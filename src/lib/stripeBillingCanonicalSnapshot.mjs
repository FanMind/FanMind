import { createHash } from "node:crypto";
import { buildStripeBillingReconciliation } from "./stripeBillingReconciliation.mjs";
import { canonicalStripeBillingProjection } from "./stripeBillingCanonicalProjection.mjs";

const id = (value, prefix) => typeof value === "string" && value.length <= 255 && new RegExp(`^${prefix}_[A-Za-z0-9_]+$`, "u").test(value);
const fail = code => { throw Error(code); };
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const supported = new Set(["active", "canceled", "past_due", "unpaid", "incomplete_expired", "paused"]);

function normalize(subscription, target, allowedPrices) {
  if (subscription?.object !== "subscription" || subscription.id !== target.subscriptionId ||
      subscription.customer !== target.customerId || !Number.isSafeInteger(subscription.created) || subscription.created<0 || subscription.livemode !== false || !supported.has(subscription.status) ||
      typeof subscription.metadata?.workspace_id !== "string" || subscription.metadata.workspace_id.toLowerCase() !== target.workspaceId ||
      subscription.pending_update || subscription.pause_collection ||
      subscription.items?.object !== "list" || subscription.items.has_more !== false ||
      !Array.isArray(subscription.items.data) || !subscription.items.data.length || subscription.items.data.length > 2) fail("subscription_unresolved");
  const items = subscription.items.data.map(item => {
    if (!id(item.id,"si") || item.subscription !== target.subscriptionId || item.quantity !== 1 ||
        item.price?.object !== "price" || item.price.livemode !== false || !allowedPrices.includes(item.price.id) ||
        !Number.isSafeInteger(item.current_period_start) || !Number.isSafeInteger(item.current_period_end) ||
        item.current_period_start < 0 || item.current_period_end <= item.current_period_start) fail("items_unresolved");
    return {id:item.id, priceId:item.price.id, start:item.current_period_start, end:item.current_period_end};
  }).sort((a,b)=>a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (new Set(items.map(x=>x.id)).size !== items.length || new Set(items.map(x=>x.priceId)).size !== items.length ||
      items.filter(x=>x.priceId===target.basePriceId).length !== 1) fail("items_unresolved");
  const invoice = subscription.latest_invoice;
  let latestInvoice = null;
  if (invoice !== null) {
    if (invoice?.object !== "invoice" || !id(invoice.id,"in") || invoice.livemode !== false || invoice.customer !== target.customerId ||
        invoice.parent?.subscription_details?.subscription !== target.subscriptionId ||
        !["draft","open","paid","uncollectible","void"].includes(invoice.status) ||
        [invoice.amount_remaining,invoice.amount_due,invoice.amount_paid,invoice.created,invoice.attempt_count].some(value=>!Number.isSafeInteger(value) || value<0) ||
        (invoice.next_payment_attempt !== null && (!Number.isSafeInteger(invoice.next_payment_attempt) || invoice.next_payment_attempt<0))) fail("invoice_unresolved");
    const paidAt=invoice.status_transitions?.paid_at;
    if ((paidAt!==null && (!Number.isSafeInteger(paidAt) || paidAt<0)) || (invoice.status==="paid" && paidAt===null)) fail("invoice_unresolved");
    const invoiceUrl = value => {
      if (value === null) return null;
      try { const url=new URL(value); if(typeof value!=="string" || value.length>4096 || url.protocol!=="https:" || url.username || url.password) fail("invoice_unresolved"); return value; }
      catch { fail("invoice_unresolved"); }
    };
    latestInvoice = {id:invoice.id,status:invoice.status,amountRemaining:invoice.amount_remaining,
      amountDue:invoice.amount_due,amountPaid:invoice.amount_paid,created:invoice.created,attemptCount:invoice.attempt_count,
      paidAt:invoice.status_transitions?.paid_at,nextPaymentAttempt:invoice.next_payment_attempt,hostedUrl:invoiceUrl(invoice.hosted_invoice_url),pdfUrl:invoiceUrl(invoice.invoice_pdf)};
  }
  if (subscription.status === "active" && (!latestInvoice || latestInvoice.status !== "paid" || latestInvoice.amountRemaining !== 0)) fail("invoice_unresolved");
  if (["past_due","unpaid"].includes(subscription.status) && (!latestInvoice || !["open","uncollectible"].includes(latestInvoice.status) || latestInvoice.amountRemaining<=0)) fail("invoice_unresolved");
  if (typeof subscription.cancel_at_period_end !== "boolean" ||
      [subscription.cancel_at,subscription.canceled_at,subscription.ended_at].some(value=>value!==null && (!Number.isSafeInteger(value) || value<0))) fail("subscription_unresolved");
  return {customerId:target.customerId,subscriptionId:target.subscriptionId,basePriceId:target.basePriceId,createdAt:subscription.created,status:subscription.status,
    cancelAtPeriodEnd:subscription.cancel_at_period_end,cancelAt:subscription.cancel_at,canceledAt:subscription.canceled_at,endedAt:subscription.ended_at,items,latestInvoice};
}

// Uses only the existing pinned Stripe SDK's read methods. No checkout,
// payment, subscription mutation or automatic reconciliation is performed.
export async function readCanonicalStripeBillingSnapshot({ stripe, target, testSecretKey, clock = Date.now } = {}) {
  if (!/^(sk|rk)_test_/u.test(testSecretKey ?? "") ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(target?.workspaceId ?? "") ||
      !id(target?.customerId,"cus") || !id(target?.subscriptionId,"sub") || !id(target?.basePriceId,"price") ||
      !Array.isArray(target?.aiPriceIds) || target.aiPriceIds.length > 2 || target.aiPriceIds.some(value=>!id(value,"price"))) return {status:"blocked",reason:"target_invalid"};
  const allowedPrices=[target.basePriceId,...target.aiPriceIds];
  target = Object.freeze({...target,workspaceId:target.workspaceId.toLowerCase(),aiPriceIds:Object.freeze([...target.aiPriceIds])});
  if (new Set(allowedPrices).size!==allowedPrices.length) return {status:"blocked",reason:"target_invalid"};
  try {
    const started=clock();
    if (!Number.isSafeInteger(started)) return {status:"blocked",reason:"clock_invalid"};
    const first=normalize(await stripe.subscriptions.retrieve(target.subscriptionId,{expand:["latest_invoice"]}),target,allowedPrices);
    // Listing all statuses includes the canceled subscription being reconciled.
    // Paginate explicitly; never interpret a first page as a complete inventory.
    let cursor; const seen=new Set();
    for(let page=0;page<10;page++) {
      const list=await stripe.subscriptions.list({customer:target.customerId,status:"all",limit:100,...(cursor?{starting_after:cursor}:{})});
      if(list?.object!=="list" || typeof list.has_more!=="boolean" || !Array.isArray(list.data) || list.data.length>100) fail("inventory_unresolved");
      for(const item of list.data) {
        if(!id(item.id,"sub") || item.customer!==target.customerId || item.livemode!==false || seen.has(item.id)) fail("inventory_unresolved");
        seen.add(item.id);
        if(item.id!==target.subscriptionId) fail("inventory_unresolved");
      }
      if(!list.has_more) break;
      if(!list.data.length || page===9) fail("inventory_unresolved");
      cursor=list.data.at(-1).id;
    }
    // Separate subscriptions and rotations need the later multi-subscription
    // operator. Never silently choose the first active record for a customer.
    if(!seen.has(target.subscriptionId)) fail("inventory_unresolved");
    const response=await stripe.subscriptions.retrieve(target.subscriptionId,{expand:["latest_invoice"]});
    const second=normalize(response,target,allowedPrices);
    if(hash(first)!==hash(second)) fail("snapshot_changed");
    if(!id(response.lastResponse?.requestId,"req")) fail("provider_receipt_missing");
    const completed=clock();
    if(!Number.isSafeInteger(completed) || completed<started || completed-started>60000) fail("snapshot_expired");
    const snapshot={...second,workspaceId:target.workspaceId,requestId:response.lastResponse.requestId,
      observedAt:new Date(started).toISOString()};
    return {status:"read",snapshot:JSON.parse(JSON.stringify(snapshot)),fingerprint:hash(snapshot)};
  } catch(error) {
    const allowed=new Set(["subscription_unresolved","items_unresolved","invoice_unresolved","inventory_unresolved","snapshot_changed","provider_receipt_missing","snapshot_expired"]);
    return {status:"blocked",reason:allowed.has(error?.message)?error.message:"provider_unavailable"};
  }
}

// Ledger input must come from the protected server-side read inventory, never
// metadata or a client. Restrict this first provider adapter to an existing
// exact base subscription; bootstrap, reversal and rotations remain blocked.
export function prepareCanonicalStripeBillingCommand({ observation, ledger, basePriceId, now = Date.now() } = {}) {
  try {
    const snapshot = observation?.snapshot;
    if (observation?.status !== "read" || !snapshot || observation.fingerprint !== hash(snapshot) ||
        ledger?.workspaceId !== snapshot.workspaceId || ledger.customerId !== snapshot.customerId || ledger.subscriptionId !== snapshot.subscriptionId ||
        !Array.isArray(ledger.pendingEvents) || !Array.isArray(ledger.objectBindings) || ledger.protectedWorkspace !== false ||
        !Number.isSafeInteger(now) || !id(basePriceId,"price") || basePriceId!==snapshot.basePriceId) fail("ledger_unresolved");
    const observed = Date.parse(snapshot.observedAt);
    if (!Number.isFinite(observed) || observed > now || observed < now-900000 || !supported.has(snapshot.status)) fail("snapshot_expired");
    const covered = new Set(["checkout.session.completed","checkout.session.async_payment_succeeded","checkout.session.async_payment_failed",
      "invoice.paid","invoice.updated","invoice.payment_failed","customer.subscription.created","customer.subscription.updated",
      "customer.subscription.deleted","customer.subscription.paused","customer.subscription.resumed"]);
    if (ledger.pendingEvents.some(event=>!covered.has(event.type) || !id(event.id,"evt") || !Number.isSafeInteger(event.createdAt) || event.createdAt < 0 || event.createdAt >= Math.floor(observed/1000)) ||
        (ledger.lastEventCreatedAt !== null && (!Number.isSafeInteger(ledger.lastEventCreatedAt) || ledger.lastEventCreatedAt >= Math.floor(observed/1000)))) fail("events_unresolved");
    const bindings = [...ledger.objectBindings];
    for (const binding of [{type:"customer",id:snapshot.customerId},{type:"subscription",id:snapshot.subscriptionId},...(snapshot.latestInvoice?[{type:"invoice",id:snapshot.latestInvoice.id}]:[])]) {
      if (!bindings.some(existing=>existing.type===binding.type && existing.id===binding.id)) bindings.push(binding);
    }
    const input = {workspaceId:snapshot.workspaceId,stream:"lifecycle",requestId:snapshot.requestId,observedAt:snapshot.observedAt,
      providerSnapshotFingerprint:observation.fingerprint,expectedRevision:ledger.revision,customerId:snapshot.customerId,subscriptionId:snapshot.subscriptionId,
      projection:canonicalStripeBillingProjection(snapshot,now),
      resolvedEventIds:ledger.pendingEvents.map(event=>event.id),objectBindings:bindings};
    buildStripeBillingReconciliation(input);
    return {status:"prepared",input};
  } catch(error) {
    const allowed = new Set(["ledger_unresolved","snapshot_expired","events_unresolved","items_unresolved","invoice_unresolved"]);
    return {status:"blocked",reason:allowed.has(error?.message)?error.message:"command_invalid"};
  }
}
