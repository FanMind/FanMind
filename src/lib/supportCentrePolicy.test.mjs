import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
function load(file, dependencies = {}) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { if (Object.hasOwn(dependencies,name)) return dependencies[name]; throw new Error(`unexpected import ${name}`); }, Date, TextDecoder });
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
