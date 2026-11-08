import { STRIPE_AI_TOPUP_OPTIONS } from "./stripeAiTopupPolicy.mjs";
import { isStripeTestSecretKey } from "./stripeKeyPolicy.mjs";

export const STAGING_STRIPE_CATALOG_CONFIRMATION =
  "verify-staging-stripe-catalog";

export const STAGING_STRIPE_PRICE_CONTRACTS = Object.freeze([
  Object.freeze({
    slot: "starter_setup",
    environmentName: "STRIPE_PRICE_STARTER_SETUP",
    unitAmount: 99_000,
    type: "one_time",
    interval: null,
  }),
  Object.freeze({
    slot: "starter_monthly",
    environmentName: "STRIPE_PRICE_STARTER_MONTHLY",
    unitAmount: 31_200,
    type: "recurring",
    interval: "month",
  }),
  Object.freeze({
    slot: "internal_daily_test",
    environmentName: "STRIPE_PRICE_INTERNAL_DAILY_TEST",
    unitAmount: 100,
    type: "recurring",
    interval: "day",
  }),
  Object.freeze({
    slot: "ai_plus",
    environmentName: "STRIPE_PRICE_AI_PLUS",
    unitAmount: 10_000,
    type: "recurring",
    interval: "month",
  }),
  Object.freeze({
    slot: "ai_ultra",
    environmentName: "STRIPE_PRICE_AI_ULTRA",
    unitAmount: 20_000,
    type: "recurring",
    interval: "month",
  }),
]);

const PRICE_ID_PATTERN = /^price_[A-Za-z0-9_]+$/u;
// Separate catalog contracts: an equal amount never migrates a legacy subscription.
export const STAGING_CAPACITY_PRICE_CONTRACTS = Object.freeze(
  [99, 199, 312].map((amount) => Object.freeze({
    slot: `capacity_${amount}`,
    environmentName: `STRIPE_PRICE_CAPACITY_${amount}`,
    unitAmount: amount * 100,
    type: "recurring",
    interval: "month",
    taxBehavior: "exclusive",
  })),
);

// Full current sandbox inventory, including the explicitly retained internal Daily test.
// Catalog verification does not approve tax registration, Checkout or runtime activation.
export const STAGING_TOPUP_PRICE_CONTRACTS = Object.freeze(
  Object.entries(STRIPE_AI_TOPUP_OPTIONS).map(([key, option]) => {
    const amount = key.slice("topup_".length);
    return Object.freeze({
      slot: key,
      environmentName: `STRIPE_PRICE_TOPUP_${amount}`,
      unitAmount: option.saleAmountCents,
      type: "one_time",
      interval: null,
      taxBehavior: "exclusive",
      priceMetadata: Object.freeze({
        fanmind_billing_contract: "capacity_v2",
        fanmind_credit_type: "topup",
        fanmind_provider_value_eur: amount,
        fanmind_topup_key: `fanmind_${key}`,
      }),
      productMetadata: Object.freeze({
        fanmind_billing_contract: "capacity_v2",
        fanmind_credit_type: "topup",
        fanmind_provider_value_eur: amount,
      }),
    });
  }),
);
export const STAGING_FULL_CAPACITY_PRICE_CONTRACTS = Object.freeze([
  ...STAGING_CAPACITY_PRICE_CONTRACTS,
  ...STAGING_TOPUP_PRICE_CONTRACTS,
  Object.freeze({ ...STAGING_STRIPE_PRICE_CONTRACTS[2], taxBehavior: "exclusive" }),
]);

export function stagingStripePriceContracts(contract = "legacy_v1") {
  if (contract === "legacy_v1") return STAGING_STRIPE_PRICE_CONTRACTS;
  if (contract === "capacity_v2") return STAGING_CAPACITY_PRICE_CONTRACTS;
  if (contract === "capacity_v2_full") return STAGING_FULL_CAPACITY_PRICE_CONTRACTS;
  return null;
}

const WEBHOOK_SECRET_PATTERN = /^whsec_[A-Za-z0-9_]+$/u;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function evaluateStagingStripeCatalogEnvironment(environment = {}) {
  const errors = [];
  const contracts = stagingStripePriceContracts(
    environment.FANMIND_STAGING_STRIPE_CATALOG_CONTRACT ?? "legacy_v1",
  );
  if (!contracts) errors.push("catalog_contract");

  if (clean(environment.FANMIND_RUNTIME_ENVIRONMENT) !== "staging") {
    errors.push("runtime_environment");
  }
  if (
    clean(environment.FANMIND_STAGING_STRIPE_CATALOG_CONFIRM) !==
    STAGING_STRIPE_CATALOG_CONFIRMATION
  ) {
    errors.push("confirmation");
  }
  if (!isStripeTestSecretKey(environment.STRIPE_SECRET_KEY)) {
    errors.push("stripe_test_mode");
  }
  if (!WEBHOOK_SECRET_PATTERN.test(clean(environment.STRIPE_WEBHOOK_SECRET))) {
    errors.push("webhook_secret");
  }

  const prices = (contracts ?? []).map((contract) => ({
    ...contract,
    id: clean(environment[contract.environmentName]),
  }));
  if (prices.some((price) => !PRICE_ID_PATTERN.test(price.id))) {
    errors.push("price_configuration");
  }
  if (new Set(prices.map((price) => price.id)).size !== prices.length) {
    errors.push("duplicate_price");
  }

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze([...new Set(errors)]),
    prices: Object.freeze(prices.map((price) => Object.freeze(price))),
  });
}

export function validateStripeTestPrice(payload, expected) {
  const product =
    payload?.product &&
    typeof payload.product === "object" &&
    !Array.isArray(payload.product)
      ? payload.product
      : null;
  const recurringMatches =
    expected.type === "one_time"
      ? payload?.recurring === null
      : payload?.recurring?.interval === expected.interval &&
        payload?.recurring?.interval_count === 1;

  return Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      payload.object === "price" &&
      payload.id === expected.id &&
      payload.livemode === false &&
      payload.active === true &&
      payload.type === expected.type &&
      payload.currency === "eur" &&
      payload.unit_amount === expected.unitAmount &&
      (!expected.taxBehavior || (
        payload.tax_behavior === expected.taxBehavior &&
        payload.billing_scheme === "per_unit" &&
        (expected.type === "one_time" || payload.recurring?.usage_type === "licensed") &&
        payload.transform_quantity == null &&
        payload.custom_unit_amount == null
      )) &&
      recurringMatches &&
      Object.entries(expected.priceMetadata ?? {}).every(([key, value]) => payload.metadata?.[key] === value) &&
      Object.entries(expected.productMetadata ?? {}).every(([key, value]) => product?.metadata?.[key] === value) &&
      product?.object === "product" &&
      product.active === true &&
      product.livemode === false,
  );
}

export function classifyStripePriceResponseStatus(status) {
  if (status === 401 || status === 403) {
    return "stripe_catalog_auth_or_permission";
  }
  if (status === 404) return "stripe_catalog_missing";
  if (status === 429 || (status >= 500 && status <= 599)) {
    return "stripe_catalog_unavailable";
  }
  return "stripe_catalog_rejected";
}

async function fetchStripePrice(environment, expected, fetchImplementation) {
  const url = new URL(
    `https://api.stripe.com/v1/prices/${encodeURIComponent(expected.id)}`,
  );
  url.searchParams.append("expand[]", "product");

  let response;
  try {
    response = await fetchImplementation(url, {
      headers: {
        Authorization: `Bearer ${environment.STRIPE_SECRET_KEY}`,
      },
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return Object.freeze({
      error: "stripe_catalog_unavailable",
      slot: null,
    });
  }
  if (!response?.ok) {
    const error = classifyStripePriceResponseStatus(response?.status);
    return Object.freeze({
      error,
      slot:
        error === "stripe_catalog_missing" ||
        error === "stripe_catalog_rejected"
          ? expected.slot
          : null,
    });
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    return Object.freeze({
      error: "stripe_catalog_invalid",
      slot: expected.slot,
    });
  }
  return Object.freeze(
    validateStripeTestPrice(payload, expected)
      ? { error: null, slot: null }
      : { error: "stripe_catalog_invalid", slot: expected.slot },
  );
}

export async function verifyStagingStripeCatalog(
  environment = {},
  { fetchImplementation = globalThis.fetch } = {},
) {
  const evaluation = evaluateStagingStripeCatalogEnvironment(environment);
  if (!evaluation.ok) {
    return Object.freeze({
      ok: false,
      error: "environment_invalid",
      priceCount: 0,
      slot: null,
    });
  }
  if (typeof fetchImplementation !== "function") {
    return Object.freeze({
      ok: false,
      error: "stripe_catalog_unavailable",
      priceCount: 0,
      slot: null,
    });
  }

  const results = await Promise.all(
    evaluation.prices.map((expected) =>
      fetchStripePrice(environment, expected, fetchImplementation),
    ),
  );
  const errorPriority = [
    "stripe_catalog_auth_or_permission",
    "stripe_catalog_missing",
    "stripe_catalog_invalid",
    "stripe_catalog_rejected",
    "stripe_catalog_unavailable",
  ];
  const selected = errorPriority
    .map((candidate) =>
      results.find((result) => result.error === candidate),
    )
    .find(Boolean);
  const error = selected?.error ?? null;

  return Object.freeze({
    ok: error === null,
    error,
    priceCount: error === null ? evaluation.prices.length : 0,
    slot: selected?.slot ?? null,
  });
}
