-- Reminders (phase 8): what's due, who gets it, quiet hours, clear-on-log.
-- All times are in December, when UK time = UTC.
\set ON_ERROR_STOP 1
\set QUIET 1

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'dad@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'mum@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'gran@example.com');

select tests.act_as('00000000-0000-0000-0000-00000000000a');
select public.create_household('Dad', '#DCEBF2', 'Bella', '2026-09-10', 31, 2, '2026-11-10') as hid \gset
select public.save_feed_plan(:'hid', '2026-11-01 00:00+00',
  '[{"time_of_day":"21:00","milk_type":"breast","volume_ml":50},{"time_of_day":"00:00","milk_type":"formula","volume_ml":55}]',
  null, 'New feed plan', null, null, false);
select public.save_medicine(:'hid', null, 'Iron', null, true, 'new_version',
  '{"dose":1.2,"unit":"ml","route":"either","times":["23:00"],"effective_from":"2026-11-01 00:00+00"}', 'Added Iron', null, null, false) as iron \gset
select public.save_medicine(:'hid', null, 'Vitamin drops', null, true, 'new_version',
  '{"dose":0.5,"unit":"ml","route":"mouth","times":["09:00"],"effective_from":"2026-11-01 00:00+00"}', 'Added Vitamin drops', null, null, false) as vit \gset
select tests.act_as(null);
reset role;
insert into public.members (household_id, user_id, display_name, colour, role, created_at)
  values (:'hid', '00000000-0000-0000-0000-00000000000b', 'Mum', '#FBE3D3', 'parent', '2026-11-01'),
         (:'hid', '00000000-0000-0000-0000-00000000000c', 'Grandma', '#ECE4F5', 'helper', '2026-11-01');
update public.members set created_at = '2026-11-01' where household_id = :'hid';
select id as dad from public.members where display_name = 'Dad' \gset
select id as mum from public.members where display_name = 'Mum' \gset
select id as gran from public.members where display_name = 'Grandma' \gset
insert into public.push_subscriptions (household_id, member_id, endpoint, keys) values
  (:'hid', :'dad', 'https://push.example/dad', '{"p256dh":"x","auth":"y"}'),
  (:'hid', :'mum', 'https://push.example/mum', '{"p256dh":"x","auth":"y"}'),
  (:'hid', :'gran', 'https://push.example/gran', '{"p256dh":"x","auth":"y"}');

-- Dad: quiet hours 22:00–06:00. Mum: 30 minutes' notice for medicines.
update public.members set reminder_settings = '{"quiet":{"start":"22:00","end":"06:00"}}' where id = :'dad';
update public.members set reminder_settings = '{"lead":{"medicine":30}}' where id = :'mum';

create temp table run as select * from public.reminder_run('2026-12-03 20:49+00') limit 0;
create function pg_temp.run_at(t timestamptz) returns void language sql as $$
  truncate run; insert into run select * from public.reminder_run(t);
$$;
-- e.g. "dad:reminder:Feed due at 21:00"
create function pg_temp.got() returns setof text language sql as $$
  select split_part(endpoint, '/', 4) || ':' || (payload ->> 'kind') || ':' || (payload ->> 'title') from run order by 1
$$;

-- ---------------------------------------------------------------- feed due, 10 minutes' notice
select pg_temp.run_at('2026-12-03 20:49+00');
select tests.check_count('select * from run', 0, 'nothing is sent before the 10-minute notice');
select pg_temp.run_at('2026-12-03 20:50+00');
select tests.check_count($$select * from pg_temp.got() g where g in ('dad:reminder:Feed due at 21:00', 'mum:reminder:Feed due at 21:00')$$, 2,
  'both parents are told 10 minutes before a planned feed');
select tests.check_count($$select * from run where payload ->> 'body' = '50 ml breast milk' and payload ->> 'url' = '#/feeds'$$, 2, 'with the planned amount and a link to Feeds');
select tests.check_count($$select * from pg_temp.got() g where g like 'gran:%'$$, 0, 'helpers are not told by default');
select pg_temp.run_at('2026-12-03 20:51+00');
select tests.check_count('select * from run', 0, 'a reminder is only sent once');

-- ---------------------------------------------------------------- clear on log
insert into public.feeds (household_id, logged_by, logged_at, tube_ml) values (:'hid', :'mum', '2026-12-03 20:55+00', 50);
select pg_temp.run_at('2026-12-03 20:56+00');
select tests.check_count($$select * from run where payload ->> 'kind' = 'done' and payload ->> 'title' = '✓ Fed'
  and payload ->> 'body' = 'Feed logged by Mum at 20:55' and (payload ->> 'silent')::boolean$$, 2,
  'once Mum logs the feed, both notifications are quietly replaced');
select pg_temp.run_at('2026-12-03 20:57+00');
select tests.check_count('select * from run', 0, 'and only once');

-- ---------------------------------------------------------------- medicines and quiet hours
select pg_temp.run_at('2026-12-03 22:30+00');
select tests.check_count($$select * from pg_temp.got() g where g = 'mum:reminder:Iron due at 23:00'$$, 1, 'Mum gets her 30 minutes'' notice');
select tests.check_count($$select * from pg_temp.got() g where g like 'dad:%'$$, 0, 'Dad (10 minutes) is not told yet');
select pg_temp.run_at('2026-12-03 22:50+00');
select tests.check_count($$select * from pg_temp.got() g where g = 'dad:reminder:Iron due at 23:00'$$, 1, 'quiet hours never silence medicines');
select pg_temp.run_at('2026-12-03 23:50+00');
select tests.check_count($$select * from pg_temp.got() g where g = 'mum:reminder:Feed due at 00:00'$$, 1, 'Mum is told about the midnight feed');
select tests.check_count($$select * from pg_temp.got() g where g like 'dad:%'$$, 0, 'Dad''s quiet hours hold other reminders');

-- A dose given before its reminder: nobody is told.
insert into public.medicine_given (household_id, logged_by, medicine_id, scheduled_for, given_at) values (:'hid', :'mum', :'vit', '2026-12-04 09:00+00', '2026-12-04 08:15+00');
select pg_temp.run_at('2026-12-04 08:50+00');
select tests.check_count($$select * from pg_temp.got() g where g like '%Vitamin drops%'$$, 0, 'a dose already given is not reminded');

-- No follow-up for a late dose (agreed): the 23:00 Iron was never given.
select pg_temp.run_at('2026-12-04 00:30+00');
select tests.check_count($$select * from pg_temp.got() g where g like '%Iron%'$$, 0, 'no second reminder for a dose not marked given');

-- ---------------------------------------------------------------- helpers can opt in
update public.members set reminder_settings = '{"types":{"medicine":true}}' where id = :'gran';
select pg_temp.run_at('2026-12-04 22:50+00');
select tests.check_count($$select * from pg_temp.got() g where g = 'gran:reminder:Iron due at 23:00'$$, 1, 'a helper who turns medicines on is told');
update public.members set reminder_settings = '{"types":{"medicine":false}}' where id = :'mum';
select pg_temp.run_at('2026-12-05 22:50+00');
select tests.check_count($$select * from pg_temp.got() g where g like 'mum:%Iron%'$$, 0, 'a parent can turn a type off');

-- ---------------------------------------------------------------- plan changes
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select public.save_routines(:'hid', 240, 30, 7, null, null, '[]', 'Obs every 4 hrs', null, null, true);
select tests.act_as(null);
reset role;
select pg_temp.run_at(now());
select tests.check_count($$select * from pg_temp.got() g where g like '%Bella''s plan changed'$$, 2, 'a plan change goes to everyone else');
select tests.check_count($$select * from pg_temp.got() g where g like 'dad:%plan changed'$$, 0, 'but not to the person who made it');

-- ---------------------------------------------------------------- supplies
insert into public.supplies (household_id, name, quantity, low_threshold) values (:'hid', 'NG tubes', 2, 3) returning id as tubes \gset
select pg_temp.run_at('2026-12-06 12:00+00');
select tests.check_count($$select * from pg_temp.got() g where g like '%:reminder:NG tubes running low'$$, 2, 'parents hear once when a supply runs low');
select pg_temp.run_at('2026-12-06 12:00+00');
select tests.check_count($$select * from pg_temp.got() g where g like '%NG tubes%'$$, 0, 'and not again');
update public.supplies set quantity = 10 where id = :'tubes';
select pg_temp.run_at('2026-12-06 12:00+00');
select tests.check_count($$select * from pg_temp.got() g where g like '%:done:✓ Restocked'$$, 2, 'restocking replaces the alert');

-- ---------------------------------------------------------------- permissions
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select tests.must_fail('select * from public.reminder_run()', 'signed-in users cannot run reminders');
select tests.must_fail('select * from public.reminder_deliveries', 'or read who was sent what');
select tests.must_succeed(format($$select public.update_my_reminders(%L, '{"types":{"feed":false}}')$$, :'hid'), 'anyone can change their own reminder settings');
select tests.check_count($$select * from public.members where display_name = 'Dad' and reminder_settings -> 'types' ->> 'feed' = 'false'$$, 1, 'saved on their own row');
