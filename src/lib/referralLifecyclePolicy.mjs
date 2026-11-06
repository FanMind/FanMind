const REFERRAL_ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

/**
 * @param {unknown} value
 * @returns {string}
 */
function clean(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function positiveAttemptCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

/**
 * @param {string | null | undefined} status
 * @returns {string | null}
 */
export function billingStatusFromStripeSubscriptionStatus(status) {
  const normalized = clean(status);

  if (REFERRAL_ACTIVE_SUBSCRIPTION_STATUSES.has(normalized)) return "active";
  if (normalized === "past_due") return "past_due";
  if (normalized === "unpaid") return "payment_failed";
  if (normalized === "paused") return "suspended";
  if (normalized === "canceled" || normalized === "incomplete_expired") {
    return "cancelled";
  }

  return null;
}

/**
 * @param {{ attemptCount?: number | null, graceExpired?: boolean }} [input]
 * @returns {string}
 */
export function billingStatusFromInvoiceFailure({
  attemptCount = 1,
  graceExpired = false,
} = {}) {
  const attempts = positiveAttemptCount(attemptCount);

  if (attempts >= 3 || graceExpired === true) return "suspended";
  if (attempts > 1) return "payment_failed";
  return "past_due";
}

/**
 * @param {{
 *   eventType?: string | null,
 *   paymentStatus?: string | null,
 *   subscriptionStatus?: string | null,
 *   refundStatus?: string | null,
 *   attemptCount?: number | null,
 *   graceExpired?: boolean
 * }} [input]
 * @returns {string | null}
 */
export function referralBillingStatusFromStripeEvent({
  eventType,
  paymentStatus,
  subscriptionStatus,
  refundStatus,
  attemptCount,
  graceExpired = false,
} = {}) {
  const type = clean(eventType);

  if (type === "checkout.session.completed") {
    return clean(paymentStatus) === "paid" ? "active" : "pending_sepa_mandate";
  }

  if (
    type === "checkout.session.async_payment_succeeded" ||
    type === "payment_intent.succeeded" ||
    type === "invoice.paid"
  ) {
    return "active";
  }

  if (
    type === "checkout.session.async_payment_failed" ||
    type === "payment_intent.payment_failed"
  ) {
    return "payment_failed";
  }

  if (type === "payment_intent.processing") return "pending_sepa_mandate";

  if (type === "invoice.payment_failed") {
    return billingStatusFromInvoiceFailure({ attemptCount, graceExpired });
  }

  if (
    type === "customer.subscription.created" ||
    type === "customer.subscription.updated"
  ) {
    return billingStatusFromStripeSubscriptionStatus(subscriptionStatus);
  }

  if (type === "customer.subscription.resumed") {
    return billingStatusFromStripeSubscriptionStatus(subscriptionStatus) ?? "active";
  }

  if (type === "customer.subscription.paused") {
    return billingStatusFromStripeSubscriptionStatus(subscriptionStatus) ?? "suspended";
  }

  if (type === "customer.subscription.deleted") return "cancelled";

  if (type === "charge.refunded" || type === "charge.dispute.created") {
    return "refunded";
  }

  if (
    type === "refund.created" ||
    type === "refund.updated" ||
    type === "refund.failed"
  ) {
    return clean(refundStatus) === "succeeded" ? "refunded" : null;
  }

  return null;
}
