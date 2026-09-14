import { NextRequest, NextResponse } from "next/server";
import {
  isTrustedFanMindMutationRequest,
  readBoundedJsonRequest,
} from "@/lib/httpMutationPolicy.mjs";
import { getPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";
import { isInternalDailyTestWorkspaceProvisioningReady } from "@/lib/supabase/server";
import { getStripeConfigStatus } from "@/lib/stripeBilling";
import { isInternalDailyTestAdmissionReady, isInternalDailyTestBillingRuntimeReady } from "@/lib/internalDailyTestReadinessPolicy.mjs";

export const dynamic = "force-dynamic";

const MAX_DAILY_TEST_WINDOW_BODY_BYTES = 256;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function jsonNoStore(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function POST(request: NextRequest) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return jsonNoStore({ ok: false, code: "origin_forbidden" }, 403);
  }

  const parsedBody = await readBoundedJsonRequest(
    request,
    MAX_DAILY_TEST_WINDOW_BODY_BYTES,
  );
  if (!parsedBody.ok) {
    return jsonNoStore(
      {
        ok: false,
        code:
          parsedBody.reason === "payload_too_large"
            ? "payload_too_large"
            : "invalid_request",
      },
      parsedBody.reason === "payload_too_large" ? 413 : 400,
    );
  }

  const payload = parsedBody.value;
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    Object.keys(payload).length !== 1 ||
    !("commercialOption" in payload) ||
    payload.commercialOption !== "internal_daily_test"
  ) {
    return jsonNoStore({ ok: false, code: "invalid_request" }, 400);
  }

  const [windowEnabled, provisioningReady] = await Promise.all([
    getPublicDailyTestPlanEnabled(),
    isInternalDailyTestWorkspaceProvisioningReady(),
  ]);
  if (!isInternalDailyTestAdmissionReady({
    windowEnabled,
    workspaceProvisioningReady: provisioningReady,
    billingRuntimeReady: isInternalDailyTestBillingRuntimeReady(),
    stripeConfig: getStripeConfigStatus(),
  })) {
    return jsonNoStore({ ok: false, code: "daily_test_window_closed" }, 409);
  }

  return jsonNoStore({ ok: true }, 200);
}
