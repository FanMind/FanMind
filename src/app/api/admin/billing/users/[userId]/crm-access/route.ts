import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { setAdminRegisteredUserCrmAccess } from "@/lib/adminBilling";
import { getSafeAdminRefererPath, redirectAdminHtml } from "@/lib/adminRedirects";
import {
  isTrustedFanMindMutationRequest,
  readBoundedFormDataRequest,
  readBoundedJsonRequest,
} from "@/lib/httpMutationPolicy.mjs";

const MAX_CRM_ACCESS_BODY_BYTES = 2_000;

async function readPayload(request: NextRequest): Promise<{ mode?: unknown; expiresAt?: unknown }> {
  if (request.headers.get("content-type")?.includes("application/json")) {
    const parsed = await readBoundedJsonRequest(request, MAX_CRM_ACCESS_BODY_BYTES);
    return parsed.ok ? parsed.value as { mode?: unknown; expiresAt?: unknown } : {};
  }
  const parsed = await readBoundedFormDataRequest(request, MAX_CRM_ACCESS_BODY_BYTES);
  if (!parsed.ok) return {};
  const form = parsed.value;
  return {
    mode: form.get("mode"),
    expiresAt: form.get("expires_at"),
  };
}

function withResult(path: string, ok: boolean): string {
  const target = new URL(path, "https://fanmind.invalid");
  target.searchParams.set("crm_access", ok ? "updated" : "failed");
  return `${target.pathname}${target.search}${target.hash}`;
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/billing/users/[userId]/crm-access">) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }
  const admin = await requirePlatformAdmin();
  const { userId } = await ctx.params;
  const result = await setAdminRegisteredUserCrmAccess(userId, admin, await readPayload(request));
  const fallbackPath = "/admin/billing?tab=customers";
  const htmlRedirect = redirectAdminHtml(request, withResult(getSafeAdminRefererPath(request) ?? fallbackPath, result.ok));
  if (htmlRedirect) return htmlRedirect;
  return NextResponse.json(
    result.ok ? { ok: true, workspaceId: result.workspaceId } : { error: result.error ?? "crm_access_update_failed" },
    { status: result.status },
  );
}
