#!/usr/bin/env bash
# Runs the migrations and database tests on throwaway Postgres databases.
# Usage: DATABASE_URL=postgres://postgres@localhost:5432/postgres scripts/test-db.sh
# The database named in DATABASE_URL is only used to create and drop "bella_test".
# Each supabase/tests/*_test.sql file gets a fresh database.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DATABASE_URL:?Set DATABASE_URL to a Postgres superuser connection}"

TEST_DB=bella_test
TEST_URL="${DATABASE_URL%/*}/$TEST_DB"
run() { psql "$TEST_URL" -q -X -v ON_ERROR_STOP=1 -f "$1" >/dev/null; }

fresh_db() {
  psql "$DATABASE_URL" -q -X -v ON_ERROR_STOP=1 -c "drop database if exists $TEST_DB" -c "create database $TEST_DB" 2>/dev/null
  # Roles are cluster-wide; drop any left over from an earlier run.
  psql "$DATABASE_URL" -q -X -c "drop role if exists anon" -c "drop role if exists authenticated" -c "drop role if exists service_role" >/dev/null 2>&1 || true
  run supabase/tests/00_supabase_stub.sql
  for f in supabase/migrations/*.sql; do
    run "$f"
  done
  run supabase/tests/01_test_helpers.sql
}

echo "Migrations: $(ls supabase/migrations/*.sql | xargs -n1 basename | tr '\n' ' ')"
for t in supabase/tests/*_test.sql; do
  echo "Running $(basename "$t")"
  fresh_db
  # Results go to /dev/null; each check prints a NOTICE, and any failure stops the run.
  run "$t"
done
psql "$DATABASE_URL" -q -X -c "drop database $TEST_DB"
echo "All database tests passed."
