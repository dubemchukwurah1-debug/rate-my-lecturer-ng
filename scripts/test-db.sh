#!/usr/bin/env bash
# Starts a throwaway local Postgres, applies the migrations and seed, and prints a
# DATABASE_URL for `npm test` / `npm run dev`. Supabase's auth schema is stubbed.
set -euo pipefail
PGBIN=${PGBIN:-/usr/lib/postgresql/16/bin}
DIR=${PGDATA_DIR:-/tmp/rml-pg}
PORT=${PGPORT:-54329}
# Postgres refuses to run as root; drop to the postgres user when needed.
AS=()
if [ "$(id -u)" = 0 ]; then AS=(runuser -u postgres --); fi
[ -f "$DIR/postmaster.pid" ] && "${AS[@]}" "$PGBIN/pg_ctl" -D "$DIR" stop -m fast >/dev/null || true
rm -rf "$DIR" && mkdir -p "$DIR" && { [ ${#AS[@]} = 0 ] || chown postgres "$DIR"; }
"${AS[@]}" "$PGBIN/initdb" -D "$DIR" -U postgres --auth=trust >/dev/null
"${AS[@]}" "$PGBIN/pg_ctl" -D "$DIR" -o "-p $PORT -k /tmp" -l "$DIR/log" start -w >/dev/null
URL="postgres://postgres@localhost:$PORT/postgres"
psql "$URL" -q -v ON_ERROR_STOP=1 <<'SQL'
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid());
create function auth.uid() returns uuid language sql stable as 'select null::uuid';
SQL
for f in supabase/migrations/*.sql supabase/seed.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f"; done
echo "$URL"
