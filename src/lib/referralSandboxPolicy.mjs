import {
  NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
  evaluateEnvironmentBoundary,
  normalizeHostname,
} from "./environmentBoundaryPolicy.mjs";
import { getStripeSecretKeyMode } from "./stripeKeyPolicy.mjs";

const WRITE_ACKNOWLEDGEMENT = "I_UNDERSTAND_TEST_MODE_ONLY";

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hostnameFromUrl(value) {
  const raw = clean(value);
  if (!raw) return null;

  try {
    return normalizeHostname(new URL(raw).hostname);
  } catch {
    return null;
  }
}

export function evaluateReferralSandboxConfiguration(
  environment = {},
  { allowWrite = false } = {},
) {
  const errors = [];
  const warnings = [];
  const keyMode = getStripeSecretKeyMode(environment.STRIPE_SECRET_KEY);
  const webhookConfigured = clean(environment.STRIPE_WEBHOOK_SECRET).startsWith(
    "whsec_",
  );
  const serviceRoleConfigured = Boolean(
    clean(environment.SUPABASE_SERVICE_ROLE_KEY),
  );
  const reconcileSecretConfigured =
    clean(environment.FANMIND_REFERRAL_RECONCILE_SECRET).length >= 32;
  const billingEnabled =
    clean(environment.FANMIND_ENABLE_REFERRAL_BILLING) === "true";
  const hostname = hostnameFromUrl(
    environment.NEXT_PUBLIC_APP_URL ?? environment.NEXT_PUBLIC_SITE_URL,
  );
  const productionHostname = hostname === "fanmind.ch" || hostname === "www.fanmind.ch";
  const acknowledgement = clean(environment.FANMIND_REFERRAL_SANDBOX_ACK);
  const environmentBoundary = evaluateEnvironmentBoundary(environment, { allowWrite });

  if (keyMode === "missing") {
    errors.push("STRIPE_SECRET_KEY fehlt.");
  } else if (keyMode === "live") {
    errors.push("Live-Stripe-Schlüssel sind für Sandbox-Tests strikt verboten.");
  } else if (keyMode === "unknown") {
    errors.push("STRIPE_SECRET_KEY ist kein erkennbarer Stripe-Testschlüssel.");
  }

  if (!webhookConfigured) {
    errors.push("STRIPE_WEBHOOK_SECRET fehlt oder ist kein whsec_-Wert.");
  }
  if (!serviceRoleConfigured) {
    errors.push("SUPABASE_SERVICE_ROLE_KEY fehlt.");
  }
  if (!reconcileSecretConfigured) {
    errors.push("FANMIND_REFERRAL_RECONCILE_SECRET fehlt oder ist zu kurz.");
  }

  if (allowWrite) {
    if (!billingEnabled) {
      errors.push(
        "Schreibender Sandbox-Test verlangt FANMIND_ENABLE_REFERRAL_BILLING=true.",
      );
    }
    if (acknowledgement !== WRITE_ACKNOWLEDGEMENT) {
      errors.push(
        `Schreibender Sandbox-Test verlangt FANMIND_REFERRAL_SANDBOX_ACK=${WRITE_ACKNOWLEDGEMENT}.`,
      );
    }
    if (!hostname) {
      errors.push(
        "Schreibender Sandbox-Test verlangt eine gültige nicht-produktive NEXT_PUBLIC_APP_URL.",
      );
    }
  } else if (billingEnabled) {
    errors.push(
      "Read-only Preflight verlangt FANMIND_ENABLE_REFERRAL_BILLING=false.",
    );
  }

  for (const boundaryError of environmentBoundary.errors) {
    errors.push(`Umgebungsgrenze: ${boundaryError}`);
  }
  for (const boundaryWarning of environmentBoundary.warnings) {
    warnings.push(`Umgebungsgrenze: ${boundaryWarning}`);
  }

  if (!allowWrite && !productionHostname && hostname) {
    warnings.push(
      "Read-only Preflight läuft gegen eine nicht-produktive URL; für Schreibtests ist zusätzlich --allow-write nötig.",
    );
  }

  return {
    ok: errors.length === 0,
    mode: allowWrite ? "sandbox-write" : "read-only",
    stripeKeyMode: keyMode,
    webhookConfigured,
    serviceRoleConfigured,
    reconcileSecretConfigured,
    billingEnabled,
    productionHostname,
    hostnameConfigured: Boolean(hostname),
    environmentBoundaryOk: environmentBoundary.ok,
    errors,
    warnings,
  };
}

export {
  NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
  WRITE_ACKNOWLEDGEMENT,
};
