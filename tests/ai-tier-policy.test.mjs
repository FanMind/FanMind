import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AI_TIER_CONFIG,
  assertAiTierPolicy,
  evaluateAiTierReadiness,
  formatAiTierPrice,
  getAiTierRuntimeReadinessFromEnvironment,
  getAiTierTotalMonthlyCents,
  isAiTierAutomaticallyBookable,
  resolveWorkspaceAiTierEntitlement,
} from "../src/config/aiTiers.mjs";

test("approved AI tier prices and package totals remain stable", () => {
  assert.equal(AI_TIER_CONFIG.standard.monthlyAddOnCents, 0);
  assert.equal(AI_TIER_CONFIG.plus.monthlyAddOnCents, 10000);
  assert.equal(AI_TIER_CONFIG.ultra.monthlyAddOnCents, 20000);

  assert.equal(getAiTierTotalMonthlyCents("standard", 31200), 31200);
  assert.equal(getAiTierTotalMonthlyCents("plus", 31200), 41200);
  assert.equal(getAiTierTotalMonthlyCents("ultra", 31200), 51200);
});

test("KI Standard remains included and Plus/Ultra remain separate add-ons", () => {
  assert.equal(AI_TIER_CONFIG.standard.includedInBase, true);
  assert.equal(AI_TIER_CONFIG.plus.includedInBase, false);
  assert.equal(AI_TIER_CONFIG.ultra.includedInBase, false);
  assert.equal(formatAiTierPrice("standard"), "im Basispaket enthalten");
  assert.equal(formatAiTierPrice("plus"), "+100 €/Monat");
  assert.equal(formatAiTierPrice("ultra"), "+200 €/Monat");
});

test("AI tiers use the approved server-side 50/100/150 conversation context", () => {
  assert.equal(AI_TIER_CONFIG.standard.contextMessageLimit, 50);
  assert.equal(AI_TIER_CONFIG.plus.contextMessageLimit, 100);
  assert.equal(AI_TIER_CONFIG.ultra.contextMessageLimit, 150);
});

test("no AI add-on is referral-discount eligible or allowed to send automatically", () => {
  for (const tier of Object.values(AI_TIER_CONFIG)) {
    assert.equal(tier.addOnReferralDiscountEligible, false);
    assert.equal(tier.automaticSendingEnabled, false);
  }
  assert.equal(assertAiTierPolicy(), true);
});

test("Plus and Ultra cannot be automatically booked before models, limits and billing are approved", () => {
  assert.equal(isAiTierAutomaticallyBookable("standard"), false);
  assert.equal(isAiTierAutomaticallyBookable("plus"), false);
  assert.equal(isAiTierAutomaticallyBookable("ultra"), false);

  assert.equal(AI_TIER_CONFIG.plus.modelClass, null);
  assert.equal(AI_TIER_CONFIG.plus.monthlyRequestLimit, null);
  assert.equal(AI_TIER_CONFIG.ultra.modelClass, null);
  assert.equal(AI_TIER_CONFIG.ultra.monthlyTokenLimit, null);
});

test("current tier readiness is explicit and fail-closed", () => {
  const standard = evaluateAiTierReadiness("standard");
  const plus = evaluateAiTierReadiness("plus", {
    stripePriceConfigured: true,
    workspaceContractConfirmed: true,
  });
  const ultra = evaluateAiTierReadiness("ultra", {
    stripePriceConfigured: true,
    workspaceContractConfirmed: true,
  });

  assert.equal(standard.ready, true);
  assert.equal(standard.automaticallyBookable, false);
  assert.deepEqual(standard.blockers, []);

  for (const readiness of [plus, ultra]) {
    assert.equal(readiness.ready, false);
    assert.equal(readiness.automaticallyBookable, false);
    assert.ok(readiness.blockers.includes("public_status"));
    assert.ok(readiness.blockers.includes("billing_status"));
    assert.ok(readiness.blockers.includes("booking_flag"));
    assert.ok(readiness.blockers.includes("model_class"));
    assert.ok(readiness.blockers.includes("monthly_request_limit"));
    assert.ok(readiness.blockers.includes("monthly_token_limit"));
    assert.ok(!readiness.blockers.includes("context_message_limit"));
    assert.ok(readiness.blockers.includes("provider_model"));
    assert.ok(readiness.blockers.includes("fallback_model"));
    assert.ok(!readiness.blockers.includes("provider_fallback_distinct"));
    assert.ok(readiness.blockers.includes("usage_enforcement"));
    assert.ok(readiness.blockers.includes("stripe_lifecycle"));
    assert.ok(readiness.blockers.includes("quality_cost_evaluation"));
    assert.ok(readiness.blockers.includes("staging_acceptance"));
    assert.ok(readiness.blockers.includes("legal_tax_approval"));
    assert.ok(readiness.blockers.includes("runtime_integration"));
    assert.ok(readiness.blockers.includes("production_activation"));
    assert.ok(!readiness.blockers.includes("stripe_price"));
    assert.ok(!readiness.blockers.includes("workspace_contract"));
  }

  assert.equal(
    isAiTierAutomaticallyBookable("plus", {
      stripePriceConfigured: true,
      workspaceContractConfirmed: true,
    }),
    false,
  );
});

test("paid tier activation evidence is tier-specific and redacted", () => {
  const environment = {
    STRIPE_PRICE_AI_PLUS: "price_plus_DO_NOT_PRINT",
    FANMIND_AI_TIER_WORKSPACE_CONTRACT_CONFIRMED: "true",
    FANMIND_AI_TIER_PLUS_MODEL: "model-plus-private",
    FANMIND_AI_TIER_PLUS_FALLBACK_MODEL: "model-plus-fallback-private",
    FANMIND_AI_TIER_PLUS_USAGE_ENFORCEMENT_CONFIRMED: "true",
    FANMIND_AI_TIER_PLUS_STRIPE_LIFECYCLE_CONFIRMED: "true",
    FANMIND_AI_TIER_PLUS_QUALITY_COST_EVALUATION_CONFIRMED: "true",
    FANMIND_AI_TIER_PLUS_STAGING_ACCEPTANCE_CONFIRMED: "true",
    FANMIND_AI_TIER_PLUS_LEGAL_TAX_APPROVAL_CONFIRMED: "true",
    FANMIND_AI_TIER_PLUS_RUNTIME_INTEGRATION_CONFIRMED: "true",
    FANMIND_AI_TIER_PLUS_PRODUCTION_ACTIVATION_CONFIRMED: "true",
  };

  const plus = getAiTierRuntimeReadinessFromEnvironment("plus", environment);
  const ultra = getAiTierRuntimeReadinessFromEnvironment("ultra", environment);

  assert.deepEqual(plus, {
    stripePriceConfigured: true,
    workspaceContractConfirmed: true,
    providerModelConfigured: true,
    fallbackModelConfigured: true,
    providerFallbackDistinct: true,
    usageEnforcementConfirmed: true,
    stripeLifecycleConfirmed: true,
    qualityCostEvaluationConfirmed: true,
    stagingAcceptanceConfirmed: true,
    legalTaxApprovalConfirmed: true,
    runtimeIntegrationConfirmed: true,
    productionActivationConfirmed: true,
  });
  assert.equal(ultra.stripePriceConfigured, false);
  assert.equal(ultra.providerModelConfigured, false);
  assert.equal(ultra.productionActivationConfirmed, false);
  assert.doesNotMatch(JSON.stringify(plus), /model-plus/u);
});

test("configured paid tier provider and fallback models must be distinct", () => {
  const environment = {
    FANMIND_AI_TIER_PLUS_MODEL: "same-private-model",
    FANMIND_AI_TIER_PLUS_FALLBACK_MODEL: "same-private-model",
  };

  const runtime = getAiTierRuntimeReadinessFromEnvironment(
    "plus",
    environment,
  );
  const readiness = evaluateAiTierReadiness("plus", runtime);

  assert.equal(runtime.providerModelConfigured, true);
  assert.equal(runtime.fallbackModelConfigured, true);
  assert.equal(runtime.providerFallbackDistinct, false);
  assert.ok(readiness.blockers.includes("provider_fallback_distinct"));
  assert.doesNotMatch(JSON.stringify(readiness), /same-private-model/u);
});

test("readiness command reports only stable status and blocker codes", () => {
  const fakePlusPrice = "price_plus_DO_NOT_PRINT";
  const fakeUltraPrice = "price_ultra_DO_NOT_PRINT";
  const result = spawnSync(
    process.execPath,
    ["scripts/operations/verify-ai-tier-readiness.mjs"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        STRIPE_PRICE_AI_PLUS: fakePlusPrice,
        STRIPE_PRICE_AI_ULTRA: fakeUltraPrice,
        FANMIND_AI_TIER_WORKSPACE_CONTRACT_CONFIRMED: "true",
        FANMIND_AI_TIER_PLUS_MODEL: "model-plus-private",
        FANMIND_AI_TIER_PLUS_FALLBACK_MODEL:
          "model-plus-fallback-private",
        FANMIND_AI_TIER_ULTRA_MODEL: "model-ultra-private",
        FANMIND_AI_TIER_ULTRA_FALLBACK_MODEL:
          "model-ultra-fallback-private",
      },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /AI_TIER_STANDARD=READY blockers=none/u);
  assert.match(result.stdout, /AI_TIER_PLUS=BLOCKED/u);
  assert.match(result.stdout, /AI_TIER_ULTRA=BLOCKED/u);
  assert.match(result.stdout, /AI_TIER_READINESS=PASS/u);
  assert.doesNotMatch(result.stdout, /DO_NOT_PRINT/u);
  assert.equal(result.stderr, "");
});

test("workspace entitlement defaults to included Standard without stored state", () => {
  assert.deepEqual(resolveWorkspaceAiTierEntitlement(), {
    requestedTierId: null,
    effectiveTierId: "standard",
    entitlementStatus: "included",
    fellBackToStandard: false,
    fallbackReasons: [],
    readinessBlockers: [],
  });

  assert.deepEqual(
    resolveWorkspaceAiTierEntitlement({
      tierId: "standard",
      status: "canceled",
      source: "client",
    }),
    {
      requestedTierId: "standard",
      effectiveTierId: "standard",
      entitlementStatus: "included",
      fellBackToStandard: false,
      fallbackReasons: [],
      readinessBlockers: [],
    },
  );
});

test("workspace entitlement rejects unknown and client-controlled paid tiers", () => {
  const now = new Date("2026-07-26T12:00:00.000Z");
  const unknown = resolveWorkspaceAiTierEntitlement(
    { tierId: "enterprise" },
    {},
    now,
  );
  assert.equal(unknown.effectiveTierId, "standard");
  assert.equal(unknown.fellBackToStandard, true);
  assert.deepEqual(unknown.fallbackReasons, ["unknown_tier"]);

  const clientClaim = resolveWorkspaceAiTierEntitlement(
    {
      tierId: "plus",
      status: "active",
      source: "stripe",
      effectiveAt: "2026-07-01T00:00:00.000Z",
      stripeSubscriptionItemLinked: true,
      serverOwned: false,
    },
    {
      stripePriceConfigured: true,
      workspaceContractConfirmed: true,
    },
    now,
  );
  assert.equal(clientClaim.effectiveTierId, "standard");
  assert.ok(clientClaim.fallbackReasons.includes("server_owned"));
  assert.ok(clientClaim.fallbackReasons.includes("tier_readiness"));
});

test("paid entitlement lifecycle and time boundaries fail closed", () => {
  const runtime = {
    stripePriceConfigured: true,
    workspaceContractConfirmed: true,
  };
  const base = {
    tierId: "ultra",
    status: "active",
    source: "stripe",
    effectiveAt: "2026-07-01T00:00:00.000Z",
    expiresAt: null,
    stripeSubscriptionItemLinked: true,
    serverOwned: true,
  };
  const now = new Date("2026-07-26T12:00:00.000Z");

  for (const [override, reason] of [
    [{ status: "paused" }, "lifecycle_status"],
    [{ source: "manual" }, "source"],
    [{ stripeSubscriptionItemLinked: false }, "stripe_item"],
    [{ effectiveAt: null }, "effective_at"],
    [{ effectiveAt: "2026-08-01T00:00:00.000Z" }, "not_started"],
    [{ expiresAt: "invalid" }, "expires_at"],
    [{ expiresAt: "2026-07-26T12:00:00.000Z" }, "expired"],
  ]) {
    const entitlement = resolveWorkspaceAiTierEntitlement(
      { ...base, ...override },
      runtime,
      now,
    );
    assert.equal(entitlement.effectiveTierId, "standard");
    assert.ok(entitlement.fallbackReasons.includes(reason));
  }
});

test("paid entitlement boundaries require explicit ISO-8601 timezone instants", () => {
  const runtime = {
    stripePriceConfigured: true,
    workspaceContractConfirmed: true,
  };
  const base = {
    tierId: "plus",
    status: "active",
    source: "stripe",
    effectiveAt: "2026-07-01T00:00:00.000Z",
    expiresAt: null,
    stripeSubscriptionItemLinked: true,
    serverOwned: true,
  };
  const now = new Date("2026-07-26T12:00:00.000Z");

  for (const [override, reason] of [
    [{ effectiveAt: "2026-07-01" }, "effective_at"],
    [{ effectiveAt: "2026-07-01T00:00:00" }, "effective_at"],
    [{ expiresAt: "07/31/2026 12:00:00" }, "expires_at"],
  ]) {
    const entitlement = resolveWorkspaceAiTierEntitlement(
      { ...base, ...override },
      runtime,
      now,
    );
    assert.equal(entitlement.effectiveTierId, "standard");
    assert.ok(entitlement.fallbackReasons.includes(reason));
  }

  const explicitOffset = resolveWorkspaceAiTierEntitlement(
    {
      ...base,
      effectiveAt: "2026-07-01T02:00:00+02:00",
      expiresAt: "2026-08-01T02:00:00+02:00",
    },
    runtime,
    now,
  );
  assert.ok(!explicitOffset.fallbackReasons.includes("effective_at"));
  assert.ok(!explicitOffset.fallbackReasons.includes("expires_at"));
});

test("current Plus and Ultra entitlements remain blocked by canonical readiness", () => {
  const environment = {
    STRIPE_PRICE_AI_PLUS: "price_plus_DO_NOT_PRINT",
    STRIPE_PRICE_AI_ULTRA: "price_ultra_DO_NOT_PRINT",
    FANMIND_AI_TIER_WORKSPACE_CONTRACT_CONFIRMED: "true",
  };
  const now = new Date("2026-07-26T12:00:00.000Z");

  for (const tierId of ["plus", "ultra"]) {
    const entitlement = resolveWorkspaceAiTierEntitlement(
      {
        tierId,
        status: "active",
        source: "stripe",
        effectiveAt: "2026-07-01T00:00:00.000Z",
        stripeSubscriptionItemLinked: true,
        serverOwned: true,
      },
      getAiTierRuntimeReadinessFromEnvironment(tierId, environment),
      now,
    );

    assert.equal(entitlement.effectiveTierId, "standard");
    assert.equal(entitlement.fellBackToStandard, true);
    assert.deepEqual(entitlement.fallbackReasons, ["tier_readiness"]);
    assert.ok(entitlement.readinessBlockers.includes("public_status"));
    assert.ok(entitlement.readinessBlockers.includes("billing_status"));
    assert.ok(entitlement.readinessBlockers.includes("booking_flag"));
    assert.ok(entitlement.readinessBlockers.includes("model_class"));
    assert.doesNotMatch(JSON.stringify(entitlement), /DO_NOT_PRINT/u);
  }
});

test("workspace entitlement rejects an invalid evaluation instant", () => {
  assert.throws(
    () =>
      resolveWorkspaceAiTierEntitlement(
        {
          tierId: "plus",
          status: "active",
          source: "stripe",
          effectiveAt: "2026-07-01T00:00:00.000Z",
          stripeSubscriptionItemLinked: true,
          serverOwned: true,
        },
        {},
        "not-a-date",
      ),
    /now must be a valid instant/u,
  );
});

test("decision proposal cannot be mistaken for a paid-tier activation", async () => {
  const [proposal, readiness, truth] = await Promise.all([
    readFile("docs/operations/AI_TIER_DECISION_PROPOSAL.md", "utf8"),
    readFile("docs/operations/AI_TIER_READINESS.md", "utf8"),
    readFile("docs/SOURCE_OF_TRUTH.md", "utf8"),
  ]);

  assert.match(proposal, /keine Freigabe/iu);
  assert.match(proposal, /UNENTSCHIEDEN/u);
  assert.match(proposal, /KI Plus[\s\S]*100 €/u);
  assert.match(proposal, /KI Ultra[\s\S]*200 €/u);
  assert.match(proposal, /keine automatische Sendung/iu);
  assert.match(proposal, /keinen Referral-Rabatt/iu);
  assert.match(proposal, /Stripe-Entitlements[\s\S]*weder aktiviert noch angewendet/iu);
  assert.match(readiness, /AI_TIER_DECISION_PROPOSAL\.md/u);
  assert.match(truth, /AI_TIER_DECISION_PROPOSAL\.md/u);
});
