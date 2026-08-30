"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import { wt } from "@/lib/workspaceCopy";
import type {
  ContactRow,
  FanAnalysisReportRow,
  FollowupRow,
  MemoryRow,
} from "@/lib/supabase/server";
import dashboardStyles from "../../dashboard/dashboard.module.css";
import {
  saveContactInternalNotes,
  saveManualFollowup,
  saveManualMemory,
} from "../actions";
import {
  deleteManualFollowup,
  deleteManualMemory,
  updateManualMemory,
} from "./contextActions";
import { FollowupStatusForm } from "@/app/followups/FollowupStatusForm";
import { FanAnalysisReport } from "./FanAnalysisReport";
import styles from "./fan-detail.module.css";
import polishStyles from "./fan-context-polish.module.css";

type ContextTab = "notes" | "knowledge" | "followups" | "analysis";

type Props = {
  contact: ContactRow;
  memories: MemoryRow[];
  memoriesError?: string;
  followups: FollowupRow[];
  report: FanAnalysisReportRow | null;
  reportError?: string;
  hasNewMessages: boolean;
  storedMessageCount: number;
  locale: FanMindLanguage;
  readOnly: boolean;
  analysisGenerationEnabled: boolean;
  analysisGenerationError?: string;
};

const tabs: Array<{ id: ContextTab; de: string; en: string }> = [
  { id: "notes", de: "Notizen", en: "Notes" },
  { id: "knowledge", de: "Kontaktwissen", en: "Contact knowledge" },
  { id: "followups", de: "Follow-ups", en: "Follow-ups" },
  { id: "analysis", de: "Analyse", en: "Analysis" },
];

export function FanContextPanel({
  contact,
  memories,
  memoriesError,
  followups,
  report,
  reportError,
  hasNewMessages,
  storedMessageCount,
  locale,
  readOnly,
  analysisGenerationEnabled,
  analysisGenerationError,
}: Props) {
  const [activeTab, setActiveTab] = useState<ContextTab>(() => {
    if (typeof window === "undefined") return "notes";
    if (window.location.hash === "#followups") return "followups";
    if (window.location.hash === "#contact-knowledge") return "knowledge";
    return "notes";
  });

  const activeLabel =
    tabs.find((tab) => tab.id === activeTab)?.[
      locale === "en" ? "en" : "de"
    ] ?? "";

  return (
    <section
      className={styles.contextPanel}
      aria-label={locale === "en" ? "Contact context" : "Kontaktkontext"}
    >
      <nav
        className={styles.contextTabs}
        aria-label={locale === "en" ? "Context tabs" : "Kontext-Reiter"}
      >
        {tabs.map((tab) => {
          const label = locale === "en" ? tab.en : tab.de;
          return (
            <button
              aria-controls={`context-${tab.id}`}
              aria-selected={activeTab === tab.id}
              className={
                activeTab === tab.id
                  ? styles.contextTabActive
                  : styles.contextTab
              }
              id={`context-tab-${tab.id}`}
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === "followups") {
                  history.replaceState(null, "", "#followups");
                } else if (tab.id === "knowledge") {
                  history.replaceState(null, "", "#contact-knowledge");
                } else {
                  history.replaceState(null, "", window.location.pathname);
                }
              }}
              role="tab"
              type="button"
            >
              {label}
            </button>
          );
        })}
      </nav>
      <div
        className={styles.contextBody}
        id={
          activeTab === "followups"
            ? "followups"
            : activeTab === "knowledge"
              ? "contact-knowledge"
              : undefined
        }
      >
        <div
          aria-labelledby={`context-tab-${activeTab}`}
          id={`context-${activeTab}`}
          role="tabpanel"
        >
          <p className={dashboardStyles.eyebrow}>{activeLabel}</p>
          {activeTab === "notes" ? (
            <FanNotesCard contact={contact} locale={locale} readOnly={readOnly} />
          ) : null}
          {activeTab === "knowledge" ? (
            <ContactKnowledgeCard
              contactId={contact.id}
              memories={memories}
              memoriesError={memoriesError}
              locale={locale}
              readOnly={readOnly}
            />
          ) : null}
          {activeTab === "followups" ? (
            <ManualFollowupCard
              contactId={contact.id}
              followups={followups}
              locale={locale}
              readOnly={readOnly}
            />
          ) : null}
          {activeTab === "analysis" ? (
            <div className={styles.analysisScrollArea}>
              <FanAnalysisReport
                contactId={contact.id}
                initialReport={report}
                loadError={reportError ?? memoriesError}
                locale={locale}
                hasNewMessages={hasNewMessages}
                storedMessageCount={storedMessageCount}
                readOnly={readOnly}
                generationEnabled={analysisGenerationEnabled}
                generationError={analysisGenerationError}
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PanelCard({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <article className={styles.contextCard}>
      <div className={styles.cardHeader}>
        <div>
          <h3>{title}</h3>
          <p className={styles.reportIntro}>{intro}</p>
        </div>
      </div>
      {children}
    </article>
  );
}

function FanNotesCard({
  contact,
  locale,
  readOnly,
}: {
  contact: ContactRow;
  locale: FanMindLanguage;
  readOnly: boolean;
}) {
  return (
    <PanelCard
      title={wt(locale, "Notizen")}
      intro={
        locale === "en"
          ? "Internal team notes for this contact."
          : "Interne Team-Notizen zu diesem Kontakt."
      }
    >
      {readOnly ? (
        <p className={styles.reportIntro} style={{ whiteSpace: "pre-wrap" }}>
          {contact.internal_notes?.trim() ||
            (locale === "en" ? "No internal notes saved." : "Keine internen Notizen gespeichert.")}
        </p>
      ) : (
        <form action={saveContactInternalNotes} className={styles.notesForm}>
        <input name="contact_id" type="hidden" value={contact.id} />
        <input name="lang" type="hidden" value={locale} />
        <textarea
          aria-label={
            locale === "en"
              ? "Internal notes for this contact"
              : "Interne Notizen zu diesem Kontakt"
          }
          defaultValue={contact.internal_notes ?? ""}
          maxLength={8000}
          name="internal_notes"
          placeholder={
            locale === "en"
              ? "Notes, context, team hints …"
              : "Notizen, Kontext und Team-Hinweise …"
          }
        />
        <div className={styles.replyFooter}>
          <button className={dashboardStyles.primaryButton} type="submit">
            {wt(locale, "Notizen speichern")}
          </button>
        </div>
        </form>
      )}
    </PanelCard>
  );
}

function ContactKnowledgeCard({
  contactId,
  memories,
  memoriesError,
  locale,
  readOnly,
}: {
  contactId: string;
  memories: MemoryRow[];
  memoriesError?: string;
  locale: FanMindLanguage;
  readOnly: boolean;
}) {
  return (
    <PanelCard
      title={locale === "en" ? "Contact knowledge" : "Kontaktwissen"}
      intro={
        locale === "en"
          ? "Verified facts, preferences, and commitments that may be used for future suggestions."
          : "Geprüfte Fakten, Vorlieben und Zusagen, die FanMind bei künftigen Vorschlägen berücksichtigen darf."
      }
    >
      {readOnly ? null : (
        <DisclosureButton
          label={
            locale === "en"
              ? "+ Add contact knowledge"
              : "+ Kontaktwissen hinzufügen"
          }
        >
        <form action={saveManualMemory} className={styles.manualActionForm}>
          <input name="contact_id" type="hidden" value={contactId} />
          <input name="lang" type="hidden" value={locale} />
          <textarea
            maxLength={4000}
            name="content"
            required
            placeholder={
              locale === "en"
                ? "What should FanMind remember?"
                : "Was soll FanMind zu diesem Kontakt wissen?"
            }
          />
          <div className={styles.formRow}>
            <select
              name="importance"
              defaultValue="normal"
              aria-label={locale === "en" ? "Importance" : "Wichtigkeit"}
            >
              <option value="low">
                {locale === "en" ? "Low" : "Niedrig"}
              </option>
              <option value="normal">
                {locale === "en" ? "Medium" : "Mittel"}
              </option>
              <option value="high">
                {locale === "en" ? "High" : "Hoch"}
              </option>
            </select>
            <select
              name="type"
              defaultValue="note"
              aria-label={locale === "en" ? "Type" : "Art"}
            >
              <option value="note">
                {locale === "en" ? "Note" : "Hinweis"}
              </option>
              <option value="preference">
                {locale === "en" ? "Preference" : "Vorliebe"}
              </option>
              <option value="promise">
                {locale === "en" ? "Commitment" : "Zusage"}
              </option>
            </select>
          </div>
          <button className={dashboardStyles.secondaryButton} type="submit">
            {locale === "en"
              ? "Save contact knowledge"
              : "Kontaktwissen speichern"}
          </button>
        </form>
        </DisclosureButton>
      )}
      {memoriesError ? (
        <p className={dashboardStyles.error}>
          <strong>
            {locale === "en"
              ? "Contact knowledge could not be loaded."
              : "Kontaktwissen konnte nicht geladen werden."}
          </strong>
          <span>{memoriesError}</span>
        </p>
      ) : null}
      <ContactKnowledgeList
        contactId={contactId}
        memories={memories}
        locale={locale}
        readOnly={readOnly}
      />
    </PanelCard>
  );
}

function ContactKnowledgeList({
  contactId,
  memories,
  locale,
  readOnly,
}: {
  contactId: string;
  memories: MemoryRow[];
  locale: FanMindLanguage;
  readOnly: boolean;
}) {
  if (!memories.length) {
    return (
      <p className={styles.muted}>
        {locale === "en"
          ? "No contact knowledge saved yet."
          : "Noch kein Kontaktwissen gespeichert."}
      </p>
    );
  }

  return (
    <div className={polishStyles.knowledgeList}>
      {memories.map((memory) => (
        <article className={polishStyles.knowledgeItem} key={memory.id}>
          <div className={polishStyles.knowledgeHeader}>
            <div className={polishStyles.badgeRow}>
              <span className={polishStyles.badge}>
                {memoryTypeLabel(memory.type, locale)}
              </span>
              <span className={polishStyles.badge}>
                {importanceLabel(memory.importance, locale)}
              </span>
            </div>
            <small className={polishStyles.compactHint}>
              {formatDate(memory.created_at, locale)}
            </small>
          </div>
          <p className={polishStyles.knowledgeContent}>{memory.content}</p>
          {readOnly ? null : (
            <div className={polishStyles.itemActions}>
            <details className={polishStyles.itemEditor}>
              <summary>
                {locale === "en" ? "Edit" : "Bearbeiten"}
              </summary>
              <form
                action={updateManualMemory}
                className={polishStyles.editorForm}
              >
                <input name="contact_id" type="hidden" value={contactId} />
                <input name="memory_id" type="hidden" value={memory.id} />
                <input name="lang" type="hidden" value={locale} />
                <textarea
                  defaultValue={memory.content}
                  maxLength={4000}
                  name="content"
                  required
                />
                <div className={polishStyles.editorGrid}>
                  <select
                    defaultValue={normalizeImportance(memory.importance)}
                    name="importance"
                    aria-label={
                      locale === "en" ? "Importance" : "Wichtigkeit"
                    }
                  >
                    <option value="low">
                      {locale === "en" ? "Low" : "Niedrig"}
                    </option>
                    <option value="normal">
                      {locale === "en" ? "Medium" : "Mittel"}
                    </option>
                    <option value="high">
                      {locale === "en" ? "High" : "Hoch"}
                    </option>
                  </select>
                  <select
                    defaultValue={normalizeMemoryType(memory.type)}
                    name="type"
                    aria-label={locale === "en" ? "Type" : "Art"}
                  >
                    <option value="note">
                      {locale === "en" ? "Note" : "Hinweis"}
                    </option>
                    <option value="preference">
                      {locale === "en" ? "Preference" : "Vorliebe"}
                    </option>
                    <option value="promise">
                      {locale === "en" ? "Commitment" : "Zusage"}
                    </option>
                  </select>
                </div>
                <button
                  className={dashboardStyles.secondaryButton}
                  type="submit"
                >
                  {locale === "en" ? "Save changes" : "Änderungen speichern"}
                </button>
              </form>
            </details>
            <form
              action={deleteManualMemory}
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                const confirmed = window.confirm(
                  locale === "en"
                    ? "Delete this contact knowledge entry?"
                    : "Diesen Eintrag aus dem Kontaktwissen löschen?",
                );
                if (!confirmed) event.preventDefault();
              }}
            >
              <input name="contact_id" type="hidden" value={contactId} />
              <input name="memory_id" type="hidden" value={memory.id} />
              <input name="lang" type="hidden" value={locale} />
              <button className={polishStyles.deleteButton} type="submit">
                {locale === "en" ? "Delete" : "Löschen"}
              </button>
            </form>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function ManualFollowupCard({
  contactId,
  followups,
  locale,
  readOnly,
}: {
  contactId: string;
  followups: FollowupRow[];
  locale: FanMindLanguage;
  readOnly: boolean;
}) {
  const sortedFollowups = useMemo(
    () =>
      [...followups].sort((a, b) =>
        (a.due_date ?? "9999-12-31").localeCompare(
          b.due_date ?? "9999-12-31",
        ),
      ),
    [followups],
  );

  return (
    <PanelCard
      title="Follow-ups"
      intro={
        locale === "en"
          ? "Open reminders and next steps for this contact."
          : "Offene Erinnerungen und nächste Schritte zu diesem Kontakt."
      }
    >
      {readOnly ? null : (
        <DisclosureButton
          label={locale === "en" ? "+ Add follow-up" : "+ Follow-up"}
        >
        <form action={saveManualFollowup} className={styles.manualActionForm}>
          <input name="contact_id" type="hidden" value={contactId} />
          <input name="lang" type="hidden" value={locale} />
          <input
            name="reason"
            required
            placeholder={locale === "en" ? "Task or reason" : "Aufgabe oder Grund"}
          />
          <div className={styles.formRow}>
            <input name="due_date" type="date" />
            <select
              name="priority"
              defaultValue="normal"
              aria-label={locale === "en" ? "Priority" : "Priorität"}
            >
              <option value="low">
                {locale === "en" ? "Low" : "Niedrig"}
              </option>
              <option value="normal">
                {locale === "en" ? "Medium" : "Mittel"}
              </option>
              <option value="high">
                {locale === "en" ? "High" : "Hoch"}
              </option>
            </select>
          </div>
          <button className={dashboardStyles.secondaryButton} type="submit">
            {locale === "en" ? "Save" : "Speichern"}
          </button>
        </form>
        </DisclosureButton>
      )}
      <CompactFollowupList
        contactId={contactId}
        followups={sortedFollowups}
        locale={locale}
        readOnly={readOnly}
      />
    </PanelCard>
  );
}

function DisclosureButton({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className={styles.inlineDisclosure}>
      <summary>{label}</summary>
      {children}
    </details>
  );
}

function CompactFollowupList({
  contactId,
  followups,
  locale,
  readOnly,
}: {
  contactId: string;
  followups: FollowupRow[];
  locale: FanMindLanguage;
  readOnly: boolean;
}) {
  return (
    <div className={polishStyles.knowledgeList}>
      {followups.length ? (
        followups.map((followup) => (
          <article className={polishStyles.knowledgeItem} key={followup.id}>
            <div className={polishStyles.badgeRow}>
              <span className={polishStyles.badge}>
                {followupStatusLabel(followup.status, locale)}
              </span>
              <span className={polishStyles.badge}>
                {importanceLabel(followup.priority, locale)}
              </span>
            </div>
            <p className={polishStyles.knowledgeContent}>{followup.reason}</p>
            <div className={polishStyles.knowledgeHeader}>
              <small className={polishStyles.compactHint}>
                {locale === "en" ? "Due" : "Fällig"}:{" "}
                {formatDate(followup.due_date, locale)}
              </small>
              {readOnly ? null : (
                <>
                  <FollowupStatusForm
                    contactId={contactId}
                    followup={followup}
                    locale={locale}
                    returnTo="contact"
                  />
                  <form
                    action={deleteManualFollowup}
                    onSubmit={(event: FormEvent<HTMLFormElement>) => {
                      const confirmed = window.confirm(
                        "Dieses Follow-up wirklich löschen?",
                      );
                      if (!confirmed) event.preventDefault();
                    }}
                  >
                    <input name="contact_id" type="hidden" value={contactId} />
                    <input name="followup_id" type="hidden" value={followup.id} />
                    <input name="lang" type="hidden" value={locale} />
                    <button className={polishStyles.deleteButton} type="submit">
                      {locale === "en" ? "Delete" : "Löschen"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </article>
        ))
      ) : (
        <p className={styles.muted}>
          {locale === "en" ? "No follow-ups yet." : "Noch keine Follow-ups."}
        </p>
      )}
    </div>
  );
}

function normalizeImportance(value: string | null): "low" | "normal" | "high" {
  if (value === "low" || value === "high") return value;
  return "normal";
}

function normalizeMemoryType(value: string | null): "note" | "preference" | "promise" {
  if (value === "preference" || value === "promise") return value;
  return "note";
}

function importanceLabel(value: string | null, locale: FanMindLanguage): string {
  if (value === "high") return locale === "en" ? "High" : "Hoch";
  if (value === "low") return locale === "en" ? "Low" : "Niedrig";
  return locale === "en" ? "Medium" : "Mittel";
}

function memoryTypeLabel(value: string | null, locale: FanMindLanguage): string {
  if (value === "preference") {
    return locale === "en" ? "Preference" : "Vorliebe";
  }
  if (value === "promise") {
    return locale === "en" ? "Commitment" : "Zusage";
  }
  return locale === "en" ? "Note" : "Hinweis";
}

function followupStatusLabel(value: string | null, locale: FanMindLanguage): string {
  if (value === "done") return locale === "en" ? "Done" : "Erledigt";
  if (value === "archived") return locale === "en" ? "Archived" : "Archiviert";
  return locale === "en" ? "Open" : "Offen";
}

function formatDate(value: string | null, locale: FanMindLanguage): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
