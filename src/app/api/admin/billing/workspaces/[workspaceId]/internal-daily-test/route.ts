import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { startInternalDailyTestCheckout } from "@/lib/adminBilling";
import { isTrustedFanMindMutationRequest } from "@/lib/httpMutationPolicy.mjs";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/billing/workspaces/[workspaceId]/internal-daily-test">) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }
  const admin = await requirePlatformAdmin();
  const { workspaceId } = await ctx.params;
  const result = await startInternalDailyTestCheckout(workspaceId, admin);
  if (result.url) return NextResponse.redirect(result.url, { status: 303 });
  return NextResponse.json({ error: "internal_daily_test_start_failed" }, { status: result.status });
}
