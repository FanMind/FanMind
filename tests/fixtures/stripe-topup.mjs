import { stripeTopupContract } from "../../src/lib/stripeAiTopupLifecycle.mjs";

export function topupFixture(key = "topup_10", tax = 300) {
  const workspaceId = "10000000-0000-4000-8000-000000000001";
  const env = { FANMIND_RUNTIME_ENVIRONMENT: "staging", NEXT_PUBLIC_APP_URL: "https://staging.fanmind.ch",
    STRIPE_SECRET_KEY: "rk_test_SyntheticNotARealKey",
    ...Object.fromEntries([10,25,50,100].map(value => [`STRIPE_PRICE_TOPUP_${value}`, `price_Synthetic${value}`])) };
  const contract = stripeTopupContract(key, env);
  const metadata = { workspace_id: workspaceId, fanmind_billing_contract: "capacity_v2", fanmind_credit_type: "topup",
    topup_key: key, fanmind_topup_key: `fanmind_${key}` };
  const price = { object: "price", id: contract.id, active: true, livemode: false, type: "one_time", recurring: null,
    currency: "eur", unit_amount: contract.unitAmount, tax_behavior: "exclusive", billing_scheme: "per_unit",
    metadata: { ...contract.priceMetadata }, product: { object: "product", id: "prod_Synthetic", active: true,
      livemode: false, tax_code: "txcd_Synthetic", metadata: { ...contract.productMetadata } } };
  const session = { id: "cs_test_Synthetic", livemode: false, mode: "payment", subscription: null, status: "complete", payment_status: "paid",
    currency: "eur", amount_subtotal: contract.unitAmount, amount_total: contract.unitAmount + tax,
    total_details: { amount_tax: tax, amount_discount: 0, amount_shipping: 0 },
    metadata: { ...metadata }, customer: "cus_Synthetic", payment_intent: "pi_Synthetic", client_reference_id: workspaceId };
  const intent = { id: "pi_Synthetic", livemode: false, currency: "eur", amount: session.amount_total,
    amount_received: session.amount_total, status: "succeeded", customer: "cus_Synthetic", metadata: { ...metadata },
    latest_charge: { id: "ch_Synthetic", refunded: false, disputed: false, amount_refunded: 0 } };
  const lines = { has_more: false, data: [{ quantity: 1, price, amount_subtotal: contract.unitAmount, amount_total: session.amount_total }] };
  const calls = { creates: [], grants: [], reversals: [], lookups: [] };
  const deps = { stripe: { prices: { retrieve: async () => price },
    tax: { settings: { retrieve: async () => ({ status: "active" }) }, registrations: { list: async () => ({ data: [{}] }) } },
    checkout: { sessions: { retrieve: async () => session, listLineItems: async () => lines,
      create: async (...args) => { calls.creates.push(args); return { id: session.id, url: "https://checkout.stripe.com/c/pay/Synthetic", livemode: false }; } } },
    paymentIntents: { retrieve: async () => intent } },
    integrationIdentifier: () => "fanmind_checkout_abcdefgh",
    findWorkspace: async input => { calls.lookups.push(input); return { status: "found", workspaceId }; },
    grant: async input => { calls.grants.push(input); }, reverse: async input => { calls.reversals.push(input); } };
  const event = { id: "evt_Synthetic", livemode: false, type: "checkout.session.completed", data: { object: structuredClone(session) } };
  const input = { workspaceId, customerId: "cus_Synthetic", topupKey: key,
    requestId: "20000000-0000-4000-8000-000000000001", admitted: true, taxReady: true };
  return { env, contract, workspaceId, metadata, price, session, intent, lines, deps, event, input, calls };
}
