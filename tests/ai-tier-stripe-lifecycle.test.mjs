import assert from "node:assert/strict";
import test from "node:test";

import {
  decideAiTierStripeLifecycleEvent,
  getAiTierStripePriceAllowlistStatus,
  redactAiTierStripeLifecycleDecision,
} from "../src/lib/aiTierStripeLifecycle.mjs";

const environment = {
  STRIPE_PRICE_AI_PLUS: "price_plus_DO_NOT_PRINT",
  STRIPE_PRICE_AI_ULTRA: "price_ultra_DO_NOT_PRINT",
};

function stripeEvent(overrides = {}) {
  return {
    id: "evt_current_DO_NOT_PRINT",
    created: 1_753_056_000,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_current_DO_NOT_PRINT",
        status: "active",
        cancel_at_period_end: false,
        items: {
          has_more: false,
          data: [
            {
              id: "si_current_DO_NOT_PRINT",
              current_period_start: 1_751_328_000,
              current_period_end: 1_754_006_400,
              price: { id: environment.STRIPE_PRICE_AI_PLUS },
            },
          ],
        },
      },
    },
    ...overrides,
  };
}

function decide(overrides = {}) {
  return decideAiTierStripeLifecycleEvent({
    event: stripeEvent(),
    current: null,
    workspaceTargetVerified: true,
    environment,
    ...overrides,
  });
}

test("AI tier Stripe price allowlist is complete, distinct and redacted", () => {
  assert.deepEqual(getAiTierStripePriceAllowlistStatus(environment), {
    ready: true,
    blockers: [],
  });
  assert.deepEqual(getAiTierStripePriceAllowlistStatus({}), {
    ready: false,
    blockers: ["plus_price", "ultra_price"],
  });
  assert.deepEqual(
    getAiTierStripePriceAllowlistStatus({
      STRIPE_PRICE_AI_PLUS: "price_same_DO_NOT_PRINT",
      STRIPE_PRICE_AI_ULTRA: "price_same_DO_NOT_PRINT",
    }),
    {
      ready: false,
      blockers: ["duplicate_price"],
    },
  );
  assert.doesNotMatch(
    JSON.stringify(getAiTierStripePriceAllowlistStatus(environment)),
    /DO_NOT_PRINT/u,
  );
});

test("verified supported price builds one internal entitlement mutation", () => {
  const result = decide();
  assert.equal(result.decision, "apply");
  assert.deepEqual(result.mutation, {
    tierId: "plus",
    status: "active",
    source: "stripe",
    stripeSubscriptionId: "sub_current_DO_NOT_PRINT",
    stripeSubscriptionItemId: "si_current_DO_NOT_PRINT",
    stripePriceId: "price_plus_DO_NOT_PRINT",
    effectiveAt: "2025-07-01T00:00:00.000Z",
    expiresAt: null,
    lastStripeEventId: "evt_current_DO_NOT_PRINT",
    lastStripeEventCreatedAt: 1_753_056_000,
  });
  assert.deepEqual(redactAiTierStripeLifecycleDecision(result), {
    decision: "apply",
    reason: null,
    tierId: "plus",
  });
  assert.doesNotMatch(
    JSON.stringify(redactAiTierStripeLifecycleDecision(result)),
    /DO_NOT_PRINT/u,
  );
});

test("workspace target and complete distinct allowlist fail closed", () => {
  assert.deepEqual(
    decide({ workspaceTargetVerified: false }),
    {
      decision: "retry",
      reason: "workspace_target",
      mutation: null,
    },
  );
  assert.deepEqual(
    decide({ environment: {} }),
    {
      decision: "retry",
      reason: "price_configuration",
      mutation: null,
    },
  );
});

test("unknown prices are ignored while ambiguous paid items retry", () => {
  const unrelated = stripeEvent();
  unrelated.data.object.items.data[0].price.id =
    "price_unrelated_DO_NOT_PRINT";
  assert.deepEqual(decide({ event: unrelated }), {
    decision: "ignore",
    reason: "unrelated_price",
    mutation: null,
  });

  const ambiguous = stripeEvent();
  ambiguous.data.object.items.data.push({
    id: "si_second_DO_NOT_PRINT",
    current_period_start: 1_751_328_000,
    current_period_end: 1_754_006_400,
    price: { id: environment.STRIPE_PRICE_AI_ULTRA },
  });
  assert.deepEqual(decide({ event: ambiguous }), {
    decision: "retry",
    reason: "ambiguous_price_items",
    mutation: null,
  });
});

test("removing the paid item cancels the stored entitlement without losing the event boundary", () => {
  const created = decide();
  assert.equal(created.decision, "apply");

  const removed = stripeEvent({
    id: "evt_removed_DO_NOT_PRINT",
    created: 1_753_056_001,
  });
  removed.data.object.items.data = [
    {
      id: "si_starter_DO_NOT_PRINT",
      current_period_start: 1_751_328_000,
      current_period_end: 1_754_006_400,
      price: { id: "price_starter_DO_NOT_PRINT" },
    },
  ];

  const result = decide({
    event: removed,
    current: created.mutation,
  });
  assert.deepEqual(result, {
    decision: "apply",
    reason: null,
    mutation: {
      ...created.mutation,
      status: "canceled",
      expiresAt: "2025-07-21T00:00:01.000Z",
      lastStripeEventId: "evt_removed_DO_NOT_PRINT",
      lastStripeEventCreatedAt: 1_753_056_001,
    },
  });
  assert.equal(result.mutation.stripeSubscriptionItemId, created.mutation.stripeSubscriptionItemId);
  assert.equal(result.mutation.stripePriceId, created.mutation.stripePriceId);
});

test("a partial Stripe item list never proves removal", () => {
  const created = decide();
  assert.equal(created.decision, "apply");
  const partial = stripeEvent({
    id: "evt_partial_DO_NOT_PRINT",
    created: 1_753_056_001,
  });
  partial.data.object.items = {
    data: [],
    has_more: true,
  };

  assert.deepEqual(
    decide({ event: partial, current: created.mutation }),
    {
      decision: "retry",
      reason: "items",
      mutation: null,
    },
  );
});

test("a Stripe item list without an explicit completeness marker retries", () => {
  const malformed = stripeEvent();
  delete malformed.data.object.items.has_more;

  assert.deepEqual(decide({ event: malformed }), {
    decision: "retry",
    reason: "items",
    mutation: null,
  });
});

test("duplicate and stale events cannot overwrite newer entitlement state", () => {
  const current = {
    stripeSubscriptionId: "sub_current_DO_NOT_PRINT",
    lastStripeEventId: "evt_stored_DO_NOT_PRINT",
    lastStripeEventCreatedAt: 1_753_056_000,
  };

  assert.deepEqual(
    decide({
      event: stripeEvent({ id: current.lastStripeEventId }),
      current,
    }),
    {
      decision: "ignore",
      reason: "duplicate_event",
      mutation: null,
    },
  );
  assert.deepEqual(
    decide({
      event: stripeEvent({
        id: "evt_older_DO_NOT_PRINT",
        created: current.lastStripeEventCreatedAt - 1,
      }),
      current,
    }),
    {
      decision: "ignore",
      reason: "stale_event",
      mutation: null,
    },
  );
  assert.deepEqual(
    decide({
      event: stripeEvent({ id: "evt_collision_DO_NOT_PRINT" }),
      current,
    }),
    {
      decision: "retry",
      reason: "event_order_conflict",
      mutation: null,
    },
  );
});

test("newer event cannot switch the stored subscription identity", () => {
  assert.deepEqual(
    decide({
      event: stripeEvent({ created: 1_753_056_001 }),
      current: {
        stripeSubscriptionId: "sub_other_DO_NOT_PRINT",
        lastStripeEventId: "evt_previous_DO_NOT_PRINT",
        lastStripeEventCreatedAt: 1_753_056_000,
      },
    }),
    {
      decision: "retry",
      reason: "subscription_mismatch",
      mutation: null,
    },
  );
});

test("subscription states map conservatively and cancellation has a fixed end", () => {
  for (const [stripeStatus, expectedStatus] of [
    ["trialing", "pending"],
    ["incomplete", "pending"],
    ["past_due", "paused"],
    ["unpaid", "paused"],
    ["incomplete_expired", "expired"],
  ]) {
    const event = stripeEvent();
    event.data.object.status = stripeStatus;
    const result = decide({ event });
    assert.equal(result.decision, "apply");
    assert.equal(result.mutation.status, expectedStatus);
    assert.equal(
      result.mutation.expiresAt,
      expectedStatus === "expired"
        ? "2025-08-01T00:00:00.000Z"
        : null,
    );
  }

  const scheduled = stripeEvent();
  scheduled.data.object.cancel_at_period_end = true;
  const scheduledResult = decide({ event: scheduled });
  assert.equal(scheduledResult.decision, "apply");
  assert.equal(
    scheduledResult.mutation.expiresAt,
    "2025-08-01T00:00:00.000Z",
  );

  const deleted = stripeEvent({
    type: "customer.subscription.deleted",
  });
  delete deleted.data.object.status;
  const deletedResult = decide({ event: deleted });
  assert.equal(deletedResult.decision, "apply");
  assert.equal(deletedResult.mutation.status, "canceled");
});

test("malformed event, item and current state never produce a mutation", () => {
  for (const [overrides, reason] of [
    [{ event: {} }, "event_identity"],
    [{ event: stripeEvent({ type: "invoice.paid" }) }, "event_type"],
    [{
      current: {
        stripeSubscriptionId: "sub_current_DO_NOT_PRINT",
        lastStripeEventId: "invalid",
        lastStripeEventCreatedAt: 1_753_056_000,
      },
    }, "current_state"],
  ]) {
    const result = decide(overrides);
    assert.equal(result.mutation, null);
    assert.equal(result.reason, reason);
  }

  const invalidPeriod = stripeEvent();
  invalidPeriod.data.object.items.data[0].current_period_end =
    invalidPeriod.data.object.items.data[0].current_period_start;
  assert.deepEqual(decide({ event: invalidPeriod }), {
    decision: "retry",
    reason: "item_period",
    mutation: null,
  });

  const redacted = redactAiTierStripeLifecycleDecision({
    decision: "retry",
    reason: "provider_error_DO_NOT_PRINT",
    mutation: null,
  });
  assert.deepEqual(redacted, {
    decision: "retry",
    reason: "invalid_result",
    tierId: null,
  });
  assert.doesNotMatch(JSON.stringify(redacted), /DO_NOT_PRINT/u);
});
