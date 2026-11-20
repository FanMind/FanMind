#!/usr/bin/env bash
# Revision 16 / RC6 deterministic concurrency tests.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to a disposable PostgreSQL 17 database}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

wait_for_barrier() {
  local prefix="$1"
  local expected="$2"
  local count
  for _ in $(seq 1 1000); do
    count="$(find "$tmp_dir" -maxdepth 1 -name "$prefix.*.ready" | wc -l)"
    if [[ "$count" == "$expected" ]]; then
      return 0
    fi
    sleep 0.01
  done
  printf 'Barrier %s reached only %s/%s clients\n' "$prefix" "$count" "$expected" >&2
  return 1
}

# Eight concurrent offers must create one row and one OFFERED audit event.
for i in 1 2 3 4 5 6 7 8; do
  request_id="20000000-0000-0000-0000-$(printf '%012d' "$i")"
  (
    touch "$tmp_dir/offer.$i.ready"
    while [[ ! -e "$tmp_dir/offer.go" ]]; do sleep 0.01; done
    psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 <<SQL >"$tmp_dir/offer.$i.out"
set role boerns_claims_runtime;
select boerns_agent_claims.offer(
  'https://claims.test.local', 'subject-bt001',
  'SYNTH-RACE', 'T1', 1, 'BT-006', '$request_id'
) ->> 'operation_status';
SQL
  ) &
done
wait_for_barrier offer 8
touch "$tmp_dir/offer.go"
wait

offered_count="$(grep -hxc 'OFFERED' "$tmp_dir"/offer.*.out || true)"
existing_count="$(grep -hxc 'ALREADY_EXISTS' "$tmp_dir"/offer.*.out || true)"
if [[ "$offered_count" != "1" || "$existing_count" != "7" ]]; then
  printf 'Expected 1 OFFERED and 7 ALREADY_EXISTS, got %s and %s\n' \
    "$offered_count" "$existing_count" >&2
  grep -H . "$tmp_dir"/offer.*.out >&2 || true
  exit 1
fi

# Eight concurrent distinct acquire requests must mint exactly one fencing token.
for i in 1 2 3 4 5 6 7 8; do
  request_id="21000000-0000-0000-0000-$(printf '%012d' "$i")"
  (
    touch "$tmp_dir/acquire.$i.ready"
    while [[ ! -e "$tmp_dir/acquire.go" ]]; do sleep 0.01; done
    psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 <<SQL >"$tmp_dir/acquire.$i.out"
set role boerns_claims_runtime;
select boerns_agent_claims.acquire(
  'https://claims.test.local', 'subject-bt006',
  'SYNTH-RACE', 'T1', 1, '$request_id', 120
) ->> 'operation_status';
SQL
  ) &
done
wait_for_barrier acquire 8
touch "$tmp_dir/acquire.go"
wait

acquired_count="$(grep -hxc 'ACQUIRED' "$tmp_dir"/acquire.*.out || true)"
observed_count="$(grep -hxc 'ALREADY_CLAIMED' "$tmp_dir"/acquire.*.out || true)"
if [[ "$acquired_count" != "1" || "$observed_count" != "7" ]]; then
  printf 'Expected 1 ACQUIRED and 7 ALREADY_CLAIMED, got %s and %s\n' \
    "$acquired_count" "$observed_count" >&2
  grep -H . "$tmp_dir"/acquire.*.out >&2 || true
  exit 1
fi

# Eight concurrent copies of one request must all replay one stored response.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
set role boerns_claims_runtime;
select boerns_agent_claims.offer(
  'https://claims.test.local', 'subject-bt001',
  'SYNTH-SAME-REQUEST', 'T1', 1, 'BT-006',
  '22000000-0000-0000-0000-000000000001'
);
SQL

for i in 1 2 3 4 5 6 7 8; do
  (
    touch "$tmp_dir/same.$i.ready"
    while [[ ! -e "$tmp_dir/same.go" ]]; do sleep 0.01; done
    psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 <<'SQL' >"$tmp_dir/same.$i.out"
set role boerns_claims_runtime;
select boerns_agent_claims.acquire(
  'https://claims.test.local', 'subject-bt006',
  'SYNTH-SAME-REQUEST', 'T1', 1,
  '22000000-0000-0000-0000-000000000002', 120
) ->> 'operation_status';
SQL
  ) &
done
wait_for_barrier same 8
touch "$tmp_dir/same.go"
wait

same_count="$(grep -hxc 'ACQUIRED' "$tmp_dir"/same.*.out || true)"
if [[ "$same_count" != "8" ]]; then
  printf 'Expected 8 identical ACQUIRED responses, got %s\n' "$same_count" >&2
  grep -H . "$tmp_dir"/same.*.out >&2 || true
  exit 1
fi

psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 <<'SQL'
do $assert$
declare
  v_race_claim_id uuid;
  v_same_claim_id uuid;
begin
  select claim_id into v_race_claim_id
    from boerns_agent_claims.claims
   where task_id = 'SYNTH-RACE' and step_id = 'T1' and revision = 1;
  select claim_id into v_same_claim_id
    from boerns_agent_claims.claims
   where task_id = 'SYNTH-SAME-REQUEST' and step_id = 'T1' and revision = 1;

  if (select count(*) from boerns_agent_claims.audit_events
       where claim_id = v_race_claim_id and event_type = 'OFFERED') <> 1 then
    raise exception 'concurrent offer created an invalid OFFERED audit count';
  end if;
  if (select count(*) from boerns_agent_claims.audit_events
       where claim_id = v_race_claim_id and event_type = 'ACQUIRED') <> 1 then
    raise exception 'concurrent acquire created an invalid ACQUIRED audit count';
  end if;
  if (select count(distinct fence_token) from boerns_agent_claims.audit_events
       where claim_id = v_race_claim_id and fence_token is not null) <> 1 then
    raise exception 'concurrent acquire exposed more than one fencing token';
  end if;
  if (select count(*) from boerns_agent_claims.audit_events
       where claim_id = v_same_claim_id and event_type = 'ACQUIRED') <> 1 then
    raise exception 'same-request race executed acquire more than once';
  end if;
  if (select count(*) from boerns_agent_claims.request_receipts
       where actor_agent_id = 'BT-006'
         and request_id = '22000000-0000-0000-0000-000000000002') <> 1 then
    raise exception 'same-request race did not persist exactly one receipt';
  end if;
end
$assert$;
select 'CONCURRENT_OFFER_ACQUIRE_AND_REPLAY_PASS';
SQL

# A live RPC holds a shared service-gate lock to transaction end. Restore epoch
# rotation must wait for it, then take the exclusive gate lock before claims.
old_epoch="$(psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 -c \
  "select fence_epoch from boerns_agent_claims.control_state where singleton")"
same_claim_id="$(psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 -c \
  "select claim_id from boerns_agent_claims.claims where task_id = 'SYNTH-SAME-REQUEST' and step_id = 'T1' and revision = 1")"
(
  psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 <<SQL >"$tmp_dir/gate_reader.out"
begin;
set role boerns_claims_runtime;
select boerns_agent_claims.read(
  'https://claims.test.local', 'subject-bt006',
  '$same_claim_id'::uuid
) ->> 'state';
\! touch "$tmp_dir/gate.ready"
select pg_sleep(2);
commit;
SQL
) &
gate_pid=$!

for _ in $(seq 1 500); do
  [[ -e "$tmp_dir/gate.ready" ]] && break
  sleep 0.01
done
if [[ ! -e "$tmp_dir/gate.ready" ]]; then
  printf 'Gate reader did not reach the restore barrier\n' >&2
  exit 1
fi

(
  psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 <<'SQL' >"$tmp_dir/rotate.out"
select boerns_agent_claims.rotate_epoch_after_restore('LOCAL_GATE_RACE_TEST');
SQL
) &
rotate_pid=$!

sleep 0.2
if ! kill -0 "$rotate_pid" 2>/dev/null; then
  printf 'Epoch rotation did not wait for the live service-gate reader\n' >&2
  wait "$rotate_pid" || true
  exit 1
fi

wait "$gate_pid"
wait "$rotate_pid"

new_epoch="$(tr -d '[:space:]' <"$tmp_dir/rotate.out")"
if [[ -z "$new_epoch" || "$new_epoch" == "$old_epoch" ]]; then
  printf 'Epoch rotation did not return a fresh epoch\n' >&2
  exit 1
fi

psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 <<'SQL'
do $assert$
begin
  if (select service_enabled from boerns_agent_claims.control_state where singleton) then
    raise exception 'service remained enabled after restore race';
  end if;
  if exists (
    select 1 from boerns_agent_claims.claims
     where state = 'CLAIMED'
        or holder_agent_id is not null
        or lease_expires_at is not null
  ) then
    raise exception 'restore race left an authoritative live lease';
  end if;
end
$assert$;
select 'SERVICE_GATE_RESTORE_RACE_PASS';
SQL
