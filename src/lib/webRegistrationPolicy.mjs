import { buildWebPasswordResetRedirect } from "./webRecoveryPolicy.mjs";

export function buildWebRegistrationRedirect(origin, language = "de") {
  // Share the reviewed, exact Production/Staging/local origin policy.
  const url = new URL(buildWebPasswordResetRedirect(origin, language));
  url.pathname = "/register/confirm";
  return url.href;
}

export function buildRegistrationAccountMetadata(input) {
  const bounded = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
  return {
    full_name: bounded(input.name, 120),
    display_name: bounded(input.name, 120),
    organization: bounded(input.organization, 160),
    role: bounded(input.role, 80),
    message: bounded(input.message, 2000),
    fanmind_locale: input.language === "en" ? "en" : "de",
    // Preferences only: never plan_id, commercial_option, billing or consent.
    registration_plan_preference: input.planId === "pilot" ? "pilot" : "starter",
    registration_option_preference: ["starter_paid_setup", "starter_no_setup_commitment", "internal_daily_test"].includes(input.commercialOption)
      ? input.commercialOption : "starter_paid_setup",
    referral_code: bounded(input.referralCode, 80),
  };
}

export function readWebRegistrationSession({ hash = "", search = "" } = {}) {
  if (typeof hash !== "string" || typeof search !== "string" || hash.length > 16384 || search.length > 2048) return null;
  const query = new URLSearchParams(search);
  if ([...query.keys()].some((key) => key !== "lang") || query.getAll("lang").length > 1) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const allowed = new Set(["access_token", "refresh_token", "token_type", "type", "expires_in", "expires_at"]);
  if ([...params.keys()].some((key) => !allowed.has(key) || params.getAll(key).length !== 1)) return null;
  if (params.get("type") !== "signup" || params.get("token_type") !== "bearer") return null;
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const token = (value, max) => typeof value === "string" && value.length > 0 && value.length <= max && /^[A-Za-z0-9._~-]+$/.test(value);
  const expiresIn = Number(params.get("expires_in"));
  if (!token(accessToken, 8192) || !token(refreshToken, 4000) || !Number.isSafeInteger(expiresIn) || expiresIn <= 0 || expiresIn > 86400) return null;
  return { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn };
}

export function registrationErrorMessage(error, language = "de") {
  const message = String(error?.message ?? "").toLowerCase();
  if (/rate|too many|security purposes/.test(message)) return language === "en"
    ? "Please wait a minute before trying again." : "Bitte warte eine Minute und versuche es dann erneut.";
  if (/already registered|already been registered/.test(message)) return language === "en"
    ? "Please sign in with your existing account or reset your password." : "Bitte melde dich mit deinem bestehenden Konto an oder setze dein Passwort zurück.";
  if (/weak|password/.test(message)) return language === "en"
    ? "Please choose a stronger password with at least 8 characters." : "Bitte wähle ein stärkeres Passwort mit mindestens 8 Zeichen.";
  return language === "en" ? "Registration could not be completed. Please try again later or contact FanMind."
    : "Die Registrierung konnte nicht abgeschlossen werden. Bitte versuche es später erneut oder kontaktiere FanMind.";
}
