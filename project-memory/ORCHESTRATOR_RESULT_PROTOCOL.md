# FanMind Orchestrator Result Protocol v2

Canonical result file: `project-memory/ORCHESTRATOR_RESULT.json`.

Required fields are `schema_version=2`, `handoff_id`, `payload_sha256`, `task_id`, `status`, `summary`, `evidence`, `blocker`, `resume_condition`, `completed_at`, `main_sha`, `source_acceptance`, and `runtime_evidence`.

Terminal status values are `COMPLETED`, `BLOCKED`, `NO_CHANGE`, and `FAILED`.

A Builder run that receives a task envelope publishes one terminal result for the same `handoff_id`, `payload_sha256` and `task_id` before claiming the handoff complete. A result from another envelope must not be reused. This result is a coordination receipt and never grants protected authorization. Trigger acceptance alone is not completion evidence. A BLOCKED or FAILED result includes the exact blocker and resume condition. Publication follows the normal FanMind repository gates. The Orchestrator accepts a result only when it is readable from current main and its envelope identity matches the durable prior workflow-run identity or the explicit Owner-direct STARTED_WORK bootstrap. If publication is not possible, the return channel remains incomplete. Secrets and credentials must never be stored in this result.

For `COMPLETED`, `source_acceptance` is typed and includes the source kind, PR number, exact head, immutable merge SHA and exact required check names. `runtime_evidence.required` states whether runtime acceptance is part of this task; source acceptance, task closeout and runtime evidence are never collapsed. A later advance of `main` does not invalidate a reachable immutable merge commit. `BLOCKED`, `FAILED` and `NO_CHANGE` remain terminal coordination states but never mean that the underlying product objective is accepted.

`NO_RESULT` is initialization only and is not a terminal Builder result.

## Mandatory reconciliation before next task

Before the Orchestrator starts or dispatches another independent Builder task, `scripts/fanmind_orchestrator_admission.py` compares the authoritative previous workflow-run/Owner-direct handoff identity, the canonical typed result receipt on current `main`, reachable GitHub PR/head/check/merge truth and the existing selector result. The previous task identity is read from the prior handoff record, never guessed from the receipt. Missing, stale, nonterminal or contradictory evidence yields zero sends and an exact blocker/resume condition. A merge, HTTP 202 or green structural God Mode check alone does not fabricate completion or `ALLOW`.

The workflow run is the durable automated handoff correlation. Its title binds `handoff_id`, `task_id` and payload digest; lifecycle concurrency remains held until a matching terminal receipt appears. Repeated or concurrent runs with the same identity and state are rejected before transport. Owner-direct bootstrap work is bound in `STARTED_WORK.md` with the same three identifiers. No per-handoff repository write, queue, registry, token scope or contents-write permission is required.
