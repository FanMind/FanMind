# FanMind External Acceptance Register

Repository implementation cannot self-close these controls. Each entry remains open until current external evidence is bound to the exact relevant account/project/build/commit/target.

Statuses: `OPEN`, `BLOCKED`, `ACCEPTED`, `NOT_REQUIRED`, `SUPERSEDED`.

## EXT-MOBILE-REDIRECT
- Related: FM-MOB-001
- Status: OPEN
- Risk: R3
- External system: Supabase Auth
- Acceptance: exact approved project allows `fanmind://reset-password`; real signed-device recovery positive/negative flow passes.
- Repository evidence alone sufficient: no

## EXT-MOBILE-EAS
- Related: FM-MOB-001
- Status: BLOCKED
- Risk: R3
- External system: Expo/EAS
- Acceptance: exact owner/project/environments validated, token access works, no Production target drift.
- Current evidence: exact `preview` run `33000433320`, job `98280538304`, on `main` `32c08ba6877d6aaaf61110c02464ee95d6bc6301` found the protected token and expected bindings blank and failed closed before public-environment verification. Owner/platform action `FM-MOB-OWNER-001` is required; no retry is authorized until configured.
- Repository evidence alone sufficient: no

## EXT-MOBILE-ANDROID
- Related: FM-MOB-001
- Status: OPEN
- Risk: R3
- External system: Android signed internal distribution / real device
- Acceptance: signed exact-commit build and private device acceptance per mobile runbook.
- Repository evidence alone sufficient: no

## EXT-MOBILE-IOS
- Related: FM-MOB-001
- Status: OPEN
- Risk: R3
- External system: Apple Developer / App Store Connect / TestFlight
- Acceptance: signed exact-commit iOS build, TestFlight and real-device acceptance.
- Repository evidence alone sufficient: no

## EXT-MOBILE-PUSH-STORE
- Related: FM-MOB-001
- Status: OPEN
- Risk: R3
- External system: Expo push + Apple/Google store portals
- Acceptance: separated push gates plus final screenshots/privacy/data-safety/store evidence from signed builds.
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
- External/protected action: controlled general Billing ledger Staging Apply/capture/reconciliation plus one current rollback-only AI lifecycle acceptance through the already applied AI ledger.
- Current evidence: FM-EV-022 verifies resources, five Test prices, the exact 22-event webhook and installed empty AI ledger read-only. Historical lifecycle acceptance predates the ledger; the general Billing ledger is absent.
- Acceptance: exact reviewed-commit Staging write freeze and ledger postflight; zero unresolved cutover state; Plus/Ultra/remove/cancel/paused/failed-payment/idempotency/order/browser-boundary paths pass; transaction fully rolls back; no Production or live payment.
- Repository evidence alone sufficient: no

## EXT-META-EVENTS
- Related: FM-META-001
- Status: OPEN
- Risk: R3
- External system: Meta Events Manager / normal browser
- Acceptance: no event before consent; exact PageView after consent/navigation; no CompleteRegistration/Lead; no PII/Advanced Matching.
- Repository evidence alone sufficient: no

## EXT-META-APP-REVIEW
- Related: FM-META-001 / FM-SOC3-001
- Status: OPEN
- Risk: R3
- External system: Meta Business/App Review
- Acceptance: required permissions/accounts approved and real Facebook/Instagram E2E passes.
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
