# FanMind Task Ledger

Use one heading per task/attempt. Never delete historical entries; supersede them explicitly.

## FM-MEM-001
- Date: 2026-08-19
- Status: DONE
- Goal: Introduce durable project memory and duplicate-work prevention.
- Starting state: Git/code history existed, but micro-attempts and conversational decisions were not systematically tracked in one operational ledger.
- Action: Added Project Memory Protocol v1 structure and PR guard.
- Result: Repository-level operational memory established.
- Evidence: `project-memory/` and `.github/workflows/project-memory-guard.yml`; V1 merged via PR #972.
- Next step: Extend the same system rather than creating a competing ledger.
- Do not repeat: Do not create a second competing memory system.

## FM-MEM-002
- Date: 2026-08-19
- Status: SUPERSEDED
- Goal: Add V2 open-loop/dependency/evidence/stale-scan model.
- Action: Built V2 in PR #973.
- Result: Functionality was retained but PR #973 was not merged independently; it was superseded by consolidated PR #975 to avoid stacked/divergent governance branches.
- Evidence: PR #973 history and V2 files now included in PR #975.
- Next step: Use the consolidated V6 system on `main`.
- Do not repeat: Do not reopen #973 as a parallel source of truth.

## FM-MEM-003
- Date: 2026-08-19
- Status: SUPERSEDED
- Goal: Add V3 standing authorizations and generated project status.
- Action: Built V3 in PR #974 and fixed generator/status drift plus hosted-checkout SHA pinning.
- Result: PR #974 was superseded by consolidated PR #975 rather than merged separately.
- Evidence: PR #974 history and V3 files incorporated into V6.
- Next step: Maintain V3 capabilities inside the consolidated memory system.
- Do not repeat: Do not merge/revive #974 independently.

## FM-MEM-004
- Date: 2026-08-19
- Status: SUPERSEDED
- Goal: Add mandatory execution policy, started-work tracking and stronger counterchecks.
- Action: V4 work was developed on the governance branch and then folded into later versions.
- Result: No separate final V4 integration; V4 is a historical stage inside PR #975.
- Evidence: `EXECUTION_POLICY.md`, STARTED_WORK/WORK_LOCK/receipt structures in PR #975 history.
- Next step: Use current protocol rules.
- Do not repeat: Do not create another V4-only branch/PR.

## FM-MEM-005
- Date: 2026-08-19
- Status: ACCEPTED
- Goal: Consolidate V2-V6 into one auditable FanMind Project Memory/governance and finishline-control system with independent counterchecks.
- Starting state: V2/V3/V4 work existed on stacked/divergent branches and FanMind had stricter CI/supply-chain controls.
- Action: Consolidated into PR #975; added authorizations, status/stale automation, STARTED_WORK, WORK_LOCKS, EXECUTION_RECEIPTS, ASSUMPTIONS, CONTRADICTIONS, QUALITY_CONTROL, Risk R1-R4, quorum, evidence freshness, negative/fail-closed paths, scope-diff guard, rollback/recovery proof, falsification and milestone closeout. Fixed SHA pinning, generated status drift and hosted checkout count expectations without weakening policy. Added exhaustive FanMind finishline audit. V6 added machine-readable `FINISHLINE_STATE.json`, `FANMIND_FINISHLINE.md`, Restore R4 state machine, external-acceptance register, derived sales-readiness gate, canonical-truth drift scanner and scheduled V6 checks inside the existing Project Memory Quality workflow.
- Result: V2-V6 governance and finishline controls were fully green on exact PR head `2a62dc8337673be0b33acfd4338d0f452224e779` and merged to `main` as `b4bef882a55e8c0dd1dd33d0ad1c1664c3078d0d`.
- Evidence: PR #975; Project Memory Guard, Quality V6 and Status success; FanMind CI success including PG17 authorization roundtrip, Operations tests and Production build; Landing success; Supply Chain success; CodeQL success; Browser E2E success for public no-write and synthetic regular-user core flow.
- Next step: Maintain V6 as the single memory/finishline system and continue `FM-RST-001` from `BACKUP_ACCEPTED -> HOST_REVALIDATED`.
- Do not repeat: Do not create a parallel memory/finishline system or bypass V6 gates.

## FM-STG-001
- Date: 2026-08-09 to 2026-08-19
- Status: ACCEPTED
- Goal: Establish and technically accept isolated Staging foundations without Production/Test mixing.
- Result: Separate Supabase Staging, separate web Staging runtime/runner path, DNS/TLS, required Staging schema foundations, Stripe Test Mode resources, synthetic isolated workspaces/users, Workspace/Daily contract, admin/browser acceptance and rollback-protected Referral/Billing lifecycle are recorded as completed in finishline #874.
- Evidence: Issue #874 Gate 1, Staging run references recorded there, current Source of Truth and merged Staging commits.
- Limitations: This acceptance does not imply Mobile signing, Plus/Ultra activation, Meta external E2E, Social E2E or Production social activation.
- Next step: Reuse this Staging foundation for the remaining acceptance gates; do not rebuild it.
- Do not repeat: Do not recreate Staging host/Supabase/Stripe test baseline absent verified drift.

## FM-RST-001
- Date: 2026-08-17 to 2026-08-26
- Updated: 2026-08-26
- Status: PARTIAL
- Goal: Complete isolated real restore drill.
- Starting state: Dedicated restore host, PostgreSQL 17 target, runner group/workflows, accepted backup tuple and protected environment already exist.
- Action: Protected read-only run `32582640853` first established baseline readiness through `TARGET_COMPATIBLE`. Exactly authorized database run `32594374666` then failed closed before its first target write and localized the missing five-extension prerequisite. After rollback-only predicate/ACL diagnostics, the owner separately authorized the final ACL-fingerprint-corrected extension-only controller on exact `main` `c627fc2d8956768091c88e3a3baaf0b882b8d2d6`.
- Result: the final controller's precommit receipt contract, mutation commit, full receipt contract, canonical ACL check and postcommit read-only postcheck all passed. The target now exposes all five required descriptors, extension fingerprint `6704956613ca8e58a527336d67b622a043e48a568858873ca5a6fa6b8bd08012` over 97 records and schema-ACL fingerprint `abedaf76740b6a7fc1e53433a41337a2f8248d79abfac4ac22c9cf835a1373e3`. No database Restore, target reset, JIT/workflow dispatch, Production write or Supabase-Staging write occurred.
- Later fail-closed attempt: exact owner authorization `5385992305` and controller SHA-256 `45054c41...` on reviewed `main` `618bce9...` reached only its local accepted-readiness/main-drift markers, then timed out on the first SSH connection to `138.124.213.66:22`. No remote preflight, JIT, protected approval, workflow dispatch, database connection or write occurred.
- Evidence: prior PRs #943/#987/#990/#991/#992/#997/#998; issue #944 comments `5381530143`, `5382274967`, `5382336892`, `5385843508`, `5385992305`, `5386014235`; readiness run `32582640853`; consumed database run `32594374666`; final extension controller PASS; owner-supplied 2026-08-26 controller output and source-order countercheck.
- Next step: obtain owner-PC public-IP/TCP-22 evidence, reconcile any exact Exoscale `/32` allowlist drift, then require a new exact R4 database-Restore authorization bound to the then-current reviewed `main` and fresh mutable runner/host/target/backup/TLS preflight.
- Do not repeat: no automatic retry/rerun of `32594374666` or controller `45054c41...`; no reuse of their JITs/authorizations; no repeat extension provisioning, target reset, quarantine deletion, host/PG/TLS rebuild or Production/Supabase-Staging target. Do not treat extension success as `DB_RESTORED`.

## FM-MOB-001
- Date: through 2026-08-19
- Updated: 2026-08-26
- Status: IMPLEMENTED_NOT_VERIFIED
- Goal: Deliver the native FanMind Mobile app through signed Android/iOS builds and real-device/store acceptance.
- Result: Native Expo/React-Native core, auth/recovery, SecureStore/Purge, contact CRUD/knowledge, AI, follow-ups, offline cache, push foundation, icon/splash/privacy/store metadata and CI/build-control paths are implemented and repository-verified. External signed-build/device/store acceptance is not complete.
- Evidence: Issues #584/#690; `apps/mobile`; mobile docs; current Source of Truth; PR #988; exact fail-closed preview run `33000433320`/job `98280538304`.
- Next step: owner/platform action `FM-MOB-OWNER-001` must configure the protected preview token/bindings and separately prove the Supabase redirect. Then run one new read-only preview check before any signing or build.
- Do not repeat: Do not restart the mobile app or replace it with a WebView.

## FM-MOB-002
- Date: 2026-08-29
- Status: ACCEPTED
- Risk: R3
- Goal: Make the stored sample conversation visible for the demo account's contacts and deliver an updated signed Android internal build.
- Starting state: the Staging demo workspace had 13 contacts and 37 RLS-protected `conversation_messages`; the installed Android preview could log in and show contact/profile/knowledge data, but the contact screen never queried or rendered message history.
- Action: added `listContactMessages(workspaceId, contactId)` with explicit workspace/contact filters and a 100-row bound, newest-first read-only message bubbles, explicit refresh, message-specific empty/error handling, no-auto-send disclosure, documentation and regression coverage.
- Result: PR #1019 passed final exact-head gates and merged as `ef0b7210c997558759a80c5ff46a7a5a0c005c3b`; protected run `33254230496` produced the exact-commit Android preview, and the owner then observed the visible history while identifying channel switching as a separate next change.
- Evidence: FM-EV-024; PR #1019; merge `ef0b7210c997558759a80c5ff46a7a5a0c005c3b`; protected build run `33254230496`; owner Mobile observation; bounded Staging data observation.
- Next step: FM-MOB-003; do not reopen or repeat FM-MOB-002.
- Do not repeat: do not create duplicate demo messages, weaken RLS, expose service-role credentials, add messages to the offline cache or claim the old APK contains this UI fix.

## FM-MOB-003
- Date: 2026-08-29
- Status: VERIFIED_NOT_ACCEPTED
- Risk: R3
- Goal: Complete the core phone demo loop with an unseen-message dashboard, per-fan channel switching and direct manual Follow-up creation.
- Starting state: the merged Android preview shows the stored messages, but mixes all channels, the start screen is a generic KPI page rather than an unseen-fan inbox, and Follow-ups can be created only after an AI suggestion.
- Action: derived per-fan channel tabs from stored messages, added an authenticated workspace-bound unseen-inbound fan query and Owner-only seen update, replaced the generic Start page with the unseen inbox, removed the rejected placeholder symbol from the shared wordmark, and added a validated Owner-only manual Follow-up form without schema, permission or demo-row changes.
- Result: PR #1021 passed all eight exact-head gates and merged as `93496a4afac9b3b315c9985afbbce02b8524fc44`; protected run `33260695232`, job `99122008690`, completed one verified `preview` Android internal build with Submit/Update disabled and cleanup successful. Repository and signed-artifact verification are complete; real-device owner acceptance is not yet complete.
- Evidence: FM-EV-025; PR #1021 final head `c4baed86bdcfd389a1f8ff5ce7752407113fb734`; merge `93496a4afac9b3b315c9985afbbce02b8524fc44`; run `33260695232`; job `99122008690`; local/native/read-only Staging evidence.
- Next step: install the existing exact-merge Android preview and verify the four requested Mobile behaviors; do not rebuild merely for device confirmation.
- Do not repeat: no new unread schema, no duplicate demo data, no offline message cache, no automatic message send and no member Follow-up mutation.

## FM-MOB-004
- Date: 2026-08-29
- Status: IMPLEMENTED_NOT_VERIFIED
- Risk: R3
- Goal: Finish the owner-observed Mobile fan-detail and navigation corrections and deliver a new exact-merge Android preview.
- Starting state: FM-MOB-003 is merged and built, but the fan detail still shows tags/profile before task navigation, identifier text can wrap, Follow-ups do not navigate back to their fan, today's Follow-ups are absent from Start and the wide splash wordmark is visibly cropped on Android.
- Action: add universal `Nachrichten|Follow-ups|Kontaktwissen` tabs, move profile/tags into knowledge, add provenance-bound fan-analysis read/prepared server action, add per-fan/today Follow-up queries and navigation, and replace the splash asset with a square `FM`-over-`FanMind` composition. Seven review passes then tightened the implementation: hide generation until Production capability activation; require complete provenance on Mobile and Web; permit legacy Web reads only after all new columns are individually proven absent; separate initial/post-create/dashboard/knowledge/analysis errors; select semantic priority groups before the exact paginated day-list cap with stable `created_at`/`id` boundaries and a last legacy fallback group; expose exact/truncated per-contact results; cap fallback-only analysis confidence low; map typed API plus inactive-Workspace failures to semantic statuses; treat legacy `NULL` status as open; paginate the central Follow-up list to completion; refuse analysis provider/write work without a valid source period; preserve service-failure precedence for capability reads; hide rejected conclusions; exclude undated messages from provider/provenance samples; and bind Bearer analysis to active owners only.
- Result: the first four successive heads passed all nine CI gates but were intentionally not merged because their reviews found six, four, six and three valid boundary/usability cases. Fifth head `c58ec12d2c93e046d3d25b12e4ae6a4dba3ed0ef` had eight green gates while Mobile Native CI was still running and was likewise superseded after three further valid review findings. Sixth head `a33875409abebd933ab325f8f14aa35bdaaf6617` passed all nine gates; after its automatic review failed technically, exactly one manual replacement review on the same head found three more valid cases. Seventh head `12994fd952137520bc1452c0dee25ddff6255a54` reached eight green gates while native CI was running and its exact-head review found two further valid cases. The seventh grouped correction is locally focused-green; final complete exact-head evidence remains pending.
- Evidence: FM-CR-005; active lock/receipt; PR #1025; superseded heads `2feba6f63d611a8461e2a9bb3402147f7fff8dd5`, `c7226cab1a991a514f3fd9d19e58b00e250135a4`, `67e02276ede02bb919088f3aa61e0e1343be52e0`, `cca0b7e2cc650b886a0a10653d49a15536e27d0a`, `c58ec12d2c93e046d3d25b12e4ae6a4dba3ed0ef`, `a33875409abebd933ab325f8f14aa35bdaaf6617` and `12994fd952137520bc1452c0dee25ddff6255a54`; twenty-seven valid review findings addressed rather than bypassed.
- Next step: complete the local matrix, publish the final corrected head, resolve the two review-seven threads, require green final exact-head CI and a clear exact-head review, merge and queue exactly one preview Android build.
- Do not repeat: no schema or demo-data creation, no client service-role/OpenAI key, no automatic send, no member mutation and no second build while queue/completion state is uncertain.

## FM-AI-001
- Date: through 2026-08-19
- Updated: 2026-08-26
- Status: PARTIAL
- Goal: Close KI Standard/Plus/Ultra product, quality, cost, Stripe-lifecycle and activation evidence.
- Result: Standard is part of the active core. Current exact-main protected read-only evidence confirms the dedicated synthetic AI resource, both Plus/Ultra Test prices, the complete five-price Test catalog, exact enabled 22-event Staging webhook and installed empty AI event ledger with forced-RLS/function-only write boundary. The 50/100/150 context policy is already accepted. Plus/Ultra remain intentionally not productively active.
- Evidence: FM-EV-022; `AI_BILLING_READONLY_RECONCILIATION_2026-08-26.md`; runs `33003378162`/`33003452287`/`33003526741`; `src/config/aiTiers.mjs`; Source of Truth; issue #560; issue #874 Gate 4.
- Next step: owner decisions/private evidence under `FM-AI-OWNER-001`; separately authorize the general Billing ledger/cutover and one current post-ledger transactional lifecycle acceptance under `FM-AI-OWNER-002`; then legal/tax, runtime integration and explicit Production activation if approved. First resolve the bounded Stripe client/payment-method/API-version conformance review in code without provider mutation.
- Do not repeat: Do not invent models/quotas or activate Plus/Ultra through a merge alone.

## FM-META-001
- Date: through 2026-08-19
- Updated: 2026-08-26
- Status: PARTIAL
- Goal: Finish Meta Events Manager, Meta external acceptance and final Meta/Security evidence.
- Result: Consent-gated parameterless PageView-only Pixel behavior is Production-confirmed. The 2026-08-26 exact-main protected read-only evidence confirms that the isolated Staging conversation-continuation and catch-up objects are present with the observed RLS/ACL/index/function boundaries and disabled runtime gates; it does not independently prove the ledger-managed continuation timestamp, while the controlled queue is intentionally ledger-free. Its mutable current-state claim is TTL-bound through `EV-META-STAGING-FOUNDATION-20260826`. Meta Facebook/Instagram foundations remain advanced. External Events Manager/Test Events, provider-side no-PII confirmation, App Review/permissions, real account/webhook/conversation E2E and required legal acceptance remain open.
- Evidence: FM-EV-007; FM-EV-023; `META_TECHNICAL_READONLY_RECONCILIATION_2026-08-26.md`; runs `33007156552`/`33007311870`/`33007481167`; issue #714; Source of Truth.
- Next step: external owner-controlled normal-browser Events Manager positive/negative/no-PII acceptance and legal review; later real Facebook/Instagram App Review/E2E in the Social gate. Any provider event, SQL Apply or runtime activation remains separately authorized.
- Do not repeat: Do not rerun the three FM-EV-023 workflows merely to close this task, repeat Production ENV/build/deploy, or re-add CompleteRegistration/Lead, Advanced Matching or CAPI without new technical/legal approval. Once the registered Staging evidence expires or before a later protected database action, use a new lock and fresh shared rollout-state-first revalidation.

## FM-SOC3-001
- Date: 2026-08-19 reconciliation of prior work
- Updated: 2026-08-20
- Status: PARTIAL
- Goal: Real technical acceptance of Phase 3 — Facebook, Instagram and WhatsApp.
- Result: Facebook/Instagram foundations are advanced; WhatsApp dormant inbound foundation is merged. None of the three has the final real external Phase-3 E2E acceptance required for sales handoff.
- Evidence: Source of Truth, issue #874 Gate 6, Meta/WhatsApp commits including dormant WhatsApp merge `e7b46bd...`.
- Next step: after non-Social gates are sufficiently closed, perform Facebook E2E/App Review, Instagram E2E/App Review and WhatsApp Staging/Meta/E2E/Production acceptance with tenant/idempotency/revocation/reconnect/no-auto-send evidence.
- Do not repeat: Do not rebuild Facebook/Instagram foundation from zero; do not expose fake active badges before real acceptance.

## FM-SOC7-001
- Date: 2026-08-19 reconciliation of prior work
- Updated: 2026-08-20
- Status: PARTIAL
- Goal: Real technical acceptance of Phase 7 — TikTok, X/Twitter, Discord and conditional OnlyFans.
- Result: Platform feasibility has been partially researched/documented; no complete real Phase-7 connector acceptance exists.
- Evidence: Issue #874 and its platform-feasibility comment.
- Next step: after Phase 3/non-Social gates, verify official TikTok scope, X Developer/API prerequisites/cost approval, implement official Discord bot/guild connector, and decide OnlyFans feasibility strictly from official/contractual basis.
- Do not repeat: No scraping, self-bot, reverse engineering or unofficial bypass.

## FM-SALES-001
- Date: 2026-08-19 reconciliation of prior work
- Updated: 2026-08-20
- Status: BLOCKED
- Goal: Technical sales handoff to Gerhard with production truth aligned to actual sellable scope.
- Blocked by: real technical acceptance of required Phase-3 and Phase-7 channels and final finishline evidence.
- Result: Sales materials and demo script exist, but technical sales handoff is not yet valid under the current canonical finishline.
- Evidence: Source of Truth Roadmap/Go-Live sections, issue #874 Sales Handoff, commit `74c3a6aa357215c52d3a4d9b01ba8513bba1b57f` aligning sales-handoff truth.
- Next step: close required gates, run final 5-minute Production demo/sales flow on exact release, synchronize sales materials/roadmap, then record handoff.
- Do not repeat: Do not call Phase 4 or an existing sales document a completed sales handoff.

## FM-LEGAL-001
- Date: through 2026-08-19
- Updated: 2026-08-20
- Status: BLOCKED
- Goal: External legal/tax/AVV completion where required.
- Result: technical/public reader framework and confirmed operator data exist; external legal, tax, registration and final AVV/provider evidence remains incomplete.
- Evidence: Issue #564 and legal evidence framework.
- Next step: incorporate only actual advisor/register/provider evidence; no guessing.
- Do not repeat: Do not treat technical checks as legal approval.

## FM-OPS-001
- Date: through 2026-08-19
- Status: VERIFIED
- Goal: Production operations, monitoring, backups, audit and deployment baseline.
- Result: Core Operations/backup/deploy/audit/monitoring foundation is production-proven. Optional/destructive follow-ups remain separately controlled.
- Evidence: Issues #524/#534 and Production operations run history.
- Limitations: full Restore remains FM-RST-001; Remote offsite delete #658 is not authorized; optional email/failure-matrix items are not blanket-complete.
- Next step: maintain, do not rebuild.

## FM-MEM-008
- Date: 2026-08-19 to 2026-08-20
- Status: ACCEPTED
- Risk: R3
- Goal: Add Project Memory V8 cross-chat reconciliation, impact-scoped revalidation, owner-action inbox and automatic handoff without weakening existing V6/V7 finishline controls.
- Branch/PR: `project-memory-v8-crosschat-impact` / PR #980.
- Implementation evidence: final exact PR head `704fec4b6264dd5a0dd83cc8e0029352672485d0` contained the V8 controls plus corrected V5 bookkeeping and generated status.
- Verification evidence: Project Memory Guard, Project Memory Quality, Project Memory Status, FanMind CI, Landing Language CI, Supply Chain Security and CodeQL all passed on that exact head.
- Independent countercheck evidence: Browser E2E run #915 passed on the same exact head after the earlier cancelled-browser attempt was explicitly rejected as insufficient evidence.
- Result: PR #980 squash-merged to `main` as `22eb6aed5da4fde47860bbe12b118d3780c8a4a0` only after the complete exact-head gate set was terminal green.
- Status path: IMPLEMENTED -> VERIFIED -> COUNTERCHECKED -> ACCEPTED.
- Negative/fail-closed path: chat claims remain non-evidence; stale success downgrades to revalidation; owner/provider-only actions remain deferred; V8 does not bypass V6/V7 gates or mutate product/runtime/provider state.
- Rollback/recovery: governance-only changes can be reverted to the last accepted V6/V7 baseline without altering product/runtime/provider state.
- Falsification question: What observation would prove our conclusion wrong? A current V8 quality/status failure, evidence that automatic handoff contradicts stronger repository/runtime truth, or evidence that V8 weakens an existing finishline/security invariant would reopen the task as `RECONCILIATION_REQUIRED`.
- Next step: maintain V8; do not reopen PR #980 or create a parallel memory system.

## FM-SEC-001
- Date: 2026-08-20
- Status: RECONCILIATION_REQUIRED
- Risk: R3
- Goal: reconcile current live Supabase security-advisor posture with the repository's controlled hardening design and finishline before any Production/Auth mutation.
- Starting state: fresh Production/Staging targets are `ACTIVE_HEALTHY`, but current advisors expose unresolved warnings.
- Production evidence: three trigger helpers still report mutable `search_path`; retired `trim_conversation_messages_to_latest_50()` is still reported as `SECURITY DEFINER` executable by `anon` and `authenticated`; leaked-password protection is disabled. `supabase/controlled/20260806203023_harden_trigger_function_privileges.sql` and `docs/operations/TRIGGER_FUNCTION_HARDENING_PRODUCTION.md` already define a checksum-pinned, transactional, fail-closed Production remediation, but the live advisor state shows that accepted post-apply state is not currently proven.
- Staging evidence: `ensure_current_user_workspace(...)` is reported as authenticated-callable `SECURITY DEFINER`; repository migration explicitly grants that call to `authenticated` and validates `auth.uid()/auth.role()` while deriving commercial terms server-side, so it is an intentional-exception candidate rather than an automatic revoke. Leaked-password protection is also disabled.
- Informational RLS findings: multiple service-only/internal tables have RLS enabled with no browser policies; current Production hardening runbook explicitly warns not to invent browser policies merely to silence these INFO advisories.
- Independent evidence class: live Supabase security advisors on both exact targets, separate from repository code/CI.
- Negative/fail-closed path: no broad grants, no artificial browser RLS policies, no trigger Apply if target/commit/checksum/ACL preflight drifts, and no Auth-setting acceptance inferred from code.
- Rollback/recovery: use only the existing transactional controlled Production runner/postflight for trigger hardening; any Auth-setting change requires a separately documented reversible provider action.
- Related issue: #982.
- Falsification question: What observation would prove our conclusion wrong? A fresh advisor/catalog/ACL read showing Production already hardened, or evidence that the controlled migration/runbook no longer matches the deployed target, would invalidate this baseline and require a new reconciliation before mutation.
- Next step: run the existing read-only Production hardening verify against the exact deployed commit; separately review the Staging RPC exception and leaked-password setting; do not Apply/mutate under this reconciliation task.
- 2026-08-26 refresh: FM-EV-019 reconfirmed the same live Production/Staging advisor and exact function/ACL state with no drift. The offline Production hardening contract is ready; the protected exact-deployed-commit verify, exception acceptance and Auth-setting decision remain open. No provider mutation occurred.
- 2026-08-26 protected verify: exact run `32997946812` job `98271985321` on deployed `5cb9c193e262f8939b5fc0c700fce154dde616e6` passed preflight/postflight audits and returned the expected read-only `hardening_not_ready` pre-state. Fresh advisors were unchanged; 24/24 focused Staging tests classified the authenticated workspace RPC as constrained intentional exposure pending explicit exception acceptance. Apply and Auth settings remain separately owner-deferred; no provider mutation occurred.
