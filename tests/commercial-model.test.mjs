import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCommercialMonthlyAmounts,
  connectionPackCount,
  getAgencyCreatorDiscountPercent,
} from "../src/config/commercialModel.mjs";

test("Core includes Standard AI and ten connections", () => {
  const result = calculateCommercialMonthlyAmounts();
  assert.equal(result.coreMonthlyFeeCents, 31_200);
  assert.equal(result.aiAddOnCents, 0);
  assert.equal(result.includedConnections, 10);
  assert.equal(result.connectionAddOnCents, 0);
  assert.equal(result.totalMonthlyCents, 31_200);
});

test("additional connections are billed only in five-account packs", () => {
  assert.equal(connectionPackCount(10), 0);
  assert.equal(connectionPackCount(11), 1);
  assert.equal(connectionPackCount(15), 1);
  assert.equal(connectionPackCount(16), 2);
  assert.equal(
    calculateCommercialMonthlyAmounts({ connectionCount: 16 })
      .connectionAddOnCents,
    9_800,
  );
});

test("Plus and Ultra stay outside the referral discount base", () => {
  const plus = calculateCommercialMonthlyAmounts({
    aiTierId: "plus",
    referralDiscountPercent: 100,
  });
  const ultra = calculateCommercialMonthlyAmounts({
    aiTierId: "ultra",
    connectionCount: 15,
    referralDiscountPercent: 100,
  });
  assert.equal(plus.totalMonthlyCents, 10_000);
  assert.equal(ultra.totalMonthlyCents, 24_900);
});

test("agency creator discounts follow the approved volume tiers", () => {
  assert.deepEqual(
    [1, 4, 5, 9, 10, 19, 20].map(getAgencyCreatorDiscountPercent),
    [0, 0, 5, 5, 10, 10, 15],
  );
});

test("self-paying creators are not billed again through the agency", () => {
  const result = calculateCommercialMonthlyAmounts({
    creatorPaysDirectly: true,
    agencyCreatorCount: 20,
  });
  assert.equal(result.agencyHubCents, 0);
  assert.equal(result.agencyCreatorGrossCents, 0);
  assert.equal(result.agencyCreatorDiscountPercent, 0);
  assert.equal(result.totalMonthlyCents, 31_200);
});

test("agency-paid creators cost one Hub plus volume-priced creator licenses", () => {
  const result = calculateCommercialMonthlyAmounts({ agencyCreatorCount: 5 });
  assert.equal(result.discountedCoreCents, 0);
  assert.equal(result.agencyHubCents, 31_200);
  assert.equal(result.agencyCreatorGrossCents, 156_000);
  assert.equal(result.agencyCreatorDiscountCents, 7_800);
  assert.equal(result.totalMonthlyCents, 179_400);
});

test("referral and agency volume discounts cannot be combined", () => {
  assert.throws(
    () =>
      calculateCommercialMonthlyAmounts({
        referralDiscountPercent: 5,
        agencyCreatorCount: 5,
      }),
    /cannot be combined/u,
  );
  assert.throws(
    () =>
      calculateCommercialMonthlyAmounts({
        referralDiscountPercent: 5,
        agencyCreatorCount: 1,
      }),
    /cannot be combined/u,
  );
});
