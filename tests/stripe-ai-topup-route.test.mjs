import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as httpPolicy from "../src/lib/httpMutationPolicy.mjs";
import { verifyStripeWebhookSignature } from "../src/lib/stripeWebhookSignaturePolicy.mjs";
import { handleStripeTopupEvent } from "../src/lib/stripeAiTopupLifecycle.mjs";
import { topupFixture } from "./fixtures/stripe-topup.mjs";

function loadRoute(path, modules, env) {
  const code = ts.transpileModule(readFileSync(path,"utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    if (name === "next/server") return { NextResponse: { json: (body, init) => Response.json(body, init) } };
    if (!Object.hasOwn(modules,name)) throw new Error(`unmocked route dependency ${name}`);
    return modules[name];
  }, process: {env}, console, Date, URL, Number, JSON, Error }, {filename:path});
  return exports;
}

function checkoutRoute() {
  const f=topupFixture();
  const state={user:{id:"20000000-0000-4000-8000-000000000001"},workspace:{id:f.workspaceId,owner_user_id:"20000000-0000-4000-8000-000000000001"},terms:true,limited:false,ready:true,frozen:false,starts:[]};
  const route=loadRoute("src/app/api/billing/topup/route.ts",{
    "@/lib/httpMutationPolicy.mjs":httpPolicy,
    "@/lib/supabase/server":{getSupabaseServerUser:async()=>({data:{user:state.user}}),getUserWorkspaceDashboard:async()=>({workspace:state.workspace})},
    "@/lib/demoMode":{isDemoWorkspace:()=>false,isTemporaryDemoUser:()=>false},
    "@/lib/adminCrmAccessPolicy.mjs":{isAdminCrmAccessWorkspace:()=>false},
    "@/lib/paymentTermsServerEvidence":{hasCurrentWorkspacePaymentTermsEvidence:async()=>state.terms},
    "@/lib/stripeBillingWriteFreeze.mjs":{isStripeBillingWriteFrozen:()=>state.frozen},
    "@/lib/stripeAiTopupLifecycle.mjs":{stripeTopupSandboxReady:()=>state.ready,stripeTopupContract:key=>key==="topup_10"},
    "@/lib/stripeAiTopup":{startWorkspaceTopup:async input=>{state.starts.push(input);return {id:"cs_test_Synthetic",url:"https://checkout.stripe.com/c/pay/Synthetic"};}},
    "@/lib/sharedRateLimit":{consumeSharedRateLimit:async()=>({allowed:!state.limited})},
  },f.env);
  const request=(payload={topupKey:"topup_10",requestId:f.input.requestId},origin="https://staging.fanmind.ch")=>new Request("https://staging.fanmind.ch/api/billing/topup",{method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(payload)});
  return {route,state,request,f};
}

test("actual checkout route uses authenticated owner Workspace; client price, amount, workspace and credit are not authority",async()=>{
  const f=checkoutRoute();
  const response=await f.route.POST(f.request({topupKey:"topup_10",requestId:f.f.input.requestId,workspaceId:"attacker",amount:1,priceId:"price_Attacker",credit:999999}));
  assert.equal(response.status,200);
  assert.equal(f.state.starts[0].workspace.id,f.f.workspaceId);
  assert.equal(f.state.starts[0].priceId,undefined);
  assert.equal(response.headers.get("cache-control"),"no-store");
});

test("actual checkout route rejects CSRF, anonymous, member, missing terms, frozen, closed and excessive requests without provider create",async()=>{
  for(const [mutate,status] of [
    [f=>f.state.user=null,401], [f=>f.state.workspace.owner_user_id="other",403],
    [f=>f.state.terms=false,409],[f=>f.state.frozen=true,503],
    [f=>f.state.ready=false,503],[f=>f.state.limited=true,429],
  ]){
    const f=checkoutRoute();mutate(f);const response=await f.route.POST(f.request());
    assert.equal(response.status,status);assert.equal(f.state.starts.length,0);
  }
  for(const [request,status] of [
    [f=>f.request(undefined,"https://evil.invalid"),403],
    [f=>f.request({topupKey:"topup_10",requestId:"bad"}),400],
    [f=>f.request({topupKey:"constructor",requestId:f.f.input.requestId}),400],
    [f=>f.request({padding:"x".repeat(2000)}),413],
  ]){const f=checkoutRoute();assert.equal((await f.route.POST(request(f))).status,status);assert.equal(f.state.starts.length,0);}
});

test("actual webhook verifies signature first and isolates topup fulfillment from all base/referral writes",async()=>{
  const f=topupFixture(); const secret="synthetic-signing-secret";let projections=0;
  const modules={
    "@/lib/stripeBillingWriteFreeze.mjs":{isStripeBillingWriteFrozen:()=>false},
    "@/lib/aiTierStripeEntitlementSync.mjs":{},"@/lib/aiTierStripeLifecycle.mjs":{},"@/lib/referralAutomation":{},
    "@/lib/stripeBillingEventLedger.mjs":{isStripeBillingEventLedgerCaptureEnabled:()=>false},
    "@/lib/stripeBillingEventSync.mjs":{syncStripeBillingEvent:()=>{projections++;}},
    "@/lib/referralLifecyclePolicy.mjs":{referralBillingStatusFromStripeEvent:()=>{projections++;}},
    "@/lib/stripeBilling":{verifyStripeSignature:(rawBody,signatureHeader)=>verifyStripeWebhookSignature({rawBody,signatureHeader,configuredSecret:secret}),
      updateWorkspaceBillingDefensively:()=>{projections++;}},
    "@/lib/stripeWorkspacePolicy.mjs":{},"@/lib/stripeWebhookEventPolicy.mjs":{isHandledStripeWebhookEventType:()=>true},
    "@/lib/stripeAiTopup":{processStripeTopupEvent:event=>handleStripeTopupEvent(event,f.deps,f.env)},
  };
  const route=loadRoute("src/app/api/stripe/webhook/route.ts",modules,f.env);
  const rawBody=JSON.stringify(f.event);const stamp=Math.floor(Date.now()/1000);
  const signature=`t=${stamp},v1=${createHmac("sha256",secret).update(`${stamp}.${rawBody}`).digest("hex")}`;
  const request=sig=>new Request("https://staging.fanmind.ch/api/stripe/webhook",{method:"POST",headers:{"stripe-signature":sig},body:rawBody});
  assert.equal((await route.POST(request("invalid"))).status,400);assert.equal(f.calls.grants.length,0);
  assert.equal((await route.POST(request(signature))).status,200);assert.equal(f.calls.grants.length,1);
  assert.equal(projections,0);
  f.deps.grant=async()=>{throw new Error("synthetic DB outage");};
  const retry=await route.POST(request(signature));assert.equal(retry.status,503);assert.equal(projections,0);
  assert.equal(retry.headers.get("cache-control"),"no-store");
});

test("actual service preserves the write freeze even while the base event ledger captures events",async()=>{
  const f=topupFixture();let frozen=true;
  const service=loadRoute("src/lib/stripeAiTopup.ts",{
    "server-only":{},
    "@/lib/stripeClient":{getStripeClient:()=>f.deps.stripe},
    "@/lib/stripeBilling":{findWorkspaceIdByStripeReferences:f.deps.findWorkspace},
    "@/lib/aiCapacityAdmin":{},"@/lib/aiCapacityPolicy.mjs":{},
    "@/lib/aiCapacityLedger":{grantAiCapacityCredit:f.deps.grant,reversePurchasedAiCapacity:f.deps.reverse},
    "@/lib/stripeAiTopupLifecycle.mjs":{handleStripeTopupEvent:(event,deps)=>handleStripeTopupEvent(event,deps,f.env)},
    "@/lib/supabase/config":{},
    "@/lib/stripeBillingWriteFreeze.mjs":{isStripeBillingWriteFrozen:()=>frozen},
  },f.env);
  await assert.rejects(service.processStripeTopupEvent(f.event),/stripe_topup_frozen/u);
  assert.equal(f.calls.grants.length,0);
  frozen=false;
  assert.equal(await service.processStripeTopupEvent(f.event),true);
  assert.equal(f.calls.grants.length,1);
});
