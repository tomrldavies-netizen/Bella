-- Bella's Safari: phase 6, family invites and roles.
--
-- How to apply: Supabase dashboard → SQL Editor → New query → paste this
-- whole file → Run. Run it once, after the phase 5 file.
--
-- From this phase new people can create an account (sign-ups are turned back
-- on in Supabase), but an account on its own sees nothing: joining needs a
-- valid invite for that email, and no one can start a second household.

-- ---------------------------------------------------------------------------
-- 1. Only one household: the first person to set up the app.
-- ---------------------------------------------------------------------------
create or replace function public.create_household(
  p_display_name text,
  p_colour text,
  p_baby_name text,
  p_birth_date date,
  p_gestation_weeks int,
  p_gestation_days int,
  p_due_date date
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  hid uuid;
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  if exists (select 1 from public.members m where m.user_id = uid and m.active) then
    raise exception 'You are already in a household' using errcode = '23505';
  end if;
  if exists (select 1 from public.households) then
    raise exception 'Bella''s Safari is already set up. Ask a parent to invite you.' using errcode = '42501';
  end if;

  insert into public.households default values returning id into hid;
  insert into public.members (household_id, user_id, display_name, colour, role)
    values (hid, uid, p_display_name, p_colour, 'parent');
  insert into public.babies (household_id, name, birth_date, gestation_weeks, gestation_days, due_date)
    values (hid, p_baby_name, p_birth_date, p_gestation_weeks, p_gestation_days, p_due_date);
  insert into public.settings (household_id) values (hid);
  return hid;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Invites: always for a named email.
-- ---------------------------------------------------------------------------
-- Existing invites (if any) were made before email was required.
update public.invites set email = lower(trim(email)) where email is not null;
alter table public.invites
  add constraint invites_email_check check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- Creating and resending run as the caller, so RLS (parents only) applies.
create function public.create_invite(p_household uuid, p_display_name text, p_role text, p_email text)
returns table (id uuid, token text, expires_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
begin
  if coalesce(trim(p_email), '') = '' then
    raise exception 'An invite needs their email' using errcode = '22023';
  end if;
  return query
    insert into public.invites as i (household_id, display_name, role, email)
      values (p_household, trim(p_display_name), p_role, lower(trim(p_email)))
      returning i.id, i.token, i.expires_at;
end $$;

-- A fresh link and 7 more days; the old link stops working.
create function public.resend_invite(p_invite_id uuid)
returns table (id uuid, token text, expires_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
begin
  return query
    update public.invites as i
      set token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
          expires_at = now() + interval '7 days'
      where i.id = p_invite_id and i.accepted_at is null
      returning i.id, i.token, i.expires_at;
  if not found then
    raise exception 'Invite not found, already used, or you can''t change it' using errcode = '42501';
  end if;
end $$;

-- What the invite page shows before signing in. Reveals only the invitee's
-- name, role, the baby's name, a hint of the email, and whether it still works.
create function public.invite_preview(p_token text)
returns table (display_name text, role text, baby_name text, email_hint text, status text)
language sql stable security definer set search_path = '' as $$
  select i.display_name, i.role, b.name,
         case when i.email is null then null
              else left(i.email, 1) || '•••@' || split_part(i.email, '@', 2) end,
         case when i.accepted_at is not null then 'used'
              when i.expires_at < now() then 'expired'
              else 'ok' end
  from public.invites i
  left join public.babies b on b.household_id = i.household_id
  where i.token = p_token
$$;

-- Joins the signed-in person to the household, if the invite is valid, unused,
-- in date, and was sent to their email.
create function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  user_email text;
  inv public.invites%rowtype;
  colour text;
begin
  if uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  select lower(u.email) into user_email from auth.users u where u.id = uid;

  select * into inv from public.invites i where i.token = p_token for update;
  if not found then
    raise exception 'This invite link isn''t valid. Ask for a new one.' using errcode = '42501';
  end if;
  if inv.accepted_at is not null then
    raise exception 'This invite has already been used. Ask for a new one.' using errcode = '42501';
  end if;
  if inv.expires_at < now() then
    raise exception 'This invite has expired. Ask for a new one.' using errcode = '42501';
  end if;
  if inv.email is null or inv.email <> user_email then
    raise exception 'This invite was sent to a different email. Sign in with the email it was sent to.' using errcode = '42501';
  end if;
  if exists (select 1 from public.members m where m.user_id = uid and m.active and m.household_id <> inv.household_id) then
    raise exception 'You are already in another household' using errcode = '23505';
  end if;

  -- A free pill colour (Mum, Dad, Grandma, Grandad), else lilac.
  select c into colour
    from unnest(array['#FBE3D3', '#DCEBF2', '#ECE4F5', '#FBF0CF']) as c
    where c not in (select m.colour from public.members m where m.household_id = inv.household_id and m.active)
    limit 1;

  insert into public.members (household_id, user_id, display_name, colour, role, active)
    values (inv.household_id, uid, inv.display_name, coalesce(colour, '#ECE4F5'), inv.role, true)
    on conflict (household_id, user_id) do update
      set active = true, role = excluded.role, display_name = excluded.display_name;

  update public.invites set accepted_at = now() where id = inv.id;
  return inv.household_id;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Everyone may change their own name and pill colour (nothing else).
-- ---------------------------------------------------------------------------
create function public.update_my_profile(p_household uuid, p_display_name text, p_colour text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.members
    set display_name = trim(p_display_name), colour = p_colour
    where household_id = p_household and user_id = (select auth.uid()) and active;
  if not found then
    raise exception 'You are not in this household' using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Who may call what
-- ---------------------------------------------------------------------------
revoke all on function public.create_invite(uuid, text, text, text) from public, anon;
revoke all on function public.resend_invite(uuid) from public, anon;
revoke all on function public.accept_invite(text) from public, anon;
revoke all on function public.update_my_profile(uuid, text, text) from public, anon;
revoke all on function public.invite_preview(text) from public;
grant execute on function public.create_invite(uuid, text, text, text) to authenticated;
grant execute on function public.resend_invite(uuid) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.update_my_profile(uuid, text, text) to authenticated;
-- The invite page is shown before signing in.
grant execute on function public.invite_preview(text) to anon, authenticated;

alter publication supabase_realtime add table public.invites;
