import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as accounting from '../src/lib/aiCapacityAccounting.mjs';
import * as capacityPolicy from '../src/lib/aiCapacityPolicy.mjs';
import * as catalog from '../src/config/openAiPriceCatalog.mjs';
import * as supportPolicy from '../src/lib/publicSupportPolicy.mjs';
import * as contextPolicy from '../src/lib/aiExecutionPolicy.mjs';

function load(file,deps={},env={},extras={}) {
 const exports={};runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
 {exports,require:n=>{if(n in deps)return deps[n];throw Error('unexpected '+n);},process:{env},Date,Buffer,AbortSignal,URLSearchParams,...extras});return exports;
}
const actor='10000000-0000-4000-8000-000000000001',workspace='20000000-0000-4000-8000-000000000001';
const requestId='30000000-0000-4000-8000-000000000001';
const identity={actor,workspace,scope:'server-scope'};
const usage={input_tokens:120,output_tokens:40,total_tokens:160,input_tokens_details:{cached_tokens:20},output_tokens_details:{reasoning_tokens:5}};
async function fixture(options={}) {
 const calls=[],seenKeys=new Set();let auths=0,providerCalls=0,recorded;
 const row={workspace_id:workspace,billing_contract_version:'capacity_v2',package_id:'capacity_99',billing_period_key:'synthetic-period',
  period_start:'2026-01-01T00:00:00Z',period_end:'2030-01-01T00:00:00Z',revision:7,active:true,source_fingerprint:'a'.repeat(64),...options.row};
 const adminPolicy={...capacityPolicy.DEFAULT_AI_CAPACITY_ADMIN_POLICY,globalCapacityEnabled:true,emergencySpendFreeze:options.frozen??false,
  qualityModeEnabled:{fast:true,balanced:true,premium:true}};
 const runtime=load('src/lib/aiCapacityRuntime.ts',{
  'server-only':{},'@/config/openAiPriceCatalog.mjs':catalog,'@/lib/aiCapacityAccounting.mjs':accounting,
  '@/lib/aiCapacityPolicy.mjs':capacityPolicy,'@/lib/aiCapacityAdmin':{getAiCapacityAdminState:async()=>({installed:true,revision:2,policy:adminPolicy})},
  '@/lib/aiCapacityLedger':{
   reserveAiCapacity:async input=>{calls.push(['reserve',input]);if(options.reserveFails)throw Error('ai_capacity_insufficient_balance');
    const created=!seenKeys.has(input.generationKey);seenKeys.add(input.generationKey);return {reservationId:'synthetic-reservation',reservedEurMicrocents:input.reservedEurMicrocents,state:'reserved',created};},
   settleAiCapacity:async input=>{calls.push(['settle',input]);if(options.settleFails)throw Error('settlement_transport_unknown');return {state:'settled'};},
   releaseAiCapacity:async (...input)=>{calls.push(['release',input]);},markAiCapacityIndeterminate:async (...input)=>{calls.push(['indeterminate',input]);}
  }
 });
 const provider=load('src/lib/supportReplyProvider.ts',{'server-only':{}},{},{fetch:async(url,init)=>{
  providerCalls++;calls.push(['provider',JSON.parse(init.body)]);assert.equal(url,'https://api.openai.com/v1/responses');
  assert.equal(init.headers.Authorization,'Bearer synthetic-key');
  if(options.networkError)throw Error('private network error');
  return {ok:!options.status,status:options.status??200,json:async()=>({output_text:options.text??'FanMind hilft bei der Bedienung.',usage:options.missingUsage?null:usage})};
 }});
 const env={OPENAI_API_KEY:'synthetic-key',FANMIND_SUPPORT_AI_QUALITY_MODE:'balanced',FANMIND_AI_CAPACITY_FX_SNAPSHOT:JSON.stringify({eurPerUsdNanos:900000000,version:'synthetic-fx',validFrom:'2026-01-01T00:00:00Z',validUntil:'2030-01-01T00:00:00Z'}),...options.env};
 const api=load('src/lib/supportCreatorCapacity.ts',{
  'server-only':{},'@/lib/aiCapacityRuntime':runtime,'@/lib/supportReplyProvider':provider,
  '@/lib/workspaceAuthorization':{requireActiveAuthorizedWorkspace:async()=>{
   auths++;return {user:{id:options.foreignActor?'foreign':actor},workspace:{id:options.switchScope&&auths>1?'foreign':workspace,owner_user_id:actor}};
  }},
  '@/lib/supportCentreServer':{supportCentreDatabase:async path=>{
   assert.ok(path.startsWith('ai_capacity_workspace_entitlements?'));
   const q=new URLSearchParams(path.split('?')[1]);assert.equal(q.get('workspace_id'),'eq.'+workspace);assert.notEqual(q.get('select'),'*');
   calls.push(['read-entitlement']);if(options.missingSchema)throw Error('missing_schema');return options.duplicateRows?[row,row]:[row];
  }},
  '@/lib/aiExecutionPolicy.mjs':contextPolicy,'@/lib/publicSupportPolicy.mjs':supportPolicy,
  '@/lib/aiUsage':{recordAiUsageEvent:async input=>{calls.push(['log']);recorded=input;}}
 },env);
 const controller=new AbortController();if(options.aborted)controller.abort();
 const run=()=>api.answerCreatorSupport({identity,requestId,question:'Wie bediene ich FanMind?',history:[{role:'user',text:'Eigene frühere Supportfrage'}],signal:controller.signal,
  beforeProvider:async()=>{calls.push(['consent-recheck']);if(options.revoked)throw Error('consent_changed');}});
 return {run,calls,get providerCalls(){return providerCalls;},get recorded(){return recorded;}};
}

test('authenticated Support reserves and settles actual Creator usage through the existing runtime before delivery',async()=>{
 const h=await fixture();assert.match(await h.run(),/FanMind/);
 const reserve=h.calls.find(x=>x[0]==='reserve')[1],settle=h.calls.find(x=>x[0]==='settle')[1];
 assert.equal(reserve.workspaceId,workspace);assert.equal(reserve.generationKey,`support:${actor}:${requestId}`);
 assert.equal(reserve.expectedEntitlementRevision,7);assert.equal(reserve.billingPeriodKey,'synthetic-period');
 assert.equal(settle.inputTokens,120);assert.equal(settle.outputTokens,40);assert.equal(settle.cachedInputTokens,20);assert.equal(settle.reasoningTokens,5);
 assert.ok(settle.actualEurMicrocents>0);assert.ok(settle.actualEurMicrocents<=reserve.reservedEurMicrocents);
 assert.equal(h.recorded.workspaceId,workspace);assert.equal(h.recorded.userId,actor);assert.equal(h.recorded.sourceRoute,'/api/support/conversation');
 assert.deepEqual(h.calls.map(x=>x[0]),['read-entitlement','reserve','consent-recheck','provider','settle','log']);
 const sent=h.calls.find(x=>x[0]==='provider')[1];assert.equal(sent.store,false);assert.equal(sent.max_output_tokens,800);
 assert.doesNotMatch(JSON.stringify(sent),/synthetic-key|server-scope|synthetic-period|workspace_id|source_fingerprint/);
});

test('missing, inactive, foreign, legacy, expired or ambiguous entitlement never reserves or calls a provider',async()=>{
 for(const options of [{missingSchema:true},{duplicateRows:true},{foreignActor:true},...[
  {workspace_id:'foreign'},{active:false},{billing_contract_version:'legacy_v1'},{package_id:'unknown'},
  {revision:0},{source_fingerprint:'bad'},{period_end:'2000-01-01T00:00:00Z'},{period_start:'2040-01-01T00:00:00Z'}
 ].map(row=>({row}))]){
  const h=await fixture(options);await assert.rejects(h.run(),/missing_schema|support_capacity_(identity_changed|entitlement_unavailable)/);assert.equal(h.providerCalls,0);assert.equal(h.calls.some(x=>x[0]==='reserve'),false);
 }
});

test('missing mode/FX, expired FX, freeze and insufficient capacity cannot fall back to Owner spending',async()=>{
 for(const options of [{env:{FANMIND_SUPPORT_AI_QUALITY_MODE:''}},{env:{FANMIND_AI_CAPACITY_FX_SNAPSHOT:''}},
  {env:{FANMIND_AI_CAPACITY_FX_SNAPSHOT:JSON.stringify({eurPerUsdNanos:900000000,version:'old',validFrom:'2000-01-01',validUntil:'2001-01-01'})}},
  {frozen:true},{reserveFails:true}]) {
  const h=await fixture(options);await assert.rejects(h.run());assert.equal(h.providerCalls,0);assert.equal(h.recorded,undefined);
 }
});

test('same generation key and concurrent duplicate never execute or settle a second provider request',async()=>{
 const h=await fixture();const r=await Promise.allSettled([h.run(),h.run()]);
 assert.equal(r.filter(x=>x.status==='fulfilled').length,1);assert.equal(h.providerCalls,1);
 assert.equal(h.calls.filter(x=>x[0]==='settle').length,1);await assert.rejects(h.run());assert.equal(h.providerCalls,1);
});

test('withdrawal, account switch and cancellation after reserve release before any provider work',async()=>{
 for(const options of [{revoked:true},{switchScope:true},{aborted:true}]){
  const h=await fixture(options);await assert.rejects(h.run());assert.equal(h.providerCalls,0);
  assert.equal(h.calls.filter(x=>x[0]==='release').length,1);assert.equal(h.calls.some(x=>x[0]==='settle'),false);
 }
});

test('definitive rejection releases; network/server uncertainty holds capacity and never retries',async()=>{
 for(const status of [400,401,403,404,422,429]){
  const h=await fixture({status});await assert.rejects(h.run());assert.equal(h.providerCalls,1);
  assert.equal(h.calls.filter(x=>x[0]==='release').length,1);assert.equal(h.calls.some(x=>x[0]==='settle'),false);
 }
 for(const options of [{networkError:true},{status:500},{status:408}]){
  const h=await fixture(options);await assert.rejects(h.run());assert.equal(h.providerCalls,1);
  assert.equal(h.calls.filter(x=>x[0]==='indeterminate').length,1);assert.equal(h.calls.some(x=>x[0]==='release'),false);
 }
});

test('missing usage remains indeterminate; unknown settlement or unsafe answer cannot be refunded or billed twice',async()=>{
 const missing=await fixture({missingUsage:true});await assert.rejects(missing.run());
 assert.equal(missing.calls.filter(x=>x[0]==='indeterminate').length,1);assert.equal(missing.calls.some(x=>x[0]==='settle'),false);
 const unknown=await fixture({settleFails:true});await assert.rejects(unknown.run());
 assert.equal(unknown.calls.filter(x=>x[0]==='settle').length,1);assert.equal(unknown.calls.some(x=>x[0]==='release'),false);
 const unsafe=await fixture({text:''});await assert.rejects(unsafe.run());
 assert.equal(unsafe.calls.filter(x=>x[0]==='settle').length,1);assert.equal(unsafe.calls.some(x=>x[0]==='release'),false);
 await assert.rejects(unsafe.run());assert.equal(unsafe.providerCalls,1);
});

test('positive current consent does not expire merely because its grant timestamp is old',()=>{
 const p=load('src/lib/supportAIConsentPolicy.ts');
 assert.equal(p.consentState({granted:true,revision:1,version:p.SUPPORT_AI_CONSENT_VERSION,grantedAt:'2020-01-01T00:00:00Z',revokedAt:null}).granted,true);
});
