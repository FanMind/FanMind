import "./supportCreator.test.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as http from "./httpMutationPolicy.mjs";
function load(file, dependencies = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { if(name === "@/lib/httpMutationPolicy.mjs") return {...http,isTrustedFanMindMutationRequest:request=>http.isTrustedMutationRequest(request,["https://staging.fanmind.ch"])}; if (Object.hasOwn(dependencies,name)) return dependencies[name]; throw new Error(`unexpected import ${name}`); }, Date, TextDecoder, Headers, URL });
  return exports;
}
const { isSupportCase, supportCaseNeedsAttention, performSupportDecision } = load("src/lib/supportCentrePolicy.ts");
const workspace = "10000000-0000-4000-8000-000000000001";
const id = "10000000-0000-4000-8000-000000000002";
const sample = () => ({ id, workspace_id: workspace, connection_id: "10000000-0000-4000-8000-000000000003", platform: "facebook", problem: "sync_attention", action: "refresh_readonly_status", permission: "read_connection_status", status: "running", created_at: new Date().toISOString(), expires_at: new Date(Date.now()+1800000).toISOString(), completed_at: null });
test("support centre: hostile tenant/action/permission/platform/expiry claims fail closed", () => {
  assert.equal(isSupportCase(sample(), workspace),true);
  for (const bad of [{workspace_id:id},{action:"restart_message_sync"},{permission:"write"},{platform:"__proto__"},{problem:"__proto__"},{status:"approved"},{expires_at:"invalid"},{expires_at:new Date(Date.now()+7200000).toISOString()}]) assert.equal(isSupportCase({...sample(),...bad},workspace),false);
});
test("support centre: immutable claim is executed once with two independent checks", async () => {
  let consumed = false, reads = 0, finishes = 0;
  const deps = { claim: async()=>{ if(consumed) throw new Error("replay"); consumed=true; return sample(); }, check: async()=>{ reads++; return true; }, finish: async success=>{ assert.equal(success,true); finishes++; } };
  assert.equal(await performSupportDecision({workspace,id,decision:"approve"},deps),"succeeded");
  await assert.rejects(performSupportDecision({workspace,id,decision:"approve"},deps),/replay/);
  assert.equal(reads,2); assert.equal(finishes,1);
});
test("support centre: reject never checks or executes", async()=>{
  assert.equal(await performSupportDecision({workspace,id,decision:"reject"},{claim:async()=>({...sample(),status:"rejected"}), check:async()=>assert.fail(),finish:async()=>assert.fail()}),"rejected");
});
test("support centre: stale, foreign and wrong-state claims never check", async()=>{
  for (const bad of [{workspace_id:id},{id:workspace},{status:"pending"},{expires_at:new Date(Date.now()-1).toISOString()}]) {
    await assert.rejects(performSupportDecision({workspace,id,decision:"approve"},{claim:async()=>({...sample(),...bad}),check:async()=>assert.fail(),finish:async()=>assert.fail()}));
  }
});
test("support centre: failed check or failed postcheck cannot produce success", async()=>{
  for(const scenario of ["pre","post","exception"]) {
    let reads=0;
    assert.equal(await performSupportDecision({workspace,id,decision:"approve"},{claim:async()=>sample(),check:async()=>{reads++;if(scenario==="exception")throw new Error("private");return scenario==="pre"?reads!==1:reads!==2;},finish:async ok=>assert.equal(ok,false)}),"failed");
  }
});
test("support centre: terminal audit failure never reports success", async()=>{
  await assert.rejects(performSupportDecision({workspace,id,decision:"approve"},{claim:async()=>sample(),check:async()=>true,finish:async()=>{throw new Error("audit");}}),/audit/);
});
test("support centre: routine successes are silent, expired approvals do not alert",()=>{
  assert.equal(supportCaseNeedsAttention({...sample(),status:"succeeded"},Date.now()),false);
  assert.equal(supportCaseNeedsAttention({...sample(),status:"pending",expires_at:"2020-01-01"},Date.now()),false);
  assert.equal(supportCaseNeedsAttention({...sample(),status:"failed"},Date.now()),true);
  assert.equal(supportCaseNeedsAttention({...sample(),status:"running"},Date.now()),true);
});
test("support centre: bounded request rejects oversized UTF-8 bodies and arrays",async()=>{
  const {readSupportRequest}=load("src/lib/supportCentreRequest.ts");
  assert.equal((await readSupportRequest(new Request("https://example.test",{method:"POST",body:'{"a":1}'}),10)).a,1);
  await assert.rejects(readSupportRequest(new Request("https://example.test",{method:"POST",body:JSON.stringify({a:"ä".repeat(8)})}),20));
  await assert.rejects(readSupportRequest(new Request("https://example.test",{method:"POST",body:"[]"}),10));
});
test("support centre actual decision route: auth, Owner, Origin, fields and fail-closed rate boundary", async()=>{
  let enabled=true, actor={user:{id},owner:true}, allowed=true, decisions=0;
  const {readSupportRequest}=load("src/lib/supportCentreRequest.ts");
  const {POST}=load("src/app/api/admin/support/decision/route.ts",{
    "next/server":{NextResponse:{json:(body,options={})=>({body,status:options.status??200,headers:options.headers})}},
    "@/lib/supportCentreRequest":{readSupportRequest},
    "@/lib/supportCentrePolicy":load("src/lib/supportCentrePolicy.ts"),
    "@/lib/sharedRateLimit":{consumeSharedRateLimit:async()=>({allowed})},
    "@/lib/supportCentreServer":{notifySupport:async()=>undefined,supportCentreEnabled:()=>enabled,supportCentreActor:async()=>actor,decideSupportCase:async()=>{decisions++;return "rejected";}},
  });
  const request=(body={workspace,id,decision:"reject"},origin="https://example.test")=>{
    const req=new Request("https://example.test/api/admin/support/decision",{method:"POST",headers:{origin},body:JSON.stringify(body)});
    req.nextUrl=new URL(req.url);return req;
  };
  enabled=false; assert.equal((await POST(request())).status,404); enabled=true;
  assert.equal((await POST(request(undefined,"https://evil.test"))).status,403);
  actor=null; assert.equal((await POST(request())).status,401);
  actor={user:{id},owner:false};assert.equal((await POST(request())).status,403);
  actor={user:{id},owner:true};assert.equal((await POST(request({workspace,id,decision:"approve",action:"write"}))).status,400);
  assert.equal((await POST(request({workspace,id,decision:"approve",connection_id:id}))).status,400);
  assert.equal((await POST(request({workspace,id,decision:["approve"]}))).status,400);
  allowed=false;assert.equal((await POST(request())).status,429);allowed=true;
  assert.equal(decisions,0);
  assert.equal((await POST(request())).status,200);assert.equal(decisions,1);
});
test("support postcheck rejects connected records with synchronization errors",()=>{
 const {verifyConnectionAfterRepair}=load("src/lib/supportRepairPostcheck.ts");
 assert.equal(verifyConnectionAfterRepair([{platform:"facebook",status:"connected",last_messenger_sync_error:"private failure"}],"facebook").verified,false);
 assert.equal(verifyConnectionAfterRepair([{platform:"facebook",status:"connected",last_messenger_sync_error:null}],"facebook").verified,true);
});
test("authenticated conversation actual route derives identity and forbids foreign scope/fields",async()=>{
 let identity={actor:id,workspace,scope:"bound"},calls=0,enabled=true;
 const {GET,POST}=load("src/app/api/support/conversation/route.ts",{
  "next/server":{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}},
  "@/lib/supportContinuityServer":{supportCustomer:async()=>identity,readSupportConversation:async()=>[]},
  "@/lib/supportCentreServer":{supportCentreEnabled:()=>enabled,supportCentreDatabase:async(_,body)=>{assert.equal(body.p_workspace,workspace);assert.equal(body.p_actor,id);calls++;return{};}},
  "@/lib/supportCentreRequest":load("src/lib/supportCentreRequest.ts"),"@/lib/supportCentrePolicy":load("src/lib/supportCentrePolicy.ts"),
  "@/lib/sharedRateLimit":{consumeSharedRateLimit:async()=>({allowed:true})},"@/lib/supportKnowledge":{supportAnswer:()=>({answer:"documented",unanswered:false})},
 });
 const req=(body,origin="https://example.test")=>{const r=new Request("https://example.test/api/support/conversation",{method:"POST",headers:{origin},body:JSON.stringify(body)});r.nextUrl=new URL(r.url);return r;};
 const message={scope:"bound",question:"Hilfe",context:"support",requestId:id};
 assert.equal((await POST(req({...message,workspace}))).status,409);
 assert.equal((await POST(req({...message,scope:"other"}))).status,409);
 assert.equal((await POST(req(message,"https://evil.test"))).status,403);
 assert.equal(calls,0);assert.equal((await POST(req(message))).status,200);assert.equal(calls,1);
 assert.equal((await POST(req({scope:"bound",handoff:true}))).status,200);assert.equal(calls,2);
 identity=null;assert.equal((await GET()).status,401);enabled=false;assert.equal((await GET()).status,404);
});

test('Support POST routes accept the configured HTTPS origin behind an internal proxy and retain CSRF denial',async()=>{
 const routes=[['support/conversation',401],['support/privacy',401],['support/escalate',401],['admin/support/decision',401],['admin/support/overview',403],['support/automatic-check',403],['support/repair-request',400]];
 for(const [path,expected] of routes){
  const exports={};
  const dependencies={
   'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}},
   '@/lib/httpMutationPolicy.mjs':{...http,isTrustedFanMindMutationRequest:r=>http.isTrustedFanMindMutationRequest(r,{NEXT_PUBLIC_APP_URL:'https://staging.fanmind.ch'})},
   '@/lib/supportCentreServer':{supportCentreEnabled:()=>true,supportCentreActor:async()=>null},
   '@/lib/supportContinuityServer':{supportCustomer:async()=>null},
   '@/lib/supabase/server':{getSupabaseServerUser:async()=>({data:{user:null}})},
   '@/lib/supportRepairPolicy':{getSupportRepairPolicy:()=>null},
  };
  runInNewContext(ts.transpileModule(readFileSync(`src/app/api/${path}/route.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>dependencies[n]??{},process:{env:{FANMIND_SUPPORT_CENTRE_ENABLED:'true',FANMIND_INAPP_HELP_REPAIR_ENABLED:'true',FANMIND_INAPP_HELP_DIAGNOSTICS_ENABLED:'true',FANMIND_INAPP_HELP_AUTOMATIC_CHECKS_ENABLED:'true'}}});
  const request=(origin,site='same-origin')=>{const r=new Request(`http://localhost:3001/api/${path}`,{method:'POST',headers:{...(origin?{origin}:{}),'sec-fetch-site':site,'content-type':'application/json'},body:'{}'});r.nextUrl=new URL(r.url);return r;};
  assert.equal((await exports.POST(request('https://staging.fanmind.ch'))).status,expected,path);
  for(const [origin,site] of [[null,'same-origin'],['https://foreign.invalid','same-origin'],['https://staging.fanmind.ch','cross-site']])assert.equal((await exports.POST(request(origin,site))).status,403,path);
 }
});


test("authenticated AI Support reuses the public guarded pipeline only after consent and identity checks",async()=>{
 const policy=await import('./publicSupportPolicy.mjs');
 let identity={actor:id,workspace,scope:"bound"},enabled=true,allowed=true,modelCalls=0,writes=0,providerStatus=200,reply="Synthetische KI-Antwort",changeIdentity=false,abort;
 let retained=Array.from({length:3},(_,i)=>({request_id:`previous-${i}`,question:`own-question-${i}`,answer:`own-answer-${i}`,unanswered:false}));
 let forwarded;
 const {POST}=load("src/app/api/support/conversation/route.ts",{
  "next/server":{NextRequest:Request,NextResponse:{json:(body,options={})=>({body,status:options.status??200})}},
  "@/lib/supportContinuityServer":{supportCustomer:async()=>identity,readSupportConversation:async target=>{assert.equal(target.actor,id);assert.equal(target.workspace,workspace);return retained;}},
  "@/lib/supportCentreServer":{supportCentreEnabled:()=>enabled,supportCentreDatabase:async(_,body)=>{assert.equal(body.p_actor,id);assert.equal(body.p_workspace,workspace);writes++;retained=[...retained,{request_id:body.p_request,question:body.p_question,answer:body.p_answer,unanswered:body.p_unanswered}];}},
  "@/lib/supportCentreRequest":load("src/lib/supportCentreRequest.ts"),"@/lib/supportCentrePolicy":load("src/lib/supportCentrePolicy.ts"),
  "@/lib/sharedRateLimit":{consumeSharedRateLimit:async()=>({allowed})},"@/lib/supportKnowledge":{supportAnswer:()=>({answer:"approved local knowledge",unanswered:false})},
  "@/lib/publicSupportPolicy.mjs":policy,
  "../../public-support/route":{POST:async request=>{modelCalls++;forwarded=await request.json();if(changeIdentity)identity={...identity,scope:"foreign"};abort?.();return new Response(JSON.stringify({reply}),{status:providerStatus,headers:{'Content-Type':'application/json'}});}},
 });
 const request=(body,origin="https://example.test",signal)=>new Request("https://example.test/api/support/conversation",{method:"POST",headers:{origin,'content-type':'application/json'},body:JSON.stringify(body),signal});
 const message={requestId:id,scope:"bound",question:"How do I review an answer?",context:"dashboard",aiConsent:true};
 assert.equal((await POST(request({...message,scope:"foreign"}))).status,409);
 assert.equal((await POST(request(message,"https://evil.invalid"))).status,403);
 assert.equal((await POST(request({...message,aiConsent:"true"}))).status,400);
 allowed=false;assert.equal((await POST(request(message))).status,429);allowed=true;
 assert.equal(modelCalls,0);assert.equal(writes,0);
 const ok=await POST(request(message));assert.equal(ok.status,200);assert.equal(ok.body.answerMode,"ai");assert.equal(modelCalls,1);assert.equal(writes,1);
 assert.equal(forwarded.consent,true);assert.equal(forwarded.question,message.question);assert.equal(forwarded.history.length,4);assert.equal(forwarded.history[0].text,'own-question-1');
 assert.deepEqual(Object.keys(forwarded).sort(),['consent','history','language','question']);
 const replay=await POST(request(message));assert.equal(replay.body.answerMode,'stored');assert.equal(modelCalls,1);assert.equal(writes,1);
 retained=[];
 providerStatus=503;assert.equal((await POST(request(message))).status,503);assert.equal(writes,1);
 providerStatus=429;assert.equal((await POST(request(message))).status,429);assert.equal(writes,1);
 providerStatus=200;reply='x'.repeat(2001);assert.equal((await POST(request(message))).status,503);assert.equal(writes,1);
 reply='bounded';changeIdentity=true;assert.equal((await POST(request(message))).status,409);assert.equal(writes,1);
 identity={actor:id,workspace,scope:"bound"};changeIdentity=false;const controller=new AbortController();abort=()=>controller.abort();assert.equal((await POST(request(message,'https://example.test',controller.signal))).status,503);assert.equal(writes,1);abort=undefined;
 const before=modelCalls;assert.equal((await POST(request({...message,aiConsent:false}))).body.answerMode,'knowledge');assert.equal(modelCalls,before);
 retained=[];assert.equal((await POST(request({...message,question:'What is the price?'}))).body.answerMode,'knowledge');assert.equal(modelCalls,before);
 identity=null;assert.equal((await POST(request(message))).status,401);enabled=false;assert.equal((await POST(request(message))).status,404);assert.equal(modelCalls,before);
});
