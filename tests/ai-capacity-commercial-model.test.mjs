import assert from "node:assert/strict";
import test from "node:test";
import {
  FANMIND_AI_CAPACITY_POLICY,
  FANMIND_AI_QUALITY_MODES,
  FANMIND_BASE_PACKAGES,
  assertFanMindAiCapacityCommercialModel,
} from "../src/config/aiCapacityPlans.mjs";

test("commercial model is 99/199/312 with unresolved included AI budgets", () => {
  assert.equal(assertFanMindAiCapacityCommercialModel(), true);
  assert.deepEqual(
    Object.values(FANMIND_BASE_PACKAGES).map((plan) => plan.monthlyPriceCents),
    [9900, 19900, 31200],
  );
  assert.ok(Object.values(FANMIND_BASE_PACKAGES).every((plan) => plan.monthlyAiBudgetMicros === null));
});

test("AI capacity policy replaces Plus/Ultra without activating billing", () => {
  assert.equal(FANMIND_AI_CAPACITY_POLICY.legacyPlusUltraProductModelActive, false);
  assert.equal(FANMIND_AI_CAPACITY_POLICY.productionActivationAllowed, false);
  assert.deepEqual(FANMIND_AI_CAPACITY_POLICY.consumptionOrder, ["included_monthly_budget", "purchased_topup"]);
  assert.equal(FANMIND_AI_CAPACITY_POLICY.includedBudgetCarryOver, false);
  assert.equal(FANMIND_AI_CAPACITY_POLICY.topupTargetGrossMarginRatio, 0.33);
  assert.equal(FANMIND_AI_CAPACITY_POLICY.purchasedTopupValidityDays, null);
  assert.deepEqual(Object.keys(FANMIND_AI_QUALITY_MODES), ["fast", "balanced", "premium"]);
});
