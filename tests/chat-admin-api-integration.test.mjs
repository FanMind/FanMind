import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as chatPolicy from "../src/lib/chatAdminPolicy.mjs";
import * as mutationPolicy from "../src/lib/httpMutationPolicy.mjs";
import { WorkspaceAuthorizationError } from "../src/lib/workspaceAuthorizationPolicy.mjs";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const characterId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const code = ts.transpileModule(readFileSync("src/app/api/chatadmin/reply-suggestions/route.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function harness(change) {
  let revoked = false;
  let character = {
    id: characterId, workspace_id: workspaceId, revision: 1, status: "active",
    display_name: "Synthetic Ada", public_age: 25, bio: "Synthetische Testpersona",
    location: null, languages: ["Deutsch"], personality: "freundlich", writing_style: "kurz",
    emoji_style: "sparsam", sentence_style: "kurz", typical_phrases: [], forbidden_phrases: [],
    flirt_style: "respektvoll", sales_rules: "kein Druck", example_messages: [], profile_image_path: null,
  };
  let context = { workspace: { id: workspaceId }, user: { id: userId } };
  const calls = { provider: 0, authorization: 0, character: 0, usage: 0 };
  const dependencies = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/chatAdmin": {
      requireChatAdminCapability: async () => { calls.authorization++; if (revoked) throw new WorkspaceAuthorizationError("Denied", "resource_forbidden"); return context; },
      getChatCharacter: async (workspace, id) => { calls.character++; assert.equal(workspace, workspaceId); assert.equal(id, characterId); if (!character) throw new WorkspaceAuthorizationError("Denied", "resource_forbidden"); return { ...character }; },
    },
    "@/lib/chatAdminPolicy.mjs": chatPolicy,
    "@/lib/aiUsage": { getFanMindAiModel: () => "synthetic-model", recordAiUsageEvent: async () => { calls.usage++; } },
    "@/lib/httpMutationPolicy.mjs": { ...mutationPolicy, isTrustedFanMindMutationRequest: request => mutationPolicy.isTrustedFanMindMutationRequest(request, {}) },
    "@/lib/sharedRateLimit": { consumeSharedRateLimit: async () => ({ allowed: true }) },
    "@/lib/workspaceAuthorization": { WorkspaceAuthorizationError },
  };
  const exports = {};
  runInNewContext(code, {
    exports, Response, Request, URL, AbortSignal, Date,
    process: { env: { OPENAI_API_KEY: "synthetic-no-provider" } },
    require(name) { assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name]; },
    fetch: async () => {
      calls.provider++;
      if (change === "revoke") revoked = true;
      if (change === "revision") character.revision++;
      if (change === "inactive") character.status = "inactive";
      if (change === "persona") character.writing_style = "different current style";
      if (change === "deleted") character = null;
      if (change === "workspace") context = { ...context, workspace: { id: characterId } };
      return Response.json({ output_text: JSON.stringify({ replies: ["Hallo!", "Wie geht es dir?", "Schön von dir zu hören."] }) });
    },
  });
  const request = (revision = 1, origin = "https://fanmind.invalid") => new Request("https://fanmind.invalid/api/chatadmin/reply-suggestions", {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ character_id: characterId, character_revision: revision, incoming_message: "Hallo, wie geht es dir?", fan_label: "Synthetic Fan" }),
  });
  return { calls, route: exports.POST, request };
}

test("actual ChatAdmin route returns exactly three suggestions bound to the current authorized Character", async () => {
  const h = harness(); const response = await h.route(h.request()); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.replies.length, 3);
  assert.equal(body.character_id, characterId); assert.equal(body.character_revision, 1);
});
for (const change of ["revoke", "revision", "inactive", "persona", "deleted", "workspace"]) {
  test(`actual ChatAdmin route discards provider output after ${change} changes during generation`, async () => {
    const h = harness(change); const response = await h.route(h.request());
    assert.notEqual(response.status, 200); assert.equal((await response.json()).replies, undefined);
    assert.equal(h.calls.provider, 1);
    assert.equal(h.calls.usage, 1, "one provider call must produce exactly one usage event");
  });
}
test("wrong origin and initially stale revision never call the provider", async () => {
  const h = harness();
  assert.equal((await h.route(h.request(1, "https://foreign.invalid"))).status, 403);
  assert.equal((await h.route(h.request(2))).status, 409);
  assert.equal(h.calls.provider, 0);
});
