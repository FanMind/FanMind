export const PUBLIC_DAILY_PLAN_PRICE_CENTS: 100;
export const PUBLIC_DAILY_PLAN_SETUP_FEE_CENTS: 0;
export function isPublicDailyRegistrationRequest(input?: {
  enabled?: boolean;
  planId?: unknown;
  testPlan?: unknown;
}): boolean;
export function resolvePublicWorkspacePlanId(workspace?: {
  plan_id?: unknown;
  commercial_option?: unknown;
  member_safe_projection?: unknown;
} | null): "daily" | "pilot" | "starter" | "growth" | "agency" | "member" | "unknown";
