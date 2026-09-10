# Started Work Register

## FM-ROADMAP-001 — Creator Intelligence sequencing 2026-09-10
- Status: VERIFIED
- Risk: R2
- Work lock: LOCK-FM-ROADMAP-CREATOR-20260910
- Scope: owner-requested roadmap and Project Memory update only; Phase 7 channels -> Sales Handoff -> Creator Intelligence -> further Phase 8 work.
- Completed so far: main 7004c9ea, all mandatory readers, open PRs/CI and existing architecture reviewed; no Creator implementation exists in the reviewed main.
- Still open: current-head CI/review and later merge/release of published PR #1090; no Creator implementation has begun.
- Exact next step: review PR #1090 and its current-head CI; do not repeat branch/PR creation or start Creator implementation before accepted handoff.
- Owner action needed: none for this roadmap preparation; no feature implementation, schema/provider mutation or Production release included.
- Evidence plan: final diff, existing roadmap/truth/translation/memory checks and selector checks before/after Sales Handoff.
- Recovery: revert only this bounded roadmap change; preserve accepted evidence and existing prices.

## FM-AI-001 / FM-RST-001 — PR #1088 review reconciliation 2026-09-10
- Status: IN_PROGRESS
- Risk: R4
- Boundary: repository evidence correction only
- Work lock: LOCK-PR1088-REVIEW-20260910
- Scope: reconcile three delayed review findings, separate technical results from missing protected-action authorization, invalidate stale mutable evidence and record the separately approved SSH change.
- Baseline: PR #1088 head 4c80de174c011a8a121ef32a176497cb3b44041e; main 7f681d26fa0e3c30e743c6a8ef1cd4fef6004e59. Seven checks passed on the old head, but three review threads remain unresolved.
- Evidence plan: exact diff, existing governance/truth controls, fresh final-head CI and resolved review. No runtime test, new authorization inference, schema or price change.
- Recovery: revert this documentation change; retain actual observations and do not silently erase the authorization gap.
- Exact next step: complete the existing quality controls, publish to PR #1088 and verify fresh CI/review.

## FM-RST-001 — owner SSH access repair 2026-09-10
- Status: PARTIAL
- Risk: R4
- Work lock: LOCK-FM-RST-SSH-20260910
- Authorization: owner explicitly confirmed saving the reviewed single-IPv4 TCP/22 ingress rule for the existing isolated Restore VM.
- Scope: only fanmind-restore-isolated, attached to fanmind-restore-01; owner source address stays private. No default-group change, new key, database Restore, Storage write or new paid target.
- Preflight: authenticated provider shows the existing VM running; neither attached group permits SSH; owner TCP probe failed and the locally available key name matches the VM base-key name. Cryptographic authentication remains unverified.
- Evidence plan: verify persisted exact rule and target scope, then independent owner TCP/SSH observation. Reject any broader CIDR, extra ports or unrelated instance attachment.
- Recovery: remove only this newly created rule if rollback is needed. Existing PostgreSQL self-group rule is preserved.
- Provider result: saved once and read back ingress TCP 22/22 from the approved owner /32; rule prefix eb474b38. The sole prior PostgreSQL self-group rule remains.
- Exact next step: owner reported SSH negotiation and failed key/passphrase/password authentication. Network reachability is independently proved; try the other existing FanMind key without server-password fallback. No successful host login is claimed.

## FM-AI-001 — shared rollout binding correction 2026-09-08
- Status: VERIFIED
- Risk: R4
- Work lock: LOCK-FINISHLINE-RESUME-20260906; bounded workflow/publication subtask complete, wider external owner/device scope remains paused.
- Result: PR #1087 passed eight exact-head workflows and resolved review, merged as 7f681d26; Production deployment/audit/go-live and exact Staging deployment passed. Technically successful AI run 34273836166 / 102221843980 passed with full rollback and cleanup; independent counts remained unchanged. See FM-EV-039.
- Protected acceptance: CTR-FM-AI-AUTH-20260910 remains RECONCILIATION_REQUIRED; technical PASS is not verified action-time authorization.
- Exact next step: keep FM-FAIL-022 and this correction closed. Do not repeat accepted prices, Billing cutover or rollback proof without a documented invalidation. Continue distinct real-device, product/private/provider/Legal/Production gates; overall FM-AI-001 remains PARTIAL.

## FM-SEC-001 / FM-AI-001 / FM-MOB-001 / FM-RST-001 — owner resume 2026-09-08
- Status: VERIFIED
- Historical checkpoint: superseded by PR #1087 publication and the September 10 authorization/freshness reconciliation; no pending repair or automatic rerun follows from this record.
- Disposition: bounded live reconciliation complete, read-only lock released; whole finishline remains partial and the bounded KI workflow repair has its own active record.
- Risk: R3
- Scope: Bernd resumed the four non-Social completion blocks and confirmed existing prices are finished. Preserve the installed catalog; no price creation or repricing.
- Work lock: LOCK-FINISHLINE-REVALIDATE-20260908 for read-only evidence and repository reconciliation only. Existing LOCK-FINISHLINE-RESUME-20260906 retains its narrower unfinished runtime scope.
- Completed so far: exact main/Production baseline a1bde3877b8f233004cb6e903f4c0b4fb68cdf3e; drift/freshness/selector preflight inspected; both FanMind Supabase targets healthy. Fresh security advisors still show Production trigger/Auth gaps and now two constrained Staging RPC warnings.
- Completed evidence: FM-EV-038 records successful shared rollout, exact Staging deploy and Stripe Test webhook verification; independent counters are unchanged. AI acceptance stopped before database access due to missing workflow API-origin bindings.
- Exact next step: use the current PR #1088 reconciliation and FM-AI-OWNER-002; PR #1087 repair, merge and deployments are complete.
- Owner action needed: only the exact remaining boundaries after available work is complete; never ask to recreate accepted prices, database Restore or signed builds.

## FM-AI-001 / FM-MOB-001 / FM-RST-001 — owner resumed finishline 2026-09-06
- Status: PARTIAL
- Risk: R4
- Owner explicitly requests Android/Push, Google Play, isolated Restore and Staging Billing completion today. Prior deferrals for these scopes are resumed, subject to actual target/readiness and external evidence.
- Work lock: LOCK-FINISHLINE-RESUME-20260906 remains ACTIVE only for FM-AI-001/FM-MOB-001; FM-RST-001 was removed after the database phase closed. Repository-only postcheck and Storage-preparation locks are released after their bounded counterchecks.
- Completed so far: Billing schema/capture-only foundation remains proven (Apply `34040107219`, durable capture `34043010578`, unfreeze `34043148548`); #1069 merged as `294264e216ee0c6844caab5c6f51f11f2a76eeeb`; #1070 merged as `2be4f5a784eff80ba417037ed0460a77f9f8353e`; #1072 merged as `62e6a11858e85996af03f6740819b0fc6194b4a4`. Exact isolated-Staging deploy `34058028839` and rollback-only canonical Billing acceptance `34058118450` / job `101553652111` passed on that commit with rollout `PASS`, Billing ledger `verify`, cutover pending `0`, uninventoried `0`, transaction rollback and cleanup `PASS`; the independent read-only Staging postcheck remained unchanged. Push registration runtime is configured; real device evidence remains pending. Historical AI-tier rollback acceptance `34039968946` / job `101504820898` succeeded on its old exact revision, but the later Staging deploy `34058028839` invalidated that mutable current-state evidence.
- Superseding AI result: Run 34273836166 / job 102221843980 on deployed 7f681d26fa0e3c30e743c6a8ef1cd4fef6004e59 technically passed the shared rollout, three ledger verifies, Test catalog, lifecycle, browser boundary and service-role ledger, with full rollback/cleanup and unchanged read-only counters. Its separately required action-time protected-Staging authorization has not been verified in the available record. Publication authorization FM-AUTH-FINISHLINE-PUBLISH-20260908 does not establish that separate scope. Keep this protected acceptance RECONCILIATION_REQUIRED under CTR-FM-AI-AUTH-20260910; retain the observed result, do not invent approval or rerun automatically.
- Historical checkpoint below: September 6 statuses are preserved; later deployed-revision observations and invalidations are authoritative.
- Still open: actual Android device/provider registration/delivery evidence, Play cohort/complete Store-device acceptance and the distinct isolated Storage target decision (database Restore is already DB_POSTCHECKED). For AI/Billing, the bounded technical Staging canonical-Billing sub-gate is closed, while one fresh exact-deployed-revision rollback-only AI-tier revalidation is `RECONCILIATION_REQUIRED` before relying on current lifecycle acceptance; product/private quality-cost, provider-side current lifecycle/downstream reconciliation, Legal/Tax, Production runtime integration and explicit activation remain open. Canonical Production projection, real payment and paid-tier activation remain disabled.
- Exact next step: do not redeploy `2be4f5a...` and do not repeat `staging-billing-canonical-acceptance.yml`; those actions are closed by runs `34058028839` and `34058118450`. Continue the owner-resumed Mobile path from the already built FCM replacement APK with real device registration evidence; keep provider delivery separate. Restore is accepted at `DB_POSTCHECKED`; do not repeat its database phase or retired SSH investigation. Only real isolated Storage remains open. Any fresh AI-tier lifecycle revalidation must target the exact currently deployed Staging revision and requires a new explicit protected-Staging authorization; do not rerun the historical `34039968946` revision as if it were current.
- Owner action needed: actual handset observation and a distinct isolated Storage target/cost decision; any future AI-tier Staging revalidation remains separately protected/authorized.


## FM-AI-001 / FM-CR-020 — Staging activation
- Status: SUPERSEDED (historical bounded freeze activation; later ledger/capture/unfreeze/canonical acceptance completed)
- Risk: R4
- Updated: 2026-09-07
- Work lock: LOCK-FM-AI-001-FREEZE-ACTIVATE-20260906 RELEASED.
- Scope: historical owner-authorized PR #1058 merge and Staging freeze activation; retained only as evidence of the pre-ledger safety boundary.
- Completed: PR #1058 merged as `157983d62afce572bfdf79374a0a5c5fd096b7db`; Staging run `34032100988` / job `101483398784` succeeded with freeze=true and independent public HTTP 503/Retry-After proof. This historical freeze was later superseded by general Billing Apply `34040107219`, durable capture `34043010578`, explicit unfreeze `34043148548`, exact Staging deploy `34058028839` and canonical rollback-only acceptance `34058118450` / job `101553652111`.
- Exact next step: none under this freeze-activation entry. Do not retain, re-enable or infer a current Billing freeze from this historical record, and do not repeat the completed ledger/capture/canonical Billing acceptance. Remaining AI work is tracked under the current FM-AI-001 owner/external gates, including the fresh exact-deployed-revision AI-tier revalidation now required by evidence freshness.
- Still open: nothing under this historical freeze activation itself; current AI product/private/provider/Legal/Production gates remain separate.
- Owner action needed: none for this superseded activation record.


## FM-AI-001 / FM-CR-020 — Checkout freeze review continuation
- Updated: 2026-09-07
- Status: SUPERSEDED (historical repository review; later ledger/capture/unfreeze/canonical acceptance completed)
- Risk: R4
- Branch/PR: `fix/staging-billing-write-freeze-20260905` / #1058
- Work lock: `LOCK-FM-AI-001-FREEZE-REVIEW-20260906` RELEASED; final remote CI/review is closed by the activation receipt.
- Completed so far: preflight, current main/PR/CI and review reconciliation. PR head `8fbd7e89678259276fddf62fc45ccc37b06ea727` exposed the shared Checkout boundary issue; the later reviewed fix restored the intended freeze behavior.
- Completed implementation: shared provider-boundary guard and fixed-code handling for API/page/redirect/admin callers; executable tests prove zero client/provider access during freeze and normal recovery after unfreeze.
- Closeout: final head `43537ccf729b7787b4bd300b678771eeb216892a` passed all eight remote workflows, all review threads resolved, PR merged and Staging freeze verified. The subsequent Billing Apply/capture/unfreeze and canonical rollback acceptance are complete under runs `34040107219`, `34043010578`, `34043148548`, `34058028839` and `34058118450`; therefore this review entry must not drive another cutover.
- Still open: nothing under this historical freeze-review continuation; remaining AI-tier current-revision revalidation, provider/product/private/Legal/Production gates are tracked separately.
- Owner action needed: none for this superseded repository review.


Canonical register for FanMind work that has started but is not yet fully completed.

## FM-MOB-006
- Started: 2026-09-03 Europe/Vienna
- Updated: 2026-09-07
- Status: ACCEPTED
- Risk: R3
- Change request: FM-CR-013
- Scope: dormant atomic Mobile Push Delivery-Ledger foundation and isolated-Staging rollback-only acceptance; no Production mutation, delivery activation or build.
- Work lock: `LOCK-FM-MOB-006-DELIVERY-LEDGER-20260903` RELEASED after repository implementation/countercheck.
- Completed result: controlled ledger SQL, server-only adapter, checksum runner, atomic reservation/lease/revocation contract, protected resource readiness, checksum-bound isolated-Staging applies, independent postflight and both rollback-only acceptance paths are complete. After safe SQLSTATE `2201B` identified an invalid bounded receipt-ID expression, exact commit `18a6ad79cb72331b4daa41ee87dd2430a8ffd473` corrected the constraint. Apply run `33867831888` / job `101006621418` and final Delivery-Ledger acceptance run `33867922978` / job `101006906941` passed with provider delivery disabled, synthetic rows, complete rollback and cleanup.
- Still open: nothing under FM-MOB-006. The required handler-containing FCM replacement APK already exists at descendant/build commit `6801d687cfe6048d6e32e63bcfe2862d2886fce0`, produced by workflow `34037085683` / job `101497020224`; the actual FCM correction commits are `1d15d8e4698392174ad7d5be23a7f174ebb2303d` and `547843cad7a1f6ecb3ba6131e155d9d068799c2b`. Real device registration and provider delivery remain separate under FM-MOB-001.
- Exact next step: do not queue another Android build. Install/use the existing `6801d687...` replacement APK for real Staging registration and Device-Acceptance; only after that may separately authorized provider-delivery evidence proceed. Keep the 12-tester/14-day Play cohort under its own external gate.
- Owner action needed: yes for real-device registration/acceptance and any later real provider delivery; no new signed build is required merely to resume this path.

## Rules
- Add an entry as soon as substantive work begins.
- Every active `IN_PROGRESS`, `PARTIAL`, `BLOCKED`, `IMPLEMENTED_NOT_VERIFIED` or `RECONCILIATION_REQUIRED` task must appear here until closed or superseded.
- Assign `Risk: R1|R2|R3|R4` before implementation continues.
- Never delete history; close with status, date, result, evidence and next step.
- Cross-link Task ID, Change Request, PR/branch, dependencies, work lock and execution receipt.

## Active work

## FM-WEB-004
- Started: 2026-09-04 Europe/Vienna
- Updated: 2026-09-04
- Status: IMPLEMENTED_NOT_VERIFIED
- Risk: R3
- Change request: FM-CR-017; continues FM-WEB-003.
- Scope: repository-only protected Website Chat retention Staging controls and Workspace-scoped rollback acceptance; no dispatch, database apply, schedule, Production, provider, email or real visitor data.
- Work lock: `LOCK-FM-WEB-004-RETENTION-STAGING-20260904` RELEASED after complete local countercheck; publication remains repository-only.
- Dependencies: exact reviewed `main`, isolated Staging target, marked synthetic Workspace and separately authorized protected actions.
- Completed result: Workspace-scoped retention signature, exact-main/TLS/target guards, checksum-bound verify/apply runner, service-role postflight, browser-denied deterministic rollback acceptance, manual workflows, tests and runbook are prepared.
- Still open: exact-main remote CI. Every Staging verify/apply/acceptance dispatch remains separately authorized.
- Exact next step: publish and inspect exact-main checks; do not dispatch a workflow.
- Owner action needed: later, separately, for each protected Staging action.

## FM-WEB-003
- Started: 2026-09-04 Europe/Vienna
- Updated: 2026-09-04
- Status: IMPLEMENTED_NOT_VERIFIED
- Risk: R3
- Change request: FM-CR-016; continues FM-WEB-001/FM-WEB-002.
- Scope: repository-only bounded Website Chat technical-retention contract; no database apply, timer/worker, CRM deletion, Production mutation, AI/provider request or outbound email.
- Work lock: `LOCK-FM-WEB-003-RETENTION-20260904` RELEASED after repository implementation and local countercheck.
- Dependencies: controlled Website Chat handoff schema, technical evidence cascades, later protected Staging controls and exact reviewed `main`.
- Completed result: checksum-pinned dry-run-first cleanup RPC, 1,000-session batch bound, lock-safe execution selection, active-Handoff hold, service-role-only ACL and explicit CRM-history exclusion are repository-ready.
- Local evidence: checksum/offline check PASS; focused retention 6/6; Website Chat 36/36; release integrations 84/84; Operations 1113/1113; TypeScript, lint, Production build, truth/action pinning and Project Memory quality/status/drift checks PASS. Lint reports only the pre-existing Mobile warning.
- Safety: controlled SQL remains outside generic migrations and adds no schedule, provider, AI, email, installation activation or external state change.
- Still open: exact-main remote CI and a separate protected Staging verify/apply/rollback-only acceptance path before any apply or operational schedule.
- Exact next step: publish the exact repository commit and inspect remote checks; do not apply the SQL from this task.
- Owner action needed: none for repository publication; separate authorization remains required for future Staging database actions.

## FM-WEB-002
- Started: 2026-09-04 Europe/Vienna
- Updated: 2026-09-04
- Status: IMPLEMENTED_NOT_VERIFIED
- Risk: R3
- Change request: FM-CR-015; continues FM-WEB-001/FM-CR-014.
- Scope: repository-only exact-main protected Staging verification, separately confirmed schema apply and rollback-only synthetic Website Chat handoff acceptance.
- Work lock: `LOCK-FM-WEB-002-STAGING-CONTROL-20260904` RELEASED after repository implementation and local countercheck.
- Dependencies: checksum-pinned Website Chat handoff SQL, isolated Staging variables/secrets and exact reviewed `main`.
- Completed result: separate exact-main manual verify/apply and rollback-only acceptance workflows, direct target/TLS/passfile controls, independent RLS/ACL/function postflight and deterministic synthetic lifecycle proof are repository-ready.
- Local evidence: pinned SQL/offline acceptance PASS; Website Chat 30/30, release integrations 78/78 and Operations 1113/1113 PASS; Action pinning, product truth, Project Memory quality/status, TypeScript, lint and production build PASS. The sole lint warning is pre-existing and outside this task.
- Remote evidence: exact-main commit `79e0e0c761f4c6f6895d76c4253b3b93b5f1e3a2` passed Browser E2E, CodeQL, Supply Chain Security, normal Web deploy, read-only Production audit and Final Go-Live Readiness.
- Safety: no workflow dispatch, database apply, Production mutation, installation activation, AI/provider call, outbound email or real visitor data.
- Still open: any protected Staging dispatch, controlled schema apply, rollback-only database acceptance, installation activation, AI/provider work and outbound email.
- Exact next step: perform no Staging dispatch without its separate authorization.
- Owner action needed: none for repository publication; separate authorization remains required before protected Staging verify, apply or acceptance.

## FM-WEB-001
- Started: 2026-09-04 Europe/Vienna
- Updated: 2026-09-04
- Status: IMPLEMENTED_NOT_VERIFIED
- Risk: R3
- Change request: FM-CR-014; extends accepted roadmap decision FM-CR-012.
- Scope: dormant Website Chat processing-entitlement and consent-bound human-handoff preparation; no database apply, installation activation, AI/provider call or outbound email.
- Work lock: `LOCK-FM-WEB-001-HANDOFF-20260904` RELEASED after repository implementation and local countercheck.
- Dependencies: existing Website Chat session/message foundation, canonical Workspace processing predicate and current CRM contact/conversation timeline.
- Planned evidence: focused policy/API/widget/controlled-SQL tests, checksum check, TypeScript/lint/build and Project Memory/truth checks.
- Completed result: consent-bound one-per-session handoff API/widget flow, existing CRM timeline linkage, atomic processing/origin/session revalidation and service-role-only fingerprinted evidence are implemented repository-side without AI, email or external mutation.
- Local evidence: checksum PASS; Website Chat 20/20, Inbox 13/13, Production controls 5/5 and WhatsApp inbound 30/30 PASS; product truth, Project Memory quality, TypeScript, lint and production build PASS. The sole lint warning is pre-existing and outside this task.
- Remote evidence: exact-main commit `6452cb2452b3e5a664d86f5073a410f3744b1bae` passed Browser E2E, CodeQL, Supply Chain Security, normal Web deploy, read-only Production audit and Final Go-Live Readiness. The deploy did not apply controlled SQL or enable an installation, so the feature remains dormant.
- Still open: protected Staging verify/apply/rollback-only acceptance, installation activation, retention cleanup, AI dialogue, uncertainty-driven escalation, email verification and manually approved email delivery.
- Exact next step: prepare a separate protected Staging verify/apply/rollback-only acceptance path before any installation can be enabled.
- Owner action needed: none for repository publication; separate authorization is required before any Staging database apply, external provider call or Production activation.


## FM-MEM-009
- Started: 2026-08-30
- Updated: 2026-08-30
- Status: ACCEPTED
- Risk: R2
- Scope: Reconcile legacy Staging/Referral issues #642/#643/#644 against immutable current Staging evidence and the active #874 finishline without reimplementing completed work or closing genuine external/negative-test gates.
- Change request: FM-CR-008.
- Branch/PR: `ops/legacy-issue-reconciliation-20260830` / #1033; final exact head `70ea1bc61c7adefb739ba8fa3e16ea0bb84b4e58`, squash merge `cc82dd7ad62e6aaf1d7b2637d49d43010789475f`.
- Work lock: `LOCK-FM-MEM-009-LEGACY-ISSUES-20260830` RELEASED.
- Dependencies: accepted STAGING_ACCEPTED milestone, exact successful Staging runs `31837057323` and `31895476403`, current #874 body, and repository tests/runbooks that define the proved boundaries.
- Assumptions: an unchecked historical issue item is not proof that implementation is absent; conversely, a later umbrella statement cannot close a specific negative/external control without matching evidence.
- Planned evidence: machine-readable issue map, deterministic human rendering, positive and negative validator tests, Project Memory/truth/drift checks, exact-head PR gates, and post-merge issue-body/state reconciliation.
- Completed result: current issue bodies, immutable workflow run/job results and the accepted Staging milestone were read-only crosschecked. The canonical machine/human reconciliation, validator and regression coverage are implemented. Focused tests pass 10/10, Operations pass 1073/1073, all local governance/truth checks pass, and PR #1033 final head `70ea1bc61c7adefb739ba8fa3e16ea0bb84b4e58` passed all 11 remote checks plus completed review with zero unresolved threads before merge `cc82dd7ad62e6aaf1d7b2637d49d43010789475f`. #642/#643 were independently re-read open with only genuine gates, #644 was re-read closed as superseded by #874, and #874 Gate 3 now preserves the verified Android AAB/Google/iOS boundaries.
- Still open: nothing under FM-MEM-009. The retained Referral/Staging/Mobile/Restore/AI/provider/legal gates remain owned by their canonical tasks and were not accepted here.
- Exact next step: keep FM-MEM-009 closed; continue only from a canonical retained gate and never rebuild the Staging foundation or Android AAB merely because an old issue was reconciled.
- Rollback/recovery: revert the governance-only commit and restore prior issue metadata if the post-merge write is inconsistent; no product/runtime/provider/database state is involved.
- Owner action needed: none for repository/issue reconciliation; retained legal, Production activation, payment and protected external gates stay owner-controlled.

## FM-MOB-004
- Started: 2026-08-29
- Updated: 2026-08-30
- Status: ACCEPTED
- Risk: R3
- Scope: Deliver the owner-requested three-section fan detail, one-line identifier, safe Mobile fan analysis, fan-bound Follow-up navigation, today's Dashboard Follow-ups and corrected square native splash; then produce one exact-merge Android preview.
- Change request: FM-CR-005.
- Branch/PR: `feat/mobile-fan-sections-analysis-followups-splash-20260829` / #1025; final exact head `64329ac628188cf532281ddb742058612b9e9eb8`, squash merge `6a2f5b6c9bac1607ecc2ccae11c6ade3cb418522`.
- Work lock: `LOCK-FM-MOB-004-FAN-SECTIONS-20260829` RELEASED.
- Dependencies: existing RLS and Mobile Bearer authorization, server-side analysis action/capability gates, exact-head CI and one protected Android preview build.
- Assumptions: stored Fan-analysis reports remain read-only and are displayed only with source period, sample size, confidence and review state. Production generation remains hidden/in preparation until the Workspace analysis/privacy contract is technically active and verified. Follow-up navigation carries only the contact ID and selected section.
- Planned evidence: Mobile typecheck/Expo/native checks, focused authorization/UI tests, full repository regression, exact-head PR gates, SHA-bound merge and exactly one merged-commit Android preview.
- Completed so far: initial implementation/docs and local checks passed. Eleven successive exact-head reviews found six, four, six, three, three, three, two, one, two, two and three valid cases, thirty-five in total. The first three corrections added provenance, semantic statuses/counting, fail-closed Mobile/Web/legacy behavior, priority-before-cap pagination and section-specific errors. Review four added the final unknown/null-priority group, an exact/truncated per-contact Follow-up result and low confidence for generic fallback-only analysis. Review five added legacy `NULL` status as open, complete stable 200-row pagination for the central Follow-up list and a hard no-write/no-provider boundary without a valid analysis source period. Review six added service-failure precedence for capability reads, conclusion hiding for rejected reports and timestamp-valid-only provider/provenance samples. Review seven made the explicit Bearer path owner-only and gated the Mobile analysis empty state after load failures. Review eight prevents Web from showing a false empty state beside a saved report hidden for incomplete provenance or a load error. Review nine excludes rejected/incomplete reports from productive reply prompts and refreshes die zentrale Follow-up-Liste on focus. Review ten binds the Web control to the server capability status and parallelizes the six fail-closed legacy column probes. Review eleven also binds that Web control to the active-processing entitlement, suppresses an unknown Dashboard count after read failure and verifies the complete report schema before provider use. The eleventh full local countercheck is green: 42 focused checks, 1055 operations tests, root TypeScript/lint/build, Mobile typecheck/Expo Doctor 20/20/Store/boundary/native prebuild, Android/iOS exports and all Project Memory/truth/drift gates passed. All fixes are grouped without schema, row, provider or Production mutation.
- Verified result: final PR head `64329ac628188cf532281ddb742058612b9e9eb8` passed all nine exact-head gates with no unresolved review thread and merged as `6a2f5b6c9bac1607ecc2ccae11c6ade3cb418522`. Protected run `33298699290`, job `99222705186`, completed exactly one `preview` Android internal build for that merge, verified the HTTPS APK artifact, stored the redacted receipt and cleaned temporary state. Submit and Update remained disabled.
- Accepted result: on 2026-08-30 the owner installed and inspected the exact-merge Android Preview on a real device and confirmed the current Mobile result as finished. This accepts the three fan sections, one-line identifier, Follow-up navigation/today list, safe analysis preparation state and corrected square splash without a rebuild.
- Still open: nothing under FM-MOB-004. The real Recovery flow plus applicable Push/Store acceptance remain separate under FM-MOB-001; the exact Production Supabase redirect is now saved and iOS/TestFlight remains Phase 8.
- Exact next step: keep FM-MOB-004 closed. Open a new bounded task only for a newly observed device defect; do not rebuild merely to repeat acceptance.
- Rollback/recovery: revert the Mobile/API commit; no database migration or destructive action is part of this change.

## FM-MOB-003
- Started: 2026-08-29
- Updated: 2026-08-29
- Status: ACCEPTED
- Risk: R3
- Scope: Turn the Mobile start screen into a real unseen-inbound dashboard without the owner's rejected placeholder icon, add a dynamic per-contact message-channel switch for every fan, and allow owners to create a manual Follow-up directly in the contact detail; then deliver one exact-commit Android preview for owner verification.
- Change request: FM-CR-003.
- Branch/PR: `feat/mobile-fan-inbox-channel-followup-20260829` / #1021; final head `c4baed86bdcfd389a1f8ff5ce7752407113fb734`, squash merge `93496a4afac9b3b315c9985afbbce02b8524fc44`.
- Work lock: `LOCK-FM-MOB-003-FAN-INBOX-20260829` RELEASED.
- Dependencies: existing RLS-protected `conversation_messages.seen_at` and `followups` contracts; FM-DEP-002 for the replacement signed Android preview; exact-head CI and owner device confirmation.
- Assumptions: unseen means an inbound message with `seen_at is null`; opening a contact may mark its unseen inbound messages as seen only through the existing Workspace-bound authenticated mutation. Channel options must be derived from that fan's stored messages and support unknown future platform names.
- Planned evidence: pure-policy tests for channel filtering and Follow-up validation; bounded dashboard/query tests; TypeScript/Expo/native checks; full repository regression; exact-head PR checks; one merged-commit Android preview and owner device confirmation.
- Completed result: the Mobile start screen now lists only fans with inbound `seen_at is null` messages; contact history offers `Alle` plus every stored platform for that fan; owners can create a validated manual Follow-up directly in the contact detail; and the rejected decorative icon is absent from both Start and the shared wordmark. TypeScript, Expo Doctor, Store/native boundary checks, Android/iOS prebuild and exports, root truth/lint, 48 focused Mobile/security tests and the complete 1054-test operations suite passed locally.
- Verified result: PR #1021 final head passed all eight exact-head GitHub gates and merged as `93496a4afac9b3b315c9985afbbce02b8524fc44`. Protected signed-build run `33260695232`, job `99122008690`, completed exactly one `preview` Android internal build for that merge, verified the HTTPS artifact, stored the redacted receipt and cleaned temporary state; Submit and Update remained disabled.
- Accepted result: FM-EV-027 binds the owner's 2026-08-30 bounded real-device acceptance to the superseding FM-MOB-004 exact-merge Preview and confirms the unseen inbox, per-fan channel tabs, direct Follow-up and absence of the rejected symbol.
- Still open: nothing under FM-MOB-003. Broader Recovery/Purge, push and Store acceptance remain separate under FM-MOB-001; iOS/TestFlight remains Phase 8.
- Exact next step: keep FM-MOB-003 closed; do not rebuild merely to repeat acceptance.
- Rollback/recovery: revert the bounded Mobile UI/data-query commit. Marking messages seen uses the already accepted product field and is not automatically reversible; no message content, Follow-up history, schema or provider state may be deleted.

## FM-MOB-002
- Started: 2026-08-29
- Updated: 2026-08-29
- Status: ACCEPTED
- Risk: R3
- Scope: Expose the existing RLS-protected `conversation_messages` for each demo contact as a visible read-only newest-first conversation history in Mobile, then produce a replacement signed Android internal build for owner verification.
- Change request: FM-CR-002.
- Branch/PR: `fix/mobile-contact-message-history-20260829` / #1019; implementation head before Project Memory reconciliation `d7bb661d4ed2ed74b656c0ee2d822cb7396d5a8a`.
- Work lock: `LOCK-FM-MOB-002-CONTACT-HISTORY-20260829` RELEASED.
- Dependencies: FM-DEP-002; existing Staging demo workspace/contact/message rows; exact Supabase/RLS binding; current Expo SDK 57 patch contract; exact-head CI; Android preview signing/build path.
- Assumptions: ASM-FM-005 remains binding. The authenticated owner screenshots prove that the previous Android build can log in and render contact details, but they do not prove this new message-history change or complete the remaining iOS/store acceptance.
- Completed result: PR #1019 passed its final exact-head repository and native gates and merged as `ef0b7210c997558759a80c5ff46a7a5a0c005c3b`. Protected signed-build run `33254230496` produced a receipt-bound exact-commit Android preview; the owner's next Mobile observation confirmed that messages are visible and isolated the follow-on absence of channel switching.
- Still open: broader FM-MOB-001 iOS/TestFlight/store/push and complete external acceptance remain separate; the new bounded Mobile request is FM-MOB-003.
- Evidence so far: FM-EV-024; PR #1019; local 2026-08-29 checks; authenticated Android screenshots supplied by the owner; existing database observation of 13 demo contacts and 37 stored conversation messages.
- Exact next step: continue only through FM-MOB-003; do not reopen #1019 or duplicate the stored demo messages.
- Rollback/recovery: revert the bounded Mobile UI/data-query commit; no database schema or row mutation is part of the implementation. The previous signed APK remains available to the owner until the replacement is accepted.
- Owner action needed: only final installation/device confirmation after the new build is produced.

## FM-RST-001
- Started: 2026-08-17
- Updated: 2026-09-07
- Status: PARTIAL
- Risk: R4
- Scope: Complete the isolated real FanMind Restore drill without touching Production or Supabase Staging; preserve the accepted read-only chain and the now receipt-bound five-extension baseline while keeping every later Restore transition separately protected.
- Branch/PR: permanent target-principal projection correction #1075 squash-merged as `e3009134f87dc4b197c518cb097ceee867b0c7f8`; issue #944 closed `completed`; earlier SSH/extension/fail-closed reconciliation remains historical in PRs #1005/#997/#995.
- Work lock: no active runtime Restore lock; all historical one-shot authorizations/controllers are consumed. PR #1075 is repository-only and authorizes no database/JIT/workflow action.
- Dependencies: FM-DEP-001; exact Schema-2 Full Backup/Verification/source binding; existing isolated host/empty target/quarantine; full receipt-bound roles/database-container/extensions; protected authorization for any later mutation.
- Assumptions: database reset does not change cluster-global roles; prior full role/container authorization success remains navigation evidence only and must be freshly receipt-checked after extension provisioning. Mutable host, target, backup, runner-policy and TLS evidence must be revalidated before any mutation.
- Completed so far: the historical read-only/extension chain remains accepted. Later workflow `33178878764` / database job `98874745740` committed the receipt-bound isolated `pg_restore`; separately authorized ACL completion `5453727223` added exactly eight missing grants and verified the exact projected authorization contract, core `5|5|5|5` and plaintext cleanup. No Production or Supabase Staging access/write and no repeated Restore occurred.
- Latest reconciled result: isolated database Restore technically complete with expected/projected-actual authorization fingerprint `0604dac8562a601e2d582f76aee4203825b826b302b9b0b93a92bdd2ca603052`; receipt `FM-RST-001-ISOLATED-DATABASE-RESTORE-ACCEPTED-20260828.md`. The post-commit helper failure came only from including target-only login `fanmind_restore_bootstrap` in the source projection. PR #1075 permanently fixes that helper boundary.
- Historical attempt, superseded by the completed database phase: authorization `5385992305` / controller `45054c41...` stopped at SSH on 2026-08-26 before dispatch or database access. Later authorizations `5431373157`, `5453497602` and `5453727223` and their outcomes are authoritative; none may be reused.
- Accepted progression: `DB_POSTCHECKED`. Receipt `FM-RST-001-DATABASE-POSTCHECK-ACCEPTED-20260907.md` maps the immutable binding, exact projected authorization contract, roles/container/extensions and core table/RLS/policy/application/security-definer postchecks to every transition predicate. Storage, server config, disposable-target cleanup, independent countercheck and final aggregate acceptance remain open.
- Evidence so far: historical PRs #943/#987/#990/#991/#992/#997/#998/#1005; issue #944 final chain `5453599115`, `5453727223`, `5453857592`; run `33178878764`, job `98874745740`; accepted database-phase receipt; PR #1075 code/tests.
- Repository result: PR #1081 merged the exact private Storage archive/receipt preparation. The follow-on controller now locally proves target-empty, overwrite denial, exact remote path/size/hash postcheck, Production/canonical-Staging denial and rollback after a simulated partial failure.
- Exact next step: PR #1085 repaired and reconciled every delayed controller finding, passed seven exact-head workflows with zero unresolved threads and a clean Codex review, and SHA-bound squash-merged as `0ccf38e5f1afdd0b5f3495a137a5d360dd214ae7`. The repository-only controller is accepted and its repair lock is released. A real external Storage transition remains deferred under `FM-RST-OWNER-007`; never rerun the database Restore and never infer `STORAGE_RESTORED` from the synthetic proof.
- Owner action needed: none for the local-only repository proof. A later real isolated Storage mutation requires a new owner decision because the 2026-09-07 choice explicitly declined an additional Supabase project/Preview branch.
## FM-MOB-001
- Started: before 2026-08-19
- Updated: 2026-09-04 (one exact handler-containing Android Preview finished; device acceptance pending)
- Status: IMPLEMENTED_NOT_VERIFIED
- Risk: R3
- Scope: Signed Android/iOS Mobile release and real-device/store acceptance; the merged repository implementation now binds both read-only resource readiness and the separately protected signed-build path to the exact remote EAS project record.
- Branch/PR: App Store Connect worksheet PR #1037 final head `88b9299f9612e344a9c0c48d78f86f11d071db6c` merged as `a16e28f6e1aa0a2d7ff81bd679b472fab7563500`; dual-store PR #1031 final head `a963ab598eeb0a7ab84110e55cb4043d4230e550` merged as `3082490451dd45b5127bdf9d9ae55b4712255b72`; Android handoff PR #1030 and Store implementation PR #1028 are merged; earlier read-only evidence PR #1010 final exact head `15fca01adae6f4934c7b729512a14b8ccc926383`, squash merge `e6b3d9715726ede77ce7230cefa824edba16b2d4`; repository binding PR #988 merged as `e20efd475e475101226f266118b9cfed7972243a`.
- Work lock: `LOCK-FM-MOB-001-ANDROID-STORE-20260830` is ACTIVE for the explicitly resumed Android Production/Google Play continuation. Earlier Preview and bounded FM-MOB-004 locks remain RELEASED.
- Dependencies: the bounded FM-MOB-003/FM-MOB-004 real-device UI/runtime observation and exact Production Supabase redirect are complete; the full receipt-bound 19-check Android runbook/private validator and real Recovery flow now wait for Play-test-track installation. iOS build/signing/TestFlight/device evidence remains Phase 8, while repository-only App Store preparation is authorized.
- Assumptions: repository CI/build evidence does not prove a signed device build; a successful EAS lookup alone does not prove that the returned owner, slug and project ID match the protected FanMind binding.
- Completed so far: native app core, auth/recovery, SecureStore/Purge, contacts/knowledge/AI/followups, offline cache, push foundation, icon/splash/privacy/store metadata and CI/control workflows. PR #988 added a bounded verifier for the redacted `eas project:info` report, rejects owner/slug/ID drift and unsafe report files, wires it before both read-only readiness and any signed internal build queue, and exercises parser plus workflow wiring through positive and negative CI self-tests. Exact head `6f42a5897aabb3387a74149010dee2b5fb2c92cd` passed Project Memory Guard/Quality/Status, FanMind CI, Landing Language CI, Supply Chain Security, CodeQL and Browser E2E before merge `e20efd475e475101226f266118b9cfed7972243a`. On 2026-08-26 all five historical resource-readiness jobs were reconciled: development job `91521865376`, preview jobs `91521865677`/`93228923133`/`95410943740` and production job `91521871719` all had blank `EXPO_TOKEN` plus all four expected binding variables and failed closed with `eas_project_lookup_failed` before public-environment verification. The latest was 2026-08-17 and predates #988.
- Latest result: protected `preview` run `33298699290`, job `99222705186`, on exact merge `6a2f5b6c9bac1607ecc2ccae11c6ade3cb418522` reverified the EAS project/public Preview environment and completed exactly one signed Android internal artifact with exact-commit HTTPS artifact verification, redacted receipt and cleanup. Submit/Update/Production remained disabled.
- Accepted Android result: on 2026-08-30 the owner installed and inspected the exact FM-MOB-004 Android Preview on a real device and confirmed the bounded FM-MOB-003/FM-MOB-004 UI/runtime result as finished.
- Current continuation: owner explicitly requested the accepted Android app be finished, bound to FanMind Production and taken to Google Play. PR #1028 passed ten exact-head gates and merged as `e96415035ffbe12f16dd3b81e13a5e62b2c4ac00`. Protected Production readiness run `33316105624` / job `99269748215` then passed without writes. Protected Store-build run `33316172583` / job `99269924756` completed exactly one Android `production` AAB for the same commit, verified the terminal artifact, retained only a redacted receipt, purged temporary state and kept Submit/Update disabled.
- External observation: the FanMind Production and Staging Supabase projects are active/healthy. After separate owner confirmation, `fanmind://reset-password` was saved and re-read as the fourth exact Production Auth redirect on 2026-08-30. On 2026-09-03 the verified Android `1.0.0` AAB was published in the closed Google Play Alpha track for Germany, Austria and Switzerland; this is not public Production access.
- Completed repository continuation: FM-EV-031 adds the deployed public Support route, reproducible 512×512 Play icon and 1024×500 feature graphic, Apple metadata/review/tester/screenshot handoff and updated Store checks. PR #1031 passed all exact-head gates and merged as `3082490451dd45b5127bdf9d9ae55b4712255b72`; post-merge deploy/readiness/audit checks and live `/support` verification passed. It queued no build and performed no portal/provider write.
- Accepted repository continuation: FM-EV-034 adds a single machine-checked App Store Connect worksheet covering 33 first-release portal fields: thirteen technical values are ready, twelve need owner/legal/account decisions and eight remain Phase-8 binary/device controls. PR #1037 final head `88b9299f9612e344a9c0c48d78f86f11d071db6c` passed all eight exact-head workflows and completed final review with no major issue and zero unresolved threads, then squash-merged as `a16e28f6e1aa0a2d7ff81bd679b472fab7563500`. No Mobile build, TestFlight, portal write or Android-AAB replacement occurred.
- Current build attempt: after FM-MOB-006 isolated-Staging acceptance, run `33868661986` / job `101009217307` queued exactly one signed Android `preview` internal build for exact commit `700885307c265f8907cefe5f5b10499a5ea7b996`. All resource/binding/one-build preflights passed. GitHub failed closed after `53m 28s` because the free-tier queue exceeded its polling window; no retry was queued and no success receipt was stored. Authenticated read-only EAS inspection on 2026-09-04 later proved that the same build finished successfully for the exact commit/profile, internal distribution, version `1.0.0 (2)`, with an APK artifact. Submit and OTA Update remained disabled.
- Still open: the deliberately deferred closed-test cohort of at least 12 opted-in testers for at least 14 days, the complete private Android 19-check/Recovery proof and real screenshots from the Play installation, and the later Production-access request. Apple Developer/App Store Connect, signed iOS build, TestFlight, real screenshots and device acceptance remain Phase 8.
- Evidence so far: issues #584/#690, Source of Truth, mobile docs/tests, PRs #988/#1019/#1021/#1025/#1028/#1030/#1031/#1037, preview run `33298699290` / job `99222705186`, Production readiness run `33316105624` / job `99269748215`, Store-build run `33316172583` / job `99269924756`, FM-EV-021/FM-EV-024/FM-EV-025/FM-EV-026/FM-EV-027/FM-EV-028/FM-EV-029/FM-EV-030/FM-EV-031/FM-EV-034 and the Mobile receipts.
- Exact next step: do not requeue. Install the exact existing handler-containing APK and perform the bounded Android observation; keep real provider/device Push delivery separately authorized. The missing automated receipt means the complete private 19-check acceptance is not yet claimable from this build. When FanMind is ready for the Gerhard handoff, enroll at least 12 approved Alpha testers, keep the test active for at least 14 days and complete the private Android/Recovery acceptance before requesting Production access.
- Owner action needed: the private Android runbook/validator and separate recovery/Push/Store external controls only.

## FM-AI-001
- Started: before 2026-08-19
- Updated: 2026-09-06
- Status: PARTIAL
- Risk: R3
- Scope: KI Standard/Plus/Ultra product, quality, cost, Stripe lifecycle and activation readiness.
- Branch/PR: read-only evidence PR #1012 passed all 10 checks at exact head `b53e000228bf99801b327c1d7b81646edce32d6f` and squash-merged as `d1b9d7e94b3bc78a1720e197a795a105bdcc1883`; implementation foundations remain on `main`.
- Work lock: `LOCK-FM-AI-001-STRIPE-CONFORMANCE-20260830` is RELEASED after #1035 exact-head acceptance and merge; the older `LOCK-FM-AI-001-READONLY-RECONCILIATION-20260826` remains RELEASED and its three evidence jobs must not be rerun.
- Dependencies: written product decisions, private quality/cost evidence, current Staging provider lifecycle, Legal/Tax, explicit Production activation.
- Assumptions: Staging Test prices existing does not mean Plus/Ultra is activated or fully accepted.
- Completed so far: Standard active; Plus/Ultra prices/policy, entitlement resolver, Staging storage/foundations, five-price Stripe Test catalog, signed webhook smoke, lifecycle controls, applied AI-tier event ledger, monitoring/recommendation/eval tooling. Current exact-main runs `33003378162`, `33003452287` and `33003526741` pass the protected read-only AI-resource, five-price Test-catalog and exact 22-event webhook checks. Direct read-only catalog evidence confirms both AI ledger functions and all three tables with forced RLS, exact role boundaries, zero events and zero unresolved reconciliations. The 50/100/150 context limits are already approved and tested. The general Billing ledger is installed on isolated Staging; capture-only durability and unfreeze are proven, and exact isolated-Staging deploy `34058028839` plus rollback-only canonical Billing acceptance `34058118450` / job `101553652111` passed with zero cutover pending/uninventoried counters, full rollback and cleanup.
- Completed code continuation: FM-CR-009 replaces productive raw Stripe REST with one SDK `22.4.0` client pinned to outbound `2026-07-29.dahlia`, removes explicit Checkout payment-method narrowing, adds a fresh eight-letter integration-identifier suffix per Session and preserves fail-closed tax/cancellation/referral behavior. PR #1035 final head `ffdc11ab4a1c199134dc009abc516cc8257f5e8b` passed all eight exact-head workflows and completed review with zero unresolved threads, then merged as `9a7b37f2cee798dc64c1d32f70fda338db174b5e`. The observed inbound Staging webhook stays `2026-06-24.dahlia`; no provider resource was touched.
- Still open: final models/fallbacks, request/token quotas, usage/overage, switching/proration/refund and cost/margin decisions; private quality/cost evidence; provider-side current post-ledger lifecycle/downstream reconciliation; legal/tax; Production runtime integration and explicit activation. Canonical Production projection and Plus/Ultra remain disabled.
- Evidence so far: issue #560, issue #874, Source of Truth, `src/config/aiTiers.mjs`, current runs/jobs recorded in FM-EV-022/FM-EV-033 plus Billing Staging runs `34058028839` and `34058118450`, historical signed-smoke run `31781263978`, pre-ledger lifecycle run `31735315959`, AI-ledger apply run `32038152382`, focused local tests and the read-only Supabase catalog results.
- Exact next step: resume only after the applicable owner authorization under `FM-AI-OWNER-001`/`002`; do not rerun the completed Billing Staging acceptance or activate paid tiers without the remaining gates.
- Owner action needed: yes for product/financial decisions and any protected external activation.

## FM-META-001
- Started: before 2026-08-19
- Updated: 2026-08-26
- Status: PARTIAL
- Risk: R3
- Scope: Meta Events Manager/external Meta acceptance and final non-Social security proof.
- Branch/PR: technical reconciliation `meta-technical-reconciliation-20260826` / #1014, final head `12a479f00cce95d0031970c98c2d3933477ab804`, squash merge `ec1f196e82ab64a3b39b69a22a7b81b0757aa7a4`; repository-only closeout #1015 head `355f1ce580045598527c51bff49d2a52c80275df`, merge `d727b53470653844b50fa6a4ca2fc98f7fb2c89b`; canonical freshness follow-up `meta-canonical-freshness-fix-20260826` / #1017, evidence head `dd8246efe399f03180c675b245cc7277d46060ca`.
- Work lock: `LOCK-FM-META-001-TECHNICAL-RECONCILIATION-20260826` RELEASED through the repository-only closeout; do not revive it.
- Dependencies: normal-browser Meta Events Manager access, Meta app/test assets, App Review/permissions, legal/privacy acceptance.
- Assumptions: technical pixel calls and Staging migrations are not external Events Manager/App Review acceptance.
- Completed so far: consent-gated parameterless PageView-only Pixel Production path; advanced Facebook/Instagram OAuth/token/content/conversation foundation; 95/95 focused local tests; direct transaction-level read-only Staging catalog countercheck; exact-main protected read-only runs `33007156552`, `33007311870` and `33007481167` all passed with Apply not requested, runtime activation disabled where applicable and postflight rollback markers. Canonical readers now record that continuation and queue schemas are present in isolated Staging, and `EV-META-STAGING-FOUNDATION-20260826` expires the mutable observation. FM-FAIL-015 preserves the read-before-rollout sequencing deviation.
- Still open: external Events Manager positive/negative browser reception and provider-side no-PII/no-unexpected-conversion proof; App Review/permissions and real account/webhook/conversation E2E; final relevant security/legal acceptance.
- Evidence so far: FM-EV-007, FM-EV-023, `META_TECHNICAL_READONLY_RECONCILIATION_2026-08-26.md`, #714, Source of Truth and the three exact-main runs/jobs.
- Exact next step: external Events Manager/App Review/provider/legal work remains owner-controlled under `FM-META-OWNER-001`; keep conversion events, Advanced Matching and CAPI disabled. Do not repeat the evidence runs merely for closeout. After Staging freshness expiry/invalidation or before another Meta database action, acquire a new lock and revalidate shared rollout state first.
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
- Branch/PR: read-only verify evidence PR #1008 final exact head `ed64255f3786eea257011778a40492d6c7c9447e`, squash merge `4efb4eeef07d850fd0fd9117244187cf94bfed41`; refresh PR #1006 merge `78333aae9d075a67a2d550a266d24cb8b9f443a4`; prior lock closeout #1007 merge `5cb9c193e262f8939b5fc0c700fce154dde616e6`; issue #982 comments `5428919200`/`5428996454`/`5429302086`.
- Work lock: `LOCK-FM-SEC-001-PRODUCTION-VERIFY-20260826` RELEASED after exact-head acceptance and merge. Acquire a separate exact authorization and new lock before any Production DB/Auth change.
- Dependencies: FM-DEP-010; exact deployed Production commit; controlled trigger-hardening checksum/runner; current Production/Staging Supabase projects; provider/Auth access for leaked-password decision.
- Assumptions: Production trigger warnings indicate pre-apply/not-accepted state; Staging authenticated workspace RPC may be intentional but its exception status must be explicitly reviewed.
- Completed so far: provider advisors and direct Production/Staging catalogs reconfirmed no drift; deploy run `32996396550` job `98266724400` proved Production at exact `main` `5cb9c193e262f8939b5fc0c700fce154dde616e6`. Exactly one protected `verify` then ran as `32997946812` job `98271985321`: preflight audit passed, the installed read-only database verifier returned fixed `hardening_not_ready`, and the always-run postflight audit passed on the same release. Fresh Production advisors remained unchanged. Focused Staging provisioning tests passed 24/24 and classify the RPC as constrained intentional exposure pending explicit exception acceptance.
- Still open: separately authorized protected Production Apply and post-advisor proof; explicit Staging RPC exception acceptance; separately authorized leaked-password protection changes on both targets.
- Evidence so far: FM-EV-014, FM-EV-019 and FM-EV-020; run `32997946812`/job `98271985321`; live Supabase advisors/catalog ACLs; controlled SQL/runbook; 24/24 focused Staging tests.
- Exact next step: keep `FM-SEC-OWNER-001`/`002` deferred until explicit owner resume and continue the generated parallel-safe Mobile read-only action. Do not rerun the verify.
- Owner action needed: yes for `FM-SEC-OWNER-001` protected Apply and `FM-SEC-OWNER-002` Auth-setting/exception decisions; neither is standing-authorized.

## Closed work

## FM-MOB-005
- Started: 2026-08-31 Europe/Vienna
- Closed: 2026-09-01 Europe/Vienna
- Status: ACCEPTED
- Risk: R3
- Change request: FM-CR-011.
- Issue: #1049 — CLOSED `completed`.
- Branch/PR: `feat/mobile-message-push-data-boundary-20260831` / #1050; final head `09ec3c8a73d57f7a0f0552e6ba89440b27e89ec7`, squash merge `953fcc56de0d02d5c2c5d41468226ba051624b53`.
- Work lock: `LOCK-FM-MOB-005-MESSAGE-PUSH-DATA-BOUNDARY-20260831` RELEASED through the post-merge closeout.
- Scope/result: accepted only the repository-side Production/Staging/test-data boundary and dormant privacy-minimal Owner-only `message_received` plus at most one `message_reminder` policy, exact-fan authenticated `Nachrichten` navigation and section-correct `seen_at` semantics. All eight exact implementation-head workflows passed, exact-head Codex review completed and zero review threads remained before merge.
- External boundary: real provider delivery, Delivery-Ledger apply, Push Staging mutation/acceptance, Production push, Google Play, a new signed message-push build and real-device message-push acceptance remain open under FM-MOB-001 / external acceptance. The existing Android `1.0.0` AAB remains the Play baseline but predates the new handler.
- Evidence: `project-memory/receipts/FM-MOB-005-20260831.md`; #1050; merge `953fcc56de0d02d5c2c5d41468226ba051624b53`; issue #1049 closeout.
- Exact next step: keep FM-MOB-005 closed; any later ledger/provider/device work requires its own bounded task/lock and must not repeat this implementation.
- Rollback/recovery: if the post-merge closeout has been merged, revert that closeout first, then revert implementation merge `953fcc56de0d02d5c2c5d41468226ba051624b53`; do not leave ACCEPTED/RELEASED records after withdrawing the implementation.

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
