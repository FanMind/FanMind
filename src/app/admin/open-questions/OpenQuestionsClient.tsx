"use client";

import { useMemo, useState } from "react";
import { updateOpenQuestionStatus } from "./actions";
import styles from "./openQuestions.module.css";

export type OpenQuestionStatus = "open" | "in_review" | "resolved";

export type OpenQuestionClientRow = {
  id: string;
  topic: string;
  reason: string;
  status: OpenQuestionStatus;
  createdAt: string;
  reference: string;
};

export type OpenQuestionTopicStat = { topic: string; count: number };
export type OpenQuestionWorkspace = { id: string; name: string };

type Props = {
  workspaces: OpenQuestionWorkspace[];
  selectedWorkspaceId: string;
  questions: OpenQuestionClientRow[];
  topicStats: OpenQuestionTopicStat[];
  error?: string;
};

const STATUS_LABELS: Record<OpenQuestionStatus, string> = {
  open: "Offen",
  in_review: "In Prüfung",
  resolved: "Erledigt",
};

const REASON_LABELS: Record<string, string> = {
  assistant_uncertainty: "Fehlendes Wissen oder unsichere Antwort",
  knowledge_gap: "Fehlendes Wissen",
  provider_error: "Providerfehler",
};
const REVIEW_TIME_ZONE = "Europe/Zurich";

function reasonLabel(reason: string) {
  return REASON_LABELS[reason] ?? "Nicht beantwortet";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: REVIEW_TIME_ZONE,
  }).format(new Date(value));
}

function calendarDay(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: REVIEW_TIME_ZONE,
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return [values.year, values.month, values.day].join("-");
}

export function OpenQuestionsClient({
  workspaces,
  selectedWorkspaceId,
  questions,
  topicStats,
  error = "",
}: Props) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [status, setStatus] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const topics = useMemo(
    () => [...new Set(questions.map((question) => question.topic))].sort((left, right) => left.localeCompare(right, "de")),
    [questions],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("de");
    return questions.filter((question) => {
      const day = calendarDay(question.createdAt);
      const searchable = [question.topic, reasonLabel(question.reason), question.reference]
        .join(" ")
        .toLocaleLowerCase("de");
      return (!needle || searchable.includes(needle)) &&
        (topic === "all" || question.topic === topic) &&
        (status === "all" || question.status === status) &&
        (!fromDate || day >= fromDate) &&
        (!toDate || day <= toDate);
    });
  }, [fromDate, query, questions, status, toDate, topic]);

  function resetFilters() {
    setQuery("");
    setTopic("all");
    setStatus("all");
    setFromDate("");
    setToDate("");
  }

  return (
    <section className={styles.workspace} aria-label="Offene Supportfragen">
      <form className={styles.workspacePicker} method="get" action="/admin/open-questions">
        <label htmlFor="workspace">Workspace</label>
        <select id="workspace" name="workspace" defaultValue={selectedWorkspaceId} required>
          <option value="" disabled>Workspace auswählen</option>
          {workspaces.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
          ))}
        </select>
        <button type="submit">Auswählen</button>
      </form>

      {error ? <p className={styles.alert} role="alert">{error}</p> : null}
      {!selectedWorkspaceId && !error ? (
        <div className={styles.empty}>
          <h2>Workspace auswählen</h2>
          <p>Die Übersicht lädt Fragen erst nach einer bewussten Auswahl.</p>
        </div>
      ) : null}

      {selectedWorkspaceId && !error ? (
        <>
          <header className={styles.summaryBar}>
            <div>
              <span>Geladene Stichprobe</span>
              <strong>{questions.length}</strong>
              <small>maximal 100 neueste Einträge</small>
            </div>
            <div>
              <span>Offen</span>
              <strong>{questions.filter((question) => question.status === "open").length}</strong>
              <small>noch nicht geprüft</small>
            </div>
            <div>
              <span>In Prüfung</span>
              <strong>{questions.filter((question) => question.status === "in_review").length}</strong>
              <small>menschliche Bearbeitung</small>
            </div>
          </header>

          <section className={styles.topicStrip} aria-label="Häufigste offene Themen">
            <div>
              <h2>Häufigste offene Themen</h2>
              <p>Nur feste, redigierte Themenlabels im ausgewählten Workspace.</p>
            </div>
            <ol>
              {topicStats.slice(0, 5).map((item) => (
                <li key={item.topic}><span>{item.topic}</span><strong>{item.count}</strong></li>
              ))}
            </ol>
          </section>

          <section className={styles.filterSection} aria-labelledby="filter-title">
            <div className={styles.sectionHeading}>
              <div>
                <h2 id="filter-title">Fragen prüfen</h2>
                <p>{filtered.length} von {questions.length} Einträgen sichtbar</p>
              </div>
              <button className={styles.resetButton} type="button" onClick={resetFilters}>Filter zurücksetzen</button>
            </div>
            <div className={styles.filters}>
              <label>Suche<input aria-label="Suche" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Thema, Ursache oder Referenz" /></label>
              <label>Thema<select aria-label="Thema" value={topic} onChange={(event) => setTopic(event.target.value)}><option value="all">Alle Themen</option>{topics.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label>Status<select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Alle Status</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Von<input aria-label="Von" type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></label>
              <label>Bis<input aria-label="Bis" type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label>
            </div>
          </section>

          <div className={styles.questionList} aria-live="polite">
            {filtered.map((question) => (
              <details className={styles.question} key={question.id}>
                <summary>
                  <span className={styles.questionTopic}>{question.topic}</span>
                  <span className={styles.questionDate}>{formatDate(question.createdAt)}</span>
                  <span className={styles.status} data-status={question.status}>{STATUS_LABELS[question.status]}</span>
                </summary>
                <div className={styles.detailBody}>
                  <dl>
                    <div><dt>Ursache</dt><dd>{reasonLabel(question.reason)}</dd></div>
                    <div><dt>Interne Referenz</dt><dd>{question.reference}</dd></div>
                    <div><dt>Themenhäufigkeit</dt><dd>{topicStats.find((item) => item.topic === question.topic)?.count ?? 0}</dd></div>
                  </dl>
                  <form action={updateOpenQuestionStatus} className={styles.statusForm}>
                    <input type="hidden" name="workspace" value={selectedWorkspaceId} />
                    <input type="hidden" name="id" value={question.id} />
                    <label htmlFor={"status-" + question.id}>Bearbeitungsstatus</label>
                    <select id={"status-" + question.id} name="status" defaultValue={question.status}>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <button type="submit">Status speichern</button>
                  </form>
                </div>
              </details>
            ))}
            {filtered.length === 0 ? <div className={styles.empty}><h2>Keine Treffer</h2><p>Filter anpassen oder zurücksetzen.</p></div> : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
