-- Suction log: helpers and parents log it; other households and signed-out visitors can't see it.
\set ON_ERROR_STOP 1
\set QUIET 1

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'parent@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'helper@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'stranger@example.com');

select tests.act_as('00000000-0000-0000-0000-00000000000a');
select public.create_household('Dad', '#DCEBF2', 'Bella', '2026-09-10', 31, 2, '2026-11-10') as hid \gset
reset role;
insert into public.members (household_id, user_id, display_name, colour, role)
  values (:'hid', '00000000-0000-0000-0000-00000000000b', 'Grandma', '#ECE4F5', 'helper');
-- A second household made directly (only one can be created through the app).
insert into public.households (name) values ('Other family') returning id as other \gset
insert into public.members (household_id, user_id, display_name, role) values (:'other', '00000000-0000-0000-0000-00000000000c', 'Other', 'parent');

-- ---------------------------------------------------------------- helper logs
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select tests.must_succeed(format($$insert into public.suctions (household_id, amount, site) values (%L, 'lot', 'nose')$$, :'hid'), 'helper can log a suction');
select tests.must_succeed(format($$insert into public.suctions (household_id, amount) values (%L, 'little')$$, :'hid'), 'where is optional');
select tests.must_fail(format($$insert into public.suctions (household_id, amount) values (%L, 'huge')$$, :'hid'), 'amount must be a little, medium or a lot');
select tests.must_fail(format($$insert into public.suctions (household_id, amount, site) values (%L, 'lot', 'ear')$$, :'hid'), 'where must be nose, mouth or both');
select tests.must_fail(format($$insert into public.suctions (household_id) values (%L)$$, :'hid'), 'amount is required');
select tests.check_count($$select id from public.suctions where logged_by = (select id from public.members where display_name = 'Grandma')$$, 2, 'logged_by is stamped with the helper');
select tests.check_changed($$update public.suctions set note = 'Thick' where amount = 'lot'$$, 1, 'helper can edit a suction');
select tests.must_fail(format($$insert into public.suctions (household_id, amount) values (%L, 'lot')$$, :'other'), 'cannot log into another household');

-- ---------------------------------------------------------------- parent
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select tests.check_count('select id from public.suctions', 2, 'parent sees the helper''s suctions');
select tests.check_changed($$delete from public.suctions where amount = 'little'$$, 1, 'parent can delete a suction');

-- ---------------------------------------------------------------- outsiders
select tests.act_as('00000000-0000-0000-0000-00000000000c');
select tests.check_count('select id from public.suctions', 0, 'another household sees none');
select tests.check_changed('update public.suctions set note = null', 0, 'another household cannot edit');
select tests.check_changed('delete from public.suctions', 0, 'another household cannot delete');
reset role;
set role anon;
select tests.must_fail('select count(*) from public.suctions', 'signed-out visitors cannot read');
reset role;
select tests.check_count($$select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'suctions'$$, 1, 'suctions sync live between phones');
