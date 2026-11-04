-- Family (phase 6): invites, joining, roles, own profile.
\set ON_ERROR_STOP 1
\set QUIET 1

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'dad@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'Gran@Example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'stranger@example.com'),
  ('00000000-0000-0000-0000-00000000000d', 'mum@example.com');

select tests.act_as('00000000-0000-0000-0000-00000000000a');
select public.create_household('Dad', '#DCEBF2', 'Bella', '2026-09-10', 31, 2, '2026-11-10') as hid \gset

-- ---------------------------------------------------------------- creating invites
select token as gran_token from public.create_invite(:'hid', 'Grandma', 'helper', '  gran@example.COM ') \gset
select tests.check_count($$select * from public.invites where email = 'gran@example.com' and role = 'helper' and expires_at > now() + interval '6 days'$$, 1,
  'a parent can invite someone; the email is tidied and it lasts 7 days');
select tests.must_fail(format($$select * from public.create_invite(%L, 'X', 'helper', '')$$, :'hid'), 'an invite needs an email');
select tests.must_fail(format($$select * from public.create_invite(%L, 'X', 'helper', 'not-an-email')$$, :'hid'), 'the email must look like an email');
select token as mum_token, id as mum_invite from public.create_invite(:'hid', 'Mum', 'parent', 'mum@example.com') \gset

-- ---------------------------------------------------------------- preview (before signing in)
select tests.act_as(null);
select tests.check_count(format($$select * from public.invite_preview(%L) where display_name = 'Grandma' and baby_name = 'Bella' and email_hint = 'g•••@example.com' and status = 'ok'$$, :'gran_token'), 1,
  'the invite page can show who it is for before signing in');
select tests.check_count($$select * from public.invite_preview('nope')$$, 0, 'an unknown link shows nothing');
select tests.must_fail(format($$select public.accept_invite(%L)$$, :'gran_token'), 'signed-out visitors cannot accept');

-- ---------------------------------------------------------------- accepting
select tests.act_as('00000000-0000-0000-0000-00000000000c');
select tests.must_fail(format($$select public.accept_invite(%L)$$, :'gran_token'), 'someone with a different email cannot use the link');
select tests.check_count('select * from public.members', 0, 'and they still see nothing');
select tests.must_fail($$select public.create_household('S', '#FBE3D3', 'S', '2026-09-01', 30, 0, '2026-11-10')$$,
  'a stranger cannot start their own household');

select tests.act_as('00000000-0000-0000-0000-00000000000b');
select tests.must_succeed(format($$select public.accept_invite(%L)$$, :'gran_token'), 'the invited person can join (email matched ignoring case)');
select tests.check_count($$select * from public.members where display_name = 'Grandma' and role = 'helper' and colour = '#FBE3D3'$$, 1,
  'they join with the invited name and role, and a free colour');
select tests.check_count('select * from public.babies', 1, 'and can now see Bella');
select tests.must_fail(format($$select public.accept_invite(%L)$$, :'gran_token'), 'a link works only once');
select tests.must_fail(format($$select * from public.create_invite(%L, 'Friend', 'parent', 'f@example.com')$$, :'hid'), 'a helper cannot invite people');
select tests.check_count('select * from public.invites', 0, 'a helper cannot see invites');

-- ---------------------------------------------------------------- own profile
select tests.must_succeed(format($$select public.update_my_profile(%L, 'Granny', '#ECE4F5')$$, :'hid'), 'anyone can change their own name and colour');
select tests.check_count($$select * from public.members where display_name = 'Granny' and role = 'helper'$$, 1, 'but not their role');
select tests.check_changed($$update public.members set display_name = 'Hacked' where display_name = 'Dad'$$, 0, 'a helper cannot rename others');

-- ---------------------------------------------------------------- resend, expiry, roles, removal
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select token as new_mum_token from public.resend_invite(:'mum_invite') \gset
select tests.check_count(format($$select 1 where %L <> %L$$, :'mum_token', :'new_mum_token'), 1, 'resending makes a new link');
reset role;
update public.invites set expires_at = now() - interval '1 minute' where id = :'mum_invite';
select tests.act_as('00000000-0000-0000-0000-00000000000d');
select tests.must_fail(format($$select public.accept_invite(%L)$$, :'new_mum_token'), 'an expired invite cannot be used');
select tests.must_fail(format($$select public.accept_invite(%L)$$, :'mum_token'), 'the old link stopped working when it was resent');
select tests.act_as('00000000-0000-0000-0000-00000000000a');
select public.resend_invite(:'mum_invite');
select token as fresh_mum_token from public.invites where id = :'mum_invite' \gset
select tests.act_as('00000000-0000-0000-0000-00000000000d');
select tests.must_succeed(format($$select public.accept_invite(%L)$$, :'fresh_mum_token'), 'resending an expired invite makes it work again');
select tests.check_count($$select * from public.members where display_name = 'Mum' and role = 'parent'$$, 1, 'Mum joins as a parent');

select tests.act_as('00000000-0000-0000-0000-00000000000a');
select tests.check_changed($$update public.members set role = 'parent' where display_name = 'Granny'$$, 1, 'a parent can change someone''s role');
select tests.check_changed($$update public.members set active = false where display_name = 'Granny'$$, 1, 'a parent can remove someone');
select tests.act_as('00000000-0000-0000-0000-00000000000b');
select tests.check_count('select * from public.babies', 0, 'someone removed loses access at once');
reset role;
select tests.check_count($$select * from public.members where display_name = 'Granny' and not active$$, 1, 'their history is kept');
