# Execution Policy v6 — Zero-Friction Development

Mandatory default for substantive FanMind agent/Codex/automation work.

## Core principle
Process cost must be proportional to actual risk. FanMind uses adaptive execution paths instead of one maximum-governance path for every change.

Every autonomous run handles exactly one bounded task and then stops. A later independent task requires a new run.

## Risk routing

### R1 — MICRO / ZERO-FRICTION
Use for small, clearly bounded repository-only work such as UI/CSS/copy changes, focused tests/docs, small React fixes, CI/lint fixes and local refactors that do not change architecture, contracts, protected data flows or runtime state.

Required path:
1. verify current scope and relevant file/current head;
2. implement;
3. run focused relevant test/lint/build when useful;
4. inspect the diff;
5. create commit/PR;
6. let relevant CI decide.

R1 does not require a separate Planner, separate Guardian, full Project-Memory preflight, work lock, execution receipt, broad Operations/Restore/Billing/provider checks or an independent evidence chain.

Project Memory is not updated for ordinary R1 code history unless the change alters project state, architecture, product truth, a decision, blocker, open loop, authorization boundary or next action.

### R2 — STANDARD DEVELOPMENT
Use for normal features and non-trivial bug fixes, new API/library behavior, multi-component product changes, larger refactors and other repository work that remains outside protected state-changing boundaries.

Required path:
1. verify scope and current main;
2. read only relevant decisions/dependencies/project-state sources;
3. implement;
4. run targeted tests;
5. inspect diff and relevant regressions;
6. create PR;
7. run relevant CI;
8. perform a short countercheck/review.

A separate Planner is not required when the task is already explicit from an issue, PR finding, CI failure, owner request or defined next action. A separate Guardian is not required for ordinary R2; the Builder may perform the countercheck unless independence is required by the affected contract/security boundary.

Project Memory is updated only when the task changes durable project state, architecture, product truth, decisions, blockers, important failed approaches, lasting dependencies, runtime/provider facts, authorization boundaries or next action.

### R3 — CONTROLLED
Use for Staging/schema/controlled-SQL work, Auth/RLS changes, provider integration, important Billing logic, migrations, runtime-affecting feature flags, sensitive data flows, Staging activation or external provider E2E.

R3 requires relevant current Project Memory, duplicate/failed-attempt checks, task lock, recovery/rollback thinking, meaningful negative/regression tests, a targeted Guardian/countercheck and Project-Memory reconciliation after completion. State-changing R3 requires at least two suitable independent evidence classes.

### R4 — PROTECTED
Use for Production DB/runtime/ENV changes, real payments/Billing activation, Legacy-customer migration, Restore writes, destructive data actions, secrets/credentials, provider activation, capability/permission grants, signing/store actions or legally significant activation.

R4 requires the full current preflight, exact commit and target binding, current prerequisite evidence, negative proof, rollback/recovery, independent Guardian/countercheck, all applicable Security/Governance/Operations gates, current protected authorization and complete closeout/receipt evidence. R4 remains fail-closed.

## Protected-boundary detection
Before acting, determine whether the task reaches a protected boundary.

Protected boundaries include Production, customer-data mutation outside ordinary product behavior, database applies, Stripe/payments, secrets, provider accounts/permissions, Auth/capability grants, Restore, irreversible/destructive actions, signing/store actions and legally significant activation.

If no protected boundary is involved, route to R1 or R2.
If one is involved, route to R3 or R4.
If uncertain, work may continue safely up to the boundary, but the boundary itself must not be crossed until the higher-risk requirements are satisfied.

## Build until boundary
Do not stop ordinary engineering prematurely because a later protected action exists.

Repository work may be analyzed, implemented, tested, reviewed and prepared as a PR up to the protected boundary. Staging APPLY, Production APPLY, Billing activation, provider activation, destructive execution and equivalent state changes remain separate protected actions.

## Project Memory role
Git is the detailed code-change history.
Project Memory is the durable state/decision/blocker/authorization/open-loop/handoff register.

Do not duplicate ordinary commit history in Project Memory.

## Planner rule
Use a Planner when the next task is unclear, several tasks compete, dependencies must first be resolved, Project Memory materially conflicts, or scope is not yet bounded.

Do not require a Planner for a clear issue, bug, PR finding, CI failure, explicit owner task or already-defined next action.

## Guardian rule
Use a separate Guardian for R3/R4, security-sensitive R2, complex architecture changes, Auth/RLS/Billing/data-boundary work or unclear regression risk.

Do not require a separate Guardian for normal R1. For ordinary R2, the Builder may perform the countercheck.

## CI and merge rule
CI is risk-adaptive.

- R1: focused relevant checks only (for example affected tests, typecheck/lint/build where useful).
- R2: normal relevant product/regression CI.
- R3/R4: full applicable security, governance, integration and operations gates.

Do not run unrelated Mobile/Restore/Billing/provider suites merely because an R1 repository file changed.

For R1/R2 repository work, the Builder may autonomously merge its PR when every check required for the affected scope is green, the PR is mergeable, the final diff matches the bounded task, no unresolved review/countercheck blocker remains, and no protected boundary is crossed. Green required CI is the default merge signal; unrelated or non-applicable suites must not be invented as extra blockers.

Do not infer deployment, provider acceptance, billing activation, Production state or any protected authorization from a merge. R3/R4 retain their explicit higher-risk authorization and evidence rules.

## Started-work / locks / receipts
R1 does not require STARTED_WORK, WORK_LOCKS or execution receipts unless the task unexpectedly escalates or changes durable project state.

R2 uses those records only when coordination, concurrency, durable state or a meaningful handoff requires them.

R3/R4 retain explicit started-work, lock and receipt handling.

## Countercheck
- R1: inspect scope/diff and relevant evidence.
- R2: implementation evidence + relevant verification + short countercheck.
- R3: targeted independent countercheck, negative/regression proof and recovery where state changes.
- R4: R3 plus all applicable protected-boundary controls.

## Completion state
Use only as much state ceremony as the task needs.

For R1/R2 repository tasks, IMPLEMENTED/VERIFIED or MERGED may be sufficient when no runtime/acceptance claim is being made.
Protected/runtime work retains the full state progression:
`TODO -> IN_PROGRESS -> IMPLEMENTED -> VERIFIED -> COUNTERCHECKED -> ACCEPTED -> PRODUCTION_CONFIRMED`.

Side states remain `BLOCKED`, `PARTIAL`, `IMPLEMENTED_NOT_VERIFIED`, `RECONCILIATION_REQUIRED`, `REJECTED`, `SUPERSEDED`, `DEFERRED`, `DUPLICATE`.

## Stop conditions
Never bypass a real red security/governance/integration gate that applies to the affected scope, a protected authorization boundary, contradictory verified evidence, missing required dependency/secret, wrong target, destructive boundary or previous failed approach without new evidence.

Unrelated gates do not become blockers merely because they exist elsewhere in FanMind.

## Autonomy
The Builder continues without unnecessary owner confirmation while scope remains clear, risk does not cross a protected boundary, no contradictory evidence appears and no new owner decision is required.

Risk escalation:
- R1 -> R2 when scope becomes non-trivial.
- R2 -> R3 when Auth, RLS, schema, provider or sensitive state boundaries are reached.
- R3 -> R4 when Production, payments, irreversible mutation, Restore, secrets or equivalent protected boundaries are reached.

## Target execution shapes
R1:
`Trigger -> Builder -> focused test -> diff -> PR -> required CI -> merge when green -> verify main -> end`

R2:
`Trigger -> Builder -> tests -> PR -> required CI -> countercheck -> merge when green -> verify main -> end`

Unclear work:
`Trigger -> Planner -> Builder -> verification -> end`

Protected work:
`Trigger -> Planner/Builder -> complete preparation -> Guardian -> READY_FOR_PROTECTED_ACTION -> stop`

## Standing permissions
Reuse permissions documented in AUTHORIZATIONS and explicit current Owner instructions where technically and safely permitted. This never overrides platform confirmations, missing credentials, protected Production/Billing/destructive/compliance boundaries or target-specific authorization requirements.

## Invariant
**Risk first. Minimum sufficient process. Build until the real boundary. Git records code history; Project Memory records durable project truth.**
