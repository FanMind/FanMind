import assert from "node:assert/strict";
import test from "node:test";
import { resolvePublicWorkspacePlanId } from "../src/lib/publicDailyPlanPolicy.mjs";

test("public Daily identity uses the persisted pair without promoting demos or preferences", () => {
  assert.equal(resolvePublicWorkspacePlanId({ plan_id: "pilot", commercial_option: "internal_daily_test" }), "daily");
  assert.equal(resolvePublicWorkspacePlanId({ plan_id: "pilot", commercial_option: "pilot_only" }), "pilot");
  assert.equal(resolvePublicWorkspacePlanId({ plan_id: "starter", commercial_option: "starter_paid_setup" }), "starter");
  assert.equal(resolvePublicWorkspacePlanId({ plan_id: "starter", commercial_option: "internal_daily_test" }), "starter");
  assert.equal(resolvePublicWorkspacePlanId({ registration_plan_preference: "pilot", registration_option_preference: "internal_daily_test" }), "unknown");
  assert.equal(resolvePublicWorkspacePlanId({ plan_id: "pilot", commercial_option: "internal_daily_test", member_safe_projection: true }), "member");
  assert.equal(resolvePublicWorkspacePlanId(null), "unknown");
});

import {
  createPublicDailyBetaSettings,
  getPublicDailyBetaStatus,
} from "../src/lib/publicDailyTestPlanPolicy.mjs";
import {
  isInternalDailyTestAdmissionReady,
  isInternalDailyTestStripeReady,
} from "../src/lib/internalDailyTestReadinessPolicy.mjs";

test("manual Daily beta has no countdown and remains enabled until an admin turns it off", () => {
  const started = new Date("2026-09-14T18:00:00.000Z");
  const settings = createPublicDailyBetaSettings(true, "admin@example.invalid", started);
  assert.equal(settings.publicDailyTestPlanEnabledUntil, null);
  assert.equal(getPublicDailyBetaStatus(settings, started).enabled, true);
  assert.equal(getPublicDailyBetaStatus(settings, new Date("2036-09-14T18:00:00.000Z")).enabled, true);

  const disabled = createPublicDailyBetaSettings(false, "admin@example.invalid", new Date("2026-09-15T18:00:00.000Z"));
  assert.equal(getPublicDailyBetaStatus(disabled).enabled, false);
});

test("legacy timed, malformed, future and unaudited Daily states fail closed", () => {
  const now = new Date("2026-09-14T18:00:00.000Z");
  const valid = createPublicDailyBetaSettings(true, "admin@example.invalid", now);
  assert.deepEqual(getPublicDailyBetaStatus(valid, now), { enabled: true, updatedAt: now.toISOString() });
  for (const settings of [
    { publicDailyTestPlanEnabled: true },
    { ...valid, updatedBy: "" },
    { ...valid, publicDailyTestPlanEnabled: "true" },
    { ...valid, publicDailyTestPlanEnabledUntil: "2026-10-14T18:00:00.000Z" },
    createPublicDailyBetaSettings(true, "admin@example.invalid", new Date(now.getTime() + 1)),
  ]) {
    assert.deepEqual(getPublicDailyBetaStatus(settings, now), { enabled: false, updatedAt: null });
  }
});

test("Daily admission requires complete checkout and webhook configuration", () => {
  const stripeConfig = {
    hasSecretKey: true,
    hasWebhookSecret: true,
    hasAppUrl: true,
    hasInternalDailyTestPrice: true,
    readyForWebhook: true,
    readyForTax: true,
  };

  assert.equal(isInternalDailyTestStripeReady(stripeConfig), true);
  assert.equal(isInternalDailyTestAdmissionReady({
    windowEnabled: true,
    workspaceProvisioningReady: true,
    billingRuntimeReady: true,
    stripeConfig,
  }), true);

  for (const missingField of Object.keys(stripeConfig)) {
    const incompleteConfig = { ...stripeConfig, [missingField]: false };
    assert.equal(
      isInternalDailyTestStripeReady(incompleteConfig),
      false,
      `${missingField} must fail closed`,
    );
    assert.equal(isInternalDailyTestAdmissionReady({
      windowEnabled: true,
      workspaceProvisioningReady: true,
      billingRuntimeReady: true,
      stripeConfig: incompleteConfig,
    }), false);
  }

  assert.equal(isInternalDailyTestAdmissionReady({
    windowEnabled: false,
    workspaceProvisioningReady: true,
    billingRuntimeReady: true,
    stripeConfig,
  }), false);
  assert.equal(isInternalDailyTestAdmissionReady({
    windowEnabled: true,
    workspaceProvisioningReady: false,
    billingRuntimeReady: true,
    stripeConfig,
  }), false);
  assert.equal(isInternalDailyTestAdmissionReady({
    windowEnabled: true,
    workspaceProvisioningReady: true,
  }), false);
});


test("Daily billing runtime requires the canonical ledger and no write freeze", async () => {
  const { isInternalDailyTestBillingRuntimeReady } = await import("../src/lib/internalDailyTestReadinessPolicy.mjs");
  const ready = {
    FANMIND_STRIPE_BILLING_EVENT_LEDGER_ENABLED: "true",
    FANMIND_STRIPE_BILLING_EVENT_LEDGER_CONTROL_CONFIRMED: "20260816210000",
    FANMIND_STRIPE_BILLING_CANONICAL_RECONCILIATION_CONFIRMED: "true",
    FANMIND_STRIPE_BILLING_WRITE_FREEZE: "false",
  };
  assert.equal(isInternalDailyTestBillingRuntimeReady(ready), true);
  for (const key of Object.keys(ready)) {
    assert.equal(isInternalDailyTestBillingRuntimeReady({ ...ready, [key]: key.endsWith("WRITE_FREEZE") ? "true" : "false" }), false);
  }
});


test("owner-approved public Daily aliases do not admit retired Pilot or arbitrary plans", async () => {
  const { isPublicDailyRegistrationRequest, PUBLIC_DAILY_PLAN_PRICE_CENTS, PUBLIC_DAILY_PLAN_SETUP_FEE_CENTS } = await import("../src/lib/publicDailyPlanPolicy.mjs");
  assert.equal(PUBLIC_DAILY_PLAN_PRICE_CENTS, 100);
  assert.equal(PUBLIC_DAILY_PLAN_SETUP_FEE_CENTS, 0);
  assert.equal(isPublicDailyRegistrationRequest({ enabled: true, planId: "daily" }), true);
  assert.equal(isPublicDailyRegistrationRequest({ enabled: true, planId: "pilot", testPlan: "daily" }), true);
  for (const input of [{}, {planId: "pilot"}, {planId:"Daily"}, {planId:"growth",testPlan:"daily"}, {planId:["daily"]}]) {
    assert.equal(isPublicDailyRegistrationRequest(input), false);
  }
  const { buildRegistrationHref } = await import("../src/lib/registrationEntryPolicy.mjs");
  assert.equal(buildRegistrationHref({ language:"en", planId:"pilot", testPlan:"daily", referralCode:"test-ref" }), "/register?plan=daily&lang=en&ref=test-ref");
});
