export const STRIPE_BILLING_WRITE_FREEZE_CODE = "stripe_billing_write_frozen";

export function isStripeBillingWriteFrozen(environment = process.env) {
  return environment?.FANMIND_STRIPE_BILLING_WRITE_FREEZE === "true";
}
