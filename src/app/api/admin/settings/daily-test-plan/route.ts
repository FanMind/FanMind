import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin";
import {
  isTrustedFanMindMutationRequest,
  readBoundedFormDataRequest,
} from "@/lib/httpMutationPolicy.mjs";
import { setPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";

const MAX_DAILY_TEST_PLAN_BODY_BYTES = 1_000;

export async function POST(request: NextRequest) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }
  const admin = await requirePlatformAdmin();
  const parsedBody = await readBoundedFormDataRequest(
    request,
    MAX_DAILY_TEST_PLAN_BODY_BYTES,
  );
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.reason === "payload_too_large" ? "payload_too_large" : "invalid_request" },
      { status: parsedBody.reason === "payload_too_large" ? 413 : 400 },
    );
  }
  const formData = parsedBody.value;
  const values = formData.getAll("enabled");
  if (values.length !== 1 || !["true", "false"].includes(String(values[0])) ||
      [...formData.keys()].some(key => key !== "enabled")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const enabled = values[0] === "true";
  // Catalog visibility is independent of paid-activation readiness. Turning
  // OFF must always be possible; turning ON never skips billing/schema checks.
  try {
    await setPublicDailyTestPlanEnabled(enabled, admin.email ?? admin.id);
  } catch {
    return NextResponse.json({ error: "settings_not_saved" }, { status: 503 });
  }
  revalidatePath("/", "layout");

  const destination = new URL("/admin/settings", request.url);
  destination.searchParams.set("daily_test_plan", enabled ? "enabled" : "disabled");
  return NextResponse.redirect(destination, { status: 303 });
}
