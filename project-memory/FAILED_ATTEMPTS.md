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
