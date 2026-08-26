# Execution Receipts

Append-only audit trail proving the mandatory preflight and independent countercheck were performed.

## Required receipt fields
```text
## RECEIPT-<TASK-ID>-<YYYYMMDD-HHMM>
- Task:
- Started:
- Finished:
- Branch/PR:
- Preflight checked: AGENTS, CURRENT_STATE, TASK_LEDGER, CHANGE_REQUESTS, DECISIONS, FAILED_ATTEMPTS, OPEN_LOOPS, DEPENDENCIES, DO_NOT_ASSUME, STARTED_WORK, WORK_LOCKS, Git/PR/CI/runtime state
- Prior attempts found:
- Dependency result:
- Planned evidence:
- Changes made:
- Checks/tests:
- Final diff counterchecked: yes|no
- Regression/security countercheck:
- Evidence produced:
- Result status:
- Open follow-up:
- Work lock released: yes|no
```

## RECEIPT-FM-MEM-005-20260819-1214
- Task: FM-MEM-005
- Started: 2026-08-19 12:14 Europe/Vienna
- Finished: 2026-08-19 after exact-head green merge
- Branch/PR: `project-memory-v4-started-work` / #975
- Preflight checked: repository metadata, AGENTS, Source of Truth, Project Memory current state/task/start/open/dependency/evidence registers, central #874, open issue set, current main history, restore runbook, Restore #944 evidence, current PR state and prior chat reconciliation.
- Prior attempts found: V1 #972 merged; V2 #973 and V3 #974 superseded into #975; V4 folded into later governance; extensive Restore/Staging/Mobile/AI/Meta work already exists and must not be rebuilt.
- Dependency result: exact-head governance dependencies satisfied; product finishline dependencies remain separately mapped in DEPENDENCIES.md, EXTERNAL_ACCEPTANCE.md and V6 `FINISHLINE_STATE.json`.
- Planned evidence: exhaustive evidence-bound audit plus independent GitHub/issue/source-truth crosscheck, machine finishline state, derived sales readiness, truth-drift scan and exact-head CI.
- Changes made: added deep audit; expanded CURRENT_STATE, TASK_LEDGER, STARTED_WORK, OPEN_LOOPS, DEPENDENCIES, EVIDENCE, ASSUMPTIONS, CONTRADICTIONS, FAILED_ATTEMPTS, WORK_LOCKS and handoff/status; added V6 `FANMIND_FINISHLINE.md`, `FINISHLINE_STATE.json`, `RESTORE_STATE_MACHINE.md`, `EXTERNAL_ACCEPTANCE.md`, sales-readiness and truth-drift scripts; upgraded Protocol/Quality to V6; integrated V6 checks into the existing Project Memory Quality workflow instead of adding a new checkout workflow.
- Checks/tests: exact head `2a62dc8337673be0b33acfd4338d0f452224e779` passed Project Memory Guard, Project Memory Quality V6 (including sales-readiness and truth-drift steps), Project Memory Status, FanMind CI including PG17 authorization roundtrip/Operations/Stripe policies/Production build, Landing Language CI, Supply Chain Security, CodeQL and Browser E2E for both public no-write and synthetic regular-user core flows.
- Final diff counterchecked: yes; the initially added dedicated V6 workflow was removed to preserve the reviewed hosted checkout inventory, and V6 checks were folded into the existing quality workflow.
- Regression/security countercheck: passed; no Production/DB/Restore/Stripe/Provider mutation, no red gate bypass, no new hosted-checkout workflow retained, destructive Remote retention and paid 1-EUR/day test remain outside standing authorization.
- Evidence produced: deep audit, finishline board/state, Restore state machine, external acceptance register, task/open-loop/dependency/evidence/assumption/contradiction records, derived sales-readiness and drift-check controls, exact-head green workflow set.
- Result status: ACCEPTED
- Open follow-up: maintain V6 and continue `FM-RST-001` from `BACKUP_ACCEPTED -> HOST_REVALIDATED`; unrelated finishline gates remain tracked separately.
- Work lock released: yes
- Merge evidence: PR #975 squash-merged to `main` as `b4bef882a55e8c0dd1dd33d0ad1c1664c3078d0d`.

## RECEIPT-FM-MEM-008-20260820
- Task: FM-MEM-008
- Started: 2026-08-19
- Finished: 2026-08-20 after exact-head green countercheck and merge
- Branch/PR: `project-memory-v8-crosschat-impact` / #980
- Preflight checked: current main, Project Memory V6/V7, current active registers, open loops/dependencies, exact PR head, all PR-triggered checks and prior cancelled Browser E2E evidence.
- Prior attempts found: prior head `ba48a7cab55ca45a98b62713bbc07989073589fc` was mostly green but Browser E2E was cancelled, so it was explicitly rejected as insufficient R3 countercheck evidence; initial V8 branch also omitted mandatory V5 active-work bookkeeping.
- Dependency result: V5 bookkeeping repaired; generated `PROJECT_STATUS.md` refreshed; all V8 prerequisites retained without mutating product/runtime/provider state.
- Planned evidence: exact-head governance/CI/security checks plus independent Browser E2E on the same revision.
- Changes made: reconciled TASK_LEDGER, STARTED_WORK, WORK_LOCKS, OPEN_LOOPS, EVIDENCE and generated Project Status while preserving V8 implementation.
- Checks/tests: exact head `704fec4b6264dd5a0dd83cc8e0029352672485d0` passed Project Memory Guard, Project Memory Quality, Project Memory Status, FanMind CI, Landing Language CI, Supply Chain Security, CodeQL and Browser E2E run #915.
- Final diff counterchecked: yes.
- Regression/security countercheck: passed; V8 remained governance-only and did not weaken V6/V7 finishline or protected provider/Production boundaries.
- Evidence produced: exact-head workflow set and merge `22eb6aed5da4fde47860bbe12b118d3780c8a4a0`.
- Result status: ACCEPTED via IMPLEMENTED -> VERIFIED -> COUNTERCHECKED -> ACCEPTED.
- Open follow-up: maintain V8 and downgrade to revalidation if handoff/evidence drifts.
- Work lock released: yes.

## RECEIPT-FM-SEC-001-20260820-DISCOVERY
- Task: FM-SEC-001
- Started: 2026-08-20
- Finished: read-only discovery/reconciliation still active; no protected mutation performed
- Branch/PR: `automation/postmerge-reconcile-20260820`; issue #982
- Preflight checked: current FanMind main, finishline/tasks/open loops/dependencies/evidence/assumptions/contradictions, live Supabase project health/security advisors, controlled Production trigger-hardening SQL/runbook and Staging workspace-provisioning RPC migration.
- Prior attempts found: Production trigger hardening already has a dedicated checksum-pinned transactional control and runbook; it must not be rebuilt or auto-applied. Staging workspace RPC is intentionally granted to authenticated users in code and must not be blindly revoked.
- Dependency result: read-only evidence is sufficient to classify the gap, not to mutate Production/Auth.
- Planned evidence: provider advisor scan independent of repository implementation evidence; later exact catalog/ACL verify and post-action advisor scan if a protected action is approved.
- Changes made: opened issue #982 and reconciled the new R3 security gap into Project Memory registers.
- Checks/tests: live Production and Staging projects are `ACTIVE_HEALTHY`; fresh security advisor scans captured current warnings.
- Final diff counterchecked: yes for reconciliation scope; no runtime/database diff.
- Regression/security countercheck: fail-closed. No DB/Auth/provider mutation, no broad grants/revokes, and no artificial browser RLS policies were introduced.
- Evidence produced: fresh provider target/advisor evidence plus repository hardening crosscheck.
- Result status: RECONCILIATION_REQUIRED.
- Open follow-up: exact read-only Production hardening verify, Staging RPC exception review and leaked-password setting decision; separately authorize any later state-changing action.
- Work lock released: no mutating lock was acquired; acquire one before any Production DB/Auth change.

## RECEIPT-FM-SEC-001-NBA-SYNC-20260820
- Task: FM-SEC-001 / Project Memory NBA orchestration reconciliation
- Started: 2026-08-20 11:43 Europe/Vienna
- Finished: branch implementation and reconciliation completed; acceptance is contingent on final exact-head green checks and merge of PR #986.
- Branch/PR: `project-memory-security-nba-sync-20260820` / #986
- Preflight checked: FanMind Project Memory preflight, current `main` `06234adb0948959a5a21ce627da53567ab0c38d2`, `CURRENT_STATE.md`, `NEXT_BEST_ACTIONS.json`, generated `NEXT_BEST_ACTION.md`, `AUTO_HANDOFF.md`, `FINISHLINE_STATE.json`, `AUTHORIZATIONS.md`, issue #982, central finishline #874, active FM-SEC-001 registers, current PR/CI state and the existing V8 generator/quality controls.
- Prior attempts found: the security discovery had already been reconciled into current state/issue #982, but the NBA catalog remained dated 2026-08-19 and omitted `FM-SEC-001`, causing the generator to select Mobile despite the newer security-first restart truth.
- Dependency result: standing authorization covers Project Memory governance branches/PRs; the correction is read-only governance and requires no Production/Staging/Auth/provider mutation.
- Planned evidence: machine selector output, automatic handoff equality, Project Memory Guard/Quality/Status, broader FanMind CI/Landing/CodeQL/Browser E2E, and final branch diff limited to Project Memory/governance files.
- Changes made: added `NBA-SECURITY-READONLY` priority 15 mapped to `FM-SEC-001`/`meta_security`; regenerated the selected NBA and automatic handoff; added a quality invariant tying `CURRENT_STATE.md` first-safe task to the catalog and generated selection; recorded reconciliation finding `RECON-2026-010`.
- Checks/tests: initial implementation head passed Project Memory Guard, Project Memory Quality (including the new invariant), Project Memory Status and Landing Language CI before this audit receipt was appended; all PR-triggered checks rerun on the final receipt head before merge.
- Final diff counterchecked: yes; scope is Project Memory/governance only and contains no product/runtime/SQL/Auth/provider mutation.
- Regression/security countercheck: fail-closed. Restore remains deferred, Mobile remains parallel-safe after Security, Sales remains blocked, Phase 8 remains not started, and the new action explicitly prohibits Apply/Auth/provider mutations.
- Evidence produced: PR #986, `RECON-2026-010`, generated `NBA-SECURITY-READONLY` handoff and the strengthened quality invariant.
- Result status: COUNTERCHECKED on the governance design; becomes ACCEPTED only after final PR head remains green and #986 merges.
- Open follow-up: after merge, execute the selected `FM-SEC-001` read-only Production hardening verify; do not perform Apply or Auth-setting mutations under this governance repair.
- Work lock released: yes for this repository-governance sync; no Production DB/Auth mutating lock was acquired.

A receipt is required for meaningful code/config/infra/governance work. Never include secrets, credentials, private backup material or protected evidence values here.

## RECEIPT-FM-RST-001-SSH-TIMEOUT-20260826
- Task: FM-RST-001
- Started: 2026-08-26 Europe/Vienna
- Finished: 2026-08-26 after exact-head checks, PR merge and issue evidence comment
- Branch/PR: `restore-ssh-timeout-reconciliation-20260826` / #1005; exact head `9ce6c0746fa61072eb507bce6d511f952a42b8e8`, squash merge `dd9d986c387040b213355e0ba1bf60ce31fa7b32`
- Preflight checked: AGENTS, Source of Truth, Protocol, Current State, Finishline, NBA, Auto Handoff, Owner Inbox, Session Handoff, Started Work, Locks, Open Loops, Task Ledger, Dependencies, Decisions, Failed Attempts, Restore state machine/runbook, drift/freshness selectors, current GitHub repository/issue/open-PR state and exact controller bytes/source order.
- Prior attempts found: run `32594374666` and its runners/authorization are consumed; extension provisioning is complete; controller `45054c41...` is a later one-shot controller whose automatic retry is forbidden.
- Dependency result: first missing evidence is owner-PC public-IP/TCP-22 reachability. No Restore/runtime/provider mutation is allowed by this reconciliation branch.
- Planned evidence: exact owner-supplied timeout output, controller source-order proof, current GitHub absence of a later Restore run, Project Memory validators, diff/secret/scope countercheck and exact-head CI before merge.
- Changes made: reconciled the pre-SSH failure across Current State, Restore state machine, NBA, owner actions, tasks, started work, open loop, failure/evidence/reconciliation/handoff/lock records.
- Checks/tests: local `git diff --check`, drift preflight, evidence freshness, generated next-best-action check, Memory v8 check and Project Memory Quality passed. Exact head `9ce6c0746fa61072eb507bce6d511f952a42b8e8` then passed Project Memory Guard/Quality/Status, Landing, FanMind CI including PostgreSQL 17, both Browser E2E jobs and CodeQL.
- Final diff counterchecked: yes; the exact PR head used unchanged tree `d48a26cb7763e4cb0338e9bcde2f5ed9809e04d6`, and all 18 changed files stayed under `project-memory/`.
- Regression/security countercheck: fail-closed. No JIT, environment approval, workflow dispatch, PostgreSQL connection, database Restore, target reset, Production/Supabase-Staging write or Exoscale mutation occurred or is authorized.
- Evidence produced: FM-EV-018, RECON-2026-013, PR #1005 and issue #944 comment `5428771745`.
- Result status: COUNTERCHECKED_FAIL_CLOSED; highest accepted Restore progression remains `TARGET_COMPATIBLE` and SSH reachability remains owner-blocked.
- Open follow-up: `FM-RST-OWNER-005` owner-PC connectivity evidence; later any exact `/32` provider mutation and `FM-RST-OWNER-006` authorization remain separate.
- Work lock released: yes; `LOCK-FM-RST-001-SSH-TIMEOUT-RECONCILIATION-20260826` was released after #1005 exact-head acceptance, merge and issue closeout.

## RECEIPT-FM-SEC-001-READONLY-REFRESH-20260826
- Task: FM-SEC-001
- Started: 2026-08-26 Europe/Vienna
- Finished: 2026-08-26 after exact-head CI, merge and issue closeout
- Branch/PR: `security-readonly-refresh-after-timeout-20260826` / #1006; exact head `d9408c825aa735c5062a87cfc1b927312d094ad3`, squash merge `78333aae9d075a67a2d550a266d24cb8b9f443a4`
- Preflight checked: current main, Project Memory governance/finishline/NBA/security records, issue #982 baseline, Supabase skill guidance, current Production/Staging projects, existing controlled SQL/runner/tests/runbook and exact relevant migration/function references.
- Prior attempts found: FM-EV-014 already classified the same warning set; the checksum-pinned transactional Production remediation exists and must not be rebuilt or auto-applied; Staging workspace RPC is intentionally authenticated-callable in the migration.
- Dependency result: provider advisor and direct catalog reads are available; protected exact-deployed-commit workflow verify and every mutation remain separate.
- Planned evidence: current advisors, exact function `proconfig`/`prosecdef`/ACL rows, offline hardening-contract check, Project Memory validators and eventual exact-head CI.
- Changes made: refreshed live evidence and active task/lock records only; no SQL/Auth/provider/product change.
- Checks/tests: direct Production/Staging catalog queries succeeded; `node scripts/operations/trigger-function-hardening-production-runner.mjs --check` returned `status=ready`.
- Final diff counterchecked: yes. Drift, freshness, NBA, Memory v8, Project Memory Quality, Project Memory Guard/Status, Landing, FanMind CI, CodeQL and both Browser E2E jobs passed on the exact PR head.
- Regression/security countercheck: fail-closed. No Apply, Auth change, grant, RLS policy or broad INFO-advisor suppression occurred.
- Evidence produced: FM-EV-019, PR #1006 and issue #982 comment `5428919200`.
- Result status: COUNTERCHECKED_READ_ONLY_NOT_REMEDIATED.
- Open follow-up: separately run the protected exact-deployed-commit verify, explicitly review the Staging RPC exception and leaked-password setting, and obtain exact authorization before any Production/Auth mutation.
- Work lock released: yes; `LOCK-FM-SEC-001-READONLY-REFRESH-20260826` was released after #1006 exact-head acceptance, merge and issue #982 closeout.

## RECEIPT-FM-RST-001-SCHEMA-ACL-20260820
- Task: FM-RST-001
- Started: 2026-08-20 16:10 Europe/Vienna
- Finished: repository implementation and branch-level reconciliation completed; exact-head R4 acceptance and protected isolated rerun remain pending.
- Branch/PR: `restore-schema-acl-recovery-20260820` / #987
- Preflight checked: current `main` `12d7ecd4cb0c8b3a1a8104745479d3cf29a1dc2f`, AGENTS, Source of Truth, Project Memory Protocol/Current State/Finishline/NBA/Owner Inbox/Handoff/Started Work/Locks/Open Loops/Task Ledger/Dependencies/Decisions/Failed Attempts, Restore state machine/runbook, current PR/CI and operator evidence from the isolated Restore target.
- Prior attempts found: the real isolated `pg_restore` completed; the unchanged receipt-bound authorization postcheck failed only after restore. Later read-only reconciliation localized the source/target difference to exactly eight missing `USAGE` schema grant tuples across `graphql` and `graphql_public`. Earlier manual diagnostics that hardcoded `127.0.0.1` were not valid evidence for the canonical TLS host and are not used as the root-cause basis. No rerestore or manual grant repair is accepted.
- Dependency result: existing Restore host/PG17/TLS/runner/backup foundation is reused; no second server and no Production/Supabase-Staging target. Any future target write remains inside the protected `restore-drill` database workflow with exact dispatch confirmation, both non-Production/Restore write gates, target acknowledgement, TLS `verify-full` and the existing receipt-bound target preflight.
- Planned evidence: exact eight-tuple classifier, exact schema/owner/non-extension/ACL precondition, bounded grant SQL and inverse rollback, unchanged full authorization fingerprint after apply, focused negative tests, CI ownership of the new test, full exact-head PR CI/security/governance set, then a fresh protected isolated Restore rerun through `DB_POSTCHECKED`.
- Changes made: added `restore-schema-acl-recovery.mjs`; wired it immediately after `pg_restore` and before the unchanged authorization postcheck; added automatic rollback+verification on post-apply mismatch; added focused tests including explicit protected R4 workflow-gate assertions; added the new test to required `test:operations`; recorded root cause and active R4 lock.
- Checks/tests: initial PR head passed Project Memory Guard/Quality/Status, Landing, Browser E2E and CodeQL; FanMind CI had exactly one policy failure because the new test file was not yet included in a required CI root. That ownership gap was corrected in `package.json`; the focused test now also asserts the exact protected Restore confirmation/write/TLS gates. Final exact-head checks are still required before merge.
- Final diff counterchecked: yes for current scope; final exact-head CI countercheck remains pending.
- Regression/security countercheck: fail-closed by design. Recovery is a no-op on a matching contract, rejects any invariant drift or grant delta other than eight, requires exact two schemas owned by `supabase_admin`, rejects extension membership/unexpected ACL entries, applies no broad grants, and has an exact inverse rollback. The final receipt-bound authorization contract remains unchanged as the acceptance oracle.
- Evidence produced: PR #987, focused recovery tests, protected-gate policy test, current GitHub CI history and the isolated operator/source reconciliation record.
- Result status: IMPLEMENTED.
- Open follow-up: wait for the final exact PR head to pass all required checks; then merge. Only after merge may the protected isolated database Restore be freshly rerun. Do not mark `DB_POSTCHECKED`, `COUNTERCHECKED` or `ACCEPTED` until that external R4 evidence exists.
- Work lock released: no; keep `LOCK-FM-RST-001-SCHEMA-ACL-RECOVERY-20260820` active until merge/countercheck reconciliation.

## RECEIPT-FM-MOB-001-EAS-PROJECT-BINDING-20260821
- Task: FM-MOB-001
- Started: 2026-08-21
- Finished: 2026-08-21 after exact-head R3 countercheck and merge
- Branch/PR: `mobile-eas-project-binding-hardening-20260821` / #988
- Preflight checked: current `main` `6b0baa53a8cb408f5d8d8d36923237676b6d5931`, AGENTS, Source of Truth, Project Memory Protocol/Current State/Finishline/NBA/Owner Inbox/Handoff/Started Work/Locks/Open Loops/Task Ledger/Dependencies/Decisions/Failed Attempts, External Acceptance, issues #584/#690/#874, exact Mobile workflows/scripts/tests, current PR/CI state and the pinned Expo EAS CLI `project:info` source contract.
- Prior attempts found: native Mobile implementation, CI, app configuration, read-only release readiness and signed-build controls already exist and must not be rebuilt. The uncovered gap was narrower: both workflows treated any successful `eas project:info` exit as a valid link while discarding the remote `fullName` and `ID`, so the protected expected owner/project values were not checked against the EAS project record returned by the pinned CLI.
- Dependency result: repository code/tests/PR work is standing-authorized. EAS account/environment evidence, Supabase Auth redirect, signing credentials, signed builds, TestFlight/stores and real devices remain external R3 controls and are not accepted by this PR.
- Planned evidence: bounded parser with exact owner/slug/project-ID match, fixed redacted output, regular-file/no-follow/size controls, positive and negative parser tests, workflow-wiring tests, exact-head Project Memory/FanMind CI/Supply Chain/CodeQL/Browser checks and an independent final-diff/proof-of-absence countercheck.
- Changes made: added `mobile-eas-project-info-verify.mjs`; parse only the bounded `fullName` and `ID` fields after ANSI normalization; require exact protected owner, fixed `fanmind-mobile` slug and UUID project ID; reject generic owner placeholders, mismatch, ambiguity, malformed output, symlinks/non-regular files and oversized reports; wire the verifier immediately after `project:info` in both read-only readiness and signed-build workflows; add CI self-tests for parser, file boundary and exact workflow ordering; update active work and lock records.
- Checks/tests: exact head `6f42a5897aabb3387a74149010dee2b5fb2c92cd` passed Project Memory Guard, Project Memory Quality, Project Memory Status, FanMind CI including the new verifier self-test, Operations/Stripe policies/Production build and PostgreSQL-17 roundtrip, Landing Language CI, Supply Chain Security, CodeQL and Browser E2E for both public no-write and synthetic regular-user flows.
- Final diff counterchecked: yes; the exact final delta was limited to the verifier, two existing Mobile workflows, one CI self-test/enforcement path and required Project Memory records.
- Regression/security countercheck: fail-closed. Build, Submit and Update gates remain unchanged; the read-only workflow contains no build/submit/update/init path; project-info reports remain private temporary files with `umask 077`, are never echoed, are opened no-follow and are deleted; fixed output exposes no owner, project ID, token, URL or artifact identifier. No EAS build, credentials, Supabase/Auth/DB, Apple or Google mutation occurred.
- Evidence produced: PR #988, exact-head workflow set, local and CI parser/file/workflow self-tests, independent countercheck comment and merge `e20efd475e475101226f266118b9cfed7972243a`.
- Result status: COUNTERCHECKED for the repository control; overall `FM-MOB-001` remains `IMPLEMENTED_NOT_VERIFIED` until the external EAS/signing/device/store gates pass.
- Open follow-up: run the existing protected read-only EAS resource-readiness workflow against the exact merged commit; only after accepted external evidence may a separately authorized signed internal build be considered.
- Work lock released: yes; `LOCK-FM-MOB-001-EAS-PROJECT-BINDING-20260821` was released after merge reconciliation.

## RECEIPT-FM-RST-001-CHECKOUT-CA-20260822
- Task: FM-RST-001
- Started: 2026-08-22 15:52 Europe/Vienna
- Finished: PR #991 passed exact-head acceptance and merged as `b75f68ecc7999a9b492051aecc2421b9b597dd18`; protected runtime closure was later counterchecked by run `32582640853` and evidence PR #992.
- Branch/PR: `restore-checkout-ca-truststore-20260822` / #991
- Preflight checked: current `main` `1735a5f552c0c20c180fb96be6fa9000cbffc360`, mandatory Project Memory/Restore readers, drift and evidence-freshness preflights, issue #944, PRs #987/#990, workflow run `32568632008`, jobs `97020817035`/`97020825268`/`97020836458`, protected job steps/logs, runner ID `40` state and operator cleanup output.
- Prior attempts found: PR #990 correctly removed `GIT_SSL_NO_VERIFY` and its fresh protected host gate passed. The later checkout still failed because six path-valued CA variables remained exported as empty strings. No Resource Readiness, Target Compatibility, decryption, DB connection or write ran.
- Dependency result: repository code/tests/PR work is standing-authorized. Existing isolated host, empty target, retained rollback quarantine, backup and protected environment are reused without mutation. No workflow dispatch or JIT creation is part of this repair.
- Planned evidence: exact live-log root cause; independent Git 2.43 negative/positive reproduction; fixed root-owned Ubuntu truststore binding; pre-checkout file/directory owner/mode/type/canonical-path checks; exact workflow-count regression tests; drift baseline; full exact-head PR CI/security/governance set; independent final-diff countercheck.
- Changes made: pinned `CURL_CA_BUNDLE`, `GIT_SSL_CAINFO`, `GIT_SSL_CAPATH`, `REQUESTS_CA_BUNDLE`, `SSL_CERT_DIR` and `SSL_CERT_FILE` in all five self-hosted Restore jobs; added truststore integrity assertions before the preinstalled gate/checkout; preserved unset `GIT_SSL_NO_VERIFY`; added regression and Project Memory reconciliation records.
- Checks/tests: focused Restore-host tests pass 19/19; the combined Restore/supply-chain policy set passes 89/89; all three edited workflows parse as YAML; Project Memory quality/sales/truth/NBA/freshness/drift/milestone/V8 and generated-status checks pass with the final workflow blob baseline. A broad `test:operations` attempt passed 1012 tests and stopped on seven unrelated missing-package errors in the incomplete local `node_modules` (`typescript`, `pdfnative`, `brace-expansion`, `sharp`, `next`); clean-install exact-head CI remains the acceptance source for that full set.
- Final diff counterchecked: yes; the bounded truststore repair passed the full exact-head PR #991 gate set before merge, and the later protected checkout independently proved active certificate verification.
- Regression/security countercheck: initial negative/positive reproduction passed; empty Git CA paths fail with the same CA error as the protected run, while the pinned system truststore succeeds. All Restore write gates/commands and the preinstalled gate digest remain unchanged.
- Evidence produced: issue #944 comment `5380738369`, the 2026-08-22 CA-truststore checkpoint, focused test output and local Git transport reproduction.
- Result status: COUNTERCHECKED for the checkout repair; overall `FM-RST-001` remains PARTIAL.
- Open follow-up: fulfilled for read-only readiness by run `32582640853`; the next database transition remains separately exact-R4-authorized and owner-deferred.
- Work lock released: yes; `LOCK-FM-RST-001-CHECKOUT-CA-TRUSTSTORE-20260822` was released after evidence PR #992 merged.

## RECEIPT-FM-RST-001-READINESS-20260822-1641
- Task: FM-RST-001
- Started: 2026-08-22 protected read-only authorization and preflight
- Finished: 2026-08-22 16:41 UTC runtime; evidence PR #992 exact head `53308fa43b258e4570b67d675f38f16e15e3bb69` merged as `cb04829c378285c24c3c53b5fab2d03177c19165`
- Branch/PR: runtime used exact `main` `b75f68ecc7999a9b492051aecc2421b9b597dd18`; evidence branch `restore-readiness-evidence-20260822` / #992
- Preflight checked: mandatory Project Memory/Restore readers, exact GitHub `main`, issue #944, PR #991 checks/merge, active Restore workflows, organization runner group/repository/workflow scope, host-1/host-2 runner directories, no active listener, exact JIT boundaries and write-disabled workflow contract.
- Prior attempts found: run `32568632008`/runner ID `40` failed checkout on empty CA paths; several local controller attempts failed before Host-2 JIT creation because of path, DNS, PowerShell privilege, background-listener timing and an invalid dependency on a local Host-1 `_diag` file. None authorized a database write.
- Dependency result: PR #991 repair present on exact main; runner/host/backup/target/TLS read-only dependencies current for run `32582640853`; database-write authorization explicitly absent.
- Planned evidence: exactly one new Resource Readiness run, exactly two fresh sequential one-job JITs, independent GitHub run/job logs, positive checkout certificate verification, resource checksum-only PASS, target compatibility `verify-full` PASS and full runner teardown.
- Changes made: dispatched only authorized read-only run `32582640853`; used Host-1 runner ID `41` and Host-2 runner ID `42`; no database workflow or write gate was enabled. The local controller was corrected before Host-2 JIT generation to remove a non-contractual diagnostic-log dependency and background-listener races.
- Checks/tests: run and all three jobs completed `success`; Host-2 steps 1-5/10-11 succeeded; checkout found the fixed truststore certificates, negotiated TLS 1.3 and reported server-certificate verification OK; `RESTORE_DRILL_RESOURCE_READINESS=PASS`; `RESTORE_TARGET_COMPATIBILITY=PASS`; no dangerous certificate-verification-skip or CA-file error. Local Project Memory/Truth/Freshness/Milestone checks passed, and 83/83 focused Restore regression tests passed.
- Final diff counterchecked: yes; exact head `53308fa43b258e4570b67d675f38f16e15e3bb69` passed Project Memory Guard/Quality/Status, Landing Language CI, FanMind CI including PG17, CodeQL and both Browser E2E jobs before merge.
- Regression/security countercheck: write flags remained false/empty; checksum-only phase made no DB connection or decryption; compatibility used a read-only catalog session with TLS `verify-full`; no secret was emitted; controller proved `.credentials`/`.runner` removal, listener exit 0 and runner ID `42` API removal.
- Evidence produced: run `32582640853`, jobs `97054217701`/`97054234003`/`97054248185`, FM-EV-015 and issue #944 read-only checkpoint comment `5381530143`.
- Result status: COUNTERCHECKED_READ_ONLY; Restore state `TARGET_COMPATIBLE`; overall task PARTIAL.
- Open follow-up: database Restore and all later state-machine steps require a new exact protected R4 authorization. Revalidate mutable evidence immediately before any such dispatch.
- Work lock released: yes; `LOCK-FM-RST-001-CHECKOUT-CA-TRUSTSTORE-20260822` was released after #992 exact-head acceptance and merge.

## RECEIPT-FM-RST-001-FAILCLOSED-20260822
- Task: FM-RST-001
- Started: 2026-08-22 with the owner's exact one-run R4 database-Restore authorization.
- Finished: 2026-08-22 after runtime failure, independent read-only reconciliation, exact-head PR checks/countercheck and merge.
- Branch/PR: `restore-failclosed-reconciliation-20260822` / #995 exact head `ce2b63c606ca1a9aa701d24a569e21d66cfe13ea`, squash merge `86bf2657996c45bfe03fadd4af689ffa89e7ea6e`; runtime used exact `main` `8bc8855a6de928cf38ef2e8fb9e9e0860fc477db`.
- Preflight checked: accepted run `32582640853`, runtime drift from `b75f68ecc7999a9b492051aecc2421b9b597dd18` to authorized main, mutable GitHub/runner/host/target/backup/TLS evidence, exact backup/verification/source binding, runner-group workflow scope, target reset receipt and two fresh sequential one-job JIT boundaries.
- Prior attempts found: the earlier controller call-depth defect was corrected before dispatch. The successful minimal readiness contract did not prove the selected receipt's full five-extension authorization contract. Prior trusted `uuid-ossp` recreation alone produced the wrong internal-member ownership/fingerprint and must not be repeated.
- Dependency result: run `32594374666` deterministically localized the first unproven dependency to the three missing extensions and stopped before write; no infrastructure rebuild is needed.
- Planned evidence: exact GitHub jobs/steps/logs, positive TLS marker, pre-write ordering, JIT teardown, local read-only target/host reconciliation, issue #944 record and Project Memory exact-head CI.
- Changes made: consumed exactly one authorized database dispatch and two fresh JITs; made no target change. Added issue comments and repository-only reconciliation records; changed the next protected action from database Restore to extension-baseline provisioning.
- Checks/tests: gate and Host-1 jobs succeeded; Host-2 checkout/resource/baseline checks succeeded; full authorization emitted `AUTHORIZATION=ERROR` and `database_authorization_preflight_failed`; cleanup succeeded. Follow-up controller returned `READ_ONLY_RECONCILIATION=PASS` with empty target and no private residue.
- Final diff counterchecked: yes. All 21 changed files were under `project-memory/`, no secret signature was found, and the exact head passed Guard, Status, Quality, Landing, FanMind CI including PG17, Browser E2E and CodeQL before merge.
- Regression/security countercheck: fail-closed. Any applied target object, plaintext residue, runner credential/JIT residue, TLS verification skip, Production write or Supabase-Staging write would invalidate the result; none was found.
- Evidence produced: run `32594374666`, jobs `97082934347`/`97082943319`/`97082992861`, issue #944 comments `5382274967`/`5382336892`, FM-EV-016 and this reconciliation branch.
- Result status: RECONCILIATION_REQUIRED; highest accepted Restore progression remains `TARGET_COMPATIBLE`.
- Open follow-up: `FM-RST-OWNER-003` exact extension-baseline authorization. No database retry until the exact 97-record fingerprint and unchanged full receipt authorization pass.
- Work lock released: yes; `LOCK-FM-RST-001-FAILCLOSED-RECONCILIATION-20260822` was released after #995 exact-head acceptance and merge.

## RECEIPT-FM-RST-001-EXTENSION-BASELINE-20260823
- Task: FM-RST-001
- Started: 2026-08-23 after the separately authorized final extension-only controller completed.
- Finished: 2026-08-23 after runtime success, exact-head repository countercheck and merge.
- Branch/PR: runtime used exact `main` `c627fc2d8956768091c88e3a3baaf0b882b8d2d6`; evidence branch `restore-extension-baseline-evidence-20260823` / #997 exact head `6642c3c95bbb33f9a4b5f5a36afa068798e252e8`, squash merge `733e2f12464f746ee5dff0be71defe22d18ce33a`.
- Preflight checked: AGENTS, Source of Truth, Project Memory execution/current/finishline/state/NBA/deferred/handoff/active/locks/loops/task/dependency/decision/failed-attempt/evidence registers, drift and freshness checks, exact main, issue #944 and the final controller output.
- Prior attempts found: earlier controller candidates failed closed and automatically rolled back on direct recursion, SSH reachability, superuser-only extension creation, malformed predicate and ACL hash-canonicalization mismatches. Separate rollback-only diagnostics proved the candidate contract and exact ACL rows.
- Dependency result: the exact isolated host/target and accepted Backup/Verification/Source/reset-receipt tuple were reused. The final controller began from the proven 42-record baseline and no active Restore workflow/JIT dispatch existed.
- Planned evidence: exact controller preflight, precommit/full receipt predicates, commit marker, canonical ACL and extension fingerprints, independent postcommit read-only postcheck, explicit proof of forbidden non-actions, issue #944 record and exact-head Project Memory/CI countercheck.
- Changes made: the authorized runtime transaction committed only the three missing extensions plus proven member-owner correction. This branch records the result and replaces the stale extension owner action with a new, separate database-Restore authorization boundary.
- Checks/tests: runtime returned `PRECOMMIT_RECEIPT_BOUND_CONTRACT=PASS`, `MUTATION_COMMIT=PASS`, `EXTENSION_BASELINE_PROVISIONING=PASS`, `FULL_RECEIPT_BOUND_CONTRACT=PASS`, `SCHEMA_ACL_CANONICAL_POSTCHECK=PASS`, `POSTCOMMIT_READ_ONLY_POSTCHECK=PASS` and `LOCAL_EXTENSION_BASELINE_CONTROLLER=PASS`. Exact PR head passed Project Memory Guard/Status/Quality, Landing, FanMind CI, Browser E2E and CodeQL.
- Final diff counterchecked: yes; all 23 evidence-PR files were under `project-memory/` and #997 merged only after the exact head was fully green.
- Regression/security countercheck: runtime reported no database Restore, target reset, JIT/workflow dispatch, Production write or Supabase-Staging write. Extension fingerprint is exact at 97 records and ACL fingerprint matches the canonical receipt helper.
- Evidence produced: FM-EV-017 and issue #944 comment `5385843508`.
- Result status: COUNTERCHECKED_EXTENSION_BASELINE at runtime; overall Restore remains PARTIAL at `TARGET_COMPATIBLE` pending later database/Storage/config/cleanup/countercheck.
- Open follow-up: `FM-RST-OWNER-004`, a new exact R4 database-Restore authorization with fresh mutable-evidence preflight.
- Work lock released: yes; `LOCK-FM-RST-001-EXTENSION-BASELINE-EVIDENCE-20260823` was released after #997 exact-head acceptance and merge.

## RECEIPT-FM-SEC-001-PRODUCTION-VERIFY-20260826-2002
- Task: FM-SEC-001
- Started: 2026-08-26 20:02 Europe/Vienna
- Finished: runtime evidence complete; pending final exact-head PR countercheck and merge
- Branch/PR: `security-production-readonly-verify-20260826` / #1008; initial exact head `cf24e854c8abab35cb1bde2c801c98b76a0fc9f3`, final evidence head pending
- Preflight checked: AGENTS, Source of Truth, Project Memory Protocol/Execution Policy/Current State/Finishline/NBA/Deferred Owner Actions/Handoff/Started Work/Locks/Open Loops/Task Ledger/Dependencies/Decisions/Authorizations/External Acceptance/Failed Attempts/Assumptions/Contradictions/Change Requests, current repository/PR state, issue #982, exact Production deploy evidence, controlled hardening workflow/runner/log verifier/tests/runbook, current Supabase guidance and provider evidence.
- Prior attempts found: the provider/catalog refresh was accepted in #1006 and its lock closed in #1007. The checksum-pinned control already exists and must not be rebuilt. The three Production trigger helpers remain expected pre-apply, while `trim_conversation_messages_to_latest_50` and leaked-password protection remain separate findings; no prior protected Production hardening verify has been accepted.
- Dependency result: exact GitHub `main` and Production release are both `5cb9c193e262f8939b5fc0c700fce154dde616e6` via deploy run `32996396550` job `98266724400`; the protected workflow and root-owned installed verifier are available. Restore remains independently owner-deferred and untouched.
- Planned evidence: local checksum/source-policy tests; visible active repository lock; exactly one workflow-dispatch `verify` on exact deployed main; full preflight, fixed `hardening_not_ready` or reconciled success diagnostic, always-run postflight audit, exact run/job/step logs, issue #982 record and exact-head CI/countercheck.
- Changes made: opened the scoped lock/receipt and PR #1008; dispatched exactly one `verify` on exact deployed main; recorded the protected preflight/action/postflight and fresh advisor evidence; classified the Staging RPC and leaked-password findings; deferred all mutations to explicit owner actions. No runtime/provider/database/Auth mutation.
- Checks/tests: Production runner offline source/checksum contract returned `status=ready`; focused Production hardening tests passed 5/5; focused Staging provisioning tests passed 24/24; workflow preflight/postflight audits passed on exact `5cb9c193e262f8939b5fc0c700fce154dde616e6`; fixed database diagnostic was `hardening_not_ready`; fresh Production advisors remained unchanged; local Project Memory drift/freshness/NBA/V8/quality/truth/milestone checks and `git diff --check` passed; exact-head PR checks remain pending.
- Final diff counterchecked: yes for runtime inputs/logs, the read-only boundary and current documentation scope; final exact-head PR checks remain pending.
- Regression/security countercheck: fail-closed boundary established. The workflow input must be `verify` with `trigger-function-hardening-production-verify`; `apply`, SQL/Auth/RLS/ACL/provider mutations, Restore/JIT/controller retry and Production/Supabase-Staging writes are forbidden.
- Evidence produced: FM-EV-020; run `32997946812`, job `98271985321`; exact deploy binding; full pre/post Production audit logs; fixed `hardening_not_ready` diagnostic; fresh post-run Production advisors; 24/24 Staging classification tests.
- Result status: COUNTERCHECKED_READ_ONLY_PRESTATE_CONFIRMED; overall FM-SEC-001 remains open and unremediated.
- Open follow-up: publish/countercheck/merge #1008 and release this evidence lock. Any later `apply`, Auth provider change or Staging exception acceptance is separate under `FM-SEC-OWNER-001`/`002`; do not dispatch verify again.
- Work lock released: no; `LOCK-FM-SEC-001-PRODUCTION-VERIFY-20260826` is active.
