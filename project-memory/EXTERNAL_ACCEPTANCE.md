# FanMind External Acceptance Register

Repository implementation cannot self-close these controls. Each entry remains open until current external evidence is bound to the exact relevant account/project/build/commit/target.

Statuses: `OPEN`, `BLOCKED`, `ACCEPTED`, `NOT_REQUIRED`, `SUPERSEDED`.

## EXT-MOBILE-REDIRECT
- Related: FM-MOB-001
- Status: OPEN
- Risk: R3
- External system: Supabase Auth
- Acceptance: exact approved project allows `fanmind://reset-password`; real signed-device recovery positive/negative flow passes.
- Current evidence: after separate action-time owner confirmation on 2026-08-30, `fanmind://reset-password` was saved in the exact Production URL Configuration and independently re-read as the fourth allowlisted URL. The real signed-device positive/negative Recovery flow remains unproven, so this combined external control stays OPEN.
- Repository evidence alone sufficient: no

## EXT-MOBILE-EAS
- Related: FM-MOB-001
- Status: ACCEPTED
- Risk: R3
- External system: Expo/EAS
- Acceptance: exact owner/project/environments validated, token access works, no Production target drift.
- Current evidence: protected `preview` run `33298699290`, job `99222705186`, on exact merge `6a2f5b6c9bac1607ecc2ccae11c6ade3cb418522` accepted Preview. Protected Production readiness run `33316105624`, job `99269748215`, on exact `main` `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00` reverified the existing EAS project binding and public FanMind Production environment without release writes. The later Store-build job repeated those checks before the one AAB. No secret or private artifact URL is retained here.
- Repository evidence alone sufficient: no

## EXT-MOBILE-ANDROID
- Related: FM-MOB-001
- Status: OPEN
- Risk: R3
- External system: Android signed internal distribution / real device
- Acceptance: signed exact-commit build and private device acceptance per mobile runbook.
- Current evidence: exact signed `preview` Android artifact for merge `6a2f5b6c9bac1607ecc2ccae11c6ade3cb418522` is verified by run `33298699290` / job `99222705186`. On 2026-08-30 the owner installed and inspected that build and accepted the bounded FM-MOB-003/FM-MOB-004 UI/runtime result. FM-EV-030 counterchecks the fail-closed private pending-template preparer; FM-DEC-010 now requires the complete receipt-bound 19-check run, recovery, cache-failure, logout-purge and screenshot proof to use the later Play-test-track installation. No such final Store-device evidence or private build ID is retained here.
- Store-build evidence: run `33316172583` / job `99269924756` completed exactly one signed Android Production AAB for `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00`, verified terminal artifact/commit/platform/profile/store class, stored a redacted receipt and cleaned temporary state. This is build evidence, not a replacement for the private device runbook or Play acceptance.
- Repository evidence alone sufficient: no

## EXT-MOBILE-IOS
- Related: FM-MOB-001 / FM-DEC-009
- Status: OPEN
- Risk: R3
- Phase: 8 — future scope, not part of the current through-Phase-7 finishline.
- External system: Apple Developer / App Store Connect / TestFlight
- Acceptance: signed exact-commit iOS build, TestFlight and real-device acceptance once Phase 8 is explicitly started.
- Current-finishline effect: none. This open future control does not block FM-MOB-001/current sales finishline after the owner moved `iOS-TestFlight` from Phase 6 to Phase 8.
- Repository preparation: FM-DEC-010 permits metadata, public Support, privacy/review/tester handoffs and screenshot planning now. These artifacts are not signed iOS/TestFlight/device evidence and do not change the OPEN Phase-8 state.
- Repository evidence alone sufficient: no

## EXT-MOBILE-PUSH-STORE
- Related: FM-MOB-001
- Status: OPEN
- Risk: R3
- External system: Expo push + Apple/Google store portals
- Acceptance: separated push gates plus final screenshots/privacy/data-safety/store evidence from signed builds, limited to the platform scope currently being accepted; iOS/TestFlight-specific portal acceptance is Phase 8 per FM-DEC-009.
- Current evidence: the Android `1.0.0` Production AAB exists and is verified by `33316172583` / `99269924756`. Owner-provided Play Console evidence on 2026-09-03 shows that exact baseline version published to `Geschlossener Test - Alpha` for Germany, Austria and Switzerland, with testers managed through `FanMind Alpha Tester`. This is closed-test distribution, not public Production access. At least twelve testers still need to opt in and complete at least 14 days before the later Production-access request. The AAB predates the native message-push handler, so real message-push acceptance remains open and requires the separately reviewed FCM-bound Preview/device-registration path before any provider-send acceptance.
- Repository evidence alone sufficient: no

## EXT-AI-PRODUCT-DECISION
- Related: FM-AI-001
- Status: BLOCKED
- Risk: R3
- External/owner decision: model/fallback, request/token quota, usage/overage, switching/proration/refund and cost/margin. The 50/100/150 context limits are already approved and are not part of this unresolved decision.
- Acceptance: written tier-specific decisions recorded without guessing.
- Repository evidence alone sufficient: no

## EXT-AI-QUALITY-COST
- Related: FM-AI-001
- Status: OPEN
- Risk: R3
- External/private evidence: blinded quality evaluation and representative usage/cost evidence.
- Acceptance: current private result satisfies documented thresholds without exposing prompt/reply/model secrets.
- Repository evidence alone sufficient: no

## EXT-AI-LEGAL-TAX
- Related: FM-AI-001 / FM-LEGAL-001
- Status: BLOCKED
- Risk: R3
- External system: legal/tax review
- Acceptance: applicable tier billing/tax/legal treatment approved before Production activation.
- Repository evidence alone sufficient: no

## EXT-AI-STAGING-LIFECYCLE
- Related: FM-AI-001
- Status: BLOCKED
- Risk: R3
- External/protected action: reconcile the observed September 8 run authorization and current freshness, then only the remaining provider/current-lifecycle and downstream evidence.
- Current evidence: Run 34273836166 / job 102221843980 on deployed 7f681d26fa0e3c30e743c6a8ef1cd4fef6004e59 technically passed the shared rollout, three ledger verifies, Test catalog, lifecycle, browser boundary and service-role ledger, with full rollback/cleanup and unchanged read-only counters. Its separately required action-time protected-Staging authorization has not been verified in the available record. Publication authorization FM-AUTH-FINISHLINE-PUBLISH-20260908 does not establish that separate scope. Keep this protected acceptance RECONCILIATION_REQUIRED under CTR-FM-AI-AUTH-20260910; retain the observed result, do not invent approval or rerun automatically. Canonical Billing run 34058118450 remains historical PASS; its current-state reuse was invalidated by Staging deploy 34273614070.
- Acceptance: reconcile the existing run authorization first. Then assess exact current release/target and evidence freshness before planning only the genuinely missing provider-side inbound webhook/current lifecycle, failed-payment, ordering/idempotency/conflict and canonical downstream Billing -> AI/referral evidence. Any new protected write requires its own exact authorization. Do not repeat SQL installation, catalog setup or a successful historical run merely to repair documentation. Product/private quality-cost, Legal/Tax and Production activation remain separate.
- Repository evidence alone sufficient: no

## EXT-META-EVENTS
- Related: FM-META-001
- Status: OPEN
- Risk: R3
- External system: Meta Events Manager / normal browser
- Acceptance: no event before consent; exact PageView after consent/navigation; no CompleteRegistration/Lead; no PII/Advanced Matching.
- Current evidence: FM-EV-007 Production-confirms the consent-gated parameterless PageView-only technical path. FM-EV-023 confirms the current repository no-PII/security boundary and isolated Staging metadata read-only, but no Meta event was emitted and no provider-side Events Manager observation was made.
- Repository evidence alone sufficient: no

## EXT-META-APP-REVIEW
- Related: FM-META-001 / FM-SOC3-001
- Status: OPEN
- Risk: R3
- External system: Meta Business/App Review
- Acceptance: required permissions/accounts approved and real Facebook/Instagram E2E passes.
- Current evidence: technical data/token/content/conversation foundations exist and FM-EV-023 confirms their current server-only Staging metadata boundaries; no Meta account, OAuth, permission, App Review or real provider E2E action was performed.
- Repository evidence alone sufficient: no

## EXT-WHATSAPP
- Related: FM-SOC3-001
- Status: OPEN
- Risk: R3
- External system: Meta/WhatsApp Business
- Acceptance: approved credentials/permissions plus Staging and real connector E2E, revocation/reconnect and tenant/idempotency evidence.
- Repository evidence alone sufficient: no

## EXT-TIKTOK
- Related: FM-SOC7-001
- Status: OPEN
- Risk: R3
- External system: TikTok developer platform
- Acceptance: current official API scope supports the required FanMind use case; then real allowed connector E2E. Login/content posting alone does not count as inbox/DM/comment support.
- Repository evidence alone sufficient: no

## EXT-X
- Related: FM-SOC7-001
- Status: BLOCKED
- Risk: R3
- External system: X developer platform
- Acceptance: developer app/access and any required paid API usage are explicitly approved, then real DM/connector E2E.
- Repository evidence alone sufficient: no
- Financial boundary: no credits/spend without separate approval.

## EXT-DISCORD
- Related: FM-SOC7-001
- Status: OPEN
- Risk: R3
- External system: Discord
- Acceptance: official OAuth2 bot/guild connector, no self-bot, real E2E and revocation/reconnect evidence.
- Repository evidence alone sufficient: no

## EXT-ONLYFANS
- Related: FM-SOC7-001
- Status: OPEN
- Risk: R3
- External system: OnlyFans/platform contract
- Acceptance: either official/contractual API basis with real accepted connector, or explicit documented `NOT_REQUIRED/unavailable` finishline decision because no compliant integration path exists.
- Repository evidence alone sufficient: no
- Hard boundary: no scraping, proxy reverse engineering or platform bypass.

## EXT-LEGAL-TAX-AVV
- Related: FM-LEGAL-001
- Status: BLOCKED
- Risk: R3
- External system: legal/tax/register/provider/customer acceptance
- Acceptance: only genuine advisor/register/provider/customer evidence for UID/register/tax/legal/AVV/subprocessors/regions/transfers/retention.
- Repository evidence alone sufficient: no

## EXT-PAID-DAILY-TEST
- Related: internal 1-EUR/day lifecycle issue #627
- Status: BLOCKED
- Risk: R4
- External system: real payment boundary
- Acceptance: separate explicit financial approval for exact workspace, amount and duration before payment.
- Repository evidence alone sufficient: no

## EXT-OFFSITE-DELETE
- Related: issue #658
- Status: BLOCKED
- Risk: R4
- External/destructive boundary: remote backup deletion
- Acceptance: separate explicit deletion approval plus current dry-run/target/rollback controls.
- Repository evidence alone sufficient: no

## Rules

- Never change an external status to `ACCEPTED` from code/CI alone.
- Never store tokens, credentials, payment data, private build URLs or legal document contents in this register.
- Evidence freshness applies: changed app/project/build/target can stale acceptance.
- External acceptance may close a dependency, but cannot waive Project Memory risk/quorum or existing platform confirmation requirements.
