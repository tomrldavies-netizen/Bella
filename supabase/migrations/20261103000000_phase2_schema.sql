-- Bella's Safari: phase 2 schema, roles and Row Level Security.
-- SPEC.md §3 (roles) and §5 (data model).
--
-- How to apply: Supabase dashboard → SQL Editor → New query → paste this
-- whole file → Run. Run it once, on an empty project.
--
-- Roles:
--   parent – read everything, log care, change the plan, manage members.
--   helper – read everything, log care. Cannot change the plan or members.
-- Enforced here in the database, not only in the app.

-- ---------------------------------------------------------------------------
-- 0. Private helper schema (not exposed through the Supabase API)
-- ---------------------------------------------------------------------------
create schema if not exists app;
grant usage on schema app to authenticated;

create function app.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- A row can never be moved to another household.
create function app.keep_household() returns trigger
language plpgsql as $$
begin
  if new.household_id is distinct from old.household_id then
    raise exception 'household_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Household and people
-- ---------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our family' check (length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null check (length(display_name) between 1 and 40),
  colour text not null default '#FBE3D3' check (colour ~ '^#[0-9A-Fa-f]{6}$'),
  role text not null check (role in ('parent', 'helper')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  unique (household_id, user_id)
);
create index members_user_idx on public.members (user_id) where active;

-- Functions used by every policy. SECURITY DEFINER so they can read
-- members without recursing into members' own policies.
create function app.my_member_id(hid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.id from public.members m
  where m.household_id = hid and m.user_id = (select auth.uid()) and m.active
$$;

create function app.is_member(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.household_id = hid and m.user_id = (select auth.uid()) and m.active
  )
$$;

create function app.is_parent(hid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.household_id = hid and m.user_id = (select auth.uid()) and m.active
      and m.role = 'parent'
  )
$$;

-- Fills logged_by / created_by / changed_by with the signed-in member, and
-- refuses to record anyone else or to change it later. Skipped for the
-- service role and the SQL editor, which have no signed-in user.
create function app.stamp_member() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  col text := tg_argv[0];
  mid uuid;
  given text;
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    mid := app.my_member_id(new.household_id);
    given := to_jsonb(new) ->> col;
    if given is null then
      new := jsonb_populate_record(new, jsonb_build_object(col, mid));
    elsif given::uuid is distinct from mid then
      raise exception '% must be the signed-in member', col using errcode = '42501';
    end if;
  elsif (to_jsonb(new) ->> col) is distinct from (to_jsonb(old) ->> col) then
    raise exception '% cannot be changed', col using errcode = '42501';
  end if;
  return new;
end $$;

-- Every household keeps at least one active parent.
create function app.keep_a_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.households h where h.id = old.household_id)
     and not exists (
       select 1 from public.members m
       where m.household_id = old.household_id and m.role = 'parent' and m.active
     ) then
    raise exception 'A household needs at least one parent' using errcode = '23514';
  end if;
  return null;
end $$;

create trigger members_keep_a_parent
  after update or delete on public.members
  for each row execute function app.keep_a_parent();

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 40),
  role text not null check (role in ('parent', 'helper')),
  email text,
  -- 244 random bits, using only built-in functions.
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, created_by) references public.members (household_id, id)
);

create table public.babies (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(name) between 1 and 40),
  birth_date date not null,
  gestation_weeks int not null check (gestation_weeks between 22 and 42),
  gestation_days int not null default 0 check (gestation_days between 0 and 6),
  due_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One baby per household in v1.
create unique index babies_one_per_household on public.babies (household_id);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.households (id) on delete cascade,
  -- Left empty until parents enter the plan agreed with the clinical team.
  obs_interval_min int check (obs_interval_min > 0),
  tummy_goal_min int not null default 30 check (tummy_goal_min >= 0),
  tube_change_days int check (tube_change_days > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Plan tables (parents write, everyone reads)
-- ---------------------------------------------------------------------------
create table public.feed_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  effective_from timestamptz not null,
  created_by uuid not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, created_by) references public.members (household_id, id)
);
create index feed_plans_effective_idx on public.feed_plans (household_id, effective_from desc);

create table public.feed_plan_slots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  feed_plan_id uuid not null,
  time_of_day time not null,
  milk_type text not null check (milk_type in ('breast', 'formula', 'mix')),
  volume_ml numeric(6, 1) not null check (volume_ml >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  unique (feed_plan_id, time_of_day),
  foreign key (household_id, feed_plan_id)
    references public.feed_plans (household_id, id) on delete cascade
);

create table public.medicines (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  route text not null default 'either' check (route in ('mouth', 'tube', 'either')),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id)
);

create table public.medicine_doses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  medicine_id uuid not null,
  dose numeric(8, 2) not null check (dose >= 0),
  unit text not null default 'ml',
  route text not null check (route in ('mouth', 'tube', 'either')),
  times time[] not null default '{}',
  effective_from timestamptz not null,
  effective_to timestamptz,
  reason text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from),
  foreign key (household_id, medicine_id)
    references public.medicines (household_id, id) on delete cascade,
  foreign key (household_id, created_by) references public.members (household_id, id)
);
create index medicine_doses_medicine_idx on public.medicine_doses (medicine_id, effective_from desc);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  medicine_id uuid not null,
  bottle_volume numeric(8, 2) not null check (bottle_volume > 0),
  opened_at timestamptz not null default now(),
  reorder_threshold_days int not null default 7 check (reorder_threshold_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, medicine_id)
    references public.medicines (household_id, id) on delete cascade
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  type text not null check (type in ('physio', 'speech_language')),
  name text not null check (length(name) between 1 and 80),
  per_day int not null default 1 check (per_day between 0 and 24),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id)
);

create table public.exercise_steps (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  exercise_id uuid not null,
  position int not null check (position >= 0),
  text text not null check (length(text) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, exercise_id)
    references public.exercises (household_id, id) on delete cascade
);
create index exercise_steps_exercise_idx on public.exercise_steps (exercise_id, position);

create table public.care_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  recurrence text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  starts_at timestamptz not null,
  with_whom text,
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id)
);
create index appointments_starts_idx on public.appointments (household_id, starts_at);

create table public.supplies (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  quantity int not null default 0 check (quantity >= 0),
  low_threshold int not null default 0 check (low_threshold >= 0),
  to_order boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_changes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  area text not null check (area in ('feeds', 'medicines', 'exercises', 'routines')),
  summary text not null,
  before jsonb,
  after jsonb,
  changed_by uuid not null,
  notify boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, changed_by) references public.members (household_id, id)
);
create index plan_changes_created_idx on public.plan_changes (household_id, created_at desc);

create table public.plan_change_seen (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  plan_change_id uuid not null,
  member_id uuid not null,
  seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_change_id, member_id),
  foreign key (household_id, plan_change_id)
    references public.plan_changes (household_id, id) on delete cascade,
  foreign key (household_id, member_id) references public.members (household_id, id)
);

-- ---------------------------------------------------------------------------
-- 3. Log tables (parents and helpers write)
--    Each has logged_by (member) and logged_at (when it happened, editable).
-- ---------------------------------------------------------------------------
create table public.feeds (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  logged_by uuid not null,
  logged_at timestamptz not null default now(),
  feed_plan_slot_id uuid,
  started_at timestamptz,
  ended_at timestamptz,
  method text not null default 'tube' check (method in ('tube', 'bottle_tube', 'breast_tube')),
  oral_ml numeric(6, 1) not null default 0 check (oral_ml >= 0),
  tube_ml numeric(6, 1) not null default 0 check (tube_ml >= 0),
  milk_type text check (milk_type in ('breast', 'formula', 'mix')),
  fortified boolean not null default false,
  sick_level text not null default 'none' check (sick_level in ('none', 'posset', 'small', 'large')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or started_at is null or ended_at >= started_at),
  foreign key (household_id, logged_by) references public.members (household_id, id),
  foreign key (household_id, feed_plan_slot_id)
    references public.feed_plan_slots (household_id, id) on delete set null (feed_plan_slot_id)
);

create table public.tube_changes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  logged_by uuid not null,
  logged_at timestamptz not null default now(),
  nostril text not null check (nostril in ('left', 'right')),
  inserted_at timestamptz not null default now(),
  retaped_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, logged_by) references public.members (household_id, id)
);

create table public.expressing_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  logged_by uuid not null,
  logged_at timestamptz not null default now(),
  duration_min int check (duration_min >= 0),
  left_ml numeric(6, 1) not null default 0 check (left_ml >= 0),
  right_ml numeric(6, 1) not null default 0 check (right_ml >= 0),
  storage text check (storage in ('fridge', 'freezer', 'used')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, logged_by) references public.members (household_id, id)
);

create table public.nappies (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  logged_by uuid not null,
  logged_at timestamptz not null default now(),
  wet boolean not null default false,
  dirty boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (wet or dirty),
  foreign key (household_id, logged_by) references public.members (household_id, id)
);

create table public.medicine_given (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  logged_by uuid not null,
  logged_at timestamptz not null default now(),
  medicine_id uuid not null,
  scheduled_for timestamptz,
  given_at timestamptz not null default now(),
  dose_given numeric(8, 2) check (dose_given >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, logged_by) references public.members (household_id, id),
  foreign key (household_id, medicine_id) references public.medicines (household_id, id)
);
create index medicine_given_slot_idx on public.medicine_given (medicine_id, scheduled_for);

create table public.weights (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  logged_by uuid not null,
  logged_at timestamptz not null default now(),
  measured_on date not null,
  weight_g int not null check (weight_g between 200 and 30000),
  length_cm numeric(5, 1) check (length_cm > 0),
  head_cm numeric(5, 1) check (head_cm > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, logged_by) references public.members (household_id, id)
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  logged_by uuid not null,
  logged_at timestamptz not null default now(),
  title text not null check (length(title) between 1 and 200),
  date date not null,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, logged_by) references public.members (household_id, id)
);

create table public.obs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  logged_by uuid not null,
  logged_at timestamptz not null default now(),
  temperature_c numeric(3, 1) check (temperature_c between 30 and 45),
  breathing text check (breathing in ('normal', 'noisy', 'pauses', 'colour_change')),
  sleep text check (sleep in ('settled', 'unsettled', 'very_sleepy')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, logged_by) references public.members (household_id, id)
);

create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  logged_by uuid not null,
  logged_at timestamptz not null default now(),
  exercise_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, logged_by) references public.members (household_id, id),
  foreign key (household_id, exercise_id) references public.exercises (household_id, id)
);

create table public.tummy_time (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  logged_by uuid not null,
  logged_at timestamptz not null default now(),
  duration_min int not null check (duration_min >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, logged_by) references public.members (household_id, id)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  logged_by uuid not null,
  logged_at timestamptz not null default now(),
  text text not null check (length(text) between 1 and 1000),
  appointment_id uuid,
  answered boolean not null default false,
  answer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, logged_by) references public.members (household_id, id),
  foreign key (household_id, appointment_id)
    references public.appointments (household_id, id) on delete set null (appointment_id)
);

create table public.care_task_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  logged_by uuid not null,
  logged_at timestamptz not null default now(),
  care_task_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, logged_by) references public.members (household_id, id),
  foreign key (household_id, care_task_id)
    references public.care_tasks (household_id, id) on delete cascade
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  logged_by uuid not null,
  logged_at timestamptz not null default now(),
  text text not null check (length(text) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, logged_by) references public.members (household_id, id)
);

-- ---------------------------------------------------------------------------
-- 4. Reminders
-- ---------------------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  member_id uuid not null,
  endpoint text not null unique,
  keys jsonb not null,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, member_id) references public.members (household_id, id) on delete cascade
);

-- Written only by the reminder Edge Function (service role).
create table public.reminders_sent (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  type text not null,
  ref_id uuid,
  due_at timestamptz not null,
  cleared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, type, ref_id, due_at)
);

-- ---------------------------------------------------------------------------
-- 5. Triggers and Row Level Security
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  log_tables text[] := array[
    'feeds', 'tube_changes', 'expressing_sessions', 'nappies', 'medicine_given',
    'weights', 'milestones', 'obs', 'exercise_logs', 'tummy_time', 'questions',
    'care_task_logs', 'notes'
  ];
  plan_tables text[] := array[
    'babies', 'settings', 'feed_plans', 'feed_plan_slots', 'medicines',
    'medicine_doses', 'prescriptions', 'exercises', 'exercise_steps',
    'care_tasks', 'appointments', 'supplies'
  ];
  household_tables text[] := log_tables || plan_tables || array[
    'members', 'invites', 'plan_changes', 'plan_change_seen',
    'push_subscriptions', 'reminders_sent'
  ];
begin
  -- updated_at on every table
  foreach t in array household_tables || array['households'] loop
    execute format(
      'create trigger %1$s_updated_at before update on public.%1$I
       for each row execute function app.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;

  -- household_id can never change
  foreach t in array household_tables loop
    execute format(
      'create trigger %1$s_keep_household before update on public.%1$I
       for each row execute function app.keep_household()', t);
    execute format('create index if not exists %1$s_household_idx on public.%1$I (household_id)', t);
  end loop;

  -- Log tables: every active member reads and writes.
  foreach t in array log_tables loop
    execute format(
      'create trigger %1$s_stamp before insert or update on public.%1$I
       for each row execute function app.stamp_member(''logged_by'')', t);
    execute format('create index %1$s_logged_at_idx on public.%1$I (household_id, logged_at desc)', t);
    execute format(
      'create policy "members read" on public.%I for select to authenticated
       using (app.is_member(household_id))', t);
    execute format(
      'create policy "members add" on public.%I for insert to authenticated
       with check (app.is_member(household_id))', t);
    execute format(
      'create policy "members edit" on public.%I for update to authenticated
       using (app.is_member(household_id)) with check (app.is_member(household_id))', t);
    execute format(
      'create policy "members delete" on public.%I for delete to authenticated
       using (app.is_member(household_id))', t);
  end loop;

  -- Plan tables: every active member reads, only parents write.
  foreach t in array plan_tables loop
    execute format(
      'create policy "members read" on public.%I for select to authenticated
       using (app.is_member(household_id))', t);
    execute format(
      'create policy "parents add" on public.%I for insert to authenticated
       with check (app.is_parent(household_id))', t);
    execute format(
      'create policy "parents edit" on public.%I for update to authenticated
       using (app.is_parent(household_id)) with check (app.is_parent(household_id))', t);
    execute format(
      'create policy "parents delete" on public.%I for delete to authenticated
       using (app.is_parent(household_id))', t);
  end loop;
end $$;

create trigger feed_plans_stamp before insert or update on public.feed_plans
  for each row execute function app.stamp_member('created_by');
create trigger medicine_doses_stamp before insert or update on public.medicine_doses
  for each row execute function app.stamp_member('created_by');
create trigger invites_stamp before insert or update on public.invites
  for each row execute function app.stamp_member('created_by');
create trigger plan_changes_stamp before insert or update on public.plan_changes
  for each row execute function app.stamp_member('changed_by');
create trigger plan_change_seen_stamp before insert or update on public.plan_change_seen
  for each row execute function app.stamp_member('member_id');

-- households: members read; parents rename. Created only by create_household().
create policy "members read" on public.households for select to authenticated
  using (app.is_member(id));
create policy "parents edit" on public.households for update to authenticated
  using (app.is_parent(id)) with check (app.is_parent(id));

-- members: everyone in the household sees who's who; only parents manage people.
create policy "members read" on public.members for select to authenticated
  using (app.is_member(household_id));
create policy "parents add" on public.members for insert to authenticated
  with check (app.is_parent(household_id));
create policy "parents edit" on public.members for update to authenticated
  using (app.is_parent(household_id)) with check (app.is_parent(household_id));
create policy "parents delete" on public.members for delete to authenticated
  using (app.is_parent(household_id));

-- invites: parents only (the token is a secret).
create policy "parents read" on public.invites for select to authenticated
  using (app.is_parent(household_id));
create policy "parents add" on public.invites for insert to authenticated
  with check (app.is_parent(household_id));
create policy "parents edit" on public.invites for update to authenticated
  using (app.is_parent(household_id)) with check (app.is_parent(household_id));
create policy "parents delete" on public.invites for delete to authenticated
  using (app.is_parent(household_id));

-- plan_changes: everyone reads; parents record changes. History is never edited.
create policy "members read" on public.plan_changes for select to authenticated
  using (app.is_member(household_id));
create policy "parents add" on public.plan_changes for insert to authenticated
  with check (app.is_parent(household_id));

-- plan_change_seen: everyone reads; each member marks their own (stamp_member enforces).
create policy "members read" on public.plan_change_seen for select to authenticated
  using (app.is_member(household_id));
create policy "members add own" on public.plan_change_seen for insert to authenticated
  with check (app.is_member(household_id));

-- push_subscriptions: each member manages only their own device and settings.
create policy "own read" on public.push_subscriptions for select to authenticated
  using (member_id = app.my_member_id(household_id));
create policy "own add" on public.push_subscriptions for insert to authenticated
  with check (member_id = app.my_member_id(household_id));
create policy "own edit" on public.push_subscriptions for update to authenticated
  using (member_id = app.my_member_id(household_id))
  with check (member_id = app.my_member_id(household_id));
create policy "own delete" on public.push_subscriptions for delete to authenticated
  using (member_id = app.my_member_id(household_id));

-- reminders_sent: members read; only the service role writes.
create policy "members read" on public.reminders_sent for select to authenticated
  using (app.is_member(household_id));

-- Signed-out visitors get nothing at all.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- 6. Starting a household
-- ---------------------------------------------------------------------------
-- Creates the household, the baby, default settings and the caller as its
-- first parent. Only for a signed-in user who isn't already in a household.
create function public.create_household(
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

  insert into public.households default values returning id into hid;
  insert into public.members (household_id, user_id, display_name, colour, role)
    values (hid, uid, p_display_name, p_colour, 'parent');
  insert into public.babies (household_id, name, birth_date, gestation_weeks, gestation_days, due_date)
    values (hid, p_baby_name, p_birth_date, p_gestation_weeks, p_gestation_days, p_due_date);
  insert into public.settings (household_id) values (hid);
  return hid;
end $$;

revoke all on function public.create_household(text, text, text, date, int, int, date) from public, anon;
grant execute on function public.create_household(text, text, text, date, int, int, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Realtime (live sync between phones). Realtime respects the RLS above.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.households, public.members, public.babies, public.settings,
  public.feed_plans, public.feed_plan_slots, public.medicines, public.medicine_doses,
  public.prescriptions, public.exercises, public.exercise_steps, public.care_tasks,
  public.appointments, public.supplies, public.plan_changes, public.plan_change_seen,
  public.feeds, public.tube_changes, public.expressing_sessions, public.nappies,
  public.medicine_given, public.weights, public.milestones, public.obs,
  public.exercise_logs, public.tummy_time, public.questions, public.care_task_logs,
  public.notes;
