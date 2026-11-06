# FM-AI-001 — Canonical Billing acceptance guard failure — 2026-09-06

- Task: `FM-AI-001` under active `LOCK-FINISHLINE-RESUME-20260906`.
- Risk: R4.
- Exact main/deployed Staging commit: `5a3f6166ced9e467c14f60cb3b84ed49157d6bc2`.
- Staging deploy evidence: `Deploy FanMind Staging` run `34056906615` completed successfully on exact main before this acceptance attempt.
- Failed acceptance: `FanMind Canonical Billing Staging Acceptance` run `34057425729`, job `101551757301`.
- Fail-closed stage: `Bind shared read-only rollout state`.
- Read-only observation: overall `STAGING_DATABASE_ROLLOUT_STATE=PASS` and `STAGING_DATABASE_ROLLOUT_STRIPE_BILLING_LEDGER=verify`. The general Billing ledger is already installed/current, so `verify` is the correct current action.
- Cause: the new canonical acceptance workflow still asserted the obsolete pre-install state `STAGING_DATABASE_ROLLOUT_STRIPE_BILLING_LEDGER=skip`.
- Safety result: the canonical rollback fixture step was skipped. No canonical Billing acceptance write, Production database write, Stripe/provider request, payment/refund, runtime projection activation or Plus/Ultra activation occurred.
- Correction scope: require the current installed-ledger `verify` state plus overall rollout `PASS`; add regression coverage forbidding the stale `skip` assertion. Do not weaken target/TLS/main/confirmation/write gates.
- Recovery / do not repeat: do not rerun run `34057425729`; it is bound to the superseded workflow content. After the correction passes exact-head CI/review and merges, deploy that new exact main to isolated Staging with `billing_write_freeze=preserve`, independently countercheck runtime/ledger state, then run one new rollback-only canonical Billing acceptance.
