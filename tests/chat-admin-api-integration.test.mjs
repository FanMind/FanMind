import * as replyQualityPolicy from "../src/lib/replyQualityPolicy.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as modelPolicy from "../src/lib/chatAdminModelPolicy.mjs";
import * as knowledgePolicy from "../src/lib/chatAdminKnowledge.mjs";
import * as chatPolicy from "../src/lib/chatAdminPolicy.mjs";
import { CHAT_ADMIN_DIALOGUE_GUIDANCE } from "../src/lib/chatAdminDialogueGuidance.mjs";
import * as mutationPolicy from "../src/lib/httpMutationPolicy.mjs";
import { WorkspaceAuthorizationError } from "../src/lib/workspaceAuthorizationPolicy.mjs";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const characterId = "22222222-2222-4222-8222-222222222222";
const fanId = "44444444-4444-4444-8444-444444444444";
const conversationId = "55555555-5555-4555-8555-555555555555";
const userId = "33333333-3333-4333-8333-333333333333";
const code = ts.transpileModule(readFileSync("src/app/api/chatadmin/reply-suggestions/route.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function authorityHarness(email, role = "owner") {
  const context = { user: { id: userId, email }, workspace: { id: workspaceId, role } };
  const calls = { capability: 0 };
  const compile = path => ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const admin = {};
  runInNewContext(compile("src/lib/admin.ts"), {
    exports: admin, process: { env: { FANMIND_ADMIN_EMAILS: "platform-admin@fanmind.invalid" } },
    require(name) { assert.ok(["next/navigation", "@/lib/supabase/server"].includes(name)); return {}; },
  });
  const dependencies = {
    "@/lib/replyQualityPolicy.mjs": replyQualityPolicy,
    "@/lib/admin": admin,
    "next/headers": { cookies: async () => ({ get: () => ({ value: "synthetic-session" }) }) },
    "@/lib/supabase/config": { getSupabaseHeaders: () => ({}), getSupabaseRestUrl: path => `https://database.invalid/${path}`, SUPABASE_ACCESS_TOKEN_COOKIE: "synthetic" },
    "@/lib/workspaceAuthorization": { WorkspaceAuthorizationError, requireActiveAuthorizedWorkspace: async () => context },
  };
  const authority = {};
  runInNewContext(compile("src/lib/chatAdmin.ts"), {
    exports: authority,
    require(name) { assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name]; },
    fetch: async () => {
      calls.capability++;
      return Response.json([{ workspace_id: workspaceId, chat_admin_multi_character: true }]);
    },
  });
  return { authority, calls, context };
}

test("actual authority permits a normal Owner with the explicit capability", async () => {
  const h = authorityHarness("owner@fanmind.invalid");
  assert.equal(await h.authority.requireChatAdminCapability(), h.context);
  assert.equal(h.calls.capability, 1);
});
for (const email of ["platform-admin@fanmind.invalid", " PLATFORM-ADMIN@FANMIND.INVALID "]) {
  test(`actual authority permits configured Platform Admin only through Owner role and explicit capability (${email.trim()})`, async () => {
    const h = authorityHarness(email);
    assert.equal(await h.authority.requireChatAdminCapability(), h.context);
    assert.equal(await h.authority.hasChatAdminCapability(), true);
    assert.equal(h.calls.capability, 2);
  });
}
test("actual authority rejects a Member even when the capability store would return a grant", async () => {
  const h = authorityHarness("member@fanmind.invalid", "member");
  await assert.rejects(h.authority.requireChatAdminCapability(), error => error instanceof WorkspaceAuthorizationError && error.code === "resource_forbidden");
  assert.equal(h.calls.capability, 0);
});
function harness(change, abortController) {
  let revoked = false;
  let providerFinished=false;
  let persisted=[];
  let character = {
    id: characterId, workspace_id: workspaceId, revision: 1, status: "active",
    display_name: "Synthetic Ada", public_age: 25, bio: "Synthetische Testpersona",
    location: null, languages: ["Deutsch"], personality: "freundlich", writing_style: "kurz",
    emoji_style: "sparsam", sentence_style: "kurz", typical_phrases: [], forbidden_phrases: [],
    flirt_style: "respektvoll", sales_rules: "kein Druck", example_messages: [], profile_image_path: null,
    sales_playbook: { positioning:"", minimumHoursBetweenOffers:48, aftercareHours:48, contentBoundaries:[], confirmationRequired:[], noGos:[], offers:[{id:"private_photo",name:"Privates Foto",category:"private_photo",description:"5 persönlich ausgewählte Fotos im digitalen Set.",currency:"EUR",minimumPriceMinor:2500,recommendedPriceMinor:2500,maximumPriceMinor:2500,maximumDiscountPercent:0,delivery:"",exclusivity:"",requiresConfirmation:false,active:true}] },
  };
  if (String(change).startsWith("ambiguous-offer")) {
    character.sales_playbook.offers.unshift({...character.sales_playbook.offers[0],id:"photo",name:"Foto",category:"photo",
      minimumPriceMinor:1000,recommendedPriceMinor:1000,maximumPriceMinor:1000});
  }
  if (change === "context-price-en") character.sales_playbook.offers[0].name = "Private Photo";
  let context = { workspace: { id: workspaceId }, user: { id: userId } };
  const calls = { provider: 0, authorization: 0, character: 0, usage: 0, usageEvents: [], providerBody: null, providerSignals: [], providerBodies: [], rateLimitCalls: 0, persistedHistoryIds: null, memoryWrites: [] };
  const dependencies = {
    "@/lib/replyQualityPolicy.mjs": replyQualityPolicy,
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/chatAdmin": {
      isChatAdminFanRuntimeEnabled: () => true,
      requireChatAdminFanRuntime: () => undefined,
      requireChatAdminCapability: async () => { calls.authorization++; if (revoked) throw new WorkspaceAuthorizationError("Denied", "resource_forbidden"); return context; },
      getChatCharacter: async (workspace, id) => { calls.character++; assert.equal(workspace, workspaceId); assert.equal(id, characterId); if (!character) throw new WorkspaceAuthorizationError("Denied", "resource_forbidden"); return { ...character }; },
      getChatFan: async (workspace, selectedCharacter, id) => ({ id, workspace_id: workspace, character_id: selectedCharacter, status:"active", revision:1, display_name:"Synthetic Fan", handle:null, platform:"OnlyFans", language:"Deutsch", summary:"mag kurze Antworten", notes:"kein Druck" }),
      getLatestChatAdminConfirmedReply: async()=>change==="closed"||((change==="close-during-provider"||change==="quality-close")&&providerFinished)?{id:"77777777-7777-4777-8777-777777777777",direction:"confirmed_reply",content:"Das Gespräch ist beendet."}:null,
      getChatConversation: async (workspace, selectedCharacter, selectedFan, id) => ({ id, workspace_id:workspace, character_id:selectedCharacter, fan_id:selectedFan }),
      listRecentChatMessages: async () => change==="offer-follow-up" ? [
        {id:"offer-inbound",workspace_id:workspaceId,character_id:characterId,fan_id:fanId,conversation_id:conversationId,direction:"fan_inbound",content:"Ich möchte ein privates Foto",created_at:"2026-10-14T12:00:00Z"},
        {id:"offer-confirmed",workspace_id:workspaceId,character_id:characterId,fan_id:fanId,conversation_id:conversationId,direction:"confirmed_reply",content:"Private Fotos bekommst du für 25 EUR.",created_at:"2026-10-14T12:01:00Z"},
      ] : [
        { id:"history-1", workspace_id:workspaceId, character_id:characterId, fan_id:fanId, conversation_id:conversationId, direction:"confirmed_reply", content:"Unser letzter Insider", created_at:"2026-10-07T10:00:00Z" },
        { id:"unused-1", workspace_id:workspaceId, character_id:characterId, fan_id:fanId, conversation_id:conversationId, direction:"suggested_reply", content:"UNUSED MODEL DRAFT", created_at:"2026-10-07T10:00:01Z" },
      ],
      getChatAdminGeneration: async () => change === "retry-learning" ? [{direction:"fan_inbound",sequence:10,content:"Ich mag kurze Antworten ohne Emojis."},...Array.from({length:3},()=>({direction:"suggested_reply",content:"Hallo!"}))] : persisted,
      updateChatFan: async (...args) => { calls.memoryWrites.push(args); if(change==="memory-revoked")revoked=true; if(change === "memory-race") throw new Error("revision_changed"); return {}; },
      persistChatAdminGeneration: async (...args) => { calls.persistedHistoryIds=args[7]; persisted=[{direction:"fan_inbound",sequence:10,content:args[8]}]; return args.at(-1); },
    },
    "@/lib/chatAdminPolicy.mjs": chatPolicy,
    "@/lib/chatAdminModelPolicy.mjs": modelPolicy,
    "@/lib/chatAdminKnowledge.mjs": knowledgePolicy,
    "@/lib/aiUsage": { getFanMindAiModel: () => "synthetic-model", recordAiUsageEvent: async event => { calls.usage++; calls.usageEvents.push(event); } },
    "@/lib/httpMutationPolicy.mjs": { ...mutationPolicy, isTrustedFanMindMutationRequest: request => mutationPolicy.isTrustedFanMindMutationRequest(request, {}) },
    "@/lib/sharedRateLimit": { consumeSharedRateLimit: async () => ({ allowed: ++calls.rateLimitCalls===1 || change!=="quality-limit" }) },
    "@/lib/workspaceAuthorization": { WorkspaceAuthorizationError },
    "@/lib/aiExecutionPolicy.mjs": { AI_REPLY_INPUT_CHAR_LIMIT: 80_000 },
  };
  const exports = {};
  runInNewContext(code, {
    exports, Response, Request, URL, AbortSignal, Date,
    process: { env: { OPENAI_API_KEY: "synthetic-no-provider", FANMIND_CHAT_ADMIN_CHARACTER_FANS_ENABLED: "true" } },
    require(name) { assert.ok(Object.hasOwn(dependencies, name), name); return dependencies[name]; },
    fetch: async (_url, init) => {
      calls.provider++;providerFinished=true;
      calls.providerBody=JSON.parse(init.body); calls.providerBodies.push(calls.providerBody); calls.providerSignals.push(init.signal);
      if(change==="timeout")throw Object.assign(new Error("synthetic timeout"),{name:"TimeoutError"});
      if (change === "revoke") revoked = true;
      if (change === "revision") character.revision++;
      if (change === "inactive") character.status = "inactive";
      if (change === "persona") character.writing_style = "different current style";
      if (change === "deleted") character = null;
      if (change === "workspace") context = { ...context, workspace: { id: characterId } };
      let replies = change === "invented-price" ? ["Das private Foto kostet 25 EUR.", "Für 25 EUR ist es erhältlich.", "Der Preis ist 25 EUR."] : change === "invalid-price-output" ? ["Nicht für 999 EUR, sondern für 25 EUR.", "Für 25 EUR ist es erhältlich.", "Der Preis ist 25 EUR."] : ["Hallo!", "Wie geht es dir?", "Schön von dir zu hören."];
      if (change === "ambiguous-offer") replies=["Welchen der beiden Artikel meinst du?","Soll es das Foto oder das private Foto sein?","Bitte wähle zuerst einen Artikel aus."];
      if (change === "ambiguous-offer-price") replies=["Das kostet 25 EUR.","Für 25 EUR.","Der Preis ist 25 EUR."];

      if (change === "refusal-price") replies = ["Das kostet 25 EUR.", "Für 25 EUR ist es erhältlich.", "Der Preis ist 25 EUR."];
      if (String(change).startsWith("context-price")) replies = ["Das private Foto kostet 25 EUR.", "Für 25 EUR ist es erhältlich.", "Der Preis ist 25 EUR."];
      if (String(change).startsWith("quality-") && (calls.provider === 1 || change === "quality-stuck")) replies = ["Hallo!", "Hallo!", "Hallo!"];
      if (change === "quality-price" && calls.provider === 2) replies = ["Für 999 EUR.", "Das kostet 999 EUR.", "Der Preis ist 999 EUR."];
      if (change === "quality-revoke") revoked = true;
      if (change === "quality-abort") abortController.abort();
      return Response.json({ usage:{input_tokens:1000,output_tokens:100,total_tokens:1100}, output_text: JSON.stringify({ replies, memory: change === "learn" || change === "memory-race" ? [{kind:"communication",quote:"Ich mag kurze Antworten ohne Emojis.",source:"incoming"}] : [] }) });
    },
  });
  const request = (revision = 1, origin = "https://fanmind.invalid", incomingMessage = "Ich will ein privates Foto von dir.") => new Request("https://fanmind.invalid/api/chatadmin/reply-suggestions", {
    method: "POST", signal: abortController?.signal, headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ character_id: characterId, character_revision: revision, fan_id: fanId, conversation_id: conversationId, generation_id:"66666666-6666-4666-8666-666666666666", incoming_message: incomingMessage }),
  });
  return { calls, route: exports.POST, request };
}

test("real reply route includes bounded teaching examples without turning them into fan or article data", async () => {
  const h = harness();
  const response = await h.route(h.request(1, "https://fanmind.invalid", "Danke für die netten Fotos."));
  assert.equal(response.status, 200);
  assert.equal(h.calls.provider, 1, "guidance does not add a second provider request");
  const [system, user] = h.calls.providerBody.input;
  assert.equal(system.role, "system");
  assert.ok(system.content.includes(CHAT_ADMIN_DIALOGUE_GUIDANCE));
  assert.ok(CHAT_ADMIN_DIALOGUE_GUIDANCE.length < 6_000, "fixed input overhead stays bounded");
  const context = JSON.parse(user.content);
  assert.equal(context.sales_playbook.requested_offer, null, "a teaching offer never releases a real offer");
  assert.equal(context.fan.id, fanId);
  assert.equal(context.style.writing, "kurz");
  assert.equal(context.rules.examples.length, 0, "the stored Character examples are not overwritten");
  assert.deepEqual(context.conversation.recent_messages.map(message => message.content), ["Unser letzter Insider"]);
  assert.doesNotMatch(user.content, /Stadtaufnahmen|bestandenen Prüfung|UNUSED MODEL DRAFT/u);
  assert.throws(() => chatPolicy.assertChatAdminReplySemantics(["Für 25 EUR.", "Hallo", "Danke"], context.incoming_message, null), /reply_price_not_permitted/u);
});

test("actual ChatAdmin route returns exactly three suggestions bound to the current authorized Character", async () => {
  const h = harness(); const response = await h.route(h.request()); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.replies.length, 3);
  assert.equal(body.character_id, characterId); assert.equal(body.character_revision, 1);
  assert.equal(h.calls.providerBody.store, false);
  assert.equal(h.calls.providerBody.input[0].content, chatPolicy.CHAT_ADMIN_REPLY_INSTRUCTIONS);
  assert.equal(h.calls.providerBody.model,modelPolicy.getChatAdminModelProfile().model);
  assert.equal(h.calls.providerBody.reasoning.effort,"medium");
  assert.equal(h.calls.providerBody.service_tier,"default");
  assert.equal(h.calls.providerBody.max_output_tokens,8192);
  assert.equal(h.calls.providerBody.store,false);
  const suppliedContext = JSON.parse(h.calls.providerBody.input[1].content);
  assert.equal(suppliedContext.fan.summary, "mag kurze Antworten");
  assert.equal(suppliedContext.fan.notes, "kein Druck");
  assert.equal(suppliedContext.conversation.recent_messages[0].content, "Unser letzter Insider");
  assert.equal(suppliedContext.conversation.recent_messages.length, 1);
  assert.doesNotMatch(h.calls.providerBody.input[1].content, /UNUSED MODEL DRAFT/u);
  assert.deepEqual(Array.from(h.calls.persistedHistoryIds), ["history-1", "unused-1"], "atomic persistence still binds the full stored history");
  assert.equal(suppliedContext.sales_playbook.requested_offer.category,"private_photo");
  assert.equal(suppliedContext.sales_playbook.requested_offer.recommendedPriceMinor,2500);
});
for (const change of ["revoke", "revision", "inactive", "persona", "deleted", "workspace"]) {
  test(`actual ChatAdmin route discards provider output after ${change} changes during generation`, async () => {
    const h = harness(change); const response = await h.route(h.request());
    assert.notEqual(response.status, 200); assert.equal((await response.json()).replies, undefined);
    assert.equal(h.calls.provider, 1);
    assert.equal(h.calls.usage, 1, "one provider call must produce exactly one usage event");
  });
}
test("fan-invented price is withheld from the model while three bound-price replies succeed", async () => {
  const h = harness("invented-price"); const response = await h.route(h.request(1, "https://fanmind.invalid", "Ist dein privates Foto für 999 EUR erhältlich?")); const body = await response.json();
  assert.equal(response.status, 200); assert.equal(body.replies.length, 3);
  assert.ok(body.replies.every(reply => /25 EUR/u.test(reply) && !/999/u.test(reply)));
  const suppliedContext = h.calls.providerBody.input[1].content;
  assert.match(suppliedContext,/vom Fan genannter, unbestätigter Preis/u); assert.doesNotMatch(suppliedContext,/999 EUR/u);
  assert.equal(h.calls.provider, 1); assert.deepEqual(Array.from(h.calls.persistedHistoryIds), ["history-1", "unused-1"]);
});

test("a provider-invented price still returns the safe policy error before persistence", async () => {
  const h = harness("invalid-price-output"); const response = await h.route(h.request(1, "https://fanmind.invalid", "Ist dein privates Foto für 999 EUR erhältlich?")); const body = await response.json();
  assert.equal(response.status, 400); assert.equal(body.error, "reply_price_not_permitted");
  assert.equal(h.calls.provider, 1); assert.equal(h.calls.persistedHistoryIds, null);
});

test("actual route passes ambiguous named offers as non-selling context and allows clarification",async()=>{
 const h=harness("ambiguous-offer");const response=await h.route(h.request(1,"https://fanmind.invalid","Was kostet Foto oder Privates Foto?"));
 const body=await response.json();assert.equal(response.status,200);assert.equal(body.replies.length,3);
 const context=JSON.parse(h.calls.providerBody.input[1].content);
 assert.equal(context.sales_playbook.requested_offer,null);assert.deepEqual(context.sales_playbook.offers,[]);
 assert.equal(context.sales_strategy.sellNow,false);assert.equal(context.style.writing,"kurz");
 assert.equal(h.calls.provider,1);assert.equal(h.calls.usage,1);
 assert.match(body.safety_note,/manuell/u);
});

test("actual route rejects a price for ambiguous named offers with the existing error and no persistence",async()=>{
 const h=harness("ambiguous-offer-price");const response=await h.route(h.request(1,"https://fanmind.invalid","Was kostet Foto oder Privates Foto?"));
 const body=await response.json();assert.equal(response.status,400);assert.equal(body.error,"reply_price_not_permitted");
 assert.equal(body.replies,undefined);assert.equal(h.calls.persistedHistoryIds,null);
 assert.equal(h.calls.memoryWrites.length,0);assert.equal(h.calls.provider,1);assert.equal(h.calls.usage,1);
});

test("wrong origin and initially stale revision never call the provider", async () => {
  const h = harness();
  assert.equal((await h.route(h.request(1, "https://foreign.invalid"))).status, 403);
  assert.equal((await h.route(h.request(2))).status, 409);
  assert.equal(h.calls.provider, 0);
});

test("actual Fan route deletes only the revision-bound Fan in the authorized workspace", async () => {
  const compiled = ts.transpileModule(readFileSync("src/app/api/chatadmin/fans/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const calls = [];
  const route = {};
  runInNewContext(compiled, {
    exports: route, Response, Request, URL,
    require(name) {
      const dependencies = {
    "@/lib/replyQualityPolicy.mjs": replyQualityPolicy,
        "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
        "@/lib/chatAdmin": {
          createChatFan: async () => {}, listChatFans: async () => [], updateChatFan: async () => {},
          requireChatAdminFanRuntime: () => undefined,
          requireChatAdminCapability: async () => ({ workspace: { id: workspaceId } }),
          deleteChatFan: async (...args) => { calls.push(args); },
        },
        "@/lib/chatAdminPolicy.mjs": chatPolicy,
    "@/lib/chatAdminModelPolicy.mjs": modelPolicy,
    "@/lib/chatAdminKnowledge.mjs": knowledgePolicy,
        "@/lib/httpMutationPolicy.mjs": { ...mutationPolicy, isTrustedFanMindMutationRequest: request => mutationPolicy.isTrustedFanMindMutationRequest(request, {}) },
        "@/lib/workspaceAuthorization": { WorkspaceAuthorizationError },
      };
      assert.ok(Object.hasOwn(dependencies, name), name);
      return dependencies[name];
    },
  });
  assert.equal(typeof route.DELETE, "function");
  const response = await route.DELETE(new Request("https://fanmind.invalid/api/chatadmin/fans", {
    method: "DELETE", headers: { origin: "https://fanmind.invalid", "content-type": "application/json" },
    body: JSON.stringify({ character_id: characterId, id: fanId, revision: 3 }),
  }));
  assert.equal(response.status, 204);
  assert.deepEqual(calls, [[workspaceId, characterId, fanId, 3]]);
});

for (const change of ["learn","memory-race"]) test(`actual route learns after durable generation and reports ${change}`, async()=>{
 const h=harness(change);const response=await h.route(h.request(1,"https://fanmind.invalid","Ich mag kurze Antworten ohne Emojis.")); const body=await response.json();
 assert.equal(response.status,200);assert.equal(body.replies.length,3);assert.equal(h.calls.provider,1);assert.equal(h.calls.memoryWrites.length,1);
 const [workspace,character,fan,revision,payload]=h.calls.memoryWrites[0];assert.equal(workspace,workspaceId);assert.equal(character,characterId);assert.equal(fan,fanId);assert.equal(revision,1);
 assert.equal(knowledgePolicy.readChatAdminKnowledge(payload.notes).facts[0].source,"66666666-6666-4666-8666-666666666666");
 assert.equal(body.memory_status,change==="learn"?"saved":"not_saved");assert.notEqual(h.calls.persistedHistoryIds,null);
});

test("same-generation retry repairs a partial knowledge save without a second provider call",async()=>{
 const h=harness("retry-learning");const response=await h.route(h.request(1,"https://fanmind.invalid","Ich mag kurze Antworten ohne Emojis."));const body=await response.json();
 assert.equal(response.status,200);assert.equal(body.memory_status,"saved");assert.equal(h.calls.provider,0);assert.equal(h.calls.memoryWrites.length,1);assert.equal(h.calls.persistedHistoryIds,null);
});

test("authority loss detected during knowledge saving suppresses reply disclosure",async()=>{
 const h=harness("memory-revoked");const response=await h.route(h.request(1,"https://fanmind.invalid","Ich mag kurze Antworten ohne Emojis."));
 assert.equal(response.status,403);assert.equal((await response.json()).replies,undefined);assert.equal(h.calls.provider,1);
});


test("rejected model output still records actual provider usage including reasoning",async()=>{
 const h=harness("invalid-price-output");const response=await h.route(h.request(1,"https://fanmind.invalid","Was kostet ein privates Foto für 999 EUR?"));
 assert.equal(response.status,400);assert.equal(h.calls.usageEvents.length,1);
 assert.equal(h.calls.usageEvents[0].status,"error");assert.equal(h.calls.usageEvents[0].providerUsage.output_tokens,100);
});


test("provider timeout is distinguishable and cannot persist replies or learned facts",async()=>{
 const h=harness("timeout");const response=await h.route(h.request(1,"https://fanmind.invalid","Ich mag kurze Antworten ohne Emojis."));
 assert.equal(response.status,504);assert.equal((await response.json()).error,"reply_generation_timeout");
 assert.equal(h.calls.provider,1);assert.equal(h.calls.persistedHistoryIds,null);assert.equal(h.calls.memoryWrites.length,0);
 assert.equal(h.calls.usageEvents.length,1);assert.equal(h.calls.usageEvents[0].status,"error");
 assert.equal(h.calls.usageEvents[0].errorCode,"chat_admin_provider_timeout");
});


test("actual reply route forwards article contents for a confirmed content follow-up",async()=>{
 const h=harness("offer-follow-up");const response=await h.route(h.request(1,"https://fanmind.invalid","Was bekomme ich da?"));
 assert.equal(response.status,200);
 const context=JSON.parse(h.calls.providerBody.input[1].content);
 assert.equal(context.sales_playbook.requested_offer.description,"5 persönlich ausgewählte Fotos im digitalen Set.");
 assert.equal(context.sales_playbook.requested_offer.recommendedPriceMinor,2500);
 assert.deepEqual(Array.from(h.calls.persistedHistoryIds),["offer-inbound","offer-confirmed"]);
});


test("confirmed closure stops provider calls, reply persistence and learning",async()=>{
 const h=harness("closed");const response=await h.route(h.request());
 assert.equal(response.status,409);assert.equal((await response.json()).error,"conversation_paused");
 assert.equal(h.calls.provider,0);assert.equal(h.calls.persistedHistoryIds,null);assert.equal(h.calls.memoryWrites.length,0);assert.equal(h.calls.usageEvents.length,0);
});
test("closure confirmed during generation suppresses disclosure and persistence",async()=>{
 const h=harness("close-during-provider");const response=await h.route(h.request());
 assert.equal(response.status,409);assert.equal((await response.json()).error,"conversation_paused");
 assert.equal(h.calls.provider,1);assert.equal(h.calls.persistedHistoryIds,null);assert.equal(h.calls.memoryWrites.length,0);
});


test("actual conversation API exposes closure pause and rejects another confirmation",async()=>{
 const compiled=ts.transpileModule(readFileSync("src/app/api/chatadmin/conversations/route.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 let confirmations=0;const api={};const row={id:"77777777-7777-4777-8777-777777777777",direction:"confirmed_reply",content:"Ich antworte nicht weiter."};
 const dependencies={
  "next/server":{NextResponse:{json:(body,init)=>Response.json(body,init)}},
  "@/lib/chatAdmin":{requireChatAdminFanRuntime:()=>{},requireChatAdminCapability:async()=>({workspace:{id:workspaceId}}),getChatFan:async()=>({id:fanId,notes:""}),getFanConversation:async()=>({id:conversationId,fan_id:fanId}),listChatMessages:async()=>[],getLatestChatAdminConfirmedReply:async()=>row,persistChatAdminConfirmedReply:async()=>{confirmations++;return row;}},
  "@/lib/chatAdminKnowledge.mjs":knowledgePolicy,
  "@/lib/workspaceAuthorization":{WorkspaceAuthorizationError},
  "@/lib/httpMutationPolicy.mjs":{...mutationPolicy,isTrustedFanMindMutationRequest:request=>mutationPolicy.isTrustedFanMindMutationRequest(request,{})},
 };
 runInNewContext(compiled,{exports:api,require:name=>{assert.ok(Object.hasOwn(dependencies,name),name);return dependencies[name];}});
 const result=await api.GET({nextUrl:new URL(`https://fanmind.invalid/api/chatadmin/conversations?character_id=${characterId}&fan_id=${fanId}`)});
 assert.equal(result.status,200);assert.equal((await result.json()).reply_pause.paused,true,"latest closure remains effective even outside displayed history");
 const response=await api.POST(new Request("https://fanmind.invalid/api/chatadmin/conversations",{method:"POST",headers:{origin:"https://fanmind.invalid","content-type":"application/json"},body:JSON.stringify({character_id:characterId,fan_id:fanId,conversation_id:conversationId,character_revision:1,fan_revision:1,confirmation_id:"66666666-6666-4666-8666-666666666666",direction:"confirmed_reply",content:"Alte Antwort"})}));
 assert.equal(response.status,409);assert.equal((await response.json()).error,"conversation_paused");assert.equal(confirmations,0);
});


test("ChatAdmin repairs once, retains one deadline and accounts for both actual provider calls", async () => {
 const h=harness("quality-repair"); const response=await h.route(h.request()); const body=await response.json();
 assert.equal(response.status,200); assert.equal(body.replies.length,3); assert.equal(h.calls.provider,2);
 assert.equal(h.calls.providerSignals[0],h.calls.providerSignals[1]);
 assert.deepEqual(h.calls.providerBodies[0].input,h.calls.providerBodies[1].input.slice(0,2));
 assert.deepEqual(JSON.parse(h.calls.providerBodies[1].input[2].content).quality_revision.previous_drafts,["Hallo!","Hallo!","Hallo!"]);
 assert.equal(h.calls.usageEvents.length,2); assert.deepEqual(h.calls.usageEvents.map(e=>e.status),["error","ok"]);
 assert.equal(h.calls.usageEvents[0].providerUsage.input_tokens,1000); assert.equal(h.calls.usageEvents[1].providerUsage.output_tokens,100);
 assert.notEqual(h.calls.persistedHistoryIds,null); assert.equal(h.calls.memoryWrites.length,0);
});
test("two repetitive ChatAdmin outputs never persist suggestions or learn incoming preferences", async () => {
 const h=harness("quality-stuck"); const response=await h.route(h.request(1,"https://fanmind.invalid","Ich mag kurze Antworten ohne Emojis."));
 assert.equal(response.status,502); assert.equal((await response.json()).error,"reply_quality_rejected");
 assert.equal(h.calls.provider,2); assert.equal(h.calls.usageEvents.length,2); assert.equal(h.calls.persistedHistoryIds,null); assert.equal(h.calls.memoryWrites.length,0);
});
test("rewrite still enforces current article prices and cannot trigger a third call", async () => {
 const h=harness("quality-price"); const response=await h.route(h.request());
 assert.equal(response.status,400); assert.equal((await response.json()).error,"reply_price_not_permitted");
 assert.equal(h.calls.provider,2); assert.equal(h.calls.usageEvents.length,2); assert.equal(h.calls.persistedHistoryIds,null);
});
test("revocation, closure or request abort between quality attempts prevents the second provider call", async () => {
 for(const change of ["quality-revoke","quality-close","quality-abort"]){
  const controller=new AbortController(); const h=harness(change,controller); const response=await h.route(h.request());
  assert.notEqual(response.status,200,change); assert.equal((await response.json()).replies,undefined);
  assert.equal(h.calls.provider,1,change); assert.equal(h.calls.usageEvents.length,1,change); assert.equal(h.calls.persistedHistoryIds,null); assert.equal(h.calls.memoryWrites.length,0);
 }
});

test("ChatAdmin correction consumes the existing per-call rate limit and cannot bypass it", async () => {
 const h=harness("quality-limit"); const response=await h.route(h.request());
 assert.equal(response.status,429); assert.equal(h.calls.provider,1); assert.equal(h.calls.rateLimitCalls,2);
 assert.equal(h.calls.usageEvents.length,1); assert.equal(h.calls.persistedHistoryIds,null);
});


test("actual reply route withholds current refused offers and retains manual review", async () => {
 for(const incoming of ["Ich möchte kein Foto, nur reden.","Keine Videos bitte.","Ich möchte nichts kaufen.","Bitte keine Angebote mehr.","Kein privates Foto, aber ein normales Bild.","I don't want a video, just chat.","Privates Foto bitte nicht."]){
  const h=harness();const response=await h.route(h.request(1,"https://fanmind.invalid",incoming));
  assert.equal(response.status,200,incoming);const body=await response.json();assert.equal(body.replies.length,3);
  const context=JSON.parse(h.calls.providerBody.input[1].content);
  assert.equal(context.sales_playbook.requested_offer,null);assert.deepEqual(context.sales_playbook.offers,[]);
  assert.equal(context.sales_strategy.sellNow,false);assert.equal(context.style.writing,"kurz");
  assert.equal(h.calls.provider,1);assert.equal(h.calls.usageEvents.length,1);assert.equal(h.calls.memoryWrites.length,0);
  assert.ok(h.calls.persistedHistoryIds);assert.match(body.safety_note,/manuell/u);
 }
});
test("actual reply route rejects prices after explicit refusal without persistence or learning", async () => {
 const h=harness("refusal-price");const response=await h.route(h.request(1,"https://fanmind.invalid","Privates Foto bitte nicht."));
 assert.equal(response.status,400);const body=await response.json();assert.equal(body.error,"reply_price_not_permitted");
 assert.equal(body.replies,undefined);assert.equal(h.calls.persistedHistoryIds,null);assert.equal(h.calls.memoryWrites.length,0);
 assert.equal(h.calls.provider,1);assert.equal(h.calls.usageEvents.length,1);
});

for(const [change,incoming] of [["context-price","Nicht schlecht, was kostet das private Foto?"],["context-price-en","Not bad. How much is the private photo?"]])test(`actual route permits only the bound price for contextual appreciation: ${incoming}`,async()=>{
 const h=harness(change);const response=await h.route(h.request(1,"https://fanmind.invalid",incoming));
 const body=await response.json();assert.equal(response.status,200);assert.equal(body.replies.length,3);
 const context=JSON.parse(h.calls.providerBody.input[1].content);
 assert.equal(context.incoming_message,incoming);assert.equal(context.sales_playbook.requested_offer.id,"private_photo");
 assert.equal(context.sales_playbook.requested_offer.recommendedPriceMinor,2500);assert.equal(context.sales_strategy.sellNow,true);
 assert.equal(context.character_id,characterId);assert.equal(context.fan.id,fanId);assert.equal(context.style.writing,"kurz");
 assert.equal(h.calls.provider,1);assert.equal(h.calls.usageEvents.length,1);assert.equal(h.calls.memoryWrites.length,0);
 assert.ok(h.calls.persistedHistoryIds);assert.match(body.safety_note,/manuell/u);
});

for(const incoming of ["Nicht schlecht, was kostet das private Foto? Ich lehne ab.","Not bad. How much is the private photo? No thanks.","Ich möchte nicht warten. Was kostet das private Foto?", "Kein Video, aber ein privates Foto?"])test(`actual route retains the price veto for unclear or refused requests: ${incoming}`,async()=>{
 const h=harness("context-price");const response=await h.route(h.request(1,"https://fanmind.invalid",incoming));
 const body=await response.json();assert.equal(response.status,400);assert.equal(body.error,"reply_price_not_permitted");
 const context=JSON.parse(h.calls.providerBody.input[1].content);
 assert.equal(context.sales_playbook.requested_offer,null);assert.equal(context.sales_strategy.sellNow,false);
 assert.equal(h.calls.persistedHistoryIds,null);assert.equal(h.calls.memoryWrites.length,0);assert.equal(h.calls.usageEvents.length,1);
});
