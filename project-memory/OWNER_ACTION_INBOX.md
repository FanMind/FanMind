# FanMind Owner Action Inbox

## FM-CHATADMIN-OWNER-VERIFY-20260921 — Read-only Staging VERIFY starten
- Status: COMPLETED
- Task: FM-CHATADMIN-002; Dependency: FM-DEP-CHATADMIN-STAGING-VERIFY-20260921; Risk: R3 read-only.
- Result: protected run `35652258052` / job `106507223598` on exact main `973e70f6d243984d95ec1420a79701faad04a39a` succeeded and returned `CHAT_ADMIN_SCHEMA_STATE=ABSENT`.
- Safety proof: `APPLY` and `ACCEPT` were skipped; the private passfile was removed; no write acknowledgement or protected mutation occurred.
- Consumed outcome: do not repeat this VERIFY only because `main` advances. The next repository step is `FM-GOV-GODMODE-001`.

## FM-CHATADMIN-OWNER-APPLY-20260921 — ChatAdmin Staging APPLY nach God Mode
- Status: NOT_READY
- Task: FM-CHATADMIN-002; Dependency: FM-DEP-CHATADMIN-STAGING-APPLY-AFTER-GODMODE-20260921; Risk: R4 protected Staging write.
- Why not ready: VERIFY proved the schema is `ABSENT`, but the owner sequence requires a cleanly merged/reconciled `FM-GOV-GODMODE-001` before any APPLY request.
- Future exact scope: only after God Mode v1 merge, re-read the then-current main/target and prepare a separate protected `FanMind ChatAdmin Staging Rollout` dispatch with mode `APPLY` and exact confirmation `apply-chat-admin-migration`.
- Boundary: this entry is not authorization to run APPLY now. ACCEPT remains a later separate step after a successful apply/postflight.

## FM-REG-OWNER-ADMIN-CRM-BROWSER-20260919 — Kostenlosen CRM-Zugang im Browser abnehmen
- Status: COMPLETED
- Task: FM-REG-003 / FM-CR-043.
- Result: registration, email confirmation, Platform-Admin “Dauerhaft kostenlos” grant and same-account Web login all succeeded. The reviewed/deployed #1136 hotfix removed the erroneous paid Billing redirect and the owner confirmed normal CRM access.
- Do not repeat: no re-registration, re-grant or Production Admin-CRM database rollout for this account.
- Remaining separate boundary: no additional real Admin-CRM grants until the missing synthetic permanent -> future temporary -> blocked -> login/direct-read lifecycle is accepted under its own protected scope.
- Next product step: use the existing granted account for Facebook first, then Instagram, through FanMind `/channels`. Mobile remains deferred by FM-DEC-021 until company registration and explicit owner resume.

## FM-REG-OWNER-SYNTHETIC-LIFECYCLE-20260919 — Fehlende synthetische Admin-CRM-Lifecycle-Abnahme
- Status: OWNER_ACTION_REQUIRED
- Task: FM-REG-003.
- Reason: the first real permanent Admin-CRM grant happened before the runbook-required synthetic permanent -> future temporary -> blocked -> login/direct-read lifecycle was recorded.
- Current safety rule: the existing real 0-EUR account remains usable and must not be re-granted/deleted. No additional real Admin-CRM grants until this synthetic acceptance is completed.
- Required future scope: separately authorize a protected synthetic confirmed-noncustomer fixture and prove permanent, future temporary, blocked, login/direct authenticated read boundaries and cleanup. Do not repeat the Production migration.
- Parallel-safe work: Facebook/Instagram repository continuation and the existing real account's Social use are allowed while this is open.

## FM-SOC3-OWNER-APP-20260911 — Meta-App-Zugang und Creator-Freigaben
- Status: OWNER_ACTION_REQUIRED
- NBA: NBA-CREATOR-SOCIAL-EXTERNAL; Task FM-SOC3-001; Gate phase3_social; external controls EXT-META-CREATOR-APP-20260911 and EXT-WHATSAPP.
- Current Production blocker 2026-09-19: real Facebook connect reached Meta with example placeholder App ID/callback values and was rejected as “Ungültige App-ID”. Do not retry until FM-CR-045 is deployed and the real central Meta app is securely bound.
- Needed securely outside chat/Git: real Production `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`, exact `FACEBOOK_REDIRECT_URI=https://fanmind.ch/api/integrations/facebook/callback`, valid 32-byte `FANMIND_TOKEN_ENCRYPTION_KEY`, and matching Meta Developer valid OAuth redirect/app permissions. Keep secrets in the protected server/provider UI only.
- After configuration: existing granted FanMind account -> `/channels` -> Facebook -> official Meta consent -> explicit Page selection if multiple -> return to FanMind -> confirm connected Page/token/scopes -> verify automatic bounded Messenger first import; then grant the separate Facebook comment permission and synchronize comments. Instagram follows only after Facebook proof.
- Retained provider checkpoint: the central FanMind Meta app was authenticated on 2026-09-14 and the Instagram Messaging/Content use case was saved after explicit owner consent. That is setup evidence only; all current permissions/App Review/Advanced Access/webhook/account E2E must be revalidated before acceptance.
- Phase 3 additionally retains separately approved WhatsApp Business credentials/permissions and real Staging/E2E/revocation/reconnect/tenant/idempotency proof for its dormant foundation.
- Boundary: never paste passwords, MFA codes, App Secret or tokens into chat. No payment, automatic send or Mobile activation implied.

## FM-SOC7-OWNER-EXTERNAL-20260911 — Externe Phase-7-Abnahme
- Status: OWNER_ACTION_REQUIRED
- NBA: NBA-PHASE7-EXTERNAL; Task FM-SOC7-001; Gate phase7_social; all external controls EXT-TIKTOK-X-PILOT-20260911, EXT-TIKTOK, EXT-X, EXT-DISCORD and EXT-ONLYFANS.
- Current priority: TikTok/X own app/account access, callbacks/scopes, each Creator's consent, actual X budget and real provider evidence using existing authorization. Credentials belong only in secure provider sign-in, never chat.
- Completion scope: this queue item covers the whole Phase 7 gate. Check each named control's status and reuse its accepted evidence; once TikTok/X is completed, request only remaining channel evidence, never repeat completed TikTok/X setup or acceptance just because phase7_social is PARTIAL.
- Deferred scope: Discord remains later; preserve its open control without starting it or asking for early activation. OnlyFans keeps the existing manual handoff; any direct access still requires actual official/contractual feasibility and provider evidence. No new consent or permission is inferred.
- Boundary: TikTok profile login is not a DM approval; X preview is not CRM ingestion. Missing connector/CRM source remains open under the existing tasks and can proceed as bounded engineering within existing authorization. No payment, auto-send or Production activation implied; installed Social schema is preserved.
- Revalidation: current provider/app/credential/target state before reliance. This item remains independent of Phase 3 and closes only with whole Phase 7 acceptance.

## FM-RST-OWNER-001 — Restore runner-group policy + host readiness
- Status: COMPLETED
- Where: GitHub Organization `FanMind` -> Settings -> Actions -> Runner groups -> `fanmind-restore-drill`
- Result: selected repository/workflow policy, Host-1 and Host-2 were revalidated for protected read-only run `32582640853`; all three jobs succeeded and both one-job runners cleaned up.
- Risk: R4
- Duration class: short
- Evidence: run `32582640853`, jobs `97054217701`/`97054234003`/`97054248185`, runner IDs `41`/`42`, issue #944 and controller cleanup output.
- Revalidation: this mutable evidence expires and must be repeated immediately before the later protected R4 write.

## FM-RST-OWNER-002 — Exact isolated database-Restore authorization
- Status: CONSUMED_FAIL_CLOSED
- Where: workflow run `32594374666` on exact commit `8bc8855a6de928cf38ef2e8fb9e9e0860fc477db`.
- Result: the single authorized dispatch and two fresh JITs were consumed. Host-2 stopped at receipt-bound database authorization preflight before the first target write; independent read-only reconciliation proved the database remains empty and runner/private cleanup is safe.
- Risk: R4
- Evidence: jobs `97082934347`, `97082943319`, `97082992861`; issue #944 comments `5382274967` and `5382336892`.
- Do not repeat: no rerun/retry, JIT reuse or inference that the prior authorization remains available.

## FM-RST-OWNER-003 — Exact isolated extension-baseline provisioning
- Status: COMPLETED
- Where: only `fanmind-restore-01` / PostgreSQL 17.11 / database `fanmind_restore`.
- Result: exact extension-only provisioning committed successfully; full receipt and canonical ACL read-only postchecks passed at 97 records with fingerprints `6704956613ca8e58a527336d67b622a043e48a568858873ca5a6fa6b8bd08012` and `abedaf76740b6a7fc1e53433a41337a2f8248d79abfac4ac22c9cf835a1373e3`.
- Evidence: issue #944 comment `5385843508`; final controller PASS output.
- Safety: no database Restore, target reset, JIT/workflow dispatch or Production/Supabase-Staging write. Authorization consumed; do not repeat.

## FM-RST-OWNER-004 — Exact isolated database-Restore authorization after extension closeout
- Status: CONSUMED_PRE_DISPATCH_FAIL_CLOSED
- Where: only the existing isolated `fanmind-restore-01` / PostgreSQL 17.11 / `fanmind_restore` target through the reviewed protected database-Restore workflow.
- Result: authorization comment `5385992305` and controller SHA-256 `45054c41...` were attempted on 2026-08-26. The controller stopped at its first SSH connection to `138.124.213.66:22` after local readiness/main-drift markers. No remote preflight, JIT, protected approval, workflow dispatch, PostgreSQL connection or write occurred.
- Forbidden: no automatic retry or reuse of controller `45054c41...`/authorization `5385992305`; no Production/Supabase-Staging target or write, target reset, reuse of run `32594374666`, runners `43`/`44` or unrelated R4 mutation.
- Risk: R4
- Evidence: issue #944 comments `5385992305`/`5386014235`; exact owner-supplied controller output; controller source order; absence of a later Restore run in current GitHub evidence.

## FM-RST-OWNER-005 — Restore-host SSH reachability evidence
- Status: SUPERSEDED
- Superseded by: the later successful isolated Restore/ACL evidence in issue #944. No owner TCP-22 capture is required for the completed database phase.
- Do not ask before: never ask for this retired action merely to resume Restore work.

## FM-RST-OWNER-006 — New exact isolated database-Restore authorization after SSH reconciliation
- Status: SUPERSEDED
- Superseded by: consumed authorization `5453497602`, workflow `33178878764` / job `98874745740`, and ACL completion authorization `5453727223`.
- Do not ask before: never request another database-Restore authorization for this completed phase; continue with read-only `DB_POSTCHECKED` reconciliation.

## FM-RST-OWNER-007 — Real isolated Supabase Storage target
- Resumed: 2026-09-08 by Bernd for completion; former deferral is lifted, but exact protected/target/cost/legal boundaries remain. See FM-EV-038 for current evidence.
- Status: OWNER_ACTION_REQUIRED
- Decision: Bernd selected `Nur lokal testen` on 2026-09-07 after the live target/cost comparison.
- Current allowed scope: publish and verify only the synthetic local Storage controller; create no Supabase project or Preview branch.
- Current boundary: Production and FanMind Staging are forbidden targets. Local green tests do not prove `STORAGE_RESTORED`.
- Resume trigger: explicit new owner decision accepting a distinct disposable Supabase target and its current cost, followed by exact artifact/commit/project/bucket/cleanup authorization.
- Do not ask before: owner explicitly reopens the real external Storage drill.

## FM-SEC-OWNER-001 — Exact protected Production trigger-function hardening Apply
- Status: COMPLETED
- Result: Production Apply `34496892707` / job `102937525772` returned `applied`; independent Verify `34497099991` / job `102938240926` returned `verified` on exact release `9a6e9d016cb0928e58b89c6c2d5b6183379c50ed`. Full before/after Production audits passed and fresh Supabase advisors removed the related trigger warnings.
- Recorded in: FM-EV-040, `EXTERNAL_ACCEPTANCE.md`, `DEPENDENCIES.md`, `TASK_LEDGER.md`, `STARTED_WORK.md`, `WORK_LOCKS.md`, `EXECUTION_RECEIPTS.md` and the 2026-09-10 release acceptance record.
- Do not repeat: no second hardening Apply or owner authorization is required unless later verified drift creates a new separately reviewed change.
- Risk: R4 completion evidence retained.

## FM-SEC-OWNER-002 — Staging RPC exception decision
- Status: OWNER_ACTION_REQUIRED
- Completed sub-scope: leaked-password protection is already enabled and independently rechecked on exact Production and isolated FanMind Staging. Advisor scans at 16:11:50Z and 16:19:32Z on 2026-09-10 no longer report `auth_leaked_password_protection`. Do not request that provider setting again.
- Remaining owner decision only: explicitly accept or reject the documented constrained authenticated RPC exceptions after reviewing their actual protections. `ensure_current_user_workspace(...)` is authenticated-only with pinned `search_path`, explicit identity/role checks, server-derived prices and no `PUBLIC`/`anon` execution. `get_current_workspace_member_safe_dashboard()` is authenticated-only with pinned `search_path`, `row_security=on`, and returns only five safe membership fields.
- Evidence: FM-EV-041 and the corresponding `EVIDENCE.md`, `EXTERNAL_ACCEPTANCE.md`, `TASK_LEDGER.md`, `STARTED_WORK.md`, `WORK_LOCKS.md` and `EXECUTION_RECEIPTS.md` close the leaked-password sub-scope; the bounded RPC exception review remains open.
- Risk: R3
- Forbidden: blind RPC revoke/grant, invented browser RLS policy, or repeating the completed Auth setting change.
- Do not ask before: the owner is ready to make the bounded RPC-exception decision; it is independent from the completed password-protection change.

## FM-MOB-OWNER-001 — Configure protected Mobile preview resources
- Status: COMPLETED
- Where: exact Expo/EAS FanMind account/project and GitHub Environment `mobile-preview`; Supabase Auth redirect is a separate external acceptance check.
- Prior blocker: read-only run `33000433320`, job `98280538304`, found the protected Preview binding blank and failed closed before any build.
- Result: protected run `33298699290`, job `99222705186`, on exact merge `6a2f5b6c9bac1607ecc2ccae11c6ade3cb418522` reverified the existing EAS project binding and public Preview environment, then completed exactly one Android internal build with HTTPS artifact verification, redacted receipt and cleanup. Submit, Update and Production remained disabled.
- Remaining external work: the bounded FM-MOB-003/FM-MOB-004 UI/runtime observation is owner-accepted on the latest exact build, and the exact Production Supabase Auth redirect is saved. The complete private receipt-bound 19-check Android runbook/validator and real Recovery flow remain open; Push/Store remain separate and iOS/TestFlight remains Phase 8.
- Risk: R3
- Forbidden: exposing project IDs/secrets/private artifact values, EAS reinitialization, automatic repeat build, Submit/Update/Store action, Production crossover or Supabase/Auth/DB mutation.

## FM-MOB-OWNER-002 — Complete the closed Google Play test cohort
- Status: DEFERRED_BY_OWNER
- Where: exact existing FanMind closed Google Play Alpha track.
- Current evidence: on 2026-09-03 the verified Android `1.0.0` Production AAB from run `33316172583` was published in the closed Alpha track for Germany, Austria and Switzerland. This is test distribution, not public Production access. The portal requires at least 12 opted-in testers for at least 14 days; FM-DEC-021 now defers starting that period until company registration is complete and the owner explicitly resumes Mobile.
- Resume trigger: company registration is complete, the owner explicitly resumes Mobile, and at least 12 approved tester addresses are available.
- Required next sequence: enroll the approved testers, verify their opt-in state, keep the test active for at least 14 days, complete the private Play-installed 19-check/Recovery evidence and only then request Production access with separate action-time confirmation.
- Forbidden: another baseline AAB build, fabricated tester enrollment/duration/device evidence, public Production submission without the completed gates, or starting iOS/TestFlight before Phase 8.
- Risk: R3

## FM-AI-OWNER-001 — Approve AI product, quality and financial evidence
- Resumed: 2026-09-08 by Bernd for completion; former deferral is lifted, but exact protected/target/cost/legal boundaries remain. See FM-EV-038 for current evidence.
- Status: OWNER_ACTION_REQUIRED
- Where: written FanMind product/financial decision record plus private quality/cost evidence; Legal/Tax acceptance remains separately external.
- Already fixed: Standard included; Plus +100 EUR/month; Ultra +200 EUR/month; no automatic send; no AI-add-on referral discount; 50/100/150 server-owned context limits; current Test prices/resources/webhook/AI ledger proven by FM-EV-022.
- Existing prices: owner reconfirmed fully created and configured on 2026-09-08; closed commercial setup, not an outstanding decision.
- Required decision/evidence: tier-specific model classes and distinct fallbacks, request/token quotas, 80/100-percent and Overage behavior, upgrade/downgrade/cancellation/proration/refund, cost/margin; four representative weeks of privacy-safe usage/cost evidence; real blinded private quality result through the existing validator.
- Risk: R3
- Forbidden: provider model names, prompts/replies, reviewer identities or secrets in issues/Project Memory; treating the recommendation matrix as approval; Plus/Ultra activation before full tier quorum.
- Resume trigger: complete written decisions and private validators, then re-run only offline/read-only readiness before any protected lifecycle or activation step.

## FM-AI-OWNER-002 — Complete remaining provider-side Staging AI lifecycle evidence
- Resumed: 2026-09-08 by Bernd for completion; former deferral is lifted, but exact protected/target/cost/legal boundaries remain. See FM-EV-038 for current evidence.
- Status: RECONCILIATION_REQUIRED
- Where: exact protected GitHub `staging` workflows plus isolated Stripe Test/Supabase Staging only.
- Current bounded evidence: Run 34273836166 / job 102221843980 on deployed 7f681d26fa0e3c30e743c6a8ef1cd4fef6004e59 technically passed the shared rollout, three ledger verifies, Test catalog, lifecycle, browser boundary and service-role ledger, with full rollback/cleanup and unchanged read-only counters. Its separately required action-time protected-Staging authorization has not been verified in the available record. Publication authorization FM-AUTH-FINISHLINE-PUBLISH-20260908 does not establish that separate scope. Keep this protected acceptance RECONCILIATION_REQUIRED under CTR-FM-AI-AUTH-20260910; retain the observed result, do not invent approval or rerun automatically. Historical canonical Billing rollback 34058118450 remains a passed September 6 run; later deploy 34273614070 invalidated its current-state use, not its recorded completion.
- Required next evidence: reconcile the existing run authorization first. Then assess exact current release/target and evidence freshness before planning only the genuinely missing provider-side inbound webhook/current lifecycle, failed-payment, ordering/idempotency/conflict and canonical downstream Billing -> AI/referral evidence. Any new protected write requires its own exact authorization. Do not repeat SQL installation, catalog setup or a successful historical run merely to repair documentation. Product/private quality-cost, Legal/Tax and Production activation remain separate.
- Risk: R3
- Forbidden: automatic rerun of the invalidated AI-tier proof, duplicate canonical Billing acceptance while its own freshness remains valid, live mode/payment/refund, Production, automatic canonical projection enablement, SQL outside reviewed controls, or paid-tier activation.
- Resume trigger: explicit exact-commit protected Staging authorization after fresh target/provider binding checks; the authorization must name the current deployed revision and current AI-tier revalidation scope.
- Current reconciliation 2026-09-10: PR #1087 is merged as 7f681d26; Production release checks and Staging deploy 34273614070 passed. FM-FAIL-022 is resolved as a workflow-origin defect. Run 34273836166 / job 102221843980 on deployed 7f681d26fa0e3c30e743c6a8ef1cd4fef6004e59 technically passed the shared rollout, three ledger verifies, Test catalog, lifecycle, browser boundary and service-role ledger, with full rollback/cleanup and unchanged read-only counters. Its separately required action-time protected-Staging authorization has not been verified in the available record. Publication authorization FM-AUTH-FINISHLINE-PUBLISH-20260908 does not establish that separate scope. Keep this protected acceptance RECONCILIATION_REQUIRED under CTR-FM-AI-AUTH-20260910; retain the observed result, do not invent approval or rerun automatically. Overall FM-AI-001 remains PARTIAL; prices stay complete.

## FM-META-OWNER-001 — Complete external Meta acceptance
- Resumed: 2026-09-08 by Bernd for completion; former deferral is lifted, but exact protected/target/cost/legal boundaries remain. See FM-EV-038 for current evidence.
- Status: OWNER_ACTION_REQUIRED
- Where: owner-controlled normal browser, exact Meta Business/Dataset Events Manager/Test Events, privacy/legal review and later Meta App Review/provider assets.
- Proven foundation: FM-EV-007 confirms the consent-gated parameterless PageView-only Production path. FM-EV-023 confirms the 2026-08-26 exact-main repository no-PII/security controls and the observed isolated Staging content/continuation/catch-up objects/metadata without writes, activation or provider events; it does not independently prove the ledger-managed continuation timestamp, while the controlled queue is intentionally ledger-free. The mutable Staging observation is TTL-bound by `EV-META-STAGING-FOUNDATION-20260826`.
- Required evidence: no event before consent; exactly one PageView after consent and each safe navigation; no CompleteRegistration/Lead/Purchase or other unexpected conversion; no PII/Advanced Matching; final privacy/legal approval. App Review and real Facebook/Instagram E2E remain part of the later Social gate.
- Risk: R3
- Forbidden: rerunning `33007156552`, `33007311870` or `33007481167` merely for the current closeout; repeating Production ENV/build/deploy; secrets/customer data in issues or Project Memory; CAPI/Advanced Matching/conversion activation; provider/account/OAuth/App Review, SQL Apply or worker/runtime change without separate exact authorization. Fresh Staging revalidation after expiry/invalidation must use a new lock and the shared rollout-state first.
- Resume trigger: owner provides the external account/browser/legal readiness; then acquire a new exact external-acceptance lock before any real Meta event or provider action.

## FM-GOV-OWNER-001 — Protect `main`
- Status: DEFERRED_BY_OWNER
- Where: GitHub repository/organization Rulesets or Branch Protection UI
- Why: `main` should require PRs/checks and block force-push/delete/direct routine pushes.
- Risk: R3
- Duration class: short
- Resume trigger: owner chooses to complete GitHub governance setup.
- Do not ask before: explicit owner resume.

## Rules
- `DEFERRED_BY_OWNER` means keep visible but do not repeatedly interrupt the owner.
- When an action is completed in another chat/session, reconcile GitHub/Project Memory evidence first, then mark it done here.
- Never infer provider, payment, signing, destructive, legal or protected Production acceptance from code or chat text alone.
