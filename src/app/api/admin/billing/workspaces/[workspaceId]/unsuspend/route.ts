import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { updateAdminBillingWorkspace } from "@/lib/adminBilling";
import { redirectAdminHtml } from "@/lib/adminRedirects";
import { isTrustedFanMindMutationRequest } from "@/lib/httpMutationPolicy.mjs";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/billing/workspaces/[workspaceId]/unsuspend">) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }
  const admin = await requirePlatformAdmin();
  const { workspaceId } = await ctx.params;
  const result = await updateAdminBillingWorkspace(workspaceId, admin, { billing_status: "active", billing_suspended_at: null, billing_suspended_reason: null, billing_manual_override: false });
  const htmlRedirect = redirectAdminHtml(request, `/admin/billing/workspaces/${workspaceId}`);
  if (htmlRedirect) return htmlRedirect;
  return NextResponse.json(result.ok ? { ok: true } : { error: "billing_unsuspend_failed" }, { status: result.status });
}
