# Project Memory Protocol v7

This directory is the operational memory for FanMind. It complements code, tests, Git history and canonical product documentation; it does not replace them.

## Mandatory execution policy
`EXECUTION_POLICY.md`, `COUNTERCHECK_POLICY.md`, `QUALITY_CONTROL.md`, `FANMIND_FINISHLINE.md`, `FINISHLINE_STATE.json`, `NEXT_BEST_ACTIONS.json`, `NEXT_BEST_ACTION.md`, `DEFERRED_OWNER_ACTIONS.md`, `RESTORE_STATE_MACHINE.md`, `EXTERNAL_ACCEPTANCE.md`, `LEGACY_ISSUE_RECONCILIATION.json`, `BRANCH_PROTECTION_CONTRACT.json`, `EVIDENCE_TTL_POLICY.json`, `EVIDENCE_FRESHNESS.json`, `DRIFT_BASELINE.json` and `MILESTONE_POLICY.json` are mandatory operational readers where relevant.

## Mandatory preflight
Before substantive code, infrastructure, configuration, workflow or product-state work:
1. Read `AGENTS.md`, `docs/SOURCE_OF_TRUTH.md`, `EXECUTION_POLICY.md`, `CURRENT_STATE.md`, `FANMIND_DEEP_AUDIT_2026-08-19.md`, `FANMIND_FINISHLINE.md`, `FINISHLINE_STATE.json`, `NEXT_BEST_ACTION.md`, `DEFERRED_OWNER_ACTIONS.md`, `SESSION_HANDOFF.md`, `STARTED_WORK.md`, `WORK_LOCKS.md`, `OPEN_LOOPS.md`, `TASK_LEDGER.md`, `DEPENDENCIES.md` and `DECISIONS.md`.
2. Run/inspect `scripts/fanmind_drift_preflight.py` before relying on prior acceptance for watched truth/workflow files.
3. Run/inspect `scripts/fanmind_evidence_freshness.py` before relying on mutable runtime/provider/admin evidence.
4. If the requested/current task is owner-deferred, do not ask again by default. Run `scripts/fanmind_next_best_action.py` and continue with the selected `parallel_safe` task unless the owner explicitly resumes the deferred action.
5. For Restore work also read `RESTORE_STATE_MACHINE.md` and the canonical Restore runbook before acting.
6. For provider, Mobile, billing, legal or other external work read `EXTERNAL_ACCEPTANCE.md` and do not infer acceptance from repository evidence alone.
7. Search `FAILED_ATTEMPTS.md`, `DO_NOT_ASSUME.md`, `ASSUMPTIONS.md`, `CONTRADICTIONS.md` and `CHANGE_REQUESTS.md` for the intended area, error, assumption and prior approach.
8. Check actual branch/head, recent commits/PRs, current CI/security/supply-chain/runtime/provider state and central finishline #874.
9. For #642/#643/#644 or work derived from their historical checkboxes, read and validate `LEGACY_ISSUE_RECONCILIATION.json`; never treat them as a zero-state independently of #874 and the retained-gate map.
10. Search existing task/change IDs before creating new work.
11. Assign Risk `R1`–`R4`, record critical assumptions, define expected scope and define the evidence/quorum that will prove success before implementation.

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
1. Preserve finishline priority; never mark a deferred owner step complete just because work proceeds elsewhere.
2. If the earliest unresolved action is `DEFERRED_BY_OWNER` or otherwise owner/platform-only, later work is eligible only when explicitly `parallel_safe=true` and all listed prerequisite gates are accepted.
3. Never select Social or Sales around an unresolved earlier owner-only/non-Social gate unless their explicit prerequisites are accepted.
4. Never auto-select payment, destructive retention, protected Production mutation, legal acceptance, credentials/signing or provider activation merely because it is next in sequence.
5. When the owner explicitly resumes a deferred action, remove/update its deferred status; the selector must restore its original finishline priority.
6. If nothing safe is executable, surface the earliest unresolved owner action instead of inventing work.

## Started-work and lock rule
As soon as substantive work begins:
- create or refresh its `STARTED_WORK.md` entry;
- acquire/update its Task-ID lock in `WORK_LOCKS.md`;
- record completed-so-far, still-open, exact-next-step and owner-action-needed fields;
- keep unfinished work visible until explicitly closed or superseded.

A stale lock is not free. Reconcile it against PRs, commits, receipts and started-work state before reuse.

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
