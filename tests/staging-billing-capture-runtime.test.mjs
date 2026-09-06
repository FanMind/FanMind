import test from "node:test";
import assert from "node:assert/strict";
import { preserveStagingBillingCapture, renderStagingBillingCapture, buildStagingCaptureEvent } from "../scripts/operations/staging-billing-capture-runtime.mjs";
import { buildStripeBillingLedgerCommand, buildStripeBillingLedgerRpcBody } from "../src/lib/stripeBillingEventLedger.mjs";

test("capture flags survive later releases and never enable canonical projection",()=>{
  const initial = "FANMIND_RELEASE_COMMIT=previous\nFANMIND_STRIPE_BILLING_WRITE_FREEZE=true\n";
  const active = renderStagingBillingCapture(initial);
  assert.ok(active.includes("FANMIND_STRIPE_BILLING_WRITE_FREEZE=true"));
  const preserved = preserveStagingBillingCapture(active);
  assert.ok(preserved.includes("FANMIND_STRIPE_BILLING_EVENT_LEDGER_ENABLED=true"));
  assert.ok(preserved.includes("FANMIND_STRIPE_BILLING_CANONICAL_RECONCILIATION_CONFIRMED=false"));
  assert.equal(preserveStagingBillingCapture(initial), "");
  assert.equal(renderStagingBillingCapture(active), active);
  assert.throws(()=>preserveStagingBillingCapture(active.replace("CONFIRMED=false","CONFIRMED=true")));
  assert.throws(()=>preserveStagingBillingCapture(preserved + "\n" + preserved));
});
test("signed proof records an unpaid unbound synthetic event without canonical mutation",()=>{
  const event = buildStagingCaptureEvent("123456789",1753056000);
  const prepared = buildStripeBillingLedgerCommand({event, signedEventVerified:true,
    projection:{billing_status:"pending_sepa_mandate",stripe_checkout_session_id:event.data.object.id}});
  assert.equal(event.livemode,false);
  assert.equal(event.data.object.payment_status,"unpaid");
  assert.equal(prepared.status,"record");
  const body = buildStripeBillingLedgerRpcBody(prepared.command,{projectionEnabled:false});
  assert.equal(body.p_projection_enabled,false);
  assert.equal(body.p_customer_id,null);
  assert.equal(body.p_subscription_id,null);
  assert.equal(body.p_event_id,"evt_fanmind_capture_123456789");
  assert.throws(()=>buildStagingCaptureEvent("../invalid",1753056000));
});
