import assert from "node:assert/strict";
import test from "node:test";

import {
  STRIPE_BILLING_LEDGER_EVENT_TYPES,
  buildStripeBillingLedgerCommand,
  buildStripeBillingLedgerRpcBody,
  isStripeBillingEventLedgerCaptureEnabled,
  isStripeBillingEventLedgerEnabled,
  normalizeStripeBillingLedgerRpcResult,
} from "../src/lib/stripeBillingEventLedger.mjs";

const WORKSPACE_ID = "4cf1aa49-0b0c-4cbe-9ef1-a94bf41c771a";

function event(type, object, overrides = {}) {
  return {
    id: "evt_ledger_1",
    created: 1_787_000_001,
    type,
    data: { object },
    ...overrides,
  };
}

function prepare(type, object, projection = { billing_status: "active" }) {
  return buildStripeBillingLedgerCommand({
    event: event(type, object),
    projection,
    signedEventVerified: true,
  });
}

test("base billing ledger needs all three dormant activation controls", () => {
  const complete = {
    FANMIND_STRIPE_BILLING_EVENT_LEDGER_ENABLED: "true",
    FANMIND_STRIPE_BILLING_EVENT_LEDGER_CONTROL_CONFIRMED: "20260816210000",
    FANMIND_STRIPE_BILLING_CANONICAL_RECONCILIATION_CONFIRMED: "true",
  };
  assert.equal(isStripeBillingEventLedgerEnabled(complete), true);
  assert.equal(isStripeBillingEventLedgerCaptureEnabled(complete), true);
  assert.equal(
    isStripeBillingEventLedgerEnabled({
      ...complete,
      FANMIND_STRIPE_BILLING_CANONICAL_RECONCILIATION_CONFIRMED: "false",
    }),
    false,
  );
  assert.equal(
    isStripeBillingEventLedgerCaptureEnabled({
      ...complete,
      FANMIND_STRIPE_BILLING_CANONICAL_RECONCILIATION_CONFIRMED: "false",
    }),
    true,
  );
  for (const key of Object.keys(complete)) {
    assert.equal(
      isStripeBillingEventLedgerEnabled({ ...complete, [key]: "false" }),
      false,
    );
  }
});

test("event list covers every webhook-mutating base billing family", () => {
  assert.deepEqual(new Set(STRIPE_BILLING_LEDGER_EVENT_TYPES), new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "payment_intent.processing",
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "invoice.paid",
    "invoice.updated",
    "invoice.payment_failed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.resumed",
    "customer.subscription.paused",
    "customer.subscription.deleted",
    "charge.refunded",
    "refund.created",
    "refund.updated",
    "refund.failed",
    "charge.dispute.created",
    "customer.tax_id.created",
    "customer.tax_id.updated",
    "customer.tax_id.deleted",
  ]));
});

test("checkout alone may carry a direct bootstrap workspace candidate", () => {
  const prepared = prepare("checkout.session.completed", {
    id: "cs_test_1",
    customer: "cus_test_1",
    subscription: "sub_test_1",
    payment_intent: "pi_test_1",
    client_reference_id: WORKSPACE_ID,
    metadata: { workspace_id: WORKSPACE_ID },
  });
  assert.equal(prepared.status, "record");
  assert.equal(prepared.command.bindingMode, "checkout");
  assert.equal(prepared.command.workspaceIdCandidate, WORKSPACE_ID);
  assert.equal(prepared.command.workspaceCandidateConflict, false);
  assert.deepEqual(prepared.command.references, {
    customerId: "cus_test_1",
    subscriptionId: "sub_test_1",
    checkoutSessionId: "cs_test_1",
    paymentIntentId: "pi_test_1",
    invoiceId: null,
    chargeId: null,
    refundId: null,
    disputeId: null,
    taxId: null,
  });
});

test("conflicting metadata is ledgered as a binding conflict hint", () => {
  const prepared = prepare("checkout.session.completed", {
    id: "cs_test_1",
    customer: "cus_test_1",
    client_reference_id: WORKSPACE_ID,
    metadata: { workspace_id: "a4a44b58-5e13-4578-a266-82a66881867e" },
  });
  assert.equal(prepared.status, "record");
  assert.equal(prepared.command.workspaceIdCandidate, null);
  assert.equal(prepared.command.workspaceCandidateConflict, true);
});

test("PaymentIntent binds on stable customer while persisting the rotating PI", () => {
  const prepared = prepare("payment_intent.succeeded", {
    id: "pi_recurring_new",
    customer: { id: "cus_test_1" },
  });
  assert.equal(prepared.command.bindingMode, "customer_transaction");
  assert.equal(prepared.command.references.customerId, "cus_test_1");
  assert.equal(
    prepared.command.references.paymentIntentId,
    "pi_recurring_new",
  );
});

test("invoice contract carries customer+subscription and only observes transaction IDs", () => {
  const prepared = prepare("invoice.paid", {
    id: "in_test_1",
    customer: "cus_test_1",
    subscription: "sub_test_1",
    payment_intent: "pi_invoice_rotated",
    charge: "ch_invoice_1",
  });
  assert.equal(prepared.command.bindingMode, "customer_subscription");
  assert.equal(prepared.command.references.customerId, "cus_test_1");
  assert.equal(prepared.command.references.subscriptionId, "sub_test_1");
  assert.equal(prepared.command.references.invoiceId, "in_test_1");
  assert.equal(
    prepared.command.references.paymentIntentId,
    "pi_invoice_rotated",
  );
  assert.equal(prepared.command.references.chargeId, "ch_invoice_1");
});

test("invoice subscription binding supports the parent subscription contract", () => {
  const prepared = prepare("invoice.updated", {
    id: "in_parent_contract",
    customer: "cus_test_1",
    parent: {
      subscription_details: { subscription: "sub_parent_1" },
    },
  });
  assert.equal(prepared.command.references.subscriptionId, "sub_parent_1");
});

test("refund and dispute retain historical transaction references", () => {
  const refund = prepare("refund.updated", {
    id: "re_test_1",
    charge: {
      id: "ch_test_1",
      customer: "cus_test_1",
      payment_intent: "pi_old_1",
    },
  });
  assert.equal(refund.command.bindingMode, "reversal");
  assert.deepEqual(
    {
      customer: refund.command.references.customerId,
      paymentIntent: refund.command.references.paymentIntentId,
      charge: refund.command.references.chargeId,
      refund: refund.command.references.refundId,
    },
    {
      customer: "cus_test_1",
      paymentIntent: "pi_old_1",
      charge: "ch_test_1",
      refund: "re_test_1",
    },
  );

  const dispute = prepare("charge.dispute.created", {
    id: "dp_test_1",
    charge: "ch_test_1",
    payment_intent: "pi_old_1",
  });
  assert.equal(dispute.command.references.disputeId, "dp_test_1");
  assert.equal(dispute.command.references.chargeId, "ch_test_1");
});

test("tax events use an independent stream", () => {
  const prepared = prepare(
    "customer.tax_id.updated",
    { id: "txi_test_1", customer: "cus_test_1" },
    { billing_note: "verified" },
  );
  assert.equal(prepared.command.stream, "tax");
  assert.equal(prepared.command.bindingMode, "tax");
  assert.equal(
    prepare(
      "customer.tax_id.updated",
      { id: "txi_test_1", customer: "cus_test_1" },
      { billing_status: "active" },
    ).reason,
    "event_payload",
  );
});

test("normalized fingerprint is deterministic and raw event data is absent", () => {
  const one = buildStripeBillingLedgerCommand({
    event: event("payment_intent.succeeded", {
      id: "pi_test_1",
      customer: "cus_test_1",
      receipt_email: "private@example.test",
    }),
    projection: {
      billing_note: "paid",
      billing_status: "active",
      billing_grace_until: undefined,
    },
    signedEventVerified: true,
  });
  const two = buildStripeBillingLedgerCommand({
    event: event("payment_intent.succeeded", {
      id: "pi_test_1",
      customer: "cus_test_1",
      receipt_email: "different@example.test",
    }),
    projection: { billing_status: "active", billing_note: "paid" },
    signedEventVerified: true,
  });
  assert.equal(one.command.payloadFingerprint, two.command.payloadFingerprint);
  assert.equal(JSON.stringify(one.command).includes("private@example"), false);
});

test("unverified, malformed, unsupported and non-allowlisted commands fail closed", () => {
  assert.equal(
    buildStripeBillingLedgerCommand({
      event: event("invoice.paid", {}),
      projection: {},
    }).reason,
    "signature_verification",
  );
  assert.equal(
    buildStripeBillingLedgerCommand({
      event: event("unknown.event", {}),
      projection: {},
      signedEventVerified: true,
    }).reason,
    "event_payload",
  );
  assert.equal(
    buildStripeBillingLedgerCommand({
      event: event("invoice.paid", {}, { id: "not_event" }),
      projection: {},
      signedEventVerified: true,
    }).reason,
    "event_payload",
  );
  assert.equal(
    buildStripeBillingLedgerCommand({
      event: event("invoice.paid", {}),
      projection: { owner_user_id: "attacker" },
      signedEventVerified: true,
    }).reason,
    "event_payload",
  );
});

test("a valid signed event with missing tenant references is still ledgerable", () => {
  const prepared = prepare("invoice.paid", { id: "in_missing_refs" }, {
    last_invoice_id: "in_missing_refs",
  });
  assert.equal(prepared.status, "record");
  assert.equal(prepared.command.references.customerId, null);
  assert.equal(prepared.command.references.subscriptionId, null);
});

test("RPC body has typed references and no raw body", () => {
  const prepared = prepare("invoice.updated", {
    id: "in_test_1",
    customer: "cus_test_1",
    subscription: "sub_test_1",
    payment_intent: "pi_new_1",
  }, { last_invoice_id: "in_test_1", last_invoice_status: "open" });
  const body = buildStripeBillingLedgerRpcBody(prepared.command);
  assert.equal(body.p_projection_enabled, false);
  assert.equal(body.p_binding_mode, "customer_subscription");
  assert.equal(body.p_customer_id, "cus_test_1");
  assert.equal(body.p_subscription_id, "sub_test_1");
  assert.equal(body.p_payment_intent_id, "pi_new_1");
  assert.deepEqual(body.p_projection, {
    last_invoice_id: "in_test_1",
    last_invoice_status: "open",
  });
  assert.equal("p_raw_body" in body, false);
});

test("RPC result parser accepts only the closed status contract", () => {
  assert.deepEqual(
    normalizeStripeBillingLedgerRpcResult([{
      result_status: "applied",
      result_reason: null,
      result_workspace_id: WORKSPACE_ID,
      result_revision: 7,
    }]),
    { status: "applied", reason: null, workspaceId: WORKSPACE_ID, revision: 7 },
  );
  assert.equal(
    normalizeStripeBillingLedgerRpcResult([{
      result_status: "ignored",
      result_reason: "duplicate_event",
      result_workspace_id: WORKSPACE_ID,
      result_revision: 7,
    }])?.reason,
    "duplicate_event",
  );
  assert.equal(
    normalizeStripeBillingLedgerRpcResult([{
      result_status: "ignored",
      result_reason: "reconciled_event",
      result_workspace_id: WORKSPACE_ID,
      result_revision: 8,
    }])?.reason,
    "reconciled_event",
  );
  assert.equal(
    normalizeStripeBillingLedgerRpcResult([{
      result_status: "unresolved",
      result_reason: "object_binding_missing",
      result_workspace_id: null,
      result_revision: 0,
    }])?.workspaceId,
    null,
  );
  assert.equal(
    normalizeStripeBillingLedgerRpcResult([{
      result_status: "invented",
      result_reason: null,
      result_workspace_id: WORKSPACE_ID,
      result_revision: 1,
    }]),
    null,
  );
  assert.equal(
    normalizeStripeBillingLedgerRpcResult([{
      result_status: "reconciliation_needed",
      result_reason: "terminal_subscription_conflict",
      result_workspace_id: WORKSPACE_ID,
      result_revision: 9,
    }])?.reason,
    "terminal_subscription_conflict",
  );
});
