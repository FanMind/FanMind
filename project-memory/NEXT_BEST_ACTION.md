# FanMind Next Best Action

Generated from `FINISHLINE_STATE.json`, `NEXT_BEST_ACTIONS.json` and `DEFERRED_OWNER_ACTIONS.md`.

- Sales ready: `false`
- Phase 8 started: `false`
- Selected action: `NBA-SECURITY-READONLY`
- Task: `FM-SEC-001`
- Gate: `meta_security` (`PARTIAL`)
- Selection status: `EXECUTABLE`
- Title: Live Supabase Security read-only reconciliieren

## Instruction

Run the existing read-only Production trigger-hardening verify against the exact deployed commit; classify the current Staging ensure_current_user_workspace SECURITY DEFINER exposure and leaked-password settings; record current evidence and contradictions. Do not Apply SQL, change Auth settings or mutate Production/Staging in this action.

## Why this action

standing-authorized safe work

## Candidate evaluation

- `NBA-RESTORE-DATABASE` priority 10: **DEFERRED_BY_OWNER** — FM-RST-OWNER-005
- `NBA-SECURITY-READONLY` priority 15: **EXECUTABLE** — standing-authorized safe work
- `NBA-MOBILE-READONLY` priority 20: **EXECUTABLE** — standing-authorized safe work
- `NBA-AI-LIFECYCLE-RECONCILE` priority 30: **EXECUTABLE** — standing-authorized safe work
- `NBA-META-TECHNICAL-RECONCILE` priority 40: **EXECUTABLE** — standing-authorized safe work
- `NBA-PHASE3-SOCIAL` priority 60: **WAITING_PREREQUISITE** — restore=PARTIAL, mobile=IMPLEMENTED_NOT_VERIFIED, ai_billing=PARTIAL, meta_security=PARTIAL
- `NBA-PHASE7-SOCIAL` priority 70: **WAITING_PREREQUISITE** — phase3_social=PARTIAL
- `NBA-SALES-HANDOFF` priority 80: **WAITING_PREREQUISITE** — restore=PARTIAL, mobile=IMPLEMENTED_NOT_VERIFIED, ai_billing=PARTIAL, meta_security=PARTIAL, phase3_social=PARTIAL, phase7_social=PARTIAL

## Selection safety rules

- A `DEFERRED_BY_OWNER` action remains open but is skipped for current assistant execution.
- Skipping a deferred action never marks its gate accepted or lowers its priority permanently.
- If an earlier unresolved action is owner-required/deferred, only later `parallel_safe=true` actions may be selected.
- Provider, payment, destructive, legal and protected Production boundaries still require their existing approvals.
- Phase 8 remains outside the current finishline.
