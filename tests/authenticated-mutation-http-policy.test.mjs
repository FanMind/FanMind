import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import {
  isTrustedFanMindMutationRequest,
  readBoundedFormDataRequest,
  readBoundedJsonRequest,
} from "../src/lib/httpMutationPolicy.mjs";
import {
  CURRENT_PAYMENT_TERMS_VERSION,
  PAYMENT_TERMS_ACTIVATION_ENABLED,
  PAYMENT_TERMS_ACTIVATION_BLOCK_CODE,
  evaluateCurrentPaymentTermsUserEvidence,
  isPaymentTermsActivationEnabled,
} from "../src/lib/paymentTermsActivationPolicy.mjs";

const supportOwnerId="10000000-0000-4000-8000-000000000001";
const supportNotificationId="10000000-0000-4000-8000-000000000002";
async function ownerOverviewFixture({ackResult=true,reopened=false,legacyOrigin=false}={}) {
  const state={owner:true,authenticated:true,enabled:true,allowed:true,acknowledged:false,calls:[],failure:false,readbackFailure:false};
  const load=(source,bindings)=>{const exports={};runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,TextDecoder,Date,require:name=>{assert.ok(Object.hasOwn(bindings,name),name);return bindings[name];}});return exports;};
  const notification={id:supportNotificationId,workspace_id:null,reference_id:supportNotificationId,code:"security_boundary",created_at:"2026-11-13T00:00:00Z",acknowledged_at:null,occurrences:1};
  let source=await readFile("src/app/api/admin/support/overview/route.ts","utf8");
  if(legacyOrigin)source=source.replace('if(!isTrustedFanMindMutationRequest(request))return fail(403);','if(request.headers.get("origin")!==request.nextUrl.origin)return fail(403);');
  const route=load(source,{
    "next/server":{NextResponse:{json:(body,options)=>Response.json(body,options)}},
    "@/lib/httpMutationPolicy.mjs":{isTrustedFanMindMutationRequest:r=>isTrustedFanMindMutationRequest(r,{NEXT_PUBLIC_APP_URL:"https://fanmind.ch"})},
    "@/lib/supportCentreRequest":load(await readFile("src/lib/supportCentreRequest.ts","utf8"),{}),
    "@/lib/supportCentrePolicy":load(await readFile("src/lib/supportCentrePolicy.ts","utf8"),{}),
    "@/lib/supportContinuityServer":{safeSupportTurns:v=>v},
    "@/lib/sharedRateLimit":{consumeSharedRateLimit:async()=>({allowed:state.allowed})},
    "@/lib/supportCentreServer":{
      supportCentreEnabled:()=>state.enabled,
      supportCentreActor:async()=>state.authenticated?{user:{id:supportOwnerId},owner:state.owner}:null,
      listOwnerSupportNotifications:async()=>{if(state.readbackFailure)throw Error("private readback diagnostic");return state.acknowledged&&!reopened?[]:[notification];},
      supportCentreDatabase:async(path,body)=>{
        state.calls.push(path);assert.equal(body.p_actor,supportOwnerId);
        if(state.failure)throw Error("private database diagnostic");
        if(path==="rpc/support_retention_health")return {healthy:true};
        if(path==="rpc/support_centre_recover")return 0;
        assert.equal(path,"rpc/support_centre_ack");assert.equal(body.p_notification,supportNotificationId);
        if(ackResult===true)state.acknowledged=true;
        return ackResult;
      },
    },
  });
  const request=(body={action:"ack",id:supportNotificationId},origin="https://fanmind.ch",site="same-origin")=>{
    const r=new Request("http://127.0.0.1:3000/api/admin/support/overview",{method:"POST",headers:{"content-type":"application/json",...(origin?{origin}:{}),"sec-fetch-site":site},body:JSON.stringify(body)});r.nextUrl=new URL(r.url);return r;
  };
  const read=()=>{const r=new Request("http://127.0.0.1:3000/api/admin/support/overview");r.nextUrl=new URL(r.url);return route.GET(r);};
  return {route,state,request,read};
}

test("Owner alarm acknowledgment persists across fresh reads behind the configured HTTPS proxy",async()=>{
  const f=await ownerOverviewFixture();assert.equal((await (await f.read()).json()).items.length,1);
  for(let attempt=0;attempt<2;attempt++){
    const response=await f.route.POST(f.request());assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});assert.equal(response.headers.get("cache-control"),"no-store");
    assert.deepEqual((await (await f.read()).json()).items,[]);
  }
});

test("the old Production origin comparison blocks the same Owner acknowledgment before any database mutation",async()=>{
  const f=await ownerOverviewFixture({legacyOrigin:true});assert.equal((await f.route.POST(f.request())).status,403);assert.deepEqual(f.state.calls,[]);
});

test("Owner acknowledgment never reports success for an unconfirmed RPC or a reopened notification",async()=>{
  for(const ackResult of [false,null,{},[],0,"true"]){const f=await ownerOverviewFixture({ackResult});assert.equal((await f.route.POST(f.request())).status,409);assert.equal((await (await f.read()).json()).items.length,1);}
  const reopened=await ownerOverviewFixture({reopened:true});assert.equal((await reopened.route.POST(reopened.request())).status,409);
  const failed=await ownerOverviewFixture();failed.state.failure=true;const result=await failed.route.POST(failed.request());assert.equal(result.status,503);assert.doesNotMatch(await result.text(),/private database/);
  const ambiguous=await ownerOverviewFixture();ambiguous.state.readbackFailure=true;
  const unconfirmed=await ambiguous.route.POST(ambiguous.request());assert.equal(unconfirmed.status,503);assert.doesNotMatch(await unconfirmed.text(),/private readback/);
  assert.equal(ambiguous.state.acknowledged,true);ambiguous.state.readbackFailure=false;
  assert.equal((await ambiguous.route.POST(ambiguous.request())).status,200);assert.deepEqual((await (await ambiguous.read()).json()).items,[]);
});

test("Owner acknowledgment retains origin, authority, rate, feature and exact-body boundaries",async()=>{
  for(const [origin,site] of [[null,"same-origin"],["https://foreign.invalid","same-origin"],["https://fanmind.ch","cross-site"]]){const f=await ownerOverviewFixture();assert.equal((await f.route.POST(f.request(undefined,origin,site))).status,403);assert.deepEqual(f.state.calls,[]);}
  for(const [key,status] of [["owner",403],["authenticated",403],["enabled",404],["allowed",429]]){const f=await ownerOverviewFixture();f.state[key]=false;assert.equal((await f.route.POST(f.request())).status,status);assert.deepEqual(f.state.calls,[]);}
  for(const body of [{action:"ack",id:"invalid"},{action:"ack",id:supportNotificationId,p_actor:supportOwnerId},{action:"ack",id:supportNotificationId,workspace_id:supportOwnerId}]){const f=await ownerOverviewFixture();assert.equal((await f.route.POST(f.request(body))).status,400);assert.deepEqual(f.state.calls,[]);}
  const recovery=await ownerOverviewFixture();const response=await recovery.route.POST(recovery.request({action:"recover"}));assert.equal(response.status,200);assert.deepEqual(await response.json(),{repaired:0});assert.deepEqual(recovery.state.calls,["rpc/support_centre_recover"]);
});

function mutationRequest({
  url = "https://fanmind.ch/api/test",
  origin = "https://fanmind.ch",
  fetchSite = "same-origin",
  body = "{}",
  contentType = "application/json",
} = {}) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": contentType,
      origin,
      "sec-fetch-site": fetchSite,
    },
    body,
  });
}

test("FanMind cookie mutations accept only configured same-site browser origins", () => {
  const environment = {
    NEXT_PUBLIC_APP_URL: "https://app.fanmind.ch",
    NEXT_PUBLIC_SITE_URL: "https://fanmind.ch",
  };

  assert.equal(isTrustedFanMindMutationRequest(mutationRequest(), environment), true);
  assert.equal(
    isTrustedFanMindMutationRequest(
      mutationRequest({ origin: "https://app.fanmind.ch" }),
      environment,
    ),
    true,
  );
  assert.equal(
    isTrustedFanMindMutationRequest(
      mutationRequest({ origin: "https://evil.invalid" }),
      environment,
    ),
    false,
  );
  assert.equal(
    isTrustedFanMindMutationRequest(
      mutationRequest({ fetchSite: "cross-site" }),
      environment,
    ),
    false,
  );
  const missingOrigin = mutationRequest();
  missingOrigin.headers.delete("origin");
  assert.equal(isTrustedFanMindMutationRequest(missingOrigin, environment), false);
});

test("chunked bodies are cancelled as soon as the streamed byte limit is exceeded", async () => {
  let cancelled = false;
  const chunks = [
    new TextEncoder().encode('{"value":"1234'),
    new TextEncoder().encode('567890"}'),
    new TextEncoder().encode("never-read"),
  ];
  const stream = new ReadableStream({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });

  const result = await readBoundedJsonRequest(
    {
      headers: new Headers({ "content-type": "application/json" }),
      body: stream,
      text: async () => {
        throw new Error("stream fallback must not run");
      },
    },
    16,
  );

  assert.deepEqual(result, { ok: false, reason: "payload_too_large", value: null });
  assert.equal(cancelled, true);
  assert.equal(chunks.length, 1, "the final chunk must not be consumed");
});

test("bounded form parsing accepts urlencoded data and rejects wrong content types", async () => {
  const accepted = await readBoundedFormDataRequest(
    mutationRequest({
      body: "status=contacted",
      contentType: "Application/X-Www-Form-Urlencoded; Charset=UTF-8",
    }),
    128,
  );
  assert.equal(accepted.ok, true);
  assert.equal(accepted.ok ? accepted.value.get("status") : null, "contacted");

  const rejected = await readBoundedFormDataRequest(mutationRequest(), 128);
  assert.deepEqual(rejected, { ok: false, reason: "invalid_form_data", value: null });

  const misleadingPrefix = await readBoundedFormDataRequest(
    mutationRequest({
      body: "status=contacted",
      contentType: "application/x-www-form-urlencoded-dangerous",
    }),
    128,
  );
  assert.deepEqual(misleadingPrefix, {
    ok: false,
    reason: "invalid_form_data",
    value: null,
  });
});

test("cookie-authenticated mutation routes enforce the shared origin boundary", async () => {
  const paths = [
    "src/app/api/auth/session/route.ts",
    "src/app/api/auth/logout/route.ts",
    "src/app/api/demo/start/route.ts",
    "src/app/api/inquiries/route.ts",
    "src/app/api/referrals/attribution/route.ts",
    "src/app/api/register/daily-test-window/route.ts",
    "src/app/api/register/workspace/route.ts",
    "src/app/api/admin/notifications/[id]/read/route.ts",
    "src/app/api/admin/operations/backup-jobs/route.ts",
    "src/app/api/admin/settings/daily-test-plan/route.ts",
    "src/app/api/admin/inquiries/[inquiryId]/status/route.ts",
    "src/app/api/admin/assets/upload/route.ts",
    "src/app/api/admin/billing/users/[userId]/confirm-email/route.ts",
    "src/app/api/admin/billing/workspaces/[workspaceId]/internal-test/route.ts",
    "src/app/api/admin/billing/workspaces/[workspaceId]/internal-daily-test/route.ts",
    "src/app/api/admin/billing/workspaces/[workspaceId]/internal-daily-test/cancel/route.ts",
    "src/app/api/admin/billing/workspaces/[workspaceId]/mark-paid/route.ts",
    "src/app/api/admin/billing/workspaces/[workspaceId]/note/route.ts",
    "src/app/api/admin/billing/workspaces/[workspaceId]/suspend/route.ts",
    "src/app/api/admin/billing/workspaces/[workspaceId]/unsuspend/route.ts",
    "src/app/api/integrations/facebook/disconnect/route.ts",
    "src/app/api/webhooks/meta/self-test/route.ts",
  ];

  for (const path of paths) {
    const source = await readFile(path, "utf8");
    assert.match(source, /isTrustedFanMindMutationRequest/u, path);
  }
});

test("productive JSON and form routes parse only through bounded readers", async () => {
  const jsonPaths = [
    "src/app/api/auth/session/route.ts",
    "src/app/api/demo/start/route.ts",
    "src/app/api/demo/cleanup/route.ts",
    "src/app/api/inquiries/route.ts",
    "src/app/api/referrals/attribution/route.ts",
    "src/app/api/register/daily-test-window/route.ts",
    "src/app/api/register/workspace/route.ts",
    "src/app/api/admin/notifications/[id]/read/route.ts",
    "src/app/api/admin/operations/backup-jobs/route.ts",
    "src/app/api/ai/prompt-settings/route.ts",
    "src/app/api/ai/reply-suggestions/route.ts",
    "src/app/api/ai/fan-analysis/route.ts",
    "src/app/api/account-deletion/route.ts",
  ];
  const formPaths = [
    "src/app/api/admin/assets/upload/route.ts",
    "src/app/api/admin/settings/daily-test-plan/route.ts",
    "src/app/api/admin/inquiries/[inquiryId]/status/route.ts",
    "src/app/api/admin/billing/workspaces/[workspaceId]/mark-paid/route.ts",
    "src/app/api/admin/billing/workspaces/[workspaceId]/note/route.ts",
  ];

  for (const path of jsonPaths) {
    const source = await readFile(path, "utf8");
    assert.match(source, /readBoundedJsonRequest/u, path);
    assert.doesNotMatch(source, /request\.json\(\)/u, path);
  }
  for (const path of formPaths) {
    const source = await readFile(path, "utf8");
    assert.match(source, /readBoundedFormDataRequest/u, path);
    assert.doesNotMatch(source, /request\.formData\(\)/u, path);
  }
});

test("selected browser and admin boundaries never forward provider error text", async () => {
  const paths = [
    "src/app/api/ai/prompt-settings/route.ts",
    "src/app/api/referrals/attribution/route.ts",
    "src/app/api/referrals/reconcile/route.ts",
    "src/app/api/admin/notifications/route.ts",
    "src/app/api/admin/notifications/[id]/read/route.ts",
    "src/app/api/admin/inquiries/[inquiryId]/status/route.ts",
    "src/app/settings/actions.ts",
    "src/app/fans/actions.ts",
    "src/app/fans/[id]/analysisActions.ts",
    "src/lib/adminBilling.ts",
    "src/lib/adminAiUsage.ts",
    "src/lib/adminReferrals.ts",
    "src/lib/workspaceAiUsage.ts",
    "src/lib/inquiries.ts",
  ];
  const sources = await Promise.all(paths.map((path) => readFile(path, "utf8")));
  const combined = sources.join("\n");

  assert.doesNotMatch(combined, /\{\s*error:\s*result\.error\s*\}/u);
  assert.doesNotMatch(combined, /json\.error\?\.message/u);
  assert.doesNotMatch(combined, /encodeURIComponent\(result\.error\.message\)/u);
  assert.doesNotMatch(combined, /new Error\(await response\.text\(\)\)/u);
  assert.doesNotMatch(
    combined,
    /error instanceof Error \? error\.message : "Unbekannter Fehler"/u,
  );
});

test("owner-enabled terms retain consent checks and server-owned checkout evidence", async () => {
  assert.equal(CURRENT_PAYMENT_TERMS_VERSION, "2026-06-v1");
  assert.equal(PAYMENT_TERMS_ACTIVATION_ENABLED, true);
  assert.equal(isPaymentTermsActivationEnabled(), true);
  assert.equal(PAYMENT_TERMS_ACTIVATION_BLOCK_CODE, "payment_terms_version_unresolved");

  const validMetadataShape = {
    payment_terms_accepted: true,
    payment_terms_version: CURRENT_PAYMENT_TERMS_VERSION,
    payment_terms_accepted_at: "2026-08-09T12:00:00.000Z",
  };
  assert.deepEqual(
    evaluateCurrentPaymentTermsUserEvidence(validMetadataShape, {
      now: Date.parse("2026-08-09T12:01:00.000Z"),
    }).blockers,
    [],
  );
  assert.deepEqual(
    evaluateCurrentPaymentTermsUserEvidence(validMetadataShape, {
      now: Date.parse("2026-08-09T12:01:00.000Z"),
      activationEnabled: false,
    }).blockers,
    ["version_unresolved"],
  );
  assert.deepEqual(
    evaluateCurrentPaymentTermsUserEvidence(
      {
        ...validMetadataShape,
        payment_terms_accepted_at: "2026-05-31T23:59:59.999Z",
      },
      {
        now: Date.parse("2026-08-09T12:01:00.000Z"),
        activationEnabled: true,
      },
    ).blockers,
    ["accepted_at_before_window"],
  );

  const [
    registerPage,
    registerClient,
    registrationRoute,
    workspaceSetup,
    checkoutApi,
    checkoutDirect,
    billingStart,
    serverEvidence,
    provisioning,
  ] = await Promise.all([
    readFile("src/app/register/page.tsx", "utf8"),
    readFile("src/app/register/RegisterClient.tsx", "utf8"),
    readFile("src/app/api/register/workspace/route.ts", "utf8"),
    readFile("src/app/workspace/setup/page.tsx", "utf8"),
    readFile("src/app/api/billing/checkout/route.ts", "utf8"),
    readFile("src/app/billing/checkout/route.ts", "utf8"),
    readFile("src/app/billing/start/page.tsx", "utf8"),
    readFile("src/lib/paymentTermsServerEvidence.ts", "utf8"),
    readFile("src/lib/workspaceProvisioning.ts", "utf8"),
  ]);

  assert.match(registerPage, /paidActivationAvailable = isPaymentTermsActivationEnabled\(\)/u);
  assert.match(registerClient, /buildRegistrationAccountMetadata/u);
  assert.doesNotMatch(registerClient, /payment_terms_accepted|fetch\("\/api\/register\/workspace"/u);
  assert.match(workspaceSetup, /if \(!isPaymentTermsActivationEnabled\(\)\)/u);
  assert.match(registrationRoute, /parseTrustedProvisioningSelection/u);
  assert.match(registrationRoute, /buildTrustedProvisioningUser/u);
  assert.doesNotMatch(registrationRoute, /ensureUserWorkspace\(data\.user\)/u);
  assert.doesNotMatch(workspaceSetup, /ensureUserWorkspace\(data\.user\)/u);
  assert.match(workspaceSetup, /paymentTermsAccepted/u);

  for (const checkoutSource of [checkoutApi, checkoutDirect, billingStart]) {
    assert.match(checkoutSource, /hasCurrentWorkspacePaymentTermsEvidence/u);
    assert.doesNotMatch(checkoutSource, /hasCurrentPaymentTermsUserEvidence/u);
  }
  assert.match(serverEvidence, /SUPABASE_SERVICE_ROLE_KEY/u);
  assert.match(serverEvidence, /payment_terms_accepted_by_user_id/u);
  assert.match(serverEvidence, /owner_user_id/u);
  assert.match(serverEvidence, /CURRENT_PAYMENT_TERMS_VERSION/u);
  assert.match(serverEvidence, /PAYMENT_TERMS_ACCEPTED_NOT_BEFORE_MS/u);
  assert.match(
    serverEvidence,
    /acceptedAt < PAYMENT_TERMS_ACCEPTED_NOT_BEFORE_MS[\s\S]*accepted_at_before_window/u,
  );
  assert.doesNotMatch(serverEvidence, /user_metadata/u);

  assert.match(provisioning, /WORKSPACE_DIRECT_INSERT_COMPATIBILITY_ENABLED = false/u);
  assert.match(
    provisioning,
    /isMissingWorkspaceProvisioningRpc[\s\S]*!WORKSPACE_DIRECT_INSERT_COMPATIBILITY_ENABLED\) return false/u,
  );
});

test("staging host provisioning validates a repeatable runner prerequisite before host mutation", async () => {
  const workflow = await readFile(
    ".github/workflows/provision-staging-host.yml",
    "utf8",
  );
  const prerequisite = workflow.indexOf(
    "Fresh staging runner registration token is required before any host mutation.",
  );
  const firstMutation = workflow.indexOf(
    "Provision isolated operating-system boundary",
  );
  assert.ok(prerequisite >= 0 && firstMutation > prerequisite);
  assert.match(
    workflow,
    /if ! sudo test -f "\$RUNNER_DIR\/\.runner" && \[ -z "\$STAGING_RUNNER_REGISTRATION_TOKEN" \]/u,
  );
  assert.match(
    workflow,
    /if ! sudo test -f "\$RUNNER_DIR\/\.runner"; then/u,
  );
  assert.match(workflow, /STAGING_RUNNER_PREREQUISITE=ready/u);
  assert.match(workflow, /FANMIND_STAGING_STRIPE_PRICE_INTERNAL_DAILY_TEST/u);
  assert.match(workflow, /STRIPE_PRICE_INTERNAL_DAILY_TEST/u);
});
