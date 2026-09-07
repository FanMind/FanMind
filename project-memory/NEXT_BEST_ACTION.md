# FanMind Next Best Action

Generated from `FINISHLINE_STATE.json`, `NEXT_BEST_ACTIONS.json` and `DEFERRED_OWNER_ACTIONS.md`.

- Sales ready: `false`
- Phase 8 started: `true`
- Selected action: `NBA-RESTORE-STORAGE-PREP`
- Task: `FM-RST-001`
- Gate: `restore` (`PARTIAL`)
- Selection status: `EXECUTABLE`
- Title: Isolierten Storage-Restore sicher vorbereiten

## Instruction

Implement and countercheck a bounded Storage restore/verification path for the exact receipt-bound Full Backup: distinct isolated target, manifest/path/size/hash equality, traversal/symlink/duplicate rejection, private plaintext handling, fail-closed rollback/cleanup and explicit Production/Supabase-Staging denial. Do not dispatch the workflow, decrypt the real artifact, connect to Storage, or perform any provider/runtime mutation. A later isolated Storage write requires separate exact R4 authorization.

## Why this action

standing-authorized safe work

## Candidate evaluation

- `NBA-RESTORE-STORAGE-PREP` priority 10: **EXECUTABLE** — standing-authorized safe work
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
