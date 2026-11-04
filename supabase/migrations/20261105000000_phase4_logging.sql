-- Bella's Safari: phase 4, logging care.
--
-- How to apply: Supabase dashboard → SQL Editor → New query → paste this
-- whole file → Run. Run it once, after the phase 3 file.

-- Marks a scheduled dose as given, refusing a second "given" for the same
-- medicine and time unless the person has confirmed it (p_allow_repeat).
-- A lock on the medicine + time means two phones tapping at the same moment
-- can't both get through. Runs as the caller, so RLS still applies.
create function public.give_medicine(
  p_household uuid,
  p_medicine_id uuid,
  p_scheduled_for timestamptz,
  p_given_at timestamptz,
  p_dose_given numeric,
  p_allow_repeat boolean
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  earlier record;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_medicine_id::text || '|' || coalesce(p_scheduled_for::text, ''), 0));

  if p_scheduled_for is not null and not coalesce(p_allow_repeat, false) then
    select g.given_at, m.display_name into earlier
      from public.medicine_given g
      join public.members m on m.id = g.logged_by
      where g.household_id = p_household and g.medicine_id = p_medicine_id and g.scheduled_for = p_scheduled_for
      order by g.given_at desc
      limit 1;
    if found then
      -- The app reads ALREADY_GIVEN and the detail to ask "Log another dose?".
      raise exception 'ALREADY_GIVEN'
        using errcode = 'P0001',
              detail = json_build_object('by', earlier.display_name, 'at', earlier.given_at)::text;
    end if;
  end if;

  insert into public.medicine_given (household_id, medicine_id, scheduled_for, given_at, logged_at, dose_given)
    values (p_household, p_medicine_id, p_scheduled_for, coalesce(p_given_at, now()), coalesce(p_given_at, now()), p_dose_given)
    returning id into new_id;
  return new_id;
end $$;

revoke all on function public.give_medicine(uuid, uuid, timestamptz, timestamptz, numeric, boolean) from public, anon;
grant execute on function public.give_medicine(uuid, uuid, timestamptz, timestamptz, numeric, boolean) to authenticated;
