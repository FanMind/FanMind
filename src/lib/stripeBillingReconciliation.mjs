import { createHash } from "node:crypto";
import { normalizeStripeBillingProjection } from "./stripeBillingEventLedger.mjs";
import { buildSupabaseApiKeyHeaders } from "./supabase/apiKeyPolicy.mjs";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu;
const PREFIXES = Object.freeze({ customer: "cus", subscription: "sub", checkout_session: "cs", payment_intent: "pi", invoice: "in", charge: "ch", refund: "re", dispute: "dp", tax_id: "txi" });
const fail = () => { throw Error("billing_reconciliation_invalid"); };
const reference = (value, prefix) => typeof value === "string" && value.length <= 255 && new RegExp(`^${prefix}_[A-Za-z0-9_]+$`, "u").test(value);

// Internal server contract, never a browser request DTO. The database remains
// authoritative for membership, complete pending-event inventory and CAS.
export function buildStripeBillingReconciliation(input) {
  if (!input || typeof input !== "object" || !UUID.test(input.workspaceId ?? "") ||
      !["lifecycle", "tax"].includes(input.stream) || !reference(input.requestId, "req") ||
      !/^[a-f0-9]{64}$/u.test(input.providerSnapshotFingerprint ?? "") ||
      !reference(input.customerId, "cus") ||
      (input.subscriptionId !== null && !reference(input.subscriptionId, "sub")) ||
      !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || input.expectedRevision >= Number.MAX_SAFE_INTEGER ||
      typeof input.observedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/u.test(input.observedAt) || !Number.isFinite(Date.parse(input.observedAt)) ||
      !Array.isArray(input.resolvedEventIds) || input.resolvedEventIds.length > 1000 ||
      !Array.isArray(input.objectBindings) || input.objectBindings.length > 1000) fail();
  const projection = normalizeStripeBillingProjection(input.projection);
  if (!projection || Object.keys(input.projection).some(key => input.projection[key] === undefined)) fail();
  const lifecycle = input.stream === "lifecycle";
  if (lifecycle) {
    const required = ["billing_status", "workspace_access_mode", "billing_suspended_at", "billing_suspended_reason"];
    if (required.some(key => !Object.hasOwn(projection, key)) ||
        !["active", "suspended", "cancelled", "expired"].includes(projection.billing_status) ||
        (projection.billing_status === "active" && (projection.workspace_access_mode !== "active" || projection.billing_suspended_at !== null || projection.billing_suspended_reason !== null)) ||
        (projection.billing_status !== "active" && projection.workspace_access_mode !== "archived_readonly")) fail();
  } else if (input.subscriptionId !== null || Object.keys(projection).some(key => key !== "billing_note")) fail();
  if ((Object.hasOwn(projection, "stripe_customer_id") && projection.stripe_customer_id !== input.customerId) ||
      (Object.hasOwn(projection, "stripe_subscription_id") && projection.stripe_subscription_id !== input.subscriptionId)) fail();
  const events = [...input.resolvedEventIds];
  if (events.some(id => !reference(id, "evt")) || new Set(events).size !== events.length) fail();
  events.sort(); // Canonical serialization only; never event chronology.
  const bindings = input.objectBindings.map(value => {
    if (!value || Object.keys(value).sort().join(",") !== "id,type" || !Object.hasOwn(PREFIXES, value.type) ||
        !reference(value.id, PREFIXES[value.type]) || (!lifecycle && !["customer", "tax_id"].includes(value.type))) fail();
    return Object.freeze({ type: value.type, id: value.id });
  }).sort((a, b) => a.type < b.type ? -1 : a.type > b.type ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (new Set(bindings.map(x => `${x.type}:${x.id}`)).size !== bindings.length ||
      bindings.some(x => x.type === "customer" && x.id !== input.customerId) ||
      !bindings.some(x => x.type === "customer" && x.id === input.customerId) ||
      (input.subscriptionId && !bindings.some(x => x.type === "subscription" && x.id === input.subscriptionId))) fail();
  const body = {
    p_workspace_id: input.workspaceId.toLowerCase(), p_event_stream: input.stream,
    p_stripe_request_id: input.requestId, p_snapshot_observed_at: new Date(input.observedAt).toISOString(),
    p_expected_revision: input.expectedRevision, p_customer_id: input.customerId,
    p_subscription_id: input.subscriptionId, p_projection: projection,
    p_resolved_event_ids: Object.freeze(events), p_object_bindings: Object.freeze(bindings),
  };
  const fingerprint = createHash("sha256").update(JSON.stringify([body, input.providerSnapshotFingerprint])).digest("hex");
  return Object.freeze({ ...body, p_snapshot_fingerprint: fingerprint, providerSnapshotFingerprint:input.providerSnapshotFingerprint });
}

export function normalizeStripeBillingReconciliationResult(payload, expectedRevision) {
  if (!Array.isArray(payload) || payload.length !== 1 || !payload[0] ||
      !["reconciled", "duplicate_reconciliation"].includes(payload[0].result_status) ||
      !Number.isSafeInteger(expectedRevision) || !Number.isSafeInteger(payload[0].result_revision) ||
      payload[0].result_revision !== expectedRevision + 1) return null;
  return Object.freeze({ status: payload[0].result_status, revision: payload[0].result_revision });
}

function exactReceipt(receipt, body, component) {
  return receipt?.component === component && receipt.status === "reconciled" &&
    receipt.workspaceId === body.p_workspace_id && receipt.requestId === body.p_stripe_request_id &&
    receipt.snapshotFingerprint === body.p_snapshot_fingerprint;
}

// Adapters must load their own authoritative state and return durable receipts.
// All three reuse this immutable snapshot identity. A transport ambiguity is not
// retried here; the operator must recover the same persisted command/receipts.
function targetConfirmed(environment, reviewedTarget) {
  const env = environment ?? {};
  if (env.FANMIND_RUNTIME_ENVIRONMENT !== "staging" || env.NEXT_PUBLIC_APP_URL !== "https://staging.fanmind.ch" ||
      env.FANMIND_ENABLE_NON_PRODUCTION_WRITES !== "true" || env.FANMIND_NON_PRODUCTION_WRITE_ACK !== "I_UNDERSTAND_NON_PRODUCTION_ONLY" ||
      !/^[a-z0-9]{20}$/u.test(reviewedTarget?.stagingRef ?? "") || !/^[a-z0-9]{20}$/u.test(reviewedTarget?.productionRef ?? "") ||
      reviewedTarget.stagingRef === reviewedTarget.productionRef ||
      env.NEXT_PUBLIC_SUPABASE_URL !== `https://${reviewedTarget.stagingRef}.supabase.co` ||
      env.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF !== reviewedTarget.productionRef ||
      env.FANMIND_STAGING_BILLING_RECONCILIATION_ENABLED !== "true") return false;
  return true;
}

export function createStagingBillingReconciliationCommitter({environment, reviewedTarget, fetchImplementation = fetch}) {
  if (!targetConfirmed(environment, reviewedTarget) || typeof environment.SUPABASE_SERVICE_ROLE_KEY !== "string" || !environment.SUPABASE_SERVICE_ROLE_KEY.trim()) fail();
  const url = `${environment.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/reconcile_workspace_stripe_billing_projection`;
  const headers = {...buildSupabaseApiKeyHeaders(environment.SUPABASE_SERVICE_ROLE_KEY), "Content-Type":"application/json"};
  return async body => {
    const canonical = buildStripeBillingReconciliation({workspaceId:body?.p_workspace_id,stream:body?.p_event_stream,requestId:body?.p_stripe_request_id,
      observedAt:body?.p_snapshot_observed_at,expectedRevision:body?.p_expected_revision,customerId:body?.p_customer_id,subscriptionId:body?.p_subscription_id,
      projection:body?.p_projection,resolvedEventIds:body?.p_resolved_event_ids,objectBindings:body?.p_object_bindings,
      providerSnapshotFingerprint:body?.providerSnapshotFingerprint});
    if (canonical.p_snapshot_fingerprint !== body.p_snapshot_fingerprint) fail();
    const rpcBody = Object.fromEntries(Object.entries(canonical).filter(([key])=>key.startsWith("p_")));
    const response = await fetchImplementation(url,{method:"POST",headers,body:JSON.stringify(rpcBody),redirect:"error",cache:"no-store",signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw Error("billing_commit_unconfirmed");
    const payload = await response.json();
    if (!normalizeStripeBillingReconciliationResult(payload,canonical.p_expected_revision)) throw Error("billing_commit_unconfirmed");
    return payload;
  };
}

export async function executeStripeBillingReconciliation({ input, adapters, environment = process.env, reviewedTarget, clock = Date.now } = {}) {
  if (!targetConfirmed(environment, reviewedTarget)) return { status: "blocked", reason: "target_not_confirmed" };
  let body;
  try { body = buildStripeBillingReconciliation(input); } catch { return { status: "blocked", reason: "command_invalid" }; }
  const observed = Date.parse(body.p_snapshot_observed_at);
  const fresh = () => {
    try { const now = clock(); return Number.isFinite(now) && observed <= now + 300000 && observed >= now - 900000; } catch { return false; }
  };
  if (!fresh()) return { status: "blocked", reason: "snapshot_expired" };
  if (!adapters || typeof adapters.commitBilling !== "function") return { status: "blocked", reason: "adapter_missing" };
  if (body.p_event_stream === "lifecycle" && (typeof adapters.reconcileAi !== "function" || typeof adapters.reconcileReferral !== "function")) return { status: "blocked", reason: "adapter_missing" };
  let stage = "downstream";
  try {
    if (body.p_event_stream === "lifecycle") {
      const ai = await adapters.reconcileAi(body);
      if (!exactReceipt(ai, body, "ai")) return { status: "blocked", reason: "ai_receipt_invalid" };
      const referral = await adapters.reconcileReferral(body);
      if (!exactReceipt(referral, body, "referral")) return { status: "blocked", reason: "referral_receipt_invalid" };
    }
    if (!fresh()) return { status: "blocked", reason: "snapshot_expired" };
    stage = "billing";
    const result = normalizeStripeBillingReconciliationResult(await adapters.commitBilling(body), body.p_expected_revision);
    return result ?? { status: "indeterminate", reason: "billing_receipt_invalid" };
  } catch { return { status: "indeterminate", reason: stage === "billing" ? "billing_transport" : "downstream_transport" }; }
}
