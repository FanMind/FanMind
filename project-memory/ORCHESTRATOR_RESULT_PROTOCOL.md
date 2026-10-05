# FanMind Orchestrator Result Protocol v2

Canonical result file: `project-memory/ORCHESTRATOR_RESULT.json`.

Required fields are `schema_version=2`, `handoff_id`, `payload_sha256`, `task_id`, `status`, `summary`, `evidence`, `blocker`, `resume_condition`, `completed_at`, `main_sha`, `source_acceptance`, and `runtime_evidence`.

Terminal status values are `COMPLETED`, `BLOCKED`, `NO_CHANGE`, and `FAILED`.

A Builder run that receives a task envelope publishes one terminal result for the same `handoff_id`, `payload_sha256` and `task_id` before claiming the handoff complete. A result from another envelope must not be reused. This result is a coordination receipt and never grants protected authorization. Trigger acceptance alone is not completion evidence. Every non-completed terminal result includes the exact blocker and resume condition. Publication follows the normal FanMind repository gates. The Orchestrator accepts a result only when it is readable from current main and its envelope identity matches the durable actual workflow transport or explicit Owner-direct bootstrap. If publication is not possible, the return channel remains incomplete. Secrets and credentials must never be stored in this result.

For `COMPLETED`, `source_acceptance` is typed and includes the source kind, PR number, exact head, immutable merge SHA and required checks. Admission verifies that the PR actually targeted `main`, the exact merge commit remains reachable from current `main`, and the check set exactly equals the digest-bound task contract. Runtime requirement comes from that task contract, never the receipt: required evidence must name an actual successful allowed workflow run on the exact source merge; source-only work uses exact `NOT_REQUIRED`. Source acceptance, task closeout and runtime evidence are never collapsed. A later unrelated advance of `main` does not invalidate the reachable merge.

`BLOCKED`, `FAILED` and `NO_CHANGE` never mean product completion. They may precede an independent task only under a separately digest-bound `RECONCILED_PARKED` disposition, matching successful terminal run closeout, explicit blocker/resume condition and normal selector/scope checks. Unknown or unresolved transport remains blocking. An already terminal task identity is not reopened by changing only its handoff/envelope identity.

`NO_RESULT` is initialization only and is not a terminal Builder result.

## Mandatory reconciliation before next task

Before the Orchestrator starts or dispatches another independent Builder task, `scripts/fanmind_orchestrator_admission.py` compares the authoritative previous workflow-run/Owner-direct handoff identity, the canonical typed result receipt on current `main`, actual GitHub PR/head/check/merge/runtime truth and the existing selector result. The previous task identity is read from the prior handoff record, never guessed from the receipt. Missing, stale, incomplete, nonterminal or contradictory evidence yields zero sends and an exact blocker/resume condition. A merge, HTTP 202 or green structural God Mode check alone does not fabricate completion or `ALLOW`.

The workflow run is the durable automated correlation. Its title binds `handoff_id`, `task_id` and payload digest, while authenticated job steps distinguish rejected admission from actual/ambiguous transport. Complete bounded pagination, strict identity parsing and first-attempt enforcement prevent malformed history or reruns from becoming sends. Lifecycle concurrency remains held until a current-run-bound terminal receipt appears. Owner-direct bootstrap work additionally binds required checks, runtime contract and active-lock non-overlap in existing `STARTED_WORK.md`/`WORK_LOCKS.md`. No per-handoff repository write, queue, registry, token scope or contents-write permission is required.
