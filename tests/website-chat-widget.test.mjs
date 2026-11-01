import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildWebsiteChatWidgetScript } from "../src/lib/websiteChatWidget.mjs";
import {
  WEBSITE_CHAT_INSTALLATION_HEADER,
  WEBSITE_CHAT_INSTALLATION_QUERY,
} from "../src/lib/websiteChatPolicy.mjs";
import {
  buildWebsiteChatAiIdentity,
  isWebsiteChatAssistantBindingValid,
  selectWebsiteChatAiAction,
} from "../src/lib/websiteChatAiPolicy.mjs";

const routePath = new URL("../src/app/api/website-chat/reply/route.ts", import.meta.url);
const servicePath = new URL("../src/lib/websiteChat.ts", import.meta.url);
const launcherPath = new URL("../src/components/PublicSupportAssistant.tsx", import.meta.url);
const landingPath = new URL("../src/app/page.tsx", import.meta.url);
const envPath = new URL("../.env.example", import.meta.url);

test("widget is consent-first, cookie-free and uses only the public Website Chat APIs", () => {
  const source = buildWebsiteChatWidgetScript();
  assert.match(source, /consent\.checked/u);
  assert.match(source, /credentials:"omit"/u);
  assert.match(source, /\/api\/website-chat\/session/u);
  assert.match(source, /\/api\/website-chat\/message/u);
  assert.match(source, /\/api\/website-chat\/reply/u);
  assert.match(source, /crypto\.randomUUID\(\)/u);
  assert.match(source, /!pendingClientMessageId \|\| pendingMessage !== message/u);
  assert.match(source, /pendingClientMessageId = crypto\.randomUUID\(\); pendingMessage = message/u);
  assert.match(source, /const currentMessageId = pendingClientMessageId/u);
  assert.match(source, /clientMessageId:currentMessageId/u);
  assert.match(source, /pendingClientMessageId = null; pendingMessage = null; status\.textContent = "Antwort wird geprüft/u);
  assert.match(source, /response\.status === 401\) sessionToken = null/u);
  assert.doesNotMatch(source, /catch \{ sessionToken = null/u);
  assert.match(source, /persönliche Antwort ist weiterhin möglich/u);
  assert.doesNotMatch(source, /document\.cookie|localStorage|sessionStorage|OPENAI|poll/iu);
});

test("widget and API routes share the installation, preflight and session envelope contract", async () => {
  const source = buildWebsiteChatWidgetScript();
  const { readFile } = await import("node:fs/promises");
  const [sessionRoute, messageRoute] = await Promise.all([
    readFile("src/app/api/website-chat/session/route.ts", "utf8"),
    readFile("src/app/api/website-chat/message/route.ts", "utf8"),
  ]);
  assert.match(source, new RegExp(`"${WEBSITE_CHAT_INSTALLATION_HEADER}":installationId`, "u"));
  assert.doesNotMatch(source, /x-fanmind-installation-id/u);
  assert.match(source, new RegExp(`\\?${WEBSITE_CHAT_INSTALLATION_QUERY}=`, "u"));
  assert.match(source, /payload\?\.ok !== true \|\| typeof payload\?\.session\?\.token !== "string"/u);
  assert.match(source, /sessionToken = payload\.session\.token/u);
  for (const route of [sessionRoute, messageRoute]) {
    assert.match(route, /WEBSITE_CHAT_INSTALLATION_HEADER/u);
    assert.match(route, /WEBSITE_CHAT_INSTALLATION_QUERY/u);
    assert.match(route, /requireWebsiteChatPreflight/u);
    assert.match(route, /request\.nextUrl\.searchParams\.get\(WEBSITE_CHAT_INSTALLATION_QUERY\)/u);
  }
});

test("widget validates bounded embed attributes and never exposes internal CRM identifiers", () => {
  const source = buildWebsiteChatWidgetScript();
  assert.match(source, /dataset\.installationId/u);
  assert.match(source, /consentVersion\.length > 80/u);
  assert.match(source, /attachShadow/u);
  assert.doesNotMatch(source, /contactId|conversationId|workspaceId/iu);
});

test("widget offers a purpose-bound human handoff only after a message was accepted", () => {
  const source = buildWebsiteChatWidgetScript();
  assert.match(source, /Persönliche Antwort erhalten/u);
  assert.match(source, /type="email" maxlength="254"/u);
  assert.match(source, /gesamten Gesprächsverlauf/u);
  assert.match(source, /handoff\.classList\.add\("open"\)/u);
  assert.match(source, /\/api\/website-chat\/handoff/u);
  assert.match(source, /clientHandoffId:pendingHandoffId/u);
  assert.match(source, /purpose:"human_reply_by_email"/u);
  assert.match(source, /credentials:"omit"/u);
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie/iu);
});


test("Public support stays useful while Website AI remains default-off", async () => {
  const [route, env, launcher, landing] = await Promise.all([
    readFile(routePath, "utf8"),
    readFile(envPath, "utf8"),
    readFile(launcherPath, "utf8"),
    readFile(landingPath, "utf8"),
  ]);
  assert.match(env, /FANMIND_WEBSITE_CHAT_AI_ENABLED=false/u);
  assert.match(env, /NEXT_PUBLIC_FANMIND_SUPPORT_CHAT_INSTALLATION_ID=\n/u);
  assert.match(env, /NEXT_PUBLIC_FANMIND_SUPPORT_CHAT_CONSENT_VERSION=\n/u);
  assert.match(route, /FANMIND_WEBSITE_CHAT_AI_ENABLED !== "true"/u);
  assert.match(launcher, /href="\/support"/u);
  assert.match(launcher, /INSTALLATION_ID_PATTERN\.test\(installationId\)/u);
  assert.match(launcher, /data-installation-id=\{installationId\}/u);
  assert.match(launcher, /language === "en" \? "Help & Support" : "Hilfe & Support"/u);
  assert.match(landing, /<PublicSupportAssistant language=\{language\} \/>/u);
});

test("Website AI reply requires a persisted inbound receipt in the same session", async () => {
  const [route, service] = await Promise.all([
    readFile(routePath, "utf8"),
    readFile(servicePath, "utf8"),
  ]);
  assert.match(route, /resolveWebsiteChatAssistantContext/u);
  assert.match(service, /website_chat_message_receipts\?select=session_id,installation_id,workspace_id,client_message_id,contact_id,conversation_id,message_id/u);
  assert.match(service, /session_id=eq\./u);
  assert.match(service, /client_message_id=eq\./u);
  assert.match(service, /session\.revoked_at/u);
  assert.match(service, /Date\.parse\(session\.expires_at\) <= Date\.now\(\)/u);
  assert.match(service, /workspace_id=eq\.\$\{encodeURIComponent\(session\.workspace_id\)\}/u);
});

test("Website AI is bounded, unstored at the provider and fail-closed", async () => {
  const route = await readFile(routePath, "utf8");
  assert.match(route, /store: false/u);
  assert.match(route, /max_output_tokens: 500/u);
  assert.match(route, /Erfinde keine Preise, Rabatte, Termine, Verfügbarkeiten, Zusagen oder Eigenschaften/u);
  assert.match(route, /biete die Übergabe an einen Menschen an/u);
  assert.match(route, /consumeSharedRateLimit/u);
  assert.match(route, /AbortSignal\.timeout\(TIMEOUT_MS\)/u);
  assert.match(route, /AI_UNAVAILABLE/u);
});

test("Website AI outbound is idempotent and stays in the same CRM conversation", async () => {
  const [route, service] = await Promise.all([
    readFile(routePath, "utf8"),
    readFile(servicePath, "utf8"),
  ]);
  assert.match(service, /buildWebsiteChatAiIdentity\(context\)/u);
  assert.match(service, /conversation_id: input\.context\.conversationId/u);
  assert.match(service, /contact_id: input\.context\.contactId/u);
  assert.match(service, /direction: "outbound"/u);
  assert.match(service, /source_platform: "website-chat"/u);
  assert.match(service, /findExistingWebsiteChatAssistantReply/u);
  assert.match(route, /scope: "website_chat_ai_message"/u);
  assert.match(route, /maxRequests: 1/u);
  assert.match(route, /AI_IN_PROGRESS/u);
  assert.ok(
    route.indexOf("findExistingWebsiteChatAssistantReply(context)") <
      route.indexOf("fetch(OPENAI_RESPONSES_URL"),
  );
});
