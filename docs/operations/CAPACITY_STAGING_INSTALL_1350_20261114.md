# Support1350: controlled Capacity preparation

Owner authorized source implementation and isolated tests, plus a FUTURE two-Creator synthetic acceptance. No target writes are authorized yet. Support PR1500 remains DRAFT and unchanged until its actual runtime prerequisites are accepted.

This prerequisite change is a separate minimal review PR: its controller must reach Main before it can install the dormant database package, while merging1500 itself would prematurely replace the live authenticated Support path. This is not a second Support or Billing implementation. Main e2b1dff18016d61065bf3cbd47e4c6e432d4a11c includes parallel Instagram1501. No Production, Stripe, secrets, real balances or deployments changed.

## Package

- Reuse unchanged foundation495c55c8…, activation1fab72b1… and lifecycle f9d59b2e…; install the existing five monetary RPCs and balance reader, not replacements.
- The separate new reconciliation profile requires the complete independently source-pinned structural, normalized effective function/ACL, remaining security and policy partitions. Only the diagnosed three missing budget defaults and precisely recognized provider default grants may be reconciled. The old read-only verifier, its expected values and manifests remain untouched.
- Require exactly two unknown name-only Capacity history markers with stored statements, and an additional exact owner-reviewed SHA256 over their complete version/name/statements tuples. Keep history unchanged. Observed Staging digest on14November19:23UTC: ae98e86a9fcdd624ef637402e656878777bfcee7d657ce637f6c5e7bcdad840d. Any changed marker requires renewed review, never automatic learning/retry.
- Apply in ONE transaction: acquire shared resource lock/table locks; recheck cold baseline/history/absence; restore only pinned defaults and least-privilege service grants; install exact lifecycle+writer; compare full independent source-generated PG17 reference including all functions, owners, bodies, defaults, relation/column ACL, RLS, constraints/indexes and cross-table triggers; preserve history digest; COMMIT only after success. Postflight mutation tests prove rollback of the entire pre-state.
- New private Price mapping starts empty/inactive. Its schema/table/helpers have RLS and no public/browser/service direct privileges. No Prices, entitlements, grants or flags are seeded.
- Canonical writer validates original normalized provider snapshot bytes against their existing completed canonical Billing receipt, current stream revision and Workspace/customer/subscription/period state. Only the protected Price allowlist determines package. Period identity uses exact UTC epoch seconds (independent of session TimeZone); CAS and immutable replay protect projection revision; existing grant_credit remains the sole credit writer. No grant is made by projection sync.
- Billing status/subscription/period or stream changes/deletion invalidate active Capacity. Protected mapping changes invalidate it too. Unknown/old evidence, unapproved Prices, direct Billing-table privileges or wrong source/tenant fail closed. The existing service transport exposes an explicit callable adapter; no webhook/route is activated implicitly. Canonical operator wiring and actual allowlist admission still require target acceptance; legacy/Daily contracts are never inferred to be Capacity99.

## Protected workflow

.github/workflows/ai-capacity-staging-install.yml reuses protected staging, the existing shared fanmind-staging-deploy concurrency group, trusted repository CA and private password-file snapshot mechanism. It adds the previously missing controller, not a new database/project. Source/target/Owner/Live and full package hash are required. Only Owner actor270165082, workflow_dispatch on exact protected current Main, completed required Main+merged source PR checks and the exact controller run are admitted for writes. The original completeChecks policy is reused unchanged.

The reviewed source PR must be the exact Main merge being dispatched; if Main advances, re-review/bind the new source rather than bypass this check. Staging Live can be its explicitly approved older release: schema installation never deploys1500. No Production path exists. Child psql receives only an allowlisted environment, session pooler5432, project-qualified user, verify-full TLS, connection/lock/statement/process limits; no inherited libpq redirection or raw errors are forwarded.

Actions are separate:
1. verify: read-only exact installed catalogue or independently pinned cold reconciliation profile; unknown/partial drift BLOCKs. RECONCILIATION_REQUIRED_RUNTIME_OFF is not permission to repair.
2. apply: atomically install cold reviewed package, keeping Runtime/Freeze/Sales/Mode flags unchanged. No generic db push, skip-on-partial or automatic retry. An already exact installation is observed without reapplying.
3. acceptance: requires installed exact catalogue and a NEW action-specific protected approval. It runs synthetic accounting inside an unconditional ROLLBACK and then verifies unchanged schema, policy and all monetary/projection counts.

Writes require the private600-mode owner-owned file supplied by protected FANMIND_STAGING_CAPACITY_BACKUP_RECEIPT, bound to its owner-reviewed SHA256. It contains exactly version, project, database_sha256, roles_sha256, verified_at, restore_run_id, restore_verified_at. Backup proof <=24h, restore proof <=30d; corresponding actual successful FanMind Isolated Database Restore Drill GitHub run is also checked. The source code creates no backup evidence or new secret. These external prerequisites remain to be provided/verified; the prior Web snapshot is not a DB backup.

Failure before COMMIT rolls back. Unknown commit outcome means fresh read-only classification, never blind reapply. After COMMIT preserve additive schema, history, ledger and holds; forward repair only, no DROP/shared DB restore. No schema installation by Web deploy.

## Separately approved synthetic acceptance

Use ONLY two explicitly approved precreated test Workspaces. Each must have its own Auth owner with reserved email capacity1350-a@test.fanmind.invalid / capacity1350-b@test.fanmind.invalid, server-owned Auth app_metadata capacity1350_synthetic=true AND server-owned Workspace test_access_flags capacity1350_synthetic=true, with no Stripe customer/subscription. No Auth/Workspace is created or relabelled by this controller. Their later protected provisioning still needs its exact target/ID approval. No real Creator may be substituted.

The transaction first requires zero existing Capacity grants/reservations/allocations/ledger/projections and the cold revision2 policy. Private writer binds two synthetic Capacity99 projections to a run-specific one-day TEST period, never a real subscription period. A receives exactly1,500,000,000EUR-microcents (15EUR) once through existing grant_credit; B receives zero. Temporary Balanced policy is rolled back with every fixture. No sale or actual payment/provider call occurs.

Checks use the existing price/accounting functions and real RPCs: B denial, A reserve, exact actual-usage settlement (120 input/20 cached/40 output/5 reasoning), unchanged duplicate, definitive release, uncertain indeterminate hold, revocation denial and no ledger entry outside A. The unknown hold is retained while the transaction exists; ROLLBACK removes the entire nonbillable synthetic experiment, not a real provider obligation. Persist only redacted PASS/rollback proof; do not emit private IDs, SQL, passwords, receipt contents or raw errors. Existing1500 provider/consent/account-switch tests remain their own evidence, not a claimed target browser test.

A successful rollback-only test is real Staging SQL acceptance of synthetic accounting, not commercial paid activation or a real OpenAI response. Production and provider invocation remain excluded.

## Quality and FX

Prepared existing mode: balanced. ECB daily XML retrieved14November2026: USD1.1052 per EUR, reference13November; exact integer inversion yields904813608nano-EUR/USD. Versioned snapshot in support-capacity-configuration-20261114.json is valid until16November14:00UTC, not configured on any host. Builder rejects stale/future/duplicate rates and unknown modes. Refresh expired evidence before use; a test rate is not a Live FX basis. No new model/key or contract acceptance. The ECB source is https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml.

## Validation

Local isolated PostgreSQL17.11 executes the shared real SQL test suite, including a deliberate postflight ACL mutation and complete pre-state rollback, unknown history, partial schema, canonical evidence/CAS/replay and Billing/mapping invalidation, browser/service boundary and two-Creator acceptance rollback. The same cases are imported by the existing required Capacity PG17 CI root; no new optional native-pass path. Local standalone backend was necessary because this workspace disallows sockets; function-body bytes are preserved, and the reference comes exclusively from controlled source plus explicit reconciliation, never Supabase output. Hosted tests use the existing isolated Docker PG17 service and source SQL unchanged.

Original1500 checks are retained. New prerequisite source requires its own exact-head required checks. TypeScript/Lint and focused source tests are local evidence; no target installation/credit acceptance claimed.

## Release gates and approval sequence

1. Review prerequisite PR/exact head and required CI. Owner separately authorizes its regular source merge; this does not replace authenticated Support or deploy anything.
2. Bind resulting exact Main, actual Staging Live, package-manifest SHA256, unchanged marker digest, actual private backup/restore receipt hash/run and common resource lease. Separately authorize ONE apply of the above workflow. Recheck current inputs, no invented future SHA.
3. Separately bind/precreate ONLY approved synthetic A/B identities, reserved server-owned markers and reviewed fresh Balanced/FX basis; authorize ONE acceptance action. The existing broad permission for future15EUR/zero fixtures is retained, not re-requested; concrete protected writes still need their explicitly required release authorization.
4. After acceptance, actual canonical Price/contract/entitlement flow for intended authenticated Creators must be admitted; a single test Workspace is insufficient for a global web rollout. Review1500 against then-current Main, keep its Draft until runtime prerequisites and legal/config gates are really satisfied, then explicitly approve merge+Staging rollout. No Owner fallback.

PDF live download, retention decision, OpenAI contract/operator proof and all Production schema/consent/Web steps remain separate. No timed Support shutdown. Mobile live VERSCHOBEN – APP-ABNAHME; automated mobile/security gates remain.
