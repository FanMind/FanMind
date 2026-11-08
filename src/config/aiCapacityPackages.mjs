// Public package prices; provider accounting and included cost budgets stay separate.
export const AI_CAPACITY_PACKAGE_IDS = Object.freeze(["capacity_99", "capacity_199", "capacity_312"]);
export const AI_CAPACITY_PUBLIC_PACKAGES = Object.freeze({
  capacity_99: Object.freeze({ id: "capacity_99", monthlyPriceCents: 9_900, setupFeeCents: 0 }),
  capacity_199: Object.freeze({ id: "capacity_199", monthlyPriceCents: 19_900, setupFeeCents: 0 }),
  capacity_312: Object.freeze({ id: "capacity_312", monthlyPriceCents: 31_200, setupFeeCents: 0 }),
});
