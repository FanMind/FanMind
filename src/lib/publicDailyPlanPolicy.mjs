// FM-DEC-014: the owner approved Daily as the third permanent public offer.
// Catalog visibility is not payment, tax, consent or Workspace authorization.
export const PUBLIC_DAILY_PLAN_ENABLED = true;
export const PUBLIC_DAILY_PLAN_PRICE_CENTS = 100;
export const PUBLIC_DAILY_PLAN_SETUP_FEE_CENTS = 0;

export function isPublicDailyRegistrationRequest({ planId, testPlan } = {}) {
  return PUBLIC_DAILY_PLAN_ENABLED && (
    planId === "daily" || (planId === "pilot" && testPlan === "daily")
  );
}
