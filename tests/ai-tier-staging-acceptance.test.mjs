import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import test from "node:test";

import {
  AI_TIER_STAGING_ACCEPTANCE_CONFIRMATION,
  AI_TIER_STAGING_RESOURCE_CONFIRMATION,
  buildAiTierSyntheticLifecycleProof,
  evaluateAiTierStagingAcceptanceEnvironment,
  evaluateAiTierStagingResourceEnvironment,
  isAiTierStagingWorkspaceId,
  validateAiTierStripeTestPrice,
} from "../src/lib/aiTierStagingAcceptancePolicy.mjs";

const execFileAsync = promisify(execFile);
const scriptPath =
  "scripts/operations/ai-tier-staging-acceptance.mjs";
const workflowPath =
  ".github/workflows/ai-tier-staging-acceptance.yml";
const resourceWorkflowPath =
  ".github/workflows/ai-tier-staging-resource-readiness.yml";

function stagingEnvironment(overrides = {}) {
  return {
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.example",
    NEXT_PUBLIC_SUPABASE_URL:
      "https://stagingref12345.supabase.co",
    FANMIND_TARGET_SUPABASE_PROJECT_REF: "stagingref12345",
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    FANMIND_NON_PRODUCTION_WRITE_ACK:
      "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    FANMIND_AI_TIER_STAGING_ACCEPTANCE_CONFIRM:
      AI_TIER_STAGING_ACCEPTANCE_CONFIRMATION,
    FANMIND_AI_TIER_STAGING_WORKSPACE_ID:
      "11111111-1111-4111-8111-111111111111",
    STRIPE_SECRET_KEY: "sk_test_DO_NOT_PRINT",
    STRIPE_PRICE_AI_PLUS: "price_plus_DO_NOT_PRINT",
    STRIPE_PRICE_AI_ULTRA: "price_ultra_DO_NOT_PRINT",
    ...overrides,
  };
}

function stagingResourceEnvironment(overrides = {}) {
  return stagingEnvironment({
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "",
    FANMIND_AI_TIER_STAGING_ACCEPTANCE_CONFIRM: "",
    FANMIND_AI_TIER_STAGING_RESOURCE_CONFIRM:
      AI_TIER_STAGING_RESOURCE_CONFIRMATION,
    ...overrides,
  });
}

function stripePrice({
  id = "price_plus_DO_NOT_PRINT",
  unitAmount = 10_000,
  livemode = false,
} = {}) {
  return {
    object: "price",
    id,
    livemode,
    active: true,
    type: "recurring",
    currency: "eur",
    unit_amount: unitAmount,
    recurring: {
      interval: "month",
      interval_count: 1,
    },
    product: {
      object: "product",
      active: true,
      livemode,
    },
  };
}

test("staging acceptance environment requires all independent gates", () => {
  assert.deepEqual(
    evaluateAiTierStagingAcceptanceEnvironment(stagingEnvironment()),
    { ok: true, errors: [] },
  );

  const unsafe = evaluateAiTierStagingAcceptanceEnvironment(
    stagingEnvironment({
      FANMIND_RUNTIME_ENVIRONMENT: "production",
      NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
      NEXT_PUBLIC_SUPABASE_URL:
        "https://productionref123.supabase.co",
      FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionref123",
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
      FANMIND_NON_PRODUCTION_WRITE_ACK: "",
      FANMIND_AI_TIER_STAGING_ACCEPTANCE_CONFIRM: "",
      STRIPE_SECRET_KEY: "sk_live_DO_NOT_PRINT",
    }),
  );
  assert.equal(unsafe.ok, false);
  assert.ok(unsafe.errors.includes("environment_boundary"));
  assert.ok(unsafe.errors.includes("runtime_environment"));
  assert.ok(unsafe.errors.includes("production_target"));
  assert.ok(unsafe.errors.includes("write_acknowledgement"));
  assert.ok(unsafe.errors.includes("acceptance_confirmation"));
  assert.ok(unsafe.errors.includes("stripe_test_mode"));
  assert.doesNotMatch(JSON.stringify(unsafe), /DO_NOT_PRINT/u);
});

test("AI tier Staging accepts a restricted Stripe test key", () => {
  const result = evaluateAiTierStagingAcceptanceEnvironment(
    stagingEnvironment({ STRIPE_SECRET_KEY: "rk_test_DO_NOT_PRINT" }),
  );
  assert.equal(result.ok, true);
  assert.doesNotMatch(JSON.stringify(result), /DO_NOT_PRINT/u);
});

test("resource preflight requires staging identity without write gates", () => {
  assert.deepEqual(
    evaluateAiTierStagingResourceEnvironment(
      stagingResourceEnvironment(),
    ),
    { ok: true, errors: [] },
  );

  const unsafe = evaluateAiTierStagingResourceEnvironment(
    stagingResourceEnvironment({
      FANMIND_RUNTIME_ENVIRONMENT: "production",
      NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
      NEXT_PUBLIC_SUPABASE_URL:
        "https://productionref123.supabase.co",
      FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionref123",
      FANMIND_AI_TIER_STAGING_RESOURCE_CONFIRM: "",
      STRIPE_SECRET_KEY: "sk_live_DO_NOT_PRINT",
    }),
  );
  assert.equal(unsafe.ok, false);
  assert.ok(unsafe.errors.includes("runtime_environment"));
  assert.ok(unsafe.errors.includes("production_target"));
  assert.ok(unsafe.errors.includes("resource_confirmation"));
  assert.ok(unsafe.errors.includes("stripe_test_mode"));
  assert.doesNotMatch(JSON.stringify(unsafe), /DO_NOT_PRINT/u);
});

test("synthetic workspace must be a canonical non-empty UUID", () => {
  assert.equal(
    isAiTierStagingWorkspaceId(
      "11111111-1111-4111-8111-111111111111",
    ),
    true,
  );
  assert.equal(isAiTierStagingWorkspaceId("production"), false);
  assert.equal(isAiTierStagingWorkspaceId(""), false);
});

test("Stripe catalog proof requires active EUR monthly test prices", () => {
  assert.equal(
    validateAiTierStripeTestPrice(stripePrice(), {
      expectedId: "price_plus_DO_NOT_PRINT",
      expectedUnitAmount: 10_000,
    }),
    true,
  );
  assert.equal(
    validateAiTierStripeTestPrice(
      stripePrice({ livemode: true }),
      {
        expectedId: "price_plus_DO_NOT_PRINT",
        expectedUnitAmount: 10_000,
      },
    ),
    false,
  );
  assert.equal(
    validateAiTierStripeTestPrice(
      stripePrice({ unitAmount: 20_000 }),
      {
        expectedId: "price_plus_DO_NOT_PRINT",
        expectedUnitAmount: 10_000,
      },
    ),
    false,
  );
  assert.equal(
    validateAiTierStripeTestPrice(
      {
        ...stripePrice(),
        product: "prod_unexpanded_DO_NOT_PRINT",
      },
      {
        expectedId: "price_plus_DO_NOT_PRINT",
        expectedUnitAmount: 10_000,
      },
    ),
    false,
  );
});

test("synthetic lifecycle proves both tiers and ordering without exposing IDs", () => {
  const proof = buildAiTierSyntheticLifecycleProof(
    stagingEnvironment(),
    {
      eventCreatedAt: 1_753_056_000,
      nonce: "0123456789abcdef",
    },
  );
  assert.equal(proof.ok, true);
  assert.equal(proof.mutation?.tierId, "plus");
  assert.match(
    proof.mutation?.stripePriceId ?? "",
    /^price_plus_/u,
  );

  const failed = buildAiTierSyntheticLifecycleProof(
    {
      STRIPE_PRICE_AI_PLUS: "price_same_DO_NOT_PRINT",
      STRIPE_PRICE_AI_ULTRA: "price_same_DO_NOT_PRINT",
    },
    {
      eventCreatedAt: 1_753_056_000,
      nonce: "0123456789abcdef",
    },
  );
  assert.deepEqual(failed, { ok: false, mutation: null });
});

test("offline CLI check needs no database or Stripe credentials", async () => {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [scriptPath, "--check"],
    { env: process.env },
  );
  const output = `${stdout}\n${stderr}`;
  assert.match(
    output,
    /AI_TIER_STAGING_ACCEPTANCE_MODE=check/u,
  );
  assert.match(
    output,
    /AI_TIER_STAGING_ACCEPTANCE_READY=YES/u,
  );
  assert.doesNotMatch(output, /price_|stripe|workspace.*-/iu);
});

test("manual workflow is staging-only and never applies a migration", async () => {
  const [workflow, script] = await Promise.all([
    readFile(workflowPath, "utf8"),
    readFile(scriptPath, "utf8"),
  ]);

  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(
    workflow,
    /inputs\.confirmation == 'run-ai-tier-staging-acceptance'/u,
  );
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /environment: staging/u);
  assert.match(
    workflow,
    /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'true'/u,
  );
  assert.match(
    workflow,
    /FANMIND_NON_PRODUCTION_WRITE_ACK: I_UNDERSTAND_NON_PRODUCTION_ONLY/u,
  );
  assert.doesNotMatch(
    workflow,
    /^      PGPASSFILE: \$\{\{ runner\.temp \}\}/mu,
  );
  assert.equal(
    workflow.match(
      /^          PGPASSFILE: \$\{\{ runner\.temp \}\}\/fanmind-ai-tier-staging\.pgpass$/gmu,
    )?.length,
    4,
  );
  assert.match(
    workflow,
    /npm run db:ai-tier-entitlements:verify/u,
  );
  assert.match(
    workflow,
    /npm run ai:tiers:staging:run/u,
  );
  assert.match(workflow, /rm -f "\$PGPASSFILE"/u);
  assert.doesNotMatch(
    workflow,
    /db:ai-tier-entitlements:apply|sk_live_|fanmind\.ch/u,
  );

  assert.match(script, /set local role authenticated/u);
  assert.match(script, /set local role service_role/u);
  assert.match(script, /AI_TIER_STAGING_SERVICE_ROLE_LEDGER=PASS/u);
  assert.match(script, /stripe_customer_id is null\s+and stripe_subscription_id is null;\s+set local role service_role/u);
  assert.match(script, /service_role_fixture_rollback_failed/u);
  assert.match(script, /status = 'canceled'[\s\S]*stripe_sync_revision = 3[\s\S]*ledger_acceptance_canceled_projection_failed/u);
  assert.doesNotMatch(script, /ledger_acceptance_projection_cleanup_failed/u);
  assert.match(
    script,
    /apply_workspace_ai_tier_stripe_event[\s\S]*ledgerMode === "ledger"/u,
  );
  assert.match(script, /rollback;/u);
  assert.match(
    script,
    /AI_TIER_STAGING_TRANSACTION=ROLLED_BACK/u,
  );
  assert.match(script, /AI_TIER_STAGING_ROLLBACK=PASS/u);
  assert.doesNotMatch(
    script,
    /console\.(?:log|error)\([^\n]*(?:STRIPE_SECRET_KEY|STRIPE_PRICE_AI_|WORKSPACE_ID|ownerId|memberId)/u,
  );
});

test("resource workflow proves external readiness without enabling writes", async () => {
  const [workflow, script] = await Promise.all([
    readFile(resourceWorkflowPath, "utf8"),
    readFile(scriptPath, "utf8"),
  ]);

  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(
    workflow,
    /inputs\.confirmation == 'verify-ai-tier-staging-resources'/u,
  );
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /environment: staging/u);
  assert.match(
    workflow,
    /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'/u,
  );
  assert.match(
    workflow,
    /FANMIND_NON_PRODUCTION_WRITE_ACK: ''/u,
  );
  assert.match(
    workflow,
    /npm run ai:tiers:staging:preflight/u,
  );
  assert.match(workflow, /rm -f "\$PGPASSFILE"/u);
  assert.doesNotMatch(
    workflow,
    /db:ai-tier-entitlements:apply|ai:tiers:staging:run|sk_live_|fanmind\.ch/u,
  );

  assert.match(script, /set transaction read only/u);
  assert.match(
    script,
    /AI_TIER_STAGING_RESOURCE_MODE=READ_ONLY/u,
  );
  assert.match(
    script,
    /AI_TIER_STAGING_RESOURCE_READINESS=PASS/u,
  );
});
