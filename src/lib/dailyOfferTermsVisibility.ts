import "server-only";
import { getPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import { getUserAuthorizedWorkspaceDashboard } from "@/lib/workspaceAuthorization";

export async function showDailyOfferTerms(): Promise<boolean> {
  if (await getPublicDailyTestPlanEnabled()) return true;
  const { data } = await getSupabaseServerUser();
  if (!data.user) return false;
  const result = await getUserAuthorizedWorkspaceDashboard(data.user);
  return !result.error && result.workspace?.commercial_option === "internal_daily_test";
}
