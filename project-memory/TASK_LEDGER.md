# FanMind Task Ledger

## FM-ROADMAP-001
- Status: VERIFIED
- Risk: R2
- Scope: FM-CR-025 roadmap recording and synchronized dependency/truth/translation controls only.
- Publication: PR #1090 is open; initial remote tree equals the locally verified tree.
- Exact next step: finish current-head CI/review of PR #1090; merge/Production release remains unperformed.

## FM-CREATOR-001
- Status: DEFERRED
- Risk: R3
- Phase: 7b, after technical Sales Handoff and before further Phase 8 work.
- Scope: Creator Intelligence & Sales Assistance on the existing FanMind CRM/reply engine; `docs/CREATOR_INTELLIGENCE.md`.
- Required for sales: false.
- Prerequisite: FM-SALES-001 / sales_handoff ACCEPTED or PRODUCTION_CONFIRMED.
- Completed so far: architecture review and owner scheduling decision only; no Creator runtime/schema implemented.
- Exact next step: after accepted Sales Handoff, revalidate source/model/auth contracts and implement Creator data boundaries before modifying the existing reply pipeline.

Use one heading per task/attempt. Never delete historical entries; supersede them explicitly.

## FM-WEB-004
- Date: 2026-09-04
- Status: IMPLEMENTED_NOT_VERIFIED
- Risk: R3
- Goal: Prepare protected exact-main Staging verification, apply and rollback-only acceptance for the dormant Website Chat retention contract.
- Scope: optional Workspace filter in the controlled RPC, target/commit/TLS policy, private-passfile runner, manual workflows, deterministic synthetic acceptance, tests and runbook. No workflow dispatch, database apply, schedule, Production mutation, installation activation, AI/provider request, outbound email or real visitor data.
- Dependencies: FM-WEB-001/FM-WEB-002/FM-WEB-003, FM-CR-017, exact reviewed `main`, applied handoff schema and a marked synthetic Staging Workspace.
- Evidence required: exact checksum, Production/redirect/weak-TLS rejection, separate confirmations, service-role owner/ACL/table/Cascade postflight, browser denial, invalid-input rejection, Workspace-scoped dry-run/bounded delete/active-Handoff protection, CRM preservation and complete rollback.
- Negative path: wrong ref/SHA/target/confirmation, alternate libpq target, browser execution, global synthetic acceptance, invalid batch/mode, CRM deletion, incomplete rollback, provider call or automatic trigger must fail closed.
- Recovery: repository changes are revertible; all synthetic acceptance writes roll back and the controlled SQL remains unapplied until a separate protected action.
- Result: the retention RPC can now be constrained by `p_workspace_id`; two manual exact-main workflows and fail-closed runners prepare read-only verification, separately confirmed Staging apply and separately confirmed rollback-only acceptance. Exact-main run `33891229801` reached Staging and failed closed at postflight because the contract was not installed. Separately authorized apply runs `33892365719` and `33893575774` failed inside the transactional SQL before commit (`apply_failed`), so PostgreSQL rolled both back. Run 3 yielded the safe fallback class only; SQLSTATE-only diagnostics are prepared for the next retry.
- Evidence: pinned SHA-256 `485bc7133764ce7c2f9d002a4a46a5a1895441ad405c9a7a0fa0970b0900ab0f`; focused retention/Staging 15/15, Website Chat 45/45, release integrations 93/93 and Operations 1113/1113 PASS; TypeScript, lint, Production build, truth/action pinning and Project Memory quality/status checks PASS. Lint retains one pre-existing unrelated Mobile warning. Exact-main remote checks remain publication closeout.
- Next step: publish the SQLSTATE-only diagnostic, require exact-main CI, then rerun the already authorized Staging apply to identify and repair the precise non-secret failure class. Keep rollback-only acceptance and scheduling blocked behind their own explicit approvals.
- Do not repeat: do not dispatch either workflow, apply through generic migrations, run acceptance globally, target Production, add a schedule or combine retention with AI/email/installation activation.

## FM-WEB-003
- Date: 2026-09-04
- Status: IMPLEMENTED_NOT_VERIFIED
- Risk: R3
- Goal: Prepare a bounded, dormant retention contract for Website Chat technical sessions, receipts and expired handoff evidence without deleting the CRM history.
- Scope: checksum-pinned controlled SQL, offline verifier, policy tests and runbook. No database apply, Staging workflow dispatch, timer/worker, Production mutation, installation activation, AI/provider request, outbound email or real visitor data.
- Dependencies: FM-WEB-001/FM-WEB-002, FM-CR-016, the controlled Website Chat handoff schema and existing cascade foreign keys from technical evidence to the visitor session.
- Evidence required: dry-run default, strict batch bound, deterministic lock-safe selection, active-Handoff retention, service-role-only ACL, exact deletion allowlist, no automatic execution and proof that contacts/Conversations/messages are excluded.
- Negative path: null/oversized limit, browser/PUBLIC execution, deletion while Handoff evidence is active, CRM deletion, generic migration discovery, timer/provider/AI/email wiring or delete-count drift must fail closed.
- Recovery: repository changes are revertible; the controlled SQL is unapplied and installs no schedule.
- Result: a checksum-bound `manage_website_chat_retention(...)` contract defaults to dry-run, caps work at 1,000 sessions, locks execution candidates with `SKIP LOCKED`, retains any session with unexpired handoff evidence and deletes only eligible technical sessions. Existing cascades remove their receipts/expired handoff evidence while CRM contacts, Conversations and messages remain untouched.
- Evidence: checksum/offline check PASS; focused retention 6/6; Website Chat 36/36; release integrations 84/84; Operations 1113/1113; TypeScript, lint, Production build, truth/action pinning and Project Memory quality/status/drift checks PASS. Lint reports only the pre-existing Mobile warning; exact-main remote evidence remains publication closeout.
- Next step: publish the exact repository commit and require exact-main CI. A separate future task must add protected Staging verify/apply and rollback-only retention acceptance before the SQL can be applied or any schedule considered.
- Do not repeat: do not move this SQL into generic migrations, delete CRM history, infer execution from `expires_at`, add a timer or combine retention authorization with AI/email/installation activation.

## FM-WEB-002
- Date: 2026-09-04
- Status: IMPLEMENTED_NOT_VERIFIED
- Risk: R3
- Goal: Prepare an exact-main, isolated-Staging verify/apply and rollback-only acceptance control for the dormant Website Chat human-handoff schema.
- Scope: repository policy, private-passfile runners, manual protected workflows, deterministic synthetic rollback acceptance, tests and runbook. No workflow dispatch, database apply, Production mutation, installation activation, AI/provider request, outbound email or real visitor data.
- Dependencies: FM-WEB-001/FM-CR-014, FM-CR-015, checksum-pinned controlled SQL and dedicated Staging/Production target bindings.
- Evidence required: fail-closed target/commit/confirmation tests, read-only ACL/RLS postflight, browser role denial, message/handoff/idempotency/wrong-origin/CRM assertions, complete rollback and proof of no AI/email transport.
- Negative path: wrong ref/SHA/origin/Supabase ref/DB host/TLS/confirmation, libpq redirect, browser table/RPC access, duplicate leakage, outbound message or incomplete rollback must fail closed.
- Recovery: repository changes are revertible; the prepared acceptance performs all synthetic writes inside a transaction that must roll back.
- Result: the repository now provides separate exact-main manual controls for read-only schema verification, separately confirmed Staging apply and rollback-only lifecycle acceptance. The runners require direct isolated-Staging API/Supabase/DB binding, TLS `verify-full`, a private snapshotted password file and fixed redacted outcomes. Acceptance requires the dedicated synthetic-processing Workspace markers and proves browser table/RPC denial, processing eligibility, message and handoff idempotency, rejection of a handoff without a prior message, wrong-origin rejection for both RPCs, CRM linkage, fingerprint storage, absence of outbound messages and complete rollback.
- Evidence: pinned SQL checksum and offline acceptance PASS; Website Chat 30/30 and release integrations 78/78 PASS; complete Operations 1113/1113 PASS after synchronizing the intentional hosted-workflow topology count; Action pinning, product truth, Project Memory quality/status, TypeScript, lint and production build PASS. Exact-main commit `79e0e0c761f4c6f6895d76c4253b3b93b5f1e3a2` then passed Browser E2E, CodeQL, Supply Chain Security, normal Web deploy, read-only Production audit and Final Go-Live Readiness. Lint retains one pre-existing unrelated Mobile Delivery-Ledger warning.
- Next step: a later read-only Staging verify is safe only with an explicit dispatch; Staging apply and rollback-only acceptance each remain separately authorized actions.
- Do not repeat: do not apply the schema through generic migrations, run against Production, enable an installation, send email, invoke AI or treat repository preparation as external acceptance.

## FM-WEB-001
- Date: 2026-09-04
- Status: IMPLEMENTED_NOT_VERIFIED
- Risk: R3
- Goal: Prepare the dormant Website Chat human-handoff path with explicit visitor email consent, complete CRM conversation linkage and an atomic Workspace processing-entitlement boundary.
- Scope: policy, API/widget contract, controlled service-role-only SQL, checksum/offline verification, tests and documentation. No database apply, installation activation, AI/provider request, outbound email, timer or Production mutation.
- Dependencies: FM-CR-012/FM-CR-014, existing Website Chat visitor session/message receipts, canonical Workspace processing contract and existing RLS-protected contact/conversation UI.
- Evidence required: bounded email/consent/idempotency tests, exact-origin/session/rate-limit enforcement, atomic SQL entitlement and session revalidation, service-role-only RLS/ACL checks, proof of no AI/outbound transport and repository checks.
- Negative path: missing consent/message/session/entitlement, malformed email, replay, unverified origin, browser DB access, automatic sending or missing controlled schema must fail closed.
- Recovery: repository changes are revertible. The controlled SQL remains unapplied until a separate protected Staging authorization and acceptance.
- Result: The cookie-free widget can request one explicit, purpose-bound human email handoff after a stored visitor message. A new guarded public route and service adapter preserve exact origin/session/rate-limit boundaries; the checksum-pinned controlled SQL atomically revalidates Workspace processing, links the handoff to the existing contact/conversation timeline, stores only an email fingerprint in the handoff evidence table and performs no AI or outbound delivery.
- Evidence: `npm run db:website-chat-handoff:check` PASS; Website Chat 20/20, Inbox 13/13, Production controls 5/5 and WhatsApp inbound 30/30 PASS; product truth and Project Memory quality PASS; Next type generation, TypeScript, lint and production build PASS. Exact-main commit `6452cb2452b3e5a664d86f5073a410f3744b1bae` then passed Browser E2E, CodeQL, Supply Chain Security, normal Web deploy, read-only Production audit and Final Go-Live Readiness. Lint retains one pre-existing unrelated unused-variable warning in the Mobile Push Delivery-Ledger runner.
- Next step: require exact-main remote checks, then create a separate protected Staging verify/apply/rollback-only acceptance path. Keep every installation disabled until schema, browser-denial, processing-gate and retention behavior pass isolated Staging acceptance; AI dialogue, uncertainty escalation, email verification and manually approved delivery remain separate.
- Do not repeat: do not rebuild the session/widget/message foundation, apply this SQL through generic migrations, enable an installation, invoke an AI/email provider or infer delivery from a stored handoff.

## FM-MOB-006
- Date: 2026-09-03 to 2026-09-04
- Status: ACCEPTED
- Risk: R3
- Goal: Add a dormant, service-role-only atomic Mobile Push Delivery-Ledger foundation with transactional target revalidation, send/receipt leases, bounded retry state and atomic device-registration revocation.
- Scope: controlled SQL, server-only RPC adapter, checksum/offline verification, protected exact-commit isolated-Staging verify/apply control, rollback-only Staging acceptance, tests and documentation. No route, worker, timer, provider request, Production activation or signed build.
- Dependencies: FM-MOB-001; accepted FM-MOB-005 repository boundary; existing `mobile_push_registrations`; exact Staging/Production/EAS target binding.
- Evidence required: offline checksum/contract validation, focused service/SQL/adapter tests, proof of route/timer/worker/provider dormancy, project-memory countercheck and exact remote commit/CI before acceptance.
- Negative path: Production or browser access, non-atomic revalidation/revocation, lease bypass, plaintext token/provider content, unbounded retries or runtime wiring must fail closed.
- Recovery: repository changes are revertible; no external state is changed by this task. Any later Staging apply uses its own checksum-bound transaction and rollback-only acceptance.
- Result: checksum-pinned controlled SQL, a server-only same-target RPC adapter, atomic reservation/revalidation, send/receipt leases, bounded retries and atomic invalid-device revocation are implemented without runtime wiring.
- Evidence: offline ledger check PASS; focused Push/ledger/Staging controls 34/34 PASS after integration; the broader Operations suite executed but its local result is non-authoritative because root dependencies are absent and it also exposed pre-existing truth-test drift that was reconciled in this change.
- Result: checksum-pinned controlled SQL, a server-only same-target RPC adapter and manual exact-main protected-Staging workflows now provide separate read-only verification, separately confirmable apply and a distinct rollback-only lifecycle acceptance path. The acceptance uses deterministic synthetic rows and proves browser denial, lease exclusivity, receipt lifecycle, atomic invalid-device revocation and complete rollback without a provider client.
- Evidence: offline acceptance contract and focused policy/workflow/fake-psql tests pass locally. Exact remote `main` `283797c1fe6c14d5e9e814d8f8ec83cf9e249483` was then used for protected read-only Staging run `33796695523` / job `100786027891`: target binding and offline checksum passed, the apply job was skipped, and the database postflight returned the fixed redacted `postflight_failed` result because the Delivery-Ledger schema is not yet installed.
- Additional resource evidence: initial protected read-only Push resource run `33797049971` / job `100787171346` failed closed before database inspection because the five dedicated Mobile Push Staging variables were unset. After action-time authorization, those non-secret isolated bindings were configured and exact-main rerun `33798738433` / job `100792675316` passed: exact commit/target separation, pinned registration checksum/contract, isolated synthetic resources and private password-file cleanup all passed while delivery and non-Production writes remained disabled.
- Schema and acceptance evidence: exact-main registration apply `33800376282` / job `100798166495`, Delivery-Ledger apply `33800490769` / job `100798544513`, independent read-only Delivery-Ledger verify `33800628826` / job `100798998381`, and registration rollback-only acceptance `33800742158` / job `100799358333` all passed. The acceptance proved browser denial, isolated synthetic service-role CRUD, transaction rollback and cleanup with delivery disabled and no Production/provider path.
- Final acceptance: the first exact acceptance exposed only safe failure classification `ticket_transition_sqlstate_2201B`; review traced this to PostgreSQL's bounded-repeat limit in the receipt-ID regular expression. Commit `18a6ad79cb72331b4daa41ee87dd2430a8ffd473` replaced that expression with an explicit `char_length` bound plus an unbounded safe-character expression and idempotently replaced the existing constraint. The pinned controlled-migration checksum is `8f8665b36a1c69ec423d903a8fa6d850122aee5c752516f6b70f216b5b5e269c`.
- External evidence: corrected isolated-Staging Delivery-Ledger apply run `33867831888` / job `101006621418` passed; final exact-commit rollback-only acceptance run `33867922978` / job `101006906941` passed. It proved reservation, lease exclusivity, ticket/receipt lifecycle, invalid-device atomic revocation, browser denial, complete rollback and cleanup using synthetic rows.
- Accepted boundary: the atomic Delivery-Ledger Staging gate is accepted. Provider sending stayed disabled; no real notification, Production mutation or real fan data was involved.
- Next step: the required handler-containing FCM replacement Preview already exists at exact descendant/build commit `6801d687cfe6048d6e32e63bcfe2862d2886fce0`, workflow `34037085683` / job `101497020224`; the actual FCM corrections are commits `1d15d8e4698392174ad7d5be23a7f174ebb2303d` and `547843cad7a1f6ecb3ba6131e155d9d068799c2b`. Do not build another Preview. Use the delivered replacement on the owner's Android device, opt in, prove one active isolated-Staging Push registration, and only then perform separately authorized real provider/device delivery acceptance. The Play cohort remains a separate external gate.

## FM-MOB-005
- Date: 2026-08-31 to 2026-09-01
- Status: ACCEPTED
- Risk: R3
- Goal: Prepare privacy-minimal incoming-message notifications and an explicit fail-closed Production/Staging/test-data boundary without activating delivery or mutating external state.
- Starting state: the dormant Follow-up push foundation and the existing Android `1.0.0` Play-baseline AAB already existed; message notifications had no accepted repository policy/native tap handler, and the existing AAB predates that handler.
- Action: added Staging-only Owner `message_received` plus at most one `message_reminder`, exact workspace/user/registration/EAS/contact/message binding, strict timestamp/freshness and PostgreSQL-microsecond checks, exact-fan `Nachrichten` navigation/seen semantics, dedicated Android message channel, independent expected non-Production target verification and bounded ASCII synthetic markers; synchronized canonical readers and negative/fail-closed tests.
- Result: PR #1050 final head `09ec3c8a73d57f7a0f0552e6ba89440b27e89ec7` passed all eight exact-head workflows, exact-head Codex review completed with all threads resolved, and the PR was SHA-bound squash-merged as `953fcc56de0d02d5c2c5d41468226ba051624b53`. Merged `main` was re-read and issue #1049 was closed `completed` only for this bounded repository scope.
- Limitations: no provider request, Delivery-Ledger apply, Push Staging migration/rollback-only acceptance, Production/Supabase mutation, Google Play action, Android build or signed-device message-push acceptance occurred. FM-MOB-001 remains `IMPLEMENTED_NOT_VERIFIED` and external Push/Store/device gates remain open.
- Evidence: PR #1050; exact workflow runs `33493784038`, `33493784036`, `33493784050`, `33493784093`, `33493783962`, `33493784004`, `33493783996`, `33493783974`; merge `953fcc56de0d02d5c2c5d41468226ba051624b53`; issue #1049; `project-memory/receipts/FM-MOB-005-20260831.md`.
- Next step: keep FM-MOB-005 closed. Continue real Push Staging/Delivery-Ledger/provider/device/Store work only under FM-MOB-001 with a new exact task/change/lock; final message-push device acceptance requires the verified FCM replacement Preview rather than another rebuild.
- Do not repeat: do not rebuild the existing Android `1.0.0` Play-baseline AAB merely because FM-MOB-005 is accepted, and do not reopen FM-MOB-005 to claim external delivery/device acceptance.
- Rollback: if the post-merge closeout PR is merged and this implementation must be withdrawn, revert the closeout merge first, then implementation squash `953fcc56de0d02d5c2c5d41468226ba051624b53`; never retain ACCEPTED/RELEASED closeout records after removing the implementation.

## FM-MEM-001
- Date: 2026-08-19
- Status: DONE
- Goal: Introduce durable project memory and duplicate-work prevention.
- Starting state: Git/code history existed, but micro-attempts and conversational decisions were not systematically tracked in one operational ledger.
- Action: Added Project Memory Protocol v1 structure and PR guard.
- Result: Repository-level operational memory established.
- Evidence: `project-memory/` and `.github/workflows/project-memory-guard.yml`; V1 merged via PR #972.
- Next step: Extend the same system rather than creating a competing ledger.
- Do not repeat: Do not create a second competing memory system.

## FM-MEM-002
- Date: 2026-08-19
- Status: SUPERSEDED
- Goal: Add V2 open-loop/dependency/evidence/stale-scan model.
- Action: Built V2 in PR #973.
- Result: Functionality was retained but PR #973 was not merged independently; it was superseded by consolidated PR #975 to avoid stacked/divergent governance branches.
- Evidence: PR #973 history and V2 files now included in PR #975.
- Next step: Use the consolidated V6 system on `main`.
- Do not repeat: Do not reopen #973 as a parallel source of truth.

## FM-MEM-003
- Date: 2026-08-19
- Status: SUPERSEDED
- Goal: Add V3 standing authorizations and generated project status.
- Action: Built V3 in PR #974 and fixed generator/status drift plus hosted-checkout SHA pinning.
- Result: PR #974 was superseded by consolidated PR #975 rather than merged separately.
- Evidence: PR #974 history and V3 files incorporated into V6.
- Next step: Maintain V3 capabilities inside the consolidated memory system.
- Do not repeat: Do not merge/revive #974 independently.

## FM-MEM-004
- Date: 2026-08-19
- Status: SUPERSEDED
- Goal: Add mandatory execution policy, started-work tracking and stronger counterchecks.
- Action: V4 work was developed on the governance branch and then folded into later versions.
- Result: No separate final V4 integration; V4 is a historical stage inside PR #975.
- Evidence: `EXECUTION_POLICY.md`, STARTED_WORK/WORK_LOCK/receipt structures in PR #975 history.
- Next step: Use current protocol rules.
- Do not repeat: Do not create another V4-only branch/PR.

## FM-MEM-005
- Date: 2026-08-19
- Status: ACCEPTED
- Goal: Consolidate V2-V6 into one auditable FanMind Project Memory/governance and finishline-control system with independent counterchecks.
- Starting state: V2/V3/V4 work existed on stacked/divergent branches and FanMind had stricter CI/supply-chain controls.
- Action: Consolidated into PR #975; added authorizations, status/stale automation, STARTED_WORK, WORK_LOCKS, EXECUTION_RECEIPTS, ASSUMPTIONS, CONTRADICTIONS, QUALITY_CONTROL, Risk R1-R4, quorum, evidence freshness, negative/fail-closed paths, scope-diff guard, rollback/recovery proof, falsification and milestone closeout. Fixed SHA pinning, generated status drift and hosted checkout count expectations without weakening policy. Added exhaustive FanMind finishline audit. V6 added machine-readable `FINISHLINE_STATE.json`, `FANMIND_FINISHLINE.md`, Restore R4 state machine, external-acceptance register, derived sales-readiness gate, canonical-truth drift scanner and scheduled V6 checks inside the existing Project Memory Quality workflow.
- Result: V2-V6 governance and finishline controls were fully green on exact PR head `2a62dc8337673be0b33acfd4338d0f452224e779` and merged to `main` as `b4bef882a55e8c0dd1dd33d0ad1c1664c3078d0d`.
- Evidence: PR #975; Project Memory Guard, Quality V6 and Status success; FanMind CI success including PG17 authorization roundtrip, Operations tests and Production build; Landing success; Supply Chain success; CodeQL success; Browser E2E success for public no-write and synthetic regular-user core flow.
- Next step: Maintain V6 as the single memory/finishline system and continue `FM-RST-001` from `BACKUP_ACCEPTED -> HOST_REVALIDATED`.
- Do not repeat: Do not create a parallel memory/finishline system or bypass V6 gates.

## FM-STG-001
- Date: 2026-08-09 to 2026-08-19
- Status: ACCEPTED
- Goal: Establish and technically accept isolated Staging foundations without Production/Test mixing.
- Result: Separate Supabase Staging, separate web Staging runtime/runner path, DNS/TLS, required Staging schema foundations, Stripe Test Mode resources, synthetic isolated workspaces/users, Workspace/Daily contract, admin/browser acceptance and rollback-protected Referral/Billing lifecycle are recorded as completed in finishline #874.
- Evidence: Issue #874 Gate 1, Staging run references recorded there, current Source of Truth and merged Staging commits.
- Limitations: This acceptance does not imply Mobile signing, Plus/Ultra activation, Meta external E2E, Social E2E or Production social activation.
- Next step: Reuse this Staging foundation for the remaining acceptance gates; do not rebuild it.
- Do not repeat: Do not recreate Staging host/Supabase/Stripe test baseline absent verified drift.

## FM-RST-001
- Date: 2026-08-17 to 2026-09-08
- Updated: 2026-09-08
- Status: PARTIAL
- Risk: R4
- Goal: Complete isolated real restore drill.
- Starting state: Dedicated restore host, PostgreSQL 17 target, runner group/workflows, accepted backup tuple and protected environment already exist.
- Accepted database progression: `DB_POSTCHECKED`. Issue #944 comments `5453497602`, `5453599115`, `5453727223`, `5453857592` prove the exact artifact/source/target binding, committed single-transaction Restore, projected expected/actual authorization fingerprint `0604dac8562a601e2d582f76aee4203825b826b302b9b0b93a92bdd2ca603052`, exact roles/container/extensions, 120 core application grants, 12 restricted SECURITY DEFINER functions and core `5|5|5|5` table/RLS/policy checks. PR #1075 permanently fixed the target-only login projection; #1077 retired stale rerun controls.
- Evidence: `FM-EV-036`; `receipts/FM-RST-001-ISOLATED-DATABASE-RESTORE-ACCEPTED-20260828.md`; `receipts/FM-RST-001-DATABASE-POSTCHECK-ACCEPTED-20260907.md`; workflow `33178878764` / job `98874745740`; PRs #1075/#1077/#1081/#1085; issue #944 closure `5573957331`. PR #1085 final head `7d32f5a0c29b8ab581a736b0744bfdcf41f5eddb` passed seven workflows, zero unresolved threads and exact-head review before squash merge `0ccf38e5f1afdd0b5f3495a137a5d360dd214ae7`; the repository-only Storage controller is accepted.
- Still open: `STORAGE_RESTORED`, `CONFIG_RESTORED`, `DISPOSABLE_TARGET_CLEANED`, independent `COUNTERCHECKED` and final `ACCEPTED`.
- Next step: keep the accepted repository-only Storage controller closed. Real isolated Storage mutation remains `DEFERRED_BY_OWNER` under `FM-RST-OWNER-007` and requires a new action-time owner decision plus a distinct isolated non-Production target.
- Do not repeat: no database Restore, target reset, consumed controller/JIT/authorization reuse, Production/Supabase-Staging target, or inference of later transitions from database evidence.

## FM-MOB-001
- Date: through 2026-08-19
- Updated: 2026-09-07
- Status: IMPLEMENTED_NOT_VERIFIED
- Goal: Deliver the native FanMind Mobile app through a signed Android build and current-finishline real-device/store acceptance; prepare iPhone Store metadata now while signed iOS/TestFlight/device work remains Phase 8.
- Result: Native Expo/React-Native core and the current fan workflow are repository-verified. Protected run `33298699290` / job `99222705186` completed an exact-merge signed Android Preview for `6a2f5b6c9bac1607ecc2ccae11c6ade3cb418522`; the owner accepted the bounded FM-MOB-003/FM-MOB-004 UI/runtime scope. PR #1028 then merged the Android `1.0.0` Store control as `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00`. Protected Production readiness `33316105624` / `99269748215` passed and protected Store build `33316172583` / `99269924756` completed exactly one verified AAB with Submit/Update disabled, redacted receipt and cleanup. FM-EV-030 provides the private evidence preparer; FM-EV-031 dual-store assets, public Support and Apple/Google review/tester handoffs passed all exact-head gates in PR #1031, merged as `3082490451dd45b5127bdf9d9ae55b4712255b72`, deployed and were verified live. FM-EV-034 adds the machine-checked 33-field App Store Connect worksheet with exact 13/12/8 ready/owner/Phase-8 separation; PR #1037 final head `88b9299f9612e344a9c0c48d78f86f11d071db6c` passed all eight exact-head workflows and final review with zero unresolved threads, then squash-merged as `a16e28f6e1aa0a2d7ff81bd679b472fab7563500`. On 2026-09-03 the verified Android `1.0.0` AAB was published in the closed Google Play Alpha track for Germany, Austria and Switzerland. The complete Android 19-check/Recovery/screenshot acceptance, at least 12 opted-in testers for at least 14 days and the later Production-access request remain open.
- Evidence: Issues #584/#690; `apps/mobile`; mobile docs; current Source of Truth; PRs #988/#1019/#1021/#1025/#1028/#1030/#1031/#1037; protected preview run `33298699290` / job `99222705186`; Production readiness `33316105624` / `99269748215`; Store build `33316172583` / `99269924756`; FM-EV-028/FM-EV-029/FM-EV-030/FM-EV-031/FM-EV-034; FCM correction commits `1d15d8e4698392174ad7d5be23a7f174ebb2303d` and `547843cad7a1f6ecb3ba6131e155d9d068799c2b`; replacement Preview workflow `34037085683` / job `101497020224` at descendant/build commit `6801d687cfe6048d6e32e63bcfe2862d2886fce0`.
- Next step: use the already delivered FCM replacement Preview on the owner's Android device, allow notifications and prove an active isolated-Staging Push registration; do not create another handler-containing Preview. Provider delivery remains a separate authorized acceptance. Preserve the exact Production AAB; the Play cohort/19-check Recovery/screenshot path remains separately external before Production access. Do not start an iOS build before Phase 8.
- Do not repeat: Do not restart the mobile app, replace it with a WebView, rebuild the FCM Preview, or rebuild the exact Production AAB merely to continue portal work.

## FM-MOB-002
- Date: 2026-08-29
- Status: ACCEPTED
- Risk: R3
- Goal: Make the stored sample conversation visible for the demo account's contacts and deliver an updated signed Android internal build.
- Starting state: the Staging demo workspace had 13 contacts and 37 RLS-protected `conversation_messages`; the installed Android preview could log in and show contact/profile/knowledge data, but the contact screen never queried or rendered message history.
- Action: added `listContactMessages(workspaceId, contactId)` with explicit workspace/contact filters and a 100-row bound, newest-first read-only message bubbles, explicit refresh, message-specific empty/error handling, no-auto-send disclosure, documentation and regression coverage.
- Result: PR #1019 passed final exact-head gates and merged as `ef0b7210c997558759a80c5ff46a7a5a0c005c3b`; protected run `33254230496` produced the exact-commit Android preview, and the owner then observed the visible history while identifying channel switching as a separate next change.
- Evidence: FM-EV-024; PR #1019; merge `ef0b7210c997558759a80c5ff46a7a5a0c005c3b`; protected build run `33254230496`; owner Mobile observation; bounded Staging data observation.
- Next step: FM-MOB-003; do not reopen or repeat FM-MOB-002.
- Do not repeat: do not create duplicate demo messages, weaken RLS, expose service-role credentials, add messages to the offline cache or claim the old APK contains this UI fix.

## FM-MOB-003
- Date: 2026-08-29
- Status: ACCEPTED
- Risk: R3
- Goal: Complete the core phone demo loop with an unseen-message dashboard, per-fan channel switching and direct manual Follow-up creation.
- Starting state: the merged Android preview shows the stored messages, but mixes all channels, the start screen is a generic KPI page rather than an unseen-fan inbox, and Follow-ups can be created only after an AI suggestion.
- Action: derived per-fan channel tabs from stored messages, added an authenticated workspace-bound unseen-inbound fan query and Owner-only seen update, replaced the generic Start page with the unseen inbox, removed the rejected placeholder symbol from the shared wordmark, and added a validated Owner-only manual Follow-up form without schema, permission or demo-row changes.
- Result: PR #1021 passed all eight exact-head gates and merged as `93496a4afac9b3b315c9985afbbce02b8524fc44`; protected run `33260695232`, job `99122008690`, completed one verified `preview` Android internal build with Submit/Update disabled and cleanup successful. The owner's 2026-08-30 real-device acceptance of the superseding FM-MOB-004 exact-merge build confirms the included FM-MOB-003 behaviors.
- Evidence: historical implementation/build record FM-EV-025 plus bounded acceptance record FM-EV-027; PR #1021 final head `c4baed86bdcfd389a1f8ff5ce7752407113fb734`; merge `93496a4afac9b3b315c9985afbbce02b8524fc44`; superseding accepted merge `6a2f5b6c9bac1607ecc2ccae11c6ade3cb418522`; local/native/read-only Staging evidence.
- Next step: keep FM-MOB-003 closed; do not rebuild merely to repeat device acceptance.
- Do not repeat: no new unread schema, no duplicate demo data, no offline message cache, no automatic message send and no member Follow-up mutation.

## FM-MOB-004
- Date: 2026-08-29
- Updated: 2026-08-30
- Status: ACCEPTED
- Risk: R3
- Goal: Finish the owner-observed Mobile fan-detail and navigation corrections and deliver a new exact-merge Android preview.
- Starting state: FM-MOB-003 is merged and built, but the fan detail still shows tags/profile before task navigation, identifier text can wrap, Follow-ups do not navigate back to their fan, today's Follow-ups are absent from Start and the wide splash wordmark is visibly cropped on Android.
- Action: add universal `Nachrichten|Follow-ups|Kontaktwissen` tabs, move profile/tags into knowledge, add provenance-bound fan-analysis read/prepared server action, add per-fan/today Follow-up queries and navigation, and replace the splash asset with a square `FM`-over-`FanMind` composition. Eleven review passes then tightened the implementation: hide generation until Production capability, active-processing entitlement and complete report schema are valid on Mobile and Web; require complete provenance on Mobile and Web; permit legacy Web reads only after all new columns are individually and concurrently proven absent; separate initial/post-create/dashboard/knowledge/analysis errors and suppress unknown count badges; select semantic priority groups before the exact paginated day-list cap with stable `created_at`/`id` boundaries and a last legacy fallback group; expose exact/truncated per-contact results; cap fallback-only analysis confidence low; map typed API plus inactive-Workspace failures to semantic statuses; treat legacy `NULL` status as open; paginate and focus-refresh the central Follow-up list; refuse analysis provider/write work without a valid source period; preserve service-failure precedence for capability reads; hide rejected conclusions; exclude undated messages from provider/provenance samples; bind Bearer analysis to active owners only; suppress false Web empty state beside hidden saved reports; and exclude rejected/incomplete reports from productive reply prompts.
- Result: thirty-five valid findings from eleven superseded review rounds were addressed rather than bypassed. Final head `64329ac628188cf532281ddb742058612b9e9eb8` passed all nine exact-head gates with no unresolved thread and merged as `6a2f5b6c9bac1607ecc2ccae11c6ade3cb418522`. Protected run `33298699290` / job `99222705186` then completed exactly one verified `preview` Android internal artifact for the merge; Submit/Update stayed disabled and cleanup passed. On 2026-08-30 the owner installed and inspected that exact build on a real Android device and confirmed the current Mobile result as finished.
- Evidence: FM-CR-005; FM-EV-026; released lock/receipt; PR #1025; merge `6a2f5b6c9bac1607ecc2ccae11c6ade3cb418522`; run `33298699290`; job `99222705186`; redacted private build receipt.
- Next step: keep FM-MOB-004 closed. Open a new bounded task only for a newly observed device defect; do not queue another build merely to repeat acceptance.
- Do not repeat: no schema or demo-data creation, no client service-role/OpenAI key, no automatic send, no member mutation and no second build while queue/completion state is uncertain.

## FM-AI-001
- 2026-09-08 superseding bounded result: FM-EV-039 closes PR #1087 publication, Production deploy/audit/go-live, exact Staging deploy and fresh AI rollback acceptance 34273836166 / 102221843980 on 7f681d26. Independent counts unchanged; FM-FAIL-022 resolved. Keep prices, installed general Billing and this correction closed. Overall FM-AI-001 remains PARTIAL; no paid-tier/Production activation.
- 2026-09-08 current continuation: FM-EV-038 / FM-FAIL-022 supersede only mutable Staging/provider status. Prices are owner-confirmed complete. Exact-main deploy 34267819029 and read-only Test webhook 34268317761 passed; AI acceptance 34268214078 failed before DB/fixture because two workflow origins were absent. The bounded repository fix passes 31 focused tests; exact-head CI/review and approved merge/new-main Staging deploy/acceptance remain open. No overall gate, paid tier or Production activation.
- 2026-09-07 bounded Staging closeout: the general Billing ledger is installed on isolated Staging; exact deploy `34058028839` and rollback-only canonical Billing acceptance `34058118450` / job `101553652111` passed on `62e6a11858e85996af03f6740819b0fc6194b4a4` with shared rollout `PASS`, Billing ledger `verify`, cutover pending `0`, uninventoried `0`, full transaction rollback and cleanup `PASS`. Independent read-only counters remained unchanged. This supersedes the earlier pending ledger/deploy/canonical-acceptance wording below and closes only that bounded technical Staging sub-gate; overall status stays PARTIAL.
- Historical 2026-09-06 bounded continuation: FM-CR-020 / PR #1058 repaired the shared Checkout freeze bypass; later #1069/#1070/#1072 plus the successful Staging runs above supersede its then-pending cutover wording.
- Date: through 2026-08-19
- Updated: 2026-09-07
- Status: PARTIAL
- Goal: Close KI Standard/Plus/Ultra product, quality, cost, Stripe-lifecycle and activation evidence.
- Result: Standard is part of the active core. Current protected evidence confirms the dedicated synthetic AI resource, both Plus/Ultra Test prices, the complete five-price Test catalog, exact enabled 22-event Staging webhook, installed AI event ledger and now installed general Billing ledger. The 50/100/150 context policy is accepted. The bounded canonical Billing Staging sub-gate is counterchecked by `34058028839` and `34058118450`; canonical Production projection and Plus/Ultra remain disabled. FM-CR-009's Stripe SDK/payment-method/outbound-version correction remains accepted. Remaining work is product/private quality-cost decisions/evidence, provider-side inbound webhook/current lifecycle and downstream AI/referral reconciliation through the installed ledgers, Legal/Tax, Production runtime integration and explicit activation.
- Evidence: FM-EV-022; FM-EV-033; `AI_BILLING_READONLY_RECONCILIATION_2026-08-26.md`; `STRIPE_RUNTIME_CONFORMANCE.md`; general Billing Apply `34040107219`; durable capture `34043010578`; unfreeze `34043148548`; exact isolated-Staging deploy `34058028839`; canonical rollback acceptance `34058118450` / job `101553652111`; `src/config/aiTiers.mjs`; Source of Truth; issue #560; issue #874 Gate 4; `project-memory/receipts/FM-AI-001-CANONICAL-BILLING-STAGING-ACCEPTED-20260906.md`.
- Next step: do not repeat the completed canonical Billing Staging deploy/acceptance. Resume product/private evidence only under `FM-AI-OWNER-001`; use the narrowed `FM-AI-OWNER-002` only for remaining provider-side webhook/current lifecycle/downstream reconciliation in Test Mode. Then complete Legal/Tax, runtime integration and explicit Production activation if approved.
- Do not repeat: Do not invent models/quotas, rerun the completed canonical Billing acceptance, use live payments, or activate Plus/Ultra/canonical Production projection through a merge alone.

## FM-META-001
- Date: through 2026-08-19
- Updated: 2026-08-26
- Status: PARTIAL
- Goal: Finish Meta Events Manager, Meta external acceptance and final Meta/Security evidence.
- Result: Consent-gated parameterless PageView-only Pixel behavior is Production-confirmed. The 2026-08-26 exact-main protected read-only evidence confirms that the isolated Staging conversation-continuation and catch-up objects are present with the observed RLS/ACL/index/function boundaries and disabled runtime gates; it does not independently prove the ledger-managed continuation timestamp, while the controlled queue is intentionally ledger-free. Its mutable current-state claim is TTL-bound through `EV-META-STAGING-FOUNDATION-20260826`. Meta Facebook/Instagram foundations remain advanced. External Events Manager/Test Events, provider-side no-PII confirmation, App Review/permissions, real account/webhook/conversation E2E and required legal acceptance remain open.
- Evidence: FM-EV-007; FM-EV-023; `META_TECHNICAL_READONLY_RECONCILIATION_2026-08-26.md`; runs `33007156552`/`33007311870`/`33007481167`; issue #714; Source of Truth.
- Next step: external owner-controlled normal-browser Events Manager positive/negative/no-PII acceptance and legal review; later real Facebook/Instagram App Review/E2E in the Social gate. Any provider event, SQL Apply or runtime activation remains separately authorized.
- Do not repeat: Do not rerun the three FM-EV-023 workflows merely to close this task, repeat Production ENV/build/deploy, or re-add CompleteRegistration/Lead, Advanced Matching or CAPI without new technical/legal approval. Once the registered Staging evidence expires or before a later protected database action, use a new lock and fresh shared rollout-state-first revalidation.

## FM-SOC3-001
- Date: 2026-08-19 reconciliation of prior work
- Updated: 2026-08-20
- Status: PARTIAL
- Goal: Real technical acceptance of Phase 3 — Facebook, Instagram and WhatsApp.
- Result: Facebook/Instagram foundations are advanced; WhatsApp dormant inbound foundation is merged. None of the three has the final real external Phase-3 E2E acceptance required for sales handoff.
- Evidence: Source of Truth, issue #874 Gate 6, Meta/WhatsApp commits including dormant WhatsApp merge `e7b46bd...`.
- Next step: after non-Social gates are sufficiently closed, perform Facebook E2E/App Review, Instagram E2E/App Review and WhatsApp Staging/Meta/E2E/Production acceptance with tenant/idempotency/revocation/reconnect/no-auto-send evidence.
- Do not repeat: Do not rebuild Facebook/Instagram foundation from zero; do not expose fake active badges before real acceptance.

## FM-SOC7-001
- Date: 2026-08-19 reconciliation of prior work
- Updated: 2026-08-20
- Status: PARTIAL
- Goal: Real technical acceptance of Phase 7 — TikTok, X/Twitter, Discord and conditional OnlyFans.
- Result: Platform feasibility has been partially researched/documented; no complete real Phase-7 connector acceptance exists.
- Evidence: Issue #874 and its platform-feasibility comment.
- Next step: after Phase 3/non-Social gates, verify official TikTok scope, X Developer/API prerequisites/cost approval, implement official Discord bot/guild connector, and decide OnlyFans feasibility strictly from official/contractual basis.
- Do not repeat: No scraping, self-bot, reverse engineering or unofficial bypass.

## FM-SALES-001
- Date: 2026-08-19 reconciliation of prior work
- Updated: 2026-08-20
- Status: BLOCKED
- Goal: Technical sales handoff to Gerhard with production truth aligned to actual sellable scope.
- Blocked by: real technical acceptance of required Phase-3 and Phase-7 channels and final finishline evidence.
- Result: Sales materials and demo script exist, but technical sales handoff is not yet valid under the current canonical finishline.
- Evidence: Source of Truth Roadmap/Go-Live sections, issue #874 Sales Handoff, commit `74c3a6aa357215c52d3a4d9b01ba8513bba1b57f` aligning sales-handoff truth.
- Next step: close required gates, run final 5-minute Production demo/sales flow on exact release, synchronize sales materials/roadmap, then record handoff.
- Do not repeat: Do not call Phase 4 or an existing sales document a completed sales handoff.

## FM-LEGAL-001
- Date: through 2026-08-19
- Updated: 2026-08-20
- Status: BLOCKED
- Goal: External legal/tax/AVV completion where required.
- Result: technical/public reader framework and confirmed operator data exist; external legal, tax, registration and final AVV/provider evidence remains incomplete.
- Evidence: Issue #564 and legal evidence framework.
- Next step: incorporate only actual advisor/register/provider evidence; no guessing.
- Do not repeat: Do not treat technical checks as legal approval.

## FM-OPS-001
- Date: through 2026-08-19
- Status: VERIFIED
- Goal: Production operations, monitoring, backups, audit and deployment baseline.
- Result: Core Operations/backup/deploy/audit/monitoring foundation is production-proven. Optional/destructive follow-ups remain separately controlled.
- Evidence: Issues #524/#534 and Production operations run history.
- Limitations: full Restore remains FM-RST-001; Remote offsite delete #658 is not authorized; optional email/failure-matrix items are not blanket-complete.
- Next step: maintain, do not rebuild.

## FM-MEM-008
- Date: 2026-08-19 to 2026-08-20
- Status: ACCEPTED
- Risk: R3
- Goal: Add Project Memory V8 cross-chat reconciliation, impact-scoped revalidation, owner-action inbox and automatic handoff without weakening existing V6/V7 finishline controls.
- Branch/PR: `project-memory-v8-crosschat-impact` / PR #980.
- Implementation evidence: final exact PR head `704fec4b6264dd5a0dd83cc8e0029352672485d0` contained the V8 controls plus corrected V5 bookkeeping and generated status.
- Verification evidence: Project Memory Guard, Project Memory Quality, Project Memory Status, FanMind CI, Landing Language CI, Supply Chain Security and CodeQL all passed on that exact head.
- Independent countercheck evidence: Browser E2E run #915 passed on the same exact head after the earlier cancelled-browser attempt was explicitly rejected as insufficient evidence.
- Result: PR #980 squash-merged to `main` as `22eb6aed5da4fde47860bbe12b118d3780c8a4a0` only after the complete exact-head gate set was terminal green.
- Status path: IMPLEMENTED -> VERIFIED -> COUNTERCHECKED -> ACCEPTED.
- Negative/fail-closed path: chat claims remain non-evidence; stale success downgrades to revalidation; owner/provider-only actions remain deferred; V8 does not bypass V6/V7 gates or mutate product/runtime/provider state.
- Rollback/recovery: governance-only changes can be reverted to the last accepted V6/V7 baseline without altering product/runtime/provider state.
- Falsification question: What observation would prove our conclusion wrong? A current V8 quality/status failure, evidence that automatic handoff contradicts stronger repository/runtime truth, or evidence that V8 weakens an existing finishline/security invariant would reopen the task as `RECONCILIATION_REQUIRED`.
- Next step: maintain V8; do not reopen PR #980 or create a parallel memory system.

## FM-MEM-009
- Date: 2026-08-30
- Status: ACCEPTED
- Risk: R2
- Goal: Close FM-LOOP-011 by mapping every stale #642/#643/#644 category to exact current evidence or a genuine retained gate and synchronize the public issue state with #874.
- Starting state: #642/#643/#644 still expose partially obsolete unchecked Staging prerequisites even though #874 Gate 1, STAGING_ACCEPTED and exact successful Staging runs prove later progress.
- Action: created one machine-readable reconciliation contract with deterministic rendering, independently pinned source/evidence/classification contracts and fail-closed tests; after exact-head merge, update issue bodies and deliberately supersede #644.
- Result: the repository contract is implemented and counterchecked; PR #1033 final head `70ea1bc61c7adefb739ba8fa3e16ea0bb84b4e58` passed all 11 exact-head checks and completed review with zero unresolved threads, then squash-merged as `cc82dd7ad62e6aaf1d7b2637d49d43010789475f`. #642/#643 remain open with genuine gates, #644 is closed as superseded, and #874 Gate 3 reflects the current Android/Google/iOS truth; every record was independently re-read.
- Evidence: FM-EV-032, exact runs `31837057323` and `31895476403`, accepted Staging milestone, 10/10 focused tests, 1073/1073 Operations tests, PR #1033 and post-merge issue snapshots observed on 2026-08-30.
- Next step: keep FM-MEM-009 accepted. Work only from the retained canonical tasks; do not reopen the historical #644 umbrella.
- Do not repeat: do not rebuild Staging/Referral foundations or close #642/#643 while their explicit remaining gates lack evidence.

## FM-SEC-001
- Date: 2026-08-20
- Status: RECONCILIATION_REQUIRED
- Risk: R3
- Goal: reconcile current live Supabase security-advisor posture with the repository's controlled hardening design and finishline before any Production/Auth mutation.
- Starting state: fresh Production/Staging targets are `ACTIVE_HEALTHY`, but current advisors expose unresolved warnings.
- Production evidence: three trigger helpers still report mutable `search_path`; retired `trim_conversation_messages_to_latest_50()` is still reported as `SECURITY DEFINER` executable by `anon` and `authenticated`; leaked-password protection is disabled. `supabase/controlled/20260806203023_harden_trigger_function_privileges.sql` and `docs/operations/TRIGGER_FUNCTION_HARDENING_PRODUCTION.md` already define a checksum-pinned, transactional, fail-closed Production remediation, but the live advisor state shows that accepted post-apply state is not currently proven.
- Staging evidence: `ensure_current_user_workspace(...)` is reported as authenticated-callable `SECURITY DEFINER`; repository migration explicitly grants that call to `authenticated` and validates `auth.uid()/auth.role()` while deriving commercial terms server-side, so it is an intentional-exception candidate rather than an automatic revoke. Leaked-password protection is also disabled.
- Informational RLS findings: multiple service-only/internal tables have RLS enabled with no browser policies; current Production hardening runbook explicitly warns not to invent browser policies merely to silence these INFO advisories.
- Independent evidence class: live Supabase security advisors on both exact targets, separate from repository code/CI.
- Negative/fail-closed path: no broad grants, no artificial browser RLS policies, no trigger Apply if target/commit/checksum/ACL preflight drifts, and no Auth-setting acceptance inferred from code.
- Rollback/recovery: use only the existing transactional controlled Production runner/postflight for trigger hardening; any Auth-setting change requires a separately documented reversible provider action.
- Related issue: #982.
- Falsification question: What observation would prove our conclusion wrong? A fresh advisor/catalog/ACL read showing Production already hardened, or evidence that the controlled migration/runbook no longer matches the deployed target, would invalidate this baseline and require a new reconciliation before mutation.
- Next step: run the existing read-only Production hardening verify against the exact deployed commit; separately review the Staging RPC exception and leaked-password setting; do not Apply/mutate under this reconciliation task.
- 2026-08-26 refresh: FM-EV-019 reconfirmed the same live Production/Staging advisor and exact function/ACL state with no drift. The offline Production hardening contract is ready; the protected exact-deployed-commit verify, exception acceptance and Auth-setting decision remain open. No provider mutation occurred.
- 2026-08-26 protected verify: exact run `32997946812` job `98271985321` on deployed `5cb9c193e262f8939b5fc0c700fce154dde616e6` passed preflight/postflight audits and returned the expected read-only `hardening_not_ready` pre-state. Fresh advisors were unchanged; 24/24 focused Staging tests classified the authenticated workspace RPC as constrained intentional exposure pending explicit exception acceptance. Apply and Auth settings remain separately owner-deferred; no provider mutation occurred.
## RECEIPT-FM-RST-001-TARGET-PRINCIPAL-PROJECTION-20260907
- Task: FM-RST-001.
- Started: 2026-09-07 after reconciling issue #944 final runtime evidence with current `main` `01803752e6ae807159bcc4301591794c7c74bdfb`.
- Risk: R4 code-path correction; no runtime execution.
- Branch/PR: `fix/restore-target-principal-projection-20260907` / #1075.
- Preflight checked: mandatory Project Memory and Restore readers; current main/PR/CI; issue #944 comments `5453599115`, `5453727223`, `5453857592`; workflow `33178878764` / database job `98874745740`; current authorization snapshot and schema-ACL recovery helpers.
- Proven runtime state: isolated `pg_restore --single-transaction` committed; exactly eight missing schema-USAGE grants were completed under separate authorization; expected/projected-actual fingerprint `0604dac8562a601e2d582f76aee4203825b826b302b9b0b93a92bdd2ca603052`; core postcheck `5|5|5|5`; plaintext cleanup PASS; no Production/Supabase-Staging access or write; no repeat Restore.
- Root cause: generic authorization capture seeds its source role component with every login, so the isolated target-only `fanmind_restore_bootstrap` principal entered target snapshots and caused the post-commit helper boundary mismatch.
- Changes made: raw source/backup capture remains unchanged. A target projection excludes exactly the connected restore login only after the existing preflight proves it is the unique login/superuser outside the receipt-bound source component. Schema-ACL before/after/failure/rollback comparisons use that bounded projection. Focused SQL encoding and wiring regressions were added.
- Checks: PR #1075 exact head `5d25e9ec94e452223e675c58fc54f4c87c1b5652` passed Project Memory Guard/Quality/Status, FanMind CI including Operations/Build and the real PostgreSQL 17 authorization roundtrip, Landing Language CI, Browser E2E and CodeQL with zero unresolved review threads.
- Result status: COUNTERCHECKED; PR #1075 squash-merged as `e3009134f87dc4b197c518cb097ceee867b0c7f8` and issue #944 closed `completed`. Overall `FM-RST-001` remains PARTIAL; the correction did not authorize or repeat a Restore.
- Open follow-up: reconcile every `DB_RESTORED -> DB_POSTCHECKED` predicate from existing receipts/read-only evidence, then continue only with genuinely unproven Storage/server-config/disposable-target/final acceptance.
- Work lock released: yes; repository correction merged and the issue-specific helper loop is closed. No runtime Restore lock was opened.

## RECEIPT-FM-RST-001-DATABASE-POSTCHECK-RECONCILIATION-20260907
- Task: FM-RST-001.
- Risk: R4 evidence reconciliation only; no runtime/database/provider action.
- Lock: `LOCK-FM-RST-001-DB-POSTCHECK-RECONCILIATION-20260907`.
- Evidence classes: immutable GitHub authorization/execution chain in issue #944; reviewed controller/runtime invariants; permanent helper implementation and exact-head CI from #1075; independent machine-reader correction #1077.
- Result status: COUNTERCHECKED. Every `DB_RESTORED -> DB_POSTCHECKED` predicate is explicitly mapped in `receipts/FM-RST-001-DATABASE-POSTCHECK-ACCEPTED-20260907.md`.
- Accepted progression: `DB_POSTCHECKED`; overall `FM-RST-001=PARTIAL`.
- Negative proof: no workflow/JIT dispatch, database/Storage connection or mutation, target reset, Production/Supabase-Staging access, or reuse of a consumed authorization/controller.
- Open follow-up: repository-only Storage restore/verification control preparation, then separately authorized isolated Storage mutation.
- Work lock released: yes; PR #1079 passed exact-head checks/review and squash-merged as `021566f3d1c9abd828b29f048cb6a0b572404fa9`.

## RECEIPT-FM-RST-001-STORAGE-PREPARATION-20260907
- Task: FM-RST-001.
- Date: 2026-09-07.
- Lock: `LOCK-FM-RST-001-STORAGE-PREPARATION-20260907`.
- Starting state: accepted `DB_POSTCHECKED`; no reusable database controller/authorization and no Storage upload path.
- Result status: COUNTERCHECKED_REPOSITORY_PREPARATION. Exact Full-Backup Storage extraction now requires safe/unique archive entries, exact manifest path-set/size/hash/count equality, private non-overwriting archive/receipt publication and independent streaming receipt/artifact/commit/part validation.
- Negative proof: synthetic tests only; no workflow, real decrypt, Storage/provider/database connection, upload/delete, Production/Supabase-Staging access or state advancement.
- Evidence: FM-EV-037; focused 15/15 tests; full Operations/build/focused ESLint; Product Truth and immutable Actions checks.
- Open follow-up: after exact-head merge, obtain separate exact R4 authorization for a distinct isolated non-Production Storage target and dedicated fail-closed write/postcheck/rollback/cleanup controller. Accepted progression remains `DB_POSTCHECKED`; overall `FM-RST-001=PARTIAL`.
- Work lock released: yes; repository-only local countercheck complete.
