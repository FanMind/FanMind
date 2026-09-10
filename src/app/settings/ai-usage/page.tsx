import { CreatorSettings } from "./CreatorSettings";
import Link from "next/link";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { isPlatformAdminEmail } from "@/lib/admin";
import { isWorkspaceBillingSuspended } from "@/lib/billing";
import { getCommercialOptionLabel } from "@/lib/dashboardFeatures";
import { getPreActivationRedirect } from "@/lib/preActivation";
import {
  getOpenFollowupCount,
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
  getWorkspaceContacts,
  signOutSupabaseServerSession,
} from "@/lib/supabase/server";
import {
  getWorkspaceAiUsageSummary,
  type WorkspaceAiUsageFeatureSummary,
  type WorkspaceAiUsageIndicator,
} from "@/lib/workspaceAiUsage";
import { getWorkspaceNavigation } from "@/lib/workspaceNavigation";
import { AccountTabs } from "../AccountTabs";
import { resolveWorkspaceLocale } from "@/lib/workspaceLocale";
import { getWorkspaceKpiStatsFromContacts } from "@/lib/workspaceKpiStats";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import dashboardStyles from "../../dashboard/dashboard.module.css";
import { AiPromptSettings } from "./AiPromptSettings";
import styles from "./ai-usage.module.css";

async function logout() {
  "use server";
  await signOutSupabaseServerSession();
  redirect("/");
}

const FEATURE_LABELS: Record<string, { de: string; en: string }> = {
  reply_suggestions: { de: "Antwortvorschläge", en: "Reply suggestions" },
  fan_analysis: { de: "Kommunikationsübersicht", en: "Communication overview" },
  conversation_summary: { de: "Gesprächszusammenfassung", en: "Conversation summary" },
  memory_suggestion: { de: "Kontaktwissen-Vorschlag", en: "Contact knowledge suggestion" },
  followup_suggestion: { de: "Follow-up-Vorschlag", en: "Follow-up suggestion" },
  campaign_draft_preview: { de: "Kampagnenentwurf (Vorschau)", en: "Campaign draft (preview)" },
};

function text(locale: FanMindLanguage, de: string, en: string): string {
  return locale === "en" ? en : de;
}

function formatNumber(value: number, locale: FanMindLanguage): string {
  return Math.round(value).toLocaleString(locale === "en" ? "en-US" : "de-DE");
}

function formatDateTime(value: string, locale: FanMindLanguage): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale === "en" ? "en-US" : "de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatPeriod(start: string, end: string, locale: FanMindLanguage): string {
  const formatter = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "de-DE", {
    dateStyle: "medium",
  });
  return `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`;
}

function featureLabel(feature: string, locale: FanMindLanguage): string {
  const labels = FEATURE_LABELS[feature];
  if (labels) return locale === "en" ? labels.en : labels.de;
  return feature.replaceAll("_", " ");
}

function statusLabel(status: string, locale: FanMindLanguage): string {
  if (status === "ok") return text(locale, "Erfolgreich", "Successful");
  if (status === "error") return text(locale, "Fehler", "Error");
  return text(locale, "Übersprungen", "Skipped");
}

function indicatorCopy(
  indicator: WorkspaceAiUsageIndicator,
  locale: FanMindLanguage,
): { title: string; body: string; chip: string } {
  if (!indicator.configured) {
    return {
      title: text(locale, "Messung aktiv", "Measurement active"),
      body: text(
        locale,
        "FanMind protokolliert die KI-Nutzung transparent. Für KI Standard ist derzeit weder ein vertragliches Kontingent noch eine automatische Sperre aktiviert.",
        "FanMind records AI usage transparently. AI Standard currently has neither a contractual quota nor an automatic block enabled.",
      ),
      chip: text(locale, "Keine Sperre", "No block"),
    };
  }
  if (indicator.level === "attention") {
    return {
      title: text(locale, "Hinweisgrenze erreicht", "Notice threshold reached"),
      body: text(
        locale,
        "Mindestens eine konfigurierte Soft-Hinweisgrenze wurde erreicht. Die KI bleibt nutzbar; dies ist keine automatische Sperre oder Nachberechnung.",
        "At least one configured soft notice threshold has been reached. AI remains available; this is not an automatic block or charge.",
      ),
      chip: text(locale, "Hinweis", "Notice"),
    };
  }
  if (indicator.level === "warning") {
    return {
      title: text(locale, "Hinweisgrenze nähert sich", "Approaching notice threshold"),
      body: text(
        locale,
        "Die Nutzung liegt bei mindestens 80 % einer konfigurierten Soft-Hinweisgrenze. Es erfolgt keine automatische Sperre.",
        "Usage is at least 80% of a configured soft notice threshold. No automatic block is applied.",
      ),
      chip: text(locale, "Beobachten", "Monitor"),
    };
  }
  return {
    title: text(locale, "Nutzung im normalen Bereich", "Usage in normal range"),
    body: text(
      locale,
      "Die Nutzung liegt unter den konfigurierten Soft-Hinweisgrenzen. Diese Werte dienen nur der Transparenz und sind keine harte Kontingentgrenze.",
      "Usage is below the configured soft notice thresholds. These values are for transparency only and are not a hard quota.",
    ),
    chip: text(locale, "Normal", "Normal"),
  };
}

function featureRows(
  rows: WorkspaceAiUsageFeatureSummary[],
  locale: FanMindLanguage,
) {
  return rows.map((row) => (
    <tr key={row.feature}>
      <td><strong>{featureLabel(row.feature, locale)}</strong></td>
      <td>{formatNumber(row.requests, locale)}</td>
      <td>{formatNumber(row.successfulRequests, locale)}</td>
      <td>{formatNumber(row.errorRequests, locale)}</td>
      <td>{formatNumber(row.estimatedTokens, locale)}</td>
    </tr>
  ));
}

export default async function AiUsageSettingsPage() {
  const { data } = await getSupabaseServerUser();
  if (!data.user) redirect("/login");

  const locale = await resolveWorkspaceLocale({ user: data.user });
  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  if (workspaceResult.error?.message === "TEMPORARY_DEMO_DELETED") {
    redirect("/login?demo_deleted=1");
  }

  const workspace = workspaceResult.workspace;
  if (!workspace) redirect("/dashboard");

  const preActivationRedirect = getPreActivationRedirect(workspace, data.user.email);
  if (preActivationRedirect) redirect(preActivationRedirect);
  if (isWorkspaceBillingSuspended(workspace)) redirect("/billing/suspended");

  const [contactsResult, followupResult, usageResult] = await Promise.all([
    getWorkspaceContacts(workspace.id),
    getOpenFollowupCount(workspace.id),
    getWorkspaceAiUsageSummary(workspace.id),
  ]);

  const contactCount = getWorkspaceKpiStatsFromContacts(
    contactsResult.contacts ?? [],
  ).totalFans;
  const { mainNavigation, settingsNavigation, savedViews } =
    getWorkspaceNavigation(
      "aiUsage",
      locale,
      followupResult.count ?? 0,
      isPlatformAdminEmail(data.user.email),
    );
  const displayName =
    typeof data.user.user_metadata?.display_name === "string" &&
    data.user.user_metadata.display_name.trim()
      ? data.user.user_metadata.display_name.trim()
      : data.user.email || workspace.name;
  const summary = usageResult.summary;
  const indicator = summary?.indicator;
  const indicatorText = indicator
    ? indicatorCopy(indicator, locale)
    : null;

  return (
    <main className={dashboardStyles.page}>
      <WorkspaceShell
        workspaceName={workspace.name}
        userLabel={displayName}
        planLabel={workspace.plan_id}
        planMeta={getCommercialOptionLabel(workspace.commercial_option)}
        planStatus={workspace.billing_status ?? "—"}
        mainNavigation={mainNavigation}
        settingsNavigation={settingsNavigation}
        savedViews={savedViews}
        header={{
          title: text(locale, "KI-Nutzung", "AI usage"),
          subtitle: text(
            locale,
            "Transparente Monatsübersicht für KI-Aktionen und geschätzte Tokens.",
            "Transparent monthly overview of AI actions and estimated tokens.",
          ),
          searchPlaceholder: text(
            locale,
            "Fans und Nachrichten suchen ...",
            "Search contacts and messages ...",
          ),
          primaryActionLabel: text(locale, "Zum Paket", "Package"),
          primaryActionHref: "/settings/package",
        }}
        contactCount={contactCount}
        openFollowupCount={followupResult.count ?? 0}
        logoutAction={logout}
        locale={locale}
      >
        <div className={styles.stack}>
          <AccountTabs activePage="aiUsage" locale={locale} />

          <CreatorSettings locale={locale} />
          <AiPromptSettings locale={locale} />

          {usageResult.error || !summary || !indicator || !indicatorText ? (
            <section className={styles.noticeCard} aria-labelledby="ai-usage-unavailable-title">
              <div>
                <p className={styles.eyebrow}>{text(locale, "KI-Nutzung", "AI usage")}</p>
                <h2 id="ai-usage-unavailable-title">{text(locale, "Auswertung momentan nicht verfügbar", "Usage summary currently unavailable")}</h2>
                <p>{usageResult.error ?? text(locale, "Es liegen noch keine auswertbaren KI-Nutzungsdaten vor.", "No evaluable AI usage data is available yet.")}</p>
              </div>
            </section>
          ) : (
            <>
              <section className={styles.hero} aria-labelledby="ai-usage-title">
                <div>
                  <p className={styles.eyebrow}>{text(locale, "Aktueller Kalendermonat", "Current calendar month")}</p>
                  <h2 id="ai-usage-title">{indicatorText.title}</h2>
                  <p>{indicatorText.body}</p>
                  <small>{formatPeriod(summary.periodStart, summary.periodEnd, locale)}</small>
                </div>
                <span className={indicator.level === "attention" ? styles.statusAttention : indicator.level === "warning" ? styles.statusWarning : styles.statusNormal}>
                  {indicatorText.chip}
                </span>
              </section>

              <section className={styles.metricGrid} aria-label={text(locale, "KI-Nutzungskennzahlen", "AI usage metrics")}>
                <article className={styles.metricCard}>
                  <span>{text(locale, "KI-Aktionen", "AI actions")}</span>
                  <strong>{formatNumber(summary.totalRequests, locale)}</strong>
                  <small>{text(locale, "Alle protokollierten Aufrufe", "All recorded calls")}</small>
                </article>
                <article className={styles.metricCard}>
                  <span>{text(locale, "Erfolgreich", "Successful")}</span>
                  <strong>{formatNumber(summary.successfulRequests, locale)}</strong>
                  <small>{text(locale, "Antworten ohne Fehlerstatus", "Responses without error status")}</small>
                </article>
                <article className={styles.metricCard}>
                  <span>{text(locale, "Fehler", "Errors")}</span>
                  <strong>{formatNumber(summary.errorRequests, locale)}</strong>
                  <small>{text(locale, "Technisch protokollierte Fehler", "Technically recorded errors")}</small>
                </article>
                <article className={styles.metricCard}>
                  <span>{text(locale, "Geschätzte Tokens", "Estimated tokens")}</span>
                  <strong>{formatNumber(summary.estimatedTotalTokens, locale)}</strong>
                  <small>{text(locale, "Eingabe und Ausgabe zusammen", "Input and output combined")}</small>
                </article>
              </section>

              <section className={styles.thresholdCard} aria-labelledby="ai-threshold-title">
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.eyebrow}>{text(locale, "Transparenz", "Transparency")}</p>
                    <h3 id="ai-threshold-title">{text(locale, "Soft-Hinweisgrenzen", "Soft notice thresholds")}</h3>
                  </div>
                  <span>{indicator.configured ? `${indicator.usagePercent ?? 0} %` : text(locale, "Nicht festgelegt", "Not configured")}</span>
                </div>
                {indicator.configured ? (
                  <div className={styles.progressTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={indicator.usagePercent ?? 0}>
                    <div className={styles.progressValue} style={{ width: `${indicator.usagePercent ?? 0}%` }} />
                  </div>
                ) : null}
                <dl className={styles.thresholdGrid}>
                  <div>
                    <dt>{text(locale, "Aktionen-Hinweis", "Action notice")}</dt>
                    <dd>{indicator.requestWarning ? formatNumber(indicator.requestWarning, locale) : text(locale, "Nicht festgelegt", "Not configured")}</dd>
                  </div>
                  <div>
                    <dt>{text(locale, "Token-Hinweis", "Token notice")}</dt>
                    <dd>{indicator.tokenWarning ? formatNumber(indicator.tokenWarning, locale) : text(locale, "Nicht festgelegt", "Not configured")}</dd>
                  </div>
                  <div>
                    <dt>{text(locale, "Geschätzte Eingabetokens", "Estimated input tokens")}</dt>
                    <dd>{formatNumber(summary.estimatedInputTokens, locale)}</dd>
                  </div>
                  <div>
                    <dt>{text(locale, "Geschätzte Ausgabetokens", "Estimated output tokens")}</dt>
                    <dd>{formatNumber(summary.estimatedOutputTokens, locale)}</dd>
                  </div>
                </dl>
                <p className={styles.disclaimer}>
                  {text(
                    locale,
                    "Hinweisgrenzen dienen ausschließlich der Orientierung. Sie sind keine harte Kontingentgrenze, lösen keine automatische Sperre aus und verändern keine Rechnung.",
                    "Notice thresholds are for orientation only. They are not a hard quota, do not trigger an automatic block and do not change billing.",
                  )}
                </p>
              </section>

              <section className={styles.tableCard} aria-labelledby="ai-feature-title">
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.eyebrow}>{text(locale, "Aufteilung", "Breakdown")}</p>
                    <h3 id="ai-feature-title">{text(locale, "Nutzung nach Funktion", "Usage by feature")}</h3>
                  </div>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>{text(locale, "Funktion", "Feature")}</th>
                        <th>{text(locale, "Aktionen", "Actions")}</th>
                        <th>{text(locale, "Erfolgreich", "Successful")}</th>
                        <th>{text(locale, "Fehler", "Errors")}</th>
                        <th>{text(locale, "Tokens geschätzt", "Estimated tokens")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.byFeature.length ? featureRows(summary.byFeature, locale) : (
                        <tr><td colSpan={5}>{text(locale, "In diesem Monat wurden noch keine KI-Aktionen protokolliert.", "No AI actions have been recorded this month.")}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className={styles.tableCard} aria-labelledby="ai-recent-title">
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.eyebrow}>{text(locale, "Letzte Ereignisse", "Recent events")}</p>
                    <h3 id="ai-recent-title">{text(locale, "Aktuelle KI-Aktivität", "Recent AI activity")}</h3>
                  </div>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>{text(locale, "Zeitpunkt", "Time")}</th>
                        <th>{text(locale, "Funktion", "Feature")}</th>
                        <th>{text(locale, "Status", "Status")}</th>
                        <th>{text(locale, "Tokens geschätzt", "Estimated tokens")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.recentEvents.length ? summary.recentEvents.map((event) => (
                        <tr key={event.id}>
                          <td>{formatDateTime(event.created_at, locale)}</td>
                          <td><strong>{featureLabel(event.feature, locale)}</strong></td>
                          <td><span className={event.status === "error" ? styles.eventError : event.status === "ok" ? styles.eventOk : styles.eventSkipped}>{statusLabel(event.status, locale)}</span></td>
                          <td>{formatNumber(event.estimated_total_tokens, locale)}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={4}>{text(locale, "Noch keine Ereignisse vorhanden.", "No events yet.")}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {summary.truncated ? (
                  <p className={styles.disclaimer}>{text(locale, "Die Monatsauswertung wurde bei 10.000 Ereignissen begrenzt. Für Detailauswertungen kontaktiere bitte FanMind.", "The monthly summary was capped at 10,000 events. Contact FanMind for a detailed export.")}</p>
                ) : null}
              </section>

              <section className={styles.noticeCard} aria-labelledby="ai-plan-title">
                <div>
                  <p className={styles.eyebrow}>{text(locale, "Paketlogik", "Package logic")}</p>
                  <h3 id="ai-plan-title">{text(locale, "KI Standard ist enthalten", "AI Standard is included")}</h3>
                  <p>{text(locale, "KI Plus und KI Ultra bleiben bis zur Freigabe von Preisen, Modellklassen, Kontingenten und Billing als Coming Soon gekennzeichnet. Für alle Stufen gilt: FanMind sendet nicht automatisch; der Mensch prüft und sendet final selbst.", "AI Plus and AI Ultra remain marked Coming Soon until pricing, model classes, quotas and billing are approved. For every tier, FanMind does not send automatically; a human reviews and sends the final message.")}</p>
                </div>
                <Link className={styles.packageLink} href="/settings/package">{text(locale, "Paket ansehen", "View package")}</Link>
              </section>
            </>
          )}
        </div>
      </WorkspaceShell>
    </main>
  );
}
