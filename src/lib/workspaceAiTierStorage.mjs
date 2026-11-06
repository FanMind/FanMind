const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const STRIPE_SUBSCRIPTION_PATTERN = /^sub_[A-Za-z0-9_]+$/u;
const STRIPE_ITEM_PATTERN = /^si_[A-Za-z0-9_]+$/u;
const STRIPE_PRICE_PATTERN = /^price_[A-Za-z0-9_]+$/u;
const STRIPE_EVENT_PATTERN = /^evt_[A-Za-z0-9_]+$/u;
const PAID_TIERS = new Set(["plus", "ultra"]);
const LIFECYCLE_STATUSES = new Set([
  "active",
  "pending",
  "paused",
  "canceled",
  "expired",
]);

function unavailable(reason) {
  return Object.freeze({
    status: "unavailable",
    reason,
    entitlement: null,
  });
}

function validInstant(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function isWorkspaceAiTierStorageWorkspaceId(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function unavailableWorkspaceAiTierStorage(reason) {
  return unavailable(reason);
}

export function normalizeWorkspaceAiTierStorageRows(
  payload,
  expectedWorkspaceId,
) {
  if (!isWorkspaceAiTierStorageWorkspaceId(expectedWorkspaceId)) {
    return unavailable("invalid_workspace");
  }
  if (!Array.isArray(payload)) return unavailable("invalid_payload");
  if (payload.length === 0) {
    return Object.freeze({
      status: "not_found",
      reason: null,
      entitlement: null,
    });
  }
  if (payload.length !== 1) return unavailable("ambiguous_rows");

  const row = payload[0];
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return unavailable("invalid_row");
  }

  const expiresAt = row.expires_at == null ? null : row.expires_at;
  const eventCreatedAt =
    typeof row.last_stripe_event_created_at === "number"
      ? row.last_stripe_event_created_at
      : Number.NaN;
  const syncRevision =
    typeof row.stripe_sync_revision === "number"
      ? row.stripe_sync_revision
      : Number.NaN;

  if (
    row.workspace_id !== expectedWorkspaceId ||
    !PAID_TIERS.has(row.tier_id) ||
    !LIFECYCLE_STATUSES.has(row.status) ||
    row.source !== "stripe" ||
    typeof row.stripe_subscription_id !== "string" ||
    !STRIPE_SUBSCRIPTION_PATTERN.test(row.stripe_subscription_id) ||
    typeof row.stripe_subscription_item_id !== "string" ||
    !STRIPE_ITEM_PATTERN.test(row.stripe_subscription_item_id) ||
    typeof row.stripe_price_id !== "string" ||
    !STRIPE_PRICE_PATTERN.test(row.stripe_price_id) ||
    typeof row.last_stripe_event_id !== "string" ||
    !STRIPE_EVENT_PATTERN.test(row.last_stripe_event_id) ||
    !Number.isSafeInteger(eventCreatedAt) ||
    eventCreatedAt < 0 ||
    row.stripe_sync_state !== "in_sync" ||
    !Number.isSafeInteger(syncRevision) ||
    syncRevision < 1 ||
    !validInstant(row.effective_at) ||
    (expiresAt !== null && !validInstant(expiresAt)) ||
    (expiresAt !== null &&
      Date.parse(expiresAt) <= Date.parse(row.effective_at))
  ) {
    return unavailable("invalid_row");
  }

  return Object.freeze({
    status: "found",
    reason: null,
    entitlement: Object.freeze({
      tierId: row.tier_id,
      status: row.status,
      source: "stripe",
      effectiveAt: row.effective_at,
      expiresAt,
      stripeSubscriptionItemLinked: true,
      serverOwned: true,
    }),
  });
}
