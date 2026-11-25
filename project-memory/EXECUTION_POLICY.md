# FanMind Execution Policy

This is the operational policy for the Builder, Planner, Guardian, Orchestrator, Manager and directly assigned executors. Domain contracts specify their technical prerequisites. Apply the following rules once per bounded assignment.

## Select the lane before acting

| Lane | Scope and existing risk identifier | Required evidence and review |
| --- | --- | --- |
| Autonomous | R1 covers small repository changes. R2 covers bounded features, bug fixes and refactors outside protected boundaries. | Inspect scope, relevant decisions, final diff and focused verification. For R2 perform a second-pass regression countercheck. Use independent review for a sensitive boundary, complex architecture or contract that requires it. |
| Controlled | R3 covers Auth/RLS, sensitive data, schema, Staging, integrations and significant billing logic. A standard protected operation uses this lane only when its existing R4 contract and exact authorization cover it. | Check current state, prior failures, dependencies and rollback. Maintain started-work, lock and receipt. Obtain independent countercheck, at least two independent evidence classes and relevant negative/regression proof. Standard R4 operations also require all R4 controls below. |
| Exceptional protected | R4 covers Production, real payments, provider activation, credentials, authority changes, destructive actions, Restore writes, signing and legally significant activation. | Complete current protected preflight and applicable security, governance and operations gates. Bind authorization and evidence to the exact target, commit, actions and prerequisites. Require independent review, fail-closed proof, recovery and closeout receipts. |

Escalate when scope expands. Prepare safe repository work up to an uncertain or protected boundary. Park a blocked step and finish independent authorized steps in the same assignment.

## Own the outcome

One executor carries the bounded task through implementation, verification and authorized follow-through. Use a Planner only for unresolved scope, priorities or dependencies. An explicit Owner assignment supplies the task directly. For automated dispatch the Orchestrator alone selects one task, assigns its unique task_id, waits for its matching terminal result, verifies and reconciles before selecting another. The Builder can fix related failures within that assignment.

Compare the final diff with the assignment. Run applicable CI and investigate failures or contradictory evidence. Reuse evidence only when its relevant inputs, dependencies and target still match and mutable evidence is fresh under the affected contract. Report skipped checks and reused evidence accurately. The technical evidence reference is [Quality Control](QUALITY_CONTROL.md).

## Merge and protected execution

Use regular merge or auto-merge when the current PR is mergeable, required checks and reviews have passed, the bounded diff is correct, blockers are resolved and the authorization covers the merge. Verify the resulting main commit. Report implementation, verification, merge, deployment and target acceptance separately.

A bounded authorization may group related operations. Bind it to the approved systems, exact actions, prerequisites, limits, validity and target evidence. Reuse it within those terms. For a new target, material drift, exhausted allowance or action outside the grant, stop that action at its boundary. Follow the protected controller, environment approvals and [authorization register](AUTHORIZATIONS.md). A merge grants no authority over a deployment, payment, database or provider.

## Record durable changes once

Git and PRs record ordinary fixes, UI edits and test runs. Update the relevant memory record when a decision, architecture, product or operational state, enduring dependency, blocker, open loop, significant failed approach or protected authorization changes. Link existing evidence. For R1, use an extra coordination record only upon escalation or a durable change. For R2, use locks and receipts only when coordination, concurrency, durable state or handoff requires them. Protected work retains mandatory records, freshness, milestone and recovery evidence under the [Project Memory Protocol](PROTOCOL.md).
