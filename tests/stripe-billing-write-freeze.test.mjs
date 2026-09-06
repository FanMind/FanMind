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
  assert.match(workflow, /default: 'false'/u);
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
