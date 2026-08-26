# Started Work Register

Canonical register for FanMind work that has started but is not yet fully completed.

## Rules
- Add an entry as soon as substantive work begins.
- Every active `IN_PROGRESS`, `PARTIAL`, `BLOCKED`, `IMPLEMENTED_NOT_VERIFIED` or `RECONCILIATION_REQUIRED` task must appear here until closed or superseded.
- Assign `Risk: R1|R2|R3|R4` before implementation continues.
- Never delete history; close with status, date, result, evidence and next step.
- Cross-link Task ID, Change Request, PR/branch, dependencies, work lock and execution receipt.

## Active work

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
- Updated: 2026-08-21
- Status: IMPLEMENTED_NOT_VERIFIED
- Risk: R3
- Scope: Signed Android/iOS Mobile release and real-device/store acceptance; the merged repository implementation now binds both read-only resource readiness and the separately protected signed-build path to the exact remote EAS project record.
- Branch/PR: `main`; PR #988 merged as `e20efd475e475101226f266118b9cfed7972243a`.
- Work lock: `LOCK-FM-MOB-001-EAS-PROJECT-BINDING-20260821` RELEASED.
- Dependencies: Supabase redirect, EAS project/environments/token, signing credentials, Apple Developer/App Store Connect for iOS.
- Assumptions: repository CI/build evidence does not prove a signed device build; a successful EAS lookup alone does not prove that the returned owner, slug and project ID match the protected FanMind binding.
- Completed so far: native app core, auth/recovery, SecureStore/Purge, contacts/knowledge/AI/followups, offline cache, push foundation, icon/splash/privacy/store metadata and CI/control workflows. PR #988 added a bounded verifier for the redacted `eas project:info` report, rejects owner/slug/ID drift and unsafe report files, wires it before both read-only readiness and any signed internal build queue, and exercises parser plus workflow wiring through positive and negative CI self-tests. Exact head `6f42a5897aabb3387a74149010dee2b5fb2c92cd` passed Project Memory Guard/Quality/Status, FanMind CI, Landing Language CI, Supply Chain Security, CodeQL and Browser E2E before merge `e20efd475e475101226f266118b9cfed7972243a`.
- Still open: real read-only EAS environment verification; redirect/device recovery; EAS/signing; signed Android + real device; iOS/TestFlight + real device; push/store portal evidence.
- Evidence so far: issues #584/#690, Source of Truth, mobile docs/tests, Expo EAS CLI `project:info` source contract, PR #988 exact-head workflow set, countercheck comment and merge commit.
- Exact next step: run the existing protected, main-bound Mobile release resource-readiness workflow for the intended non-Production environment and bind its external EAS result to the exact merged commit. Do not queue a build or mutate credentials in that read-only step.
- Owner action needed: only where protected EAS environment/account access, Supabase Redirect, signing, stores and real-device acceptance require external action.

## FM-AI-001
- Started: before 2026-08-19
- Updated: 2026-08-19
- Status: PARTIAL
- Risk: R3
- Scope: KI Standard/Plus/Ultra product, quality, cost, Stripe lifecycle and activation readiness.
- Branch/PR: current AI/billing foundations on main.
- Work lock: acquire before modifying tier policy, Stripe lifecycle or controlled SQL.
- Dependencies: written product decisions, private quality/cost evidence, current Staging lifecycle, Legal/Tax, explicit Production activation.
- Assumptions: Staging Test prices existing does not mean Plus/Ultra is activated or fully accepted.
- Completed so far: Standard active; Plus/Ultra prices/policy, entitlement resolver, Staging storage/foundations, Test catalog foundation, lifecycle/ledger controls, monitoring/recommendation/eval tooling.
- Still open: final models/quotas/overage/context/switch/refund decisions; private quality/cost evidence; full current Staging lifecycle; legal/tax; explicit production activation.
- Evidence so far: issue #560, issue #874, Source of Truth, `src/config/aiTiers.mjs`.
- Exact next step: reconcile current Staging lifecycle evidence against Gate 4 and list only truly missing decisions/tests.
- Owner action needed: yes for product/financial decisions and any protected external activation.

## FM-META-001
- Started: before 2026-08-19
- Updated: 2026-08-19
- Status: PARTIAL
- Risk: R3
- Scope: Meta Events Manager/external Meta acceptance and final non-Social security proof.
- Branch/PR: existing Meta foundation on main.
- Work lock: acquire before Meta app/permission/production activation changes.
- Dependencies: normal-browser Meta Events Manager access, Meta app/test assets, App Review/permissions, legal/privacy acceptance.
- Assumptions: technical pixel calls and Staging migrations are not external Events Manager/App Review acceptance.
- Completed so far: consent-gated PageView-only Pixel production code; advanced Facebook/Instagram OAuth/token/content/conversation foundation; relevant Staging migrations/controls.
- Still open: Events Manager positive/negative browser evidence; no-PII evidence; App Review/permissions and real account/webhook/conversation E2E; final relevant security/legal evidence.
- Evidence so far: #714, Source of Truth, Meta tests/migrations.
- Exact next step: external normal-browser Events Manager acceptance, keeping conversion events/advanced matching/CAPI disabled.
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
- Branch/PR: active read-only evidence branch `security-production-readonly-verify-20260826` / pending; read-only refresh PR #1006 exact head `d9408c825aa735c5062a87cfc1b927312d094ad3`, squash merge `78333aae9d075a67a2d550a266d24cb8b9f443a4`; lock closeout #1007 merged as `5cb9c193e262f8939b5fc0c700fce154dde616e6`; issue #982 comments `5428919200`/`5428996454`.
- Work lock: `LOCK-FM-SEC-001-PRODUCTION-VERIFY-20260826` ACTIVE for one exact-deployed-commit `verify` action only. The prior refresh lock is released; acquire a separate exact authorization and lock before any Production DB/Auth change.
- Dependencies: FM-DEP-010; exact deployed Production commit; controlled trigger-hardening checksum/runner; current Production/Staging Supabase projects; provider/Auth access for leaked-password decision.
- Assumptions: Production trigger warnings indicate pre-apply/not-accepted state; Staging authenticated workspace RPC may be intentional but its exception status must be explicitly reviewed.
- Completed so far: 2026-08-26 provider advisors and direct Production/Staging function/ACL catalogs reconfirm the prior state without drift; the existing controlled Production SQL/runner offline contract reports ready. Staging RPC exposure matches the intentional migration ACL/search-path design and remains an exception-review item rather than unexplained drift. PRs #1006/#1007 passed their exact-head gates and merged. Deploy run `32996396550` job `98266724400` independently proves Production release, `/api/version`, `/api/health` and all required components are green at exact `main` `5cb9c193e262f8939b5fc0c700fce154dde616e6`.
- Still open: protected exact-deployed-commit Production verify; explicit Staging RPC exception acceptance; leaked-password setting decision/evidence; only then any separately authorized mutation and post-advisor countercheck.
- Evidence so far: FM-EV-014 and refreshed FM-EV-019; live Supabase security advisors/catalog ACLs; current controlled SQL, Production hardening runbook and workspace provisioning migration.
- Exact next step: publish the active repository evidence lock, then dispatch exactly one protected `verify` through `trigger-function-hardening-production-control.yml` on exact deployed `main` `5cb9c193e262f8939b5fc0c700fce154dde616e6`; inspect preflight, expected fail-closed diagnostic and always-run postflight. Do not Apply.
- Owner action needed: only for protected Production DB/Auth mutations or provider-only setting changes when the read-only evidence is ready.

## Closed work

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
