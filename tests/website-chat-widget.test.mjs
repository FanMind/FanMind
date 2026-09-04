import assert from "node:assert/strict";
import test from "node:test";
import { buildWebsiteChatWidgetScript } from "../src/lib/websiteChatWidget.mjs";
import {
  WEBSITE_CHAT_INSTALLATION_HEADER,
  WEBSITE_CHAT_INSTALLATION_QUERY,
} from "../src/lib/websiteChatPolicy.mjs";

test("widget is consent-first, cookie-free and uses only the public Website Chat APIs", () => {
  const source = buildWebsiteChatWidgetScript();
  assert.match(source, /consent\.checked/u);
  assert.match(source, /credentials:"omit"/u);
  assert.match(source, /\/api\/website-chat\/session/u);
  assert.match(source, /\/api\/website-chat\/message/u);
  assert.match(source, /crypto\.randomUUID\(\)/u);
  assert.match(source, /!pendingClientMessageId \|\| pendingMessage !== message/u);
  assert.match(source, /pendingClientMessageId = crypto\.randomUUID\(\); pendingMessage = message/u);
  assert.match(source, /clientMessageId:pendingClientMessageId/u);
  assert.match(source, /pendingClientMessageId = null; pendingMessage = null; status\.textContent = "Danke/u);
  assert.match(source, /response\.status === 401\) sessionToken = null/u);
  assert.doesNotMatch(source, /catch \{ sessionToken = null/u);
  assert.match(source, /keine automatische KI-Antwort/u);
  assert.doesNotMatch(source, /document\.cookie|localStorage|sessionStorage|OPENAI|poll|outbound/iu);
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
