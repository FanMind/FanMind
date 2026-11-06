import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { updateAdminBillingWorkspace } from "@/lib/adminBilling";
import { redirectAdminHtml } from "@/lib/adminRedirects";
import {
  isTrustedFanMindMutationRequest,
  readBoundedFormDataRequest,
} from "@/lib/httpMutationPolicy.mjs";

const PAYMENT_SOURCES = ["bank_transfer", "stripe_confirmed", "cash_or_other", "credit_note", "correction"] as const;
const MAX_MARK_PAID_BODY_BYTES = 4_000;

function sourceText(source: string): string {
  if (source === "bank_transfer") return "Zahlung per Banküberweisung eingegangen";
  if (source === "credit_note") return "Zahlung durch Gutschrift/Kulanz ausgeglichen";
  return "Zahlung als eingegangen markiert";
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/billing/workspaces/[workspaceId]/mark-paid">) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }
  const admin = await requirePlatformAdmin();
  const { workspaceId } = await ctx.params;
  const parsedBody = await readBoundedFormDataRequest(request, MAX_MARK_PAID_BODY_BYTES);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.reason === "payload_too_large" ? "payload_too_large" : "invalid_request" },
      { status: parsedBody.reason === "payload_too_large" ? 413 : 400 },
    );
  }
  const form = parsedBody.value;
  const rawSource = form.get("payment_source")?.toString() ?? "bank_transfer";
  const paymentSource = PAYMENT_SOURCES.includes(rawSource as (typeof PAYMENT_SOURCES)[number]) ? rawSource : "bank_transfer";
  const amount = form.get("amount")?.toString().trim().slice(0, 40);
  const reference = form.get("reference")?.toString().trim().slice(0, 240);
  const paidAtInput = form.get("paid_at")?.toString().trim() ?? "";
  const paidAtDate = /^\d{4}-\d{2}-\d{2}$/u.test(paidAtInput)
    ? new Date(`${paidAtInput}T12:00:00.000Z`)
    : null;
  const paidAt = paidAtDate && Number.isFinite(paidAtDate.getTime())
    ? paidAtDate.toISOString()
    : new Date().toISOString();
  const liftPaymentSuspension = form.get("lift_payment_suspension") === "true";
  const noteParts = [`Zahlung verbucht: ${paymentSource}`, sourceText(paymentSource)];
  if (amount) noteParts.push(`Betrag: ${amount}`);
  if (reference) noteParts.push(`Referenz: ${reference}`);
  noteParts.push(`Datum: ${paidAt.slice(0, 10)}`);
  const values: Record<string, unknown> = { billing_status: "active", billing_last_payment_at: paidAt, billing_retry_count: 0, billing_next_retry_at: null, billing_grace_until: null, billing_admin_note: noteParts.join(" · ") };
  if (liftPaymentSuspension) Object.assign(values, { billing_suspended_at: null, billing_suspended_reason: null });
  const result = await updateAdminBillingWorkspace(workspaceId, admin, values);
  const htmlRedirect = redirectAdminHtml(request, `/admin/billing/workspaces/${workspaceId}`);
  if (htmlRedirect) return htmlRedirect;
  return NextResponse.json(result.ok ? { ok: true } : { error: "billing_payment_update_failed" }, { status: result.status });
}
