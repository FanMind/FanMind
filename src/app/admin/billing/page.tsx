import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/admin";
import { isInternalTestMember, isInternalTestWorkspace, listAdminBillingMembers, listAdminBillingWorkspaces, listWorkspaceContactCounts, type AdminBillingMember, type AdminBillingWorkspace } from "@/lib/adminBilling";
import { PLANS, type FeatureKey, type FeatureStatus, type PlanId } from "@/config/plans";
import { roadmapPhases } from "@/config/roadmap";
import { getBillingStatusLabel } from "@/lib/billing";
import { getCommercialOptionLabel } from "@/lib/dashboardFeatures";
import { getStripeConfigStatus } from "@/lib/stripeBilling";
import { AdminBillingShell } from "./AdminBillingShell";
import { AdminTabs } from "./AdminTabs";
import styles from "./adminBilling.module.css";
import { resolvePublicWorkspacePlanId } from "@/lib/publicDailyPlanPolicy.mjs";

const suspendedStatuses = new Set(["suspended", "manual_suspended"]);

type AdminBillingPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function date(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("de-DE") : "—";
}

function statusClass(status?: string | null) {
  if (status === "active") return styles.badgeOk;
  if (status === "past_due" || status === "payment_failed" || status?.includes("suspended")) return styles.badgeBad;
  if (status?.startsWith("pending")) return styles.badgeWarn;
  return styles.badge;
}

function overviewStatusLabel(workspace: AdminBillingWorkspace) {
  if (workspace.billing_status) return getBillingStatusLabel(workspace.billing_status);
  if (resolvePublicWorkspacePlanId(workspace) === "daily") return "Zahlung offen";
  if (workspace.plan_id === "pilot") return "Demo/Kostenlos";
  if (workspace.plan_id === "starter") return "Zahlung offen";
  return "Unbekannt";
}

function customerStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    active: "Aktiv",
    demo_free: "Demo/Kostenlos",
    pending_payment_setup: "Offen",
    pending_sepa_mandate: "SEPA offen",
    past_due: "Überfällig",
    payment_failed: "Fehlgeschlagen",
    suspended: "Gesperrt",
    manual_suspended: "Manuell gesperrt",
    cancelled: "Gekündigt",
    expired: "Abgelaufen",
  };
  return status ? labels[status] ?? getBillingStatusLabel(status) : "Zahlung offen";
}

function getWorkspaceDate(workspace: AdminBillingWorkspace) {
  return workspace.created_at ?? workspace.billing_updated_at ?? null;
}

function getLastActivityDate(workspace: AdminBillingWorkspace) {
  return workspace.billing_updated_at ?? workspace.billing_last_payment_at ?? workspace.billing_last_payment_failed_at ?? workspace.created_at ?? null;
}

function sortByDateDesc(left: AdminBillingWorkspace, right: AdminBillingWorkspace) {
  return new Date(getWorkspaceDate(right) ?? 0).getTime() - new Date(getWorkspaceDate(left) ?? 0).getTime();
}

function planLabel(planId?: string | null) {
  if (planId === "pilot") return "Interne Demo";
  if (planId === "starter") return "Starter";
  if (planId === "growth") return "Growth";
  if (planId === "agency") return "Agency";
  return planId ?? "—";
}

function compactOptionLabel(option?: string | null) {
  if (option === "pilot") return "Legacy-/Demo-Zugang";
  if (option === "starter_flex" || option === "starter_no_setup_commitment") return "Starter Flex";
  if (option === "starter_12m" || option === "starter_paid_setup") return "Starter 12 Monate";
  const label = getCommercialOptionLabel(option ?? "");
  return label.length > 18 ? `${label.slice(0, 15)}…` : label;
}

function readablePlan(workspace: AdminBillingWorkspace) {
  if (workspace.plan_id === "growth") return "Growth";
  if (workspace.plan_id === "agency") return "Agency";
  return compactOptionLabel(workspace.commercial_option) || planLabel(workspace.plan_id);
}

function initials(value?: string | null) {
  const source = value?.trim() || "Workspace";
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)).toUpperCase();
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function StatCard({ icon, label, value, hint, trend, tone }: { icon: string; label: string; value: string | number; hint: string; trend: string; tone: string }) {
  return (
    <article className={styles.crmKpiCard}>
      <span className={`${styles.crmKpiIcon} ${tone}`}>{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
        <em>{trend}</em>
      </div>
    </article>
  );
}

const packagePlanIds: PlanId[] = ["pilot", "starter", "growth", "agency"];
const matrixFeatures: Array<{ key: FeatureKey; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "contacts", label: "Kontakte / Fans" },
  { key: "contact_detail", label: "Manuelle Kontakte" },
  { key: "csv_import", label: "CSV-Import" },
  { key: "memory", label: "Kontaktwissen" },
  { key: "ai_replies", label: "KI-Antwortvorschläge" },
  { key: "followups", label: "Follow-ups" },
  { key: "analytics", label: "Kommunikationsübersicht" },
  { key: "roadmap", label: "Kanäle-Roadmap" },
  { key: "basic_segments", label: "Segmente" },
  { key: "campaigns", label: "Kampagnen" },
  { key: "analytics", label: "Analytics / Reporting" },
  { key: "integrations", label: "Integrationen" },
  { key: "automatic_sending", label: "Automatisches Senden" },
  { key: "payments", label: "Zahlungen / Billing" },
];

function packageStatusLabel(status: FeatureStatus, planId: PlanId, featureKey: FeatureKey) {
  if (featureKey === "automatic_sending") return "Hidden";
  if (planId === "growth" || planId === "agency") {
    if (status === "hidden") return "Hidden";
    if (status === "coming_soon") return "Coming Soon";
    return "Roadmap";
  }
  if (featureKey === "integrations") return status === "hidden" ? "Hidden" : "Roadmap";
  if (status === "active" || status === "demo") return "Aktiv";
  if (status === "limited" || status === "preview") return "Limitiert";
  if (status === "coming_soon") return "Coming Soon";
  if (status === "hidden") return "Hidden";
  return "Nicht aktiv";
}

function matrixChipClass(label: string) {
  if (label === "Aktiv") return styles.matrixActive;
  if (label === "Limitiert") return styles.matrixLimited;
  if (label === "Coming Soon") return styles.matrixSoon;
  if (label === "Roadmap") return styles.matrixRoadmap;
  if (label === "Hidden") return styles.matrixHidden;
  return styles.matrixInactive;
}

function PackagesContent() {
  const activePackages = packagePlanIds.filter((planId) => planId === "starter").length;
  const hiddenFeatures = packagePlanIds.reduce((count, planId) => count + Object.values(PLANS[planId].featureConfig).filter((feature) => feature.status === "hidden" || feature.visibility === "hidden").length, 0);
  const comingSoonFeatures = packagePlanIds.reduce((count, planId) => count + Object.values(PLANS[planId].featureConfig).filter((feature) => feature.status === "coming_soon" || feature.status === "preview").length, 0);
  const packageCards = [
    { id: "pilot" as PlanId, icon: "D", title: "Interne Demo / Legacy", price: "Nicht öffentlich buchbar", meta: ["kostenloser Demo-/Legacy-Zugang", "keine normale Kundenbuchung"], status: "Intern", tone: styles.packagePilot },
    { id: "starter" as PlanId, icon: "S", title: "Starter", price: "312 €/Monat", meta: ["Starter Flex: 990 € Setup + 312 €/Monat", "Starter 12 Monate: 0 € Setup + 312 €/Monat"], status: "Aktiv", tone: styles.packageStarter },
    { id: "growth" as PlanId, icon: "G", title: "Growth", price: "Coming Soon", meta: ["Vorschau / Roadmap", "noch nicht produktiv buchbar"], status: "Coming Soon", tone: styles.packageGrowth },
    { id: "agency" as PlanId, icon: "A", title: "Agency", price: "Coming Soon", meta: ["Roadmap / Agenturen", "noch nicht produktiv buchbar"], status: "Coming Soon", tone: styles.packageAgency },
  ];
  const visibilityRules = [["App", "Kundensicht"], ["Landingpage", "Öffentlich"], ["Roadmap", "Öffentlich"], ["Admin", "Immer sichtbar"], ["Sales-Demo", "Nur intern"]] as const;
  const upgradeRules = [["Downgrade-Sperre", "in Vorbereitung"], ["Upgrade-Pfade", "Linearer Pfad"], ["Feature-Entsperrung", "nach Zahlung"], ["Zahlungsprüfung", "Erforderlich"]] as const;

  return <>
    <section className={styles.crmKpiGrid} aria-label="Paket- und Feature-Kennzahlen">
      <StatCard icon="◆" label="Aktive Pakete" value={activePackages} hint="Starter öffentlich verfügbar" trend="Aus Plan-Konfiguration" tone={styles.toneGreen} />
      <StatCard icon="◌" label="Versteckte Features" value={hiddenFeatures} hint="Hidden Status/Sichtbarkeit" trend="Keine UI-Secrets" tone={styles.toneRed} />
      <StatCard icon="↗" label="Coming Soon Features" value={comingSoonFeatures} hint="Preview oder Coming Soon" trend="Roadmap ehrlich markiert" tone={styles.toneAmber} />
      <StatCard icon="⇄" label="Upgrade-Regeln" value="4" hint="Nur Status-Übersicht" trend="Keine Engine geändert" tone={styles.toneCyan} />
      <StatCard icon="◎" label="Landingpage Sichtbarkeit" value="Öffentlich" hint="Roadmap/Preise kontrolliert" trend="Planlogik unverändert" tone={styles.toneBlue} />
    </section>
    <section className={styles.packageLayout}>
      <div className={styles.packageMain}>
        <article className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Pakete</span><h2>Paketübersicht</h2></div><span className={styles.badge}>4 Pakete</span></div><div className={styles.packageGrid}>{packageCards.map((item) => <div className={`${styles.packageCard} ${item.tone}`} key={item.id}><div className={styles.packageTopline}><span className={styles.packageIcon}>{item.icon}</span><span className={item.status === "Aktiv" ? styles.badgeOk : styles.badgeWarn}>{item.status}</span></div><h3>{item.title}</h3><strong>{item.price}</strong><ul>{item.meta.map((line) => <li key={line}>{line}</li>)}</ul></div>)}</div></article>
        <article className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Freigaben</span><h2>Feature-Matrix</h2></div><span className={styles.badge}>Admin-Übersicht</span></div><div className={styles.featureMatrix}><div className={styles.featureMatrixHead}><span>Feature</span>{packagePlanIds.map((planId) => <span key={planId}>{PLANS[planId].name}</span>)}</div>{matrixFeatures.map((feature, index) => <div className={styles.featureMatrixRow} key={`${feature.key}-${index}`}><strong>{feature.label}</strong>{packagePlanIds.map((planId) => { const label = packageStatusLabel(PLANS[planId].featureConfig[feature.key].status, planId, feature.key); return <span className={matrixChipClass(label)} key={planId}>{label}</span>; })}</div>)}</div><div className={styles.legendRow}><span className={styles.matrixActive}>Aktiv</span><span className={styles.matrixLimited}>Limitiert</span><span className={styles.matrixSoon}>Coming Soon</span><span className={styles.matrixHidden}>Hidden</span><span className={styles.matrixRoadmap}>Roadmap Only</span></div></article>
      </div>
      <aside className={styles.packageAside}>
        <article className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Sichtbarkeit</span><h2>Sichtbarkeits-Regeln</h2><p className={styles.cardSubtitle}>Steuere, wo Features und Pakete sichtbar sind.</p></div></div><div className={styles.ruleList}>{visibilityRules.map(([label, status]) => <div className={styles.ruleItem} key={label}><span>{label}</span><strong>{status}</strong></div>)}</div><p className={styles.muted}>Anzeige der aktuellen Sichtbarkeit; keine neue Regel-Engine.</p></article>
        <article className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Upgrades</span><h2>Upgrade-Regeln</h2><p className={styles.cardSubtitle}>Definiere, wie und wann Upgrades möglich sind.</p></div></div><div className={styles.ruleList}>{upgradeRules.map(([label, status]) => <div className={styles.ruleItem} key={label}><span>{label}</span><strong>{status}</strong></div>)}</div><button className={styles.buttonSecondary} disabled>Regeln verwalten · in Vorbereitung</button></article>
        <article className={`${styles.card} ${styles.noticeCard}`}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Hinweis</span><h2>Hinweis</h2></div></div><p>Änderungen an Paketen und Features gelten für neue Kunden sofort. Für bestehende Kunden gelten Bestandsschutz-Regeln, sofern vertraglich vereinbart.</p><p>Produktive Freigaben erfolgen erst nach Zahlungs- und Admin-Prüfung.</p></article>
      </aside>
    </section>
  </>;
}

function OverviewContent({ workspaces, error }: { workspaces: AdminBillingWorkspace[]; error: string | null }) {
  const stripe = getStripeConfigStatus();
  const active = workspaces.filter((w) => w.billing_status === "active").length;
  const pilotDemos = workspaces.filter((w) => resolvePublicWorkspacePlanId(w) !== "daily" && (w.plan_id === "pilot" || w.commercial_option === "pilot")).length;
  const openPayments = workspaces.filter((w) => w.billing_status?.startsWith("pending") || w.billing_status === "past_due" || w.billing_status === "payment_failed").length;
  const recentlyUpdated = workspaces.filter((w) => w.billing_updated_at || w.billing_admin_note).length;
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const recentWorkspaces = [...workspaces].sort(sortByDateDesc).slice(0, 5);
  const activityItems = [...workspaces].filter((w) => w.billing_updated_at || w.billing_admin_note).sort((left, right) => new Date(right.billing_updated_at ?? 0).getTime() - new Date(left.billing_updated_at ?? 0).getTime()).slice(0, 5);
  const systemStatus = [["Datenbank", error ? "Eingeschränkt" : "Online", error ? styles.badgeWarn : styles.badgeOk], ["API & Dienste", "Online", styles.badgeOk], ["Dateispeicher", "Unbekannt", styles.badge], ["E-Mail Versand", "Nicht konfiguriert", styles.badgeWarn], ["KI-Verarbeitung", aiConfigured ? "Aktiv" : "Nicht konfiguriert", aiConfigured ? styles.badgeOk : styles.badgeWarn], ["Integrationen", "Teilweise", styles.badgeWarn]] as const;
  const quickActions = [{ icon: "+", label: "Neuen Kunden anlegen", href: "/register?plan=starter&option=starter_paid_setup", meta: "Starter-Registrierung", enabled: true }, { icon: "◆", label: "Kostenlose Demo öffnen", href: "/login", meta: "Temporärer Demo-Zugang", enabled: true }, { icon: "↗", label: "Paket zuweisen", meta: "In Vorbereitung", enabled: false }, { icon: "@", label: "Nutzer einladen", meta: "In Vorbereitung", enabled: false }, { icon: "€", label: "Rechnung erstellen", meta: stripe.readyForCheckout ? "In Vorbereitung" : "Stripe unvollständig", enabled: false }];
  const roadmapItems = roadmapPhases.slice(0, 4).map((phase) => [phase.title, phase.status] as const);

  return <>
    <section className={styles.crmKpiGrid} aria-label="Admin-Kennzahlen">
      <StatCard icon="👥" label="Kunden gesamt" value={workspaces.length} hint={workspaces.length ? "Echte Workspaces" : "Noch keine Daten"} trend="Live aus Admin-Billing" tone={styles.toneBlue} />
      <StatCard icon="✓" label="Aktive Workspaces" value={active} hint="Billing-Status aktiv" trend="Ohne Demo-Daten" tone={styles.toneGreen} />
      <StatCard icon="◆" label="Pilot-Demos" value={pilotDemos} hint="Plan oder Option Pilot" trend="Aus Workspace-Daten" tone={styles.toneViolet} />
      <StatCard icon="€" label="Offene Zahlungen" value={openPayments} hint="Pending, fehlgeschlagen oder überfällig" trend="Billing-Status" tone={styles.toneAmber} />
      <StatCard icon="AI" label="KI-Status" value={aiConfigured ? "Aktiv" : "Fehlt"} hint={aiConfigured ? "OpenAI-Key vorhanden" : "Nicht konfiguriert"} trend="Konfiguration" tone={aiConfigured ? styles.toneGreen : styles.toneRed} />
      <StatCard icon="↻" label="Letzte Admin-Aktionen" value={recentlyUpdated} hint={recentlyUpdated ? "Billing-Updates/Notizen" : "Noch keine Daten"} trend="Audit-Signal" tone={styles.toneCyan} />
    </section>
    {error ? <p className={styles.badgeWarn}>{error}</p> : null}
    <section className={styles.dashboardMiddleGrid}>
      <article className={`${styles.card} ${styles.recentCard}`}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>CRM-Übersicht</span><h2>Kürzlich hinzugekommene Kunden/Workspaces</h2></div><span className={styles.badge}>{workspaces.length} gesamt</span></div>{recentWorkspaces.length ? <div className={styles.compactTable}><div className={styles.compactTableHead}><span>Kunde / Workspace</span><span>Plan</span><span>Nutzer</span><span>Erstellt am</span><span>Status</span></div>{recentWorkspaces.map((workspace) => <div className={styles.compactTableRow} key={workspace.id}><span><Link className={styles.workspaceLink} href={`/admin/billing/workspaces/${workspace.id}`}>{workspace.name}</Link><small>{workspace.id}</small></span><span>{planLabel(workspace.plan_id)}<small>{compactOptionLabel(workspace.commercial_option)}</small></span><span>—</span><span>{date(getWorkspaceDate(workspace))}</span><span><span className={statusClass(workspace.billing_status)}>{overviewStatusLabel(workspace)}</span></span></div>)}</div> : <div className={styles.emptyState}>Noch keine Workspaces vorhanden.</div>}<Link className={styles.textLink} href="/admin/billing?tab=customers">Alle Kunden anzeigen</Link></article>
      <article className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Direktzugriff</span><h2>Schnellaktionen</h2></div></div><div className={styles.quickActionList}>{quickActions.map((action) => action.enabled && action.href ? <Link className={styles.quickAction} href={action.href} key={action.label}><span className={styles.actionIcon}>{action.icon}</span><span><strong>{action.label}</strong><small>{action.meta}</small></span><b aria-hidden="true">→</b></Link> : <div className={`${styles.quickAction} ${styles.disabledAction}`} key={action.label}><span className={styles.actionIcon}>{action.icon}</span><span><strong>{action.label}</strong><small>{action.meta}</small></span><b aria-hidden="true">→</b></div>)}</div></article>
      <article className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Betrieb</span><h2>Systemstatus</h2></div></div><div className={styles.statusList}>{systemStatus.map(([label, status, className]) => <div className={styles.statusItem} key={label}><span className={styles.statusLabel}><span className={styles.statusIcon} aria-hidden="true" />{label}</span><span className={className}>{status}</span></div>)}</div><p className={styles.muted}>Status aus vorhandener Konfiguration; unsichere Dienste bleiben neutral.</p></article>
    </section>
    <section className={styles.dashboardBottomGrid}><article className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Produkt</span><h2>Feature-Roadmap &amp; Sichtbarkeit</h2></div><Link className={styles.textLink} href="/admin/roadmap">Roadmap öffnen</Link></div><div className={styles.roadmapList}>{roadmapItems.map(([label, status]) => <div className={styles.roadmapItem} key={label}><strong>{label}</strong><span className={status === "In Entwicklung" ? styles.badgeOk : status === "Geplant" ? styles.badgeWarn : styles.badge}>{status}</span></div>)}</div></article><article className={`${styles.card} ${styles.activityCard}`}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Audit</span><h2>Letzte Aktivitäten (Audit-Log)</h2></div></div>{activityItems.length ? <ul className={styles.timeline}>{activityItems.map((workspace) => <li className={styles.timelineItem} key={workspace.id}><span className={styles.timelineDot} /><div><strong>{workspace.name}</strong><p>{workspace.billing_admin_note ? "Admin-Notiz gespeichert" : "Billing-Daten aktualisiert"}</p></div><time>{date(workspace.billing_updated_at)}</time></li>)}</ul> : <div className={styles.emptyState}>Noch keine Admin-Aktivitäten gespeichert.</div>}</article></section>
  </>;
}


function cents(value?: number | null) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format((value ?? 0) / 100);
}

function invoiceStatusLabel(status?: string | null) {
  if (status === "paid" || status === "bezahlt" || status === "active") return "Bezahlt";
  if (status === "open" || status === "pending" || status?.startsWith("pending")) return "Offen";
  if (status === "past_due") return "Überfällig";
  if (status === "payment_failed") return "Fehlgeschlagen";
  if (status === "suspended" || status === "manual_suspended") return "Gesperrt";
  return "Unbekannt";
}

function invoiceStatusClass(status?: string | null) {
  const label = invoiceStatusLabel(status);
  if (label === "Bezahlt") return styles.badgeOk;
  if (label === "Offen") return styles.badgeWarn;
  if (label === "Überfällig" || label === "Fehlgeschlagen" || label === "Gesperrt") return styles.badgeBad;
  return styles.badge;
}

function invoiceStatus(workspace: AdminBillingWorkspace) {
  return workspace.last_invoice_status ?? workspace.billing_status;
}

function invoiceAmountDue(workspace: AdminBillingWorkspace) {
  return workspace.last_invoice_amount_due_cents ?? workspace.last_invoice_amount_paid_cents ?? 0;
}

function invoiceAmountPaid(workspace: AdminBillingWorkspace) {
  return workspace.last_invoice_amount_paid_cents ?? (invoiceStatusLabel(invoiceStatus(workspace)) === "Bezahlt" ? workspace.last_invoice_amount_due_cents : null) ?? 0;
}

function hasInvoiceSignal(workspace: AdminBillingWorkspace) {
  return Boolean(workspace.last_invoice_id || workspace.last_invoice_status || workspace.last_invoice_amount_due_cents || workspace.last_invoice_amount_paid_cents || workspace.last_invoice_hosted_url || workspace.last_invoice_pdf_url || workspace.billing_last_payment_at || workspace.billing_last_payment_failed_at);
}

function isThisMonth(value?: string | null) {
  if (!value) return false;
  const dateValue = new Date(value);
  const now = new Date();
  return dateValue.getFullYear() === now.getFullYear() && dateValue.getMonth() === now.getMonth();
}

function PaymentsContent({ workspaces, members, selectedWorkspaceId, error }: { workspaces: AdminBillingWorkspace[]; members: AdminBillingMember[]; selectedWorkspaceId?: string; error: string | null }) {
  const invoices = workspaces.filter(hasInvoiceSignal).sort((left, right) => new Date(getLastActivityDate(right) ?? 0).getTime() - new Date(getLastActivityDate(left) ?? 0).getTime());
  const selected = invoices.find((workspace) => workspace.id === selectedWorkspaceId) ?? invoices[0] ?? null;
  const selectedOwner = selected ? members.find((member) => member.workspace_id === selected.id && member.user_id === selected.owner_user_id) ?? members.find((member) => member.workspace_id === selected.id) : null;
  const openInvoices = invoices.filter((workspace) => invoiceStatusLabel(invoiceStatus(workspace)) === "Offen");
  const overdueInvoices = invoices.filter((workspace) => invoiceStatusLabel(invoiceStatus(workspace)) === "Überfällig");
  const paidInvoices = invoices.filter((workspace) => invoiceStatusLabel(invoiceStatus(workspace)) === "Bezahlt");
  const monthlyRevenue = invoices.filter((workspace) => isThisMonth(workspace.billing_last_payment_at)).reduce((sum, workspace) => sum + invoiceAmountPaid(workspace), 0);
  const totalDue = invoices.reduce((sum, workspace) => sum + invoiceAmountDue(workspace), 0);
  const totalPaid = invoices.reduce((sum, workspace) => sum + invoiceAmountPaid(workspace), 0);
  const openAmount = openInvoices.reduce((sum, workspace) => sum + Math.max(0, invoiceAmountDue(workspace) - invoiceAmountPaid(workspace)), 0);
  const overdueAmount = overdueInvoices.reduce((sum, workspace) => sum + Math.max(0, invoiceAmountDue(workspace) - invoiceAmountPaid(workspace)), 0);
  const history = selected ? [
    selected.created_at ? `Rechnung erstellt: ${date(selected.created_at)}` : null,
    invoiceStatusLabel(invoiceStatus(selected)) === "Offen" ? "Zahlung erwartet" : null,
    selected.billing_last_payment_at ? `Zahlung eingegangen: ${date(selected.billing_last_payment_at)}` : null,
    selected.billing_last_payment_failed_at ? `Zahlungsfehler: ${date(selected.billing_last_payment_failed_at)}` : null,
  ].filter(Boolean) : [];

  return <>
    <section className={styles.crmKpiGrid} aria-label="Zahlungskennzahlen">
      <StatCard icon="€" label="Umsatz diesen Monat" value={cents(monthlyRevenue)} hint={invoices.length ? "Aus bestätigten Zahlungsdaten" : "Keine Rechnungen vorhanden"} trend="Echte Billing-Daten" tone={styles.toneGreen} />
      <StatCard icon="◷" label="Offene Rechnungen" value={openInvoices.length} hint="Status offen/pending" trend="Keine Demo-Rechnungen" tone={styles.toneAmber} />
      <StatCard icon="!" label="Überfällige Zahlungen" value={overdueInvoices.length} hint="Status past_due" trend="Aus Billing-Status" tone={styles.toneRed} />
      <StatCard icon="✓" label="Erfolgreiche Zahlungen" value={paidInvoices.length} hint="Status paid/active" trend="Echt verbucht" tone={styles.toneCyan} />
      <StatCard icon="M" label="Manuelle Rechnungen" value={0} hint="Keine separate Datenquelle" trend="Sauberer Fallback" tone={styles.toneBlue} />
    </section>
    {error ? <p className={styles.badgeWarn}>{error}</p> : null}
    <section className={styles.paymentsLayout}>
      <article className={`${styles.card} ${styles.paymentsTableCard}`}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Billing</span><h2>Zahlungen &amp; Rechnungen</h2></div><span className={styles.badge}>{invoices.length} Einträge</span></div><div className={styles.paymentFilterBar}><select className={styles.select} disabled><option>Status: Alle</option></select><button className={styles.buttonSecondary} disabled>Letzte 30 Tage · vorbereitet</button><input className={styles.input} placeholder="Suche nach Kunde, Rechnungs-Nr. ..." disabled /></div>{invoices.length ? <div className={styles.paymentTable}><div className={styles.paymentTableHead}><span>Kunde</span><span>Rechnungs-Nr.</span><span>Betrag</span><span>Fälligkeitsdatum</span><span>Status</span><span>Zahlungsmethode</span><span>Aktion</span></div>{invoices.map((workspace) => <div className={styles.paymentTableRow} key={workspace.id}><span><strong>{workspace.name}</strong><small>{workspace.id}</small></span><span>{workspace.last_invoice_id ?? "—"}</span><span>{cents(invoiceAmountDue(workspace))}</span><span>—</span><span><span className={invoiceStatusClass(invoiceStatus(workspace))}>{invoiceStatusLabel(invoiceStatus(workspace))}</span></span><span>—</span><span><Link className={styles.buttonSecondary} href={`/admin/billing?tab=payments&workspace=${workspace.id}`}>Details</Link></span></div>)}</div> : <div className={styles.emptyState}>Noch keine Rechnungen vorhanden. Sobald Stripe Rechnungen liefert oder Zahlungen verbucht wurden, erscheinen sie hier.</div>}</article>
      <aside className={`${styles.card} ${styles.paymentDetailPanel}`}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Details</span><h2>{selected?.last_invoice_id ? `Rechnung ${selected.last_invoice_id}` : "Rechnungsdetails"}</h2></div>{selected ? <span className={invoiceStatusClass(invoiceStatus(selected))}>{invoiceStatusLabel(invoiceStatus(selected))}</span> : null}</div>{selected ? <><dl className={styles.paymentDetailList}><div><dt>Rechnungsempfänger</dt><dd>{selected.name}<small>{selectedOwner?.display_name ?? selectedOwner?.email ?? selected.owner_user_id ?? "Owner nicht hinterlegt"}</small><small>{selectedOwner?.email ?? "E-Mail nicht hinterlegt"}</small></dd></div><div><dt>Paket &amp; Abrechnung</dt><dd>{readablePlan(selected)}<small>{getCommercialOptionLabel(selected.commercial_option ?? "") || "—"}</small><small>Betrag: {cents(invoiceAmountDue(selected))}</small><small>Zeitraum: —</small></dd></div><div><dt>Zahlungshistorie</dt><dd>{history.length ? history.map((item) => <small key={item}>{item}</small>) : <small>Noch kein Zahlungsverlauf gespeichert.</small>}</dd></div><div><dt>Notizen</dt><dd>{selected.billing_admin_note || "Noch keine Zahlungsnotiz vorhanden."}</dd></div></dl><div className={styles.panelActions}>{selected.last_invoice_hosted_url ? <a className={styles.buttonPrimary} href={selected.last_invoice_hosted_url} target="_blank" rel="noreferrer">Rechnung öffnen</a> : <button className={styles.buttonSecondary} disabled>Rechnung öffnen · nicht verfügbar</button>}{selected.last_invoice_pdf_url ? <a className={styles.buttonSecondary} href={selected.last_invoice_pdf_url} target="_blank" rel="noreferrer">PDF öffnen</a> : <button className={styles.buttonSecondary} disabled>PDF öffnen · nicht verfügbar</button>}<Link className={styles.buttonSecondary} href={`/admin/billing/workspaces/${selected.id}`}>Zahlung verbuchen</Link><button className={styles.buttonSecondary} disabled>Erinnerung senden · in Vorbereitung</button></div></> : <div className={styles.emptyState}>Wähle eine echte Rechnung aus, sobald Billing-Daten vorhanden sind.</div>}</aside>
    </section>
    <section className={styles.paymentBottomGrid}><article className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Zahlungsarten</span><h2>Zahlungsmethoden</h2></div></div><div className={styles.methodList}><div><strong>SEPA Lastschrift</strong><span>SEPA via Stripe vorbereitet</span></div><div><strong>Überweisung</strong><span>Überweisung extern</span></div><div><strong>Kreditkarte</strong><span>Kreditkarte nicht aktiv</span></div></div><p className={styles.muted}>Noch keine Zahlungsstatistik vorhanden.</p><button className={styles.buttonSecondary} disabled>Zahlungsmethoden verwalten · in Vorbereitung</button></article><article className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Aktueller Zeitraum</span><h2>Zahlungsübersicht</h2></div></div><div className={styles.summaryList}><div><span>Gesamtumsatz</span><strong>{cents(totalDue)}</strong></div><div><span>Erfolgreich vereinnahmt</span><strong>{cents(totalPaid)}</strong></div><div><span>Offene Beträge</span><strong>{cents(openAmount)}</strong></div><div><span>Überfällige Beträge</span><strong>{cents(overdueAmount)}</strong></div></div>{invoices.length ? null : <p className={styles.muted}>Noch keine bestätigten Zahlungsdaten vorhanden.</p>}<button className={styles.buttonSecondary} disabled>Zur Umsatzanalyse · in Vorbereitung</button></article></section>
  </>;
}

function CustomersContent({ workspaces, members, contactCounts, selectedWorkspaceId, error, memberError }: { workspaces: AdminBillingWorkspace[]; members: AdminBillingMember[]; contactCounts: Map<string, number>; selectedWorkspaceId?: string; error: string | null; memberError: string | null }) {
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? workspaces[0] ?? null;
  const workspaceRows = [...workspaces].sort(sortByDateDesc).slice(0, 10);
  const selectedMembers = selectedWorkspace ? members.filter((member) => member.workspace_id === selectedWorkspace.id) : [];
  const newestCreatedAt = Math.max(0, ...workspaces.map((workspace) => new Date(workspace.created_at ?? 0).getTime()).filter(Number.isFinite));
  const newRegistrations = workspaces.filter((workspace) => {
    if (!workspace.created_at || !newestCreatedAt) return false;
    const createdAt = new Date(workspace.created_at).getTime();
    return Number.isFinite(createdAt) && newestCreatedAt - createdAt <= 30 * 24 * 60 * 60 * 1000;
  }).length;
  const suspended = workspaces.filter((workspace) => suspendedStatuses.has(workspace.billing_status ?? "")).length;
  const internalTestMembers = members.filter((member) => isInternalTestMember(member, workspaces.find((workspace) => workspace.id === member.workspace_id))).length;

  return <>
    <section className={styles.crmKpiGrid} aria-label="Kunden- und Nutzer-Kennzahlen">
      <StatCard icon="◎" label="Kunden gesamt" value={workspaces.length} hint={workspaces.length ? "Echte Workspaces" : "Noch keine Daten"} trend="Aus Admin-Billing" tone={styles.toneBlue} />
      <StatCard icon="👤" label="Aktive Nutzer" value={members.length} hint={members.length ? "Workspace-Mitglieder" : "Keine Mitglieder geladen"} trend="Echte Mitgliedschaften" tone={styles.toneGreen} />
      <StatCard icon="↗" label="Neue Registrierungen" value={newRegistrations} hint="Workspaces der letzten 30 Tage" trend="Nach created_at" tone={styles.toneCyan} />
      <StatCard icon="⛔" label="Gesperrte Zugänge" value={suspended} hint="Suspended oder manuell gesperrt" trend="Billing-Status" tone={styles.toneRed} />
      <StatCard icon="T" label="Interne Testzugänge" value={internalTestMembers} hint="Markierte Testnutzer" trend="Admin-only Erkennung" tone={styles.toneRed} />
    </section>
    {error ? <p className={styles.badgeWarn}>{error}</p> : null}
    {memberError ? <p className={styles.badgeWarn}>{memberError}</p> : null}
    <section className={styles.customerWorkspaceGrid}>
      <article className={`${styles.card} ${styles.customerTableCard}`}>
        <div className={styles.cardHeader}><div><span className={styles.eyebrow}>CRM-Verzeichnis</span><h2>Kunden / Workspaces</h2></div><span className={styles.badge}>{workspaces.length} Einträge</span></div>
        <div className={styles.filterBar}><input className={styles.input} placeholder="Suchen nach Kunde oder Workspace..." disabled /><select className={styles.select} disabled><option>Alle Pakete</option></select><select className={styles.select} disabled><option>Alle Status</option></select><button className={styles.buttonSecondary} disabled>Filter</button></div>
        {workspaceRows.length ? <div className={styles.customerTable}><div className={styles.customerTableHead}><span>Kunde</span><span>Workspace</span><span>Paket</span><span>Nutzer</span><span>Status</span><span>Letzte Aktivität</span><span>Aktion</span></div>{workspaceRows.map((workspace) => { const count = members.filter((member) => member.workspace_id === workspace.id).length; const isInternalTest = isInternalTestWorkspace(workspace); return <div className={`${styles.customerTableRow} ${isInternalTest ? styles.internalTestRow : ""}`} key={workspace.id}><span className={styles.identityCell}><span className={styles.avatar}>{initials(workspace.name)}</span><span><strong>{workspace.name}</strong><small>{workspace.owner_user_id ? `Owner ${workspace.owner_user_id.slice(0, 8)}…` : "Owner nicht hinterlegt"}</small></span></span><span><Link className={styles.workspaceLink} href={`/admin/billing?tab=customers&workspace=${workspace.id}`}>{workspace.name}</Link><small>{workspace.id}</small></span><span>{readablePlan(workspace)}</span><span>{count || "—"}</span><span><span className={statusClass(workspace.billing_status)}>{isInternalTest ? "Interner Testzugang" : customerStatusLabel(workspace.billing_status)}</span></span><span>{date(getLastActivityDate(workspace))}</span><span><Link className={styles.buttonSecondary} href={`/admin/billing/workspaces/${workspace.id}`}>Details ansehen</Link></span></div>; })}</div> : <div className={styles.emptyState}>Noch keine echten Workspaces vorhanden.</div>}
      </article>
      <aside className={`${styles.card} ${styles.customerDetailPanel}`}>
        <div className={styles.cardHeader}><div><span className={styles.eyebrow}>Auswahl</span><h2>Kundendetails</h2></div>{selectedWorkspace ? <span className={isInternalTestWorkspace(selectedWorkspace) ? styles.badgeInternalTest : statusClass(selectedWorkspace.billing_status)}>{isInternalTestWorkspace(selectedWorkspace) ? "Interner Testzugang" : customerStatusLabel(selectedWorkspace.billing_status)}</span> : null}</div>
        {selectedWorkspace ? <><div className={styles.detailHero}><span className={styles.avatarLarge}>{initials(selectedWorkspace.name)}</span><div><strong>{selectedWorkspace.name}</strong><small>{selectedWorkspace.id}</small></div></div><dl className={styles.customerDetailList}><div><dt>Owner</dt><dd>{selectedWorkspace.owner_user_id ?? "Nicht hinterlegt"}</dd></div><div><dt>Paket</dt><dd>{readablePlan(selectedWorkspace)} · {selectedWorkspace.commitment_months ? `${selectedWorkspace.commitment_months} Monate` : "Laufzeit offen"}</dd></div><div><dt>Kontakte/Fans</dt><dd>{contactCounts.get(selectedWorkspace.id) ?? "—"}</dd></div><div><dt>Testzugang</dt><dd>{isInternalTestWorkspace(selectedWorkspace) ? "Interner Testzugang" : "Nein"}</dd></div><div><dt>Notizen</dt><dd>{selectedWorkspace.billing_admin_note || "Noch keine Notiz."}</dd></div><div><dt>Zuletzt bearbeitet</dt><dd>{date(selectedWorkspace.billing_updated_at ?? selectedWorkspace.created_at)}</dd></div></dl><div className={styles.panelActions}><Link className={styles.buttonPrimary} href={`/admin/billing/workspaces/${selectedWorkspace.id}`}>Workspace öffnen</Link><form action={`/api/admin/billing/workspaces/${selectedWorkspace.id}/internal-test`} method="post"><button className={styles.buttonSecondary}>Als internen Testzugang freischalten</button></form><button className={styles.buttonSecondary} disabled>Paket ändern · in Vorbereitung</button><form action={`/api/admin/billing/workspaces/${selectedWorkspace.id}/suspend`} method="post"><button className={styles.buttonDanger}>Zugang sperren</button></form><button className={styles.buttonSecondary} disabled>Einladung senden · in Vorbereitung</button></div>{selectedMembers.length ? <div className={styles.memberMiniList}><strong>Teammitglieder</strong>{selectedMembers.slice(0, 4).map((member) => <span key={member.id}>{member.display_name ?? member.email ?? member.user_id}<small>{member.role ?? "Mitglied"}</small></span>)}</div> : <p className={styles.muted}>Keine Teammitglieder für diesen Workspace geladen.</p>}</> : <div className={styles.emptyState}>Wähle einen Workspace aus, sobald echte Daten vorhanden sind.</div>}
      </aside>
    </section>
    <article className={`${styles.card} ${styles.teamCard}`}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Nutzerverwaltung</span><h2>Eingeladene Nutzer / Teammitglieder</h2></div><span className={styles.badge}>{members.length} aktive Mitglieder</span></div><div className={styles.filterBar}><input className={styles.input} placeholder="Namen oder E-Mail suchen..." disabled /><select className={styles.select} disabled><option>Alle Rollen</option></select><select className={styles.select} disabled><option>Alle Status</option></select></div>{members.length ? <div className={styles.teamTable}><div className={styles.teamTableHead}><span>Name</span><span>E-Mail</span><span>Rolle</span><span>Kunde / Workspace</span><span>Status</span><span>Eingeladen am</span><span>Aktion</span></div>{members.slice(0, 10).map((member) => { const workspace = workspaces.find((item) => item.id === member.workspace_id); const isInternalTest = isInternalTestMember(member, workspace); return <div className={`${styles.teamTableRow} ${isInternalTest ? styles.internalTestRow : ""}`} key={member.id}><span>{member.display_name ?? "—"}</span><span className={isInternalTest ? styles.internalTestUser : undefined}>{member.email ?? "—"}{isInternalTest ? <small>Interner Testzugang</small> : null}</span><span>{member.role ?? "Mitglied"}</span><span>{workspace?.name ?? member.workspace_id}</span><span><span className={isInternalTest ? styles.badgeInternalTest : styles.badgeOk}>{isInternalTest ? "Interner Testzugang" : "Aktiv"}</span></span><span>{date(member.created_at)}</span><span className={styles.actions}>{workspace ? <Link className={styles.buttonSecondary} href={`/admin/billing/workspaces/${workspace.id}`}>Workspace</Link> : "—"}<form action={`/api/admin/billing/users/${member.user_id}/confirm-email`} method="post"><button className={styles.buttonSecondary}>E-Mail serverseitig bestätigen</button></form></span></div>; })}</div> : <div className={styles.emptyState}>Noch keine offenen Einladungen vorhanden.</div>}<div className={styles.footerActions}><button className={styles.buttonSecondary} disabled>Alle Einladungen anzeigen · in Vorbereitung</button><button className={styles.buttonSecondary} disabled>Nutzerverwaltung öffnen · in Vorbereitung</button></div></article>
  </>;
}

export default async function AdminBillingPage({ searchParams }: AdminBillingPageProps) {
  const user = await requirePlatformAdmin();
  const params = await searchParams;
  const tabParam = getSingleParam(params.tab);
  const activeTab = tabParam === "customers" ? "customers" : tabParam === "packages" ? "packages" : tabParam === "payments" ? "payments" : "overview";
  const selectedWorkspaceId = getSingleParam(params.workspace);
  const [{ workspaces, error }, { members, error: memberError }, { counts: contactCounts }] = await Promise.all([listAdminBillingWorkspaces(), listAdminBillingMembers(), listWorkspaceContactCounts()]);

  return (
    <AdminBillingShell user={user} title="Adminbereich" subtitle="Verwalte Kunden, Workspaces, Pakete und Systemeinstellungen.">
      <div className={styles.adminStack}>
        <AdminTabs activeTab={activeTab} />
        {activeTab === "customers" ? <CustomersContent workspaces={workspaces} members={members} contactCounts={contactCounts} selectedWorkspaceId={selectedWorkspaceId} error={error} memberError={memberError} /> : activeTab === "packages" ? <PackagesContent /> : activeTab === "payments" ? <PaymentsContent workspaces={workspaces} members={members} selectedWorkspaceId={selectedWorkspaceId} error={error} /> : <OverviewContent workspaces={workspaces} error={error} />}
      </div>
    </AdminBillingShell>
  );
}
