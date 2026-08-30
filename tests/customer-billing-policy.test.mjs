import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
  shouldShowDemoInvoicesForWorkspace,
  mapStripeInvoiceToCustomerInvoice,
  listPolicyInvoiceResult,
} from "../src/lib/customerBillingPolicy.mjs";
import {
  AUSTRIAN_STANDARD_VAT_PERCENT,
  STRIPE_TAX_MODE,
  evaluateStripeTaxConfiguration,
} from "../src/lib/stripeTaxPolicy.mjs";
import {
  STRIPE_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
  verifyStripeWebhookSignature,
} from "../src/lib/stripeWebhookSignaturePolicy.mjs";
import {
  STRIPE_BILLING_ALLOWED,
  STRIPE_BILLING_RETRYABLE_ERROR,
  resolveStripeWebhookWorkspaceCandidates,
  stripeWebhookReferenceContractDecision,
  stripeWebhookReferenceLookupValues,
  stripeSubscriptionWorkspaceBindingDecision,
} from "../src/lib/stripeWorkspacePolicy.mjs";
import fs from "node:fs";

function stripeSignature(body, secret, timestamp) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

test("Stripe Tax readiness is fail-closed until mode and registration are confirmed", () => {
  assert.equal(evaluateStripeTaxConfiguration({}).ready, false);
  assert.equal(
    evaluateStripeTaxConfiguration({ FANMIND_TAX_MODE: STRIPE_TAX_MODE }).ready,
    false,
  );
  const ready = evaluateStripeTaxConfiguration({
    FANMIND_TAX_MODE: STRIPE_TAX_MODE,
    FANMIND_STRIPE_TAX_REGISTRATION_CONFIRMED: "true",
  });
  assert.equal(ready.ready, true);
  assert.equal(ready.austrianStandardVatPercent, 20);
  assert.equal(AUSTRIAN_STANDARD_VAT_PERCENT, 20);
});

test("all Checkout sessions delegate eligible payment methods to Stripe", () => {
  const stripeBillingSource = fs.readFileSync("src/lib/stripeBilling.ts", "utf8");
  const identifierPolicySource = fs.readFileSync(
    "src/lib/stripeIntegrationIdentifierPolicy.mjs",
    "utf8",
  );
  const billingSource = fs.readFileSync("src/lib/billing.ts", "utf8");

  assert.doesNotMatch(stripeBillingSource, /payment_method_types/u);
  assert.match(stripeBillingSource, /billing_address_collection: "required"/u);
  assert.match(stripeBillingSource, /tax_id_collection: \{ enabled: true \}/u);
  assert.match(stripeBillingSource, /automatic_tax: \{ enabled: true \}/u);
  assert.match(
    stripeBillingSource,
    /integration_identifier: createStripeIntegrationIdentifier\(\)/u,
  );
  assert.match(identifierPolicySource, /fanmind_checkout_/u);
  assert.match(billingSource, /planId === "starter"[\s\S]*return "card"/u);
  assert.doesNotMatch(stripeBillingSource, /small_business|Kleinunternehmer/iu);
});

test("Stripe webhook covers tax-ID lifecycle and waits for completed refunds", () => {
  const webhookSource = fs.readFileSync(
    "src/app/api/stripe/webhook/route.ts",
    "utf8",
  );

  for (const eventType of [
    "customer.tax_id.created",
    "customer.tax_id.updated",
    "customer.tax_id.deleted",
    "refund.updated",
    "refund.failed",
  ]) {
    assert.match(webhookSource, new RegExp(eventType.replaceAll(".", "\\."), "u"));
  }
  assert.match(webhookSource, /refundSucceeded \? "refunded" : null/u);
});

test("Stripe webhook Workspace candidates must be UUID-valid and agree with stored references", () => {
  const workspaceA = "11111111-1111-4111-8111-111111111111";
  const workspaceB = "22222222-2222-4222-8222-222222222222";
  const referencedA = { status: "found", workspaceId: workspaceA };

  assert.deepEqual(
    resolveStripeWebhookWorkspaceCandidates({
      directCandidates: [workspaceA, undefined, workspaceA],
      referenceResolution: referencedA,
    }),
    referencedA,
  );
  for (const directCandidates of [
    [workspaceA, workspaceB],
    ["not-a-uuid"],
    [workspaceB],
  ]) {
    assert.deepEqual(
      resolveStripeWebhookWorkspaceCandidates({
        directCandidates,
        referenceResolution: referencedA,
      }),
      { status: STRIPE_BILLING_RETRYABLE_ERROR },
    );
  }
  assert.deepEqual(
    resolveStripeWebhookWorkspaceCandidates({
      directCandidates: [workspaceA],
      referenceResolution: { status: "not_found" },
    }),
    { status: STRIPE_BILLING_RETRYABLE_ERROR },
  );
  assert.deepEqual(
    resolveStripeWebhookWorkspaceCandidates({
      directCandidates: [workspaceA],
      referenceResolution: { status: "not_found" },
      allowDirectBootstrap: true,
    }),
    { status: "found", workspaceId: workspaceA },
  );
});

test("every mutating Stripe event requires its complete typed reference set", () => {
  const exact = {
    customerId: "cus_SyntheticReferenceContract",
    subscriptionId: "sub_SyntheticReferenceContract",
    paymentIntentId: "pi_SyntheticReferenceContract",
  };
  for (const eventType of [
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "payment_intent.processing",
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "invoice.paid",
    "invoice.updated",
    "invoice.payment_failed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.resumed",
    "customer.subscription.paused",
    "customer.subscription.deleted",
    "charge.refunded",
    "refund.created",
    "refund.updated",
    "refund.failed",
    "charge.dispute.created",
    "customer.tax_id.created",
    "customer.tax_id.updated",
    "customer.tax_id.deleted",
  ]) {
    assert.equal(
      stripeWebhookReferenceContractDecision({ eventType, ...exact }),
      STRIPE_BILLING_ALLOWED,
      eventType,
    );
  }

  for (const [eventType, missingField] of [
    ["checkout.session.completed", "customerId"],
    ["payment_intent.succeeded", "customerId"],
    ["payment_intent.succeeded", "paymentIntentId"],
    ["invoice.paid", "customerId"],
    ["invoice.paid", "subscriptionId"],
    ["customer.subscription.updated", "customerId"],
    ["customer.subscription.updated", "subscriptionId"],
    ["refund.updated", "paymentIntentId"],
    ["customer.tax_id.updated", "customerId"],
  ]) {
    assert.equal(
      stripeWebhookReferenceContractDecision({
        eventType,
        ...exact,
        [missingField]: undefined,
      }),
      STRIPE_BILLING_RETRYABLE_ERROR,
      `${eventType}:${missingField}`,
    );
  }
  assert.equal(
    stripeWebhookReferenceContractDecision({
      eventType: "invoice.paid",
      ...exact,
      subscriptionId: "not-a-subscription",
    }),
    STRIPE_BILLING_RETRYABLE_ERROR,
  );

  assert.deepEqual(
    stripeWebhookReferenceLookupValues({
      eventType: "checkout.session.completed",
      ...exact,
    }),
    { customerId: exact.customerId },
  );
  assert.deepEqual(
    stripeWebhookReferenceLookupValues({
      eventType: "invoice.paid",
      ...exact,
    }),
    {
      customerId: exact.customerId,
      subscriptionId: exact.subscriptionId,
    },
  );
  assert.deepEqual(
    stripeWebhookReferenceLookupValues({
      eventType: "payment_intent.succeeded",
      ...exact,
    }),
    { customerId: exact.customerId },
  );
  assert.deepEqual(
    stripeWebhookReferenceLookupValues({
      eventType: "refund.updated",
      ...exact,
    }),
    { customerId: exact.customerId },
  );
  assert.deepEqual(
    stripeWebhookReferenceLookupValues({
      eventType: "refund.updated",
      ...exact,
      customerId: undefined,
    }),
    { paymentIntentId: exact.paymentIntentId },
  );
  assert.deepEqual(
    stripeWebhookReferenceLookupValues({
      eventType: "customer.tax_id.updated",
      ...exact,
    }),
    { customerId: exact.customerId },
  );
  assert.equal(
    stripeWebhookReferenceLookupValues({ eventType: "unknown.event", ...exact }),
    null,
  );

  const stripeBillingSource = fs.readFileSync(
    "src/lib/stripeBilling.ts",
    "utf8",
  );
  assert.match(
    stripeBillingSource,
    /missingReferenceCount \+= 1[\s\S]*missingReferenceCount > 0[\s\S]*matchedWorkspaceIds\.size === 0[\s\S]*status: "not_found"[\s\S]*status: "retryable_error"/u,
  );
});

test("subscription events require the exact stored customer and base subscription", () => {
  const workspaceId = "11111111-1111-4111-8111-111111111111";
  const input = {
    responseOk: true,
    bodyParsed: true,
    workspaceId,
    customerId: "cus_current_DO_NOT_PRINT",
    subscriptionId: "sub_base_DO_NOT_PRINT",
  };
  const exactRow = {
    id: workspaceId,
    stripe_customer_id: input.customerId,
    stripe_subscription_id: input.subscriptionId,
  };

  assert.equal(
    stripeSubscriptionWorkspaceBindingDecision({
      ...input,
      rows: [exactRow],
    }),
    STRIPE_BILLING_ALLOWED,
  );
  for (const rows of [
    [],
    [{ ...exactRow, stripe_customer_id: "cus_other_DO_NOT_PRINT" }],
    [{ ...exactRow, stripe_subscription_id: "sub_ai_DO_NOT_PRINT" }],
  ]) {
    assert.equal(
      stripeSubscriptionWorkspaceBindingDecision({ ...input, rows }),
      STRIPE_BILLING_RETRYABLE_ERROR,
    );
  }
});

test("subscription binding is checked before any Workspace billing mutation", () => {
  const webhookSource = fs.readFileSync(
    "src/app/api/stripe/webhook/route.ts",
    "utf8",
  );
  const binding = webhookSource.indexOf(
    "await verifyStripeSubscriptionWorkspaceBinding(",
  );
  const billingWrite = webhookSource.indexOf(
    "await updateWorkspaceBillingDefensively(",
  );

  assert.ok(binding >= 0 && billingWrite > binding);
  assert.match(
    webhookSource,
    /stripeWebhookReferenceLookupValues\([\s\S]*findWorkspaceIdByStripeReferences\(lookupReferences\)[\s\S]*workspaceIdCandidatesFromObject\(object\)/u,
  );
  assert.match(
    webhookSource,
    /resolution\.status === "not_found"[\s\S]*status: "retryable_error"/u,
  );
  assert.match(
    webhookSource,
    /eventType\?\.startsWith\("customer\.subscription\."\) === true[\s\S]*customerId: stripeId\(input\.object\.customer\)[\s\S]*subscriptionId: objectIdWithPrefix\(input\.object, "sub_"\)/u,
  );
});

test("Stripe webhook signatures are replay-safe, rotation-safe and malformed-input safe", () => {
  const body = JSON.stringify({
    id: "evt_SyntheticSignaturePolicy",
    type: "invoice.paid",
  });
  const secret = "whsec_SyntheticSignaturePolicySecret";
  const now = 1_787_000_000;
  const valid = stripeSignature(body, secret, now);
  const verify = (signatureHeader, overrides = {}) =>
    verifyStripeWebhookSignature({
      rawBody: body,
      signatureHeader,
      configuredSecret: secret,
      nowSeconds: now,
      ...overrides,
    });

  assert.equal(STRIPE_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS, 300);
  assert.equal(verify(`t=${now},v1=${valid}`), true);
  assert.equal(
    verify(`t=${now},v1=${"0".repeat(64)},v0=fake,v1=${valid}`),
    true,
  );
  assert.equal(
    verify(
      `t=${now - STRIPE_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS},v1=${stripeSignature(
        body,
        secret,
        now - STRIPE_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
      )}`,
    ),
    true,
  );

  for (const timestamp of [now - 301, now + 301]) {
    assert.equal(
      verify(
        `t=${timestamp},v1=${stripeSignature(body, secret, timestamp)}`,
      ),
      false,
    );
  }
  for (const signatureHeader of [
    null,
    "",
    `t=${now}`,
    `t=${now},t=${now},v1=${valid}`,
    `t=${now},v1=short`,
    `t=not-a-time,v1=${valid}`,
    `t=${now},v1=${"z".repeat(64)}`,
    `t=${now},v0=${valid}`,
  ]) {
    assert.doesNotThrow(() => verify(signatureHeader));
    assert.equal(verify(signatureHeader), false);
  }
  assert.equal(
    verify(`t=${now},v1=${valid}`, { rawBody: `${body}changed` }),
    false,
  );
});

test("real account without Stripe customer ID shows an empty invoice state", () => {
  const workspace = {
    billing_status: "demo_free",
    name: "Bernd Real Test Workspace",
    commercial_option: "starter_paid_setup",
    stripe_customer_id: null,
  };

  assert.equal(shouldShowDemoInvoicesForWorkspace(workspace), false);
  assert.deepEqual(listPolicyInvoiceResult({ workspace, stripeInvoices: null }), []);
});

test("public demo workspace keeps demo invoices", () => {
  const workspace = {
    billing_status: "demo_free",
    name: "FanMind Demo Workspace",
    commercial_option: "pilot_only",
    stripe_customer_id: null,
  };

  const invoices = listPolicyInvoiceResult({ workspace, stripeInvoices: null });
  assert.equal(shouldShowDemoInvoicesForWorkspace(workspace), true);
  assert.ok(invoices.length >= 2);
  assert.ok(invoices.every((invoice) => invoice.isDemo === true));
  assert.ok(invoices.some((invoice) => invoice.number === "Demo-Rechnung 0001"));
});

test("a user-editable demo-like workspace name never grants demo invoice behavior", () => {
  const workspace = {
    billing_status: "active",
    name: "FanMind Demo Workspace",
    commercial_option: "starter_paid_setup",
    stripe_customer_id: null,
  };

  assert.equal(shouldShowDemoInvoicesForWorkspace(workspace), false);
  assert.deepEqual(
    listPolicyInvoiceResult({ workspace, stripeInvoices: null }),
    [],
  );
});

test("real Stripe customer without invoices shows an empty invoice state", () => {
  const workspace = {
    billing_status: "active",
    name: "Bernd Real Test Workspace",
    commercial_option: "starter_paid_setup",
    stripe_customer_id: "cus_real_without_invoices",
  };

  assert.deepEqual(listPolicyInvoiceResult({ workspace, stripeInvoices: [] }), []);
});

test("real Stripe customer with invoices only shows Stripe invoice data", () => {
  const workspace = {
    billing_status: "active",
    name: "Bernd Real Test Workspace",
    commercial_option: "starter_paid_setup",
    stripe_customer_id: "cus_real_with_invoice",
  };
  const invoices = listPolicyInvoiceResult({
    workspace,
    stripeInvoices: [
      {
        id: "in_123",
        number: "FAN-2026-0001",
        created: 1784563200,
        status: "paid",
        currency: "eur",
        amount_due: 31200,
        amount_paid: 31200,
        subtotal: 31200,
        total_tax_amounts: [{ amount: 0 }],
        total: 31200,
        hosted_invoice_url: "https://pay.stripe.com/invoice/test",
        invoice_pdf: "https://pay.stripe.com/invoice/test/pdf",
      },
    ],
  });

  assert.equal(invoices.length, 1);
  assert.deepEqual(invoices[0], mapStripeInvoiceToCustomerInvoice({
    id: "in_123",
    number: "FAN-2026-0001",
    created: 1784563200,
    status: "paid",
    currency: "eur",
    amount_due: 31200,
    amount_paid: 31200,
    subtotal: 31200,
    total_tax_amounts: [{ amount: 0 }],
    total: 31200,
    hosted_invoice_url: "https://pay.stripe.com/invoice/test",
    invoice_pdf: "https://pay.stripe.com/invoice/test/pdf",
  }));
  assert.equal(invoices[0].isDemo, undefined);
});

test("internal 1 EUR daily Stripe subscription plan remains available", () => {
  const stripeBillingSource = fs.readFileSync("src/lib/stripeBilling.ts", "utf8");
  const billingStartSource = fs.readFileSync("src/app/billing/start/page.tsx", "utf8");

  assert.match(stripeBillingSource, /commercialOption === "internal_daily_test"/);
  assert.match(stripeBillingSource, /process\.env\.STRIPE_PRICE_INTERNAL_DAILY_TEST/);
  assert.match(stripeBillingSource, /planId: "pilot"/);
  assert.match(stripeBillingSource, /mode: "subscription"/);
  assert.match(stripeBillingSource, /commercialOption,[\s\S]*paymentCollectionMethod: "card"/u);
  assert.match(billingStartSource, /workspace\?\.commercial_option === "internal_daily_test"/u);
  assert.match(
    billingStartSource,
    /const checkoutPaymentMethodText =\s*"Stripe zeigt die für diese Zahlung verfügbaren Zahlarten"/u,
  );
  assert.match(
    billingStartSource,
    /commercial_option === "internal_daily_test"[\s\S]*isInternalDailyTestStripeReady\(stripe\)/u,
  );
  assert.equal(
    billingStartSource.match(/<dd>\{checkoutPaymentMethodText\}<\/dd>/gu)?.length,
    1,
  );
  assert.equal(
    billingStartSource.match(/<li>\{checkoutPaymentMethodText\}<\/li>/gu)?.length,
    1,
  );
});


test("daily test registration is controlled by an explicit fail-closed server flag", () => {
  const registerPageSource = fs.readFileSync("src/app/register/page.tsx", "utf8");
  const registerClientSource = fs.readFileSync("src/app/register/RegisterClient.tsx", "utf8");
  const registrationWindowRouteSource = fs.readFileSync("src/app/api/register/daily-test-window/route.ts", "utf8");
  const registrationWorkspaceRouteSource = fs.readFileSync("src/app/api/register/workspace/route.ts", "utf8");
  const supabaseServerSource = fs.readFileSync("src/lib/supabase/server.ts", "utf8");

  const runtimeSettingsSource = fs.readFileSync("src/lib/runtimeProductSettings.ts", "utf8");
  const publicDailyTestPolicySource = fs.readFileSync("src/lib/publicDailyTestPlanPolicy.mjs", "utf8");
  const adminRouteSource = fs.readFileSync("src/app/api/admin/settings/daily-test-plan/route.ts", "utf8");
  const adminSettingsSource = fs.readFileSync("src/app/admin/settings/page.tsx", "utf8");
  const workspaceSetupSource = fs.readFileSync("src/app/workspace/setup/page.tsx", "utf8");
  const deploySource = fs.readFileSync(".github/workflows/deploy-fanmind.yml", "utf8");

  assert.match(registerPageSource, /getPublicDailyTestPlanEnabled/);
  assert.match(registerPageSource, /isInternalDailyTestWorkspaceProvisioningReady/);
  assert.match(registerPageSource, /isInternalDailyTestAdmissionReady\(\{[\s\S]*stripeConfig: getStripeConfigStatus\(\)/u);
  const checkoutRouteSource = fs.readFileSync("src/app/api/billing/checkout/route.ts", "utf8");
  assert.match(checkoutRouteSource, /await getPublicDailyTestPlanEnabled\(\)/);
  assert.match(
    checkoutRouteSource,
    /commercialOption === "internal_daily_test"[\s\S]*isInternalDailyTestStripeReady\(config\)/u,
  );
  assert.match(runtimeSettingsSource, /publicDailyTestPlanEnabled/);
  assert.match(runtimeSettingsSource, /getTemporaryPublicDailyTestPlanStatus/);
  assert.match(publicDailyTestPolicySource, /PUBLIC_DAILY_TEST_PLAN_WINDOW_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(publicDailyTestPolicySource, /enabledUntilMs - updatedAtMs <= PUBLIC_DAILY_TEST_PLAN_WINDOW_MS/);
  assert.doesNotMatch(runtimeSettingsSource, /FANMIND_ENABLE_PUBLIC_DAILY_TEST_PLAN/);
  assert.match(runtimeSettingsSource, /rename\(temporaryPath, settingsPath\)/);
  assert.match(adminRouteSource, /requirePlatformAdmin/);
  assert.match(
    adminRouteSource,
    /enabled &&[\s\S]*isInternalDailyTestWorkspaceProvisioningReady\(\)[\s\S]*isInternalDailyTestStripeReady\(getStripeConfigStatus\(\)\)[\s\S]*daily_test_plan", "not_ready"[\s\S]*setPublicDailyTestPlanEnabled/u,
  );
  assert.match(
    adminSettingsSource,
    /windowEnabled && provisioningReady && stripeReady[\s\S]*Sichere Registrierung[\s\S]*Stripe &amp; Webhook/u,
  );
  assert.match(deploySource, /if \[ ! -e "\$RUNTIME_SETTINGS_FILE" \]/);
  assert.doesNotMatch(deploySource, /sed -i.*FANMIND_ENABLE_PUBLIC_DAILY_TEST_PLAN/);
  assert.doesNotMatch(registerPageSource, /enablePublicDailyTestPlan=\{false\}/);
  assert.match(
    registerClientSource,
    /isDailyTestRegistration\(\{[\s\S]*enabled: enablePublicDailyTestPlan,[\s\S]*planId: resolvedPlanId,[\s\S]*testPlan: requestedTestPlan/u,
  );
  assert.match(registerClientSource, /isRetiredPilotRequested \? "starter" : resolvedPlanId/u);
  assert.match(registerClientSource, /commercialOption = isDailyTestPlanSelected \? "internal_daily_test"/);
  assert.match(registerClientSource, /fanmind_locale: language/u);
  assert.match(registrationWindowRouteSource, /export const dynamic = "force-dynamic"/u);
  assert.match(registrationWindowRouteSource, /isTrustedFanMindMutationRequest\(request\)/u);
  assert.match(registrationWindowRouteSource, /readBoundedJsonRequest\([\s\S]*MAX_DAILY_TEST_WINDOW_BODY_BYTES/u);
  assert.match(registrationWindowRouteSource, /Object\.keys\(payload\)\.length !== 1/u);
  assert.match(registrationWindowRouteSource, /getPublicDailyTestPlanEnabled\(\)[\s\S]*isInternalDailyTestWorkspaceProvisioningReady\(\)[\s\S]*isInternalDailyTestAdmissionReady\(\{[\s\S]*stripeConfig: getStripeConfigStatus\(\)/u);
  assert.match(registrationWindowRouteSource, /daily_test_window_closed/u);
  assert.match(registrationWindowRouteSource, /"Cache-Control": "no-store"/u);
  assert.doesNotMatch(registrationWindowRouteSource, /createStripeCheckoutSession/u);
  const windowCheckIndex = registerClientSource.indexOf('fetch("/api/register/daily-test-window"');
  const signUpIndex = registerClientSource.indexOf("supabase.auth.signUp");
  assert.ok(windowCheckIndex >= 0 && signUpIndex > windowCheckIndex);
  assert.match(registerClientSource, /selectedCommercialOption === "internal_daily_test"[\s\S]*fetch\("\/api\/register\/daily-test-window"/u);
  assert.match(registerClientSource, /windowResponse\.json\(\)\.catch\(\(\) => null\)[\s\S]*!windowResponse\.ok \|\| windowPayload\?\.ok !== true[\s\S]*setError\(DAILY_TEST_WINDOW_CLOSED_MESSAGES\[language\]\)[\s\S]*return;/u);
  assert.doesNotMatch(registerClientSource, /DAILY_TEST_WINDOW_CLOSED_MESSAGES[\s\S]*selectedCommercialOption\s*=\s*"starter/u);
  const sessionSyncIndex = registerClientSource.indexOf("await syncSupabaseSessionForServer(data.session)");
  const workspaceMutationIndex = registerClientSource.indexOf('fetch("/api/register/workspace"');
  assert.ok(sessionSyncIndex > signUpIndex && workspaceMutationIndex > sessionSyncIndex);
  assert.doesNotMatch(registerClientSource, /supabase\.rpc|\.from\("workspaces"\)|\.from\("workspace_members"\)/u);
  assert.match(
    registrationWorkspaceRouteSource,
    /getSupabaseServerUser\(\)[\s\S]*buildTrustedProvisioningUser\([\s\S]*data\.user[\s\S]*ensureUserWorkspace\(trustedUser\)/u,
  );
  assert.match(registrationWorkspaceRouteSource, /daily_test_window_closed/u);
  assert.match(registrationWorkspaceRouteSource, /"Cache-Control": "no-store"/u);
  const dailyGateIndex = supabaseServerSource.indexOf('workspaceTerms.commercialOption === "internal_daily_test"');
  const provisioningRpcIndex = supabaseServerSource.indexOf("INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_RPC", dailyGateIndex);
  const legacyBridgeIndex = supabaseServerSource.indexOf("// Compatibility bridge for the deploy-before-migrate rollout.", dailyGateIndex);
  assert.ok(dailyGateIndex >= 0 && provisioningRpcIndex > dailyGateIndex && legacyBridgeIndex > provisioningRpcIndex);
  assert.match(supabaseServerSource, /isInternalDailyTest[\s\S]*isInternalDailyTestWorkspaceProvisioningReady\(\)[\s\S]*isInternalDailyTestStripeReady\(getStripeConfigStatus\(\)\)[\s\S]*getPublicDailyTestPlanEnabled\(\)[\s\S]*getServiceAccessToken\(\)/u);
  assert.match(supabaseServerSource, /if \(!workspace && !isInternalDailyTest\)/u);
  assert.match(supabaseServerSource, /planId === "pilot" && commercialOption === "internal_daily_test"[\s\S]*getRegistrationCommercialTerms\("pilot", "internal_daily_test"\)/u);
  assert.match(
    workspaceSetupSource,
    /resolveWorkspaceLocale\([\s\S]*lang: params\?\.lang,[\s\S]*user: data\.user/u,
  );
  assert.match(
    workspaceSetupSource,
    /PUBLIC_DAILY_TEST_PLAN_UNAVAILABLE_ERROR[\s\S]*PUBLIC_DAILY_TEST_BILLING_UNAVAILABLE_ERROR[\s\S]*PUBLIC_DAILY_TEST_PROVISIONING_UNAVAILABLE_ERROR/u,
  );
  assert.match(
    workspaceSetupSource,
    /dailyTestAvailable[\s\S]*getPublicDailyTestPlanEnabled\(\)[\s\S]*isInternalDailyTestWorkspaceProvisioningReady\(\)[\s\S]*getStripeConfigStatus\(\)[\s\S]*internal_daily_test[\s\S]*No workspace was created[\s\S]*Es wurde kein Workspace angelegt/u,
  );
  assert.doesNotMatch(
    workspaceSetupSource,
    /\{setupResult\.error\.message\}/u,
  );
  assert.match(
    registerClientSource,
    /DAILY_TEST_WORKSPACE_RECOVERY_MESSAGES[\s\S]*Do not register again[\s\S]*workspacePayload\?\.code === "daily_test_window_closed"[\s\S]*DAILY_TEST_WORKSPACE_RECOVERY_MESSAGES\[language\]/u,
  );
});

test("daily beta admin checkout targets the workspace owner and cancels at paid-day end", () => {
  const adminBillingSource = fs.readFileSync("src/lib/adminBilling.ts", "utf8");
  assert.match(adminBillingSource, /userId: workspace\.owner_user_id/);
  assert.match(adminBillingSource, /userEmail: workspace\.owner_email/);
  assert.match(adminBillingSource, /cancel_at_period_end: true/);
  assert.match(adminBillingSource, /const persisted = await updateAdminBillingWorkspace/u);
  assert.match(adminBillingSource, /if \(!persisted\.ok\)[\s\S]*expireStripeCheckoutSession\(session\.id\)[\s\S]*ok: false/u);
  assert.match(adminBillingSource, /!workspace\.stripe_subscription_id[\s\S]*!workspace\.stripe_checkout_session_id[\s\S]*ok: false[\s\S]*await expireStripeCheckoutSession\(workspace\.stripe_checkout_session_id\)[\s\S]*if \(!checkoutExpired\)[\s\S]*ok: false[\s\S]*updateAdminBillingWorkspace/u);
  assert.match(
    adminBillingSource,
    /startInternalDailyTestCheckout[\s\S]*isInternalDailyTestStripeReady\(getStripeConfigStatus\(\)\)[\s\S]*createStripeCheckoutSession/u,
  );
  assert.match(adminBillingSource, /!workspace\.stripe_subscription_id[\s\S]*billing_status: "demo_free"[\s\S]*stripe_checkout_session_id: null[\s\S]*stripe_live_daily_test: false/u);
  const stripeBillingSource = fs.readFileSync("src/lib/stripeBilling.ts", "utf8");
  assert.match(stripeBillingSource, /stripe\.checkout\.sessions\.expire\(normalizedId\)[\s\S]*stripe\.checkout\.sessions\.retrieve\(normalizedId\)[\s\S]*session\.status === "expired"/u);
  assert.doesNotMatch(adminBillingSource, /subscriptions\/\$\{encodeURIComponent\(workspace\.stripe_subscription_id\)\}`, \{ method: "DELETE"/);
});
