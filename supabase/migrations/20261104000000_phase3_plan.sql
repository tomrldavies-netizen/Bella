-- Bella's Safari: phase 3, Bella's plan.
--
-- How to apply: Supabase dashboard → SQL Editor → New query → paste this
-- whole file → Run. Run it once, after the phase 2 file.
--
-- The save_* functions write a plan change and its "Recent changes" record
-- together, so a dropped connection can't leave half a plan saved. They run
-- with the caller's own permissions (SECURITY INVOKER), so the RLS rules from
-- phase 2 still decide who may write: helpers are refused.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
-- Optional free-text timing, e.g. "During each tube feed".
alter table public.exercises add column timing_note text check (length(timing_note) <= 200);

-- Care tasks repeat every N days, or weekly on chosen days (1 = Monday … 7 = Sunday).
alter table public.care_tasks
  add column every_days int check (every_days between 1 and 365),
  add column weekdays int[] not null default '{}',
  add column active boolean not null default true,
  add column sort_order int not null default 0;
alter table public.care_tasks
  add constraint care_tasks_recurrence_check check (
    (recurrence = 'every_n_days' and every_days is not null)
    or (recurrence = 'weekly' and cardinality(weekdays) > 0
        and weekdays <@ array[1, 2, 3, 4, 5, 6, 7])
  );

alter table public.medicines add column sort_order int not null default 0;

-- ---------------------------------------------------------------------------
-- 2. Recording a change
-- ---------------------------------------------------------------------------
create function app.record_plan_change(
  p_household uuid, p_area text, p_summary text, p_before jsonb, p_after jsonb, p_notify boolean
) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if coalesce(trim(p_summary), '') = '' then
    return;
  end if;
  insert into public.plan_changes (household_id, area, summary, before, after, notify)
    values (p_household, p_area, p_summary, p_before, p_after, coalesce(p_notify, true));
end $$;

-- ---------------------------------------------------------------------------
-- 3. Feed plan: every save is a new version; old versions are kept.
--    p_slots: [{"time_of_day": "06:00", "milk_type": "breast", "volume_ml": 50}, …]
-- ---------------------------------------------------------------------------
create function public.save_feed_plan(
  p_household uuid,
  p_effective_from timestamptz,
  p_slots jsonb,
  p_note text,
  p_summary text,
  p_before jsonb,
  p_after jsonb,
  p_notify boolean
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  plan_id uuid;
begin
  insert into public.feed_plans (household_id, effective_from, note)
    values (p_household, p_effective_from, nullif(trim(p_note), ''))
    returning id into plan_id;

  insert into public.feed_plan_slots (household_id, feed_plan_id, time_of_day, milk_type, volume_ml)
    select p_household, plan_id, (s ->> 'time_of_day')::time, s ->> 'milk_type', (s ->> 'volume_ml')::numeric
    from jsonb_array_elements(coalesce(p_slots, '[]')) s;

  perform app.record_plan_change(p_household, 'feeds', p_summary, p_before, p_after, p_notify);
  return plan_id;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Medicines. A dose, route or times change is a new dose version from a
--    chosen time; the previous version is closed at that time and kept.
--    p_dose_mode: 'none' (name/notes only), 'new_version', or 'set_end'
--    (change only the end date of the current version).
--    p_dose: {"dose": 1.2, "unit": "ml", "route": "mouth", "times": ["05:00"],
--             "effective_from": "…", "effective_to": "…" | null, "reason": "…"}
-- ---------------------------------------------------------------------------
create function public.save_medicine(
  p_household uuid,
  p_medicine_id uuid,
  p_name text,
  p_notes text,
  p_active boolean,
  p_dose_mode text,
  p_dose jsonb,
  p_summary text,
  p_before jsonb,
  p_after jsonb,
  p_notify boolean
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  med_id uuid := p_medicine_id;
  v_from timestamptz := (p_dose ->> 'effective_from')::timestamptz;
  v_to timestamptz := (p_dose ->> 'effective_to')::timestamptz;
  v_route text := coalesce(p_dose ->> 'route', 'either');
begin
  if p_dose_mode not in ('none', 'new_version', 'set_end') then
    raise exception 'Unknown dose mode %', p_dose_mode;
  end if;

  if med_id is null then
    if p_dose_mode <> 'new_version' then
      raise exception 'A new medicine needs a dose' using errcode = '22023';
    end if;
    insert into public.medicines (household_id, name, notes, route, active, sort_order)
      values (p_household, trim(p_name), nullif(trim(p_notes), ''), v_route, coalesce(p_active, true),
        (select coalesce(max(sort_order), 0) + 1 from public.medicines where household_id = p_household))
      returning id into med_id;
  else
    update public.medicines
      set name = trim(p_name), notes = nullif(trim(p_notes), ''), active = coalesce(p_active, active),
          route = case when p_dose_mode = 'new_version' then v_route else route end
      where id = med_id and household_id = p_household;
    if not found then
      raise exception 'Medicine not found, or you can''t change it' using errcode = '42501';
    end if;
  end if;

  if p_dose_mode = 'new_version' then
    if v_from is null then
      raise exception 'A new dose needs a start time' using errcode = '22023';
    end if;
    -- Replace any versions that hadn't started yet, and close the current one.
    delete from public.medicine_doses
      where medicine_id = med_id and household_id = p_household and effective_from >= v_from;
    update public.medicine_doses
      set effective_to = v_from
      where medicine_id = med_id and household_id = p_household
        and (effective_to is null or effective_to > v_from);
    insert into public.medicine_doses
      (household_id, medicine_id, dose, unit, route, times, effective_from, effective_to, reason)
      values (
        p_household, med_id, (p_dose ->> 'dose')::numeric, coalesce(p_dose ->> 'unit', 'ml'), v_route,
        coalesce(array(select t::time from jsonb_array_elements_text(p_dose -> 'times') t order by 1), '{}'),
        v_from, v_to, nullif(trim(p_dose ->> 'reason'), '')
      );
  elsif p_dose_mode = 'set_end' then
    update public.medicine_doses
      set effective_to = v_to
      where id = (
        select d.id from public.medicine_doses d
        where d.medicine_id = med_id and d.household_id = p_household
        order by d.effective_from desc limit 1
      );
  end if;

  perform app.record_plan_change(p_household, 'medicines', p_summary, p_before, p_after, p_notify);
  return med_id;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Exercises, with their how-to steps (replaced as a whole on save).
--    p_steps: ["Step one", "Step two", …]
-- ---------------------------------------------------------------------------
create function public.save_exercise(
  p_household uuid,
  p_exercise_id uuid,
  p_type text,
  p_name text,
  p_per_day int,
  p_timing_note text,
  p_active boolean,
  p_steps jsonb,
  p_summary text,
  p_before jsonb,
  p_after jsonb,
  p_notify boolean
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  ex_id uuid := p_exercise_id;
begin
  if ex_id is null then
    insert into public.exercises (household_id, type, name, per_day, timing_note, active, sort_order)
      values (p_household, p_type, trim(p_name), p_per_day, nullif(trim(p_timing_note), ''), coalesce(p_active, true),
        (select coalesce(max(sort_order), 0) + 1 from public.exercises where household_id = p_household and type = p_type))
      returning id into ex_id;
  else
    update public.exercises
      set name = trim(p_name), per_day = p_per_day, timing_note = nullif(trim(p_timing_note), ''),
          active = coalesce(p_active, active)
      where id = ex_id and household_id = p_household;
    if not found then
      raise exception 'Exercise not found, or you can''t change it' using errcode = '42501';
    end if;
    delete from public.exercise_steps where exercise_id = ex_id and household_id = p_household;
  end if;

  -- Blank steps are dropped and the rest numbered 0, 1, 2… in order.
  insert into public.exercise_steps (household_id, exercise_id, position, text)
    select p_household, ex_id, (row_number() over (order by ord) - 1)::int, trim(step)
    from jsonb_array_elements_text(coalesce(p_steps, '[]')) with ordinality as s(step, ord)
    where trim(step) <> '';

  perform app.record_plan_change(p_household, 'exercises', p_summary, p_before, p_after, p_notify);
  return ex_id;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Obs & routines: settings plus care tasks.
--    p_tasks: [{"id": "…" | null, "name": "Bath", "recurrence": "weekly",
--               "every_days": null, "weekdays": [1, 4]}, …]
--    Tasks missing from the list are retired (kept for their history).
-- ---------------------------------------------------------------------------
create function public.save_routines(
  p_household uuid,
  p_obs_interval_min int,
  p_tummy_goal_min int,
  p_tube_change_days int,
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
        tube_change_days = p_tube_change_days
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

-- ---------------------------------------------------------------------------
-- 7. Who may call them (RLS inside still decides what they may write)
-- ---------------------------------------------------------------------------
revoke all on function public.save_feed_plan(uuid, timestamptz, jsonb, text, text, jsonb, jsonb, boolean) from public, anon;
revoke all on function public.save_medicine(uuid, uuid, text, text, boolean, text, jsonb, text, jsonb, jsonb, boolean) from public, anon;
revoke all on function public.save_exercise(uuid, uuid, text, text, int, text, boolean, jsonb, text, jsonb, jsonb, boolean) from public, anon;
revoke all on function public.save_routines(uuid, int, int, int, jsonb, text, jsonb, jsonb, boolean) from public, anon;
grant execute on function public.save_feed_plan(uuid, timestamptz, jsonb, text, text, jsonb, jsonb, boolean) to authenticated;
grant execute on function public.save_medicine(uuid, uuid, text, text, boolean, text, jsonb, text, jsonb, jsonb, boolean) to authenticated;
grant execute on function public.save_exercise(uuid, uuid, text, text, int, text, boolean, jsonb, text, jsonb, jsonb, boolean) to authenticated;
grant execute on function public.save_routines(uuid, int, int, int, jsonb, text, jsonb, jsonb, boolean) to authenticated;
