# FanMind Co-Located Claim Service: Architecture and Production Gate

Status: `DESIGN_PREPARED / TEST_EXECUTION_BLOCKED / PRODUCTION_NOT_AUTHORIZED`  
Task: `BOERNS-CLAIM-SUPABASE-001`  
Issue: `Bernds-tech/Boerns-Core#32`  
Revision: 16 / RC6  
Target: FanMind Supabase `drqkpdvtbbrrdwmtrodz`, PostgreSQL 17

## Decision and isolation boundary

The unused authorization to create `boerns-agent-claims-pilot` is withdrawn.
No Supabase project was created. The candidate is designed for co-location in
FanMind, but every database object is new and namespace-bound. Existing FanMind
tables, functions, schemas, exposed-schema settings, applications, data, and
permissions are not modified by this draft.

Co-location still shares project administrators, database superusers,
`service_role`, compute, connection pools, backup/restore, outage and billing
boundaries with FanMind. A private schema reduces accidental coupling; it does
not create project-level tenant isolation. Production remains blocked until this
residual risk and the actual FanMind baseline are reviewed.

## Exact database objects

| Kind | Objects |
|---|---|
| Roles | `boerns_claims_owner` (`NOLOGIN`), `boerns_claims_runtime` (`NOLOGIN`) |
| Schema | `boerns_agent_claims` |
| Sequence | `fencing_token_seq` |
| Tables | `control_state`, `principals`, `claims`, `request_receipts`, `audit_events` |
| Explicit indexes | `claims_recovery_idx`, `claims_intended_agent_idx`, `audit_events_claim_idx`, `audit_events_request_idx` |
| RLS policies | one owner-only policy on each table |
| Triggers | row mutation and statement-level truncate guards on `request_receipts` and `audit_events` |
| Private RPCs | `offer`, `acquire`, `renew`, `complete`, `read` |
| Internal functions | `forbid_mutation`, `lock_service_gate`, `current_agent`, `request_replay`, `record_request`, `claim_response`, `write_audit`, `rotate_epoch_after_restore` |

No extension is installed. No object is created in `public`. No schema is added
to the Supabase API exposure list. The runtime role receives no table privilege
and only signature-specific `EXECUTE` on the five private RPCs.

## State and transaction model

The unique authoritative key is `(task_id, step_id, revision)`. Identifiers are
length- and character-constrained so the derived colon-separated `claim_key` is
unambiguous.

`acquire` locks the claim row with `FOR UPDATE`. Only the intended enabled
principal can acquire it. The first acquisition creates a database-generated
lease and a monotonically increasing sequence token. A concurrent acquisition
observes the committed holder and receives no new token. An expired claim can be
atomically recovered by the same intended principal and receives a higher token.

Every mutating request is serialized by a transaction-level advisory lock over
`(agent_id, request_id)`. The receipt stores the operation, structured
fingerprint and complete response in the same transaction as claim and audit
state. Changed-payload reuse fails closed.

Every runtime RPC first locks the singleton control row `FOR SHARE` and holds the
lock to transaction end. Restore rotation takes `FOR UPDATE` on that same row
before touching any claim, so it waits for in-flight RPC transactions and new
RPCs fail closed after the service is disabled. This fixed lock order prevents a
restore from creating an authoritative post-rotation write under an old epoch.

The empty rollback uses the same singleton as an exclusive linearization gate.
It takes `FOR UPDATE`, disables service, obtains `ACCESS EXCLUSIVE` locks on all
five tables, and only then counts operational rows. Existing runtime and direct
writers finish before the count; later writers remain blocked through the
`RESTRICT` drops. A committed row therefore aborts rollback instead of being
deleted after a stale emptiness observation.

Completion requires the current principal, active lease, epoch, token and a
unique completion UUID. The terminal state is immutable through the runtime API.

## Fencing and restore

A fencing credential is the pair `(fence_epoch, fence_token)`. The sequence is
monotonic only inside an epoch. A database restore can rewind sequence and row
state, so restore safety cannot rely on the restored epoch value.

The restore runbook must keep the API closed, invoke the ungranted administrative
`rotate_epoch_after_restore` function, disable the service, invalidate all active
leases, and verify the new epoch from an independently controlled deployment
step before reopening. Old clients and side-effect adapters must reject all other
epochs. Request receipts carry their creation epoch; replay of a pre-restore
receipt is rejected rather than returned as current truth.

## Data minimization

Stored data is restricted to task coordinates, pseudonymous agent IDs and
workload subjects, lease/fence state, request UUIDs, terminal code, an opaque
evidence reference, its SHA-256 digest, and technical timestamps. Prompts, task
payloads, chat or issue contents, message bodies, authorization headers, tokens,
secrets and arbitrary runtime metadata are excluded.

The final retention schedule is not yet approved. No purge job is included in
the migration; deleting receipts without a proven idempotency horizon could
re-enable old requests. Retention therefore remains a production gate.

## Failure and load risks

| Risk | Current control | Remaining proof |
|---|---|---|
| Duplicate workers | unique key, row lock, receipt replay | PostgreSQL-17 parallel test |
| Stale worker side effects | epoch plus token | target adapters must enforce the fence |
| Ambiguous API timeout | stored response and same-key retry | API integration test |
| Database outage | API returns `CLAIM_STATUS_UNKNOWN`; no work starts | outage test |
| Unknown database/driver result | closed error map returns generic 503 | adapter negative test |
| Restore rewind | disabled restore path and epoch rotation | isolated restore rehearsal |
| Noisy neighbor impact on FanMind | short transactions and indexed lookups | baseline, connection and load test |
| Lock contention | one row lock per task key; no external call in transaction | p95/p99 and timeout limits |
| Storage growth | compact receipts and audit rows | approved retention and capacity model |
| Credential compromise | private schema and narrow runtime role | issuer, secret store, rotation, revocation |

The migration itself is transactional. Normal calls touch one claim row, one
receipt and one or two audit/index paths. Exact throughput, WAL, backup and cost
impact cannot be asserted without the FanMind baseline and an isolated load run.

## FanMind migration, backup and restore baseline

The read-only repository baseline is now identified as `FanMind/FanMind`.
Repository instructions identify `docs/database/fanmind_current_schema.md` and
`supabase/migrations/` as database truth, with individually approved contract
steps under `supabase/controlled/`. The indexed default-branch evidence used in
this review is commit `b5a95069b4036d0c250bc4641bc1317f097cc7f3`; it also maps Production to
project `drqkpdvtbbrrdwmtrodz`. RC6 is not present in that repository and has no
FanMind commit, PR or workflow run.

FanMind issue #944 records a real isolated PostgreSQL 17.11 database restore and
ACL reconciliation as technically complete, followed by permanent helper fix
merge `e3009134f87dc4b197c518cb097ceee867b0c7f8`. The same closeout explicitly
keeps aggregate restore program `FM-RST-001` at `PARTIAL`: Storage, server
configuration, disposable-target cleanup, countercheck and final aggregate
acceptance are not promoted. This is relevant process evidence, not an RC6
restore or production-readiness proof.

Current Production backup/PITR state, RPO/RTO, pooler/connection limits,
headroom, live object/ACL collision baseline and the currently assigned
migration/restore operator remain `UNKNOWN / BLOCKED_FOR_PRODUCTION_GATE`.

Sources:

- `https://github.com/FanMind/FanMind/blob/b5a95069b4036d0c250bc4641bc1317f097cc7f3/docs/database/fanmind_current_schema.md`
- `https://github.com/FanMind/FanMind/issues/944#issuecomment-5453857592`
- `https://github.com/FanMind/FanMind/issues/944#issuecomment-5573957331`

## Deployment and rollback

Deployment sequence, once separately authorized:

1. Capture object, extension, role, grant, RLS, function-signature and performance baseline.
2. Verify a current restorable backup and an isolated restore rehearsal.
3. Apply the migration transaction with the service disabled and no principals.
4. Read back every object owner, ACL, policy, function definition and checksum.
5. Prove the FanMind baseline is unchanged outside the new namespace and roles.
6. Provision one pilot API identity and one principal in a separate approved change.
7. Run security, concurrency, failure and rollback tests before enabling service.

Rollback has three distinct paths:

- SQL error before commit: transaction rollback; no database objects remain.
- Empty, disabled installation: exclusive gate plus table locks, then guarded
  emptiness check and dependency-restricted drop in one transaction.
- Operational data exists: the RC6 rollback stops unconditionally. Use a
  separately reviewed forward fix or restore plan; RC6 has no data-loss override.

Restore is not equivalent to rollback. A restored environment remains closed
until epoch rotation, lease invalidation, ACL/RLS/function checks, audit checks,
FanMind nonregression and explicit reopening are complete.

## Cost and operations

No new Supabase project or paid resource is required by the design. Incremental
cost is shared FanMind compute, connections, storage, WAL, backups, observability
and operational support. The amount is `UNKNOWN` until baseline and load data are
available. Co-location can consume FanMind capacity and expand its operational
blast radius; no zero-cost or zero-impact claim is made.

## Current verification status

- SQL/API/rollback artifacts: `PREPARED`.
- Static structure and secret scans: `RUNNABLE LOCALLY`.
- Native PostgreSQL-17 migration and functional tests: `BLOCKED` because this
  container has no PostgreSQL engine and the package repository is denied by the
  environment proxy (`403`).
- FanMind repository/process baseline: `PARTIALLY VERIFIED`; RC6 is not versioned there.
- Live FanMind object/ACL/nonregression comparison: `BLOCKED`, current catalog unavailable.
- Backup/restore: historical PostgreSQL-17 database/ACL drill verified; current
  Production backup/PITR and aggregate restore acceptance remain `BLOCKED`.
- Independent security, QA and release acceptance of this fixed candidate:
  `REVIEW_PENDING`.

## Separate production approval required

No production approval should be granted yet. A future Owner decision must name
the reviewed artifact hashes, migration operator, maintenance window, verified
backup/restore evidence, acceptable load limits, exact identity/grant change,
pilot agent, rollback trigger, monitoring owner and service activation step.


