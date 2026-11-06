import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { markWorkspaceAsInternalTestAccess } from "@/lib/adminBilling";
import { redirectAdminHtml } from "@/lib/adminRedirects";
import { isTrustedFanMindMutationRequest } from "@/lib/httpMutationPolicy.mjs";

export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/billing/workspaces/[workspaceId]/internal-test">) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }
  const admin = await requirePlatformAdmin();
  const { workspaceId } = await ctx.params;
  const result = await markWorkspaceAsInternalTestAccess(workspaceId, admin);
  const htmlRedirect = redirectAdminHtml(request, `/admin/billing/workspaces/${workspaceId}`);
  if (htmlRedirect) return htmlRedirect;
  return NextResponse.json(result.ok ? { ok: true } : { error: "internal_test_update_failed" }, { status: result.status });
}
