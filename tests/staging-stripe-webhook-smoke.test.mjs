import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

import {
  STAGING_STRIPE_WEBHOOK_SMOKE_CONFIRMATION,
  STAGING_STRIPE_WEBHOOK_SMOKE_EVENT_TYPE,
  evaluateStagingStripeWebhookSmokeEnvironment,
  isStagingStripeWebhookSmokeContractSafe,
  runStagingStripeWebhookSmoke,
} from "../src/lib/stagingStripeWebhookSmokePolicy.mjs";
import { verifyStripeWebhookSignature } from "../src/lib/stripeWebhookSignaturePolicy.mjs";

const execFileAsync = promisify(execFile);
const releaseCommit = "a".repeat(40);
const secret = "whsec_SyntheticStagingBindingSecret";
const scriptPath = "scripts/operations/staging-stripe-webhook-smoke.mjs";
const workflowPath =
  ".github/workflows/staging-stripe-webhook-smoke.yml";

function environment(overrides = {}) {
  return {
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    FANMIND_STAGING_STRIPE_WEBHOOK_SMOKE_CONFIRM:
      STAGING_STRIPE_WEBHOOK_SMOKE_CONFIRMATION,
    FANMIND_EXPECTED_RELEASE_COMMIT: releaseCommit,
    FANMIND_WORKFLOW_COMMIT: releaseCommit,
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
    STRIPE_WEBHOOK_SECRET: secret,
    ...overrides,
  };
}

function response(status, payload) {
  return {
    status,
    async json() {
      return payload;
    },
  };
}

function versionPayload(overrides = {}) {
  return {
    application: "fanmind",
    releaseCommit,
    environment: "production",
    runtimeEnvironment: "staging",
    ...overrides,
  };
}

test("the signed smoke is exact-commit Staging-only and write-disabled", () => {
  assert.equal(isStagingStripeWebhookSmokeContractSafe(), true);
  assert.equal(
    evaluateStagingStripeWebhookSmokeEnvironment(environment()).ok,
    true,
  );
  assert.deepEqual(
    evaluateStagingStripeWebhookSmokeEnvironment(
      environment({ FANMIND_RUNTIME_ENVIRONMENT: "production" }),
    ).errors,
    ["runtime_environment"],
  );
  assert.deepEqual(
    evaluateStagingStripeWebhookSmokeEnvironment(
      environment({ FANMIND_WORKFLOW_COMMIT: "b".repeat(40) }),
    ).errors,
    ["workflow_commit"],
  );
  assert.deepEqual(
    evaluateStagingStripeWebhookSmokeEnvironment(
      environment({ FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true" }),
    ).errors,
    ["write_boundary"],
  );
  assert.deepEqual(
    evaluateStagingStripeWebhookSmokeEnvironment(
      environment({ STRIPE_WEBHOOK_SECRET: ` ${secret}` }),
    ).errors,
    ["webhook_secret"],
  );
});

test("the smoke verifies the deployed commit before sending one harmless signed probe", async () => {
  const calls = [];
  const nowSeconds = 1_787_000_000;
  const result = await runStagingStripeWebhookSmoke(environment(), {
    nowSeconds,
    fetchImplementation: async (url, options) => {
      calls.push({ url: String(url), options });
      if (calls.length === 1) return response(200, versionPayload());
      return response(200, { received: true });
    },
  });

  assert.deepEqual(result, {
    ok: true,
    error: null,
    httpStatus: 200,
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://staging.fanmind.ch/api/version");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(
    calls[1].url,
    "https://staging.fanmind.ch/api/stripe/webhook",
  );
  assert.equal(calls[1].options.method, "POST");
  const probe = JSON.parse(calls[1].options.body);
  assert.equal(probe.type, STAGING_STRIPE_WEBHOOK_SMOKE_EVENT_TYPE);
  assert.equal(probe.livemode, false);
  assert.equal(Object.hasOwn(probe.data.object, "workspace_id"), false);
  assert.equal(Object.hasOwn(probe.data.object, "customer"), false);
  assert.equal(Object.hasOwn(probe.data.object, "subscription"), false);
  assert.equal(
    verifyStripeWebhookSignature({
      rawBody: calls[1].options.body,
      signatureHeader: calls[1].options.headers["Stripe-Signature"],
      configuredSecret: secret,
      nowSeconds,
    }),
    true,
  );
});

test("release drift and invalid receipts stop the signed probe fail-closed", async () => {
  const calls = [];
  const drift = await runStagingStripeWebhookSmoke(environment(), {
    fetchImplementation: async (url, options) => {
      calls.push({ url, options });
      return response(200, versionPayload({ releaseCommit: "b".repeat(40) }));
    },
  });
  assert.equal(drift.error, "version_mismatch");
  assert.equal(calls.length, 1);

  const invalidReceipt = await runStagingStripeWebhookSmoke(environment(), {
    fetchImplementation: async (_url, _options) =>
      _options.method === "GET"
        ? response(200, versionPayload())
        : response(200, { received: true, unexpected: true }),
  });
  assert.equal(invalidReceipt.error, "webhook_invalid");
});

test("the workflow is protected, redacted and cannot touch Stripe or Supabase resources", async () => {
  const [workflow, script, policy, handler] = await Promise.all([
    readFile(workflowPath, "utf8"),
    readFile(scriptPath, "utf8"),
    readFile("src/lib/stagingStripeWebhookSmokePolicy.mjs", "utf8"),
    readFile("src/app/api/stripe/webhook/route.ts", "utf8"),
  ]);

  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /inputs\.reviewed_commit == github\.sha/u);
  assert.match(workflow, /environment: staging/u);
  assert.match(workflow, /permissions:\n  contents: read/u);
  assert.match(workflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'/u);
  assert.match(workflow, /run-signed-staging-stripe-webhook-smoke/u);
  assert.doesNotMatch(
    workflow,
    /STRIPE_SECRET_KEY|SUPABASE|PGHOST|PGPASSWORD|psql/iu,
  );
  assert.doesNotMatch(policy, /api\.stripe\.com|SUPABASE|workspace_id/iu);
  assert.doesNotMatch(handler, new RegExp(STAGING_STRIPE_WEBHOOK_SMOKE_EVENT_TYPE, "u"));
  assert.match(
    handler,
    /if \(!isHandledStripeWebhookEventType\(event\.type\)\) \{[\s\S]*return NextResponse\.json\(\{ received: true \}\);[\s\S]*const object/u,
  );
  assert.doesNotMatch(
    script,
    /console\.(?:log|error)\([^\n]*(?:process\.env|STRIPE_WEBHOOK_SECRET)/u,
  );
});

test("the offline signed-smoke contract makes no network call", async () => {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [scriptPath, "--check"],
    { env: { ...process.env } },
  );
  const output = `${stdout}\n${stderr}`;
  assert.match(output, /STAGING_STRIPE_WEBHOOK_SMOKE_CONTRACT=PASS/u);
  assert.match(output, /STAGING_STRIPE_WEBHOOK_SMOKE_NETWORK_CALLS=0/u);
  assert.match(output, /STAGING_STRIPE_WEBHOOK_SMOKE_MUTATIONS=0/u);
});
