import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as creatorPolicy from "../src/lib/creatorIntelligencePolicy.mjs";
import * as executionPolicy from "../src/lib/aiExecutionPolicy.mjs";
import * as mutationPolicy from "../src/lib/httpMutationPolicy.mjs";
import * as authPolicy from "../src/lib/workspaceAuthorizationPolicy.mjs";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const contactId = "22222222-2222-4222-8222-222222222222";
const creatorId = "33333333-3333-4333-8333-333333333333";
const conversationId = "44444444-4444-4444-8444-444444444444";
function compile(path) { return ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText; }
const replyCode = compile("src/app/api/ai/reply-suggestions/route.ts");
const fanCode = compile("src/app/api/creators/fan/route.ts");
const loaderCode = compile("src/lib/creatorIntelligence.ts");
function evaluate(code, dependencies, extra = {}) {
  const exports = {};
  runInNewContext(code, { exports, Response, Request, URL, AbortSignal, Date, ...extra,
    require(name) { assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`); return dependencies[name]; },
  });
  return exports;
}
function context() {
  const bundle = creatorPolicy.defaultCreatorBundle();
  return { creatorId, revision: 1, persona: { ...bundle.persona, displayName: "Synthetic Sophie" },
    voice: { ...bundle.voice, tone: "Warm and playful", avoidedPhrases: ["forbidden phrase"] }, playbook: bundle.playbook,
    strategy: creatorPolicy.deriveCreatorStrategy({ playbook: bundle.playbook }) };
}
function harness({ denied = false, owner = true, changed = false, summaryMismatch = false, enabled = true } = {}) {
  const calls = { ai: [], voices: 0, memories: 0, contexts: 0, saves: [] };
  const dependencies = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/creatorIntelligencePolicy.mjs": creatorPolicy,
    "@/lib/aiExecutionPolicy.mjs": executionPolicy,
    "@/lib/httpMutationPolicy.mjs": { ...mutationPolicy, isTrustedFanMindMutationRequest: (request) => mutationPolicy.isTrustedFanMindMutationRequest(request, {}) },
    "@/lib/workspaceProcessingPolicy.mjs": { evaluateWorkspaceProcessingEntitlement: () => ({ allowed: true }) },
    "@/config/aiTiers.mjs": { getAiTierConfig: () => ({ contextMessageLimit: 50 }) },
    "@/lib/requestAccessToken": { BearerAccessTokenError: class extends Error {}, getOptionalBearerAccessToken: () => undefined },
    "@/lib/rateLimit": { getClientIp: () => "192.0.2.1" },
    "@/lib/sharedRateLimit": { consumeSharedRateLimit: async () => ({ allowed: true }) },
    "@/lib/subscriptionCancellation": { isWorkspaceArchivedAfterSubscriptionEnd: () => false },
    "@/lib/workspaceAiTierEntitlements": { getResolvedWorkspaceAiTier: async () => ({ entitlement: { effectiveTierId: "starter" } }) },
    "@/lib/aiUsage": { getFanMindAiModel: () => "synthetic-model", recordAiUsageEvent: async () => {} },
    "@/lib/workspaceAiPrompts": { getWorkspaceAiPromptContext: async () => ({ companyPrompt: "Agency rules", profileName: "Default", profilePrompt: "Follow approved rules" }) },
    "@/lib/workspaceAuthorization": { ...authPolicy, requireContactInActiveAuthorizedWorkspace: async (id) => {
      if (denied || id !== contactId) throw new authPolicy.WorkspaceAuthorizationError("Denied", "resource_forbidden");
      return { workspace: { id: workspaceId, owner_user_id: "owner" }, user: { id: owner ? "owner" : "member" }, contact: { id: contactId, workspace_id: workspaceId, display_name: "Synthetic fan" } };
    } },
    "@/lib/creatorIntelligence": {
      creatorIntelligenceEnabled: () => enabled,
      loadCreatorReplyContext: async (workspace, contact) => { assert.equal(workspace, workspaceId); assert.equal(contact, contactId); calls.contexts++; return changed && calls.contexts > 1 ? { ...context(), revision: 2 } : context(); },
      getCreatorFanData: async () => ({ configured: true, events: [], offers: [], commercial: {} }),
      saveCreatorFanReview: async (...args) => { calls.saves.push(args); creatorPolicy.normalizeCreatorFanReview(args[2]); },
    },
    "@/lib/supabase/server": {
      getRecentContactConversationMessages: async () => ({ messages: [{ conversation_id: conversationId, direction: "inbound", content: "Wie geht es dir?" }], error: null }),
      getFanAnalysisReport: async () => ({ report: null }), getContactAiProfile: async () => ({ profile: null }),
      getWorkspaceVoiceProfile: async () => { calls.voices++; return { profile: { tone: "Chatter voice" } }; },
      getRecentContactMemories: async (workspace, contact) => { assert.equal(workspace, workspaceId); assert.equal(contact, contactId); calls.memories++; return { memories: [{ content: "Synthetic fan likes hiking." }] }; },
      getConversationSummary: async () => ({ summary: { contact_id: summaryMismatch ? creatorId : contactId, summary: "Synthetic summary" } }),
    },
  };
  const runtime = {
    process: { env: { OPENAI_API_KEY: "synthetic-no-provider" } },
    fetch: async (_url, options) => {
      calls.ai.push(JSON.parse(options.body));
      return Response.json({ output_text: JSON.stringify({ reply_options: ["Hey!", "Schön von dir zu hören.", "Was machst du heute?"].map((text) => ({ text })), suggested_memory: { content: "", importance: "normal" }, suggested_followup: { recommended: false, in_days: null, reason: "" } }) });
    },
  };
  return { calls, reply: evaluate(replyCode, dependencies, runtime), fan: evaluate(fanCode, dependencies, runtime) };
}
function post(path, body, origin = "https://fanmind.invalid") { return new Request(`https://fanmind.invalid${path}`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }); }

test("actual reply route auto-loads the account Creator, memory and summary and ignores a caller's Creator override", async () => {
  const h = harness();
  const response = await h.reply.POST(post("/api/ai/reply-suggestions", { contactId, creatorId: "forged", creatorContext: { persona: "forged" } }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.creator_context.name, "Synthetic Sophie");
  assert.deepEqual(result.reply_options.map((option) => option.label), ["Recommended", "Softer", "Stronger"]);
  assert.equal(h.calls.voices, 0); assert.equal(h.calls.memories, 1); assert.equal(h.calls.contexts, 2);
  const sent = JSON.parse(h.calls.ai[0].input[1].content);
  assert.equal(sent.creatorContext.creatorId, creatorId);
  assert.match(sent.fanMemory, /likes hiking/); assert.equal(sent.conversationSummary, "Synthetic summary");
  assert.doesNotMatch(JSON.stringify(sent), /forged|Chatter voice/);
  assert.equal(h.calls.ai[0].store, false);
});

test("foreign contact and mixed summary produce no AI request, while a changed profile discards the generated draft", async () => {
  for (const config of [{ denied: true }, { summaryMismatch: true }]) {
    const h = harness(config);
    assert.notEqual((await h.reply.POST(post("/api/ai/reply-suggestions", { contactId }))).status, 200);
    assert.equal(h.calls.ai.length, 0);
  }
  const h = harness({ changed: true });
  const response = await h.reply.POST(post("/api/ai/reply-suggestions", { contactId }));
  assert.equal(response.status, 500); assert.equal((await response.json()).reply_options, undefined);
});

test("actual fan review route checks contact ownership, origin and rollout before any write", async () => {
  const payload = { confirmed: true, event: null, commercial: { fanStage: "unknown", engagementScore: null, purchaseIntentScore: null, offerFatigue: null, salesHold: true, offerRequested: false, requestedOfferId: null, sourceReference: "synthetic-evidence", preferredContent: [], preferredStyle: "" } };
  for (const config of [{ denied: true }, { owner: false }, { enabled: false }]) {
    const h = harness(config);
    assert.notEqual((await h.fan.POST(post(`/api/creators/fan?contactId=${contactId}`, payload))).status, 200);
    assert.equal(h.calls.saves.length, 0);
  }
  const h = harness();
  assert.equal((await h.fan.POST(post(`/api/creators/fan?contactId=${contactId}`, payload, "https://foreign.invalid"))).status, 403);
  assert.equal(h.calls.saves.length, 0);
  assert.equal((await h.fan.POST(post(`/api/creators/fan?contactId=${contactId}`, payload))).status, 200);
  assert.equal(h.calls.saves[0][0], workspaceId); assert.equal(h.calls.saves[0][1], contactId);
});

test("actual loader uses the user's JWT and Workspace filter, and disabled rollout makes zero requests", async () => {
  const calls = [];
  const dependencies = {
    "server-only": {}, "next/headers": { cookies: async () => { throw new Error("bearer must not read cookies"); } },
    "@/lib/creatorIntelligencePolicy.mjs": creatorPolicy,
    "@/lib/supabase/config": { SUPABASE_ACCESS_TOKEN_COOKIE: "synthetic", getSupabaseRestUrl: (table) => `https://supabase.invalid/rest/v1/${table}`, getSupabaseHeaders: (token) => ({ Authorization: `Bearer ${token}` }) },
  };
  const env = { FANMIND_CREATOR_INTELLIGENCE_ENABLED: "false" };
  const loader = evaluate(loaderCode, dependencies, { process: { env }, fetch: async (url, options) => { calls.push({ url, options }); return Response.json([]); } });
  assert.equal(await loader.loadCreatorReplyContext(workspaceId, contactId, "synthetic-jwt"), null);
  assert.equal(calls.length, 0);
  env.FANMIND_CREATOR_INTELLIGENCE_ENABLED = "true";
  assert.equal(await loader.loadCreatorReplyContext(workspaceId, contactId, "synthetic-jwt"), null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get("workspace_id"), `eq.${workspaceId}`);
  assert.equal(calls[0].options.headers.Authorization, "Bearer synthetic-jwt");
  assert.equal(calls[0].options.cache, "no-store");
});
