import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { updatePilotInquiryStatus } from "@/lib/inquiries";
import { getSafeAdminRedirectUrl } from "@/lib/adminRedirects";
import {
  isTrustedFanMindMutationRequest,
  readBoundedFormDataRequest,
} from "@/lib/httpMutationPolicy.mjs";

const MAX_INQUIRY_STATUS_BODY_BYTES = 1_000;

export async function POST(request: NextRequest, context: { params: Promise<{ inquiryId: string }> }) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }
  const admin = await requirePlatformAdmin();
  const parsedBody = await readBoundedFormDataRequest(
    request,
    MAX_INQUIRY_STATUS_BODY_BYTES,
  );
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.reason === "payload_too_large" ? "payload_too_large" : "invalid_request" },
      { status: parsedBody.reason === "payload_too_large" ? 413 : 400 },
    );
  }
  const formData = parsedBody.value;
  const status = String(formData?.get("status") ?? "");
  const { inquiryId } = await context.params;
  const result = await updatePilotInquiryStatus(inquiryId, status, admin);
  if (!result.ok) return NextResponse.json({ error: "inquiry_status_update_failed" }, { status: result.statusCode });
  return NextResponse.redirect(getSafeAdminRedirectUrl(request, "/admin/inquiries"), { status: 303 });
}
