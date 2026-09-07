# FanMind Next Best Action

Generated from `FINISHLINE_STATE.json`, `NEXT_BEST_ACTIONS.json` and `DEFERRED_OWNER_ACTIONS.md`.

- Sales ready: `false`
- Phase 8 started: `true`
- Selected action: `NBA-RESTORE-POSTCHECK-RECONCILE`
- Task: `FM-RST-001`
- Gate: `restore` (`PARTIAL`)
- Selection status: `EXECUTABLE`
- Title: DB_RESTORED zu DB_POSTCHECKED receiptgebunden reconciliieren

## Instruction

The isolated PostgreSQL 17 database Restore is complete and non-repeatable: workflow 33178878764/job 98874745740 committed pg_restore; one-shot ACL completion 5453727223 applied exactly eight schema-USAGE grants, matched the projected expected/actual authorization fingerprint 0604dac8562a601e2d582f76aee4203825b826b302b9b0b93a92bdd2ca603052, passed core 5|5|5|5 and plaintext cleanup, and PR #1075 permanently fixed the target-only principal projection. Do not collect the old TCP-22 evidence, create a new Restore authorization/JIT, reset the target or repeat the database Restore. Reconcile the exact DB_RESTORED -> DB_POSTCHECKED receipt predicates for owner/ACL/default-ACL/roles/database-container/extensions plus schema/data/accounting/core-table/RLS/policy/authorization evidence. Use existing immutable/private receipts first and acquire only read-only proof for a genuine gap. Promote DB_POSTCHECKED only when every required predicate is explicit; Storage, server config, disposable-target cleanup, countercheck and aggregate acceptance remain later separate states.

## Why this action

standing-authorized safe work

## Candidate evaluation

- `NBA-RESTORE-POSTCHECK-RECONCILE` priority 10: **EXECUTABLE** — standing-authorized safe work
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
