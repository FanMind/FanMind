import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

// Execute the production query function, not a copied implementation. The
// provider is synthetic; this proves query binding, not real database RLS.
const serverPath = "src/lib/supabase/server.ts";
const serverSource = ts.createSourceFile(serverPath, readFileSync(serverPath, "utf8"), ts.ScriptTarget.Latest, true);
const declaration = serverSource.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "getRecentContactConversationMessages");
assert.ok(declaration);
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const workspace = "10000000-0000-4000-8000-000000000001";
const contact = "20000000-0000-4000-8000-000000000001";
const selected = "40000000-0000-4000-8000-000000000001";
const foreign = "40000000-0000-4000-8000-000000000999";

function queryHarness(rows = []) {
  const calls = [];
  const exports = {};
  runInNewContext(compile(declaration.getText(serverSource)), {
    exports, CONVERSATION_MESSAGE_COLUMNS: "synthetic-columns", Math,
    getAccessToken: async supplied => supplied,
    conversationMessagesError: message => ({ messages: [], error: { message } }),
    postgrestSelect: async (...args) => {
      calls.push(args);
      const matches = rows.filter(row => args[3].every(([key, value]) => row[key] === value));
      return { data: matches.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, args[4]), error: null };
    },
  });
  return { query: exports.getRecentContactConversationMessages, calls };
}

function routeHarness(query) {
  const calls = [];
  const exports = {};
  const dependencies = {
    "next/server": { NextResponse: { json: (body, options) => ({ body, ...options }) } },
    "@/lib/requestAccessToken": { getOptionalBearerAccessToken: () => "synthetic-user-token", BearerAccessTokenError: class extends Error {} },
    "@/lib/httpMutationPolicy.mjs": { isTrustedFanMindMutationRequest: () => true, readBoundedJsonRequest: async request => ({ ok: true, value: request.payload }) },
    "@/lib/workspaceAuthorization": { WorkspaceAuthorizationError: class extends Error {}, requireContactInActiveAuthorizedWorkspace: async id => {
      assert.equal(id, contact);
      return { contact: { id: contact }, workspace: { id: workspace }, user: { id: "synthetic-user" } };
    } },
    "@/lib/subscriptionCancellation": { isWorkspaceArchivedAfterSubscriptionEnd: () => false },
    "@/lib/creatorIntelligence": { loadCreatorReplyContext: async () => null },
    "@/lib/workspaceAiPrompts": { getWorkspaceAiPromptContext: async () => ({}) },
    "@/lib/workspaceAiTierEntitlements": { getResolvedWorkspaceAiTier: async () => ({ entitlement: { effectiveTierId: "synthetic" } }) },
    "@/config/aiTiers.mjs": { getAiTierConfig: () => ({ contextMessageLimit: 50 }) },
    "@/lib/supabase/server": {
      getRecentContactConversationMessages: (...args) => { calls.push(args); return query(...args); },
      getFanAnalysisReport: async () => ({ report: null }),
      getContactAiProfile: async () => ({ profile: null }),
      getWorkspaceVoiceProfile: async () => ({ profile: null }),
    },
  };
  runInNewContext(compile(readFileSync("src/app/api/ai/reply-suggestions/route.ts", "utf8")), {
    exports, URL, Date, console: { error() {} },
    fetch() { assert.fail("No provider request may follow an inaccessible selected conversation"); },
    require(name) { return dependencies[name] ?? {}; },
  });
  return { post: exports.POST, calls };
}

test("reply history query keeps workspace, contact and selected conversation before its bound", async () => {
  const row = (patch = {}) => ({ workspace_id: workspace, contact_id: contact, conversation_id: selected, id: "selected-message", created_at: "2026-11-13T09:00:00Z", ...patch });
  const h = queryHarness([row(), row({ id: "other-post", conversation_id: foreign }), row({ id: "other-workspace", workspace_id: "foreign" }), row({ id: "other-contact", contact_id: "foreign" })]);
  const result = await h.query(workspace, contact, 999, "synthetic-user-token", selected);
  assert.deepEqual(Array.from(result.messages, message => message.id), ["selected-message"]);
  assert.equal(h.calls.length, 1);
  assert.deepEqual(Array.from(h.calls[0][3], pair => Array.from(pair)), [["workspace_id", workspace], ["contact_id", contact], ["conversation_id", selected]]);
  assert.equal(h.calls[0][4], 150);
});

test("missing or foreign selected conversation returns 400 without unscoped retry or provider call", async () => {
  const h = queryHarness([{ workspace_id: "foreign", contact_id: contact, conversation_id: foreign, created_at: "2026-11-13T09:00:00Z" }]);
  const route = routeHarness(h.query);
  const result = await route.post({ payload: { contactId: contact, conversationId: foreign, incomingMessage: "Synthetic manual text must not bypass an inaccessible thread" } });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /ausgewählten Gespräch/u);
  assert.equal(route.calls.length, 1);
  assert.equal(route.calls[0][4], foreign);
  assert.equal(h.calls.length, 1);
});

test("malformed selected conversation is rejected before the history query", async () => {
  const h = queryHarness();
  const route = routeHarness(h.query);
  for (const conversationId of ["", "not-a-uuid", "x&workspace_id=foreign", null]) {
    const result = await route.post({ payload: { contactId: contact, conversationId } });
    assert.equal(result.status, 400);
  }
  assert.equal(route.calls.length, 0);
  assert.equal(h.calls.length, 0);
});
