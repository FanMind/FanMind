const STRIPE_EVENT_PATTERN = /^evt_[A-Za-z0-9_]+$/u;
const STRIPE_SUBSCRIPTION_PATTERN = /^sub_[A-Za-z0-9_]+$/u;
const STRIPE_ITEM_PATTERN = /^si_[A-Za-z0-9_]+$/u;
const STRIPE_PRICE_PATTERN = /^price_[A-Za-z0-9_]+$/u;

export const AI_TIER_STRIPE_EVENT_TYPES = Object.freeze([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

const STATUS_MAP = Object.freeze({
  active: "active",
  trialing: "pending",
  incomplete: "pending",
  paused: "paused",
  past_due: "paused",
  unpaid: "paused",
  canceled: "canceled",
  incomplete_expired: "expired",
});
const STORED_LIFECYCLE_STATUSES = new Set(Object.values(STATUS_MAP));
const DIAGNOSTIC_REASONS = new Set([
  "workspace_target",
  "price_configuration",
  "event_identity",
  "event_type",
  "subscription",
  "current_state",
  "duplicate_event",
  "stale_event",
  "event_order_conflict",
  "subscription_mismatch",
  "items",
  "unrelated_price",
  "ambiguous_price_items",
  "item_period",
  "subscription_status",
]);

function ignore(reason) {
  return Object.freeze({ decision: "ignore", reason, mutation: null });
}

function retry(reason) {
  return Object.freeze({ decision: "retry", reason, mutation: null });
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function string(value) {
  return typeof value === "string" ? value : null;
}

function safeTimestamp(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function isoFromStripeTimestamp(value) {
  const timestamp = safeTimestamp(value);
  if (timestamp === null) return null;
  const date = new Date(timestamp * 1000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function configuredPrice(value) {
  return typeof value === "string" && STRIPE_PRICE_PATTERN.test(value);
}

function priceConfiguration(environment) {
  const plus = environment?.STRIPE_PRICE_AI_PLUS;
  const ultra = environment?.STRIPE_PRICE_AI_ULTRA;
  if (!configuredPrice(plus) || !configuredPrice(ultra) || plus === ultra) {
    return null;
  }
  return new Map([
    [plus, "plus"],
    [ultra, "ultra"],
  ]);
}

export function getAiTierStripePriceAllowlistStatus(
  environment = process.env,
) {
  const plus = environment?.STRIPE_PRICE_AI_PLUS;
  const ultra = environment?.STRIPE_PRICE_AI_ULTRA;
  const blockers = [];
  if (!configuredPrice(plus)) blockers.push("plus_price");
  if (!configuredPrice(ultra)) blockers.push("ultra_price");
  if (
    configuredPrice(plus) &&
    configuredPrice(ultra) &&
    plus === ultra
  ) {
    blockers.push("duplicate_price");
  }
  return Object.freeze({
    ready: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}

function currentEventState(current) {
  if (current == null) return { status: "missing" };
  if (!record(current)) return { status: "invalid" };
  if (
    !STRIPE_EVENT_PATTERN.test(string(current.lastStripeEventId) ?? "") ||
    safeTimestamp(current.lastStripeEventCreatedAt) === null ||
    !STRIPE_SUBSCRIPTION_PATTERN.test(
      string(current.stripeSubscriptionId) ?? "",
    )
  ) {
    return { status: "invalid" };
  }
  return {
    status: "valid",
    eventId: current.lastStripeEventId,
    eventCreatedAt: current.lastStripeEventCreatedAt,
    subscriptionId: current.stripeSubscriptionId,
  };
}

function currentEntitlementState(current, allowlist) {
  const value = record(current);
  if (!value) return null;

  const tierId = string(value.tierId);
  const status = string(value.status);
  const source = string(value.source);
  const stripeSubscriptionId = string(value.stripeSubscriptionId);
  const stripeSubscriptionItemId = string(value.stripeSubscriptionItemId);
  const stripePriceId = string(value.stripePriceId);
  const effectiveAt = string(value.effectiveAt);

  if (
    (tierId !== "plus" && tierId !== "ultra") ||
    !STORED_LIFECYCLE_STATUSES.has(status) ||
    source !== "stripe" ||
    !STRIPE_SUBSCRIPTION_PATTERN.test(stripeSubscriptionId ?? "") ||
    !STRIPE_ITEM_PATTERN.test(stripeSubscriptionItemId ?? "") ||
    !STRIPE_PRICE_PATTERN.test(stripePriceId ?? "") ||
    allowlist.get(stripePriceId) !== tierId ||
    !effectiveAt ||
    !Number.isFinite(Date.parse(effectiveAt))
  ) {
    return null;
  }

  return {
    tierId,
    status,
    source,
    stripeSubscriptionId,
    stripeSubscriptionItemId,
    stripePriceId,
    effectiveAt,
  };
}

function lifecycleStatus(eventType, subscriptionStatus) {
  if (eventType === "customer.subscription.deleted") return "canceled";
  return STATUS_MAP[subscriptionStatus] ?? null;
}

export function decideAiTierStripeLifecycleEvent({
  event,
  current = null,
  workspaceTargetVerified = false,
  environment = process.env,
} = {}) {
  if (workspaceTargetVerified !== true) return retry("workspace_target");

  const allowlist = priceConfiguration(environment);
  if (!allowlist) return retry("price_configuration");

  const eventRecord = record(event);
  const eventId = string(eventRecord?.id);
  const eventType = string(eventRecord?.type);
  const eventCreatedAt = safeTimestamp(eventRecord?.created);
  if (
    !eventId ||
    !STRIPE_EVENT_PATTERN.test(eventId) ||
    eventCreatedAt === null
  ) {
    return retry("event_identity");
  }
  if (!AI_TIER_STRIPE_EVENT_TYPES.includes(eventType)) {
    return ignore("event_type");
  }

  const subscription = record(record(eventRecord?.data)?.object);
  const subscriptionId = string(subscription?.id);
  if (
    !subscriptionId ||
    !STRIPE_SUBSCRIPTION_PATTERN.test(subscriptionId)
  ) {
    return retry("subscription");
  }

  const existing = currentEventState(current);
  if (existing.status === "invalid") return retry("current_state");
  if (existing.status === "valid") {
    if (existing.eventId === eventId) return ignore("duplicate_event");
    if (eventCreatedAt < existing.eventCreatedAt) {
      return ignore("stale_event");
    }
    if (eventCreatedAt === existing.eventCreatedAt) {
      return retry("event_order_conflict");
    }
    if (existing.subscriptionId !== subscriptionId) {
      return retry("subscription_mismatch");
    }
  }

  const itemCollection = record(subscription?.items);
  const items = itemCollection?.data;
  if (!Array.isArray(items)) return retry("items");
  // Embedded Stripe lists can be truncated. Treating a partial list as proof
  // that the paid add-on disappeared could revoke the wrong entitlement. The
  // explicit false also prevents a malformed/changed provider payload from
  // silently becoming proof of a complete list.
  if (itemCollection?.has_more !== false) return retry("items");
  const matches = items.flatMap((candidate) => {
    const item = record(candidate);
    const priceId = string(record(item?.price)?.id);
    const tierId = priceId ? allowlist.get(priceId) : null;
    return tierId ? [{ item, priceId, tierId }] : [];
  });
  if (matches.length === 0) {
    if (existing.status !== "valid") return ignore("unrelated_price");
    if (
      eventType !== "customer.subscription.updated" &&
      eventType !== "customer.subscription.deleted"
    ) {
      return retry("current_state");
    }

    // A newer event for the same subscription with no allowlisted item means
    // the previously stored add-on was removed. Preserve its identifiers and
    // the latest Stripe event boundary, but make it immediately ineligible.
    // Keeping the row (rather than deleting it) makes replay/stale-event
    // protection durable with the existing schema.
    const currentEntitlement = currentEntitlementState(current, allowlist);
    if (!currentEntitlement) return retry("current_state");
    const removedAt = isoFromStripeTimestamp(eventCreatedAt);
    const expiresAt =
      removedAt &&
      Date.parse(removedAt) > Date.parse(currentEntitlement.effectiveAt)
        ? removedAt
        : null;

    return Object.freeze({
      decision: "apply",
      reason: null,
      mutation: Object.freeze({
        tierId: currentEntitlement.tierId,
        status: "canceled",
        source: "stripe",
        stripeSubscriptionId: currentEntitlement.stripeSubscriptionId,
        stripeSubscriptionItemId:
          currentEntitlement.stripeSubscriptionItemId,
        stripePriceId: currentEntitlement.stripePriceId,
        effectiveAt: currentEntitlement.effectiveAt,
        expiresAt,
        lastStripeEventId: eventId,
        lastStripeEventCreatedAt: eventCreatedAt,
      }),
    });
  }
  if (matches.length !== 1) return retry("ambiguous_price_items");

  const { item, priceId, tierId } = matches[0];
  const subscriptionItemId = string(item.id);
  const effectiveAt = isoFromStripeTimestamp(item.current_period_start);
  const periodEnd = isoFromStripeTimestamp(item.current_period_end);
  if (
    !subscriptionItemId ||
    !STRIPE_ITEM_PATTERN.test(subscriptionItemId) ||
    !effectiveAt ||
    !periodEnd ||
    Date.parse(periodEnd) <= Date.parse(effectiveAt)
  ) {
    return retry("item_period");
  }

  const status = lifecycleStatus(eventType, string(subscription.status));
  if (!status) return retry("subscription_status");
  const expiresAt =
    status === "canceled" ||
    status === "expired" ||
    subscription.cancel_at_period_end === true
      ? periodEnd
      : null;

  return Object.freeze({
    decision: "apply",
    reason: null,
    mutation: Object.freeze({
      tierId,
      status,
      source: "stripe",
      stripeSubscriptionId: subscriptionId,
      stripeSubscriptionItemId: subscriptionItemId,
      stripePriceId: priceId,
      effectiveAt,
      expiresAt,
      lastStripeEventId: eventId,
      lastStripeEventCreatedAt: eventCreatedAt,
    }),
  });
}

export function redactAiTierStripeLifecycleDecision(result) {
  const decision =
    result?.decision === "apply" ||
    result?.decision === "ignore" ||
    result?.decision === "retry"
      ? result.decision
      : "retry";
  return Object.freeze({
    decision,
    reason:
      decision === "apply"
        ? null
        : DIAGNOSTIC_REASONS.has(result?.reason)
          ? result.reason
          : "invalid_result",
    tierId:
      result?.decision === "apply" &&
      (result?.mutation?.tierId === "plus" ||
        result?.mutation?.tierId === "ultra")
        ? result.mutation.tierId
        : null,
  });
}
