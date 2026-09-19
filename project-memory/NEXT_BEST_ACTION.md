# FanMind Next Best Action

Generated from `FINISHLINE_STATE.json`, `NEXT_BEST_ACTIONS.json` and `DEFERRED_OWNER_ACTIONS.md`.

- Sales ready: `false`
- Phase 8 started: `true`
- Selected action: `NBA-ADMIN-CRM-LOGIN-HOTFIX`
- Task: `FM-REG-003`
- Gate: `registration_admin_crm` (`IN_PROGRESS`)
- Selection status: `EXECUTABLE`
- Title: Admin-CRM Login vom bezahlten Billing trennen

## Instruction

FM-CR-043 is the current executable priority. Preserve the already granted 0-EUR Admin-CRM Workspace and fix only the routing/billing isolation: active Admin-CRM must reach Web CRM without any paid Billing path; blocked/expired must reach /workspace/access-paused; all direct Billing/checkout surfaces including POST /api/billing/checkout must reject or redirect Admin-CRM before Stripe. Do not repeat registration, the real Admin grant, the Production migration, payment, Stripe/Tax, provider or Mobile work. After reviewed green merge and normal Production deploy/version proof, the owner retests the same already-granted account read-only through Dashboard/Fans/Inbox/Follow-ups. No further real Admin-CRM grants are permitted until the runbook's missing synthetic lifecycle acceptance is completed and recorded.

## Why this action

standing-authorized safe work

## Candidate evaluation

- `NBA-ADMIN-CRM-LOGIN-HOTFIX` priority 1: **EXECUTABLE** — standing-authorized safe work
- `NBA-CREATOR-INTELLIGENCE` priority 5: **EXECUTABLE** — standing-authorized safe work
- `NBA-CREATOR-SOCIAL-EXTERNAL` priority 8: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-PHASE7-EXTERNAL` priority 9: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-RESTORE-STORAGE-R4-AUTH` priority 10: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-SECURITY-PROTECTED` priority 15: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-MOBILE-READONLY` priority 20: **DEFERRED_BY_OWNER** — FM-MOB-OWNER-CREATOR-SOCIAL-20260910
- `NBA-AI-LIFECYCLE-RECONCILE` priority 30: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-META-TECHNICAL-RECONCILE` priority 40: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-SALES-HANDOFF` priority 80: **WAITING_PREREQUISITE** — restore=PARTIAL, mobile=IMPLEMENTED_NOT_VERIFIED, ai_billing=PARTIAL, meta_security=PARTIAL, phase3_social=PARTIAL, phase7_social=PARTIAL

## Selection safety rules

- A `DEFERRED_BY_OWNER` action remains open but is skipped for current assistant execution.
- Skipping a deferred action never marks its gate accepted or lowers its priority permanently.
- If an earlier unresolved action is owner-required/deferred, only later `parallel_safe=true` actions may be selected.
- Provider, payment, destructive, legal and protected Production boundaries still require their existing approvals.
- Phase 8 remains outside the current finishline.
