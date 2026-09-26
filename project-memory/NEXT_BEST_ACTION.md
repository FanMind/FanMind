# FanMind Next Best Action

Generated from `FINISHLINE_STATE.json`, `NEXT_BEST_ACTIONS.json` and `DEFERRED_OWNER_ACTIONS.md`.

- Sales ready: `false`
- Phase 8 started: `true`
- Selected action: `NBA-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN`
- Task: `FM-CREATOR-001`
- Gate: `creator_foundation_profile_transition_design` (`IN_PROGRESS`)
- Selection status: `EXECUTABLE`
- Title: Creator-Profile unabhängig abgleichen und begrenzten Quellenübergang entwerfen

## Instruction

Source transition design drafted in `docs/operations/CREATOR_FOUNDATION_FORWARD_TRANSITION_DESIGN.md`; do not re-author or republish it unchanged. Exact next source steps: isolated native PG17 proof of original auth.uid postgres-to-auth-owner sequence; independently reproduce the Daily workspace CHECK profile without assuming the optional billing baseline; complete independently pinned Hosted role/configuration/membership provenance. These source tasks remain unperformed and executable; no exclusively external blocker is established. Bounded repository/offline source work at priority 2 under existing user authorization and FM-DEC-024. Independently reconcile supported provider/role and installed-parent source profiles using the already captured private observation and separately pinned source evidence. Never use target-derived expected values. Design a source-defined forward transition with exact preconditions, supported baseline, authorization boundaries, atomicity, cleanup/recovery and meaningful isolated tests. No APPLY, runtime activation, target calls, provider calls, workflow dispatch, target DDL/data/role changes, temporary target helper or customer fixture. Bounded completion: publish independently supported profile inputs and a reviewable source transition design, or record PARTIAL with the exact missing external provenance. If external input blocks completion, make the specific action requires_owner=true and link an exact owner/evidence item so existing selection reports OWNER_ACTION_REQUIRED; do not call PARTIAL completed or keep a generic executable placeholder. No repeated permission question for already authorized safe offline work. Creator aggregate stays IN_PROGRESS; learningState=UNDETERMINED, targetAccepted=false, applyAllowed=false and runtimeActivated=false. A catalog classifier outcome is a scoped observation, never target acceptance, learning-schema ABSENT/INSTALLED proof or authority to write. The catalog action and broad NBA-CREATOR-INTELLIGENCE remain consumed; no unchanged retry.

## Why this action

standing-authorized safe work

## Builder manager

- Default worker limit: `3`
- Effective worker limit: `3`
- Hard maximum worker limit: `5`
- SAFE READY SET: `NBA-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN`
- Worker slots reserved by active/ready work: `1`
- Active task continuations reserving slots: `NBA-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN`
- Serialized due to conflict/limit: `NONE`
- Blocked by action dependencies: `NONE`
- Parallel execution is fail-closed: a second concurrent action requires `parallel_safe=true` plus complete non-overlapping scope metadata; missing/unknown scope serializes.
- The manager reuses the existing action catalog and task/gate state; it does not create a second TODO/orchestration system.

## Candidate evaluation

- `NBA-CHATADMIN-STAGING-VERIFY` priority 0: **DONE** — gate chatadmin_staging_verify is VERIFIED
- `NBA-CHATADMIN-MANUAL-FLOW` priority 1: **DONE** — gate chatadmin_manual_flow is ACCEPTED
- `NBA-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN` priority 2: **EXECUTABLE** — standing-authorized safe work
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
