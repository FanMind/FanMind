import { NextRequest, NextResponse } from "next/server";
import { isDemoWorkspace, isTemporaryDemoUser } from "@/lib/demoMode";
import {
  isTrustedMutationRequest,
  readBoundedJsonRequest,
} from "@/lib/httpMutationPolicy.mjs";
import { PAYMENT_TERMS_ACTIVATION_BLOCK_CODE } from "@/lib/paymentTermsActivationPolicy.mjs";
import { hasCurrentWorkspacePaymentTermsEvidence } from "@/lib/paymentTermsServerEvidence";
import { createStripeCheckoutSession, getStripeConfigStatus, resolveCheckoutPlan } from "@/lib/stripeBilling";
import {
  isStripeBillingWriteFrozen,
  STRIPE_BILLING_WRITE_FREEZE_CODE,
} from "@/lib/stripeBillingWriteFreeze.mjs";
import { isInternalDailyTestStripeReady } from "@/lib/internalDailyTestReadinessPolicy.mjs";
import { getPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";
import { getSupabaseServerUser, getUserWorkspaceDashboard } from "@/lib/supabase/server";

const MAX_CHECKOUT_BODY_BYTES = 4096;

export async function POST(request: NextRequest) {
  if (!isTrustedMutationRequest(request, [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.FANMIND_APP_URL,
  ])) {
    return NextResponse.json(
      { error: "Die Zahlungsanfrage konnte nicht verifiziert werden.", code: "origin_forbidden" },
      { status: 403 },
    );
  }

  if (isStripeBillingWriteFrozen()) {
    return NextResponse.json(
      {
        error: "Zahlungen sind während eines kurzen Wartungsfensters vorübergehend pausiert. Bitte versuche es gleich erneut.",
        code: STRIPE_BILLING_WRITE_FREEZE_CODE,
      },
      { status: 503, headers: { "Retry-After": "60" } },
    );
  }

  const { data } = await getSupabaseServerUser();
  if (!data.user) return NextResponse.json({ error: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an, um die Zahlung fortzusetzen." }, { status: 401 });
  if (isTemporaryDemoUser(data.user)) return NextResponse.json({ error: "Demo-User können keinen Checkout starten." }, { status: 403 });

  const parsedBody = await readBoundedJsonRequest(request, MAX_CHECKOUT_BODY_BYTES);
  if (!parsedBody.ok) {
    const tooLarge = parsedBody.reason === "payload_too_large";
    return NextResponse.json(
      {
        error: tooLarge
          ? "Die Zahlungsanfrage ist zu groß."
          : "Die Zahlungsanfrage ist ungültig.",
        code: tooLarge ? "payload_too_large" : "invalid_request",
      },
      { status: tooLarge ? 413 : 400 },
    );
  }
  const payload = parsedBody.value as { planId?: string; commercialOption?: string } | null;
  if (!payload?.planId || !payload.commercialOption) return NextResponse.json({ error: "Deine Zahlungsoption konnte nicht eindeutig zugeordnet werden. Bitte kontaktiere FanMind." }, { status: 400 });

  if (payload.commercialOption === "internal_daily_test" && !(await getPublicDailyTestPlanEnabled())) {
    return NextResponse.json({ error: "Das interne Live-Testabo kann nur im Adminbereich gestartet werden." }, { status: 403 });
  }

  const config = getStripeConfigStatus();
  const plan = resolveCheckoutPlan(payload.planId, payload.commercialOption);
  const checkoutReady = payload.commercialOption === "internal_daily_test"
    ? isInternalDailyTestStripeReady(config)
    : config.readyForCheckout;
  if (!checkoutReady) return NextResponse.json({ error: "Die Zahlung ist aktuell noch nicht vollständig konfiguriert. Bitte kontaktiere FanMind." }, { status: 503 });

  if (!plan) return NextResponse.json({ error: "Deine Zahlungsoption konnte nicht eindeutig zugeordnet werden. Bitte kontaktiere FanMind." }, { status: 400 });

  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  if (!workspaceResult.workspace) return NextResponse.json({ error: "Workspace konnte nicht geladen werden.", code: "workspace_unavailable" }, { status: 400 });
  if (isDemoWorkspace(workspaceResult.workspace)) return NextResponse.json({ error: "Demo-Workspaces können keinen Checkout starten." }, { status: 403 });
  if (workspaceResult.workspace.plan_id !== plan.planId || workspaceResult.workspace.commercial_option !== plan.commercialOption) {
    return NextResponse.json({ error: "Deine Zahlungsoption konnte nicht eindeutig zugeordnet werden. Bitte kontaktiere FanMind." }, { status: 400 });
  }

  if (!(await hasCurrentWorkspacePaymentTermsEvidence(workspaceResult.workspace.id, data.user.id))) {
    return NextResponse.json(
      {
        error: "Die verbindliche Version der Zahlungsbedingungen ist noch nicht serverseitig bestätigt. Die Zahlung bleibt bis dahin gesperrt.",
        code: PAYMENT_TERMS_ACTIVATION_BLOCK_CODE,
      },
      { status: 409 },
    );
  }

  const session = await createStripeCheckoutSession({ plan, userId: data.user.id, workspaceId: workspaceResult.workspace.id, userEmail: data.user.email });
  if (!session.url) return NextResponse.json({ error: "Die Zahlung konnte nicht gestartet werden. Bitte kontaktiere FanMind.", code: "checkout_unavailable" }, { status: 502 });
  return NextResponse.json({ url: session.url, sessionId: session.id });
}