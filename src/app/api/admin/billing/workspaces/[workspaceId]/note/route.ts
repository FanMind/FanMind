import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { updateAdminBillingWorkspace } from "@/lib/adminBilling";
import { redirectAdminHtml } from "@/lib/adminRedirects";
import {
  isTrustedFanMindMutationRequest,
  readBoundedFormDataRequest,
  readBoundedJsonRequest,
} from "@/lib/httpMutationPolicy.mjs";

const MAX_BILLING_NOTE_BODY_BYTES = 6_000;

export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/billing/workspaces/[workspaceId]/note">) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }
  const admin = await requirePlatformAdmin();
  const { workspaceId } = await ctx.params;
  const contentType = request.headers.get("content-type") ?? "";
  const parsedBody = contentType.includes("application/json")
    ? await readBoundedJsonRequest(request, MAX_BILLING_NOTE_BODY_BYTES)
    : await readBoundedFormDataRequest(request, MAX_BILLING_NOTE_BODY_BYTES);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.reason === "payload_too_large" ? "payload_too_large" : "invalid_request" },
      { status: parsedBody.reason === "payload_too_large" ? 413 : 400 },
    );
  }
  const payload = parsedBody.value instanceof FormData
    ? { note: parsedBody.value.get("note")?.toString() }
    : (parsedBody.value as { note?: unknown } | null);
  const result = await updateAdminBillingWorkspace(workspaceId, admin, { billing_admin_note: String(payload?.note ?? "").slice(0, 2000) });
  const htmlRedirect = redirectAdminHtml(request, `/admin/billing/workspaces/${workspaceId}`);
  if (htmlRedirect) return htmlRedirect;
  return NextResponse.json(result.ok ? { ok: true } : { error: "billing_note_update_failed" }, { status: result.status });
}
