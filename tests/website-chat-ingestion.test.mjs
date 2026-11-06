import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260808234500_website_chat_message_ingestion.sql",
  import.meta.url,
);
const controlledMigrationPath = new URL(
  "../supabase/controlled/20260904120000_website_chat_handoff.sql",
  import.meta.url,
);
const routePath = new URL("../src/app/api/website-chat/message/route.ts", import.meta.url);
const servicePath = new URL("../src/lib/websiteChat.ts", import.meta.url);

test("website chat ingestion is transactional, idempotent and service-role-only", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /primary key \(session_id, client_message_id\)/u);
  assert.match(sql, /alter table public\.website_chat_message_receipts enable row level security/u);
  assert.match(sql, /revoke all on table public\.website_chat_message_receipts[\s\S]*?from public, anon, authenticated/u);
  assert.match(sql, /security invoker/u);
  assert.match(sql, /revoke all on function public\.ingest_website_chat_message[\s\S]*?from public, anon, authenticated/u);
  assert.match(sql, /grant execute on function public\.ingest_website_chat_message[\s\S]*?to service_role/u);
  assert.match(sql, /s\.revoked_at is null/u);
  assert.match(sql, /s\.expires_at > v_now/u);
  assert.match(sql, /o\.verified_at is not null/u);
  assert.match(sql, /for update of s/u);
  assert.doesNotMatch(sql, /security definer/iu);
});

test("website messages enter the CRM inbox without AI or outbound delivery", async () => {
  const [sql, controlledSql, route, service] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(controlledMigrationPath, "utf8"),
    readFile(routePath, "utf8"),
    readFile(servicePath, "utf8"),
  ]);
  assert.match(sql, /insert into public\.contacts/u);
  assert.match(sql, /insert into public\.conversations/u);
  assert.match(sql, /insert into public\.conversation_messages/u);
  assert.match(sql, /'inbound'/u);
  assert.match(sql, /'website-chat'/u);
  assert.match(route, /ALLOWED_HEADER_NAMES = \["authorization", "content-type", INSTALLATION_HEADER\]/u);
  assert.match(route, /ALLOWED_HEADERS = ALLOWED_HEADER_NAMES\.join\(","\)/u);
  assert.match(route, /website_chat_message_session/u);
  assert.match(route, /website_chat_message_coarse_ip/u);
  assert.match(route, /readBoundedJsonRequest/u);
  assert.match(route, /SESSION_INVALID/u);
  const postStart = route.indexOf("export async function POST");
  const coarseCheck = route.indexOf("consumeCoarseIpRateLimit(request)", postStart);
  const installationLookup = route.indexOf("resolveWebsiteChatInstallation", postStart);
  const bearerLookup = route.indexOf("bearerToken(request)", postStart);
  assert.ok(postStart >= 0 && coarseCheck > postStart && coarseCheck < installationLookup && coarseCheck < bearerLookup);
  assert.match(service, /rpc\/ingest_website_chat_message_v2/u);
  assert.doesNotMatch(service, /result\?\.status === 404[\s\S]*session_unavailable/u);
  assert.match(service, /if \(!result\?\.ok\)[\s\S]*persistence_unavailable/u);
  assert.doesNotMatch(`${sql}\n${controlledSql}\n${route}\n${service}`, /OPENAI_API_KEY|copilot\/reply|automatic.?send/iu);
  assert.doesNotMatch(sql, /direction[\s\S]{0,80}'outbound'/iu);
  assert.doesNotMatch(controlledSql, /direction[\s\S]{0,80}'outbound'/iu);
});
