#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const VERSION = "fanmind-operations-monitor-migration-1";
const MAX_INPUT_BYTES = 65536;
const ACTIONS = new Set(["verify", "apply"]);
const SUCCESS_STATUSES = new Set(["verified", "applied", "already_applied"]);
const ERROR_CODES = new Set([
  "apply_confirmation_invalid",
  "apply_failed",
  "argument_invalid",
  "base_preflight_failed",
  "connection_redirect_invalid",
  "database_identity_invalid",
  "database_port_invalid",
  "database_project_binding_invalid",
  "installed_migration_permissions_invalid",
  "live_version_invalid",
  "live_version_unavailable",
  "migration_checksum_mismatch",
  "migration_contract_invalid",
  "migration_file_invalid",
  "migration_unreadable",
  "passfile_changed",
  "passfile_invalid",
  "passfile_path_invalid",
  "passfile_read_failed",
  "postflight_failed",
  "project_binding_missing",
  "psql_unavailable",
  "release_commit_invalid",
  "release_commit_mismatch",
  "root_required",
  "runtime_environment_invalid",
  "schema_not_ready",
  "unexpected_failure",
  "verify_confirmation_invalid",
]);

function fail(code) {
  throw new Error(`operations_monitor_migration_log_${code}`);
}

export function verifyOperationsMonitorMigrationLog(source, notBefore, action) {
  if (
    typeof source !== "string" ||
    source.includes("\0") ||
    Buffer.byteLength(source, "utf8") > MAX_INPUT_BYTES
  ) {
    fail("input_invalid");
  }
  const notBeforeMs = Date.parse(notBefore ?? "");
  if (!Number.isFinite(notBeforeMs)) fail("not_before_invalid");
  if (!ACTIONS.has(action)) fail("action_invalid");

  let latest = null;
  for (const line of source.split(/\r?\n/u)) {
    if (!line || Buffer.byteLength(line, "utf8") > 2048) continue;
    let payload;
    try {
      payload = JSON.parse(line);
    } catch {
      continue;
    }
    const timestamp = Date.parse(payload?.ts ?? "");
    if (
      !Number.isFinite(timestamp) ||
      timestamp < notBeforeMs ||
      timestamp > Date.now() + 300000 ||
      payload?.version !== VERSION ||
      payload?.action !== action
    ) {
      continue;
    }

    let result = null;
    if (
      payload?.level === "info" &&
      payload?.event === "migration_status" &&
      SUCCESS_STATUSES.has(payload?.status)
    ) {
      if (
        (action === "verify" && payload.status !== "verified") ||
        (action === "apply" && !["applied", "already_applied"].includes(payload.status))
      ) {
        continue;
      }
      result = { action, status: payload.status, errorCode: null };
    } else if (
      payload?.level === "error" &&
      payload?.event === "migration_failed" &&
      ERROR_CODES.has(payload?.error_code)
    ) {
      result = { action, status: "failed", errorCode: payload.error_code };
    }

    if (result && (!latest || timestamp >= latest.timestamp)) {
      latest = { ...result, timestamp };
    }
  }
  if (!latest) fail("diagnostic_missing");
  return {
    action: latest.action,
    status: latest.status,
    errorCode: latest.errorCode,
  };
}

export function formatOperationsMonitorMigrationDiagnostic(result) {
  const lines = [
    `OPERATIONS_MONITOR_MIGRATION_ACTION=${result.action}`,
    `OPERATIONS_MONITOR_MIGRATION_RESULT=${result.status}`,
  ];
  if (result.errorCode) {
    lines.push(`OPERATIONS_MONITOR_MIGRATION_ERROR=${result.errorCode}`);
  }
  return `${lines.join("\n")}\n`;
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (direct) {
  const [sourcePath, notBefore, action] = process.argv.slice(2);
  if (!sourcePath || !notBefore || !action) fail("arguments_invalid");
  const source = await readFile(sourcePath, "utf8");
  process.stdout.write(
    formatOperationsMonitorMigrationDiagnostic(
      verifyOperationsMonitorMigrationLog(source, notBefore, action),
    ),
  );
}
