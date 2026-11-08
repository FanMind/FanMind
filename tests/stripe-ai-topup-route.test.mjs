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


// Same registered Billing route suite: no second test runner or package changes.
const portalPolicy = await import("../src/lib/stripeCustomerPortal.mjs");
function portalFixture() {
  const f=topupFixture();
  f.env.STRIPE_BILLING_PORTAL_CONFIGURATION="bpc_Synthetic";
  const config={object:"billing_portal.configuration",id:"bpc_Synthetic",active:true,livemode:false,
    application:null,login_page:{enabled:false},features:{invoice_history:{enabled:true},
      customer_update:{enabled:false},payment_method_update:{enabled:false},
      subscription_cancel:{enabled:false},subscription_update:{enabled:false}}};
  const customer={object:"customer",id:"cus_Synthetic",livemode:false,metadata:{workspace_id:f.workspaceId}};
  const calls=[];
  const state={user:{id:"20000000-0000-4000-8000-000000000001"},
    workspace:{id:f.workspaceId,owner_user_id:"20000000-0000-4000-8000-000000000001",stripe_customer_id:customer.id},
    demo:false,adminCrm:false,limited:false,authError:false};
  const session={object:"billing_portal.session",id:"bps_Synthetic",configuration:config.id,customer:customer.id,
    return_url:"https://staging.fanmind.ch/settings/invoices",url:"https://billing.stripe.com/p/session/Synthetic"};
  const deps={findWorkspace:async()=>({status:"found",workspaceId:f.workspaceId}),stripe:{
    customers:{retrieve:async id=>{calls.push(["customer",id]);return customer;}},
    billingPortal:{configurations:{retrieve:async id=>{calls.push(["config",id]);return config;}},
      sessions:{create:async params=>{calls.push(["create",params]);return session;}}}}};
  const route=loadRoute("src/app/api/billing/portal/route.ts",{
    "@/lib/httpMutationPolicy.mjs":httpPolicy,
    "@/lib/supabase/server":{getSupabaseServerUser:async()=>{if(state.authError)throw Error("private auth detail");return {data:{user:state.user}};},
      getUserWorkspaceDashboard:async()=>({workspace:state.workspace})},
    "@/lib/demoMode":{isDemoWorkspace:()=>state.demo,isTemporaryDemoUser:()=>state.demo},
    "@/lib/adminCrmAccessPolicy.mjs":{isAdminCrmAccessWorkspace:()=>state.adminCrm},
    "@/lib/stripeCustomerPortal.mjs":{stripeCustomerPortalConfigured:()=>portalPolicy.stripeCustomerPortalConfigured(f.env),
      createWorkspaceStripePortal:input=>portalPolicy.createWorkspaceStripePortal(input,deps,f.env)},
    "@/lib/stripeClient":{getStripeClient:()=>deps.stripe},
    "@/lib/stripeBilling":{findWorkspaceIdByStripeReferences:deps.findWorkspace},
    "@/lib/sharedRateLimit":{consumeSharedRateLimit:async()=>({allowed:!state.limited})},
  },f.env);
  const request=(body={},origin="https://staging.fanmind.ch")=>new Request("https://staging.fanmind.ch/api/billing/portal",{
    method:"POST",headers:{origin,"content-type":"application/json"},body:JSON.stringify(body)});
  return {...f,config,customer,session,calls,state,deps,route,request};
}

test("actual portal route binds test Customer and explicit restricted config, never client authority",async()=>{
  const f=portalFixture();const response=await f.route.POST(f.request());
  assert.equal(response.status,200);assert.equal(response.headers.get("cache-control"),"no-store");
  assert.deepEqual(await response.json(),{url:f.session.url});
  assert.deepEqual(f.calls,[ ["customer",f.customer.id],["config",f.config.id],
    ["create",{configuration:f.config.id,customer:f.customer.id,return_url:f.session.return_url}] ]);
  const bad=portalFixture();assert.equal((await bad.route.POST(bad.request({customer:"cus_Other",return_url:"https://evil.invalid"}))).status,400);
  assert.deepEqual(bad.calls,[]);
});

test("actual portal route denies anonymous/member/demo/free-CRM, CSRF, rate, freeze and Live before provider access",async()=>{
  for(const [mutate,status] of [
    [f=>f.state.user=null,401],[f=>f.state.workspace.owner_user_id="other",403],
    [f=>f.state.demo=true,403],[f=>f.state.adminCrm=true,403],
    [f=>f.state.workspace.stripe_customer_id=null,403],[f=>f.state.limited=true,429],
    [f=>f.env.FANMIND_STRIPE_BILLING_WRITE_FREEZE="true",503],
    [f=>f.env.STRIPE_SECRET_KEY="sk_live_synthetic",503],
    [f=>f.env.NEXT_PUBLIC_APP_URL="https://fanmind.ch",503],
    [f=>f.env.FANMIND_RUNTIME_ENVIRONMENT="production",503],
    [f=>delete f.env.STRIPE_BILLING_PORTAL_CONFIGURATION,503],
    [f=>f.state.authError=true,503],
  ]) { const f=portalFixture();mutate(f);const response=await f.route.POST(f.request());
    assert.equal(response.status,status);assert.deepEqual(f.calls,[]);
    assert.doesNotMatch(await response.text(),/private auth detail/u); }
  const csrf=portalFixture();assert.equal((await csrf.route.POST(csrf.request({},"https://evil.invalid"))).status,403);assert.deepEqual(csrf.calls,[]);
  for(const [body,status] of [[{padding:"x".repeat(2000)},413],[[],400],[null,400]]) {
    const f=portalFixture();assert.equal((await f.route.POST(f.request(body))).status,status);assert.deepEqual(f.calls,[]);
  }
});

test("portal refuses ambiguous/foreign/deleted/live Customers and writable, unknown, inactive or default configs",async()=>{
  for(const mutate of [
    f=>f.deps.findWorkspace=async()=>({status:"retryable_error"}),
    f=>f.deps.findWorkspace=async()=>({status:"found",workspaceId:"foreign"}),
    f=>f.customer.id="cus_Other",f=>f.customer.deleted=true,f=>f.customer.livemode=true,
    f=>f.customer.metadata.workspace_id="foreign",
    f=>f.config.id="bpc_Other",f=>f.config.active=false,f=>f.config.livemode=true,
    f=>f.config.application="ca_Unexpected",f=>f.config.login_page.enabled=true,
    f=>f.config.features.invoice_history.enabled=false,
    ...["customer_update","payment_method_update","subscription_cancel","subscription_update"].map(name=>f=>f.config.features[name].enabled=true),
    f=>f.config.features.future_mutation={enabled:true},
    f=>delete f.config.features.payment_method_update,
    f=>f.deps.stripe.billingPortal.configurations.retrieve=async()=>{f.env.FANMIND_STRIPE_BILLING_WRITE_FREEZE="true";return f.config;},
    f=>f.deps.stripe.billingPortal.configurations.retrieve=async()=>{f.env.STRIPE_BILLING_PORTAL_CONFIGURATION="bpc_Rotated";return f.config;},
  ]) {const f=portalFixture();mutate(f);
    await assert.rejects(portalPolicy.createWorkspaceStripePortal({workspaceId:f.workspaceId,customerId:"cus_Synthetic"},f.deps,f.env));
    assert.equal(f.calls.filter(x=>x[0]==="create").length,0);}
});

test("portal refuses provider session substitution and unsafe redirects without returning the capability",async()=>{
  for(const mutate of [
    f=>f.session.customer="cus_Other",f=>f.session.configuration="bpc_Other",
    f=>f.session.return_url="https://evil.invalid",f=>f.session.object="unexpected",
    f=>f.session.url="https://billing.stripe.com.evil.invalid/session",
    f=>f.session.url="https://user:password@billing.stripe.com/session",
    f=>f.session.url="http://billing.stripe.com/session",
    f=>f.session.url="not a URL",
    f=>f.deps.stripe.billingPortal.sessions.create=async()=>{throw Error("private provider detail");},
  ]) {const f=portalFixture();mutate(f);const response=await f.route.POST(f.request());
    assert.equal(response.status,503);const body=await response.text();assert.doesNotMatch(body,/private provider detail|session\/Synthetic|cus_Other/u);}
});


test("portal reuses authoritative legacy Customer mapping without inventing or backfilling metadata",async()=>{
  const f=portalFixture();delete f.customer.metadata.workspace_id;
  const response=await f.route.POST(f.request());assert.equal(response.status,200);
  assert.equal(f.calls.filter(x=>x[0]==="create").length,1);
  f.deps.findWorkspace=async()=>({status:"not_found"});
  await assert.rejects(portalPolicy.createWorkspaceStripePortal({workspaceId:f.workspaceId,customerId:f.customer.id},f.deps,f.env));
  assert.equal(f.calls.filter(x=>x[0]==="create").length,1);
});
