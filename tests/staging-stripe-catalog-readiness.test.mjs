import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

import {
  STAGING_STRIPE_CATALOG_CONFIRMATION,
  STAGING_STRIPE_PRICE_CONTRACTS,
  STAGING_CAPACITY_PRICE_CONTRACTS,
  STAGING_FULL_CAPACITY_PRICE_CONTRACTS,
  classifyStripePriceResponseStatus,
  evaluateStagingStripeCatalogEnvironment,
  validateStripeTestPrice,
  verifyStagingStripeCatalog,
} from "../src/lib/stagingStripeCatalogPolicy.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = "scripts/operations/staging-stripe-catalog-readiness.mjs";
const workflowPath =
  ".github/workflows/staging-stripe-catalog-readiness.yml";
const runbookPath =
  "docs/operations/STAGING_STRIPE_CATALOG_READINESS.md";

function environment(overrides = {}) {
  return {
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    FANMIND_STAGING_STRIPE_CATALOG_CONFIRM:
      STAGING_STRIPE_CATALOG_CONFIRMATION,
    STRIPE_SECRET_KEY: "rk_test_SyntheticCatalogKey",
    STRIPE_WEBHOOK_SECRET: "whsec_SyntheticCatalogSecret",
    STRIPE_PRICE_STARTER_SETUP: "price_SyntheticStarterSetup",
    STRIPE_PRICE_STARTER_MONTHLY: "price_SyntheticStarterMonthly",
    STRIPE_PRICE_INTERNAL_DAILY_TEST: "price_SyntheticDaily",
    STRIPE_PRICE_AI_PLUS: "price_SyntheticAiPlus",
    STRIPE_PRICE_AI_ULTRA: "price_SyntheticAiUltra",
    ...overrides,
  };
}

function stripePayload(expected) {
  return {
    object: "price",
    id: expected.id,
    livemode: false,
    active: true,
    type: expected.type,
    currency: "eur",
    unit_amount: expected.unitAmount,
    recurring:
      expected.type === "recurring"
        ? { interval: expected.interval, interval_count: 1 }
        : null,
    product: {
      object: "product",
      active: true,
      livemode: false,
    },
  };
}

test("the isolated catalog requires five distinct Stripe test prices", () => {
  const evaluation = evaluateStagingStripeCatalogEnvironment(environment());
  assert.equal(evaluation.ok, true);
  assert.equal(evaluation.prices.length, 5);
  assert.deepEqual(
    STAGING_STRIPE_PRICE_CONTRACTS.map((contract) => contract.unitAmount),
    [99_000, 31_200, 100, 10_000, 20_000],
  );

  assert.deepEqual(
    evaluateStagingStripeCatalogEnvironment(
      environment({ STRIPE_SECRET_KEY: "sk_live_DoNotUse" }),
    ).errors,
    ["stripe_test_mode"],
  );
  assert.deepEqual(
    evaluateStagingStripeCatalogEnvironment(
      environment({
        STRIPE_PRICE_AI_ULTRA: "price_SyntheticAiPlus",
      }),
    ).errors,
    ["duplicate_price"],
  );
});

test("catalog validation rejects live, inactive, wrong amount and wrong interval prices", () => {
  const expected = {
    ...STAGING_STRIPE_PRICE_CONTRACTS[1],
    id: "price_SyntheticStarterMonthly",
  };
  assert.equal(validateStripeTestPrice(stripePayload(expected), expected), true);

  for (const mutation of [
    (payload) => (payload.livemode = true),
    (payload) => (payload.active = false),
    (payload) => (payload.unit_amount = 1),
    (payload) => (payload.recurring.interval = "year"),
    (payload) => (payload.product.active = false),
  ]) {
    const payload = stripePayload(expected);
    mutation(payload);
    assert.equal(validateStripeTestPrice(payload, expected), false);
  }
});

test("Stripe response failures collapse to stable actionable categories", () => {
  assert.equal(
    classifyStripePriceResponseStatus(401),
    "stripe_catalog_auth_or_permission",
  );
  assert.equal(
    classifyStripePriceResponseStatus(403),
    "stripe_catalog_auth_or_permission",
  );
  assert.equal(classifyStripePriceResponseStatus(404), "stripe_catalog_missing");
  assert.equal(
    classifyStripePriceResponseStatus(429),
    "stripe_catalog_unavailable",
  );
  assert.equal(
    classifyStripePriceResponseStatus(503),
    "stripe_catalog_unavailable",
  );
  assert.equal(
    classifyStripePriceResponseStatus(400),
    "stripe_catalog_rejected",
  );
});

test("catalog verification preserves the fixed response category", async () => {
  const result = await verifyStagingStripeCatalog(environment(), {
    fetchImplementation: async () => ({ ok: false, status: 403 }),
  });
  assert.deepEqual(result, {
    ok: false,
    error: "stripe_catalog_auth_or_permission",
    priceCount: 0,
    slot: null,
  });
});

test("a missing price reports only its fixed catalog slot", async () => {
  const currentEnvironment = environment();
  const evaluation =
    evaluateStagingStripeCatalogEnvironment(currentEnvironment);
  const missingSlot = "internal_daily_test";
  const result = await verifyStagingStripeCatalog(currentEnvironment, {
    fetchImplementation: async (url) => {
      const expected = evaluation.prices.find((price) =>
        String(url).includes(encodeURIComponent(price.id)),
      );
      if (expected.slot === missingSlot) {
        return { ok: false, status: 404 };
      }
      return {
        ok: true,
        async json() {
          return stripePayload(expected);
        },
      };
    },
  });
  assert.deepEqual(result, {
    ok: false,
    error: "stripe_catalog_missing",
    priceCount: 0,
    slot: missingSlot,
  });
});

test("read-only verification fetches exactly the five configured prices", async () => {
  const seen = [];
  const currentEnvironment = environment();
  const evaluation =
    evaluateStagingStripeCatalogEnvironment(currentEnvironment);
  const result = await verifyStagingStripeCatalog(currentEnvironment, {
    fetchImplementation: async (url, options) => {
      seen.push({
        url: String(url),
        authorization: options.headers.Authorization,
      });
      const expected = evaluation.prices.find((price) =>
        String(url).includes(encodeURIComponent(price.id)),
      );
      return {
        ok: true,
        async json() {
          return stripePayload(expected);
        },
      };
    },
  });

  assert.deepEqual(result, {
    ok: true,
    error: null,
    priceCount: 5,
    slot: null,
  });
  assert.equal(seen.length, 5);
  assert.ok(
    seen.every((request) =>
      request.url.includes("expand%5B%5D=product"),
    ),
  );
  assert.ok(
    seen.every(
      (request) =>
        request.authorization === "Bearer rk_test_SyntheticCatalogKey",
    ),
  );
});

function capacityEnvironment(overrides = {}) {
  return environment({
    FANMIND_STAGING_STRIPE_CATALOG_CONTRACT: "capacity_v2",
    STRIPE_PRICE_CAPACITY_99: "price_SyntheticCapacity99",
    STRIPE_PRICE_CAPACITY_199: "price_SyntheticCapacity199",
    STRIPE_PRICE_CAPACITY_312: "price_SyntheticCapacity312",
    ...overrides,
  });
}

function capacityPayload(expected) {
  return {
    ...stripePayload(expected),
    tax_behavior: "exclusive",
    billing_scheme: "per_unit",
    recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
    transform_quantity: null,
    custom_unit_amount: null,
  };
}

function fullEnvironment(overrides = {}) {
  return capacityEnvironment({
    FANMIND_STAGING_STRIPE_CATALOG_CONTRACT: "capacity_v2_full",
    ...Object.fromEntries([10, 25, 50, 100].map((v) => [`STRIPE_PRICE_TOPUP_${v}`, `price_SyntheticTopup${v}`])),
    ...overrides,
  });
}

function fullPayload(expected) {
  const payload = capacityPayload(expected);
  if (expected.type === "one_time") payload.recurring = null;
  else payload.recurring.interval = expected.interval;
  payload.metadata = { ...expected.priceMetadata };
  payload.product.metadata = { ...expected.productMetadata };
  return payload;
}

test("full current catalog verifies eight configured prices including one-time provider-value topups and retained Daily", async () => {
  const env = fullEnvironment();
  const evaluation = evaluateStagingStripeCatalogEnvironment(env);
  assert.equal(evaluation.ok, true);
  assert.equal(STAGING_FULL_CAPACITY_PRICE_CONTRACTS.length, 8);
  assert.deepEqual(evaluation.prices.map((p) => [p.slot, p.unitAmount, p.interval]), [
    ["capacity_99", 9900, "month"], ["capacity_199", 19900, "month"], ["capacity_312", 31200, "month"],
    ["topup_10", 1499, null], ["topup_25", 3749, null], ["topup_50", 7499, null], ["topup_100", 14900, null],
    ["internal_daily_test", 100, "day"],
  ]);
  const seen = [];
  const result = await verifyStagingStripeCatalog(env, {
    fetchImplementation: async (url, options) => {
      assert.equal(options.method ?? "GET", "GET");
      assert.equal(options.body, undefined);
      seen.push(String(url));
      const expected = evaluation.prices.find((p) => new URL(String(url)).pathname.endsWith(`/${p.id}`));
      assert.ok(expected);
      return { ok: true, json: async () => fullPayload(expected) };
    },
  });
  assert.deepEqual(result, { ok: true, error: null, priceCount: 8, slot: null });
  assert.equal(new Set(seen).size, 8);
});

test("full catalog rejects live, recurring, transformed, wrong credit and missing metadata topups", () => {
  const prices = evaluateStagingStripeCatalogEnvironment(fullEnvironment()).prices.filter((p) => p.type === "one_time");
  for (const price of prices) {
    assert.equal(validateStripeTestPrice(fullPayload(price), price), true);
    for (const mutate of [
      (p) => { p.livemode = true; },
      (p) => { p.product.livemode = true; },
      (p) => { p.active = false; },
      (p) => { p.product.active = false; },
      (p) => { p.unit_amount += 1; },
      (p) => { p.currency = "usd"; },
      (p) => { p.type = "recurring"; p.recurring = { interval: "month", interval_count: 1 }; },
      (p) => { p.tax_behavior = "inclusive"; },
      (p) => { p.billing_scheme = "tiered"; },
      (p) => { p.transform_quantity = { divide_by: 10, round: "up" }; },
      (p) => { p.metadata.fanmind_provider_value_eur = "999"; },
      (p) => { p.product.metadata.fanmind_provider_value_eur = "999"; },
      (p) => { p.metadata.fanmind_topup_key = "topup_10"; },
      (p) => { p.metadata.fanmind_billing_contract = "legacy_v1"; },
      (p) => { delete p.metadata; },
    ]) {
      const payload = fullPayload(price);
      mutate(payload);
      assert.equal(validateStripeTestPrice(payload, price), false);
    }
  }
});

test("missing or duplicate topup mappings block before provider access; a missing topup reports only its slot", async () => {
  for (const overrides of [
    { STRIPE_PRICE_TOPUP_10: "" },
    { STRIPE_PRICE_TOPUP_25: "price_SyntheticTopup10" },
    { STRIPE_PRICE_TOPUP_50: "price_SyntheticCapacity99" },
    { STRIPE_SECRET_KEY: "rk_live_Forbidden" },
    { FANMIND_RUNTIME_ENVIRONMENT: "production" },
  ]) {
    let calls = 0;
    const result = await verifyStagingStripeCatalog(fullEnvironment(overrides), {
      fetchImplementation: async () => { calls++; throw new Error("unexpected request"); },
    });
    assert.equal(result.error, "environment_invalid");
    assert.equal(calls, 0);
  }
  const env = fullEnvironment();
  const evaluation = evaluateStagingStripeCatalogEnvironment(env);
  const result = await verifyStagingStripeCatalog(env, {
    fetchImplementation: async (url) => {
      const expected = evaluation.prices.find((p) => new URL(String(url)).pathname.endsWith(`/${p.id}`));
      return expected.slot === "topup_50" ? { ok: false, status: 404 } : { ok: true, json: async () => fullPayload(expected) };
    },
  });
  assert.deepEqual(result, { ok: false, error: "stripe_catalog_missing", priceCount: 0, slot: "topup_50" });
});

test("protected full-catalog workflow maps all four topup prices without activating tax or Checkout", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  for (const amount of [10, 25, 50, 100]) {
    assert.ok(workflow.includes(`STRIPE_PRICE_TOPUP_${amount}: \u0024{{ vars.FANMIND_STAGING_STRIPE_PRICE_TOPUP_${amount} }}`));
  }
  assert.doesNotMatch(workflow, /FANMIND_STRIPE_TAX_REGISTRATION_CONFIRMED|top_up_sales_enabled|automatic_tax/u);
});

test("Capacity-v2 selects only 99/199/312 monthly prices without legacy setup or add-ons", () => {
  const evaluation = evaluateStagingStripeCatalogEnvironment(capacityEnvironment());
  assert.equal(evaluation.ok, true);
  assert.deepEqual(evaluation.prices.map((price) => price.unitAmount), [9900, 19900, 31200]);
  assert.deepEqual(evaluation.prices.map((price) => price.slot), ["capacity_99", "capacity_199", "capacity_312"]);
  assert.equal(STAGING_CAPACITY_PRICE_CONTRACTS.length, 3);
  for (const price of evaluation.prices) {
    assert.equal(validateStripeTestPrice(capacityPayload(price), price), true);
    for (const mutate of [
      (p) => { p.livemode = true; },
      (p) => { p.product.livemode = true; },
      (p) => { p.unit_amount += 1; },
      (p) => { p.tax_behavior = "inclusive"; },
      (p) => { p.recurring.interval = "year"; },
      (p) => { p.recurring.usage_type = "metered"; },
      (p) => { p.billing_scheme = "tiered"; },
      (p) => { p.transform_quantity = { divide_by: 10, round: "up" }; },
      (p) => { p.custom_unit_amount = { enabled: true }; },
    ]) {
      const payload = capacityPayload(price);
      mutate(payload);
      assert.equal(validateStripeTestPrice(payload, price), false);
    }
  }
});

test("Capacity-v2 missing mappings, live keys and unknown contracts fail before any request", async () => {
  for (const overrides of [
    { STRIPE_PRICE_CAPACITY_99: "" },
    { STRIPE_PRICE_CAPACITY_199: "price_SyntheticCapacity99" },
    { STRIPE_SECRET_KEY: "sk_live_DoNotUse" },
    { FANMIND_RUNTIME_ENVIRONMENT: "production" },
    { FANMIND_STAGING_STRIPE_CATALOG_CONTRACT: "capacity_v3" },
    { FANMIND_STAGING_STRIPE_CATALOG_CONTRACT: "" },
  ]) {
    let calls = 0;
    const result = await verifyStagingStripeCatalog(capacityEnvironment(overrides), {
      fetchImplementation: async () => { calls += 1; throw new Error("unexpected network"); },
    });
    assert.equal(result.error, "environment_invalid");
    assert.equal(calls, 0);
  }
});

test("Capacity-v2 makes exactly three GETs and never falls back to legacy after a missing price", async () => {
  const env = capacityEnvironment();
  const evaluation = evaluateStagingStripeCatalogEnvironment(env);
  for (const missing of [null, "capacity_199"]) {
    const seen = [];
    const result = await verifyStagingStripeCatalog(env, {
      fetchImplementation: async (url, options) => {
        assert.equal(options.method ?? "GET", "GET");
        assert.equal(options.body, undefined);
        seen.push(String(url));
        const expected = evaluation.prices.find((price) => String(url).includes(price.id));
        assert.ok(expected);
        if (expected.slot === missing) return { ok: false, status: 404 };
        return { ok: true, json: async () => capacityPayload(expected) };
      },
    });
    assert.equal(seen.length, 3);
    assert.equal(result.ok, missing === null);
    assert.equal(result.slot, missing);
    assert.equal(result.priceCount, missing === null ? 3 : 0);
  }
});

test("the protected workflow defaults to the new capacity catalog and maps all three prices", async () => {
  const workflow = await readFile(workflowPath, "utf8");
  assert.match(workflow, /default: capacity_v2_full/u);
  assert.match(workflow, /FANMIND_STAGING_STRIPE_CATALOG_CONTRACT: \$\{\{ inputs\.catalog_contract \}\}/u);
  for (const amount of [99, 199, 312]) {
    assert.ok(workflow.includes(`STRIPE_PRICE_CAPACITY_${amount}: \u0024{{ vars.FANMIND_STAGING_STRIPE_PRICE_CAPACITY_${amount} }}`));
  }
});

test("the workflow is exact-commit, protected, read-only and fully mapped", async () => {
  const [workflow, script, runbook] = await Promise.all([
    readFile(workflowPath, "utf8"),
    readFile(scriptPath, "utf8"),
    readFile(runbookPath, "utf8"),
  ]);

  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /inputs\.reviewed_commit == github\.sha/u);
  assert.match(workflow, /environment: staging/u);
  assert.match(workflow, /permissions:\n  contents: read/u);
  assert.match(workflow, /verify-staging-stripe-catalog/u);
  for (const name of [
    "FANMIND_STAGING_STRIPE_PRICE_STARTER_SETUP",
    "FANMIND_STAGING_STRIPE_PRICE_STARTER_MONTHLY",
    "FANMIND_STAGING_STRIPE_PRICE_INTERNAL_DAILY_TEST",
    "FANMIND_STAGING_STRIPE_PRICE_AI_PLUS",
    "FANMIND_STAGING_STRIPE_PRICE_AI_ULTRA",
  ]) {
    assert.match(workflow, new RegExp(name, "u"));
  }
  assert.doesNotMatch(
    workflow,
    /\b(?:POST|DELETE|PATCH)\b|PGHOST|PGPASSWORD|psql/iu,
  );
  assert.doesNotMatch(
    script,
    /console\.(?:log|error)\([^\n]*(?:STRIPE_SECRET_KEY|STRIPE_PRICE_|expected\.id)/u,
  );
  assert.match(runbook, /erstellt und verändert weder Stripe-Ressourcen/iu);
});

test("the offline contract check makes no network call", async () => {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [scriptPath, "--check"],
    { env: { ...process.env } },
  );
  const output = `${stdout}\n${stderr}`;
  assert.match(output, /STAGING_STRIPE_CATALOG_CONTRACT=PASS/u);
  assert.match(output, /STAGING_STRIPE_CATALOG_NETWORK_CALLS=0/u);
});
