import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  isStripeBillingWriteFrozen,
  STRIPE_BILLING_WRITE_FREEZE_CODE,
} from "../src/lib/stripeBillingWriteFreeze.mjs";

test("billing write freeze is explicit and fail-closed only on exact true", () => {
  assert.equal(isStripeBillingWriteFrozen({}), false);
  assert.equal(
    isStripeBillingWriteFrozen({ FANMIND_STRIPE_BILLING_WRITE_FREEZE: "false" }),
    false,
  );
  assert.equal(
    isStripeBillingWriteFrozen({ FANMIND_STRIPE_BILLING_WRITE_FREEZE: "TRUE" }),
    false,
  );
  assert.equal(
    isStripeBillingWriteFrozen({ FANMIND_STRIPE_BILLING_WRITE_FREEZE: "true" }),
    true,
  );
  assert.equal(
    STRIPE_BILLING_WRITE_FREEZE_CODE,
    "stripe_billing_write_frozen",
  );
});

test("controlled freeze blocks Checkout and makes legacy webhook projection retryable", () => {
  const checkoutSource = fs.readFileSync(
    "src/app/api/billing/checkout/route.ts",
    "utf8",
  );
  const stripeBillingSource = fs.readFileSync(
    "src/lib/stripeBilling.ts",
    "utf8",
  );
  const webhookSource = fs.readFileSync(
    "src/app/api/stripe/webhook/route.ts",
    "utf8",
  );

  assert.match(
    checkoutSource,
    /isStripeBillingWriteFrozen\(\)[\s\S]*STRIPE_BILLING_WRITE_FREEZE_CODE[\s\S]*status: 503[\s\S]*"Retry-After": "60"/u,
  );
  assert.match(
    stripeBillingSource,
    /updateWorkspaceBillingDefensively[\s\S]*isStripeBillingWriteFrozen\(\)[\s\S]*STRIPE_BILLING_RETRYABLE_ERROR/u,
  );
  assert.match(
    webhookSource,
    /billingUpdateDecision === STRIPE_BILLING_RETRYABLE_ERROR[\s\S]*throw new StripeWebhookRetryableError\(\)/u,
  );
});

test("isolated Staging deploy carries only an explicit true or false billing freeze state", () => {
  const workflow = fs.readFileSync(
    ".github/workflows/deploy-staging.yml",
    "utf8",
  );

  assert.match(workflow, /billing_write_freeze:/u);
  assert.match(workflow, /default: 'preserve'/u);
  assert.match(workflow, /BILLING_WRITE_FREEZE: \$\{\{ inputs\.billing_write_freeze \}\}/u);
  assert.match(
    workflow,
    /BILLING_WRITE_FREEZE" != "true"[\s\S]*BILLING_WRITE_FREEZE" != "false"/u,
  );
  assert.match(
    workflow,
    /FANMIND_STRIPE_BILLING_WRITE_FREEZE=%s[\s\S]*"\$EXPECTED_RELEASE_COMMIT" "\$BILLING_WRITE_FREEZE"/u,
  );
  assert.match(workflow, /STAGING_BILLING_WRITE_FREEZE=\$BILLING_WRITE_FREEZE/u);
  assert.doesNotMatch(workflow, /FANMIND_STRIPE_BILLING_EVENT_LEDGER_ENABLED:\s*true/u);
});

// Execute the real shared module; an API-only guard must fail this regression.
const ts = await import("typescript");
const { runInNewContext } = await import("node:vm");
const freezePolicy = await import("../src/lib/stripeBillingWriteFreeze.mjs");
const taxPolicy = await import("../src/lib/stripeTaxPolicy.mjs");
const workspacePolicy = await import("../src/lib/stripeWorkspacePolicy.mjs");
const compiledBilling = ts.default.transpileModule(
  fs.readFileSync("src/lib/stripeBilling.ts", "utf8"),
  { compilerOptions: { module: ts.default.ModuleKind.CommonJS, target: ts.default.ScriptTarget.ES2022 } },
).outputText;

function billingHarness(frozen) {
  const environment = {
    FANMIND_STRIPE_BILLING_WRITE_FREEZE: frozen,
    STRIPE_SECRET_KEY: "synthetic-not-a-key",
    STRIPE_WEBHOOK_SECRET: "synthetic-not-a-secret",
    STRIPE_PRICE_STARTER_SETUP: "price_synthetic_setup",
    STRIPE_PRICE_STARTER_MONTHLY: "price_synthetic_monthly",
    STRIPE_PRICE_INTERNAL_DAILY_TEST: "price_synthetic_daily",
    NEXT_PUBLIC_APP_URL: "https://billing.invalid",
    FANMIND_TAX_MODE: "stripe_tax",
    FANMIND_STRIPE_TAX_REGISTRATION_CONFIRMED: "true",
  };
  const calls = [];
  let clientReads = 0;
  const exports = {};
  const unused = new Proxy({}, { get() { throw new Error("Unexpected dependency access"); } });
  const dependencies = {
    "@/lib/stripeClient": {
      getStripeClient() {
        clientReads += 1;
        return { checkout: { sessions: { async create(params) {
          calls.push(params);
          return { id: "cs_test_synthetic", url: "https://checkout.invalid/synthetic" };
        } } } };
      },
      createStripeIntegrationIdentifier: () => "synthetic-abcdefgh",
    },
    "@/lib/stripeBillingWriteFreeze.mjs": {
      ...freezePolicy,
      isStripeBillingWriteFrozen: () => freezePolicy.isStripeBillingWriteFrozen(environment),
    },
    "@/lib/stripeTaxPolicy.mjs": {
      evaluateStripeTaxConfiguration: () => taxPolicy.evaluateStripeTaxConfiguration(environment),
    },
    "@/lib/stripeWorkspacePolicy.mjs": workspacePolicy,
    "@/lib/supabase/config": unused,
    "@/lib/workspaceProvisioning": unused,
    "@/lib/stripeWebhookSignaturePolicy.mjs": unused,
  };
  runInNewContext(compiledBilling, {
    exports,
    process: { env: environment },
    console: { warn() {} },
    fetch() { throw new Error("Unexpected network request"); },
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  return { billing: exports, environment, calls, clientReads: () => clientReads };
}

for (const [planId, option] of [
  ["starter", "starter_paid_setup"],
  ["starter", "starter_no_setup_commitment"],
  ["pilot", "internal_daily_test"],
]) {
  test(`shared Checkout blocks ${option} before provider access and recovers after unfreeze`, async () => {
    const harness = billingHarness("true");
    const input = {
      plan: harness.billing.resolveCheckoutPlan(planId, option),
      userId: "synthetic-user", workspaceId: "synthetic-workspace",
    };
    const blocked = await harness.billing.createStripeCheckoutSession(input);
    assert.equal(blocked.code, freezePolicy.STRIPE_BILLING_WRITE_FREEZE_CODE);
    assert.equal(blocked.error, freezePolicy.STRIPE_BILLING_WRITE_FREEZE_MESSAGE);
    assert.equal(blocked.url, undefined);
    assert.equal(blocked.id, undefined);
    assert.equal(harness.clientReads(), 0);
    assert.equal(harness.calls.length, 0);

    harness.environment.FANMIND_STRIPE_BILLING_WRITE_FREEZE = "false";
    const allowed = await harness.billing.createStripeCheckoutSession(input);
    assert.equal(allowed.url, "https://checkout.invalid/synthetic");
    assert.equal(harness.calls.length, 1);
    assert.equal(harness.calls[0].metadata.commercial_option, option);
  });
}

test("legacy billing projection remains retryable without database access while frozen", async () => {
  const harness = billingHarness("true");
  assert.equal(
    await harness.billing.updateWorkspaceBillingDefensively("synthetic-workspace", { billing_status: "active" }),
    workspacePolicy.STRIPE_BILLING_RETRYABLE_ERROR,
  );
  assert.equal(harness.calls.length, 0);
});

const { resolveStagingBillingFreeze, verifyStagingBillingFreeze } = await import(
  "../scripts/operations/staging-billing-freeze-control.mjs"
);

test("normal Staging deployment preserves an existing freeze and rejects ambiguous state", () => {
  assert.equal(resolveStagingBillingFreeze("preserve", ""), "false");
  assert.equal(resolveStagingBillingFreeze("preserve", "FANMIND_STRIPE_BILLING_WRITE_FREEZE=true\n"), "true");
  assert.equal(resolveStagingBillingFreeze("false", "FANMIND_STRIPE_BILLING_WRITE_FREEZE=true\n"), "false");
  for (const value of ["TRUE", "true=ignored", "", "true\nFANMIND_STRIPE_BILLING_WRITE_FREEZE=false"]) {
    assert.throws(() => resolveStagingBillingFreeze("preserve", `FANMIND_STRIPE_BILLING_WRITE_FREEZE=${value}`));
  }
  assert.throws(() => resolveStagingBillingFreeze("invalid", ""));
});

function freezeRuntimeHarness({ environment = "staging", release = "a".repeat(40), status = 503, code = "stripe_billing_write_frozen", changedRelease = false } = {}) {
  const calls = [];
  return { calls, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/api/version")) return new Response(JSON.stringify({
      application: "fanmind", runtimeEnvironment: environment,
      releaseCommit: changedRelease && calls.length === 3 ? "b".repeat(40) : release,
    }), { status: 200, headers: { "Cache-Control": "no-store" } });
    return new Response(JSON.stringify({ code }), { status, headers: { "Retry-After": "60" } });
  } };
}

test("Apply freeze proof binds actual HTTP behavior to one exact Staging release", async () => {
  const harness = freezeRuntimeHarness();
  await verifyStagingBillingFreeze({ origin: "https://staging.fanmind.invalid", commit: "a".repeat(40), fetchImpl: harness.fetchImpl });
  assert.equal(harness.calls.length, 3);
  assert.equal(harness.calls[1].options.body, "{}");
  assert.equal(harness.calls[1].options.headers.Origin, "https://staging.fanmind.invalid");
  assert.equal(harness.calls[1].options.headers.Authorization, undefined);
  assert.equal(harness.calls[1].options.headers.Cookie, undefined);
  assert.equal(harness.calls[1].options.redirect, "error");
});

for (const [name, settings] of [
  ["unfrozen", { status: 401 }],
  ["generic maintenance", { code: "checkout_unavailable" }],
  ["Production runtime", { environment: "production" }],
  ["old release", { release: "b".repeat(40) }],
  ["release changed during probe", { changedRelease: true }],
]) {
  test(`Apply rejects ${name} instead of trusting an operator flag`, async () => {
    const harness = freezeRuntimeHarness(settings);
    await assert.rejects(verifyStagingBillingFreeze({ origin: "https://staging.fanmind.invalid", commit: "a".repeat(40), fetchImpl: harness.fetchImpl }));
  });
}

test("Production URLs are rejected before any request", async () => {
  for (const origin of ["https://fanmind.ch", "https://www.fanmind.ch", "https://fanmind.ch.", "http://staging.fanmind.invalid"]) {
    const harness = freezeRuntimeHarness();
    await assert.rejects(verifyStagingBillingFreeze({ origin, commit: "a".repeat(40), fetchImpl: harness.fetchImpl }));
    assert.equal(harness.calls.length, 0);
  }
});

test("deploy and Apply share exclusion and Apply requires live proof before SQL", () => {
  const deploy = fs.readFileSync(".github/workflows/deploy-staging.yml", "utf8");
  const apply = fs.readFileSync(".github/workflows/stripe-billing-event-ledger-staging.yml", "utf8");
  assert.match(deploy, /group: fanmind-staging-deploy\s+cancel-in-progress: false/u);
  assert.match(apply, /group: fanmind-staging-deploy\s+cancel-in-progress: false/u);
  assert.match(apply, /set -euo pipefail\s+node scripts\/operations\/staging-billing-freeze-control.mjs[\s\S]*--verify[^\n]+\n\s+npm run db:stripe-billing-ledger:apply/u);
  assert.ok(deploy.indexOf('--resolve') < deploy.indexOf('rsync --archive'));
});

const compiledWebhook = ts.default.transpileModule(
  fs.readFileSync("src/app/api/stripe/webhook/route.ts", "utf8"),
  { compilerOptions: { module: ts.default.ModuleKind.CommonJS, target: ts.default.ScriptTarget.ES2022 } },
).outputText;
const eventPolicy = await import("../src/lib/stripeWebhookEventPolicy.mjs");
const referralPolicy = await import("../src/lib/referralLifecyclePolicy.mjs");
const ledgerPolicy = await import("../src/lib/stripeBillingEventLedger.mjs");
const { buildSignedFreezeProbe, runSignedBillingFreezeProbe } = await import("../scripts/operations/staging-signed-billing-freeze-probe.mjs");

function webhookHarness({ frozen = true, capture = false, signature = true } = {}) {
  const exports = {};
  let ledgerCalls = 0;
  const unused = new Proxy({}, { get() { return () => { throw new Error("unexpected_side_effect"); }; } });
  const imports = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/stripeBillingWriteFreeze.mjs": { ...freezePolicy, isStripeBillingWriteFrozen: () => frozen },
    "@/lib/stripeBillingEventLedger.mjs": { isStripeBillingEventLedgerCaptureEnabled: () => capture, isStripeBillingEventLedgerEnabled: () => false },
    "@/lib/stripeWebhookEventPolicy.mjs": eventPolicy,
    "@/lib/referralLifecyclePolicy.mjs": referralPolicy,
    "@/lib/stripeWorkspacePolicy.mjs": workspacePolicy,
    "@/lib/stripeBilling": { ...unused, verifyStripeSignature: () => signature, findWorkspaceIdByStripeReferences: () => { throw new Error("legacy_resumed"); } },
    "@/lib/stripeBillingEventSync.mjs": { syncStripeBillingEvent: async () => { ledgerCalls++; return { status: "unresolved" }; } },
  };
  runInNewContext(compiledWebhook, { exports, console: { warn() {}, error() {} }, require: name => imports[name] ?? unused });
  return { post: exports.POST, ledgerCalls: () => ledgerCalls };
}
function probeRequest(type = "checkout.session.completed") {
  return new Request("https://staging.invalid/api/stripe/webhook", { method: "POST", body: JSON.stringify({type, data: {object: {}}}) });
}
test("actual signed webhook freezes before legacy lookups and preserves signature rejection", async () => {
  const h = webhookHarness();
  const r = await h.post(probeRequest());
  assert.equal(r.status, 503);
  assert.equal(r.headers.get("Retry-After"), "60");
  assert.equal((await r.json()).code, freezePolicy.STRIPE_BILLING_WRITE_FREEZE_CODE);
  assert.equal(h.ledgerCalls(), 0);
  assert.equal((await webhookHarness({signature:false}).post(probeRequest())).status, 400);
  assert.equal((await h.post(probeRequest("fanmind.staging.webhook.binding_probe"))).status, 200);
});
test("actual webhook preserves capture-only and resumes legacy flow after unfreeze", async () => {
  const h = webhookHarness({capture:true});
  assert.equal((await h.post(probeRequest())).status, 200);
  assert.equal(h.ledgerCalls(), 1);
  await assert.rejects(webhookHarness({frozen:false}).post(probeRequest()), /stripe_webhook_billing_update_retryable/);
});
test("freeze probe cannot become a durable billing ledger event", () => {
  const event = JSON.parse(buildSignedFreezeProbe(100));
  assert.equal(event.type, "checkout.session.completed");
  assert.deepEqual(event.data.object, {object:"checkout.session"});
  const command = ledgerPolicy.buildStripeBillingLedgerCommand({event, projection:{billing_status:"pending_sepa_mandate"}, signedEventVerified:true});
  assert.equal(command.status, "retry");
  assert.equal(command.reason, "event_payload");
});
test("signed freeze probe requires exact release, binding, fixed retry code and a stable freeze", async () => {
  const env = { GITHUB_REF:"refs/heads/main", GITHUB_SHA:"a".repeat(40), FANMIND_EXPECTED_RELEASE_COMMIT:"a".repeat(40), FANMIND_WORKFLOW_COMMIT:"a".repeat(40), FANMIND_RUNTIME_ENVIRONMENT:"staging", FANMIND_ENABLE_NON_PRODUCTION_WRITES:"false", STRIPE_WEBHOOK_SECRET:"whsec_synthetic", FANMIND_STAGING_STRIPE_WEBHOOK_SMOKE_CONFIRM:"run-signed-staging-stripe-webhook-smoke", FANMIND_SIGNED_BILLING_FREEZE_CONFIRM:"verify-signed-billing-freeze" };
  const requests = [];
  function fakeFetch({ signedStatus = 503 } = {}) {
    return async (url, options) => {
      requests.push({url,options});
      if (url.endsWith("/api/version")) return Response.json({application:"fanmind",environment:"production",runtimeEnvironment:"staging",releaseCommit:env.GITHUB_SHA},{headers:{"Cache-Control":"no-store"}});
      if (url.endsWith("/api/billing/checkout")) return Response.json({code:"stripe_billing_write_frozen"},{status:503,headers:{"Retry-After":"60"}});
      const payload = JSON.parse(options.body);
      if (payload.type === "fanmind.staging.webhook.binding_probe") return Response.json({received:true});
      assert.equal(payload.id,"fanmind-freeze-probe");
      assert.match(options.headers["Stripe-Signature"], /^t=\d+,v1=[a-f0-9]{64}$/);
      return Response.json({code:"stripe_billing_write_frozen"},{status:signedStatus,headers:{"Retry-After":"60"}});
    };
  }
  assert.equal(await runSignedBillingFreezeProbe(env,fakeFetch()),true);
  await assert.rejects(runSignedBillingFreezeProbe(env,fakeFetch({signedStatus:200})));
  await assert.rejects(runSignedBillingFreezeProbe({...env,GITHUB_REF:"refs/heads/other"},fakeFetch()));
  assert.ok(requests.every(r=>r.url.startsWith("https://staging.fanmind.ch/")));
});
