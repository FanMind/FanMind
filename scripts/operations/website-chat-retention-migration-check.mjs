#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const WEBSITE_CHAT_RETENTION_ID = "20260904170000_website_chat_retention";
export const WEBSITE_CHAT_RETENTION_PATH = resolve(
  process.cwd(),
  `supabase/controlled/${WEBSITE_CHAT_RETENTION_ID}.sql`,
);
export const EXPECTED_WEBSITE_CHAT_RETENTION_SHA256 =
  "fca022284b48ff7be67c16b0f35ba0ba1d55ff19383f4d4db28ebb1716b1f34a";

function fail(code) {
  throw new Error(`WEBSITE_CHAT_RETENTION_ERROR=${code}`);
}

export function evaluateWebsiteChatRetentionSql(sql) {
  if (typeof sql !== "string") fail("sql_unreadable");
  const digest = createHash("sha256").update(sql).digest("hex");
  if (digest !== EXPECTED_WEBSITE_CHAT_RETENTION_SHA256) {
    fail("sql_checksum_mismatch");
  }

  const required = [
    /^begin;/iu,
    /CONTROLLED \/ DORMANT BY DEFAULT/iu,
    /create or replace function public\.manage_website_chat_retention/iu,
    /p_limit integer default 500/iu,
    /p_execute boolean default false/iu,
    /p_limit > 1000/iu,
    /session\.revoked_at is not null or session\.expires_at <= v_now/iu,
    /handoff\.expires_at > v_now/iu,
    /for update of session skip locked/iu,
    /delete from public\.website_chat_visitor_sessions/iu,
    /get diagnostics v_deleted_sessions = row_count/iu,
    /security invoker[\s\S]*set search_path = public, pg_temp/iu,
    /from public, anon, authenticated, service_role/iu,
    /to service_role/iu,
    /aclexplode/iu,
    /CRM contacts, conversations and messages are never deleted/iu,
    /commit;\s*$/iu,
  ];
  const forbidden = [
    /delete from public\.(?:contacts|conversations|conversation_messages|workspaces)/iu,
    /create\s+policy/iu,
    /\btruncate\s+table\b/iu,
    /\bpg_cron\b|\bcron\.schedule\b/iu,
    /\b(?:http|net)\.(?:post|get)\b/iu,
    /resend|sendgrid|mailgun|postmark|smtp|openai/iu,
  ];
  const missingContract = required.findIndex((contract) => !contract.test(sql));
  const forbiddenContract = forbidden.findIndex((contract) => contract.test(sql));
  if (missingContract >= 0) fail(`sql_contract_missing_${missingContract + 1}`);
  if (forbiddenContract >= 0) fail(`sql_contract_forbidden_${forbiddenContract + 1}`);
  const deleteTargets = Array.from(
    sql.matchAll(/\bdelete\s+from\s+([a-z_][a-z0-9_.]*)/giu),
    (match) => match[1].toLowerCase(),
  );
  if (
    deleteTargets.length !== 1 ||
    deleteTargets[0] !== "public.website_chat_visitor_sessions"
  ) {
    fail("sql_delete_allowlist_mismatch");
  }
  return Object.freeze({ digest, migrationId: WEBSITE_CHAT_RETENTION_ID });
}

export function checkWebsiteChatRetentionMigration() {
  const result = evaluateWebsiteChatRetentionSql(
    readFileSync(WEBSITE_CHAT_RETENTION_PATH, "utf8"),
  );
  console.log(`WEBSITE_CHAT_RETENTION_ID=${result.migrationId}`);
  console.log(`WEBSITE_CHAT_RETENTION_SHA256=${result.digest}`);
  console.log("WEBSITE_CHAT_RETENTION_OFFLINE_CHECK=PASS");
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) fail("argument_invalid");
  checkWebsiteChatRetentionMigration();
}
