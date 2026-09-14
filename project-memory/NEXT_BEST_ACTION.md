# FanMind Next Best Action

Generated from `FINISHLINE_STATE.json`, `NEXT_BEST_ACTIONS.json` and `DEFERRED_OWNER_ACTIONS.md`.

- Sales ready: `false`
- Phase 8 started: `true`
- Selected action: `NBA-CUSTOMER-ACTIVATION-ENGINEERING`
- Task: `FM-BILL-003`
- Gate: `ai_billing` (`PARTIAL`)
- Selection status: `EXECUTABLE`
- Title: Bestehenden Kundenweg und KI-Budget technisch fertigstellen

## Instruction

Follow HANDOFF_AUDIT_20260914.md: finish the existing account -> server-owned Workspace -> versioned consent -> Stripe billing projection -> entitlement path and connect monthly AI usage budgets to that path. Read existing controlled rollout code and current target facts before preparing any missing source; reuse completed prices, Staging installations and receipts. This is repository/engineering work, separate from NBA-AI-LIFECYCLE-RECONCILE owner/provider acceptance. Prepare a concrete reviewed rollout without executing protected target mutations, inventing tax/contract facts, billing a customer or enabling paid tiers through this action. Preserve the explicit paid-activation pause until genuine prerequisites exist. The 1/1.5/2 million quantities remain examples. No new login, Stripe catalog, billing platform, database Restore or Android build.

## Why this action

standing-authorized safe work

## Candidate evaluation

- `NBA-CUSTOMER-ACTIVATION-ENGINEERING` priority 2: **EXECUTABLE** — standing-authorized safe work
- `NBA-CREATOR-INTELLIGENCE` priority 5: **EXECUTABLE** — standing-authorized safe work
- `NBA-CREATOR-SOCIAL-EXTERNAL` priority 8: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-PHASE7-EXTERNAL` priority 9: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-RESTORE-STORAGE-R4-AUTH` priority 10: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-SECURITY-PROTECTED` priority 15: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-MOBILE-READONLY` priority 20: **WAITING_PREREQUISITE** — sales_handoff=BLOCKED
- `NBA-AI-LIFECYCLE-RECONCILE` priority 30: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-META-TECHNICAL-RECONCILE` priority 40: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-SALES-HANDOFF` priority 80: **WAITING_PREREQUISITE** — restore=PARTIAL, ai_billing=PARTIAL, meta_security=PARTIAL, phase3_social=PARTIAL, phase7_social=PARTIAL

## Selection safety rules

- A `DEFERRED_BY_OWNER` action remains open but is skipped for current assistant execution.
- Skipping a deferred action never marks its gate accepted or lowers its priority permanently.
- If an earlier unresolved action is owner-required/deferred, only later `parallel_safe=true` actions may be selected.
- Provider, payment, destructive, legal and protected Production boundaries still require their existing approvals.
- Phase 8 remains outside the current finishline.
