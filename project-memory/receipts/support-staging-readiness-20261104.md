# Support Staging readiness —2026-11-04

Task #1350, product PR #1416 merged at
f8ed24bd12c3445732abcd46b9d3f42bfad55334; main verified unchanged.
New source preparation only: Draft #1417, feat/support-staging-1350.

## Fresh observations (read-only)

- Supabase FanMind Staging project vshyhvgcmrlagvfnvomc, ACTIVE_HEALTHY, PG17.6.
- Six base Support tables absent; no Support-centre/chat functions installed.
  The original ten-function sample was incomplete: base manifest contains16.
- Existing support_repair_audit is present and excluded from this rollout.
- No pg_cron extension. No supported daily Support-run receipts exist because
  Support schema is absent. No Owner assignment can exist in the missing table.
- `https://staging.fanmind.ch/api/version` at2026-11-04T10:11:34.356Z:
  releaseCommit=f353f3e1c853c6104797d4db9ab578b8695b14bd,
  runtimeEnvironment=staging. It does not attest deployment of f8ed24bd or #1417.
- Existing main Actions records show no later Support schema/deploy proof; do not
  confuse successful source CI or skipped/cancelled Creator actions with deployment.
- Existing authorization records cover other exact scopes, not new Support DDL,
  platform-Owner binding or scheduler activation. User explicitly excludes new
  DB writes/infrastructure from automatic authorization. No target write performed.

## New source work

Atomic install + independent PG17 reference, exact/no-op/drift handling and empty
rollback; operator-only audited/volume-guarded retention with bounded retries;
Owner-only retention health; exact-scope own-data export and snapshot-bound own
erasure; lifecycle/error handling; operating/privacy procedures. Original base
SQL and separately maintained Admin Chat remain unchanged. Reuse the existing
protected Website retention workflow with component-specific gate and shared lease.
All new schedules remain disabled unless separately configured and authorized.

Focused new controls6/6, selected lint, TypeScript, workflow boundary compatibility
10/10 and whitespace checks pass locally. Independent privacy source/doc PASS;
source QA and security review findings corrected. Final new native PG17 reference,
exact-head CI/browser results and final independent delta review are pending at
this checkpoint. This receipt deliberately does not claim runtime QA PASS.

## Remaining acceptance gates

1. Reproduce/pin independent PG17 reference and finish exact-head source CI/reviews.
2. Exact reviewed-source merge under repository rules and actual authorization.
3. Newly approved Staging-only schema install, through the existing protected job.
4. Separately approved exact existing confirmed/unbanned Admin auth UUID as Owner.
5. Authorized Staging app deployment/flags and only marked synthetic fixtures.
6. Authorized first physical retention, daily schedule/pinned source and monitored
   successful receipt; confirmed operational failure observer and privacy operator.
7. Actual own-data/isolation/consent/retention integration and independent runtime
   QA/security/privacy PASS. No real-customer/Production acceptance inferred.

See docs/operations/SUPPORT_STAGING_ROLLOUT.md for risks, exact scope and rollback,
and SUPPORT_PRIVACY_PROCESS.md for full-request handoff and remaining operations.

Delta validation checkpoint: Browser78/78 PASS on34cb2093; independent source
security/rollout and privacy/docs PASS. The native bootstrap rejected installation
as intended at exact postflight: JSON Number rounded the sequence bigint maximum.
Catalogue sequence integers are now text, preserving9223372036854775807 exactly,
with a native regression assertion. This was isolated synthetic CI only; no target
change occurred. A new reference must be generated, never hand-corrected from the
failed rounded candidate. CI also requires updating its exact hosted-checkout count
from83 to84 for the separately gated new Support job; local supply-chain12/12 PASS.
