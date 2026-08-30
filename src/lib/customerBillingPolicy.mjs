export const DEMO_WORKSPACE_NAME = "Sandra M. Demo Workspace";
export const TEMPORARY_DEMO_WORKSPACE_NAME = "FanMind Demo Workspace";
export const LEGACY_TEMPORARY_DEMO_WORKSPACE_NAME = "Temporary FanMind Demo";

export function isExplicitDemoInvoiceWorkspace(workspace) {
  const workspaceName = (workspace?.name ?? "").trim();
  return (
    workspaceName === DEMO_WORKSPACE_NAME ||
    workspaceName === TEMPORARY_DEMO_WORKSPACE_NAME ||
    workspaceName === LEGACY_TEMPORARY_DEMO_WORKSPACE_NAME
  );
}

export function shouldShowDemoInvoicesForWorkspace(workspace) {
  return (
    workspace?.billing_status === "demo_free" &&
    !workspace?.stripe_customer_id &&
    isExplicitDemoInvoiceWorkspace(workspace)
  );
}

function numberField(source, key) {
  return typeof source[key] === "number" ? source[key] : null;
}

function stringField(source, key) {
  return typeof source[key] === "string" ? source[key] : null;
}

function taxAmount(source) {
  const taxes = Array.isArray(source.total_taxes)
    ? source.total_taxes
    : Array.isArray(source.total_tax_amounts)
      ? source.total_tax_amounts
      : null;
  if (!taxes) return null;
  return taxes.reduce((sum, tax) => {
    const amount = typeof tax?.amount === "number" ? tax.amount : 0;
    return sum + amount;
  }, 0);
}

export function sortInvoicesNewestFirst(invoices) {
  return [...invoices].sort((left, right) => {
    const rightCreated = right.created ? Date.parse(right.created) : 0;
    const leftCreated = left.created ? Date.parse(left.created) : 0;
    return rightCreated - leftCreated;
  });
}

export function getDemoInvoicesForWorkspace(workspace) {
  if (!shouldShowDemoInvoicesForWorkspace(workspace)) return [];

  return sortInvoicesNewestFirst([
    {
      id: "demo-invoice-0001",
      number: "Demo-Rechnung 0001",
      created: "2026-07-01T10:00:00.000Z",
      status: "bezahlt",
      currency: "EUR",
      amountDue: 99000,
      amountPaid: 99000,
      subtotal: 99000,
      tax: 0,
      total: 99000,
      hostedInvoiceUrl: null,
      invoicePdf: null,
      description: "Pilot Setup",
      isDemo: true,
      pdfHint: "Demo-PDF-Hinweis: Für diese Beispielrechnung gibt es kein echtes PDF und keine Stripe-Rechnung.",
    },
    {
      id: "demo-invoice-0002",
      number: "Demo-Rechnung 0002",
      created: "2026-07-08T10:00:00.000Z",
      status: "offen",
      currency: "EUR",
      amountDue: 31200,
      amountPaid: 0,
      subtotal: 31200,
      tax: 0,
      total: 31200,
      hostedInvoiceUrl: null,
      invoicePdf: null,
      description: "Starter Monat",
      isDemo: true,
      pdfHint: "Demo-PDF-Hinweis: Für diese Beispielrechnung gibt es kein echtes PDF und keine Stripe-Rechnung.",
    },
  ]);
}

export function mapStripeInvoiceToCustomerInvoice(invoice) {
  return {
    id: String(invoice.id),
    number: stringField(invoice, "number"),
    created: typeof invoice.created === "number" ? new Date(invoice.created * 1000).toISOString() : null,
    status: stringField(invoice, "status"),
    currency: (stringField(invoice, "currency") ?? "eur").toUpperCase(),
    amountDue: numberField(invoice, "amount_due"),
    amountPaid: numberField(invoice, "amount_paid"),
    subtotal: numberField(invoice, "subtotal"),
    tax: taxAmount(invoice),
    total: numberField(invoice, "total"),
    hostedInvoiceUrl: stringField(invoice, "hosted_invoice_url"),
    invoicePdf: stringField(invoice, "invoice_pdf"),
  };
}

export function listPolicyInvoiceResult({ workspace, stripeInvoices }) {
  if (!workspace?.stripe_customer_id) return getDemoInvoicesForWorkspace(workspace);
  return sortInvoicesNewestFirst((stripeInvoices ?? []).map(mapStripeInvoiceToCustomerInvoice));
}
