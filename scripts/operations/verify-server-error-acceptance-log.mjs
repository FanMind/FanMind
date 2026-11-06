#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const VERSION = "fanmind-server-error-acceptance-1";
const MAX_INPUT_BYTES = 65536;
const SAFE_ERRORS = new Set([
  "server_error_acceptance_ack_invalid",
  "server_error_acceptance_cleanup_failed",
  "server_error_acceptance_config_missing",
  "server_error_acceptance_contract_invalid",
  "server_error_acceptance_email_not_disabled",
  "server_error_acceptance_environment_invalid",
  "server_error_acceptance_release_invalid",
  "server_error_acceptance_store_invalid",
  "server_error_acceptance_unexpected_failure",
]);

function fail(code) {
  throw new Error(`server_error_acceptance_log_${code}`);
}

function safeErrorCode(value) {
  if (SAFE_ERRORS.has(value)) return value;
  if (/^server_error_acceptance_store_[1-5][0-9]{2}$/u.test(value)) return value;
  return null;
}

export function verifyServerErrorAcceptanceLog(source, notBefore) {
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
      payload?.event !== "acceptance_failed" ||
      !errorCode
    ) {
      continue;
    }
    if (!latest || timestamp >= latest.timestamp) latest = { errorCode, timestamp };
  }
  if (!latest) fail("diagnostic_missing");
  return { status: "failed", errorCode: latest.errorCode };
}

export function formatServerErrorAcceptanceDiagnostic(result) {
  return [
    "SERVER_ERROR_ACCEPTANCE=failed",
    `SERVER_ERROR_ACCEPTANCE_ERROR=${result.errorCode}`,
    "",
  ].join("\n");
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (direct) {
  const [sourcePath, notBefore] = process.argv.slice(2);
  if (!sourcePath || !notBefore) fail("arguments_invalid");
  const source = await readFile(sourcePath, "utf8");
  process.stdout.write(
    formatServerErrorAcceptanceDiagnostic(
      verifyServerErrorAcceptanceLog(source, notBefore),
    ),
  );
}
