# FanMind Next Best Action

Generated from `FINISHLINE_STATE.json`, `NEXT_BEST_ACTIONS.json` and `DEFERRED_OWNER_ACTIONS.md`.

- Sales ready: `false`
- Phase 8 started: `true`
- Selected action: `NBA-CHATADMIN-MANUAL-FLOW`
- Task: `FM-CHATADMIN-002`
- Gate: `chatadmin_manual_flow` (`IN_PROGRESS`)
- Selection status: `OWNER_ACTION_REQUIRED`
- Title: ChatAdmin manuellen Staging-Anwendungsflow abnehmen

## Instruction

Owner-authorized continuation under FM-AUTH-CHATADMIN-MANUAL-FLOW-20260926 and first priority under FM-DEC-024. Complete bounded Character/late-response source isolation correction and normal review/CI/merge, then bind actual Staging runtime to exact reviewed main before any temporary synthetic capability fixture. Exercise Character -> synthetic pasted Fan message -> exactly three revision-bound suggestions -> select/copy/manual handoff, negative authority/tenant/Character boundaries and exact fixture cleanup with independent countercheck. No real data, Social send, auto-send, Production activation, Billing/Stripe/Tax/Restore/Mobile mutation; prior APPLY and DB ACCEPT remain consumed.

## Why this action

owner/platform action required

## Builder manager

- Default worker limit: `3`
- Effective worker limit: `3`
- Hard maximum worker limit: `5`
- SAFE READY SET: `NONE`
- Worker slots reserved by active/ready work: `1`
- Active task continuations reserving slots: `NBA-CHATADMIN-MANUAL-FLOW`
- Serialized due to conflict/limit: `NONE`
- Blocked by action dependencies: `NONE`
- Parallel execution is fail-closed: a second concurrent action requires `parallel_safe=true` plus complete non-overlapping scope metadata; missing/unknown scope serializes.
- The manager reuses the existing action catalog and task/gate state; it does not create a second TODO/orchestration system.

## Candidate evaluation

- `NBA-CHATADMIN-STAGING-VERIFY` priority 0: **DONE** — gate chatadmin_staging_verify is VERIFIED
- `NBA-CHATADMIN-MANUAL-FLOW` priority 1: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-SOCIAL-INBOUND-CURRENT-ACCOUNT` priority 2: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-GOV-GODMODE-001` priority 3: **DONE** — gate governance_god_mode is ACCEPTED
- `NBA-CHATADMIN-STAGING-APPLY` priority 4: **DONE** — gate chatadmin_staging_apply is ACCEPTED
- `NBA-CHATADMIN-STAGING-ACCEPT` priority 5: **DONE** — gate chatadmin_staging_accept is ACCEPTED
- `NBA-ADMIN-CRM-SYNTHETIC-LIFECYCLE` priority 7: **OWNER_ACTION_REQUIRED** — owner/platform action required
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
- The Builder Manager may use at most 3 workers by default; later configuration may never exceed 5.
- Same task/file/directory/module/contract/database/API/Project-Memory/CI/runtime/provider/environment scope is serialized.
- Action dependencies must be verified before dependents enter the safe ready set; an independent task may continue if another worker fails.
- Provider, payment, destructive, legal and protected Production boundaries still require their existing approvals.
- Phase 8 remains outside the current finishline.
