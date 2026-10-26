# Capacity v2: read-only Staging preparation

This is a separate reviewable source package under the existing FM-AI-001 /
FM-CR-052 continuation. It does not change PR #1331, create another task queue,
authorize Staging, provide an apply mode or claim commercial readiness.

## Pinned inputs and separation

Reviewed lifecycle commit: `e9df302f1fd066e8396a385d875c1ff3f669f152`.
Current reviewed main: `dc269fd80407bfa2a3e1885e19e432b0ebaed68e`.
Lifecycle SHA-256:
`f9d59b2e85aac51cc09782f8a7eab63120beff5668c63aeeff1d949e5d2dea99`.
Target: Staging `vshyhvgcmrlagvfnvomc`; Production
`drqkpdvtbbrrdwmtrodz` is excluded. These project references are not credentials.

`ai-capacity-staging-preparation.json` binds the three controlled SQL inputs,
the new read-only query, source-only emitter, existing shared Staging environment
policy and its dependencies, trusted CA, tests and recovery contract by SHA-256.
The expected catalog fingerprint is independently reproducible from the pinned
foundation/activation SQL on local PostgreSQL17.11, synthetic roles/Workspace and
the already approved revision-2 policy. No target result supplies expected values.

The new emitter supports only `--check` and `--emit-readonly-sql`. It has no
network/database client, password reader, deploy, workflow-dispatch or APPLY mode.
Its output is a prepared query, not an executed preflight or an authorization.
Commit/project/recovery labels in generated SQL identify the request; they do
not independently prove the database endpoint. The protected transport must do so.

## Offline preparation

From the repository root, run:

```sh
node scripts/operations/ai-capacity-staging-preflight-preparation.mjs --check
```

For the NEW tests only, reuse the existing isolated PG17 transport:

```sh
FANMIND_CAPACITY_PG17_REQUIRED=true \
FANMIND_CREATOR_PG17_CONTAINER_ID=<isolated-local-PG17-container-id> \
node --test tests/ai-capacity-staging-preflight.test.mjs
```

The new file is also registered in the existing `test:ai-capacity` and Operations
roots, so a future preparation PR inherits the existing Required PG17 path.
The focused command serializes its files to avoid racing shared local role
creation across the two independently cleaned test databases.
No second test system or optional database-pass path is added.
Do not rerun the old lifecycle suite solely to restate its unchanged evidence.

## Exact future read-only preflight contract

Before dispatch, reviewed PR #1331 and this preparation must be on main. Record
the then-current exact merged main/controller SHA, manifest SHA-256, reviewed SQL
SHA-256, recovery SHA-256, target ref, runtime release identity, request/run ID
and fresh protected-Staging approval. No placeholder or historical permission
can supply that authorization; do not fill a future main SHA in advance.
Any head/main/checksum/target change requires review of the affected evidence.

The source integration now reuses `.github/workflows/staging-database-rollout-state.yml`
and its protected `staging` environment/transport with explicit `scope=capacity`.
It consumes this emitter/query/evaluator without the generic apply/skip derivation.
Its only Capacity result is `READONLY_BASELINE_MATCH` or `BLOCK`. Neither implies
activation. Source review/merge and a NEW protected authorization remain mandatory
before dispatch. See `AI_CAPACITY_STAGING_READONLY_INTEGRATION.md`. No target run
or workflow dispatch was performed by this source integration.

The prepared emitter requires the existing shared policy inputs unchanged:

- `GITHUB_REF=refs/heads/main`, `GITHUB_SHA` equal the fresh reviewed commit,
  `FANMIND_STAGING_DATABASE_ROLLOUT_REVIEWED_COMMIT` equal that SHA, and local
  clean checkout `HEAD=origin/main`. Fixed hashes of the reviewed three SQL files
  must match current files and committed HEAD blobs, including squash/shallow
  checkouts; provenance does not require e9 to survive as a main ancestor.
  The workflow AND Capacity runner fetch/check current main before credentials
  or queries; a stale local tracking ref alone is not authoritative.
- Staging runtime/app/API identity, exact target/Production refs above and the
  target's HTTPS Supabase URL. No Production app origin or project substitution.
- Existing protected `FANMIND_STAGING_DB_HOST` session pooler on port5432,
  `PGUSER=postgres.vshyhvgcmrlagvfnvomc`, configured Staging database,
  `PGSSLMODE=verify-full` and the pinned Supabase root CA. The exact pooler host
  comes from the protected configuration, not an invented hostname in this file.
  Reject URL/libpq redirects, hostaddr, services and TLS overrides. Do not expose
  password/passfile contents. The existing wrapper now snapshots a private,
  identity-bound passfile, execute `psql -X -v ON_ERROR_STOP=1` without shell
  interpolation using a bounded allowlisted environment, and remove it finally.
- `FANMIND_ENABLE_NON_PRODUCTION_WRITES=false`, empty write acknowledgement,
  existing rollout read-only confirmation, plus
  `FANMIND_CAPACITY_PREFLIGHT_CONFIRM=prepare-readonly-capacity-preflight`.
  Emission alone does not enforce a protected GitHub environment approval.

The query executes ONE repeatable-read READ ONLY transaction, with
`row_security=off` so filtered counts error instead of resembling empty tables;
10s statement timeout,2s lock timeout,15s idle-in-transaction timeout, pinned
search_path and final ROLLBACK. It installs no temporary helper, changes no
target object, calls no Capacity/admin RPC and reads no Workspace/customer rows.
Only catalog structure, allowlisted singleton policy and existence/count
aggregates are examined. The transport imposes a45s whole-process hard timeout,
64KiB stdout/stderr buffer bound and discards raw failures, including
timeout/parse/missing-object errors. Connection timeout remains10s.

Required observations, ALL conjunctive:

1. PostgreSQL major17, read-only transaction and disabled RLS filtering.
2. Existing Workspace parent is a regular RLS-enabled table with a non-null UUID
   `id` and valid single-column primary key. Browser roles have no public-schema
   CREATE, superuser, BYPASSRLS or membership of service_role.
3. Exactly the five source-defined Capacity foundation tables. Their complete
   column order/types/nullability/defaults/generated identity, constraints and
   validation, indexes/validity, owner, RLS/force-RLS, policies, triggers, table
   and column ACLs and effective anon/authenticated/service_role privileges must
   reproduce the pinned source fingerprint. Supabase/default-privilege or
   provider differences BLOCK; never regenerate expectations from the target.
4. Exactly the four source-defined existing functions (immutable ledger trigger,
   admin getter/updater, activation guard), exact bodies/config/owners/ACL and
   effective role privileges. Do not invoke a mutation to prove a guard here.
5. Every lifecycle RPC name absent across ALL signatures, including legacy
   Reserve overloads, balance snapshot and purchase-reversal function. New
   entitlement projection, seven reservation columns and included-period unique
   index all absent. Existing/full/partial installation BLOCKS this first-install
   baseline; no automatic overwrite, migration repair, apply or skip.
6. Zero grants, reservations, allocations and ledger events. The singleton
   policy has exactly one row: singleton1, revision2, budgets
   1500000000/3000000000/5000000000 EUR microcents (EUR15/30/50).
7. Global Capacity, package99/199/312 sales, top-up sales, Fast/Balanced/Premium
   and runtime/package-sales/top-up activation readiness ALL false; emergency
   spend freeze true. No policy seed or revision update is allowed.
8. Existing Supabase migration-history relation readable with no generic
   Capacity marker by version/name. This is controlled SQL, not a generic
   timestamp migration. Missing relation/columns/privilege or markers BLOCK.

The read-only diagnostic extension does not relax any item above. It additionally
computes exact canonical fingerprint equality after an in-memory normalization of
only the three reviewed budget defaults. It reports separate safety booleans for
table structure, function inventory/definer boundary, table RLS/ACL and remaining trigger/ownership/browser-role
boundaries. Capacity migration history is exposed only through bounded counts for
known/unknown and name/version/statement-presence classes. No marker identity,
version, statement, database definition or observed hash is emitted.

Interpretation is strict: a true normalized-fingerprint field with the original
digest and all three default fields mismatching supports baseline reconciliation
as the complete schema explanation. A false normalized field means a separate
schema cause remains and no default-only correction may be proposed. The three
defaults themselves may later be restored only by a separately authorized,
reviewed transactional schema change; this package contains no executable repair.

The query's schema digest covers security and structure, not customer data.
Runtime/deployment wiring and flags are a separate read-only release evidence
class: exact current Staging release, source route import audit, existing gates
off and no productive Capacity writer/provider/Stripe path. This SQL cannot
attest process configuration or canonical commercial entitlement. Do not invent
new runtime environment flags or mark those external prerequisites accepted.

## Recovery and next step

The exact rollback binding is `AI_CAPACITY_STAGING_RECOVERY.md` and its manifest
SHA-256. Before COMMIT an eventual reviewed apply must be one transaction with
in-transaction pre/postflight; errors roll back the entire body. The isolated new
test proves unchanged catalog/policy/monetary state after such ROLLBACK. After
COMMIT preserve history and use read-only reconciliation plus reviewed forward
repair; no automatic down/drop or generic migration push is available.

Next allowed source step: review/merge the dependent integration PR after #1331.
The next protected target step is then
a NEW authorized read-only Capacity preflight bound to its actual merged main,
controller/query/recovery checksums and exact target. APPLY requires another
separate current authorization and controller/postflight/backup/privacy review.

D3 top-up/refund, productive entitlement writer/Stripe mapping, privacy/deletion
rollout, productive routes, provider calls and activation remain separate work.
Nothing here changes package pricing, Finishline, customers or target state.
