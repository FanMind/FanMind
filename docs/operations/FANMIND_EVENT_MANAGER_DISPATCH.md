# FanMind event-driven manager dispatch

## Purpose

FanMind must not depend on nominal ChatGPT task start times. The canonical Project Memory, current GitHub state, locks and dependencies remain the coordination plane. The event dispatcher is only a low-latency wake-up path.

## Architecture

1. A pull request is merged into `main`.
2. `.github/workflows/fanmind-manager-event-dispatch.yml` runs.
3. If configured, the workflow sends a narrow wake-up event to the published FanMind Workspace Manager through the ChatGPT Workspace Agents API.
4. The manager re-runs the full FanMind preflight against current `main`, reconciles actual evidence, recomputes the SAFE READY SET and continues safe work.
5. The existing hourly Builder remains the fallback if an event is missed, the API is unavailable or the dispatcher is not configured.

The event payload is never project evidence. It contains only enough immutable GitHub metadata to identify the wake-up event. Every project-state claim must be re-read from canonical sources and current connected evidence.

## Required configuration

Repository variable:

- `CHATGPT_FANMIND_MANAGER_TRIGGER_ID`: published Workspace Agent API channel ID in `agtch_...` format.

Repository secret:

- `CHATGPT_WORKSPACE_AGENT_ACCESS_TOKEN`: Workspace Agent access token with permission to trigger that published manager.

If either value is absent, the workflow exits successfully with a notice and performs no external call. This preserves the scheduled Builder as the operational fallback and avoids breaking repository CI before the external trigger is provisioned.

## Manager contract

The published manager should use the existing FanMind Builder/Manager instructions and must:

- run the complete mandatory preflight on every trigger;
- treat the trigger payload as a wake-up signal only;
- re-read current GitHub main, PR/CI/review state, Project Memory, runtime/provider evidence, STARTED_WORK, WORK_LOCKS and DEPENDENCIES;
- recompute the SAFE READY SET rather than assuming the triggering PR determines the next task;
- honor the default maximum of three independent workers;
- serialize any uncertain overlap;
- never infer Owner/protected/environment authorization from a merge event;
- return NO_CHANGE rather than manufacturing work when nothing is safely executable.

## Idempotency and loops

Merge events use an idempotency key bound to PR number and merge SHA. Retrying the same merge should not enqueue duplicate agent work. A manager-created follow-up PR may intentionally create a later merge event; anti-loop rules in Project Memory remain authoritative and must stop no-change receipt churn.

## Security boundary

The access token is stored only as a GitHub Actions secret and is never written to Project Memory, workflow summaries or logs. The API trigger does not itself authorize Staging/Production/database/provider/payment/destructive actions.

## Activation check

After the external Workspace Agent is published and both configuration values exist, run the workflow manually once. A successful dispatch reports HTTP 202. Then merge one normal bounded PR and confirm one event dispatch occurs. The manager must independently re-read current state before acting.
