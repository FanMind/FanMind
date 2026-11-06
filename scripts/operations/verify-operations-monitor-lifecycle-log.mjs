#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const VERSION = "fanmind-operations-monitor-lifecycle-1";
const MAX_INPUT_BYTES = 65536;
const SAFE_ERRORS = new Set([
  "operations_monitor_lifecycle_contract",
  "operations_monitor_lifecycle_email_not_disabled",
  "operations_monitor_lifecycle_warning_state",
  "operations_monitor_lifecycle_critical_state",
  "operations_monitor_lifecycle_recovery_state",
  "operations_monitor_lifecycle_email_audit",
  "operations_monitor_lifecycle_cleanup_failed",
  "operations_monitor_supabase_config_missing",
  "operations_monitor_failed",
]);

function fail(code) {
  throw new Error(`operations_monitor_lifecycle_log_${code}`);
}

function safeErrorCode(value) {
  if (SAFE_ERRORS.has(value)) return value;
  if (/^operations_store_[1-5][0-9]{2}$/u.test(value)) return value;
  return null;
}

export function verifyOperationsMonitorLifecycleLog(source, notBefore) {
  if (
    typeof source !== "string" ||
    source.includes("\0") ||
    Buffer.byteLength(source, "utf8") > MAX_INPUT_BYTES
  ) {
    fail("input_invalid");
  }
  const notBeforeMs = Date.parse(notBefore ?? "");
  if (!Number.isFinite(notBeforeMs)) fail("not_before_invalid");

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
    const errorCode = safeErrorCode(payload?.error_code);
    if (
      !Number.isFinite(timestamp) ||
      timestamp < notBeforeMs ||
      timestamp > Date.now() + 300000 ||
      payload?.version !== VERSION ||
      payload?.level !== "error" ||
      payload?.event !== "lifecycle_failed" ||
      !errorCode
    ) {
      continue;
    }
    if (!latest || timestamp >= latest.timestamp) {
      latest = { errorCode, timestamp };
    }
  }
  if (!latest) fail("diagnostic_missing");
  return { status: "failed", errorCode: latest.errorCode };
}

export function formatOperationsMonitorLifecycleDiagnostic(result) {
  return [
    "OPERATIONS_MONITOR_LIFECYCLE=failed",
    `OPERATIONS_MONITOR_LIFECYCLE_ERROR=${result.errorCode}`,
    "",
  ].join("\n");
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (direct) {
  const [sourcePath, notBefore] = process.argv.slice(2);
  if (!sourcePath || !notBefore) fail("arguments_invalid");
  const source = await readFile(sourcePath, "utf8");
  process.stdout.write(
    formatOperationsMonitorLifecycleDiagnostic(
      verifyOperationsMonitorLifecycleLog(source, notBefore),
    ),
  );
}
