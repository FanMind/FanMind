#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DEFAULT_ENV_FILE = "/var/www/fanmind/.env.production";
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_DELETE_LIMIT = 500;
const MAX_DELETE_LIMIT = 5000;

function parseEnvText(text) {
  const values = new Map();
  for (const rawLine of String(text).split(/\r?\n/u)) {
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

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function parseRpcRow(payload, kind) {
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row || typeof row !== "object") throw new Error(`${kind}_response_invalid`);

  const candidateCount = Number(row.candidate_count ?? 0);
  const deletedCount = Number(row.deleted_count ?? 0);
  const hasMore = row.has_more;
  const tablePresent = kind === "server_error" ? row.table_present : true;

  if (
    !Number.isInteger(candidateCount) ||
    candidateCount < 0 ||
    candidateCount > MAX_DELETE_LIMIT ||
    !Number.isInteger(deletedCount) ||
    deletedCount < 0 ||
    deletedCount > MAX_DELETE_LIMIT ||
    typeof hasMore !== "boolean" ||
    typeof tablePresent !== "boolean"
  ) {
    throw new Error(`${kind}_response_invalid`);
  }

  return { candidateCount, deletedCount, hasMore, tablePresent };
}

async function callRetentionRpc({
  baseUrl,
  serviceKey,
  functionName,
  retentionDays,
  limit,
  execute,
  fetchImpl,
  kind,
}) {
  let response;
  try {
    response = await fetchImpl(
      `${baseUrl}/rest/v1/rpc/${functionName}`,
      {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_retention_days: retentionDays,
          p_limit: limit,
          p_execute: execute,
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
  } catch {
    throw new Error(`${kind}_request_failed`);
  }

  if (!response.ok) throw new Error(`${kind}_rpc_failed`);
  const payload = await response.json().catch(() => null);
  return parseRpcRow(payload, kind);
}

async function runWebhookDiagnosticRetention({
  envFile = process.env.FANMIND_ENV_FILE || DEFAULT_ENV_FILE,
  execute = process.argv.includes("--execute"),
  fetchImpl = globalThis.fetch,
  log = console.log,
} = {}) {
  let envText;
  try {
    envText = await readFile(envFile, "utf8");
  } catch {
    throw new Error("environment_unreadable");
  }
  const values = parseEnvText(envText);
  const baseUrl = String(values.get("NEXT_PUBLIC_SUPABASE_URL") ?? "")
    .trim()
    .replace(/\/$/u, "");
  const serviceKey = String(values.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/u.test(baseUrl)) {
    throw new Error("supabase_url_invalid");
  }
  if (serviceKey.length < 32) throw new Error("service_role_unavailable");

  const retentionDays = boundedInteger(
    values.get("FANMIND_WEBHOOK_DIAGNOSTIC_RETENTION_DAYS"),
    DEFAULT_RETENTION_DAYS,
    1,
    365,
  );
  const limit = boundedInteger(
    values.get("FANMIND_WEBHOOK_DIAGNOSTIC_DELETE_LIMIT"),
    DEFAULT_DELETE_LIMIT,
    1,
    MAX_DELETE_LIMIT,
  );

  const meta = await callRetentionRpc({
    baseUrl,
    serviceKey,
    functionName: "manage_meta_webhook_event_retention",
    retentionDays,
    limit,
    execute,
    fetchImpl,
    kind: "meta",
  });
  const serverError = await callRetentionRpc({
    baseUrl,
    serviceKey,
    functionName: "manage_server_error_event_retention",
    retentionDays,
    limit,
    execute,
    fetchImpl,
    kind: "server_error",
  });

  log(`WEBHOOK_RETENTION_MODE=${execute ? "execute" : "dry_run"}`);
  log(`WEBHOOK_RETENTION_DAYS=${retentionDays}`);
  log(`WEBHOOK_RETENTION_LIMIT=${limit}`);
  log(`META_DIAGNOSTIC_CANDIDATES=${meta.candidateCount}`);
  log(`META_DIAGNOSTIC_DELETED=${meta.deletedCount}`);
  log(`META_DIAGNOSTIC_HAS_MORE=${meta.hasMore}`);
  log(`SERVER_ERROR_TABLE_PRESENT=${serverError.tablePresent}`);
  log(`SERVER_ERROR_CANDIDATES=${serverError.candidateCount}`);
  log(`SERVER_ERROR_DELETED=${serverError.deletedCount}`);
  log(`SERVER_ERROR_HAS_MORE=${serverError.hasMore}`);
  log("WEBHOOK_RETENTION_RESULT=success");

  return { execute, retentionDays, limit, meta, serverError };
}

async function main() {
  await runWebhookDiagnosticRetention();
}

export {
  MAX_DELETE_LIMIT,
  parseEnvText,
  parseRpcRow,
  runWebhookDiagnosticRetention,
};

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    const code =
      error instanceof Error && /^[a-z0-9_]{1,64}$/u.test(error.message)
        ? error.message
        : "webhook_retention_failed";
    console.error(`WEBHOOK_RETENTION_RESULT=failed`);
    console.error(`WEBHOOK_RETENTION_REASON=${code}`);
    process.exitCode = 1;
  });
}
