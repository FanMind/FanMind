import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routePath = new URL("../src/app/api/website-chat/reply/route.ts", import.meta.url);
const servicePath = new URL("../src/lib/websiteChat.ts", import.meta.url);
const widgetPath = new URL("../src/lib/websiteChatWidget.mjs", import.meta.url);
const launcherPath = new URL("../src/components/PublicSupportAssistant.tsx", import.meta.url);
const landingPath = new URL("../src/app/page.tsx", import.meta.url);
const envPath = new URL("../.env.example", import.meta.url);

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
  assert.match(landing, /<PublicSupportAssistant \/>/u);
});

test("Website AI reply requires a persisted inbound receipt in the same session", async () => {
  const [route, service] = await Promise.all([
    readFile(routePath, "utf8"),
    readFile(servicePath, "utf8"),
  ]);
  assert.match(route, /resolveWebsiteChatAssistantContext/u);
  assert.match(service, /website_chat_message_receipts\?select=contact_id,conversation_id,message_id/u);
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
  assert.match(service, /website-ai:\$\{context\.clientMessageId\}/u);
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

test("Website widget renders AI replies and preserves human fallback", async () => {
  const widget = await readFile(widgetPath, "utf8");
  assert.match(widget, /WEBSITE_CHAT_WIDGET_VERSION = "1\.2\.0"/u);
  assert.match(widget, /\/api\/website-chat\/reply/u);
  assert.match(widget, /addBubble\("assistant"/u);
  assert.match(widget, /persönliche Antwort ist weiterhin möglich/u);
  assert.match(widget, /\/api\/website-chat\/handoff/u);
});
