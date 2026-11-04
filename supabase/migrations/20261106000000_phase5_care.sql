-- Bella's Safari: phase 5, care and growth.
--
-- How to apply: Supabase dashboard → SQL Editor → New query → paste this
-- whole file → Run. Run it once, after the phase 4 file.

-- The normal temperature range agreed with Bella's team. Left empty unless
-- the parents enter it; obs readings outside it are highlighted in the app.
alter table public.settings
  add column temp_min_c numeric(3, 1) check (temp_min_c between 30 and 45),
  add column temp_max_c numeric(3, 1) check (temp_max_c between 30 and 45),
  add constraint settings_temp_range_check check (
    (temp_min_c is null and temp_max_c is null)
    or (temp_min_c is not null and temp_max_c is not null and temp_min_c < temp_max_c)
  );

-- save_routines gains the temperature range. Replace the phase 3 version.
drop function public.save_routines(uuid, int, int, int, jsonb, text, jsonb, jsonb, boolean);

create function public.save_routines(
  p_household uuid,
  p_obs_interval_min int,
  p_tummy_goal_min int,
  p_tube_change_days int,
  p_temp_min_c numeric,
  p_temp_max_c numeric,
  p_tasks jsonb,
  p_summary text,
  p_before jsonb,
  p_after jsonb,
  p_notify boolean
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  t jsonb;
  pos int := 0;
  kept uuid[] := '{}';
  task_id uuid;
begin
  update public.settings
    set obs_interval_min = p_obs_interval_min, tummy_goal_min = p_tummy_goal_min,
        tube_change_days = p_tube_change_days, temp_min_c = p_temp_min_c, temp_max_c = p_temp_max_c
    where household_id = p_household;
  if not found then
    raise exception 'Settings not found, or you can''t change them' using errcode = '42501';
  end if;

  for t in select * from jsonb_array_elements(coalesce(p_tasks, '[]')) loop
    pos := pos + 1;
    task_id := nullif(t ->> 'id', '')::uuid;
    if task_id is null then
      insert into public.care_tasks (household_id, name, recurrence, every_days, weekdays, sort_order)
        values (
          p_household, trim(t ->> 'name'), t ->> 'recurrence', (t ->> 'every_days')::int,
          coalesce(array(select d::int from jsonb_array_elements_text(t -> 'weekdays') d order by 1), '{}'), pos
        )
        returning id into task_id;
    else
      update public.care_tasks
        set name = trim(t ->> 'name'), recurrence = t ->> 'recurrence', every_days = (t ->> 'every_days')::int,
            weekdays = coalesce(array(select d::int from jsonb_array_elements_text(t -> 'weekdays') d order by 1), '{}'),
            active = true, sort_order = pos
        where id = task_id and household_id = p_household;
    end if;
    kept := kept || task_id;
  end loop;

  update public.care_tasks
    set active = false
    where household_id = p_household and active and not (id = any (kept));

  perform app.record_plan_change(p_household, 'routines', p_summary, p_before, p_after, p_notify);
end $$;

revoke all on function public.save_routines(uuid, int, int, int, numeric, numeric, jsonb, text, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.save_routines(uuid, int, int, int, numeric, numeric, jsonb, text, jsonb, jsonb, boolean) to authenticated;
