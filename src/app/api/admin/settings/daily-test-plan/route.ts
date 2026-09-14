import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import {
  isTrustedFanMindMutationRequest,
  readBoundedFormDataRequest,
} from "@/lib/httpMutationPolicy.mjs";
import { setPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";
import { isInternalDailyTestWorkspaceProvisioningReady } from "@/lib/supabase/server";
import { getStripeConfigStatus } from "@/lib/stripeBilling";
import { isInternalDailyTestStripeReady } from "@/lib/internalDailyTestReadinessPolicy.mjs";

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
  const enabled = formData.get("enabled") === "true";

  if (
    enabled &&
    (
      !(await isInternalDailyTestWorkspaceProvisioningReady()) ||
      !isInternalDailyTestStripeReady(getStripeConfigStatus())
    )
  ) {
    const destination = new URL("/admin/settings", request.url);
    destination.searchParams.set("daily_test_plan", "not_ready");
    return NextResponse.redirect(destination, { status: 303 });
  }

  await setPublicDailyTestPlanEnabled(enabled, admin.email ?? admin.id);

  const destination = new URL("/admin/settings", request.url);
  destination.searchParams.set("daily_test_plan", enabled ? "enabled" : "disabled");
  return NextResponse.redirect(destination, { status: 303 });
}
