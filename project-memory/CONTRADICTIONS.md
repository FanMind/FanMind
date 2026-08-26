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
- Updated: 2026-08-19
- Related task/change: FM-STG-001 / #642/#643/#644
- Risk: R2
- Source A: older P1/referral/staging issue bodies
- Claim A: separate Staging/Supabase/Stripe/synthetic identities and broad lifecycle prerequisites are still absent.
- Source B: central finishline #874 Gate 1 and later Staging/Referral evidence
- Claim B: isolated Staging foundations and primary Staging acceptance are now recorded complete, including rollback-protected Referral/Billing lifecycle.
- Stronger/current evidence: #874 later run/commit evidence.
- Status: RECONCILIATION_REQUIRED
- Resolution/action: map each remaining old checkbox to current test/run evidence; close/supersede only stale checklist items, retain genuine regression gaps. No reimplementation from zero.
- Evidence: #874 Gate 1; deep audit.

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
- Updated: 2026-08-19
- Related task/change: FM-AI-001
- Risk: R3
- Source A: older #560/#874 checkboxes saying separate Plus/Ultra Test prices are absent.
- Claim A: Test prices still need creation.
- Source B: later Source of Truth/#874 Staging evidence
- Claim B: isolated Stripe Test catalog including Plus/Ultra is now read-only/finishline verified, while complete lifecycle/product/quality activation remains open.
- Stronger/current evidence: later Staging truth.
- Status: RECONCILIATION_REQUIRED
- Resolution/action: before Gate 4 action, verify current Test catalog IDs/status read-only and focus on missing lifecycle/product evidence rather than blindly recreating prices.
- Evidence: Source of Truth Staging section; #874 Gate 1.

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

Never resolve a contradiction by deleting the older record. Document which source was stale or wrong and why.
