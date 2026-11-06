import { createHash } from "node:crypto";

import {
  decideAiTierStripeLifecycleEvent,
  redactAiTierStripeLifecycleDecision,
} from "./aiTierStripeLifecycle.mjs";

const STRIPE_CUSTOMER_PATTERN = /^cus_[A-Za-z0-9_]+$/u;
const RPC_RESULTS = new Map([
  ["applied", new Set([null])],
  ["ignored", new Set(["duplicate_event", "stale_event", "unrelated_price"])],
  [
    "reconciliation_needed",
    new Set([
      "event_identity",
      "event_order_conflict",
      "reconciliation_pending",
      "subscription_mismatch",
    ]),
  ],
]);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function string(value) {
  return typeof value === "string" ? value : null;
}

function stripeReference(value, pattern) {
  const candidate =
    string(value) ?? string(record(value)?.id);
  return candidate && pattern.test(candidate) ? candidate : null;
}

function commandResult(status, reason = null, command = null) {
  return Object.freeze({ status, reason, command });
}

function paidItemFromMutation(mutation) {
  if (!mutation) return null;
  return Object.freeze({
    tierId: mutation.tierId,
    lifecycleStatus: mutation.status,
    subscriptionItemId: mutation.stripeSubscriptionItemId,
    priceId: mutation.stripePriceId,
    effectiveAt: mutation.effectiveAt,
    expiresAt: mutation.expiresAt,
  });
}

function fingerprint(command) {
  // Hash only the normalized, server-validated Stripe projection. The raw
  // signed body can contain customer data and must not be persisted here.
  const paidItem = command.paidItem;
  const canonical = JSON.stringify([
    command.eventId,
    command.eventCreatedAt,
    command.eventType,
    command.customerId,
    command.subscriptionId,
    paidItem?.tierId ?? null,
    paidItem?.lifecycleStatus ?? null,
    paidItem?.subscriptionItemId ?? null,
    paidItem?.priceId ?? null,
    paidItem?.effectiveAt ?? null,
    paidItem?.expiresAt ?? null,
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

export function buildAiTierStripeLedgerCommand({
  workspaceId,
  event,
  signedEventVerified = false,
  environment = process.env,
} = {}) {
  if (signedEventVerified !== true) {
    return commandResult("retry", "signature_verification");
  }

  const eventRecord = record(event);
  const subscription = record(record(eventRecord?.data)?.object);
  const customerId = stripeReference(
    subscription?.customer,
    STRIPE_CUSTOMER_PATTERN,
  );
  if (!customerId) return commandResult("retry", "tenant_binding");

  const decision = decideAiTierStripeLifecycleEvent({
    event,
    current: null,
    workspaceTargetVerified: true,
    environment,
  });
  const redacted = redactAiTierStripeLifecycleDecision(decision);
  if (decision.decision === "retry") {
    return commandResult("retry", redacted.reason);
  }
  if (
    decision.decision === "ignore" &&
    decision.reason !== "unrelated_price"
  ) {
    return commandResult("ignored", redacted.reason);
  }

  const command = {
    workspaceId,
    eventId: eventRecord.id,
    eventCreatedAt: eventRecord.created,
    eventType: eventRecord.type,
    customerId,
    subscriptionId: subscription.id,
    paidItem: paidItemFromMutation(decision.mutation),
  };
  command.payloadFingerprint = fingerprint(command);

  return commandResult(
    "record",
    decision.reason === "unrelated_price" ? "unrelated_price" : null,
    Object.freeze(command),
  );
}

export function buildAiTierStripeLedgerRpcBody(command) {
  const value = record(command);
  const paidItem = record(value?.paidItem);
  return {
    p_workspace_id: value?.workspaceId ?? null,
    p_signature_verified: true,
    p_event_id: value?.eventId ?? null,
    p_event_created_at: value?.eventCreatedAt ?? null,
    p_event_type: value?.eventType ?? null,
    p_customer_id: value?.customerId ?? null,
    p_subscription_id: value?.subscriptionId ?? null,
    p_payload_fingerprint: value?.payloadFingerprint ?? null,
    p_has_paid_item: Boolean(paidItem),
    p_tier_id: paidItem?.tierId ?? null,
    p_lifecycle_status: paidItem?.lifecycleStatus ?? null,
    p_subscription_item_id: paidItem?.subscriptionItemId ?? null,
    p_price_id: paidItem?.priceId ?? null,
    p_effective_at: paidItem?.effectiveAt ?? null,
    p_expires_at: paidItem?.expiresAt ?? null,
  };
}

export function normalizeAiTierStripeLedgerRpcResult(payload) {
  if (!Array.isArray(payload) || payload.length !== 1) return null;
  const row = record(payload[0]);
  const status = string(row?.result_status);
  const reason = row?.result_reason == null ? null : string(row.result_reason);
  const revision = row?.result_revision;
  if (
    !status ||
    !RPC_RESULTS.get(status)?.has(reason) ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  ) {
    return null;
  }
  return Object.freeze({ status, reason, revision });
}
