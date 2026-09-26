# FanMind Next Best Action

Generated from `FINISHLINE_STATE.json`, `NEXT_BEST_ACTIONS.json` and `DEFERRED_OWNER_ACTIONS.md`.

- Sales ready: `false`
- Phase 8 started: `true`
- Selected action: `NBA-CREATOR-FOUNDATION-TRANSITION-GENERATOR`
- Task: `FM-CREATOR-001`
- Gate: `creator_foundation_transition_generator` (`IN_PROGRESS`)
- Selection status: `EXECUTABLE`
- Title: Begrenzten Creator-Foundation-Übergang fail-closed erzeugen und nativ beweisen

## Instruction

Implement the bounded repository-only transition generator and native PG17 proofs defined by the accepted profile/transition package. It may emit only the pinned creator_workspace_access_allowed helper, the two pinned RPC bodies and the four exact policy USING replacements; it must never replay the whole Foundation or write product data. Bind the accepted auth.uid, Daily parent and Hosted role profiles plus all query/source/reference pins; fail closed on pin/profile drift, mixed or already-current state, unknown overload/policy/role paths, unexpected AdminCRM and any unsupported target-derived value. Prove atomic rollback after each injected step, unchanged stored data, Legacy-to-Current result and required negative/cross-workspace cases. Deliver source, tests and reproducible artifact manifest through independent exact-head review and CI. No target/provider call, workflow dispatch, SQL APPLY, runtime activation or deployment acceptance belongs to this action. A later target-bound observation/reference acceptance/transition remains a separately authorized protected action.

## Why this action

standing-authorized safe work

## Builder manager

- Default worker limit: `3`
- Effective worker limit: `3`
- Hard maximum worker limit: `5`
- SAFE READY SET: `NBA-CREATOR-FOUNDATION-TRANSITION-GENERATOR`
- Worker slots reserved by active/ready work: `1`
- Active task continuations reserving slots: `NONE`
- Serialized due to conflict/limit: `NONE`
- Blocked by action dependencies: `NONE`
- Parallel execution is fail-closed: a second concurrent action requires `parallel_safe=true` plus complete non-overlapping scope metadata; missing/unknown scope serializes.
- The manager reuses the existing action catalog and task/gate state; it does not create a second TODO/orchestration system.

## Candidate evaluation

- `NBA-CHATADMIN-STAGING-VERIFY` priority 0: **DONE** — gate chatadmin_staging_verify is VERIFIED
- `NBA-CHATADMIN-MANUAL-FLOW` priority 1: **DONE** — gate chatadmin_manual_flow is ACCEPTED
- `NBA-CREATOR-FOUNDATION-TRANSITION-GENERATOR` priority 2: **EXECUTABLE** — standing-authorized safe work
- `NBA-GOV-GODMODE-001` priority 3: **DONE** — gate governance_god_mode is ACCEPTED
- `NBA-CHATADMIN-STAGING-APPLY` priority 4: **DONE** — gate chatadmin_staging_apply is ACCEPTED
- `NBA-CHATADMIN-STAGING-ACCEPT` priority 5: **DONE** — gate chatadmin_staging_accept is ACCEPTED
- `NBA-CREATOR-CONFIRMED-CHAT-STAGING-VERIFY` priority 6: **DONE** — gate creator_confirmed_chat_staging_verify is RECONCILED
- `NBA-ADMIN-CRM-SYNTHETIC-LIFECYCLE` priority 7: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-SOCIAL-INBOUND-CURRENT-ACCOUNT` priority 8: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-CREATOR-SOCIAL-EXTERNAL` priority 9: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-RESTORE-STORAGE-R4-AUTH` priority 10: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-PHASE7-EXTERNAL` priority 11: **OWNER_ACTION_REQUIRED** — owner/platform action required
- `NBA-CREATOR-FOUNDATION-RECONCILIATION-PREFLIGHT` priority 12: **DONE** — gate creator_foundation_reconciliation_preflight is ACCEPTED
- `NBA-CREATOR-FOUNDATION-STAGING-CATALOG` priority 13: **DONE** — gate creator_foundation_staging_catalog is RECONCILED
- `NBA-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN` priority 14: **DONE** — gate creator_foundation_profile_transition_design is ACCEPTED
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
