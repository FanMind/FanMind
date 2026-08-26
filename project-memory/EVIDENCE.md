# FanMind Evidence and Acceptance

Implementation status and acceptance status are deliberately separate.

## Status model
- `IMPLEMENTED`: code/configuration exists.
- `IMPLEMENTED_NOT_VERIFIED`: implementation exists but required verification is missing or incomplete.
- `VERIFIED`: defined technical checks passed with evidence.
- `COUNTERCHECKED`: independent countercheck passed for the current commit/target.
- `ACCEPTED`: required real-world/staging/device/operator acceptance is complete.
- `PRODUCTION_CONFIRMED`: production state has been independently confirmed where applicable.

`DONE` is retained only for historical v1 entries. New work should use the status model above.

## FM-EV-001
- Related: FM-MEM-001
- Date: 2026-08-19
- Target: repository governance
- Type: merged repository controls
- Reference: Project Memory Protocol v1 files and guard workflow on `main`; PR #972
- Result: repository-level project memory established
- Limitations: v1 did not yet separate open loops, dependencies, acceptance levels or stale scanning
- Acceptance: VERIFIED

## FM-EV-002
- Related: FM-STG-001
- Date: through 2026-08-19
- Target: isolated FanMind Staging
- Type: Staging infrastructure + functional acceptance
- Reference: central finishline #874 Gate 1 and run/commit evidence recorded there
- Result: separate Supabase/Web Staging, DNS/TLS, required test resources, isolated synthetic users/workspaces, Workspace/Daily contract and rollback-protected Referral/Billing Staging lifecycle are recorded complete
- Limitations: does not prove Mobile signing, Plus/Ultra Production readiness, Meta external E2E or Social connectors
- Acceptance: ACCEPTED

## FM-EV-003
- Related: FM-RST-001
- Date: 2026-08-15 to 2026-08-19
- Target: backup/recovery contract
- Type: code + CI + Production backup evidence
- Reference: PR #943 merge `14a1e2d0e100f2ec8cfa14486c96f128fb431878`; issue #944 comments
- Result: ACL/default-ACL/Owner/Role/DB-container/Extension contract implemented, deployed and proven in real two-cluster PG17 CI
- Limitations: not a real artifact restore into the operator target
- Acceptance: VERIFIED

## FM-EV-004
- Related: FM-RST-001
- Date: 2026-08-15+
- Target: Production backup pipeline, read-only verification
- Type: encrypted Full Backup + checksum verification
- Reference: Full Backup `b74c1c60-1d61-4a39-9f0d-648ec003a12c`; Verification `006e6ab8-8f5c-43c1-ac68-6570e992a7a1`
- Result: succeeded/validation passed/offsite uploaded; Schema 2 authorization contract; checksum verification succeeded without restore
- Limitations: no decryption/real restore acceptance
- Acceptance: VERIFIED

## FM-EV-005
- Related: FM-RST-001
- Date: 2026-08-17 to 2026-08-19
- Target: isolated Restore operator environment
- Type: operator-session infrastructure evidence
- Reference: restore-session record summarized in `FANMIND_DEEP_AUDIT_2026-08-19.md`
- Result: isolated VM, Ubuntu 24.04, PostgreSQL 17.11, Node 24.19.0, target DB `fanmind_restore`, bootstrap login, local PostgreSQL, TLS verify-full, non-sudo restore user, environment/age/runner-group setup were established in the working session
- Limitations: live state may drift and the current connector cannot independently attest the complete GitHub runner-group Admin policy; mandatory revalidation before R4 write
- Acceptance: VERIFIED_NOT_ACCEPTED

## FM-EV-006
- Related: FM-MOB-001
- Date: through 2026-08-19
- Target: repository/mobile CI
- Type: implementation + CI/build controls
- Reference: issues #584/#690; mobile source/docs/tests
- Result: native app core and technical build/control foundation implemented
- Limitations: no signed real-device Android/iOS/Store acceptance
- Acceptance: VERIFIED

## FM-EV-007
- Related: FM-META-001
- Date: through 2026-08-19
- Target: Production Meta Pixel technical path
- Type: code/Production behavior
- Reference: issue #714 and Source of Truth
- Result: consent-gated parameterless PageView-only path with protected-route/PII/Advanced-Matching/CAPI boundaries
- Limitations: Meta Events Manager normal-browser reception and legal final acceptance remain external
- Acceptance: PRODUCTION_CONFIRMED

## FM-EV-008
- Related: FM-AI-001
- Date: through 2026-08-19
- Target: AI policy/Staging foundation
- Type: code/config/Staging
- Reference: `src/config/aiTiers.mjs`, issue #560, #874, Source of Truth
- Result: Standard active; Plus/Ultra fail-closed technical foundation, test-catalog/storage/lifecycle/eval/monitoring controls exist
- Limitations: final models/quotas/quality/cost/lifecycle/legal/Production activation incomplete
- Acceptance: VERIFIED_NOT_ACCEPTED

## FM-EV-009
- Related: FM-SOC3-001 / FM-SOC7-001
- Date: 2026-08-19 audit
- Target: Social finishline
- Type: source/issue/code reconciliation
- Reference: #874, Source of Truth, Meta/WhatsApp foundations
- Result: Facebook/Instagram foundation advanced; WhatsApp dormant foundation exists; Phase 7 feasibility notes exist
- Limitations: required real Phase-3/Phase-7 E2E acceptance absent
- Acceptance: IMPLEMENTED_NOT_VERIFIED

## FM-EV-010
- Related: FM-SALES-001
- Date: 2026-08-19
- Target: sales handoff truth
- Type: canonical roadmap/sales alignment
- Reference: Source of Truth, #874, commit `74c3a6aa357215c52d3a4d9b01ba8513bba1b57f`
- Result: canonical decision is sales handoff only after required Phase-3/Phase-7 technical acceptance; sales materials exist
- Limitations: handoff itself not yet performed
- Acceptance: VERIFIED

## FM-EV-011
- Related: all finishline tasks
- Date: 2026-08-19
- Target: repository + issues + project memory
- Type: exhaustive reconciliation
- Reference: `project-memory/FANMIND_DEEP_AUDIT_2026-08-19.md`
- Result: current built/open/stale/blocked/do-not-repeat state reconciled across product, Production, Staging, Restore, Mobile, AI/Billing, Meta, Social, Security, Legal and Sales
- Limitations: external/live mutable resources must still be revalidated at execution time
- Acceptance: COUNTERCHECKED

## FM-EV-012
- Related: FM-MEM-005
- Date: 2026-08-19
- Target: FanMind repository governance / finishline controls
- Type: exact-head CI + merged V6 governance
- Reference: PR #975 exact head `2a62dc8337673be0b33acfd4338d0f452224e779`; merge commit `b4bef882a55e8c0dd1dd33d0ad1c1664c3078d0d`
- Result: Project Memory Guard, Project Memory Status, Project Memory Quality V6 including Sales Readiness and Canonical Truth Drift, FanMind CI including PG17/Operations/Stripe policies/Production build, Landing Language CI, Supply Chain Security, CodeQL and both Browser E2E jobs all passed before merge
- Limitations: acceptance covers the V6 memory/finishline governance system only; it does not close Restore, Mobile, AI/Billing, Meta/Security, Social or Sales Handoff gates
- Acceptance: ACCEPTED

## FM-EV-013
- Related: FM-MEM-008
- Date: 2026-08-20
- Target: PR #980 / merged Project Memory V8
- Type: implementation evidence + independent exact-head CI countercheck
- Reference: final exact head `704fec4b6264dd5a0dd83cc8e0029352672485d0`; Browser E2E run #915; merge `22eb6aed5da4fde47860bbe12b118d3780c8a4a0`
- Result: after rejecting an earlier cancelled Browser E2E as insufficient, the final head passed Project Memory Guard, Quality, Status, FanMind CI, Supply Chain Security, Landing Language CI, CodeQL and Browser E2E before merge.
- Independent evidence: repository/CI checks and Browser E2E are separate from the implementation diff; merge commit is bound to the accepted head.
- Limitations: V8 acceptance covers governance/memory behavior only and does not close product/runtime/provider/device finishline gates.
- Status path: IMPLEMENTED -> VERIFIED -> COUNTERCHECKED -> ACCEPTED.
- Acceptance: ACCEPTED

## FM-EV-014
- Related: FM-SEC-001 / issue #982
- Date: 2026-08-20
- Target: live FanMind Production Supabase `drqkpdvtbbrrdwmtrodz` and FanMind Staging `vshyhvgcmrlagvfnvomc`
- Type: independent provider advisor + direct read-only catalog/ACL evidence
- Reference: fresh Supabase project health/security advisor scans; direct read-only `pg_catalog` function/privilege queries; current repository controlled hardening SQL/runbook and workspace-provisioning migration
- Result: both projects are `ACTIVE_HEALTHY`. Production direct catalog evidence confirms `set_social_connections_updated_at()`, `set_referral_updated_at()` and `set_demo_start_session_updated_at()` have no pinned function config/search path and are executable by both `anon` and `authenticated`; `trim_conversation_messages_to_latest_50()` remains `SECURITY DEFINER`, has `search_path=public, pg_temp`, and is executable by both `anon` and `authenticated`. Production advisors independently report the matching warnings plus leaked-password protection disabled. Staging direct catalog evidence confirms `ensure_current_user_workspace(text,text,boolean)` is `SECURITY DEFINER`, pinned to `search_path=pg_catalog, public, pg_temp`, not executable by `anon`, and executable by `authenticated`/`service_role`, matching the explicit migration design; leaked-password protection remains disabled.
- Repository crosscheck: the Production state is exactly the pre-hardening state the existing controlled SQL/runbook is designed to remediate; merge/deploy intentionally does not auto-apply it. The Staging workspace RPC warning is an intentional-exposure review item rather than unexplained ACL drift.
- RLS INFO posture: service-only/internal tables with RLS enabled/no policy are not automatically defects; current Production hardening documentation explicitly forbids inventing browser policies only to silence the linter.
- Limitations: read-only catalog/advisor evidence proves current state but does not authorize a Production DB/Auth mutation. No state-changing provider action was performed.
- Falsification: a later exact catalog/ACL/advisor read showing a different state or a mismatch between controlled migration and deployed target invalidates this baseline.
- Acceptance: COUNTERCHECKED_NOT_ACCEPTED

## FM-EV-015
- Related: FM-RST-001 / issue #944
- Date: 2026-08-22
- Target: exact `main` `b75f68ecc7999a9b492051aecc2421b9b597dd18`, organization runner policy, isolated Restore host, accepted encrypted Full Backup and empty PostgreSQL-17 target
- Type: protected read-only GitHub workflow + independent job-log/TLS/JIT-cleanup countercheck
- Reference: run `32582640853`; jobs `97054217701`, `97054234003`, `97054248185`; one-job runner IDs `41` and `42`; PR #991; issue #944 comment `5381530143`; evidence PR #992 exact head `53308fa43b258e4570b67d675f38f16e15e3bb69`, merge `cb04829c378285c24c3c53b5fab2d03177c19165`
- Result: all jobs succeeded. Checkout used the pinned root-owned Ubuntu truststore, negotiated TLS 1.3 and reported `server certificate verification OK`; resource readiness verified the Full Backup checksum without decryption/DB access/write; target compatibility verified PostgreSQL 17, all required roles, `pgcrypto`, dedicated restore superuser and TLS `verify-full` through a read-only catalog session. Both one-job runners cleaned credentials/configuration; Host-2 exit and API removal were controller-verified.
- Negative evidence: no dangerous `server certificate verification SKIPPED`, no CA-file error, no decryption, no restore, no target reset, no Production write, no Supabase-Staging write and no secret output.
- Limitations: `FM-RST-001` is not complete. Database, postcheck, Storage, config, cleanup and final countercheck remain open; mutable host/runner/target/TLS evidence must be refreshed before the separately authorized write.
- State-machine result: `TARGET_COMPATIBLE`.
- Acceptance: COUNTERCHECKED_READ_ONLY

## FM-EV-019
- Related: FM-SEC-001 / issue #982
- Date: 2026-08-26
- Target: live FanMind Production Supabase `drqkpdvtbbrrdwmtrodz` and FanMind Staging `vshyhvgcmrlagvfnvomc`
- Type: refreshed independent provider advisor + direct read-only catalog/ACL evidence
- Reference: current Supabase security advisors; direct read-only `pg_proc`/ACL queries; local offline contract check for `trigger-function-hardening-production-runner.mjs --check`; PR #1006 exact head `d9408c825aa735c5062a87cfc1b927312d094ad3`, squash merge `78333aae9d075a67a2d550a266d24cb8b9f443a4`, issue #982 comment `5428919200`
- Result: the 2026-08-20 security baseline has not drifted. Production still has no function-level `search_path` on the three ordinary trigger helpers and their ACL still grants `EXECUTE` to `PUBLIC`, `anon` and `authenticated`. The retired `trim_conversation_messages_to_latest_50()` remains `SECURITY DEFINER`, pinned only to `search_path=public, pg_temp`, and directly executable by those browser roles. Staging `ensure_current_user_workspace(text,text,boolean)` remains `SECURITY DEFINER`, pinned to `search_path=pg_catalog, public, pg_temp`, executable by `authenticated` and `service_role`, and not executable by `PUBLIC`/`anon`.
- Advisor countercheck: Production reports the same three mutable-search-path warnings, browser execution of the retired definer function and leaked-password protection disabled. Staging reports the authenticated workspace RPC and leaked-password protection disabled. RLS-enabled/no-policy INFO findings remain informational until table ownership/use is classified; no artificial policies are inferred.
- Repository countercheck: the existing Production controlled SQL remains checksum/contract valid and the offline runner check returned `status=ready`; no new hardening implementation is needed. The current provider state is still the exact pre-apply state, not accepted post-apply evidence.
- Limitations: the protected exact-deployed-commit Production workflow verify was not dispatched. No SQL Apply, Auth setting, grant, RLS policy or other Production/Staging/provider mutation was performed or authorized.
- Falsification: a later exact catalog/ACL/advisor read, deployed-commit mismatch or protected verify result inconsistent with this state reopens reconciliation before any mutation.
- Acceptance: COUNTERCHECKED_READ_ONLY_NOT_REMEDIATED

## FM-EV-020
- Related: FM-SEC-001 / issue #982
- Date: 2026-08-26
- Target: exact GitHub `main` and Production release `5cb9c193e262f8939b5fc0c700fce154dde616e6`; Production Supabase `drqkpdvtbbrrdwmtrodz`
- Type: protected exact-release read-only database verify + independent pre/post Production audits and post-run provider advisor countercheck
- Reference: `trigger-function-hardening-production-control.yml` run `32997946812`, job `98271985321`; deploy run `32996396550`, job `98266724400`; PR #1008 final exact head `ed64255f3786eea257011778a40492d6c7c9447e`, squash merge `4efb4eeef07d850fd0fd9117244187cf94bfed41`; issue #982 comment `5429302086`; checksum-pinned Production runner/log verifier; fresh post-run Production security advisors
- Result: workflow input and runtime environment were exactly `HARDENING_ACTION=verify`, `EXPECTED_COMMIT=REVIEWED_COMMIT=5cb9c193e262f8939b5fc0c700fce154dde616e6`. The preflight Production audit passed, the installed database verifier returned the fixed diagnostic `TRIGGER_FUNCTION_HARDENING_PRODUCTION_ERROR=hardening_not_ready`, and the always-run postflight Production audit passed again on the same release with eight healthy components. The workflow conclusion is intentionally `failure` because the verified live state is the allowed pre-hardening state, not because the diagnostic was unavailable.
- Read-only/negative proof: `verify` runs only the bounded base/postflight SQL under `SET TRANSACTION READ ONLY` and exits before the migration branch. No `apply` confirmation, migration execution, SQL/Auth/RLS/ACL/provider mutation, Restore/JIT/controller action, Production data write or Supabase-Staging write occurred.
- Independent countercheck: the fresh post-run Production advisor set is unchanged and still reports the three mutable-search-path helpers, browser execution of the retired `trim_conversation_messages_to_latest_50()` definer and leaked-password protection disabled. Focused Staging provisioning tests passed 24/24 and reconfirm that `ensure_current_user_workspace(...)` is an authenticated-only, identity-bound, server-priced, search-path-pinned intentional exposure; this is a constrained exception candidate, not automatic policy acceptance.
- Classification: Production trigger hardening is implemented but not applied; a separately authorized protected `apply` remains required for remediation. Staging RPC exposure is technically constrained and intentional but remains pending explicit exception acceptance. Disabled leaked-password protection is a real separate Auth-control gap on both targets and requires a separately authorized provider-setting action.
- Falsification: a later exact log, catalog/ACL/advisor read or release mismatch inconsistent with these results reopens reconciliation before any mutation.
- Acceptance: COUNTERCHECKED_READ_ONLY_PRESTATE_CONFIRMED

## FM-EV-021
- Related: FM-MOB-001 / issues #584 and #690
- Date: 2026-08-26
- Target: exact GitHub `main` `32c08ba6877d6aaaf61110c02464ee95d6bc6301`; protected GitHub Environment `mobile-preview`; Expo/EAS read-only resource path
- Type: protected exact-main read-only resource-readiness workflow + independent job/log countercheck
- Reference: `mobile-release-resource-readiness.yml` run `33000433320`, job `98280538304`; PR #988 binding verifier; issue #690 comment `5429569941`; evidence PR #1010 final exact head `15fca01adae6f4934c7b729512a14b8ccc926383`, squash merge `e6b3d9715726ede77ce7230cefa824edba16b2d4`.
- Result: checkout, Node setup and Mobile dependency installation passed. The exact EAS project lookup failed closed with the runtime-emitted marker `MOBILE_RELEASE_READINESS_ERROR=eas_project_lookup_failed`; the selected release environment was `preview` and the public EAS environment step was skipped.
- Root-cause evidence: the job environment supplied blank `EXPO_TOKEN`, expected EAS owner/project ID, expected Mobile/Production Supabase refs and expected Mobile API origin. No project-info report reached the exact binding verifier, so no owner/slug/project ID was accepted.
- Negative evidence: workflow source has no build/sign/submit/update/init path and all release-write gates remain fixed false. No EAS build, credential creation, Store action, Supabase/Auth/DB mutation, Restore/JIT/controller action or Production/Supabase-Staging data write occurred; no secret value was copied into Project Memory.
- Classification: current external Mobile preview resources are `BLOCKED`, not an application-code regression. `FM-MOB-OWNER-001` must configure the protected exact values and redirect acceptance before a new one-shot read-only check.
- Falsification: a later fresh exact-main protected run with nonblank but mismatched bindings, project-info mismatch or Production crossover reopens the classification; only a complete read-only PASS may advance external EAS readiness.
- Acceptance: COUNTERCHECKED_FAIL_CLOSED_EXTERNAL_BLOCKER

## FM-EV-022
- Related: FM-AI-001 / issues #560 and #874 Gate 4
- Date: 2026-08-26
- Target: exact GitHub `main` `2f8d9ca989e87ad88a76a514308618a9ce5d6fbb`; protected GitHub Environment `staging`; isolated Stripe Test Mode and Staging Supabase project
- Type: three protected exact-main read-only workflows + direct read-only Supabase catalog query + focused local regression set
- Reference: AI resource run `33003378162`, job `98290675487`; five-price catalog run `33003452287`, job `98290922265`; webhook-readiness run `33003526741`, job `98291186923`; issue #560 comment `5429960286`; issue #874 comment `5429960711`; `AI_BILLING_READONLY_RECONCILIATION_2026-08-26.md`; evidence PR #1012.
- Result: AI resource readiness passed with exact database binding, offline lifecycle contract, both Plus/Ultra Test prices and the dedicated synthetic workspace; the catalog independently passed for all five isolated Test prices; the enabled Staging webhook passed for the exact URL, Test Mode, configured signing secret and 22 handled events at its pinned API version. All three jobs used the exact reviewed commit.
- Database boundary: explicit `BEGIN; SET TRANSACTION READ ONLY` catalog evidence confirms the AI entitlement/event/reconciliation tables and both atomic security-definer functions are installed; ledger tables use forced RLS with no policies/direct runtime-table rights, browser roles cannot execute the functions, service role has only the required entitlement read and function execute boundary, and the fixed search path is present. There are 0 AI ledger events and 0 unresolved reconciliations.
- Current limitation: the successful historical transactional lifecycle run `31735315959` predates the applied AI ledger and used legacy service-role CRUD; AI ledger apply run `32038152382` occurred later. The separately controlled general Billing ledger tables/functions are absent and its workflow has never run. Therefore current post-ledger Upgrade/Downgrade/Cancellation/Failed-payment/Entitlement acceptance is not proven.
- Product/quality classification: 50/100/150 context limits are already approved, server-owned and tested; they are not an open decision. Models/fallbacks, request/token quotas, usage/overage rules, commercial switching/refund decisions, representative cost evidence and the real private blinded quality result remain open.
- Stripe conformance observations: the internal daily-test Checkout still fixes card-only `payment_method_types`, the endpoint is pinned to `2026-06-24.dahlia`, and server calls use raw REST rather than the current client pattern. No automatic provider/code change is implied; resolve these in a separate reviewed change before activation.
- Negative evidence: write flags stayed false/blank, no SQL Apply or transactional acceptance ran, and no Stripe product/price/webhook/payment/refund, Supabase row/schema, paid-tier, Production, Restore, Mobile or Security mutation occurred. Focused local policies passed 175/175 and all offline control checks passed.
- Classification: synthetic resource, Test prices, webhook configuration and AI-ledger installation are current read-only `PASS`; overall FM-AI-001 remains `PARTIAL` and is deferred to `FM-AI-OWNER-001`/`002` plus private/external evidence.
- Falsification: any later catalog drift, ledger schema/ACL drift, nonzero unresolved reconciliation, changed price/webhook contract, or lifecycle run inconsistent with this evidence reopens reconciliation before activation.
- Acceptance: COUNTERCHECKED_READ_ONLY_FOUNDATION

## FM-EV-016
- Related: FM-RST-001 / issue #944
- Date: 2026-08-22
- Target: exact `main` `8bc8855a6de928cf38ef2e8fb9e9e0860fc477db`, run `32594374666`, isolated `fanmind-restore-01` PostgreSQL 17.11 database `fanmind_restore`
- Type: protected R4 workflow evidence + independent read-only host/target reconciliation
- Reference: run `32594374666`; jobs `97082934347`, `97082943319`, `97082992861`; one-job runner IDs `43` and `44`; issue #944 comments `5382274967` and `5382336892`; PR #995 exact head `ce2b63c606ca1a9aa701d24a569e21d66cfe13ea`, merge `86bf2657996c45bfe03fadd4af689ffa89e7ea6e`; target reset receipt `/home/fanmind-restore/secure/target-reset-receipt-20260821_193331.json`.
- Result: gate and Host-1 succeeded. Host-2 passed exact checkout, checksum-only Resource Readiness, baseline PostgreSQL compatibility and positive TLS certificate verification, then failed at `database_authorization_preflight_failed` before backup decryption/first target write. The target has 2/5 receipt-bound extensions; `pg_stat_statements`, `supabase_vault` and `uuid-ossp` are missing, with trusted control files present.
- Independent evidence: follow-up read-only controller returned `READ_ONLY_RECONCILIATION=PASS`, listener/credentials/JIT/plaintext absent, Host-2 exit receipt 0, TLS `verify-full`, server-enforced read-only transaction, empty baseline target, 2/2 baseline extensions, 3/3 baseline roles and retained connection-disabled quarantine.
- Negative evidence: no `RESTORE_DRILL_DATABASE=PASS`, no applied Restore, no target reset, no Production write, no Supabase-Staging write, no certificate-verification skip and no private artifact upload.
- Prior accepted repair path: exact five-extension state requires fingerprint `6704956613ca8e58a527336d67b622a043e48a568858873ca5a6fa6b8bd08012` over 97 records, including the proven 36-`pgcrypto` and 10-`uuid-ossp` member-owner correction; recreating `uuid-ossp` alone previously produced the wrong fingerprint.
- Limitations at observation time: the extension baseline was not yet provisioned and the unchanged full receipt-bound role/container authorization still had to run after provisioning. FM-EV-017 now supersedes that blocker; database/Storage/config/cleanup/final acceptance remain open.
- State-machine result at observation time: highest accepted progression `TARGET_COMPATIBLE`; side state `RECONCILIATION_REQUIRED`, later cleared by FM-EV-017.
- Acceptance: COUNTERCHECKED_FAIL_CLOSED

## FM-EV-017
- Related: FM-RST-001 / issue #944
- Date: 2026-08-23
- Target: exact `main` `c627fc2d8956768091c88e3a3baaf0b882b8d2d6`, isolated Exoscale `fanmind-restore-01` PostgreSQL 17.11 database `fanmind_restore`
- Type: separately authorized R4 extension-only mutation + receipt-bound precommit/postcommit and independent read-only postchecks
- Reference: Full Backup `b74c1c60-1d61-4a39-9f0d-648ec003a12c`; Verification `006e6ab8-8f5c-43c1-ac68-6570e992a7a1`; Source commit `14a1e2d0e100f2ec8cfa14486c96f128fb431878`; reset receipt `/home/fanmind-restore/secure/target-reset-receipt-20260821_193331.json`; issue #944 comment `5385843508`; final controller SHA-256 `4f5afa39c6f8b25ded4593d1dfac9f31f4347e11187ebfa0c0d2e55e957f9880`.
- Result: GitHub/auth/active-workflow preflights passed. The controller started from the proven 42-record baseline, passed the precommit receipt contract, committed only the three missing extensions plus proven member-owner correction, then passed the full receipt contract, canonical schema-ACL postcheck and postcommit read-only postcheck.
- Exact post-state: five required extensions; 97 extension records; extension fingerprint `6704956613ca8e58a527336d67b622a043e48a568858873ca5a6fa6b8bd08012`; schema-ACL fingerprint `abedaf76740b6a7fc1e53433a41337a2f8248d79abfac4ac22c9cf835a1373e3`.
- Rollback evidence: every earlier candidate provisioning mismatch emitted `AUTOMATIC_ROLLBACK=PASS`; the successful candidate committed only after the exact bound predicates passed. Separate rollback-only predicate and ACL diagnostics proved candidate semantics without committing.
- Negative evidence: `DATABASE_RESTORE=NOT_DISPATCHED`, `TARGET_RESET=NOT_ATTEMPTED`, `JIT_WORKFLOW_DISPATCH=NOT_ATTEMPTED`, `PRODUCTION_WRITE=NOT_ATTEMPTED`, `SUPABASE_STAGING_WRITE=NOT_ATTEMPTED`.
- Limitations: this evidence satisfies only the receipt-bound extension prerequisite. It does not prove `DB_RESTORED` or authorize a database workflow. Mutable runner-policy/host/target/backup/TLS evidence must be refreshed for a new exact R4 database authorization.
- State-machine result: highest accepted progression remains `TARGET_COMPATIBLE`; extension prerequisite satisfied.
- Acceptance: COUNTERCHECKED_EXTENSION_BASELINE

## FM-EV-018
- Related: FM-RST-001 / issue #944
- Date: 2026-08-26
- Target: exact reviewed `main` `618bce9bc00fe4722c91d5fcf5fed3657a3d8372`; controller SHA-256 `45054c41143e33fce4406aea30478e43ed5280a36e1b339d0cc9c38df71ae946`; SSH endpoint `138.124.213.66:22`
- Type: owner-supplied controller terminal output + controller source-order countercheck + current GitHub absence evidence
- Reference: owner authorization issue #944 comment `5385992305`; prepared-controller comment `5386014235`; accepted read-only run `32582640853` and Host-2 job `97054248185` referenced by the controller.
- Result: the controller emitted `ACCEPTED_READINESS_EVIDENCE=PASS` and `READINESS_TO_AUTHORIZED_MAIN_RUNTIME_DRIFT=NONE`, then failed with `ssh: connect to host 138.124.213.66 port 22: Connection timed out` and `DATABASE_RESTORE_CONTROLLER=FAIL`.
- Independent/source-order evidence: the exact controller bytes hash correctly and call the first restricted remote SSH preflight before JIT generation, protected-environment approval and database workflow dispatch. Current issue/run evidence shows no later Restore workflow run after the last recorded extension closeout.
- Negative evidence: no remote R4 preflight marker, no JIT, no environment approval, no workflow dispatch, no PostgreSQL connection, no database Restore, no target reset and no Production/Supabase-Staging mutation.
- Limitations: this does not prove whether the root cause is public-IP/allowlist drift, host firewall, VM/network state or another connectivity fault. Owner-PC public-IP/TCP-22 evidence and exact Exoscale security-group comparison remain required.
- State-machine result: highest accepted progression remains `TARGET_COMPATIBLE`; side state `RECONCILIATION_REQUIRED`. Controller `45054c41...` and authorization `5385992305` are non-reusable; automatic retry forbidden.
- Acceptance: COUNTERCHECKED_PRE_DISPATCH_FAIL_CLOSED

Never store secrets, private credentials, plaintext sensitive payloads, or unsafe diagnostic material here.
