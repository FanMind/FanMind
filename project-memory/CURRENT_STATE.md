## Creator foundation accepted — 2026-09-11
- Bounded source/schema/JWT/PDF scope ACCEPTED; overall FM-CREATOR-001 / FM-SOC3-001 remains IN_PROGRESS. #1108 reviewed head 9a421bc3 passed all 13 checks and final 17:34:55 UTC independent review; merged main f0c7a84e6105752d34b489520fb92d2bb7e5b61a, tree 2e01ad99.
- Protected Verify 34628681395 proved exact legacy state. Upgrade 34628886294 committed the PT409-only function correction with exact POSTFLIGHT=PASS at 17:39:36 UTC; no repeated foundation Apply or activation operation. Staging Deploy 34628740980, Web Deploy 34628626636 and public Readiness 34628752787 passed.
- Actual acceptance 34629009649 PASS: real owner/member/foreign JWT isolation, one style, edit/reapproval/stale/concurrent revisions, both actual PDFs and bundle cascades. Independent always-cleanup and temporary-member rotation/rejection both PASS. Final independent 17:42:49 UTC read: four tables zero and unfinished Creator RPCs zero. No provider/model call; runtimeActivated=false is the controller result, not observation of the deployed process flag; that flag remains UNVERIFIED. qualityAcceptance=false.
- This supersedes older pending/failed foundation checkpoints only. Do not reapply SQL or rerun the accepted foundation merely for a new reader commit. Canonical readers now point to the actual source/target receipt. No executable behavior changes in this closeout. EV-CREATOR-STAGING-FOUNDATION-20260911 records the 24-hour mutable evidence TTL and revalidation triggers; history is retained, current target claims require freshness.
- Remaining: controlled enabled UI and full account/contact deletion acceptance; real Creator writing examples/blinded quality and confirmed-chat learning; central Meta/TikTok/X apps, each Creator's consent, X budget and real provider acceptance. Meta developer portal currently requires secure user sign-in; no platform credentials may enter chat. No runtime activation was performed and the deployed Creator flag still needs an independent check; paid activation remains deferred, Android remains after Creator/Social, Backup stays separate. External account/consent steps are tracked by owner-required NBA-CREATOR-SOCIAL-EXTERNAL, separate from executable engineering.

## Creator conflict recovery — 2026-09-11
- FM-CR-033 / FM-CREATOR-001, existing R4 Creator/Meta lock. #1107 merged as 03ecdc181147b59608288dbb9eb553c95cb74efe after 12 green exact-head checks and completed independent review at 17:11:46 UTC. Production Deploy 34626547339, Staging Deploy 34626617033 and public Readiness 34626710505 passed.
- Actual run 34626769355 passed authenticated/isolation_verified/disclosure_verified, then failed request_timeout at stale revision. Independent Creator cleanup AND temporary-member rotation/rejection passed. All four tables were independently empty. Two runaway Creator RPC backends, bound by PID/start/fingerprint to the two test periods, were conditionally terminated; zero remain. No unrelated database/runtime/Production change.
- Supabase's official 40001 retry-loop documentation now explains the reproduced failure. A pinned function-only PT409 correction preserves the original artifact and all rights/data, with separately confirmed reviewed-main Staging upgrade, exact old/new comparison, empty-table locks, transactional and independent postflight and no blind retry. The 60-second workaround is removed; acceptance still requires a specific conflict, not a generic error.
- Local validation: 43 focused tests and 1331 Operations tests pass, with three local PG17 skips reserved for mandatory native CI; build, lint (one existing unrelated warning), truth/drift and memory checks pass.
- Next: current source review/native PG17 CI, Verify -> controlled upgrade of the proven-empty legacy foundation, Staging deploy and one complete JWT/PDF/revision acceptance. Do not repeat foundation Apply. Runtime/UI, whole-account/contact deletion, style quality/learning and provider apps/consent remain open; Backup and paid activation stay separate.

## Real Creator acceptance follow-through — 2026-09-11
- FM-CR-033 / FM-CREATOR-001, R4, existing Creator/Meta lock. #1106 is published as main 0ea87d3c6905eae38b8518d20542411c432a0839, tree a40f56a2; all 13 checks and final 16:54:28 UTC independent review passed. Production Deploy 34624773924, public Readiness 34624945190 and Staging Deploy 34624785610 passed.
- Real target run 34625034162 passed schema/version checks and synthetic-member activation, but the combined JWT/PDF/revision step failed; its generic diagnostic does not prove a completed sub-gate. Independent always-cleanup passed. Fresh 17:00:24 UTC read proves all four Creator tables empty.
- Member rotation reached a successful Admin update and marker/membership postflight, followed by password_rejection_invalid on the rejection proof. The marked member still exists; its metadata update at 16:59:34 UTC follows the last sign-in at 16:59:00 UTC. Do not claim the rejection proof passed.
- Follow-up source selects Auth API version 2024-01-01 and accepts only structured invalid_credentials or the exact documented legacy invalid_grant + Invalid login credentials pair; other errors remain failures. Fixed allowlisted error codes and completed-stage checkpoints make the next acceptance diagnostic useful without private text. Expected revision-conflict requests have a bounded 60-second response allowance; no timeout counts as success and no client retry is added.
- Next: reviewed source/CI, Staging deploy and one controlled acceptance against the proven-empty fixtures. Do not repeat schema Apply or widen grants. Runtime/quality/provider/full-delete gates remain open; Backup and paid activation remain separate.

## Creator/Social data disclosure continuation — 2026-09-11
- FM-CR-033 / FM-CREATOR-001 under the existing R4 Creator/Meta lock. Creator schema Apply 34623104141 is verified, with independent 16:39:30 UTC catalog proof: four empty RLS tables, three functions, browser Creator/style updates denied. No repeated schema Apply.
- Concrete defect: the existing PDF collector attempted user-JWT access to the service-only Social connection table after its Staging installation. The corrected server-only reader exports only six scoped metadata fields after renewed owner authorization; all Creator datasets still use the real owner's JWT/RLS. Optional absence is distinct from failed access.
- The controlled real-JWT acceptance now also requires the deployed exact main and proves each synthetic owner's actual PDF contains their own Creator/style and excludes the other account and secrets. No files/private contents are retained; cleanup remains exact-run-bound. Source tests use the real PDF builder/parser.
- Source review/CI, exact Staging Web deploy and actual JWT/PDF run remain required. Runtime/UI, contact/account deletion, real quality/learning and external provider consent are still open. Creator flags stay off; paid activation and Backup are unchanged.

## Creator schema and acceptance review follow-through — 2026-09-11
- FM-CR-033 / FM-CREATOR-001, Risk R4, existing LOCK-FM-CREATOR-META-FINISH-20260911. #1105 is merged as 3f6178bd58a05a0457feea87fb7a894aba6e6591, tree da35ac81e7f985f9fa21914ac15a6666de77f619. Exact-head native Android/iOS, PG17, Web/browser and independent review passed. Production Deploy 34622111581 and public Readiness 34622261563 passed; the separate historical Backup audit remains failed.
- Protected Creator Verify 34622658443 passed on that main with STATE=absent / NEXT=apply. Controlled Apply 34623104141 committed at 16:38:15 UTC and independently returned STATE=verified / POSTFLIGHT=PASS / RUNTIME_ACTIVATED=false. No schema retry is needed. Creator runtime stays off.
- #1106 review corrections now include opaque-key headers, the shared member lock for fixture provisioning too, response byte limits before buffering, and an explicitly confirmed original-run receipt for cleanup recovery. Ten behavior tests / 27 targeted tests pass; current source review/CI and real JWT acceptance remain pending.
- Next: finish exact-source review, verify target installation, run the controlled real-JWT test, then DSAR/runtime/deletion/quality/provider acceptance. No new Backup work or paid activation.
## Creator JWT acceptance continuation — 2026-09-11
- FM-CR-033 / FM-CREATOR-001 under LOCK-FM-CREATOR-META-FINISH-20260911, Risk R4. Continues the authorized isolated Creator Staging completion, separate from Backup and paid activation.
- Source #1105 adds Meta first import, one writing style and the controlled schema installation. Its review corrections make authenticated Creator tables SELECT-only and the two mutation RPCs explicitly owner checked. Native PG17 tests pass; final current-head source/native/review and target receipts are tracked in the PR.
- New controlled `accept` mode verifies the installed schema first, then the two existing marked synthetic owners and the temporary marked member with real JWTs. It refuses prior Creator data, validates direct-write denial, one Creator, foreign/member boundaries, drafts/reapproval and simultaneous expected revisions. Run/attempt/SHA-bound cleanup has an independent always step; member credential rotation/rejection also always runs.
- Five local behavior tests prove zero network on invalid targets, no mutation of existing/unmarked fixtures, lost-create-response cleanup, cleanup failure and retry for the same run, and denial of foreign-run cleanup. No real JWT acceptance or runtime activation is claimed from mocks. Provider calls and synthetic-to-learning ingestion remain zero.
- Next: source review/CI, exact-main schema Verify/Apply, then protected real JWT acceptance. Runtime/UI, DSAR/account/contact deletion, real writing quality/learning and provider apps/consent remain separate proof requirements. No change to accepted Sales gates.

## Creator / Meta continuation — 2026-09-11
- Task FM-CREATOR-001 / FM-SOC3-001 / FM-CR-033; Risk R4; LOCK-FM-CREATOR-META-FINISH-20260911. Owner explicitly requests finishing the reported Creator/Social steps.
- Prior #1104 is complete: main d19254f0, empty Social Staging Apply 34591339718 and deploy 34591566257 accepted in its final receipt; previous pending/active checkpoints below are superseded for that scope. No repeated Social schema installation.
- Implemented now: Meta message callbacks and explicit Facebook page selection invoke the existing bounded first import after saving and rechecking the exact connection; shared limiter, processing/owner/demo gates and distinct partial/error outcomes. URL returns do not authorize imports.
- Creator pipeline excludes explicit/default legacy profile styles; rollout UI uses one text writing style plus business rules. Retained controlled Creator Staging runner/SQL comparator resumed and real PG17 negative/rollback tests extended.
- Local: Next build and TypeScript pass; targeted callback/style/control tests pass. Full Operations had 1,306 passes, three PG17 skips and one workflow inventory expectation now updated for the new protected controller. Final CI/PG17/browser target proof remains required.
- PR #1105 first source checks passed Web/build/browser/security. Review found direct profile writes could bypass approval and unexpected ACL grantees could pass the comparator; both are corrected before target installation. All Creator tables now require SELECT-only authenticated access and owner-checked atomic RPC writes; full ACL allowlists and negative PG17 cases enforce the boundary. Initial PG17 index comparison missed PostgreSQL’s pg_temp alias; normalization now handles that exact alias. Expo SDK57 patch alignment addresses newly published dependency expectations without changing Mobile product scope. Current-head CI/review must pass.
- Fresh Staging read 15:31:41 UTC: zero Creator tables/functions, five protected parent tables, authenticated profile UPDATE denied. No target Apply or Creator flag activation yet. GitHub protected Staging has existing DB and synthetic owner/secondary account resources; its 16-secret inventory contains no TikTok/X/Meta provider app secrets. Host/provider configuration is not inferred from that inventory alone.
- Remaining: publish/verify this source, controlled Creator target installation/runtime/JWT/export/delete proof, actual provider apps/Creator consent/X budget and real style-quality/learning. Android and paid activation retain their owner deferral; Backup stays separate FM-OPS-001.

## Social schema Staging follow-through — 2026-09-11
- FM-SOC7-001 / FM-CR-032 remains active under LOCK-FM-SOCIAL-CONNECT-FLOW-20260911, Risk R4. Source #1103 is published as main 3df6f5f87cb71ee4775f1c6797f42db810ded32c, exact reviewed tree 323eb2ce; 13 PR checks and independent review completed. Deploy 34589815376 and public Readiness 34589929792 passed. Earlier source/CI pending text below is superseded by #1103's final receipt.
- Controlled Verify 34590000782 passed on that exact main: STATE=absent, no apply. Apply 34590217929 then stopped with apply_indeterminate_verify_before_retry. Independent read-only target check at 10:40:58 UTC proves both Social tables absent and zero Social functions; no partial installation or provider activation exists.
- Fresh target metadata shows Supabase grants service_role ALL table privileges by default in public. The bounded correction revokes those inherited grants on the two new tables before granting only SELECT/INSERT/UPDATE/DELETE. Exact ACL verification stays intact; the real PG17 fixture now models these observed defaults and must reject an extra service-role TRUNCATE grant.
- Next: review/test/publish only this grant correction, run the protected Verify then Apply/Postflight against the new reviewed main, and record target success before releasing the lock. Do not rerun the old Apply, change global default privileges, delete schema or use ad-hoc target DDL.
- Remaining: central provider app/Creator consent/X budget and real provider acceptance; Meta historical first import still needs its automatic callback handoff. Existing Webhooks/manual sync are retained. Creator draft cd5cac7c remains unchanged; Android follows Creator/Social.
- Production audit 34589929800 still reports the separate historical Backup worker failure. No complete Operations/provider/sales acceptance is claimed; sales_ready=false.

## Connection return and first preview — 2026-09-11
- Task: FM-SOC7-001 / FM-CR-032 / FM-DEC-018; Risk R4; LOCK-FM-SOCIAL-CONNECT-FLOW-20260911.
- Owner confirms FanMind login -> choose channel -> official platform login/consent -> return and permitted retrieval. Central FanMind developer-app configuration is distinct from each Creator's own consent; no platform passwords in FanMind. One text writing style per account remains binding.
- Implemented: return opens TikTok/X/Instagram/Facebook; Meta login buttons use document navigation compatible with the existing CSP. X initial preview requires a server-confirmed pending connection and consumes the same DB read lease atomically; duplicate URL/tab/reload cannot authorize another first read. Manual reads retain the 15-minute bound.
- Controlled Staging schema Verify/Apply/Postflight source uses pinned SQL, target/commit/TLS binding, private passfile and exact catalog/function/ACL comparison. Both Social tables were absent in the fresh read-only Staging preflight. No target SQL or provider activation has run.
- Verification so far: 25 focused behavior/control tests pass; TypeScript and Next build pass. Required independent PG17/schema/rollback and Chromium journey checks remain pending in current-head CI.
- Prior #1102 publication is closed: merged 95bbd13a, matching tree 6cb730eb, Deploy 34582527767 and public Readiness 34582645358 passed. Final receipt released LOCK-FM-SOCIAL-OAUTH-20260911; previous pending-source instructions below are superseded.
- Backup audit 34582645378 failed due to the earlier September 11 database backup. Follow-up is recorded separately under FM-OPS-001; no current all-green Operations claim. Owner prioritizes Social engineering; no check/history is weakened.
- Next: independent source countercheck/publication, controlled Staging installation, then central app/consent/budget/provider acceptance. Creator draft cd5cac7c is retained unchanged; Android and owner-deferred paid activation keep their prior order.

## TikTok / X connection implementation — 2026-09-11
- Task: FM-SOC7-001 / FM-CR-031 / FM-DEC-017; Risk R4; LOCK-FM-SOCIAL-OAUTH-20260911.
- Owner now explicitly includes TikTok and X/Twitter in ongoing Creator/Social work. One account, one text writing style remains FM-DEC-016; Discord/manager/team work stays later.
- Source: official TikTok profile OAuth and X OAuth2/PKCE, account-bound encrypted credentials, atomic one-use state, unique account bindings, controlled refresh/disconnect and bounded X inbound one-to-one preview. UI explicitly distinguishes profile-only from DM access. No preview CRM ingestion or learning writes.
- Verification so far: 13 behavior tests; full Operations suite 1,282 passed, zero failures, two actual-PG17 cases deferred to required CI; Next build passed. Type generation resolves the clean-worktree RouteContext preflight requirement. Database/Chromium proof and final exact-head review/publication still pending.
- Remaining: new schema target-bound controlled rollout, approved provider apps/account consent, X budget and actual provider/legal proof, later persistent CRM import and Production activation. Both provider paths are default-off and structurally Staging-only. Do not call this a live integration.
- Retained Creator draft: cd5cac7c5b559b1f6aeef1808bf3ac0e978fbfe1 re-materialized without edits; its earlier protected Creator Staging work is not applied or superseded. Continue separately after its own review.
- #1101 final receipt releases the earlier style-documentation lock; #1100 receipt already released the reader closeout lock. Those publications are not to be repeated.
- Next: complete current PR CI/database/browser counterchecks; final PR receipt binds source completion and releases only this bounded source lock. Then continue the recorded rollout/provider prerequisites, not completed billing/Android tasks.

# FanMind Current State

## One account, one text writing style — 2026-09-11
- FM-DEC-016 / FM-CR-030: each normal user is the Creator of their own account. Exactly one writing style per account; voice means written expression, never audio or real voices. All reply variants stay in that style.
- A future manager may supervise separate Creator/user accounts and their channels. Use the selected account's style and fan context; no pooled style or manager-persona substitution. Manager/team/multi-workspace implementation remains later.
- This is a documentation clarification only. Existing Creator SQL cardinality and same-style reply policy support the contract, but legacy prompt/UI conformance and real Creator target acceptance remain open. The separately prepared local Staging rollout is not published or applied by this change.
- #1100's final receipt already closes the prior reader release at 8c03b78c; do not repeat it. Continue the existing Creator/Social work before Android; retain all current sales/provider/billing/restore gates.

## Creator und Social jetzt, Android danach — 2026-09-10
- FM-DEC-015 / FM-CR-029 is current: one Creator per independent account/Workspace. Team access, extended roles, auditable approval workflows and multiple Workspaces remain later. Android follows the current Creator/Social increments; paid activation remains owner-deferred until actual tax/UID facts.
- First source package is published: PR #1099 merged as 0e5ec0a2e8bfa3cb0c7e46248cdbbda83dedc16c; exact tree cb4a979ed9aa4daf8e49740c9ae222024bbcbde4 matches all 14 successful checks on d0798960374bc69811db0c21c922a405818c1f1a. Deploy 34529647457, independent Production audit 34529903547 and public readiness 34529903536 all passed for that release.
- Implemented: structured Persona/Voice/Playbook editor, automatic existing-pipeline Creator context with Fan Memory/Summary, Recommended/Softer/Stronger, confirmed commercial review/purchase/offer entry, AFTERCARE and bounded offer strategy, DSAR export and manual Social/OnlyFans handoff.
- Real PostgreSQL 17 negative/atomic checks passed without skips (job 103045962829). Real Chromium Creator edit/reapproval/purchase-entry and existing CRM journeys passed (job 103045963302). Public desktop/mobile, CodeQL, dependency, Mobile compatibility and all memory checks passed. Local Operations: 1,269 pass plus one PG17-only local skip; local TypeScript/lint/truth/build pass.
- Target activation is still OPEN: no Creator SQL, flag, provider permission or real customer data was activated. Controlled Staging Apply/Verify/runtime acceptance, blinded two-Creator voice quality, 30–100-message voice onboarding and full confirmed-chat/reaction/purchase learning remain next. Direct OnlyFans API and real Meta/Legal acceptance stay separate.
- Latest live browser confirms the new content but found Phase 7 still grouped under Later. The bounded closeout change moves it to In progress/preparation and reconciles the obsolete integration summary; no feature activation is implied.
- LOCK-FM-CREATOR-SOCIAL-20260910 is RELEASED for the first source package. LOCK-FM-CREATOR-CLOSEOUT-20260910 covers only this reader/evidence reconciliation. Once its enclosing PR receipt completes, resume FM-CREATOR-001 with a fresh target-bound work lock; do not rebuild or re-publish #1099.
- Preserve DB_POSTCHECKED, accepted Staging and completed Security/Billing/Mobile sub-scopes. Sales_ready remains false. PR #1098 consent correction was already published at 22017b3a (Deploy 34510228167, Audit 34510392821, Readiness 34510392800); no repeated tax/activation questions during owner deferral.

## Paid activation engineering — 2026-09-10
- FM-BILL-003 / FM-CR-028: repeated owner activation instruction is recorded as FM-AUTH-PAID-ACTIVATION-20260910. Price, normal publication and necessary controlled activation permission must not be requested again; actual tax, consent and provider evidence must still be correct.
- Implemented and locally verified: all three setup forms submit their displayed payment-terms revision; both authenticated provisioning entry points and the trusted-consent helper reject missing/stale revisions before Workspace mutation. Persisted editable Auth metadata cannot substitute for the submitted revision. Existing activation, authentication, origin, commercial and tax boundaries remain intact.
- Nine new executable behavior tests pass, including both real entry points, all three packages, no-mutation rejection and rendered form values. The 1,252 Operations tests, truth checks, lint (one pre-existing unrelated warning), TypeScript and normal Production build pass. Final current-head CI/review and exact deployment evidence belong to the enclosing PR; do not infer runtime publication from this source checkpoint.
- Fresh read-only Production countercheck: Starter RPC count=0, Daily RPC count=0, both Billing ledgers absent, browser Workspace INSERT still granted. Full activation remains PARTIAL. Applying the historical June-version functions cannot establish consent to the materially changed September public terms. The authoritative tax/status fact is still missing; Live Stripe has zero recorded Tax registrations in the retained September-10 observation.
- Next: finish the bounded code publication, then align the actual tax/contract revision with jointly reviewed Workspace functions and complete the existing Expand/Contract, Daily and Billing/canonical rollout plus real email/checkout/webhook acceptance. Never relabel existing consent or synthesize an acceptance. This code patch does not close those engineering steps or the four overall gates.
- Preserve completed #1095–#1097 catalog/account and Security work, accepted DB_POSTCHECKED/Staging, existing signed builds, and all remaining Restore/Mobile/Push/AI/Meta tasks. Creator remains Phase 7b after accepted Sales Handoff and before further Phase 8; sales_ready=false.

## Confirmed three-offer publication — 2026-09-10
- Public catalog/account scope of FM-BILL-002 is PRODUCTION_CONFIRMED: PR #1096 merged as 0b54ffba3e46757f47e1a3a1c6c4696d6e26b098, matching reviewed tree 10700d47c0c139c50643c40b69c8a6c59138cafe. All 13 checks on final head 637e72790e651ba84c7a6c4868768410f9da8378 succeeded; all review threads are resolved.
- Deploy 34502092289, independent Production audit 34502241951 and public readiness 34502241927 succeeded on that exact release. The audit log records PRODUCTION_AUDIT_VERIFIED=true at 16:27:53Z. PR #1096 retains the live DE/EN/browser countercheck and final publication receipt.
- Original publication lock LOCK-FM-BILL-002-20260910 is RELEASED. No offer implementation, price recreation, publication or trigger/password activation is pending from #1095/#1096.
- Full paid activation remains PARTIAL under FM-LOOP-THREE-OFFERS-20260910: Production Workspace/Daily provisioning and rights rollout, compatible versioned consent, both Billing ledgers/canonical processing, actual tax facts and real email/checkout/webhook acceptance. Completed catalog publication does not grant customer or Workspace consent.
- Current four-gate table: docs/operations/RELEASE_ACCEPTANCE_20260910.md. Accepted DB_POSTCHECKED and isolated Staging remain accepted; real Storage/config/cleanup, Mobile/Push, AI quality/cost, bounded Staging RPC review and Meta/provider evidence remain in their existing tasks. Creator stays after accepted Sales Handoff and before further Phase 8; sales_ready=false.

## Three-offer review and Auth closeout — 2026-09-10
- PR #1096 review corrections: Daily has a presentation-only effective identity across dashboard, onboarding, account/settings, package cards, cancellation and admin counts; persisted pilot/internal_daily_test and all permission/payment rules remain unchanged. Member-safe views never disclose a commercial identity. The exact public plan=daily route is added to the existing consent-gated PageView allowlist; private/referral query values remain denied. Obsolete 24-hour reader instructions are reconciled with permanent catalog versus protected activation.
- Full local suite after correction: 1,446 passed, one skipped, zero failures; normal build, type/lint and truth checks pass. Final head 637e7279 has all 13 successful checks, including desktop/mobile and synthetic core-flow browser checks; publication is confirmed above.
- Production drqkpdvtbbrrdwmtrodz and isolated FanMind Staging vshyhvgcmrlagvfnvomc: Prevent use of leaked passwords enabled through the authenticated provider UI. Saved and reopened switches are checked; independent advisors at 16:11:50Z (Production) and 16:19:32Z (Staging), 2026-09-10, no longer report auth_leaked_password_protection. Production retains only 14 service-only RLS INFO findings; Staging retains 29 INFO findings and two intentional-RPC warnings pending bounded exception review.
- Trigger hardening and both Auth protections are complete and must not be requested again. Remaining real full-activation engineering, tax/contract/email/provider and four-gate status remain in docs/operations/RELEASE_ACCEPTANCE_20260910.md. No complete paid activation or sales_handoff is claimed; existing Staging/Restore acceptance and Phase-7b order are preserved.

## Three approved offers and verified completion evidence — 2026-09-10
- Owner decision FM-DEC-014 / FM-CR-027 authorizes three permanent public offers and publication: Starter Flex 990 EUR setup + 312 EUR/month; Starter 12 Monate 0 EUR setup + 312 EUR/month with the existing 12-month term; Daily 0 EUR setup + 1 EUR/day. Daily reuses the existing price/engine and supersedes only the former 24-hour public beta restriction.
- FM-BILL-002: catalog, DE/EN account selection, terms presentation and existing protected setup/checkout compatibility are published and independently confirmed in PR #1096. Final local suite: 1,446 passed, one skipped; full final-head CI succeeded. Full paid runtime activation remains separate.
- PR #1095 is PRODUCTION_CONFIRMED at 9a6e9d016cb0928e58b89c6c2d5b6183379c50ed; deployment 34493661010, independent audit 34493830507 and public readiness 34493830467 succeeded. Its final PR receipt releases the lock. This closes the account-only Web publication, not genuine email delivery or paid Workspace/Checkout acceptance.
- Security trigger subtask is PRODUCTION_CONFIRMED: Production Apply 34496892707 / job 102937525772 returned applied; independent Verify 34497099991 / job 102938240926 returned verified. Full before/after Production audits passed on 9a6e9d016cb0928e58b89c6c2d5b6183379c50ed. Supabase advisors at 2026-09-10T15:38:41Z independently show no mutable-search-path or browser EXECUTE warning for these trigger functions.
- Fresh Production read: both Starter and Daily provisioning RPCs are absent and direct browser Workspace INSERT privileges have not been contracted. Live Stripe has zero Tax registrations. Current consent version remains unresolved. These are rollout/tax/contract dependencies, not missing permission to publish the three prices.
- Four-gate explanation and exact next steps: docs/operations/RELEASE_ACCEPTANCE_20260910.md. Accepted Staging and DB_POSTCHECKED are preserved; no duplicate Restore/build/price creation or automatic payment.
- Requested account/catalog publication is complete. Actual recipient, disposable Restore target/cost and authoritative tax facts remain explicit; Auth provider access and both password-protection activations are complete. Creator stays Phase 7b after accepted Sales Handoff and before further Phase 8; sales_ready remains false.

## Registration is the current owner priority — 2026-09-10
- FM-REG-002 / FM-CR-026: owner requested completing and publishing registration now. Account-only signup and confirmed-email continuation are VERIFIED in PR #1095 by application/security/database/CRM checks and 44 public Chromium cases on 11636d87; the final follow-up, review and Production publication are completed, with the exact #1095 receipt retained and #1096 catalog publication confirmed above.
- The free login account is separated from existing protected paid Workspace/Checkout activation. No terms approval, migration, tax registration, payment or third-party email send is inferred.
- Fresh Stripe Live read: zero Tax registrations; active Tax settings alone are insufficient. Exact current payment-terms/version acceptance and the existing billing runtime gates also remain open.
- Next: retain the completed account/catalog release and continue the specific remaining full-activation engineering and acceptance requirements. Preserve Mobile, Push, Restore and Phase-7b Creator sequencing under their existing tasks.

## Five handoff questions reconciled — 2026-09-10
- Production/test separation: FM-STG-001 remains ACCEPTED for the separate Supabase and Web Staging foundation. Do not rebuild it or confuse it with the unfinished full Restore and feature-specific acceptance.
- Signed internal Android: successful immutable workflow 34037085683 proves the existing FCM replacement Preview at 6801d687cfe6048d6e32e63bcfe2862d2886fce0. Reuse it; the older Production AAB and real-device acceptance remain distinct.
- Push: still IMPLEMENTED_NOT_VERIFIED. The registration and atomic Staging ledger foundations exist, but the delivery service has no runtime caller, timer or worker and currently sends nothing. A reviewed single-reminder trigger/receipt integration, fresh real-device registration and separately authorized provider/device acceptance are still needed; Production delivery/scheduling stays unimplemented/disabled. This is implementation plus acceptance work, not just a missing phone confirmation.
- Screenshot package/CI task: FM-SEC-002 source/CI is VERIFIED through merged PR #1089. Web publication is PRODUCTION_CONFIRMED; signed publication of the patched Mobile revision remains open under FM-MOB-001 because Preview 6801d687 and AAB e9641503 predate #1089. Existing Mobile audit exceptions and separate Auth/database security gates remain open.
- Screenshot publication task: the Web changes in #1089 and visible roadmap #1090 are published. Mobile package changes are merged/CI-verified but have no patched signed-release evidence. Current main 20f51f784f7e647ce7e3c3c237f74d558f08e85a has successful deployment 34484012525, audit 34484145499 and readiness 34484145715. FM-REG-001 closes only the deployed Web recovery code; real mail/signup/workspace/device Recovery and payment-terms approval remain open.
- Mutable evidence limit: the zero real Push registration count is the retained 2026-09-08 observation, not a fresh device/database check on September 10. No actual Push receipt/display/tap or Production activation is claimed.
- Priority: keep the accepted foundations and completed release closed, retain every required finishline gate and follow the existing selector/action boundaries. sales_ready remains false; Creator work remains deferred until accepted Sales Handoff.

## Roadmap published and independently verified — 2026-09-10
- FM-ROADMAP-001 is PRODUCTION_CONFIRMED for roadmap visibility only. PR #1090 merged as 7dbd7a3a5cf52ace0e44ed3e66b3084618dc1db1 after ten green current-head checks and the corrected Phase-7a guide review.
- Exact-release Production deployment 34483135613, read-only audit 34483304635 and public go-live readiness 34483304720 succeeded. Main Browser E2E and CodeQL also passed. No further publication of #1090 is pending.
- Independent live browser inspection confirms all ten Phase-7 items in DE and EN, handoff before Creator work, all five Creator entries planned, corrected Phase-5/6 statuses and no horizontal item overflow or hidden vertical card content. The public registration page independently still reports payment_terms_version_unresolved.
- Durable future task: FM-CREATOR-001 remains DEFERRED until accepted sales_handoff; scope docs/CREATOR_INTELLIGENCE.md; no new pre-sales blocker. Required order: open pre-sales work -> Phase 3/7a channels -> Sales Handoff -> Phase 7b Creator Intelligence -> further Phase 8.
- Still open: Restore Storage/config/cleanup and access; Android real-device/recovery/Push and Play acceptance; real registration/mail/workspace and payment-terms approval; AI quality/cost/provider/downstream/authorization and activation; Security/Meta provider evidence; real Phase-3/7a connections and final handoff. Existing Staging, database postcheck, signed artifacts and prices are not to be rebuilt.
- Next: use the existing finishline selector and exact external-action boundaries. Do not restart the rescue helper, repeat the successful database Restore, infer approval for the rejected password action, or start Creator implementation early. This publication closes only the roadmap task; sales_ready remains false.

## Visible roadmap follow-up — 2026-09-10
- Owner expects the approved roadmap to be visible on fanmind.ch and all open points retained. FM-ROADMAP-001 continues in existing PR #1090; do not create a duplicate implementation.
- Fresh baseline: main 44179146926c691476364f668624ac24aab34ac9 includes merged PR #1089. Deploy 34481266092, Production audit 34481420092 and go-live readiness 34481420119 succeeded on that release. Older instructions to publish #1088/#1089 and old audit failures below are historical, not current release blockers.
- PR #1090 initial head 976fab65 failed the rendered-language check on the identical feature name. English copy is corrected without changing the guard; both sets of additive Project Memory records are preserved while merging current main.
- Visible Phase 5/6 now distinguish accepted isolated Staging and existing signed Android builds from open full Restore, real registration/mail/workspace/contract acceptance, AI/Billing, Security/Meta, Play-device and real Push acceptance. No existing required finishline gate is marked complete by this copy change.
- Priority remains: finish open pre-sales work -> Phase 3/7a real channels -> technical Sales Handoff -> FM-CREATOR-001 in Phase 7b -> further Phase 8 work. FM-CREATOR-001 remains DEFERRED, required_for_sales=false, and has the accepted sales_handoff prerequisite.
- Next for roadmap: complete exact-head CI/review, normal release and independent public DE/EN/version check. Read PR #1090 and the live version before repeating publication. Future feature scope is docs/CREATOR_INTELLIGENCE.md and task FM-CREATOR-001.
- Unchanged external work: database Restore is accepted through DB_POSTCHECKED; real Storage/config/cleanup and access remain open. The rescue helper already ran; do not repeat it or the separately rejected password-change action. Existing signed Android artifacts and prices must not be rebuilt/recreated. Protected AI authorization reconciliation, real device/provider evidence and legal decisions remain distinct.

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
2. **Mobile — FM-MOB-001, R3:** signed Android preview and the bounded real-device UI/runtime observation are complete for FM-MOB-003/FM-MOB-004. PR #1028 merged the Android `1.0.0` Store control as `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00`; its exact signed AAB is published in the closed Google Play Alpha track for Germany, Austria and Switzerland, and `fanmind://reset-password` is saved in the exact Production Auth allowlist. FM-MOB-006 accepted the isolated-Staging atomic Push Delivery-Ledger gate on exact commit `18a6ad79cb72331b4daa41ee87dd2430a8ffd473`: apply `33867831888` / `101006621418` and rollback-only acceptance `33867922978` / `101006906941` passed with provider sending disabled, synthetic rows, complete rollback and cleanup. Historical run `33868661986` / job `101009217307` produced a handler-containing Preview candidate for `700885307c265f8907cefe5f5b10499a5ea7b996`, but for Push registration it is superseded by the FCM-bound replacement Android Preview at exact commit `6801d687`, independently verified by workflow `34037085683` / job `101497020224`. The replacement install link was delivered to the owner; device opt-in/registration and separately authorized real provider delivery remain open. The retained 2026-09-08 Staging postcheck recorded zero real push registrations; this is historical evidence and does not establish the current device count. Real Push acceptance remains unproved. The cohort of at least 12 opted-in testers for at least 14 days remains open before later Play Production-access request. `iOS-TestFlight` remains Phase 8.
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

1. **FM-CREATOR-001:** current priority by FM-DEC-015: first source package #1099 is published; finish only its bounded reader closeout, then protected Staging rollout/runtime and voice quality. One Creator per independent account/Workspace; full chat-learning remains next. Reuse existing Facebook/Instagram and manual OnlyFans handoff; actual provider/legal acceptance stays open.
2. **FM-SOC3-001:** selected Facebook/Instagram and human-handoff engineering may proceed alongside Creator work. Never infer App Review, API scope or provider E2E from source availability. Unselected WhatsApp work remains in its existing roadmap.
3. **FM-SOC7-001:** OnlyFans manual handoff and documented technical/legal evaluation; direct API/sending is not implemented or activated. Other Phase-7 channels retain their existing prerequisites.
4. **FM-MOB-001:** Android follows the current Creator/Social increments (FM-MOB-OWNER-CREATOR-SOCIAL-20260910). Preserve signed Preview/Alpha and Push-ledger evidence; do not rebuild the old artifact, start a cohort, or resend push now. The newer package patch still needs its own signed/device publication later.
5. **FM-RST-001:** DB_POSTCHECKED and private Storage controller preparation remain accepted. Real Storage target/upload/cost and final acceptance remain owner-deferred; no repeated database Restore.
6. **FM-SEC-001:** trigger hardening and both leaked-password protections are proved by the latest recorded receipts; do not repeat them. Only genuine remaining bounded Staging RPC and Meta/legal acceptance stay open.
7. **FM-AI-001:** retain accepted general Billing/Staging sub-gates and overall PARTIAL. Paid activation/tax facts remain owner-deferred; Plus/Ultra and canonical Production projection stay guarded.
8. **FM-META-001:** real App Review/provider/legal evidence stays separate. Sales Handoff still requires the genuine remaining gate quorum and final Production demo. Creator development is not an added pre-sales gate.
