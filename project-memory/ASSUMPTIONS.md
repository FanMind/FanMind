## ASM-FM-CREATOR-DEPLOYED-FLAG-20260911
- Related: FM-CREATOR-001 / FM-CR-033; Risk R4; Status: NEEDS_VERIFICATION.
- Assumption: job-local FANMIND_CREATOR_INTELLIGENCE_ENABLED=false proves the running Staging process is disabled. That inference is INVALIDATED: /api/version does not attest this flag and the acceptance validates only its own environment.
- Evidence: #1109 independent review; workflow/acceptance source inspection. No activation operation was performed, but no host/process flag proof is available.
- Next: independent actual process or authenticated feature-state observation before an enabled-runtime/current-off claim; never read or expose secret values. The bounded schema/JWT/PDF result remains valid within its stated scope.

# Assumption Verification Register

## ASM-FM-CREATOR-SOCIAL-20260910
- Status: VERIFIED for source and priority; target acceptance remains NEEDS_VERIFICATION.
- Evidence: local baseline tree equals current remote main; Creator scope is documentation only before this work; latest owner instruction explicitly resumes implementation before Android.
- Boundaries: no Creator assignment may be guessed from display names or the logged-in chatter. Existing legacy records must not silently acquire a different persona. Meta and OnlyFans access/consent require actual evidence; repository work does not provide it.

## ASM-FM-CREATOR-20260910
- Date: 2026-09-10
- Related task: FM-ROADMAP-001 / FM-CREATOR-001
- Risk: R2
- Assumption: owner initially intended sequencing after accepted Sales Handoff. FM-DEC-015 now explicitly resumes Creator/Social engineering before Android, one Creator per account/Workspace.
- Status: SUPERSEDED
- Evidence: explicit owner instruction in this session; FM-DEC-013 and docs/CREATOR_INTELLIGENCE.md.
- Recheck trigger: any future change to the handoff/Creator/Phase-8 sequence.
- Action if false: reconcile a new owner decision before changing prerequisites; do not infer permission to start early.
## ASSUMP-FM-REG-001-20260910
- Task: FM-REG-001
- Risk: R3
- Status: VERIFIED
- Assumption: local existing application, test and reader sources match current remote main before this correction.
- Evidence: all seven existing paths match remote tree e9c1fd702a840759f661f4e2d8d1e3bd6322c702 blob SHAs.
- Invalidated assumption: all non-local password recovery requests should return to fanmind.ch; Staging must retain its own origin.
- Needs verification: provider allowlist accepts the exact DE/EN callback URLs; real email delivery and usable link on the intended environment; current CI on the proposed commit.
- Boundary: fragment type is syntactic routing information, not proof of token provenance; Auth validates the access token. No PKCE support is added to Web.

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
- Updated: 2026-09-07
- Related task: FM-AI-001
- Risk: R3
- Assumption: Existence of Plus/Ultra Stripe Test prices means Plus/Ultra are productively ready.
- Why it matters: would incorrectly activate or sell unfinished tiers.
- Verification source/evidence: FM-EV-022 and Source of Truth/#560 confirm Test prices/resources/webhook/AI ledger. The general Billing ledger and bounded canonical Staging acceptance are now also proven by Apply `34040107219`, deploy `34058028839` and rollback-only acceptance `34058118450` / job `101553652111`. Productive readiness still requires models/fallbacks, quotas, private quality/cost, remaining provider-side current lifecycle/downstream reconciliation, Legal/Tax, runtime integration and explicit Production activation.
- Status: INVALIDATED
- Recheck trigger: any Plus/Ultra activation proposal.
- Action if false: keep Plus/Ultra and canonical Production projection fail-closed until full tier quorum; do not repeat the completed canonical Billing Staging sub-gate.

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
## ASM-FM-OPS-AUDIT-20260911
- Task: FM-OPS-001 / FM-CR-034; Risk R4.
- VERIFIED: actual main e0f2a517855a65bd927c3968c8e0700f06bb54db tree matches the clean baseline. Existing deploy installs root-owned audit/verifier; its independent workflow executes those installed files with no checkout. Audit 34639783862 failed without a published probe diagnostic.
- NEEDS_VERIFICATION: the actual failed Production probe and current PM2-reported Node version/host boot measurements. Shell Node, build Node and an old audit cannot establish current process or reboot acceptance.
- Countercheck: executable negative/redaction tests plus actual current-head installed audit after reviewed publication. Preserve full failure state if the new runtime subset passes but backups do not.

## FM-CR-036 — Production restart assumptions — 2026-09-12
- VERIFIED: exact current main/release c2342d66ff0fa9f9656360f326cc9ec60f1aaa80 and complete installed audit; previous backup blocker closed by #1111 final receipt 5644711203.
- VERIFIED: authenticated provider page and encrypted console identify fanmind-prod-01 / 855fe169-f3ea-4dcf-8849-e7fe0c729f5b / at-vie-2; do not operate the separate restore host.
- UNVERIFIED: systemd startup for nginx, PM2, runner and operational units, matching saved PM2 launch definition, and authenticated host-login recovery. Running status/portal access alone does not prove these.
- Owner authorization: explicit controlled Ubuntu reboot plus latest continuation, not inferred from generic publication authorization. No extra backup, rights change or restore repetition.
