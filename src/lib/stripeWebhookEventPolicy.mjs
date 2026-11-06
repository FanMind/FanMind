export const STRIPE_WEBHOOK_HANDLED_EVENTS = Object.freeze([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "payment_intent.processing",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "invoice.paid",
  "invoice.updated",
  "invoice.payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.resumed",
  "customer.subscription.paused",
  "customer.subscription.deleted",
  "charge.refunded",
  "refund.created",
  "refund.updated",
  "refund.failed",
  "charge.dispute.created",
  "customer.tax_id.created",
  "customer.tax_id.updated",
  "customer.tax_id.deleted",
]);

const handledEvents = new Set(STRIPE_WEBHOOK_HANDLED_EVENTS);

export function isHandledStripeWebhookEventType(value) {
  return typeof value === "string" && handledEvents.has(value);
}
