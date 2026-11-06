import assert from "node:assert/strict";
import test from "node:test";

import "./commercial-model.test.mjs";

import {
  REFERRAL_DISCOUNT_STEP_PERCENT,
  REFERRAL_GROWTH_WINDOW_CAP,
  REFERRAL_MAX_ACTIVE_COUNT,
  calculateReferralMonthlyAmounts,
  calculateReferralPercent,
  evaluateReferralWorkspaceEligibility,
  isReferralGrowthWindowOpen,
} from "../src/lib/referralPolicy.mjs";
import { referralCouponMatchesContract } from "../src/lib/referralStripeCouponPolicy.mjs";

test("referral constants match the approved 5/20/2000 policy", () => {
  assert.equal(REFERRAL_DISCOUNT_STEP_PERCENT, 5);
  assert.equal(REFERRAL_MAX_ACTIVE_COUNT, 20);
  assert.equal(REFERRAL_GROWTH_WINDOW_CAP, 2000);
});

test("referral percentage is clamped between zero and 100 percent", () => {
  assert.deepEqual(calculateReferralPercent(-3), {
    activeReferralCount: 0,
    billableActiveReferralCount: 0,
    discountPercent: 0,
  });
  assert.equal(calculateReferralPercent(0).discountPercent, 0);
  assert.equal(calculateReferralPercent(1).discountPercent, 5);
  assert.equal(calculateReferralPercent(19).discountPercent, 95);
  assert.equal(calculateReferralPercent(20).discountPercent, 100);
  assert.equal(calculateReferralPercent(21).discountPercent, 100);
  assert.equal(calculateReferralPercent(200).billableActiveReferralCount, 20);
  assert.equal(calculateReferralPercent(3, -10).discountPercent, 0);
  assert.equal(calculateReferralPercent(3, 101).discountPercent, 100);
  assert.equal(calculateReferralPercent(3, 47.6).discountPercent, 48);
});

test("monthly referral amounts never become negative and do not include setup fees", () => {
  assert.deepEqual(calculateReferralMonthlyAmounts(31_200, 1), {
    activeReferralCount: 1,
    billableActiveReferralCount: 1,
    discountPercent: 5,
    monthlyFeeCentsBeforeDiscount: 31_200,
    monthlyDiscountCents: 1_560,
    monthlyFeeCentsAfterDiscount: 29_640,
  });

  const freeMonth = calculateReferralMonthlyAmounts(31_200, 20);
  assert.equal(freeMonth.monthlyDiscountCents, 31_200);
  assert.equal(freeMonth.monthlyFeeCentsAfterDiscount, 0);

  const invalidFee = calculateReferralMonthlyAmounts(-1, 20);
  assert.equal(invalidFee.monthlyFeeCentsBeforeDiscount, 0);
  assert.equal(invalidFee.monthlyDiscountCents, 0);
  assert.equal(invalidFee.monthlyFeeCentsAfterDiscount, 0);

  assert.equal(
    Object.hasOwn(freeMonth, "setupFeeCents"),
    false,
    "Setup fees must stay outside the recurring referral calculation.",
  );
});

test("Stripe referral coupons are valid only for the Starter Core product", () => {
  const valid = {
    valid: true,
    duration: "forever",
    percent_off: 5,
    applies_to: { products: ["prod_starter_core"] },
  };
  assert.equal(
    referralCouponMatchesContract(valid, 5, "prod_starter_core"),
    true,
  );
  assert.equal(
    referralCouponMatchesContract(
      { ...valid, applies_to: { products: [] } },
      5,
      "prod_starter_core",
    ),
    false,
  );
  assert.equal(
    referralCouponMatchesContract(
      { ...valid, applies_to: { products: ["prod_starter_core", "prod_ai_plus"] } },
      5,
      "prod_starter_core",
    ),
    false,
  );
  assert.equal(
    referralCouponMatchesContract(valid, 10, "prod_starter_core"),
    false,
  );
});

test("growth window closes at 2000 active paid workspaces", () => {
  assert.equal(isReferralGrowthWindowOpen("open", 1_999), true);
  assert.equal(isReferralGrowthWindowOpen("reopened", 1_999), true);
  assert.equal(isReferralGrowthWindowOpen("open", 2_000), false);
  assert.equal(isReferralGrowthWindowOpen("open", 2_001), false);
  assert.equal(isReferralGrowthWindowOpen("closing", 100), false);
  assert.equal(isReferralGrowthWindowOpen("closed", 0), false);
});

test("only active paid, non-demo workspaces are referral eligible", () => {
  const activePaid = evaluateReferralWorkspaceEligibility({
    billing_status: "active",
    commercial_option: "starter_paid_setup",
    setup_fee_cents: 99_000,
    monthly_fee_cents: 31_200,
    name: "Mia Active Club",
  });
  assert.deepEqual(activePaid, { eligible: true, reason: null });

  const demo = evaluateReferralWorkspaceEligibility({
    billing_status: "demo_free",
    commercial_option: "starter_paid_setup",
    setup_fee_cents: 99_000,
    monthly_fee_cents: 31_200,
    name: "FanMind Demo Workspace",
  });
  assert.equal(demo.eligible, false);

  const internalTest = evaluateReferralWorkspaceEligibility({
    billing_status: "active",
    commercial_option: "internal_daily_test",
    setup_fee_cents: 0,
    monthly_fee_cents: 100,
    name: "Internal QA",
  });
  assert.equal(internalTest.eligible, false);

  const pastDue = evaluateReferralWorkspaceEligibility({
    billing_status: "past_due",
    commercial_option: "starter_paid_setup",
    setup_fee_cents: 99_000,
    monthly_fee_cents: 31_200,
    name: "Late Payer",
  });
  assert.equal(pastDue.eligible, false);

  const cancelled = evaluateReferralWorkspaceEligibility({
    billing_status: "cancelled",
    commercial_option: "starter_paid_setup",
    setup_fee_cents: 99_000,
    monthly_fee_cents: 31_200,
    name: "Cancelled Workspace",
  });
  assert.equal(cancelled.eligible, false);

  const freeWorkspace = evaluateReferralWorkspaceEligibility({
    billing_status: "active",
    commercial_option: "starter_paid_setup",
    setup_fee_cents: 0,
    monthly_fee_cents: 0,
    name: "Free Workspace",
  });
  assert.equal(freeWorkspace.eligible, false);
});
