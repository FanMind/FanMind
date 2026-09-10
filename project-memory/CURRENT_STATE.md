# FanMind Current State

## Creator roadmap decision — 2026-09-10
- FM-DEC-013 / FM-CR-025: Phase 7a required Social channels -> technical Sales Handoff to Gerhard -> Phase 7b Creator Intelligence & Sales Assistance -> further Phase 8 work.
- FM-CREATOR-001 is DEFERRED until sales_handoff is accepted, required_for_sales=false and not parallel_safe. Its architecture review is not runtime implementation. Scope: docs/CREATOR_INTELLIGENCE.md.
- The current change is roadmap/Project Memory only. Existing overall gate states, prices and historical Website-AI preparation remain unchanged; sales_ready=false.
- Repository reconciliation: current read-only GitHub baseline is 7004c9ea (PR #1088 already merged); older pre-merge continuation below is historical. Deployment/Browser/CodeQL succeeded on that main, while Production Audit runs 34451800230 and 34458129680 failed. This roadmap change does not resolve or rerun those audits or take over existing operational locks.

## Current continuation — 2026-09-10
- Exact current main remains 7f681d26fa0e3c30e743c6a8ef1cd4fef6004e59. PR #1088 is the documentation closeout; its three delayed review findings are being reconciled before merge.
- Owner explicitly approved the prepared single-source SSH rule. It was saved once in fanmind-restore-isolated and read back as TCP 22/22, approved owner /32, rule prefix eb474b38. Only the existing Restore VM is attached. Owner Windows SSH independently reached authentication, then failed after key/passphrase/password attempts. Network reachability is confirmed; try the other existing FanMind key without password fallback. Host login is not yet proved.
- Database Restore remains DB_POSTCHECKED. Actual Storage, config inspection, cleanup and final countercheck remain open; a distinct disposable Storage target still needs its concrete current cost/artifact/cleanup decision.
- AI authorization: CTR-FM-AI-AUTH-20260910 is RECONCILIATION_REQUIRED. The September 8 technical PASS is retained, but publication authorization does not prove the separately required Staging write approval. Do not rerun it to fix a record.
- Runtime/provider observations from September 8 retain their original timestamps and must not be described as freshly checked today. New Staging deploy 34273614070 invalidated the older mutable Billing and Push postchecks; historical installation/build/rollback evidence remains.
- Prices are complete. Android device/Push/Recovery, Security/Auth, KI product/private/provider/Legal/Production and Meta Events/legal remain open; all overall gates stay partial and sales_ready=false.

## Published runtime and Restore access — 2026-09-08
- PR #1087 final head `6b5194ac96aa5e297f68aaffaa8bed3d433e58c9` passed all eight PR workflows with every review finding resolved, then squash-merged as `7f681d26fa0e3c30e743c6a8ef1cd4fef6004e59`.
- Production deployment `34273495406` / `102220717543`, independent read-only audit `34273656946` / `102221248690` and public go-live check `34273656942` / `102221247360` all passed on that release. Seven required health components passed; no Production SQL apply or paid-tier activation.
- Isolated Staging deployment `34273614070` / `102221113332` passed on the same release, with 14 public routes, seven required health components and preserved `billing_write_freeze=false`. Optional email configuration remains unknown.
- AI technical result and authorization boundary: Run 34273836166 / job 102221843980 on deployed 7f681d26fa0e3c30e743c6a8ef1cd4fef6004e59 technically passed the shared rollout, three ledger verifies, Test catalog, lifecycle, browser boundary and service-role ledger, with full rollback/cleanup and unchanged read-only counters. Its separately required action-time protected-Staging authorization has not been verified in the available record. Publication authorization FM-AUTH-FINISHLINE-PUBLISH-20260908 does not establish that separate scope. Keep this protected acceptance RECONCILIATION_REQUIRED under CTR-FM-AI-AUTH-20260910; retain the observed result, do not invent approval or rerun automatically.
- Restore portal access is restored: authenticated Exoscale FanMind shows exact existing `fanmind-restore-01` running in `at-vie-2`. Its encrypted provider console is reachable and displays the separate Linux login prompt. Portal authentication is not host authentication. No local SSH identity or backup/private receipt is available, and accepted database-run artifacts currently cannot be downloaded.
- Continue from accepted `DB_POSTCHECKED`. Actual Storage and config inspection require protected-host login and the existing exact backup/private receipts, then a distinct disposable Storage target with its explicit cost/artifact/cleanup decision. No second database Restore, target reset, password/key/firewall change, new provider target or real Storage operation occurred.
- Existing prices remain complete. Android real-device registration/delivery/Recovery, Security/Auth and Meta/provider/legal acceptance remain separate; all four overall gates remain partial and `sales_ready=false`.
- This supersedes earlier instructions in this file to publish PR #1087, deploy `a1bde387`, or repeat the failed Exoscale portal login. Older checkpoints are retained only as history.


Last reconciled: 2026-09-08

## Owner resume — 2026-09-08
- Historical checkpoint: superseded by the September 8 publication and September 10 reconciliation above; no instruction here authorizes a repeat action.
- Bernd resumed Restore, Android/Push, KI/Billing and Security/Meta before real Social integrations. Existing prices are complete and must not be recreated or repriced (FM-DEC-012).
- Reviewed main/Production: `a1bde3877b8f233004cb6e903f4c0b4fb68cdf3e`. Fresh Production audit `34266289342` and public go-live check `34266289377` passed. No Production mutation in this continuation.
- Staging: shared read-only rollout `34267504075` / `102200475242` passed. Exact-main deploy `34267819029` / `102201553389` passed with 14 public routes, seven required health components and preserved Billing configuration (`billing_write_freeze=false`); optional email configuration remains unknown.
- Stripe Test webhook: read-only run `34268317761` / `102203246459` passed on the same main: exact endpoint, 22 events, configured secret, inbound API `2026-06-24.dahlia`. No catalog/payment/provider mutation.
- KI rollback acceptance `34268214078` / `102202884497` stopped before database access/fixture at `environment_invalid`. The shared gate requires two API-origin bindings absent from the AI workflow. Repository correction adds those bindings; 31 focused tests pass, including a regression that failed on the old workflow and Production-crossover rejection. Remote CI/review, merge, exact-new-main Staging deploy and one fresh rollback acceptance remain required. Do not rerun the unchanged failed revision.
- Independent post-attempt Staging counters remain 0 Push registrations, 0 delivery attempts, 0 AI entitlements, 0 AI events and 1 prior durable Billing event. Historical general Billing installation/capture/canonical acceptance remains complete; do not repeat SQL Apply or delete the retained event.
- Restore remains accepted at `DB_POSTCHECKED`; controller preparation is complete. Real Storage still needs a distinct disposable target, exact artifact/target authorization, postcheck and cleanup. The September 7 local-only decision does not authorize a new paid target. Never repeat the database Restore, retired SSH investigation or controller build.
- Android: reuse FCM Preview `6801d687`, workflow `34037085683`; real device registration/delivery and the applicable full 19-check/Recovery receipt remain open. The published older Play AAB cannot prove the newer Push handler. Keep the owner-deferred Play cohort timing separate.
- Security advisors at 19:09 UTC: Production retains three mutable search paths, two browser-EXECUTE warnings on the legacy retention trigger and disabled leaked-password protection. Staging has disabled leaked-password protection and two constrained authenticated RPC warnings (`ensure_current_user_workspace` and `get_current_workspace_member_safe_dashboard`); neither exception is accepted by inference. No Auth/ACL/RLS change occurred.
- Meta: shared Staging content/catch-up checks verify; the browser is at the Meta login screen. Real consent-positive/negative Events Manager evidence and legal acceptance remain open. App Review and real account E2E belong to the later Social gate.
- Gates remain partial; `sales_ready=false`. Resume owner actions at their original priority, while exact Production, target/cost, device and legal boundaries remain explicit.

## Mandatory restart point

Before substantive FanMind work, read in this order:

1. `AGENTS.md` and `docs/SOURCE_OF_TRUTH.md`;
2. `project-memory/PROTOCOL.md`, `FANMIND_DEEP_AUDIT_2026-08-19.md`, `FANMIND_FINISHLINE.md`, `FINISHLINE_STATE.json`, `EXTERNAL_ACCEPTANCE.md`;
3. `project-memory/STARTED_WORK.md`, `TASK_LEDGER.md`, `OPEN_LOOPS.md`, `DEPENDENCIES.md`, `EVIDENCE.md`, `ASSUMPTIONS.md`, `CONTRADICTIONS.md`, `FAILED_ATTEMPTS.md`;
4. for Restore work, `RESTORE_STATE_MACHINE.md` plus the canonical Restore runbook;
5. central finishline issue #874, security issue #982 and the exact current Git/PR/CI/runtime/provider state.

Older percentages, issue checkboxes and chat statements are historical until reconciled against current evidence.

## Project role

FanMind is the production CRM/fan-communication product. Canonical product truth is `docs/SOURCE_OF_TRUTH.md`. Project Memory records execution truth and discovered drift without silently overriding canonical docs.

## Project Memory governance status

Project Memory V8 is **ACCEPTED on `main`**.

- V6 baseline: PR #975 exact head `2a62dc8337673be0b33acfd4338d0f452224e779`, merge `b4bef882a55e8c0dd1dd33d0ad1c1664c3078d0d`.
- V8: PR #980 final exact head `704fec4b6264dd5a0dd83cc8e0029352672485d0`, merge `22eb6aed5da4fde47860bbe12b118d3780c8a4a0`.
- Final V8 head passed Project Memory Guard, Quality, Status, FanMind CI, Landing Language CI, Supply Chain Security, CodeQL and Browser E2E run #915.
- An earlier cancelled Browser E2E was explicitly rejected as insufficient R3 countercheck evidence.
- `FINISHLINE_STATE.json` remains the machine-readable finishline state.
- `sales_ready=false` remains correct; Sales Handoff is not complete.

## Audited finishline state

### Built/accepted foundations — do not rebuild

- Project Memory V8 governance/counterchecks and cross-chat handoff;
- production Web/CRM core;
- Production deploy, health/version, PM2/nginx, read-only audit, monitoring and backup foundation;
- isolated Staging infrastructure and primary technical Staging acceptance;
- native Mobile repository/core and CI foundation;
- KI Standard and Plus/Ultra fail-closed technical foundation;
- Meta Pixel PageView-only technical Production path;
- advanced Facebook/Instagram foundation;
- dormant WhatsApp inbound foundation;
- Restore backup/authorization contract, PG17 roundtrip, fresh Schema-2 encrypted Full Backup and isolated host foundation.

### Active incomplete finishline

1. **Restore — FM-RST-001, R4:** database phase is accepted through `DB_POSTCHECKED`; real isolated Storage/Server-config/Cleanup/Evidence acceptance remains open.
2. **Mobile — FM-MOB-001, R3:** signed Android preview and the bounded real-device UI/runtime observation are complete for FM-MOB-003/FM-MOB-004. PR #1028 merged the Android `1.0.0` Store control as `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00`; its exact signed AAB is published in the closed Google Play Alpha track for Germany, Austria and Switzerland, and `fanmind://reset-password` is saved in the exact Production Auth allowlist. FM-MOB-006 accepted the isolated-Staging atomic Push Delivery-Ledger gate on exact commit `18a6ad79cb72331b4daa41ee87dd2430a8ffd473`: apply `33867831888` / `101006621418` and rollback-only acceptance `33867922978` / `101006906941` passed with provider sending disabled, synthetic rows, complete rollback and cleanup. Historical run `33868661986` / job `101009217307` produced a handler-containing Preview candidate for `700885307c265f8907cefe5f5b10499a5ea7b996`, but for Push registration it is superseded by the FCM-bound replacement Android Preview at exact commit `6801d687`, independently verified by workflow `34037085683` / job `101497020224`. The replacement install link was delivered to the owner; device opt-in/registration and separately authorized real provider delivery remain open. Staging currently has zero real push registrations, so no real Push acceptance is claimable yet. The cohort of at least 12 opted-in testers for at least 14 days remains open before later Play Production-access request. `iOS-TestFlight` remains Phase 8.
3. **AI/Billing — FM-AI-001, R3:** FM-EV-022 proves the synthetic Staging resource, Plus/Ultra and complete five-price Test catalog, exact 22-event webhook, installed empty AI ledger and 50/100/150 context policy. FM-EV-033 accepts the bounded Stripe SDK/payment-method/outbound-version correction through PR #1035 / merge `9a7b37f2cee798dc64c1d32f70fda338db174b5e`. The general Billing ledger is now installed on isolated Staging (Apply `34040107219`), capture-only was durably proven (`34043010578`) and unfrozen (`34043148548`), and the exact isolated-Staging deploy `34058028839` plus rollback-only canonical Billing acceptance `34058118450` / job `101553652111` passed on `62e6a11858e85996af03f6740819b0fc6194b4a4` with rollout `PASS`, cutover pending `0`, uninventoried `0`, transaction rollback and cleanup `PASS`. This closes only that bounded technical Staging sub-gate. Product/private quality-cost evidence, provider-side current post-ledger lifecycle/downstream reconciliation, Legal/Tax, Production runtime integration and explicit activation remain open. Canonical Production projection and Plus/Ultra remain disabled.
4. **Meta/Security — FM-META-001, R3:** FM-EV-023 counterchecks the point-in-time exact-main Meta Staging content/continuation/catch-up metadata and repository no-PII/security boundary read-only; its mutable Staging observation expires through `EV-META-STAGING-FOUNDATION-20260826`. Continuation and queue objects were observed present in isolated Staging, but the ledger-managed continuation timestamp was not independently proven; the controlled queue is intentionally ledger-free and requires its complete postflight rather than a table-presence inference. Worker/analysis activation, synthetic queue acceptance, Production and provider E2E remain open. The PageView-only Production path remains confirmed by FM-EV-007. External Events Manager/provider reception, App Review/real Meta E2E, legal acceptance and final finishline security evidence remain open.
5. **Phase 3 — FM-SOC3-001, R3:** Facebook/Instagram/WhatsApp final real E2E not accepted.
6. **Phase 7 — FM-SOC7-001, R3:** TikTok/X/Discord/conditional OnlyFans real connectors not accepted.
7. **Sales handoff — FM-SALES-001, R2:** blocked until required Phase-3/Phase-7 acceptance and final Production demo truth.
8. **Legal/Tax/AVV — FM-LEGAL-001, R3:** external approvals remain separate; do not guess.
9. **Live Supabase security reconciliation — FM-SEC-001, R3:** issue #982; protected read-only run `32997946812` confirmed the exact pre-hardening Production state, but remediation and the separate Auth-setting changes are not authorized or accepted.
10. **Phase 8 Website AI — FM-WEB-001/FM-WEB-002/FM-WEB-003/FM-WEB-004, R3:** repository-side Website Chat now includes a dormant consent-bound human email handoff, complete existing CRM timeline linkage, a checksum-pinned atomic processing gate, separate exact-main protected handoff controls and Workspace-scoped protected controls for the checksum-pinned dry-run-first retention contract. It is `IMPLEMENTED_NOT_VERIFIED`: protected verification reached Staging and failed closed because retention was not installed; two separately authorized transactional apply attempts then failed before commit and rolled back. Both controlled contracts remain unapplied, all installations remain disabled and real Staging acceptance, retention apply/acceptance/scheduling, AI dialogue, uncertainty escalation, email verification and approved delivery remain open. Retention targets only eligible technical session/evidence rows after Handoff expiry and explicitly preserves CRM contacts, Conversations and messages.

## Live Supabase target/security evidence — 2026-08-26

Both Supabase projects are currently `ACTIVE_HEALTHY` in `eu-west-3`.

### Production

Fresh advisors report:

- mutable `search_path` on `set_social_connections_updated_at`, `set_referral_updated_at`, `set_demo_start_session_updated_at`;
- retired `trim_conversation_messages_to_latest_50()` still reported as `SECURITY DEFINER` executable by `anon` and `authenticated`;
- leaked-password protection disabled;
- RLS-enabled/no-policy INFO findings on multiple service-only/internal tables.

Repository truth already contains the checksum-pinned transactional control `supabase/controlled/20260806203023_harden_trigger_function_privileges.sql` and `docs/operations/TRIGGER_FUNCTION_HARDENING_PRODUCTION.md`. Protected run `32997946812` on exact deployed `main` `5cb9c193e262f8939b5fc0c700fce154dde616e6` passed the full read-only Production preflight, returned the expected fixed `hardening_not_ready` diagnostic, and passed the always-run read-only postflight on the same release. Fresh advisors remained unchanged. Therefore code-present is implementation evidence and the exact live pre-state is now proven, but no remediation was applied. Use only the separate protected Apply when explicitly authorized, followed by postflight and advisor re-scan.

### Staging

Fresh advisors report authenticated execution of `ensure_current_user_workspace(...)` as `SECURITY DEFINER` and leaked-password protection disabled. Direct catalog evidence plus 24/24 focused provisioning tests confirm that the migration revokes `PUBLIC`/`anon`, grants only the intended authenticated call path, pins search path, checks `auth.uid()`/`auth.role()`, serializes per-user provisioning and derives commercial terms server-side. Classify it as a technically constrained intentional-exposure candidate pending explicit policy acceptance, not as permission to revoke blindly. Disabled leaked-password protection on both targets is a separate real Auth-control gap, not an accepted exception.

Do not create artificial browser RLS policies merely to silence INFO advisories for service-only tables.

## Restore-drill exact known state
- **Latest superseding database-phase evidence (2026-08-28, reconciled 2026-09-07):** issue #944 final comment `5453857592` proves workflow `33178878764` / database job `98874745740` completed and committed the isolated PostgreSQL 17 database Restore before the later ACL-helper boundary failure. Separately authorized completion `5453727223` added exactly eight missing schema-USAGE grants, produced exact projected expected/actual authorization fingerprint `0604dac8562a601e2d582f76aee4203825b826b302b9b0b93a92bdd2ca603052`, core-table postcheck `5|5|5|5` and plaintext cleanup `PASS`. No Production or Supabase Staging access/write and no repeated Restore occurred. Receipt: `receipts/FM-RST-001-ISOLATED-DATABASE-RESTORE-ACCEPTED-20260828.md`.
- This supersedes every older active instruction below that says `DB_RESTORED` was not reached or asks for SSH reconciliation/new database-Restore authorization. Do not repeat run `33178878764`, job `98874745740` or the database Restore. PR #1075 fixed the target-only login projection; PR #1077 retired stale rerun selectors; PR #1079 merged the exact `DB_POSTCHECKED` evidence reconciliation. PR #1081 added the private exact Storage archive/receipt preparation; PR #1085 accepted the repository-only fail-closed Storage controller after final head `7d32f5a0c29b8ab581a736b0744bfdcf41f5eddb` passed seven workflows, zero unresolved threads and exact-head review, then merged as `0ccf38e5f1afdd0b5f3495a137a5d360dd214ae7`. No provider target was created or contacted and no Restore ran. Overall `FM-RST-001` remains `PARTIAL` at `DB_POSTCHECKED`; real Storage is `DEFERRED_BY_OWNER` under `FM-RST-OWNER-007`.

### Repository/backup evidence

- PR #943 merge `14a1e2d0e100f2ec8cfa14486c96f128fb431878` hardened ACL/default-ACL/Owner/Role/DB-container/Extension recovery contract.
- Real two-cluster PostgreSQL-17 CI passed.
- New encrypted Schema-2 Full Backup `b74c1c60-1d61-4a39-9f0d-648ec003a12c` succeeded, validated and uploaded offsite.
- Checksum-only Verification `006e6ab8-8f5c-43c1-ac68-6570e992a7a1` succeeded/passed.
- Historical privilege-less backups are not valid Gate-2 recovery evidence.
- Historical pre-2026-08-28 state, superseded by the latest database-phase evidence above: the highest accepted progression was `TARGET_COMPATIBLE` and `DB_RESTORED` had not yet been reached.
- PR #987 merged the bounded schema-ACL recovery as `b6bc368915d50dd2903b83b87c7ca25eb0ed6e18`; the disposable target was later independently reset to the empty baseline and the prior populated database retained as connection-disabled quarantine.
- PR #990 merged the `GIT_SSL_NO_VERIFY` checkout repair as `1735a5f552c0c20c180fb96be6fa9000cbffc360`.
- Protected read-only run `32568632008` passed dispatch and Host-1 but protected job `97020836458` failed in `actions/checkout` because path-valued CA variables were present with empty values. Resource Readiness and Target Compatibility were skipped, one-job runner ID `40` cleaned itself, and no DB/Production/Supabase-Staging mutation occurred.
- PR #991 pinned all Restore CA consumers to the root-owned Ubuntu truststore and merged as `b75f68ecc7999a9b492051aecc2421b9b597dd18` after exact-head green countercheck.
- Fresh protected read-only run `32582640853` on that exact commit completed `success`: gate job `97054217701`, Host-1 job `97054234003` and protected Host-2 job `97054248185` all passed. Checkout loaded the pinned truststore, negotiated TLS 1.3 and reported `server certificate verification OK`; the earlier unsafe verification-skip marker and empty-CA failure were absent.
- Resource Readiness proved isolated/separate targeting, encrypted Full Backup type, matching checksum-only verification, no DB connection, no decryption and writes disabled. Target Compatibility proved PostgreSQL 17, all three required roles, `pgcrypto` 1.3, the dedicated restore superuser, read-only catalog access, TLS `verify-full` and writes disabled.
- Fresh one-job runners completed normal teardown; Host-2 runner ID `42` removed `.credentials`/`.runner`, exited 0 and disappeared from the live runner list before the controller accepted cleanup. No database Restore, target reset, Production write or Supabase-Staging write occurred.
- Evidence PR #992 exact head `53308fa43b258e4570b67d675f38f16e15e3bb69` passed all applicable repository/security/browser gates and merged as `cb04829c378285c24c3c53b5fab2d03177c19165`; the evidence-reconciliation lock is released.
- The owner then authorized exactly one database-Restore run on `main` `8bc8855a6de928cf38ef2e8fb9e9e0860fc477db`. Run `32594374666` consumed that authorization: gate job `97082934347` and Host-1 job `97082943319` succeeded; protected Host-2 job `97082992861` failed at the receipt-bound database authorization preflight.
- Code order and logs prove the failure occurred before the empty-target write path and before `pg_restore --single-transaction`. Receipt upload was skipped, private workflow cleanup succeeded, both one-job credentials/configurations were removed, and the independent read-only follow-up found no JIT, listener, credential or plaintext residue. Target TLS remained `verify-full`; `fanmind_restore` remained empty; the rollback quarantine remained connection-disabled.
- The separately authorized extension-baseline provisioning on exact `main` `c627fc2d8956768091c88e3a3baaf0b882b8d2d6` committed only `pg_stat_statements` 1.11, `supabase_vault` 0.3.1 and `uuid-ossp` 1.1 plus the already proven member-owner correction. Precommit receipt binding, mutation commit, full receipt contract, canonical ACL postcheck and postcommit read-only postcheck all passed.
- Current extension evidence is exact: five required descriptors, 97 records, extension fingerprint `6704956613ca8e58a527336d67b622a043e48a568858873ca5a6fa6b8bd08012` and schema-ACL fingerprint `abedaf76740b6a7fc1e53433a41337a2f8248d79abfac4ac22c9cf835a1373e3`. Backup, Verification, Source commit and reset receipt bindings remained unchanged. Issue #944 comment `5385843508` records the success and all forbidden non-actions.
- Run `32594374666`, runner IDs `43`/`44`, the prior database authorization and the extension authorization are consumed. Any database Restore still requires a new exact R4 authorization and fresh mutable-evidence preflight. Automatic retry, target reset and any Production/Supabase-Staging write remain forbidden.
- The owner later granted the next exact database-Restore scope in issue #944 comment `5385992305`; controller SHA-256 `45054c41143e33fce4406aea30478e43ed5280a36e1b339d0cc9c38df71ae946` was prepared in comment `5386014235` for reviewed `main` `618bce9bc00fe4722c91d5fcf5fed3657a3d8372`.
- On 2026-08-26 that controller printed only `ACCEPTED_READINESS_EVIDENCE=PASS` and `READINESS_TO_AUTHORIZED_MAIN_RUNTIME_DRIFT=NONE`, then its first SSH call to `138.124.213.66:22` timed out. The controller source places that SSH preflight before JIT creation, environment approval and workflow dispatch; current GitHub evidence contains no later Restore run. Therefore no remote preflight, JIT, protected approval, workflow dispatch, PostgreSQL connection or database/Production/Supabase-Staging mutation occurred.
- The controller explicitly forbids automatic retry. Authorization/comment `5385992305` and controller `45054c41...` must not be reused. Current side state is `RECONCILIATION_REQUIRED` at the unchanged highest accepted progression `TARGET_COMPATIBLE`.

### Operator-session foundation — revalidate before use

- no second restore server;
- isolated Restore VM exists;
- Ubuntu 24.04;
- PostgreSQL 17.11;
- Node 24.19.0;
- target database `fanmind_restore`;
- bootstrap login `fanmind_restore_bootstrap`;
- local PostgreSQL `127.0.0.1:5432`;
- TLS `verify-full` passed;
- `fanmind-restore` has no sudo;
- protected `restore-drill` environment and age-identity setup recorded;
- runner group `fanmind-restore-drill` setup recorded.

These live facts can drift. Revalidate runner group/workflow allowlist/JIT state, host gate/toolchain, target, TLS and artifact binding immediately before the next R4 step.

## Important contradictions

- GitHub repository ownership and runner-group scope are reconciled: `FanMind/FanMind`, repository ID `1259448985`, selected group `fanmind-restore-drill` and exactly the three reviewed `main` Restore workflows. This mutable policy must still be freshly revalidated before every later R4 write.
- Production trigger-hardening implementation exists in code, but fresh live advisors show the pre-accepted privilege/search-path warnings. Treat implementation and live acceptance separately until exact target verify/postflight is complete.

## Canonical roadmap boundary

- Phase 3: Facebook, Instagram, WhatsApp.
- Phase 7: TikTok, X/Twitter, Discord, OnlyFans only if officially/contractually feasible.
- Phase 8: the disabled Website-AI security/widget/message-ingestion foundation has started; dialog, escalation, email return path, `iOS-TestFlight`, LinkedIn and later platforms remain deferred. This bounded foundation is outside the current through-Phase-7 finishline and does not remove the native iOS implementation foundation.
- Phase 4 = completed production/billing base, **not** sales handoff.
- Technical sales handoff occurs only after required Phase-3 and Phase-7 channel acceptance.

## Governance posture

GitHub `main` is currently **not branch-protected**. This is known and remains a deferred owner/governance action; do not falsely report enforced PR/status-check protection.

## Do not repeat by default

- no second restore server;
- no Restore against Production or Supabase Staging;
- no re-provisioning of restore TLS/PostgreSQL/runner foundation absent verified drift;
- no rebuild of the existing trigger-hardening control;
- no blind revoke of intentional Staging RPC access;
- no artificial browser RLS policies solely to silence service-only INFO advisories;
- no Production DB/Auth mutation without exact read-only evidence and existing protected approval path;
- no old Cloudzy/systemd production deploy assumptions;
- no rebuild of Facebook/Instagram foundation;
- no Mobile restart/WebView rewrite;
- no invented Plus/Ultra models/quotas;
- no Referral Production activation through merge alone;
- no remote offsite deletion without new explicit deletion approval;
- no real 1-EUR/day paid test without separate financial approval;
- no Phase-8 signed iOS build, TestFlight, device or App-Store submission work; repository-only iPhone Store preparation is allowed by FM-DEC-010;
- no scraping/self-bot/platform bypass;
- no bypass of red/pending security/governance gates;
- no parallel project-memory/finishline system.

PR #1012 passed all 10 exact-head checks and merged as `d1b9d7e94b3bc78a1720e197a795a105bdcc1883`; its FM-AI-001 evidence lock is released. Never rerun `33003378162`, `33003452287` or `33003526741`. Remaining AI product/private/protected work is deferred to `FM-AI-OWNER-001`/`002`, and Plus/Ultra stay fail-closed.

FM-EV-023 records the 2026-08-26 Meta technical read-only reconciliation on exact `main` `966ffe3b105321e1350ec8c4fdb111341e99dd83`. Runs `33007156552`, `33007311870` and `33007481167` all passed with Apply not requested and no activation/write; do not rerun them. Production Pixel activation/deploy is already technically confirmed and is not an open prerequisite. External Events Manager, provider-side no-PII evidence, App Review/provider E2E and legal acceptance remain open.

PR #1014 passed all seven triggered exact-head checks at `12a479f00cce95d0031970c98c2d3933477ab804`, its tree matched the final squash-merge tree, and it merged as `ec1f196e82ab64a3b39b69a22a7b81b0757aa7a4`. Repository-only closeout #1015 exact head `355f1ce580045598527c51bff49d2a52c80275df` merged as `d727b53470653844b50fa6a4ca2fc98f7fb2c89b` and released the Meta evidence lock. Canonical freshness follow-up #1017 starts at evidence head `dd8246efe399f03180c675b245cc7277d46060ca`. Mutable Staging state is tracked by `EV-META-STAGING-FOUNDATION-20260826`; do not rerun the three workflows/direct query merely for closeout, but require a new lock and shared rollout-state-first revalidation after expiry/invalidation or before another Meta Staging database action.

## Exact next safe sequence

1. **FM-RST-001:** `DB_POSTCHECKED` and the repository-only private Storage preparation/controller are accepted; do not repeat the database Restore or controller implementation. Real isolated Storage mutation remains owner-deferred under `FM-RST-OWNER-007`; a new action-time owner decision and distinct isolated non-Production target are required before any upload. Server-config/disposable-target/final evidence remain later transitions.
2. **FM-SEC-001:** keep the proven Production pre-state open. Protected trigger-hardening Apply, Staging RPC exception acceptance and leaked-password provider changes are separate owner decisions/actions.
3. **FM-MOB-001:** preserve the accepted bounded UI/runtime result and published Alpha AAB. The atomic Push Delivery-Ledger isolated-Staging gate is accepted on `18a6ad79cb72331b4daa41ee87dd2430a8ffd473`. For Push registration the current exact signed device candidate is the FCM-bound replacement Preview at `6801d687` from workflow `34037085683` / job `101497020224`; it supersedes the older `700885...` candidate. Do not rebuild. Next install/use that replacement artifact for opt-in/registration observation; keep any real provider delivery separately authorized. When the Play cohort is started, at least 12 approved testers must remain opted in for at least 14 days before later Production-access request. iOS signing/build/TestFlight/device work remains Phase 8.
4. **FM-AI-001:** the isolated-Staging general Billing ledger/capture/canonical rollback acceptance sub-gate is complete through runs `34058028839` and `34058118450`; keep overall `PARTIAL`. Resume only through `FM-AI-OWNER-001`/`002` for remaining product/private/provider/Legal/Production evidence, and do not activate Plus/Ultra.
5. **FM-META-001:** external Events Manager/App Review/provider/legal acceptance is deferred to `FM-META-OWNER-001`; do not rerun the three FM-EV-023 checks or repeat Production activation/deploy.
6. After all non-Social gates: real Phase-3, Phase-7/OnlyFans feasibility, then final Production demo and sales handoff.
