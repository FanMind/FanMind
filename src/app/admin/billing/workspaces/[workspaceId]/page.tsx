import type React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/admin";
import { INTERNAL_DAILY_TEST_OPTION, getAdminBillingWorkspace, isInternalTestWorkspace, listStripeInvoicesForWorkspace } from "@/lib/adminBilling";
import { getBillingStatusLabel } from "@/lib/billing";
import { getCommercialOptionLabel } from "@/lib/dashboardFeatures";
import { getStripeConfigStatus } from "@/lib/stripeBilling";
import { isInternalDailyTestStripeReady } from "@/lib/internalDailyTestReadinessPolicy.mjs";
import { AdminBillingShell } from "../../AdminBillingShell";
import styles from "../../adminBilling.module.css";

function money(cents?: number | null) {
  return typeof cents === "number" ? (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" }) : "—";
}

function date(value?: string | null) {
  return value ? new Date(value).toLocaleString("de-DE") : "—";
}

function shortId(value?: string | null) {
  if (!value) return "—";
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function statusClass(status?: string | null) {
  switch (status) {
    case "active":
    case "demo_free":
      return styles.badgeOk;
    case "pending_payment_setup":
    case "pending_sepa_mandate":
    case "past_due":
      return styles.badgeWarn;
    case "payment_failed":
    case "suspended":
    case "manual_suspended":
    case "cancelled":
    case "expired":
      return styles.badgeBad;
    default:
      return styles.badge;
  }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className={styles.field}><dt>{label}</dt><dd>{value || "—"}</dd></div>;
}

function taxBreakdown(invoice: { subtotal?: number | null; total_tax_amounts?: number | null; total?: number | null }) {
  const hasStripeTaxData = typeof invoice.subtotal === "number" || typeof invoice.total_tax_amounts === "number" || typeof invoice.total === "number";
  if (!hasStripeTaxData) return null;
  return <dl className={styles.detailGrid}><Field label="Netto" value={money(invoice.subtotal)} /><Field label="Steuer" value={money(invoice.total_tax_amounts)} /><Field label="Brutto" value={money(invoice.total)} /></dl>;
}

function QuickFact({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return <div className={styles.quickFact}><span>{label}</span><strong className={tone}>{value || "—"}</strong></div>;
}

function TimelineItem({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  if (!value || value === "—" || value === 0) return null;
  return <li className={styles.timelineItem}><span className={styles.timelineDot} /><div><strong>{label}</strong><p className={tone}>{value}</p></div></li>;
}

export default async function AdminBillingWorkspaceDetailPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const user = await requirePlatformAdmin();
  const { workspaceId } = await params;
  const { workspace, error } = await getAdminBillingWorkspace(workspaceId);
  if (!workspace && !error) notFound();
  const stripe = getStripeConfigStatus();
  const dailyStripeReady = isInternalDailyTestStripeReady(stripe);
  const invoices = workspace ? await listStripeInvoicesForWorkspace(workspace) : { invoices: [], error: null };
  const planLabel = workspace?.plan_id ?? "—";
  const optionLabel = getCommercialOptionLabel(workspace?.commercial_option ?? "");
  const billingStatusLabel = getBillingStatusLabel(workspace?.billing_status);
  const isSuspended = workspace?.billing_status === "suspended" || workspace?.billing_status === "manual_suspended";
  const isInternalTest = isInternalTestWorkspace(workspace);
  const isInternalDailyTest = workspace?.commercial_option === INTERNAL_DAILY_TEST_OPTION;
  const taxBadgeClass = stripe.readyForTax ? styles.badgeOk : styles.badgeWarn;
  const timelineHasItems = Boolean(workspace?.billing_last_payment_at || workspace?.billing_last_payment_failed_at || workspace?.billing_next_retry_at || workspace?.billing_grace_until || workspace?.billing_suspended_at || workspace?.billing_admin_note || (workspace?.billing_retry_count ?? 0) > 0);

  return <AdminBillingShell user={user} title="Adminbereich" subtitle={`Workspace-Detail · Angemeldet als Admin: ${user.email ?? "Admin"}`}>
    <div className={styles.adminStack}>
      {error ? <p className={styles.badgeWarn}>{error}</p> : null}
      {workspace ? <>
        <section className={styles.crmHero}>
          <div className={styles.crmHeroMain}>
            <span className={styles.eyebrow}>Kundenprofil</span>
            <h1>{workspace.name ?? "Workspace"}</h1>
            <p>Owner: {workspace.owner_email ?? workspace.owner_user_id ?? "nicht hinterlegt"} · Workspace-ID: <span>{workspace.id}</span></p>
            <div className={styles.crmBadgeRow}>
              <span className={styles.chip}>{planLabel}</span>
              <span className={styles.badge}>{optionLabel}</span>
              <span className={statusClass(workspace.billing_status)}>Status: {billingStatusLabel}</span>
              {isSuspended ? <span className={styles.badgeBad}>Sperre aktiv</span> : null}
              {isInternalTest ? <span className={styles.badgeInternalTest}>Interner Testzugang</span> : null}{isInternalDailyTest ? <span className={styles.badgeWarn}>Live-Testabo · 1 €/Tag</span> : null}
            </div>
          </div>
          <div className={styles.crmHeroAside}>
            <Link className={styles.buttonSecondary} href="/admin/billing">← Zur Übersicht</Link>
            <span>Monat / MRR</span>
            <strong>{money(workspace.monthly_fee_cents)}</strong>
          </div>
        </section>

        <section className={styles.quickFacts} aria-label="Wichtigste Kennzahlen">
          <QuickFact label="Plan" value={planLabel} />
          <QuickFact label="Option" value={optionLabel} />
          <QuickFact label="Setup" value={money(workspace.setup_fee_cents)} />
          <QuickFact label="Monat" value={money(workspace.monthly_fee_cents)} />
          <QuickFact label="Interner Live-Test" value={isInternalDailyTest ? "1 € pro Tag · Stripe Live" : "—"} tone={isInternalDailyTest ? styles.badgeWarn : undefined} />
          <QuickFact label="Bindung" value={`${workspace.commitment_months ?? 0} Monate`} />
          <QuickFact label="Zahlungsstatus" value={isInternalTest ? "Interner Testzugang" : billingStatusLabel} tone={isInternalTest ? styles.badgeInternalTest : statusClass(workspace.billing_status)} />
          <QuickFact label="Letzte Zahlung" value={date(workspace.billing_last_payment_at)} />
          <QuickFact label="Nächster Versuch / Kulanz" value={workspace.billing_next_retry_at ? date(workspace.billing_next_retry_at) : date(workspace.billing_grace_until)} />
          <QuickFact label="Steuermodus" value={stripe.taxModeLabel} tone={taxBadgeClass} />
        </section>

        <nav className={styles.sectionNav} aria-label="CRM-Abschnitte">
          <a href="#uebersicht">Übersicht</a><a href="#rechnungen">Rechnungen</a><a href="#zahlungsverlauf">Zahlungsverlauf</a><a href="#admin-notizen">Admin-Notizen</a><a href="#technische-daten">Technische Daten</a>
        </nav>

        <div className={styles.crmLayout}>
          <main className={styles.crmMain}>
            <section id="uebersicht" className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Übersicht</span><h2>Vertrag & Zahlungsstatus</h2></div><span className={statusClass(workspace.billing_status)}>{billingStatusLabel}</span></div><dl className={styles.detailGrid}><Field label="Workspace" value={workspace.name} /><Field label="Owner" value={workspace.owner_email ?? workspace.owner_user_id} /><Field label="Plan" value={planLabel} /><Field label="Option" value={optionLabel} /><Field label="Setup" value={money(workspace.setup_fee_cents)} /><Field label="Monatsbetrag" value={money(workspace.monthly_fee_cents)} /><Field label="Bindung" value={`${workspace.commitment_months ?? 0} Monate`} /><Field label="Kulanzfrist" value={date(workspace.billing_grace_until)} /><Field label="Live-Testabo" value={isInternalDailyTest ? "internal_daily_test · 1 € pro Tag · im Normalbetrieb nicht öffentlich" : "—"} /><Field label="Steuermodus" value={stripe.taxModeLabel} /><Field label="Rechnungshinweis" value={stripe.invoiceNote ?? "Stripe Tax aktiv, wenn Stripe Steuerdaten liefert"} /></dl></section>

            <section id="rechnungen" className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Rechnungen</span><h2>Rechnungen</h2></div>{!stripe.hasSecretKey ? <span className={styles.badgeWarn}>Stripe nicht konfiguriert</span> : stripe.readyForTax ? <span className={styles.badgeOk}>Stripe &amp; Tax bereit</span> : <span className={styles.badgeWarn}>Stripe Tax nicht freigegeben</span>}</div>{invoices.error ? <p className={styles.badgeWarn}>{invoices.error}</p> : null}{workspace.last_invoice_id || invoices.invoices.length ? <div className={styles.invoiceList}>{workspace.last_invoice_id ? <article className={styles.invoiceCard}><div><span className={styles.subline}>Letzte Rechnung</span><strong>{workspace.last_invoice_id}</strong></div><span className={styles.badge}>{workspace.last_invoice_status ?? "—"}</span><dl><Field label="Betrag fällig" value={money(workspace.last_invoice_amount_due_cents)} /><Field label="Betrag bezahlt" value={money(workspace.last_invoice_amount_paid_cents)} />{stripe.readyForTax ? null : <Field label="Steuerstatus" value="Checkout bis Tax-Freigabe gesperrt" />}</dl><div className={styles.actions}>{workspace.last_invoice_hosted_url ? <a className={styles.buttonSecondary} href={workspace.last_invoice_hosted_url}>Rechnung öffnen</a> : null}{workspace.last_invoice_pdf_url ? <a className={styles.buttonSecondary} href={workspace.last_invoice_pdf_url}>PDF öffnen</a> : null}</div></article> : null}{invoices.invoices.map((invoice) => <article className={styles.invoiceRow} key={invoice.id}><div><span>{date(invoice.created)}</span><strong>{invoice.id}</strong></div><span className={styles.badge}>{invoice.status ?? "—"}</span><span>{typeof invoice.total === "number" ? money(invoice.total) : money(invoice.amount_due)}</span>{taxBreakdown(invoice)}<div className={styles.actions}>{invoice.hosted_invoice_url ? <a href={invoice.hosted_invoice_url}>Rechnung öffnen</a> : null}{invoice.invoice_pdf ? <a href={invoice.invoice_pdf}>PDF öffnen</a> : null}</div></article>)}</div> : <div className={styles.emptyState}>Noch keine Rechnung vorhanden. Sobald Stripe eine Rechnung liefert oder eine Zahlung verbucht wurde, erscheint sie hier.</div>}</section>

            <section id="zahlungsverlauf" className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Historie</span><h2>Zahlungsverlauf</h2></div></div>{timelineHasItems ? <ul className={styles.timeline}><TimelineItem label="Checkout gestartet" value={workspace.stripe_checkout_session_id ? date(workspace.billing_updated_at) : null} /><TimelineItem label="Subscription-ID" value={workspace.stripe_subscription_id} /><TimelineItem label="Invoice-Status" value={workspace.last_invoice_status} /><TimelineItem label="Letzte Zahlung" value={date(workspace.billing_last_payment_at)} tone={styles.goodText} /><TimelineItem label="Letzter Zahlungsfehler" value={date(workspace.billing_last_payment_failed_at)} tone={styles.badText} /><TimelineItem label="Fehlversuche" value={(workspace.billing_retry_count ?? 0) > 0 ? workspace.billing_retry_count : null} /><TimelineItem label="Nächster Zahlungsversuch" value={date(workspace.billing_next_retry_at)} /><TimelineItem label="Kulanzfrist" value={date(workspace.billing_grace_until)} /><TimelineItem label="Gesperrt seit" value={date(workspace.billing_suspended_at)} tone={styles.badText} />{workspace.billing_admin_note ? <TimelineItem label="Admin-Notiz / Zahlung verbucht" value={workspace.billing_admin_note} /> : null}</ul> : <div className={styles.emptyState}>Noch kein Zahlungsereignis gespeichert.</div>}</section>

            <section id="technische-daten" className={styles.card}><details className={styles.technicalDetails}><summary>Technische Daten anzeigen</summary><dl className={styles.detailGrid}><Field label="Workspace ID" value={workspace.id} /><Field label="Stripe Customer ID" value={workspace.stripe_customer_id} /><Field label="Stripe Subscription ID" value={workspace.stripe_subscription_id} /><Field label="Stripe Checkout Session ID" value={workspace.stripe_checkout_session_id} /><Field label="Interne Test-Option" value={isInternalDailyTest ? INTERNAL_DAILY_TEST_OPTION : "—"} /><Field label="FANMIND_TAX_MODE" value={stripe.taxMode} /><Field label="Aktualisiert" value={date(workspace.billing_updated_at)} /><Field label="Aktualisiert von" value={shortId(workspace.billing_updated_by_user_id)} /></dl></details></section>
          </main>

          <aside className={styles.crmAside}>
            <section className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Steuerung</span><h2>Admin-Aktionen</h2></div></div><div className={styles.actionGroup}><form action={`/api/admin/billing/workspaces/${workspace.id}/suspend`} method="post"><button className={styles.buttonDanger}>Sperren</button></form><form action={`/api/admin/billing/workspaces/${workspace.id}/unsuspend`} method="post"><button className={styles.buttonSecondary}>Entsperren</button></form><form action={`/api/admin/billing/workspaces/${workspace.id}/internal-test`} method="post"><button className={styles.buttonSecondary}>Kostenfreien internen Testzugang freischalten</button></form><form action={`/api/admin/billing/workspaces/${workspace.id}/internal-daily-test`} method="post"><button className={styles.buttonPrimary} disabled={!isInternalTest || !dailyStripeReady}>1-€-Live-Testabo starten</button></form><form action={`/api/admin/billing/workspaces/${workspace.id}/internal-daily-test/cancel`} method="post"><button className={styles.buttonDanger} disabled={!isInternalDailyTest}>Live-Testabo deaktivieren</button></form></div><p className={styles.subline}>Internes Live-Testabo: Stripe Live, 1 € pro Tag, nur für markierte interne Test-Workspaces. Im Normalbetrieb nicht öffentlich, keine Referral-Verrechnung.</p><form action={`/api/admin/billing/workspaces/${workspace.id}/mark-paid`} method="post" className={styles.compactForm}><h3>Zahlung verbuchen</h3><label>Zahlungsquelle<select className={styles.select} name="payment_source" defaultValue="bank_transfer"><option value="bank_transfer">Banküberweisung</option><option value="stripe_confirmed">Stripe bestätigt</option><option value="cash_or_other">Bar/anderer Weg</option><option value="credit_note">Gutschrift/Kulanz</option><option value="correction">Korrektur</option></select></label><label>Betrag optional<input className={styles.input} name="amount" inputMode="decimal" /></label><label>Referenz/Notiz optional<input className={styles.input} name="reference" /></label><label>Datum optional<input className={styles.input} name="paid_at" type="date" /></label><label className={styles.checkboxLabel}><input type="checkbox" name="lift_payment_suspension" value="true" defaultChecked={workspace.billing_status !== "manual_suspended"} disabled={workspace.billing_status === "manual_suspended"} /> Zahlungsbedingte Sperre aufheben</label><button className={styles.buttonPrimary}>Zahlung verbuchen</button></form><form id="admin-notizen" action={`/api/admin/billing/workspaces/${workspace.id}/note`} method="post" className={styles.compactForm}><h3>Admin-Notiz</h3><textarea className={styles.textarea} name="note" defaultValue={workspace.billing_admin_note ?? ""} rows={4} /><button className={styles.buttonPrimary}>Admin-Notiz speichern</button></form></section>
          </aside>
        </div>
      </> : null}
    </div>
  </AdminBillingShell>;
}
