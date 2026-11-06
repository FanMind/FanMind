import { randomBytes } from "node:crypto";

import {
  NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
  evaluateEnvironmentBoundary,
} from "./environmentBoundaryPolicy.mjs";
import {
  decideAiTierStripeLifecycleEvent,
  getAiTierStripePriceAllowlistStatus,
} from "./aiTierStripeLifecycle.mjs";
import { isStripeTestSecretKey } from "./stripeKeyPolicy.mjs";

export const AI_TIER_STAGING_ACCEPTANCE_CONFIRMATION =
  "run-ai-tier-staging-acceptance";
export const AI_TIER_STAGING_RESOURCE_CONFIRMATION =
  "verify-ai-tier-staging-resources";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const STRIPE_ID_PATTERN = /^(?:evt|sub|si|price)_[A-Za-z0-9_]+$/u;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function isAiTierStagingWorkspaceId(value) {
  return UUID_PATTERN.test(clean(value).toLowerCase());
}

export function evaluateAiTierStagingAcceptanceEnvironment(
  environment = {},
) {
  const errors = [];
  const boundary = evaluateEnvironmentBoundary(environment, {
    allowWrite: true,
  });
  errors.push(...boundary.errors.map(() => "environment_boundary"));

  if (boundary.runtimeEnvironment !== "staging") {
    errors.push("runtime_environment");
  }
  if (boundary.appProduction || boundary.supabaseProductionMatch) {
    errors.push("production_target");
  }
  if (
    !boundary.supabaseTargetRefMatchesUrl ||
    boundary.supabaseTargetRefMismatch
  ) {
    errors.push("supabase_target_binding");
  }
  if (
    clean(environment.FANMIND_NON_PRODUCTION_WRITE_ACK) !==
    NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT
  ) {
    errors.push("write_acknowledgement");
  }
  if (
    clean(environment.FANMIND_AI_TIER_STAGING_ACCEPTANCE_CONFIRM) !==
    AI_TIER_STAGING_ACCEPTANCE_CONFIRMATION
  ) {
    errors.push("acceptance_confirmation");
  }
  if (
    !isAiTierStagingWorkspaceId(
      environment.FANMIND_AI_TIER_STAGING_WORKSPACE_ID,
    )
  ) {
    errors.push("synthetic_workspace");
  }
  if (!isStripeTestSecretKey(environment.STRIPE_SECRET_KEY)) {
    errors.push("stripe_test_mode");
  }

  const priceAllowlist =
    getAiTierStripePriceAllowlistStatus(environment);
  if (!priceAllowlist.ready) {
    errors.push("stripe_price_allowlist");
  }

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze([...new Set(errors)]),
  });
}

export function evaluateAiTierStagingResourceEnvironment(
  environment = {},
) {
  const errors = [];
  const boundary = evaluateEnvironmentBoundary(environment, {
    allowWrite: false,
  });
  errors.push(...boundary.errors.map(() => "environment_boundary"));

  if (boundary.runtimeEnvironment !== "staging") {
    errors.push("runtime_environment");
  }
  if (boundary.appProduction || boundary.supabaseProductionMatch) {
    errors.push("production_target");
  }
  if (
    !boundary.supabaseTargetRefMatchesUrl ||
    boundary.supabaseTargetRefMismatch
  ) {
    errors.push("supabase_target_binding");
  }
  if (
    clean(environment.FANMIND_AI_TIER_STAGING_RESOURCE_CONFIRM) !==
    AI_TIER_STAGING_RESOURCE_CONFIRMATION
  ) {
    errors.push("resource_confirmation");
  }
  if (
    !isAiTierStagingWorkspaceId(
      environment.FANMIND_AI_TIER_STAGING_WORKSPACE_ID,
    )
  ) {
    errors.push("synthetic_workspace");
  }
  if (!isStripeTestSecretKey(environment.STRIPE_SECRET_KEY)) {
    errors.push("stripe_test_mode");
  }

  const priceAllowlist =
    getAiTierStripePriceAllowlistStatus(environment);
  if (!priceAllowlist.ready) {
    errors.push("stripe_price_allowlist");
  }

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze([...new Set(errors)]),
  });
}

export function validateAiTierStripeTestPrice(
  payload,
  { expectedId, expectedUnitAmount },
) {
  const product =
    payload?.product &&
    typeof payload.product === "object" &&
    !Array.isArray(payload.product)
      ? payload.product
      : null;
  return Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      payload.object === "price" &&
      payload.id === expectedId &&
      payload.livemode === false &&
      payload.active === true &&
      payload.type === "recurring" &&
      payload.currency === "eur" &&
      payload.unit_amount === expectedUnitAmount &&
      payload.recurring?.interval === "month" &&
      payload.recurring?.interval_count === 1 &&
      product?.object === "product" &&
      product.active === true &&
      product.livemode === false,
  );
}

function syntheticId(prefix, suffix) {
  return `${prefix}_fanmind_staging_${suffix}`;
}

function syntheticStripeEvent({
  id,
  created,
  subscriptionId,
  subscriptionItemId,
  priceId,
}) {
  return {
    id,
    created,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: subscriptionId,
        status: "active",
        cancel_at_period_end: false,
        items: {
          has_more: false,
          data: [
            {
              id: subscriptionItemId,
              current_period_start: created - 86_400,
              current_period_end: created + 2_592_000,
              price: { id: priceId },
            },
          ],
        },
      },
    },
  };
}

export function buildAiTierSyntheticLifecycleProof(
  environment,
  {
    eventCreatedAt = Math.floor(Date.now() / 1000),
    nonce = randomBytes(12).toString("hex"),
  } = {},
) {
  if (
    !Number.isSafeInteger(eventCreatedAt) ||
    eventCreatedAt < 86_400 ||
    !/^[a-f0-9]{8,64}$/u.test(nonce)
  ) {
    return Object.freeze({ ok: false, mutation: null });
  }

  const subscriptionId = syntheticId("sub", nonce);
  const plusEvent = syntheticStripeEvent({
    id: syntheticId("evt", `${nonce}_plus`),
    created: eventCreatedAt,
    subscriptionId,
    subscriptionItemId: syntheticId("si", `${nonce}_plus`),
    priceId: environment?.STRIPE_PRICE_AI_PLUS,
  });
  const plus = decideAiTierStripeLifecycleEvent({
    event: plusEvent,
    workspaceTargetVerified: true,
    environment,
  });
  if (plus.decision !== "apply" || plus.mutation?.tierId !== "plus") {
    return Object.freeze({ ok: false, mutation: null });
  }

  const current = {
    stripeSubscriptionId: plus.mutation.stripeSubscriptionId,
    lastStripeEventId: plus.mutation.lastStripeEventId,
    lastStripeEventCreatedAt: plus.mutation.lastStripeEventCreatedAt,
  };
  const duplicate = decideAiTierStripeLifecycleEvent({
    event: plusEvent,
    current,
    workspaceTargetVerified: true,
    environment,
  });
  const stale = decideAiTierStripeLifecycleEvent({
    event: {
      ...plusEvent,
      id: syntheticId("evt", `${nonce}_stale`),
      created: eventCreatedAt - 1,
    },
    current,
    workspaceTargetVerified: true,
    environment,
  });
  const collision = decideAiTierStripeLifecycleEvent({
    event: {
      ...plusEvent,
      id: syntheticId("evt", `${nonce}_collision`),
    },
    current,
    workspaceTargetVerified: true,
    environment,
  });
  const ultra = decideAiTierStripeLifecycleEvent({
    event: syntheticStripeEvent({
      id: syntheticId("evt", `${nonce}_ultra`),
      created: eventCreatedAt + 1,
      subscriptionId,
      subscriptionItemId: syntheticId("si", `${nonce}_ultra`),
      priceId: environment?.STRIPE_PRICE_AI_ULTRA,
    }),
    current,
    workspaceTargetVerified: true,
    environment,
  });

  if (
    duplicate.decision !== "ignore" ||
    duplicate.reason !== "duplicate_event" ||
    stale.decision !== "ignore" ||
    stale.reason !== "stale_event" ||
    collision.decision !== "retry" ||
    collision.reason !== "event_order_conflict" ||
    ultra.decision !== "apply" ||
    ultra.mutation?.tierId !== "ultra"
  ) {
    return Object.freeze({ ok: false, mutation: null });
  }

  const mutation = plus.mutation;
  if (
    ![
      mutation.stripeSubscriptionId,
      mutation.stripeSubscriptionItemId,
      mutation.stripePriceId,
      mutation.lastStripeEventId,
    ].every((value) => STRIPE_ID_PATTERN.test(value))
  ) {
    return Object.freeze({ ok: false, mutation: null });
  }

  return Object.freeze({ ok: true, mutation });
}
