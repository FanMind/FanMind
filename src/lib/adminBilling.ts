import {
  createStripeCheckoutSession,
  expireStripeCheckoutSession,
  getStripeConfigStatus,
  resolveCheckoutPlan,
} from "@/lib/stripeBilling";
import { isInternalDailyTestStripeReady } from "@/lib/internalDailyTestReadinessPolicy.mjs";
import { getStripeClient } from "@/lib/stripeClient";
import { getSupabaseAuthUrl, getSupabaseHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";
import type { SupabaseServerUser } from "@/lib/supabase/server";

export const INTERNAL_TEST_ACCESS_NOTE = "Interner Testzugang";
export const INTERNAL_DAILY_TEST_OPTION = "internal_daily_test";
export const INTERNAL_DAILY_TEST_NOTE = "Internes Live-Testabo · 1 €/Tag";

export type AdminBillingWorkspace = {
  id: string; name: string; created_at: string | null; owner_user_id: string | null; plan_id: string | null; commercial_option: string | null;
  setup_fee_cents: number | null; monthly_fee_cents: number | null; commitment_months: number | null;
  billing_status: string | null; billing_suspended_at: string | null; billing_suspended_reason: string | null; billing_manual_override: boolean | null;
  billing_last_payment_failed_at: string | null; billing_last_payment_at: string | null; billing_retry_count: number | null; billing_next_retry_at: string | null; billing_grace_until: string | null; billing_admin_note: string | null; billing_updated_at: string | null; billing_updated_by_user_id: string | null;
  test_access_flags: InternalTestAccessFlags | null;
  stripe_customer_id: string | null; stripe_subscription_id: string | null; stripe_checkout_session_id: string | null;
  last_invoice_id: string | null; last_invoice_status: string | null; last_invoice_amount_due_cents: number | null; last_invoice_amount_paid_cents: number | null; last_invoice_hosted_url: string | null; last_invoice_pdf_url: string | null;
};

const ADMIN_BILLING_COLUMNS = "id,name,created_at,owner_user_id,plan_id,commercial_option,setup_fee_cents,monthly_fee_cents,commitment_months,billing_status,billing_suspended_at,billing_suspended_reason,billing_manual_override,billing_last_payment_failed_at,billing_last_payment_at,billing_retry_count,billing_next_retry_at,billing_grace_until,billing_admin_note,billing_updated_at,billing_updated_by_user_id,stripe_customer_id,stripe_subscription_id,stripe_checkout_session_id,last_invoice_id,last_invoice_status,last_invoice_amount_due_cents,last_invoice_amount_paid_cents,last_invoice_hosted_url,last_invoice_pdf_url,test_access_flags";

function serviceKey() { return process.env.SUPABASE_SERVICE_ROLE_KEY; }
function validUuid(id: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id); }

export async function listAdminBillingWorkspaces(): Promise<{ workspaces: AdminBillingWorkspace[]; error: string | null }> {
  const key = serviceKey();
  if (!key) return { workspaces: [], error: "Supabase Service Role ist nicht konfiguriert." };
  try {
    const url = new URL(getSupabaseRestUrl("workspaces"));
    url.searchParams.set("select", ADMIN_BILLING_COLUMNS);
    url.searchParams.set("order", "billing_updated_at.desc.nullslast,name.asc");
    const response = await fetch(url, { headers: getSupabaseHeaders(key), cache: "no-store" });
    if (!response.ok) return { workspaces: [], error: `Workspaces konnten nicht geladen werden (${response.status}). Migration evtl. noch nicht live.` };
    return { workspaces: await response.json() as AdminBillingWorkspace[], error: null };
  } catch { return { workspaces: [], error: "Workspaces konnten nicht geladen werden." }; }
}

export async function updateAdminBillingWorkspace(workspaceId: string, admin: SupabaseServerUser, values: Record<string, unknown>) {
  const key = serviceKey();
  if (!key) return { ok: false, status: 503, error: "Supabase Service Role ist nicht konfiguriert." };
  if (!validUuid(workspaceId)) return { ok: false, status: 400, error: "Ungültige Workspace-ID." };
  const body = { ...values, billing_updated_at: new Date().toISOString(), billing_updated_by_user_id: admin.id };
  const url = new URL(getSupabaseRestUrl("workspaces"));
  url.searchParams.set("id", `eq.${workspaceId}`);
  const response = await fetch(url, { method: "PATCH", headers: { ...getSupabaseHeaders(key), Prefer: "return=minimal" }, body: JSON.stringify(body), cache: "no-store" });
  if (!response.ok) return { ok: false, status: response.status, error: "Billing-Aktion konnte nicht gespeichert werden." };
  return { ok: true, status: 200, error: null };
}

export async function getAdminBillingWorkspace(workspaceId: string): Promise<{ workspace: (AdminBillingWorkspace & { owner_email?: string | null }) | null; error: string | null }> {
  const key = serviceKey();
  if (!key) return { workspace: null, error: "Supabase Service Role ist nicht konfiguriert." };
  if (!validUuid(workspaceId)) return { workspace: null, error: "Ungültige Workspace-ID." };
  try {
    const url = new URL(getSupabaseRestUrl("workspaces"));
    url.searchParams.set("select", ADMIN_BILLING_COLUMNS);
    url.searchParams.set("id", `eq.${workspaceId}`);
    url.searchParams.set("limit", "1");
    const response = await fetch(url, { headers: getSupabaseHeaders(key), cache: "no-store" });
    if (!response.ok) return { workspace: null, error: `Workspace konnte nicht geladen werden (${response.status}).` };
    const rows = await response.json() as AdminBillingWorkspace[];
    const workspace = rows[0];
    if (!workspace) return { workspace: null, error: null };
    let ownerEmail: string | null = null;
    if (workspace.owner_user_id && validUuid(workspace.owner_user_id)) {
      const ownerResponse = await fetch(getSupabaseAuthUrl(`/admin/users/${encodeURIComponent(workspace.owner_user_id)}`), {
        headers: getSupabaseHeaders(key),
        cache: "no-store",
      }).catch(() => null);
      if (ownerResponse?.ok) {
        const ownerPayload = await ownerResponse.json().catch(() => null) as { user?: { email?: unknown }; email?: unknown } | null;
        const candidate = ownerPayload?.user?.email ?? ownerPayload?.email;
        ownerEmail = typeof candidate === "string" && candidate.trim() ? candidate.trim() : null;
      }
    }
    return { workspace: { ...workspace, owner_email: ownerEmail }, error: null };
  } catch { return { workspace: null, error: "Workspace konnte nicht geladen werden." }; }
}

export type StripeInvoiceSummary = { id: string; status?: string | null; created?: string | null; subtotal?: number | null; total_tax_amounts?: number | null; total?: number | null; amount_due?: number | null; hosted_invoice_url?: string | null; invoice_pdf?: string | null };

function stripeInvoiceTaxAmount(invoice: Record<string, unknown>): number | null {
  const taxes = Array.isArray(invoice.total_taxes)
    ? invoice.total_taxes
    : Array.isArray(invoice.total_tax_amounts)
      ? invoice.total_tax_amounts
      : null;
  if (!taxes) return null;
  return taxes.reduce(
    (sum, tax) =>
      sum +
      (typeof (tax as { amount?: unknown }).amount === "number"
        ? (tax as { amount: number }).amount
        : 0),
    0,
  );
}

export async function listStripeInvoicesForWorkspace(workspace: Pick<AdminBillingWorkspace, "stripe_customer_id">): Promise<{ invoices: StripeInvoiceSummary[]; error: string | null }> {
  const stripe = getStripeClient();
  if (!stripe || !workspace.stripe_customer_id) return { invoices: [], error: null };
  try {
    const result = await stripe.invoices.list({
      customer: workspace.stripe_customer_id,
      limit: 10,
    });
    const invoices = result.data as unknown as Array<Record<string, unknown>>;
    return { invoices: invoices.map((invoice) => ({ id: String(invoice.id), status: typeof invoice.status === "string" ? invoice.status : null, created: typeof invoice.created === "number" ? new Date(invoice.created * 1000).toISOString() : null, subtotal: typeof invoice.subtotal === "number" ? invoice.subtotal : null, total_tax_amounts: stripeInvoiceTaxAmount(invoice), total: typeof invoice.total === "number" ? invoice.total : null, amount_due: typeof invoice.amount_due === "number" ? invoice.amount_due : null, hosted_invoice_url: typeof invoice.hosted_invoice_url === "string" ? invoice.hosted_invoice_url : null, invoice_pdf: typeof invoice.invoice_pdf === "string" ? invoice.invoice_pdf : null })), error: null };
  } catch {
    return { invoices: [], error: "Stripe-Rechnungen konnten nicht geladen werden." };
  }
}

export async function startInternalDailyTestCheckout(workspaceId: string, admin: SupabaseServerUser): Promise<{ ok: boolean; status: number; error: string | null; url?: string; sessionId?: string }> {
  const key = serviceKey();
  if (!key) return { ok: false, status: 503, error: "Supabase Service Role ist nicht konfiguriert." };
  const { workspace, error } = await getAdminBillingWorkspace(workspaceId);
  if (!workspace) return { ok: false, status: 404, error: error ?? "Workspace wurde nicht gefunden." };
  if (!isInternalTestWorkspace(workspace)) return { ok: false, status: 403, error: "Das 1-€-Live-Testabo ist nur für klar markierte interne Test-Workspaces erlaubt." };
  if (!isInternalDailyTestStripeReady(getStripeConfigStatus())) {
    return { ok: false, status: 503, error: "Stripe Checkout und Webhook sind für das 1-€-Live-Testabo nicht vollständig konfiguriert." };
  }
  const plan = resolveCheckoutPlan("pilot", INTERNAL_DAILY_TEST_OPTION);
  if (!plan) return { ok: false, status: 503, error: "STRIPE_PRICE_INTERNAL_DAILY_TEST ist nicht konfiguriert." };
  if (!workspace.owner_user_id || !workspace.owner_email) return { ok: false, status: 409, error: "Der Workspace-Owner und seine E-Mail müssen vor dem Stripe-Test eindeutig aufgelöst werden." };
  const session = await createStripeCheckoutSession({ plan, userId: workspace.owner_user_id, workspaceId, userEmail: workspace.owner_email });
  if (!session.url) return { ok: false, status: 502, error: session.error ?? "Stripe Checkout konnte nicht gestartet werden." };
  const persisted = await updateAdminBillingWorkspace(workspaceId, admin, {
    plan_id: "pilot",
    commercial_option: INTERNAL_DAILY_TEST_OPTION,
    setup_fee_cents: 0,
    monthly_fee_cents: 0,
    commitment_months: 0,
    billing_status: "pending_payment_setup",
    payment_collection_method: plan.paymentCollectionMethod,
    billing_manual_override: false,
    billing_admin_note: `${INTERNAL_TEST_ACCESS_NOTE} · ${INTERNAL_DAILY_TEST_NOTE} · Checkout gestartet · ${new Date().toISOString()}`,
    stripe_checkout_session_id: session.id ?? null,
    test_access_flags: { ...normalizeInternalTestAccessFlags(workspace.test_access_flags), internal: true, test: true, billing_disabled: false, stripe_live_daily_test: true },
  });
  if (!persisted.ok) {
    if (session.id) await expireStripeCheckoutSession(session.id);
    return {
      ok: false,
      status: persisted.status,
      error: persisted.error ?? "Der Stripe-Checkout konnte dem Workspace nicht sicher zugeordnet werden.",
    };
  }
  return { ok: true, status: 200, error: null, url: session.url, sessionId: session.id };
}

export async function cancelInternalDailyTestSubscription(workspaceId: string, admin: SupabaseServerUser): Promise<{ ok: boolean; status: number; error: string | null }> {
  const stripe = getStripeClient();
  const { workspace, error } = await getAdminBillingWorkspace(workspaceId);
  if (!workspace) return { ok: false, status: 404, error: error ?? "Workspace wurde nicht gefunden." };
  if (workspace.commercial_option !== INTERNAL_DAILY_TEST_OPTION) return { ok: false, status: 403, error: "Nur interne Live-Testabos können über diese Aktion deaktiviert werden." };
  if (workspace.stripe_subscription_id && !stripe) return { ok: false, status: 503, error: "Stripe ist für die Kündigung nicht konfiguriert." };
  if (stripe && workspace.stripe_subscription_id) {
    try {
      await stripe.subscriptions.update(workspace.stripe_subscription_id, {
        cancel_at_period_end: true,
      });
    } catch {
      return { ok: false, status: 502, error: "Stripe-Subscription konnte nicht deaktiviert werden." };
    }
  }
  if (!workspace.stripe_subscription_id) {
    if (!workspace.stripe_checkout_session_id) {
      return {
        ok: false,
        status: 409,
        error: "Der offene Stripe-Checkout kann nicht eindeutig bestätigt und deaktiviert werden.",
      };
    }
    const checkoutExpired = await expireStripeCheckoutSession(workspace.stripe_checkout_session_id);
    if (!checkoutExpired) {
      return {
        ok: false,
        status: 502,
        error: "Stripe konnte das offene Checkout nicht bestätigt deaktivieren.",
      };
    }
    return updateAdminBillingWorkspace(workspaceId, admin, {
      billing_status: "demo_free",
      payment_collection_method: "none",
      stripe_checkout_session_id: null,
      subscription_cancel_requested_at: new Date().toISOString(),
      subscription_cancel_at_period_end: false,
      billing_admin_note: `${INTERNAL_TEST_ACCESS_NOTE} · ${INTERNAL_DAILY_TEST_NOTE} · Nicht abgeschlossenes Checkout deaktiviert · ${new Date().toISOString()}`,
      test_access_flags: {
        ...normalizeInternalTestAccessFlags(workspace.test_access_flags),
        billing_disabled: true,
        stripe_live_daily_test: false,
      },
    });
  }
  return updateAdminBillingWorkspace(workspaceId, admin, {
    subscription_cancel_requested_at: new Date().toISOString(),
    subscription_cancel_at_period_end: true,
    billing_admin_note: `${INTERNAL_TEST_ACCESS_NOTE} · ${INTERNAL_DAILY_TEST_NOTE} · Kündigung zum Ende des bezahlten Tages vorgemerkt · ${new Date().toISOString()}`,
  });
}

export type AdminBillingMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string | null;
  created_at: string | null;
  email?: string | null;
  display_name?: string | null;
};

type WorkspaceMemberRow = { id: string; workspace_id: string; user_id: string; role: string | null; created_at: string | null };
type ProfileRow = { id: string; email: string | null; display_name: string | null };

export type InternalTestAccessFlags = {
  admin: boolean;
  demo: boolean;
  internal: boolean;
  test: boolean;
  billing_disabled: boolean;
  mail_confirmed: boolean;
  no_expiry: boolean;
  ai_maintenance: boolean;
  stripe_live_daily_test?: boolean;
};

export const INTERNAL_TEST_ACCESS_FLAGS: InternalTestAccessFlags = {
  admin: true,
  demo: true,
  internal: true,
  test: true,
  billing_disabled: true,
  mail_confirmed: true,
  no_expiry: true,
  ai_maintenance: true,
};

export function normalizeInternalTestAccessFlags(flags: Partial<Record<keyof InternalTestAccessFlags, unknown>> | null | undefined): InternalTestAccessFlags {
  return {
    admin: flags?.admin === true,
    demo: flags?.demo === true,
    internal: flags?.internal === true,
    test: flags?.test === true,
    billing_disabled: flags?.billing_disabled === true,
    mail_confirmed: flags?.mail_confirmed === true,
    no_expiry: flags?.no_expiry === true,
    ai_maintenance: flags?.ai_maintenance === true,
    stripe_live_daily_test: flags?.stripe_live_daily_test === true,
  };
}

export function isAiMaintenanceInternalTestWorkspace(workspace: Pick<AdminBillingWorkspace, "test_access_flags"> | null | undefined): boolean {
  return normalizeInternalTestAccessFlags(workspace?.test_access_flags).ai_maintenance;
}

export function isInternalTestWorkspace(workspace: Pick<AdminBillingWorkspace, "billing_status" | "billing_admin_note" | "setup_fee_cents" | "monthly_fee_cents" | "test_access_flags"> | null | undefined): boolean {
  if (!workspace) return false;
  const flags = normalizeInternalTestAccessFlags(workspace.test_access_flags);
  const hasInternalFlags = flags.internal && flags.test && (flags.billing_disabled || flags.stripe_live_daily_test === true);
  const hasLegacyNote = (workspace.billing_admin_note ?? "").includes(INTERNAL_TEST_ACCESS_NOTE);
  return (workspace.billing_status === "demo_free" || workspace.billing_status === "active" || workspace.billing_status === "pending_payment_setup" || workspace.billing_status === "pending_sepa_mandate" || workspace.billing_status === "past_due" || workspace.billing_status === "payment_failed") && (hasInternalFlags || hasLegacyNote);
}

export function isInternalTestMember(member: Pick<AdminBillingMember, "email">, workspace: Pick<AdminBillingWorkspace, "billing_status" | "billing_admin_note" | "setup_fee_cents" | "monthly_fee_cents" | "test_access_flags"> | null | undefined): boolean {
  const email = (member.email ?? "").trim().toLowerCase();
  return isInternalTestWorkspace(workspace) || email.endsWith("@fanmind.local") || email.includes("+test") || email.includes("+demo");
}

type ContactCountRow = { workspace_id: string; count: number };

export async function listAdminBillingMembers(): Promise<{ members: AdminBillingMember[]; error: string | null }> {
  const key = serviceKey();
  if (!key) return { members: [], error: "Supabase Service Role ist nicht konfiguriert." };
  try {
    const memberUrl = new URL(getSupabaseRestUrl("workspace_members"));
    memberUrl.searchParams.set("select", "id,workspace_id,user_id,role,created_at");
    memberUrl.searchParams.set("order", "created_at.desc.nullslast");
    memberUrl.searchParams.set("limit", "100");
    const memberResponse = await fetch(memberUrl, { headers: getSupabaseHeaders(key), cache: "no-store" });
    if (!memberResponse.ok) return { members: [], error: `Workspace-Mitglieder konnten nicht geladen werden (${memberResponse.status}).` };
    const rows = await memberResponse.json() as WorkspaceMemberRow[];
    const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))];
    const profiles = new Map<string, ProfileRow>();

    if (userIds.length) {
      const profileUrl = new URL(getSupabaseRestUrl("profiles"));
      profileUrl.searchParams.set("select", "id,email,display_name");
      profileUrl.searchParams.set("id", `in.(${userIds.join(",")})`);
      const profileResponse = await fetch(profileUrl, { headers: getSupabaseHeaders(key), cache: "no-store" });
      if (profileResponse.ok) {
        for (const profile of await profileResponse.json() as ProfileRow[]) profiles.set(profile.id, profile);
      }
    }

    return {
      members: rows.map((row) => ({ ...row, email: profiles.get(row.user_id)?.email ?? null, display_name: profiles.get(row.user_id)?.display_name ?? null })),
      error: null,
    };
  } catch { return { members: [], error: "Workspace-Mitglieder konnten nicht geladen werden." }; }
}

export async function listWorkspaceContactCounts(): Promise<{ counts: Map<string, number>; error: string | null }> {
  const key = serviceKey();
  if (!key) return { counts: new Map(), error: null };
  try {
    const url = new URL(getSupabaseRestUrl("contacts"));
    url.searchParams.set("select", "workspace_id");
    const response = await fetch(url, { headers: { ...getSupabaseHeaders(key), Prefer: "count=exact" }, cache: "no-store" });
    if (!response.ok) return { counts: new Map(), error: null };
    const rows = await response.json() as ContactCountRow[];
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.workspace_id, (counts.get(row.workspace_id) ?? 0) + 1);
    return { counts, error: null };
  } catch { return { counts: new Map(), error: null }; }
}

export async function confirmAdminBillingUserEmail(userId: string): Promise<{ ok: boolean; status: number; error: string | null }> {
  const key = serviceKey();
  if (!key) return { ok: false, status: 503, error: "Supabase Service Role ist nicht konfiguriert." };
  if (!validUuid(userId)) return { ok: false, status: 400, error: "Ungültige User-ID." };

  const response = await fetch(getSupabaseAuthUrl(`/admin/users/${encodeURIComponent(userId)}`), {
    method: "PUT",
    headers: getSupabaseHeaders(key),
    body: JSON.stringify({ email_confirm: true }),
    cache: "no-store",
  });

  if (!response.ok) return { ok: false, status: response.status, error: "E-Mail-Bestätigung konnte serverseitig nicht gesetzt werden." };
  return { ok: true, status: 200, error: null };
}

async function getWorkspaceOwnerUserId(workspaceId: string, key: string): Promise<string | null> {
  const url = new URL(getSupabaseRestUrl("workspaces"));
  url.searchParams.set("select", "owner_user_id");
  url.searchParams.set("id", `eq.${workspaceId}`);
  url.searchParams.set("limit", "1");
  const response = await fetch(url, { headers: getSupabaseHeaders(key), cache: "no-store" });
  if (!response.ok) return null;
  const rows = (await response.json().catch(() => [])) as Array<{ owner_user_id?: string | null }>;
  return rows[0]?.owner_user_id ?? null;
}

async function confirmInternalTestOwnerEmail(workspaceId: string, key: string): Promise<void> {
  const ownerUserId = await getWorkspaceOwnerUserId(workspaceId, key);
  if (!ownerUserId || !validUuid(ownerUserId)) return;
  await fetch(getSupabaseAuthUrl(`/admin/users/${encodeURIComponent(ownerUserId)}`), {
    method: "PUT",
    headers: getSupabaseHeaders(key),
    body: JSON.stringify({ email_confirm: true }),
    cache: "no-store",
  }).catch(() => undefined);
}

export async function markWorkspaceAsInternalTestAccess(workspaceId: string, admin: SupabaseServerUser): Promise<{ ok: boolean; status: number; error: string | null }> {
  const key = serviceKey();
  if (!key) return { ok: false, status: 503, error: "Supabase Service Role ist nicht konfiguriert." };
  await confirmInternalTestOwnerEmail(workspaceId, key);
  const note = `${INTERNAL_TEST_ACCESS_NOTE} · Admin/Demo/Internal/Test · Billing deaktiviert · Mail bestätigt · Keine Ablaufzeit · AI Maintenance · ${new Date().toISOString().slice(0, 10)}`;
  return updateAdminBillingWorkspace(workspaceId, admin, {
    billing_status: "demo_free",
    billing_manual_override: true,
    billing_suspended_at: null,
    billing_suspended_reason: null,
    billing_retry_count: 0,
    billing_next_retry_at: null,
    billing_grace_until: null,
    setup_fee_cents: 0,
    monthly_fee_cents: 0,
    billing_admin_note: note,
    test_access_flags: INTERNAL_TEST_ACCESS_FLAGS,
  });
}
