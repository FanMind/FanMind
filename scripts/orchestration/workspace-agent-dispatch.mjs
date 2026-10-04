import { appendFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const API_ORIGIN = "https://api.chatgpt.com";
const BETA_HEADER = "workspace_agent_runs=v1";
const MAX_BODY_BYTES = 16_384;
const MAX_MESSAGE_CHARS = 500;
const REQUEST_ID_HEADERS = [
  "x-request-id",
  "openai-request-id",
  "x-correlation-id",
  "traceparent",
];
const ACTIVE_STATUSES = new Set(["queued", "in_progress", "suspended"]);

function cleanText(value, maxLength = MAX_MESSAGE_CHARS) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanIdentifier(value, pattern) {
  return typeof value === "string" && pattern.test(value) ? value : "";
}

async function readBoundedText(response, limit = MAX_BODY_BYTES) {
  if (!response.body?.getReader) {
    return (await response.text()).slice(0, limit);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (size < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = limit - size;
    chunks.push(value.subarray(0, remaining));
    size += Math.min(value.byteLength, remaining);
    if (value.byteLength > remaining || size === limit) {
      await reader.cancel();
      break;
    }
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map(Buffer.from)));
}

function allowlistedHeaders(headers) {
  return Object.fromEntries(
    REQUEST_ID_HEADERS.flatMap((name) => {
      const value = cleanText(headers.get(name), 200);
      return value && /^[A-Za-z0-9._:/=-]+$/u.test(value) ? [[name, value]] : [];
    }),
  );
}

async function diagnoseResponse(response) {
  const text = await readBoundedText(response);
  let body = {};
  try {
    body = JSON.parse(text);
  } catch {
    // Non-JSON bodies are intentionally not retained or logged.
  }

  const error = body?.error && typeof body.error === "object" ? body.error : {};
  return {
    httpStatus: response.status,
    requestIds: allowlistedHeaders(response.headers),
    conversationUrl:
      typeof body?.conversation_url === "string" &&
      /^https:\/\/chatgpt\.com\//u.test(body.conversation_url)
        ? body.conversation_url.slice(0, 500)
        : "",
    runId: cleanIdentifier(body?.agent_trigger_run_id, /^apirun_[A-Za-z0-9_-]+$/u),
    status: cleanIdentifier(body?.status, /^(queued|in_progress|suspended|completed|failed)$/u),
    error: {
      code: cleanIdentifier(error.code, /^[a-z][a-z0-9_-]{0,63}$/u),
      message: cleanText(error.message),
    },
  };
}

function writeSummaryLine(summary, line) {
  summary.push(line);
}

function addHttpDiagnostic(summary, diagnostic) {
  writeSummaryLine(summary, `- HTTP status: \`${diagnostic.httpStatus}\``);
  for (const [name, value] of Object.entries(diagnostic.requestIds)) {
    writeSummaryLine(summary, `- ${name}: \`${value}\``);
  }
  if (diagnostic.error.code) {
    writeSummaryLine(summary, `- API error code: \`${diagnostic.error.code}\``);
  }
  if (diagnostic.error.message) {
    writeSummaryLine(summary, `- API error message: ${diagnostic.error.message}`);
  }
}

export async function runWorkspaceAgentDispatch({
  token,
  triggerId,
  taskId,
  payload,
  existingRunId = "",
  idempotencyKey = "",
  pollAttempts = 12,
  pollIntervalMs = 10_000,
  getTimeoutMs = 15_000,
  fetchImpl = globalThis.fetch,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  persistAccepted = async () => {},
}) {
  if (!cleanIdentifier(triggerId, /^agtch_[A-Za-z0-9_-]+$/u)) {
    throw new Error("invalid trigger id");
  }
  if (!cleanIdentifier(taskId, /^[A-Za-z0-9][A-Za-z0-9._:-]{2,159}$/u)) {
    throw new Error("invalid task id");
  }
  if (!Number.isSafeInteger(pollAttempts) || pollAttempts < 1 || pollAttempts > 60) {
    throw new Error("invalid polling budget");
  }
  if (!Number.isSafeInteger(getTimeoutMs) || getTimeoutMs < 1_000 || getTimeoutMs > 60_000) {
    throw new Error("invalid GET timeout");
  }

  const summary = ["### FanMind Builder API diagnostic", `- Task ID: \`${cleanText(taskId, 200)}\``];
  let runId = cleanIdentifier(existingRunId, /^apirun_[A-Za-z0-9_-]+$/u);
  let conversationUrl = "";

  if (!runId) {
    if (!payload || !idempotencyKey) throw new Error("dispatch payload and idempotency key are required");
    const response = await fetchImpl(`${API_ORIGIN}/v1/workspace_agents/${triggerId}/trigger`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        "OpenAI-Beta": BETA_HEADER,
      },
      body: payload,
      redirect: "error",
    });
    const diagnostic = await diagnoseResponse(response);
    if (response.status < 200 || response.status >= 300) {
      writeSummaryLine(summary, "- Result: `HTTP_START_ERROR`");
      addHttpDiagnostic(summary, diagnostic);
      return { exitCode: 1, result: "HTTP_START_ERROR", summary };
    }
    if (!diagnostic.runId) {
      writeSummaryLine(summary, "- Result: `START_RESPONSE_INVALID`");
      addHttpDiagnostic(summary, diagnostic);
      writeSummaryLine(summary, "- The beta start response did not contain a valid `agent_trigger_run_id`.");
      return { exitCode: 1, result: "START_RESPONSE_INVALID", summary };
    }
    runId = diagnostic.runId;
    conversationUrl = diagnostic.conversationUrl;
    writeSummaryLine(summary, `- Start accepted: HTTP \`${diagnostic.httpStatus}\``);
    addHttpDiagnostic(summary, { ...diagnostic, httpStatus: diagnostic.httpStatus });
  } else {
    writeSummaryLine(summary, "- Mode: `GET_ONLY`");
  }

  writeSummaryLine(summary, `- Trigger run: \`${runId}\``);
  if (conversationUrl) writeSummaryLine(summary, `- Workspace Agent conversation: ${conversationUrl}`);
  await persistAccepted([...summary]);

  for (let attempt = 1; attempt <= pollAttempts; attempt += 1) {
    if (attempt > 1) await sleep(pollIntervalMs);
    let response;
    let diagnostic;
    try {
      response = await fetchImpl(
        `${API_ORIGIN}/v1/workspace_agents/${triggerId}/runs/${runId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "OpenAI-Beta": BETA_HEADER,
          },
          redirect: "error",
          signal: AbortSignal.timeout(getTimeoutMs),
        },
      );
      diagnostic = await diagnoseResponse(response);
    } catch {
      writeSummaryLine(summary, "- Result: `PENDING`");
      writeSummaryLine(summary, "- Last status check: bounded GET transport/body-read failure.");
      writeSummaryLine(summary, "- The accepted run ID remains valid for GET-only continuation; no POST was retried.");
      return { exitCode: 0, result: "PENDING", runId, conversationUrl, summary };
    }
    if (response.status < 200 || response.status >= 300) {
      writeSummaryLine(summary, "- Result: `STATUS_HTTP_ERROR`");
      addHttpDiagnostic(summary, diagnostic);
      return { exitCode: 1, result: "STATUS_HTTP_ERROR", runId, conversationUrl, summary };
    }
    if (diagnostic.status === "completed") {
      writeSummaryLine(summary, "- Result: `COMPLETED`");
      writeSummaryLine(summary, "- Terminal API status: `completed`");
      return { exitCode: 0, result: "COMPLETED", runId, conversationUrl, summary };
    }
    if (diagnostic.status === "failed") {
      const result =
        diagnostic.error.code === "dispatch_failed"
          ? "DISPATCH_FAILED"
          : diagnostic.error.code === "run_failed"
            ? "RUN_FAILED"
            : "FAILED";
      writeSummaryLine(summary, `- Result: \`${result}\``);
      writeSummaryLine(summary, "- Terminal API status: `failed`");
      if (diagnostic.error.code) writeSummaryLine(summary, `- Run error code: \`${diagnostic.error.code}\``);
      if (diagnostic.error.message) writeSummaryLine(summary, `- Run error message: ${diagnostic.error.message}`);
      return { exitCode: 1, result, runId, conversationUrl, summary };
    }
    if (!ACTIVE_STATUSES.has(diagnostic.status)) {
      writeSummaryLine(summary, "- Result: `STATUS_RESPONSE_INVALID`");
      addHttpDiagnostic(summary, diagnostic);
      return { exitCode: 1, result: "STATUS_RESPONSE_INVALID", runId, conversationUrl, summary };
    }
  }

  writeSummaryLine(summary, "- Result: `PENDING`");
  writeSummaryLine(summary, "- Polling budget exhausted without a terminal state; this is not a run failure.");
  writeSummaryLine(summary, "- Continue only with a GET-only check for the recorded run ID; do not repeat the POST.");
  return { exitCode: 0, result: "PENDING", runId, conversationUrl, summary };
}

async function main() {
  const existingRunId = process.env.EXISTING_TRIGGER_RUN_ID ?? "";
  const payload = existingRunId ? "" : await readFile(process.env.PAYLOAD_FILE, "utf8");
  let persistedLineCount = 0;
  const result = await runWorkspaceAgentDispatch({
    token: process.env.AGENT_ACCESS_TOKEN,
    triggerId: process.env.AGENT_TRIGGER_ID,
    taskId: process.env.REQUESTED_TASK_ID,
    payload,
    existingRunId,
    idempotencyKey: process.env.IDEMPOTENCY_KEY ?? "",
    pollAttempts: Number(process.env.POLL_ATTEMPTS ?? 12),
    pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 10_000),
    getTimeoutMs: Number(process.env.GET_TIMEOUT_MS ?? 15_000),
    persistAccepted: async (lines) => {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
      persistedLineCount = lines.length;
    },
  });
  const remaining = result.summary.slice(persistedLineCount);
  if (remaining.length > 0) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${remaining.join("\n")}\n`);
  }
  process.exitCode = result.exitCode;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
