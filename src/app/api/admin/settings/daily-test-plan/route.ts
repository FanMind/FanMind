import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import {
  isTrustedFanMindMutationRequest,
  readBoundedFormDataRequest,
} from "@/lib/httpMutationPolicy.mjs";
import { setPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";
import { isInternalDailyTestWorkspaceProvisioningReady } from "@/lib/supabase/server";
import { expireOpenInternalDailyTestCheckoutSessions, getStripeConfigStatus } from "@/lib/stripeBilling";
import { isInternalDailyTestBillingRuntimeReady, isInternalDailyTestStripeReady } from "@/lib/internalDailyTestReadinessPolicy.mjs";
import { isPaymentTermsActivationEnabled } from "@/lib/paymentTermsActivationPolicy.mjs";

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
      !isInternalDailyTestStripeReady(getStripeConfigStatus()) ||
      !isInternalDailyTestBillingRuntimeReady() ||
      !isPaymentTermsActivationEnabled()
    )
  ) {
    const destination = new URL("/admin/settings", request.url);
    destination.searchParams.set("daily_test_plan", "not_ready");
    return NextResponse.redirect(destination, { status: 303 });
  }

  try {
    await setPublicDailyTestPlanEnabled(enabled, admin.email ?? admin.id);
  } catch {
    const destination = new URL("/admin/settings", request.url);
    destination.searchParams.set("daily_test_plan", "busy");
    return NextResponse.redirect(destination, { status: 303 });
  }

  if (!enabled && !(await expireOpenInternalDailyTestCheckoutSessions())) {
    const destination = new URL("/admin/settings", request.url);
    destination.searchParams.set("daily_test_plan", "disabled_cleanup_required");
    return NextResponse.redirect(destination, { status: 303 });
  }

  const destination = new URL("/admin/settings", request.url);
  destination.searchParams.set("daily_test_plan", enabled ? "enabled" : "disabled");
  return NextResponse.redirect(destination, { status: 303 });
}
