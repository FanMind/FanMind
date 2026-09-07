# FanMind Next Best Action

Generated from `FINISHLINE_STATE.json`, `NEXT_BEST_ACTIONS.json` and `DEFERRED_OWNER_ACTIONS.md`.

- Sales ready: `false`
- Phase 8 started: `true`
- Selected action: `NBA-RESTORE-POSTCHECK`
- Task: `FM-RST-001`
- Gate: `restore` (`PARTIAL`)
- Selection status: `EXECUTABLE`
- Title: Vorhandene Restore-Belege gegen DB_POSTCHECKED abgleichen

## Instruction

Reconcile the existing receipt-bound evidence for every DB_RESTORED -> DB_POSTCHECKED predicate: ownership, ACL/default ACL, roles, database container, extensions, five core tables, RLS, policies, application grants and restricted SECURITY DEFINER execution. If any predicate is not explicit, obtain read-only proof only. Do not dispatch or repeat the database Restore, reset the target, reuse a consumed controller/JIT, or access Production/Supabase Staging.

## Why this action

standing-authorized safe work

## Candidate evaluation

- `NBA-RESTORE-POSTCHECK` priority 10: **EXECUTABLE** — standing-authorized safe work
- `NBA-SECURITY-PROTECTED` priority 15: **DEFERRED_BY_OWNER** — FM-SEC-OWNER-001
- `NBA-MOBILE-READONLY` priority 20: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-AI-LIFECYCLE-RECONCILE` priority 30: **DEFERRED_BY_OWNER** — FM-AI-OWNER-001
- `NBA-META-TECHNICAL-RECONCILE` priority 40: **DEFERRED_BY_OWNER** — FM-META-OWNER-001
- `NBA-PHASE3-SOCIAL` priority 60: **WAITING_PREREQUISITE** — restore=PARTIAL, mobile=IMPLEMENTED_NOT_VERIFIED, ai_billing=PARTIAL, meta_security=PARTIAL
- `NBA-PHASE7-SOCIAL` priority 70: **WAITING_PREREQUISITE** — phase3_social=PARTIAL
- `NBA-SALES-HANDOFF` priority 80: **WAITING_PREREQUISITE** — restore=PARTIAL, mobile=IMPLEMENTED_NOT_VERIFIED, ai_billing=PARTIAL, meta_security=PARTIAL, phase3_social=PARTIAL, phase7_social=PARTIAL

## Selection safety rules

- A `DEFERRED_BY_OWNER` action remains open but is skipped for current assistant execution.
- Skipping a deferred action never marks its gate accepted or lowers its priority permanently.
- If an earlier unresolved action is owner-required/deferred, only later `parallel_safe=true` actions may be selected.
- Provider, payment, destructive, legal and protected Production boundaries still require their existing approvals.
- Phase 8 remains outside the current finishline.
