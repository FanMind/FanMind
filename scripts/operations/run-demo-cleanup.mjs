#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DEFAULT_ENV_FILE = "/var/www/fanmind/.env.production";
const DEFAULT_CLEANUP_URL = "https://fanmind.ch/api/demo/cleanup";
const DEFAULT_LIMIT = 25;
const SAFE_CLEANUP_ERROR_CODES = new Set([
  "demo_cleanup_not_configured",
  "demo_delete_auth_user_failed",
  "demo_delete_contact_ai_profiles_failed",
  "demo_delete_contact_reply_targets_failed",
  "demo_delete_contacts_failed",
  "demo_delete_conversation_messages_failed",
  "demo_delete_conversation_summaries_failed",
  "demo_delete_conversations_failed",
  "demo_delete_failed",
  "demo_delete_fan_analysis_reports_failed",
  "demo_delete_followups_failed",
  "demo_delete_memories_failed",
  "demo_delete_workspace_failed",
  "demo_delete_workspace_members_failed",
  "demo_identity_not_temporary",
  "demo_workspace_identity_mismatch",
]);
const SAFE_CLEANUP_WORKER_ERROR_CODES = new Set([
  "demo_cleanup_http_failed",
  "demo_cleanup_items_failed",
  "demo_cleanup_request_failed",
  "demo_cleanup_response_invalid",
]);

function cleanupWorkerError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

export function cleanupWorkerErrorCode(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  return SAFE_CLEANUP_WORKER_ERROR_CODES.has(code)
    ? code
    : "demo_cleanup_failed";
}

export function normalizeCleanupCount(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 100
    ? value
    : null;
}

export function parseEnvText(text) {
  const values = new Map();
  for (const rawLine of text.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const separator = line.indexOf("=");
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

export function normalizeCleanupErrorCodes(value) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.flatMap((entry) => {
        if (typeof entry !== "string") return [];
        const code = entry.trim().toLowerCase();
        return SAFE_CLEANUP_ERROR_CODES.has(code) ? [code] : [];
      }),
    ),
  ].slice(0, 10);
}

export async function runDemoCleanup({
  envFile = process.env.FANMIND_ENV_FILE || DEFAULT_ENV_FILE,
  cleanupUrl = process.env.FANMIND_DEMO_CLEANUP_URL || DEFAULT_CLEANUP_URL,
  fetchImpl = globalThis.fetch,
  log = console.log,
  errorLog = console.error,
} = {}) {
  let text;
  try {
    text = await readFile(envFile, "utf8");
  } catch {
    errorLog("FANMIND_DEMO_CLEANUP_SKIPPED=env_unreadable");
    return { skipped: true, ok: false, reason: "env_unreadable" };
  }

  const values = parseEnvText(text);
  const secret = values.get("FANMIND_DEMO_CLEANUP_SECRET")?.trim() ?? "";
  if (secret.length < 32) {
    log("FanMind demo cleanup skipped: cleanup secret is not configured.");
    return { skipped: true, ok: true, reason: "secret_missing" };
  }

  const configuredLimit = Number(values.get("FANMIND_DEMO_CLEANUP_LIMIT"));
  const limit = Number.isInteger(configuredLimit) && configuredLimit > 0
    ? Math.min(configuredLimit, 100)
    : DEFAULT_LIMIT;

  let response;
  try {
    response = await fetchImpl(cleanupUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ limit }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw cleanupWorkerError("demo_cleanup_request_failed");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw cleanupWorkerError("demo_cleanup_http_failed");
  }

  const claimed = normalizeCleanupCount(payload?.claimed);
  const deleted = normalizeCleanupCount(payload?.deleted);
  const failed = normalizeCleanupCount(payload?.failed);
  if (claimed === null || deleted === null || failed === null) {
    throw cleanupWorkerError("demo_cleanup_response_invalid");
  }
  const errorCodes = normalizeCleanupErrorCodes(payload?.errorCodes);
  const codeSuffix = errorCodes.length
    ? ` error_codes=${errorCodes.join(",")}`
    : "";
  log(
    `FanMind demo cleanup: claimed=${claimed} deleted=${deleted} failed=${failed}${codeSuffix}`,
  );

  if (failed > 0 || payload?.ok !== true) {
    throw cleanupWorkerError("demo_cleanup_items_failed");
  }

  return { skipped: false, ok: true, claimed, deleted, failed };
}

async function main() {
  await runDemoCleanup();
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(`FANMIND_DEMO_CLEANUP_ERROR=${cleanupWorkerErrorCode(error)}`);
    process.exitCode = 1;
  });
}
