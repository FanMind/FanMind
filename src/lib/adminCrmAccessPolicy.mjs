const BASE_ACCESS_FLAGS = Object.freeze({
  admin: true,
  demo: true,
  internal: true,
  test: true,
  billing_disabled: true,
  mail_confirmed: true,
  ai_maintenance: true,
  admin_crm_access: true,
});

function validNow(now) {
  return now instanceof Date && Number.isFinite(now.getTime())
    ? now
    : new Date();
}

function parseExpiry(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const clean = value.trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/u.test(clean)
    ? `${clean}T23:59:59.999Z`
    : clean;
  const parsed = new Date(normalized);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function activeValues(now, mode, expiresAt) {
  const permanent = mode === "permanent";
  return {
    billing_status: "demo_free",
    billing_provider: "manual",
    payment_collection_method: "none",
    billing_manual_override: permanent,
    billing_suspended_at: null,
    billing_suspended_reason: null,
    billing_last_payment_failed_at: null,
    billing_retry_count: 0,
    billing_next_retry_at: null,
    billing_grace_until: null,
    subscription_effective_end_at: null,
    setup_fee_cents: 0,
    monthly_fee_cents: 0,
    commitment_months: 0,
    workspace_access_mode: "active",
    test_access_flags: {
      ...BASE_ACCESS_FLAGS,
      no_expiry: permanent,
      temporary_processing_access: !permanent,
      ...(expiresAt
        ? { temporary_processing_access_expires_at: expiresAt.toISOString() }
        : {}),
    },
    billing_updated_at: validNow(now).toISOString(),
  };
}

export function resolveAdminCrmAccessTransition(input, now = new Date()) {
  const current = validNow(now);
  if (!input || typeof input !== "object") {
    return { ok: false, error: "crm_access_mode_invalid" };
  }

  if (input.mode === "permanent") {
    return { ok: true, values: activeValues(current, "permanent", null) };
  }

  if (input.mode === "temporary") {
    const expiresAt = parseExpiry(input.expiresAt);
    if (!expiresAt || expiresAt.getTime() <= current.getTime()) {
      return { ok: false, error: "temporary_access_expiry_required" };
    }
    return {
      ok: true,
      values: activeValues(current, "temporary", expiresAt),
    };
  }

  if (input.mode === "blocked") {
    return {
      ok: true,
      values: {
        billing_status: "manual_suspended",
        billing_provider: "manual",
        payment_collection_method: "none",
        billing_manual_override: false,
        billing_suspended_at: current.toISOString(),
        billing_suspended_reason: "admin_crm_access_blocked",
        billing_grace_until: null,
        workspace_access_mode: "active",
        test_access_flags: {
          ...BASE_ACCESS_FLAGS,
          no_expiry: false,
          temporary_processing_access: false,
        },
        billing_updated_at: current.toISOString(),
      },
    };
  }

  return { ok: false, error: "crm_access_mode_invalid" };
}

export function adminCrmAccessLabel(workspace, now = new Date()) {
  if (!workspace || typeof workspace !== "object") return "Nicht freigeschaltet";
  if (
    workspace.billing_status === "manual_suspended" ||
    workspace.billing_status === "suspended"
  ) {
    return "Gesperrt";
  }

  const flags =
    workspace.test_access_flags &&
    typeof workspace.test_access_flags === "object" &&
    !Array.isArray(workspace.test_access_flags)
      ? workspace.test_access_flags
      : {};
  if (flags.temporary_processing_access === true) {
    const expiry = parseExpiry(flags.temporary_processing_access_expires_at);
    if (!expiry || expiry.getTime() <= validNow(now).getTime()) {
      return "Befristet abgelaufen";
    }
    return "Befristet kostenlos";
  }
  if (workspace.billing_manual_override === true && flags.no_expiry === true) {
    return "Dauerhaft kostenlos";
  }
  return "Nicht freigeschaltet";
}
