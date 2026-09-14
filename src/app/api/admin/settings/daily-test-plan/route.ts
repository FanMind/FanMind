import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin";
import { isTrustedFanMindMutationRequest, readBoundedFormDataRequest } from "@/lib/httpMutationPolicy.mjs";
import { setPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";

const MAX_DAILY_TEST_PLAN_BODY_BYTES = 1_000;

export async function POST(request: NextRequest) {
  if (!isTrustedFanMindMutationRequest(request)) return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  const admin = await requirePlatformAdmin();
  const parsed = await readBoundedFormDataRequest(request, MAX_DAILY_TEST_PLAN_BODY_BYTES);
  if (!parsed.ok) return NextResponse.json({ error: parsed.reason === "payload_too_large" ? "payload_too_large" : "invalid_request" }, { status: parsed.reason === "payload_too_large" ? 413 : 400 });
  const values = parsed.value.getAll("enabled");
  if (values.length !== 1 || !["true", "false"].includes(String(values[0]))) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const enabled = values[0] === "true";
  try {
    // Catalog control only. Enabling visibility never bypasses the separate
    // consent, provisioning, Tax, Stripe and Billing readiness checks.
    await setPublicDailyTestPlanEnabled(enabled, admin.id);
  } catch {
    return NextResponse.json({ error: "daily_settings_write_failed" }, { status: 503 });
  }
  revalidatePath("/", "layout");
  const destination = new URL("/admin/settings", request.url);
  destination.searchParams.set("daily_test_plan", enabled ? "enabled" : "disabled");
  return NextResponse.redirect(destination, { status: 303 });
}
