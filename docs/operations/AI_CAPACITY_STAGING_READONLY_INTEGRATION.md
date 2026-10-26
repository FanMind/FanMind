# Capacity v2 protected read-only Staging integration

FM-AI-001 / FM-CR-052 source continuation, updated 17 October 2026. Reuses preparation
38c15520376c35d3fedf8fd547b322221def755b; no new task queue or apply controller.
PR #1331 and #1332 are merged; reviewed main for this diagnostic increment is
3fcf7c31e8b6d978e35c8920e1c3cddefeff4d2e. Its authorized preflight run39022404980
returned BLOCK without a reason; the actual Staging cause remains unknown.
This repository-only increment adds safe diagnostics, not a speculative repair.
A future diagnostic run requires the increment reviewed/merged and a NEW exact
protected Staging authorization. No previous merge or run authorization applies.

## Existing path, explicit scope

Use ONLY `.github/workflows/staging-database-rollout-state.yml`, its protected
`staging` environment, existing serialization group and private password-file
setup/final cleanup. No new workflow, transport, secrets, provider connection or
alternate authorization route is added. Existing rollout consumers retain their
default rollout scope. An unknown scope blocks; it never falls back to rollout.

For a FUTURE separately authorized Capacity observation, inputs are:

- `scope=capacity`;
- `reviewed_commit=<then-current exact merged main/controller SHA>`;
- `confirmation=verify-staging-database-rollout-state`;
- `capacity_confirmation=prepare-readonly-capacity-preflight`.

These are input definitions, not an instruction or permission to dispatch now.
Record the source PR/head/checks/independent review, actual merged main, requested
Staging target, runtime release context, manifest/query/recovery SHA-256 and new
protected approval/run identity. Do not reuse any historical seed/catalog/apply
authorization or manufacture a future merged commit. Recheck changed evidence.

Both workflow and Capacity runner fetch live main and require the dispatch SHA,
reviewed SHA and clean committed checkout to match it before reading credentials
or issuing a query. Query/transport/workflow/preparation/recovery/policy/CA files
are checksum-bound by `ai-capacity-staging-integration.json` and the existing
preparation manifest. Shared hash-vector and committed-blob verification supports
normal/squash merges and shallow checkouts. No original28 test or query byte is
replaced, and expected catalog/policy values are not learned from Staging.

## Read-only transport and outcomes

The existing runner selects Capacity before generic rollout action derivation.
The exact target is Staging vshyhvgcmrlagvfnvomc, different from Production
drqkpdvtbbrrdwmtrodz. Existing app/API/project/host/user/session-pooler5432/TLS
guards remain in force; the CA path/content is tied to the reviewed repository.
The existing source password-file validation/snapshot additionally requires one
exact host/port/database/user entry, no wildcard/multiple entries, owner/mode0600,
no symlink/racing read and bounded size. Snapshot contents are zeroed in memory
and the snapshot directory is removed on success, mismatch, error or timeout.

The same psql transport uses no password prompt or psqlrc, ON_ERROR_STOP and stdin
SQL without shell interpolation. Capacity children receive only an allowlisted
environment, fixed TLS verification,10s connection timeout, default read-only
session and query limits. Inherited secrets, libpq redirects, PGOPTIONS and
process overrides are not forwarded. Client execution has a45s SIGKILL deadline
and64KiB output bound. The pinned query retains its own repeatable-read/read-only,
row_security=off,10s statement/2s lock/15s idle limits and final ROLLBACK.

The Capacity decision line remains:

```
STAGING_DATABASE_ROLLOUT_CAPACITY=READONLY_BASELINE_MATCH
```

or `STAGING_DATABASE_ROLLOUT_CAPACITY=BLOCK` with nonzero exit. There is no Capacity
PASS/apply/skip/repair result. Malformed/multiple/extra/partial observations,
wrong source/main/target/recovery labels, schema/policy/ACL/RLS/data drift, stale
main, checksum failure, missing credentials/client, timeout and oversized output
block. Raw SQL/diagnostics/IDs/passwords are never printed by this branch. Request
labels bind the response to the request; project-qualified transport/TLS and
protected configuration independently establish endpoint identity.

## Safe BLOCK diagnostics

A BLOCK additionally emits exactly one fixed diagnostic line:

```
STAGING_DATABASE_ROLLOUT_CAPACITY_DIAGNOSTIC=<STAGE>:<REASON>
```

| Stage | Fixed reasons and evidenced checkpoint |
| --- | --- |
| SOURCE_CHECK | SOURCE_REJECTED: a recognized source/hash/committed-blob control rejects |
| ENVIRONMENT_MAIN | ENVIRONMENT_REJECTED, CA_BINDING_REJECTED, MAIN_FETCH_FAILED, MAIN_OR_CHECKOUT_REJECTED: the corresponding existing guard rejects |
| CLIENT_PASSFILE | CLIENT_UNAVAILABLE, PASSFILE_REJECTED: version probe or private snapshot guard rejects |
| CONNECTION_TLS | CONNECTION_FAILED: psql exits2, indicating failed/lost connection; NOT proof of a TLS, credential or network root cause |
| QUERY_EXECUTION | SQL_SCRIPT_FAILED: psql exits3 with ON_ERROR_STOP; CLIENT_DEADLINE: whole-child timeout; OUTPUT_LIMIT: bounded capture exceeds limit |
| RESPONSE_PARSING | RESPONSE_CARDINALITY, INVALID_JSON, RESPONSE_SHAPE: exact existing response checks reject |
| RESPONSE_BINDING | LABEL_MISMATCH: existing main/target/lifecycle/recovery response binding rejects |
| BASELINE_COMPARISON | BASELINE_MISMATCH: existing comparison rejects; no expected value changes |
| UNKNOWN_BLOCK | UNCLASSIFIED: every unrecognized exception, signal/status or child failure |

A stage identifies a verified local failure checkpoint, not the deepest cause.
In particular client deadline/output-limit and UNKNOWN_BLOCK do not prove that
SQL ran or that a connection succeeded. SQL_SCRIPT_FAILED does not distinguish
permissions, RLS, missing objects or other script errors. CONNECTION_FAILED does
not distinguish DNS, TLS, auth or a lost connection. No stderr pattern or dynamic
SQLSTATE supplies classification. Earlier workflow guards can still fail before
the runner; their existing logs remain the evidence for that boundary.

Only BASELINE_MISMATCH may add:

```
STAGING_DATABASE_ROLLOUT_CAPACITY_FIELDS=<fixed field identifiers, comma-separated>
```

Identifiers are hardcoded in CAPACITY_BASELINE_FIELDS in the pinned runner:
expectedObservation keys and expectedPolicy keys prefixed with policy_. The list
is filtered and source-ordered, never taken verbatim from input. It contains no
observed/expected values, row data, hashes, paths or arbitrary field names.
Unknown errors cannot self-declare diagnostics through message, stage, reason,
fields or stack properties. Only private internally created diagnostic records
are rendered. Raw exceptions and child stdout/stderr remain suppressed.

The follow-up diagnostic fields remain source-defined and additive. The original
schema digest and three budget-default booleans are unchanged. A second boolean
rebuilds the same complete catalog profile after replacing only those three
default expressions in memory with the reviewed source expressions. `true`
therefore proves that those defaults completely explain the aggregate digest
difference; `false` proves that at least one additional catalog difference
exists. It never changes a catalog or learns an expected value from Staging.

Separate exact, source-pinned catalog profiles cover normalized columns,
constraints and indexes; complete function definitions, owners, ACLs and effective
execution rights; table RLS/ACL; and remaining trigger/owner/browser-role safeguards. These are diagnostic partitions; the
normalized complete-profile boolean remains the exact canonical equality proof.
Migration evidence is limited to counts for all Capacity-like markers, known or
unknown classification, unknown name-only/version-only/name-and-version classes,
and whether an unknown record has stored statements. Marker identifiers,
versions, statement text, catalog definitions and observed hash values are never
rendered. Every source-baseline count is zero and every safety boolean is true;
any deviation remains `BLOCK` and prints only allowlisted field identifiers.

The provider-default attribution is narrower than a baseline exception. Two
additional booleans project only the repository-pinned Supabase initial-schema
grants: direct `anon`/`authenticated`/`service_role` EXECUTE entries on the
immutable trigger function, direct `service_role` EXECUTE on the activation
guard and `service_role` ALL on the five Capacity tables.
They compare the resulting complete function and RLS/ACL profiles to the same
original source hashes. A match can therefore attribute those two aggregate
profile failures without hiding a different function body, owner, policy, RLS,
column ACL or browser privilege. A separate boolean proves only the bounded
shape "exactly one unknown name-only Capacity marker with stored statements";
it emits no marker identity, version or statement.

BLOCK still exits1; baseline match still emits only the original decision line.
No retry, Skip, Apply or repair is added. Expected policy/monetary state,
recovery, workflow, CA, limits and passfile transport remain unchanged. Query,
runner, tests, documentation and their existing manifest pins are refreshed.

Before any future execution: review exact PR head and Required CI, independent
countercheck, actual merged main, integration-manifest/controller/query/recovery
checksums and exact protected Staging target. Obtain a NEW Owner/environment
approval for a single read-only run on that binding. No dispatch/target query is
part of this source task. Diagnose using the bounded code; retain BLOCK and seek
separate review for any further needed evidence. Never learn the baseline from
the unknown target, expose raw output or automatically repair/retry.

## Scope of proof and recovery

The existing query verifies source-defined foundation/activation schema,
functions/overloads, constraints/indexes/triggers/owners, effective table/column
ACLs and RLS, Workspace UUID/PK/RLS parent, empty monetary state and absent new
lifecycle/projection/columns/index/migration markers. Policy must be singleton1,
revision2, EUR15/30/50, all usage/sales/modes/readiness off, freeze on. An existing
or partial installation blocks this FIRST-INSTALL baseline; no skip or overwrite.
Full allowlist: `AI_CAPACITY_STAGING_PREFLIGHT_PREPARATION.md`.

A baseline match is an observation at that time, not target activation, a
commercial entitlement proof or Apply permission. Runtime release/flags and
backup/privacy readiness remain distinct external evidence. Read-only observation
needs no database down migration; failure closes the session/rolls back and removes
local credentials. `AI_CAPACITY_STAGING_RECOVERY.md` remains pinned unchanged.
No Production read/write, Staging mutation, provider/Stripe call or dispatch is
performed here. D3 top-up/refund and productive entitlement/routes remain separate.
