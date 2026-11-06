#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_INPUT_BYTES = 64 * 1024;
const ACTION_FIELDS = Object.freeze([
  "STAGING_DATABASE_ROLLOUT_WORKSPACE_MEMBER_BOUNDARY",
  "STAGING_DATABASE_ROLLOUT_WHATSAPP_CLOUD_INBOUND",
  "STAGING_DATABASE_ROLLOUT_AI_TIER",
  "STAGING_DATABASE_ROLLOUT_MOBILE_PUSH",
  "STAGING_DATABASE_ROLLOUT_META_CONTENT",
  "STAGING_DATABASE_ROLLOUT_META_CATCHUP",
  "STAGING_DATABASE_ROLLOUT_META_CONTINUATION",
  "STAGING_DATABASE_ROLLOUT_TRIGGER_HARDENING",
]);
const FIXED_FIELDS = Object.freeze([
  "STAGING_DATABASE_ROLLOUT_GENERIC_MIGRATION",
  "STAGING_DATABASE_ROLLOUT_STATE",
]);
const FIELD_ORDER = Object.freeze([...ACTION_FIELDS, ...FIXED_FIELDS]);
const ACTION_VALUES = new Set(["apply", "skip", "verify"]);

function fail() {
  throw new Error("invalid_rollout_evidence");
}

function canonicalizeStagingRolloutEvidence(output) {
  if (typeof output !== "string" || Buffer.byteLength(output) > MAX_INPUT_BYTES) {
    fail();
  }

  const values = new Map();
  const acceptedFields = new Set(FIELD_ORDER);
  for (const line of output.split(/\r?\n/u)) {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 1) continue;
    const field = line.slice(0, separatorIndex);
    if (!acceptedFields.has(field)) continue;
    if (values.has(field)) fail();
    values.set(field, line.slice(separatorIndex + 1));
  }

  if (FIELD_ORDER.some((field) => !values.has(field))) fail();
  if (ACTION_FIELDS.some((field) => !ACTION_VALUES.has(values.get(field)))) {
    fail();
  }
  if (values.get("STAGING_DATABASE_ROLLOUT_GENERIC_MIGRATION") !== "disabled") {
    fail();
  }
  if (values.get("STAGING_DATABASE_ROLLOUT_STATE") !== "PASS") fail();

  return `${FIELD_ORDER.map((field) => `${field}=${values.get(field)}`).join("\n")}\n`;
}

async function readBoundedStandardInput() {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > MAX_INPUT_BYTES) fail();
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size).toString("utf8");
}

async function main() {
  const canonical = canonicalizeStagingRolloutEvidence(
    await readBoundedStandardInput(),
  );
  process.stdout.write(canonical);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch(() => {
    console.error("STAGING_DATABASE_ROLLOUT_EVIDENCE_ERROR=invalid");
    process.exitCode = 1;
  });
}

export { canonicalizeStagingRolloutEvidence };
