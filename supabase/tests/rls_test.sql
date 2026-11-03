-- Row Level Security tests. Run with scripts/test-db.sh.
-- Acts as a parent, a helper, an outsider and a signed-out visitor.
\set ON_ERROR_STOP 1
\set QUIET 1

create schema tests;
grant usage on schema tests to anon, authenticated;

-- Switch to a signed-in user (or signed out when uid is null).
create function tests.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  perform set_config('role', case when uid is null then 'anon' else 'authenticated' end, false);
end $$;

create function tests.must_fail(q text, why text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    raise notice 'ok (blocked): % [%]', why, sqlerrm;
    return;
  end;
  raise exception 'FAIL: expected this to be blocked: %', why;
end $$;

create function tests.must_succeed(q text, why text) returns void language plpgsql as $$
begin
  execute q;
  raise notice 'ok: %', why;
end $$;

create function tests.check_count(q text, expected bigint, why text) returns void language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || q || ') t' into n;
  if n <> expected then
    raise exception 'FAIL: % (expected %, got %)', why, expected, n;
  end if;
  raise notice 'ok: %', why;
end $$;

-- Rows changed by an UPDATE/DELETE (RLS filters silently rather than erroring).
create function tests.check_changed(q text, expected bigint, why text) returns void language plpgsql as $$
declare n bigint;
begin
  execute q;
  get diagnostics n = row_count;
  if n <> expected then
    raise exception 'FAIL: % (expected % rows changed, got %)', why, expected, n;
  end if;
  raise notice 'ok: %', why;
end $$;

grant execute on all functions in schema tests to anon, authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'parent@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'helper@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'outsider@example.com'),
  ('00000000-0000-0000-0000-00000000000d', 'parent2@example.com');

-- ---------------------------------------------------------------- setup
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select public.create_household('Dad', '#DCEBF2', 'Bella', '2026-09-10', 31, 2, '2026-11-12') as hid \gset
select tests.check_count('select * from public.members where role = ''parent''', 1, 'creator becomes the first parent');
select tests.check_count('select * from public.babies', 1, 'baby created');
select tests.check_count('select * from public.settings where tummy_goal_min = 30', 1, 'default settings created');
select tests.must_fail($$select public.create_household('Dad', '#DCEBF2', 'B', '2026-09-10', 31, 2, '2026-11-12')$$,
  'cannot create a second household');
select id as parent_mid from public.members where user_id = auth.uid() \gset

-- Parent adds a helper (this is what invites will do in phase 6).
select tests.must_succeed(format($$insert into public.members (household_id, user_id, display_name, colour, role)
  values (%L, '00000000-0000-0000-0000-00000000000b', 'Grandma', '#ECE4F5', 'helper')$$, :'hid'),
  'parent can add a helper');
select id as helper_mid from public.members where user_id = '00000000-0000-0000-0000-00000000000b' \gset

-- Parent writes the plan.
select tests.must_succeed(format($$insert into public.feed_plans (household_id, effective_from) values (%L, now())$$, :'hid'),
  'parent can create a feed plan');
select id as plan_id from public.feed_plans limit 1 \gset
select tests.check_count(format($$select * from public.feed_plans where created_by = %L$$, :'parent_mid'), 1,
  'feed plan created_by is stamped with the parent');
select tests.must_succeed(format($$insert into public.feed_plan_slots (household_id, feed_plan_id, time_of_day, milk_type, volume_ml)
  values (%L, %L, '06:00', 'breast', 50)$$, :'hid', :'plan_id'), 'parent can add a feed slot');
select id as slot_id from public.feed_plan_slots limit 1 \gset
select tests.must_succeed(format($$insert into public.medicines (household_id, name) values (%L, 'Test medicine')$$, :'hid'),
  'parent can add a medicine');
select tests.must_succeed(format($$insert into public.invites (household_id, display_name, role) values (%L, 'Grandad', 'helper')$$, :'hid'),
  'parent can create an invite');
select tests.must_succeed(format($$insert into public.plan_changes (household_id, area, summary) values (%L, 'feeds', 'test')$$, :'hid'),
  'parent can record a plan change');
select id as change_id from public.plan_changes limit 1 \gset
select tests.must_fail(format($$insert into public.nappies (household_id, wet, logged_by) values (%L, true, %L)$$, :'hid', :'helper_mid'),
  'parent cannot log a nappy in the helper''s name');

-- ---------------------------------------------------------------- helper
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select tests.check_count('select * from public.babies', 1, 'helper can see the baby');
select tests.check_count('select * from public.feed_plan_slots', 1, 'helper can see the feed plan');
select tests.check_count('select * from public.members', 2, 'helper can see household members');
select tests.must_succeed(format($$insert into public.nappies (household_id, wet) values (%L, true)$$, :'hid'),
  'helper can log a nappy');
select tests.check_count(format($$select * from public.nappies where logged_by = %L$$, :'helper_mid'), 1,
  'nappy logged_by is stamped with the helper');
select tests.must_succeed(format($$insert into public.feeds (household_id, feed_plan_slot_id, tube_ml, milk_type) values (%L, %L, 50, 'breast')$$, :'hid', :'slot_id'),
  'helper can log a feed against the plan');
select tests.must_fail(format($$insert into public.nappies (household_id, wet, logged_by) values (%L, true, %L)$$, :'hid', :'parent_mid'),
  'helper cannot log in someone else''s name');
select tests.must_fail(format($$update public.nappies set logged_by = %L$$, :'parent_mid'),
  'logged_by cannot be changed');
select tests.must_fail(format($$update public.nappies set household_id = gen_random_uuid()$$),
  'household_id cannot be changed');
select tests.check_changed('update public.nappies set dirty = true', 1, 'helper can edit a log entry');

select tests.must_fail(format($$insert into public.feed_plans (household_id, effective_from) values (%L, now())$$, :'hid'),
  'helper cannot create a feed plan');
select tests.must_fail(format($$insert into public.feed_plan_slots (household_id, feed_plan_id, time_of_day, milk_type, volume_ml)
  values (%L, %L, '09:00', 'formula', 60)$$, :'hid', :'plan_id'), 'helper cannot add a feed slot');
select tests.check_changed('update public.feed_plan_slots set volume_ml = 99', 0, 'helper cannot change a feed amount');
select tests.check_changed('update public.medicines set name = ''x''', 0, 'helper cannot change a medicine');
select tests.check_changed('update public.settings set tummy_goal_min = 5', 0, 'helper cannot change settings');
select tests.check_changed('delete from public.feed_plan_slots', 0, 'helper cannot delete the feed plan');
select tests.check_changed('update public.babies set name = ''x''', 0, 'helper cannot change baby details');
select tests.must_fail(format($$insert into public.plan_changes (household_id, area, summary) values (%L, 'feeds', 'x')$$, :'hid'),
  'helper cannot record a plan change');
select tests.check_changed('update public.members set role = ''parent''', 0, 'helper cannot promote themselves');
select tests.must_fail(format($$insert into public.members (household_id, user_id, display_name, role)
  values (%L, '00000000-0000-0000-0000-00000000000c', 'Stranger', 'parent')$$, :'hid'), 'helper cannot add members');
select tests.check_count('select * from public.invites', 0, 'helper cannot see invites');
select tests.must_fail(format($$insert into public.invites (household_id, display_name, role) values (%L, 'X', 'parent')$$, :'hid'),
  'helper cannot create invites');
select tests.must_succeed(format($$insert into public.plan_change_seen (household_id, plan_change_id) values (%L, %L)$$, :'hid', :'change_id'),
  'helper can mark a plan change as seen');
select tests.must_fail(format($$insert into public.plan_change_seen (household_id, plan_change_id, member_id) values (%L, %L, %L)$$, :'hid', :'change_id', :'parent_mid'),
  'helper cannot mark a change as seen for someone else');
select tests.must_succeed(format($$insert into public.push_subscriptions (household_id, member_id, endpoint, keys)
  values (%L, %L, 'https://push.example/helper', '{}')$$, :'hid', :'helper_mid'), 'helper can save their own push subscription');
select tests.check_changed($$update public.push_subscriptions set settings = '{"feeds": false}'$$, 1, 'helper can update their own push settings');

-- ---------------------------------------------------------------- parent again
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select tests.check_count('select * from public.push_subscriptions', 0, 'parent cannot see the helper''s push subscription');
select tests.must_fail(format($$update public.members set role = 'helper' where id = %L$$, :'parent_mid'),
  'the last parent cannot demote themselves');
select tests.check_changed(format($$update public.members set active = false where id = %L$$, :'helper_mid'), 1,
  'parent can remove a helper');

-- ---------------------------------------------------------------- removed helper
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select tests.check_count('select * from public.babies', 0, 'a removed helper sees nothing');
select tests.must_fail(format($$insert into public.nappies (household_id, wet) values (%L, true)$$, :'hid'),
  'a removed helper cannot log');

-- ---------------------------------------------------------------- outsider
select tests.act_as('00000000-0000-0000-0000-00000000000c');
select tests.check_count('select * from public.households', 0, 'outsider sees no households');
select tests.check_count('select * from public.babies', 0, 'outsider sees no babies');
select tests.check_count('select * from public.feeds', 0, 'outsider sees no feeds');
select tests.check_count('select * from public.members', 0, 'outsider sees no members');
select tests.must_fail(format($$insert into public.members (household_id, user_id, display_name, role)
  values (%L, '00000000-0000-0000-0000-00000000000c', 'Me', 'parent')$$, :'hid'), 'outsider cannot add themselves');
select tests.must_fail(format($$insert into public.nappies (household_id, wet) values (%L, true)$$, :'hid'),
  'outsider cannot log into the household');
select tests.check_changed('update public.feed_plan_slots set volume_ml = 1', 0, 'outsider cannot change the plan');
-- Outsider starts their own household, then tries to point at Bella's plan.
select public.create_household('Other', '#FBE3D3', 'Other baby', '2026-09-01', 30, 0, '2026-11-10') as other_hid \gset
select tests.check_count('select * from public.babies', 1, 'outsider only sees their own baby');
select tests.must_fail(format($$insert into public.feeds (household_id, feed_plan_slot_id, tube_ml) values (%L, %L, 10)$$, :'other_hid', :'slot_id'),
  'cannot link a feed to another household''s plan');

-- ---------------------------------------------------------------- signed out
select tests.act_as(null);
select tests.must_fail('select * from public.babies', 'signed-out visitor cannot read anything');
select tests.must_fail($$select public.create_household('x', '#FFFFFF', 'x', '2026-01-01', 30, 0, '2026-03-01')$$,
  'signed-out visitor cannot create a household');

-- ---------------------------------------------------------------- cleanup
reset role;
select tests.must_succeed(format($$delete from public.households where id = %L$$, :'other_hid'),
  'deleting a whole household still works');
