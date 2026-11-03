#!/usr/bin/env node

import { constants, openSync, closeSync, fstatSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { evaluateWebsiteChatRetentionStagingEnvironment } from "../../src/lib/websiteChatRetentionStagingPolicy.mjs";
import { WEBSITE_CHAT_STAGING_UUID_PATTERN } from "../../src/lib/websiteChatStagingControlPolicy.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const sqlPath = fileURLToPath(new URL("./open-questions-retention-acceptance.sql", import.meta.url));
const STATUSES = new Set(["open", "in_review", "resolved"]);
const MARKERS = [
  "OPEN_QUESTION_ATOMIC_AUDIT=PASS", "OPEN_QUESTION_DELETE_CASCADE=PASS",
  "CONVERSATION_MESSAGE_LATEST_50=PASS", "OPEN_QUESTION_ACCEPTANCE_ROLLBACK=PASS",
];

function fail(code) { throw new Error(`OPEN_QUESTION_RETENTION_ACCEPTANCE_ERROR=${code}`); }

function requiredUuid(environment, key) {
  const value = String(environment[key] ?? "").trim().toLowerCase();
  if (!WEBSITE_CHAT_STAGING_UUID_PATTERN.test(value)) fail("fixture_identifier_invalid");
  return value;
}

function validatePassfile(environment) {
  const path = String(environment.PGPASSFILE ?? "").trim();
  if (!isAbsolute(path)) fail("passfile_invalid");
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || (stat.mode & 0o777) !== 0o600 || stat.size < 1 ||
        (typeof process.getuid === "function" && stat.uid !== process.getuid())) fail("passfile_invalid");
  } finally { if (descriptor !== undefined) closeSync(descriptor); }
}

export function checkOpenQuestionRetentionAcceptanceSource() {
  const sql = readFileSync(sqlPath, "utf8");
  if (/\bcommit\s*;/iu.test(sql) || (sql.match(/\brollback\s*;/giu)?.length ?? 0) !== 2 ||
      MARKERS.some((marker) => !sql.includes(marker))) fail("source_contract_invalid");
  return sql;
}

function run(environment) {
  const policy = evaluateWebsiteChatRetentionStagingEnvironment(environment, { mode: "acceptance" });
  if (!policy.ok) fail("environment_invalid");
  validatePassfile(environment);
  const questionId = requiredUuid(environment, "FANMIND_OPEN_QUESTIONS_STAGING_QUESTION_ID");
  const messageId = requiredUuid(environment, "FANMIND_OPEN_QUESTIONS_STAGING_MESSAGE_ID");
  const actorId = requiredUuid(environment, "FANMIND_OPEN_QUESTIONS_STAGING_ACTOR_ID");
  const currentStatus = String(environment.FANMIND_OPEN_QUESTIONS_CURRENT_STATUS ?? "").trim();
  const nextStatus = String(environment.FANMIND_OPEN_QUESTIONS_NEXT_STATUS ?? "").trim();
  if (!STATUSES.has(currentStatus) || !STATUSES.has(nextStatus) || currentStatus === nextStatus) fail("status_invalid");
  checkOpenQuestionRetentionAcceptanceSource();
  const args = [
    "--no-password", "--no-psqlrc", "--quiet", "--tuples-only", "--no-align",
    "--set=ON_ERROR_STOP=1", `--set=workspace_id=${policy.workspaceId}`,
    `--set=question_id=${questionId}`, `--set=message_id=${messageId}`,
    `--set=actor_id=${actorId}`, `--set=current_status=${currentStatus}`,
    `--set=next_status=${nextStatus}`, `--file=${sqlPath}`,
  ];
  const result = spawnSync("psql", args, { env: environment, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.error || result.status !== 0 || MARKERS.some((marker) => !result.stdout.includes(marker))) fail("database_acceptance_failed");
  console.log("OPEN_QUESTION_RETENTION_TARGET=staging");
  console.log("OPEN_QUESTION_RETENTION_TRANSACTION=ROLLED_BACK");
  console.log("OPEN_QUESTION_RETENTION_ACCEPTANCE=PASS");
}

function main() {
  const [argument] = process.argv.slice(2);
  if (argument === "--check") {
    checkOpenQuestionRetentionAcceptanceSource();
    console.log("OPEN_QUESTION_RETENTION_ACCEPTANCE_READY=YES");
    return;
  }
  if (argument !== "--run") fail("argument_invalid");
  run(process.env);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try { main(); }
  catch (error) {
    console.error(error instanceof Error && /^OPEN_QUESTION_RETENTION_ACCEPTANCE_ERROR=[a-z0-9_]+$/u.test(error.message)
      ? error.message : "OPEN_QUESTION_RETENTION_ACCEPTANCE_ERROR=unexpected_failure");
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  }
}
