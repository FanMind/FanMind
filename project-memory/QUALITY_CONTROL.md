# Project Memory Quality Control v5

Mandatory controls and countercontrols for FanMind product, infrastructure and operations work.

## Risk levels
- R1: documentation/housekeeping with no runtime effect.
- R2: normal bounded product/UI/application changes.
- R3: auth, data model, API/backend authority, external integrations, mobile signing/build, infrastructure configuration, privacy-sensitive or cross-domain changes.
- R4: Production, billing/Stripe, security controls, destructive data operations, backup/restore, database migrations, secrets, release/publishing, legal/compliance activation or irreversible operational boundaries.

Every substantive task records `Risk: R1|R2|R3|R4` before implementation. Unknown risk defaults upward.

## Completion quorum
- R1: scope/diff check + one evidence class.
- R2: implementation evidence + independent countercheck + relevant regression/negative-path check.
- R3: at least two independent evidence classes, current CI/test evidence, dependency/assumption reconciliation and rollback/recovery plan for state-changing work.
- R4: all applicable FanMind CI/security/supply-chain/operations gates green, at least two independent evidence classes, exact commit/target-bound runtime or staging evidence, rollback/recovery plan, negative/fail-closed proof, and any protected-boundary approval still required by existing FanMind policy.

Evidence classes include diff review, automated tests, CI/security checks, staging/runtime evidence, read-only database verification, restore receipts, real-device evidence, external-resource acceptance and owner/operator acceptance. Duplicate self-reports count once.

## Evidence freshness
Evidence is valid only when bound to the current relevant commit/PR/build/workflow/target. Material head or target changes stale prior evidence until rerun or explicitly revalidated.

## Proof of absence / negative path
For fixes and controls, identify what must no longer happen. Security, auth, billing, restore, database-integrity and authority changes require meaningful negative or fail-closed proof by default.

## Rollback / recovery proof
R3/R4 state-changing work records recovery method, affected state/data, whether recovery was tested/simulated/reviewed, and irreversible steps. No `PRODUCTION_CONFIRMED` without a credible recovery path unless irreversibility was explicitly approved under existing protected policy.

## Scope-diff guard
Compare intended scope with final diff. Unexpected workflows, permissions, migrations, dependencies, generated output, secrets/config handling or unrelated files trigger `RECONCILIATION_REQUIRED` until explained or removed.

## Assumption verification
Critical assumptions belong in `ASSUMPTIONS.md` with status `VERIFIED`, `INVALIDATED` or `NEEDS_VERIFICATION` and evidence. Current production/staging/restore runner state, migration state, external approvals, Stripe/provider state, mobile build state and deployment commit must never be inferred from old chat context.

## Contradiction matrix
Conflicts among TASK_LEDGER, STARTED_WORK, WORK_LOCKS, OPEN_LOOPS, DEPENDENCIES, EXECUTION_RECEIPTS, EVIDENCE, PR/CI/security/workflow and runtime/target state belong in `CONTRADICTIONS.md` and force `RECONCILIATION_REQUIRED`.

Examples: task says DONE while CI is red; PR merged but active started work has no follow-up disposition; restore evidence refers to another commit/target; dependency marked BLOCKED although already resolved; active work has no started-work record.

## Completion state machine
`TODO -> IN_PROGRESS -> IMPLEMENTED -> VERIFIED -> COUNTERCHECKED -> ACCEPTED -> PRODUCTION_CONFIRMED` as applicable. Side states remain `BLOCKED`, `PARTIAL`, `IMPLEMENTED_NOT_VERIFIED`, `RECONCILIATION_REQUIRED`, `REJECTED`, `SUPERSEDED`, `DEFERRED`, `DUPLICATE`.

## Falsification question
Before COUNTERCHECKED answer: `What observation would prove our conclusion wrong?` Check the strongest practical falsifier or explain why it cannot currently be checked.

## Milestone closeout
Before declaring a FanMind milestone/phase complete, reconcile all related tasks, STARTED_WORK, OPEN_LOOPS, dependencies, failed attempts, change requests, PRs, CI/security/operations gates, assumptions, contradictions and evidence. Any unresolved item is explicitly carried forward; it may never disappear because a phase label changed.


## God Mode v1 overlay
For substantive R2+ work, current Project Memory must also identify affected `FM-CONTRACT-*` and `FM-IGATE-*` records when applicable. A local/module success does not close an integration gate.

Before a release or protected activation can be treated as technically clear:
- all required applicable `SYSTEM_INVARIANTS.json` entries must be `ENFORCED`;
- all affected `INTEGRATION_GATES.json` entries must be `VERIFIED`;
- `IMPACT_MAP.json` consumers/tests/docs/rollouts must be reconciled after contract/schema/API/AI-context/Billing/disclosure/Social changes;
- `RELEASE_DECISION.json` may contain only `ALLOW`, `BLOCK` or `OWNER_REQUIRED`;
- `ALLOW` is forbidden with missing/stale evidence, P1/P2, pending/red required checks, unresolved review threads, reconciliation flags, unmet dependencies or a protected action still requiring owner/environment approval.

For R3/R4, the countercheck must include at least one relevant fail-closed/adversarial proof when bounded and technically meaningful. Passing the God Mode CI validates the control plane, not Production/Staging acceptance.
