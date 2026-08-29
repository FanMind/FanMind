# FanMind Failed Attempts / Do-Not-Repeat Log

Record failed, unsafe, superseded or misleading approaches here. Do not store secrets.

## FM-FAIL-001
- Date: 2026-08-19
- Status: DONE
- Area: Project execution discipline
- Attempt: Rely on chat/model memory alone to remember small implementation attempts.
- Result: Repeated work and duplicate troubleshooting paths can occur across long-running sessions.
- Cause: Conversational context is not a durable project ledger.
- Decision: Repository project memory is mandatory.
- Do not repeat: Do not begin a technical path solely from remembered conversation state; run the preflight first.

## FM-FAIL-002
- Date: 2026-08-19
- Status: DONE
- Area: Restore drill
- Attempt: Treat the restore effort as if infrastructure must be rebuilt from scratch whenever the current run is blocked.
- Result: Duplicate setup work and loss of the actual blocker.
- Cause: Missing fine-grained operational history.
- Decision: Continue from the first unproven gate after checking current workflows, runner state and ledger.
- Do not repeat: No new restore server/runner-group/TLS baseline unless verified drift or an explicit architectural decision requires it.

## FM-FAIL-003
- Date: 2026-08-19
- Status: DONE
- Area: Supply-chain test maintenance
- Attempt: Use hard-coded total counts of hosted checkout workflows/usages as the primary policy assertion.
- Result: Adding legitimate Project Memory workflows made the operations test fail although all hosted checkouts still used the reviewed immutable SHA.
- Cause: topology count was coupled to a valid evolving workflow set.
- Decision: Count expectations were reconciled for the intentional V5 workflow additions without downgrading SHA policy; future changes must inspect semantic policy rather than treating a changed count alone as a vulnerability.
- Do not repeat: Never downgrade hosted workflows to restore-runner checkout v4 merely to satisfy an old count.

## FM-FAIL-004
- Date: 2026-08-19
- Status: DONE
- Area: GitHub contents API editing
- Attempt: Use an excerpt returned by a partial `fetch_file` response as if `update_file` performed a patch.
- Result: `update_file` replaces the complete file; an excerpt-only update would truncate the file.
- Cause: connector write semantics were not respected for that one step.
- Decision: The full supply-chain test file was restored immediately from `main` and only the intended expectations were changed.
- Do not repeat: For `update_file`, always supply a verified complete file body; if full content cannot be safely obtained, use a proper local patch/branch workflow instead of guessing.

## FM-FAIL-005
- Date: 2026-08-19
- Status: DONE
- Area: Status planning
- Attempt: Treat old issue checkboxes/percentages such as Restore `0/4` or historical P1 Staging prerequisites as the complete current state.
- Result: Would undercount completed preparation and cause duplicate Staging/Restore work while still potentially overstating real Acceptance if interpreted carelessly.
- Cause: old trackers intentionally preserve historical checklist state while later commits/runs advanced prerequisites.
- Decision: Separate implementation/preparation from real acceptance and reconcile against #874, current commits/runs and Deep Audit before work.
- Do not repeat: No execution solely from an old percentage or unchecked issue box.

## FM-FAIL-006
- Date: 2026-08-19
- Status: DONE
- Area: Sales readiness
- Attempt: Interpret Phase 4 completion/prepared sales documents as completed technical sales handoff.
- Result: Conflicts with later binding decision that required Phase-3 and Phase-7 real channel acceptance comes first.
- Cause: roadmap truth changed after earlier sales-readiness language.
- Decision: Phase 4 = production/billing base only; FM-SALES-001 remains blocked until current finishline closes.
- Do not repeat: Do not call FanMind technically handed over/sales-ready merely because Phase 4 or sales docs are complete.

## FM-FAIL-007
- Date: 2026-08-19
- Status: DONE
- Area: Restore authorization truth
- Attempt: Continue relying on pre-transfer text saying the repository is user-owned and needs a future organization transfer.
- Result: Contradicts current GitHub metadata and could waste work on an already-completed ownership transition.
- Cause: canonical restore readers were not yet updated after organization change/setup.
- Decision: Ownership claim is invalidated; exact runner-group Admin policy still requires independent live revalidation before Restore dispatch.
- Do not repeat: Do not redo org transfer and do not infer runner authorization from labels or org ownership alone.

## FM-FAIL-008
- Date: 2026-08-20
- Status: DONE
- Area: V5/R3 acceptance evidence
- Attempt: Treat PR #980 as ready for R3 acceptance while its required exact-head Browser E2E run had been cancelled during Chromium installation and its first V8 branch omitted active-work bookkeeping.
- Result: The mostly-green check set was insufficient for R3 quorum and could have skipped the required independent countercheck/status path.
- Cause: implementation and most CI evidence were present, but one required evidence class and mandatory V5 records were incomplete.
- Decision: reject the cancelled run as evidence, reconcile the V5 registers/generated status, obtain a fresh exact-head complete check set, and only then merge/accept.
- Do not repeat: never convert `cancelled`, `skipped`, stale-head or partial check evidence into `COUNTERCHECKED`/`ACCEPTED` merely because other gates are green.

## FM-FAIL-009
- Date: 2026-08-22
- Status: DONE
- Area: Restore checkout TLS truststore
- Attempt: Neutralize path-valued CA environment variables in self-hosted Restore jobs by exporting them as empty strings.
- Result: Protected read-only run `32568632008` passed its host gate but Git/cURL failed every checkout fetch with an unreadable empty CA-file path; Resource Readiness and Target Compatibility never executed.
- Cause: the empty values were still present and therefore overrode normal system truststore discovery for Git/cURL.
- Decision: pin all CA-path consumers to Ubuntu's fixed root-owned system CA bundle/directory and validate ownership, type, canonical path and non-writability before checkout. Keep `GIT_SSL_NO_VERIFY` entirely unset.
- Do not repeat: never use an empty string as the safe value for `CURL_CA_BUNDLE`, `GIT_SSL_CAINFO`, `GIT_SSL_CAPATH`, `REQUESTS_CA_BUNDLE`, `SSL_CERT_DIR` or `SSL_CERT_FILE` in a Restore workflow.

## FM-FAIL-010
- Date: 2026-08-22
- Status: DONE
- Area: ephemeral one-job JIT controller continuation
- Attempt: require a particular prior Host-1 `_diag/Runner_*.log` file and coordinate Host-2 through a buffered background PowerShell job plus immediate online polling.
- Result: the valid Host-2 continuation stopped before JIT generation on a missing non-contractual diagnostic file; earlier background variants also produced listener-ready timing races and could race remote cleanup.
- Cause: ephemeral runner diagnostic files are not a stable authorization contract, and offline-to-online registration plus SSH output buffering are asynchronous.
- Decision: authorize Host-2 from exact GitHub Host-1 success plus credential/listener/API cleanup, then run the already queued Host-2 job synchronously with streamed console output and require independent GitHub job success, listener exit 0 and runner removal before cleanup acceptance.
- Do not repeat: do not regenerate a JIT after a pre-JIT controller defect; do not gate continuation on one local `_diag` filename; do not poll a fresh JIT as if its initial `offline` state were an error; do not use a background listener when the single queued job can be consumed synchronously.

## FM-FAIL-011
- Date: 2026-08-22
- Status: DONE
- Area: Restore target compatibility contract
- Attempt: Treat the minimal read-only `TARGET_COMPATIBLE` check and reset baseline (`plpgsql`, `pgcrypto`) as sufficient preparation for the selected backup receipt's full database authorization preflight.
- Result: Exactly authorized run `32594374666` reached Host-2 and failed deterministically at `database_authorization_preflight_failed` before the first write because only 2 of 5 required extensions were present.
- Cause: the readiness workflow validates a deliberately smaller host/target baseline, while the database runner validates the selected receipt's exact five-extension descriptor and 97-record fingerprint. The earlier state label did not distinguish these contracts clearly enough.
- Decision: preserve `TARGET_COMPATIBLE` as the highest accepted baseline state but add `RECONCILIATION_REQUIRED`; require a separately authorized extension-baseline transaction and exact full receipt-bound read-only postcheck before any new database dispatch.
- Do not repeat: do not rerun the database workflow unchanged, infer receipt compatibility from the minimal marker, recreate only `uuid-ossp`, or skip the proven 36-`pgcrypto`/10-`uuid-ossp` member-owner correction.

## FM-FAIL-012
- Date: 2026-08-23
- Status: DONE
- Area: isolated extension-baseline controller predicate/ACL verification
- Attempt: early extension-controller candidates used the non-superuser restore login for a superuser-only extension, an invalid `\quit` predicate form, and two inconsistent ACL-fingerprint newline encodings.
- Result: each candidate failed before commit and reported `AUTOMATIC_ROLLBACK=PASS`; the target returned to the exact 42-record baseline. Rollback-only diagnostics later proved the candidate five-extension state and exact 14 ACL rows without committing.
- Cause: execution identity and controller-local predicate/hash implementations differed from the already proven receipt helper semantics.
- Decision: use the authorized bootstrap-superuser boundary only for the bounded extension transaction, compare the exact predicate values directly, and compute the ACL fingerprint with the same canonical LF encoding as the receipt helper.
- Do not repeat: do not weaken the expected receipt, accept semantic ACL rows with a mismatched hash, bypass the canonical hash, rerun an earlier controller SHA or treat automatic rollback as successful provisioning.

## FM-FAIL-013
- Date: 2026-08-26
- Status: RECONCILED_FAIL_CLOSED
- Area: owner-PC SSH reachability to isolated Restore host
- Attempt: run exactly authorized database-Restore controller SHA-256 `45054c41143e33fce4406aea30478e43ed5280a36e1b339d0cc9c38df71ae946` against `138.124.213.66`.
- Result: local GitHub/readiness binding passed, then the first SSH connection timed out on port 22. No remote preflight, JIT generation, protected-environment approval, workflow dispatch, PostgreSQL connection or write occurred.
- Cause: not yet proven. Most likely candidates are owner public-IP drift versus the Exoscale SSH source `/32`, or host/network reachability. Do not assert the cause until the Windows public-IP/TCP-22 evidence and exact security-group state are compared.
- Decision: preserve `TARGET_COMPATIBLE`, set side state `RECONCILIATION_REQUIRED`, require owner-PC reachability evidence, and treat any Exoscale allowlist mutation plus later Restore authorization as separate exact R4 boundaries.
- Do not repeat: no automatic retry and no reuse of controller `45054c41...` or authorization `5385992305`; never broaden SSH to `0.0.0.0/0` or another non-exact CIDR.

## FM-FAIL-014
- Date: 2026-08-26
- Status: RECONCILED_FAIL_CLOSED
- Area: protected Mobile `preview` resource readiness
- Attempt: after reconciling five stale failed runs and publishing PR #1010's evidence lock, dispatch exactly one current `mobile-release-resource-readiness.yml` run on exact `main` `32c08ba6877d6aaaf61110c02464ee95d6bc6301` with `release_environment=preview`.
- Result: run `33000433320`, job `98280538304`, passed checkout, Node setup and dependency install, then failed in the exact EAS project lookup with emitted marker `MOBILE_RELEASE_READINESS_ERROR=eas_project_lookup_failed`. The public-environment step was skipped.
- Cause: the protected `mobile-preview` environment supplied blank `EXPO_TOKEN` and blank expected EAS owner/project, Supabase project refs and API origin. The project-info verifier was never reached, so no external binding was accepted.
- Decision: defer the exact protected environment/account configuration to `FM-MOB-OWNER-001`, preserve `IMPLEMENTED_NOT_VERIFIED`, and continue only parallel-safe work.
- Do not repeat: do not rerun this failed job/run, invent owner/project values, initialize a new EAS project, expose credentials, queue a signed build, submit/update, or mutate Supabase/Auth/Production. After configuration require a new lock and exactly one fresh read-only check.

## FM-FAIL-015
- Date: 2026-08-26
- Status: RECONCILED_READ_ONLY_PROCESS_FAILURE
- Area: Meta Staging rollout-state sequencing
- Attempt: collect a direct transaction-level read-only Meta catalog inventory under the visible #1014 lock before the shared read-only rollout-state workflow had classified the exact Staging schema.
- Result: the query succeeded with `transaction_read_only=on`, selected only catalog metadata and rolled back; the later exact-main continuation workflow returned `STAGING_DATABASE_ROLLOUT_STATE=PASS`. No row/schema write, Apply, acceptance, runtime activation or provider action occurred, but the order violated the mandatory `AGENTS.md` gate.
- Cause: the work-lock scope permitted both evidence types but did not explicitly bind the direct query behind the shared rollout-state decision, so the safe read-only evidence was collected in the wrong sequence.
- Decision: preserve the result only as bounded read-only evidence with this process finding; do not rerun it. No further direct Meta Staging catalog access is allowed under the current lock. Any future Meta Staging database action must first consume a fresh shared rollout-state decision for the same exact commit and target and stop on partial, drifted, stale, mismatched or `block` state.
- Do not repeat: never treat transaction-level read-only mode as a substitute for the required shared rollout-state gate, and never erase an ordering failure merely because a later workflow returns `PASS`.

## FM-FAIL-016
- Date: 2026-08-29
- Status: RECONCILED_REPOSITORY_TRANSFER_FAILURE
- Area: GitHub Git-data branch update for PR #1019
- Attempt: collect every changed local file as one base64-encoded command output and build the follow-up Git tree from that oversized tool response.
- Result: the response was truncated; intermediate commit `b5177d8abe4ec9c7eb33833a880ca884f023cf86` contained two bogus truncation-marker paths, a corrupted `apps/mobile/README.md` blob and only a subset of the intended files. It was not merged.
- Cause: the command output exceeded the bounded tool-response budget, and its truncation warning was incorrectly parsed as file data.
- Decision: create clean blobs in bounded file-size batches, make a fast-forward repair commit, explicitly delete both bogus paths and compare all 20 remote blob SHAs with local `git hash-object` values before trusting the branch.
- Recovery evidence: repair commit `a135c952f157d60de3962f7e012a85e40deae588` restored every intended file, removed both bogus paths and produced `checked=20`, `mismatches=[]`, `junk=[]` against tree `ba48929a2d011cb20c404b4513c15027f0d99d9e`. PR #1019 remained open and unmerged throughout.
- Do not repeat: never parse a truncated multi-file base64 response; bound batches below the response limit and require an exact remote-tree/local-blob countercheck before merge.

## FM-FAIL-017
- Date: 2026-08-29
- Status: RECONCILED_TRANSIENT_DEPENDENCY_DRIFT
- Area: PR #1019 Mobile CI / Expo SDK 57 package contract
- Attempt: trust the previously green local Expo Doctor result and the older committed SDK 57 patch lock as sufficient for the later exact-head GitHub run.
- Result: Mobile CI run `33252615878`, job `99100802515`, passed TypeScript, Store, Android/iOS export, native prebuild and boundary checks but failed Expo Doctor because Expo had published a newer compatible SDK 57 patch matrix after the local check. No application, provider or database mutation occurred.
- Cause: the Expo package compatibility matrix is mutable within SDK 57; the older lock installed `expo@57.0.13` and related earlier patches while the current authoritative Doctor expected `expo@57.0.18` and the corresponding patch set.
- Decision: use one temporary PR-only, contents-read GitHub workflow to install the existing lock, run `npx expo install --fix`, and export only `apps/mobile/package.json` plus `apps/mobile/package-lock.json`. The first temporary run failed before mutation because dependencies were not installed; the corrected run `33252966832` succeeded. Consume its artifact, remove the temporary workflow from the final tree, then require a fresh complete exact-head Mobile CI pass.
- Do not repeat: do not suppress Expo Doctor, hand-edit integrity hashes, or retry the unchanged lock. Do not merge the temporary generation workflow.
