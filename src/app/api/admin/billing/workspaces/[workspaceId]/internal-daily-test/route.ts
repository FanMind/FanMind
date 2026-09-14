import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { startInternalDailyTestCheckout } from "@/lib/adminBilling";
import { isTrustedFanMindMutationRequest } from "@/lib/httpMutationPolicy.mjs";
import { getPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";

function closedOfferResponse() {
  return NextResponse.json({ error: "offer_unavailable", message: "Daily ist derzeit ausgeschaltet. Bestehende Abos bleiben unverändert." }, { status: 409 });
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/billing/workspaces/[workspaceId]/internal-daily-test">) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }
  const admin = await requirePlatformAdmin();
  if (!await getPublicDailyTestPlanEnabled()) return closedOfferResponse();
  const { workspaceId } = await ctx.params;
  const result = await startInternalDailyTestCheckout(workspaceId, admin);
  if (result.code === "offer_unavailable") return closedOfferResponse();
  if (result.url) return NextResponse.redirect(result.url, { status: 303 });
  return NextResponse.json({ error: "internal_daily_test_start_failed" }, { status: result.status });
}
