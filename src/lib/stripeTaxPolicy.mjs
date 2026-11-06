export const STRIPE_TAX_MODE = "stripe_tax";
export const AUSTRIAN_STANDARD_VAT_PERCENT = 20;

function clean(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function evaluateStripeTaxConfiguration(environment = process.env) {
  const stripeTaxEnabled = clean(environment.FANMIND_TAX_MODE) === STRIPE_TAX_MODE;
  const taxRegistrationConfirmed =
    clean(environment.FANMIND_STRIPE_TAX_REGISTRATION_CONFIRMED) === "true";

  return Object.freeze({
    taxMode: stripeTaxEnabled ? STRIPE_TAX_MODE : "unconfigured",
    stripeTaxEnabled,
    taxRegistrationConfirmed,
    ready: stripeTaxEnabled && taxRegistrationConfirmed,
    austrianStandardVatPercent: AUSTRIAN_STANDARD_VAT_PERCENT,
  });
}
