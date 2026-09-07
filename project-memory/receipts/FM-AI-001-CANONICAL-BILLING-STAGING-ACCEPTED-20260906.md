# FM-AI-001 — Canonical Billing Staging rollback acceptance — 2026-09-06

- Task: `FM-AI-001` under active `LOCK-FINISHLINE-RESUME-20260906`.
- Risk: R4.
- Bounded status: `ACCEPTED` for the isolated-Staging canonical Billing rollback-only sub-gate only. Overall `FM-AI-001` and `ai_billing` remain `PARTIAL`.
- Repair merge: PR #1072 merged as `62e6a11858e85996af03f6740819b0fc6194b4a4` after the first acceptance attempt failed closed on an obsolete rollout-state guard.
- Exact isolated-Staging deploy: `Deploy FanMind Staging` run `34058028839` completed `success` on exact `main` `62e6a11858e85996af03f6740819b0fc6194b4a4` with the protected manual deployment contract.
- Exact rollback acceptance: `FanMind Canonical Billing Staging Acceptance` run `34058118450`, job `101553652111`, completed `success` on the same exact commit and isolated Staging target.
- Shared read-only rollout state proved `STAGING_DATABASE_ROLLOUT_STRIPE_BILLING_LEDGER=verify` and `STAGING_DATABASE_ROLLOUT_STATE=PASS` before the rollback fixture.
- General Billing ledger postflight returned `PASS`, `CUTOVER_PENDING=0`, `CUTOVER_UNINVENTORIED=0` and `POSTFLIGHT_TRANSACTION=ROLLED_BACK`.
- Canonical fixture returned `STAGING_CANONICAL_BILLING_ACCEPTANCE=PASS`, `STAGING_CANONICAL_BILLING_TRANSACTION=ROLLED_BACK` and `STAGING_CANONICAL_BILLING_CLEANUP=PASS`.
- Independent read-only Supabase Staging countercheck after the run observed the durable prior capture-only event count unchanged at `1`, with `0` Billing reconciliations, `0` Billing streams, `0` AI-tier entitlements/events/reconciliations and `0` Mobile Push registrations. This is consistent with complete rollback and no accidental runtime/provider activation.
- Negative/fail-closed evidence is retained by failed run `34057425729`: it stopped before the rollback fixture when the stale guard expected the pre-install state. That run was not rerun after the workflow changed.
- Safety boundary: no Production database write, no live Stripe/provider call, no real payment or refund, no canonical runtime projection activation, no Plus/Ultra activation, no Mobile provider send and no Restore mutation occurred in this acceptance.
- Remaining AI/Billing work is separate: external/product model/fallback/quota/overage/proration/refund/cost decisions, private quality/cost proof, provider-side current lifecycle/reconciliation evidence where required, Legal/Tax and any explicit Production activation. Do not promote `sales_ready` or the overall `ai_billing` finishline gate from this bounded result alone.
