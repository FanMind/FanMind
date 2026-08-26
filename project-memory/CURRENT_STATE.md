# FanMind Current State

Last reconciled: 2026-08-26

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

1. **Restore — FM-RST-001, R4:** real isolated DB/Storage/Server-config/Cleanup/Evidence acceptance still open.
2. **Mobile — FM-MOB-001, R3:** signed Android/iOS builds, redirect/EAS/signing, real devices, TestFlight/store/push acceptance open.
3. **AI/Billing — FM-AI-001, R3:** FM-EV-022 currently proves the synthetic Staging resource, Plus/Ultra and complete five-price Test catalog, exact 22-event webhook, installed empty AI ledger and 50/100/150 context policy. Product/private evidence, Stripe conformance review, unapplied general Billing ledger/cutover, current post-ledger lifecycle, Legal/Tax, runtime integration and explicit activation remain open.
4. **Meta/Security — FM-META-001, R3:** external Events Manager/browser evidence, remaining external Meta/App Review E2E and final finishline security evidence open.
5. **Phase 3 — FM-SOC3-001, R3:** Facebook/Instagram/WhatsApp final real E2E not accepted.
6. **Phase 7 — FM-SOC7-001, R3:** TikTok/X/Discord/conditional OnlyFans real connectors not accepted.
7. **Sales handoff — FM-SALES-001, R2:** blocked until required Phase-3/Phase-7 acceptance and final Production demo truth.
8. **Legal/Tax/AVV — FM-LEGAL-001, R3:** external approvals remain separate; do not guess.
9. **Live Supabase security reconciliation — FM-SEC-001, R3:** issue #982; protected read-only run `32997946812` confirmed the exact pre-hardening Production state, but remediation and the separate Auth-setting changes are not authorized or accepted.

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

### Repository/backup evidence

- PR #943 merge `14a1e2d0e100f2ec8cfa14486c96f128fb431878` hardened ACL/default-ACL/Owner/Role/DB-container/Extension recovery contract.
- Real two-cluster PostgreSQL-17 CI passed.
- New encrypted Schema-2 Full Backup `b74c1c60-1d61-4a39-9f0d-648ec003a12c` succeeded, validated and uploaded offsite.
- Checksum-only Verification `006e6ab8-8f5c-43c1-ac68-6570e992a7a1` succeeded/passed.
- Historical privilege-less backups are not valid Gate-2 recovery evidence.
- Highest accepted Restore progression remains `TARGET_COMPATIBLE`; the separately protected receipt-bound five-extension baseline is now proven. `DB_RESTORED` was not reached.
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
- Phase 8: LinkedIn and later platforms; not started and outside current scope.
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
- no Phase-8 work;
- no scraping/self-bot/platform bypass;
- no bypass of red/pending security/governance gates;
- no parallel project-memory/finishline system.

PR #1012 passed all 10 exact-head checks and merged as `d1b9d7e94b3bc78a1720e197a795a105bdcc1883`; its FM-AI-001 evidence lock is released. Never rerun `33003378162`, `33003452287` or `33003526741`. Remaining AI product/private/protected work is deferred to `FM-AI-OWNER-001`/`002`, and Plus/Ultra stay fail-closed.

## Exact next safe sequence

1. **FM-META-001:** continue the generated parallel-safe technical reconciliation for Pixel/no-PII/security tests and existing Meta foundations; external Events Manager/App Review/provider acceptance remains separate.
2. **FM-MOB-001:** keep run `33000433320` as fail-closed evidence. Mobile external configuration is deferred to `FM-MOB-OWNER-001`; do not rerun, build, sign, submit or mutate providers before that action.
3. **FM-SEC-001:** keep the proven Production pre-state open. Protected trigger-hardening Apply, Staging RPC exception acceptance and leaked-password provider changes are separate owner decisions/actions.
4. Keep Restore at `TARGET_COMPATIBLE`. First reconcile owner-PC public IP/TCP-22 reachability and any exact Exoscale `/32` allowlist drift; then require new exact R4 authorization. Do not rerun controller `45054c41...`.
5. After all non-Social gates: real Phase-3, Phase-7/OnlyFans feasibility, then final Production demo and sales handoff.
