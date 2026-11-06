import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildAiTierStripeLedgerCommand,
  buildAiTierStripeLedgerRpcBody,
  normalizeAiTierStripeLedgerRpcResult,
} from "../src/lib/aiTierStripeEventLedger.mjs";
import {
  syncWorkspaceAiTierStripeEntitlement,
} from "../src/lib/aiTierStripeEntitlementSync.mjs";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const environment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.supabase.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_DO_NOT_PRINT",
  FANMIND_AI_TIER_STRIPE_PERSISTENCE_ENABLED: "true",
  FANMIND_AI_TIER_STRIPE_EVENT_LEDGER_ENABLED: "true",
  FANMIND_AI_TIER_WORKSPACE_CONTRACT_CONFIRMED: "true",
  STRIPE_PRICE_AI_PLUS: "price_plus_DO_NOT_PRINT",
  STRIPE_PRICE_AI_ULTRA: "price_ultra_DO_NOT_PRINT",
};

function event({
  id = "evt_current_DO_NOT_PRINT",
  created = 1_753_056_000,
  priceId = environment.STRIPE_PRICE_AI_PLUS,
  items,
} = {}) {
  return {
    id,
    created,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_current_DO_NOT_PRINT",
        customer: "cus_current_DO_NOT_PRINT",
        status: "active",
        cancel_at_period_end: false,
        items: {
          has_more: false,
          data: items ?? [
            {
              id: "si_current_DO_NOT_PRINT",
              current_period_start: 1_751_328_000,
              current_period_end: 1_754_006_400,
              price: { id: priceId },
            },
          ],
        },
      },
    },
  };
}

function response(payload, ok = true) {
  return {
    ok,
    async json() {
      return payload;
    },
  };
}

test("the bridge stays dormant until the controlled ledger gate is explicit", async () => {
  for (const missing of [
    "FANMIND_AI_TIER_STRIPE_PERSISTENCE_ENABLED",
    "FANMIND_AI_TIER_STRIPE_EVENT_LEDGER_ENABLED",
    "FANMIND_AI_TIER_WORKSPACE_CONTRACT_CONFIRMED",
    "STRIPE_PRICE_AI_PLUS",
    "STRIPE_PRICE_AI_ULTRA",
  ]) {
    let requests = 0;
    const disabledEnvironment = { ...environment };
    delete disabledEnvironment[missing];
    const result = await syncWorkspaceAiTierStripeEntitlement({
      workspaceId,
      event: event(),
      signedEventVerified: true,
      environment: disabledEnvironment,
      fetchImplementation: async () => {
        requests += 1;
        throw new Error("must not fetch");
      },
    });

    assert.deepEqual(result, { status: "disabled", reason: null });
    assert.equal(requests, 0);
  }
});

test("an unsigned internal call cannot reach persistence", async () => {
  let requests = 0;
  const result = await syncWorkspaceAiTierStripeEntitlement({
    workspaceId,
    event: event(),
    environment,
    fetchImplementation: async () => {
      requests += 1;
      throw new Error("must not fetch");
    },
  });

  assert.deepEqual(result, {
    status: "retry",
    reason: "signature_verification",
  });
  assert.equal(requests, 0);
});

test("the service-role RPC rejects cleartext remote URLs and URL credentials", async () => {
  for (const nextPublicSupabaseUrl of [
    "http://synthetic.supabase.invalid",
    "https://user:password@synthetic.supabase.invalid",
  ]) {
    let requests = 0;
    const result = await syncWorkspaceAiTierStripeEntitlement({
      workspaceId,
      event: event(),
      signedEventVerified: true,
      environment: { ...environment, NEXT_PUBLIC_SUPABASE_URL: nextPublicSupabaseUrl },
      fetchImplementation: async () => {
        requests += 1;
        throw new Error("must not fetch");
      },
    });

    assert.deepEqual(result, {
      status: "retry",
      reason: "storage_configuration",
    });
    assert.equal(requests, 0);
  }
});

test("a signed paid event becomes one normalized atomic RPC call", async () => {
  const requests = [];
  const result = await syncWorkspaceAiTierStripeEntitlement({
    workspaceId,
    event: event(),
    signedEventVerified: true,
    environment,
    fetchImplementation: async (url, options) => {
      requests.push({ url: String(url), options });
      return response([
        { result_status: "applied", result_reason: null, result_revision: 1 },
      ]);
    },
  });

  assert.deepEqual(result, { status: "applied", reason: null });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.method, "POST");
  assert.match(
    requests[0].url,
    /\/rest\/v1\/rpc\/apply_workspace_ai_tier_stripe_event$/u,
  );
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.p_workspace_id, workspaceId);
  assert.equal(body.p_signature_verified, true);
  assert.equal(body.p_customer_id, "cus_current_DO_NOT_PRINT");
  assert.equal(body.p_subscription_id, "sub_current_DO_NOT_PRINT");
  assert.equal(body.p_has_paid_item, true);
  assert.equal(body.p_tier_id, "plus");
  assert.match(body.p_payload_fingerprint, /^[a-f0-9]{64}$/u);
  assert.doesNotMatch(JSON.stringify(result), /DO_NOT_PRINT/u);
});

test("a complete Starter-only snapshot is ledgered without inventing paid state", async () => {
  const prepared = buildAiTierStripeLedgerCommand({
    workspaceId,
    event: event({ priceId: "price_starter_DO_NOT_PRINT" }),
    signedEventVerified: true,
    environment,
  });
  assert.equal(prepared.status, "record");
  assert.equal(prepared.reason, "unrelated_price");
  assert.equal(prepared.command.paidItem, null);

  const body = buildAiTierStripeLedgerRpcBody(prepared.command);
  assert.equal(body.p_has_paid_item, false);
  for (const field of [
    "p_tier_id",
    "p_lifecycle_status",
    "p_subscription_item_id",
    "p_price_id",
    "p_effective_at",
    "p_expires_at",
  ]) {
    assert.equal(body[field], null);
  }
});

test("tenant binding requires the signed subscription customer", () => {
  const missing = event();
  delete missing.data.object.customer;
  assert.deepEqual(
    buildAiTierStripeLedgerCommand({
      workspaceId,
      event: missing,
      signedEventVerified: true,
      environment,
    }),
    { status: "retry", reason: "tenant_binding", command: null },
  );

  const expanded = event();
  expanded.data.object.customer = { id: "cus_expanded_DO_NOT_PRINT" };
  const prepared = buildAiTierStripeLedgerCommand({
    workspaceId,
    event: expanded,
    signedEventVerified: true,
    environment,
  });
  assert.equal(prepared.command.customerId, "cus_expanded_DO_NOT_PRINT");
});

test("the payload fingerprint is deterministic and changes with projection state", () => {
  const first = buildAiTierStripeLedgerCommand({
    workspaceId,
    event: event(),
    signedEventVerified: true,
    environment,
  });
  const replay = buildAiTierStripeLedgerCommand({
    workspaceId,
    event: event(),
    signedEventVerified: true,
    environment,
  });
  const changed = event();
  changed.data.object.status = "past_due";
  const changedCommand = buildAiTierStripeLedgerCommand({
    workspaceId,
    event: changed,
    signedEventVerified: true,
    environment,
  });

  assert.equal(
    first.command.payloadFingerprint,
    replay.command.payloadFingerprint,
  );
  assert.notEqual(
    first.command.payloadFingerprint,
    changedCommand.command.payloadFingerprint,
  );
});

test("same-second conflicts are acknowledged as durable reconciliation instead of retry", async () => {
  const result = await syncWorkspaceAiTierStripeEntitlement({
    workspaceId,
    event: event({ id: "evt_collision_DO_NOT_PRINT" }),
    signedEventVerified: true,
    environment,
    fetchImplementation: async () =>
      response([
        {
          result_status: "reconciliation_needed",
          result_reason: "event_order_conflict",
          result_revision: 3,
        },
      ]),
  });

  assert.deepEqual(result, {
    status: "reconciliation_needed",
    reason: "event_order_conflict",
  });
});

test("RPC responses are exact, redacted and fail closed", () => {
  assert.deepEqual(
    normalizeAiTierStripeLedgerRpcResult([
      { result_status: "ignored", result_reason: "stale_event", result_revision: 4 },
    ]),
    { status: "ignored", reason: "stale_event", revision: 4 },
  );
  for (const payload of [
    [],
    [{ result_status: "applied", result_reason: "stale_event", result_revision: 1 }],
    [{ result_status: "reconciliation_needed", result_reason: "raw_DO_NOT_PRINT", result_revision: 1 }],
    [{ result_status: "applied", result_reason: null, result_revision: -1 }],
  ]) {
    assert.equal(normalizeAiTierStripeLedgerRpcResult(payload), null);
  }
});

test("the verified webhook path passes signature provenance and retries only retryable storage", async () => {
  const route = await readFile("src/app/api/stripe/webhook/route.ts", "utf8");
  assert.match(
    route,
    /export async function POST[\s\S]*verifyStripeSignature\(rawBody,[\s\S]*return NextResponse\.json\([\s\S]*status: 400/u,
  );
  assert.match(
    route,
    /syncWorkspaceAiTierStripeEntitlement\(\{[\s\S]*signedEventVerified: true[\s\S]*aiTierSync\.status === "retry"[\s\S]*throw new StripeWebhookRetryableError\(\)[\s\S]*aiTierSync\.status === "reconciliation_needed"/u,
  );
});
