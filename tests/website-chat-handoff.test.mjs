import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  evaluateWebsiteChatHandoffSql,
  EXPECTED_WEBSITE_CHAT_HANDOFF_SHA256,
} from "../scripts/operations/website-chat-handoff-migration-check.mjs";

const migrationPath = new URL(
  "../supabase/controlled/20260904120000_website_chat_handoff.sql",
  import.meta.url,
);
const routePath = new URL("../src/app/api/website-chat/handoff/route.ts", import.meta.url);
const servicePath = new URL("../src/lib/websiteChat.ts", import.meta.url);
const widgetPath = new URL("../src/lib/websiteChatWidget.mjs", import.meta.url);
const supabaseServerPath = new URL("../src/lib/supabase/server.ts", import.meta.url);
const fanDetailPath = new URL("../src/app/fans/[id]/page.tsx", import.meta.url);

test("controlled handoff SQL is checksum-pinned and offline-verifiable", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const result = evaluateWebsiteChatHandoffSql(sql);
  assert.equal(result.digest, EXPECTED_WEBSITE_CHAT_HANDOFF_SHA256);
  assert.equal(result.migrationId, "20260904120000_website_chat_handoff");
});

test("handoff storage is service-role-only and consent-bound", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /alter table public\.website_chat_handoffs enable row level security/u);
  assert.doesNotMatch(sql, /create\s+policy/iu);
  assert.match(
    sql,
    /revoke all on table public\.website_chat_handoffs[\s\S]*from public, anon, authenticated, service_role/iu,
  );
  assert.match(sql, /grant select, insert, update, delete[\s\S]*to service_role/u);
  assert.match(sql, /constraint website_chat_handoffs_one_per_session unique \(session_id\)/u);
  assert.match(sql, /consent_purpose = 'human_reply_by_email'/u);
  assert.match(sql, /visitor_email_fingerprint ~ '\^\[0-9a-f\]\{64\}\$'/u);
  assert.match(sql, /expires_at <= consent_granted_at \+ interval '90 days'/u);
  assert.doesNotMatch(sql, /visitor_email\s+text|raw_ip|ip_address|session_token\s+text/iu);
  assert.match(sql, /visitor_email_fingerprint,[\s\S]*encode\(extensions\.digest\(convert_to\(v_email/u);
  assert.match(sql, /v_session record;[\s\S]*select session\.\*, installation\.message_retention_days[\s\S]*into v_session/u);
});

test("message and handoff writes revalidate processing, session and origin atomically", async () => {
  const [sql, service] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(servicePath, "utf8"),
  ]);
  assert.match(sql, /workspace_processing_allowed_contract/u);
  assert.equal(
    sql.match(/website_chat_processing_allowed\(session\.workspace_id\)/gu)?.length,
    2,
  );
  assert.equal(sql.match(/allowed_origin\.verified_at is not null/gu)?.length, 2);
  assert.equal(sql.match(/session\.expires_at > v_now/gu)?.length, 2);
  assert.equal(sql.match(/for update of session/gu)?.length, 2);
  assert.match(sql, /revoke execute on function public\.ingest_website_chat_message[\s\S]*from service_role/u);
  assert.match(service, /rpc\/ingest_website_chat_message_v2/u);
  assert.match(service, /evaluateWorkspaceProcessingEntitlement/u);
  assert.match(service, /if \(!processing\.allowed\)/u);
});

test("public handoff route is origin-, session-, body- and rate-limit guarded", async () => {
  const [route, service] = await Promise.all([
    readFile(routePath, "utf8"),
    readFile(servicePath, "utf8"),
  ]);
  assert.match(route, /resolveWebsiteChatInstallation/u);
  assert.match(route, /hashWebsiteChatSessionToken/u);
  assert.match(route, /readBoundedJsonRequest/u);
  assert.match(route, /website_chat_handoff_coarse_ip/u);
  assert.match(route, /website_chat_handoff_session/u);
  assert.match(route, /HANDOFF_RATE_MAXIMUM = 5/u);
  assert.match(route, /Vary: "Origin"/u);
  assert.match(route, /Cache-Control": "private, no-store"/u);
  assert.match(service, /normalizeWebsiteChatEmail/u);
  assert.match(service, /requireWebsiteChatHandoffConsent/u);
  assert.match(service, /rpc\/request_website_chat_handoff/u);
  assert.match(service, /p_public_installation_id: publicInstallationId/u);
});

test("handoff raises the existing CRM conversation without outbound delivery", async () => {
  const [sql, route, service, widget, supabaseServer, fanDetail] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(routePath, "utf8"),
    readFile(servicePath, "utf8"),
    readFile(widgetPath, "utf8"),
    readFile(supabaseServerPath, "utf8"),
    readFile(fanDetailPath, "utf8"),
  ]);
  assert.match(sql, /from public\.website_chat_message_receipts/u);
  assert.match(sql, /insert into public\.conversation_messages/u);
  assert.match(sql, /direction, message_type/u);
  assert.match(sql, /'note', 'note'/u);
  assert.match(sql, /priority = 'high'/u);
  assert.match(sql, /next_step = 'Persönlich per E-Mail antworten'/u);
  assert.match(sql, /website_chat_handoff_contact_update_failed/u);
  assert.match(sql, /website_chat_handoff_conversation_update_failed/u);
  assert.match(widget, /gesamten Gesprächsverlauf/u);
  assert.match(widget, /human_reply_by_email/u);
  assert.match(supabaseServer, /export async function getContactConversationMessages/u);
  assert.match(supabaseServer, /conversation_messages/u);
  assert.match(fanDetail, /getContactConversationMessages\(workspace\.id, contact\.id\)/u);
  assert.match(fanDetail, /timeline\.map/u);
  assert.doesNotMatch(
    `${sql}\n${route}\n${service}\n${widget}`,
    /resend|sendgrid|mailgun|postmark|smtp|OPENAI_API_KEY|fetch\([^)]*(?:email|mail)/iu,
  );
});
