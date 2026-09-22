# Countercheck Policy

The second-pass verification must be independent from the implementation pass.

## Independent evidence
Use at least one evidence source different from the one used to claim success. Task text or PR description alone is never sufficient.

Examples: implementation claim -> final diff + CI; workflow code -> current workflow run; restore step -> receipt-bound target verification; mobile build -> exact-build device evidence; billing/AI/security change -> current target-bound verification plus fail-closed/negative path.

## Freshness
Final evidence must match the current reviewed commit, PR/branch and target environment/build/runtime where applicable. Older workflow runs, previous deployments, older backups, previous mobile builds or stale screenshots are `STALE` and cannot close a task.

## Negative/regression check
Verify the relevant failure/fail-closed path and previously failing case, not only the happy path.

## Triangulation
High-impact restore, production, billing, AI entitlement, security, mobile signing/device and social-connector work requires at least two independent evidence classes before `ACCEPTED` or `PRODUCTION_CONFIRMED`.

## Separation
Execution receipts must record implementation evidence and countercheck evidence separately.

## Contradictions
Any disagreement between project memory, Git/PR, CI, runtime, protected environment or device evidence becomes `RECONCILIATION_REQUIRED`; do not guess or average. Resolve from current verified evidence.

## Completion gate
A clean completion claim requires current-commit evidence, independent countercheck evidence, no unresolved reconciliation finding, no stale active lock, no untracked started work/open loop/dependency and the required negative/regression check. Red governance/security/supply-chain checks remain blocking.

## God Mode adversarial countercheck
For substantive R2+ scope, independently identify affected `FM-CONTRACT-*` and `FM-IGATE-*` records and actively search for the relevant break paths: tenant leak, authority escalation, browser service-role use, race/TOCTOU, stale revision, partial schema/orphan data, wrong target, idempotency/retry failure, rollback failure and cross-module contract drift.

For R3/R4, use at least one bounded negative/mutation proof that would turn red if the protection were intentionally broken when technically safe. A test is weak if it stays green after the relevant guard is deliberately violated.

A passing module test never substitutes for affected integration-gate evidence. A passing God Mode workflow validates governance fail-closed behavior only; it does not imply `ALLOW`, Staging acceptance or Production acceptance.
