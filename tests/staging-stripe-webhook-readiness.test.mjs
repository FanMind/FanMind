import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

import {
  STAGING_STRIPE_WEBHOOK_CONFIRMATION,
  STAGING_STRIPE_WEBHOOK_EVENTS,
  STAGING_STRIPE_WEBHOOK_URL,
  STRIPE_API_VERSION,
  classifyStripeWebhookResponseStatus,
  evaluateStagingStripeWebhookEnvironment,
  validateStripeTestWebhookEndpoint,
  verifyStagingStripeWebhookEndpoint,
} from "../src/lib/stagingStripeWebhookPolicy.mjs";

const execFileAsync = promisify(execFile);
const scriptPath =
  "scripts/operations/staging-stripe-webhook-readiness.mjs";
const workflowPath =
  ".github/workflows/staging-stripe-webhook-readiness.yml";
const runbookPath =
  "docs/operations/STAGING_STRIPE_WEBHOOK_READINESS.md";

function environment(overrides = {}) {
  return {
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    FANMIND_STAGING_STRIPE_WEBHOOK_CONFIRM:
      STAGING_STRIPE_WEBHOOK_CONFIRMATION,
    STRIPE_SECRET_KEY: "rk_test_SyntheticWebhookReadKey",
    STRIPE_WEBHOOK_SECRET: "whsec_SyntheticWebhookSecret",
    ...overrides,
  };
}

function endpoint(overrides = {}) {
  return {
    id: "we_SyntheticStagingEndpoint",
    object: "webhook_endpoint",
    api_version: STRIPE_API_VERSION,
    enabled_events: [...STAGING_STRIPE_WEBHOOK_EVENTS],
    livemode: false,
    status: "enabled",
    url: STAGING_STRIPE_WEBHOOK_URL,
    ...overrides,
  };
}

function page(data, hasMore = false) {
  return {
    ok: true,
    async json() {
      return {
        object: "list",
        data,
        has_more: hasMore,
      };
    },
  };
}

test("the Staging webhook contract is exact and environment-bound", () => {
  assert.equal(STAGING_STRIPE_WEBHOOK_EVENTS.length, 22);
  assert.equal(new Set(STAGING_STRIPE_WEBHOOK_EVENTS).size, 22);
  assert.equal(
    STAGING_STRIPE_WEBHOOK_URL,
    "https://staging.fanmind.ch/api/stripe/webhook",
  );
  assert.equal(
    evaluateStagingStripeWebhookEnvironment(environment()).ok,
    true,
  );
  assert.deepEqual(
    evaluateStagingStripeWebhookEnvironment(
      environment({ STRIPE_SECRET_KEY: "sk_live_DoNotUse" }),
    ).errors,
    ["stripe_test_mode"],
  );
  assert.deepEqual(
    evaluateStagingStripeWebhookEnvironment(
      environment({ FANMIND_RUNTIME_ENVIRONMENT: "production" }),
    ).errors,
    ["runtime_environment"],
  );
});

test("endpoint validation requires test mode, enabled status, pinned version and exact events", () => {
  assert.deepEqual(validateStripeTestWebhookEndpoint(endpoint()), {
    ok: true,
    error: null,
    missingEvent: null,
  });
  assert.equal(
    validateStripeTestWebhookEndpoint(endpoint({ livemode: true })).error,
    "stripe_webhook_live_mode",
  );
  assert.equal(
    validateStripeTestWebhookEndpoint(endpoint({ status: "disabled" })).error,
    "stripe_webhook_disabled",
  );
  assert.equal(
    validateStripeTestWebhookEndpoint(endpoint({ api_version: null })).error,
    "stripe_webhook_api_version",
  );

  const missingEvent = STAGING_STRIPE_WEBHOOK_EVENTS[3];
  assert.deepEqual(
    validateStripeTestWebhookEndpoint(
      endpoint({
        enabled_events: STAGING_STRIPE_WEBHOOK_EVENTS.filter(
          (event) => event !== missingEvent,
        ),
      }),
    ),
    {
      ok: false,
      error: "stripe_webhook_events",
      missingEvent,
    },
  );
  assert.deepEqual(
    validateStripeTestWebhookEndpoint(
      endpoint({
        enabled_events: [
          ...STAGING_STRIPE_WEBHOOK_EVENTS,
          "charge.succeeded",
        ],
      }),
    ),
    {
      ok: false,
      error: "stripe_webhook_events",
      missingEvent: null,
    },
  );
});

test("Stripe response failures collapse to stable categories", () => {
  assert.equal(
    classifyStripeWebhookResponseStatus(401),
    "stripe_webhook_auth_or_permission",
  );
  assert.equal(
    classifyStripeWebhookResponseStatus(403),
    "stripe_webhook_auth_or_permission",
  );
  assert.equal(
    classifyStripeWebhookResponseStatus(429),
    "stripe_webhook_unavailable",
  );
  assert.equal(
    classifyStripeWebhookResponseStatus(503),
    "stripe_webhook_unavailable",
  );
  assert.equal(
    classifyStripeWebhookResponseStatus(400),
    "stripe_webhook_rejected",
  );
});

test("read-only verification uses the pinned API version and accepts one exact endpoint", async () => {
  const requests = [];
  const result = await verifyStagingStripeWebhookEndpoint(environment(), {
    fetchImplementation: async (url, options) => {
      requests.push({ url: String(url), headers: options.headers });
      return page([endpoint()]);
    },
  });

  assert.deepEqual(result, {
    ok: true,
    error: null,
    eventCount: 22,
    missingEvent: null,
  });
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/v1\/webhook_endpoints\?limit=100$/u);
  assert.equal(requests[0].headers["Stripe-Version"], STRIPE_API_VERSION);
  assert.equal(
    requests[0].headers.Authorization,
    "Bearer rk_test_SyntheticWebhookReadKey",
  );
});

test("verification follows pagination without disclosing endpoint IDs", async () => {
  const requests = [];
  const firstEndpoint = endpoint({
    id: "we_SyntheticOtherEndpoint",
    url: "https://example.invalid/webhook",
  });
  const result = await verifyStagingStripeWebhookEndpoint(environment(), {
    fetchImplementation: async (url) => {
      requests.push(String(url));
      return requests.length === 1
        ? page([firstEndpoint], true)
        : page([endpoint()]);
    },
  });

  assert.equal(result.ok, true);
  assert.equal(requests.length, 2);
  assert.match(
    requests[1],
    /starting_after=we_SyntheticOtherEndpoint/u,
  );
});

test("missing, duplicate and incomplete Staging endpoints fail closed", async () => {
  const missing = await verifyStagingStripeWebhookEndpoint(environment(), {
    fetchImplementation: async () => page([]),
  });
  assert.equal(missing.error, "stripe_webhook_missing");

  const duplicate = await verifyStagingStripeWebhookEndpoint(environment(), {
    fetchImplementation: async () =>
      page([endpoint(), endpoint({ id: "we_SyntheticDuplicate" })]),
  });
  assert.equal(duplicate.error, "stripe_webhook_duplicate");

  const missingEvent = STAGING_STRIPE_WEBHOOK_EVENTS.at(-1);
  const incomplete = await verifyStagingStripeWebhookEndpoint(environment(), {
    fetchImplementation: async () =>
      page([
        endpoint({
          enabled_events: STAGING_STRIPE_WEBHOOK_EVENTS.slice(0, -1),
        }),
      ]),
  });
  assert.deepEqual(incomplete, {
    ok: false,
    error: "stripe_webhook_events",
    eventCount: 0,
    missingEvent,
  });

  const malformedList = await verifyStagingStripeWebhookEndpoint(
    environment(),
    {
      fetchImplementation: async () =>
        page([endpoint(), { object: "webhook_endpoint" }]),
    },
  );
  assert.equal(malformedList.error, "stripe_webhook_invalid");
});

test("the event contract stays synchronized with the Stripe webhook handler", async () => {
  const source = await readFile("src/app/api/stripe/webhook/route.ts", "utf8");
  const handledEvents = new Set(
    [...source.matchAll(/event\.type\s*===\s*"([^"]+)"/gu)].map(
      (match) => match[1],
    ),
  );
  assert.deepEqual(
    [...handledEvents].sort(),
    [...STAGING_STRIPE_WEBHOOK_EVENTS].sort(),
  );
});

test("the workflow is exact-commit, protected, read-only and redacted", async () => {
  const [workflow, script, policy, runbook] = await Promise.all([
    readFile(workflowPath, "utf8"),
    readFile(scriptPath, "utf8"),
    readFile("src/lib/stagingStripeWebhookPolicy.mjs", "utf8"),
    readFile(runbookPath, "utf8"),
  ]);

  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /inputs\.reviewed_commit == github\.sha/u);
  assert.match(workflow, /environment: staging/u);
  assert.match(workflow, /permissions:\n  contents: read/u);
  assert.match(workflow, /verify-staging-stripe-webhook/u);
  assert.doesNotMatch(
    workflow,
    /\b(?:POST|DELETE|PATCH)\b|PGHOST|PGPASSWORD|psql/iu,
  );
  assert.doesNotMatch(
    script,
    /console\.(?:log|error)\([^\n]*(?:process\.env|environment\.(?:STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET)|endpoint\.id)/u,
  );
  assert.doesNotMatch(policy, /console\.(?:log|error)/u);
  assert.match(policy, /"Stripe-Version": STRIPE_API_VERSION/u);
  assert.match(runbook, /erstellt, ändert[\s\S]*weder Stripe-Ressourcen/iu);
  assert.match(runbook, /GET \/v1\/webhook_endpoints/u);
});

test("the offline contract check makes no network call", async () => {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [scriptPath, "--check"],
    { env: { ...process.env } },
  );
  const output = `${stdout}\n${stderr}`;
  assert.match(output, /STAGING_STRIPE_WEBHOOK_CONTRACT=PASS/u);
  assert.match(output, /STAGING_STRIPE_WEBHOOK_NETWORK_CALLS=0/u);
});
