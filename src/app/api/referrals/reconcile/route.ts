import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isPlatformAdminEmail } from "@/lib/admin";
import { isTrustedFanMindMutationRequest } from "@/lib/httpMutationPolicy.mjs";
import { reconcileReferralAutomation } from "@/lib/referralAutomation";
import { getSupabaseServerUser } from "@/lib/supabase/server";

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

async function authorizationMode(
  request: NextRequest,
): Promise<"service" | "admin" | null> {
  const configuredSecret =
    process.env.FANMIND_REFERRAL_RECONCILE_SECRET?.trim() || "";
  const authorization = request.headers.get("authorization") ?? "";
  const providedSecret = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (
    configuredSecret &&
    providedSecret &&
    safeEqual(configuredSecret, providedSecret)
  ) {
    return "service";
  }

  const { data } = await getSupabaseServerUser();
  return isPlatformAdminEmail(data.user?.email) ? "admin" : null;
}

export async function POST(request: NextRequest) {
  const mode = await authorizationMode(request);
  if (!mode) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  if (mode === "admin" && !isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }

  const result = await reconcileReferralAutomation();
  return NextResponse.json({
    checked: result.checked,
    handled: result.handled,
    errors: result.errors.length ? ["referral_reconciliation_failed"] : [],
  }, {
    status: result.errors.length ? 207 : 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}
