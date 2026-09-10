"use client";

import type { CreatorStrategy } from "@/lib/creatorIntelligencePolicy.mjs";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import { wt } from "@/lib/workspaceCopy";
import { saveSuggestedFollowup, saveSuggestedMemory } from "../actions";
import { OriginalChannelButton } from "./OriginalChannelButton";
import { CreatorFanReview } from "./CreatorFanReview";
import dashboardStyles from "../../dashboard/dashboard.module.css";
import styles from "./fan-detail.module.css";

export type ReplyMode = { id: string; label: string; prompt: string };

type PromptProfileOption = {
  id: string;
  name: string;
  isActive: boolean;
  isDefault: boolean;
};

type ReplySuggestion = { tone: string; label: string; text: string };
type SuggestedMemory = {
  content: string;
  importance: "low" | "normal" | "high";
};
type SuggestedFollowup = {
  recommended: boolean;
  in_days: number | null;
  reason: string;
};
type AiSuggestionsResult = {
  reply_options: ReplySuggestion[];
  suggested_memory?: SuggestedMemory;
  suggested_followup?: SuggestedFollowup;
  safety_note: string;
  creator_context?: { name: string; revision: number; strategy: CreatorStrategy };
};

type Props = {
  originalChannelAction?: { href: string | null; label: string };
  demoConnectionsDisabled?: boolean;
  telegramSendEnabled?: boolean;
  contact: {
    contactId: string;
    displayName: string;
    handle: string | null;
    sourcePlatform: string | null;
    language: string | null;
    status: string | null;
    tags: string[] | null;
    summary: string | null;
    latestInboundMessage?: string;
  };
  modes: ReplyMode[];
  locale?: FanMindLanguage;
};

export function AiReplySuggestions({
  contact,
  modes,
  originalChannelAction,
  demoConnectionsDisabled = false,
  telegramSendEnabled = false,
  locale = "de",
}: Props) {
  const router = useRouter();
  const [activeModeId, setActiveModeId] = useState(modes[0]?.id ?? "friendly");
  const activeMode = useMemo(
    () => modes.find((mode) => mode.id === activeModeId) ?? modes[0],
    [activeModeId, modes],
  );
  const [replyInstruction, setReplyInstruction] = useState("");
  const [promptProfiles, setPromptProfiles] = useState<PromptProfileOption[]>([]);
  const [selectedPromptProfileId, setSelectedPromptProfileId] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/ai/prompt-settings", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json().catch(() => null)) as {
          settings?: { profiles?: PromptProfileOption[] };
        } | null;
      })
      .then((data) => {
        if (!active) return;
        const profiles = (data?.settings?.profiles ?? []).filter(
          (profile) => profile.isActive,
        );
        setPromptProfiles(profiles);
        const preferred =
          profiles.find((profile) => profile.isDefault) ?? profiles[0];
        setSelectedPromptProfileId(preferred?.id ?? "");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const [suggestions, setSuggestions] = useState<AiSuggestionsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [telegramDraft, setTelegramDraft] = useState("");
  const [telegramSending, setTelegramSending] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState("");
  const [memoryDismissed, setMemoryDismissed] = useState(false);
  const [followupDismissed, setFollowupDismissed] = useState(false);
  const [memorySaving, setMemorySaving] = useState(false);
  const [followupSaving, setFollowupSaving] = useState(false);
  const [memoryStatus, setMemoryStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [followupStatus, setFollowupStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const canSendTelegram =
    telegramSendEnabled &&
    !demoConnectionsDisabled &&
    contact.sourcePlatform === "telegram";

  async function generateSuggestions(mode = activeMode) {
    if (!mode) return;
    setError("");
    setCopiedIndex(null);
    setMemoryDismissed(false);
    setFollowupDismissed(false);
    setMemoryStatus(null);
    setFollowupStatus(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/reply-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contact.contactId,
          responseMode: `${mode.label}: ${mode.prompt}`,
          responseInstruction: replyInstruction.trim(),
          promptProfileId: selectedPromptProfileId || undefined,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | AiSuggestionsResult
        | { error?: string }
        | null;

      if (!response.ok || !data || !("reply_options" in data)) {
        setError(
          (data && "error" in data && data.error) ||
            (locale === "en"
              ? "Reply suggestions could not be created."
              : "Antwortvorschläge konnten gerade nicht erzeugt werden."),
        );
        return;
      }

      const nextSuggestions = data.reply_options.slice(0, 3);
      setSuggestions({ ...data, reply_options: nextSuggestions });
      setTelegramDraft((current) => current || nextSuggestions[0]?.text || "");
    } catch {
      setError(
        locale === "en"
          ? "Reply suggestions could not be created."
          : "Antwortvorschläge konnten gerade nicht erzeugt werden.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function copySuggestion(text: string, index: number) {
    setError("");
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
    } catch {
      setCopiedIndex(index);
      setError(
        locale === "en"
          ? "Clipboard is unavailable. Please select and copy the suggestion manually."
          : "Clipboard ist nicht verfügbar. Bitte markiere und kopiere den Vorschlag manuell.",
      );
    }
  }

  const suggestedMemory = suggestions?.suggested_memory;
  const hasMemorySuggestion =
    Boolean(suggestedMemory?.content?.trim()) && !memoryDismissed;
  const suggestedFollowup = suggestions?.suggested_followup;
  const hasFollowupSuggestion =
    Boolean(
      suggestedFollowup?.recommended && suggestedFollowup.reason?.trim(),
    ) && !followupDismissed;
  const followupDateLabel = formatFollowupDate(
    suggestedFollowup?.in_days,
    locale,
  );

  async function saveMemorySuggestion() {
    if (!suggestedMemory?.content?.trim()) return;
    setMemorySaving(true);
    setMemoryStatus(null);
    try {
      const result = await saveSuggestedMemory({
        contactId: contact.contactId,
        content: suggestedMemory.content.trim(),
        importance: suggestedMemory.importance,
      });
      setMemoryStatus(
        result.ok
          ? {
              ok: true,
              message:
                locale === "en"
                  ? "Saved to contact knowledge."
                  : "Im Kontaktwissen gespeichert.",
            }
          : result,
      );
      if (result.ok) router.refresh();
    } catch {
      setMemoryStatus({
        ok: false,
        message:
          locale === "en"
            ? "Contact knowledge could not be saved."
            : "Kontaktwissen konnte nicht gespeichert werden.",
      });
    } finally {
      setMemorySaving(false);
    }
  }

  async function saveFollowupSuggestion() {
    if (!suggestedFollowup?.reason?.trim()) return;
    setFollowupSaving(true);
    setFollowupStatus(null);
    try {
      const result = await saveSuggestedFollowup({
        contactId: contact.contactId,
        reason: suggestedFollowup.reason.trim(),
        inDays: suggestedFollowup.in_days,
      });
      setFollowupStatus(result);
      if (result.ok) router.refresh();
    } catch {
      setFollowupStatus({
        ok: false,
        message:
          locale === "en"
            ? "Follow-up could not be saved."
            : "Follow-up konnte nicht gespeichert werden.",
      });
    } finally {
      setFollowupSaving(false);
    }
  }

  async function sendTelegramDraft() {
    setTelegramStatus("");
    setTelegramSending(true);
    try {
      const response = await fetch("/api/integrations/telegram/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contact.contactId,
          text: telegramDraft,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setTelegramStatus(
          data?.error ?? "Telegram-Nachricht konnte nicht gesendet werden.",
        );
        return;
      }
      setTelegramStatus(
        "Telegram-Nachricht wurde manuell gesendet und dokumentiert.",
      );
      setTelegramDraft("");
    } catch {
      setTelegramStatus("Telegram-Nachricht konnte nicht gesendet werden.");
    } finally {
      setTelegramSending(false);
    }
  }

  return (
    <article
      className={`${styles.card} ${styles.replyCard}`}
      aria-labelledby="ai-replies-title"
    >
      <div className={styles.cardHeader}>
        <div>
          <p className={dashboardStyles.eyebrow}>
            {wt(locale, "KI-Antwortvorschläge")}
          </p>
          <h3 id="ai-replies-title">
            {locale === "en" ? "Three distinct suggestions" : "Drei unterschiedliche Vorschläge"}
          </h3>
          <p className={styles.muted}>
            {locale === "en"
              ? "Choose a direction, add an instruction if needed, and copy the best draft."
              : "Richtung wählen, bei Bedarf eine Anweisung ergänzen und den passenden Entwurf kopieren."}
          </p>
        </div>
        <span className={styles.statusBadge}>
          {wt(locale, "Keine automatische Sendefunktion.").replace(/\.$/, "")}
        </span>
      </div>

      {!demoConnectionsDisabled ? <CreatorFanReview key={contact.contactId} contactId={contact.contactId} locale={locale} /> : null}
      <div className={styles.modeBar} aria-label="Antwort-Richtung wählen">
        {modes.map((mode) => (
          <button
            className={
              mode.id === activeModeId
                ? styles.modeButtonActive
                : styles.modeButton
            }
            key={mode.id}
            onClick={() => setActiveModeId(mode.id)}
            type="button"
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className={styles.promptProfileBar}>
        <label>
          <span>{locale === "en" ? "Company reply profile" : "Unternehmens-Antwortprofil"}</span>
          {promptProfiles.length ? (
            <select
              onChange={(event) => setSelectedPromptProfileId(event.target.value)}
              value={selectedPromptProfileId}
            >
              {promptProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}{profile.isDefault ? (locale === "en" ? " · Default" : " · Standard") : ""}
                </option>
              ))}
            </select>
          ) : (
            <small>{locale === "en" ? "No custom profile is active yet." : "Noch kein eigenes Profil aktiv."}</small>
          )}
        </label>
        <a href="/settings/ai-usage">
          {locale === "en" ? "Manage prompts" : "Prompts verwalten"}
        </a>
      </div>

      <label className={styles.replyBox}>
        <span className={styles.label}>
          {locale === "en" ? "Additional instruction" : "Zusatzanweisung"}
        </span>
        <textarea
          maxLength={1000}
          onChange={(event) => setReplyInstruction(event.target.value)}
          placeholder={
            locale === "en"
              ? "e.g. shorter, more direct, ask one clarifying question"
              : "z. B. kürzer, direkter oder eine Rückfrage stellen"
          }
          rows={2}
          value={replyInstruction}
        />
      </label>

      <div className={styles.replyFooter}>
        <button
          className={dashboardStyles.primaryButton}
          disabled={isLoading || !contact.latestInboundMessage}
          onClick={() => void generateSuggestions()}
          type="button"
        >
          {isLoading
            ? locale === "en"
              ? "Generating suggestions…"
              : "Vorschläge werden erzeugt…"
            : wt(locale, "KI-Vorschläge erzeugen")}
        </button>
        {!contact.latestInboundMessage ? (
          <span>
            {locale === "en"
              ? "No inbound message is available as context."
              : "Keine eingehende Nachricht als Kontext vorhanden."}
          </span>
        ) : null}
        {originalChannelAction ? (
          <OriginalChannelButton
            demoConnectionsDisabled={demoConnectionsDisabled}
            href={originalChannelAction.href}
            label={originalChannelAction.label}
            locale={locale}
          />
        ) : null}
      </div>

      {error ? (
        <p className={dashboardStyles.error} role="alert">
          <strong>{error}</strong>
        </p>
      ) : null}

      {suggestions?.creator_context ? <aside className={styles.suggestionCard} aria-label={locale === "en" ? "Creator strategy" : "Creator-Strategie"}>
        <strong>{suggestions.creator_context.name} · {suggestions.creator_context.strategy.state}</strong>
        <p>{locale === "en" ? "Conversation temperature" : "Gesprächstemperatur"}: {suggestions.creator_context.strategy.temperature ?? "—"}/100 · Purchase Intent: {suggestions.creator_context.strategy.purchaseIntent ?? "—"}/100 · Offer Fatigue: {suggestions.creator_context.strategy.offerFatigue ?? "—"}/100</p>
        <p>{suggestions.creator_context.strategy.sellNow
          ? locale === "en" ? "An approved offer can fit. Review the context before sending." : "Ein freigegebenes Angebot kann passen. Vor dem Senden den Kontext prüfen."
          : locale === "en" ? "Do not sell now. Focus on the conversation and aftercare." : "Jetzt nicht verkaufen. Gespräch und Betreuung haben Vorrang."}</p>
        {suggestions.creator_context.strategy.offer ? <p>{suggestions.creator_context.strategy.offer.name} · {new Intl.NumberFormat(locale === "en" ? "en-GB" : "de-DE", { style: "currency", currency: suggestions.creator_context.strategy.offer.currency }).format(suggestions.creator_context.strategy.offer.priceMinor / 100)}</p> : null}
        <small>{locale === "en" ? "— means no reviewed value. Copying a reply does not confirm sending or a purchase." : "— bedeutet: kein geprüfter Wert. Kopieren bestätigt weder Versand noch Kauf."}</small>
      </aside> : null}

      <div className={styles.suggestionGrid} aria-live="polite">
        {(suggestions?.reply_options ?? []).map((option, index) => (
          <article
            className={styles.suggestionCard}
            key={`${option.tone}-${index}`}
          >
            <div className={styles.replyCardHeader}>
              <div>
                <strong>{option.label || `Vorschlag ${index + 1}`}</strong>
                <p className={styles.muted}>
                  {option.tone || activeMode?.label}
                </p>
              </div>
            </div>
            <p>{option.text}</p>
            {canSendTelegram ? (
              <button
                className={dashboardStyles.secondaryButton}
                onClick={() => setTelegramDraft(option.text)}
                type="button"
              >
                Als Telegram-Entwurf übernehmen
              </button>
            ) : null}
            <div className={styles.replyCardActions}>
              <button
                className={dashboardStyles.secondaryButton}
                onClick={() => void copySuggestion(option.text, index)}
                type="button"
              >
                {copiedIndex === index
                  ? wt(locale, "Kopiert")
                  : wt(locale, "Antwort kopieren")}
              </button>
            </div>
          </article>
        ))}
      </div>

      {hasMemorySuggestion || hasFollowupSuggestion ? (
        <div className={styles.suggestionGrid} aria-live="polite">
          {hasMemorySuggestion ? (
            <article className={styles.suggestionCard}>
              <div className={styles.replyCardHeader}>
                <div>
                  <strong>
                    {locale === "en"
                      ? "Contact knowledge suggestion"
                      : "Vorschlag fürs Kontaktwissen"}
                  </strong>
                  <p className={styles.muted}>
                    {locale === "en"
                      ? "Saved in the Contact knowledge tab"
                      : "Wird im Reiter Kontaktwissen gespeichert"}
                  </p>
                </div>
              </div>
              <div>
                <p>{suggestedMemory?.content}</p>
                <p className={styles.muted}>
                  {locale === "en" ? "Importance" : "Wichtigkeit"}: {" "}
                  {importanceLabel(suggestedMemory?.importance, locale)}
                </p>
              </div>
              <div className={styles.replyCardActions}>
                <button
                  className={dashboardStyles.primaryButton}
                  disabled={memorySaving || memoryStatus?.ok}
                  onClick={() => void saveMemorySuggestion()}
                  type="button"
                >
                  {memorySaving
                    ? locale === "en"
                      ? "Saving…"
                      : "Speichere …"
                    : memoryStatus?.ok
                      ? locale === "en"
                        ? "Saved"
                        : "Gespeichert"
                      : locale === "en"
                        ? "Save"
                        : "Speichern"}
                </button>
                <button
                  className={dashboardStyles.secondaryButton}
                  disabled={memorySaving || memoryStatus?.ok}
                  onClick={() => setMemoryDismissed(true)}
                  type="button"
                >
                  {locale === "en" ? "Dismiss" : "Verwerfen"}
                </button>
                {memoryStatus ? (
                  <p
                    className={
                      memoryStatus.ok
                        ? styles.noteSavedHint
                        : dashboardStyles.error
                    }
                    role="status"
                  >
                    {memoryStatus.message}
                  </p>
                ) : null}
              </div>
            </article>
          ) : null}

          {hasFollowupSuggestion ? (
            <article className={styles.suggestionCard}>
              <div className={styles.replyCardHeader}>
                <div>
                  <strong>Follow-up-Vorschlag</strong>
                  <p className={styles.muted}>
                    {locale === "en"
                      ? "Save as a manual reminder"
                      : "Als manuelle Erinnerung speichern"}
                  </p>
                </div>
              </div>
              <div>
                <p>{suggestedFollowup?.reason}</p>
                <p className={styles.muted}>
                  {locale === "en" ? "Suggested date" : "Empfohlenes Datum"}: {" "}
                  {followupDateLabel}
                </p>
              </div>
              <div className={styles.replyCardActions}>
                <button
                  className={dashboardStyles.primaryButton}
                  disabled={followupSaving || followupStatus?.ok}
                  onClick={() => void saveFollowupSuggestion()}
                  type="button"
                >
                  {followupSaving
                    ? locale === "en"
                      ? "Saving…"
                      : "Speichere …"
                    : followupStatus?.ok
                      ? locale === "en"
                        ? "Saved"
                        : "Gespeichert"
                      : locale === "en"
                        ? "Save"
                        : "Speichern"}
                </button>
                <button
                  className={dashboardStyles.secondaryButton}
                  disabled={followupSaving || followupStatus?.ok}
                  onClick={() => setFollowupDismissed(true)}
                  type="button"
                >
                  {locale === "en" ? "Dismiss" : "Verwerfen"}
                </button>
                {followupStatus ? (
                  <p
                    className={
                      followupStatus.ok
                        ? styles.noteSavedHint
                        : dashboardStyles.error
                    }
                    role="status"
                  >
                    {followupStatus.message}
                  </p>
                ) : null}
              </div>
            </article>
          ) : null}
        </div>
      ) : null}

      {canSendTelegram ? (
        <div className={styles.fallbackHelp}>
          <strong>Manueller Telegram-Antwortfluss</strong>
          <p className={styles.muted}>
            FanMind sendet nur nach deinem Klick. Prüfe den Entwurf vor dem Versand.
          </p>
          <label>
            Antwortentwurf
            <textarea
              value={telegramDraft}
              onChange={(event) => setTelegramDraft(event.target.value)}
              maxLength={4096}
              placeholder="Geprüften Telegram-Antwortentwurf eingeben …"
              rows={5}
            />
          </label>
          <button
            className={dashboardStyles.primaryButton}
            disabled={telegramSending || !telegramDraft.trim()}
            onClick={() => void sendTelegramDraft()}
            type="button"
          >
            {telegramSending ? "Sende manuell …" : "Manuell über Telegram senden"}
          </button>
          {telegramStatus ? <p className={styles.muted}>{telegramStatus}</p> : null}
        </div>
      ) : null}

      <p className={styles.reportSafetyNote}>
        {wt(
          locale,
          "Der Mensch prüft und sendet final selbst. Keine automatische Sendefunktion.",
        )}
      </p>
    </article>
  );
}

function importanceLabel(
  value: "low" | "normal" | "high" | undefined,
  locale: FanMindLanguage,
) {
  if (value === "high") return locale === "en" ? "High" : "Hoch";
  if (value === "low") return locale === "en" ? "Low" : "Niedrig";
  return locale === "en" ? "Medium" : "Mittel";
}

function formatFollowupDate(
  inDays: number | null | undefined,
  locale: FanMindLanguage,
) {
  if (typeof inDays !== "number" || !Number.isFinite(inDays)) {
    return locale === "en" ? "Check date manually" : "Datum manuell prüfen";
  }
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + inDays);
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dueDate);
}
