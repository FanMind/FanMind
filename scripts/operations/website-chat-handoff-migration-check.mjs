#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const WEBSITE_CHAT_HANDOFF_ID = "20260904120000_website_chat_handoff";
export const WEBSITE_CHAT_HANDOFF_PATH = resolve(
  process.cwd(),
  `supabase/controlled/${WEBSITE_CHAT_HANDOFF_ID}.sql`,
);
export const EXPECTED_WEBSITE_CHAT_HANDOFF_SHA256 =
  "44c77eae690b1ac53e8a30ae0fb890232f61f493d3f808ee4044a70a5d3f7744";

function fail(code) {
  throw new Error(`WEBSITE_CHAT_HANDOFF_ERROR=${code}`);
}

export function evaluateWebsiteChatHandoffSql(sql) {
  if (typeof sql !== "string") fail("sql_unreadable");
  const digest = createHash("sha256").update(sql).digest("hex");
  if (digest !== EXPECTED_WEBSITE_CHAT_HANDOFF_SHA256) {
    fail("sql_checksum_mismatch");
  }

  const required = [
    /^begin;/iu,
    /CONTROLLED \/ DORMANT BY DEFAULT/iu,
    /create table if not exists public\.website_chat_handoffs/iu,
    /unique \(session_id\)/iu,
    /consent_purpose = 'human_reply_by_email'/iu,
    /alter table public\.website_chat_handoffs enable row level security/iu,
    /from public, anon, authenticated, service_role/iu,
    /to service_role/iu,
    /create or replace function public\.website_chat_processing_allowed/iu,
    /workspace_processing_allowed_contract/iu,
    /security definer[\s\S]*set search_path = pg_catalog, public, pg_temp[\s\S]*set row_security = on/iu,
    /revoke execute on function public\.ingest_website_chat_message[\s\S]*from service_role/iu,
    /create or replace function public\.ingest_website_chat_message_v2/iu,
    /create or replace function public\.request_website_chat_handoff/iu,
    /session\.expires_at > v_now/iu,
    /allowed_origin\.verified_at is not null/iu,
    /website_chat_processing_allowed\(session\.workspace_id\)/iu,
    /for update of session/iu,
    /Besucher bittet um eine persönliche Antwort per E-Mail/iu,
    /priority = 'high'/iu,
    /next_step = 'Persönlich per E-Mail antworten'/iu,
    /website_chat_handoff_contact_update_failed/iu,
    /website_chat_handoff_conversation_update_failed/iu,
    /No delivery state implies an email was sent/iu,
    /commit;\s*$/iu,
  ];
  const forbidden = [
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
  return Object.freeze({ digest, migrationId: WEBSITE_CHAT_HANDOFF_ID });
}

export function checkWebsiteChatHandoffMigration() {
  const result = evaluateWebsiteChatHandoffSql(
    readFileSync(WEBSITE_CHAT_HANDOFF_PATH, "utf8"),
  );
  console.log(`WEBSITE_CHAT_HANDOFF_ID=${result.migrationId}`);
  console.log(`WEBSITE_CHAT_HANDOFF_SHA256=${result.digest}`);
  console.log("WEBSITE_CHAT_HANDOFF_OFFLINE_CHECK=PASS");
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) fail("argument_invalid");
  checkWebsiteChatHandoffMigration();
}
