import { billingStatusFromStripeSubscriptionStatus, billingStatusFromInvoiceFailure } from "./referralLifecyclePolicy.mjs";
const fail = code => { throw Error(code); };

// Shared derivation: both preparation and execution use the verified provider
// observation. An independently supplied lifecycle projection is not proof.
export function canonicalStripeBillingProjection(snapshot, now) {
  if (!Number.isSafeInteger(now) || !["active","canceled","past_due","unpaid","incomplete_expired","paused"].includes(snapshot?.status)) fail("snapshot_invalid");
    const baseItems = snapshot.items?.filter(item=>item.priceId===snapshot.basePriceId);
    if (baseItems?.length !== 1 || !Number.isSafeInteger(baseItems[0].end) || baseItems[0].end <= 0) fail("items_unresolved");
    if (snapshot.status === "active" && (baseItems[0].end*1000 <= now || snapshot.latestInvoice?.status !== "paid" || snapshot.latestInvoice.amountRemaining !== 0)) fail("invoice_unresolved");
    let status = billingStatusFromStripeSubscriptionStatus(snapshot.status);
    const invoice=snapshot.latestInvoice;
    const delinquent=["past_due","unpaid"].includes(snapshot.status);
    if(delinquent && !invoice) fail("invoice_unresolved");
    const iso=seconds=>seconds===null?null:new Date(seconds*1000).toISOString();
    const grace=delinquent?iso(invoice.created+10*24*60*60):null;
    if(delinquent) {
      const failed=billingStatusFromInvoiceFailure({attemptCount:invoice.attemptCount,graceExpired:now>Date.parse(grace)});
      status=failed==="suspended"?failed:snapshot.status==="unpaid"?"payment_failed":failed;
    }
    const terminal=["suspended","cancelled","expired"].includes(status);
    const cancellation=snapshot.cancelAtPeriodEnd || snapshot.cancelAt!==null;
    const end=snapshot.status==="canceled"?snapshot.endedAt:cancellation?(snapshot.cancelAt ?? baseItems[0].end):null;
  return {billing_status:status,workspace_access_mode:terminal?"archived_readonly":"active",
        billing_suspended_at:terminal?snapshot.observedAt:null,billing_suspended_reason:terminal?`stripe_canonical_${snapshot.status}`:null,
        stripe_customer_id:snapshot.customerId,stripe_subscription_id:snapshot.subscriptionId,
        billing_contract_started_at:iso(snapshot.createdAt),billing_current_period_end_at:iso(baseItems[0].end),subscription_cancel_at_period_end:snapshot.cancelAtPeriodEnd,
        subscription_effective_end_at:iso(end),
        ...(!cancellation || snapshot.canceledAt!==null?{subscription_cancel_requested_at:cancellation?iso(snapshot.canceledAt):null}:{}),
        last_invoice_id:invoice?.id ?? null,last_invoice_status:invoice?.status ?? null,
        last_invoice_amount_due_cents:invoice?.amountDue ?? null,last_invoice_amount_paid_cents:invoice?.amountPaid ?? null,
        last_invoice_hosted_url:invoice?.hostedUrl ?? null,last_invoice_pdf_url:invoice?.pdfUrl ?? null,
        billing_grace_until:grace,billing_retry_count:delinquent?Math.max(1,invoice.attemptCount):0,
        billing_next_retry_at:delinquent?iso(invoice.nextPaymentAttempt):null,
        ...(invoice?.status==="paid"?{billing_last_payment_at:iso(invoice.paidAt),billing_last_payment_failed_at:null}:delinquent?{billing_last_payment_failed_at:snapshot.observedAt}:{})};
}


export function canonicalStripeTaxProjection(snapshot, bindings) {
  const tax=snapshot?.tax;
  if(snapshot?.subscriptionId!==null || !tax || Object.keys(tax).sort().join(",")!=="customerId,deleted,id,verificationStatus" ||
     !/^txi_[A-Za-z0-9_]+$/u.test(tax.id??"") || tax.customerId!==snapshot.customerId || typeof tax.deleted!=="boolean" ||
     (tax.deleted?tax.verificationStatus!==null:!["verified","pending","unverified","unavailable"].includes(tax.verificationStatus)) ||
     !Array.isArray(bindings) || bindings.filter(binding=>binding.type==="tax_id").length!==1 ||
     !bindings.some(binding=>binding.type==="tax_id" && binding.id===tax.id)) fail("tax_snapshot_invalid");
  return {billing_note:tax.deleted?"Stripe-Steuer-ID wurde entfernt.":tax.verificationStatus==="verified"?"Stripe-Steuer-ID wurde verifiziert.":tax.verificationStatus==="pending"?"Stripe-Steuer-ID-Prüfung ist ausstehend.":"Stripe-Steuer-ID ist noch nicht verifiziert."};
}
