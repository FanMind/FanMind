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


test("ChatAdmin maps server validation to actionable field feedback", () => {
  assert.match(source, /invalid_writing_style:\{field:"writing_style",message:"Schreibstil/);
  assert.match(source, /setInvalidField\(validation\.field\)/);
  assert.match(source, /data-invalid-field=\{invalidField\?\?undefined\}/);
  assert.match(source, /role="alert"/);
  assert.match(source, /invalid_bio:\{field:"bio",message:"Bio muss ausgefüllt sein und darf höchstens 4\.000 Zeichen enthalten\."/);
  assert.match(source, /payload_too_large:\{field:null,message:"Die Character-Daten sind insgesamt zu lang\./);
  const characterSave = source.slice(source.indexOf(" async function save("), source.indexOf(" async function deactivate("));
  assert.ok(characterSave.length > 0);
  assert.doesNotMatch(characterSave, /Speichern abgewiesen: \$\{body\.error\}/);
});

test("Character PATCH preserves bounded-body validation reasons", () => {
  const route = readFileSync("src/app/api/chatadmin/characters/route.ts", "utf8");
  const patch = route.slice(route.indexOf("export async function PATCH"), route.indexOf("export async function DELETE"));
  assert.ok(patch.length > 0);
  assert.match(patch, /if\(!body\.ok\)return NextResponse\.json\(\{error:body\.reason\}/);
  assert.doesNotMatch(patch, /!body\.ok\|\|/);
});

test("ChatAdmin validation styles mark every character input in red", () => {
  const layout = readFileSync("src/app/chatadmin/layout.tsx", "utf8");
  const css = readFileSync("src/app/chatadmin/validation.module.css", "utf8");
  assert.match(layout, /validation\.module\.css/);
  for (const field of [
    "display_name","public_age","bio","languages","profile_image_path","personality",
    "writing_style","emoji_style","sentence_style","typical_phrases","forbidden_phrases",
    "example_messages","flirt_style","sales_rules",
  ]) assert.match(css, new RegExp(`data-invalid-field="${field}"`));
  assert.match(css, /#fb7185/);
  assert.match(css, /\[role="alert"\]/);
});
