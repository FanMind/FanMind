#!/usr/bin/env bash
# RC6 empty-rollback linearization test. Disposable PostgreSQL 17 only.
set -euo pipefail

: "${ROLLBACK_DATABASE_URL:?must point to a separate disposable PostgreSQL 17 database}"

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
forward_sql="$root_dir/20261028_01_create_boerns_agent_claims.sql"
rollback_sql="$root_dir/20261028_01_drop_boerns_agent_claims.sql"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

run_rollback() {
  psql "$ROLLBACK_DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
set boerns_agent_claims.rollback_approved = 'true';
\i '$rollback_sql'
SQL
}

psql "$ROLLBACK_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f "$root_dir/tests/00_local_database_preflight.sql"
psql "$ROLLBACK_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$forward_sql"

# Writer-first race: rollback must wait, then count the committed row and abort.
(
  psql "$ROLLBACK_DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
begin;
insert into boerns_agent_claims.principals
  (agent_id, auth_issuer, auth_subject, enabled, can_offer)
values
  ('BT-006', 'https://claims.test.local', 'rollback-race-writer', false, false);
\! touch '$tmp_dir/writer.ready'
\! while [ ! -e '$tmp_dir/writer.go' ]; do sleep 0.01; done
commit;
SQL
) &
writer_pid=$!

for _ in $(seq 1 500); do
  [[ -e "$tmp_dir/writer.ready" ]] && break
  sleep 0.01
done
[[ -e "$tmp_dir/writer.ready" ]]

(run_rollback >"$tmp_dir/writer_first.out" 2>&1) &
rollback_pid=$!
sleep 0.2
kill -0 "$rollback_pid" 2>/dev/null
touch "$tmp_dir/writer.go"
wait "$writer_pid"
if wait "$rollback_pid"; then
  printf 'Rollback deleted a row committed by the writer-first race\n' >&2
  exit 1
fi

psql "$ROLLBACK_DATABASE_URL" -At -v ON_ERROR_STOP=1 <<'SQL' |
select case
  when to_regnamespace('boerns_agent_claims') is not null
   and (select count(*) from boerns_agent_claims.principals) = 1
  then 'WRITER_FIRST_PASS'
  else 'WRITER_FIRST_FAIL'
end;
SQL
grep -qx WRITER_FIRST_PASS

psql "$ROLLBACK_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -c "delete from boerns_agent_claims.principals where agent_id = 'BT-006'"

# Rollback-first race: hold the last table lock so the rollback owns the gate
# and earlier table locks before a late direct writer attempts an insert.
(
  psql "$ROLLBACK_DATABASE_URL" -v ON_ERROR_STOP=1 <<SQL
begin;
lock table boerns_agent_claims.audit_events in access share mode;
\! touch '$tmp_dir/blocker.ready'
\! while [ ! -e '$tmp_dir/blocker.go' ]; do sleep 0.01; done
commit;
SQL
) &
blocker_pid=$!

for _ in $(seq 1 500); do
  [[ -e "$tmp_dir/blocker.ready" ]] && break
  sleep 0.01
done
[[ -e "$tmp_dir/blocker.ready" ]]

(run_rollback >"$tmp_dir/rollback_first.out" 2>&1) &
rollback_pid=$!

for _ in $(seq 1 500); do
  lock_count="$(psql "$ROLLBACK_DATABASE_URL" -At -v ON_ERROR_STOP=1 <<'SQL'
select count(*)
  from pg_locks l
  join pg_class c on c.oid = l.relation
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'boerns_agent_claims'
   and c.relname = 'principals'
   and l.mode = 'AccessExclusiveLock'
   and l.granted;
SQL
)"
  [[ "$lock_count" == "1" ]] && break
  sleep 0.01
done
[[ "$lock_count" == "1" ]]

(
  psql "$ROLLBACK_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
insert into boerns_agent_claims.principals
  (agent_id, auth_issuer, auth_subject, enabled, can_offer)
values
  ('BT-006', 'https://claims.test.local', 'rollback-race-late', false, false);
SQL
) >"$tmp_dir/late_writer.out" 2>&1 &
late_writer_pid=$!

sleep 0.2
kill -0 "$late_writer_pid" 2>/dev/null
touch "$tmp_dir/blocker.go"
wait "$blocker_pid"
wait "$rollback_pid"
if wait "$late_writer_pid"; then
  printf 'Late writer passed rollback-owned table locks\n' >&2
  exit 1
fi

test "$(psql "$ROLLBACK_DATABASE_URL" -At -v ON_ERROR_STOP=1 \
  -c "select to_regnamespace('boerns_agent_claims') is null")" = "t"
printf 'EMPTY_ROLLBACK_RACES_PASS\n'
