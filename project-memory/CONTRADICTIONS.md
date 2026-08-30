# Contradiction / Reconciliation Register

Any conflict between project memory and actual Git/PR/CI/security/workflow/runtime/target evidence is recorded here and forces `RECONCILIATION_REQUIRED` until resolved.

Statuses: `OPEN`, `RECONCILIATION_REQUIRED`, `RESOLVED`, `SUPERSEDED`.

## CTR-FM-001
- Date: 2026-08-19
- Updated: 2026-08-19
- Related task/change: FM-RST-001
- Risk: R4
- Source A: `docs/SOURCE_OF_TRUTH.md`, `AGENTS.md`, `docs/operations/RESTORE_DRILL.md`
- Claim A: repository is currently public/user-owned and must first be transferred to a future organization before the organization Restore runner group can exist.
- Source B: live GitHub repository metadata
- Claim B: repository is `FanMind/FanMind`, owner type Organization `FanMind`.
- Stronger/current evidence: live repository metadata plus the exact organization runner-group/repository/workflow-policy preflight used for successful protected read-only run `32582640853`.
- Status: RESOLVED
- Resolution/action: canonical readers now identify `FanMind/FanMind` and the exact three-workflow organization scope. Do not repeat transfer work. Treat the policy as mutable and revalidate it before every later R4 write.
- Evidence: `FANMIND_DEEP_AUDIT_2026-08-19.md`; current GitHub repo metadata; run `32582640853`; jobs `97054217701`/`97054234003`/`97054248185`; controller preflight and runner cleanup; PR #992 merge `cb04829c378285c24c3c53b5fab2d03177c19165`.

## CTR-FM-002
- Date: 2026-08-19
- Updated: 2026-08-19
- Related task/change: FM-RST-001 / issue #944
- Risk: R4
- Source A: original #944 body / older Gate-2 comments
- Claim A: ACL/default-ACL backup/restore contract and fresh Schema-2 recovery backup still need implementation/deployment/creation.
- Source B: later #944/#874 evidence and main history
- Claim B: PR #943 is merged/deployed, PG17 roundtrip is green, Worker v6 is healthy, new Schema-2 Full Backup and checksum verification succeeded.
- Stronger/current evidence: later immutable commit/run/backup evidence.
- Status: RESOLVED
- Resolution/action: keep #944 open only for real artifact-bound isolated Restore/Postcheck acceptance; do not reimplement ACL backup contract.
- Evidence: merge `14a1e2d...`, Full Backup `b74c1c60...`, Verification `006e6ab8...`.

## CTR-FM-003
- Date: 2026-08-19
- Updated: 2026-08-30
- Related task/change: FM-STG-001 / FM-MEM-009 / #642/#643/#644/#874
- Risk: R2
- Source A: older P1/referral/staging issue bodies
- Claim A: separate Staging/Supabase/Stripe/synthetic identities and broad lifecycle prerequisites are still absent.
- Source B: central finishline #874 Gate 1 and later Staging/Referral evidence
- Claim B: isolated Staging foundations and primary Staging acceptance are now recorded complete, including rollback-protected Referral/Billing lifecycle.
- Stronger/current evidence: #874 later run/commit evidence.
- Status: RESOLVED
- Resolution/action: every historical unchecked item is now mapped to exact current evidence or a named retained gate. #642/#643 remain open with genuine gaps, #644 is closed only as superseded by #874, and #874 Gate 3 preserves the Android/Google/iOS boundaries. No Staging or Referral foundation was reimplemented.
- Evidence: #874 Gate 1; exact Staging runs `31837057323` and `31895476403`; PR #1033 final head `70ea1bc61c7adefb739ba8fa3e16ea0bb84b4e58`; squash merge `cc82dd7ad62e6aaf1d7b2637d49d43010789475f`; FM-EV-032; independent post-write reads of #642/#643/#644/#874 on 2026-08-30.

## CTR-FM-004
- Date: 2026-08-19
- Updated: 2026-08-19
- Related task/change: FM-SALES-001
- Risk: R2
- Source A: historical product/sales statements that treated Phase 4 as sales release/handoff
- Claim A: sales start/handoff already follows Phase 4.
- Source B: current Source of Truth, `src/config/roadmap.ts` and #874
- Claim B: Phase 4 is production/billing base only; Phase 7 is final technical block and sales handoff requires Phase-3+Phase-7 acceptance.
- Stronger/current evidence: current code/canonical reader and later sales-handoff alignment commit.
- Status: RESOLVED
- Resolution/action: never report FanMind as technically handed over for sales until FM-SOC3-001/FM-SOC7-001 and final demo criteria pass.
- Evidence: `src/config/roadmap.ts`; commit `74c3a6aa357215c52d3a4d9b01ba8513bba1b57f`; Source of Truth.

## CTR-FM-005
- Date: 2026-08-19
- Updated: 2026-08-26
- Related task/change: FM-AI-001
- Risk: R3
- Source A: older #560/#874 checkboxes saying separate Plus/Ultra Test prices are absent.
- Claim A: Test prices still need creation.
- Source B: later Source of Truth/#874 Staging evidence
- Claim B: isolated Stripe Test catalog including Plus/Ultra is now read-only/finishline verified, while complete lifecycle/product/quality activation remains open.
- Stronger/current evidence: exact-main protected read-only AI-resource, five-price catalog and webhook runs plus direct Staging AI-ledger catalog evidence.
- Status: RESOLVED
- Resolution/action: runs `33003378162`, `33003452287` and `33003526741` prove the synthetic resource, Plus/Ultra prices, all five Test prices and exact webhook are current; FM-EV-022 records the result. Do not recreate or rerun them. Focus only on the current post-ledger lifecycle, general Billing ledger/cutover, product/private/legal/runtime/activation gaps.
- Evidence: FM-EV-022; `AI_BILLING_READONLY_RECONCILIATION_2026-08-26.md`; Source of Truth; #560/#874.

## CTR-FM-006
- Date: 2026-08-19
- Updated: 2026-08-19
- Related task/change: FM-MOB-001
- Risk: R3
- Source A: strong repository/mobile CI/build evidence
- Claim A: Mobile could appear nearly complete.
- Source B: canonical Mobile release truth
- Claim B: no signed Android/iOS real-device/store acceptance is complete.
- Stronger/current evidence: Source of Truth plus #584/#690 external acceptance lists.
- Status: RESOLVED
- Resolution/action: report code/CI and external signed/device/store states separately.
- Evidence: #584/#690, `docs/mobile/BETA_RELEASE.md`, Source of Truth.

## CTR-FM-007
- Date: 2026-08-19
- Updated: 2026-08-19
- Related task/change: FM-AI-001
- Risk: R3
- Source A: older #560 recommendation text
- Claim A: recommendation table used context limits 20/50/100 messages.
- Source B: current `src/config/aiTiers.mjs` on audited main
- Claim B: current configured context-message limits are Standard 50, Plus 100, Ultra 150; modelClass, monthlyRequestLimit and monthlyTokenLimit remain `null`; Plus/Ultra remain `Coming Soon`, `not_configured` and not automatically bookable.
- Stronger/current evidence: current executable policy code.
- Status: RESOLVED
- Resolution/action: never reintroduce the older context recommendation as current configuration. Product decisions for model/request/token/overage still remain open and must be recorded separately before activation.
- Evidence: `src/config/aiTiers.mjs` at audited main.

## CTR-FM-008
- Date: 2026-08-19
- Updated: 2026-08-19
- Related task/change: FM-STG-001
- Risk: R2
- Source A: current `src/config/roadmap.ts` Phase-5 line
- Claim A: production/test-data separation is `partial` with external resources open.
- Source B: later central finishline #874 Gate 1
- Claim B: separate Supabase Staging, Web Staging, Stripe Test resources, synthetic workspaces/users and primary Staging acceptance are now recorded complete.
- Stronger/current evidence: later Gate-1 run/commit evidence; roadmap UI may intentionally be conservative but is no longer sufficient as exact operational status.
- Status: RECONCILIATION_REQUIRED
- Resolution/action: before next roadmap/public-truth update, determine whether Phase-5 wording should be advanced without overstating the still-open feature-specific external gates. Do not rebuild Staging merely because roadmap UI remains conservative.
- Evidence: `src/config/roadmap.ts`; #874 Gate 1; deep audit.

## CTR-FM-009
- Date: 2026-08-20
- Updated: 2026-08-26
- Related task/change: FM-SEC-001 / issue #982
- Risk: R3
- Source A: current repository controlled Production hardening SQL/runbook
- Claim A: code exists to pin the three trigger helper search paths and revoke direct browser execution of the optional retired retention function, but the runbook explicitly says merge/deploy does not auto-apply this Production database mutation.
- Source B: fresh live Production Supabase security advisors
- Claim B: the three mutable-search-path warnings and both browser-execution warnings for `trim_conversation_messages_to_latest_50()` are still present; leaked-password protection is also disabled.
- Stronger/current evidence: protected exact-release read-only run `32997946812` proves both claims are compatible: the implementation is deployed but the database hardening is not applied. Preflight/postflight Production audits passed; the fixed database diagnostic was `hardening_not_ready`; fresh advisors remained unchanged.
- Status: RESOLVED
- Resolution/action: preserve the now-proven implementation/live-state distinction. Use only the separately protected controlled Apply when explicitly authorized under `FM-SEC-OWNER-001`, then postflight and re-scan advisors. Keep leaked-password settings and Staging exception acceptance separate under `FM-SEC-OWNER-002`. Do not invent browser RLS policies for intentional service-only tables.
- Evidence: FM-EV-019/FM-EV-020; run `32997946812`, job `98271985321`; fresh post-run Production advisor scan; `supabase/controlled/20260806203023_harden_trigger_function_privileges.sql`; `docs/operations/TRIGGER_FUNCTION_HARDENING_PRODUCTION.md`.
- Falsification question: What observation would prove our conclusion wrong? A fresh catalog/ACL/advisor read showing the live Production state is already hardened, or evidence that the deployed target no longer matches the controlled migration/runbook, would invalidate this reconciliation before mutation.

## CTR-FM-010
- Date: 2026-08-22
- Updated: 2026-08-23
- Related task/change: FM-RST-001
- Risk: R4
- Source A: successful protected read-only run `32582640853` and `RESTORE_TARGET_COMPATIBILITY=PASS`.
- Claim A: the isolated target satisfies the minimal PostgreSQL 17/roles/`pgcrypto` readiness contract and is safe to inspect over TLS `verify-full` with writes disabled.
- Source B: protected database run `32594374666` and independent read-only reconciliation.
- Claim B: the same empty target fails the selected receipt's larger authorization contract because only 2/5 exact extensions are present.
- Stronger/current evidence: both sources are valid at different contract layers; the later receipt-bound preflight is authoritative for database-Restore eligibility.
- Status: RESOLVED
- Resolution/action: preserve baseline `TARGET_COMPATIBLE`; separately authorized extension-only provisioning and unchanged receipt-bound postchecks passed at the exact 97-record extension and canonical ACL fingerprints. The first unproven transition is now the separately authorized database Restore, not extension provisioning.
- Evidence: runs `32582640853` and `32594374666`; jobs `97054248185` and `97082992861`; issue #944 comments `5382274967`/`5382336892`/`5385843508`; FM-EV-015/FM-EV-016/FM-EV-017.
- Falsification question: What observation would prove this conclusion wrong? A current read-only full receipt authorization matching the exact five-extension/97-record fingerprint would close the blocker; any evidence of a target write would invalidate the current no-write reconciliation.

## CTR-FM-011
- Date: 2026-08-26
- Updated: 2026-08-26
- Related task/change: FM-META-001 / issue #714
- Risk: R3
- Source A: `docs/analytics/META_PIXEL.md` pre-activation checklist.
- Claim A: Production ENV, build/deploy and technical activation still need to occur before external acceptance.
- Source B: FM-EV-007 and issue #714.
- Claim B: the consent-gated parameterless PageView-only technical Production path is already confirmed; only external Events Manager/provider/no-PII/legal acceptance remains.
- Stronger/current evidence: FM-EV-007 plus FM-EV-023 exact-main repository/Staging read-only countercheck; issue #714 records the Production technical result.
- Status: RESOLVED
- Resolution/action: update the runbook to treat Production ENV/build/deploy as completed technical foundation and prevent accidental repetition. Keep normal-browser Events Manager/Test Events, provider-side no-PII/no-unexpected-conversion observation, App Review/real provider E2E and legal acceptance explicitly open under `FM-META-OWNER-001`.
- Evidence: FM-EV-007; FM-EV-023; `META_TECHNICAL_READONLY_RECONCILIATION_2026-08-26.md`; issue #714; runs `33007156552`, `33007311870`, `33007481167`.
- Falsification question: What observation would prove our conclusion wrong? A current exact Production configuration/release check showing the Pixel path is no longer deployed or fail-closed would require a fresh technical reconciliation before external acceptance.

## CTR-FM-012
- Date: 2026-08-26
- Updated: 2026-08-26
- Related task/change: FM-META-001 / issue #714
- Risk: R3
- Source A: pre-closeout `docs/SOURCE_OF_TRUTH.md` and `docs/integrations/META_CONTENT_INTELLIGENCE.md`.
- Claim A: the conversation-continuation migration is unapplied in Staging, and the catch-up queue migration is only prepared with its external migration path still open.
- Source B: FM-EV-023 direct catalog metadata plus exact-main protected read-only runs `33007311870` and `33007481167`.
- Claim B: continuation columns and queue table/index/functions are already present in isolated Staging with the expected read-only postflight boundaries; Apply was not requested during the evidence runs. Worker/analysis activation, synthetic queue acceptance, provider E2E and Production remain open.
- Stronger/current evidence: point-in-time catalog and protected workflow evidence on 2026-08-26, tracked as mutable `EV-META-STAGING-FOUNDATION-20260826`.
- Status: RESOLVED
- Resolution/action: synchronize canonical readers to the observed-present Staging objects without claiming historical Apply, worker, acceptance, provider or Production completion. The ledger-managed continuation timestamp was not proven by FM-EV-023; the controlled catch-up queue is intentionally absent from the Supabase migration ledger. After freshness expiry/invalidation or before another Meta Staging database action, use a new lock and fresh same-commit/same-target shared rollout state: combine the continuation ledger timestamp with its objects and classify the queue through its complete ledger-free postflight.
- Evidence: FM-EV-023; `EV-META-STAGING-FOUNDATION-20260826`; #1014 final head `12a479f00cce95d0031970c98c2d3933477ab804`, merge `ec1f196e82ab64a3b39b69a22a7b81b0757aa7a4`; runs `33007311870` and `33007481167`.
- Falsification question: What observation would prove our conclusion wrong? A fresh shared rollout-state result showing absent, partial or drifted continuation/queue objects invalidates the current-state claim and blocks every later database action until separately reconciled.

## CTR-FM-013
- Date: 2026-08-29
- Updated: 2026-08-29
- Related task/change: FM-MOB-002 / FM-CR-002
- Risk: R3
- Source A: authenticated Android contact-detail screenshots from the installed preview.
- Claim A: demo contacts are present, but no stored conversation history is visible.
- Source B: bounded authenticated Staging observation and Mobile source inspection.
- Claim B: 37 demo conversation messages already exist for the 13 demo contacts; the previous Mobile contact detail never queried or rendered `conversation_messages`.
- Stronger/current evidence: data observation plus exact source control flow identify a presentation omission rather than missing storage or permissions.
- Status: RESOLVED
- Resolution/action: #1019 adds an RLS-protected workspace/contact query and visible read-only history. Do not duplicate rows or alter RLS. Final acceptance remains pending a replacement exact-commit Android build and owner device confirmation.
- Evidence: FM-EV-024; PR #1019; owner screenshots; local Mobile tests and exports.
- Falsification question: What observation would prove our conclusion wrong? If the replacement exact-commit build still shows an empty history while an authenticated query for that same workspace/contact returns rows, the query/model mapping or runtime project binding must be reopened before any database mutation.

## CTR-FM-014
- Date: 2026-08-29
- Updated: 2026-08-29
- Related task/change: FM-MOB-003 / FM-CR-003
- Risk: R3
- Source A: the installed Mobile Start page and shared `BrandMark` component.
- Claim A: a decorative node symbol represents FanMind and the Start page should primarily explain the app and show generic contact KPIs.
- Source B: the owner's explicit screenshot correction and workflow request.
- Claim B: that symbol is not the FanMind logo and must be absent; Start is the operational inbox and must list only fans with unseen inbound messages.
- Stronger/current evidence: the owner's direct product decision plus the established Web `seen_at` semantics.
- Status: RESOLVED
- Resolution/action: remove the decorative symbol globally without inventing a replacement asset, keep the FanMind text wordmark where a brand label is still needed, and make the authenticated Start page an unseen-inbound fan queue. Do not restore the symbol from old screenshots or generic mockup copy.
- Evidence: FM-EV-025; FM-CR-003; owner screenshot dated 2026-08-29; source/test proof of absence.
- Falsification question: What observation would prove our conclusion wrong? A current owner-approved brand asset specifying that exact symbol, or an exact replacement build still rendering it, would reopen the visual correction.

## CTR-FM-015
- Date: 2026-08-29
- Updated: 2026-08-29
- Related task/change: FM-MOB-001 / FM-MOB-003
- Risk: R3
- Source A: the older Mobile external/dependency/deferred registers.
- Claim A: the protected `mobile-preview` Expo token and EAS/Supabase/API bindings are blank, so no retry or signed Preview build is authorized.
- Source B: current protected GitHub/EAS evidence.
- Claim B: the exact EAS project and Preview environment are now verified; protected run `33260695232`, job `99122008690`, successfully completed one exact-merge signed Android internal artifact with cleanup.
- Stronger/current evidence: the later exact-commit protected workflow and verified EAS artifact supersede the historical fail-closed blocker without erasing it.
- Status: RESOLVED
- Resolution/action: mark the Preview resource configuration accepted and the old owner-configuration action resolved. Keep Android device, Recovery redirect, iOS/TestFlight, push and Store acceptance open; do not infer them from one successful Android build.
- Evidence: FM-EV-025; run `33260695232`; job `99122008690`; merge `93496a4afac9b3b315c9985afbbce02b8524fc44`.
- Falsification question: What observation would prove our conclusion wrong? A current protected read-only resource check showing project/environment/target drift, or an artifact not bound to the recorded commit/profile/platform, would invalidate the accepted Preview-resource state.

## CTR-FM-016
- Date: 2026-08-30
- Updated: 2026-08-30
- Related task/change: FM-MOB-001 / FM-CR-006
- Risk: R3
- Source A: the pre-build Mobile documentation and Project Memory handoff state.
- Claim A: Production EAS readiness, Signing Credentials and the first Android Store AAB remain externally open and the Store workflow is only prepared.
- Source B: current protected GitHub/EAS completion evidence and the live Google Play account state.
- Claim B: Production readiness run `33316105624` / job `99269748215` passed on exact merge `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00`; Store-build run `33316172583` / job `99269924756` then completed and terminally verified exactly one Android `1.0.0` AAB with Submit/Update disabled. Google account review, not an absent AAB, currently prevents app creation and upload.
- Stronger/current evidence: the later exact-commit protected workflow logs and terminal artifact verification supersede the pre-build handoff without implying Play acceptance or publication.
- Status: RESOLVED
- Resolution/action: register FM-EV-028 and the redacted execution receipt, reconcile Mobile canonical docs and operational registers, preserve the existing AAB and continue only with the separate Recovery/device and Play-portal controls. Do not queue a second AAB merely to resume portal work.
- Evidence: FM-EV-028; protected runs `33316105624` and `33316172583`; jobs `99269748215` and `99269924756`; live Google Play Console observation dated 2026-08-30.
- Falsification question: What observation would prove our conclusion wrong? A protected EAS record showing that the terminal artifact belongs to another commit/platform/profile, is not an AAB, or is no longer retrievable would invalidate the accepted Store-build state and require a new exact authorization rather than an automatic retry.

Never resolve a contradiction by deleting the older record. Document which source was stale or wrong and why.
