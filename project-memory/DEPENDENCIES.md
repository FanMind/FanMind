# FanMind Dependencies

Track ordering and prerequisites here. Do not mark dependent work accepted while a required prerequisite remains unresolved.

## FM-DEP-001
- From: FM-RST-001
- Requires: reviewed restore workflows, protected `restore-drill` environment, exact Organization runner-group/workflow-allowlist/JIT policy, isolated existing PostgreSQL-17.11 target, TLS `verify-full`, exact accepted Schema-2 Full Backup/Receipt, current host gate/toolchain and the complete receipt-bound database authorization contract.
- Type: internal + external control
- Status: ACTIVE
- Updated: 2026-08-23
- Current evidence: read-only run `32582640853` proved the baseline chain through `TARGET_COMPATIBLE`; run `32594374666` failed closed before write; the later separately authorized extension-only transaction and full receipt-bound postcheck proved the exact five-extension/97-record fingerprint `6704956613ca8e58a527336d67b622a043e48a568858873ca5a6fa6b8bd08012` plus canonical ACL fingerprint `abedaf76740b6a7fc1e53433a41337a2f8248d79abfac4ac22c9cf835a1373e3`.
- Rule: Continue from the first unproven gate, now `TARGET_COMPATIBLE -> DB_RESTORED`. Revalidate mutable policy/host/target/backup/TLS evidence and obtain a new exact database-Restore authorization. Do not recreate established infrastructure, repeat extension provisioning, automatically retry the consumed run, target Production/Supabase Staging or infer `DB_RESTORED` from the extension baseline.

## FM-DEP-002
- From: FM-MOB-001
- Requires: exact Supabase redirect/recovery evidence, current EAS project/environments/token, existing Android signing credentials, signed Android build, real Android device acceptance and separate applicable Push/Store evidence for the current through-Phase-7 finishline.
- Type: external platform + technical acceptance
- Status: ACTIVE
- Updated: 2026-08-29
- Current evidence: Preview EAS project/environment/token binding is accepted and protected run `33260695232` / job `99122008690` produced one verified exact-merge signed Android internal artifact. Owner real-device acceptance, Supabase recovery redirect and applicable Push/Store evidence remain open.
- Deferred boundary: Apple Developer/App Store Connect, signed iOS build, TestFlight and real iOS device acceptance were moved by owner decision FM-DEC-009 to Phase 8. They remain future external work and do not block FM-MOB-001/current sales finishline.
- Rule: repository CI and signed-artifact success still do not satisfy real-device or Store acceptance. Use the existing Android preview for device checks; do not automatically rebuild, submit, update or invent external identifiers. Do not start iOS/TestFlight work before Phase 8 is explicitly started.

## FM-DEP-003
- From: FM-AI-001
- Requires: tier-specific written model/fallback, request/token quota, usage/overage, switching/proration/refund and cost/margin decisions; private quality/cost evidence; Stripe conformance review; general Billing ledger Staging cutover; full current post-ledger Stripe/Webhook/Entitlement lifecycle; Legal/Tax boundary; runtime integration and explicit Production activation. The 50/100/150 context policy, synthetic resource, Test prices, exact webhook configuration and AI ledger installation are already current evidence.
- Type: product + financial + technical + external
- Status: ACTIVE
- Updated: 2026-08-26
- Rule: Plus/Ultra stay fail-closed until every applicable prerequisite is current; current read-only resource/catalog/webhook/ledger evidence alone is insufficient.

## FM-DEP-004
- From: FM-META-001
- Requires: Meta Events Manager normal-browser evidence, Meta test/business assets, App Review/permissions for real integrations, provider-side no-PII/no-unexpected-conversion evidence, privacy/legal acceptance and final Security/Production smoke.
- Type: provider + legal + technical
- Status: ACTIVE
- Updated: 2026-08-26
- Current evidence: FM-EV-007 Production-confirms the consent-gated parameterless PageView-only path. FM-EV-023 read-only counterchecks the 2026-08-26 exact-main Meta Staging content, continuation and catch-up foundation without writes or activation; its mutable Staging observation is tracked by `EV-META-STAGING-FOUNDATION-20260826`.
- Rule: the technical Pixel path and observed Staging metadata are proven foundations, not external Meta Events Manager/App Review/legal acceptance. Do not repeat Production activation or the FM-EV-023 runs as a substitute for external evidence. After freshness expiry/invalidation or before another Meta Staging database action, use a new lock and fresh shared rollout-state-first verification.

## FM-DEP-005
- From: FM-SOC3-001
- Requires: FM-RST-001/FM-MOB-001/FM-AI-001/FM-META-001 sufficiently closed according to #874, plus Facebook/Instagram/WhatsApp credentials/permissions/test assets and legal boundaries.
- Type: finishline ordering + provider
- Status: ACTIVE
- Updated: 2026-08-19
- Rule: Social is intentionally the last technical block; reuse existing Meta/WhatsApp foundations.

## FM-DEP-006
- From: FM-SOC7-001
- Requires: prior non-Social/Phase-3 finishline, current official platform capability, X cost/API approval where needed, Discord official bot/guild model, OnlyFans official/contractual feasibility.
- Type: finishline ordering + provider + possible financial/legal
- Status: ACTIVE
- Updated: 2026-08-19
- Rule: no scraping, self-bot, reverse engineering or unofficial bypass.

## FM-DEP-007
- From: FM-SALES-001
- Requires: FM-SOC3-001 and FM-SOC7-001 accepted as required by #874, exact-release 5-minute Production demo, synchronized sales material/roadmap/product truth.
- Type: milestone
- Status: BLOCKED
- Updated: 2026-08-19
- Rule: Phase 4 completion and existing sales docs are not equivalent to technical sales handoff.

## FM-DEP-008
- From: FM-LEGAL-001
- Requires: genuine advisor/register/provider/customer evidence.
- Type: external
- Status: BLOCKED
- Updated: 2026-08-19
- Rule: do not guess UID/register/tax/legal/AVV/provider facts; technical checks cannot self-approve legal status.

## FM-DEP-009
- From: FM-MEM-005 / FM-MEM-008
- Requires: exact governance PR heads and terminal green Project Memory/FanMind/Security/Browser gates.
- Type: repository governance
- Status: SATISFIED
- Updated: 2026-08-20
- Evidence: V6 exact head `2a62dc8337673be0b33acfd4338d0f452224e779` passed all applicable checks and PR #975 merged as `b4bef882a55e8c0dd1dd33d0ad1c1664c3078d0d`; V8 exact head `704fec4b6264dd5a0dd83cc8e0029352672485d0` passed the full gate set including Browser E2E and PR #980 merged as `22eb6aed5da4fde47860bbe12b118d3780c8a4a0`.
- Rule: V8 is now the active mainline memory layer; reopen only on material drift/contradiction.

## FM-DEP-010
- From: FM-SEC-001
- Requires: exact live Production/Staging Supabase target identity and health; exact deployed Production commit; read-only catalog/ACL/advisor evidence; checksum-pinned controlled trigger-hardening runner/runbook; explicit provider/owner authorization before any Production DB or Auth-setting mutation; fresh post-action advisor evidence.
- Type: security + external provider + protected mutation
- Status: ACTIVE
- Updated: 2026-08-26
- Evidence: FM-EV-020 and protected read-only run `32997946812` prove the exact Production pre-state and healthy pre/post runtime without mutation; 24/24 focused tests support the constrained Staging RPC classification.
- Rule: read-only reconciliation is complete for the current state. Production DB/Auth mutation must remain fail-closed under its existing protected control and explicit owner actions `FM-SEC-OWNER-001`/`002`; do not revoke intentional RPC access or add browser RLS policies merely to silence an advisor without policy review.

## Dependency states
`ACTIVE`, `SATISFIED`, `BLOCKED`, `SUPERSEDED`.

Cross-domain dependencies must be linked to the same FanMind task IDs and #874. Do not create a parallel finishline tracker unless #874 is explicitly superseded.
