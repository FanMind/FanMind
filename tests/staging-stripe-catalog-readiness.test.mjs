import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

import {
  STAGING_STRIPE_CATALOG_CONFIRMATION,
  STAGING_STRIPE_PRICE_CONTRACTS,
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
