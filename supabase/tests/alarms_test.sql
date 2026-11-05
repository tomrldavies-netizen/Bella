-- Alarm mode (feeds and medicines): repeats, stop, snooze, quiet and work hours.
-- December dates, so UK time = UTC. 3 Dec 2026 is a Thursday.
\set ON_ERROR_STOP 1
\set QUIET 1

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'dad@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'mum@example.com');

select tests.act_as('00000000-0000-0000-0000-00000000000a');
select public.create_household('Dad', '#DCEBF2', 'Bella', '2026-09-10', 31, 2, '2026-11-10') as hid \gset
select public.save_feed_plan(:'hid', '2026-11-01 00:00+00', '[{"time_of_day":"14:00","milk_type":"formula","volume_ml":55}]', null, 'x', null, null, false);
select public.save_medicine(:'hid', null, 'Iron', null, true, 'new_version',
  '{"dose":1.2,"unit":"ml","route":"either","times":["11:00"],"effective_from":"2026-11-01 00:00+00"}', 'x', null, null, false) as iron \gset
select tests.act_as(null);
reset role;
insert into public.members (household_id, user_id, display_name, colour, role) values (:'hid', '00000000-0000-0000-0000-00000000000b', 'Mum', '#FBE3D3', 'parent');
update public.members set created_at = '2026-11-01';
select id as dad from public.members where display_name = 'Dad' \gset
select id as mum from public.members where display_name = 'Mum' \gset
insert into public.push_subscriptions (household_id, member_id, endpoint, keys) values
  (:'hid', :'dad', 'https://push.example/dad', '{}'), (:'hid', :'mum', 'https://push.example/mum', '{}');

-- Dad: alarms for feeds and medicines, works Mon–Fri 09:00–12:00. Mum: no alarms.
update public.members set reminder_settings = '{"alarm":{"feed":true,"medicine":true},"work":{"days":[1,2,3,4,5],"start":"09:00","end":"12:00"}}' where id = :'dad';

create temp table run as select * from public.reminder_run('2026-12-03 13:00+00') limit 0;
create function pg_temp.run_at(t timestamptz) returns void language sql as $$
  truncate run; insert into run select * from public.reminder_run(t);
$$;
create function pg_temp.got() returns setof text language sql as $$
  select split_part(endpoint, '/', 4) || ':' || (payload ->> 'kind') from run order by 1
$$;

-- ---------------------------------------------------------------- feed alarm
select pg_temp.run_at('2026-12-03 13:50+00');
select tests.check_count($$select * from pg_temp.got() g where g = 'dad:alarm'$$, 1, 'Dad''s first feed reminder is alarm-style');
select tests.check_count($$select * from pg_temp.got() g where g = 'mum:reminder'$$, 1, 'Mum''s is an ordinary notification');
select tests.check_count($$select * from run where payload ->> 'alarm_token' is not null and endpoint like '%dad'$$, 1, 'with a token for Stop/Snooze');
select pg_temp.run_at('2026-12-03 13:56+00');
select tests.check_count('select * from run', 0, 'no repeats before the due time');
select pg_temp.run_at('2026-12-03 14:00+00');
select tests.check_count($$select * from pg_temp.got() g where g = 'dad:alarm'$$, 1, 'at the due time it rings again');
select tests.check_count($$select * from pg_temp.got() g where g like 'mum:%'$$, 0, 'Mum isn''t alarmed');
select pg_temp.run_at('2026-12-03 14:01+00');
select tests.check_count('select * from run', 0, 'not every minute');
select pg_temp.run_at('2026-12-03 14:02+00');
select tests.check_count($$select * from pg_temp.got() g where g = 'dad:alarm'$$, 1, 'every 2 minutes');
select pg_temp.run_at('2026-12-03 14:04+00');
select tests.check_count($$select * from run where payload ->> 'title' like '⏰ Feed due at 14:00'$$, 1, 'repeats say it''s still not logged');

-- Snooze, then Stop, from the notification (token only, no sign-in).
select token as tok from public.reminder_alarms a join public.reminders_sent r on r.id = a.reminder_id where r.type = 'feed' \gset
select tests.act_as(null);
select tests.must_succeed(format($$select public.alarm_action(%L, 'snooze')$$, :'tok'), 'Snooze works from a notification button');
reset role;
select tests.check_count(format($$select * from public.reminder_alarms where token = %L and snooze_until is not null$$, :'tok'), 1, 'snooze is recorded');
-- Pretend the 5-minute snooze was pressed at 14:04 (it runs off the real clock).
update public.reminder_alarms set snooze_until = '2026-12-03 14:09+00' where token = :'tok';
select pg_temp.run_at('2026-12-03 14:06+00');
select tests.check_count('select * from run', 0, 'snoozed: no ring');
select pg_temp.run_at('2026-12-03 14:09+00');
select tests.check_count($$select * from pg_temp.got() g where g = 'dad:alarm'$$, 1, 'rings again when the snooze ends');
select tests.act_as(null);
select tests.must_succeed(format($$select public.alarm_action(%L, 'stop')$$, :'tok'), 'Stop works from a notification button');
reset role;
select pg_temp.run_at('2026-12-03 14:11+00');
select tests.check_count('select * from run', 0, 'stopped: no more rings');

-- ---------------------------------------------------------------- 20-minute limit and clear-on-log
select tests.act_as(null);
reset role;
-- Friday 4 Dec, 10:50: Dad is at work (09:00–12:00), so his medicine reminder is an ordinary notification.
select pg_temp.run_at('2026-12-04 10:50+00');
select tests.check_count($$select * from pg_temp.got() g where g = 'dad:reminder'$$, 1, 'during work hours an alarm falls back to a notification');
select pg_temp.run_at('2026-12-04 11:00+00');
select tests.check_count('select * from run', 0, 'and doesn''t repeat');

-- Saturday 5 Dec (not a work day): the feed alarm repeats until 20 minutes after, then stops.
select pg_temp.run_at('2026-12-05 13:50+00');
select pg_temp.run_at('2026-12-05 14:00+00');
select pg_temp.run_at('2026-12-05 14:18+00');
select tests.check_count($$select * from pg_temp.got() g where g = 'dad:alarm'$$, 1, 'still ringing 18 minutes after');
select pg_temp.run_at('2026-12-05 14:22+00');
select tests.check_count('select * from run', 0, 'no rings after 20 minutes');

-- Saturday medicine: logged mid-alarm stops it and quietly replaces the notification.
select pg_temp.run_at('2026-12-05 10:50+00');
select pg_temp.run_at('2026-12-05 11:00+00');
select tests.check_count($$select * from pg_temp.got() g where g = 'dad:alarm'$$, 1, 'medicine alarm rings at the due time');
insert into public.medicine_given (household_id, logged_by, medicine_id, scheduled_for, given_at) values (:'hid', :'mum', :'iron', '2026-12-05 11:00+00', '2026-12-05 11:01+00');
select pg_temp.run_at('2026-12-05 11:02+00');
select tests.check_count($$select * from pg_temp.got() g where g like '%:alarm'$$, 0, 'once given, the alarm stops');
select tests.check_count($$select * from pg_temp.got() g where g = 'dad:done'$$, 1, 'and Dad''s notification is quietly replaced');

-- Quiet hours win over alarms too.
update public.members set reminder_settings = reminder_settings || '{"quiet":{"start":"13:00","end":"15:00"}}' where id = :'dad';
select pg_temp.run_at('2026-12-06 13:50+00');
select tests.check_count($$select * from pg_temp.got() g where g like 'dad:%'$$, 0, 'quiet hours: no feed reminder at all for Dad');

-- ---------------------------------------------------------------- the app's view, and permissions
update public.members set reminder_settings = '{"alarm":{"feed":true}}' where id = :'dad';
select pg_temp.run_at('2026-12-07 13:55+00');
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select tests.check_count($$select * from public.my_alarms('2026-12-07 13:56+00') where type = 'feed' and title = 'Feed due at 14:00'$$, 1, 'the app can see Dad''s ringing alarm');
select tests.must_fail('select * from public.reminder_alarms', 'but not the alarms table directly');
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select tests.check_count($$select * from public.my_alarms('2026-12-07 13:56+00')$$, 0, 'Mum doesn''t see Dad''s alarms');
select tests.must_fail($$select public.alarm_action('x', 'explode')$$, 'unknown actions are refused');
