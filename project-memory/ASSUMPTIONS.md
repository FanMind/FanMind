# Assumption Verification Register

Critical assumptions used to plan or execute FanMind work must be recorded before they are relied upon.

Statuses: `NEEDS_VERIFICATION`, `VERIFIED`, `INVALIDATED`, `SUPERSEDED`.

## ASM-FM-001
- Date: 2026-08-19
- Updated: 2026-08-19
- Related task: FM-RST-001
- Risk: R4
- Assumption: The repository still needs transfer from a user owner into an organization before the `fanmind-restore-drill` runner group can exist.
- Why it matters: Old restore docs use this as a hard dispatch blocker.
- Verification source/evidence: current GitHub repository metadata reports `FanMind/FanMind` with owner type Organization `FanMind`.
- Status: INVALIDATED
- Recheck trigger: repository owner/name change.
- Action if false: already false; do not repeat organization-transfer work. Update stale canonical reader text after runner-policy truth is safely reconciled.

## ASM-FM-002
- Date: 2026-08-19
- Updated: 2026-08-19
- Related task: FM-RST-001
- Risk: R4
- Assumption: The current live runner group `fanmind-restore-drill` still has the exact selected-repository/workflow/JIT policy recorded during setup.
- Why it matters: labels are routing only; the Admin policy is part of the restore authorization boundary.
- Verification source/evidence: setup was performed in the operator session, but the current GitHub connector does not expose complete runner-group Admin policy attestation.
- Status: NEEDS_VERIFICATION
- Recheck trigger: immediately before any Restore dispatch/write and after any organization/repository workflow change.
- Action if false: block Restore, correct policy through GitHub Admin controls, re-capture evidence; do not weaken workflow gates.

## ASM-FM-003
- Date: 2026-08-19
- Updated: 2026-08-19
- Related task: FM-RST-001
- Risk: R4
- Assumption: isolated restore VM, PG17.11, Node24.19, DB `fanmind_restore`, bootstrap login, TLS verify-full and no-sudo restore user remain unchanged from the operator session.
- Why it matters: these are prerequisites for safe continuation and must not be silently trusted or unnecessarily rebuilt.
- Verification source/evidence: prior restore operator-session evidence; current repository runbook/toolchain requirements.
- Status: NEEDS_VERIFICATION
- Recheck trigger: immediately before Resource Readiness/Compatibility and after host maintenance.
- Action if false: reconcile only the drifted component; do not rebuild the whole restore host by default.

## ASM-FM-004
- Date: 2026-08-19
- Updated: 2026-08-26
- Related task: FM-AI-001
- Risk: R3
- Assumption: Existence of Plus/Ultra Stripe Test prices means Plus/Ultra are productively ready.
- Why it matters: would incorrectly activate or sell unfinished tiers.
- Verification source/evidence: FM-EV-022 and Source of Truth/#560 confirm current Test prices, resources, webhook and AI ledger, while models, quotas, private quality/cost, current post-ledger lifecycle, general Billing ledger/cutover, legal/tax, runtime integration and explicit Production activation remain required.
- Status: INVALIDATED
- Recheck trigger: any Plus/Ultra activation proposal.
- Action if false: keep Plus/Ultra fail-closed until full tier quorum.

## ASM-FM-005
- Date: 2026-08-19
- Updated: 2026-08-19
- Related task: FM-MOB-001
- Risk: R3
- Assumption: Successful Native CI/debug APK/iOS simulator build is equivalent to a signed real-device/store acceptance.
- Why it matters: would falsely close Mobile.
- Verification source/evidence: Source of Truth and #584/#690 explicitly keep signing, real devices, TestFlight and stores external/open.
- Status: INVALIDATED
- Recheck trigger: any Mobile completion claim.
- Action if false: require exact signed-build/device/store evidence.

## ASM-FM-006
- Date: 2026-08-19
- Updated: 2026-08-19
- Related task: FM-SOC3-001 / FM-SOC7-001
- Risk: R3
- Assumption: Existing connector foundation or provider login capability proves the required FanMind inbox/DM/comment scope is available and accepted.
- Why it matters: could produce fake integrations or platform-policy violations.
- Verification source/evidence: #874 platform-feasibility rules and Source of Truth.
- Status: INVALIDATED
- Recheck trigger: before implementing or enabling each real Social channel.
- Action if false: verify official current platform scope first; no scraping/bypass.

## ASM-FM-007
- Date: 2026-08-19
- Updated: 2026-08-19
- Related task: FM-SALES-001
- Risk: R2
- Assumption: Phase 4 completion or prepared sales documents mean FanMind has already completed technical sales handoff.
- Why it matters: conflicts with current canonical finishline.
- Verification source/evidence: Source of Truth, #874 and sales-handoff alignment commit `74c3a6aa357215c52d3a4d9b01ba8513bba1b57f`.
- Status: INVALIDATED
- Recheck trigger: any sellable/handed-over completion claim.
- Action if false: keep handoff blocked until required Phase-3/Phase-7 acceptance and final Production demo.

## ASM-FM-008
- Date: 2026-08-19
- Updated: 2026-08-19
- Related task: all
- Risk: R3
- Assumption: Old P0/P1 percentages or unchecked issue-body boxes are current truth without revalidation.
- Why it matters: causes duplicate work and false regressions/progress.
- Verification source/evidence: #874 and recent commits/evidence supersede multiple older tracker statements.
- Status: INVALIDATED
- Recheck trigger: every planning/status session.
- Action if false: current Git/CI/runtime/provider evidence first; preserve older trackers as history.

## ASM-FM-009
- Date: 2026-08-20
- Updated: 2026-08-20
- Related task: FM-SEC-001
- Risk: R3
- Assumption: Production trigger-function hardening is already accepted/applied because the controlled SQL and runbook exist on `main`.
- Why it matters: would falsely close live privilege/search-path warnings and could skip required protected Production evidence.
- Verification source/evidence: fresh Production Supabase advisors still report the three mutable-search-path warnings and browser execution of `trim_conversation_messages_to_latest_50()`; the Production runbook explicitly states merge/deploy does not auto-apply the database mutation.
- Status: INVALIDATED
- Recheck trigger: before any claim that Production trigger hardening is complete and after any controlled Apply/Verify.
- Action if false: treat code as implementation evidence only; require exact target read-only verify, protected Apply if authorized, postflight and fresh advisor scan.

## ASM-FM-010
- Date: 2026-08-20
- Updated: 2026-08-26
- Related task: FM-SEC-001
- Risk: R3
- Assumption: The Staging `ensure_current_user_workspace(...)` authenticated `SECURITY DEFINER` exposure is safe and intentionally accepted merely because the migration grants it to `authenticated`.
- Why it matters: intentional code design is not equivalent to current security acceptance of a privileged RPC.
- Verification source/evidence: direct catalog evidence and 24/24 focused tests confirm the migration revokes `PUBLIC`/`anon`, grants only the intended authenticated call path, pins search path, checks `auth.uid()`/`auth.role()`, serializes per-user provisioning and derives commercial values server-side. The live advisor still correctly reports that an authenticated SECURITY DEFINER path exists.
- Status: NEEDS_VERIFICATION
- Recheck trigger: explicit policy/owner exception decision, any function/grant/catalog drift, or promotion of equivalent behavior to Production.
- Action if false: current technical classification is constrained intentional exposure, not final policy acceptance. Keep fail-closed; under `FM-SEC-OWNER-002`, explicitly accept the exception or remediate through a separately reviewed migration. Do not revoke blindly.

## ASM-FM-011
- Date: 2026-08-29
- Updated: 2026-08-29
- Related task: FM-MOB-002
- Risk: R3
- Assumption: The demo contacts appear without messages because Staging failed to store them or requires a new database permission/schema change.
- Why it matters: accepting this assumption would duplicate demo data or alter RLS instead of fixing the actual Mobile presentation defect.
- Verification source/evidence: bounded authenticated Staging observation found 13 demo contacts and 37 matching `conversation_messages`; source inspection showed the Mobile detail screen loaded only the contact and contact memories and contained no message query or history renderer.
- Status: INVALIDATED
- Recheck trigger: any future empty-history report after the replacement build is installed.
- Action if false: keep the database unchanged; query by both workspace and contact through the authenticated RLS path and diagnose exact account/workspace/build binding before considering data creation or policy changes.

## ASM-FM-012
- Date: 2026-08-29
- Updated: 2026-08-29
- Related task: FM-MOB-003
- Risk: R3
- Assumption: The unseen-fan dashboard, per-fan channel switch and direct manual Follow-up require a new Supabase schema or broader browser permission.
- Why it matters: unnecessary database or RLS changes would increase risk and could weaken the already accepted Workspace boundary.
- Verification source/evidence: existing `conversation_messages.seen_at`, authenticated Workspace/contact message policies, Owner-only Mobile mutation rule and existing `followups` insert contract were inspected; bounded read-only Staging aggregation confirmed unseen inbound rows and Lena messages across three platforms. FM-EV-025 and the negative source tests bind every new read/update to the current Workspace and preserve Member read-only behavior.
- Status: INVALIDATED
- Recheck trigger: a same-build runtime RLS failure on the exact Owner Workspace, or a future schema/policy change affecting `conversation_messages`/`followups`.
- Action if false: diagnose the exact query/policy mismatch before any migration; do not add service-role access, broaden grants or duplicate demo rows.

Do not delete invalid assumptions; preserve them so the same mistaken premise is not reused later.
