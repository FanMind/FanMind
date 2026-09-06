import { createHash } from "node:crypto";
import { decideAiTierStripeLifecycleEvent } from "./aiTierStripeLifecycle.mjs";

const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const blocked = reason => ({ status:"blocked", reason });

// Pure planner for an authoritative, transactionally read AI inventory. It
// does not create entitlement rows or invent a signed provider event.
function plan({ observation, billingCommand, inventory, environment = process.env } = {}) {
  const snapshot = observation?.snapshot;
  if (observation?.status !== "read" || !snapshot || observation.fingerprint !== hash(snapshot) ||
      billingCommand?.providerSnapshotFingerprint !== observation.fingerprint ||
      billingCommand.p_workspace_id !== snapshot.workspaceId || billingCommand.p_customer_id !== snapshot.customerId ||
      billingCommand.p_subscription_id !== snapshot.subscriptionId || billingCommand.p_stripe_request_id !== snapshot.requestId ||
      billingCommand.p_snapshot_observed_at !== snapshot.observedAt ||
      inventory?.workspaceId !== snapshot.workspaceId || inventory.customerId !== snapshot.customerId || inventory.subscriptionId !== snapshot.subscriptionId ||
      !Array.isArray(inventory.unresolvedEvents) || !Object.hasOwn(inventory,"current")) return blocked("ai_inventory_invalid");
  const cutoff = Math.floor(Date.parse(snapshot.observedAt)/1000);
  if (!Number.isSafeInteger(cutoff) || inventory.unresolvedEvents.some(event=>
      !Number.isSafeInteger(event.createdAt) || event.createdAt >= cutoff || !Number.isFinite(Date.parse(event.verifiedAt)) || Date.parse(event.verifiedAt)>Date.parse(snapshot.observedAt))) return blocked("ai_snapshot_too_old");
  // This envelope only reuses the established pure subscription/price/status
  // policy. Its synthetic ID is never persisted or sent to an event ledger.
  const policy = decideAiTierStripeLifecycleEvent({workspaceTargetVerified:true,environment,event:{
    id:"evt_canonical_policy_only",created:cutoff,type:"customer.subscription.updated",data:{object:{id:snapshot.subscriptionId,status:snapshot.status,
      cancel_at_period_end:snapshot.cancelAtPeriodEnd,items:{has_more:false,data:snapshot.items.map(item=>({id:item.id,price:{id:item.priceId},current_period_start:item.start,current_period_end:item.end}))}}}}});
  if (policy.decision === "retry" || (policy.decision === "ignore" && policy.reason !== "unrelated_price")) return blocked("ai_projection_invalid");
  const paid = policy.decision === "apply" ? policy.mutation : null;
  const current = inventory.current;
  if (current !== null && (current.workspace_id !== snapshot.workspaceId || !/^sub_[A-Za-z0-9_]+$/u.test(current.stripe_subscription_id??"") || current.source !== "stripe" ||
      !Number.isSafeInteger(current.stripe_sync_revision) || current.stripe_sync_revision < 0 || current.stripe_sync_revision >= Number.MAX_SAFE_INTEGER ||
      !["in_sync","reconciliation_needed"].includes(current.stripe_sync_state) ||
      !Number.isSafeInteger(current.last_stripe_event_created_at) || current.last_stripe_event_created_at >= cutoff)) return blocked("ai_inventory_invalid");
  if(current && current.stripe_subscription_id!==snapshot.subscriptionId &&
     (current.stripe_sync_state!=="reconciliation_needed" || !inventory.unresolvedEvents.some(event=>
       event.reason==="subscription_mismatch" && event.subscriptionId===snapshot.subscriptionId &&
       event.workspaceId===snapshot.workspaceId && event.customerId===snapshot.customerId))) return blocked("ai_rotation_evidence_missing");
  if (!inventory.unresolvedEvents.length) {
    const sameInstant = (a,b) => a === null && b === null || typeof a === "string" && typeof b === "string" && Number.isFinite(Date.parse(a)) && Date.parse(a)===Date.parse(b);
    const equal = paid && current?.stripe_sync_state === "in_sync" && current.tier_id === paid.tierId && current.status === paid.status &&
      current.stripe_subscription_item_id === paid.stripeSubscriptionItemId && current.stripe_price_id === paid.stripePriceId &&
      sameInstant(current.effective_at,paid.effectiveAt) && sameInstant(current.expires_at,paid.expiresAt);
    const standard = !paid && (current === null || current.stripe_sync_state === "in_sync" && ["canceled","expired"].includes(current.status));
    if (!equal && !standard) return blocked("ai_state_requires_reconciliation");
    // The installed reconciliation RPC requires genuine unresolved evidence.
    // Until a reviewed atomic no-op cutoff transport exists, a matching state
    // must not emit a success receipt: doing so would leave equal/delayed
    // Stripe seconds unbounded after the Billing reservation is released.
    return blocked("ai_cutoff_persistence_unavailable");
  }
  // Existing SQL explicitly forbids synthesizing an initial paid entitlement
  // through reconciliation. Initial acquisition must follow a real event.
  if (current === null && paid || current !== null && current.stripe_sync_state !== "reconciliation_needed") return blocked("ai_state_requires_reconciliation");
  const rpcBody={p_workspace_id:snapshot.workspaceId,p_stripe_request_id:snapshot.requestId,p_customer_id:snapshot.customerId,
    p_subscription_id:snapshot.subscriptionId,p_expected_previous_subscription_id:current?.stripe_subscription_id ?? null,
    p_snapshot_observed_at:snapshot.observedAt,p_snapshot_fingerprint:billingCommand.p_snapshot_fingerprint,p_expected_revision:current?.stripe_sync_revision ?? 0,
    p_has_paid_item:paid !== null,p_tier_id:paid?.tierId ?? null,p_lifecycle_status:paid?.status ?? null,
    p_subscription_item_id:paid?.stripeSubscriptionItemId ?? null,p_price_id:paid?.stripePriceId ?? null,
    p_effective_at:paid?.effectiveAt ?? null,p_expires_at:paid?.expiresAt ?? null};
  return {status:"reconcile",rpcBody:Object.freeze(rpcBody),requiresAtomicRevalidation:true};
}

export function planCanonicalBillingAi(input) {
  try { return plan(input); } catch { return blocked("ai_inventory_invalid"); }
}
