// FM-DEC-014: the owner approved Daily as the third permanent public offer.
// Catalog visibility is not payment, tax, consent or Workspace authorization.
export const PUBLIC_DAILY_PLAN_ENABLED = true;
export const PUBLIC_DAILY_PLAN_PRICE_CENTS = 100;
export const PUBLIC_DAILY_PLAN_SETUP_FEE_CENTS = 0;

// Presentation only: the stored legacy ID and all authorization/billing
// policies stay unchanged. Never resolve a plan from signup preferences.
export function resolvePublicWorkspacePlanId(workspace) {
  if (workspace?.member_safe_projection === true) return "member";
  if (workspace?.plan_id === "pilot" && workspace?.commercial_option === "internal_daily_test") return "daily";
  return ["pilot", "starter", "growth", "agency"].includes(workspace?.plan_id)
    ? workspace.plan_id
    : "unknown";
}

export function isPublicDailyRegistrationRequest({ planId, testPlan } = {}) {
  return PUBLIC_DAILY_PLAN_ENABLED && (
    planId === "daily" || (planId === "pilot" && testPlan === "daily")
  );
}
