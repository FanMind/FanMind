export const FIXED_DEMO_EMAIL = "sandra.m@fanmind.ch";

export const STRIPE_BILLING_ALLOWED = "allowed";
export const STRIPE_BILLING_BLOCKED = "blocked";
export const STRIPE_BILLING_RETRYABLE_ERROR = "retryable_error";
export const STRIPE_BILLING_UPDATED = "updated";
export const STRIPE_BILLING_ZERO_ROWS = "zero_rows";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const STRIPE_CUSTOMER_PATTERN = /^cus_[A-Za-z0-9_]+$/u;
const STRIPE_SUBSCRIPTION_PATTERN = /^sub_[A-Za-z0-9_]+$/u;
const STRIPE_PAYMENT_INTENT_PATTERN = /^pi_[A-Za-z0-9_]+$/u;

const CHECKOUT_SESSION_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
]);
const PAYMENT_INTENT_EVENTS = new Set([
  "payment_intent.processing",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
]);
const INVOICE_EVENTS = new Set([
  "invoice.paid",
  "invoice.updated",
  "invoice.payment_failed",
]);
const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.resumed",
  "customer.subscription.paused",
  "customer.subscription.deleted",
]);
const PAYMENT_REVERSAL_EVENTS = new Set([
  "charge.refunded",
  "refund.created",
  "refund.updated",
  "refund.failed",
  "charge.dispute.created",
]);
const TAX_ID_EVENTS = new Set([
  "customer.tax_id.created",
  "customer.tax_id.updated",
  "customer.tax_id.deleted",
]);

export function stripeWebhookReferenceContractDecision({
  eventType,
  customerId,
  subscriptionId,
  paymentIntentId,
}) {
  const customerValid =
    typeof customerId === "string" &&
    STRIPE_CUSTOMER_PATTERN.test(customerId);
  const subscriptionValid =
    typeof subscriptionId === "string" &&
    STRIPE_SUBSCRIPTION_PATTERN.test(subscriptionId);
  const paymentIntentValid =
    typeof paymentIntentId === "string" &&
    STRIPE_PAYMENT_INTENT_PATTERN.test(paymentIntentId);

  if (CHECKOUT_SESSION_EVENTS.has(eventType)) {
    return customerValid
      ? STRIPE_BILLING_ALLOWED
      : STRIPE_BILLING_RETRYABLE_ERROR;
  }
  if (PAYMENT_INTENT_EVENTS.has(eventType)) {
    return customerValid && paymentIntentValid
      ? STRIPE_BILLING_ALLOWED
      : STRIPE_BILLING_RETRYABLE_ERROR;
  }
  if (INVOICE_EVENTS.has(eventType) || SUBSCRIPTION_EVENTS.has(eventType)) {
    return customerValid && subscriptionValid
      ? STRIPE_BILLING_ALLOWED
      : STRIPE_BILLING_RETRYABLE_ERROR;
  }
  if (PAYMENT_REVERSAL_EVENTS.has(eventType)) {
    return paymentIntentValid
      ? STRIPE_BILLING_ALLOWED
      : STRIPE_BILLING_RETRYABLE_ERROR;
  }
  if (TAX_ID_EVENTS.has(eventType)) {
    return customerValid
      ? STRIPE_BILLING_ALLOWED
      : STRIPE_BILLING_RETRYABLE_ERROR;
  }
  return STRIPE_BILLING_RETRYABLE_ERROR;
}

export function stripeWebhookReferenceLookupValues(input) {
  if (stripeWebhookReferenceContractDecision(input) !== STRIPE_BILLING_ALLOWED) {
    return null;
  }
  const { eventType, customerId, subscriptionId, paymentIntentId } = input;
  if (CHECKOUT_SESSION_EVENTS.has(eventType) || TAX_ID_EVENTS.has(eventType)) {
    return { customerId };
  }
  if (PAYMENT_INTENT_EVENTS.has(eventType)) {
    // A recurring payment creates a new PaymentIntent. The signed event must
    // contain that typed ID, but the stable stored tenant key is the Customer.
    return { customerId };
  }
  if (INVOICE_EVENTS.has(eventType) || SUBSCRIPTION_EVENTS.has(eventType)) {
    return { customerId, subscriptionId };
  }
  if (PAYMENT_REVERSAL_EVENTS.has(eventType)) {
    // Charge/dispute objects normally carry the Customer. Refund objects may
    // not, so only that narrower shape falls back to the currently stored PI.
    return customerId ? { customerId } : { paymentIntentId };
  }
  return null;
}

export function resolveStripeWebhookWorkspaceCandidates({
  directCandidates,
  referenceResolution,
  allowDirectBootstrap = false,
}) {
  if (!Array.isArray(directCandidates)) {
    return { status: "retryable_error" };
  }
  const presentCandidates = directCandidates.filter(
    (candidate) => candidate !== null && candidate !== undefined,
  );
  if (
    presentCandidates.some(
      (candidate) =>
        typeof candidate !== "string" || !UUID_PATTERN.test(candidate),
    )
  ) {
    return { status: "retryable_error" };
  }

  const directWorkspaceIds = new Set(presentCandidates);
  if (directWorkspaceIds.size > 1) {
    return { status: "retryable_error" };
  }
  if (
    !referenceResolution ||
    !["found", "not_found", "retryable_error"].includes(
      referenceResolution.status,
    )
  ) {
    return { status: "retryable_error" };
  }
  if (referenceResolution.status === "retryable_error") {
    return { status: "retryable_error" };
  }

  const [directWorkspaceId] = directWorkspaceIds;
  if (
    directWorkspaceId &&
    referenceResolution.status === "found" &&
    referenceResolution.workspaceId !== directWorkspaceId
  ) {
    return { status: "retryable_error" };
  }
  if (directWorkspaceId) {
    if (
      referenceResolution.status === "not_found" &&
      allowDirectBootstrap !== true
    ) {
      return { status: "retryable_error" };
    }
    return { status: "found", workspaceId: directWorkspaceId };
  }
  return referenceResolution;
}

export function stripeSubscriptionWorkspaceBindingDecision({
  responseOk,
  bodyParsed,
  rows,
  workspaceId,
  customerId,
  subscriptionId,
}) {
  if (
    responseOk !== true ||
    bodyParsed !== true ||
    !Array.isArray(rows) ||
    typeof workspaceId !== "string" ||
    !UUID_PATTERN.test(workspaceId) ||
    typeof customerId !== "string" ||
    !STRIPE_CUSTOMER_PATTERN.test(customerId) ||
    typeof subscriptionId !== "string" ||
    !STRIPE_SUBSCRIPTION_PATTERN.test(subscriptionId)
  ) {
    return STRIPE_BILLING_RETRYABLE_ERROR;
  }

  const row = rows[0];
  return rows.length === 1 &&
    row &&
    typeof row === "object" &&
    row.id === workspaceId &&
    row.stripe_customer_id === customerId &&
    row.stripe_subscription_id === subscriptionId
    ? STRIPE_BILLING_ALLOWED
    : STRIPE_BILLING_RETRYABLE_ERROR;
}

export function stripeBillingWorkspaceDecision({
  workspace,
  ownerEmail,
  hasTemporaryDemoSession,
}) {
  if (
    !workspace ||
    typeof workspace.owner_user_id !== "string" ||
    !workspace.owner_user_id ||
    typeof ownerEmail !== "string" ||
    !ownerEmail.trim() ||
    typeof hasTemporaryDemoSession !== "boolean"
  ) {
    return STRIPE_BILLING_RETRYABLE_ERROR;
  }

  if (
    ownerEmail.trim().toLowerCase() === FIXED_DEMO_EMAIL ||
    hasTemporaryDemoSession
  ) {
    return STRIPE_BILLING_BLOCKED;
  }

  return STRIPE_BILLING_ALLOWED;
}

export function isStripeBillingWorkspaceEligible(input) {
  return stripeBillingWorkspaceDecision(input) === STRIPE_BILLING_ALLOWED;
}

export function stripeBillingPatchDecision({
  responseOk,
  bodyParsed,
  rows,
  workspaceId,
}) {
  if (!responseOk || !bodyParsed || !Array.isArray(rows)) {
    return STRIPE_BILLING_RETRYABLE_ERROR;
  }
  if (
    rows.length === 1 &&
    rows[0] &&
    typeof rows[0] === "object" &&
    rows[0].id === workspaceId
  ) {
    return STRIPE_BILLING_UPDATED;
  }
  if (rows.length === 0) return STRIPE_BILLING_ZERO_ROWS;
  return STRIPE_BILLING_RETRYABLE_ERROR;
}

export function stripeBillingManualSuspensionDecision({
  responseOk,
  bodyParsed,
  rows,
  workspaceId,
}) {
  if (!responseOk || !bodyParsed || !Array.isArray(rows)) {
    return STRIPE_BILLING_RETRYABLE_ERROR;
  }
  if (
    rows.length === 1 &&
    rows[0] &&
    typeof rows[0] === "object" &&
    rows[0].id === workspaceId &&
    rows[0].billing_status === "manual_suspended"
  ) {
    return STRIPE_BILLING_BLOCKED;
  }
  return STRIPE_BILLING_RETRYABLE_ERROR;
}
