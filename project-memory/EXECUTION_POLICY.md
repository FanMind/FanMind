# Execution Policy v6

Mandatory default for substantive FanMind agent/Codex/automation work.

## Automatic preflight
Read `AGENTS.md` and relevant project-memory sources including current state, task ledger, change requests, decisions, failed attempts, open loops, dependencies, evidence, do-not-assume, handoff/status, authorizations, STARTED_WORK, WORK_LOCKS, EXECUTION_RECEIPTS, RECONCILIATION, QUALITY_CONTROL, ASSUMPTIONS and CONTRADICTIONS. Verify actual branch/head, PR/CI/security/workflow state, runtime/target state and prior attempts.

Assign `Risk: R1|R2|R3|R4`; uncertainty defaults upward. Record and freshly verify critical assumptions, especially Production/Staging/restore target, runner, migration, deployment commit, Stripe/provider, external approvals and mobile build/signing state. Define success evidence, negative/fail-closed evidence and recovery expectations for R3/R4 state-changing work.

## Frozen task contract and convergence
Before DELIVERY, apply `TASK_CONVERGENCE_POLICY.md`: freeze measurable acceptance criteria, evidence quorum, scope and explicit out-of-scope boundaries. Once DELIVERY begins, new findings may not silently expand the task. Non-blocking adjacent findings become FOLLOW_UP, TECH_DEBT, BUG_SEPARATE or ENHANCEMENT.

Every repair cycle must produce a material delta. Two consecutive no-progress cycles stop the current strategy. The same failing criterion/root-cause hypothesis may be attempted at most three times; thereafter transition to BLOCKED, RECONCILIATION_REQUIRED or a separately scoped diagnostic task.

When every frozen criterion and required quorum passes, stop the task and close it. Countercheck/Supervisor work verifies existing criteria and may not invent new completion requirements.

## Started-work rule
As soon as substantive work begins, record it in STARTED_WORK with Risk, acquire/update the Task-ID lock and open an execution receipt. Unfinished restore/mobile/AI/billing/social/security/infra work remains visible until explicitly closed, superseded or transferred with exact next step.

## Duplicate/regression and scope guard
Confirm the work is not already implemented, previously failed/rejected without new evidence, in the wrong domain or blocked by unresolved dependencies. Unexpected workflows, permissions, migrations, dependencies, secrets/config handling, generated output or unrelated files force `RECONCILIATION_REQUIRED`.

## Independent countercheck
Before merge/completion/success reporting: re-read goal; inspect final diff; verify fresh commit/PR/workflow/target evidence; test meaningful negative/regression/fail-closed paths; answer `What observation would prove our conclusion wrong?`; re-check assumptions/dependencies/open loops/contradictions; reconcile memory with PR/CI/security/runtime state; apply QUALITY_CONTROL quorum. R3/R4 require at least two independent evidence classes. R4 also requires all applicable FanMind CI/security/supply-chain/operations gates green and exact target-bound evidence. Record rollback/recovery proof, finish receipt, and release/update lock.

## Completion state machine
`TODO -> IN_PROGRESS -> IMPLEMENTED -> VERIFIED -> COUNTERCHECKED -> ACCEPTED -> PRODUCTION_CONFIRMED` as applicable. Side states include `BLOCKED`, `PARTIAL`, `IMPLEMENTED_NOT_VERIFIED`, `RECONCILIATION_REQUIRED`, `REJECTED`, `SUPERSEDED`, `DEFERRED`, `DUPLICATE`. Never jump from implementation to acceptance without quorum.

## Stop conditions
Do not bypass red governance/security/supply-chain/operations checks, invalid assumptions, contradictory verified evidence, missing dependencies/secrets, Production/billing/restore/destructive/compliance/publishing boundaries, or previous failed approaches without new evidence.

## Milestone closeout
Before a FanMind phase/milestone is complete, reconcile all related tasks, started work, locks, loops, dependencies, failed attempts, change requests, PRs, CI/security/operations gates, assumptions, contradictions and evidence. Carry every unresolved item forward explicitly.

Standing permissions in AUTHORIZATIONS are reused where technically/safely allowed; existing protected-environment and destructive-action confirmation requirements remain in force.

**Invariant: Project memory -> actual Git/runtime/target state -> prior attempts -> Risk/assumptions -> started-work/lock -> dependencies/evidence plan -> action -> falsification/negative check -> independent countercheck -> quorum/reconciliation -> receipt -> memory update.**
