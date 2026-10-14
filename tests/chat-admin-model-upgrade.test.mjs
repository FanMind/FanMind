import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as modelPolicy from "../src/lib/chatAdminModelPolicy.mjs";
import * as usagePolicy from "../src/lib/aiUsageProviderMetrics.mjs";
import * as costEngine from "../src/lib/aiCostEngine.mjs";

const valid = {status:"completed",model:modelPolicy.getChatAdminModelProfile().model,output_text:JSON.stringify({replies:["Danke dir!", "Freut mich, dass sie dir gefallen.","Na, dann hat sich das Fotografieren gelohnt."]})};
function fakeProvider(payload=valid,status=200) {
 const calls=[];
 return {calls,fetchImpl:async(url,init)=>{calls.push({url,init});return Response.json(payload,{status});}};
}
test("ChatAdmin reuses the prepared balanced profile and leaves the CRM model resolver unchanged",()=>{
 const request=modelPolicy.buildChatAdminModelRequest("synthetic bounded context");
 assert.equal(request.model,modelPolicy.getChatAdminModelProfile().model);
 assert.equal(request.reasoning.effort,"medium");assert.equal(request.service_tier,"default");
 assert.equal(request.store,false);assert.equal(request.max_output_tokens,4096);
 assert.equal(request.text.format.schema.properties.replies.minItems,3);
 assert.match(readFileSync("src/lib/aiUsage.ts","utf8"),/FANMIND_AI_MODEL\?\.trim\(\) \|\| "gpt-5\.2"/u);
});
test("pre-switch provider probe is one synthetic no-storage request with no CRM persistence",async()=>{
 const probe=fakeProvider();await modelPolicy.verifyChatAdminModelProvider({apiKey:"synthetic-not-real",fetchImpl:probe.fetchImpl});
 assert.equal(probe.calls.length,1);assert.equal(probe.calls[0].url,"https://api.openai.com/v1/responses");
 const body=JSON.parse(probe.calls[0].init.body);assert.equal(body.store,false);assert.equal(body.model,valid.model);
 assert.doesNotMatch(probe.calls[0].init.body,/workspace_id|fan_id|conversation_id/u);
});
test("unavailable, incomplete, wrong-model and invented-price probe results block without fallback",async()=>{
 const probe=fakeProvider();await assert.rejects(()=>modelPolicy.verifyChatAdminModelProvider({apiKey:"",fetchImpl:probe.fetchImpl}));assert.equal(probe.calls.length,0);
 for(const [payload,status] of [[valid,403],[valid,429],[{...valid,status:"incomplete"},200],[{...valid,model:"other-model"},200],[{...valid,output_text:JSON.stringify({replies:["Hallo"]})},200],[{...valid,output_text:JSON.stringify({replies:["Das kostet 20 EUR", "Hallo", "Danke"]})},200]]) {
  const p=fakeProvider(payload,status);await assert.rejects(()=>modelPolicy.verifyChatAdminModelProvider({apiKey:"synthetic-not-real",fetchImpl:p.fetchImpl}));assert.equal(p.calls.length,1);
 }
});
test("provider proof precedes live switching and its diagnostics never disclose keys or replies",()=>{
 const deploy=readFileSync("scripts/operations/deploy-isolated-release.sh","utf8");
 assert.ok(deploy.indexOf('node --env-file=')<deploy.indexOf('if ! switch_current_link'));
 const source=readFileSync("scripts/operations/chat-admin-model-preflight.mjs","utf8");
 assert.match(source,/CHAT_ADMIN_MODEL_PREFLIGHT=PASS/u);assert.match(source,/CHAT_ADMIN_MODEL_PREFLIGHT=BLOCK/u);
 assert.doesNotMatch(source,/console\.|JSON\.stringify|stderr\.write\(error/u);
});
test("ChatAdmin costs include cached input and reasoning output using the canonical USD catalog",async()=>{
 let event;
 const code=ts.transpileModule(readFileSync("src/lib/aiUsage.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const compiledUsage={};const dependencies={"@/lib/supabase/config":{getSupabaseHeaders:()=>({}),getSupabaseRestUrl:()=>"https://synthetic.invalid/ai_usage_events"},"@/lib/aiUsageProviderMetrics.mjs":usagePolicy,"./aiCostEngine.mjs":costEngine,"./chatAdminModelPolicy.mjs":modelPolicy};
 runInNewContext(code,{exports:compiledUsage,process:{env:{SUPABASE_SERVICE_ROLE_KEY:"synthetic-not-real",FANMIND_AI_USAGE_CURRENCY:"EUR",FANMIND_AI_PRICE_INPUT_PER_MILLION_CENTS:"1"}},Date,fetch:async(_url,init)=>{event=JSON.parse(init.body);return new Response(null,{status:204});},require:name=>{assert.ok(Object.hasOwn(dependencies,name),name);return dependencies[name];}});
 await compiledUsage.recordAiUsageEvent({workspaceId:"synthetic",feature:"chat_admin_reply",model:valid.model,inputChars:4000,outputChars:40,status:"ok",providerUsage:{input_tokens:1000,output_tokens:100,total_tokens:1100,input_tokens_details:{cached_tokens:500},output_tokens_details:{reasoning_tokens:80}}});
 assert.equal(event.estimated_cost_cents,0.205);assert.equal(event.currency,"USD");assert.equal(event.estimated_output_tokens,100);
});
