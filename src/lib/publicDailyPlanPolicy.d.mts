export const PUBLIC_DAILY_PLAN_ENABLED: true;
export const PUBLIC_DAILY_PLAN_PRICE_CENTS: 100;
export const PUBLIC_DAILY_PLAN_SETUP_FEE_CENTS: 0;
export function resolvePublicWorkspacePlanId(workspace?: {
  plan_id?: unknown;
  commercial_option?: unknown;
  member_safe_projection?: unknown;
} | null): "daily" | "pilot" | "starter" | "growth" | "agency" | "member" | "unknown";
export function isPublicDailyRegistrationRequest(input?: {
  planId?: unknown;
  testPlan?: unknown;
}): boolean;
