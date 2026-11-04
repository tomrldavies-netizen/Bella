-- Shared helpers for the *_test.sql files. Loaded before each test file.
\set ON_ERROR_STOP 1

create schema tests;
grant usage on schema tests to anon, authenticated;

-- Switch to a signed-in user (or signed out when uid is null).
create function tests.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  perform set_config('role', case when uid is null then 'anon' else 'authenticated' end, false);
end $$;

create function tests.must_fail(q text, why text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    raise notice 'ok (blocked): % [%]', why, sqlerrm;
    return;
  end;
  raise exception 'FAIL: expected this to be blocked: %', why;
end $$;

create function tests.must_succeed(q text, why text) returns void language plpgsql as $$
begin
  execute q;
  raise notice 'ok: %', why;
end $$;

create function tests.check_count(q text, expected bigint, why text) returns void language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || q || ') t' into n;
  if n <> expected then
    raise exception 'FAIL: % (expected %, got %)', why, expected, n;
  end if;
  raise notice 'ok: %', why;
end $$;

-- Rows changed by an UPDATE/DELETE (RLS filters silently rather than erroring).
create function tests.check_changed(q text, expected bigint, why text) returns void language plpgsql as $$
declare n bigint;
begin
  execute q;
  get diagnostics n = row_count;
  if n <> expected then
    raise exception 'FAIL: % (expected % rows changed, got %)', why, expected, n;
  end if;
  raise notice 'ok: %', why;
end $$;

grant execute on all functions in schema tests to anon, authenticated;
