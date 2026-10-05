# FanMind Orchestrator Builder dispatch

## Purpose

The manual `workflow_dispatch` transport accepts one previously prepared FanMind task envelope. It is not a merge wake-up, task selector or acceptance signal. The existing Project Memory, selector, started work, locks, result receipt and GitHub truth remain authoritative.

## Executable method

`scripts/fanmind_orchestrator_admission.py` is the common preparation, admission and closeout entry.

1. From fresh `main`, the Orchestrator prepares one JSON envelope containing the handoff identity, current and previous task IDs, source, exact goal, bounded scope, acceptance, risk, forbidden boundaries and prepared main SHA.
2. `prepare --handoff <scratch-json> [--composer-output <scratch-text>]` canonicalizes that envelope, records its SHA-256 and emits the exact base64 workflow input. The optional composer file is the only supported manual text payload.
3. The manual workflow receives only the prepared handoff identity, task IDs, digest and exact base64 envelope. It checks out fresh `main`; no free task prose is accepted.
4. Before transport, `dispatch` verifies the envelope/digest, fresh main, authoritative previous handoff identity, typed canonical receipt, real PR head/check/merge reachability and the existing selector's one-or-zero serial decision.
5. A valid catalog handoff must equal the selector's sole executable action. An Owner-direct handoff is labelled `OWNER_DIRECT` and must not claim catalog readiness.
6. Only a `SEND` result invokes the existing Workspace Agent transport. Every blocker returns zero sends plus the reconciliation condition.
7. The workflow keeps its global lifecycle concurrency until current `main` publishes a matching terminal typed receipt. The run title binds handoff ID, task ID and payload digest.

The selector retains its explicit parallel-safe analysis. Dispatch consumes one action by default. Existing non-overlapping parallel capability is not removed, but additional concurrent dispatch requires a separate explicit handoff and cannot bypass conflict, duplicate or active-work checks.

## Handoff lifecycle and idempotency

Automated handoff correlation is the existing GitHub workflow-run record, not a new repository queue or Latest-Handoff file. The run title preserves `handoff_id`, `task_id` and payload digest independently of the result receipt. The receipt must later repeat all three values.

Before a send, admission reads earlier workflow runs. A queued, active or completed run with the same envelope identity blocks a repeat. Global non-cancelling concurrency covers the Builder lifecycle while the job awaits closeout; even after a timeout, the unresolved handoff/receipt mismatch remains fail-closed for later admission.

The one migration bootstrap for an explicitly Owner-direct task is recorded in existing `STARTED_WORK.md` and `WORK_LOCKS.md` with the same identity fields. No per-handoff commit to `main`, contents-write permission, new token scope, plugin, registry or second queue is introduced.

## Result meaning

`COMPLETED` requires typed source acceptance and actual GitHub truth. Its immutable merge evidence remains valid after unrelated `main` progress. Source acceptance, task closeout and runtime evidence remain separate.

`BLOCKED`, `FAILED` and `NO_CHANGE` are terminal coordination results, not accepted product work. They do not let a catalog task become DONE and are not treated as permission to manufacture replacement work. HTTP 202 and a green structural God Mode check are never completion or `ALLOW`.

## Manual boundary

The supported manual path uses `prepare`, then `check --repository FanMind/FanMind` with the exact prepared composer file and the identities emitted by preparation. `check` performs the same live public GitHub run/PR/check/commit reads as automated admission; it does not accept a caller-supplied truth file. Any residual prefix, suffix or changed text yields `composer_content_mismatch` and zero sends. Only the exact prepared text is then eligible for the supported manual send step.

GitHub CI cannot universally prevent an Owner or root user from typing arbitrary text directly into another interface. Enforcement applies to this repository's supported preparation/check entry and the existing Builder transport workflow; no UI automation or platform access system is added.

## Configuration and security

The existing repository variable `CHATGPT_FANMIND_MANAGER_TRIGGER_ID` and secret `CHATGPT_WORKSPACE_AGENT_ACCESS_TOKEN` remain unchanged. Workflow permissions stay exactly `contents: read`; no Actions, Checks or Pull Requests token grant is added. Because FanMind is public, admission reads canonical run/PR/check/commit metadata through unauthenticated GitHub GET endpoints and fails closed on HTTP, rate-limit, parse or incomplete-evidence errors. The controller job token is not assumed to have those scopes and is not sent to those endpoints. Tokens and response bodies are not persisted in Project Memory.

The workflow stays `workflow_dispatch` only. It does not restore merge wake-ups, scheduled self-selection or Builder self-selection. A normal merge, deploy or receipt publication does not automatically trigger another Builder.

## Activation boundary

This source task stops at a Draft PR. Merge, auto-merge, deployment, live API trigger and the controlled side-effect-free check run require later explicit authorization. A successful transport response alone is not acceptance.
