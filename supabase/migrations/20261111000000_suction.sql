-- Suction log: how often Bella needs suctioning, how much came out and where.
-- A log table like nappies: every active member (parents and helpers) reads,
-- adds, edits and deletes; nobody outside the household sees anything.

create table public.suctions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  logged_by uuid not null,
  logged_at timestamptz not null default now(),
  amount text not null check (amount in ('little', 'medium', 'lot')),
  site text check (site in ('nose', 'mouth', 'both')),
  note text check (char_length(note) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, logged_by) references public.members (household_id, id)
);

create trigger suctions_updated_at before update on public.suctions
  for each row execute function app.set_updated_at();
create trigger suctions_keep_household before update on public.suctions
  for each row execute function app.keep_household();
create trigger suctions_stamp before insert or update on public.suctions
  for each row execute function app.stamp_member('logged_by');
create index suctions_logged_at_idx on public.suctions (household_id, logged_at desc);

alter table public.suctions enable row level security;
create policy "members read" on public.suctions for select to authenticated
  using (app.is_member(household_id));
create policy "members add" on public.suctions for insert to authenticated
  with check (app.is_member(household_id));
create policy "members edit" on public.suctions for update to authenticated
  using (app.is_member(household_id)) with check (app.is_member(household_id));
create policy "members delete" on public.suctions for delete to authenticated
  using (app.is_member(household_id));

revoke all on public.suctions from anon;
grant select, insert, update, delete on public.suctions to authenticated;

alter publication supabase_realtime add table public.suctions;
