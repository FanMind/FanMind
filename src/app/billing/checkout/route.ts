import { NextResponse } from "next/server";
import { shouldShowBillingCheckoutAction, isWorkspaceBillingSuspended } from "@/lib/billing";
import { isPlatformAdminEmail } from "@/lib/admin";
import { isAdminCrmAccessWorkspace } from "@/lib/adminCrmAccessPolicy.mjs";
import { isDemoWorkspace, isTemporaryDemoUser } from "@/lib/demoMode";
import { PAYMENT_TERMS_ACTIVATION_BLOCK_CODE } from "@/lib/paymentTermsActivationPolicy.mjs";
import { hasCurrentWorkspacePaymentTermsEvidence } from "@/lib/paymentTermsServerEvidence";
import { isTrustedFanMindMutationRequest } from "@/lib/httpMutationPolicy.mjs";
import { getPreActivationRedirect } from "@/lib/preActivation";
import { createStripeCheckoutSession, getAppUrl, getStripeConfigStatus, resolveWorkspaceCheckoutPlan } from "@/lib/stripeBilling";
import { isInternalDailyTestBillingRuntimeReady, isInternalDailyTestStripeReady } from "@/lib/internalDailyTestReadinessPolicy.mjs";
import { getPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";
import { STRIPE_BILLING_WRITE_FREEZE_CODE } from "@/lib/stripeBillingWriteFreeze.mjs";
import { getSupabaseServerUser, getUserWorkspaceDashboard } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FANMIND_PUBLIC_APP_URL = "https://fanmind.ch";

function getPublicAppUrl() {
  const configuredAppUrl = getAppUrl() || FANMIND_PUBLIC_APP_URL;

  try {
    const url = new URL(configuredAppUrl);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return FANMIND_PUBLIC_APP_URL;
    return url.origin;
  } catch {
    return FANMIND_PUBLIC_APP_URL;
  }
}

function getInternalRedirectUrl(path: string) {
  return new URL(path, getPublicAppUrl());
}

function redirectTo(path: string) {
  return NextResponse.redirect(getInternalRedirectUrl(path), { status: 303 });
}

async function startCheckout(request: Request, method: "GET" | "POST") {
  const { data } = await getSupabaseServerUser();
  if (!data.user) return redirectTo("/login?returnTo=/billing/start");
  if (isPlatformAdminEmail(data.user.email)) return redirectTo("/dashboard");
  if (isTemporaryDemoUser(data.user)) return redirectTo("/dashboard");

  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  if (workspaceResult.error?.message === "TEMPORARY_DEMO_DELETED") return redirectTo("/login?demo_deleted=1");

  const workspace = workspaceResult.workspace;
  if (!workspace) return redirectTo("/workspace/setup");

  const redirectTarget = getPreActivationRedirect(workspace, data.user.email);
  if (isAdminCrmAccessWorkspace(workspace)) {
    return redirectTo(redirectTarget ?? "/dashboard");
  }
  if (workspace.billing_status === "active" || redirectTarget === "/dashboard") return redirectTo("/dashboard");
  if (redirectTarget === "/billing/pending") return redirectTo("/billing/pending");
  if (isWorkspaceBillingSuspended(workspace) || redirectTarget === "/billing/suspended") return redirectTo("/billing/suspended");
  if (redirectTarget === "/workspace/setup") return redirectTo("/workspace/setup");

  const isDemo = isDemoWorkspace(workspace);
  if (isDemo) return redirectTo("/dashboard");

  if (!(await hasCurrentWorkspacePaymentTermsEvidence(workspace.id, data.user.id))) {
    return redirectTo(
      `/billing/start?error=${encodeURIComponent(PAYMENT_TERMS_ACTIVATION_BLOCK_CODE)}`,
    );
  }

  const plan = await resolveWorkspaceCheckoutPlan(workspace, data.user.id);
  if (!plan) return redirectTo("/billing/start?error=payment-option");
  if (plan.billingContract === "capacity_v2") {
    if (method !== "POST" || !isTrustedFanMindMutationRequest(request)) return redirectTo("/billing/start");
  } else if (!shouldShowBillingCheckoutAction(workspace)) {
    return redirectTo("/billing/start");
  }

  if (
    workspace.commercial_option === "internal_daily_test" &&
    (!(await getPublicDailyTestPlanEnabled()) || !isInternalDailyTestBillingRuntimeReady())
  ) return redirectTo("/billing/start?error=payment-start");

  const config = getStripeConfigStatus();
  const checkoutReady = workspace.commercial_option === "internal_daily_test"
    ? isInternalDailyTestStripeReady(config)
    : plan.billingContract === "capacity_v2"
      ? config.readyForWebhook && config.readyForTax && config.hasAppUrl
      : config.readyForCheckout;
  if (!checkoutReady) return redirectTo("/billing/start?error=payment-start");

  const session = await createStripeCheckoutSession({ plan, userId: data.user.id, workspaceId: workspace.id, userEmail: data.user.email });
  if (session.code === STRIPE_BILLING_WRITE_FREEZE_CODE) {
    return redirectTo(`/billing/start?error=${STRIPE_BILLING_WRITE_FREEZE_CODE}`);
  }
  if (!session.url) return redirectTo("/billing/start?error=payment-start");

  return NextResponse.redirect(session.url, { status: 303 });
}

export async function GET(request: Request) {
  return startCheckout(request, "GET");
}

export async function POST(request: Request) {
  return startCheckout(request, "POST");
}
