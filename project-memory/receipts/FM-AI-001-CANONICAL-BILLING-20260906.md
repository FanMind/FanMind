# FM-AI-001 — Canonical Billing review checkpoint — 2026-09-06

- Task: `FM-AI-001` under `LOCK-FINISHLINE-RESUME-20260906`.
- Status: `IMPLEMENTED_NOT_VERIFIED`.
- Risk: R4.
- Base: merged `main` `294264e216ee0c6844caab5c6f51f11f2a76eeeb` from PR #1069.
- PR: #1070, `feat/staging-canonical-downstream-20260906`.
- Scope: repository-only canonical AI planning, persistent private attempt recovery and protected rollback-only Staging Billing acceptance. No Production database write, provider activation, real payment, refund, paid-tier activation or canonical runtime projection.
- Preflight: mandatory Project Memory readers, AGENTS/Source of Truth, current main/PR/CI/review state, Billing/AI ledger contracts, prior FM-FAIL-020/FM-FAIL-021 and current isolated-Staging read-only state were reconciled before continuation.
- Review corrections: matching Standard/no-entitlement and already matching paid AI state remain fail-closed until a durable atomic snapshot cutoff exists; Plus/Ultra prices must be valid, distinct from each other and from the canonical base price; base-subscription rotation remains blocked even with exact mismatch evidence until Workspace base binding and AI reconciliation can move atomically; the rollback fixture now starts from a lifecycle state distinct from its expected active projection so protected/no-op projection cannot pass accidentally.
- Regression correction: the planner fixture now carries the canonical `basePriceId`, restoring the intended cutoff/reconciliation tests after the new price guard.
- Scope reconciliation: stale pre-merge `SESSION_HANDOFF.md`, `STARTED_WORK.md` and generated `PROJECT_STATUS.md` deltas were removed from #1070. They must be updated in the post-merge Project Memory closeout from actual merged/runtime evidence rather than guessed before acceptance.
- Falsification: any no-op AI success receipt without persisted cutoff, AI/base price collision reaching an RPC, subscription rotation reaching the current AI RPC before an atomic Workspace binding, protected rollback fixture passing without a visible Billing projection, or Production/live-provider mutation invalidates this checkpoint.
- Recovery: repository changes remain revertible; the prepared Staging acceptance is transactionally rollback-only and has not been dispatched by this checkpoint.
- Evidence boundary: predecessor review-correction head `525c14165ef90962f9c047f533126cb388216294` had all prior review threads addressed, but this receipt publication creates a new exact PR head and therefore requires a fresh complete R4 CI/security/governance countercheck and final independent review before merge.
- Next step: require the new exact head to pass all applicable checks and a fresh no-finding review, then merge #1070. Only after merge/deployment may the separately protected rollback-only Staging acceptance be considered. No overall Billing acceptance is claimed here.
