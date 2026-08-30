"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import dashboardStyles from "../../dashboard/dashboard.module.css";
import {
  analyzeFanCommunication,
  deleteFanCommunicationProfile,
  type FanAnalysisActionState,
} from "./analysisActions";
import styles from "./fan-detail.module.css";
import polishStyles from "./fan-context-polish.module.css";

type Report = {
  report_json: Record<string, unknown> | null;
  summary: string | null;
  source_message_count: number | null;
  source_from_at: string | null;
  source_to_at: string | null;
  confidence_score: number | null;
  review_status: "unreviewed" | "confirmed" | "corrected" | "rejected" | null;
  generated_at: string | null;
  updated_at?: string | null;
} | null;

type Props = {
  contactId: string;
  initialReport: Report;
  loadError?: string;
  locale?: FanMindLanguage;
  hasNewMessages?: boolean;
  storedMessageCount?: number;
  readOnly?: boolean;
};

type ReportSection = { title: string; content: string };
type AnalysisMode = "short" | "standard" | "detailed";

const initialState: FanAnalysisActionState = { ok: false, message: "" };

export function FanAnalysisReport({
  contactId,
  initialReport,
  loadError,
  locale = "de",
  hasNewMessages = false,
  storedMessageCount = 0,
  readOnly = false,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    analyzeFanCommunication,
    initialState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteFanCommunicationProfile,
    initialState,
  );
  const report = state.report ?? initialReport;
  const reportHasCompleteProvenance = hasCompleteReportProvenance(report);
  const rejectedReport = hasRejectedReportProvenance(report) ? report : null;
  const rejectedReportUpdatedAt =
    rejectedReport?.updated_at ?? rejectedReport?.generated_at ?? null;
  const displayReport = reportHasCompleteProvenance ? report : null;
  const effectiveMessageCount = displayReport?.source_message_count ?? storedMessageCount;
  const reportSections = buildStoredReportSections(displayReport, locale);
  const reportMode = getReportMode(displayReport);
  const [summarySection, ...detailSections] = reportSections;
  const isLowData = Boolean(displayReport) && effectiveMessageCount < 3;

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state.ok, state.generatedAt]);

  useEffect(() => {
    if (deleteState.ok) router.refresh();
  }, [deleteState.ok, router]);

  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <h3>
            {locale === "en"
              ? "Communication overview"
              : "Kommunikationsübersicht"}
          </h3>
          <p className={styles.reportIntro}>
            {locale === "en"
              ? "Practical, careful guidance from saved messages and contact knowledge."
              : "Kurze, vorsichtige Hinweise aus Nachrichten und Kontaktwissen."}
          </p>
        </div>
      </div>

      {readOnly ? null : (
        <form action={formAction} className={polishStyles.analysisForm}>
        <input name="contact_id" type="hidden" value={contactId} />
        <input name="locale" type="hidden" value={locale} />
        <div className={polishStyles.analysisControlRow}>
          <label>
            {locale === "en" ? "Depth" : "Tiefe"}
            <select defaultValue="short" name="analysis_mode">
              <option value="short">
                {locale === "en" ? "Short" : "Kurz"}
              </option>
              <option value="standard">Standard</option>
              <option value="detailed">
                {locale === "en" ? "Detailed" : "Ausführlich"}
              </option>
            </select>
          </label>
          <label>
            {locale === "en" ? "Additional instruction" : "Zusatzanweisung"}
            <input
              maxLength={500}
              name="analysis_instruction"
              placeholder={
                locale === "en"
                  ? "e.g. summarize in three lines"
                  : "z. B. in drei Zeilen zusammenfassen"
              }
            />
          </label>
        </div>
        <button
          className={dashboardStyles.secondaryButton}
          disabled={pending}
          type="submit"
        >
          {pending
            ? locale === "en"
              ? "Creating overview…"
              : "Übersicht wird erstellt…"
            : report
              ? locale === "en"
                ? "Update overview"
                : "Übersicht aktualisieren"
              : locale === "en"
                ? "Create overview"
                : "Übersicht erstellen"}
        </button>
        </form>
      )}

      <div aria-live="polite">
        {pending ? (
          <p className={styles.safeNotice}>
            {locale === "en"
              ? "The overview will appear after saving."
              : "Die Übersicht erscheint direkt nach dem Speichern."}
          </p>
        ) : null}
        {state.message ? (
          <p className={state.ok ? styles.safeNotice : dashboardStyles.error}>
            <strong>
              {state.ok
                ? locale === "en"
                  ? "Saved."
                  : "Gespeichert."
                : locale === "en"
                  ? "Could not create the overview."
                  : "Übersicht konnte nicht erstellt werden."}
            </strong>
            <span>{state.message}</span>
          </p>
        ) : null}
      </div>

      {report && !readOnly ? (
        <form action={deleteAction} className={polishStyles.analysisForm}>
          <input name="contact_id" type="hidden" value={contactId} />
          <input name="locale" type="hidden" value={locale} />
          <p className={styles.reportSafetyNote}>
            {locale === "en"
              ? "Delete only the derived profile; the authorized chat history remains available in its thread."
              : "Löscht nur das abgeleitete Profil; der autorisierte Chatverlauf bleibt im jeweiligen Thread erhalten."}
          </p>
          <button
            className={dashboardStyles.secondaryButton}
            disabled={deletePending}
            type="submit"
          >
            {deletePending
              ? locale === "en"
                ? "Deleting profile…"
                : "Profil wird gelöscht…"
              : locale === "en"
                ? "Delete communication profile"
                : "Kommunikationsprofil löschen"}
          </button>
          {deleteState.message ? (
            <p className={deleteState.ok ? styles.safeNotice : dashboardStyles.error}>
              {deleteState.message}
            </p>
          ) : null}
        </form>
      ) : null}

      {loadError ? (
        <p className={dashboardStyles.error}>
          <strong>
            {locale === "en"
              ? "The overview could not be loaded."
              : "Die Übersicht konnte nicht geladen werden."}
          </strong>
          <span>{loadError}</span>
        </p>
      ) : null}

      {rejectedReport ? (
        <p className={dashboardStyles.error}>
          {locale === "en"
            ? `This overview was rejected by a human reviewer. Its conclusions are hidden. Review: rejected · Updated: ${rejectedReportUpdatedAt ? formatDate(rejectedReportUpdatedAt, locale) : "not yet"}`
            : `Diese Übersicht wurde menschlich abgelehnt. Ihre Schlussfolgerungen werden nicht angezeigt. Prüfstatus: abgelehnt · Aktualisiert: ${rejectedReportUpdatedAt ? formatDate(rejectedReportUpdatedAt, locale) : "noch nicht"}`}
        </p>
      ) : null}

      {report && !reportHasCompleteProvenance && !rejectedReport ? (
        <p className={dashboardStyles.error}>
          {locale === "en"
            ? "This saved overview is not shown without a complete source period, confidence, and review status."
            : "Diese gespeicherte Übersicht wird ohne vollständigen Herkunftszeitraum, Konfidenz und Prüfstatus nicht angezeigt."}
        </p>
      ) : null}

      <div className={styles.reportSectionList}>
        {isLowData ? (
          <p className={polishStyles.compactHint}>
            {locale === "en"
              ? "Only a small amount of message context is available."
              : "Es ist erst wenig Nachrichtenkontext vorhanden."}
          </p>
        ) : null}

        {summarySection && displayReport ? (
          <>
            <section className={polishStyles.primarySummary}>
              <strong>{summarySection.title}</strong>
              <p>{summarySection.content}</p>
            </section>
            {detailSections.length ? (
              <details
                className={polishStyles.analysisDetails}
                open={reportMode !== "short"}
              >
                <summary>
                  {locale === "en" ? "Show details" : "Details anzeigen"}
                </summary>
                {detailSections.map((section) => (
                  <section className={styles.reportSection} key={section.title}>
                    <div className={styles.reportSectionHeader}>
                      <strong>{section.title}</strong>
                    </div>
                    <p>{section.content}</p>
                  </section>
                ))}
              </details>
            ) : null}
            {hasNewMessages ? (
              <p className={styles.safeNotice}>
                {locale === "en"
                  ? "New messages are available since the last overview."
                  : "Seit der letzten Übersicht sind neue Nachrichten vorhanden."}
              </p>
            ) : null}
            <p className={styles.muted}>
              {locale === "en" ? "Source" : "Quelle"}: {effectiveMessageCount}{" "}
              {locale === "en" ? "messages" : "Nachrichten"} ·{" "}
              {locale === "en" ? "Period" : "Zeitraum"}: {" "}
              {formatDate(displayReport.source_from_at, locale)} – {formatDate(displayReport.source_to_at, locale)} ·{" "}
              {locale === "en" ? "Confidence" : "Konfidenz"}: {displayReport.confidence_score}/100 ·{" "}
              {locale === "en" ? "Review" : "Prüfstatus"}: {formatReviewStatus(displayReport.review_status, locale)} ·{" "}
              {locale === "en" ? "Updated" : "Aktualisiert"}: {" "}
              {(displayReport.updated_at ?? displayReport.generated_at)
                ? formatDate(
                    (displayReport.updated_at ?? displayReport.generated_at) as string,
                    locale,
                  )
                : locale === "en"
                  ? "not yet"
                  : "noch nicht"}
            </p>
            <p className={styles.reportSafetyNote}>
              {locale === "en"
                ? "Communication guidance only: no diagnosis or sensitive inference."
                : "Nur Kommunikationshilfe: keine Diagnose und keine sensiblen Ableitungen."}
            </p>
          </>
        ) : rejectedReport || report || loadError ? null : (
          <EmptyState
            title={
              locale === "en"
                ? "No communication overview yet."
                : "Noch keine Kommunikationsübersicht vorhanden."
            }
            body={
              locale === "en"
                ? "Choose the depth and create an overview from saved messages and contact knowledge."
                : "Tiefe auswählen und eine Übersicht aus Nachrichten und Kontaktwissen erstellen."
            }
          />
        )}
      </div>
    </article>
  );
}

function hasCompleteReportProvenance(
  report: Report,
): report is NonNullable<Report> & {
  source_from_at: string;
  source_to_at: string;
  confidence_score: number;
  review_status: "unreviewed" | "confirmed" | "corrected";
} {
  return hasCompleteReportMetadata(report) && report.review_status !== "rejected";
}

function hasRejectedReportProvenance(
  report: Report,
): report is NonNullable<Report> & {
  source_from_at: string;
  source_to_at: string;
  confidence_score: number;
  review_status: "rejected";
} {
  return hasCompleteReportMetadata(report) && report.review_status === "rejected";
}

function hasCompleteReportMetadata(
  report: Report,
): report is NonNullable<Report> & {
  source_from_at: string;
  source_to_at: string;
  confidence_score: number;
  review_status: "unreviewed" | "confirmed" | "corrected" | "rejected";
} {
  if (!report?.source_from_at || !report.source_to_at) return false;
  const sourceFrom = Date.parse(report.source_from_at);
  const sourceTo = Date.parse(report.source_to_at);
  return (
    Number.isFinite(sourceFrom) &&
    Number.isFinite(sourceTo) &&
    sourceFrom <= sourceTo &&
    typeof report.confidence_score === "number" &&
    Number.isFinite(report.confidence_score) &&
    report.confidence_score >= 0 &&
    report.confidence_score <= 100 &&
    ["unreviewed", "confirmed", "corrected", "rejected"].includes(
      report.review_status ?? "",
    )
  );
}

function formatReviewStatus(
  value: NonNullable<Report>["review_status"],
  locale: FanMindLanguage,
) {
  const labels =
    locale === "en"
      ? { unreviewed: "unreviewed", confirmed: "confirmed", corrected: "corrected", rejected: "rejected" }
      : { unreviewed: "ungeprüft", confirmed: "bestätigt", corrected: "korrigiert", rejected: "abgelehnt" };
  return value ? labels[value] : locale === "en" ? "unavailable" : "nicht verfügbar";
}

function buildStoredReportSections(
  report: Report,
  locale: FanMindLanguage,
): ReportSection[] {
  if (!report?.report_json) return [];
  const values = normalizeReportJson(report.report_json);
  const neutral = getNeutralAnalysisTexts(locale);
  const titles =
    locale === "en"
      ? {
          summary: "Short summary",
          style: "Communication style",
          mood: "Current tone",
          interests: "Interests and relevant topics",
          reaction: "Response to offers",
          reply: "Recommended reply style",
          caution: "Caution",
        }
      : {
          summary: "Kurzfassung",
          style: "Kommunikationsstil",
          mood: "Aktuelle Tonlage",
          interests: "Interessen und relevante Themen",
          reaction: "Reaktion auf Angebote",
          reply: "Empfohlener Antwortstil",
          caution: "Vorsicht",
        };

  return [
    {
      title: titles.summary,
      content: readableValue(values.kurzprofil) || report.summary || neutral.kurzprofil,
    },
    {
      title: titles.style,
      content:
        readableValue(values.kommunikationsstil) || neutral.kommunikationsstil,
    },
    {
      title: titles.mood,
      content: readableValue(values.stimmung) || neutral.stimmung,
    },
    {
      title: titles.interests,
      content:
        readableValue(values.interessen_trigger) || neutral.interessen_trigger,
    },
    {
      title: titles.reaction,
      content: readableValue(values.kauf_reaktion) || neutral.kauf_reaktion,
    },
    {
      title: titles.reply,
      content: readableValue(values.antwortstil) || neutral.antwortstil,
    },
    {
      title: titles.caution,
      content: readableValue(values.no_gos) || neutral.no_gos,
    },
  ];
}

function getReportMode(report: Report): AnalysisMode {
  const value = report?.report_json?.analysis_mode;
  if (value === "short" || value === "detailed") return value;
  return "standard";
}

function normalizeReportJson(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const parsed = parseJsonLike(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : value;
}

function readableValue(value: unknown): string {
  const parsed = parseJsonLike(value);
  return collectReadableParts(parsed).join(", ").trim();
}

function parseJsonLike(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[{[]/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function collectReadableParts(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  if (Array.isArray(value)) return value.flatMap(collectReadableParts);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(
      collectReadableParts,
    );
  }
  return [];
}

function getNeutralAnalysisTexts(locale: FanMindLanguage) {
  if (locale === "en") {
    return {
      kurzprofil: "No reliable summary is available yet.",
      kommunikationsstil: "Keep communication friendly, concise, and respectful.",
      stimmung: "The current tone cannot be determined reliably.",
      interessen_trigger: "Use only explicitly documented interests and questions.",
      kauf_reaktion: "Do not predict a purchase; respond to the concrete request.",
      antwortstil: "Reply manually in a calm, helpful, pressure-free style.",
      no_gos: "Avoid diagnoses, sensitive inferences, pressure, and invented facts.",
    };
  }
  return {
    kurzprofil: "Noch keine belastbare Kurzfassung vorhanden.",
    kommunikationsstil: "Freundlich, knapp und respektvoll kommunizieren.",
    stimmung: "Die aktuelle Tonlage ist nicht zuverlässig bestimmbar.",
    interessen_trigger: "Nur ausdrücklich dokumentierte Interessen und Fragen nutzen.",
    kauf_reaktion: "Keine Kaufprognose; auf die konkrete Anfrage eingehen.",
    antwortstil: "Ruhig, hilfreich und ohne Druck manuell antworten.",
    no_gos: "Keine Diagnosen, sensiblen Ableitungen, Druck oder erfundenen Fakten.",
  };
}

function formatDate(value: string, locale: FanMindLanguage) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className={dashboardStyles.emptyState}>
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
    </div>
  );
}
