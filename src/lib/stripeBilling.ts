import {
  getSupabaseApiKeyHeaders,
  getSupabaseAuthUrl,
  getSupabaseRestUrl,
} from "@/lib/supabase/config";
import type { PlanId } from "@/config/plans";
import type Stripe from "stripe";
import {
  createStripeIntegrationIdentifier,
  getStripeClient,
} from "@/lib/stripeClient";
import {
  isMissingWorkspaceExpandColumn,
  withoutWorkspaceExpandColumns,
} from "@/lib/workspaceProvisioning";
import {
  STRIPE_BILLING_ALLOWED,
  STRIPE_BILLING_BLOCKED,
  STRIPE_BILLING_RETRYABLE_ERROR,
  STRIPE_BILLING_UPDATED,
  STRIPE_BILLING_ZERO_ROWS,
  stripeBillingManualSuspensionDecision,
  stripeBillingPatchDecision,
  stripeSubscriptionWorkspaceBindingDecision,
  stripeBillingWorkspaceDecision,
  type StripeBillingUpdateDecision,
  type StripeBillingWorkspaceDecision,
} from "@/lib/stripeWorkspacePolicy.mjs";
import { evaluateStripeTaxConfiguration } from "@/lib/stripeTaxPolicy.mjs";
import { verifyStripeWebhookSignature } from "@/lib/stripeWebhookSignaturePolicy.mjs";

export type CheckoutCommercialOption =
  | "pilot_only"
  | "starter_paid_setup"
  | "starter_no_setup_commitment"
  | "internal_daily_test";

export type TaxMode = "unconfigured" | "stripe_tax";

export const STRIPE_TAX_INVOICE_NOTE =
  "Nettopreise. Die anwendbare Umsatzsteuer oder Reverse-Charge-Behandlung wird anhand der Rechnungsadresse und des steuerlichen Kundenstatus ermittelt.";

export type StripeConfigStatus = {
  taxMode: TaxMode;
  stripeTaxEnabled: boolean;
  taxRegistrationConfirmed: boolean;
  readyForTax: boolean;
  taxModeLabel: string;
  invoiceNote: string | null;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  hasPilotPrice: boolean;
  hasStarterSetupPrice: boolean;
  hasStarterMonthlyPrice: boolean;
  hasGrowthMonthlyPrice: boolean;
  hasAgencyMonthlyPrice: boolean;
  hasInternalDailyTestPrice: boolean;
  growthAgencyBillingEnabled: boolean;
  hasAppUrl: boolean;
  readyForCheckout: boolean;
  readyForWebhook: boolean;
};

export type CheckoutPlan = {
  planId: Extract<PlanId, "pilot" | "starter">;
  commercialOption: CheckoutCommercialOption;
  mode: "payment" | "subscription";
  priceIds: string[];
  setupFeeCents: number;
  monthlyFeeCents: number;
  commitmentMonths: 0 | 12;
  paymentCollectionMethod: "sepa_direct_debit" | "card";
};

export type StripeWorkspaceReferences = {
  customerId?: string;
  subscriptionId?: string;
  paymentIntentId?: string;
};

export type StripeWorkspaceResolution =
  | { status: "found"; workspaceId: string }
  | { status: "not_found" }
  | { status: "retryable_error" };

export function getTaxMode(): TaxMode {
  return evaluateStripeTaxConfiguration().taxMode;
}

export function getTaxModeLabel(mode: TaxMode = getTaxMode()): string {
  return mode === "stripe_tax"
    ? "Stripe Tax · Nettopreise"
    : "Steuerkonfiguration nicht freigegeben";
}

export function getStripeConfigStatus(): StripeConfigStatus {
  const tax = evaluateStripeTaxConfiguration();
  const taxMode = tax.taxMode;
  const hasSecretKey = Boolean(process.env.STRIPE_SECRET_KEY);
  const hasWebhookSecret = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  const hasPilotPrice = Boolean(process.env.STRIPE_PRICE_PILOT_SETUP);
  const hasStarterSetupPrice = Boolean(process.env.STRIPE_PRICE_STARTER_SETUP);
  const hasStarterMonthlyPrice = Boolean(process.env.STRIPE_PRICE_STARTER_MONTHLY);
  const hasGrowthMonthlyPrice = Boolean(process.env.STRIPE_PRICE_GROWTH_MONTHLY);
  const hasAgencyMonthlyPrice = Boolean(process.env.STRIPE_PRICE_AGENCY_MONTHLY);
  const hasInternalDailyTestPrice = Boolean(
    process.env.STRIPE_PRICE_INTERNAL_DAILY_TEST,
  );
  const growthAgencyBillingEnabled =
    process.env.FANMIND_ENABLE_GROWTH_AGENCY_BILLING === "true";
  const hasAppUrl = Boolean(getAppUrl());

  return {
    taxMode,
    stripeTaxEnabled: tax.stripeTaxEnabled,
    taxRegistrationConfirmed: tax.taxRegistrationConfirmed,
    readyForTax: tax.ready,
    taxModeLabel: getTaxModeLabel(taxMode),
    invoiceNote: tax.ready ? STRIPE_TAX_INVOICE_NOTE : null,
    hasSecretKey,
    hasWebhookSecret,
    hasPilotPrice,
    hasStarterSetupPrice,
    hasStarterMonthlyPrice,
    hasGrowthMonthlyPrice,
    hasAgencyMonthlyPrice,
    hasInternalDailyTestPrice,
    growthAgencyBillingEnabled,
    hasAppUrl,
    // Das frühere Pilot-/Setup-Produkt ist nicht mehr Teil der öffentlichen
    // Checkout-Bereitschaft. Aktiv sind nur die beiden Starter-Varianten.
    readyForCheckout:
      hasSecretKey &&
      hasWebhookSecret &&
      hasAppUrl &&
      hasStarterSetupPrice &&
      hasStarterMonthlyPrice &&
      tax.ready,
    readyForWebhook: hasSecretKey && hasWebhookSecret,
  };
}

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ""
  ).replace(/\/$/, "");
}

export function resolveCheckoutPlan(
  planId: unknown,
  commercialOption: unknown,
): CheckoutPlan | null {
  // Legacy-Workspaces mit dem früheren entgeltlichen Pilot-Paket dürfen keinen
  // neuen Checkout mehr erhalten. Kostenlose Demo und interne Tests bleiben getrennt.
  if (planId === "pilot" && commercialOption === "pilot_only") return null;

  if (planId === "starter" && commercialOption === "starter_paid_setup") {
    const setupPrice = process.env.STRIPE_PRICE_STARTER_SETUP;
    const monthlyPrice = process.env.STRIPE_PRICE_STARTER_MONTHLY;
    return setupPrice && monthlyPrice
      ? {
          planId,
          commercialOption,
          mode: "subscription",
          priceIds: [setupPrice, monthlyPrice],
          setupFeeCents: 99000,
          monthlyFeeCents: 31200,
          commitmentMonths: 0,
          paymentCollectionMethod: "card",
        }
      : null;
  }

  if (
    planId === "starter" &&
    commercialOption === "starter_no_setup_commitment"
  ) {
    const monthlyPrice = process.env.STRIPE_PRICE_STARTER_MONTHLY;
    return monthlyPrice
      ? {
          planId,
          commercialOption,
          mode: "subscription",
          priceIds: [monthlyPrice],
          setupFeeCents: 0,
          monthlyFeeCents: 31200,
          commitmentMonths: 12,
          paymentCollectionMethod: "card",
        }
      : null;
  }

  if (commercialOption === "internal_daily_test") {
    const dailyPrice = process.env.STRIPE_PRICE_INTERNAL_DAILY_TEST;
    return dailyPrice
      ? {
          planId: "pilot",
          commercialOption,
          mode: "subscription",
          priceIds: [dailyPrice],
          setupFeeCents: 0,
          monthlyFeeCents: 0,
          commitmentMonths: 0,
          paymentCollectionMethod: "card",
        }
      : null;
  }

  return null;
}

export async function createStripeCheckoutSession(input: {
  plan: CheckoutPlan;
  userId: string;
  workspaceId: string;
  userEmail?: string;
}): Promise<{ url?: string; id?: string; error?: string }> {
  const stripe = getStripeClient();
  const appUrl = getAppUrl();
  const stripeConfig = getStripeConfigStatus();
  if (
    !stripe ||
    !appUrl ||
    !stripeConfig.readyForWebhook ||
    !stripeConfig.readyForTax
  ) {
    return {
      error:
        "Zahlung ist noch nicht aktiv konfiguriert. Bitte FanMind kontaktieren.",
    };
  }

  const metadata = {
    user_id: input.userId,
    workspace_id: input.workspaceId,
    plan_id: input.plan.planId,
    commercial_option: input.plan.commercialOption,
    setup_fee_cents: String(input.plan.setupFeeCents),
    monthly_fee_cents: String(input.plan.monthlyFeeCents),
    commitment_months: String(input.plan.commitmentMonths),
    internal_live_test:
      input.plan.commercialOption === "internal_daily_test" ? "true" : "false",
  };
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: input.plan.mode,
    success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/billing/cancel`,
    client_reference_id: input.workspaceId,
    ...(input.userEmail ? { customer_email: input.userEmail } : {}),
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    automatic_tax: { enabled: true },
    line_items: input.plan.priceIds.map((price) => ({ price, quantity: 1 })),
    metadata,
    integration_identifier: createStripeIntegrationIdentifier(),
    ...(input.plan.mode === "payment"
      ? { payment_intent_data: { metadata } }
      : { subscription_data: { metadata } }),
  };

  try {
    const session = await stripe.checkout.sessions.create(params);
    if (!session.id || !session.url) {
      return { error: "Stripe Checkout konnte nicht gestartet werden." };
    }
    return { id: session.id, url: session.url };
  } catch {
    return { error: "Stripe Checkout konnte nicht gestartet werden." };
  }
}

export async function expireStripeCheckoutSession(sessionId: unknown): Promise<boolean> {
  const stripe = getStripeClient();
  const normalizedId = typeof sessionId === "string" ? sessionId.trim() : "";
  if (!stripe || !/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(normalizedId)) return false;
  try {
    await stripe.checkout.sessions.expire(normalizedId);
    return true;
  } catch {
    // Reconcile below: expiration may have succeeded before the response was lost.
  }

  // Stripe expiration is irreversible. If it succeeded but our following
  // local workspace update failed, a retry must reconcile the already-expired
  // session instead of remaining permanently stuck on the POST error.
  try {
    const session = await stripe.checkout.sessions.retrieve(normalizedId);
    return session.status === "expired";
  } catch {
    return false;
  }
}

export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  return verifyStripeWebhookSignature({
    rawBody,
    signatureHeader,
    configuredSecret: process.env.STRIPE_WEBHOOK_SECRET,
  });
}

export async function findWorkspaceIdByStripeReferences(
  references: StripeWorkspaceReferences,
): Promise<StripeWorkspaceResolution> {
  const lookups = (
    [
      ["stripe_customer_id", references.customerId],
      ["stripe_subscription_id", references.subscriptionId],
      ["stripe_payment_intent_id", references.paymentIntentId],
    ] as Array<[string, string | undefined]>
  ).filter((entry): entry is [string, string] => Boolean(entry[1]));
  if (lookups.length === 0) return { status: "not_found" };

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { status: "retryable_error" };

  const matchedWorkspaceIds = new Set<string>();
  let missingReferenceCount = 0;
  for (const [column, value] of lookups) {
    try {
      const url = `${getSupabaseRestUrl("workspaces")}?select=id&${column}=eq.${encodeURIComponent(value)}&limit=2`;
      const response = await fetch(url, {
        headers: getSupabaseApiKeyHeaders(serviceKey),
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) {
        console.warn(
          "Stripe workspace lookup unavailable",
          column,
          response.status,
        );
        return { status: "retryable_error" };
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        return { status: "retryable_error" };
      }
      if (!Array.isArray(payload)) return { status: "retryable_error" };
      if (payload.length === 0) {
        missingReferenceCount += 1;
        continue;
      }
      if (payload.length !== 1) return { status: "retryable_error" };
      const id = (payload[0] as { id?: unknown } | undefined)?.id;
      if (typeof id !== "string" || !id) {
        return { status: "retryable_error" };
      }
      matchedWorkspaceIds.add(id);
      if (matchedWorkspaceIds.size > 1) {
        return { status: "retryable_error" };
      }
    } catch {
      console.warn(
        "Stripe workspace lookup unavailable",
        column,
        "request_failed",
      );
      return { status: "retryable_error" };
    }
  }
  if (missingReferenceCount > 0) {
    return matchedWorkspaceIds.size === 0
      ? { status: "not_found" }
      : { status: "retryable_error" };
  }
  const [workspaceId] = matchedWorkspaceIds;
  if (matchedWorkspaceIds.size === 1 && workspaceId) {
    return { status: "found", workspaceId };
  }
  return { status: "not_found" };
}

export async function verifyStripeSubscriptionWorkspaceBinding(input: {
  workspaceId: string;
  customerId?: string;
  subscriptionId?: string;
}): Promise<StripeBillingWorkspaceDecision> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return STRIPE_BILLING_RETRYABLE_ERROR;

  try {
    const url = new URL(getSupabaseRestUrl("workspaces"));
    url.searchParams.set(
      "select",
      "id,stripe_customer_id,stripe_subscription_id",
    );
    url.searchParams.set("id", `eq.${input.workspaceId}`);
    url.searchParams.set("limit", "2");
    const response = await fetch(url, {
      headers: getSupabaseApiKeyHeaders(serviceKey),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    let rows: unknown;
    let bodyParsed = true;
    try {
      rows = await response.json();
    } catch {
      rows = null;
      bodyParsed = false;
    }
    return stripeSubscriptionWorkspaceBindingDecision({
      responseOk: response.ok,
      bodyParsed,
      rows,
      workspaceId: input.workspaceId,
      customerId: input.customerId,
      subscriptionId: input.subscriptionId,
    });
  } catch {
    console.warn(
      "Stripe subscription workspace binding unavailable",
      "request_failed",
    );
    return STRIPE_BILLING_RETRYABLE_ERROR;
  }
}

type StripeBillingWorkspaceRow = {
  id?: string;
  owner_user_id?: string | null;
};

async function isStripeBillingTargetAllowed(
  workspaceId: string,
  serviceKey: string,
): Promise<StripeBillingWorkspaceDecision> {
  try {
    const serviceHeaders = {
      ...getSupabaseApiKeyHeaders(serviceKey),
    };
    const workspaceUrl = new URL(getSupabaseRestUrl("workspaces"));
    workspaceUrl.searchParams.set("select", "id,owner_user_id");
    workspaceUrl.searchParams.set("id", `eq.${workspaceId}`);
    workspaceUrl.searchParams.set("limit", "1");
    const workspaceResponse = await fetch(workspaceUrl, {
      headers: serviceHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!workspaceResponse.ok) {
      console.warn(
        "Stripe billing workspace guard unavailable",
        workspaceResponse.status,
      );
      return STRIPE_BILLING_RETRYABLE_ERROR;
    }
    let workspaceRows: StripeBillingWorkspaceRow[];
    try {
      const payload = await workspaceResponse.json();
      if (!Array.isArray(payload)) return STRIPE_BILLING_RETRYABLE_ERROR;
      workspaceRows = payload as StripeBillingWorkspaceRow[];
    } catch {
      return STRIPE_BILLING_RETRYABLE_ERROR;
    }
    const workspace = workspaceRows[0];
    if (
      workspaceRows.length !== 1 ||
      !workspace ||
      workspace.id !== workspaceId ||
      typeof workspace.owner_user_id !== "string" ||
      !workspace.owner_user_id
    ) {
      return STRIPE_BILLING_RETRYABLE_ERROR;
    }

    const sessionUrl = new URL(getSupabaseRestUrl("demo_start_sessions"));
    sessionUrl.searchParams.set("select", "id");
    sessionUrl.searchParams.set("workspace_id", `eq.${workspaceId}`);
    sessionUrl.searchParams.set("limit", "1");
    const sessionResponse = await fetch(sessionUrl, {
      headers: serviceHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!sessionResponse.ok) {
      console.warn(
        "Stripe billing demo-session guard unavailable",
        sessionResponse.status,
      );
      return STRIPE_BILLING_RETRYABLE_ERROR;
    }
    let sessionRows: Array<{ id?: string }>;
    try {
      const payload = await sessionResponse.json();
      if (!Array.isArray(payload)) return STRIPE_BILLING_RETRYABLE_ERROR;
      sessionRows = payload as Array<{ id?: string }>;
    } catch {
      return STRIPE_BILLING_RETRYABLE_ERROR;
    }

    const ownerResponse = await fetch(
      getSupabaseAuthUrl(
        `/admin/users/${encodeURIComponent(workspace.owner_user_id)}`,
      ),
      {
        headers: serviceHeaders,
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!ownerResponse.ok) {
      console.warn(
        "Stripe billing owner guard unavailable",
        ownerResponse.status,
      );
      return STRIPE_BILLING_RETRYABLE_ERROR;
    }
    let ownerPayload:
      | {
          user?: { id?: string; email?: string | null };
          id?: string;
          email?: string | null;
        }
      | null;
    try {
      ownerPayload = (await ownerResponse.json()) as typeof ownerPayload;
    } catch {
      return STRIPE_BILLING_RETRYABLE_ERROR;
    }
    const owner = ownerPayload?.user ?? ownerPayload;
    if (
      owner?.id !== workspace.owner_user_id ||
      typeof owner.email !== "string" ||
      !owner.email.trim()
    ) {
      return STRIPE_BILLING_RETRYABLE_ERROR;
    }

    return stripeBillingWorkspaceDecision({
      workspace,
      ownerEmail: owner.email,
      hasTemporaryDemoSession: sessionRows.length > 0,
    });
  } catch {
    console.warn(
      "Stripe billing workspace guard unavailable",
      "request_failed",
    );
    return STRIPE_BILLING_RETRYABLE_ERROR;
  }
}

async function verifyManualSuspendedBillingState(
  workspaceId: string,
  serviceKey: string,
): Promise<StripeBillingUpdateDecision> {
  try {
    const statusUrl = new URL(getSupabaseRestUrl("workspaces"));
    statusUrl.searchParams.set("select", "id,billing_status");
    statusUrl.searchParams.set("id", `eq.${workspaceId}`);
    statusUrl.searchParams.set("limit", "1");
    const response = await fetch(statusUrl, {
      headers: getSupabaseApiKeyHeaders(serviceKey),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    let rows: unknown = [];
    let bodyParsed = true;
    try {
      rows = await response.json();
    } catch {
      bodyParsed = false;
    }
    return stripeBillingManualSuspensionDecision({
      responseOk: response.ok,
      bodyParsed,
      rows,
      workspaceId,
    });
  } catch {
    console.warn(
      "Stripe billing manual-suspension check unavailable",
      "request_failed",
    );
    return STRIPE_BILLING_RETRYABLE_ERROR;
  }
}

export async function updateWorkspaceBillingDefensively(
  workspaceId: string | undefined,
  fields: Record<string, string | number | boolean | null | undefined>,
): Promise<StripeBillingUpdateDecision> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!workspaceId || !serviceKey) return STRIPE_BILLING_RETRYABLE_ERROR;
  const targetDecision = await isStripeBillingTargetAllowed(
    workspaceId,
    serviceKey,
  );
  if (targetDecision === STRIPE_BILLING_BLOCKED) {
    console.warn("Stripe billing update blocked by workspace policy");
    return STRIPE_BILLING_BLOCKED;
  }
  if (targetDecision !== STRIPE_BILLING_ALLOWED) {
    console.warn("Stripe billing update guard unavailable");
    return STRIPE_BILLING_RETRYABLE_ERROR;
  }
  const body = Object.fromEntries(
    Object.entries({
      ...fields,
      billing_provider: "stripe",
      billing_updated_at: new Date().toISOString(),
    }).filter(([, value]) => value !== undefined),
  );
  try {
    const manualGuardApplied =
      typeof fields.billing_status === "string" &&
      fields.billing_status !== "manual_suspended";
    const updateUrl = new URL(getSupabaseRestUrl("workspaces"));
    updateUrl.searchParams.set("id", `eq.${workspaceId}`);
    updateUrl.searchParams.set("select", "id");
    if (manualGuardApplied) {
      updateUrl.searchParams.set(
        "billing_status",
        "not.eq.manual_suspended",
      );
    }
    const patch = async (patchBody: Record<string, unknown>) => {
      const response = await fetch(updateUrl, {
        method: "PATCH",
        headers: {
          ...getSupabaseApiKeyHeaders(serviceKey),
          Prefer: "return=representation",
        },
        body: JSON.stringify(patchBody),
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      let responseRows: unknown = [];
      let bodyParsed = true;
      try {
        responseRows = await response.json();
      } catch {
        bodyParsed = false;
      }
      return { response, responseRows, bodyParsed };
    };
    let patchResult = await patch(body);
    const errorMessage =
      patchResult.bodyParsed &&
      patchResult.responseRows &&
      typeof patchResult.responseRows === "object" &&
      "message" in patchResult.responseRows &&
      typeof patchResult.responseRows.message === "string"
        ? patchResult.responseRows.message
        : "";
    if (
      !patchResult.response.ok &&
      isMissingWorkspaceExpandColumn(new Error(errorMessage))
    ) {
      // Deploy-before-migrate bridge: PostgREST rejects the complete PATCH
      // atomically when Step A columns are not yet in its schema cache. Retry
      // once with only the already-deployed billing columns so Stripe state is
      // still persisted during the compatibility window.
      patchResult = await patch(withoutWorkspaceExpandColumns(body));
    }
    const updateDecision = stripeBillingPatchDecision({
      responseOk: patchResult.response.ok,
      bodyParsed: patchResult.bodyParsed,
      rows: patchResult.responseRows,
      workspaceId,
    });
    if (updateDecision === STRIPE_BILLING_ZERO_ROWS) {
      const zeroRowDecision = manualGuardApplied
        ? await verifyManualSuspendedBillingState(workspaceId, serviceKey)
        : STRIPE_BILLING_RETRYABLE_ERROR;
      console.warn(
        zeroRowDecision === STRIPE_BILLING_BLOCKED
          ? "Stripe billing update blocked by verified manual suspension"
          : "Stripe billing zero-row update needs retry",
      );
      return zeroRowDecision;
    }
    if (updateDecision !== STRIPE_BILLING_UPDATED) {
      console.warn(
        "Stripe billing update unavailable",
        patchResult.response.status,
      );
    }
    return updateDecision;
  } catch {
    console.warn(
      "Stripe billing update unavailable",
      "request_failed",
    );
    return STRIPE_BILLING_RETRYABLE_ERROR;
  }
}

export async function updateStripeSubscriptionCancellation(input: {
  subscriptionId: string;
  cancelAtPeriodEnd: boolean;
  cancelAt?: string | null;
  workspaceId: string;
  action: "request" | "revoke";
}): Promise<{ error?: string; subscription?: Record<string, unknown> }> {
  const stripe = getStripeClient();
  if (!stripe) return { error: "Stripe ist serverseitig noch nicht konfiguriert." };

  const params: Stripe.SubscriptionUpdateParams = {
    cancel_at_period_end: input.cancelAtPeriodEnd,
    ...(input.action === "request" && input.cancelAt
      ? { cancel_at: Math.floor(Date.parse(input.cancelAt) / 1000) }
      : {}),
    ...(input.action === "revoke" ? { cancel_at: "" } : {}),
    metadata: {
      workspace_id: input.workspaceId,
      fanmind_cancellation_action: input.action,
    },
  };

  try {
    const subscription = await stripe.subscriptions.update(
      input.subscriptionId,
      params,
    );
    return {
      subscription: subscription as unknown as Record<string, unknown>,
    };
  } catch {
    return { error: "Stripe-Subscription konnte nicht aktualisiert werden." };
  }
}
