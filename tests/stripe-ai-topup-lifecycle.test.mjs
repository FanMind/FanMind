import assert from "node:assert/strict";
import test from "node:test";
import { createStripeTopupCheckout, handleStripeTopupEvent, stripeTopupSandboxReady } from "../src/lib/stripeAiTopupLifecycle.mjs";
import { STRIPE_AI_TOPUP_OPTIONS, resolveStripeAiTopup } from "../src/lib/stripeAiTopupPolicy.mjs";
import { topupFixture } from "./fixtures/stripe-topup.mjs";

for (const value of [10,25,50,100]) {
  test(`package ${value}: one-time checkout, explicit Session/PI metadata, then tax-safe fulfillment`, async () => {
    const f = topupFixture(`topup_${value}`);
    await createStripeTopupCheckout(f.input, f.deps, f.env);
    const [params, options] = f.calls.creates[0];
    assert.equal(params.mode, "payment");
    assert.deepEqual(params.line_items, [{ price: f.contract.id, quantity: 1 }]);
    assert.deepEqual(params.metadata, params.payment_intent_data.metadata);
    assert.equal(params.metadata.fanmind_topup_key, `fanmind_topup_${value}`);
    assert.equal(params.customer, "cus_Synthetic");
    assert.equal(params.subscription_data, undefined);
    assert.equal(params.payment_method_types, undefined);
    assert.equal(params.allow_promotion_codes, false);
    await createStripeTopupCheckout(f.input, f.deps, f.env);
    assert.equal(f.calls.creates[1][1].idempotencyKey, options.idempotencyKey);
    assert.equal(await handleStripeTopupEvent(f.event, f.deps, f.env), true);
    assert.equal(f.calls.grants[0].grantedEurMicrocents, value * 100_000_000);
    assert.equal(f.calls.grants[0].metadata.sale_amount_cents, f.contract.unitAmount);
    assert.equal(f.calls.grants[0].metadata.tax_amount_cents, 300);
    assert.equal(f.calls.grants[0].expiresAt, null);
    assert.equal(f.calls.grants[0].grantKey, "stripe:payment_intent:pi_Synthetic");
    assert.deepEqual(f.calls.lookups, [{ customerId: "cus_Synthetic" }]);
  });
}

test("unknown/prototype keys cannot select a package", () => {
  for (const topupKey of ["__proto__", "constructor", "toString"]) {
    assert.equal(resolveStripeAiTopup({ topupKey, currency: "eur", amountTotalCents: 1499 }), null);
  }
  assert.equal(STRIPE_AI_TOPUP_OPTIONS.topup_10.creditEurMicrocents / 100_000_000, 10);
});

test("unpaid completed -> asynchronous success; both event IDs use the same grant identity", async () => {
  const f = topupFixture(); f.session.payment_status = "unpaid";
  assert.equal(await handleStripeTopupEvent(f.event, f.deps, f.env), true);
  assert.equal(f.calls.grants.length, 0);
  f.session.payment_status = "paid"; f.event.type = "checkout.session.async_payment_succeeded";
  await handleStripeTopupEvent(f.event, f.deps, f.env);
  f.event.type = "checkout.session.completed"; f.event.id = "evt_Other";
  await handleStripeTopupEvent(f.event, f.deps, f.env);
  assert.equal(f.calls.grants.length, 2);
  assert.equal(f.calls.grants[0].grantKey, f.calls.grants[1].grantKey);
  // Actual durable idempotency is separately exercised against the real PG17 RPC.
});

test("asynchronous failure and topup PaymentIntent lifecycle never touch base billing", async () => {
  for (const type of ["checkout.session.async_payment_failed", "payment_intent.processing", "payment_intent.succeeded", "payment_intent.payment_failed"]) {
    const f = topupFixture(); f.event.type = type;
    if (type.startsWith("payment_intent.")) f.event.data.object = f.intent;
    assert.equal(await handleStripeTopupEvent(f.event, f.deps, f.env), true);
    assert.equal(f.calls.grants.length, 0); assert.equal(f.calls.reversals.length, 0);
  }
});

test("base subscription, invoice, Daily, tax and untagged PI remain on the existing handler", async () => {
  for (const type of ["checkout.session.completed", "payment_intent.succeeded", "invoice.paid", "customer.subscription.updated", "customer.tax_id.created"]) {
    const f = topupFixture(); f.event.type = type; f.event.data.object.metadata = { commercial_option: "internal_daily_test" };
    assert.equal(await handleStripeTopupEvent(f.event, f.deps, f.env), false);
    assert.equal(f.calls.grants.length, 0); assert.equal(f.calls.lookups.length, 0);
  }
});

test("mismatched amounts, currency, quantities, price, metadata, workspace, mode and refunded intent fail closed", async () => {
  for (const mutate of [
    f => f.session.amount_subtotal++, f => f.session.amount_total++, f => f.session.currency = "usd",
    f => f.session.total_details.amount_tax = -1, f => f.session.total_details.amount_discount = 1,
    f => f.session.total_details.amount_shipping = 1, f => f.session.mode = "subscription",
    f => f.session.subscription = "sub_Synthetic", f => f.session.livemode = true,
    f => f.event.livemode = true, f => f.session.payment_status = "no_payment_required",
    f => f.session.automatic_tax.enabled = false, f => f.session.automatic_tax.status = "failed",
    f => f.session.automatic_tax = null,
    f => f.lines.has_more = true, f => f.lines.data.push(f.lines.data[0]),
    f => f.lines.data[0].quantity = 2, f => f.price.id = "price_Wrong",
    f => f.price.metadata.fanmind_provider_value_eur = "100", f => f.price.product.tax_code = null,
    f => f.intent.amount_received--, f => f.intent.customer = "cus_Other",
    f => f.intent.metadata.workspace_id = "10000000-0000-4000-8000-000000000002",
    f => f.session.client_reference_id = "10000000-0000-4000-8000-000000000002",
    f => f.deps.findWorkspace = async () => ({ status: "retryable_error" }),
    f => f.deps.findWorkspace = async () => ({ status: "found", workspaceId: "10000000-0000-4000-8000-000000000002" }),
    f => f.intent.latest_charge.amount_refunded = 1, f => f.intent.latest_charge.disputed = true,
    f => f.intent.latest_charge = "ch_Unexpanded",
  ]) {
    const f = topupFixture(); mutate(f);
    await assert.rejects(handleStripeTopupEvent(f.event, f.deps, f.env), /stripe_topup_verification_failed/u);
    assert.equal(f.calls.grants.length, 0);
  }
});

test("zero-tax/reverse-charge total is valid; tax is never credited as capacity", async () => {
  const f = topupFixture("topup_100", 0);
  await handleStripeTopupEvent(f.event, f.deps, f.env);
  assert.equal(f.calls.grants[0].grantedEurMicrocents, 10_000_000_000);
});

test("closed sales, missing tax classification/registration and Live block before creating checkout", async () => {
  for (const mutate of [
    f => f.input.admitted = false, f => f.input.taxReady = false,
    f => f.env.FANMIND_RUNTIME_ENVIRONMENT = "production", f => f.env.STRIPE_SECRET_KEY = "rk_live_Forbidden",
    f => f.env.NEXT_PUBLIC_APP_URL = "https://fanmind.ch", f => f.price.product.tax_code = null,
    f => f.deps.stripe.tax.settings.retrieve = async () => ({ status: "pending" }),
    f => f.deps.stripe.tax.registrations.list = async () => ({ data: [] }),
    f => f.env.STRIPE_PRICE_TOPUP_25 = f.env.STRIPE_PRICE_TOPUP_10,
  ]) {
    const f = topupFixture(); mutate(f);
    await assert.rejects(createStripeTopupCheckout(f.input, f.deps, f.env));
    assert.equal(f.calls.creates.length, 0);
  }
  assert.equal(stripeTopupSandboxReady({}), false);
});

test("risk events reverse only an explicitly identified topup and never refer a base payment to the capacity RPC", async () => {
  for (const type of ["refund.created", "refund.updated", "charge.refunded", "charge.dispute.created"]) {
    const f = topupFixture(); f.event.type = type;
    f.event.data.object = { id: "re_Synthetic", payment_intent: "pi_Synthetic", status: "succeeded" };
    assert.equal(await handleStripeTopupEvent(f.event, f.deps, f.env), true);
    assert.equal(f.calls.reversals[0].grantKey, "stripe:payment_intent:pi_Synthetic");
    assert.equal(f.calls.grants.length, 0);
    f.intent.metadata = {};
    assert.equal(await handleStripeTopupEvent(f.event, f.deps, f.env), false);
    assert.equal(f.calls.reversals.length, 1);
  }
});
