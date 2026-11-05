-- Bella's Safari: phase 8, push reminders.
--
-- How to apply: Supabase dashboard → SQL Editor → New query → paste this
-- whole file → Run. Run it once, after the phase 7 file.
--
-- How reminders work:
--   * Every minute the send-reminders Edge Function calls reminder_run().
--   * reminder_run() works out what is due (feeds and medicines from the
--     plan, obs, NG tube change, appointments, supplies, prescriptions,
--     plan changes), records each one once in reminders_sent, and returns
--     the notifications to send to each person's phones (respecting their
--     settings and quiet hours, which never silence medicines).
--   * When someone logs the thing, the reminder is cleared: nobody else is
--     told, and anyone already told gets a quiet "done" replacement.
-- Times in the plan are UK time (Europe/London).

-- ---------------------------------------------------------------------------
-- 1. Settings: each person's choices (types, lead times, quiet hours)
-- ---------------------------------------------------------------------------
-- {"types": {"feed": true, ...}, "lead": {"feed": 10, ...}, "quiet": {"start": "22:00", "end": "06:00"} | null}
alter table public.members add column reminder_settings jsonb not null default '{}';

create function public.update_my_reminders(p_household uuid, p_settings jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.members
    set reminder_settings = coalesce(p_settings, '{}')
    where household_id = p_household and user_id = (select auth.uid()) and active;
  if not found then
    raise exception 'You are not in this household' using errcode = '42501';
  end if;
end $$;
revoke all on function public.update_my_reminders(uuid, jsonb) from public, anon;
grant execute on function public.update_my_reminders(uuid, jsonb) to authenticated;

-- Defaults agreed with the parents: everything on for parents; for helpers
-- only plan-change alerts, until they turn others on.
create function app.reminder_on(m public.members, kind text) returns boolean
language sql stable as $$
  select coalesce(
    (m.reminder_settings -> 'types' ->> kind)::boolean,
    kind = 'plan_change' or m.role = 'parent'
  )
$$;

create function app.reminder_lead(m public.members, kind text) returns interval
language sql stable as $$
  select case when kind in ('feed', 'medicine', 'obs')
    then make_interval(mins => coalesce((m.reminder_settings -> 'lead' ->> kind)::int, 10))
    else interval '0' end
$$;

-- Quiet hours in UK time; they may run past midnight (22:00–06:00).
create function app.in_quiet_hours(m public.members, at timestamptz) returns boolean
language plpgsql stable as $$
declare
  q jsonb := m.reminder_settings -> 'quiet';
  t time := (at at time zone 'Europe/London')::time;
  s time;
  e time;
begin
  if q is null or jsonb_typeof(q) <> 'object' then
    return false;
  end if;
  s := (q ->> 'start')::time;
  e := (q ->> 'end')::time;
  if s = e then return false; end if;
  return case when s < e then t >= s and t < e else t >= s or t < e end;
end $$;

-- ---------------------------------------------------------------------------
-- 2. What has been sent
-- ---------------------------------------------------------------------------
alter table public.reminders_sent
  add column title text,
  add column body text,
  add column url text,
  add column done_title text,
  add column done_body text;
-- ref_id points at the thing the reminder is about (slot, medicine, obs…).

create table public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders_sent (id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  sent_at timestamptz not null default now(),
  done_sent_at timestamptz,
  unique (reminder_id, subscription_id)
);
-- Only the Edge Function (service role) reads or writes deliveries.
alter table public.reminder_deliveries enable row level security;
revoke all on public.reminder_deliveries from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. The reminder run
-- ---------------------------------------------------------------------------
create function app.uk(d date, t time) returns timestamptz
language sql stable as $$ select (d + t) at time zone 'Europe/London' $$;

create function public.reminder_run(p_now timestamptz default now())
returns table (subscription_id uuid, endpoint text, keys jsonb, payload jsonb)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  today date := (p_now at time zone 'Europe/London')::date;
begin
  -- ---------------------------------------------------------- 3a. events
  -- Planned feeds (from the plan in force at each feed time).
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

  -- Scheduled medicine doses (from the dose version in force).
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

  -- Obs: the latest obs plus the interval in the plan.
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

  -- NG tube change: 09:00 on the day it's due.
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

  -- Appointments: 18:00 the evening before, and 1 hour before.
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

  -- Supplies at or below their low level (or flagged to order): once each time.
  insert into public.reminders_sent (household_id, type, ref_id, due_at, title, body, url)
  select s.household_id, 'supplies', s.id, date_trunc('minute', p_now),
         s.name || ' running low', s.quantity || ' left', '#/plan'
  from public.supplies s
  where (s.to_order or s.quantity <= s.low_threshold)
    and not exists (select 1 from public.reminders_sent r where r.type = 'supplies' and r.ref_id = s.id and r.cleared_at is null)
  on conflict (household_id, type, ref_id, due_at) do nothing;

  -- Prescriptions near reorder (estimate from the planned daily dose): once per bottle.
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

  -- Plan changes with "Tell everyone" on.
  insert into public.reminders_sent (household_id, type, ref_id, due_at, title, body, url)
  select c.household_id, 'plan_change', c.id, c.created_at,
         coalesce(b.name, 'The') || '''s plan changed', c.summary, '#/'
  from public.plan_changes c
  left join public.babies b on b.household_id = c.household_id
  where c.notify and c.created_at > p_now - interval '30 minutes'
  on conflict (household_id, type, ref_id, due_at) do nothing;

  -- ---------------------------------------------------------- 3b. clear what's been done
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

  -- ---------------------------------------------------------- 3c. send and replace
  return query
  with due as (
    -- New notifications: who should get each live reminder, on each phone.
    insert into public.reminder_deliveries (reminder_id, subscription_id, member_id)
    select r.id, ps.id, mb.id
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
      -- Quiet hours never silence medicines (agreed with the parents).
      and (r.type = 'medicine' or not app.in_quiet_hours(mb, p_now))
      -- Plan changes: not to the person who made them, nor to people who joined later.
      and (r.type <> 'plan_change' or exists (
            select 1 from public.plan_changes c where c.id = r.ref_id and c.changed_by <> mb.id and mb.created_at <= c.created_at))
    on conflict (reminder_id, subscription_id) do nothing
    returning reminder_deliveries.reminder_id, reminder_deliveries.subscription_id
  ),
  done as (
    -- Quiet replacements for notifications whose reminder has since been done.
    update public.reminder_deliveries d
      set done_sent_at = p_now
      from public.reminders_sent r
      where r.id = d.reminder_id and r.cleared_at is not null and d.done_sent_at is null
        and r.done_title is not null
    returning d.reminder_id, d.subscription_id
  )
  select ps.id, ps.endpoint, ps.keys,
         jsonb_build_object('kind', 'reminder', 'title', r.title, 'body', r.body, 'url', r.url,
                            'tag', r.type || ':' || r.id, 'silent', false)
  from due x
  join public.reminders_sent r on r.id = x.reminder_id
  join public.push_subscriptions ps on ps.id = x.subscription_id
  union all
  select ps.id, ps.endpoint, ps.keys,
         jsonb_build_object('kind', 'done', 'title', r.done_title, 'body', r.done_body, 'url', r.url,
                            'tag', r.type || ':' || r.id, 'silent', true)
  from done y
  join public.reminders_sent r on r.id = y.reminder_id
  join public.push_subscriptions ps on ps.id = y.subscription_id;
end $$;

-- Only the Edge Function (service role) runs reminders.
revoke all on function public.reminder_run(timestamptz) from public, anon, authenticated;
grant execute on function public.reminder_run(timestamptz) to service_role;

-- A phone that is no longer subscribed (the push service said "gone").
create function public.forget_subscription(p_endpoint text) returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint
$$;
revoke all on function public.forget_subscription(text) from public, anon, authenticated;
grant execute on function public.forget_subscription(text) to service_role;

-- Tidy old records daily-ish (kept for 30 days).
create function public.reminder_cleanup() returns void
language sql security definer set search_path = '' as $$
  delete from public.reminders_sent where due_at < now() - interval '30 days' and type <> 'prescription'
$$;
revoke all on function public.reminder_cleanup() from public, anon, authenticated;
grant execute on function public.reminder_cleanup() to service_role;
