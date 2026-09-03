# FanMind Next Best Action

Generated from `FINISHLINE_STATE.json`, `NEXT_BEST_ACTIONS.json` and `DEFERRED_OWNER_ACTIONS.md`.

- Sales ready: `false`
- Phase 8 started: `true`
- Selected action: `NBA-RESTORE-DATABASE`
- Task: `FM-RST-001`
- Gate: `restore` (`PARTIAL`)
- Selection status: `DEFERRED_BY_OWNER`
- Title: SSH-Zugang reconciliieren und Restore neu autorisieren

## Instruction

Do not rerun controller 45054c41... . First capture the owner Windows public-IP/TCP-22 result and reconcile any exact Exoscale /32 allowlist drift under a separate narrow authorization. Then require FM-RST-OWNER-006: a new exact R4 authorization/controller bound to the then-current reviewed main, existing isolated PostgreSQL-17.11 target, accepted backup/verification/source/reset-receipt tuple, fresh mutable runner-policy/host/target/backup/TLS evidence and fresh sequential one-job JITs. Do not reset the target or write Production/Supabase Staging.

## Why this action

FM-RST-OWNER-005

## Candidate evaluation

- `NBA-RESTORE-DATABASE` priority 10: **DEFERRED_BY_OWNER** — FM-RST-OWNER-005
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
