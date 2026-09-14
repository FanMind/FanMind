// Daily retains its legacy storage identity, but new admission is controlled
// exclusively by the server-owned beta switch. Catalog visibility is never
// payment, tax, consent or Workspace authorization.
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

export function isPublicDailyRegistrationRequest({ enabled, planId, testPlan } = {}) {
  return enabled === true && (
    planId === "daily" || (planId === "pilot" && testPlan === "daily")
  );
}
