import { STRIPE_AI_TOPUP_OPTIONS, stripeAiTopupGrantKey } from "./stripeAiTopupPolicy.mjs";
import { STAGING_TOPUP_PRICE_CONTRACTS, validateStripeTestPrice } from "./stagingStripeCatalogPolicy.mjs";
import { isStripeTestSecretKey } from "./stripeKeyPolicy.mjs";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const id = (value, prefix) => typeof value === "string" && new RegExp(`^${prefix}[A-Za-z0-9]+$`, "u").test(value);
const reference = value => typeof value === "string" ? value : value?.id;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const fail = () => { throw new Error("stripe_topup_verification_failed"); };
const marked = object => object?.metadata?.fanmind_credit_type === "topup" ||
  object?.metadata?.topup_key != null || object?.metadata?.fanmind_topup_key != null;

export function stripeTopupSandboxReady(env = process.env) {
  try {
    return env.FANMIND_RUNTIME_ENVIRONMENT === "staging" && isStripeTestSecretKey(env.STRIPE_SECRET_KEY) &&
      new URL(env.NEXT_PUBLIC_APP_URL).origin === "https://staging.fanmind.ch";
  } catch { return false; }
}

export function stripeTopupContract(key, env = process.env) {
  const contract = STAGING_TOPUP_PRICE_CONTRACTS.find(item => item.slot === key);
  const priceId = contract && env[contract.environmentName];
  if (!contract || !id(priceId, "price_")) return null;
  const mappings = STAGING_TOPUP_PRICE_CONTRACTS.map(item => env[item.environmentName]);
  if (mappings.filter(value => value === priceId).length !== 1) return null;
  return { ...contract, id: priceId, option: STRIPE_AI_TOPUP_OPTIONS[key] };
}

function metadataFor(key, workspaceId) {
  return { workspace_id: workspaceId, fanmind_billing_contract: "capacity_v2", fanmind_credit_type: "topup",
    topup_key: key, fanmind_topup_key: `fanmind_${key}` };
}

function validMetadata(metadata, key, workspaceId) {
  return Object.entries(metadataFor(key, workspaceId)).every(([name, value]) => metadata?.[name] === value);
}

function validTaxPrice(price, contract) {
  // Product classification is a separate prerequisite; never invent a tax code.
  return validateStripeTestPrice(price, contract) &&
    id(reference(price.product?.tax_code), "txcd_");
}

export async function createStripeTopupCheckout(input, deps, env = process.env) {
  const contract = stripeTopupContract(input.topupKey, env);
  if (!stripeTopupSandboxReady(env) || !contract || !uuid.test(input.workspaceId) ||
      !id(input.customerId, "cus_") || !uuid.test(input.requestId) || input.admitted !== true || input.taxReady !== true) fail();
  const price = await deps.stripe.prices.retrieve(contract.id, { expand: ["product"] });
  if (!validTaxPrice(price, contract)) fail();
  // Verify the test account actually has active tax settings and a registration;
  // the readiness variable alone must not enable automatic_tax.
  const settings = await deps.stripe.tax.settings.retrieve();
  const registrations = await deps.stripe.tax.registrations.list({ status: "active", limit: 1 });
  if (settings.status !== "active" || !registrations.data?.length) fail();
  const metadata = metadataFor(input.topupKey, input.workspaceId);
  const params = {
    mode: "payment", customer: input.customerId, client_reference_id: input.workspaceId,
    line_items: [{ price: contract.id, quantity: 1 }],
    metadata, payment_intent_data: { metadata },
    success_url: `${env.NEXT_PUBLIC_APP_URL}/settings/ai-usage?topup=return`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/settings/ai-usage?topup=cancel`,
    automatic_tax: { enabled: true }, customer_update: { address: "auto" },
    billing_address_collection: "required", tax_id_collection: { enabled: true },
    allow_promotion_codes: false, integration_identifier: deps.integrationIdentifier(),
  };
  const session = await deps.stripe.checkout.sessions.create(params, {
    idempotencyKey: `fanmind:topup:${input.workspaceId}:${input.requestId}`,
  });
  if (!id(session.id, "cs_test_") || session.livemode !== false || !session.url ||
      new URL(session.url).origin !== "https://checkout.stripe.com") fail();
  return { id: session.id, url: session.url };
}

async function boundWorkspace(customer, metadata, deps) {
  if (!id(customer, "cus_") || !uuid.test(metadata?.workspace_id ?? "")) fail();
  const result = await deps.findWorkspace({ customerId: customer });
  if (result.status !== "found" || result.workspaceId !== metadata.workspace_id) fail();
  return result.workspaceId;
}

// Called only after signature and write-freeze verification. Tagged one-time
// purchases never enter the base-subscription/referral projection below it.
export async function handleStripeTopupEvent(event, deps, env = process.env) {
  const object = event.data?.object ?? {};
  const sessionEvent = event.type?.startsWith("checkout.session.");
  const intentEvent = event.type?.startsWith("payment_intent.");
  const riskEvent = ["charge.refunded", "refund.created", "refund.updated", "refund.failed", "charge.dispute.created"].includes(event.type);
  if (!sessionEvent && !intentEvent && !riskEvent) return false;
  let intent;
  if (riskEvent) {
    const intentId = reference(object.payment_intent);
    if (!id(intentId, "pi_")) return false;
    intent = await deps.stripe.paymentIntents.retrieve(intentId);
    if (intent.id !== intentId) fail();
    if (!marked(intent)) return false;
  } else if (!marked(object)) return false;
  if (!stripeTopupSandboxReady(env) || event.livemode !== false) fail();
  if (intentEvent) return true; // Session fulfillment is authoritative, including delayed success.
  if (riskEvent) {
    const key = intent.metadata?.topup_key;
    if (intent.livemode !== false || !validMetadata(intent.metadata, key, intent.metadata?.workspace_id) ||
        !stripeTopupContract(key, env)) fail();
    const workspaceId = await boundWorkspace(reference(intent.customer), intent.metadata, deps);
    const succeeded = event.type === "charge.refunded" || event.type === "charge.dispute.created" || object.status === "succeeded";
    if (succeeded) {
      if (!id(event.id, "evt_")) fail();
      await deps.reverse({ workspaceId, grantKey: stripeAiTopupGrantKey(intent.id),
        reversalKey: `stripe:event:${event.id}`, reason: event.type === "charge.dispute.created" ? "dispute" : "refund",
        metadata: { stripe_event_id: event.id, stripe_payment_intent_id: intent.id } });
    }
    return true;
  }
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"].includes(event.type)) return true;
  if (!id(object.id, "cs_test_")) fail();
  const session = await deps.stripe.checkout.sessions.retrieve(object.id);
  const key = session.metadata?.topup_key;
  const contract = stripeTopupContract(key, env);
  if (!contract || session.id !== object.id || session.livemode !== false || session.mode !== "payment" ||
      session.subscription != null || !validMetadata(session.metadata, key, session.client_reference_id) ||
      session.metadata.workspace_id !== object.metadata?.workspace_id || key !== object.metadata?.topup_key) fail();
  const workspaceId = await boundWorkspace(reference(session.customer), session.metadata, deps);
  // Completed may precede bank settlement; neither failure nor unpaid grants capacity.
  if (event.type === "checkout.session.async_payment_failed" || session.payment_status === "unpaid") return true;
  if (session.status !== "complete" || session.payment_status !== "paid" || session.currency !== "eur") fail();
  const totals = session.total_details;
  if (session.amount_subtotal !== contract.unitAmount || !integer(totals?.amount_tax) ||
      totals.amount_discount !== 0 || totals.amount_shipping !== 0 ||
      session.amount_total !== session.amount_subtotal + totals.amount_tax || !integer(session.amount_total)) fail();
  const lines = await deps.stripe.checkout.sessions.listLineItems(session.id, { limit: 2, expand: ["data.price.product"] });
  const line = lines.data?.[0];
  if (lines.has_more !== false || lines.data.length !== 1 || line.quantity !== 1 ||
      line.price?.id !== contract.id || !validTaxPrice(line.price, contract) ||
      line.amount_subtotal !== contract.unitAmount || line.amount_total !== session.amount_total) fail();
  const intentId = reference(session.payment_intent);
  if (!id(intentId, "pi_")) fail();
  intent = await deps.stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
  if (intent.livemode !== false || intent.id !== intentId || intent.status !== "succeeded" ||
      intent.currency !== "eur" || intent.amount !== session.amount_total || intent.amount_received !== session.amount_total ||
      reference(intent.customer) !== reference(session.customer) || !validMetadata(intent.metadata, key, workspaceId)) fail();
  // A delayed checkout replay must not grant new spendable credit after a refund
  // or dispute. Existing reversal/reconciliation remains operator controlled.
  if (!intent.latest_charge || typeof intent.latest_charge !== "object" ||
      intent.latest_charge.refunded !== false || intent.latest_charge.disputed !== false ||
      intent.latest_charge.amount_refunded !== 0) fail();
  await deps.grant({ workspaceId, grantKind: "purchased", grantKey: stripeAiTopupGrantKey(intentId), expiresAt: null,
    grantedEurMicrocents: contract.option.creditEurMicrocents,
    metadata: { stripe_payment_intent_id: intentId, stripe_checkout_session_id: session.id,
      topup_key: key, sale_amount_cents: contract.unitAmount, tax_amount_cents: totals.amount_tax } });
  return true;
}
