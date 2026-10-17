#!/usr/bin/env bash
# Runs all migrations + seed against the Supabase database in SUPABASE_DB_URL (.env.local).
# Usage: npm run db:setup
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
  SUPABASE_DB_URL="$(grep -E '^SUPABASE_DB_URL=' .env.local | cut -d= -f2-)"
fi
if [ -z "${SUPABASE_DB_URL:-}" ] || [[ "$SUPABASE_DB_URL" == *YOUR-* ]]; then
  echo "Set SUPABASE_DB_URL in .env.local (Supabase > Connect > Session pooler URI)" >&2
  exit 1
fi

for f in supabase/migrations/*.sql supabase/seed.sql; do
  echo "==> $f"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -q --single-transaction -f "$f"
done
echo "Done."
