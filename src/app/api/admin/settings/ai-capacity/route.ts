import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { parseEurBudgetToMicrocents, updateAiCapacityAdminPolicy } from "@/lib/aiCapacityAdmin";
import { isTrustedFanMindMutationRequest, readBoundedFormDataRequest } from "@/lib/httpMutationPolicy.mjs";

const MAX_AI_CAPACITY_ADMIN_BODY_BYTES = 8000;

function checked(form: FormData, name: string): boolean {
  return form.get(name) === "on";
}

export async function POST(request: NextRequest) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }
  const admin = await requirePlatformAdmin();
  const parsed = await readBoundedFormDataRequest(request, MAX_AI_CAPACITY_ADMIN_BODY_BYTES);
  if (!parsed.ok) {
    return NextResponse.json({ error: "invalid_request" }, { status: parsed.reason === "payload_too_large" ? 413 : 400 });
  }

  const form = parsed.value;
  const revision = Number.parseInt(String(form.get("revision") ?? ""), 10);
  const budget99 = parseEurBudgetToMicrocents(form.get("budget_99_eur"));
  const budget199 = parseEurBudgetToMicrocents(form.get("budget_199_eur"));
  const budget312 = parseEurBudgetToMicrocents(form.get("budget_312_eur"));

  if (!Number.isSafeInteger(revision) || revision < 1 || [budget99, budget199, budget312].includes(undefined)) {
    const destination = new URL("/admin/settings?ai_capacity=invalid", request.url);
    return NextResponse.redirect(destination, { status: 303 });
  }

  const result = await updateAiCapacityAdminPolicy(admin, revision, {
    globalCapacityEnabled: checked(form, "global_capacity_enabled"),
    emergencySpendFreeze: checked(form, "emergency_spend_freeze"),
    topUpSalesEnabled: checked(form, "top_up_sales_enabled"),
    packageSalesEnabled: {
      capacity_99: checked(form, "package_99_sales_enabled"),
      capacity_199: checked(form, "package_199_sales_enabled"),
      capacity_312: checked(form, "package_312_sales_enabled"),
    },
    qualityModeEnabled: {
      fast: checked(form, "fast_enabled"),
      balanced: checked(form, "balanced_enabled"),
      premium: checked(form, "premium_enabled"),
    },
    includedBudgetEurMicrocents: {
      capacity_99: budget99 as number | null,
      capacity_199: budget199 as number | null,
      capacity_312: budget312 as number | null,
    },
  });

  const code = result.ok
    ? "updated"
    : result.error === "revision_conflict"
      ? "conflict"
      : result.error === "schema_not_installed"
        ? "not_ready"
        : result.error === "invalid_policy"
          ? "invalid"
          : "failed";
  return NextResponse.redirect(new URL("/admin/settings?ai_capacity=" + code, request.url), { status: 303 });
}
