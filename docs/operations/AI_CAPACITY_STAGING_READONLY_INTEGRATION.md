# Capacity v2 protected read-only Staging integration

FM-AI-001 / FM-CR-052 source continuation, updated 17 October 2026. Reuses preparation
38c15520376c35d3fedf8fd547b322221def755b; no new task queue or apply controller.
PR #1331 is merged as fe1ef98e6dc70c0a4a27bcce81c8970002f3bade, the current
main at reconciliation. Its reviewed head e9df302f1fd066e8396a385d875c1ff3f669f152
has the identical source tree. PR #1332 incorporates this main through a normal
merge update without rewriting history or changing protected implementation bytes.
PR #1332 still needs its OWN Owner merge authorization after exact-head checks.
Dispatch additionally requires this integration on main and a NEW exact protected
Staging authorization. The #1331 authorization grants neither action.

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

The only Capacity result line is:

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
