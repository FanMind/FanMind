## FM-LOOP-CREATOR-DELETION-INVENTORY-20260922
- Status: CLOSED; Task: FM-CREATOR-001; Risk: R3.
- Closed by: PR #1162 merged as `3532bd4b9a19400284443f35b9b94b2849393aeb`; downstream disclosure/deletion/persistence verification continued through #1163-#1167. Do not rebuild the crash-safe Workspace inventory contract.
- Follow-up: confirmed-chat schema rollout is a separate lifecycle. Repository runner hardening converged through #1168/#1171/#1172; target-aware source-state/deploy reconciliation converged through #1173/#1174; the VERIFY-only protected Staging source control converged in #1175 and is consumed. Actual target VERIFY and every APPLY remain separate protected actions and must not cause the Builder to recreate #1175 or globally stop unrelated repository-safe Creator work.


# FanMind Open Loops

## FM-LOOP-REBOOT-PUBLICATION-20260912
- Status: CLOSED; task FM-OPS-001 / FM-CR-036; LOCK-FM-OPS-REBOOT-20260912 retained.
- Finished local read-only boot collector/verifier, executable failure/redaction tests and Operations regression checks. Automatic approval review rejects publication of this exact code/memory payload to public FanMind/FanMind despite the verified existing repository and recorded earlier grants. No remote branch/PR/deploy/reboot created; do not bypass via another tool.
- Historical blocked next step: concrete owner confirmation for the prepared patch's public publication, then normal current-head CI/review/deploy and actual boot-state/recovery preflight. The previously accepted backup/DB Restore/Creator foundation remain closed.

- Resolution: explicit current owner confirmation FM-AUTH-OPS-BOOT-PUBLISH-20260912; approved source tree published unchanged as a33eedad075d506f566ac5347fc3c0ac74f9a2ff. The earlier automatic rejection remains historical; resume current-head PR review/CI and normal rollout. No runtime/reboot acceptance is implied.

## FM-LOOP-SOCIAL-CONNECT-FLOW-20260911
- Status: IN_PROGRESS; task FM-SOC7-001 / FM-CR-032 / FM-DEC-018.
- Source #1102-#1104 is published; selected-channel return and once-only X preview are implemented, Social Staging schema installed via 34591339718 / deploy 34591566257.
- Next: real app/budget/consent/provider acceptance through owner-required NBA-CREATOR-SOCIAL-EXTERNAL (Meta/Phase 3) and NBA-PHASE7-EXTERNAL (Phase 7), after current-target checks. No repeated source or schema setup; no Production/provider activation inferred.

## FM-LOOP-BACKUP-DATABASE-20260911
- Status: CLOSED; task FM-OPS-001 / FM-CR-035.
- Final evidence: #1111 comment 5644711203. Reviewed hardened/legacy contract correction, scheduled September 12 database backup succeeded/validated/uploaded encrypted; installed full audit 34648286758 / 103525002411 passed on c2342d66ff0fa9f9656360f326cc9ec60f1aaa80 at 08:20:31 UTC. Historical failure remains in the unchanged records; no extra backup was created.
- Preserve: this does not complete the requested Ubuntu reboot or remaining isolated Storage/config Restore. Do not repeat the accepted database Restore or reopen the corrected contract without fresh contradictory evidence.

## FM-LOOP-CREATOR-SOCIAL-20260910
- Status: IN_PROGRESS aggregate gate; only NBA-CREATOR-FOUNDATION-RECONCILIATION-PREFLIGHT is admitted as source-only continuation.
- FM-DEC-016 clarification: one text writing style per user/Creator account; no audio or manager-style substitution. Before target activation, verify existing legacy prompt choices/labels and all reply variants respect the one-style contract. Manager access to multiple separate accounts/channels remains later.
- Scope: one Creator per own account/Workspace; profile/voice/playbook, commercial evidence and existing reply/Social handoff foundation. Team/roles/auditable approvals/multi-workspace management follow later.
- Source #1099-#1108 and the bounded privacy/delete, confirmed-chat, onboarding-input and aggregate-summary continuations through #1184 are published. Their accepted repository scopes stay closed. Actual deployed flag, enabled runtime UI, real private samples, human style approval, blinded quality and provider acceptance remain separate and do not by themselves define a repository implementation package.
- Exact next: NBA-CREATOR-FOUNDATION-RECONCILIATION-PREFLIGHT is the sole admitted source-only continuation at priority 2. The actual failed NBA-CREATOR-CONFIRMED-CHAT-STAGING-VERIFY observation is RECONCILED/CONSUMED; do not replay unchanged VERIFY or infer ABSENT. Never repeat consumed work; never reactivate the consumed broad `NBA-CREATOR-INTELLIGENCE` placeholder. No schema APPLY/runtime activation is implied. External app/account/provider acceptance remains separate under NBA-CREATOR-SOCIAL-EXTERNAL (Meta/Phase 3) and NBA-PHASE7-EXTERNAL (Phase 7). Revalidate mutable target evidence after triggers/TTL. FM-DEC-021 preserves Mobile deferral until completed company registration plus explicit owner resume.
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
- Next check: do not queue another Store build. FM-DEC-021 blocks this entire remaining Mobile sequence until company registration is complete and the owner explicitly resumes Mobile. Only then, with at least 12 approved testers, begin the closed-test period, complete the private 19-check/Recovery record and later consider Production access. Do not start iOS/TestFlight before that explicit resume.

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
- Status: CLOSED
- Updated: 2026-09-20
- Historical gap: Production trigger hardening, explicit Staging RPC exception acceptance and leaked-password protection were previously all open.
- Closed by: Production trigger hardening Apply `34496892707` / job `102937525772` and independent Verify `34497099991` / job `102938240926` passed on exact release `9a6e9d016cb0928e58b89c6c2d5b6183379c50ed`; leaked-password protection was separately enabled and independently rechecked on Production and isolated Staging under FM-EV-041. Do not repeat either completed action.
- Follow-up: only the bounded authenticated RPC exception decision remains open under `FM-SEC-OWNER-002`; it is tracked below as a separate narrowed loop and authorizes no mutation.

## FM-LOOP-SEC-RPC-EXCEPTION-20260920
- Related: FM-SEC-001 / FM-SEC-OWNER-002 / issue #982
- Status: OPEN
- Updated: 2026-09-20
- Gap: explicit policy acceptance/rejection of the constrained authenticated RPC exceptions is still missing. `ensure_current_user_workspace(...)` and `get_current_workspace_member_safe_dashboard()` have different verified protection details and must not be conflated.
- Close when: the owner explicitly accepts or rejects the documented RPC exception after reviewing the exact role/identity/search-path/row-security/return-shape evidence; record that decision without inventing browser policies or changing grants merely to close the loop.
- Next check: owner decision only when ready. No Production Apply, leaked-password setting change, blind RPC revoke/grant or other protected mutation is standing-authorized.

## Rules
- Every `PARTIAL`, `BLOCKED`, `IMPLEMENTED_NOT_VERIFIED` or `RECONCILIATION_REQUIRED` task must have either an open-loop entry or an explicit reason why no follow-up is required.
- Close loops explicitly; never delete their history.
- A loop may be `OPEN`, `BLOCKED`, `CLOSED` or `SUPERSEDED`.

## FM-LOOP-CHATADMIN-20260920
- Status: IMPLEMENTED_FOR_PR; task FM-CHATADMIN-001. Repository-only Owner exception; controlled schema remains unapplied and capability default-off.
- Separate unaffected issue: `production_audit_backup_latest_stale_or_empty` remains open under Operations. This task did not run Backup/Restore or claim the complete Production audit is green.
- Next: local/full verification, publish exactly one bounded PR, then wait for Current-Head CI/CodeQL/Browser E2E and one independent Codex review without P1/P2. Do not merge.

## FM-LOOP-CHATADMIN-STAGING-20260920
- Status: CLOSED; task FM-CHATADMIN-002; Updated: 2026-09-21.
- PR #1146 merged as exact main `648912cc2e9958cc8bc2e39c11b7977dabff862b` after all current-head gates and independent review passed.
- Protected read-only Staging VERIFY run `35652258052` / job `106507223598` on exact main `973e70f6d243984d95ec1420a79701faad04a39a` returned `CHAT_ADMIN_SCHEMA_STATE=ABSENT`; APPLY/ACCEPT skipped.
- This closes the observation loop only. The distinct later APPLY path is blocked behind God Mode v1 and separate owner authorization.
- Separate Operations loop remains `production_audit_backup_latest_stale_or_empty`; do not conflate it with ChatAdmin.


## FM-LOOP-GODMODE-20260921
- Status: CLOSED; task FM-GOV-GODMODE-001; Updated: 2026-09-22.
- Result: PR #1157 final head `79510c8bc35371aa657cf42ca7cded5810341d88` merged as exact main `1c5e1232f0893b0730a985c6e717b5c27c535f35`; post-merge repository/runtime counterchecks completed.
- Boundary: later hardening ideas are new bounded scope. The distinct ChatAdmin Staging APPLY owner action is ready for separate authorization; this loop never authorizes it.

## FM-LOOP-CHATADMIN-APPLY-AFTER-GODMODE-20260922
- Status: CLOSED; task FM-CHATADMIN-002; Updated: 2026-09-26.
- Protected owner-authorized APPLY `36235870895` / `108387398410` completed on exact reviewed `2aaf225fec29fd91c20f822185c770f87eb3d10d`; workflow and independent Staging postflight are VERIFIED, tables remain empty, Production is unchanged.
- Do not repeat APPLY.

## FM-LOOP-CHATADMIN-STAGING-ACCEPT-20260926
- Status: CLOSED; task FM-CHATADMIN-002; Updated: 2026-09-26.
- Protected run `36238536613`, successful attempt 2 / job `108396358120` on exact reviewed `7655aed2cae6ff3588207fee6f2227fd5b8db41c` passed same-run schema VERIFY, rollback-only DB/RLS acceptance and cleanup. Independent postflight confirms zero persistent ChatAdmin rows.
- Attempt 1 failed before mutation at `fixture_identity`; owner-provided protected fixture variables resolved the prerequisite. Do not repeat DB/RLS ACCEPT.

## FM-LOOP-CHATADMIN-MANUAL-FLOW-20260926
- Status: CLOSED; task FM-CHATADMIN-002.
- Result: run `36255475314`, attempt 1 / job `108441348490`, reviewed/deployed main `9652ae62928c70d8f39d8f184857a34fcd4de74f`; all required same-run probe/browser/verify/cleanup/absence/manual PASS markers; independent cleanup `2026-09-26T16:29:38.790838Z`, schema/RLS/ACL `2026-09-26T16:29:38.136543Z`, sessions `2026-09-26T16:29:38.790838Z` and Production absence `2026-09-26T16:29:39.531953Z`. Receipt: `project-memory/receipts/chat-admin-manual-flow-36255475314-1-acceptance.json`.
- Boundary: Only synthetic Staging application acceptance is closed. Real capability grants, private image-storage APPLY and aggregate Production activation remain separate/open. No external social/fan message delivery, automatic send or Production ChatAdmin data/schema/capability mutation occurred; normal application deployments from reviewed main merges remain distinct; prior schema APPLY and DB/RLS ACCEPT remain consumed.
