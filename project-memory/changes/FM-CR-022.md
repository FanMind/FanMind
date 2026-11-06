# FM-CR-022 — Canonical Billing Staging acceptance closeout

- Date: 2026-09-06
- Closed: 2026-09-07
- Status: ACCEPTED
- Source: owner-resumed `FM-AI-001` finishline work.
- Related task: `FM-AI-001`.
- Risk: R4 evidence/reconciliation closeout; no new state-changing runtime action.
- Goal: reconcile Project Memory after exact isolated-Staging deploy `34058028839` and rollback-only canonical Billing acceptance `34058118450` succeeded on `62e6a11858e85996af03f6740819b0fc6194b4a4`.
- Scope: evidence receipt and canonical Project Memory reader updates only. No SQL Apply, provider call, payment/refund, Production DB mutation, canonical runtime projection activation, paid-tier activation, Mobile provider send or Restore mutation.
- Required reconciliation: remove stale claims that the general Billing ledger is absent or that the exact Staging deploy/canonical rollback acceptance are still pending; preserve `FM-AI-001=PARTIAL`, `ai_billing=PARTIAL`, `sales_ready=false` and every genuinely open external/product/legal/provider gate.
- Evidence: run `34058028839` success; run `34058118450` / job `101553652111` success; rollback markers and zero cutover counters; independent read-only Staging counts after rollback. Historical AI-tier rollback acceptance `34039968946` / job `101504820898` remains valid as evidence for its old exact revision only. Do not repeat that old run/revision as if it were current; because later Staging deploy `34058028839` invalidated its mutable current-state freshness, one fresh exact-deployed-revision rollback acceptance remains separately open and may run only under a new explicit protected Staging authorization.
- Recovery: documentation-only. If the cited Billing evidence is later proven mismatched, revert only the Billing-specific closeout state, Billing receipt/evidence and Billing-reader claims from this change. Do **not** revert unrelated Mobile reconciliation (`FM-MOB-007` / `FM-CR-018`) merely because Billing evidence is invalidated; those Mobile records have their own independent evidence and rollback boundary.
