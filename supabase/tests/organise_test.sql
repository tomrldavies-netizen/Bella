-- Plan screen and summary (phase 7): who can change what.
\set ON_ERROR_STOP 1
\set QUIET 1

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'dad@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'gran@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'stranger@example.com');

select tests.act_as('00000000-0000-0000-0000-00000000000a');
select public.create_household('Dad', '#DCEBF2', 'Bella', '2026-09-10', 31, 2, '2026-11-10') as hid \gset
select public.save_medicine(:'hid', null, 'Iron', null, true, 'new_version',
  '{"dose":1.2,"unit":"ml","route":"either","times":["05:00","17:00"],"effective_from":"2026-10-01 00:00+00"}', 'Added Iron', null, null, true) as med \gset
insert into public.supplies (household_id, name, quantity, low_threshold) values (:'hid', 'Syringes', 24, 10) returning id as syringes \gset
insert into public.appointments (household_id, starts_at, with_whom) values (:'hid', '2026-11-10 10:30+00', 'Community nurse') returning id as appt \gset
insert into public.prescriptions (household_id, medicine_id, bottle_volume, opened_at) values (:'hid', :'med', 50, '2026-11-01') returning id as rx \gset
select public.save_routines(:'hid', null, 30, null, null, null, '[{"name":"Bath","recurrence":"weekly","weekdays":[1,4]}]', 'Added Bath', null, null, true);
select id as bath from public.care_tasks where name = 'Bath' \gset
select id as change_id from public.plan_changes where summary = 'Added Bath' \gset
reset role;
insert into public.members (household_id, user_id, display_name, colour, role) values (:'hid', '00000000-0000-0000-0000-00000000000b', 'Grandma', '#ECE4F5', 'helper');

-- ---------------------------------------------------------------- helper
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select tests.must_succeed(format($$select public.set_supply_quantity(%L, 23)$$, :'syringes'), 'a helper can change a supply count');
select tests.check_count('select * from public.supplies where quantity = 23 and low_threshold = 10', 1, 'only the count changed');
select tests.must_fail(format($$select public.set_supply_quantity(%L, -1)$$, :'syringes'), 'a count cannot go below zero');
select tests.check_changed('update public.supplies set low_threshold = 0', 0, 'a helper cannot change the low-stock level');
select tests.must_fail(format($$insert into public.supplies (household_id, name) values (%L, 'Wipes')$$, :'hid'), 'a helper cannot add supply items');
select tests.check_changed('delete from public.supplies', 0, 'a helper cannot remove supply items');
select tests.must_succeed(format($$insert into public.questions (household_id, text, appointment_id) values (%L, 'How long will she need iron?', %L)$$, :'hid', :'appt'),
  'a helper can add a question for an appointment');
select tests.check_changed($$update public.questions set answered = true, answer = 'Until 6 months'$$, 1, 'a helper can mark a question answered');
select tests.must_fail(format($$insert into public.appointments (household_id, starts_at) values (%L, now())$$, :'hid'), 'a helper cannot add appointments');
select tests.check_changed('update public.prescriptions set reordered_at = now()', 0, 'a helper cannot change prescriptions');
select tests.must_succeed(format($$insert into public.care_task_logs (household_id, care_task_id) values (%L, %L)$$, :'hid', :'bath'), 'a helper can tick off a care task');
select tests.must_succeed(format($$insert into public.expressing_sessions (household_id, duration_min, left_ml, right_ml, storage) values (%L, 15, 40, 35, 'freezer')$$, :'hid'),
  'a helper can log expressing');
select tests.check_changed('update public.expressing_sessions set used_at = now()', 1, 'and mark frozen milk used');
select tests.must_succeed(format($$insert into public.milestones (household_id, title, date) values (%L, 'First full bottle', '2026-11-02')$$, :'hid'),
  'a helper can add a first');
select tests.must_succeed(format($$insert into public.plan_change_seen (household_id, plan_change_id) values (%L, %L)$$, :'hid', :'change_id'),
  'a helper can say they have seen a plan change');
select tests.must_fail(format($$insert into public.plan_change_seen (household_id, plan_change_id) values (%L, %L)$$, :'hid', :'change_id'),
  'but only once');

-- ---------------------------------------------------------------- parent
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select tests.check_changed('update public.prescriptions set reordered_at = now()', 1, 'a parent can mark a prescription reordered');
select tests.must_succeed(format($$insert into public.prescriptions (household_id, medicine_id, bottle_volume) values (%L, %L, 50)$$, :'hid', :'med'),
  'a parent can log a new bottle opened');
select tests.must_succeed(format($$select public.set_supply_quantity(%L, 30)$$, :'syringes'), 'a parent can change a count too');

-- ---------------------------------------------------------------- stranger
select tests.act_as('00000000-0000-0000-0000-00000000000c');
select tests.must_fail(format($$select public.set_supply_quantity(%L, 0)$$, :'syringes'), 'a stranger cannot change supplies');
select tests.check_count('select * from public.questions', 0, 'or see questions');
