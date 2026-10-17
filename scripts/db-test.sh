#!/usr/bin/env bash
# Runs the pgTAP tests in supabase/tests against SUPABASE_DB_URL (.env.local).
# Each file runs in its own transaction and is rolled back, so no data is left behind.
# The database must already have every migration applied.
# Usage: npm run db:test
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env.local ]; then
  SUPABASE_DB_URL="$(grep -E '^SUPABASE_DB_URL=' .env.local | cut -d= -f2-)"
fi
if [ -z "${SUPABASE_DB_URL:-}" ] || [[ "$SUPABASE_DB_URL" == *YOUR-* ]]; then
  echo "Set SUPABASE_DB_URL in .env.local (Supabase > Connect > Session pooler URI)" >&2
  exit 1
fi

failed=0
for f in supabase/tests/*.test.sql; do
  echo "==> $f"
  out="$(psql "$SUPABASE_DB_URL" -q -t -f "$f" 2>&1 | grep -E '^ *(ok|not ok|1\.\.|#)|ERROR' || true)"
  echo "$out" | grep -E 'not ok|ERROR|# ' || true
  echo "$out" | grep -cE '^ *ok' | sed 's/^/    passed: /'
  if echo "$out" | grep -qE 'not ok|ERROR'; then failed=1; fi
done
exit $failed
