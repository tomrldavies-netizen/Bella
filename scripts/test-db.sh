#!/usr/bin/env bash
# Runs the migrations and RLS tests on a throwaway Postgres database.
# Usage: DATABASE_URL=postgres://postgres@localhost:5432/postgres scripts/test-db.sh
# The database named in DATABASE_URL is only used to create and drop "bella_test".
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?Set DATABASE_URL to a Postgres superuser connection}"

TEST_DB=bella_test
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -c "drop database if exists $TEST_DB" -c "create database $TEST_DB"
# Roles are cluster-wide; drop any left over from an earlier run.
psql "$DATABASE_URL" -q -c "drop role if exists anon" -c "drop role if exists authenticated" -c "drop role if exists service_role" >/dev/null 2>&1 || true

TEST_URL="${DATABASE_URL%/*}/$TEST_DB"
run() { psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$1"; }

run supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  echo "Applying $f"
  run "$f"
done
echo "Running RLS tests"
# Results go to /dev/null; each check prints a NOTICE, and any failure stops the run.
psql "$TEST_URL" -q -X -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql >/dev/null
echo "All RLS tests passed."

psql "$DATABASE_URL" -q -c "drop database $TEST_DB"
