import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ORCHESTRATOR_RECEIPT_PATH,
  classifyManagerPrFiles,
} from "../scripts/orchestration/classify-manager-pr-files.mjs";
import { runWorkspaceAgentDispatch } from "../scripts/orchestration/workspace-agent-dispatch.mjs";

const file = (filename) => ({ filename });
const jsonResponse = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const unreadableResponse = () => ({
  status: 200,
  headers: new Headers(),
  body: {
    getReader: () => ({
      read: async () => {
        throw new Error("synthetic body read failure");
      },
    }),
  },
});
const common = {
  token: "test-token-never-logged",
  triggerId: "agtch_test",
  taskId: "task-test",
  payload: JSON.stringify({ input: "bounded" }),
  idempotencyKey: "fanmind-builder-task-test",
  pollIntervalMs: 0,
  sleep: async () => {},
};

test("suppresses only a complete receipt-only merged PR", () => {
  assert.deepEqual(
    classifyManagerPrFiles({
      pages: [[file(ORCHESTRATOR_RECEIPT_PATH)]],
      expectedChangedFiles: 1,
    }),
    { receiptOnly: true, classification: "receipt_only", observedCount: 1 },
  );
});

test("dispatches product-only and mixed receipt/product merged PRs", () => {
  for (const pages of [
    [[file("src/app/page.tsx")]],
    [[file(ORCHESTRATOR_RECEIPT_PATH), file("src/app/page.tsx")]],
  ]) {
    const result = classifyManagerPrFiles({
      pages,
      expectedChangedFiles: pages[0].length,
    });
    assert.equal(result.receiptOnly, false);
    assert.equal(result.classification, "dispatch");
  }
});

test("incomplete or malformed enumeration is uncertain and never receipt-only", () => {
  for (const input of [
    { pages: [[file(ORCHESTRATOR_RECEIPT_PATH)]], expectedChangedFiles: 2 },
    { pages: [[{}]], expectedChangedFiles: 1 },
    { pages: null, expectedChangedFiles: 1 },
  ]) {
    const result = classifyManagerPrFiles(input);
    assert.equal(result.receiptOnly, false);
    assert.equal(result.classification, "uncertain");
  }
});

test("a rejected start is one HTTP_START_ERROR with bounded allowlisted diagnostics", async () => {
  const calls = [];
  const result = await runWorkspaceAgentDispatch({
    ...common,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse(
        409,
        {
          error: {
            code: "channel_not_runnable",
            message: `conflict\n${"x".repeat(800)}`,
            secret: "must-not-appear",
          },
          access_token: "must-not-appear",
        },
        {
          "x-request-id": "req_test-409",
          authorization: "must-not-appear",
          cookie: "must-not-appear",
        },
      );
    },
  });

  assert.equal(result.result, "HTTP_START_ERROR");
  assert.equal(result.exitCode, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["OpenAI-Beta"], "workspace_agent_runs=v1");
  assert.equal(calls[0].options.headers["Idempotency-Key"], common.idempotencyKey);
  assert.equal(calls[0].options.redirect, "error");
  const summary = result.summary.join("\n");
  assert.match(summary, /req_test-409/u);
  assert.match(summary, /channel_not_runnable/u);
  assert.doesNotMatch(summary, /must-not-appear|test-token/u);
  assert.ok(summary.length < 2_000);
});

test("suspended is nonterminal and completed is terminal", async () => {
  const calls = [];
  const responses = [
    jsonResponse(202, {
      conversation_url: "https://chatgpt.com/g/g-test/c/test",
      agent_trigger_run_id: "apirun_test123",
    }),
    jsonResponse(200, { status: "suspended" }),
    jsonResponse(200, { status: "completed" }),
  ];
  const result = await runWorkspaceAgentDispatch({
    ...common,
    pollAttempts: 2,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return responses.shift();
    },
  });

  assert.equal(result.result, "COMPLETED");
  assert.equal(result.runId, "apirun_test123");
  assert.deepEqual(calls.map((call) => call.options.method), ["POST", "GET", "GET"]);
  assert.equal(calls[1].options.headers["OpenAI-Beta"], "workspace_agent_runs=v1");
});

test("terminal API errors distinguish dispatch_failed and run_failed", async () => {
  for (const [code, expected] of [
    ["dispatch_failed", "DISPATCH_FAILED"],
    ["run_failed", "RUN_FAILED"],
  ]) {
    const result = await runWorkspaceAgentDispatch({
      ...common,
      existingRunId: "apirun_existing",
      pollAttempts: 1,
      fetchImpl: async () =>
        jsonResponse(200, { status: "failed", error: { code, message: "bounded" } }),
    });
    assert.equal(result.result, expected);
    assert.equal(result.exitCode, 1);
    assert.match(result.summary.join("\n"), new RegExp(code, "u"));
  }
});

test("GET fetch and body-read failures preserve accepted metadata as PENDING", async (t) => {
  for (const mode of ["accepted-post", "get-only"]) {
    for (const failure of ["fetch", "body-read"]) {
      await t.test(`${mode}: ${failure}`, async () => {
        const calls = [];
        const accepted = [];
        const responses =
          mode === "accepted-post"
            ? [
                jsonResponse(202, {
                  conversation_url: "https://chatgpt.com/g/g-test/c/preserved",
                  agent_trigger_run_id: "apirun_preserved",
                }),
              ]
            : [];
        const result = await runWorkspaceAgentDispatch({
          ...common,
          existingRunId: mode === "get-only" ? "apirun_preserved" : "",
          pollAttempts: 2,
          persistAccepted: async (lines) => accepted.push(lines),
          fetchImpl: async (url, options) => {
            calls.push({ url, options });
            if (responses.length > 0) return responses.shift();
            if (failure === "fetch") throw new TypeError("synthetic fetch failure");
            return unreadableResponse();
          },
        });

        assert.equal(result.result, "PENDING");
        assert.equal(result.exitCode, 0);
        assert.equal(result.runId, "apirun_preserved");
        assert.equal(accepted.length, 1);
        assert.match(accepted[0].join("\n"), /apirun_preserved/u);
        if (mode === "accepted-post") {
          assert.ok(
            accepted[0]
              .join("\n")
              .includes("https://chatgpt.com/g/g-test/c/preserved"),
          );
          assert.deepEqual(calls.map((call) => call.options.method), ["POST", "GET"]);
        } else {
          assert.deepEqual(calls.map((call) => call.options.method), ["GET"]);
        }
        assert.ok(calls.at(-1).options.signal instanceof AbortSignal);
        assert.match(result.summary.join("\n"), /no POST was retried/u);
      });
    }
  }
});

test("poll exhaustion is PENDING and a follow-up is GET-only", async () => {
  const calls = [];
  const result = await runWorkspaceAgentDispatch({
    ...common,
    existingRunId: "apirun_existing",
    pollAttempts: 2,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse(200, { status: "in_progress" });
    },
  });

  assert.equal(result.result, "PENDING");
  assert.equal(result.exitCode, 0);
  assert.deepEqual(calls.map((call) => call.options.method), ["GET", "GET"]);
  assert.match(result.summary.join("\n"), /not a run failure/u);
});

test("workflow exposes bounded probe and GET-only modes without raw dumps", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/fanmind-manager-event-dispatch.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /workflow_dispatch:/u);
  assert.doesNotMatch(workflow, /pull_request:/u);
  assert.match(workflow, /task_id:[\s\S]*required: true/u);
  assert.match(workflow, /diagnostic_probe_id:/u);
  assert.match(workflow, /existing_run_id:/u);
  assert.match(
    workflow,
    /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/u,
  );
  assert.match(workflow, /REQUESTED_TASK: \$\{\{ inputs\.task \}\}/u);
  assert.match(workflow, /REQUESTED_TASK_ID: \$\{\{ inputs\.task_id \}\}/u);
  assert.match(workflow, /sole authority for selecting the next independent FanMind task/u);
  assert.match(workflow, /Do not select, start, continue, or substitute another independent roadmap task/u);
  assert.match(workflow, /Reply with exactly FANMIND_BUILDER_API_PROBE_OK:/u);
  assert.match(workflow, /Do not use repository or provider tools/u);
  assert.match(workflow, /Do not create a result receipt or any file/u);
  assert.match(workflow, /workspace-agent-dispatch\.mjs/u);
  assert.match(workflow, /PAYLOAD_INPUT_BASE64:/u);
  assert.doesNotMatch(workflow, /PAYLOAD_FILE:|payload\.json/u);
  assert.doesNotMatch(workflow, /head -c|Response body:/u);
});
