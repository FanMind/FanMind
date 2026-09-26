## FM-CREATOR-001 — exhausted Creator action reconciliation — 2026-09-26
- Status: MERGED_VERIFIED
- Risk: R2
- Work lock: LOCK-FM-CREATOR-NEXT-ACTION-RECONCILIATION-20260926
- Baseline: exact main `2aaf225fec29fd91c20f822185c770f87eb3d10d` after #1185 closed the #1184 aggregate-summary repository receipt.
- Remaining outcome: consume the broad `NBA-CREATOR-INTELLIGENCE` placeholder now that its last documented bounded continuation is merged; keep the aggregate Creator gate `IN_PROGRESS`, surface the actual earliest owner boundary, and require any later repository work to enter as a distinct authorized bounded action.
- Expected files/contracts: `docs/CREATOR_INTELLIGENCE.md`, `project-memory/NEXT_BEST_ACTIONS.json`, generated `NEXT_BEST_ACTION.md`, `scripts/fanmind_truth_drift_check.py`, a focused regression and scope-exact Project Memory records. No product/runtime contract changes.
- Acceptance: #1184 is documented as completed; the consumed broad action cannot be classified executable; the manager reserves zero workers and invents no scope; truth drift rejects absence of both an active eligible Creator action and a consumed retired record; all focused Manager/Memory/drift checks pass.
- Negative/regression proof: the new regression fails against baseline because the action is still active and the Creator document still calls the merged summary the next step; a missing retired evidence/reason record remains invalid.
- Completion stage: repository `MERGED_VERIFIED`. PR #1186 final head `a5e9880ad14961143ecee2611da921d8ec1e07fe` passed all triggered exact-head workflows, independent exact-head review reported no major issues, all review threads were resolved, and normal squash merge produced `d2af392dfa099da8d675481bb343154d829743ff`. Merge is not Creator runtime/Staging/provider/quality acceptance.
- Exact next step: none for this bounded repository reconciliation. Keep `NBA-CREATOR-INTELLIGENCE` consumed; any later Creator repository increment requires a new exact bounded action. Current Builder Manager state remains `SAFE READY SET=NONE`.
- Forbidden: SQL APPLY, protected environment/runtime/provider/customer/Billing/Restore/Mobile mutation, real private sample use, new Creator product decisions, direct main writes or another broad unbounded action.
- Result: clean implementation head `0eb05fddaa92a3e9b865ffc1261964e50ff41c80` passed the focused regression, 1,548 Operations tests (1,544 pass / 0 fail / 4 documented skips), Manager contract/selection, truth drift, Project Memory quality/V8/status, accepted-state drift, freshness, sales-readiness, milestone and legacy controls. The current branch is ready for one exact-head PR/review cycle; no merge or runtime acceptance is claimed.
- Review continuation: independent review of published tree `af3cbe14d0819e68ee037a9748afa81e751f6812` found one P1 and one P2. P1: current `OPEN_LOOPS.md` still authorized repository work under the retired broad action. P2: truth drift accepted reactivation of the consumed legacy ID. The same PR now reconciles the loop and makes any active `NBA-CREATOR-INTELLIGENCE` entry fail closed; focused regressions cover both paths.
- Review-fix verification: clean correction head `33cc31b62b98cc3d125a4cd60792a4717168eca1` passed the focused active-ID and open-loop regressions plus the full 1,548-test Operations suite (1,544 pass / 0 fail / 4 documented skips). Current-head remote CI and exactly one new independent review remain required after publication.
- Post-merge verify: current `main` contains the retired/consumed broad Creator action classification and continues to surface `FM-REG-003` as the earliest owner boundary; no product/runtime/provider state changed.

## FM-CREATOR-001 — privacy-safe voice evidence summary — 2026-09-25
- Status: MERGED_VERIFIED
- Risk: R2
- Work lock: LOCK-FM-CREATOR-VOICE-EVIDENCE-SUMMARY-20260925
- Baseline: exact main `094334c38e9942affe7e8100aeb02df45808e530` after #1183 reconciled the bounded onboarding input contract and released its predecessor lock.
- Scope: repository-only deterministic summary over an already normalized 30–100-message Creator onboarding dataset. Files are bounded to `src/lib/creatorVoiceOnboarding.mjs`, `tests/creator-voice-onboarding.test.mjs`, Creator documentation and exact Project-Memory records.
- Acceptance: return only aggregate character/question/exclamation/emoji statistics and top emojis for one exact Workspace/Creator. No raw message text or message IDs in the summary, no automatic profile/voice approval, no provider/model call, no persistence, no SQL or target mutation.
- Negative paths: cross-Creator scope or sample-size mismatch fail closed; privacy regression proves raw sample text and message IDs are absent from the summary.
- Boundary: this is evidence preparation for later human review only. It does not derive subjective style scores, create an approved Creator voice profile, use real private samples in Git, run blinded quality, activate runtime/provider or mutate Staging/Production.
- Result: PR #1184 final head `12924950dfcfee263c48774c16c667d9bd5c6167` passed all eight required exact-head checks and independent review with no remaining major issue after the emoji-punctuation P2 correction; the thread is resolved and normal squash merge produced exact main `2dace28f6ab631261c60da1f3aa7920eaa40c849`.
- Post-merge repository verify: current main contains source blob `55efe11da5916a13d90c8c287e49bbb62c6798ac` and test blob `07cee74e32ab64d2d9dab59d4323f0e0c7b3d2f3`.
- Resume: keep this aggregate-summary scope closed. Recompute the Builder Manager and admit only a distinct still-open Creator increment; real samples, subjective profile approval, blinded quality and runtime/provider/target acceptance remain separate.
- Recovery: ordinary repository revert; no external state changed.

## FM-CREATOR-001 — bounded voice onboarding input contract — 2026-09-25
- Status: MERGED_VERIFIED
- Risk: R3
- Work lock: LOCK-FM-CREATOR-VOICE-ONBOARDING-20260925 — RELEASED
- Result: PR #1182 final head `4ce84791a01efa1ebe99293243bd4d70428edb19` passed FanMind CI, Browser E2E, CodeQL, Supply Chain, Landing Language, God Mode and all Project Memory checks. Exact-head Codex review completed with no further major findings after the initial P1/P2 corrections, all review threads are resolved, and normal squash merge produced exact main `134d1ba100aaa1dbae734c9db19c076e5c513b52`.
- Post-merge repository verify: current `main` contains the hardened validator, all four review-regression tests, the required `test:operations` registration and synchronized Creator documentation.
- Accepted repository scope: only 30–100 confirmed real manual outbound messages from one exact Workspace/Creator may enter the onboarding dataset; inbound/AI-draft/unconfirmed/wrong-source/cross-tenant/duplicate/sparse/invalid-time/oversized normalized evidence fails closed.
- Boundary: this is repository acceptance only. No real private onboarding sample, learned profile generation, blinded two-Creator quality result, provider/model call, persistence, SQL, Staging/Production/customer/Billing/Restore/Mobile mutation or runtime activation is claimed.
- Resume: do not rebuild #1182. Recompute the Builder Manager and select the next distinct Creator-safe scope.
- Recovery: ordinary repository revert; no external state was changed.

## FM-CREATOR-001 — authenticator transitive SET-path P1 follow-up — 2026-09-24
- Status: MERGED_VERIFIED
- Risk: R2
- Work lock: LOCK-FM-CREATOR-AUTHENTICATOR-SERVICE-ROLE-20260924 — RELEASED
- Result: PR #1172 exact head `ca6be4882aa3437a5e6858fdaa79b6f8e9b41e0d` converged with green triggered CI, exact-head independent review without findings and zero blocking threads, then merged normally as `418c1d0d1576d0c87e617f28fc4507ce0e83480f`.
- Boundary: repository-only verifier hardening; no SQL APPLY, Staging/Production/provider/customer/Billing/Restore/Mobile mutation.
- Resume: do not reopen this P1 scope. Continue only the separate confirmed-chat installed source-state step above.

## FM-REG-001 — Daily setup display closeout
- Status: PRODUCTION_CONFIRMED; Risk: R2; lock: LOCK-FM-DAILY-SETUP-UI-20260914 — RELEASED_PRODUCTION_CONFIRMED; owner: Codex.
- Result: PR #1125 final head `423f82d67fd15d633d020c4f92da7f744e181416` passed its final-head checks/review and merged as `8694986f7d25639ccbdf67b23c40f88bd175f972`. Its durable completion receipt records successful Production deploy `34886792334`, exact `/api/version`, Production audit `34886957898` and public readiness `34886957948`.
- Scope closed: Daily setup presentation only. The receipt explicitly releases this lock. Full Daily provisioning/payment/tax readiness remains separate and PARTIAL.
- Exact next step: do not rebuild or reopen this UI closeout. Continue only the distinct retained Daily/Billing gates when their own prerequisites and authorizations are satisfied.
- Recovery: bounded source revert through the normal isolated release; this presentation change had no data mutation.

## Creator foundation closeout — 2026-09-11
- Scope: FM-CREATOR-001 / FM-SOC3-001 / FM-CR-033; bounded source/schema/JWT/revision/PDF package ACCEPTED. LOCK-FM-CREATOR-META-FINISH-20260911 is RELEASED for that package; overall tasks remain IN_PROGRESS/PARTIAL.
- Completed: #1105-#1108 are published; executable main f0c7a84e, Verify 34628681395, PT409-only Upgrade 34628886294, Staging Deploy 34628740980 and real acceptance 34629009649 passed. Owner/member/foreign isolation, one style, approval/revisions, both PDFs, independent cleanup and temporary-member rotation/rejection passed; 17:42:49 UTC post-read confirms empty Creator tables/no unfinished Creator RPCs.
- No runtime activation was performed. The deployed process flag is UNVERIFIED; controller input false is not host evidence. Enabled UI, full contact/account deletion, actual quality and confirmed-chat learning remain open.
- Exact next step: repository and controlled synthetic-Staging engineering under NBA-CREATOR-INTELLIGENCE, with current target preflight and appropriate new scope. Provider-account access, central apps, individual Creator consent and real provider acceptance remain separate under owner-required NBA-CREATOR-SOCIAL-EXTERNAL (Meta/Phase 3) and NBA-PHASE7-EXTERNAL (Phase 7); reuse existing authorization and obtain only missing access/factual evidence.
- Historical checkpoints below are superseded for already-published #1102-#1108 source and installed Social/Creator foundations. Social Apply 34591339718 and deploy 34591566257 completed #1104. Do not repeat those source/installations or treat old locks/next-step text as active. Mutable current-target evidence must be revalidated after listed triggers/TTL; historical successful runs are retained.

## FM-SOC7-001 — Connection return and initial preview
- Status: IN_PROGRESS
- Task: FM-SOC7-001 / FM-CR-032 / FM-DEC-018
- Risk: R4
- Work lock: LOCK-FM-SOCIAL-CONNECT-FLOW-20260911
- Completed so far: #1103 published at 3df6f5f8, all 13 PR checks and independent review passed; Deploy/Readiness passed. Protected Verify 34590000782 passed. Apply 34590217929 stopped; independent catalog proof shows no Social objects installed. Supabase-specific inherited service_role grants are now modeled in the bounded correction and PG17 fixture.
- Still open: exact-head CI/review/publication of the grant correction, protected new-main Verify/Apply/Postflight, actual app/consent/budget and provider acceptance; later automatic Meta first-import handoff.
- Exact next step: finish this grant correction, then use only the reviewed protected Staging workflow. Do not repeat the old Apply or completed #1103 source work.
- Owner action needed: none for source engineering. Existing platform/account credentials are not requested in chat. Protected deployment/provider prerequisites remain factual boundaries.
- Retained work: Creator draft cd5cac7c remains separately preserved; #1102 source publication is not repeated. Historical Backup failure at 00:30 UTC remains tracked under FM-OPS-001.

## FM-SOC7-001 — TikTok / X connection engineering
- Status: IN_PROGRESS
- Task: FM-SOC7-001 / FM-CR-031
- Risk: R4
- Work lock: LOCK-FM-SOCIAL-OAUTH-20260911
- Authorization: Bernd explicitly requests TikTok and X/Twitter now and continued implementation; FM-DEC-016 remains binding.
- Completed so far: current main/PR receipts and existing Meta/TikTok/source contracts read, accepted-state drift and evidence freshness pass. Official X OAuth/DM and TikTok Login/token/profile docs read. No provider app or real DM approval is inferred.
- Still open: implementation, negative and independent database/CI proof, source publication, separate protected target and provider acceptance.
- Exact next step: implement official read-only connectors and account isolation in this branch; preserve the existing Creator rollout draft and all completed work.
- Owner action needed: none for engineering. Actual account consent/app access and X usage budget must be established before a real provider pilot; no secrets requested in chat.
- Recovery: default-off gates and bounded source revert; no uncontrolled target SQL or provider send.

# Started Work Register

## FM-CREATOR-001 — one account, one writing style clarification
- Date: 2026-09-11
- Status: COUNTERCHECKED
- Risk: R1
- Work lock: LOCK-FM-CREATOR-STYLE-20260911
- Scope: record Bernd's terminology/account/manager clarification in canonical documentation and Project Memory. No application, database, provider, pricing or role activation.
- Completed so far: unchanged main 8c03b78c and mandatory readers inspected; #1100 final receipt confirms the prior reader closeout is already released. Existing Creator SQL has one style row per Creator; the reply policy requires the same style across all variants. The legacy prompt-profile UI remains a separate compatibility item.
- Still open: reviewed publication of the completed documentation clarification; Creator runtime/legacy UI and manager features remain separate.
- Exact next step: publish the counterchecked FM-DEC-016 / FM-CR-030 documentation change through its enclosing PR and preserve the separate Creator Staging continuation.
- Owner action needed: none for recording this explicit clarification. Manager access remains a later feature.
- Recovery: revert only these documentation additions; no data or runtime state changes.

## FM-CREATOR-001 — Creator and Social continuation
- Date: 2026-09-10
- Status: PARTIAL
- Risk: R4
- Work lock: LOCK-FM-CREATOR-SOCIAL-20260910 RELEASED for first source package.
- Completed so far: PR #1099 merged as 0e5ec0a2e8bfa3cb0c7e46248cdbbda83dedc16c; exact tree cb4a979ed9aa4daf8e49740c9ae222024bbcbde4 matches all 14 successful checks on d0798960374bc69811db0c21c922a405818c1f1a. Deploy 34529647457, independent Production audit 34529903547 and public readiness 34529903536 all passed for that release.
- Still open: controlled Staging target/runtime, actual voice quality, full confirmed-chat learning, Meta/OnlyFans provider/legal acceptance. No target SQL or feature activation was performed.
- Exact next step: bounded reader closeout, then a fresh Creator target-preparation lock. Never repeat the completed code/CI/publication as if absent.
- Owner action needed: none for source engineering; do not infer external evidence or launch Android/paid activation during deferral.
- Evidence: FM-EV-CREATOR-20260910; actual PG17 RLS/FK/atomic counterchecks and real Chromium edit/reapproval/purchase-entry acceptance passed.
- Recovery: controlled flag-off/application revert preserves real data; no automatic schema rollback or provider send.

## FM-BILL-003 — paid activation engineering
- Date: 2026-09-10
- Status: PARTIAL
- Risk: R4
- Work lock: LOCK-FM-BILL-003-20260910
- Completed so far: exact revision submission implemented for both entry points/all three offers; nine executable behavior tests and 1,252 Operations tests pass, along with truth/lint/type/build checks. Production read confirms the retained rollout prerequisites.
- Still open: final CI/review/publication of the implemented consent boundary, authoritative tax/contract alignment, controlled Workspace/Billing rollout and real complete activation acceptance.
- Exact next step: finish the bounded source release, then align the contract version in the existing function rollout using actual tax facts. Do not apply historical June-version functions as acceptance of materially changed September terms.
- Owner action needed: no repeat activation permission; actual tax/contract/provider facts are not inferred.
- Evidence plan: negative no-mutation behavior, existing regression/CI, exact release and reviewed controlled target evidence.
- Recovery: bounded revert, preserving real accounts and all prior acceptance.

- Latest closeout: PR #1098 final receipt proves source publication, releases the work lock and records the owner tax/UID deferral. Earlier pending-publication instructions in this historical checkpoint are superseded; no repeat publication or activation now.

## FM-BILL-002 — publication status reconciliation
- Date: 2026-09-10
- Status: COUNTERCHECKED
- Risk: R1
- Work lock: LOCK-FM-BILL-002-RECONCILIATION-20260910
- Scope: synchronize existing task/receipt/handoff entries with the independently verified PR #1096 publication. No application, workflow, schema, provider or finishline-gate changes.
- Completed so far: main tree equals the released tree; all 13 final-head checks and exact-release Deploy/Audit/Readiness independently read as successful.
- Result: stale publication fields are synchronized; memory quality, V8, truth and drift checks pass. The scope/finishline countercheck confirms no runtime or gate change.
- Exact next step: merge this documentation correction through its enclosing reviewed PR; merged Git history is its receipt. Do not reopen the already completed offer publication for a later documentation deployment.
- Owner action needed: none; existing publication/status-reconciliation authorization applies.
- Evidence plan: GitHub commit/run facts, audit log exact release, unchanged finishline and diff, existing memory/truth checks.
- Recovery: documentation-only revert; existing published offers and security controls remain intact.

## FM-BILL-002 — three public payment offers and acceptance reconciliation
- Status: PRODUCTION_CONFIRMED
- Risk: R4
- Work lock: LOCK-FM-BILL-002-20260910
- Completed so far: account code #1095 and three-offer catalog #1096 published. Exact #1096 release 0b54ffba3e46757f47e1a3a1c6c4696d6e26b098; final-head CI, Deploy 34502092289, independent audit 34502241951 and readiness 34502241927 succeeded. Existing Live prices reused; trigger/password controls separately complete.
- Still open: full paid runtime engineering and acceptance in FM-LOOP-THREE-OFFERS-20260910; the four overall gates retain their precise missing work. No public Daily or account publication remains.
- Exact next step: preserve this completed publication and continue existing Production provisioning/consent/Billing engineering plus actual external acceptance.
- Owner action needed: none for requested source publication; actual tax/contract/recipient/Restore-target facts are not fabricated.

## FM-REG-002 — Public registration and confirmed-email continuation
- Status: PRODUCTION_CONFIRMED
- Risk: R4
- Work lock: LOCK-FM-REG-002-20260910
- Completed so far: bounded account/confirmation implementation, 1,241 local Operations tests, normal build/type/lint and PR #1095 application/security/database/CRM checks plus 44 desktop/mobile browser tests on 11636d874031552f4f7ddf58fbc0009f5adf0de1.
- Still open: genuine external email and full paid-activation acceptance; the final account-code CI/review/publication are complete.
- Exact next step: continue the retained full-activation loop using the completed #1095/#1096 publication receipts; no repeat publication.
- Owner action needed: exact payment-terms/version and tax facts for subsequent paid activation, plus an approved recipient for real email acceptance; no new permission needed for this requested normal Web publication.


- Publication reconciliation 2026-09-10: PR #1095 is PRODUCTION_CONFIRMED at 9a6e9d016cb0928e58b89c6c2d5b6183379c50ed; deployment 34493661010, independent audit 34493830507 and public readiness 34493830467 succeeded. Its final PR receipt releases the lock. This closes the account-only Web publication, not genuine email delivery or paid Workspace/Checkout acceptance. Earlier pending publication steps in this historical block are superseded.

## FM-STATUS-001 — five handoff questions
- Date: 2026-09-10
- Status: VERIFIED
- Risk: R2
- Work lock: LOCK-FM-STATUS-001-20260910
- Scope: evidence-based status reconciliation only. No takeover of the unfinished FM-MOB-001 or Restore runtime work.
- Completed so far: current-main release and all final #1089 checks verified; signed Android run 34037085683 and rollback-only Push-ledger acceptance 33867922978 succeeded. Source inspection proves the delivery service has no runtime caller.
- Result: stale package/recovery task, started-work, receipt and lock statuses are reconciled; the Push guide and next-action catalog now explicitly retain the implementation gap. Existing memory/truth/drift checks pass and the finishline remains unchanged.
- Still open: publication through the enclosing PR; real Push trigger integration, opt-in/registration, provider/device acceptance and Production activation remain separate unfinished work.
- Exact next step: complete the enclosing PR with green final-head checks; once merged, keep this documentation reconciliation closed and continue the existing finishline.
- Owner action needed: none for this documentation correction; it grants no protected-action permission.
- Recovery: bounded documentation revert.

- CI reconciliation: PR #1094 first head 2c36651e failed only the product-truth assertion requiring the historically false heading "Kontrollierter Ledger – vorbereitet, nicht angewendet". Scope explicitly expands to that existing documentation assertion in scripts/verify-product-truth.mjs: require the proven ledger evidence and the still-missing delivery path while preserving every runtime/Production gate. Revalidate with the full existing truth command and meaningful negative documentation probes. No activation or runtime implementation is included.

- Follow-up countercheck: npm run verify:truth passes (255 product-truth files, zero warnings); all 22 existing Push-delivery tests pass, including the unchanged dormancy/Production boundaries. Three negative probes reject missing ledger evidence, missing inactive-send status and missing integration-gap text; the original guide was restored after each probe set. Memory/truth/drift checks pass. Require fresh final-head CI for this corrected assertion.

- P1/P2 review reconciliation: synchronize every identified canonical/mobile/operations Push reader with the accepted historical Staging foundation, preserve the missing message-specific reservation and real send path, and split FM-SEC-002 source/CI VERIFIED from Web PRODUCTION_CONFIRMED and still-open patched Mobile signed publication under FM-MOB-001. The old signed candidate is not evidence for #1089 Mobile updates. Source-of-truth fingerprint changes only for this reviewed documentation scope; other watched files and all finishline gates remain unchanged.

- Review countercheck: all 76 existing Mobile Push/staging/native-release/boundary tests pass, including canonical reader agreement; full product truth and memory/drift checks pass. A scan finds no current unapplied-ledger claim in the reconciled readers; the only retained mention explicitly describes the superseded historical failure. The exact old artifacts remain separate from the newer Mobile source patch. Final enclosing-PR CI/review is still required.

## FM-ROADMAP-001 — visible roadmap publication follow-up
- Date: 2026-09-10
- Status: PRODUCTION_CONFIRMED
- Risk: R4
- Boundary: normal Web release with bounded roadmap/copy changes only.
- Work lock: LOCK-FM-ROADMAP-VISIBLE-20260910
- Goal: owner reports Creator work absent from the live roadmap and asks how future work and open points remain visible.
- Baseline: main 44179146926c691476364f668624ac24aab34ac9; PR #1089 deployed successfully in run 34481266092; audit 34481420092 and readiness 34481420119 passed. PR #1090 is unmerged; head 976fab65 failed only language-runtime-guard because one English feature name was identical to German.
- Scope: preserve current main, correct translation without weakening the guard, reconcile stale Staging/Android labels, retain actual open acceptance and publish the approved roadmap through existing PR #1090.
- Evidence plan: existing tests, actual rendered DE/EN guard, fresh complete PR CI/review, normal deployment and independent public roadmap/version verification.
- Recovery: existing isolated-release rollback; a reviewed revert of only roadmap/copy changes restores prior presentation. No database, credentials, providers or feature flags change.
- Result: PR #1090 merged at 7dbd7a3a; deployment 34483135613, audit 34483304635 and readiness 34483304720 passed; independent live DE/EN content/order/layout checks passed.
- Exact next step: bounded roadmap publication is closed; resume existing pre-sales gates. Creator implementation remains DEFERRED until sales_handoff is accepted.
- Owner action needed: none for the requested visible roadmap correction; unrelated protected acceptance remains separate.

## FM-ROADMAP-001 — historical preparation checkpoint 2026-09-10
- Superseded by: successful publication/countercheck above; the former pending PR/release instructions below are historical.
- Status: VERIFIED
- Risk: R2
- Work lock: LOCK-FM-ROADMAP-CREATOR-20260910
- Scope: owner-requested roadmap and Project Memory update only; Phase 7 channels -> Sales Handoff -> Creator Intelligence -> further Phase 8 work.
- Completed so far: main 7004c9ea, all mandatory readers, open PRs/CI and existing architecture reviewed; no Creator implementation exists in the reviewed main.
- Still open: current-head CI/review and later merge/release of published PR #1090; no Creator implementation has begun.
- Exact next step: review PR #1090 and its current-head CI; do not repeat branch/PR creation or start Creator implementation before accepted handoff.
- Owner action needed: none for this roadmap preparation; no feature implementation, schema/provider mutation or Production release included.
- Evidence plan: final diff, existing roadmap/truth/translation/memory checks and selector checks before/after Sales Handoff.
- Recovery: revert only this bounded roadmap change; preserve accepted evidence and existing prices.
## FM-SEC-002 — release dependency patches
- Date: 2026-09-10
- Status: VERIFIED
- Risk: R3
- Work lock: LOCK-FM-SEC-002-20260910
- Scope: patch vulnerable packages revealed by current release CI; no audit exception expansion or feature/framework-major upgrade.
- Web publication: PRODUCTION_CONFIRMED. PR #1089 final head 7205fa3785659bab6b3cf75a2eab4c05891361d4 passed all checks and merged as 44179146926c691476364f668624ac24aab34ac9. Deployment 34481266092, audit 34481420092 and readiness 34481420119 passed; the later current-main release 20f51f784f7e647ce7e3c3c237f74d558f08e85a is also confirmed by deployment 34484012525, audit 34484145499 and readiness 34484145715.
- Still open: Mobile source and complete CI are VERIFIED for the patched Expo/Expo Router/Sharp/dependency tree in #1089. The existing signed FCM Preview 6801d687 and Production AAB e9641503 predate that patch and do not contain it. Signed publication and device verification of the patched Mobile revision remain open under FM-MOB-001; a Web deploy cannot close them. Do not rebuild an old candidate merely to repeat registration proof; plan the newer signed release separately after its exact revision and applicable delivery work are reviewed. Existing Mobile audit exceptions and separate Auth/database hardening remain distinct.
- Exact next step: keep the source patch/CI and Web release closed; the historical repository lock is released and patched signed Mobile publication remains under FM-MOB-001.
- Recovery: forward security correction preferred; review any revert because the prior release has known vulnerable versions.

## FM-REG-001 — Web password recovery before real registrations
- Date: 2026-09-10
- Status: PRODUCTION_CONFIRMED
- Risk: R3
- Work lock: LOCK-FM-REG-001-20260910
- Goal: fix the observed Staging-to-Production recovery redirect and reject/scrub malformed recovery links before provider validation.
- Scope: existing Web recovery pages, pure callback/redirect policy, synthetic tests and reader updates. No real password change, email send, provider setting, registration/payment activation, migration or Restore operation.
- Baseline: remote main 7004c9ea44c98f125fbd7988a2557cf356693b36; existing prices complete; paid registration still blocked by unresolved payment-terms version.
- Historical pre-publication evidence plan: executable positive/negative policy tests, synthetic browser cases, exact-head CI and diff review. Local dependency installation was cancelled before network approval; build/browser execution not yet available locally.
- Recovery: revert this bounded application change; no provider or database rollback is needed.
- Result: PR #1089 final head 7205fa3785659bab6b3cf75a2eab4c05891361d4 passed all checks and merged as 44179146926c691476364f668624ac24aab34ac9. Deployment 34481266092, audit 34481420092 and readiness 34481420119 passed; the later current-main release 20f51f784f7e647ce7e3c3c237f74d558f08e85a is also confirmed by deployment 34484012525, audit 34484145499 and readiness 34484145715.
- Still open: real mail/signup/workspace/device Recovery and payment-terms approval, outside this completed code correction.
- Exact next step: preserve the deployed Web correction and continue only the separately authorized external acceptance.

## FM-AI-001 / FM-RST-001 — PR #1088 review reconciliation 2026-09-10
- Status: VERIFIED
- Reconciled: 2026-09-25 from the PR #1088 publication closeout: final head `83213f6007ac558617ffe9eff9ec37d816ff3c0e` passed all seven applicable exact-head workflows, all three review threads were resolved, and squash merge `7004c9ea44c98f125fbd7988a2557cf356693b36` was independently verified. This closes only the documentation reconciliation; CTR-FM-AI-AUTH-20260910 and owner SSH authentication remain separate open evidence gates.
- Risk: R4
- Boundary: repository evidence correction only
- Work lock: LOCK-PR1088-REVIEW-20260910
- Scope: reconcile three delayed review findings, separate technical results from missing protected-action authorization, invalidate stale mutable evidence and record the separately approved SSH change.
- Baseline: PR #1088 head 4c80de174c011a8a121ef32a176497cb3b44041e; main 7f681d26fa0e3c30e743c6a8ef1cd4fef6004e59. Seven checks passed on the old head, but three review threads remain unresolved.
- Evidence plan: exact diff, existing governance/truth controls, fresh final-head CI and resolved review. No runtime test, new authorization inference, schema or price change.
- Recovery: revert this documentation change; retain actual observations and do not silently erase the authorization gap.
- Exact next step: complete the existing quality controls, publish to PR #1088 and verify fresh CI/review.

## FM-RST-001 — owner SSH access repair 2026-09-10
- Status: PARTIAL
- Risk: R4
- Work lock: LOCK-FM-RST-SSH-20260910
- Authorization: owner explicitly confirmed saving the reviewed single-IPv4 TCP/22 ingress rule for the existing isolated Restore VM.
- Scope: only fanmind-restore-isolated, attached to fanmind-restore-01; owner source address stays private. No default-group change, new key, database Restore, Storage write or new paid target.
- Preflight: authenticated provider shows the existing VM running; neither attached group permits SSH; owner TCP probe failed and the locally available key name matches the VM base-key name. Cryptographic authentication remains unverified.
- Evidence plan: verify persisted exact rule and target scope, then independent owner TCP/SSH observation. Reject any broader CIDR, extra ports or unrelated instance attachment.
- Recovery: remove only this newly created rule if rollback is needed. Existing PostgreSQL self-group rule is preserved.
- Provider result: saved once and read back ingress TCP 22/22 from the approved owner /32; rule prefix eb474b38. The sole prior PostgreSQL self-group rule remains.
- Exact next step: owner reported SSH negotiation and failed key/passphrase/password authentication. Network reachability is independently proved; try the other existing FanMind key without server-password fallback. No successful host login is claimed.

## FM-AI-001 — shared rollout binding correction 2026-09-08
- Status: VERIFIED
- Risk: R4
- Work lock: LOCK-FINISHLINE-RESUME-20260906; bounded workflow/publication subtask complete, wider external owner/device scope remains paused.
- Result: PR #1087 passed eight exact-head workflows and resolved review, merged as 7f681d26; Production deployment/audit/go-live and exact Staging deployment passed. Technically successful AI run 34273836166 / 102221843980 passed with full rollback and cleanup; independent counts remained unchanged. See FM-EV-039.
- Protected acceptance: CTR-FM-AI-AUTH-20260910 remains RECONCILIATION_REQUIRED; technical PASS is not verified action-time authorization.
- Exact next step: keep FM-FAIL-022 and this correction closed. Do not repeat accepted prices, Billing cutover or rollback proof without a documented invalidation. Continue distinct real-device, product/private/provider/Legal/Production gates; overall FM-AI-001 remains PARTIAL.

## FM-SEC-001 / FM-AI-001 / FM-MOB-001 / FM-RST-001 — owner resume 2026-09-08
- Status: VERIFIED
- Historical checkpoint: superseded by PR #1087 publication and the September 10 authorization/freshness reconciliation; no pending repair or automatic rerun follows from this record.
- Disposition: bounded live reconciliation complete, read-only lock released; whole finishline remains partial and the bounded KI workflow repair has its own active record.
- Risk: R3
- Scope: Bernd resumed the four non-Social completion blocks and confirmed existing prices are finished. Preserve the installed catalog; no price creation or repricing.
- Work lock: LOCK-FINISHLINE-REVALIDATE-20260908 for read-only evidence and repository reconciliation only. Existing LOCK-FINISHLINE-RESUME-20260906 retains its narrower unfinished runtime scope.
- Completed so far: exact main/Production baseline a1bde3877b8f233004cb6e903f4c0b4fb68cdf3e; drift/freshness/selector preflight inspected; both FanMind Supabase targets healthy. Fresh security advisors still show Production trigger/Auth gaps and now two constrained Staging RPC warnings.
- Completed evidence: FM-EV-038 records successful shared rollout, exact Staging deploy and Stripe Test webhook verification; independent counters are unchanged. AI acceptance stopped before database access due to missing workflow API-origin bindings.
- Exact next step: use the current PR #1088 reconciliation and FM-AI-OWNER-002; PR #1087 repair, merge and deployments are complete.
- Owner action needed: only the exact remaining boundaries after available work is complete; never ask to recreate accepted prices, database Restore or signed builds.

## FM-AI-001 / FM-MOB-001 / FM-RST-001 — owner resumed finishline 2026-09-06
- Status: PARTIAL
- Risk: R4
- Owner explicitly requests Android/Push, Google Play, isolated Restore and Staging Billing completion today. Prior deferrals for these scopes are resumed, subject to actual target/readiness and external evidence.
- Work lock: LOCK-FINISHLINE-RESUME-20260906 remains ACTIVE only for FM-AI-001/FM-MOB-001; FM-RST-001 was removed after the database phase closed. Repository-only postcheck and Storage-preparation locks are released after their bounded counterchecks.
- Completed so far: Billing schema/capture-only foundation remains proven (Apply `34040107219`, durable capture `34043010578`, unfreeze `34043148548`); #1069 merged as `294264e216ee0c6844caab5c6f51f11f2a76eeeb`; #1070 merged as `2be4f5a784eff80ba417037ed0460a77f9f8353e`; #1072 merged as `62e6a11858e85996af03f6740819b0fc6194b4a4`. Exact isolated-Staging deploy `34058028839` and rollback-only canonical Billing acceptance `34058118450` / job `101553652111` passed on that commit with rollout `PASS`, Billing ledger `verify`, cutover pending `0`, uninventoried `0`, transaction rollback and cleanup `PASS`; the independent read-only Staging postcheck remained unchanged. Push registration runtime is configured; real device evidence remains pending. Historical AI-tier rollback acceptance `34039968946` / job `101504820898` succeeded on its old exact revision, but the later Staging deploy `34058028839` invalidated that mutable current-state evidence.
- Superseding AI result: Run 34273836166 / job 102221843980 on deployed 7f681d26fa0e3c30e743c6a8ef1cd4fef6004e59 technically passed the shared rollout, three ledger verifies, Test catalog, lifecycle, browser boundary and service-role ledger, with full rollback/cleanup and unchanged read-only counters. Its separately required action-time protected-Staging authorization has not been verified in the available record. Publication authorization FM-AUTH-FINISHLINE-PUBLISH-20260908 does not establish that separate scope. Keep this protected acceptance RECONCILIATION_REQUIRED under CTR-FM-AI-AUTH-20260910; retain the observed result, do not invent approval or rerun automatically.
- Historical checkpoint below: September 6 statuses are preserved; later deployed-revision observations and invalidations are authoritative.
- Still open: actual Android device/provider registration/delivery evidence, Play cohort/complete Store-device acceptance and the distinct isolated Storage target decision (database Restore is already DB_POSTCHECKED). For AI/Billing, the bounded technical Staging canonical-Billing sub-gate is closed, while one fresh exact-deployed-revision rollback-only AI-tier revalidation is `RECONCILIATION_REQUIRED` before relying on current lifecycle acceptance; product/private quality-cost, provider-side current lifecycle/downstream reconciliation, Legal/Tax, Production runtime integration and explicit activation remain open. Canonical Production projection, real payment and paid-tier activation remain disabled.
- Exact next step: do not redeploy `2be4f5a...` and do not repeat `staging-billing-canonical-acceptance.yml`; those actions are closed by runs `34058028839` and `34058118450`. Continue the owner-resumed Mobile path from the already built FCM replacement APK with real device registration evidence; keep provider delivery separate. Restore is accepted at `DB_POSTCHECKED`; do not repeat its database phase or retired SSH investigation. Only real isolated Storage remains open. Any fresh AI-tier lifecycle revalidation must target the exact currently deployed Staging revision and requires a new explicit protected-Staging authorization; do not rerun the historical `34039968946` revision as if it were current.
- Owner action needed: actual handset observation and a distinct isolated Storage target/cost decision; any future AI-tier Staging revalidation remains separately protected/authorized.


## FM-AI-001 / FM-CR-020 — Staging activation
- Status: SUPERSEDED (historical bounded freeze activation; later ledger/capture/unfreeze/canonical acceptance completed)
- Risk: R4
- Updated: 2026-09-07
- Work lock: LOCK-FM-AI-001-FREEZE-ACTIVATE-20260906 RELEASED.
- Scope: historical owner-authorized PR #1058 merge and Staging freeze activation; retained only as evidence of the pre-ledger safety boundary.
- Completed: PR #1058 merged as `157983d62afce572bfdf79374a0a5c5fd096b7db`; Staging run `34032100988` / job `101483398784` succeeded with freeze=true and independent public HTTP 503/Retry-After proof. This historical freeze was later superseded by general Billing Apply `34040107219`, durable capture `34043010578`, explicit unfreeze `34043148548`, exact Staging deploy `34058028839` and canonical rollback-only acceptance `34058118450` / job `101553652111`.
- Exact next step: none under this freeze-activation entry. Do not retain, re-enable or infer a current Billing freeze from this historical record, and do not repeat the completed ledger/capture/canonical Billing acceptance. Remaining AI work is tracked under the current FM-AI-001 owner/external gates, including the fresh exact-deployed-revision AI-tier revalidation now required by evidence freshness.
- Still open: nothing under this historical freeze activation itself; current AI product/private/provider/Legal/Production gates remain separate.
- Owner action needed: none for this superseded activation record.


## FM-AI-001 / FM-CR-020 — Checkout freeze review continuation
- Updated: 2026-09-07
- Status: SUPERSEDED (historical repository review; later ledger/capture/unfreeze/canonical acceptance completed)
- Risk: R4
- Branch/PR: `fix/staging-billing-write-freeze-20260905` / #1058
- Work lock: `LOCK-FM-AI-001-FREEZE-REVIEW-20260906` RELEASED; final remote CI/review is closed by the activation receipt.
- Completed so far: preflight, current main/PR/CI and review reconciliation. PR head `8fbd7e89678259276fddf62fc45ccc37b06ea727` exposed the shared Checkout boundary issue; the later reviewed fix restored the intended freeze behavior.
- Completed implementation: shared provider-boundary guard and fixed-code handling for API/page/redirect/admin callers; executable tests prove zero client/provider access during freeze and normal recovery after unfreeze.
- Closeout: final head `43537ccf729b7787b4bd300b678771eeb216892a` passed all eight remote workflows, all review threads resolved, PR merged and Staging freeze verified. The subsequent Billing Apply/capture/unfreeze and canonical rollback acceptance are complete under runs `34040107219`, `34043010578`, `34043148548`, `34058028839` and `34058118450`; therefore this review entry must not drive another cutover.
- Still open: nothing under this historical freeze-review continuation; remaining AI-tier current-revision revalidation, provider/product/private/Legal/Production gates are tracked separately.
- Owner action needed: none for this superseded repository review.


Canonical register for FanMind work that has started but is not yet fully completed.

## FM-MOB-006
- Started: 2026-09-03 Europe/Vienna
- Updated: 2026-09-07
- Status: ACCEPTED
- Risk: R3
- Change request: FM-CR-013
- Scope: dormant atomic Mobile Push Delivery-Ledger foundation and isolated-Staging rollback-only acceptance; no Production mutation, delivery activation or build.
- Work lock: `LOCK-FM-MOB-006-DELIVERY-LEDGER-20260903` RELEASED after repository implementation/countercheck.
- Completed result: controlled ledger SQL, server-only adapter, checksum runner, atomic reservation/lease/revocation contract, protected resource readiness, checksum-bound isolated-Staging applies, independent postflight and both rollback-only acceptance paths are complete. After safe SQLSTATE `2201B` identified an invalid bounded receipt-ID expression, exact commit `18a6ad79cb72331b4daa41ee87dd2430a8ffd473` corrected the constraint. Apply run `33867831888` / job `101006621418` and final Delivery-Ledger acceptance run `33867922978` / job `101006906941` passed with provider delivery disabled, synthetic rows, complete rollback and cleanup.
- Still open: nothing under FM-MOB-006. The required handler-containing FCM replacement APK already exists at descendant/build commit `6801d687cfe6048d6e32e63bcfe2862d2886fce0`, produced by workflow `34037085683` / job `101497020224`; the actual FCM correction commits are `1d15d8e4698392174ad7d5be23a7f174ebb2303d` and `547843cad7a1f6ecb3ba6131e155d9d068799c2b`. Real device registration and provider delivery remain separate under FM-MOB-001.
- Exact next step: do not queue another Android build. Install/use the existing `6801d687...` replacement APK for real Staging registration and Device-Acceptance; only after that may separately authorized provider-delivery evidence proceed. Keep the 12-tester/14-day Play cohort under its own external gate.
- Owner action needed: yes for real-device registration/acceptance and any later real provider delivery; no new signed build is required merely to resume this path.

## Rules
- Add an entry as soon as substantive work begins.
- Every active `IN_PROGRESS`, `PARTIAL`, `BLOCKED`, `IMPLEMENTED_NOT_VERIFIED` or `RECONCILIATION_REQUIRED` task must appear here until closed or superseded.
- Assign `Risk: R1|R2|R3|R4` before implementation continues.
- Never delete history; close with status, date, result, evidence and next step.
- Cross-link Task ID, Change Request, PR/branch, dependencies, work lock and execution receipt.

## Active work

## FM-GOV-BUILDER-MANAGER-002 — non-running slot accounting — 2026-09-24
- Status: ACCEPTED
- Risk: R2
- Work lock: LOCK-FM-GOV-BUILDER-MANAGER-SLOTS-20260924
- Owner: autonomous FanMind Builder
- Baseline: exact main `5ca91a63ae9f6df0871830269d4ac987d7b3f2c9` after clean merge of #1178.
- Defect: the existing Builder Manager counted OWNER_ACTION_REQUIRED, DEFERRED_BY_OWNER, WAITING_PREREQUISITE and canonically BLOCKED continuations as running workers. Eleven non-running scopes therefore exhausted the three-worker pool and serialized independent `NBA-CREATOR-INTELLIGENCE`, contrary to the closed-loop rule that one blocked scope must not globally stop safe work.
- Bounded scope: `scripts/fanmind_next_best_action.py`, its embedded manager regression contract and exact Project-Memory reconciliation only.
- Safety: unknown/ambiguous executable active work still reserves fail-closed capacity; this correction does not authorize owner/protected/provider/runtime/database work or relax scope-conflict checks.
- Acceptance: manager contract tests, Project Memory Quality/Guard/Status, God Mode, current-head CI/CodeQL/Browser and one independent review with P1=0/P2=0/no blocking threads.
- Result: PR #1180 final head `8f672bfad8c7124b8bd440f3deb1fb4b34873829` passed all eight required current-head checks and the independent exact-head review with P1=0/P2=0/no blocking threads, then squash-merged normally as exact main `2c4954048d3ca359ac96978764b46e435854f0f4`.
- Closeout: governance lock release and post-merge manager recomputation are captured by the enclosing #1181 reconciliation. Resulting SAFE READY repository action is `NBA-CREATOR-INTELLIGENCE`; do not reopen this governance task.
- Recovery: ordinary repository revert; no external state is mutated.


## FM-CREATOR-001 — confirmed-chat protected Staging VERIFY control — 2026-09-24
- Status: MERGED_VERIFIED
- Risk: R4
- Work lock: LOCK-FM-CREATOR-CONFIRMED-CHAT-STAGING-VERIFY-20260924 — RELEASED_MERGED_VERIFIED
- Owner: autonomous builder
- Baseline: exact main `c119e0eb82e0643fc676afb7725d7518011e1286`; PR #1174 is merged and its automatic Production deploy/runtime verification succeeded.
- Contract / gate: `FM-CONTRACT-DISCLOSURE-DELETE-001` / `FM-IGATE-DISCLOSURE-DELETE-001`.
- Bounded scope: repository-only VERIFY control at `.github/workflows/creator-confirmed-chat-learning-staging-verify.yml`, focused static regression coverage, rollout runbook and bounded Project-Memory reconciliation.
- Result: PR #1175 final head `398abaa709ae4e526e1bd1d1d16df832b6ade815` corrected its initial P1/P2 findings, all review threads were resolved, the independent current-head review reported no further major issues, and the PR merged normally as exact main `6e43bc6a86d73bffec203f7af2270002255a3008`.
- Boundary: this proves only the repository control. No Staging VERIFY was dispatched and no target schema state, APPLY, runtime activation, provider/customer/Billing/Restore/Mobile mutation or Production acceptance is inferred.
- Exact next step: do not rebuild or republish #1175. Keep actual Staging VERIFY/APPLY as separately protected target actions. Recompute the Builder Manager first; continue a distinct Creator scope only after `NBA-CREATOR-INTELLIGENCE` is actually admitted to the current SAFE READY SET. If the manager reports `SAFE READY SET: NONE` or serializes Creator for worker capacity/conflict, reconcile stale/terminal continuations instead of starting Creator work.
- Recovery: ordinary source revert; no external target state was changed by this repository package.

## FM-CREATOR-001 — post-merge gitless release-test repair — 2026-09-24
- Status: PRODUCTION_CONFIRMED
- Risk: R2
- Work lock: LOCK-FM-CREATOR-POSTMERGE-GITLESS-TESTS-20260924
- Owner: autonomous builder
- Baseline: exact main `ee87c430ea71d942966ce48e5696051b232d9742`, merged PR #1173.
- Trigger: automatic Deploy FanMind run `36053892421` failed before publication because six confirmed-chat verifier tests called `git rev-parse HEAD` while running inside the isolated release directory, which intentionally has no `.git`. The application build and 1,504/1,513 tests passed; no Production release switch, SQL, provider or customer mutation occurred.
- Scope: test-harness-only correction so early target-binding negatives use a syntactically valid reviewed SHA in gitless release packaging, while real Git checkout attestation remains fully enforced by the runner and by CI checkouts. Do not weaken runner identity checks.
- Acceptance: current-head CI/review green with P1=0/P2=0/no blocking threads; normal merge; automatic post-merge deploy must pass on the exact merge commit before this continuation is released.
- Exact next step: complete current-head CI and the automatically triggered independent review on PR #1174; fix findings on that same PR, merge only at P1=0/P2=0/no blocking threads, then consume the automatic post-merge Deploy FanMind result on the exact merge commit.
- Forbidden: SQL APPLY, manual Production/Staging deploy, provider/customer/Billing/Restore/Mobile mutation, secrets or direct main writes.
- Recovery: ordinary repository revert; no external state was changed by the failed deploy.

## FM-CREATOR-001 — confirmed-chat target-aware Staging source-state switch — 2026-09-24
- Status: PRODUCTION_CONFIRMED
- Risk: R4
- Work lock: LOCK-FM-CREATOR-CONFIRMED-CHAT-INSTALLED-STATE-20260924
- Contract / gate: `FM-CONTRACT-DISCLOSURE-DELETE-001` / `FM-IGATE-DISCLOSURE-DELETE-001`.
- Owner: autonomous builder
- Baseline: exact main `418c1d0d1576d0c87e617f28fc4507ce0e83480f` after normal merge of PR #1172.
- Consumed predecessor: PR #1172 exact head `ca6be4882aa3437a5e6858fdaa79b6f8e9b41e0d` passed every triggered current-head workflow, independent Codex review reported no findings, had zero blocking threads and merged as `418c1d0d1576d0c87e617f28fc4507ce0e83480f`. Its authenticator P1 follow-up is complete and must not be rebuilt.
- Bounded scope: switch only the reviewed **Staging** confirmed-chat disclosure/deletion lifecycle from `preinstall` to `installed`, while Production/unknown runtimes remain `preinstall`; update synchronized regression tests/runner/runbook and bounded Creator navigation. The initial global switch was rejected by current-head P1 because Production has no controlled schema yet. No target schema is installed and runtime learning stays inactive.
- Current review reconciliation: the latest exact-head review identified four blocking findings (P1 contract/gate release-decision impact, P2 loaded-env account-deletion state, P1 generic APPLY reachability, P1 Production VERIFY using Staging state). The same PR now records the R4 privacy contract/gate as affected while keeping RELEASE_DECISION=BLOCK, resolves account deletion from its loaded env, binds VERIFY state to the selected runtime, and makes generic `--apply` fail immediately with `apply_protected_path_required`.
- Exact next step: complete current-head CI plus the automatically triggered independent review of this material correction; fix any finding on the same PR and merge only at P1=0/P2=0/no blocking threads. After merge/deploy, the next target step is a fresh read-only isolated-Staging VERIFY. A later APPLY requires a new protected release-/receipt-bound path and separate owner/environment authorization.
- Forbidden: SQL APPLY, protected Staging/Production write, runtime flag activation, provider/customer/Billing/Restore/Mobile mutation, secrets or direct main writes.
- Recovery: ordinary repository revert; no external target state changed.

## FM-WEB-004
- Started: 2026-09-04 Europe/Vienna
- Updated: 2026-09-04
- Status: IMPLEMENTED_NOT_VERIFIED
- Risk: R3
- Change request: FM-CR-017; continues FM-WEB-003.
- Scope: repository-only protected Website Chat retention Staging controls and Workspace-scoped rollback acceptance; no dispatch, database apply, schedule, Production, provider, email or real visitor data.
- Work lock: `LOCK-FM-WEB-004-RETENTION-STAGING-20260904` RELEASED after complete local countercheck; publication remains repository-only.
- Dependencies: exact reviewed `main`, isolated Staging target, marked synthetic Workspace and separately authorized protected actions.
- Completed result: Workspace-scoped retention signature, exact-main/TLS/target guards, checksum-bound verify/apply runner, service-role postflight, browser-denied deterministic rollback acceptance, manual workflows, tests and runbook are prepared.
- Still open: exact-main remote CI. Every Staging verify/apply/acceptance dispatch remains separately authorized.
- Exact next step: publish and inspect exact-main checks; do not dispatch a workflow.
- Owner action needed: later, separately, for each protected Staging action.

## FM-WEB-003
- Started: 2026-09-04 Europe/Vienna
- Updated: 2026-09-04
- Status: IMPLEMENTED_NOT_VERIFIED
- Risk: R3
- Change request: FM-CR-016; continues FM-WEB-001/FM-WEB-002.
- Scope: repository-only bounded Website Chat technical-retention contract; no database apply, timer/worker, CRM deletion, Production mutation, AI/provider request or outbound email.
- Work lock: `LOCK-FM-WEB-003-RETENTION-20260904` RELEASED after repository implementation and local countercheck.
- Dependencies: controlled Website Chat handoff schema, technical evidence cascades, later protected Staging controls and exact reviewed `main`.
- Completed result: checksum-pinned dry-run-first cleanup RPC, 1,000-session batch bound, lock-safe execution selection, active-Handoff hold, service-role-only ACL and explicit CRM-history exclusion are repository-ready.
- Local evidence: checksum/offline check PASS; focused retention 6/6; Website Chat 36/36; release integrations 84/84; Operations 1113/1113; TypeScript, lint, Production build, truth/action pinning and Project Memory quality/status/drift checks PASS. Lint reports only the pre-existing Mobile warning.
- Safety: controlled SQL remains outside generic migrations and adds no schedule, provider, AI, email, installation activation or external state change.
- Still open: exact-main remote CI and a separate protected Staging verify/apply/rollback-only acceptance path before any apply or operational schedule.
- Exact next step: publish the exact repository commit and inspect remote checks; do not apply the SQL from this task.
- Owner action needed: none for repository publication; separate authorization remains required for future Staging database actions.

## FM-WEB-002
- Started: 2026-09-04 Europe/Vienna
- Updated: 2026-09-04
- Status: IMPLEMENTED_NOT_VERIFIED
- Risk: R3
- Change request: FM-CR-015; continues FM-WEB-001/FM-CR-014.
- Scope: repository-only exact-main protected Staging verification, separately confirmed schema apply and rollback-only synthetic Website Chat handoff acceptance.
- Work lock: `LOCK-FM-WEB-002-STAGING-CONTROL-20260904` RELEASED after repository implementation and local countercheck.
- Dependencies: checksum-pinned Website Chat handoff SQL, isolated Staging variables/secrets and exact reviewed `main`.
- Completed result: separate exact-main manual verify/apply and rollback-only acceptance workflows, direct target/TLS/passfile controls, independent RLS/ACL/function postflight and deterministic synthetic lifecycle proof are repository-ready.
- Local evidence: pinned SQL/offline acceptance PASS; Website Chat 30/30, release integrations 78/78 and Operations 1113/1113 PASS; Action pinning, product truth, Project Memory quality/status, TypeScript, lint and production build PASS. The sole lint warning is pre-existing and outside this task.
- Remote evidence: exact-main commit `79e0e0c761f4c6f6895d76c4253b3b93b5f1e3a2` passed Browser E2E, CodeQL, Supply Chain Security, normal Web deploy, read-only Production audit and Final Go-Live Readiness.
- Safety: no workflow dispatch, database apply, Production mutation, installation activation, AI/provider call, outbound email or real visitor data.
- Still open: any protected Staging dispatch, controlled schema apply, rollback-only database acceptance, installation activation, AI/provider work and outbound email.
- Exact next step: perform no Staging dispatch without its separate authorization.
- Owner action needed: none for repository publication; separate authorization remains required before protected Staging verify, apply or acceptance.

## FM-WEB-001
- Started: 2026-09-04 Europe/Vienna
- Updated: 2026-09-04
- Status: IMPLEMENTED_NOT_VERIFIED
- Risk: R3
- Change request: FM-CR-014; extends accepted roadmap decision FM-CR-012.
- Scope: dormant Website Chat processing-entitlement and consent-bound human-handoff preparation; no database apply, installation activation, AI/provider call or outbound email.
- Work lock: `LOCK-FM-WEB-001-HANDOFF-20260904` RELEASED after repository implementation and local countercheck.
- Dependencies: existing Website Chat session/message foundation, canonical Workspace processing predicate and current CRM contact/conversation timeline.
- Planned evidence: focused policy/API/widget/controlled-SQL tests, checksum check, TypeScript/lint/build and Project Memory/truth checks.
- Completed result: consent-bound one-per-session handoff API/widget flow, existing CRM timeline linkage, atomic processing/origin/session revalidation and service-role-only fingerprinted evidence are implemented repository-side without AI, email or external mutation.
- Local evidence: checksum PASS; Website Chat 20/20, Inbox 13/13, Production controls 5/5 and WhatsApp inbound 30/30 PASS; product truth, Project Memory quality, TypeScript, lint and production build PASS. The sole lint warning is pre-existing and outside this task.
- Remote evidence: exact-main commit `6452cb2452b3e5a664d86f5073a410f3744b1bae` passed Browser E2E, CodeQL, Supply Chain Security, normal Web deploy, read-only Production audit and Final Go-Live Readiness. The deploy did not apply controlled SQL or enable an installation, so the feature remains dormant.
- Still open: protected Staging verify/apply/rollback-only acceptance, installation activation, retention cleanup, AI dialogue, uncertainty-driven escalation, email verification and manually approved email delivery.
- Exact next step: prepare a separate protected Staging verify/apply/rollback-only acceptance path before any installation can be enabled.
- Owner action needed: none for repository publication; separate authorization is required before any Staging database apply, external provider call or Production activation.


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
- Rollback/recovery: revert the bounded Mobile UI/data-query commit. Marking messages seen uses the already accepted product field and is not automatically reversible; no message content, Follow-up history, schema or provider state may be deleted.

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
- Updated: 2026-09-07
- Status: PARTIAL
- Risk: R4
- Scope: Complete the isolated real FanMind Restore drill without touching Production or Supabase Staging; preserve the accepted read-only chain and the now receipt-bound five-extension baseline while keeping every later Restore transition separately protected.
- Branch/PR: permanent target-principal projection correction #1075 squash-merged as `e3009134f87dc4b197c518cb097ceee867b0c7f8`; issue #944 closed `completed`; earlier SSH/extension/fail-closed reconciliation remains historical in PRs #1005/#997/#995.
- Work lock: no active runtime Restore lock; all historical one-shot authorizations/controllers are consumed. PR #1075 is repository-only and authorizes no database/JIT/workflow action.
- Dependencies: FM-DEP-001; exact Schema-2 Full Backup/Verification/source binding; existing isolated host/empty target/quarantine; full receipt-bound roles/database-container/extensions; protected authorization for any later mutation.
- Assumptions: database reset does not change cluster-global roles; prior full role/container authorization success remains navigation evidence only and must be freshly receipt-checked after extension provisioning. Mutable host, target, backup, runner-policy and TLS evidence must be revalidated before any mutation.
- Completed so far: the historical read-only/extension chain remains accepted. Later workflow `33178878764` / database job `98874745740` committed the receipt-bound isolated `pg_restore`; separately authorized ACL completion `5453727223` added exactly eight missing grants and verified the exact projected authorization contract, core `5|5|5|5` and plaintext cleanup. No Production or Supabase Staging access/write and no repeated Restore occurred.
- Latest reconciled result: isolated database Restore technically complete with expected/projected-actual authorization fingerprint `0604dac8562a601e2d582f76aee4203825b826b302b9b0b93a92bdd2ca603052`; receipt `FM-RST-001-ISOLATED-DATABASE-RESTORE-ACCEPTED-20260828.md`. The post-commit helper failure came only from including target-only login `fanmind_restore_bootstrap` in the source projection. PR #1075 permanently fixes that helper boundary.
- Historical attempt, superseded by the completed database phase: authorization `5385992305` / controller `45054c41...` stopped at SSH on 2026-08-26 before dispatch or database access. Later authorizations `5431373157`, `5453497602` and `5453727223` and their outcomes are authoritative; none may be reused.
- Accepted progression: `DB_POSTCHECKED`. Receipt `FM-RST-001-DATABASE-POSTCHECK-ACCEPTED-20260907.md` maps the immutable binding, exact projected authorization contract, roles/container/extensions and core table/RLS/policy/application/security-definer postchecks to every transition predicate. Storage, server config, disposable-target cleanup, independent countercheck and final aggregate acceptance remain open.
- Evidence so far: historical PRs #943/#987/#990/#991/#992/#997/#998/#1005; issue #944 final chain `5453599115`, `5453727223`, `5453857592`; run `33178878764`, job `98874745740`; accepted database-phase receipt; PR #1075 code/tests.
- Repository result: PR #1081 merged the exact private Storage archive/receipt preparation. The follow-on controller now locally proves target-empty, overwrite denial, exact remote path/size/hash postcheck, Production/canonical-Staging denial and rollback after a simulated partial failure.
- Exact next step: PR #1085 repaired and reconciled every delayed controller finding, passed seven exact-head workflows with zero unresolved threads and a clean Codex review, and SHA-bound squash-merged as `0ccf38e5f1afdd0b5f3495a137a5d360dd214ae7`. The repository-only controller is accepted and its repair lock is released. A real external Storage transition remains deferred under `FM-RST-OWNER-007`; never rerun the database Restore and never infer `STORAGE_RESTORED` from the synthetic proof.
- Owner action needed: none for the local-only repository proof. A later real isolated Storage mutation requires a new owner decision because the 2026-09-07 choice explicitly declined an additional Supabase project/Preview branch.
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
- Updated: 2026-09-06
- Status: PARTIAL
- Risk: R3
- Scope: KI Standard/Plus/Ultra product, quality, cost, Stripe lifecycle and activation readiness.
- Branch/PR: read-only evidence PR #1012 passed all 10 checks at exact head `b53e000228bf99801b327c1d7b81646edce32d6f` and squash-merged as `d1b9d7e94b3bc78a1720e197a795a105bdcc1883`; implementation foundations remain on `main`.
- Work lock: `LOCK-FM-AI-001-STRIPE-CONFORMANCE-20260830` is RELEASED after #1035 exact-head acceptance and merge; the older `LOCK-FM-AI-001-READONLY-RECONCILIATION-20260826` remains RELEASED and its three evidence jobs must not be rerun.
- Dependencies: written product decisions, private quality/cost evidence, current Staging provider lifecycle, Legal/Tax, explicit Production activation.
- Assumptions: Staging Test prices existing does not mean Plus/Ultra is activated or fully accepted.
- Completed so far: Standard active; Plus/Ultra prices/policy, entitlement resolver, Staging storage/foundations, five-price Stripe Test catalog, signed webhook smoke, lifecycle controls, applied AI-tier event ledger, monitoring/recommendation/eval tooling. Current exact-main runs `33003378162`, `33003452287` and `33003526741` pass the protected read-only AI-resource, five-price Test-catalog and exact 22-event webhook checks. Direct read-only catalog evidence confirms both AI ledger functions and all three tables with forced RLS, exact role boundaries, zero events and zero unresolved reconciliations. The 50/100/150 context limits are already approved and tested. The general Billing ledger is installed on isolated Staging; capture-only durability and unfreeze are proven, and exact isolated-Staging deploy `34058028839` plus rollback-only canonical Billing acceptance `34058118450` / job `101553652111` passed with zero cutover pending/uninventoried counters, full rollback and cleanup.
- Completed code continuation: FM-CR-009 replaces productive raw Stripe REST with one SDK `22.4.0` client pinned to outbound `2026-07-29.dahlia`, removes explicit Checkout payment-method narrowing, adds a fresh eight-letter integration-identifier suffix per Session and preserves fail-closed tax/cancellation/referral behavior. PR #1035 final head `ffdc11ab4a1c199134dc009abc516cc8257f5e8b` passed all eight exact-head workflows and completed review with zero unresolved threads, then merged as `9a7b37f2cee798dc64c1d32f70fda338db174b5e`. The observed inbound Staging webhook stays `2026-06-24.dahlia`; no provider resource was touched.
- Still open: final models/fallbacks, request/token quotas, usage/overage, switching/proration/refund and cost/margin decisions; private quality/cost evidence; provider-side current post-ledger lifecycle/downstream reconciliation; legal/tax; Production runtime integration and explicit activation. Canonical Production projection and Plus/Ultra remain disabled.
- Evidence so far: issue #560, issue #874, Source of Truth, `src/config/aiTiers.mjs`, current runs/jobs recorded in FM-EV-022/FM-EV-033 plus Billing Staging runs `34058028839` and `34058118450`, historical signed-smoke run `31781263978`, pre-ledger lifecycle run `31735315959`, AI-ledger apply run `32038152382`, focused local tests and the read-only Supabase catalog results.
- Exact next step: resume only after the applicable owner authorization under `FM-AI-OWNER-001`/`002`; do not rerun the completed Billing Staging acceptance or activate paid tiers without the remaining gates.
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

## FM-SOC3-001 / FM-CR-044 — Facebook/Instagram inbound continuation — 2026-09-19
- Status: IN_PROGRESS
- Risk: R3
- Work lock: LOCK-FM-SOCIAL-INBOUND-20260919
- Baseline: current Production/main `a5fb5e133d3ef49f745bed6d3e599d24d73bb493`; owner-confirmed Admin-CRM login works; read-only Production countercheck found zero Facebook/Instagram social connections for Admin-CRM workspaces.
- Scope: continue the existing Meta connection and inbound-message path without rebuilding it. Preserve official provider login, explicit Facebook Page selection, Instagram Professional binding, encrypted server token storage, bounded first DM import, incremental sync/webhook behavior, tenant isolation and manual/no-auto-send semantics.
- Current source: #1137 ports only the still-valid `workspace_inactive` user guidance from stale #1121 onto current main and reconciles current evidence/hand-off.
- Retained provider evidence from #1121: authenticated central FanMind Meta app inspection on 2026-09-14; Facebook server configuration was then observed as ready but the connection was blocked by the now-resolved Workspace admission issue; Instagram Messaging/Content use case was later saved after explicit owner consent. These do not prove current account connection or live inbound messaging.
- Real Production continuation 2026-09-19: #1137 is merged/deployed as `67773a794936ba48100d811e21358239d72e26b3`; the owner then tested Facebook connect. The FanMind Workspace admission succeeded, but the generated OAuth URL carried example placeholder App ID/callback values and Meta returned “Ungültige App-ID”. No social connection was created.
- Still open: FM-CR-045 source guard and then secure owner-controlled Production/Meta app configuration; current Facebook/Instagram consent, scopes/permissions/App Review/Advanced Access as applicable, Instagram test/account role and Business Login/callback/server configuration, webhook publication/verification requirements, real inbound/import/isolation/duplicate/revocation/reconnect proof.
- Exact next step: finish FM-CR-045 current-head CI/review/deploy so placeholders fail closed. Then owner securely binds the real central Meta app to Production and retries only Facebook connect; on success verify return/status and bounded initial DM import, then authorize/sync comments separately. No passwords, MFA codes, app secrets or tokens in chat.
- Boundary: Payment and Mobile stay deferred; no OnlyFans reverse-engineering/credential-storage connector.

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
- Status: PARTIAL
- Risk: R3
- Scope: reconcile fresh live Supabase Production/Staging security advisors with the controlled hardening design before any database/Auth mutation.
- Branch/PR: read-only verify evidence PR #1008 final exact head `ed64255f3786eea257011778a40492d6c7c9447e`, squash merge `4efb4eeef07d850fd0fd9117244187cf94bfed41`; refresh PR #1006 merge `78333aae9d075a67a2d550a266d24cb8b9f443a4`; prior lock closeout #1007 merge `5cb9c193e262f8939b5fc0c700fce154dde616e6`; issue #982 comments `5428919200`/`5428996454`/`5429302086`.
- Work lock: `LOCK-FM-SEC-001-PRODUCTION-VERIFY-20260826` RELEASED after exact-head acceptance and merge. Acquire a separate exact authorization and new lock before any Production DB/Auth change.
- Dependencies: FM-DEP-010; exact deployed Production commit; controlled trigger-hardening checksum/runner; current Production/Staging Supabase projects; provider/Auth access for leaked-password decision.
- Assumptions: Production trigger warnings indicate pre-apply/not-accepted state; Staging authenticated workspace RPC may be intentional but its exception status must be explicitly reviewed.
- Completed so far: provider advisors and direct Production/Staging catalogs reconfirmed no drift; deploy run `32996396550` job `98266724400` proved Production at exact `main` `5cb9c193e262f8939b5fc0c700fce154dde616e6`. Exactly one protected `verify` then ran as `32997946812` job `98271985321`: preflight audit passed, the installed read-only database verifier returned fixed `hardening_not_ready`, and the always-run postflight audit passed on the same release. Fresh Production advisors remained unchanged. Focused Staging provisioning tests passed 24/24 and classify the RPC as constrained intentional exposure pending explicit exception acceptance.
- Still open: provider Auth protection, bounded Staging RPC exception review and separate Meta external acceptance. Production trigger Apply and its independent Verify are complete.
- Evidence so far: FM-EV-014, FM-EV-019 and FM-EV-020; run `32997946812`/job `98271985321`; live Supabase advisors/catalog ACLs; controlled SQL/runbook; 24/24 focused Staging tests.
- Exact next step: keep the independently verified Production trigger hardening closed; continue authenticated provider Auth protection and bounded Staging RPC exception review under FM-SEC-OWNER-002, plus separate Meta evidence.
- Owner action needed: secure provider sign-in where required and remaining external facts; no repeated trigger-Apply or publication approval.

- Current result 2026-09-10: Production Apply 34496892707 / job 102937525772 returned applied; independent Verify 34497099991 / job 102938240926 returned verified. Full before/after Production audits passed on 9a6e9d016cb0928e58b89c6c2d5b6183379c50ed. Supabase advisors at 2026-09-10T15:38:41Z independently show no mutable-search-path or browser EXECUTE warning for these trigger functions. The prior Production trigger pre-state and Apply owner action above are superseded. Auth leaked-password protection and the bounded Staging RPC exception review remain open; the overall Security/Meta gate is not complete.
- Current next step: provider Auth setting/exception review and Meta external evidence; retain the completed trigger hardening.

- Auth completion 2026-09-10: Production drqkpdvtbbrrdwmtrodz and isolated FanMind Staging vshyhvgcmrlagvfnvomc: Prevent use of leaked passwords enabled through the authenticated provider UI. Saved and reopened switches are checked; independent advisors at 16:11:50Z (Production) and 16:19:32Z (Staging), 2026-09-10, no longer report auth_leaked_password_protection. Production retains only 14 service-only RLS INFO findings; Staging retains 29 INFO findings and two intentional-RPC warnings pending bounded exception review. Earlier Auth-setting gaps and activation requests are superseded. Remaining scope is bounded RPC exception review and separate Meta evidence, not another trigger or Auth toggle.

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
## FM-OPS-001 — bounded Production audit diagnosis — 2026-09-11
- Status: PRODUCTION_CONFIRMED
- Final receipt: #1110 comment 5640486486 closes only this package; lock released. Overall Operations remains PARTIAL. Its previous pending-publication statements below are historical.
- Risk: R4
- Change: FM-CR-034; lock LOCK-FM-OPS-AUDIT-20260911.
- Owner requests continuing the reported completion work, including controlled reboot evidence. Baseline main e0f2a517855a65bd927c3968c8e0700f06bb54db, tree 3149df013a74345822acc5f1f1afde4144c3ca77; clean local tree matches. Drift/freshness/next-action preflights pass; Creator remains the product priority after this bounded diagnosis.
- Observed: audit 34639783862 exits 1 before publishing a diagnostic; shell failure skips the verifier and deletes private output. The latest failing probe is unproven. Preserve the historical database-backup failure under FM-LOOP-BACKUP-DATABASE-20260911.
- Scope: fixed-stage failure diagnostics and safe runtime/host evidence only. No backup job, restore, SQL, feature activation or reboot in this source change. DB_POSTCHECKED and accepted Creator foundation remain closed.
- Evidence/recovery: executable shell/workflow failure and redaction tests, unchanged fail-closed acceptance gates, current-head CI/review and installed exact-release audit. Revert the bounded source through the existing isolated release path if needed. A failed full audit remains failed; a diagnostic is not reboot or Operations acceptance.
- Exact next step: publish the bounded correction, read the real failure stage, then address only its demonstrated cause. Restore-target and console recovery facts must precede the separately requested OS restart.

## FM-OPS-001 — hardened backup contract continuation — 2026-09-11
- Final superseding receipt: https://github.com/FanMind/FanMind/pull/1111#issuecomment-5644711203 confirms reviewed #1111 on c2342d66ff0fa9f9656360f326cc9ec60f1aaa80, scheduled database backup at 2026-09-12T00:31:01.985Z (validated and encrypted offsite), and full installed audit 34648286758 / 103525002411 PASS at 08:20:31 UTC. This bounded package and lock are closed; earlier pending fields below are historical. No extra backup or database Restore is required.
- Status: PRODUCTION_CONFIRMED
- Risk: R4
- Work lock: LOCK-FM-OPS-BACKUP-CONTRACT-20260911; Change FM-CR-035.
- Completed preflight: exact released tree/runtime, current backup job/age and read-only Production function privileges compared with installed source. The source wrongly requires the legacy exposed retention trigger; current approved hardening has removed that exposure.
- Scope: bounded compatibility correction with old receipts/Restore acceptance preserved. No SQL privilege change, repeated Restore or generic backup rewrite.
- Exact next step: test both exact legacy and hardened states, publish through current-head CI/review, then use the existing authorized backup path for one fresh database-only proof after checking the installed release and worker.
- Recovery: bounded source revert; no deletion of source data, prior backups or accepted receipts. A fresh failure remains open and must not be hidden or retried automatically.

## FM-OPS-001 — controlled Ubuntu reboot — 2026-09-12
- Continuation 2026-09-13: #1113 is Production-confirmed on main 62fecd108d1d0157652ac0a293a7eb738d402a83, tree 39bd847281afff4b6d525218c0b458891995d078, by final receipt 5645657817; its earlier pending source notes are historical. Bernd has authenticated to fanmind-prod-01 with his existing SSH key. His bounded host read confirmed dump.pm2 was owner-owned, regular, canonical and readable but mode 0664; his executed chmod now confirms 0600. Direct systemd D-Bus reads prove ExecCondition, ExecStartPre, ExecStartPost and ExecStopPost are empty. The previous systemctl --all measurement omitted them. Current scope is the evidenced typed-empty read correction, regression/redaction tests and normal reviewed rollout; recheck saved-app binding/permissions after deploy. Keep this R4 lock active. Independent reference, privileged recovery, fresh idle/runtime evidence and the actual reboot remain open; no reset, extra backup or repeated Restore.
- Continuation 2026-09-12 11:18 UTC: Bernd explicitly says "ok mach das bitte" to the remaining PM2 startup, independent reference and recovery prerequisites. PR #1112 is already merged/deployed as ce9b842cf0f18dcd0d34d5232ad4ab6e2c25f9f3 (tree b555270cf95b83645aa4432039aafbffc9769a08); final receipt https://github.com/FanMind/FanMind/pull/1112#issuecomment-5645444721 supersedes its historical pending notes. Installed audit 34689543073 / 103542269118 at 10:51:34 UTC passes all eight runtime components, but boot readiness is false; PM2_STARTUP, PM2_SAVED_APP and BOOT_NODE need bounded reason diagnostics, and independent reference/recovery remain unverified. No competing open PR found. Current continuation adds read-only fixed diagnostic codes with unchanged acceptance rules, then requires exact-head review/CI and normal installed readout before any demonstrated host correction.
- Third review follow-through #1112: all 23 focused tests (including the native kernel proof) and all 13 checks passed on 67608cc432b3391377a93ab9ea37803347283796. The completed review found four further gaps. Corrections bind all managed unit definitions and timer-launched services to reviewed full-file hashes, reject Conditions/Asserts/drop-ins, protect every runner PATH entry, and require an independent root-owned reference for the exact runner registration and nginx/PM2/runner unit hashes. Audit/deploy never bootstrap that reference from current files. Local result is 25 passes plus the documented native-kernel-only skip; all 26 must pass in native CI. Reference installation and authenticated recovery are still unverified; no boot-ready claim or reboot.
- Second review follow-through #1112: the prior d57bef906fe21f83c1c752894e874428536b3445 passed all 13 remote checks; the completed review found three further reboot gaps. PM2 now requires its exact kill stop command and no post-stop hook; runner registration requires safe GitHub service endpoints; persisted native runner executables must match the kernel-held images of the running service by inode, stable metadata, ELF format and SHA-256. Local focused result: 22 passed, one native-kernel proof skipped because this workspace denies or hides /proc process images. That proof is mandatory and cannot skip in GitHub Actions. Current-head CI/review and installed target evidence remain pending; no service mutation or reboot.
- Review follow-through #1112 (09:41 UTC): five blocking startup gaps were corrected before merge: NeedDaemonReload=no for every unit; rejected PM2 Node/loader overrides and service launch hooks; actual runner command/registration/artifact binding with official v2.337.0 script fingerprints; resolved release symlink plus Next deployment ID. Twenty-one focused tests pass, including the corresponding failing paths and secret redaction. Current-head remote CI/review and installed target evidence remain pending; no service mutation or reboot.
- Status: IN_PROGRESS
- Risk: R4
- Change: FM-CR-036; Work lock: LOCK-FM-OPS-REBOOT-20260912.
- Baseline: clean exact main c2342d66ff0fa9f9656360f326cc9ec60f1aaa80 / tree 4509e2931478c0af046def29760ca139ac51b45f; independently verified Production audit and exact authenticated Exoscale instance. Drift/freshness preflights passed; prior backup closure reconciled from its final durable receipt.
- Scope: bounded read-only boot readiness followed by the already requested controlled restart, only after actual boot/recovery preflight. No startup-state mutation in the collector.
- Exact next step: finish current-head PR/CI/review for the approved published source, normal deploy and installed boot-readiness readout; resolve only demonstrated startup gaps, then the already requested controlled reboot with before/after evidence.
- Recovery: readout failure leaves running services unchanged; source revert uses the existing isolated release path. Reboot recovery requires working autostarts and the existing provider console/authorized host access; portal console currently reaches Linux login only. Do not reset credentials or reinstall the instance.
## FM-OPS-001 — official runner update layout — 2026-09-13
- Status: IN_PROGRESS
- Risk: R4
- Change: FM-CR-036; retain LOCK-FM-OPS-REBOOT-20260912.
- Prior source: #1116 final receipt 5653464231 confirms reviewed/deployed main 89c804c6e595d7eaa18b1e9d15a9f6e2e2d52fa6, tree 5d3c20b288b3e2efc91e572d302f886c43e953b0, Deploy 34758542991 and installed audit 34758613627. Its earlier source-pending notes are historical.
- Owner evidence: installed collector and release match; candidate runner configuration/startup remain false. Protected owner-owned bin and externals links resolve to the official 2.337.0 sibling directories; root, scripts and native files have the expected direct/versioned layout and 0755/0644 modes.
- Scope: accept only the reviewed direct or complete versioned layout, protect the path chain and reject changes during inspection; retain complete registration/script pins, credential metadata-only handling and actual kernel image identity. Never replace the host links to satisfy a checker.
- Evidence plan: the observed layout must fail on old source, then pass corrected configuration and native-image tests; wrong targets, versions, parents, permissions, nested links and link replacement must fail. Current-head independent review/CI and normal installed rollout remain required.
- Completed local verification: all three new regressions fail on old source; corrected focused tests 41 pass/0 fail/1 local kernel skip, full Operations 1366 pass/0 fail/4 environment skips, build/truth/lint/memory/drift pass. The existing native-kernel test now exercises real versioned child images, wrong arguments/group, alias replacement and byte-identical native replacement; GitHub must run it without skipping before merge.
- Recovery: existing isolated source rollback; no startup mutation, reference bootstrap, SQL, extra backup or repeated accepted Restore/Creator work. Independent reference, privileged recovery, both runners idle and actual before/after reboot proof remain open.
- Exact next step: implement the bounded layout correction, verify its negative/native paths, then review/CI/normal rollout and host binding. Owner action needed: subsequent authenticated host observations only; reuse existing source publication authority.

## FM-OPS-001 — runner registration compatibility — 2026-09-13
- Status: IN_PROGRESS
- Risk: R4
- Change: FM-CR-036; retain LOCK-FM-OPS-REBOOT-20260912.
- Authorization: the owner's explicit continuation covers demonstrated boot prerequisites, reviewed source publication and normal rollout; the controlled restart remains conditional on actual boot/recovery evidence.
- Baseline: current remote main 1bdf55838208788b361f48d8cc45a92c4571173a, tree d16cac544935f6788c99ef9302da04a0c4f49434. #1115 final receipt 5652891341 closes the nginx/BOM source package and supersedes its older pending notes. Drift/freshness preflights pass; the owner explicitly continues Operations before the catalog's next Creator task.
- Owner-proven host progress: runner unit 0644; base registration, saved PATH/environment and credentials 0600; PM2 dump 0600 retained. The owner created only the missing root-protected /snap/bin directory; both complete saved PATH lists now pass. Base and protected migrated registrations are byte-identical, their IDs/repository/work directory match, and migrated credentials are absent. Private registration values remain outside Git.
- Demonstrated source gap: the provider-supplied Pipelines URL has one opaque identifier segment, not a UUID; HTTPS and host checks pass. Broker uses its root URL. The collector also needs to bind the possible migrated registration and exclude unreviewed alternate credentials.
- Scope/evidence: allow one bounded opaque Pipelines identifier with unchanged full registration pin; accept only absent or byte-identical protected migrated settings and the observed absence of alternate credentials. Add negative/byte-integrity/redaction checks; require exact-head review/CI, normal deploy and installed audit.
- Exact next step: implement and verify this bounded source correction, then resume independent registration/unit reference, recovery and fresh pre/post reboot evidence. No additional backup, repeated Restore or credential read/reset.
- Recovery: revert source through the existing isolated release flow; host reference is never learned or installed by the collector/deploy. FM-OPS-001 remains PARTIAL until the actual reboot and its postflight.

## FM-OPS-001 — Ubuntu nginx condition correction — 2026-09-13
- Related source finding: actions/runner v2.337.0 IOUtil.SaveObject writes settings with Encoding.UTF8; its optional leading UTF-8 BOM currently makes the collector's JSON.parse fail. Accept exactly one leading BOM for parsing after hashing the complete original source. Reproduce it in the existing runner fixture; do not claim this is the cause of the owner's unavailable read until host metadata is inspected.
- Date: 2026-09-13
- Status: IN_PROGRESS
- Risk: R4
- Change: FM-CR-036; existing LOCK-FM-OPS-REBOOT-20260912 retained.
- Exact next step: verify the bounded source correction, complete current-head review/CI and normal rollout, then resume demonstrated host prerequisites and installed boot proof.
- Authorization: Bernd's explicit continuation covers the demonstrated boot-check correction, reviewed source publication and normal rollout. No actual reboot or reference bootstrap is performed by this source package.
- Baseline: reviewed/deployed main 41d2547806fc7f8288268c45446c3467b268f150; #1114 final receipt 5652605280 closes the prior structured-array correction and supersedes its historical pending/PR-creation notes.
- Authenticated owner evidence: nginx matches the complete official nginx-common 1.24.0-2ubuntu7.17 unit and its one non-negated/non-trigger ConditionFileIsExecutable=/usr/sbin/nginx. The generic empty-Conditions rule incorrectly rejects it. PM2 matches the 7.0.3 template; Production runner matches the official v2.337.0 template but has mode 0664. Registration read is unavailable; the independent reference is absent. PM2's separate all-directory PATH probe is false; its cause is unverified.
- Scope: accept only the independently pinned nginx unit plus its exact typed D-Bus condition and a fresh protected executable check; retain all unknown/additional-condition, drop-in, assertion, reference and runner gates.
- Evidence plan: official package/source, exact owner readout, executable positive/negative/redaction tests, current-head review/CI, normal deploy and installed audit. Production and Staging runners share this host; both need fresh idle evidence before reboot.
- Recovery: reviewed source revert through the existing isolated release deployment. No unit rewrite, permissions change, credential access, database action or extra backup in this package.
## FM-REG-003 — Admin access for confirmed registrations — 2026-09-15
- Status: IN_PROGRESS
- Risk: R4
- Change: FM-CR-041
- Lock: LOCK-FM-REG-003-ADMIN-CRM-ACCESS-20260915
- Owner decision: Daily is 1 EUR gross per day for future paying customers. The currently confirmed user is to receive immediate permanent free CRM access; the Admin must later be able to convert that same Workspace to a temporary end date or block access.
- Root cause: the Admin customer screen reads only `workspace_members`; a confirmed Auth user without a provisioned Workspace is therefore invisible. The registration flow intentionally separates free confirmed accounts from paid Workspace provisioning.
- Scope: server-only paginated Auth listing joined to existing profiles/memberships, idempotent free Workspace provisioning, permanent/temporary/blocked access transitions and admin audit. The separately authorized exact Production SQL rollout is complete; no automatic email confirmation, Stripe/Tax/payment/provider mutation or unrelated product work.
- Completed so far: the initial focused test failed before implementation and now passes. The bounded source adds paginated sanitized Auth visibility, the confirmation gate, idempotent owner Workspace/membership provisioning, permanent/temporary/blocked entitlement transitions, durable audit logging and no Stripe coupling. Fresh corrected-head local evidence: focused 6/6, targeted cross-boundary regressions 58/58, Operations 1376 pass/0 fail/4 environment skips, ESLint 0 errors/1 unrelated existing warning, Production build PASS, Product Truth PASS, Project Memory Quality PASS, Memory V8 PASS and both drift checks PASS.
- Exact next step: the real Admin-CRM login route is complete through #1136 / Production / same-account owner re-login. Do not repeat registration, grant or database rollout. Keep FM-REG-003 open only for the missing synthetic permanent -> future temporary -> blocked -> login/direct-read lifecycle; no additional real grants until that separate acceptance is completed.
- Owner browser evidence 2026-09-19: registration, confirmation, permanent Admin grant and the post-hotfix login all succeeded. The account reaches CRM rather than `/billing/start`. FM-CR-043 is closed as PRODUCTION_CONFIRMED.
- Review continuation 2026-09-15: PR #1132 head `daaf88372a06f063f7be2b95f6bbebbb95eec6ab` passed every current-head check, then the independent Codex review reported six valid findings: retired plan representation, later Stripe binding, non-atomic provisioning/audit writes, eager all-page Auth enumeration, missing expired-access read gate and UTC interpretation of date-only expiry. The bounded correction moves Workspace/membership/audit changes into one service-role-only transactional RPC, rejects commercial or provider-bound Workspaces, uses Starter CRM display state, fetches only the requested Auth page, gates application reads after block/expiry and resolves date-only expiry at Europe/Zurich end-of-day. Historical at that review point: the migration was source-only and unapplied. This was later superseded by #1134 acceptance and the separately authorized Production apply; do not repeat those pending steps.
- Second review continuation 2026-09-15: corrected head `a023ec3b33f91268daea4e3b3e4c4dc732c5aae6` passed every non-Mobile current-head workflow; Mobile alone is red from an unrelated new Expo patch expectation on unchanged main dependencies. The completed review reported five further findings. The next bounded correction adds a restrictive database entitlement boundary to every current RLS table with `workspace_id`, rejects and hides generic Billing/Test/Daily mutations for Admin-CRM Workspaces, queries Workspace ownership exactly for the current Auth page, records the contract in README/Source of Truth and adds a checksum-pinned rollout/runbook with explicit separate Production authorization and postflight. Historical at that review point: local evidence passed and no DB apply had occurred yet. The later #1134 + separately authorized Production apply supersedes that state.
- Third review continuation 2026-09-15: PR #1132 head `a2ad07fa713c8f40db63254986ca0ceb15ed9b6b` passed every non-Mobile current-head workflow; Mobile remained red only for the unchanged Expo patch expectation. The completed review reported six further findings. The bounded correction adds the restrictive entitlement policy to `workspaces`, a minimal inactive-state projection for safe paused-access routing, immediate temporary provisioning for a registration without a Workspace, hides generic customer-panel mutations, separates Admin CRM from public-demo feature blocking and removes browser execution from the two unguarded Creator mutation RPCs until they enforce the same entitlement. Historical at that review point: local source checks passed while CI/review and DB apply were still pending. #1134 and the separately authorized Production apply supersede those pending statements.

## FM-MOB-001 / FM-CR-042 — Expo patch CI correction
- Date: 2026-09-16
- Status: ACCEPTED
- Risk: R2
- Work lock: `LOCK-FM-MOB-001-EXPO-PATCH-CI-20260916`
- Baseline: current main `afcd6f53b2f3bf8c93b70b74076bac1c14df5306`; PR #1132 Mobile CI run `35034370024`, job `104599960180` proves Expo Doctor requires `expo ~57.0.23` and `expo-notifications ~57.0.19` while the remaining Mobile checks pass.
- Scope: compatible dependency and lockfile correction only. No Mobile behavior change, Production mutation, provider action, signing, artifact publication or Store submission.
- Completed so far: deterministic install resolves `expo@57.0.23` and `expo-notifications@57.0.19`; the complete local Mobile check, Android/iOS JavaScript exports, bounded dependency-audit policy and Project Memory controls pass.
- Exact next step: none for this already accepted source/CI patch. Preserve PR #1134 evidence; remaining Mobile work stays under FM-MOB-001 and is deferred by FM-DEC-021 until company registration plus explicit owner resume.
- Acceptance boundary: source/CI can close this bounded correction; a newer signed artifact and real-device/Store acceptance remain open under FM-MOB-001.
- Fourth review continuation 2026-09-18: integrated current main `9d6f2c6` (PR #1133) into the existing PR #1132 branch. The four current findings are corrected in source: rollout-order-independent Creator RPC/RLS entitlement enforcement, minimal inactive Workspace projection and stable `/workspace/access-paused` routing, Mobile cache validity capped at temporary Admin-CRM expiry, and an in-transaction rejection of memberships in any other Workspace. No Production SQL, deployment, payment, provider or live-user mutation occurred. Fresh exact-head CI and independent review remain required.
- PR #1134 closeout 2026-09-19: final head `65b8c34913db214ada3588fdcdd69e09b7f37e69` passed required PR checks/review and merged as `630aef3ccb53fed9b46284cb1d4bf1825a57687e`; Production deploy `35431328695` passed. With explicit owner authorization, exact Admin-CRM migration SHA-256 `7d1201fc5b45b571d2944b301eb1f5f197ea4f25ad643c8e8010d9d0ba3c1efd` applied once as `20260919081945 admin_crm_access`. Independent postflight proves service-role-only mutation RPC and 19 restrictive entitlement policies. No real user/payment/provider mutation occurred.

## FM-CREATOR-001 — confirmed-chat learning contract
- Date: 2026-09-19
- Status: VERIFIED
- Risk: R2
- Work lock: LOCK-FM-CREATOR-CONFIRMED-CHAT-20260919
- Baseline: local main snapshot `ccfe0ccef743e889d4ea16d454282cf66e465ed9`; repository remote and GitHub credentials are unavailable in this container, so remote PR/CI facts cannot be independently refreshed here.
- Scope: reconcile FM-CR-045/#1138 as Production-confirmed, then implement a repository-only deterministic confirmed-chat learning contract and synthetic quality metrics. Preserve one Creator/account/workspace/text style, strict tenant/fan/conversation identity, nullable unknown reaction/purchase, human-confirmed outbound evidence and no automatic send.
- Evidence plan: focused unit/negative tests, existing Creator regressions, lint/type/build, Project Memory guard/quality/status and final diff. No SQL Apply, provider/model call, real data, payment, Mobile or protected target mutation.
- Recovery: bounded source/docs revert; no external state changes.
- Completed so far: stale FM-CR-045 selection reconciled to the supplied immutable #1138 release receipt; selector now chooses Creator Intelligence. Pure validator and synthetic tests cover proposal/generation/revision binding, confirmed human outbound, cross-tenant/fan/conversation rejection, evidence-bound later reaction/purchase, nullable unknowns and deterministic edit metrics. Focused Creator tests, lint, generated-type-aware typecheck and Production build pass; Project Memory checks pass. Remote GitHub CI and independent Codex review remain unavailable until this branch is published through an authenticated repository connection.
- Exact next step: publish one canonical PR, obtain current-head CI/independent review, then merge/deploy only through the normal source workflow. After this bounded package, the next safe implementation is Creator deletion/privacy integration; no schema apply is implied.
## FM-AI-001-COST-GUARD-FOUNDATION-20260920
- Status: VERIFIED
- Risk: R3
- Lock: LOCK-FM-AI-001-COST-GUARD-20260920
- Owner: Codex Cloud
- Branch/PR: existing PR #1141, initial review head `8a6f71a6b2ccc5b1d3edbc8938b1d9f21a673622`; no new branch or PR.
- Scope: bounded repository-only provider-usage normalization, versioned server-price calculation and unconfigured monthly budget-decision foundation. No schema/RLS, provider, Stripe, Production or runtime-enforcement activation.
- Completed so far: exact cached/uncached/cache-write/output cost arithmetic, model/service-tier/time price selection, 79/80/99/100 boundary decisions and unconfigured-limit behavior tests. The three P2 review findings are corrected fail-closed: malformed supplied detail counters reject provider normalization, malformed configured budget limits throw the stable `invalid_budget_limits` error, and both the requested and every catalog `serviceTier` must be a concrete nonempty string before price resolution. Focused tests pass 14/14; Operations passes 1395/0 with three environment skips; lint passes with one pre-existing unrelated warning; Production build, Project Memory quality, accepted-state drift, truth drift and Next-Best-Action checks pass. Remote current-head CI/thread resolution and renewed independent review remain the exact next evidence steps.
- Still open: atomic idempotent Workspace-month reservation/ledger schema and controlled rollout, productive pre/post-call wiring, category persistence/admin projections, concurrency/provider-error/fallback integration tests, owner-approved tier limits and independent current-head CI/CodeQL/review.
- Exact next step: commit and push the correction to the same PR #1141, obtain exact-head CI/CodeQL, reply to and resolve the three genuinely fixed P2 threads, and request one `@codex review` on that exact head. Do not merge. Only after a final review without P1/P2 may #1141 be reported merge-ready.
- Owner action needed: final Standard/Plus/Ultra token, provider-cost and optional request limits; overage/fallback behavior remains a later commercial/legal decision.
## FM-CREATOR-001 — Delete / Privacy / Disclosure
- Status: IMPLEMENTED_FOR_PR; Risk: R3; lock: LOCK-FM-CREATOR-PRIVACY-20260920; owner: Codex.
- Baseline: verified `main` `32223a6f0fef1c000c1d64ef3fad13f8f6e8be08` after #1142 / Production deploy 35504957682. PR #1141 is fully superseded by #1142 and must not be reused; repository credentials are unavailable for closing it from this workspace. PR #1130 was diffed and its still-valid complete-disclosure implementation was selectively integrated, then reconciled with the newer Creator datasets already on main.
- Scope: owner-bound contact deletion, account/workspace deletion verification, complete fail-closed own-Workspace disclosure, secret stripping and synthetic cross-tenant/error regressions. No SQL/apply, Production/Staging/customer mutation, provider access, Creator activation, Mobile, Billing or automatic send.
- Completed so far: contact delete now requires the active owner/contact boundary and an exact workspace-filtered one-row delete; existing cascading FKs remove conversations/messages/summaries/memories/follow-ups/profiles/reports/reply targets and Creator commercial evidence. Account deletion now rejects request/workspace mismatch and verifies all active plus optional Creator data families are absent after auth/workspace cascade. Disclosure includes complete account/Workspace/CRM/Social/Creator persona/style/playbook/commercial data, preserves optional-not-installed honesty, fails closed on authorized-read errors and strips credentials.
- Still open: exact-head full tests/build, one PR, current-head CI/CodeQL, independent Codex review and merge/deploy. Creator runtime/UI activation, confirmed-chat persistence/API/database contract, real blinded quality and provider acceptance remain separate.
- Exact next step: publish exactly one bounded PR and obtain all current-head checks plus independent review; do not merge automatically. After merge, the next safe Creator task is repository-only confirmed-chat persistence/API design, with any schema target action separately authorized.
- Recovery: revert this bounded source/UI/test/memory patch; no external data or target was mutated.
- Owner action needed: none for source review. A maintainer with GitHub write access may close #1141 as superseded by #1142.
## FM-CREATOR-001 — PR #1143 Review-Hotfix
- Status: IN_PROGRESS
- Risk: R3
- Lock: LOCK-FM-CREATOR-PRIVACY-HOTFIX-20260920
- Owner: Codex Cloud
- Baseline: merged main `027d5a21ac41daae0331a0af2f9685d3729b2039` / PR #1143. Exactly one P1 and two P2 review findings remain; #1143 is not edited or reverted.
- Scope: ownership-transfer Account Delete retry, bounded secret-free Auth disclosure, and atomic exact-tenant Meta queue + Contact deletion contract. No Apply, runtime activation, provider, Mobile, Billing or unrelated Creator work.
- Completed so far: bounded source/tests and checksum-pinned offline SQL check prepared and committed on the single Hotfix branch. Focused deletion/disclosure/cross-tenant tests, 1,425 Operations policy tests (three documented PG/environment skips), lint, Production build and all local Project-Memory/drift/freshness/next-action controls pass. Browser E2E was attempted but the local Chromium binary is absent; remote Current-Head Browser E2E remains required. PR title/body were prepared through the required PR tool; this environment returned no remote PR number or remote CI state. Still open: actual remote PR publication/number, Current-Head CI/CodeQL and independent Codex review without P1/P2. No Staging/Production Apply.
- Exact next step: publish the prepared single Hotfix PR, obtain Current-Head checks and independent review, and do not merge until there are no P1/P2 findings. Creator Delete/Privacy/Disclosure remains unaccepted until the Hotfix is merged.

## FM-CREATOR-001 — PR #1144 post-merge review hotfix
- Date: 2026-09-22
- Status: OWNER_ACCEPTED_MERGE
- Risk: R3
- Lock: LOCK-FM-CREATOR-PRIVACY-POSTMERGE-20260922 RELEASED
- Result: bounded follow-up merged through PR #1160, final head `d354b200f4be6f81ce4a51616eb2f77e8e4b30d5`, owner-accepted merge `ae5a3bd2e8e75c9c9d4f55b821b2bbdaf1e452c6`; #1161 records the manual merge evidence.
- Boundary: do not reopen #1160. Its later P2 review observation is a new bounded scope below.

## FM-CREATOR-001 — crash-safe account deletion Workspace inventory
- Date: 2026-09-22
- Status: IN_PROGRESS
- Risk: R3
- Lock: LOCK-FM-CREATOR-DELETION-INVENTORY-20260922
- Owner: ChatGPT / connected GitHub
- Baseline: exact current main `3ec6115612f1e2b9cf58d2d2064fbb7a561b2f6b`; #1160 remains closed/owner-accepted.
- Scope: add the controlled/unapplied `owned_workspace_ids` column and service-role-only `begin_account_deletion_processing` RPC so request lock, current ownership selection, member/subscription blocker recheck, inventory persistence and `processing` transition are one DB transaction; consume only the RPC-returned inventory before Auth deletion, require the stored set for resume, and clear it after completion. Preserve null-Workspace requests and transferred historical Workspaces.
- Boundaries: repository-only code/tests/docs/memory; no controlled SQL Apply, no real account/customer deletion, no Staging/Production/provider/Billing/Restore/Mobile mutation.
- Evidence plan: controlled-contract checksum/static negatives, atomic SQL request/Workspace/member locks, authoritative `array_agg` snapshot, dynamic multi-Workspace RPC return, missing-contract fail-before-delete, missing-inventory resume failure, full Current-Head CI/CodeQL/Browser and one required independent review cycle.
- Exact next step: publish/review this single bounded inventory PR, fix only current-head findings, and merge under convergence when all checks/review are clean. Do not apply the controlled SQL in this task.
- Recovery: source/docs revert only; target schema remains unchanged until a separately protected authorized rollout.

## FM-CHATADMIN-001 — isolated multi-character Owner exception
- Date: 2026-09-20; Status: IMPLEMENTED_FOR_PR; Risk: R3; Lock: LOCK-FM-CHATADMIN-20260920; Owner: Codex Cloud.
- Baseline: exact main `93027f7cf04d7bff5a03b3ec3a3e39f0cc5fd334` after merged #1144; Deploy, Browser E2E, CodeQL, Supply Chain, Final Go-Live and runtime release were owner-confirmed successful. Read-only Production Audit remains separately red only for `production_audit_backup_latest_stale_or_empty`; no global green-audit claim and no Backup/Restore action in this task.
- Scope/result: isolated default-off one-Workspace capability, Character/Conversation/Message controlled schema, Owner/RLS/revision authorization, capability-hidden Web UI, manual OnlyFans copy/paste measured reply route, disclosure/deletion inventory and synthetic negatives. No apply, activation, provider login/API, Mobile, Billing, Meta, Admin or normal Creator semantic change.
- Still open: exact-head local verification, one PR, Current-Head CI/CodeQL/Browser E2E and independent Codex review without P1/P2. Do not merge automatically.

## FM-CHATADMIN-002 — controlled Staging rollout
- Date: 2026-09-20; Status: VERIFIED; Risk: R4; historical source lock released; Updated: 2026-09-26.
- Source/VERIFY/God Mode, Staging APPLY and synthetic DB/RLS ACCEPT are consumed. Successful ACCEPT evidence: run `36238536613`, attempt 2 / job `108396358120`, exact reviewed `7655aed2cae6ff3588207fee6f2227fd5b8db41c`; same-run schema VERIFY PASS, database acceptance PASS, manual flow OPEN, cleanup PASS.
- Independent target evidence after rollback: exact ChatAdmin tables/RLS remain present on Staging, capability/character/conversation/message row counts are 0/0/0/0, and Production has no ChatAdmin schema.
- Failed attempt 1 stopped before mutation at `fixture_identity`; the owner populated the protected synthetic fixture variables and the same exact action succeeded on rerun. The repository fallback PR #1188 was closed unmerged.
- No real capability grant, customer data, provider/Billing/Restore/Mobile mutation or automatic send occurred.
- Exact next step: distinct protected manual application-layer acceptance with synthetic Staging data and cleanup; Character -> manual Fan message -> exactly three revision-bound suggestions -> Copy -> manual-send handoff.

- Repository closeout publication: APPLY reconciliation PR #1187 final head `85b1b7e40cf1767c8439d7a32dd2c10ffc87ff8a` merged as `7655aed2cae6ff3588207fee6f2227fd5b8db41c`; ACCEPT reconciliation PR #1189 final head `8eee77b76a9273b9652920254d6d635cca6bbaf4` merged as current main `a1af8f5742958e5e666ae3f361e388b8a4cf922f`. Exact-head checks/reviews converged with no unresolved blocking thread. Manual application flow remains separately owner-gated.

## FM-GOV-GODMODE-001 — God Mode v1
- Date: 2026-09-21; Updated: 2026-09-22
- Status: ACCEPTED
- Risk: R3
- Lock: LOCK-FM-GOV-GODMODE-001-20260921 RELEASED
- Owner: ChatGPT / connected GitHub
- Publication: PR #1157 final head `79510c8bc35371aa657cf42ca7cded5810341d88` merged as exact main `1c5e1232f0893b0730a985c6e717b5c27c535f35`.
- Verified scope: bounded repository-only governance package: invariants, contracts, integration gates, impact map, fail-closed release decision, adversarial tests, synthetic golden flows, Post-Merge Guardian contract and CI integration.
- Post-merge evidence: Deploy, God Mode Gate, Browser E2E, CodeQL, Supply Chain and Final Go-Live Readiness passed on exact merge. Read-only Production Audit independently verifies the runtime/release and remains red only for the separate pre-existing backup-freshness Operations loop.
- Recovery: ordinary source revert; no Staging/Production/database/provider/Billing/Restore/Mobile state was mutated by this scope.
- Closed boundary: do not rebuild or reopen God Mode v1 for later hardening ideas. ChatAdmin APPLY is a distinct R4 protected owner/environment action.

## FM-GOV-EVENT-ORCH-001 — event-driven manager wake-up
- Date: 2026-09-24
- Status: IMPLEMENTED_FOR_PR
- Risk: R2
- Lock: LOCK-FM-GOV-EVENT-ORCH-001-20260924
- Owner: ChatGPT / connected GitHub
- Baseline: exact main `65c3a1266e37ac1a385caffff74745f25f54ddf3` after merged Builder Manager PR #1169; active product PR #1168 remains separate.
- Scope: repository-only event dispatcher and governance contract. A merged PR to `main` can wake a published FanMind Workspace Manager through the Workspace Agents API. The existing hourly Builder remains fallback.
- Safety: no Product/DB/Staging/Production/provider/Billing/Restore/Mobile mutation; no secret value stored in Git. Missing trigger configuration is a successful no-op, not an inferred authorization.
- External activation dependency: published Workspace Agent API channel ID plus Workspace Agent access token must be configured outside Git as documented.
- Exact next step: current-head CI/review for this bounded PR; after merge, provision the external trigger values and perform one manual 202-acceptance test before relying on event latency.


## FM-CREATOR-001 — post-merge authenticator service-role hotfix — 2026-09-24
- Status: IN_PROGRESS
- Risk: R3
- Lock: LOCK-FM-CREATOR-AUTHENTICATOR-SERVICE-ROLE-20260924
- Baseline: exact main a034d5517f1ad4846680b293a6b53645aa6bab69 after owner merge of PR #1168.
- Trigger: exact-head independent review of #1168 found one remaining P1: canonical Supabase/PostgREST authenticator SET-role membership into service_role is rejected by the verifier.
- Scope: repository-only allowlist of the exact non-inheriting, SET-enabled, non-admin authenticator -> service_role edge alongside the already reviewed authenticator -> authenticated edge, plus focused regression coverage.
- Safety: no SQL APPLY, no Staging/Production/provider/runtime/customer/Billing/Restore/Mobile mutation; no broad role relaxation; postgres membership remains unexcepted.
- Acceptance: focused regression, full current-head CI/CodeQL/Browser/God Mode, exactly one independent review cycle, P1/P2=0, no blocking threads, then normal PR merge and post-merge verify.
- Exact next step: consume current-head CI and exactly one independent review of PR #1171; if all required checks are green, P1/P2=0, no blocking threads remain and GitHub reports mergeable, merge normally, verify exact main, record success and release this lock.
