# Synthetic Test and Rollback Plan

Status: `RC6 PREPARED / NOT_EXECUTED_ON_POSTGRESQL`  
Scope: disposable PostgreSQL 17 or an explicitly approved isolated Supabase test environment only

## Candidate files

- `20261028_01_create_boerns_agent_claims.sql`
- `20261028_01_drop_boerns_agent_claims.sql`
- `tests/00_local_database_preflight.sql`
- `tests/10_functional_smoke.sql`
- `tests/20_concurrent_acquire.sh`
- `tests/25_empty_rollback_race.sh`
- `adapter/error_mapping.mjs`
- `tests/30_adapter_error_mapping.test.mjs`

## Required execution sequence

```bash
psql "$DATABASE_URL" -f tests/00_local_database_preflight.sql
psql "$DATABASE_URL" -f 20261028_01_create_boerns_agent_claims.sql
psql "$DATABASE_URL" -f tests/10_functional_smoke.sql
DATABASE_URL="$DATABASE_URL" tests/20_concurrent_acquire.sh
DATABASE_URL="$DATABASE_URL" tests/25_empty_rollback_race.sh
node --test tests/30_adapter_error_mapping.test.mjs
```

`DATABASE_URL` must point to a disposable environment. It must never point to
FanMind production under the current authorization.

## Assertions

| Test | Expected result |
|---|---|
| Initial state | service disabled; zero principals |
| Permissions | `PUBLIC` has no RPC execute; runtime has no table read/DML |
| Disabled service | all runtime mutations fail closed |
| Offer | coordinator can create one unique task key |
| Request conflict | same UUID plus changed fingerprint is rejected |
| Foreign principal | cannot acquire another agent's task |
| Foreign renew | foreign and unknown claim IDs both yield `BC003` before fence validation |
| Authorization | authenticated principal without `can_offer` yields `BC008`, not `BC002` |
| First acquire | exactly one `ACQUIRED` response and fencing token |
| Same-key replay | semantically identical stored JSONB response plus `replayed=true` |
| New acquire request | `ALREADY_CLAIMED`; no new token |
| Read-back | claim-ID read returns the same state and fencing token |
| Missing fence value | SQL `NULL` is rejected before renew/finalize |
| Lease bounds | 14 and 901 seconds are rejected; 120 seconds renews |
| Recovery | expired lease receives higher token through `acquire` |
| Stale fence | cannot finalize after recovery |
| Completion replay | one terminal mutation and one completion audit event |
| Revoked principal | disabled principal cannot acquire an offered task |
| Restore primitive | service closes, epoch changes, leases invalidate, fresh acquire required |
| Restore receipt | pre-restore request receipt is rejected in the new epoch |
| Append-only | receipt/audit update, delete and truncate are rejected |
| Parallel offer | eight clients yield one `OFFERED`, seven `ALREADY_EXISTS` |
| Parallel acquire | eight clients yield one `ACQUIRED`, seven `ALREADY_CLAIMED` |
| Same request race | eight copies replay one receipt and one `ACQUIRED` audit event |
| Restore lock race | epoch rotation waits for an open RPC transaction, then disables and invalidates leases |
| Empty rollback, writer first | committed concurrent row is counted after locks; rollback aborts without deletion |
| Empty rollback, rollback first | later writer cannot pass the exclusive locks or recreate a dropped schema |
| Adapter catch-all | unknown SQLSTATE, ACL, driver, timeout, malformed response, and transport errors all yield generic 503 |

## Additional independent cases required before production

BT-030's prepared matrix must cover transaction aborts, same-key concurrent
requests, sequence/epoch behavior, process death before and after commit,
database disconnect, API timeout, restore rewind, oversized input, disabled and
revoked principals, enumeration resistance, load/lock behavior, and target
side-effect fencing. BT-006 must check requirement traceability, FanMind
nonregression and reproducibility. BT-038 must verify immutable hashes, raw logs,
operator identity and rollback evidence.

## Rollback rehearsal

1. Deploy to a clean disposable database and verify `service_enabled=false`.
2. Before adding principals, execute the drop file without its session guard;
   expect rejection.
3. Set `boerns_agent_claims.rollback_approved=true` in the rollback transaction
   and execute the drop; verify the exclusive gate and all table locks precede
   the emptiness check, then verify schema and both roles no longer exist.
4. Redeploy, load synthetic operational rows and repeat without
   any additional flag; expect unconditional rejection.
5. Verify that operational rollback requires a separately approved forward fix
   or restore plan; RC6 contains no data-loss override.
6. Compare full pre/post catalogs for all non-claim objects in the empty case.
7. Run both deterministic writer-first and rollback-first races; neither may
   delete a committed operational row or allow a post-check insert.

## Stop criteria

Stop and mark `FAIL` or `BLOCKED` on any duplicate `ACQUIRED`, reused fence,
unauthorized table/RPC access, mutation while disabled, changed FanMind object,
unexplained lock, unbounded transaction, secret in output, incomplete audit,
restore without new epoch, or inability to reproduce the exact candidate hash.

## Current execution evidence

No PostgreSQL result is claimed. The available container has no PostgreSQL
server/client. Attempting to install the isolated engine failed because the
configured Ubuntu snapshot endpoint returned HTTP `403` through the environment
proxy. No external or production database was contacted as a workaround.

### Exact next action

Run the immutable RC6 archive once in an explicitly authorized disposable
PostgreSQL 17 environment and submit native logs plus the archive hash for
independent review. Production approval is not requested.
