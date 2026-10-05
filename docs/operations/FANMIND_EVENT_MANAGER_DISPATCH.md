# FanMind Orchestrator Builder dispatch

## Purpose

The manual `workflow_dispatch` transport accepts one previously prepared FanMind task envelope. It is not a merge wake-up, task selector or acceptance signal. The existing Project Memory, selector, started work, locks, result receipt and GitHub truth remain authoritative.

## Executable method

`scripts/fanmind_orchestrator_admission.py` is the common preparation, admission and closeout entry.

1. From fresh `main`, the Orchestrator prepares one JSON envelope containing the handoff identity, current and previous task IDs, source, exact goal, bounded scope, acceptance, risk, forbidden boundaries and prepared main SHA.
2. `prepare --handoff <scratch-json> [--composer-output <scratch-text>]` canonicalizes that envelope, records its SHA-256 and emits the exact base64 workflow input. The optional composer file is the only supported manual text payload.
3. The manual workflow receives only the prepared handoff identity, task IDs, digest and exact base64 envelope. It checks out fresh `main`; no free task prose is accepted. IDs use the same whitespace-free grammar as the authenticated run-title parser.
4. Before transport, `admit` verifies the envelope/digest, exact checked-out/current main, authenticated current run and first attempt, authoritative previous handoff identity, typed canonical receipt, actual main-targeted PR head/check/merge reachability, runtime evidence when required, and the existing selector's one-or-zero serial decision.
5. A valid catalog handoff must equal the selector's sole executable action. An Owner-direct handoff is labelled `OWNER_DIRECT` and must not claim catalog readiness.
6. Admission and transport are separate workflow steps. Only successful `admit` materializes the exact transport payload; only the following transport step can invoke the existing Workspace Agent. Every blocker returns zero sends plus the reconciliation condition.
7. The workflow keeps its global lifecycle concurrency until current `main` publishes a matching terminal typed receipt. The run title binds handoff ID, task ID and payload digest.

The selector retains its explicit parallel-safe analysis. Dispatch consumes one action by default. Existing non-overlapping parallel capability is not removed, but additional concurrent dispatch requires a separate explicit handoff and cannot bypass conflict, duplicate or active-work checks.

## Handoff lifecycle and idempotency

Automated handoff correlation is the existing GitHub workflow-run record, not a new repository queue or Latest-Handoff file. The run title preserves `handoff_id`, `task_id` and payload digest independently of the result receipt. The receipt must later repeat all three values.

Before a send, admission boundedly paginates the complete workflow-run history and every attempt's complete job history. Missing totals, incomplete pages, unreadable identities or job-step evidence block. Actual job steps distinguish a rejected pre-transport reservation from a run whose transport was accepted or became ambiguous; only the latter becomes authoritative predecessor/duplicate evidence. A GitHub rerun (`run_attempt != 1`) never posts again, and a rejected later attempt cannot hide a POST from an earlier attempt. Global non-cancelling concurrency covers the Builder lifecycle; timeout, cancellation or job failure after transport remains unresolved and fail-closed.

The one rollout boundary is actual legacy workflow run `37234276748` (2026-10-04T21:00:06Z), the newest of 20 observed manual runs whose pre-method title was only `FanMind Orchestrator Builder Dispatch`. Unstructured identities are ignored only at or below that immutable run ID. Any unstructured newer run blocks. This compatibility constant is not a Latest-Handoff record and is never updated per dispatch.

The one migration bootstrap for an explicitly Owner-direct task is recorded in existing `STARTED_WORK.md` and `WORK_LOCKS.md` with the same identity fields, required-check/runtime contract and exact set of active locks explicitly proven non-overlapping by the Owner task. Caller labels or a timestamp alone grant nothing. A stale, missing or duplicate binding fails closed. No per-handoff commit to `main`, contents-write permission, new token scope, plugin, registry or second queue is introduced.

## Result meaning

`COMPLETED` requires typed source acceptance, the full accepted prior envelope and actual GitHub truth. The PR must target `main`, its exact verified merge commit must be reachable from current `main`, and the accepted prior contract's required workflow names must each have a successful exact-head `pull_request` run. GitHub job/check-run names are deliberately not compared with workflow names. Source-only tasks require the exact `NOT_REQUIRED` runtime form. For this R3 method task, the required later evidence is the contract's exact side-effect-free CLI test command, bound to the source merge/local head, task, handoff, payload and the SHA-256 of its complete log. Normal God Mode CI remains source/offline evidence and cannot substitute for that separately authorized CLI proof. Unsupported evidence stays blocked. Immutable merge evidence remains valid after unrelated `main` progress. Source acceptance, task closeout and runtime evidence remain separate.

`BLOCKED`, `FAILED` and `NO_CHANGE` are terminal coordination results, not accepted product work. A digest-bound `RECONCILED_PARKED` disposition may release a genuinely independent selector-approved task only when the matching actual predecessor run closed successfully with an explicit blocker and resume condition; an unresolved transport cannot. Same-work continuation requires selector- or Owner-bound resume evidence that strictly extends the accepted predecessor evidence. Completed semantic work is not reopened by changing catalog-action, task, handoff or source labels. These statuses do not make a catalog task DONE or authorize replacement work. HTTP 202 and a green structural God Mode check are never completion or `ALLOW`.

## Manual boundary

The supported manual path uses `prepare`, then `check --repository FanMind/FanMind` with the exact prepared composer file and identities emitted by preparation. `check` performs the same live public GitHub reads, verifies exact local/current-main binding and rejects any residual text. A successful result is `PREPARED_ONLY` with `send_authorized=false`: it is validation, not a reservation or automatic send grant. Existing read-only rights cannot atomically reserve an out-of-workflow manual send.

From an exact fresh checkout, the usable sequence is:

```bash
python3 scripts/fanmind_orchestrator_admission.py prepare \
  --handoff /tmp/fanmind-handoff.json \
  --composer-output /tmp/fanmind-builder-input.txt

python3 scripts/fanmind_orchestrator_admission.py check \
  --handoff /tmp/fanmind-handoff.json \
  --repository FanMind/FanMind \
  --handoff-id '<prepared-handoff-id>' \
  --task-id '<prepared-task-id>' \
  --previous-task-id '<prepared-previous-task-id>' \
  --payload-sha256 '<prepare-output-sha256>' \
  --composer-input /tmp/fanmind-builder-input.txt
```

After `PREPARED_ONLY`, an explicitly authorized Parent may use exactly `/tmp/fanmind-builder-input.txt` through the existing manual Builder path, including while the Workspace Agent trigger API remains unavailable. That procedural route does not gain workflow concurrency or automatic deduplication: the Parent must keep it serial, preserve the prepared identity and reconcile the matching receipt/GitHub truth before any independent work. The repository workflow remains the only transport boundary automatically enforced by this code.

GitHub CI cannot universally prevent an Owner or root user from typing arbitrary text directly into another interface. Enforcement applies to this repository's supported preparation/check entry and the existing Builder transport workflow; no UI automation or platform access system is added.

After a separately authorized merge, the controlled check is run from a fresh checkout whose `HEAD` equals the accepted merge commit. The exact side-effect-free command is:

```bash
python3 -m unittest -v tests/test_fanmind_orchestrator_admission.py && node --test tests/fanmind-manager-event-dispatch.test.mjs
```

The operator retains the complete combined log and its SHA-256. The later receipt binds that digest plus the exact command, merge/local-head SHA, task, handoff and payload. This Draft-PR phase does not run that check on a merged release and does not claim the proof exists.

## Configuration and security

The existing repository variable `CHATGPT_FANMIND_MANAGER_TRIGGER_ID` and secret `CHATGPT_WORKSPACE_AGENT_ACCESS_TOKEN` remain unchanged. Workflow permissions stay exactly `contents: read`; no Actions, Checks or Pull Requests token grant is added. Because FanMind is public, admission reads canonical run/PR/check/commit metadata through unauthenticated GitHub GET endpoints and fails closed on HTTP, rate-limit, parse or incomplete-evidence errors. The controller job token is not assumed to have those scopes and is not sent to those endpoints. Tokens and response bodies are not persisted in Project Memory.

The workflow stays `workflow_dispatch` only. It does not restore merge wake-ups, scheduled self-selection or Builder self-selection. A normal merge, deploy or receipt publication does not automatically trigger another Builder.

## Activation boundary

This source task stops at a Draft PR. Merge, auto-merge, deployment, live API trigger and the controlled side-effect-free check run require later explicit authorization. A successful transport response alone is not acceptance.
