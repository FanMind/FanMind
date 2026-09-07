# FanMind Next Best Action

Generated from `FINISHLINE_STATE.json`, `NEXT_BEST_ACTIONS.json` and `DEFERRED_OWNER_ACTIONS.md`.

- Sales ready: `false`
- Phase 8 started: `true`
- Selected action: `NBA-RESTORE-STORAGE-R4-AUTH`
- Task: `FM-RST-001`
- Gate: `restore` (`PARTIAL`)
- Selection status: `OWNER_ACTION_REQUIRED`
- Title: Isolierten Storage-Restore exakt freigeben

## Instruction

The repository-only Storage preparation is implemented and locally counterchecked: it creates and revalidates a private exact archive/receipt without provider access. After exact-head merge, require a new exact R4 authorization bound to the accepted Full Backup, exact main commit, distinct isolated non-Production Supabase project/bucket, current environment boundary, dedicated target-empty/prewrite and postwrite manifest/path/size/hash controller, rollback/cleanup plan and explicit Production/Supabase-Staging denial. Do not decrypt the real artifact, connect to Storage, upload, dispatch or claim STORAGE_RESTORED before that authorization.

## Why this action

owner/platform action required

## Candidate evaluation

- `NBA-RESTORE-STORAGE-R4-AUTH` priority 10: **OWNER_ACTION_REQUIRED** — owner/platform action required
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
