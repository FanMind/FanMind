import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routePath = new URL("../src/app/api/website-chat/reply/route.ts", import.meta.url);
const servicePath = new URL("../src/lib/websiteChat.ts", import.meta.url);
const widgetPath = new URL("../src/lib/websiteChatWidget.mjs", import.meta.url);
const envPath = new URL("../.env.example", import.meta.url);
const decisionsPath = new URL("../project-memory/DECISIONS.md", import.meta.url);

test("Website AI is default-off and separate from Creator-Building", async () => {
  const [route, env, decisions] = await Promise.all([
    readFile(routePath, "utf8"),
    readFile(envPath, "utf8"),
    readFile(decisionsPath, "utf8"),
  ]);
  assert.match(env, /FANMIND_WEBSITE_CHAT_AI_ENABLED=false/u);
  assert.match(route, /FANMIND_WEBSITE_CHAT_AI_ENABLED !== "true"/u);
  assert.match(decisions, /Creator-Building and FanMind are separate product surfaces/u);
  assert.match(decisions, /Website AI assistant belongs to FanMind, not Creator-Building/u);
});

test("Website AI reply requires the persisted inbound Website session receipt", async () => {
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
});

test("Website AI outbound is idempotent and stays in the same CRM conversation", async () => {
  const service = await readFile(servicePath, "utf8");
  assert.match(service, /website-ai:\$\{input\.context\.clientMessageId\}/u);
  assert.match(service, /conversation_id: input\.context\.conversationId/u);
  assert.match(service, /contact_id: input\.context\.contactId/u);
  assert.match(service, /direction: "outbound"/u);
  assert.match(service, /source_platform: "website-chat"/u);
  assert.match(service, /if \(existing\[0\]\?\.content\)/u);
});

test("Website widget renders AI replies but preserves human fallback", async () => {
  const widget = await readFile(widgetPath, "utf8");
  assert.match(widget, /WEBSITE_CHAT_WIDGET_VERSION = "1\.2\.0"/u);
  assert.match(widget, /\/api\/website-chat\/reply/u);
  assert.match(widget, /addBubble\("assistant"/u);
  assert.match(widget, /persönliche Antwort ist weiterhin möglich/u);
  assert.match(widget, /\/api\/website-chat\/handoff/u);
});
