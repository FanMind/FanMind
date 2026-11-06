import assert from "node:assert/strict";
import test from "node:test";

import {
  NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
  WRITE_ACKNOWLEDGEMENT,
  evaluateReferralSandboxConfiguration,
} from "../src/lib/referralSandboxPolicy.mjs";

const completeReadOnlyEnvironment = {
  STRIPE_SECRET_KEY: "sk_test_example",
  STRIPE_WEBHOOK_SECRET: "whsec_example",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-example",
  FANMIND_REFERRAL_RECONCILE_SECRET: "x".repeat(48),
  FANMIND_ENABLE_REFERRAL_BILLING: "false",
  FANMIND_RUNTIME_ENVIRONMENT: "production",
  NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
  NEXT_PUBLIC_SUPABASE_URL: "https://productionref123.supabase.co",
  FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
  FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
};

const safeWriteBoundary = {
  FANMIND_RUNTIME_ENVIRONMENT: "staging",
  NEXT_PUBLIC_APP_URL: "https://staging.fanmind.example",
  NEXT_PUBLIC_SUPABASE_URL: "https://stagingref12345.supabase.co",
  FANMIND_TARGET_SUPABASE_PROJECT_REF: "stagingref12345",
  FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
  FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
  FANMIND_NON_PRODUCTION_WRITE_ACK: NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
};

test("read-only preflight accepts test credentials only with a valid shared boundary", () => {
  const result = evaluateReferralSandboxConfiguration(
    completeReadOnlyEnvironment,
  );

  assert.equal(result.ok, true);
  assert.equal(result.mode, "read-only");
  assert.equal(result.stripeKeyMode, "test");
  assert.equal(result.billingEnabled, false);
  assert.equal(result.productionHostname, true);
  assert.equal(result.environmentBoundaryOk, true);
});

test("restricted Stripe test keys are accepted and restricted live keys are blocked", () => {
  const restrictedTest = evaluateReferralSandboxConfiguration({
    ...completeReadOnlyEnvironment,
    STRIPE_SECRET_KEY: "rk_test_restricted_example",
  });
  assert.equal(restrictedTest.ok, true);
  assert.equal(restrictedTest.stripeKeyMode, "test");

  const restrictedLive = evaluateReferralSandboxConfiguration({
    ...completeReadOnlyEnvironment,
    STRIPE_SECRET_KEY: "rk_live_forbidden",
  });
  assert.equal(restrictedLive.ok, false);
  assert.equal(restrictedLive.stripeKeyMode, "live");
});

test("read-only referral preflight rejects a stale global write gate", () => {
  const result = evaluateReferralSandboxConfiguration({
    ...completeReadOnlyEnvironment,
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    FANMIND_NON_PRODUCTION_WRITE_ACK: NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
  });

  assert.equal(result.ok, false);
  assert.equal(result.environmentBoundaryOk, false);
  assert.match(result.errors.join("\n"), /Umgebungsgrenze: Read-only Preflight/);
});

test("live Stripe keys are rejected in every sandbox mode", () => {
  const result = evaluateReferralSandboxConfiguration({
    ...completeReadOnlyEnvironment,
    STRIPE_SECRET_KEY: "sk_live_forbidden",
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Live-Stripe-Schlüssel/);
});

test("read-only preflight fails when referral billing is enabled", () => {
  const result = evaluateReferralSandboxConfiguration({
    ...completeReadOnlyEnvironment,
    FANMIND_ENABLE_REFERRAL_BILLING: "true",
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Read-only Preflight/);
});

test("write mode requires referral and shared environment acknowledgements", () => {
  const unsafe = evaluateReferralSandboxConfiguration(
    {
      ...completeReadOnlyEnvironment,
      FANMIND_ENABLE_REFERRAL_BILLING: "true",
    },
    { allowWrite: true },
  );

  assert.equal(unsafe.ok, false);
  assert.match(unsafe.errors.join("\n"), /SANDBOX_ACK/);
  assert.match(unsafe.errors.join("\n"), /fanmind\.ch/);
  assert.match(unsafe.errors.join("\n"), /Umgebungsgrenze/);
  assert.equal(unsafe.environmentBoundaryOk, false);

  const safe = evaluateReferralSandboxConfiguration(
    {
      ...completeReadOnlyEnvironment,
      ...safeWriteBoundary,
      FANMIND_ENABLE_REFERRAL_BILLING: "true",
      FANMIND_REFERRAL_SANDBOX_ACK: WRITE_ACKNOWLEDGEMENT,
    },
    { allowWrite: true },
  );

  assert.equal(safe.ok, true);
  assert.equal(safe.mode, "sandbox-write");
  assert.equal(safe.productionHostname, false);
  assert.equal(safe.environmentBoundaryOk, true);
});

test("referral write mode rejects a staging host that points to Production Supabase", () => {
  const result = evaluateReferralSandboxConfiguration(
    {
      ...completeReadOnlyEnvironment,
      ...safeWriteBoundary,
      NEXT_PUBLIC_SUPABASE_URL: "https://productionref123.supabase.co",
      FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionref123",
      FANMIND_ENABLE_REFERRAL_BILLING: "true",
      FANMIND_REFERRAL_SANDBOX_ACK: WRITE_ACKNOWLEDGEMENT,
    },
    { allowWrite: true },
  );

  assert.equal(result.ok, false);
  assert.equal(result.environmentBoundaryOk, false);
  assert.match(result.errors.join("\n"), /Production-Supabase-Projekt/);
});

test("trailing-dot Production hostnames remain blocked in write mode", () => {
  const result = evaluateReferralSandboxConfiguration(
    {
      ...completeReadOnlyEnvironment,
      FANMIND_RUNTIME_ENVIRONMENT: "staging",
      NEXT_PUBLIC_APP_URL: "https://fanmind.ch.",
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
      FANMIND_NON_PRODUCTION_WRITE_ACK: NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
      FANMIND_ENABLE_REFERRAL_BILLING: "true",
      FANMIND_REFERRAL_SANDBOX_ACK: WRITE_ACKNOWLEDGEMENT,
    },
    { allowWrite: true },
  );

  assert.equal(result.ok, false);
  assert.equal(result.productionHostname, true);
  assert.match(result.errors.join("\n"), /fanmind\.ch/);
});

test("missing webhook, service role and reconcile secrets fail without revealing values", () => {
  const result = evaluateReferralSandboxConfiguration({
    FANMIND_RUNTIME_ENVIRONMENT: "production",
    NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
    NEXT_PUBLIC_SUPABASE_URL: "https://productionref123.supabase.co",
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
    STRIPE_SECRET_KEY: "sk_test_example",
    FANMIND_ENABLE_REFERRAL_BILLING: "false",
  });

  assert.equal(result.ok, false);
  assert.equal(result.webhookConfigured, false);
  assert.equal(result.serviceRoleConfigured, false);
  assert.equal(result.reconcileSecretConfigured, false);
  assert.match(result.errors.join("\n"), /STRIPE_WEBHOOK_SECRET/);
  assert.match(result.errors.join("\n"), /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(result.errors.join("\n"), /FANMIND_REFERRAL_RECONCILE_SECRET/);
});
