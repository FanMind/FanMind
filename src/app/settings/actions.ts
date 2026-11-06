"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
  updatePersonalProfileSettings,
  updateSupabaseServerUserMetadata,
  updateTaxMasterDataSettings,
  updateWorkspaceMasterDataSettings,
} from "@/lib/supabase/server";
import {
  getSupabaseApiKeyHeaders,
  getSupabaseRestUrl,
} from "@/lib/supabase/config";
import { resolveSubscriptionCancellation } from "@/lib/subscriptionCancellation";
import { updateStripeSubscriptionCancellation } from "@/lib/stripeBilling";
import { FANMIND_LOCALE_COOKIE, localeCookieOptions } from "@/lib/workspaceLocale";
import {
  FANMIND_BRIGHTNESS_COOKIE,
  getPreferenceMetadata,
  normalizeFanMindBrightness,
  preferenceCookieOptions,
} from "@/lib/userPreferences";

const SETTINGS_SAVE_ERROR = "Die Änderung konnte gerade nicht gespeichert werden. Bitte versuche es erneut.";
const SUBSCRIPTION_UPDATE_ERROR = "Die Abo-Änderung konnte gerade nicht gespeichert werden. Bitte versuche es erneut.";

function cleanText(formData: FormData, key: string, maxLength: number, required = false): { value: string | null; error: string | null } {
  const raw = formData.get(key);
  const value = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!value) return required ? { value: null, error: `${key} ist erforderlich.` } : { value: null, error: null };
  if (value.length > maxLength) return { value: null, error: `${key} darf maximal ${maxLength} Zeichen haben.` };
  return { value, error: null };
}

export async function saveAppearancePreferences(formData: FormData) {
  const { data } = await getSupabaseServerUser();
  if (!data.user) redirect("/login");

  const locale = formData.get("locale") === "en" ? "en" : "de";
  const brightness = normalizeFanMindBrightness(formData.get("brightness"));
  const cookieStore = await cookies();

  cookieStore.set(FANMIND_LOCALE_COOKIE, locale, localeCookieOptions());
  cookieStore.set(FANMIND_BRIGHTNESS_COOKIE, String(brightness), preferenceCookieOptions());

  const metadata = getPreferenceMetadata({
    currentMetadata: data.user.user_metadata,
    locale,
    brightness,
  });
  const result = await updateSupabaseServerUserMetadata(metadata);

  const returnTo = String(formData.get("returnTo") || "/settings");
  const safeReturnTo = returnTo.startsWith("/settings") ? returnTo : "/settings";
  const search = result.error ? `?preferences_error=${encodeURIComponent(SETTINGS_SAVE_ERROR)}` : "?preferences_saved=1";
  redirect(`${safeReturnTo}${search}`);
}

async function getProfileWorkspaceOrRedirect(errorKey: string) {
  const { data } = await getSupabaseServerUser();
  if (!data.user) redirect("/login");

  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  if (!workspaceResult.workspace) {
    redirect(`/settings/profile?${errorKey}=${encodeURIComponent("Workspace konnte nicht geladen werden.")}`);
  }

  return { user: data.user, workspace: workspaceResult.workspace };
}

function redirectProfileResult(savedKey: string, errorKey: string, error: Error | null) {
  const search = error ? `${errorKey}=${encodeURIComponent(SETTINGS_SAVE_ERROR)}` : `${savedKey}=1`;
  redirect(`/settings/profile?${search}`);
}

export async function savePersonalProfileData(formData: FormData) {
  const { user, workspace } = await getProfileWorkspaceOrRedirect("personal_error");

  const fields = {
    displayName: cleanText(formData, "displayName", 120),
    phone: cleanText(formData, "phone", 40),
    roleAudience: cleanText(formData, "roleAudience", 120),
  };

  const validationError = Object.values(fields).find((field) => field.error)?.error;
  if (validationError) redirect(`/settings/profile?personal_error=${encodeURIComponent(validationError)}`);

  const result = await updatePersonalProfileSettings(user, workspace.id, {
    displayName: fields.displayName.value,
    phone: fields.phone.value,
    roleAudience: fields.roleAudience.value,
  });

  redirectProfileResult("profile_saved", "personal_error", result.error);
}

export async function saveWorkspaceMasterData(formData: FormData) {
  const { user, workspace } = await getProfileWorkspaceOrRedirect("workspace_error");

  const fields = {
    workspaceName: cleanText(formData, "workspaceName", 120, true),
    organizationName: cleanText(formData, "organizationName", 160),
    streetAddress: cleanText(formData, "streetAddress", 180),
    postalCode: cleanText(formData, "postalCode", 24),
    city: cleanText(formData, "city", 100),
    country: cleanText(formData, "country", 80),
  };

  const validationError = Object.values(fields).find((field) => field.error)?.error;
  if (validationError || !fields.workspaceName.value) {
    redirect(`/settings/profile?workspace_error=${encodeURIComponent(validationError ?? "Workspace-Name ist erforderlich.")}`);
  }

  const result = await updateWorkspaceMasterDataSettings(user, workspace.id, {
    workspaceName: fields.workspaceName.value,
    organizationName: fields.organizationName.value,
    streetAddress: fields.streetAddress.value,
    postalCode: fields.postalCode.value,
    city: fields.city.value,
    country: fields.country.value,
  });

  redirectProfileResult("workspace_saved", "workspace_error", result.error);
}

export async function saveTaxMasterData(formData: FormData) {
  const { user, workspace } = await getProfileWorkspaceOrRedirect("tax_error");

  const fields = {
    vatId: cleanText(formData, "vatId", 40),
    taxNumber: cleanText(formData, "taxNumber", 60),
    companyRegisterNumber: cleanText(formData, "companyRegisterNumber", 80),
    companyRegisterCourt: cleanText(formData, "companyRegisterCourt", 120),
  };

  const validationError = Object.values(fields).find((field) => field.error)?.error;
  if (validationError) redirect(`/settings/profile?tax_error=${encodeURIComponent(validationError)}`);

  const result = await updateTaxMasterDataSettings(user, workspace.id, {
    vatId: fields.vatId.value,
    taxNumber: fields.taxNumber.value,
    companyRegisterNumber: fields.companyRegisterNumber.value,
    companyRegisterCourt: fields.companyRegisterCourt.value,
  });

  redirectProfileResult("tax_saved", "tax_error", result.error);
}



function redirectPackageResult(key: "cancel_error" | "cancel_saved", value: string): never {
  redirect(`/settings/package?${key}=${encodeURIComponent(value)}`);
}

async function servicePatch(table: string, id: string, body: Record<string, unknown>) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { error: new Error("workspace_update_unavailable") };
  try {
    const response = await fetch(`${getSupabaseRestUrl(table)}?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { ...getSupabaseApiKeyHeaders(serviceKey), Prefer: "return=minimal" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    return response.ok ? { error: null } : { error: new Error("workspace_update_failed") };
  } catch {
    return { error: new Error("workspace_update_failed") };
  }
}

async function auditSubscriptionChange(input: { userId: string; email?: string; workspaceId: string; action: string; outcome: string; metadata: Record<string, unknown> }) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return;
  await fetch(getSupabaseRestUrl("operations_audit_log"), {
    method: "POST",
    headers: { ...getSupabaseApiKeyHeaders(serviceKey), Prefer: "return=minimal" },
    body: JSON.stringify({ actor_user_id: input.userId, actor_email: input.email ?? null, action: input.action, target_table: "workspaces", target_id: input.workspaceId, severity: "info", outcome: input.outcome, metadata: input.metadata }),
  }).catch(() => undefined);
}

async function getOwnerWorkspaceOrRedirect() {
  const { data } = await getSupabaseServerUser();
  if (!data.user) redirect("/login");
  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  const workspace = workspaceResult.workspace;
  if (!workspace) redirectPackageResult("cancel_error", "Workspace konnte nicht geladen werden.");
  if (workspace.owner_user_id !== data.user.id && workspace.role !== "owner") redirectPackageResult("cancel_error", "Nur Workspace-Owner dürfen das Abo verwalten.");
  return { user: data.user, workspace };
}

export async function requestSubscriptionCancellation() {
  const { user, workspace } = await getOwnerWorkspaceOrRedirect();
  const policy = resolveSubscriptionCancellation(workspace);
  if (!policy.canSelfService || !workspace.stripe_subscription_id) redirectPackageResult("cancel_error", "Dieses Paket kann nicht per Self-Service gekündigt werden.");

  const stripe = await updateStripeSubscriptionCancellation({
    subscriptionId: workspace.stripe_subscription_id,
    cancelAtPeriodEnd: policy.stripeCancelAtPeriodEnd,
    cancelAt: policy.requiresCancelAtTimestamp ? policy.effectiveEndAt : null,
    workspaceId: workspace.id,
    action: "request",
  });
  if (stripe.error) {
    await auditSubscriptionChange({ userId: user.id, email: user.email, workspaceId: workspace.id, action: "subscription_cancellation_request", outcome: "failure", metadata: { error_code: "stripe_subscription_update_failed" } });
    redirectPackageResult("cancel_error", SUBSCRIPTION_UPDATE_ERROR);
  }
  const now = new Date().toISOString();
  const result = await servicePatch("workspaces", workspace.id, {
    subscription_cancel_requested_at: now,
    subscription_cancel_requested_by_user_id: user.id,
    subscription_cancel_at_period_end: policy.stripeCancelAtPeriodEnd,
    subscription_effective_end_at: policy.effectiveEndAt,
    subscription_cancellation_revoked_at: null,
    billing_admin_note: `Kündigung zum Vertragsende vorgemerkt: ${policy.effectiveEndAt}`,
    billing_updated_by_user_id: user.id,
  });
  await auditSubscriptionChange({ userId: user.id, email: user.email, workspaceId: workspace.id, action: "subscription_cancellation_request", outcome: result.error ? "failure" : "success", metadata: { effectiveEndAt: policy.effectiveEndAt, stripeCancelAtPeriodEnd: policy.stripeCancelAtPeriodEnd } });
  if (result.error) redirectPackageResult("cancel_error", SUBSCRIPTION_UPDATE_ERROR);
  redirectPackageResult("cancel_saved", "Kündigung wurde zum Vertragsende vorgemerkt.");
}

export async function revokeSubscriptionCancellation() {
  const { user, workspace } = await getOwnerWorkspaceOrRedirect();
  if (!workspace.subscription_cancel_requested_at || !workspace.stripe_subscription_id) redirectPackageResult("cancel_error", "Es ist keine Kündigung vorgemerkt.");
  if (workspace.subscription_effective_end_at && Date.parse(workspace.subscription_effective_end_at) <= Date.now()) redirectPackageResult("cancel_error", "Die Kündigung kann nach Vertragsende nicht zurückgenommen werden.");
  const stripe = await updateStripeSubscriptionCancellation({ subscriptionId: workspace.stripe_subscription_id, cancelAtPeriodEnd: false, cancelAt: null, workspaceId: workspace.id, action: "revoke" });
  if (stripe.error) {
    await auditSubscriptionChange({ userId: user.id, email: user.email, workspaceId: workspace.id, action: "subscription_cancellation_revoke", outcome: "failure", metadata: { error_code: "stripe_subscription_update_failed" } });
    redirectPackageResult("cancel_error", SUBSCRIPTION_UPDATE_ERROR);
  }
  const result = await servicePatch("workspaces", workspace.id, {
    subscription_cancel_requested_at: null,
    subscription_cancel_requested_by_user_id: null,
    subscription_cancel_at_period_end: false,
    subscription_effective_end_at: null,
    subscription_cancellation_revoked_at: new Date().toISOString(),
    billing_admin_note: "Kündigung zurückgenommen.",
    billing_updated_by_user_id: user.id,
  });
  await auditSubscriptionChange({ userId: user.id, email: user.email, workspaceId: workspace.id, action: "subscription_cancellation_revoke", outcome: result.error ? "failure" : "success", metadata: {} });
  if (result.error) redirectPackageResult("cancel_error", SUBSCRIPTION_UPDATE_ERROR);
  redirectPackageResult("cancel_saved", "Kündigung wurde zurückgenommen.");
}
