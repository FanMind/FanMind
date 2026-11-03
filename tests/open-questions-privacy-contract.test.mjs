import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../supabase/migrations/20261103090000_website_chat_open_questions.sql", import.meta.url);
const retentionPath = new URL("../supabase/migrations/20260614120000_conversation_message_retention.sql", import.meta.url);
const actionPath = new URL("../src/app/admin/open-questions/actions.ts", import.meta.url);
const contractPath = new URL("../docs/operations/OPEN_QUESTIONS_PRIVACY_RETENTION.md", import.meta.url);
const acceptancePath = new URL("../scripts/operations/open-questions-retention-acceptance.sql", import.meta.url);

test("status mutation and audit event are one workspace-bound transaction", async () => {
  const [sql, action] = await Promise.all([readFile(migrationPath, "utf8"), readFile(actionPath, "utf8")]);
  assert.match(sql, /for update/u);
  assert.match(sql, /question\.id = p_question_id and question\.workspace_id = p_workspace_id/gu);
  assert.match(sql, /update public\.website_chat_open_questions[\s\S]*insert into public\.website_chat_open_question_audit_events/u);
  assert.match(sql, /actor_id[\s\S]*before_status[\s\S]*after_status[\s\S]*occurred_at/u);
  assert.match(sql, /if v_question\.status <> p_after_status then/u);
  assert.match(action, /const actor = await requirePlatformAdmin\(\)/u);
  assert.match(action, /rpc\/update_website_chat_open_question_status/u);
  assert.match(action, /p_actor_id: actor\.id/u);
});

test("candidate and audit storage remain service-role-only and contain no raw message text", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.doesNotMatch(sql, /\b(?:content|question_text|message_text)\s+text\b/iu);
  assert.match(sql, /revoke all on public\.website_chat_open_questions from public, anon, authenticated/u);
  assert.match(sql, /revoke all on public\.website_chat_open_question_audit_events from public, anon, authenticated/u);
  assert.match(sql, /revoke update, delete on public\.website_chat_open_questions from service_role/u);
  assert.match(sql, /revoke insert, update, delete on public\.website_chat_open_question_audit_events from service_role/u);
  assert.match(sql, /grant select, insert on public\.website_chat_open_questions to service_role/u);
  assert.match(sql, /grant select on public\.website_chat_open_question_audit_events to service_role/u);
  assert.match(sql, /security definer[\s\S]*set search_path = pg_catalog, public, pg_temp/u);
  assert.match(sql, /has_table_privilege\('service_role', 'public\.website_chat_open_questions', 'UPDATE'\)/u);
  assert.match(sql, /has_table_privilege\('service_role', 'public\.website_chat_open_question_audit_events', 'INSERT'\)/u);
  assert.match(sql, /revoke all on function public\.update_website_chat_open_question_status[\s\S]*from public, anon, authenticated, service_role/u);
  assert.match(sql, /grant execute on function public\.update_website_chat_open_question_status[\s\S]*to service_role/u);
  assert.doesNotMatch(sql, /create\s+policy/iu);
});

test("original-message lifecycle has a rollback-only acceptance harness", async () => {
  const [sql, retention, contract, acceptance] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(retentionPath, "utf8"),
    readFile(contractPath, "utf8"),
    readFile(acceptancePath, "utf8"),
  ]);
  assert.match(sql, /inbound_message_id uuid not null references public\.conversation_messages\(id\) on delete cascade/u);
  assert.match(retention, /row_number\(\) over[\s\S]*partition by conversation_id[\s\S]*where ranked\.rn > 50/u);
  assert.match(retention, /after insert on public\.conversation_messages/u);
  assert.match(contract, /keine Anonymisierung/iu);
  assert.match(contract, /BT-051/u);
  assert.match(contract, /Backup-Aufbewahrung/iu);
  assert.match(contract, /isolierte Staging-Abnahme/iu);
  assert.doesNotMatch(acceptance, /\bcommit\s*;/iu);
  assert.equal(acceptance.match(/\brollback\s*;/giu)?.length, 2);
  assert.match(acceptance, /OPEN_QUESTION_ATOMIC_AUDIT=PASS/u);
  assert.match(acceptance, /OPEN_QUESTION_DELETE_CASCADE=PASS/u);
  assert.match(acceptance, /OPEN_QUESTION_ACCEPTANCE_ROLLBACK=PASS/u);
});
