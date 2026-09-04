# Started Work Register

Canonical register for FanMind work that has started but is not yet fully completed.

## FM-MOB-006
- Started: 2026-09-03 Europe/Vienna
- Updated: 2026-09-04
- Status: ACCEPTED
- Risk: R3
- Change request: FM-CR-013
- Scope: dormant atomic Mobile Push Delivery-Ledger foundation and isolated-Staging rollback-only acceptance; no Production mutation, delivery activation or build.
- Work lock: `LOCK-FM-MOB-006-DELIVERY-LEDGER-20260903` RELEASED after repository implementation/countercheck.
- Completed result: controlled ledger SQL, server-only adapter, checksum runner, atomic reservation/lease/revocation contract, protected resource readiness, checksum-bound isolated-Staging applies, independent postflight and both rollback-only acceptance paths are complete. After safe SQLSTATE `2201B` identified an invalid bounded receipt-ID expression, exact commit `18a6ad79cb72331b4daa41ee87dd2430a8ffd473` corrected the constraint. Apply run `33867831888` / job `101006621418` and final Delivery-Ledger acceptance run `33867922978` / job `101006906941` passed with provider delivery disabled, synthetic rows, complete rollback and cleanup.
- Still open: nothing under FM-MOB-006. A handler-containing signed Android build and real provider/device delivery evidence remain separate under FM-MOB-001.
- Exact next step: prepare one separately reviewed signed Android build containing the merged message handler, then require separate authorization for real-device/provider acceptance. Keep the 12-tester/14-day Play cohort deferred until Gerhard handoff readiness.
- Owner action needed: yes for the new signed build and any real provider/device action.

## Rules
- Add an entry as soon as substantive work begins.
- Every active `IN_PROGRESS`, `PARTIAL`, `BLOCKED`, `IMPLEMENTED_NOT_VERIFIED` or `RECONCILIATION_REQUIRED` task must appear here until closed or superseded.
- Assign `Risk: R1|R2|R3|R4` before implementation continues.
- Never delete history; close with status, date, result, evidence and next step.
- Cross-link Task ID, Change Request, PR/branch, dependencies, work lock and execution receipt.

## Active work

## FM-MEM-009
- Started: 2026-08-30
- Updated: 2026-08-30
- Status: ACCEPTED
- Risk: R2
- Scope: Reconcile legacy Staging/Referral issues #642/#643/#644 against immutable current Staging evidence and the active #874 finishline without reimplementing completed work or closing genuine external/negative-test gates.
- Change request: FM-CR-008.
- Branch/PR: `ops/legacy-issue-reconciliation-20260830` / #1033; final exact head `70ea1bc61c7adefb739ba8fa3e16ea0bb84b4e58`, squash merge `cc82dd7ad62e6aaf1d7b2637d49d43010789475f`.
- Work lock: `LOCK-FM-MEM-009-LEGACY-ISSUES-20260830` RELEASED.
- Dependencies: accepted STAGING_ACCEPTED milestone, exact successful Staging runs `31837057323` and `31895476403`, current #874 body, and repository tests/runbooks that define the proved boundaries.
- Assumptions: an unchecked historical issue item is not proof that implementation is absent; conversely, a later umbrella statement cannot close a specific negative/external control without matching evidence.
- Planned evidence: machine-readable issue map, deterministic human rendering, positive and negative validator tests, Project Memory/truth/drift checks, exact-head PR gates, and post-merge issue-body/state reconciliation.
- Completed result: current issue bodies, immutable workflow run/job results and the accepted Staging milestone were read-only crosschecked. The canonical machine/human reconciliation, validator and regression coverage are implemented. Focused tests pass 10/10, Operations pass 1073/1073, all local governance/truth checks pass, and PR #1033 final head `70ea1bc61c7adefb739ba8fa3e16ea0bb84b4e58` passed all 11 remote checks plus completed review with zero unresolved threads before merge `cc82dd7ad62e6aaf1d7b2637d49d43010789475f`. #642/#643 were independently re-read open with only genuine gates, #644 was re-read closed as superseded by #874, and #874 Gate 3 now preserves the verified Android AAB/Google/iOS boundaries.
- Still open: nothing under FM-MEM-009. The retained Referral/Staging/Mobile/Restore/AI/provider/legal gates remain owned by their canonical tasks and were not accepted here.
- Exact next step: keep FM-MEM-009 closed; continue only from a canonical retained gate and never rebuild the Staging foundation or Android AAB merely because an old issue was reconciled.
- Rollback/recovery: revert the governance-only commit and restore prior issue metadata if the post-merge write is inconsistent; no product/runtime/provider/database state is involved.
- Owner action needed: none for repository/issue reconciliation; retained legal, Production activation, payment and protected external gates stay owner-controlled.

## FM-MOB-004
- Started: 2026-08-29
- Updated: 2026-08-30
- Status: ACCEPTED
- Risk: R3
- Scope: Deliver the owner-requested three-section fan detail, one-line identifier, safe Mobile fan analysis, fan-bound Follow-up navigation, today's Dashboard Follow-ups and corrected square native splash; then produce one exact-merge Android preview.
- Change request: FM-CR-005.
- Branch/PR: `feat/mobile-fan-sections-analysis-followups-splash-20260829` / #1025; final exact head `64329ac628188cf532281ddb742058612b9e9eb8`, squash merge `6a2f5b6c9bac1607ecc2ccae11c6ade3cb418522`.
- Work lock: `LOCK-FM-MOB-004-FAN-SECTIONS-20260829` RELEASED.
- Dependencies: existing RLS and Mobile Bearer authorization, server-side analysis action/capability gates, exact-head CI and one protected Android preview build.
- Assumptions: stored Fan-analysis reports remain read-only and are displayed only with source period, sample size, confidence and review state. Production generation remains hidden/in preparation until the Workspace analysis/privacy contract is technically active and verified. Follow-up navigation carries only the contact ID and selected section.
- Planned evidence: Mobile typecheck/Expo/native checks, focused authorization/UI tests, full repository regression, exact-head PR gates, SHA-bound merge and exactly one merged-commit Android preview.
- Completed so far: initial implementation/docs and local checks passed. Eleven successive exact-head reviews found six, four, six, three, three, three, two, one, two, two and three valid cases, thirty-five in total. The first three corrections added provenance, semantic statuses/counting, fail-closed Mobile/Web/legacy behavior, priority-before-cap pagination and section-specific errors. Review four added the final unknown/null-priority group, an exact/truncated per-contact Follow-up result and low confidence for generic fallback-only analysis. Review five added legacy `NULL` status as open, complete stable 200-row pagination for the central Follow-up list and a hard no-write/no-provider boundary without a valid analysis source period. Review six added service-failure precedence for capability reads, conclusion hiding for rejected reports and timestamp-valid-only provider/provenance samples. Review seven made the explicit Bearer path owner-only and gated the Mobile analysis empty state after load failures. Review eight prevents Web from showing a false empty state beside a saved report hidden for incomplete provenance or a load error. Review nine excludes rejected/incomplete reports from productive reply prompts and refreshes die zentrale Follow-up-Liste on focus. Review ten binds the Web control to the server capability status and parallelizes the six fail-closed legacy column probes. Review eleven also binds that Web control to the active-processing entitlement, suppresses an unknown Dashboard count after read failure and verifies the complete report schema before provider use. The eleventh full local countercheck is green: 42 focused checks, 1055 operations tests, root TypeScript/lint/build, Mobile typecheck/Expo Doctor 20/20/Store/boundary/native prebuild, Android/iOS exports and all Project Memory/truth/drift gates passed. All fixes are grouped without schema, row, provider or Production mutation.
- Verified result: final PR head `64329ac628188cf532281ddb742058612b9e9eb8` passed all nine exact-head gates with no unresolved review thread and merged as `6a2f5b6c9bac1607ecc2ccae11c6ade3cb418522`. Protected run `33298699290`, job `99222705186`, completed exactly one `preview` Android internal build for that merge, verified the HTTPS APK artifact, stored the redacted receipt and cleaned temporary state. Submit and Update remained disabled.
- Accepted result: on 2026-08-30 the owner installed and inspected the exact-merge Android Preview on a real device and confirmed the current Mobile result as finished. This accepts the three fan sections, one-line identifier, Follow-up navigation/today list, safe analysis preparation state and corrected square splash without a rebuild.
- Still open: nothing under FM-MOB-004. The real Recovery flow plus applicable Push/Store acceptance remain separate under FM-MOB-001; the exact Production Supabase redirect is now saved and iOS/TestFlight remains Phase 8.
- Exact next step: keep FM-MOB-004 closed. Open a new bounded task only for a newly observed device defect; do not rebuild merely to repeat acceptance.
- Rollback/recovery: revert the Mobile/API commit; no database migration or destructive action is part of this change.

## FM-MOB-003
- Started: 2026-08-29
- Updated: 2026-08-29
- Status: ACCEPTED
- Risk: R3
- Scope: Turn the Mobile start screen into a real unseen-inbound dashboard without the owner's rejected placeholder icon, add a dynamic per-contact message-channel switch for every fan, and allow owners to create a manual Follow-up directly in the contact detail; then deliver one exact-commit Android preview for owner verification.
- Change request: FM-CR-003.
- Branch/PR: `feat/mobile-fan-inbox-channel-followup-20260829` / #1021; final head `c4baed86bdcfd389a1f8ff5ce7752407113fb734`, squash merge `93496a4afac9b3b315c9985afbbce02b8524fc44`.
- Work lock: `LOCK-FM-MOB-003-FAN-INBOX-20260829` RELEASED.
- Dependencies: existing RLS-protected `conversation_messages.seen_at` and `followups` contracts; FM-DEP-002 for the replacement signed Android preview; exact-head CI and owner device confirmation.
- Assumptions: unseen means an inbound message with `seen_at is null`; opening a contact may mark its unseen inbound messages as seen only through the existing Workspace-bound authenticated mutation. Channel options must be derived from that fan's stored messages and support unknown future platform names.
- Planned evidence: pure-policy tests for channel filtering and Follow-up validation; bounded dashboard/query tests; TypeScript/Expo/native checks; full repository regression; exact-head PR checks; one merged-commit Android preview and owner device confirmation.
- Completed result: the Mobile start screen now lists only fans with inbound `seen_at is null` messages; contact history offers `Alle` plus every stored platform for that fan; owners can create a validated manual Follow-up directly in the contact detail; and the rejected decorative icon is absent from both Start and the shared wordmark. TypeScript, Expo Doctor, Store/native boundary checks, Android/iOS prebuild and exports, root truth/lint, 48 focused Mobile/security tests and the complete 1054-test operations suite passed locally.
- Verified result: PR #1021 final head passed all eight exact-head GitHub gates and merged as `93496a4afac9b3b315c9985afbbce02b8524fc44`. Protected signed-build run `33260695232`, job `99122008690`, completed exactly one `preview` Android internal build for that merge, verified the HTTPS artifact, stored the redacted receipt and cleaned temporary state; Submit and Update remained disabled.
- Accepted result: FM-EV-027 binds the owner's 2026-08-30 bounded real-device acceptance to the superseding FM-MOB-004 exact-merge Preview and confirms the unseen inbox, per-fan channel tabs, direct Follow-up and absence of the rejected symbol.
- Still open: nothing under FM-MOB-003. Broader Recovery/Purge, push and Store acceptance remain separate under FM-MOB-001; iOS/TestFlight remains Phase 8.
- Exact next step: keep FM-MOB-003 closed; do not rebuild merely to repeat acceptance.
- Rollback/recovery: revert the Mobile UI/data-policy commit. Marking messages seen uses the already accepted product field and is not automatically reversible; no message content, Follow-up history, schema or provider state may be deleted.

## FM-MOB-002
- Started: 2026-08-29
- Updated: 2026-08-29
- Status: ACCEPTED
- Risk: R3
- Scope: Expose the existing RLS-protected `conversation_messages` for each demo contact as a visible read-only newest-first conversation history in Mobile, then produce a replacement signed Android internal build for owner verification.
- Change request: FM-CR-002.
- Branch/PR: `fix/mobile-contact-message-history-20260829` / #1019; implementation head before Project Memory reconciliation `d7bb661d4ed2ed74b656c0ee2d822cb7396d5a8a`.
- Work lock: `LOCK-FM-MOB-002-CONTACT-HISTORY-20260829` RELEASED.
- Dependencies: FM-DEP-002; existing Staging demo workspace/contact/message rows; exact Supabase/RLS binding; current Expo SDK 57 patch contract; exact-head CI; Android preview signing/build path.
- Assumptions: ASM-FM-005 remains binding. The authenticated owner screenshots prove that the previous Android build can log in and render contact details, but they do not prove this new message-history change or complete the remaining iOS/store acceptance.
- Completed result: PR #1019 passed its final exact-head repository and native gates and merged as `ef0b7210c997558759a80c5ff46a7a5a0c005c3b`. Protected signed-build run `33254230496` produced a receipt-bound exact-commit Android preview; the owner's next Mobile observation confirmed that messages are visible and isolated the follow-on absence of channel switching.
- Still open: broader FM-MOB-001 iOS/TestFlight/store/push and complete external acceptance remain separate; the new bounded Mobile request is FM-MOB-003.
- Evidence so far: FM-EV-024; PR #1019; local 2026-08-29 checks; authenticated Android screenshots supplied by the owner; existing database observation of 13 demo contacts and 37 stored conversation messages.
- Exact next step: continue only through FM-MOB-003; do not reopen #1019 or duplicate the stored demo messages.
- Rollback/recovery: revert the bounded Mobile UI/data-query commit; no database schema or row mutation is part of the implementation. The previous signed APK remains available to the owner until the replacement is accepted.
- Owner action needed: only final installation/device confirmation after the new build is produced.

## FM-RST-001
- Started: 2026-08-17
- Updated: 2026-08-26
- Status: PARTIAL
- Risk: R4
- Scope: Complete the isolated real FanMind Restore drill without touching Production or Supabase Staging; preserve the accepted read-only chain and the now receipt-bound five-extension baseline while keeping every later Restore transition separately protected.
- Branch/PR: SSH-timeout reconciliation PR #1005 exact head `9ce6c0746fa61072eb507bce6d511f952a42b8e8` merged as `dd9d986c387040b213355e0ba1bf60ce31fa7b32`; extension evidence PR #997 merged as `733e2f12464f746ee5dff0be71defe22d18ce33a`; prior fail-closed evidence PR #995 merged as `86bf2657996c45bfe03fadd4af689ffa89e7ea6e`.
- Work lock: no active Restore repository lock; `LOCK-FM-RST-001-SSH-TIMEOUT-RECONCILIATION-20260826` and the prior extension evidence lock are RELEASED. The runtime task remains owner-blocked at `FM-RST-OWNER-005`.
- Dependencies: FM-DEP-001; exact Schema-2 Full Backup/Verification/source binding; existing isolated host/empty target/quarantine; full receipt-bound roles/database-container/extensions; protected authorization for any later mutation.
- Assumptions: database reset does not change cluster-global roles; prior full role/container authorization success remains navigation evidence only and must be freshly receipt-checked after extension provisioning. Mutable host, target, backup, runner-policy and TLS evidence must be revalidated before any mutation.
- Completed so far: protected read-only run `32582640853` accepted through `TARGET_COMPATIBLE`. Exactly authorized database run `32594374666` failed closed before its first target write. The separately authorized final extension controller on `main` `c627fc2d8956768091c88e3a3baaf0b882b8d2d6` then committed only the three missing extensions and proven member-owner correction. Its precommit contract, mutation commit, full receipt contract, canonical schema-ACL postcheck and independent postcommit read-only postcheck all passed.
- Latest reconciled result: the isolated target now matches all five required extension descriptors. Extension fingerprint is exactly `6704956613ca8e58a527336d67b622a043e48a568858873ca5a6fa6b8bd08012` over 97 records; schema-ACL fingerprint is exactly `abedaf76740b6a7fc1e53433a41337a2f8248d79abfac4ac22c9cf835a1373e3`. The Full Backup, Verification, Source commit and reset receipt bindings remained exact. No database Restore, target reset, JIT/workflow dispatch, Production write or Supabase-Staging write occurred.
- Latest attempt: owner authorization comment `5385992305` produced controller SHA-256 `45054c41143e33fce4406aea30478e43ed5280a36e1b339d0cc9c38df71ae946`. On 2026-08-26 it passed only the accepted-readiness and main-drift markers, then its first SSH connection to `138.124.213.66:22` timed out. Source order and live GitHub evidence prove no remote preflight, JIT, environment approval, workflow dispatch or database connection occurred.
- Still open: owner-PC public-IP/TCP-22 evidence, possible separately authorized Exoscale `/32` allowlist reconciliation, a new exact protected database Restore after fresh mutable preflight, DB postcheck, Storage, server config, disposable-target cleanup, independent countercheck and final acceptance.
- Evidence so far: PRs #943/#987/#990/#991/#992/#997/#998/#1005; issue #944 comments `5381530143`, `5382274967`, `5382336892`, `5385843508`, `5385992305`, `5386014235`, `5428771745`; runs `32582640853` and `32594374666`; final extension controller PASS; exact failed database controller output supplied by the owner on 2026-08-26.
- Exact next step: do not rerun controller `45054c41...`. Capture the Windows public IP and detailed TCP-22 result; reconcile Exoscale SSH allowlisting only if that evidence confirms drift. Then require a new exact R4 Restore authorization and freshly generated controller.
- Owner action needed: yes, first for `FM-RST-OWNER-005` connectivity evidence and, only after reconciliation, `FM-RST-OWNER-006` new exact protected database-Restore authorization.
## FM-MOB-001
- Started: before 2026-08-19
- Updated: 2026-09-04 (one exact handler-containing Android Preview finished; device acceptance pending)
- Status: IMPLEMENTED_NOT_VERIFIED
- Risk: R3
- Scope: Signed Android/iOS Mobile release and real-device/store acceptance; the merged repository implementation now binds both read-only resource readiness and the separately protected signed-build path to the exact remote EAS project record.
- Branch/PR: App Store Connect worksheet PR #1037 final head `88b9299f9612e344a9c0c48d78f86f11d071db6c` merged as `a16e28f6e1aa0a2d7ff81bd679b472fab7563500`; dual-store PR #1031 final head `a963ab598eeb0a7ab84110e55cb4043d4230e550` merged as `3082490451dd45b5127bdf9d9ae55b4712255b72`; Android handoff PR #1030 and Store implementation PR #1028 are merged; earlier read-only evidence PR #1010 final exact head `15fca01adae6f4934c7b729512a14b8ccc926383`, squash merge `e6b3d9715726ede77ce7230cefa824edba16b2d4`; repository binding PR #988 merged as `e20efd475e475101226f266118b9cfed7972243a`.
- Work lock: `LOCK-FM-MOB-001-ANDROID-STORE-20260830` is ACTIVE for the explicitly resumed Android Production/Google Play continuation. Earlier Preview and bounded FM-MOB-004 locks remain RELEASED.
- Dependencies: the bounded FM-MOB-003/FM-MOB-004 real-device UI/runtime observation and exact Production Supabase redirect are complete; the full receipt-bound 19-check Android runbook/private validator and real Recovery flow now wait for Play-test-track installation. iOS build/signing/TestFlight/device evidence remains Phase 8, while repository-only App Store preparation is authorized.
- Assumptions: repository CI/build evidence does not prove a signed device build; a successful EAS lookup alone does not prove that the returned owner, slug and project ID match the protected FanMind binding.
- Completed so far: native app core, auth/recovery, SecureStore/Purge, contacts/knowledge/AI/followups, offline cache, push foundation, icon/splash/privacy/store metadata and CI/control workflows. PR #988 added a bounded verifier for the redacted `eas project:info` report, rejects owner/slug/ID drift and unsafe report files, wires it before both read-only readiness and any signed internal build queue, and exercises parser plus workflow wiring through positive and negative CI self-tests. Exact head `6f42a5897aabb3387a74149010dee2b5fb2c92cd` passed Project Memory Guard/Quality/Status, FanMind CI, Landing Language CI, Supply Chain Security, CodeQL and Browser E2E before merge `e20efd475e475101226f266118b9cfed7972243a`. On 2026-08-26 all five historical resource-readiness jobs were reconciled: development job `91521865376`, preview jobs `91521865677`/`93228923133`/`95410943740` and production job `91521871719` all had blank `EXPO_TOKEN` plus all four expected binding variables and failed closed with `eas_project_lookup_failed` before public-environment verification. The latest was 2026-08-17 and predates #988.
- Latest result: protected `preview` run `33298699290`, job `99222705186`, on exact merge `6a2f5b6c9bac1607ecc2ccae11c6ade3cb418522` reverified the EAS project/public Preview environment and completed exactly one signed Android internal artifact with exact-commit HTTPS artifact verification, redacted receipt and cleanup. Submit/Update/Production remained disabled.
- Accepted Android result: on 2026-08-30 the owner installed and inspected the exact FM-MOB-004 Android Preview on a real device and confirmed the bounded FM-MOB-003/FM-MOB-004 UI/runtime result as finished.
- Current continuation: owner explicitly requested the accepted Android app be finished, bound to FanMind Production and taken to Google Play. PR #1028 passed ten exact-head gates and merged as `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00`. Protected Production readiness run `33316105624` / job `99269748215` then passed without writes. Protected Store-build run `33316172583` / job `99269924756` completed exactly one Android `production` AAB for the same commit, verified the terminal artifact, retained only a redacted receipt, purged temporary state and kept Submit/Update disabled.
- External observation: the FanMind Production and Staging Supabase projects are active/healthy. After separate owner confirmation, `fanmind://reset-password` was saved and re-read as the fourth exact Production Auth redirect on 2026-08-30. On 2026-09-03 the verified Android `1.0.0` AAB was published in the closed Google Play Alpha track for Germany, Austria and Switzerland; this is not public Production access.
- Completed repository continuation: FM-EV-031 adds the deployed public Support route, reproducible 512×512 Play icon and 1024×500 feature graphic, Apple metadata/review/tester/screenshot handoff and updated Store checks. PR #1031 passed all exact-head gates and merged as `3082490451dd45b5127bdf9d9ae55b4712255b72`; post-merge deploy/readiness/audit checks and live `/support` verification passed. It queued no build and performed no portal/provider write.
- Accepted repository continuation: FM-EV-034 adds a single machine-checked App Store Connect worksheet covering 33 first-release portal fields: thirteen technical values are ready, twelve need owner/legal/account decisions and eight remain Phase-8 binary/device controls. PR #1037 final head `88b9299f9612e344a9c0c48d78f86f11d071db6c` passed all eight exact-head workflows and completed final review with no major issue and zero unresolved threads, then squash-merged as `a16e28f6e1aa0a2d7ff81bd679b472fab7563500`. No Mobile build, TestFlight, portal write or Android-AAB replacement occurred.
- Current build attempt: after FM-MOB-006 isolated-Staging acceptance, run `33868661986` / job `101009217307` queued exactly one signed Android `preview` internal build for exact commit `700885307c265f8907cefe5f5b10499a5ea7b996`. All resource/binding/one-build preflights passed. GitHub failed closed after `53m 28s` because the free-tier queue exceeded its polling window; no retry was queued and no success receipt was stored. Authenticated read-only EAS inspection on 2026-09-04 later proved that the same build finished successfully for the exact commit/profile, internal distribution, version `1.0.0 (2)`, with an APK artifact. Submit and OTA Update remained disabled.
- Still open: the deliberately deferred closed-test cohort of at least 12 opted-in testers for at least 14 days, the complete private Android 19-check/Recovery proof and real screenshots from the Play installation, and the later Production-access request. Apple Developer/App Store Connect, signed iOS build, TestFlight, real screenshots and device acceptance remain Phase 8.
- Evidence so far: issues #584/#690, Source of Truth, mobile docs/tests, PRs #988/#1019/#1021/#1025/#1028/#1030/#1031/#1037, preview run `33298699290` / job `99222705186`, Production readiness run `33316105624` / job `99269748215`, Store-build run `33316172583` / job `99269924756`, FM-EV-021/FM-EV-024/FM-EV-025/FM-EV-026/FM-EV-027/FM-EV-028/FM-EV-029/FM-EV-030/FM-EV-031/FM-EV-034 and the Mobile receipts.
- Exact next step: do not requeue. Install the exact existing handler-containing APK and perform the bounded Android observation; keep real provider/device Push delivery separately authorized. The missing automated receipt means the complete private 19-check acceptance is not yet claimable from this build. When FanMind is ready for the Gerhard handoff, enroll at least 12 approved Alpha testers, keep the test active for at least 14 days and complete the private Android/Recovery acceptance before requesting Production access.
- Owner action needed: the private Android runbook/validator and separate recovery/Push/Store external controls only.

## FM-AI-001
- Started: before 2026-08-19
- Updated: 2026-08-30
- Status: PARTIAL
- Risk: R3
- Scope: KI Standard/Plus/Ultra product, quality, cost, Stripe lifecycle and activation readiness.
- Branch/PR: read-only evidence PR #1012 passed all 10 checks at exact head `b53e000228bf99801b327c1d7b81646edce32d6f` and squash-merged as `d1b9d7e94b3bc78a1720e197a795a105bdcc1883`; implementation foundations remain on `main`.
- Work lock: `LOCK-FM-AI-001-STRIPE-CONFORMANCE-20260830` is RELEASED after #1035 exact-head acceptance and merge; the older `LOCK-FM-AI-001-READONLY-RECONCILIATION-20260826` remains RELEASED and its three evidence jobs must not be rerun.
- Dependencies: written product decisions, private quality/cost evidence, current Staging lifecycle, Legal/Tax, explicit Production activation.
- Assumptions: Staging Test prices existing does not mean Plus/Ultra is activated or fully accepted.
- Completed so far: Standard active; Plus/Ultra prices/policy, entitlement resolver, Staging storage/foundations, five-price Stripe Test catalog, signed webhook smoke, lifecycle controls, applied AI-tier event ledger, monitoring/recommendation/eval tooling. Current exact-main runs `33003378162`, `33003452287` and `33003526741` pass the protected read-only AI-resource, five-price Test-catalog and exact 22-event webhook checks. Direct read-only catalog evidence confirms both AI ledger functions and all three tables with forced RLS, exact role boundaries, zero events and zero unresolved reconciliations. The 50/100/150 context limits are already approved and tested.
- Completed code continuation: FM-CR-009 replaces productive raw Stripe REST with one SDK `22.4.0` client pinned to outbound `2026-07-29.dahlia`, removes explicit Checkout payment-method narrowing, adds a fresh eight-letter integration-identifier suffix per Session and preserves fail-closed tax/cancellation/referral behavior. PR #1035 final head `ffdc11ab4a1c199134dc009abc516cc8257f5e8b` passed all eight exact-head workflows and completed review with zero unresolved threads, then merged as `9a7b37f2cee798dc64c1d32f70fda338db174b5e`. The observed inbound Staging webhook stays `2026-06-24.dahlia`; no provider resource was touched.
- Still open: final models/fallbacks, request/token quotas, usage/overage, switching/proration/refund and cost/margin decisions; private quality/cost evidence; provider-side webhook migration; a current full transactional Staging lifecycle through the applied AI ledger; the separately designed general Billing event ledger is not applied; legal/tax; runtime integration and explicit Production activation.
- Evidence so far: issue #560, issue #874, Source of Truth, `src/config/aiTiers.mjs`, current runs/jobs recorded in FM-EV-022, FM-EV-033, historical signed-smoke run `31781263978`, pre-ledger lifecycle run `31735315959`, AI-ledger apply run `32038152382`, 175/175 focused local tests and the 2026-08-26 read-only Supabase catalog result.
- Exact next step: resume only after the applicable owner authorization under `FM-AI-OWNER-001`/`002`; do not rerun the three read-only jobs, apply SQL or activate paid tiers without that gate.
- Owner action needed: yes for product/financial decisions and any protected external activation.

## FM-META-001
- Started: before 2026-08-19
- Updated: 2026-08-26
- Status: PARTIAL
- Risk: R3
- Scope: Meta Events Manager/external Meta acceptance and final non-Social security proof.
- Branch/PR: technical reconciliation `meta-technical-reconciliation-20260826` / #1014, final head `12a479f00cce95d0031970c98c2d3933477ab804`, squash merge `ec1f196e82ab64a3b39b69a22a7b81b0757aa7a4`; repository-only closeout #1015 head `355f1ce580045598527c51bff49d2a52c80275df`, merge `d727b53470653844b50fa6a4ca2fc98f7fb2c89b`; canonical freshness follow-up `meta-canonical-freshness-fix-20260826` / #1017, evidence head `dd8246efe399f03180c675b245cc7277d46060ca`.
- Work lock: `LOCK-FM-META-001-TECHNICAL-RECONCILIATION-20260826` RELEASED through the repository-only closeout; do not revive it.
- Dependencies: normal-browser Meta Events Manager access, Meta app/test assets, App Review/permissions, legal/privacy acceptance.
- Assumptions: technical pixel calls and Staging migrations are not external Events Manager/App Review acceptance.
- Completed so far: consent-gated parameterless PageView-only Pixel Production path; advanced Facebook/Instagram OAuth/token/content/conversation foundation; 95/95 focused local tests; direct transaction-level read-only Staging catalog countercheck; exact-main protected read-only runs `33007156552`, `33007311870` and `33007481167` all passed with Apply not requested, runtime activation disabled where applicable and postflight rollback markers. Canonical readers now record that continuation and queue schemas are present in isolated Staging, and `EV-META-STAGING-FOUNDATION-20260826` expires the mutable observation. FM-FAIL-015 preserves the read-before-rollout sequencing deviation.
- Still open: external Events Manager positive/negative browser reception and provider-side no-PII/no-unexpected-conversion proof; App Review/permissions and real account/webhook/conversation E2E; final relevant security/legal acceptance.
- Evidence so far: FM-EV-007, FM-EV-023, `META_TECHNICAL_READONLY_RECONCILIATION_2026-08-26.md`, #714, Source of Truth and the three exact-main runs/jobs.
- Exact next step: external Events Manager/App Review/provider/legal work remains owner-controlled under `FM-META-OWNER-001`; keep conversion events, Advanced Matching and CAPI disabled. Do not repeat the evidence runs merely for closeout. After Staging freshness expiry/invalidation or before another Meta database action, acquire a new lock and revalidate shared rollout state first.
- Owner action needed: external Meta account/access and legal approval where required.

## FM-SOC3-001
- Started: foundation work before 2026-08-19
- Updated: 2026-08-19
- Status: PARTIAL
- Risk: R3
- Scope: Phase 3 real Facebook, Instagram and WhatsApp connectors.
- Branch/PR: existing Meta/WhatsApp foundations on main.
- Work lock: acquire per connector before external mutation.
- Dependencies: non-Social finishline sufficiently closed; provider credentials/permissions; legal boundaries.
- Assumptions: existing foundation is not a live accepted connector.
- Completed so far: Facebook/Instagram foundation advanced; dormant WhatsApp inbound foundation merged.
- Still open: final real E2E for all three, including auth, tenant isolation, idempotency, token/revocation/reconnect and no-auto-send evidence.
- Evidence so far: Source of Truth, #874 Gate 6, Meta/WhatsApp commits.
- Exact next step: run Social only after Gates 2-5 are sufficiently closed; reuse existing Meta foundation.
- Owner action needed: provider credentials/App Review where externally required.

## FM-SOC7-001
- Started: feasibility assessment before 2026-08-19
- Updated: 2026-08-19
- Status: PARTIAL
- Risk: R3
- Scope: Phase 7 TikTok, X/Twitter, Discord and conditional OnlyFans.
- Branch/PR: no accepted real connector set yet.
- Work lock: acquire per platform before implementation.
- Dependencies: Phase 3/non-Social finishline; official platform scope; X cost approval; OnlyFans official/contractual feasibility.
- Assumptions: Login/content-posting capability is not equivalent to inbox/DM/comment capability.
- Completed so far: platform feasibility notes in #874.
- Still open: official scope revalidation and real connector/E2E work.
- Evidence so far: #874 platform-feasibility comment.
- Exact next step: after prior gates, verify current official API capability before coding each connector.
- Owner action needed: yes for paid X/API spend or external platform onboarding where required.

## FM-SALES-001
- Started: sales materials prepared before 2026-08-19
- Updated: 2026-08-19
- Status: BLOCKED
- Risk: R2
- Scope: final technical sales handoff to Gerhard.
- Branch/PR: sales docs already exist; no new sales claim until finishline accepted.
- Work lock: none required until closeout.
- Dependencies: FM-SOC3-001, FM-SOC7-001 and final exact-release demo/production truth.
- Assumptions: Phase 4 completion or existing sales docs do not equal sales handoff.
- Completed so far: sales one-pager/demo script/objection material prepared and canonical truth aligned to Phase-7 finishline.
- Still open: required social acceptance, final 5-minute Production demo, final reader/material sync, formal technical handoff.
- Evidence so far: Source of Truth, #874, commit `74c3a6aa357215c52d3a4d9b01ba8513bba1b57f`.
- Exact next step: remain blocked until social finishline; do not prematurely mark sellable technical handoff.
- Owner action needed: final operator/sales acceptance at handoff.

## FM-LEGAL-001
- Started: before 2026-08-19
- Updated: 2026-08-19
- Status: BLOCKED
- Risk: R3
- Scope: final external law/tax/AVV/provider evidence.
- Branch/PR: technical legal evidence framework on main.
- Work lock: none for collecting evidence; protected review for public/legal mutations.
- Dependencies: actual advisor/register/provider documents.
- Assumptions: technical truth cannot substitute legal/tax approval.
- Completed so far: confirmed operator/business facts and technical reader/evidence framework.
- Still open: tax/register/UID, legal review, final AVV/subprocessor/region/transfer/retention evidence and acceptance.
- Evidence so far: issue #564.
- Exact next step: incorporate only confirmed external evidence when received.
- Owner action needed: yes/external advisors.

## FM-SEC-001
- Started: 2026-08-20
- Updated: 2026-08-26
- Status: RECONCILIATION_REQUIRED
- Risk: R3
- Scope: reconcile fresh live Supabase Production/Staging security advisors with the controlled hardening design before any database/Auth mutation.
- Branch/PR: read-only verify evidence PR #1008 final exact head `ed64255f3786eea257011778a40492d6c7c9447e`, squash merge `4efb4eeef07d850fd0fd9117244187cf94bfed41`; refresh PR #1006 merge `78333aae9d075a67a2d550a266d24cb8b9f443a4`; prior lock closeout #1007 merge `5cb9c193e262f8939b5fc0c700fce154dde616e6`; issue #982 comments `5428919200`/`5428996454`/`5429302086`.
- Work lock: `LOCK-FM-SEC-001-PRODUCTION-VERIFY-20260826` RELEASED after exact-head acceptance and merge. Acquire a separate exact authorization and new lock before any Production DB/Auth change.
- Dependencies: FM-DEP-010; exact deployed Production commit; controlled trigger-hardening checksum/runner; current Production/Staging Supabase projects; provider/Auth access for leaked-password decision.
- Assumptions: Production trigger warnings indicate pre-apply/not-accepted state; Staging authenticated workspace RPC may be intentional but its exception status must be explicitly reviewed.
- Completed so far: provider advisors and direct Production/Staging catalogs reconfirmed no drift; deploy run `32996396550` job `98266724400` proved Production at exact `main` `5cb9c193e262f8939b5fc0c700fce154dde616e6`. Exactly one protected `verify` then ran as `32997946812` job `98271985321`: preflight audit passed, the installed read-only database verifier returned fixed `hardening_not_ready`, and the always-run postflight audit passed on the same release. Fresh Production advisors remained unchanged. Focused Staging provisioning tests passed 24/24 and classify the RPC as constrained intentional exposure pending explicit exception acceptance.
- Still open: separately authorized protected Production Apply and post-advisor proof; explicit Staging RPC exception acceptance; separately authorized leaked-password protection changes on both targets.
- Evidence so far: FM-EV-014, FM-EV-019 and FM-EV-020; run `32997946812`/job `98271985321`; live Supabase advisors/catalog ACLs; controlled SQL/runbook; 24/24 focused Staging tests.
- Exact next step: keep `FM-SEC-OWNER-001`/`002` deferred until explicit owner resume and continue the generated parallel-safe Mobile read-only action. Do not rerun the verify.
- Owner action needed: yes for `FM-SEC-OWNER-001` protected Apply and `FM-SEC-OWNER-002` Auth-setting/exception decisions; neither is standing-authorized.

## Closed work

## FM-MOB-005
- Started: 2026-08-31 Europe/Vienna
- Closed: 2026-09-01 Europe/Vienna
- Status: ACCEPTED
- Risk: R3
- Change request: FM-CR-011.
- Issue: #1049 — CLOSED `completed`.
- Branch/PR: `feat/mobile-message-push-data-boundary-20260831` / #1050; final head `09ec3c8a73d57f7a0f0552e6ba89440b27e89ec7`, squash merge `953fcc56de0d02d5c2c5d41468226ba051624b53`.
- Work lock: `LOCK-FM-MOB-005-MESSAGE-PUSH-DATA-BOUNDARY-20260831` RELEASED through the post-merge closeout.
- Scope/result: accepted only the repository-side Production/Staging/test-data boundary and dormant privacy-minimal Owner-only `message_received` plus at most one `message_reminder` policy, exact-fan authenticated `Nachrichten` navigation and section-correct `seen_at` semantics. All eight exact implementation-head workflows passed, exact-head Codex review completed and zero review threads remained before merge.
- External boundary: real provider delivery, Delivery-Ledger apply, Push Staging mutation/acceptance, Production push, Google Play, a new signed message-push build and real-device message-push acceptance remain open under FM-MOB-001 / external acceptance. The existing Android `1.0.0` AAB remains the Play baseline but predates the new handler.
- Evidence: `project-memory/receipts/FM-MOB-005-20260831.md`; #1050; merge `953fcc56de0d02d5c2c5d41468226ba051624b53`; issue #1049 closeout.
- Exact next step: keep FM-MOB-005 closed; any later ledger/provider/device work requires its own bounded task/lock and must not repeat this implementation.
- Rollback/recovery: if the post-merge closeout has been merged, revert that closeout first, then revert implementation merge `953fcc56de0d02d5c2c5d41468226ba051624b53`; do not leave ACCEPTED/RELEASED records after withdrawing the implementation.

## FM-MEM-005
- Started: 2026-08-19 08:40 Europe/Vienna
- Closed: 2026-08-19
- Status: ACCEPTED
- Risk: R3
- Scope: Project Memory V2-V6, exhaustive FanMind finishline audit and machine-enforced finishline controls.
- Branch/PR: `project-memory-v4-started-work` / PR #975
- Result: exact head `2a62dc8337673be0b33acfd4338d0f452224e779` passed Project Memory Guard/Quality V6/Status, FanMind CI, Supply Chain, Landing, CodeQL and Browser E2E; merged as `b4bef882a55e8c0dd1dd33d0ad1c1664c3078d0d`.
- Evidence: PR #975, merge commit and exact-head workflow runs.
- Follow-up: maintain V6; continue `FM-RST-001`.

## FM-MEM-008
- Started: 2026-08-19
- Closed: 2026-08-20
- Status: ACCEPTED
- Risk: R3
- Scope: Project Memory V8 cross-chat reconciliation, impact matrix, owner-action inbox, automatic handoff and V8 quality enforcement.
- Branch/PR: `project-memory-v8-crosschat-impact` / #980.
- Result: after correcting missing V5 bookkeeping and stale generated status, final exact head `704fec4b6264dd5a0dd83cc8e0029352672485d0` passed Guard, Quality, Status, FanMind CI, Supply Chain, Landing, CodeQL and Browser E2E, then squash-merged as `22eb6aed5da4fde47860bbe12b118d3780c8a4a0`.
- Evidence: exact-head GitHub workflow runs and merge commit; independent Browser E2E run #915.
- Follow-up: maintain V8; any stale/contradictory handoff must downgrade to revalidation rather than being trusted.
