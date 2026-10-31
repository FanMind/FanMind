# Börns Agent Claims RC6

Immutable correction candidate for `BOERNS-CLAIM-SUPABASE-001`.

Status: `REVIEW_PENDING / NATIVE_DB_TEST_NOT_RUN / PRODUCTION_NOT_AUTHORIZED`

## Provenance

- Superseded basis: `boerns-agent-claims-rc5.zip`
- RC5 archive SHA-256:
  `c34eff8bf387e3f3806724500610f2514315b26ff532edb6fe6f89844f7c8b8b`
- Source evidence: Boerns-Core issue 32 comments `6426677669`,
  `6426679843`, `6426681991`, and `6426684132`.
- Blocking reviews: issue 32 comments `6426780757` and `6426783707`.
- RC1 through RC5 remain unchanged. RC6 has no deployment or production effect.

The RC5 archive itself was not exposed by the available connector. The RC5
forward SQL and rollback were reconstructed byte-for-byte from the append-only
comments and matched their published SHA-256 values. The RC5 documentation and
test sources were reconstructed from the same comments; RC6 assigns fresh
hashes to every resulting file and does not reuse the inconsistent RC5 test
manifest values.

## Corrections

1. Empty rollback takes the exclusive control-row gate and `ACCESS EXCLUSIVE`
   locks on all five tables before checking emptiness. Locks remain held through
   every `RESTRICT` drop in the same transaction.
2. `renew` checks holder visibility before state or fence details. A foreign and
   an unknown `claim_id` both raise `BC003`.
3. Authentication remains `BC002`/401; an authenticated principal lacking
   `can_offer` now raises `BC008`/403.
4. The adapter error map is closed. Unknown SQLSTATEs, ACL failures, driver
   errors, timeouts, malformed results, and transport failures map to a generic
   503 `CLAIM_STATUS_UNKNOWN` without internal details.
5. Functional, adapter, and deterministic rollback-race tests cover the four
   corrections. No PostgreSQL result is claimed in this design-only step.

## Files

- `20261028_01_create_boerns_agent_claims.sql`
- `20261028_01_drop_boerns_agent_claims.sql`
- `API_CONTRACT.md`
- `ARCHITECTURE_AND_PRODUCTION_GATE.md`
- `TEST_AND_ROLLBACK_PLAN.md`
- `adapter/error_mapping.mjs`
- `tests/00_local_database_preflight.sql`
- `tests/10_functional_smoke.sql`
- `tests/20_concurrent_acquire.sh`
- `tests/25_empty_rollback_race.sh`
- `tests/30_adapter_error_mapping.test.mjs`
- `RC5_TO_RC6.diff`
- `MANIFEST.sha256`

`MANIFEST.sha256` binds every file above except itself. Its own digest and the
archive digest are published separately with the append-only evidence.

## Verification Boundary

Executed locally: manifest read-back, SHA-256 recomputation, `bash -n`, and the
Node adapter unit tests. PostgreSQL 17 migration, rollback, concurrency, RLS,
and race tests are `NOT_RUN` by instruction. FanMind was not accessed or
mutated. No merge, deployment, secret, right, provider, or production change
was performed.
