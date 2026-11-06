import { requirePlatformAdmin } from "@/lib/admin";
import { getAdminAiUsageSummary } from "@/lib/adminAiUsage";
import {
  ADMIN_AI_USAGE_DAY_RANGES,
  normalizeAdminAiUsageDays,
} from "@/lib/aiUsageDashboardMetrics.mjs";
import type {
  AiBudgetIndicator,
  AiUsageSpikeIndicator,
} from "@/lib/aiUsageDashboardMetrics.mjs";
import { AdminBillingShell } from "../billing/AdminBillingShell";
import { AdminTabs } from "../billing/AdminTabs";
import styles from "../billing/adminBilling.module.css";

type Props = { searchParams: Promise<{ days?: string }> };

function money(cents: number, currency: string) { return `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ${currency}`; }
function date(value: string) { return new Date(value).toLocaleString("de-DE"); }
function budgetLabel(level: AiBudgetIndicator["level"]) {
  if (level === "attention") return "Budget erreicht";
  if (level === "warning") return "Budgetwarnung";
  if (level === "observe") return "Beobachten";
  if (level === "normal") return "Im Rahmen";
  if (level === "incomplete") return "Auswertung begrenzt";
  return "Nicht konfiguriert";
}
function spikeLabel(level: AiUsageSpikeIndicator["level"]) {
  if (level === "warning") return "Auffälliger Anstieg";
  if (level === "incomplete") return "Auswertung begrenzt";
  if (level === "insufficient_basis") return "Neue Aktivität";
  return "Keine Auffälligkeit";
}
function indicatorClass(level: string) {
  if (level === "normal") return styles.matrixActive;
  if (level === "observe") return styles.matrixLimited;
  if (level === "warning" || level === "attention") return styles.matrixSoon;
  return styles.matrixHidden;
}
function budgetDetails(indicator: AiBudgetIndicator, currency: string) {
  if (!indicator.configured || indicator.budgetCents === null) {
    return "Kein internes Monatsbudget hinterlegt. Die Anzeige misst nur und erzeugt weder Kontingent noch Sperre.";
  }
  if (indicator.level === "incomplete") {
    return "Die Monatsauswertung hat die Sicherheitsobergrenze erreicht. Eine verlässliche Budgetbewertung wird deshalb nicht behauptet.";
  }
  return `${money(indicator.currentCostCents, currency)} von ${money(indicator.budgetCents, currency)} · ${indicator.usagePercent ?? 0} %.`;
}
function spikeDetails(indicator: AiUsageSpikeIndicator, currency: string, days: number) {
  if (indicator.level === "incomplete") {
    return "Mindestens einer der beiden Vergleichszeiträume hat die Sicherheitsobergrenze erreicht. Es wird kein Spike behauptet.";
  }
  if (indicator.level === "insufficient_basis") {
    return `Im vorherigen gleich langen Zeitraum gab es keine ausreichende Vergleichsbasis. Aktuell: ${indicator.currentRequests.toLocaleString("de-DE")} Anfragen in ${days === 1 ? "24 Stunden" : `${days} Tagen`}.`;
  }
  const requestRatio = indicator.requestRatio === null ? "—" : `${indicator.requestRatio.toLocaleString("de-DE")}×`;
  const costRatio = indicator.costRatio === null ? "—" : `${indicator.costRatio.toLocaleString("de-DE")}×`;
  return `Anfragen ${indicator.currentRequests.toLocaleString("de-DE")} zu ${indicator.previousRequests.toLocaleString("de-DE")} (${requestRatio}) · Kosten ${money(indicator.currentCostCents, currency)} zu ${money(indicator.previousCostCents, currency)} (${costRatio}).`;
}

export default async function AdminAiUsagePage({ searchParams }: Props) {
  const user = await requirePlatformAdmin();
  const params = await searchParams;
  const days = normalizeAdminAiUsageDays(params.days);
  const { summary, error } = await getAdminAiUsageSummary(days);

  return <AdminBillingShell user={user} title="KI-Verbrauch" subtitle="Workspace-, Feature- und Zeitraum-Auswertung ohne Prompt- oder Antwortvolltexte.">
    <div className={styles.adminStack}>
    <AdminTabs activeTab="ai-usage" />
    <section className={styles.hero}><span className={styles.eyebrow}>Admin · beobachtend</span><h1>KI-Verbrauch</h1><p>Workspace-, Feature- und Zeitraum-Auswertung. Vollständige Provider-Tokenwerte werden bevorzugt; ältere oder unvollständige Events können auf Zeichenlänge geschätzt sein. Kosten bleiben nicht abrechnungsgenau.</p></section>
    <nav className={styles.sectionNav} aria-label="Auswertungszeitraum">
      {ADMIN_AI_USAGE_DAY_RANGES.map((range) => <a key={range} href={`/admin/ai-usage?days=${range}`} className={range === days ? styles.buttonPrimary : styles.buttonSecondary} aria-current={range === days ? "page" : undefined}>{range === 1 ? "24 Stunden" : `${range} Tage`}</a>)}
    </nav>
    {error ? <div className={styles.emptyState}>{error}</div> : null}
    {summary ? <>
      <section className={styles.kpiGrid}><div className={styles.kpiCard}><span>Anfragen</span><strong>{summary.totalRequests}</strong><small>{days === 1 ? "letzte 24 Stunden" : `letzte ${days} Tage`}</small></div><div className={styles.kpiCard}><span>Kosten geschätzt</span><strong>{money(summary.totalEstimatedCostCents, summary.currency)}</strong><small>serverseitig berechnet</small></div><div className={styles.kpiCard}><span>Ø Kosten/Anfrage</span><strong>{summary.totalRequests ? money(summary.totalEstimatedCostCents / summary.totalRequests, summary.currency) : "—"}</strong><small>geschätzter Mittelwert</small></div><div className={styles.kpiCard}><span>Tokens geschätzt</span><strong>{(summary.totalInputTokens + summary.totalOutputTokens).toLocaleString("de-DE")}</strong><small>Input + Output</small></div><div className={styles.kpiCard}><span>Fehler</span><strong>{summary.errorRequests}</strong><small>Status error</small></div></section>
      <section className={styles.dashboardBottomGrid}>
        <article className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Interner Kostenhinweis</span><h2>Monatsbudget</h2></div><span className={indicatorClass(summary.budgetIndicator.level)}>{budgetLabel(summary.budgetIndicator.level)}</span></div><p className={styles.cardSubtitle}>{budgetDetails(summary.budgetIndicator, summary.currency)}</p></article>
        <article className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Beobachtung ohne Sperre</span><h2>Spike-Vergleich</h2></div><span className={indicatorClass(summary.spikeIndicator.level)}>{spikeLabel(summary.spikeIndicator.level)}</span></div><p className={styles.cardSubtitle}>{spikeDetails(summary.spikeIndicator, summary.currency, days)}</p></article>
      </section>
      {summary.truncated ? <div className={styles.emptyState}>Die gewählte Auswertung wurde bei 10.000 Ereignissen begrenzt. Summen und Verhältnisse sind Untergrenzen; die Warnlogik behauptet in diesem Zustand keine Entwarnung.</div> : null}
      <section className={styles.dashboardBottomGrid}><article className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Workspaces</span><h2>Verbrauch pro Workspace</h2></div></div><div className={styles.compactTable}><div className={styles.compactTableHead}><span>Workspace</span><span>Anfragen</span><span>Kosten geschätzt</span><span>Tokens</span><span>Kosten/Fan</span></div>{summary.byWorkspace.map((row) => <div className={styles.compactTableRow} key={row.workspaceId}><span title={row.workspaceId}><strong>{row.workspaceName}</strong><small>{row.contactCount === null ? "Kontakte nicht verfügbar" : `${row.contactCount.toLocaleString("de-DE")} Kontakte/Fans`}</small></span><span>{row.requests}</span><span>{money(row.estimatedCostCents, summary.currency)}</span><span>{(row.inputTokens + row.outputTokens).toLocaleString("de-DE")}</span><span>{row.estimatedCostPerFanCents === null ? "—" : money(row.estimatedCostPerFanCents, summary.currency)}<small>{row.estimatedCostPerHundredFansCents === null || row.estimatedCostPerThousandFansCents === null ? "keine Fan-Basis" : `${money(row.estimatedCostPerHundredFansCents, summary.currency)} /100 Fans · ${money(row.estimatedCostPerThousandFansCents, summary.currency)} /1.000 Fans`}</small></span></div>)}</div></article>
      <article className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Features</span><h2>Verbrauch pro Feature</h2></div></div><div className={styles.compactTable}><div className={styles.compactTableHead}><span>Feature</span><span>Anfragen</span><span>Kosten geschätzt</span><span>Fehler</span></div>{summary.byFeature.map((row) => <div className={styles.compactTableRow} key={row.feature}><span>{row.feature}</span><span>{row.requests}</span><span>{money(row.estimatedCostCents, summary.currency)}</span><span>{row.errorRequests}</span></div>)}</div></article></section>
      <article className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Entscheidungsgrundlage · erfolgreiche Events</span><h2>Token-Verteilung pro Feature</h2><p className={styles.cardSubtitle}>Nearest-rank P50, P90 und P95. Vollständige Providerwerte werden bevorzugt; historische Fallbackwerte können geschätzt sein.{summary.truncated ? " Wegen der Ereignisgrenze gilt die Verteilung nur für die geladene Stichprobe." : ""}</p></div></div><div className={`${styles.compactTable} ${styles.tokenDistributionTable}`}><div className={styles.compactTableHead}><span>Feature</span><span>Stichprobe</span><span>P50 Tokens</span><span>P90 Tokens</span><span>P95 Tokens</span></div>{summary.byFeatureTokenDistribution.length ? summary.byFeatureTokenDistribution.map((row) => <div className={styles.compactTableRow} key={row.feature}><span><strong>{row.feature}</strong></span><span>{row.sampleCount.toLocaleString("de-DE")}</span><span>{row.p50.totalTokens.toLocaleString("de-DE")}<small>P50 Input {row.p50.inputTokens.toLocaleString("de-DE")} · Output {row.p50.outputTokens.toLocaleString("de-DE")}</small></span><span>{row.p90.totalTokens.toLocaleString("de-DE")}<small>P90 Input {row.p90.inputTokens.toLocaleString("de-DE")} · Output {row.p90.outputTokens.toLocaleString("de-DE")}</small></span><span>{row.p95.totalTokens.toLocaleString("de-DE")}<small>P95 Input {row.p95.inputTokens.toLocaleString("de-DE")} · Output {row.p95.outputTokens.toLocaleString("de-DE")}</small></span></div>) : <div className={styles.emptyState}>Noch keine erfolgreichen Events mit konsistenten positiven Tokenwerten im gewählten Zeitraum.</div>}</div></article>
      <article className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Modelle</span><h2>Verbrauch pro Modell</h2></div></div><div className={styles.compactTable}><div className={styles.compactTableHead}><span>Modell</span><span>Anfragen</span><span>Kosten geschätzt</span><span>Tokens</span><span>Fehler</span></div>{summary.byModel.map((row) => <div className={styles.compactTableRow} key={row.model}><span><strong>{row.model}</strong></span><span>{row.requests}</span><span>{money(row.estimatedCostCents, summary.currency)}</span><span>{(row.inputTokens + row.outputTokens).toLocaleString("de-DE")}<small>{row.inputTokens.toLocaleString("de-DE")} Input · {row.outputTokens.toLocaleString("de-DE")} Output</small></span><span>{row.errorRequests}</span></div>)}</div></article>
      <article className={styles.card}><div className={styles.cardHeader}><div><span className={styles.eyebrow}>Letzte Events</span><h2>Keine Prompt- oder Antwortvolltexte gespeichert</h2></div></div><div className={styles.compactTable}><div className={styles.compactTableHead}><span>Zeit</span><span>Workspace</span><span>Feature</span><span>Status</span><span>Latenz</span></div>{summary.recentEvents.map((event) => <div className={styles.compactTableRow} key={event.id}><span>{date(event.created_at)}</span><span>{event.workspace_id}</span><span>{event.feature}<small>{event.model}</small></span><span>{event.status}{event.error_code ? ` · ${event.error_code}` : ""}</span><span>{event.latency_ms ?? "—"} ms</span></div>)}</div></article>
    </> : null}
    </div>
  </AdminBillingShell>;
}
