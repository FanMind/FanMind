import assert from "node:assert/strict";
import test from "node:test";

import { syncStripeBillingEvent } from "../src/lib/stripeBillingEventSync.mjs";

const ENVIRONMENT = {
  FANMIND_STRIPE_BILLING_EVENT_LEDGER_ENABLED: "true",
  FANMIND_STRIPE_BILLING_EVENT_LEDGER_CONTROL_CONFIRMED: "20260816210000",
  FANMIND_STRIPE_BILLING_CANONICAL_RECONCILIATION_CONFIRMED: "true",
  NEXT_PUBLIC_SUPABASE_URL: "https://staging.example.test",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
};
const WORKSPACE_ID = "4cf1aa49-0b0c-4cbe-9ef1-a94bf41c771a";
const EVENT = {
  id: "evt_sync_1",
  created: 1_787_000_001,
  type: "payment_intent.succeeded",
  data: { object: { id: "pi_test_1", customer: "cus_test_1" } },
};

test("disabled bridge performs no storage call", async () => {
  let calls = 0;
  const result = await syncStripeBillingEvent({
    event: EVENT,
    projection: { billing_status: "active" },
    signedEventVerified: true,
    environment: {},
    fetchImplementation: async () => { calls += 1; },
  });
  assert.equal(result.status, "disabled");
  assert.equal(calls, 0);
});

test("enabled bridge sends one normalized RPC and returns applied workspace", async () => {
  let request;
  const result = await syncStripeBillingEvent({
    event: EVENT,
    projection: { billing_status: "active" },
    signedEventVerified: true,
    environment: ENVIRONMENT,
    fetchImplementation: async (url, init) => {
      request = { url: String(url), init };
      return {
        ok: true,
        json: async () => [{
          result_status: "applied",
          result_reason: null,
          result_workspace_id: WORKSPACE_ID,
          result_revision: 1,
        }],
      };
    },
  });
  assert.equal(result.status, "applied");
  assert.equal(result.workspaceId, WORKSPACE_ID);
  assert.equal(
    request.url,
    "https://staging.example.test/rest/v1/rpc/apply_workspace_stripe_billing_event",
  );
  const body = JSON.parse(request.init.body);
  assert.equal(body.p_signature_verified, true);
  assert.equal(body.p_projection_enabled, true);
  assert.equal(body.p_event_id, "evt_sync_1");
  assert.equal(body.p_customer_id, "cus_test_1");
  assert.equal(body.p_payment_intent_id, "pi_test_1");
  assert.equal("data" in body, false);
});

test("two-key cutover capture persists but cannot project", async () => {
  let body;
  const result = await syncStripeBillingEvent({
    event: EVENT,
    projection: { billing_status: "active" },
    signedEventVerified: true,
    environment: {
      ...ENVIRONMENT,
      FANMIND_STRIPE_BILLING_CANONICAL_RECONCILIATION_CONFIRMED: "false",
    },
    fetchImplementation: async (_url, init) => {
      body = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => [{
          result_status: "reconciliation_needed",
          result_reason: "reconciliation_pending",
          result_workspace_id: WORKSPACE_ID,
          result_revision: 0,
        }],
      };
    },
  });
  assert.equal(body.p_projection_enabled, false);
  assert.equal(result.status, "reconciliation_needed");
  assert.equal(result.reason, "reconciliation_pending");
});

test("same-second and unresolved outcomes are durable non-retry states", async () => {
  for (const [status, reason] of [
    ["reconciliation_needed", "event_order_conflict"],
    ["unresolved", "object_binding_missing"],
  ]) {
    const result = await syncStripeBillingEvent({
      event: EVENT,
      projection: { billing_status: "active" },
      signedEventVerified: true,
      environment: ENVIRONMENT,
      fetchImplementation: async () => ({
        ok: true,
        json: async () => [{
          result_status: status,
          result_reason: reason,
          result_workspace_id: null,
          result_revision: 0,
        }],
      }),
    });
    assert.equal(result.status, status);
    assert.equal(result.reason, reason);
  }

  const reconciledReplay = await syncStripeBillingEvent({
    event: EVENT,
    projection: { billing_status: "active" },
    signedEventVerified: true,
    environment: ENVIRONMENT,
    fetchImplementation: async () => ({
      ok: true,
      json: async () => [{
        result_status: "ignored",
        result_reason: "reconciled_event",
        result_workspace_id: WORKSPACE_ID,
        result_revision: 2,
      }],
    }),
  });
  assert.equal(reconciledReplay.status, "ignored");
  assert.equal(reconciledReplay.reason, "reconciled_event");
});

test("invalid signature, response or storage fails closed as retry", async () => {
  assert.equal((await syncStripeBillingEvent({
    event: EVENT,
    projection: {},
    signedEventVerified: false,
    environment: ENVIRONMENT,
    fetchImplementation: async () => { throw new Error("must not call"); },
  })).reason, "signature_verification");

  assert.equal((await syncStripeBillingEvent({
    event: EVENT,
    projection: {},
    signedEventVerified: true,
    environment: ENVIRONMENT,
    fetchImplementation: async () => ({ ok: false }),
  })).reason, "storage_write");

  assert.equal((await syncStripeBillingEvent({
    event: EVENT,
    projection: {},
    signedEventVerified: true,
    environment: ENVIRONMENT,
    fetchImplementation: async () => { throw new Error("offline"); },
  })).reason, "storage_unavailable");
});
