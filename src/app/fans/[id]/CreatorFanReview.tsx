"use client";

import { useEffect, useState } from "react";
import type { CreatorFanReview as Review } from "@/lib/creatorIntelligencePolicy.mjs";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import styles from "../../settings/ai-usage/AiPromptSettings.module.css";

type FanData = {
  available: boolean; configured?: boolean; canManage?: boolean;
  commercial?: Partial<Review["commercial"]>;
  events?: Array<{ kind: string; occurred_at: string; amount_minor: number | null; currency: string | null; evidence_reference: string }>;
  offers?: Array<{ id: string; name: string }>;
};
const empty: Review["commercial"] = {
  fanStage: "unknown", engagementScore: null, purchaseIntentScore: null, offerFatigue: null,
  salesHold: false, offerRequested: false, requestedOfferId: null,
  sourceReference: "", preferredContent: [], preferredStyle: "",
};

export function CreatorFanReview({ contactId, locale }: { contactId: string; locale: FanMindLanguage }) {
  const t = (de: string, en: string) => locale === "en" ? en : de;
  const [data, setData] = useState<FanData | null>(null);
  const [commercial, setCommercial] = useState(empty);
  const [kind, setKind] = useState<"" | "purchase" | "offer" | "offer_declined">("");
  const [occurredAt, setOccurredAt] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [category, setCategory] = useState("");
  const [evidence, setEvidence] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const endpoint = `/api/creators/fan?contactId=${encodeURIComponent(contactId)}`;
  useEffect(() => {
    let active = true;
    void fetch(endpoint, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("load_failed");
      const result = await response.json() as FanData;
      if (active) { setData(result); setCommercial({ ...empty, ...result.commercial }); }
    }).catch(() => { if (active) setError(locale === "en" ? "Creator fan data could not be loaded." : "Creator-Fandaten konnten nicht geladen werden."); });
    return () => { active = false; };
  }, [endpoint, locale]);

  function edit(patch: Partial<Review["commercial"]>) { setCommercial((current) => ({ ...current, ...patch })); }
  async function save() {
    setSaving(true); setError(""); setNotice("");
    try {
      const payload: Review = {
        confirmed, commercial,
        event: kind ? { kind, occurredAt: new Date(occurredAt).toISOString(), amountMinor: amount ? Math.round(Number(amount) * 100) : null,
          currency: amount ? currency : null, category, evidenceReference: evidence } : null,
      };
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "save_failed");
      setConfirmed(false); setKind(""); setAmount(""); setEvidence("");
      setNotice(t("Bestätigte Daten gespeichert. Bitte Antwortvorschläge neu erzeugen, damit sie diese Prüfung berücksichtigen.", "Confirmed data saved. Generate new reply suggestions to use this review."));
      const refreshed = await fetch(endpoint, { cache: "no-store" });
      if (refreshed.ok) setData(await refreshed.json() as FanData);
    } catch { setError(t("Bitte Bestätigung, Beleg, Datum und Werte prüfen. Ein Beleg kann nur einmal erfasst werden.", "Check confirmation, evidence, date and values. Evidence can only be recorded once.")); }
    finally { setSaving(false); }
  }

  if (data && (!data.available || !data.configured)) return null;
  if (!data) return error ? <p role="alert">{error}</p> : null;
  return <details className={styles.profileCard}>
    <summary>{t("Creator-Fanwissen und bestätigte Käufe", "Creator fan knowledge and confirmed purchases")}</summary>
    <p>{t("Unbekannte Werte bleiben leer. Einschätzungen brauchen eine Quelle; ein kopierter Entwurf oder geöffneter Kanal ist kein Versand- oder Kaufbeleg.", "Leave unknown values empty. Assessments need a source; copying a draft or opening a channel is not proof of sending or purchasing.")}</p>
    <fieldset disabled={!data.canManage || saving} onChange={() => { setConfirmed(false); setNotice(""); }} className={styles.profileCard}>
      <legend>{t("Geprüfte Einschätzung", "Reviewed assessment")}</legend>
      <label className={styles.field}><span>{t("Fan-Phase", "Fan stage")}</span><select value={commercial.fanStage} onChange={(event) => edit({ fanStage: event.target.value as Review["commercial"]["fanStage"] })}>
        <option value="unknown">{t("Unbekannt", "Unknown")}</option><option value="new">{t("Neu", "New")}</option><option value="engaged">{t("Im Gespräch", "Engaged")}</option><option value="buyer">{t("Käufer", "Buyer")}</option><option value="vip">VIP</option><option value="inactive">{t("Inaktiv", "Inactive")}</option>
      </select></label>
      {([ ["engagementScore", "Engagement / Temperatur", "Engagement / temperature"], ["purchaseIntentScore", "Kaufabsicht", "Purchase intent"], ["offerFatigue", "Angebotsmüdigkeit", "Offer fatigue"] ] as const).map(([key, de, en]) => <label key={key} className={styles.field}><span>{t(de, en)} (0–100)</span><input type="number" min="0" max="100" placeholder={t("Unbekannt", "Unknown")} value={commercial[key] ?? ""} onChange={(event) => edit({ [key]: event.target.value === "" ? null : Number(event.target.value) })} /></label>)}
      <label className={styles.field}><span>{t("Bevorzugte Inhalte – ein Eintrag pro Zeile", "Preferred content – one entry per line")}</span><textarea value={commercial.preferredContent.join("\n")} onChange={(event) => edit({ preferredContent: event.target.value.split("\n") })} /></label>
      <label className={styles.field}><span>{t("Bevorzugter Kommunikationsstil", "Preferred communication style")}</span><input maxLength={240} value={commercial.preferredStyle} onChange={(event) => edit({ preferredStyle: event.target.value })} /></label>
      <label className={styles.field}><span>{t("Quelle der Prüfung (Nachrichten-/Belegreferenz)", "Review source (message / evidence reference)")}</span><input maxLength={200} value={commercial.sourceReference} onChange={(event) => edit({ sourceReference: event.target.value })} /></label>
      <label><input type="checkbox" checked={commercial.salesHold} onChange={(event) => edit({ salesHold: event.target.checked })} /> {t("Verkauf pausieren", "Pause sales")}</label>
      <label><input type="checkbox" checked={commercial.offerRequested} onChange={(event) => edit({ offerRequested: event.target.checked })} /> {t("Fan hat dieses Angebot ausdrücklich angefragt", "Fan explicitly requested this offer")}</label>
      <label className={styles.field}><span>{t("Angefragtes freigegebenes Angebot", "Requested approved offer")}</span><select value={commercial.requestedOfferId ?? ""} onChange={(event) => edit({ requestedOfferId: event.target.value || null })}><option value="">{t("Keines", "None")}</option>{data.offers?.map((offer) => <option key={offer.id} value={offer.id}>{offer.name}</option>)}</select></label>
      <label className={styles.field}><span>{t("Bestätigtes Ereignis ergänzen", "Add a confirmed event")}</span><select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="">{t("Kein neues Ereignis", "No new event")}</option><option value="purchase">{t("Tatsächlicher Kauf", "Actual purchase")}</option><option value="offer">{t("Tatsächlich gesendetes Angebot", "Actually sent offer")}</option><option value="offer_declined">{t("Abgelehntes Angebot", "Declined offer")}</option></select></label>
      {kind ? <>
        <label className={styles.field}><span>{t("Zeitpunkt (lokale Zeit)", "Time (local time)")}</span><input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} /></label>
        <label className={styles.field}><span>{t("Betrag (bei Kauf erforderlich)", "Amount (required for purchases)")}</span><input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label className={styles.field}><span>{t("Währung", "Currency")}</span><select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>EUR</option><option>CHF</option><option>USD</option><option>GBP</option></select></label>
        <label className={styles.field}><span>{t("Content-Kategorie", "Content category")}</span><input maxLength={80} value={category} onChange={(event) => setCategory(event.target.value)} /></label>
        <label className={styles.field}><span>{t("Eindeutige Kauf-/Nachrichtenreferenz", "Unique purchase / message reference")}</span><input maxLength={200} value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label>
      </> : null}
    </fieldset>
    {data.canManage ? <>
      <label><input type="checkbox" disabled={saving} checked={confirmed} onChange={(event) => { setCommercial((current) => ({ ...current, preferredContent: current.preferredContent.map((line) => line.trim()).filter(Boolean) })); setConfirmed(event.target.checked); }} /> {t("Ich habe diese Angaben anhand der genannten Quelle geprüft.", "I have checked these details against the stated source.")}</label>
      <button className={styles.primaryButton} type="button" disabled={!confirmed || saving} onClick={() => void save()}>{saving ? t("Speichert …", "Saving…") : t("Geprüfte Fandaten speichern", "Save reviewed fan data")}</button>
    </> : null}
    {data.events?.length ? <ul>{data.events.map((event) => <li key={`${event.kind}:${event.evidence_reference}`}>{event.kind} · {new Date(event.occurred_at).toLocaleString(locale === "en" ? "en-GB" : "de-DE")} · {event.amount_minor !== null && event.currency ? new Intl.NumberFormat(locale === "en" ? "en-GB" : "de-DE", { style: "currency", currency: event.currency }).format(event.amount_minor / 100) : "—"}</li>)}</ul> : null}
    {notice ? <p className={styles.success} role="status">{notice}</p> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
  </details>;
}
