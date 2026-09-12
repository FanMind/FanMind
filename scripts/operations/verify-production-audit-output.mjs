#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { bootSummaryFromValues } from "./production-boot-readiness.mjs";

import {
  OPTIONAL_PUBLIC_HEALTH_COMPONENTS,
  REQUIRED_PUBLIC_HEALTH_COMPONENTS,
} from "../public-health-policy.mjs";

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const AUDIT_STAGES = new Set([
  "prerequisites", "runtime", "release", "health", "pm2", "env_flags",
  "nginx", "http", "host", "systemd", "boot_readiness", "backup_inventory", "backup_checksum",
  "offsite", "worker",
]);
const BACKUP_MAX_AGE_HOURS = Object.freeze({
  database: 36,
  storage: 36,
  server_config: 36,
  full: 192,
});

class ProductionAuditError extends Error {}

function fail(code) {
  throw new ProductionAuditError(`production_audit_${code}`);
}

export function parseProductionAuditOutput(source) {
  if (typeof source !== "string" || source.includes("\0")) {
    fail("output_invalid");
  }

  const values = new Map();
  for (const rawLine of source.split(/\r?\n/u)) {
    if (!rawLine) continue;
    const match = rawLine.match(/^([A-Z][A-Z0-9_]*)=(.*)$/u);
    if (!match) fail("output_line_invalid");
    const [, key, value] = match;
    const entries = values.get(key) ?? [];
    entries.push(value);
    values.set(key, entries);
  }
  return values;
}

function single(values, key) {
  const entries = values.get(key) ?? [];
  if (entries.length !== 1) fail(`${key.toLowerCase()}_cardinality_invalid`);
  return entries[0];
}

function integer(values, key, { minimum = 0, maximum = Number.MAX_SAFE_INTEGER } = {}) {
  const value = single(values, key);
  if (!/^\d+$/u.test(value)) fail(`${key.toLowerCase()}_invalid`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    fail(`${key.toLowerCase()}_invalid`);
  }
  return parsed;
}

function positiveNumber(value, code) {
  if (!/^\d+(?:\.\d+)?$/u.test(value)) fail(code);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) fail(code);
  return parsed;
}

function httpStatus(values, key) {
  const status = integer(values, key, { minimum: 200, maximum: 399 });
  return status;
}

function healthSummary(values) {
  const expected = [
    ...REQUIRED_PUBLIC_HEALTH_COMPONENTS,
    ...OPTIONAL_PUBLIC_HEALTH_COMPONENTS,
  ];
  const actual = new Map();

  for (const value of values.get("HEALTH_COMPONENT") ?? []) {
    const match = value.match(/^([a-z0-9_]+):(healthy|degraded|unavailable|unknown)$/u);
    if (!match || actual.has(match[1])) fail("health_components_invalid");
    actual.set(match[1], match[2]);
  }

  if (
    actual.size !== expected.length ||
    expected.some((component) => actual.get(component) !== "healthy")
  ) {
    fail("health_components_unhealthy");
  }

  return expected.length;
}

function backupSummary(values) {
  const latest = new Map();
  for (const value of values.get("BACKUP_LATEST") ?? []) {
    const segments = value.split("|");
    const type = segments.shift();
    if (!type || latest.has(type) || !(type in BACKUP_MAX_AGE_HOURS)) {
      fail("backup_latest_invalid");
    }

    const properties = Object.fromEntries(
      segments.map((segment) => {
        const separator = segment.indexOf("=");
        if (separator <= 0) fail("backup_latest_invalid");
        return [segment.slice(0, separator), segment.slice(separator + 1)];
      }),
    );
    if (
      !properties.file ||
      properties.pair !== "complete" ||
      !/^\d+$/u.test(properties.size_bytes ?? "")
    ) {
      fail("backup_latest_invalid");
    }

    const ageHours = positiveNumber(
      properties.age_hours ?? "",
      "backup_latest_age_invalid",
    );
    const sizeBytes = Number(properties.size_bytes);
    if (
      !Number.isSafeInteger(sizeBytes) ||
      sizeBytes <= 0 ||
      ageHours > BACKUP_MAX_AGE_HOURS[type]
    ) {
      fail("backup_latest_stale_or_empty");
    }

    latest.set(type, { ageHours, sizeBytes });
  }

  const requiredTypes = Object.keys(BACKUP_MAX_AGE_HOURS);
  if (
    latest.size !== requiredTypes.length ||
    requiredTypes.some((type) => !latest.has(type))
  ) {
    fail("backup_latest_missing");
  }

  return Object.fromEntries(
    requiredTypes.map((type) => [
      type,
      {
        ageHours: latest.get(type).ageHours,
        sizeBytes: latest.get(type).sizeBytes,
      },
    ]),
  );
}

export function verifyProductionRuntimeOutput(source, expectedCommit) {
  if (!SHA_PATTERN.test(expectedCommit ?? "")) fail("expected_commit_invalid");

  const values = parseProductionAuditOutput(source);

  const auditUtc = single(values, "AUDIT_UTC");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(auditUtc) ||
      !Number.isFinite(Date.parse(auditUtc))) fail("timestamp_invalid");
  const nodeVersion = single(values, "NODE_VERSION");
  const pm2NodeVersion = single(values, "PM2_NODE_VERSION");
  if (!/^v\d+\.\d+\.\d+$/u.test(nodeVersion)) fail("node_version_invalid");
  if (!/^\d+\.\d+\.\d+$/u.test(pm2NodeVersion)) fail("pm2_node_version_invalid");
  const hostUptimeSeconds = integer(values, "HOST_UPTIME_SECONDS");
  const hostBootId = single(values, "HOST_BOOT_ID");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(hostBootId)) {
    fail("host_boot_id_invalid");
  }

  const releaseValues = [
    single(values, "SERVER_HEAD"),
    single(values, "ORIGIN_MAIN"),
    single(values, "LIVE_RELEASE"),
  ];
  if (
    releaseValues.some(
      (value) => !SHA_PATTERN.test(value) || value !== expectedCommit,
    )
  ) {
    fail("release_drift");
  }
  if (single(values, "LIVE_ENVIRONMENT") !== "production") {
    fail("environment_invalid");
  }
  if (single(values, "LIVE_RUNTIME_ENVIRONMENT") !== "production") {
    fail("runtime_environment_invalid");
  }
  if (single(values, "LIVE_HEALTH") !== "healthy") fail("health_unhealthy");

  const healthComponentCount = healthSummary(values);
  if (single(values, "PM2_STATUS") !== "online") fail("pm2_offline");
  if (single(values, "PM2_EXEC_MODE") !== "cluster_mode" ||
      single(values, "PM2_CWD") !== "/var/www/fanmind-current") {
    fail("pm2_launch_contract_invalid");
  }
  const pm2Restarts = integer(values, "PM2_RESTARTS");
  if (integer(values, "PM2_UNSTABLE_RESTARTS") !== 0) {
    fail("pm2_unstable_restarts");
  }
  const pm2UptimeSeconds = integer(values, "PM2_UPTIME_SECONDS");
  const serverErrorTrackingEnabled =
    single(values, "SERVER_ERROR_TRACKING_ENABLED") === "true";
  if (!serverErrorTrackingEnabled) {
    fail("server_error_tracking_disabled");
  }
  if (single(values, "SERVER_ERROR_EMAIL_ENABLED") !== "false") {
    fail("server_error_email_enabled");
  }
  const serverErrorEmailEnabled = false;
  if (single(values, "NGINX_CONFIG") !== "ok") fail("nginx_invalid");
  if (single(values, "NGINX_ACTIVE") !== "active") fail("nginx_inactive");
  const localLoginHttp = httpStatus(values, "LOCAL_LOGIN_HTTP");
  const publicLoginHttp = httpStatus(values, "PUBLIC_LOGIN_HTTP");
  const diskUsedPercent = integer(values, "ROOT_DISK_USED_PERCENT", {
    maximum: 89,
  });
  const memoryAvailableKiB = integer(values, "MEMORY_AVAILABLE_KIB", {
    minimum: 1,
  });
  const rebootRequired = single(values, "REBOOT_REQUIRED");
  if (!["true", "false"].includes(rebootRequired)) {
    fail("reboot_required_invalid");
  }
  const systemdUnitCount = integer(values, "FANMIND_SYSTEMD_UNIT_COUNT", {
    minimum: 1,
  });

  return {
    auditUtc, nodeVersion, pm2NodeVersion, hostUptimeSeconds, hostBootId,
    releaseCommit: expectedCommit, healthComponentCount, pm2Restarts,
    pm2UptimeSeconds, serverErrorTrackingEnabled, serverErrorEmailEnabled,
    localLoginHttp, publicLoginHttp, diskUsedPercent, memoryAvailableKiB,
    rebootRequired: rebootRequired === "true", systemdUnitCount,
    bootReadiness: bootSummaryFromValues(values),
  };
}

export function verifyProductionAuditOutput(source, expectedCommit) {
  if (!SHA_PATTERN.test(expectedCommit ?? "")) fail("expected_commit_invalid");
  const values = parseProductionAuditOutput(source);
  if (single(values, "AUDIT_RESULT") !== "success") fail("result_failed");
  const runtime = verifyProductionRuntimeOutput(source, expectedCommit);

  if (single(values, "BACKUP_ROOT") !== "available") {
    fail("backup_root_unavailable");
  }
  const backupCompletePairCount = integer(values, "BACKUP_COMPLETE_PAIR_COUNT", {
    minimum: 4,
  });
  if (integer(values, "BACKUP_ORPHAN_PAIR_COUNT") !== 0) {
    fail("backup_orphans_present");
  }
  const backups = backupSummary(values);
  if (single(values, "BACKUP_VERIFY_OK") !== "true") {
    fail("backup_verify_failed");
  }
  if (single(values, "BACKUP_VERIFY_MODE") !== "checksum_only") {
    fail("backup_verify_mode_invalid");
  }
  if (single(values, "BACKUP_VERIFY_TYPE") !== "full") {
    fail("backup_verify_type_invalid");
  }
  integer(values, "BACKUP_VERIFY_SIZE_BYTES", { minimum: 1 });

  if (single(values, "OFFSITE_ENABLED") !== "true") {
    fail("offsite_disabled");
  }
  if (single(values, "OFFSITE_STATUS") !== "reachable") {
    fail("offsite_unreachable");
  }
  const offsiteCompletePairCount = integer(
    values,
    "OFFSITE_COMPLETE_PAIR_COUNT",
    { minimum: 1 },
  );
  if (integer(values, "OFFSITE_ORPHAN_PAIR_COUNT") !== 0) {
    fail("offsite_orphans_present");
  }
  if (single(values, "OFFSITE_LATEST_FULL") === "missing") {
    fail("offsite_full_missing");
  }

  const backupWorkerStructuredEventCount = integer(
    values,
    "BACKUP_WORKER_STRUCTURED_EVENT_COUNT",
    { minimum: 1 },
  );
  if (integer(values, "BACKUP_WORKER_24H_FAILURE_EVENT_COUNT") !== 0) {
    fail("backup_worker_failures_present");
  }
  if (single(values, "BACKUP_WORKER_24H_FAILURE_FREE") !== "true") {
    fail("backup_worker_failure_free_invalid");
  }

  return {
    ...runtime,
    backupCompletePairCount,
    backups,
    offsiteCompletePairCount,
    backupWorkerStructuredEventCount,
  };
}

export function printProductionRuntimeSummary(summary) {
  console.log("PRODUCTION_RUNTIME_VERIFIED=true");
  console.log(`PRODUCTION_AUDIT_UTC=${summary.auditUtc}`);
  console.log(`PRODUCTION_RELEASE=${summary.releaseCommit}`);
  console.log(`PRODUCTION_SHELL_NODE_VERSION=${summary.nodeVersion}`);
  console.log(`PRODUCTION_PM2_NODE_VERSION=${summary.pm2NodeVersion}`);
  console.log(`PRODUCTION_HOST_UPTIME_SECONDS=${summary.hostUptimeSeconds}`);
  console.log(`PRODUCTION_HOST_BOOT_ID=${summary.hostBootId}`);
  console.log(`PRODUCTION_HEALTH_COMPONENTS=${summary.healthComponentCount}`);
  for (const component of [...REQUIRED_PUBLIC_HEALTH_COMPONENTS, ...OPTIONAL_PUBLIC_HEALTH_COMPONENTS]) {
    console.log(`PRODUCTION_HEALTH_COMPONENT=${component}:healthy`);
  }
  console.log("PRODUCTION_PM2_STATUS=online");
  console.log("PRODUCTION_PM2_EXEC_MODE=cluster_mode");
  console.log("PRODUCTION_PM2_CWD=/var/www/fanmind-current");
  console.log("PRODUCTION_PM2_UNSTABLE_RESTARTS=0");
  console.log(`PRODUCTION_PM2_RESTARTS=${summary.pm2Restarts}`);
  console.log(`PRODUCTION_PM2_UPTIME_SECONDS=${summary.pm2UptimeSeconds}`);
  console.log("PRODUCTION_NGINX_CONFIG=ok");
  console.log("PRODUCTION_NGINX_ACTIVE=active");
  console.log(`PRODUCTION_LOCAL_LOGIN_HTTP=${summary.localLoginHttp}`);
  console.log(`PRODUCTION_PUBLIC_LOGIN_HTTP=${summary.publicLoginHttp}`);
  console.log(
    `PRODUCTION_SERVER_ERROR_TRACKING_ENABLED=${summary.serverErrorTrackingEnabled}`,
  );
  console.log(
    `PRODUCTION_SERVER_ERROR_EMAIL_ENABLED=${summary.serverErrorEmailEnabled}`,
  );
  console.log(`PRODUCTION_DISK_USED_PERCENT=${summary.diskUsedPercent}`);
  console.log(`PRODUCTION_MEMORY_AVAILABLE_KIB=${summary.memoryAvailableKiB}`);
  console.log(`PRODUCTION_REBOOT_REQUIRED=${summary.rebootRequired}`);
  console.log(`PRODUCTION_SYSTEMD_UNIT_COUNT=${summary.systemdUnitCount}`);
  // Boot preflight is a separate result. A live Operations pass alone must
  // never authorize a reboot or imply that the host has actually restarted.
  console.log(`PRODUCTION_BOOT_READINESS_VERIFIED=${summary.bootReadiness.verified}`);
  for (const [role, value] of Object.entries(summary.bootReadiness.units)) {
    console.log(`PRODUCTION_BOOT_UNIT_${role}=${value}`);
  }
  for (const [key, value] of Object.entries(summary.bootReadiness.checks)) {
    console.log(`PRODUCTION_BOOT_${key}=${value}`);
  }
}

export function printProductionAuditSummary(summary) {
  console.log("PRODUCTION_AUDIT_VERIFIED=true");
  printProductionRuntimeSummary(summary);
  console.log(
    `PRODUCTION_BACKUP_COMPLETE_PAIR_COUNT=${summary.backupCompletePairCount}`,
  );
  for (const [type, backup] of Object.entries(summary.backups)) {
    console.log(
      `PRODUCTION_BACKUP=${type}|age_hours=${backup.ageHours.toFixed(2)}|size_bytes=${backup.sizeBytes}`,
    );
  }
  console.log(
    `PRODUCTION_OFFSITE_COMPLETE_PAIR_COUNT=${summary.offsiteCompletePairCount}`,
  );
  console.log(
    `PRODUCTION_BACKUP_WORKER_STRUCTURED_EVENT_COUNT=${summary.backupWorkerStructuredEventCount}`,
  );
}

async function main() {
  const [auditOutputPath, expectedCommit, auditExitCode = "0"] = process.argv.slice(2);
  if (!auditOutputPath || !expectedCommit) {
    console.error(
      "Usage: verify-production-audit-output.mjs <audit-output-path> <expected-commit> [audit-exit-code]",
    );
    process.exit(2);
  }

  let source = "";
  try {
    if (!/^\d{1,3}$/u.test(auditExitCode) || Number(auditExitCode) > 255) {
      fail("exit_code_invalid");
    }
    source = await readFile(auditOutputPath, "utf8");
    if (Number(auditExitCode) !== 0) fail("probe_failed");
    const summary = verifyProductionAuditOutput(source, expectedCommit);
    printProductionAuditSummary(summary);
  } catch (error) {
    console.log("PRODUCTION_AUDIT_VERIFIED=false");
    const code = error instanceof ProductionAuditError ? error.message : "production_audit_output_unavailable";
    console.log(`PRODUCTION_AUDIT_FAILURE_CODE=${code}`);
    let stage = Number(auditExitCode) === 0 ? "validation" : "unknown";
    try {
      const reported = single(parseProductionAuditOutput(source), "AUDIT_FAILED_STAGE");
      if (AUDIT_STAGES.has(reported)) stage = reported;
    } catch {}
    console.log(`PRODUCTION_AUDIT_FAILED_STAGE=${stage}`);
    if (/^\d{1,3}$/u.test(auditExitCode) && Number(auditExitCode) <= 255) {
      console.log(`PRODUCTION_AUDIT_EXIT_CODE=${Number(auditExitCode)}`);
    }
    try {
      // A separately verified runtime subset is never a full Operations pass.
      printProductionRuntimeSummary(verifyProductionRuntimeOutput(source, expectedCommit));
    } catch {
      console.log("PRODUCTION_RUNTIME_VERIFIED=false");
    }
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
