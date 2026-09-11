# FanMind Open Loops

## FM-LOOP-SOCIAL-CONNECT-FLOW-20260911
- Status: IN_PROGRESS; task FM-SOC7-001 / FM-CR-032 / FM-DEC-018.
- Source #1102-#1104 is published; selected-channel return and once-only X preview are implemented, Social Staging schema installed via 34591339718 / deploy 34591566257.
- Next: real app/budget/consent/provider acceptance through owner-required NBA-CREATOR-SOCIAL-EXTERNAL, after current-target checks. No repeated source or schema setup; no Production/provider activation inferred.

## FM-LOOP-BACKUP-DATABASE-20260911
- Status: OPEN; task FM-OPS-001, separate from Social source engineering under current owner priority.
- Historical observation bound to #1102: Production audit 34582645378 failed. The database backup job failed at 2026-09-11 00:30:34 UTC with backup_worker_failed, before that source release. Latest observed database success was 2026-09-10 00:30:44 UTC; Storage/config succeeded September 11. These observations are not refreshed by this entry.
- Next: protected host-side diagnosis and controlled function proof. A generic code does not identify the cause. Keep audit/history unchanged and do not claim a fresh fully green Operations acceptance.

## FM-LOOP-CREATOR-SOCIAL-20260910
- Status: IN_PROGRESS; current priority per FM-DEC-015.
- FM-DEC-016 clarification: one text writing style per user/Creator account; no audio or manager-style substitution. Before target activation, verify existing legacy prompt choices/labels and all reply variants respect the one-style contract. Manager access to multiple separate accounts/channels remains later.
- Scope: one Creator per own account/Workspace; profile/voice/playbook, commercial evidence and existing reply/Social handoff foundation. Team/roles/auditable approvals/multi-workspace management follow later.
- Source #1099-#1108 is published. Creator schema/upgrade/JWT/revision/PDF foundation acceptance 34629009649 passed. Actual deployed flag, enabled UI, full contact/account deletion and real quality/confirmed-chat learning remain open; full learning is not implemented yet.
- Exact next: controlled repository/synthetic-Staging UI/delete/learning engineering under NBA-CREATOR-INTELLIGENCE; external app/account/provider acceptance is separate under NBA-CREATOR-SOCIAL-EXTERNAL. Revalidate mutable target evidence after triggers/TTL; Android follows Creator/Social.
- Paid activation deferral: PR #1098 already published the consent correction. FM-BILL-003 is PARTIAL and owner-deferred until actual tax/UID facts arrive. Earlier activation-first instructions below are historical and must not restart questions/actions during this deferral.


## FM-LOOP-THREE-OFFERS-20260910 — full registration activation
- Task: FM-BILL-003 / FM-BILL-002 / FM-REG-002 / FM-LEGAL-001
- Status: PARTIAL
- Owner approved three prices and normal publication; do not ask for that approval again.
- Complete/retain: account flow #1095 and three-offer catalog #1096 published; exact catalog release 0b54ffba3e46757f47e1a3a1c6c4696d6e26b098, Deploy 34502092289 / audit 34502241951 / readiness 34502241927 passed. Live prices already exist; Production trigger hardening and password protection in both environments complete.
- Current progress: FM-BILL-003 adds tested exact displayed-revision binding to both authenticated provisioning entry points; the enclosing PR records final CI/publication. Repeated activation approval is retained under FM-AUTH-PAID-ACTIVATION-20260910. This does not make the legacy June-version SQL match September public terms.
- Remaining engineering: reviewed Workspace Expand/Contract and Daily provisioning rollout, compatible current consent-version migration, Billing ledger/canonical downstream rollout and end-to-end registration/checkout/webhook acceptance.
- Remaining actual external facts: approved real email recipient; applicable tax registration/status and authoritative versioned contract. Zero Live Tax registrations freshly observed September 10. No customer charge to manufacture acceptance.
- Next: controlled Production Workspace/Daily/consent/Billing implementation and actual email/tax/checkout/webhook acceptance. Public-offer approval and publication are already complete. Four-gate matrix: docs/operations/RELEASE_ACCEPTANCE_20260910.md.

## Registration is the current owner priority — 2026-09-10
- FM-REG-002 / FM-CR-026: owner requested completing and publishing registration now. Account-only signup and confirmed-email continuation are VERIFIED in PR #1095 by application/security/database/CRM checks and 44 public Chromium cases on 11636d87; the generated-status follow-up, final review and Production publication are complete in #1095, followed by the confirmed three-offer release #1096.
- The free login account is separated from existing protected paid Workspace/Checkout activation. No terms approval, migration, tax registration, payment or third-party email send is inferred.
- Fresh Stripe Live read: zero Tax registrations; active Tax settings alone are insufficient. Exact current payment-terms/version acceptance and the existing billing runtime gates also remain open.
- Next: preserve completed account/catalog publication and continue the specific remaining full-activation engineering and acceptance requirements. Preserve Mobile, Push, Restore and Phase-7b Creator sequencing under their existing tasks.

This register contains started, partially completed or follow-up work that could otherwise disappear between sessions. Do not use it as a second task backlog; link each loop to an existing task/change ID whenever possible.

## FM-LOOP-001
- Related: FM-RST-001
- Status: OPEN
- Updated: 2026-09-08
- Gap: the database Restore and `DB_POSTCHECKED` reconciliation are complete. PR #1081 accepted the private Storage artifact/receipt preparation; PR #1085 accepted the repository-only fail-closed Storage controller after final head `7d32f5a0c29b8ab581a736b0744bfdcf41f5eddb` passed seven workflows, zero unresolved threads and exact-head review, then merged as `0ccf38e5f1afdd0b5f3495a137a5d360dd214ae7`. Actual isolated Storage upload/postcheck, server-config, disposable-target cleanup, countercheck and final aggregate acceptance remain separate and unproven.
- Close when: every still-applicable post-database state-machine transition has current R4 quorum and independent countercheck.
- Next check: do not repeat workflow `33178878764`, job `98874745740`, consumed controllers or the accepted repository controller implementation. Real isolated Storage remains `DEFERRED_BY_OWNER` under `FM-RST-OWNER-007`; before any upload, require a new action-time owner decision, distinct isolated non-Production target and exact R4 authorization for the accepted controller.

## FM-LOOP-002
- Related: FM-MEM-005
- Status: CLOSED
- Updated: 2026-08-19
- Gap: V2-V6 memory/governance and finishline controls required exact-head acceptance and merge.
- Closed by: PR #975 exact head `2a62dc8337673be0b33acfd4338d0f452224e779` passed all applicable Memory/FanMind/Security/Browser gates and was squash-merged as `b4bef882a55e8c0dd1dd33d0ad1c1664c3078d0d`.
- Follow-up: maintain V6; no parallel memory system.

## FM-LOOP-003
- Related: FM-MOB-001 / FM-MOB-003 / FM-MOB-004
- Status: OPEN
- Updated: 2026-09-03
- Gap: the owner accepted the bounded FM-MOB-003/FM-MOB-004 UI/runtime result, one exact Production AAB is verified for `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00`, and the exact Production Supabase Recovery redirect is saved. That AAB is now published in the closed Google Play Alpha track for Germany, Austria and Switzerland. The broader receipt-bound 19-check Android runbook, real Recovery flow, the deliberately deferred cohort of at least 12 opted-in testers for at least 14 days, the later Production-access request and applicable Push/Store acceptance remain open for FM-MOB-001. iOS/TestFlight has been moved to Phase 8 by FM-DEC-009 and is not a current blocker.
- Close when: the private validator passes a complete 19-check Android record bound to the exact signed build/commit, Recovery/Purge is evidence-bound, and the applicable Google Play/internal-test/store controls are accepted.
- Next check: do not queue another Store build. When FanMind is ready for the Gerhard handoff, have at least 12 approved testers opt in, keep the closed test running for at least 14 days and use the Play-installed Alpha build to generate and complete the private 19-check record, including the saved `fanmind://reset-password` route. Apply for Production access only after those gates are evidenced. Do not start iOS/TestFlight work until Phase 8 is explicitly started.

## FM-LOOP-004
- Current reconciliation 2026-09-10: PR #1087 is merged as 7f681d26; Production release checks and Staging deploy 34273614070 passed. FM-FAIL-022 is resolved as a workflow-origin defect. Run 34273836166 / job 102221843980 on deployed 7f681d26fa0e3c30e743c6a8ef1cd4fef6004e59 technically passed the shared rollout, three ledger verifies, Test catalog, lifecycle, browser boundary and service-role ledger, with full rollback/cleanup and unchanged read-only counters. Its separately required action-time protected-Staging authorization has not been verified in the available record. Publication authorization FM-AUTH-FINISHLINE-PUBLISH-20260908 does not establish that separate scope. Keep this protected acceptance RECONCILIATION_REQUIRED under CTR-FM-AI-AUTH-20260910; retain the observed result, do not invent approval or rerun automatically. Overall FM-AI-001 remains PARTIAL; prices stay complete.
- Related: FM-AI-001
- Status: OPEN
- Updated: 2026-09-10
- Gap: The general Billing ledger is installed on isolated Staging and the bounded canonical Billing rollback-only sub-gate is now counterchecked: exact deploy `34058028839` and acceptance `34058118450` / job `101553652111` passed on `62e6a11858e85996af03f6740819b0fc6194b4a4` with ledger state `verify`, overall rollout `PASS`, cutover pending `0`, uninventoried `0`, full transaction rollback and cleanup `PASS`. The independent read-only postcheck stayed unchanged. Final product decisions, private quality/cost proof, provider-side inbound webhook/current lifecycle evidence, Legal/Tax, Production runtime integration and explicit activation remain incomplete.
- Close when: tier-specific risk quorum is satisfied and any Production activation is explicit and current.
- Next check: do not repeat the completed Staging deploy/canonical rollback acceptance. Resume only from `FM-AI-OWNER-001`/the narrowed `FM-AI-OWNER-002`; keep Plus/Ultra and canonical Production projection fail-closed until all remaining gates are current.

- Required next evidence: reconcile the existing run authorization first. Then assess exact current release/target and evidence freshness before planning only the genuinely missing provider-side inbound webhook/current lifecycle, failed-payment, ordering/idempotency/conflict and canonical downstream Billing -> AI/referral evidence. Any new protected write requires its own exact authorization. Do not repeat SQL installation, catalog setup or a successful historical run merely to repair documentation. Product/private quality-cost, Legal/Tax and Production activation remain separate.

## FM-LOOP-005
- Related: FM-META-001
- Status: OPEN
- Updated: 2026-08-26
- Gap: Pixel technical path is Production-confirmed and the 2026-08-26 Meta Staging content/continuation/catch-up foundation is read-only counterchecked in FM-EV-023, with freshness tracked by `EV-META-STAGING-FOUNDATION-20260826`; external Events Manager/browser reception, provider-side no-PII/no-unexpected-conversion evidence, App Review/permissions, real Meta account E2E and legal acceptance remain incomplete.
- Close when: all applicable Meta external/security/legal acceptance evidence is current.
- Next check: owner-controlled normal-browser Events Manager acceptance under #714. Do not rerun `33007156552`, `33007311870` or `33007481167` merely for this closeout, repeat Production activation/deploy, apply SQL or activate Meta workers/providers. If the Staging observation is later relied upon after expiry/invalidation, acquire a new lock and run a fresh shared rollout-state-first read-only verification.

## FM-LOOP-006
- Related: FM-SOC3-001
- Status: OPEN
- Updated: 2026-08-19
- Gap: Phase 3 foundations exist but Facebook, Instagram and WhatsApp have not all passed real external E2E acceptance.
- Close when: all three required channels pass tenant/idempotency/auth/revocation/reconnect/no-auto-send acceptance.
- Next check: do not start until earlier non-Social gates are sufficiently closed per #874.

## FM-LOOP-007
- Update 2026-09-11: FM-DEC-017 resumes TikTok/X now. Source OAuth/profile/X-DM-preview package is in review; controlled target rollout, real app/access/budget/legal and future persistent CRM ingestion remain open. Do not infer an accepted integration from fixtures or profile login. Discord remains later.
- Related: FM-SOC7-001
- Status: OPEN
- Updated: 2026-08-19
- Gap: Phase 7 real connectors are not accepted; OnlyFans remains conditional feasibility.
- Close when: TikTok/X/Discord have approved official connector scope and E2E evidence, and OnlyFans is either officially/contractually implemented+accepted or explicitly documented unavailable without bypass.
- Next check: current official API/platform capability immediately before implementation.

## FM-LOOP-008
- Related: FM-SALES-001
- Status: BLOCKED
- Updated: 2026-08-19
- Gap: sales material exists, but technical sales handoff is blocked by required Phase-3/Phase-7 acceptance and final Production demo truth.
- Close when: #874 Sales Handoff criteria pass on the exact final release.
- Next check: after Social finishline.

## FM-LOOP-009
- Related: FM-LEGAL-001
- Status: BLOCKED
- Updated: 2026-08-19
- Gap: external tax/legal/register/AVV/provider evidence is incomplete.
- Close when: only genuine external evidence/approvals have been recorded; no technical self-approval.
- Next check: when advisor/register/provider evidence arrives.

## FM-LOOP-010
- Related: FM-RST-001
- Status: CLOSED
- Updated: 2026-08-22
- Gap: canonical restore documentation still contains pre-transfer `user-owned`/`future-org` wording although the current repository is Organization-owned `FanMind/FanMind`.
- Closed by: protected read-only run `32582640853` independently revalidated repository ID `1259448985`, group `fanmind-restore-drill`, selected repository and exact three-workflow scope; canonical readers were reconciled by PR #992, merged as `cb04829c378285c24c3c53b5fab2d03177c19165`.
- Follow-up: mutable runner policy must still be revalidated before every R4 write; do not repeat the organization transfer.

## FM-LOOP-011
- Related: FM-AI-001 / Referral controls
- Status: CLOSED
- Updated: 2026-08-30
- Gap: older issues #642/#643/#644 contain stale Staging prerequisites or unchecked items that newer #874 evidence partially/fully supersedes.
- Close when: each old checkbox has been mapped to current evidence or retained as a genuine remaining gate; then close/supersede stale issues deliberately.
- Closed by: PR #1033 final head `70ea1bc61c7adefb739ba8fa3e16ea0bb84b4e58` passed all 11 exact-head checks and completed review with zero unresolved threads, squash-merged as `cc82dd7ad62e6aaf1d7b2637d49d43010789475f`; the machine-validated map classifies all 46 historical unchecked items, #642/#643 remain open with genuine gates, #644 is closed as superseded by #874, and #874 Mobile wording is current.
- Follow-up: retained gates continue under #642/#643/#874 and their canonical tasks; do not reimplement accepted Staging or reopen #644.

## FM-LOOP-012
- Related: FM-MEM-008
- Status: CLOSED
- Updated: 2026-08-20
- Gap: Project Memory V8 originally omitted mandatory V5 active-work bookkeeping and a prior exact-head Browser E2E run was cancelled.
- Closed by: final exact PR #980 head `704fec4b6264dd5a0dd83cc8e0029352672485d0` included corrected V5 bookkeeping/generated status and passed Guard, Quality, Status, FanMind CI, Landing, Supply Chain, CodeQL and Browser E2E run #915 before merge `22eb6aed5da4fde47860bbe12b118d3780c8a4a0`.
- Follow-up: maintain V8; stale handoff/evidence must downgrade to revalidation.

## FM-LOOP-013
- Related: FM-SEC-001 / issue #982
- Status: OPEN
- Updated: 2026-08-26
- Gap: protected read-only run `32997946812` now proves the exact Production pre-hardening state, and the Staging RPC is classified as technically constrained intentional exposure. Production remediation, explicit Staging exception acceptance and leaked-password protection on both targets remain unaccepted/unapplied.
- Close when: exact-target read-only catalog/ACL/advisor evidence classifies every warning as remediated or explicitly accepted by policy; any approved state-changing action follows the existing R3 protected path with rollback/postflight; fresh advisor scans are bound to exact targets.
- Next check: only after explicit owner resume, run one exact protected Production Apply and post-advisor scan under `FM-SEC-OWNER-001`; decide the separate Staging exception/Auth setting path under `FM-SEC-OWNER-002`. No mutation is standing-authorized.

## Rules
- Every `PARTIAL`, `BLOCKED`, `IMPLEMENTED_NOT_VERIFIED` or `RECONCILIATION_REQUIRED` task must have either an open-loop entry or an explicit reason why no follow-up is required.
- Close loops explicitly; never delete their history.
- A loop may be `OPEN`, `BLOCKED`, `CLOSED` or `SUPERSEDED`.
