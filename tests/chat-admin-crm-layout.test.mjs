import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync("src/app/chatadmin/ChatAdminClient.tsx", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
}).outputText;

function loadClient() {
  const clientModule = { exports: {} };
  const localRequire = (name) => {
    if (name === "./chatadmin.module.css") return new Proxy({}, { get: (_, key) => String(key) });
    return require(name);
  };
  new Function("module", "exports", "require", compiled)(clientModule, clientModule.exports, localRequire);
  return clientModule.exports;
}

const arela = {
  id: "10000000-0000-4000-8000-000000000001",
  workspace_id: "20000000-0000-4000-8000-000000000001",
  display_name: "Arela Voss",
  profile_image_path: null,
  public_age: 25,
  bio: "Creatorin",
  location: "Wien",
  languages: ["Deutsch"],
  personality: "selbstbewusst",
  writing_style: "natürlich",
  emoji_style: "sparsam",
  sentence_style: "kurz",
  typical_phrases: [],
  forbidden_phrases: [],
  flirt_style: "respektvoll",
  sales_rules: "kein Druck",
  example_messages: [],
  status: "active",
  revision: 7,
  created_at: "2026-09-26T00:00:00Z",
  updated_at: "2026-09-26T00:00:00Z",
};

test("ChatAdmin renders the compact CRM workspace contract", () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { ChatAdminClient } = loadClient();
  const html = renderToStaticMarkup(React.createElement(ChatAdminClient, { initialCharacters: [arela] }));

  assert.match(html, /aria-label="Charaktere"/);
  assert.match(html, /aria-label="Fans von Arela Voss"/);
  assert.match(html, /aria-label="Gespräch"/);
  assert.doesNotMatch(html, /Revision 7/);
});

test("ChatAdmin groups stored AI suggestions under their inbound fan message", () => {
  const { groupChatMessages } = loadClient();
  assert.equal(typeof groupChatMessages, "function");
  assert.deepEqual(groupChatMessages([
    { id: "confirmed", direction: "confirmed_reply", content: "Hallo", created_at: "2026-09-30T10:00:00Z" },
    { id: "inbound", direction: "fan_inbound", content: "Wie geht es dir?", created_at: "2026-09-30T10:01:00Z" },
    { id: "suggestion-1", direction: "suggested_reply", content: "Gut", created_at: "2026-09-30T10:01:01Z" },
    { id: "suggestion-2", direction: "suggested_reply", content: "Sehr gut", created_at: "2026-09-30T10:01:02Z" },
    { id: "suggestion-3", direction: "suggested_reply", content: "Bestens", created_at: "2026-09-30T10:01:03Z" },
  ]), [
    { message: { id: "confirmed", direction: "confirmed_reply", content: "Hallo", created_at: "2026-09-30T10:00:00Z" }, suggestions: [] },
    { message: { id: "inbound", direction: "fan_inbound", content: "Wie geht es dir?", created_at: "2026-09-30T10:01:00Z" }, suggestions: [
      { id: "suggestion-1", direction: "suggested_reply", content: "Gut", created_at: "2026-09-30T10:01:01Z" },
      { id: "suggestion-2", direction: "suggested_reply", content: "Sehr gut", created_at: "2026-09-30T10:01:02Z" },
      { id: "suggestion-3", direction: "suggested_reply", content: "Bestens", created_at: "2026-09-30T10:01:03Z" },
    ] },
  ]);
});
