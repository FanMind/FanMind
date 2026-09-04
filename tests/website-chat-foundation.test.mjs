import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260808223000_website_chat_security_foundation.sql",
  import.meta.url,
);
const routePath = new URL("../src/app/api/website-chat/session/route.ts", import.meta.url);
const servicePath = new URL("../src/lib/websiteChat.ts", import.meta.url);
const runbookPath = new URL(
  "../docs/operations/WEBSITE_CHAT_FOUNDATION.md",
  import.meta.url,
);

test("website chat storage is RLS-enabled and service-role-only", async () => {
  const sql = await readFile(migrationPath, "utf8");
  for (const table of [
    "website_chat_installations",
    "website_chat_allowed_origins",
    "website_chat_visitor_sessions",
  ]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "u"));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table}[\\s\\S]*?from public, anon, authenticated`, "u"));
  }
  assert.match(sql, /visitor_subject_hash ~ '\^\[0-9a-f\]\{64\}\$'/u);
  assert.doesNotMatch(sql, /raw_ip|ip_address|session_token\s+text/iu);
  assert.match(sql, /enabled boolean not null default false/u);
});

test("public session route is origin-, consent-, body- and rate-limit guarded", async () => {
  const [route, service] = await Promise.all([
    readFile(routePath, "utf8"),
    readFile(servicePath, "utf8"),
  ]);
  assert.match(route, /resolveWebsiteChatInstallation/u);
  assert.match(route, /readBoundedJsonRequest/u);
  assert.match(route, /consumeSharedRateLimit/u);
  assert.match(route, /website_chat_session_coarse_ip/u);
  assert.match(route, /website_chat_session_ip/u);
  const postStart = route.indexOf("export async function POST");
  const coarseCheck = route.indexOf("consumeCoarseIpRateLimit(request)", postStart);
  const installationLookup = route.indexOf("resolveWebsiteChatInstallation", postStart);
  assert.ok(postStart >= 0 && coarseCheck > postStart && coarseCheck < installationLookup);
  const optionsStart = route.indexOf("export async function OPTIONS");
  const optionsCoarseCheck = route.indexOf("consumeCoarseIpRateLimit(request)", optionsStart);
  const optionsInstallationLookup = route.indexOf("resolveWebsiteChatInstallation", optionsStart);
  assert.ok(optionsStart >= 0 && optionsCoarseCheck > optionsStart && optionsCoarseCheck < optionsInstallationLookup);
  assert.match(route, /Vary: "Origin"/u);
  assert.match(route, /Cache-Control": "private, no-store"/u);
  assert.match(service, /requireConsent/u);
  assert.match(service, /hashWebsiteChatSessionToken/u);
  assert.doesNotMatch(`${route}\n${service}`, /OPENAI_API_KEY|reply-suggestions|copilot\/reply/u);
  assert.doesNotMatch(`${route}\n${service}`, /automatic|auto.?send|outbound/iu);
});

test("website chat stays disabled while the atomic processing gate awaits controlled Staging acceptance", async () => {
  const [runbook, controlledSql, service] = await Promise.all([
    readFile(runbookPath, "utf8"),
    readFile(
      new URL("../supabase/controlled/20260904120000_website_chat_handoff.sql", import.meta.url),
      "utf8",
    ),
    readFile(servicePath, "utf8"),
  ]);
  assert.match(
    runbook,
    /nicht in der Datenbank angewandt und nicht produktiv aktiviert/u,
  );
  assert.match(controlledSql, /website_chat_processing_allowed\(session\.workspace_id\)/u);
  assert.match(controlledSql, /workspace_processing_allowed_contract/u);
  assert.match(service, /evaluateWorkspaceProcessingEntitlement/u);
});
