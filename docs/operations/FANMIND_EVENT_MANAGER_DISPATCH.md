# FanMind Orchestrator Builder dispatch

## Purpose

`.github/workflows/fanmind-manager-event-dispatch.yml` is the manual, correlated API start path from the FanMind Orchestrator to the published FanMind Builder. It accepts exactly one normal bounded task, one no-write diagnostic probe, or one GET-only follow-up for an existing API run.

The trigger payload is not project evidence. A normal Builder run must re-read current canonical state and return the task-correlated result required by the Orchestrator contract.

## Required configuration

Repository variable:

- `CHATGPT_FANMIND_MANAGER_TRIGGER_ID`: the existing published Workspace Agent API channel ID in `agtch_...` format.

Repository secret:

- `CHATGPT_WORKSPACE_AGENT_ACCESS_TOKEN`: the existing Workspace Agent access token permitted to trigger that published channel.

Neither value may be printed, copied to an artifact, replaced, or inferred from diagnostics. Missing or malformed configuration fails before any API request.

## Modes

Exactly one mode is valid for each workflow invocation:

- Normal dispatch: `task` and the mandatory unique `task_id` are present.
- No-write probe: `diagnostic_probe_id` and `task_id` are present; `task` and `existing_run_id` are empty.
- GET-only follow-up: `existing_run_id` and `task_id` are present; `task` and `diagnostic_probe_id` are empty.

The no-write probe builds only this instruction:

```text
Reply with exactly FANMIND_BUILDER_API_PROBE_OK:<probe-id> and then stop. Do not use repository or provider tools. Do not make product or external writes. Do not create a result receipt or any file.
```

Its success requires both the terminal API status `completed` and that exact correlated confirmation in the linked ChatGPT conversation. API acceptance or `completed` without the chat confirmation is insufficient.

## API and diagnostic contract

The POST is issued once with `OpenAI-Beta: workspace_agent_runs=v1`. A task-bound `Idempotency-Key` identifies that one logical dispatch; the workflow performs no automatic POST retry. A successful start must return a valid `agent_trigger_run_id` (`apirun_...`).

The accepted run ID and conversation URL are written to the diagnostic summary before the first status poll. The workflow then polls `GET /v1/workspace_agents/{agtch_id}/runs/{apirun_id}` within fixed per-request and total budgets. `completed` and `failed` are terminal. `queued`, `in_progress`, and `suspended` remain nonterminal. Exhausting the budget or encountering a bounded GET transport/body-read failure produces `PENDING`, preserves the run ID, and is not reported as run failure. Continue only through the GET-only mode; never repeat the POST merely because polling ended or a GET failed.

HTTP start failures are reported as `HTTP_START_ERROR`. A terminal API run failure is reported separately as `DISPATCH_FAILED`, `RUN_FAILED`, or `FAILED` according to the allowlisted `error.code`. A received non-success GET response is `STATUS_HTTP_ERROR`; a GET transport/body-read exception is `PENDING`. Neither triggers another POST.

Diagnostics retain only:

- HTTP status;
- validated `agent_trigger_run_id`, terminal/nonterminal status and ChatGPT conversation URL;
- bounded `error.code` and `error.message`;
- bounded values for `x-request-id`, `openai-request-id`, `x-correlation-id`, and `traceparent`.

Raw response bodies and unrestricted headers are never logged. Authorization, cookies, tokens, credentials, unknown response fields, and non-JSON bodies are discarded.

## Current incident evidence

Reference run `37229083406` / job `111514744249` reached the single POST and received HTTP 409. The published API documents 409 as a channel/agent-not-runnable start rejection. The retained evidence does not include an allowlisted API error code or request correlation ID, so the exact reason for this instance is not yet proven.

The prior path omitted `OpenAI-Beta: workspace_agent_runs=v1`, did not poll the run endpoint, and copied up to 2,000 raw response bytes into the job summary. The missing beta header is proven to prevent reliable `apirun_...` acquisition and follow-up diagnosis; it is not evidence that the header omission caused the 409. Remaining hypotheses, to be separated by one reviewed no-write probe, include channel publication/runnability state and token-to-channel access state. No token, channel, agent, permission, or secret change is justified before that evidence exists.

## Security boundary

The API trigger grants no Staging, Production, database, provider, payment, destructive, credential, or permission authority. The diagnostic probe must not use tools or produce repository receipts/files. Merging this repository change does not authorize or perform a live API POST; the one-time probe remains a separate reviewed action.
