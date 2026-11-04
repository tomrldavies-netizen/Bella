-- Bella's Safari: phase 7, appointments, supplies, prescriptions, expressing,
-- firsts with photos, and "plan has changed".
--
-- How to apply: Supabase dashboard → SQL Editor → New query → paste this
-- whole file → Run. Run it once, after the phase 6 file.

-- ---------------------------------------------------------------------------
-- 1. Prescriptions: one row per bottle. "Reordered" hides the reorder warning.
-- ---------------------------------------------------------------------------
alter table public.prescriptions add column reordered_at timestamptz;
create index prescriptions_medicine_idx on public.prescriptions (medicine_id, opened_at desc);

-- ---------------------------------------------------------------------------
-- 2. Supplies: helpers may change the count (agreed with the parents), but
--    adding/removing items and low-stock levels stay with parents (RLS).
-- ---------------------------------------------------------------------------
create function public.set_supply_quantity(p_supply_id uuid, p_quantity int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_quantity < 0 then
    raise exception 'Quantity can''t be below zero' using errcode = '22023';
  end if;
  update public.supplies s
    set quantity = p_quantity
    where s.id = p_supply_id and app.is_member(s.household_id);
  if not found then
    raise exception 'Supply not found' using errcode = '42501';
  end if;
end $$;

revoke all on function public.set_supply_quantity(uuid, int) from public, anon;
grant execute on function public.set_supply_quantity(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Expressing: frozen milk stays in the freezer stock until marked used.
-- ---------------------------------------------------------------------------
alter table public.expressing_sessions add column used_at timestamptz;

-- ---------------------------------------------------------------------------
-- 4. Bella's firsts: photos in a private bucket, one folder per household.
--    Only members of that household can see, add or remove its photos.
--    (Skipped where Supabase Storage isn't installed, e.g. the test database.)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('firsts', 'firsts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
      on conflict (id) do nothing;

    execute $p$
      create policy "household members read firsts" on storage.objects for select to authenticated
      using (bucket_id = 'firsts' and app.is_member(((storage.foldername(name))[1])::uuid))
    $p$;
    execute $p$
      create policy "household members add firsts" on storage.objects for insert to authenticated
      with check (bucket_id = 'firsts' and app.is_member(((storage.foldername(name))[1])::uuid))
    $p$;
    execute $p$
      create policy "household members remove firsts" on storage.objects for delete to authenticated
      using (bucket_id = 'firsts' and app.is_member(((storage.foldername(name))[1])::uuid))
    $p$;
  end if;
end $$;
