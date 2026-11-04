-- Logging care (phase 4): helpers log, double-dose guard.
\set ON_ERROR_STOP 1
\set QUIET 1

-- Returns the error a second "given" for the 05:00 dose raises.
create function tests.second_dose_error(hid uuid, med uuid) returns text language plpgsql as $$
declare msg text; det text;
begin
  perform public.give_medicine(hid, med, '2026-11-05 05:00+00', now(), 1.2, false);
  return 'no error';
exception when others then
  get stacked diagnostics msg = message_text, det = pg_exception_detail;
  return msg || ' ' || det;
end $$;
grant execute on function tests.second_dose_error(uuid, uuid) to authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'parent@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'helper@example.com');

select tests.act_as('00000000-0000-0000-0000-00000000000a');
select public.create_household('Dad', '#DCEBF2', 'Bella', '2026-09-10', 31, 2, '2026-11-10') as hid \gset
select public.save_medicine(:'hid', null, 'Iron', null, true, 'new_version',
  '{"dose":1.2,"unit":"ml","route":"either","times":["05:00","17:00"],"effective_from":"2026-10-01 00:00+00"}',
  'Added Iron', null, null, true) as med \gset
reset role;
insert into public.members (household_id, user_id, display_name, colour, role)
  values (:'hid', '00000000-0000-0000-0000-00000000000b', 'Grandma', '#ECE4F5', 'helper');

-- ---------------------------------------------------------------- helper logs care
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select tests.must_succeed(format($$insert into public.feeds (household_id, method, oral_ml, tube_ml, milk_type, fortified, sick_level)
  values (%L, 'bottle_tube', 15, 35, 'breast', true, 'posset')$$, :'hid'), 'helper can log a feed');
select tests.must_succeed(format($$insert into public.nappies (household_id, wet, dirty) values (%L, true, true)$$, :'hid'), 'helper can log a nappy');
select tests.must_succeed(format($$insert into public.tube_changes (household_id, nostril) values (%L, 'left')$$, :'hid'), 'helper can log a tube change');
select tests.check_changed('update public.tube_changes set retaped_at = now()', 1, 'helper can record a retape');
select tests.must_succeed(format($$insert into public.notes (household_id, text) values (%L, 'Lovely settled evening')$$, :'hid'), 'helper can write a note');
select tests.must_fail(format($$insert into public.nappies (household_id, wet, dirty) values (%L, false, false)$$, :'hid'), 'a nappy must be wet or dirty');

-- ---------------------------------------------------------------- double-dose guard
select public.give_medicine(:'hid', :'med', '2026-11-05 05:00+00', '2026-11-05 05:02+00', 1.2, false) as g1 \gset
select tests.check_count(format($$select * from public.medicine_given g join public.members m on m.id = g.logged_by
  where g.id = %L and m.display_name = 'Grandma' and g.dose_given = 1.2$$, :'g1'), 1, 'helper can mark a dose given, stamped with their name');

select tests.act_as('00000000-0000-0000-0000-00000000000a');
select tests.check_count(format($$select 1 where tests.second_dose_error(%L, %L) like 'ALREADY_GIVEN {"by" : "Grandma"%%'$$, :'hid', :'med'), 1,
  'a second "given" for the same dose is refused and says who gave it');
select tests.check_count(format($$select * from public.medicine_given where medicine_id = %L$$, :'med'), 1, 'so only one is recorded');
select tests.must_succeed(format($$select public.give_medicine(%L, %L, '2026-11-05 05:00+00', now(), 1.2, true)$$, :'hid', :'med'),
  'after confirming, a repeat can be logged');
select tests.must_succeed(format($$select public.give_medicine(%L, %L, '2026-11-05 17:00+00', now(), 1.2, false)$$, :'hid', :'med'),
  'a different dose time is not blocked');
select tests.must_succeed(format($$select public.give_medicine(%L, %L, null, now(), 1.2, false)$$, :'hid', :'med'),
  'an unscheduled dose is not blocked');
select tests.check_count(format($$select * from public.medicine_given where medicine_id = %L$$, :'med'), 4, 'all intended doses recorded');

-- ---------------------------------------------------------------- care logs (phase 5)
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select tests.must_succeed(format($$insert into public.obs (household_id, temperature_c, breathing, sleep) values (%L, 36.8, 'normal', 'settled')$$, :'hid'),
  'helper can log obs');
select tests.must_succeed(format($$insert into public.tummy_time (household_id, duration_min) values (%L, 6)$$, :'hid'), 'helper can log tummy time');
select tests.must_succeed(format($$insert into public.weights (household_id, measured_on, weight_g) values (%L, '2026-11-05', 2310)$$, :'hid'),
  'helper can log a weigh-in');
select tests.must_fail(format($$insert into public.obs (household_id, temperature_c) values (%L, 50)$$, :'hid'), 'an impossible temperature is refused');
select tests.check_changed('update public.settings set temp_min_c = 30, temp_max_c = 40', 0, 'helper cannot change the temperature range');
