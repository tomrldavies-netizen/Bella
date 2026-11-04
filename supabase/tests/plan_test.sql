-- Bella's plan (phase 3): save functions, dose versions and permissions.
\set ON_ERROR_STOP 1
\set QUIET 1

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'parent@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'helper@example.com');

select tests.act_as('00000000-0000-0000-0000-00000000000a');
select public.create_household('Dad', '#DCEBF2', 'Bella', '2026-09-10', 31, 2, '2026-11-10') as hid \gset
reset role;
insert into public.members (household_id, user_id, display_name, colour, role)
  values (:'hid', '00000000-0000-0000-0000-00000000000b', 'Grandma', '#ECE4F5', 'helper');

-- ---------------------------------------------------------------- feed plan
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select public.save_feed_plan(:'hid', '2026-11-01 00:00+00',
  '[{"time_of_day":"00:00","milk_type":"breast","volume_ml":50},{"time_of_day":"06:00","milk_type":"breast","volume_ml":50}]',
  null, 'New feed plan: 2 feeds, 100 ml a day', null, null, true) as plan1 \gset
select tests.check_count(format('select * from public.feed_plan_slots where feed_plan_id = %L', :'plan1'), 2,
  'saving a feed plan stores its slots');
select public.save_feed_plan(:'hid', '2026-11-02 00:00+00',
  '[{"time_of_day":"00:00","milk_type":"breast","volume_ml":50},{"time_of_day":"06:00","milk_type":"formula","volume_ml":50}]',
  null, '06:00 feed now formula, 50 ml', null, null, false) as plan2 \gset
select tests.check_count('select * from public.feed_plans', 2, 'a second save keeps the first plan as history');
select tests.check_count(format('select * from public.feed_plan_slots where feed_plan_id = %L', :'plan1'), 2,
  'old plan slots are untouched');
select tests.check_count($$select * from public.plan_changes where area = 'feeds' and summary = '06:00 feed now formula, 50 ml' and not notify$$, 1,
  'the change is recorded with its summary and notify setting');
select tests.must_fail(format($$select public.save_feed_plan(%L, now(),
  '[{"time_of_day":"00:00","milk_type":"breast","volume_ml":50},{"time_of_day":"00:00","milk_type":"formula","volume_ml":50}]',
  null, 'dupe', null, null, true)$$, :'hid'), 'two feeds at the same time are refused');
select tests.check_count('select * from public.feed_plans', 2, 'a refused save leaves nothing half-saved');
select tests.check_count($$select * from public.plan_changes where summary = 'dupe'$$, 0, 'and records no change');

-- ---------------------------------------------------------------- medicines
select public.save_medicine(:'hid', null, 'Iron', null, true, 'new_version',
  '{"dose":1.0,"unit":"ml","route":"mouth","times":["17:00","05:00"],"effective_from":"2026-10-01 00:00+00"}',
  'Added Iron', null, null, true) as med \gset
select tests.check_count(format($$select * from public.medicine_doses where medicine_id = %L and times = '{05:00,17:00}'$$, :'med'), 1,
  'a new medicine gets its first dose, times sorted');
select public.save_medicine(:'hid', :'med', 'Iron', null, true, 'new_version',
  '{"dose":1.2,"unit":"ml","route":"mouth","times":["05:00","17:00"],"effective_from":"2026-10-19 23:00+00","reason":"after weigh-in"}',
  'Iron 1.0 ml → 1.2 ml', null, null, true);
select tests.check_count(format($$select * from public.medicine_doses where medicine_id = %L and dose = 1.0 and effective_to = '2026-10-19 23:00+00'$$, :'med'), 1,
  'a dose change closes the previous version at the new start time');
select tests.check_count(format($$select * from public.medicine_doses where medicine_id = %L and dose = 1.2 and effective_to is null and reason = 'after weigh-in'$$, :'med'), 1,
  'and adds the new version with its reason');
-- A version scheduled for the future, then replaced before it starts.
select public.save_medicine(:'hid', :'med', 'Iron', null, true, 'new_version',
  '{"dose":1.4,"unit":"ml","route":"mouth","times":["05:00","17:00"],"effective_from":"2027-01-01 00:00+00"}', 'scheduled', null, null, true);
select public.save_medicine(:'hid', :'med', 'Iron', null, true, 'new_version',
  '{"dose":1.3,"unit":"ml","route":"mouth","times":["05:00","17:00"],"effective_from":"2026-12-01 00:00+00"}', 'y', null, null, true);
select tests.check_count(format($$select * from public.medicine_doses where medicine_id = %L and dose = 1.4$$, :'med'), 0,
  'a version that had not started yet is replaced');
select tests.check_count(format($$select * from public.medicine_doses where medicine_id = %L$$, :'med'), 3,
  'past versions are kept as history');
select public.save_medicine(:'hid', :'med', 'Iron', null, true, 'set_end', '{"effective_to":"2027-02-01 00:00+00"}',
  'Iron ends 1 Feb', null, null, true);
select tests.check_count(format($$select * from public.medicine_doses where medicine_id = %L and dose = 1.3 and effective_to = '2027-02-01 00:00+00'$$, :'med'), 1,
  'an end date can be set without a new version');
select public.save_medicine(:'hid', :'med', 'Iron (Sytron)', 'with a feed', true, 'none', null, 'Renamed', null, null, true);
select tests.check_count(format($$select * from public.medicine_doses where medicine_id = %L$$, :'med'), 3,
  'a rename does not create a dose version');
select tests.must_fail(format($$select public.save_medicine(%L, null, 'X', null, true, 'none', null, 'x', null, null, true)$$, :'hid'),
  'a new medicine needs a dose');

-- ---------------------------------------------------------------- exercises
select public.save_exercise(:'hid', null, 'physio', 'Hip stretches', 3, null, true, '["On her back", "  ", "Stop if unhappy"]',
  'Added hip stretches', null, null, true) as ex \gset
select tests.check_count(format($$select * from public.exercise_steps where exercise_id = %L$$, :'ex'), 2, 'blank steps are dropped');
select tests.check_count(format($$select * from public.exercise_steps where exercise_id = %L and position = 1 and text = 'Stop if unhappy'$$, :'ex'), 1,
  'steps keep their order');
select public.save_exercise(:'hid', :'ex', 'physio', 'Hip stretches', 2, 'After a feed', true, '["Stop if unhappy", "On her back"]',
  'Hip stretches now 2 times a day', null, null, true);
select tests.check_count(format($$select * from public.exercise_steps where exercise_id = %L and position = 0 and text = 'Stop if unhappy'$$, :'ex'), 1,
  'steps can be reordered');
select tests.check_count(format($$select * from public.exercises where id = %L and timing_note = 'After a feed' and per_day = 2$$, :'ex'), 1,
  'how often and the timing note are saved');

-- ---------------------------------------------------------------- routines
select public.save_routines(:'hid', 240, 30, 7,
  '[{"name":"Bath","recurrence":"weekly","weekdays":[4,1]},{"name":"Skin check","recurrence":"every_n_days","every_days":2}]',
  'Obs every 4 hrs', null, null, true);
select tests.check_count('select * from public.settings where obs_interval_min = 240 and tube_change_days = 7', 1, 'settings saved');
select tests.check_count($$select * from public.care_tasks where name = 'Bath' and weekdays = '{1,4}' and active$$, 1, 'weekly task saved');
select id as bath from public.care_tasks where name = 'Bath' \gset
select public.save_routines(:'hid', 240, 30, 7, format('[{"id":"%s","name":"Bath time","recurrence":"weekly","weekdays":[1]}]', :'bath')::jsonb,
  'Removed skin check', null, null, true);
select tests.check_count($$select * from public.care_tasks where name = 'Skin check' and not active$$, 1, 'a removed task is retired, not deleted');
select tests.check_count($$select * from public.care_tasks where name = 'Bath time' and weekdays = '{1}'$$, 1, 'a task can be edited');
select tests.must_fail(format($$select public.save_routines(%L, 240, 30, 7, '[{"name":"X","recurrence":"weekly","weekdays":[]}]', 'x', null, null, true)$$, :'hid'),
  'a weekly task needs at least one day');

-- ---------------------------------------------------------------- helper is refused
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select tests.check_count('select * from public.feed_plan_slots', 4, 'helper can read the feed plan');
select tests.check_count('select * from public.medicine_doses', 3, 'helper can read dose history');
select tests.must_fail(format($$select public.save_feed_plan(%L, now(), '[]', null, 'x', null, null, true)$$, :'hid'),
  'helper cannot save a feed plan');
select tests.must_fail(format($$select public.save_medicine(%L, %L, 'Iron', null, true, 'new_version',
  '{"dose":9,"unit":"ml","route":"mouth","times":["05:00"],"effective_from":"2026-11-05 00:00+00"}', 'x', null, null, true)$$, :'hid', :'med'),
  'helper cannot change a dose');
select tests.must_fail(format($$select public.save_medicine(%L, %L, 'Renamed', null, true, 'none', null, 'x', null, null, true)$$, :'hid', :'med'),
  'helper cannot rename a medicine');
select tests.must_fail(format($$select public.save_exercise(%L, %L, 'physio', 'X', 1, null, true, '[]', 'x', null, null, true)$$, :'hid', :'ex'),
  'helper cannot change an exercise');
select tests.must_fail(format($$select public.save_routines(%L, 60, 5, 1, '[]', 'x', null, null, true)$$, :'hid'),
  'helper cannot change routines');
select tests.check_count('select * from public.medicine_doses where dose = 9', 0, 'nothing a helper tried was saved');
select tests.check_count($$select * from public.plan_changes where summary = 'x'$$, 0, 'and no changes were recorded for them');
select tests.check_count('select * from public.settings where obs_interval_min = 240', 1, 'routines are unchanged');
