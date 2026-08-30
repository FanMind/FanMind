# Work Locks

Prevents two agents/sessions from independently working the same task.

## Rules
- Acquire a lock before substantive implementation.
- One active lock per Task ID.
- A second worker must inspect the existing lock and continue/coordinate rather than restart.
- Locks older than 24h are STALE, not free: reconcile `STARTED_WORK.md`, PRs, commits and receipts before replacing.
- Release only after updating `STARTED_WORK.md` and the execution receipt.

## Active locks

# LOCK-FM-MOB-001-ANDROID-STORE-20260830
- Task: FM-MOB-001 / FM-CR-006
- Status: ACTIVE
- Holder: ChatGPT Android/Apple Store preparation continuation session 2026-08-30
- Branch/PR: `mobile/dual-store-prep-20260830`; prior handoff PR #1030 and Store implementation PR #1028 are merged.
- Acquired: 2026-08-30 UTC
- Risk: R3 Mobile Production build and external Store acceptance
- Scope: preserve the first-release version, protected one-AAB Production evidence and exact FanMind Production binding; complete repository-only Google/Apple Store graphics, metadata, support, review/tester and screenshot-plan preparation. Android recovery/full device acceptance begins only after Play-test-track installation. No automatic Submit/Update, no second Android build, no iOS build/signing/TestFlight, no fabricated device evidence, no database/schema/RLS mutation and no push-delivery activation.
- Current blocker: Google is still reviewing the developer identity/documents; phone verification and Play app creation are disabled until that review completes.
- Completed under this lock: PR #1028 passed its exact-head gates and merged as `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00`; Production readiness run `33316105624` / job `99269748215` passed, and Store-build run `33316172583` / job `99269924756` completed exactly one verified Android `1.0.0` AAB with Submit/Update disabled, redacted receipt and cleanup. FM-EV-030 added the private evidence preparer; FM-EV-031 prepares dual-store assets/metadata/support and extends the validator to bind the later Play-installed device proof to that exact Android Production/Store receipt.
- Resume from: never repeat the AAB build. After Google approval, verify phone/account state, create the Play app record, transfer the prepared package and upload the existing AAB to the required test track. Only after the Play download is available, use the private preparer and complete all 19 real-device/Recovery checks plus real screenshots. Apple signing/build/TestFlight/device work waits for Phase 8. Require immediate confirmation before any review submission or publication.

## LOCK-FM-MOB-004-FAN-SECTIONS-20260829
- Task: FM-MOB-004
- Status: RELEASED
- Holder: ChatGPT Mobile fan-sections/analysis/follow-up/splash session 2026-08-29
- Branch/PR: `feat/mobile-fan-sections-analysis-followups-splash-20260829` / #1025; final head `64329ac628188cf532281ddb742058612b9e9eb8`, merge `6a2f5b6c9bac1607ecc2ccae11c6ade3cb418522`.
- Acquired: 2026-08-29 Europe/Vienna
- Risk: R3 Mobile authenticated reads/AI action plus signed Android preview
- Scope: three fan sections, one-line identifier, provenance-bound stored fan analysis with Web/Mobile capability-, processing-entitlement- and full-schema-gated generation clearly marked as preparation, active-owner-only Bearer mutation, no write without a valid fully dated source period, rejected-conclusion hiding and prompt exclusion, typed capability failures, parallel fail-closed legacy probes and error-gated empty/count state, fan-bound/today Follow-up navigation with explicit error/count/truncation handling, legacy-null-open semantics plus complete focus-refreshed central pagination, corrected splash, exact-head checks, merge and one replacement Android preview.
- Resume from: merged FM-MOB-003 foundation on current `main`; extend existing RLS, owner-only mutation and server AI controls without recreating them.
- Safety: no automatic sending, service-role key in Mobile, offline message/analysis cache, schema/demo-row/provider/Production mutation, iOS submission or Store publication is authorized.
- Released: 2026-08-30 after all nine exact-head gates passed, #1025 merged and protected run `33298699290` / job `99222705186` completed one verified exact-merge `preview` Android artifact with receipt and cleanup.
- Accepted: owner real-device acceptance completed on 2026-08-30 for the exact FM-MOB-004 Android Preview. Do not resume this lock; a newly observed defect requires a new bounded task and does not authorize an automatic rebuild, schema change, provider activation or duplicate demo data.

## LOCK-FM-MOB-003-FAN-INBOX-20260829
- Task: FM-MOB-003
- Status: RELEASED
- Holder: ChatGPT Mobile fan-inbox/channel/follow-up completion session 2026-08-29
- Branch/PR: `feat/mobile-fan-inbox-channel-followup-20260829` / #1021; final head `c4baed86bdcfd389a1f8ff5ce7752407113fb734`, merge `93496a4afac9b3b315c9985afbbce02b8524fc44`
- Acquired: 2026-08-29 Europe/Vienna
- Risk: R3 Mobile read/seen state plus signed Android preview build
- Scope: dynamic message-channel switch for every contact, unseen-inbound-only start dashboard, manual owner Follow-up creation in the contact detail, exact-head checks, merge and one replacement Android preview; no schema/provider/Production mutation.
- Resume from: existing message-history UI on merged `main` `ef0b7210c997558759a80c5ff46a7a5a0c005c3b`; use existing `seen_at`, authenticated RLS and owner-only Follow-up contracts.
- Safety: no automatic sending, service-role key, offline message cache, new demo rows, schema migration, Production deploy, provider activation, iOS submission or Store publication is authorized.
- Released: 2026-08-29 after terminal-green merge and protected Android run `33260695232` / job `99122008690` completed one verified exact-merge preview artifact with cleanup.
- Accepted: the owner's 2026-08-30 real-device acceptance of the superseding exact FM-MOB-004 Android Preview confirms FM-MOB-003. Do not resume this lock; a newly observed defect requires a new bounded task and does not authorize an automatic rebuild, schema change or duplicate demo data.

## Released locks

# LOCK-FM-AI-001-STRIPE-CONFORMANCE-20260830
- Task: FM-AI-001 / FM-CR-009
- Status: RELEASED
- Holder: ChatGPT Stripe code-conformance continuation session 2026-08-30
- Branch/PR: `feat/stripe-client-conformance-20260830` / #1035; final head `ffdc11ab4a1c199134dc009abc516cc8257f5e8b`, squash merge `9a7b37f2cee798dc64c1d32f70fda338db174b5e`
- Acquired: 2026-08-30 UTC
- Risk: R3 billing runtime code with all external/provider actions excluded
- Scope: replace production server-side raw Stripe REST calls with one current SDK client contract, remove explicit Checkout payment-method narrowing, add a per-session eight-letter integration identifier, preserve fail-closed tax readiness and regression-test cancellation/referral safety. The verified Staging webhook endpoint remains pinned at its observed inbound version until a separately authorized provider migration.
- Safety: no Stripe/provider read or write, payment/refund, price/coupon/subscription mutation, webhook endpoint update, SQL/database mutation, protected workflow, Plus/Ultra activation, Production configuration or Mobile build/store action was authorized or performed.
- Released: 2026-08-30 after all eight exact-head workflows passed, final review completed with zero unresolved threads and #1035 merged as `9a7b37f2cee798dc64c1d32f70fda338db174b5e`.
- Resume from: do not revive this lock or rerun the three FM-EV-022 protected jobs. Remaining product/private/provider/lifecycle work requires the existing `FM-AI-OWNER-001`/`002` gates and a new scoped lock.

## LOCK-FM-MOB-002-CONTACT-HISTORY-20260829
- Task: FM-MOB-002
- Status: RELEASED
- Holder: ChatGPT Mobile demo conversation-history completion session 2026-08-29
- Branch/PR: `fix/mobile-contact-message-history-20260829` / #1019; implementation head before Project Memory reconciliation `d7bb661d4ed2ed74b656c0ee2d822cb7396d5a8a`
- Acquired: 2026-08-29 Europe/Vienna
- Risk: R3 Mobile data display plus signed Android preview build
- Scope: display existing RLS-protected contact messages read-only, pass exact-head checks, merge and produce one replacement signed Android internal build; no database/provider/Production mutation.
- Released: 2026-08-29 after #1019 merged as `ef0b7210c997558759a80c5ff46a7a5a0c005c3b`, protected build run `33254230496` finished and the owner confirmed the history-visible state by identifying the remaining per-channel navigation gap.
- Resume from: do not revive this lock; channel/dashboard/manual-Follow-up scope belongs to FM-MOB-003.
- Safety: no automatic message sending, service-role key, offline message cache, database schema/row write, Production deploy, iOS submission, Store publication or unrelated provider mutation is authorized.

## LOCK-FM-META-001-TECHNICAL-RECONCILIATION-20260826
- Task: FM-META-001
- Status: RELEASED
- Holder: ChatGPT Meta technical read-only reconciliation session 2026-08-26
- Branch/PR: evidence `meta-technical-reconciliation-20260826` / #1014, evidence head `5b63b1e2de8fc37daaef5f26451d4f037d9cf65f`, final exact head `12a479f00cce95d0031970c98c2d3933477ab804`, squash merge `ec1f196e82ab64a3b39b69a22a7b81b0757aa7a4`; repository-only closeout #1015 head `355f1ce580045598527c51bff49d2a52c80275df`, merge `d727b53470653844b50fa6a4ca2fc98f7fb2c89b`; canonical freshness follow-up `meta-canonical-freshness-fix-20260826` / #1017, evidence head `dd8246efe399f03180c675b245cc7277d46060ca`.
- Acquired: 2026-08-26 Europe/Vienna
- Released: 2026-08-26 after #1014 passed all seven triggered exact-head checks and merged, then repository-only closeout #1015 merged; no protected action was repeated.
- Risk: R3 protected Staging evidence and canonical-reader reconciliation; read-only checks only
- Scope: reconciled Pixel/no-PII/security tests and the 2026-08-26 Meta Staging foundations against exact GitHub `main` `966ffe3b105321e1350ec8c4fdb111341e99dd83`; exactly one permitted run each of the three protected read-only workflows and one transaction-level read-only catalog query produced FM-EV-023.
- Runtime result: runs `33007156552`/`98303773974`, `33007311870`/`98304322162` and `33007481167`/`98304886826` passed once; 95/95 focused tests passed. Continuation and queue schemas are present in isolated Staging, while worker/analysis activation, synthetic queue acceptance, provider E2E, legal acceptance and Production remain open. Mutable Staging evidence is tracked by `EV-META-STAGING-FOUNDATION-20260826`.
- Process result: FM-FAIL-015 preserves that the direct query preceded the mandatory shared rollout-state classification. It was server-enforced read-only and rolled back; the later shared state was `PASS`; no query or workflow was repeated. Any later Meta Staging database action requires a new lock and fresh same-commit/same-target rollout-state classification first.
- Safety: no Meta consent grant or PageView emission, Meta Events Manager/App Review/account/OAuth/token/provider call, SQL Apply, rollback-only acceptance, worker/queue/runtime activation, Production deploy/configuration, Supabase row/schema write, Restore/Mobile/AI/Security mutation or legal decision occurred.
- Resume from: do not revive this lock. External work is deferred to `FM-META-OWNER-001`; after freshness expiry/invalidation or before another Meta Staging database action, acquire a new lock and revalidate shared rollout state first.

## LOCK-FM-AI-001-READONLY-RECONCILIATION-20260826
- Task: FM-AI-001
- Status: RELEASED
- Holder: ChatGPT AI/Billing read-only reconciliation session 2026-08-26
- Branch/PR: evidence `ai-billing-readonly-reconciliation-20260826` / #1012, final exact head `b53e000228bf99801b327c1d7b81646edce32d6f`, squash merge `d1b9d7e94b3bc78a1720e197a795a105bdcc1883`; repository-only closeout `ai-billing-readonly-reconciliation-closeout-20260826` / #1013.
- Acquired: 2026-08-26 21:01 Europe/Vienna
- Released: 2026-08-26 after the final head passed all 10 Guard/Quality/Status, Landing, FanMind CI including PostgreSQL 17, CodeQL and Browser E2E checks; issues #560/#874 were updated and #1012 merged SHA-bound.
- Risk: R3 protected Staging/Stripe evidence collection; read-only database and provider checks only
- Scope: bound the current AI entitlement ledger, all five isolated Stripe Test prices, exact Staging webhook and synthetic AI resource boundary to exact `main` `2f8d9ca989e87ad88a76a514308618a9ce5d6fbb` through exactly three read-only runs.
- Runtime result: runs `33003378162`/`98290675487`, `33003452287`/`98290922265` and `33003526741`/`98291186923` each passed once; issue #560 comment `5429960286` and issue #874 comment `5429960711` record the classification.
- Safety: no Plus/Ultra activation, product/price/webhook mutation, payment, refund, Tax registration, SQL Apply, transactional lifecycle acceptance, runtime-ledger activation, Production/Restore/Mobile/Security mutation or Supabase write occurred.
- Resume from: do not revive this lock or rerun its three jobs. Remaining AI work is owner/protected under `FM-AI-OWNER-001`/`002`; the generated parallel-safe task is `FM-META-001`.

## LOCK-FM-MOB-001-PREVIEW-READINESS-20260826
- Task: FM-MOB-001
- Status: RELEASED
- Holder: ChatGPT Mobile preview read-only readiness session 2026-08-26
- Branch/PR: `mobile-preview-readonly-readiness-20260826` / #1010; final exact head `15fca01adae6f4934c7b729512a14b8ccc926383`, squash merge `e6b3d9715726ede77ce7230cefa824edba16b2d4`
- Acquired: 2026-08-26 20:30 Europe/Vienna
- Released: 2026-08-26 after exact-head Guard/Status/Quality, Landing, FanMind CI, CodeQL and both Browser E2E jobs passed, issue #690 comment `5429569941` recorded the blocker, and #1010 merged.
- Risk: R3 external resource evidence; protected read-only Expo/EAS lookup only
- Scope: reconciled five historical fail-closed runs and exactly one current `preview` run `33000433320`/job `98280538304` on `main` `32c08ba6877d6aaaf61110c02464ee95d6bc6301`; the run failed closed on missing protected configuration.
- Safety: no EAS build, signing, submit, update, project initialization, credential creation, Supabase/Auth/DB change, Store action, Restore/JIT/controller retry or Production/Supabase-Staging data write occurred.
- Resume from: do not revive this lock or rerun `33000433320`. Mobile is owner-deferred to `FM-MOB-OWNER-001`; the generated safe task is AI/Billing read-only reconciliation.

## LOCK-FM-SEC-001-PRODUCTION-VERIFY-20260826
- Task: FM-SEC-001
- Status: RELEASED
- Holder: ChatGPT protected Production read-only verification session 2026-08-26
- Branch/PR: `security-production-readonly-verify-20260826` / #1008; final exact head `ed64255f3786eea257011778a40492d6c7c9447e`, squash merge `4efb4eeef07d850fd0fd9117244187cf94bfed41`.
- Acquired: 2026-08-26 20:02 Europe/Vienna
- Released: 2026-08-26 after exact-head Guard/Status/Quality, FanMind CI, Landing, CodeQL and Browser E2E passed, issue #982 comment `5429302086` recorded the evidence, and #1008 merged.
- Risk: R3 protected Production evidence collection; read-only database verification and repository evidence only
- Scope: bound the checksum-pinned Production trigger-function hardening verifier to exact deployed `main` `5cb9c193e262f8939b5fc0c700fce154dde616e6`, ran exactly one `verify`, and reconciled preflight/action/postflight/provider evidence.
- Safety: no `apply`, SQL/Auth/RLS/ACL/provider mutation, Restore/JIT/controller retry or Production/Supabase-Staging write was authorized or performed.
- Resume from: do not revive this lock or rerun verify. Protected Apply and Auth/exception decisions are separately owner-deferred as `FM-SEC-OWNER-001`/`002`; the generated safe task is Mobile read-only reconciliation.

## LOCK-FM-SEC-001-READONLY-REFRESH-20260826
- Task: FM-SEC-001
- Status: RELEASED
- Holder: ChatGPT read-only Supabase security refresh session 2026-08-26
- Branch/PR: `security-readonly-refresh-after-timeout-20260826` / #1006; exact head `d9408c825aa735c5062a87cfc1b927312d094ad3`, squash merge `78333aae9d075a67a2d550a266d24cb8b9f443a4`.
- Acquired: 2026-08-26 Europe/Vienna
- Released: 2026-08-26 after #1006 passed every exact-head gate, merged, and issue #982 comment `5428919200` recorded the read-only result.
- Risk: R3 evidence reconciliation; provider reads and repository documentation only
- Scope: refresh Production/Staging advisor and exact function/ACL evidence, compare it with the existing controlled hardening contract, and preserve the separate mutation boundary.
- Safety: no SQL Apply, Auth setting, grant, RLS policy, Production/Staging write or other provider mutation was authorized or performed by this lock.
- Resume from: acquire a new scoped lock for the protected exact-deployed-commit verify or any separately authorized owner/provider action; do not revive this evidence-refresh lock.

## LOCK-FM-RST-001-SSH-TIMEOUT-RECONCILIATION-20260826
- Task: FM-RST-001
- Status: RELEASED
- Holder: ChatGPT Restore SSH-timeout reconciliation session 2026-08-26
- Branch/PR: `restore-ssh-timeout-reconciliation-20260826` / #1005; exact head `9ce6c0746fa61072eb507bce6d511f952a42b8e8`, squash merge `dd9d986c387040b213355e0ba1bf60ce31fa7b32`.
- Acquired: 2026-08-26 Europe/Vienna after exact controller SHA-256 `45054c41143e33fce4406aea30478e43ed5280a36e1b339d0cc9c38df71ae946` stopped at its first SSH call with a TCP timeout.
- Released: 2026-08-26 after #1005 passed every exact-head gate, merged, and issue #944 comment `5428771745` recorded the fail-closed result.
- Risk: R4 evidence reconciliation; repository documentation and read-only provider checks only.
- Scope: record the owner authorization, controller attempt, pre-SSH/pre-JIT/pre-dispatch failure, preserve `TARGET_COMPATIBLE`, and define the owner-only connectivity and later reauthorization boundary.
- Resume from: no Restore controller retry. First obtain the Windows public-IP/TCP-22 result, then reconcile the Exoscale `/32` allowlist through a separately authorized provider action if required.
- Safety: this lock authorized no database Restore, target reset, JIT, workflow dispatch, environment approval, Production/Supabase-Staging write or Exoscale security-group mutation.

## LOCK-FM-RST-001-EXTENSION-BASELINE-EVIDENCE-20260823
- Task: FM-RST-001
- Status: RELEASED
- Holder: ChatGPT extension-baseline evidence closeout session 2026-08-23
- Branch/PR: `restore-extension-baseline-evidence-20260823` / #997; exact head `6642c3c95bbb33f9a4b5f5a36afa068798e252e8`, squash merge `733e2f12464f746ee5dff0be71defe22d18ce33a`.
- Acquired: 2026-08-23 13:53 Europe/Vienna after the final controller reported committed provisioning plus complete read-only postcheck PASS.
- Released: 2026-08-23 after exact-head Project Memory Guard/Status/Quality, Landing, FanMind CI, Browser E2E and CodeQL all passed and #997 merged.
- Risk: R4 evidence reconciliation; repository documentation only.
- Scope: record the exact successful isolated extension-baseline provisioning, close the prior 2-of-5 blocker and preserve the separate new-authorization boundary for any database Restore.
- Resume from: no extension evidence reconciliation remains. Runtime work is owner-deferred as `FM-RST-OWNER-004`; no database workflow/JIT or target/Production/Supabase-Staging mutation is authorized.
- Safety: this lock authorized only repository/Issue evidence closeout. No database Restore, target reset, JIT/workflow dispatch, Production write, Supabase-Staging write or other runtime mutation occurred.

## LOCK-FM-RST-001-FAILCLOSED-RECONCILIATION-20260822
- Task: FM-RST-001
- Status: RELEASED
- Holder: ChatGPT database-Restore fail-closed reconciliation session 2026-08-22
- Branch/PR: `restore-failclosed-reconciliation-20260822` / #995; exact head `ce2b63c606ca1a9aa701d24a569e21d66cfe13ea`, squash merge `86bf2657996c45bfe03fadd4af689ffa89e7ea6e`; lock closeout PR #996.
- Acquired: 2026-08-22 after independent read-only reconciliation of run `32594374666`.
- Released: 2026-08-22 22:22 Europe/Vienna after exact-head CI/countercheck and merge.
- Risk: R4 evidence reconciliation; repository documentation only.
- Scope: record the consumed protected database-Restore run, prove the pre-write failure/cleanup/empty-target state, preserve the exact 2-of-5 extension blocker and define the separately authorized provisioning boundary.
- Resume from: no repository reconciliation resume remains. Runtime work is owner-deferred as `FM-RST-OWNER-003`; no workflow retry and no target/Production/Supabase-Staging mutation.
- Safety: this lock authorizes only repository evidence reconciliation. Extension/role/config changes, target reset, database Restore and every other R4 mutation require a new exact protected authorization.

## LOCK-FM-RST-001-CHECKOUT-CA-TRUSTSTORE-20260822
- Task: FM-RST-001
- Status: RELEASED
- Holder: ChatGPT Restore readiness evidence reconciliation session 2026-08-22
- Branch/PR: `restore-readiness-evidence-20260822` / #992; predecessor #991 merged.
- Acquired: 2026-08-22 15:52 Europe/Vienna
- Released: 2026-08-22 after exact head `53308fa43b258e4570b67d675f38f16e15e3bb69` passed Project Memory Guard/Quality/Status, FanMind CI, Landing Language CI, CodeQL and both Browser E2E jobs, then squash-merged as `cb04829c378285c24c3c53b5fab2d03177c19165`.
- Scope: reconcile PR #991 and successful protected read-only run `32582640853` into canonical docs/Project Memory, close the stale ownership/runner-policy contradiction and preserve the exact next R4 boundary; no database/runtime/provider mutation.
- Resume from: no repository evidence-reconciliation resume is required. Restore remains `TARGET_COMPATIBLE`; the exact isolated database-Restore authorization is separately owner-deferred.
- Safety: repository documentation/Project Memory only. Database Restore, isolated-target write, Production write and Supabase-Staging write remain outside this lock and require separate exact R4 authorization.

## LOCK-FM-RST-001-SCHEMA-ACL-RECOVERY-20260820
- Task: FM-RST-001
- Status: SUPERSEDED
- Holder: ChatGPT Restore schema-ACL recovery session 2026-08-20
- Branch/PR: `restore-schema-acl-recovery-20260820` / #987
- Acquired: 2026-08-20 16:10 Europe/Vienna
- Released: 2026-08-22 after reconciliation proved PR #987 merged as `b6bc368915d50dd2903b83b87c7ca25eb0ed6e18`; later target/readiness evidence superseded the implementation resume point.
- Scope: bounded recovery of the eight proven missing schema grant tuples on `graphql` and `graphql_public`; no Production or Supabase Staging mutation.
- Resume from: no repository implementation resume required. The current Restore blocker is the separately recorded checkout CA-truststore reconciliation.

## LOCK-FM-MOB-001-EAS-PROJECT-BINDING-20260821
- Task: FM-MOB-001
- Status: RELEASED
- Holder: ChatGPT Mobile EAS project-binding hardening session 2026-08-21
- Branch/PR: `mobile-eas-project-binding-hardening-20260821` / #988
- Acquired: 2026-08-21
- Released: 2026-08-21 after exact head `6f42a5897aabb3387a74149010dee2b5fb2c92cd` passed Project Memory Guard/Quality/Status, FanMind CI, Landing Language CI, Supply Chain Security, CodeQL and Browser E2E, then squash-merged as `e20efd475e475101226f266118b9cfed7972243a`.
- Scope: harden the existing read-only Mobile release and signed-build resource checks so successful `eas project:info` lookup is bound to the exact expected EAS owner, `fanmind-mobile` slug and project ID before any later build gate; no credential creation, build, submit, update, signing or provider mutation.
- Resume from: no repository implementation resume required. The next Mobile step is the existing protected read-only EAS resource-readiness run; external EAS, Supabase Auth, signing, stores and real-device acceptance remain open.

## LOCK-FM-MEM-009-LEGACY-ISSUES-20260830
- Task: FM-MEM-009
- Status: RELEASED
- Holder: ChatGPT legacy issue reconciliation session 2026-08-30
- Branch/PR: `ops/legacy-issue-reconciliation-20260830` / #1033
- Acquired: 2026-08-30
- Risk: R2 governance and GitHub issue metadata only
- Scope: map #642/#643/#644 to exact current evidence/remaining gates, install drift checks, and reconcile their GitHub state after exact-head merge; no code reimplementation, provider, database, billing, Production or Mobile build action.
- Released: 2026-08-30 after PR #1033 final exact head `70ea1bc61c7adefb739ba8fa3e16ea0bb84b4e58` passed all 11 checks and completed review with zero unresolved threads, squash-merged as `cc82dd7ad62e6aaf1d7b2637d49d43010789475f`, and #642/#643/#644/#874 were changed and independently re-read in their intended states.
- Resume from: no FM-MEM-009 work remains. Use #642/#643/#874 and the canonical task/evidence records for genuine retained gates; never revive #644 as an execution tracker.

## LOCK-FM-MEM-005
- Task: FM-MEM-005
- Status: RELEASED
- Holder: ChatGPT FanMind audit/V6 session 2026-08-19
- Branch/PR: `project-memory-v4-started-work` / #975
- Acquired: 2026-08-19 12:14 Europe/Vienna
- Updated: 2026-08-19
- Scope: exhaustive FanMind-only reconciliation, Project Memory V2-V6 integration and exact-head countercheck
- Resume from: no resume required; task accepted on main
- Released: after exact head `2a62dc8337673be0b33acfd4338d0f452224e779` passed all applicable gates and PR #975 merged as `b4bef882a55e8c0dd1dd33d0ad1c1664c3078d0d`

## LOCK-FM-MEM-008
- Task: FM-MEM-008
- Status: RELEASED
- Holder: scheduled Project Memory reconciliation 2026-08-20
- Branch/PR: `project-memory-v8-crosschat-impact` / #980
- Acquired: 2026-08-20 08:22 Europe/Vienna
- Released: 2026-08-20 after final exact head `704fec4b6264dd5a0dd83cc8e0029352672485d0` passed the complete gate set including Browser E2E and PR #980 merged as `22eb6aed5da4fde47860bbe12b118d3780c8a4a0`.
- Scope: V5 bookkeeping and exact-head evidence reconciliation for V8 governance only; no product/runtime/provider mutation.
- Resume from: no resume required unless V8 evidence becomes stale or contradictory; then create a new reconciliation lock rather than reviving this one.

All product workstreams remain tracked in `STARTED_WORK.md`; new locks must be acquired before substantive continuation of their respective task IDs.
