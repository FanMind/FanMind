import { createHash } from "node:crypto";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EVENT_PATTERN = /^evt_[A-Za-z0-9_]+$/u;

const EVENT_CONTRACTS = new Map([
  ["checkout.session.completed", ["lifecycle", "checkout"]],
  ["checkout.session.async_payment_succeeded", ["lifecycle", "checkout"]],
  ["checkout.session.async_payment_failed", ["lifecycle", "checkout"]],
  ["payment_intent.processing", ["lifecycle", "customer_transaction"]],
  ["payment_intent.succeeded", ["lifecycle", "customer_transaction"]],
  ["payment_intent.payment_failed", ["lifecycle", "customer_transaction"]],
  ["invoice.paid", ["lifecycle", "customer_subscription"]],
  ["invoice.updated", ["lifecycle", "customer_subscription"]],
  ["invoice.payment_failed", ["lifecycle", "customer_subscription"]],
  ["customer.subscription.created", ["lifecycle", "customer_subscription"]],
  ["customer.subscription.updated", ["lifecycle", "customer_subscription"]],
  ["customer.subscription.resumed", ["lifecycle", "customer_subscription"]],
  ["customer.subscription.paused", ["lifecycle", "customer_subscription"]],
  ["customer.subscription.deleted", ["lifecycle", "customer_subscription"]],
  ["charge.refunded", ["lifecycle", "reversal"]],
  ["refund.created", ["lifecycle", "reversal"]],
  ["refund.updated", ["lifecycle", "reversal"]],
  ["refund.failed", ["lifecycle", "reversal"]],
  ["charge.dispute.created", ["lifecycle", "reversal"]],
  ["customer.tax_id.created", ["tax", "tax"]],
  ["customer.tax_id.updated", ["tax", "tax"]],
  ["customer.tax_id.deleted", ["tax", "tax"]],
]);

const REFERENCE_PATTERNS = Object.freeze({
  customerId: /^cus_[A-Za-z0-9_]+$/u,
  subscriptionId: /^sub_[A-Za-z0-9_]+$/u,
  checkoutSessionId: /^cs_[A-Za-z0-9_]+$/u,
  paymentIntentId: /^pi_[A-Za-z0-9_]+$/u,
  invoiceId: /^in_[A-Za-z0-9_]+$/u,
  chargeId: /^ch_[A-Za-z0-9_]+$/u,
  refundId: /^re_[A-Za-z0-9_]+$/u,
  disputeId: /^dp_[A-Za-z0-9_]+$/u,
  taxId: /^txi_[A-Za-z0-9_]+$/u,
});

const STRING_PROJECTION_FIELDS = new Set([
  "billing_status",
  "workspace_access_mode",
  "billing_suspended_reason",
  "billing_note",
  "stripe_customer_id",
  "stripe_subscription_id",
  "stripe_checkout_session_id",
  "stripe_payment_intent_id",
  "stripe_mandate_id",
  "last_invoice_id",
  "last_invoice_status",
  "last_invoice_hosted_url",
  "last_invoice_pdf_url",
]);
const TIMESTAMP_PROJECTION_FIELDS = new Set([
  "billing_last_payment_at",
  "billing_last_payment_failed_at",
  "billing_next_retry_at",
  "billing_grace_until",
  "billing_suspended_at",
  "billing_contract_started_at",
  "billing_current_period_end_at",
  "billing_next_invoice_at",
  "subscription_effective_end_at",
  "subscription_cancel_requested_at",
]);
const INTEGER_PROJECTION_FIELDS = new Set([
  "billing_retry_count",
  "last_invoice_amount_due_cents",
  "last_invoice_amount_paid_cents",
]);
const BOOLEAN_PROJECTION_FIELDS = new Set([
  "subscription_cancel_at_period_end",
]);
const PROJECTION_FIELDS = new Set([
  ...STRING_PROJECTION_FIELDS,
  ...TIMESTAMP_PROJECTION_FIELDS,
  ...INTEGER_PROJECTION_FIELDS,
  ...BOOLEAN_PROJECTION_FIELDS,
]);

const RESULT_CONTRACT = new Map([
  ["applied", new Set([null])],
  [
    "ignored",
    new Set([
      "duplicate_event",
      "reconciled_event",
      "stale_event",
      "protected_workspace",
    ]),
  ],
  [
    "reconciliation_needed",
    new Set([
      "event_identity_conflict",
      "event_order_conflict",
      "reconciliation_pending",
      "tenant_binding_conflict",
      "terminal_subscription_conflict",
    ]),
  ],
  ["unresolved", new Set(["tenant_binding_missing", "object_binding_missing"])],
]);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function string(value) {
  return typeof value === "string" ? value : null;
}

function objectField(object, key) {
  return record(record(object)?.[key]);
}

function arrayField(object, key) {
  const value = record(object)?.[key];
  return Array.isArray(value) ? value : [];
}

function stripeReference(value, pattern) {
  const candidate = string(value) ?? string(record(value)?.id);
  return candidate && pattern.test(candidate) ? candidate : null;
}

function prefixedObjectId(object, pattern) {
  return stripeReference(record(object)?.id, pattern);
}

function metadataWorkspaceCandidate(object) {
  return objectField(object, "metadata")?.workspace_id;
}

function directWorkspaceCandidates(object) {
  const lines = objectField(object, "lines");
  return [
    metadataWorkspaceCandidate(object),
    record(object)?.client_reference_id,
    metadataWorkspaceCandidate(objectField(object, "subscription_details")),
    metadataWorkspaceCandidate(
      objectField(objectField(object, "parent"), "subscription_details"),
    ),
    metadataWorkspaceCandidate(objectField(object, "payment_intent_data")),
    ...arrayField(lines, "data").map((line) =>
      metadataWorkspaceCandidate(line),
    ),
  ].filter((value) => value !== null && value !== undefined);
}

function normalizedWorkspaceHint(object) {
  const candidates = directWorkspaceCandidates(object);
  if (
    candidates.some(
      (candidate) =>
        typeof candidate !== "string" || !UUID_PATTERN.test(candidate),
    )
  ) {
    return { workspaceIdCandidate: null, workspaceCandidateConflict: true };
  }
  const unique = [...new Set(candidates)];
  return unique.length <= 1
    ? {
        workspaceIdCandidate: unique[0] ?? null,
        workspaceCandidateConflict: false,
      }
    : { workspaceIdCandidate: null, workspaceCandidateConflict: true };
}

function referencesForEvent(object, eventType) {
  const charge = objectField(object, "charge");
  const parentSubscriptionDetails = objectField(
    objectField(object, "parent"),
    "subscription_details",
  );
  const customerId = stripeReference(
    record(object)?.customer ?? charge?.customer,
    REFERENCE_PATTERNS.customerId,
  );
  const paymentIntentId = stripeReference(
    record(object)?.payment_intent ?? charge?.payment_intent,
    REFERENCE_PATTERNS.paymentIntentId,
  );

  return Object.freeze({
    customerId:
      customerId ??
      (eventType?.startsWith("customer.tax_id.")
        ? stripeReference(
            record(object)?.customer,
            REFERENCE_PATTERNS.customerId,
          )
        : null),
    subscriptionId:
      stripeReference(
        record(object)?.subscription ?? parentSubscriptionDetails?.subscription,
        REFERENCE_PATTERNS.subscriptionId,
      ) ??
      (eventType?.startsWith("customer.subscription.")
        ? prefixedObjectId(object, REFERENCE_PATTERNS.subscriptionId)
        : null),
    checkoutSessionId: eventType?.startsWith("checkout.session.")
      ? prefixedObjectId(object, REFERENCE_PATTERNS.checkoutSessionId)
      : null,
    paymentIntentId:
      paymentIntentId ??
      (eventType?.startsWith("payment_intent.")
        ? prefixedObjectId(object, REFERENCE_PATTERNS.paymentIntentId)
        : null),
    invoiceId: eventType?.startsWith("invoice.")
      ? prefixedObjectId(object, REFERENCE_PATTERNS.invoiceId)
      : null,
    chargeId:
      (eventType === "charge.refunded"
        ? prefixedObjectId(object, REFERENCE_PATTERNS.chargeId)
        : stripeReference(
            record(object)?.charge,
            REFERENCE_PATTERNS.chargeId,
          )) ?? null,
    refundId: eventType?.startsWith("refund.")
      ? prefixedObjectId(object, REFERENCE_PATTERNS.refundId)
      : null,
    disputeId: eventType === "charge.dispute.created"
      ? prefixedObjectId(object, REFERENCE_PATTERNS.disputeId)
      : null,
    taxId: eventType?.startsWith("customer.tax_id.")
      ? prefixedObjectId(object, REFERENCE_PATTERNS.taxId)
      : null,
  });
}

function validIsoTimestamp(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

export function normalizeStripeBillingProjection(fields) {
  const value = record(fields);
  if (!value) return null;
  const projection = {};
  for (const key of Object.keys(value).sort()) {
    const fieldValue = value[key];
    if (fieldValue === undefined) continue;
    if (!PROJECTION_FIELDS.has(key)) return null;
    if (fieldValue === null) {
      projection[key] = null;
      continue;
    }
    if (
      STRING_PROJECTION_FIELDS.has(key) &&
      typeof fieldValue === "string" &&
      fieldValue.length <= 4_096
    ) {
      projection[key] = fieldValue;
      continue;
    }
    if (
      TIMESTAMP_PROJECTION_FIELDS.has(key) &&
      validIsoTimestamp(fieldValue)
    ) {
      projection[key] = new Date(fieldValue).toISOString();
      continue;
    }
    if (
      INTEGER_PROJECTION_FIELDS.has(key) &&
      Number.isSafeInteger(fieldValue) &&
      fieldValue >= 0 &&
      fieldValue <= 2_147_483_647
    ) {
      projection[key] = fieldValue;
      continue;
    }
    if (
      BOOLEAN_PROJECTION_FIELDS.has(key) &&
      typeof fieldValue === "boolean"
    ) {
      projection[key] = fieldValue;
      continue;
    }
    return null;
  }
  return Object.freeze(projection);
}

function projectionMatchesEventContract(eventType, projection) {
  if (!eventType?.startsWith("customer.tax_id.")) return true;
  return Object.keys(projection).every((key) => key === "billing_note");
}

function fingerprint(command) {
  // The signed raw body is never stored. Only the normalized, allowlisted
  // projection and provider references participate in the replay identity.
  return createHash("sha256")
    .update(
      JSON.stringify([
        command.eventId,
        command.eventCreatedAt,
        command.eventType,
        command.stream,
        command.bindingMode,
        command.workspaceIdCandidate,
        command.workspaceCandidateConflict,
        ...Object.keys(command.references)
          .sort()
          .map((key) => command.references[key]),
        Object.entries(command.projection),
        command.referralBillingStatus,
      ]),
    )
    .digest("hex");
}

function result(status, reason = null, command = null) {
  return Object.freeze({ status, reason, command });
}

export function isStripeBillingEventLedgerEnabled(environment = process.env) {
  return (
    isStripeBillingEventLedgerCaptureEnabled(environment) &&
    environment?.FANMIND_STRIPE_BILLING_CANONICAL_RECONCILIATION_CONFIRMED ===
      "true"
  );
}

export function isStripeBillingEventLedgerCaptureEnabled(
  environment = process.env,
) {
  return (
    environment?.FANMIND_STRIPE_BILLING_EVENT_LEDGER_ENABLED === "true" &&
    environment?.FANMIND_STRIPE_BILLING_EVENT_LEDGER_CONTROL_CONFIRMED ===
      "20260816210000"
  );
}

export function buildStripeBillingLedgerCommand({
  event,
  projection: projectionInput,
  referralBillingStatus = null,
  signedEventVerified = false,
} = {}) {
  if (signedEventVerified !== true) {
    return result("retry", "signature_verification");
  }
  const eventRecord = record(event);
  const eventId = string(eventRecord?.id);
  const eventType = string(eventRecord?.type);
  const eventCreatedAt = eventRecord?.created;
  const contract = EVENT_CONTRACTS.get(eventType);
  const object = objectField(eventRecord?.data, "object") ?? {};
  const projection = normalizeStripeBillingProjection(projectionInput);
  if (
    !eventId ||
    !EVENT_PATTERN.test(eventId) ||
    !contract ||
    !Number.isSafeInteger(eventCreatedAt) ||
    eventCreatedAt < 0 ||
    !projection ||
    !projectionMatchesEventContract(eventType, projection) ||
    !(
      referralBillingStatus === null ||
      (typeof referralBillingStatus === "string" &&
        referralBillingStatus.length <= 64)
    )
  ) {
    return result("retry", "event_payload");
  }

  const [stream, bindingMode] = contract;
  const references = referencesForEvent(object, eventType);
  const workspaceHint = normalizedWorkspaceHint(object);
  const command = {
    eventId,
    eventCreatedAt,
    eventType,
    stream,
    bindingMode,
    ...workspaceHint,
    references,
    projection,
    referralBillingStatus,
  };
  command.payloadFingerprint = fingerprint(command);
  return result("record", null, Object.freeze(command));
}

export function buildStripeBillingLedgerRpcBody(
  command,
  { projectionEnabled = false } = {},
) {
  const value = record(command) ?? {};
  const references = record(value.references) ?? {};
  return {
    p_signature_verified: true,
    p_projection_enabled: projectionEnabled === true,
    p_event_id: value.eventId ?? null,
    p_event_created_at: value.eventCreatedAt ?? null,
    p_event_type: value.eventType ?? null,
    p_event_stream: value.stream ?? null,
    p_binding_mode: value.bindingMode ?? null,
    p_workspace_id_candidate: value.workspaceIdCandidate ?? null,
    p_workspace_candidate_conflict:
      value.workspaceCandidateConflict === true,
    p_customer_id: references.customerId ?? null,
    p_subscription_id: references.subscriptionId ?? null,
    p_checkout_session_id: references.checkoutSessionId ?? null,
    p_payment_intent_id: references.paymentIntentId ?? null,
    p_invoice_id: references.invoiceId ?? null,
    p_charge_id: references.chargeId ?? null,
    p_refund_id: references.refundId ?? null,
    p_dispute_id: references.disputeId ?? null,
    p_tax_id: references.taxId ?? null,
    p_payload_fingerprint: value.payloadFingerprint ?? null,
    p_projection: value.projection ?? null,
  };
}

export function normalizeStripeBillingLedgerRpcResult(payload) {
  if (!Array.isArray(payload) || payload.length !== 1) return null;
  const row = record(payload[0]);
  const status = string(row?.result_status);
  const reason = row?.result_reason == null ? null : string(row.result_reason);
  const workspaceId = row?.result_workspace_id == null
    ? null
    : string(row.result_workspace_id);
  const revision = row?.result_revision;
  if (
    !status ||
    !RESULT_CONTRACT.get(status)?.has(reason) ||
    (workspaceId !== null && !UUID_PATTERN.test(workspaceId)) ||
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    ((status === "applied" || status === "ignored") && !workspaceId)
  ) {
    return null;
  }
  return Object.freeze({ status, reason, workspaceId, revision });
}

export const STRIPE_BILLING_LEDGER_EVENT_TYPES = Object.freeze([
  ...EVENT_CONTRACTS.keys(),
]);

export const STRIPE_BILLING_LEDGER_PROJECTION_FIELDS = Object.freeze([
  ...PROJECTION_FIELDS,
].sort());
