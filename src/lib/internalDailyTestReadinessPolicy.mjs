export function isInternalDailyTestStripeReady(config) {
  return config?.hasSecretKey === true
    && config?.hasWebhookSecret === true
    && config?.hasAppUrl === true
    && config?.hasInternalDailyTestPrice === true
    && config?.readyForWebhook === true
    && config?.readyForTax === true;
}

export function isInternalDailyTestAdmissionReady(input) {
  return input?.windowEnabled === true
    && input?.workspaceProvisioningReady === true
    && input?.billingRuntimeReady === true
    && isInternalDailyTestStripeReady(input?.stripeConfig);
}

export function isInternalDailyTestBillingRuntimeReady(environment = process.env) {
  return environment?.FANMIND_STRIPE_BILLING_WRITE_FREEZE !== "true"
    && environment?.FANMIND_STRIPE_BILLING_EVENT_LEDGER_ENABLED === "true"
    && environment?.FANMIND_STRIPE_BILLING_EVENT_LEDGER_CONTROL_CONFIRMED === "20260816210000"
    && environment?.FANMIND_STRIPE_BILLING_CANONICAL_RECONCILIATION_CONFIRMED === "true";
}
