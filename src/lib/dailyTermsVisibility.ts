import "server-only";
import { getPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import { getUserAuthorizedWorkspaceDashboard } from "@/lib/workspaceAuthorization";

export async function showDailyTerms(): Promise<boolean> {
  if (await getPublicDailyTestPlanEnabled()) return true;
  try {
    const { data } = await getSupabaseServerUser();
    if (!data.user) return false;
    const result = await getUserAuthorizedWorkspaceDashboard(data.user);
    return result.workspace?.commercial_option === "internal_daily_test";
  } catch { return false; }
}
