# FanMind Orchestrator Result Protocol v1

Canonical result file: `project-memory/ORCHESTRATOR_RESULT.json`.

Required fields are `task_id`, `status`, `summary`, `evidence`, `blocker`, `completed_at`, and `main_sha`.

Terminal status values are `COMPLETED`, `BLOCKED`, `NO_CHANGE`, and `FAILED`.

A Builder run that receives a task_id publishes one terminal result for that same task_id before claiming the handoff complete. A result from another task_id must not be reused. This result is a coordination receipt and never grants protected authorization. Trigger acceptance alone is not completion evidence. A BLOCKED result includes the exact blocker and resume condition. Publication follows the normal FanMind repository gates. The Orchestrator accepts a result only when it is readable from current main and the task_id exactly matches. If publication is not possible, the return channel remains incomplete. Secrets and credentials must never be stored in this result.

`NO_RESULT` is initialization only and is not a terminal Builder result.
