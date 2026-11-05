-- Bella's Safari: alarm mode for feeds and medicines, and work hours.
--
-- How to apply: Supabase dashboard → SQL Editor → New query → paste this
-- whole file → Run. Run it once, after the phase 8 file.
--
-- Agreed with the parents:
--   * Alarm mode (per person, for feeds and/or medicines): the reminder is a
--     loud-style notification that repeats every 2 minutes for up to 20 minutes
--     after the due time, until it's logged or the person taps Stop / Snooze.
--   * During that person's quiet hours or work hours an alarm falls back to an
--     ordinary notification (no repeats). Medicine notifications still always
--     come through, as before.
-- Settings live in members.reminder_settings:
--   "alarm": {"feed": true, "medicine": true}
--   "work":  {"days": [1,2,3,4,5], "start": "09:00", "end": "17:30"}   (1 = Monday)

-- ---------------------------------------------------------------------------
-- 1. Windows and switches
-- ---------------------------------------------------------------------------
create function app.in_work_hours(m public.members, at timestamptz) returns boolean
language plpgsql stable as $$
declare
  w jsonb := m.reminder_settings -> 'work';
  local timestamp := at at time zone 'Europe/London';
  t time := local::time;
  dow int := extract(isodow from local)::int;
  s time;
  e time;
begin
  if w is null or jsonb_typeof(w) <> 'object' then
    return false;
  end if;
  if not (w -> 'days') @> to_jsonb(dow) then
    return false;
  end if;
  s := (w ->> 'start')::time;
  e := (w ->> 'end')::time;
  return case when s < e then t >= s and t < e else t >= s or t < e end;
end $$;

-- Alarm style right now for this person and type?
create function app.alarm_active(m public.members, kind text, at timestamptz) returns boolean
language sql stable as $$
  select kind in ('feed', 'medicine')
     and app.reminder_on(m, kind)
     and coalesce((m.reminder_settings -> 'alarm' ->> kind)::boolean, false)
     and not app.in_quiet_hours(m, at)
     and not app.in_work_hours(m, at)
$$;

-- ---------------------------------------------------------------------------
-- 2. Each person's alarm for each reminder
-- ---------------------------------------------------------------------------
create table public.reminder_alarms (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders_sent (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  -- Lets "Stop" / "Snooze" on a notification work without signing in (unguessable).
  token text not null unique default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  rings int not null default 0,
  last_rung_at timestamptz,
  snooze_until timestamptz,
  stopped_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reminder_id, member_id)
);
alter table public.reminder_alarms enable row level security;
revoke all on public.reminder_alarms from anon, authenticated;

-- Stop or snooze an alarm, from a notification button (token only) or the app.
create function public.alarm_action(p_token text, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_action = 'stop' then
    update public.reminder_alarms set stopped_at = now() where token = p_token;
  elsif p_action = 'snooze' then
    update public.reminder_alarms set snooze_until = now() + interval '5 minutes' where token = p_token and stopped_at is null;
  else
    raise exception 'Unknown alarm action' using errcode = '22023';
  end if;
end $$;
revoke all on function public.alarm_action(text, text) from public;
grant execute on function public.alarm_action(text, text) to anon, authenticated;

-- The signed-in person's alarms ringing right now (for the in-app alarm screen).
create function public.my_alarms(p_now timestamptz default now())
returns table (token text, type text, title text, body text, url text, due_at timestamptz, ref_id uuid, snoozed boolean)
language sql stable security definer set search_path = '' as $$
  select a.token, r.type, r.title, r.body, r.url, r.due_at, r.ref_id, a.snooze_until is not null and a.snooze_until > p_now
  from public.reminder_alarms a
  join public.reminders_sent r on r.id = a.reminder_id
  join public.members m on m.id = a.member_id
  where m.user_id = (select auth.uid()) and m.active
    and r.cleared_at is null and a.stopped_at is null
    and p_now <= r.due_at + interval '20 minutes'
  order by r.due_at
$$;
revoke all on function public.my_alarms(timestamptz) from public, anon;
grant execute on function public.my_alarms(timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. reminder_run, now with alarms (replaces the phase 8 version)
-- ---------------------------------------------------------------------------
create or replace function public.reminder_run(p_now timestamptz default now())
returns table (subscription_id uuid, endpoint text, keys jsonb, payload jsonb)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  today date := (p_now at time zone 'Europe/London')::date;
begin
  -- ---------------------------------------------------------- 3a. events (unchanged from phase 8)
  insert into public.reminders_sent (household_id, type, ref_id, due_at, title, body, url)
  select p.household_id, 'feed', s.id, at,
         'Feed due at ' || to_char(s.time_of_day, 'HH24:MI'),
         trim_scale(s.volume_ml)::text || ' ml ' ||
           case s.milk_type when 'breast' then 'breast milk' when 'formula' then 'formula' else 'mix' end,
         '#/feeds'
  from public.feed_plan_slots s
  join public.feed_plans p on p.id = s.feed_plan_id
  cross join lateral (select app.uk(d, s.time_of_day) as at from unnest(array[today, today + 1]) d) x
  where x.at between p_now - interval '15 minutes' and p_now + interval '90 minutes'
    and p.id = (select fp.id from public.feed_plans fp
                where fp.household_id = p.household_id and fp.effective_from <= x.at
                order by fp.effective_from desc limit 1)
  on conflict (household_id, type, ref_id, due_at) do nothing;

  insert into public.reminders_sent (household_id, type, ref_id, due_at, title, body, url)
  select m.household_id, 'medicine', m.id, x.at,
         m.name || ' due at ' || to_char(t, 'HH24:MI'),
         trim_scale(v.dose)::text || ' ' || v.unit || ' · ' ||
           case v.route when 'mouth' then 'by mouth' when 'tube' then 'via tube' else 'by mouth or via tube' end,
         '#/meds'
  from public.medicines m
  join public.medicine_doses v on v.medicine_id = m.id
  cross join lateral unnest(v.times) t
  cross join lateral (select app.uk(d, t) as at from unnest(array[today, today + 1]) d) x
  where m.active
    and x.at >= v.effective_from and (v.effective_to is null or x.at < v.effective_to)
    and x.at between p_now - interval '15 minutes' and p_now + interval '90 minutes'
  on conflict (household_id, type, ref_id, due_at) do nothing;

  insert into public.reminders_sent (household_id, type, ref_id, due_at, title, body, url)
  select o.household_id, 'obs', o.id, o.logged_at + make_interval(mins => st.obs_interval_min),
         'Obs due', 'Temperature, breathing and sleep', '#/care'
  from public.settings st
  cross join lateral (
    select * from public.obs ob where ob.household_id = st.household_id order by ob.logged_at desc limit 1
  ) o
  where st.obs_interval_min is not null
    and o.logged_at + make_interval(mins => st.obs_interval_min) between p_now - interval '15 minutes' and p_now + interval '90 minutes'
  on conflict (household_id, type, ref_id, due_at) do nothing;

  insert into public.reminders_sent (household_id, type, ref_id, due_at, title, body, url)
  select tc.household_id, 'tube', tc.id,
         app.uk((tc.inserted_at at time zone 'Europe/London')::date + st.tube_change_days, time '09:00'),
         'NG tube change due', initcap(tc.nostril) || ' nostril · in for ' || st.tube_change_days || ' days', '#/feeds'
  from public.settings st
  cross join lateral (
    select * from public.tube_changes t where t.household_id = st.household_id order by t.inserted_at desc limit 1
  ) tc
  where st.tube_change_days is not null
    and p_now between app.uk((tc.inserted_at at time zone 'Europe/London')::date + st.tube_change_days, time '09:00') - interval '90 minutes'
                  and app.uk((tc.inserted_at at time zone 'Europe/London')::date + st.tube_change_days, time '09:00') + interval '12 hours'
  on conflict (household_id, type, ref_id, due_at) do nothing;

  insert into public.reminders_sent (household_id, type, ref_id, due_at, title, body, url)
  select a.household_id, 'appointment', a.id, w.at,
         case when w.before then 'Tomorrow: ' else 'In 1 hour: ' end || coalesce(a.with_whom, 'appointment'),
         to_char(a.starts_at at time zone 'Europe/London', 'HH24:MI') || coalesce(' · ' || a.location, ''),
         '#/plan'
  from public.appointments a
  cross join lateral (values
    (app.uk((a.starts_at at time zone 'Europe/London')::date - 1, time '18:00'), true),
    (a.starts_at - interval '1 hour', false)
  ) w(at, before)
  where w.at between p_now - interval '15 minutes' and p_now + interval '5 minutes'
  on conflict (household_id, type, ref_id, due_at) do nothing;

  insert into public.reminders_sent (household_id, type, ref_id, due_at, title, body, url)
  select s.household_id, 'supplies', s.id, date_trunc('minute', p_now),
         s.name || ' running low', s.quantity || ' left', '#/plan'
  from public.supplies s
  where (s.to_order or s.quantity <= s.low_threshold)
    and not exists (select 1 from public.reminders_sent r where r.type = 'supplies' and r.ref_id = s.id and r.cleared_at is null)
  on conflict (household_id, type, ref_id, due_at) do nothing;

  insert into public.reminders_sent (household_id, type, ref_id, due_at, title, body, url)
  select rx.household_id, 'prescription', rx.id, rx.opened_at,
         m.name || ': time to reorder', 'About ' || x.days_left || ' days left', '#/meds'
  from public.prescriptions rx
  join public.medicines m on m.id = rx.medicine_id and m.active
  cross join lateral (
    select v.dose * cardinality(v.times) as per_day
    from public.medicine_doses v where v.medicine_id = m.id order by v.effective_from desc limit 1
  ) d
  cross join lateral (
    select floor((rx.bottle_volume - d.per_day * greatest(0, today - (rx.opened_at at time zone 'Europe/London')::date)) / d.per_day)::int as days_left
  ) x
  where d.per_day > 0 and rx.reordered_at is null
    and x.days_left <= rx.reorder_threshold_days
    and rx.id = (select r2.id from public.prescriptions r2 where r2.medicine_id = rx.medicine_id order by r2.opened_at desc limit 1)
  on conflict (household_id, type, ref_id, due_at) do nothing;

  insert into public.reminders_sent (household_id, type, ref_id, due_at, title, body, url)
  select c.household_id, 'plan_change', c.id, c.created_at,
         coalesce(b.name, 'The') || '''s plan changed', c.summary, '#/'
  from public.plan_changes c
  left join public.babies b on b.household_id = c.household_id
  where c.notify and c.created_at > p_now - interval '30 minutes'
  on conflict (household_id, type, ref_id, due_at) do nothing;

  -- ---------------------------------------------------------- 3b. clear what's been done (unchanged)
  update public.reminders_sent r
    set cleared_at = p_now,
        done_title = '✓ Fed',
        done_body = 'Feed logged by ' || coalesce(f.who, 'someone') || ' at ' || to_char(f.at at time zone 'Europe/London', 'HH24:MI')
    from (
      select fe.household_id, fe.logged_at as at, mb.display_name as who
      from public.feeds fe join public.members mb on mb.id = fe.logged_by
    ) f
    where r.type = 'feed' and r.cleared_at is null and f.household_id = r.household_id
      and f.at between r.due_at - interval '60 minutes' and r.due_at + interval '3 hours';

  update public.reminders_sent r
    set cleared_at = p_now,
        done_title = '✓ ' || split_part(r.title, ' due at ', 1) || ' given',
        done_body = 'By ' || coalesce(g.who, 'someone') || ' at ' || to_char(g.at at time zone 'Europe/London', 'HH24:MI')
    from (
      select gv.household_id, gv.medicine_id, gv.scheduled_for, gv.given_at as at, mb.display_name as who
      from public.medicine_given gv join public.members mb on mb.id = gv.logged_by
    ) g
    where r.type = 'medicine' and r.cleared_at is null
      and g.household_id = r.household_id and g.medicine_id = r.ref_id and g.scheduled_for = r.due_at;

  update public.reminders_sent r
    set cleared_at = p_now, done_title = '✓ Obs done',
        done_body = 'By ' || coalesce((select mb.display_name from public.members mb where mb.id = o.logged_by), 'someone')
    from public.obs base, public.obs o
    where r.type = 'obs' and r.cleared_at is null and base.id = r.ref_id
      and o.household_id = r.household_id and o.logged_at > base.logged_at;

  update public.reminders_sent r
    set cleared_at = p_now, done_title = '✓ NG tube changed', done_body = initcap(t.nostril) || ' nostril'
    from public.tube_changes base, public.tube_changes t
    where r.type = 'tube' and r.cleared_at is null and base.id = r.ref_id
      and t.household_id = r.household_id and t.inserted_at > base.inserted_at;

  update public.reminders_sent r
    set cleared_at = p_now, done_title = 'Appointment changed', done_body = 'Check the Plan screen'
    where r.type = 'appointment' and r.cleared_at is null
      and not exists (
        select 1 from public.appointments a where a.id = r.ref_id
          and (a.starts_at - interval '1 hour' = r.due_at
               or app.uk((a.starts_at at time zone 'Europe/London')::date - 1, time '18:00') = r.due_at));

  update public.reminders_sent r
    set cleared_at = p_now, done_title = '✓ Restocked', done_body = coalesce(s.name || ': ' || s.quantity || ' now', 'Removed')
    from public.reminders_sent r2
    left join public.supplies s on s.id = r2.ref_id
    where r.id = r2.id and r.type = 'supplies' and r.cleared_at is null
      and (s.id is null or (not s.to_order and s.quantity > s.low_threshold));

  update public.reminders_sent r
    set cleared_at = p_now, done_title = '✓ Reordered', done_body = 'Prescription sorted'
    from public.prescriptions rx
    where r.type = 'prescription' and r.cleared_at is null and rx.id = r.ref_id
      and (rx.reordered_at is not null
           or exists (select 1 from public.prescriptions n where n.medicine_id = rx.medicine_id and n.opened_at > rx.opened_at));

  -- ---------------------------------------------------------- 3c. alarms
  -- Start an alarm for each person with alarm mode on (outside their quiet/work
  -- hours) once a feed or medicine reaches its notice time.
  insert into public.reminder_alarms (reminder_id, member_id, last_rung_at)
  select r.id, mb.id, p_now
  from public.reminders_sent r
  join public.members mb on mb.household_id = r.household_id and mb.active
  where r.type in ('feed', 'medicine') and r.cleared_at is null
    and p_now >= r.due_at - app.reminder_lead(mb, r.type)
    and p_now <= r.due_at + interval '20 minutes'
    and app.alarm_active(mb, r.type, p_now)
  on conflict (reminder_id, member_id) do nothing;

  -- ---------------------------------------------------------- 3d. send and replace
  return query
  with due as (
    -- First notification for each live reminder, on each phone (as phase 8).
    insert into public.reminder_deliveries (reminder_id, subscription_id, member_id, sent_at)
    select r.id, ps.id, mb.id, p_now
    from public.reminders_sent r
    join public.members mb on mb.household_id = r.household_id and mb.active
    join public.push_subscriptions ps on ps.member_id = mb.id
    where r.cleared_at is null
      and app.reminder_on(mb, r.type)
      and p_now >= r.due_at - app.reminder_lead(mb, r.type)
      and p_now <= r.due_at + case r.type
            when 'tube' then interval '12 hours'
            when 'supplies' then interval '1 day'
            when 'prescription' then interval '100 years'
            when 'plan_change' then interval '30 minutes'
            else interval '15 minutes' end
      and (r.type = 'medicine' or not app.in_quiet_hours(mb, p_now))
      and (r.type <> 'plan_change' or exists (
            select 1 from public.plan_changes c where c.id = r.ref_id and c.changed_by <> mb.id and mb.created_at <= c.created_at))
    on conflict (reminder_id, subscription_id) do nothing
    returning reminder_deliveries.reminder_id, reminder_deliveries.subscription_id, reminder_deliveries.member_id
  ),
  rings as (
    -- Repeats: every 2 minutes from the due time, up to 20 minutes after it,
    -- unless stopped, snoozed, logged, or the person is now in quiet/work hours.
    update public.reminder_alarms a
      set rings = a.rings + 1, last_rung_at = p_now
      from public.reminders_sent r, public.members mb
      where r.id = a.reminder_id and mb.id = a.member_id
        and r.cleared_at is null and a.stopped_at is null
        and p_now >= r.due_at
        and p_now <= r.due_at + interval '20 minutes'
        and (a.snooze_until is null or p_now >= a.snooze_until)
        and (a.last_rung_at is null or a.last_rung_at <= p_now - interval '2 minutes' + interval '5 seconds')
        and app.alarm_active(mb, r.type, p_now)
    returning a.reminder_id, a.member_id, a.token
  ),
  done as (
    update public.reminder_deliveries d
      set done_sent_at = p_now
      from public.reminders_sent r
      where r.id = d.reminder_id and r.cleared_at is not null and d.done_sent_at is null
        and r.done_title is not null
    returning d.reminder_id, d.subscription_id
  )
  select ps.id, ps.endpoint, ps.keys,
         jsonb_build_object('kind', case when al.token is not null then 'alarm' else 'reminder' end,
                            'title', r.title, 'body', r.body, 'url', r.url,
                            'tag', r.type || ':' || r.id, 'silent', false, 'alarm_token', al.token)
  from due x
  join public.reminders_sent r on r.id = x.reminder_id
  join public.push_subscriptions ps on ps.id = x.subscription_id
  left join public.reminder_alarms al on al.reminder_id = x.reminder_id and al.member_id = x.member_id and al.stopped_at is null
  union all
  select ps.id, ps.endpoint, ps.keys,
         jsonb_build_object('kind', 'alarm', 'title', '⏰ ' || r.title, 'body', r.body || ' · not logged yet', 'url', r.url,
                            'tag', r.type || ':' || r.id, 'silent', false, 'alarm_token', g.token)
  from rings g
  join public.reminders_sent r on r.id = g.reminder_id
  join public.push_subscriptions ps on ps.member_id = g.member_id
  union all
  select ps.id, ps.endpoint, ps.keys,
         jsonb_build_object('kind', 'done', 'title', r.done_title, 'body', r.done_body, 'url', r.url,
                            'tag', r.type || ':' || r.id, 'silent', true)
  from done y
  join public.reminders_sent r on r.id = y.reminder_id
  join public.push_subscriptions ps on ps.id = y.subscription_id;
end $$;

revoke all on function public.reminder_run(timestamptz) from public, anon, authenticated;
grant execute on function public.reminder_run(timestamptz) to service_role;

alter publication supabase_realtime add table public.reminders_sent;
