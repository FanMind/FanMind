#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const VERSION = "fanmind-operations-monitor-1";
const MAX_INPUT_BYTES = 65536;
const COMPONENTS = new Set([
  "application",
  "pm2",
  "host_disk",
  "host_memory",
  "ssl_certificate",
  "backup_freshness",
  "backup_worker",
  "unknown_component",
]);
const UNHEALTHY_STATUSES = new Set(["unknown", "degraded", "unavailable"]);

function fail(code) {
  throw new Error(`operations_monitor_probe_log_${code}`);
}

function parseHealthGateCode(value) {
  const prefix = "operations_monitor_health_gate_failed|";
  if (!value.startsWith(prefix)) return null;
  const entries = value.slice(prefix.length).split(",");
  const seen = new Set();
  const checks = [];
  for (const entry of entries) {
    const [component, status, extra] = entry.split(":");
    if (
      extra !== undefined ||
      !COMPONENTS.has(component) ||
      !UNHEALTHY_STATUSES.has(status) ||
      seen.has(component)
    ) {
      fail("health_gate_invalid");
    }
    seen.add(component);
    checks.push(`${component}:${status}`);
  }
  if (checks.length === 0 || checks.length > COMPONENTS.size) {
    fail("health_gate_invalid");
  }
  return checks.sort();
}

function parseSafeErrorCode(value) {
  if (typeof value !== "string" || value.length > 400) return null;
  const checks = parseHealthGateCode(value);
  if (checks) return { diagnosis: "health_gate", checks };
  if (value === "operations_monitor_supabase_config_missing") {
    return { diagnosis: "supabase_config_missing", checks: [] };
  }
  if (/^operations_store_[1-5][0-9]{2}$/u.test(value)) {
    return { diagnosis: value, checks: [] };
  }
  if (value === "operations_monitor_failed") {
    return { diagnosis: "unknown", checks: [] };
  }
  return null;
}

export function verifyOperationsMonitorProbeLog(source, notBefore) {
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
    if (
      !Number.isFinite(timestamp) ||
      timestamp < notBeforeMs ||
      timestamp > Date.now() + 300000 ||
      payload?.version !== VERSION ||
      payload?.level !== "error" ||
      payload?.event !== "monitor_failed"
    ) {
      continue;
    }
    const safe = parseSafeErrorCode(payload?.error_code);
    if (safe && (!latest || timestamp >= latest.timestamp)) {
      latest = { ...safe, timestamp };
    }
  }
  if (!latest) fail("diagnostic_missing");
  return { diagnosis: latest.diagnosis, checks: latest.checks };
}

export function formatOperationsMonitorProbeDiagnostic(result) {
  const lines = [`OPERATIONS_MONITOR_PROBE_DIAGNOSIS=${result.diagnosis}`];
  for (const check of result.checks) {
    lines.push(`OPERATIONS_MONITOR_UNHEALTHY_CHECK=${check}`);
  }
  return `${lines.join("\n")}\n`;
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (direct) {
  const [sourcePath, notBefore] = process.argv.slice(2);
  if (!sourcePath || !notBefore) fail("arguments_invalid");
  const source = await readFile(sourcePath, "utf8");
  process.stdout.write(
    formatOperationsMonitorProbeDiagnostic(
      verifyOperationsMonitorProbeLog(source, notBefore),
    ),
  );
}
