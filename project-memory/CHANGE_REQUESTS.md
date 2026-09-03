# FanMind Change Requests

Capture new ideas before changing active scope. Classify each as ACCEPTED, DEFERRED, REJECTED, DUPLICATE or merged into an existing task.

## FM-CR-001
- Date: 2026-08-19
- Status: ACCEPTED
- Source: owner
- Idea: Introduce a durable project-memory, duplicate-check and change-intake mechanism for ongoing development.
- Classification: New governance capability.
- Affected areas: repository governance, PR workflow, engineering execution.
- Related task: FM-MEM-001
- Decision: Implement Project Memory Protocol v1 across active FanMind/WellFit repositories.

## FM-CR-002
- Date: 2026-08-29
- Status: ACCEPTED
- Source: owner
- Idea: The authenticated demo account must show the already stored sample messages for all demo contacts directly in the Mobile contact detail.
- Classification: Bounded Mobile product correction and replacement Android preview build.
- Affected areas: `apps/mobile` contact detail/data access, Mobile documentation, regression tests and signed Android preview evidence.
- Existing task/decision checked: FM-MOB-001, FM-DEC-003, FM-DEP-002, ASM-FM-005 and FM-LOOP-003.
- Dependencies: Existing RLS-protected `conversation_messages` rows, current Mobile Supabase binding, exact-head repository checks and a new exact-commit Android internal build.
- Decision: Track the implementation and replacement build as FM-MOB-002 without reopening or replacing the native Mobile foundation.
- Related task: FM-MOB-002

## FM-CR-003
- Date: 2026-08-29
- Status: ACCEPTED
- Source: owner
- Idea: Mobile must let every fan switch among all stored message platforms, use the account start screen as a dashboard containing only fans with unseen inbound messages, remove the owner's explicitly rejected placeholder logo symbol, and let an owner create a manual Follow-up directly on a fan from the phone.
- Classification: Bounded Mobile core-demo workflow correction and replacement Android preview build.
- Affected areas: Mobile dashboard, contact detail, authenticated Supabase reads/seen update, Follow-up form, policy tests, Mobile documentation and signed Android preview evidence.
- Existing task/decision checked: FM-MOB-001/002, FM-DEC-003, FM-DEP-002, FM-LOOP-003, existing web `seen_at` semantics and owner-only Mobile mutation boundary.
- Dependencies: current RLS-protected `conversation_messages`/`contacts`/`followups` contracts, exact-head CI and one new exact-commit Android preview.
- Decision: implement together as FM-MOB-003 because the three changes form one phone demo loop: unseen fan -> channel-specific history -> manual Follow-up.
- Related task: FM-MOB-003

## FM-CR-004
- Date: 2026-08-29
- Status: ACCEPTED
- Source: owner
- Idea: Move `iOS-TestFlight` out of Phase 6 and into Phase 8.
- Classification: Roadmap and current-finishline scope reclassification; no runtime or provider mutation.
- Affected areas: canonical roadmap, Mobile finishline/dependencies, external acceptance wording and central reader/tests.
- Existing task/decision checked: FM-MOB-001, FM-DEP-002, FM-LOOP-003, EXT-MOBILE-IOS, `FINISHLINE_STATE.json`, `FANMIND_FINISHLINE.md` and the current Phase-8 boundary.
- Dependencies: Phase 8 must remain not started during the current finishline; existing iOS code/build foundations remain untouched.
- Decision: Phase 6 no longer requires iOS/TestFlight acceptance. `iOS-TestFlight` becomes a Phase-8 roadmap item and is not a blocker for the current through-Phase-7 finishline. This reclassification does not start Phase 8 and does not remove native iOS support or CI/build foundations.
- Related task: FM-MOB-001

## FM-CR-005
- Date: 2026-08-29
- Status: ACCEPTED
- Source: owner
- Idea: Refine the Mobile fan detail into three consistent sections for every fan, keep the identifier on one line, expose safe fan analysis under contact knowledge, make Follow-ups navigate back to their fan, show today's Follow-ups on Start and replace the cropped startup asset with `FM` above `FanMind`.
- Classification: Bounded Mobile usability correction and replacement Android preview build.
- Affected areas: Mobile contact detail/dashboard/follow-up navigation, authenticated AI route, RLS data reads, native splash branding, documentation and tests.
- Existing task/decision checked: FM-MOB-001/002/003, FM-CR-004, existing Web fan-analysis action, RLS-protected `fan_analysis_reports`/`followups`, no-auto-send and owner-only mutation boundaries.
- Dependencies: exact-head CI, existing Mobile Bearer session, server-side analysis capability/retention gates, one merged-commit Android preview and owner device confirmation.
- Decision: implement as FM-MOB-004 without schema, demo-row, provider,
  Production or automatic-send changes. PR review tightened the decision:
  stored analysis is provenance-bound and generation remains visibly in
  preparation without an active Mobile control until the separate Production
  capability/privacy contract is truly activated and verified.
- Related task: FM-MOB-004

## FM-CR-006
- Date: 2026-08-30
- Status: ACCEPTED
- Source: owner
- Idea: Finish the accepted Android app, bind its release build to FanMind Production and bring it through Google Play.
- Classification: Android Production/Store continuation of the existing Mobile release task; no iOS Phase-8 start and no automatic public release.
- Affected areas: Mobile version, Production EAS/AAB control, Supabase Auth redirect acceptance, Android private device runbook, Google Play listing/data-safety/testing/submission evidence and Project Memory.
- Existing task/decision checked: FM-MOB-001, FM-MOB-003/004 acceptance, FM-DEC-009, EXT-MOBILE-REDIRECT, EXT-MOBILE-ANDROID and EXT-MOBILE-PUSH-STORE.
- Dependencies: exact reviewed `main`, verified `mobile-production`/EAS/FanMind targets, existing frozen Android signing credentials, complete private Android acceptance, live Supabase recovery redirect, Google developer identity/phone verification, Play app record and applicable test-program eligibility.
- Decision: Resume FM-MOB-001 at Risk R3. Prepare a separate main-only Production Android AAB workflow with Submit/Update disabled, then perform external Supabase/device/Play controls separately. Publishing remains an action-time-confirmed external step and cannot be claimed while Google account review blocks app creation.
- Related task: FM-MOB-001

## FM-CR-007
- Date: 2026-08-30
- Status: ACCEPTED
- Source: owner
- Idea: Continue the blocked Store work now, prepare the iPhone App Store in parallel without an available iPhone, and defer the complete Android device acceptance until FanMind can be downloaded from Google Play.
- Classification: Repository-only dual-store preparation and Android acceptance-sequence correction; no new Mobile binary or portal submission.
- Affected areas: public Support route, Google Play graphics, Apple/Google metadata and review/tester handoffs, Mobile Store checks, canonical readers and Project Memory.
- Existing task/decision checked: FM-MOB-001, FM-CR-006, FM-DEC-009, EXT-MOBILE-ANDROID, EXT-MOBILE-IOS and EXT-MOBILE-PUSH-STORE.
- Dependencies: unchanged verified Android `1.0.0` AAB, pending Google account review, later Play test-track download, Apple Developer/App Store Connect and later signed iOS/TestFlight/device evidence.
- Decision: Prepare both Store packages now. Android full 19-check acceptance and final screenshots begin only after installation from the Play test track. Apple metadata/support/review/screenshot planning is allowed now, but iOS signing, build, TestFlight and device acceptance remain Phase 8 and unverified.
- Related task: FM-MOB-001

## FM-CR-008
- Date: 2026-08-30
- Status: ACCEPTED
- Source: owner
- Idea: Continue autonomously with safe work while Google Play approval is pending and ensure the known project state is fully incorporated rather than leaving stale trackers that trigger duplicate work.
- Classification: Repository/issue governance reconciliation; no product runtime, provider, database, payment, signing or release mutation.
- Affected areas: Project Memory issue reconciliation, quality controls, #642/#643/#644 and bounded current-status wording in #874.
- Existing task/decision checked: FM-STG-001, FM-LOOP-011, FM-AI-001, #642/#643/#644/#874, STAGING_ACCEPTED and the current Mobile/Restore/AI owner-deferred boundaries.
- Dependencies: exact immutable Staging evidence and successful exact-head repository review before external issue metadata is changed.
- Decision: keep genuine #642/#643 gates open, supersede only the historical #644 umbrella, and make the mapping machine-checkable so later work cannot mistake stale checkboxes for missing implementation.
- Related task: FM-MEM-009

## FM-CR-009
- Date: 2026-08-30
- Status: ACCEPTED
- Source: owner
- Idea: Continue autonomously with the next safe FanMind completion work while Google Play approval remains pending.
- Classification: Bounded repository-only Stripe runtime conformance correction; no provider, price, webhook-endpoint, database, payment, refund, tax-registration or tier-activation mutation.
- Affected areas: server-side Stripe client construction, outbound API-version pin, Checkout dynamic payment-method contract, request integration identifier, billing/referral Stripe calls, focused regression tests and AI/Billing Project Memory.
- Existing task/decision checked: FM-AI-001, FM-LOOP-004, FM-AI-OWNER-001/002, FM-EV-022 and the accepted 2026-08-26 AI/Billing read-only reconciliation.
- Dependencies: exact reviewed main, Stripe SDK/API contract, fail-closed tax readiness, existing disabled Plus/Ultra/runtime gates, and later owner/protected action for any provider-side webhook-version migration or transactional acceptance.
- Decision: complete only the explicitly listed code conformance review. Keep eligible Checkout payment methods Dashboard-managed, pin outbound SDK requests independently from the verified older inbound Staging webhook endpoint, and leave all provider/runtime activation work blocked.
- Related task: FM-AI-001

## FM-CR-010
- Date: 2026-08-30
- Status: ACCEPTED
- Source: owner
- Idea: Continue autonomously with all safe App-Store preparation that can be completed while Google Play account approval remains pending.
- Classification: Repository-only App Store Connect field reconciliation and fail-closed release worksheet; no Mobile binary, signing, portal or provider mutation.
- Affected areas: Apple portal handoff, Mobile Store readiness validator, regression tests, canonical Mobile readers and Project Memory.
- Existing task/decision checked: FM-MOB-001, FM-CR-006/007, FM-DEC-010, EXT-MOBILE-ANDROID, EXT-MOBILE-IOS, EXT-MOBILE-PUSH-STORE and the existing verified Android `1.0.0` AAB.
- Dependencies: unchanged Mobile identity and prepared metadata, current Apple App Store Connect field requirements, later owner/legal/account decisions and Phase-8 signed-build/device evidence.
- Decision: Add one machine-checked 33-field App Store Connect worksheet that separates thirteen repository-ready values, twelve owner/legal/account decisions and eight Phase-8 binary/device controls. Keep all unresolved values explicit; do not start iOS signing/build/TestFlight, create a portal record or rebuild Android.
- Related task: FM-MOB-001

## FM-CR-011
- Date: 2026-08-31
- Closed: 2026-09-01
- Status: ACCEPTED
- Source: owner
- Idea: During the Google Play approval wait, make Production/Staging/test-data separation machine-checkable and prepare privacy-minimal incoming-message push plus at most one delayed reminder.
- Classification: Bounded repository-only Mobile Push/data-boundary hardening; no provider, database, Production, Store or build mutation.
- Affected areas: message-push policy, native notification routing/seen semantics, data-environment guard, Mobile/root product readers, tests and Project Memory.
- Existing task/decision checked: FM-MOB-001/003/004, FM-DEC-009/010, FM-DEP-002, FM-LOOP-003, existing dormant Follow-up Push foundation and external Push/Store acceptance boundaries.
- Dependencies: exact reviewed repository state, fail-closed CI/review, later separate Push Staging/Delivery-Ledger/provider/device gates for real delivery.
- Decision: Accepted for repository scope through PR #1050 final head `09ec3c8a73d57f7a0f0552e6ba89440b27e89ec7`, squash merge `953fcc56de0d02d5c2c5d41468226ba051624b53`, eight green exact-head workflows, completed Codex review and zero unresolved threads. Real provider delivery, Delivery-Ledger apply, Production push, Google Play/build/device acceptance remain open under FM-MOB-001/external acceptance.
- Related task: FM-MOB-005

## Intake template

```text
## FM-CR-XXX
- Date: YYYY-MM-DD
- Status: NEW
- Source: owner/team/agent
- Idea:
- Classification:
- Affected areas:
- Existing task/decision checked:
- Dependencies:
- Decision:
- Related task:
```
## FM-CR-012
- Date: 2026-09-03
- Status: ACCEPTED
- Source: owner
- Idea: Assign the already-started embeddable Website AI assistant to Phase 8. Users receive an embed code; visitor conversations are visible in FanMind; when AI cannot continue reliably it hands the conversation to the FanMind user; a visitor who explicitly provides an email address can receive the user's later reply.
- Classification: Roadmap correction and product-scope clarification. Existing disabled Website Chat security, session, widget and ingestion work counts as started foundation; this decision does not authorize Production activation, provider sending or personal-data collection without consent/legal acceptance.
- Affected areas: canonical roadmap, Website Chat foundation, public project summary and roadmap invariants.
- Decision: Phase 8 now explicitly includes the Website AI assistant. Foundation is `partial`; AI dialogue, escalation, full conversation UX, email capture/verification and reply delivery remain open.
