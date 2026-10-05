# Project Memory Protocol v7

This directory is the operational memory for FanMind. It complements code, tests, Git history and canonical product documentation; it does not replace them.

## Mandatory execution policy
`EXECUTION_POLICY.md`, `COUNTERCHECK_POLICY.md`, `QUALITY_CONTROL.md`, `FANMIND_FINISHLINE.md`, `FINISHLINE_STATE.json`, `NEXT_BEST_ACTIONS.json`, `NEXT_BEST_ACTION.md`, `DEFERRED_OWNER_ACTIONS.md`, `RESTORE_STATE_MACHINE.md`, `EXTERNAL_ACCEPTANCE.md`, `LEGACY_ISSUE_RECONCILIATION.json`, `BRANCH_PROTECTION_CONTRACT.json`, `EVIDENCE_TTL_POLICY.json`, `EVIDENCE_FRESHNESS.json`, `DRIFT_BASELINE.json` and `MILESTONE_POLICY.json` are mandatory operational readers where relevant.

## Adaptive preflight
`EXECUTION_POLICY.md` defines the required preflight by risk.

- R1 reads only the current scope/head and directly relevant source needed to make the bounded change safely.
- R2 reads current main plus relevant decisions, dependencies and project-state sources for the affected area.
- R3/R4 retain the full project-state, failed-attempt, evidence, target, authorization and external-acceptance preflight appropriate to the protected boundary.
- Restore/provider/Mobile/Billing/legal/protected Production work keeps its domain-specific mandatory readers and target checks.
- Historical legacy-issue reconciliation remains required when work derives from #642/#643/#644.
- Always assign Risk R1-R4 before implementation; if scope expands, escalate rather than continuing under an undersized path.

Do not require the complete legacy preflight merely because a task is substantive if the task is an R1/R2 repository-only change with no protected boundary.

## Owner-declared merge evidence
- If Bernd explicitly states that he personally merged a specific FanMind pull request, that statement is authoritative Owner evidence for the actor, intent and deliberate acceptance of that manual merge.
- When GitHub independently confirms the PR is merged, record the state as `OWNER_ACCEPTED_MERGE` with the exact PR/head/merge SHA when available.
- A supervisor/builder must not later classify that same owner-accepted merge as a Builder merge violation, missing merge authorization, or repeatedly reopen a missing pre-merge independent-review requirement solely because the Owner consciously overrode/accepted the merge boundary.
- Owner merge evidence closes the provenance/merge-acceptance question for that exact merged source/governance scope. It does not fabricate facts the Owner did not attest: runtime health, Staging/Production/provider state, schema application, payment, external acceptance, or protected action execution still require their own evidence.
- If GitHub cannot currently be read, record the Owner statement as `OWNER_ATTESTED_MERGE`; reconcile exact GitHub metadata later without treating the Owner statement as absent evidence.
- If the Owner explicitly says a merge was accidental, provisional, or should not count as acceptance, that later statement supersedes this default.

## V7 hardening contract

### Branch protection
- `BRANCH_PROTECTION_CONTRACT.json` defines the required remote `main` protection/ruleset contract.
- Remote protection is currently owner-deferred because the connected GitHub app cannot configure rulesets/branch protection.
- Until remote enforcement exists, agents must still use branch + PR and may not treat the unprotected branch as permission for direct `main` writes.

### Evidence freshness / no stale success
- `EVIDENCE_TTL_POLICY.json` defines TTLs only for mutable evidence classes.
- Immutable commit/build evidence does not expire merely with time; it is invalidated only by an explicit trigger.
- `EVIDENCE_FRESHNESS.json` records tracked mutable/immutable evidence.
- Expired mutable evidence cannot support a new `ACCEPTED` or `PRODUCTION_CONFIRMED` claim until revalidated.

### Accepted-state drift preflight
- `DRIFT_BASELINE.json` binds critical accepted truth/workflow files to Git blob fingerprints.
- `scripts/fanmind_drift_preflight.py` fails closed on an un-reconciled fingerprint change.
- A watched-file change is not automatically wrong; it requires `DRIFT_REVIEW_REQUIRED` and the baseline may be updated only in the same reviewed change that reconciles the affected gate.

### Milestone snapshots
- `MILESTONE_POLICY.json` defines milestone snapshot requirements.
- Accepted milestone snapshots live under `project-memory/milestones/` and are append-only/immutable historical evidence.
- Existing snapshots are never overwritten; later invalidation or supersession is recorded separately.

## Finishline / next-best-action contract
- `FINISHLINE_STATE.json` is the machine-readable current finishline state.
- `FANMIND_FINISHLINE.md` is the human-readable board and must agree with that state.
- `NEXT_BEST_ACTIONS.json` is the prioritized execution catalog.
- `DEFERRED_OWNER_ACTIONS.md` records owner-only/external steps deliberately postponed for later.
- `scripts/fanmind_next_best_action.py` derives the next safe action. An earlier deferred/owner-required action stays open; only later `parallel_safe=true` actions may execute around it.
- `scripts/fanmind_sales_readiness.py` derives `SALES_READY`.
- `scripts/fanmind_truth_drift_check.py` validates canonical roadmap/source-truth invariants.
- `.github/workflows/project-memory-quality.yml` runs these controls plus evidence freshness, accepted-state drift and milestone validation on PR/manual/daily execution.
- Only the disabled Website-AI foundation in Phase 8 may be `started`; all other Phase-8 work remains deferred and the bounded foundation is outside the current finishline.

## Next-best-action rule
Owner decision FM-DEC-015 supersedes the prior development sequence: Creator
Intelligence and selected Social/AI-handoff engineering may proceed now, before
Android completion. Each Creator has an independent account/Workspace. This
changes development priority only, not sales acceptance or provider/legal gates.
Further unrelated Phase 8 work and Team/roles/multi-workspace features remain later.

1. Preserve finishline priority; never mark a deferred owner step complete just because work proceeds elsewhere.
2. If the earliest unresolved action is `DEFERRED_BY_OWNER` or otherwise owner/platform-only, later work is eligible only when explicitly `parallel_safe=true` and all listed prerequisite gates are accepted.
3. Selected Social engineering may proceed under FM-DEC-015; real provider activation and Sales Handoff retain their explicit acceptance prerequisites.
4. Never auto-select payment, destructive retention, protected Production mutation, legal acceptance, credentials/signing or provider activation merely because it is next in sequence.
5. When the owner explicitly resumes a deferred action, remove/update its deferred status; the selector must restore its original finishline priority.
6. If nothing safe is executable after reconciling the complete active product roadmap, surface the earliest unresolved owner action instead of inventing work.
7. The canonical product roadmap in `src/config/roadmap.ts` is an input to Orchestrator planning, not merely a UI display. When the current finishline action is owner/platform-blocked, the Orchestrator must inspect unfinished product-roadmap items in already-active phases and continue with an independent repository-safe item when it can be mapped into the existing action catalog with explicit scope, prerequisites and `parallel_safe=true`. It must not create a second queue or bypass the existing selector.
8. A blocked roadmap item does not stop unrelated safe roadmap progress. Firmendaten, credentials, provider/legal approval, Production/Billing/Restore/destructive actions and other protected boundaries remain blocked until their existing authorization is satisfied; the Orchestrator skips around them only for non-overlapping safe work.
9. After every accepted/closed task, the Orchestrator immediately recomputes finishline state, active product-roadmap gaps and the SAFE READY SET and selects the next eligible bounded task. Waiting for a fresh Owner "weiter"/"go" is not a valid idle state when such work exists.
10. `SAFE READY SET: NONE` is valid only after the selector has reconciled unfinished items from the active product-roadmap phases against the existing action catalog, active locks, dependencies and protected boundaries. An unmapped unfinished roadmap item must be surfaced as a planning gap for bounded catalog reconciliation rather than being silently treated as no work.
11. Roadmap reconciliation parses only the canonical exported `roadmapPhases` literal without executing TypeScript. Catalog `roadmap_items` references identify existing actions; they do not create actions, reservations, authorization or transport permission. A mapping inherits every existing action gate, dependency, active-lock, failed-attempt, semantic-replay, scope-overlap and protected-action restriction.
12. An active unfinished item with no exact catalog mapping remains a visible planning/catalog gap. It cannot enter `SAFE READY SET`, become a task ID or authorize dispatch until a separately reviewed bounded catalog action supplies the normal scope and safety contract.

## Started-work and lock rule
Use started-work/locks according to Execution Policy v6.

- R1: no STARTED_WORK, WORK_LOCK or receipt by default.
- R2: use them only when coordination, concurrency, durable project state or a meaningful handoff requires it.
- R3/R4: explicit started-work, lock and receipt handling remains mandatory.
- Any task that escalates into a protected boundary adopts the higher-risk coordination requirements before crossing that boundary.

A stale lock is not free. Reconcile it against PRs, commits, receipts and started-work state before reuse.

## Finishline freeze / anti-overengineering rule
Once a task has an explicit acceptance contract and its agreed bounded implementation scope is implemented (including the user-visible core flow when the task is user-facing), enter **FINISHLINE_FREEZE**.

While frozen:
1. Only defects that actually break an agreed acceptance criterion, a registered security/authority invariant, a required integration contract, or a current target/runtime acceptance may block completion.
2. New theoretical edge cases, additional hardening layers, broader refactors, extra governance, new test dimensions, architectural cleanup and "while we are here" improvements go to backlog unless current evidence proves they are required by rule 1.
3. A reviewer finding may block only when it is P0/P1, or a P2 that demonstrates a concrete violation of the agreed acceptance contract or a registered invariant. **When God Mode applies, its existing unconditional P0/P1/P2 release blocker remains authoritative.** Findings that are non-blocking under the applicable release policy are documented for later and do not start another corrective PR chain.
4. Do not create a new PR solely to add more controls after the current acceptance contract is satisfied. Re-open implementation only from fresh evidence that shows an actual failure **or** invalidates required acceptance evidence because it is missing, stale, contradictory or `RECONCILIATION_REQUIRED`.
5. For MVP/product increments, the default closure path is: implement -> required checks -> one independent review/countercheck -> Staging/runtime owner-visible test where applicable -> close.
6. Owner-visible usability is part of the finishline when the task is a user-facing feature. If the owner cannot reach or exercise the agreed flow, the feature is not complete.
7. FINISHLINE_FREEZE never overrides an existing protected-action confirmation, Production/Billing/Restore/destructive boundary, tenant isolation, no-browser-service-role rule, no-auto-send rule, or any other registered invariant.

The purpose of FINISHLINE_FREEZE is to prevent accepted scope from expanding through speculative controls while preserving all already-defined safety boundaries.

**Default MVP closure path:** **Build -> one clean verification (including the already-required countercheck/negative proof) -> try it on Staging where applicable -> Owner sees/tests it when user-facing -> done.**

**Do not return to:** build -> verify -> invent another control -> harden again -> add another review/control layer -> repeat without a concrete failing acceptance criterion or invalidated required evidence.

## Mandatory countercheck
Before completion, merge or a success report:
1. Re-read the goal and acceptance criteria.
2. Inspect the final diff and compare actual vs expected scope.
3. Verify evidence freshness against the current commit/PR/build/runtime/device/provider/target.
4. Run accepted-state drift preflight for affected watched files.
5. Use countercheck evidence independent from the implementation self-report.
6. Verify the relevant negative, regression, proof-of-absence or fail-closed path.
7. For R3/R4 work, require at least two evidence classes; state-changing work also requires rollback/recovery proof.
8. Ask: **What observation would prove this conclusion wrong?** Check it where feasible.
9. Reconcile tasks, started work, locks, loops, dependencies, evidence, assumptions, contradictions, external acceptance, finishline, next-best-action, deferred owner actions and CI/runtime state.
10. Any unresolved mismatch becomes `RECONCILIATION_REQUIRED` and prevents a clean completion claim.
11. Write/update the execution receipt and release/refresh the work lock.

## Completion state machine
`TODO -> IN_PROGRESS -> IMPLEMENTED -> VERIFIED -> COUNTERCHECKED -> ACCEPTED -> PRODUCTION_CONFIRMED` where applicable.

`BLOCKED`, `PARTIAL`, `IMPLEMENTED_NOT_VERIFIED`, `RECONCILIATION_REQUIRED`, `REJECTED`, `SUPERSEDED`, `DEFERRED` and `DUPLICATE` remain valid side states.

## Completion quorum
- R1: scope/diff + relevant evidence.
- R2: implementation evidence + relevant automated/manual verification + countercheck.
- R3: at least two independent evidence classes + negative/regression path + rollback/recovery where state changes.
- R4: R3 plus all applicable security/governance/target acceptance controls and explicit protected-boundary confirmation where required.

## Restore-specific R4 progression
The real Restore follows `RESTORE_STATE_MACHINE.md`; states cannot be skipped. `BACKUP_ACCEPTED` does not equal a completed Restore. Material host/policy/artifact/target drift can invalidate later evidence and force revalidation.

## External acceptance rule
Any control in `EXTERNAL_ACCEPTANCE.md` can be marked `ACCEPTED` only from current external/operator evidence bound to the relevant account/project/build/commit/target. Code, tests and CI alone cannot self-approve it.

## Sales readiness rule
`SALES_READY=true` is allowed only when every `required_for_sales` gate is in an allowed accepted state. The bounded disabled Website-AI foundation in Phase 8 neither satisfies nor blocks that finishline; Phase 4 alone never satisfies sales handoff.

## Milestone closeout
Before closing a phase, release, restore drill or other milestone, review project-wide tasks, finishline, next-best-action, external/deferred actions, evidence freshness, accepted-state drift, locks/receipts, loops/dependencies, contradictions and CI/runtime/device/provider evidence. When the milestone reaches `ACCEPTED` or `PRODUCTION_CONFIRMED`, create the required immutable snapshot.

## Mandatory postflight
Update the applicable task/state/evidence/handoff files, regenerate `NEXT_BEST_ACTION.md` when selection inputs change, update freshness records for new mutable evidence, and create milestone snapshots when a milestone is newly accepted.

## Source-of-truth precedence
Verified current repository/runtime/provider evidence wins over conversational recollection when they conflict. Existing FanMind source-of-truth and security/operations documents remain authoritative for their domains. Record contradictions rather than silently reconciling them.

## Standing authorization
Reuse permissions documented in `AUTHORIZATIONS.md` without asking again where technically and safely permitted. This does not override platform confirmations, missing credentials, protected Production/billing/destructive/compliance boundaries or red governance/security gates.

## Core invariant
**Project memory -> canonical/live truth -> finishline/external/deferred state -> evidence freshness/drift -> next-best-action selection -> previous attempts -> risk/assumptions -> started-work/lock -> dependencies/evidence plan -> action -> independent countercheck -> reconciliation -> execution receipt -> milestone snapshot/memory update.**

Never store passwords, API keys, private tokens, plaintext backup material, secret values or private credentials here.


## God Mode v1 mandatory readers
When `FM-GOV-GODMODE-001` exists, every substantive project-state/release/integration decision must also read:
- `GOD_MODE_POLICY.md`
- `SYSTEM_INVARIANTS.json`
- `CONTRACT_REGISTRY.json`
- `INTEGRATION_GATES.json`
- `IMPACT_MAP.json`
- `RELEASE_DECISION.json`

Contract/schema/API/AI-context/Billing/disclosure/Social changes require consumer-impact and integration-gate revalidation. `ALLOW` is never inferred from green CI or a merge. Protected owner/environment actions remain separately gated.

## Event-driven orchestration contract

FanMind orchestration is state-driven, never clock-order-driven. Scheduled Builder, Supervisor, Navigator and Owner Manager runs are fallback/reconciliation opportunities, not ordering guarantees.

- Automated Builder transport may be dispatched only by the manual Orchestrator workflow. The digest-bound command-line path returns `PREPARED_ONLY`/`send_authorized=false`; an already explicitly authorized Parent may use that exact content through the existing manual Builder path and must serialize/reconcile it procedurally because read-only validation cannot atomically reserve the out-of-workflow send.
- Every wake-up must classify the bounded task first and then run the minimum sufficient R1/R2 preflight or the full R3/R4 preflight defined by Execution Policy v6.
- Trigger payloads are navigation hints only and never Source of Truth or acceptance evidence.
- Cross-run coordination uses canonical Project Memory only when the task changes durable state or requires coordination; GitHub remains the detailed history for ordinary R1/R2 code changes.
- `.github/workflows/fanmind-manager-event-dispatch.yml` is manual `workflow_dispatch` only. No merge, receipt publication or schedule wakes it, and the Builder never self-selects from a repository event.
- Before transport, the executable admission gate binds fresh main, one prepared task envelope and current first-attempt workflow run, authoritative prior actual transport identity, the typed result receipt, actual GitHub main-targeted PR/check/merge truth, any contract-required runtime attestation and the existing selector's one-or-zero serial decision.
- The default orchestration is one active Workspace Builder/Manager run at a time. Existing explicitly parallel-safe, non-overlapping analysis remains available, but each dispatch admits exactly one envelope and uncertainty returns zero sends.
- Separate Planner/Guardian/Supervisor/Navigator runs are not default workers; use them only when the active risk class or contract explicitly requires independent planning/evidence/review.
- Repeated, rerun or concurrent admission of the same handoff/task/digest is idempotently blocked from transport; a terminal task identity is not reopened by changing only its handoff ID, and unchanged state must not create receipt/PR churn.
- Configuration and activation details live in `docs/operations/FANMIND_EVENT_MANAGER_DISPATCH.md`.


## FanMind Orchestrator single-authority contract
- The FanMind Orchestrator is the single decision point for new independent work. It owns roadmap/state inspection, prioritization, SAFE READY SET selection, task scoping, task_id assignment, result verification and the next-task decision.
- The FanMind Builder is an execution worker. It executes exactly the bounded task_id it receives. It may diagnose and repair problems inside that task, but it does not choose another roadmap task, continue unrelated work, or replace a blocked task with a different one.
- Repository merge events are evidence for reconciliation only; they never dispatch or authorize Builder work. The workflow accepts one exact prepared envelope and rejects free task prose; the command-line manual check remains non-consuming preparation only.
- HTTP/API trigger acceptance is only a transport receipt. Completion requires a typed terminal result with the exact handoff ID, payload digest and task ID, verified against the independent prior handoff identity and current GitHub truth.
- The typed result preserves its full accepted handoff contract. Admission evaluates the prior task's required workflow names and runtime requirement from that prior contract, never from the new handoff; exact-head workflow runs, not their internal job names, satisfy source checks.
- Every relevant workflow-run attempt is reconciled. A later rejected rerun never erases an earlier accepted or ambiguous transport, and incomplete attempt history blocks.
- When an accepted contract requires the Orchestrator CLI check, the receipt's command, complete-log SHA-256, checked-at value and merge/task/handoff/payload binding are a validated operator attestation. Repository admission does not independently retrieve or authenticate that execution. Source-only contracts may use `NOT_REQUIRED`; no new workflow mode is implied.
- The Orchestrator must not dispatch a second independent Builder task while a prior task is unresolved unless an explicit, proven non-overlapping parallel-work rule permits it. Default orchestration is serial to minimize duplicate work and cost.
- BLOCKED, FAILED and NO_CHANGE preserve their real terminal meaning and never mark the underlying product task accepted. A new independent dispatch requires a digest-bound `RECONCILED_PARKED` disposition, matching successfully closed actual run, explicit blocker/resume condition and normal selector/admission independence; unresolved transport remains blocking.
- Protected Production/Billing/provider/destructive/secret/legal boundaries remain governed by their existing authorization rules; Orchestrator authority does not bypass them.
