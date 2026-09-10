"use client";

import { useEffect, useState } from "react";
import { defaultCreatorBundle, type CreatorBundle, type CreatorOffer, type CreatorVoice } from "@/lib/creatorIntelligencePolicy.mjs";
import type { FanMindLanguage } from "@/lib/fanmindCopy";
import styles from "./AiPromptSettings.module.css";

const scales = [
  ["warmth", "Wärme", "Warmth"], ["playfulness", "Verspieltheit", "Playfulness"],
  ["flirtLevel", "Flirt-Level", "Flirt level"], ["directness", "Direktheit", "Directness"],
  ["mystery", "Zurückhaltung", "Reserve"], ["questionFrequency", "Gegenfragen", "Questions"],
  ["salesDirectness", "Verkaufsdirektheit", "Sales directness"],
] as const;
const voiceTexts = [
  ["tone", "Grundton", "Base tone"], ["messageLength", "Typische Nachrichtenlänge", "Typical message length"],
  ["emojiFrequency", "Emoji-Häufigkeit", "Emoji frequency"], ["writingStyle", "Schreibstil und Satzzeichen", "Writing and punctuation"],
  ["humorStyle", "Humor", "Humor"], ["complimentStyle", "Umgang mit Komplimenten", "Responding to compliments"],
] as const;
const voiceLists = [
  ["preferredEmojis", "Bevorzugte Emojis", "Preferred emojis"], ["greetings", "Begrüßungen", "Greetings"],
  ["closings", "Verabschiedungen", "Closings"], ["commonPhrases", "Typische Wörter und Phrasen", "Typical words and phrases"],
  ["avoidedPhrases", "Nie verwenden", "Never use"], ["goodExamples", "Echte Beispielnachrichten – so schreiben", "Real message examples – write like this"],
  ["badExamples", "So nicht schreiben", "Do not write like this"],
] as const;

export function CreatorSettings({ locale }: { locale: FanMindLanguage }) {
  const t = (de: string, en: string) => locale === "en" ? en : de;
  const [bundle, setBundle] = useState<CreatorBundle>(defaultCreatorBundle);
  const [ready, setReady] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void fetch("/api/creators", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("load_failed");
      const data = await response.json() as { available: boolean; canManage: boolean; creators: CreatorBundle[] };
      if (!active) return;
      setReady(data.available); setCanManage(data.canManage);
      if (data.creators[0]) setBundle(data.creators[0]);
    }).catch(() => { if (active) setError(locale === "en" ? "Creator profile could not be loaded." : "Creator-Profil konnte nicht geladen werden."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locale]);

  function update(patch: Partial<CreatorBundle>) {
    setNotice(""); setError("");
    setBundle((current) => ({ ...current, ...patch, approve: false }));
  }
  function updateVoice(key: keyof CreatorVoice, value: string | string[] | number) {
    update({ voice: { ...bundle.voice, [key]: value } });
  }
  function updateOffer(index: number, patch: Partial<CreatorOffer>) {
    update({ playbook: { ...bundle.playbook, offers: bundle.playbook.offers.map((offer, n) => n === index ? { ...offer, ...patch } : offer) } });
  }
  function lines(value: string) { return value.split("\n").map((line) => line.trim()).filter(Boolean); }
  const disabled = !canManage || saving;
  return <section className={styles.card} aria-labelledby="creator-settings-title">
    <div className={styles.header}><div>
      <p className={styles.eyebrow}>{t("Creator Intelligence · Phase 7b", "Creator intelligence · Phase 7b")}</p>
      <h2 id="creator-settings-title">{t("Dein Creator-Profil und deine Stimme", "Your creator profile and voice")}</h2>
      <p>{t("Ein Creator, ein Account, ein eigener Workspace. Fanwissen, Stimme und Angebote bleiben in diesem Account. Teamzugänge und die Verwaltung mehrerer Workspaces folgen später.", "One creator, one account, one dedicated workspace. Fan knowledge, voice and offers stay in this account. Team access and managing multiple workspaces follow later.")}</p>
    </div></div>
    {loading ? <p role="status">{t("Profil wird geladen …", "Loading profile…")}</p> : !ready ? <p className={styles.notice}>
      {t("Die Creator-Erweiterung ist in Vorbereitung. Das bestehende Kontaktwissen und die bisherigen KI-Antworten bleiben verfügbar.", "The creator extension is being prepared. Existing contact knowledge and AI replies remain available.")}
    </p> : <>
      <fieldset disabled={disabled} className={styles.profileCard}>
        <legend>{t("Bestätigte Persona", "Confirmed persona")}</legend>
        {([
          ["displayName", "Name / Künstlername", "Name / stage name", 100], ["bio", "Bio", "Bio", 1200],
          ["location", "Öffentlicher Persona-Standort", "Public persona location", 160], ["internalNotes", "Interne Notizen", "Internal notes", 1500],
        ] as const).map(([key, de, en, maximum]) => <label className={styles.field} key={key}><span>{t(de, en)}</span>
          <textarea rows={key === "bio" ? 3 : 2} maxLength={maximum} value={bundle.persona[key] ?? ""} onChange={(event) => update({ persona: { ...bundle.persona, [key]: event.target.value } })} />
        </label>)}
        <label className={styles.field}><span>{t("Öffentlich bestätigtes Alter (optional)", "Publicly confirmed age (optional)")}</span><input type="number" min="18" max="120" value={bundle.persona.publicAge ?? ""} onChange={(event) => update({ persona: { ...bundle.persona, publicAge: event.target.value === "" ? null : Number(event.target.value) } })} /></label>
        {([ ["languages", "Sprachen, eine pro Zeile", "Languages, one per line"], ["platforms", "Plattformen, eine pro Zeile", "Platforms, one per line"] ] as const).map(([key, de, en]) => <label className={styles.field} key={key}><span>{t(de, en)}</span><textarea rows={2} value={bundle.persona[key].join("\n")} onChange={(event) => update({ persona: { ...bundle.persona, [key]: event.target.value.split("\n") } })} /></label>)}
        <label className={styles.field}><span>Status</span><select value={bundle.persona.status} onChange={(event) => update({ persona: { ...bundle.persona, status: event.target.value as CreatorBundle["persona"]["status"] } })}>
          <option value="draft">{t("Entwurf", "Draft")}</option><option value="active">{t("Aktiv", "Active")}</option><option value="paused">{t("Pausiert", "Paused")}</option><option value="archived">{t("Archiviert", "Archived")}</option>
        </select></label>
      </fieldset>
      <fieldset disabled={disabled} className={styles.profileCard}><legend>{t("Sprachlicher Fingerabdruck", "Voice fingerprint")}</legend>
        {voiceTexts.map(([key, de, en]) => <label className={styles.field} key={key}><span>{t(de, en)}</span><input maxLength={240} value={bundle.voice[key]} onChange={(event) => updateVoice(key, event.target.value)} /></label>)}
        {scales.map(([key, de, en]) => <label className={styles.field} key={key}><span>{t(de, en)} · {bundle.voice[key]}/100</span><input type="range" min="0" max="100" value={bundle.voice[key]} onChange={(event) => updateVoice(key, Number(event.target.value))} /></label>)}
        {voiceLists.map(([key, de, en]) => <label className={styles.field} key={key}><span>{t(de, en)}</span><textarea rows={key.endsWith("Examples") ? 4 : 2} value={bundle.voice[key].join("\n")} onChange={(event) => updateVoice(key, event.target.value.split("\n"))} /><small>{t("Ein Eintrag pro Zeile. Gute Beispiele: mindestens drei bestätigte eigene Nachrichten.", "One entry per line. Good examples: at least three confirmed messages of your own.")}</small></label>)}
      </fieldset>
      <fieldset disabled={disabled} className={styles.profileCard}><legend>Sales Playbook</legend>
        <label className={styles.field}><span>{t("Positionierung", "Positioning")}</span><textarea maxLength={600} value={bundle.playbook.positioning} onChange={(event) => update({ playbook: { ...bundle.playbook, positioning: event.target.value } })} /></label>
        {([ ["minimumHoursBetweenOffers", "Mindestabstand zwischen Angeboten (Stunden)", "Minimum hours between offers"], ["aftercareHours", "Betreuung ohne Verkaufsangebot nach Kauf (Stunden)", "Hours of aftercare without offers after purchase"] ] as const).map(([key, de, en]) => <label className={styles.field} key={key}><span>{t(de, en)}</span><input type="number" min="1" max="720" value={bundle.playbook[key]} onChange={(event) => update({ playbook: { ...bundle.playbook, [key]: Number(event.target.value) } })} /></label>)}
        {([ ["contentBoundaries", "Content-Grenzen", "Content boundaries"], ["confirmationRequired", "Immer vorher bestätigen lassen", "Always obtain confirmation first"], ["noGos", "Absolute No-Gos", "Absolute no-gos"] ] as const).map(([key, de, en]) => <label className={styles.field} key={key}><span>{t(de, en)}</span><textarea rows={3} value={bundle.playbook[key].join("\n")} onChange={(event) => update({ playbook: { ...bundle.playbook, [key]: event.target.value.split("\n") } })} /></label>)}
        {bundle.playbook.offers.map((offer, index) => <div className={styles.profileCard} key={offer.id}>
          <strong>{t("Angebot", "Offer")} {index + 1}</strong>
          {([ ["name", "Name", "Name"], ["category", "Kategorie", "Category"], ["description", "Beschreibung", "Description"], ["delivery", "Lieferzeit", "Delivery time"], ["exclusivity", "Exklusivität", "Exclusivity"] ] as const).map(([key, de, en]) => <label className={styles.field} key={key}><span>{t(de, en)}</span><input value={offer[key]} onChange={(event) => updateOffer(index, { [key]: event.target.value })} /></label>)}
          <label className={styles.field}><span>{t("Währung", "Currency")}</span><select value={offer.currency} onChange={(event) => updateOffer(index, { currency: event.target.value })}><option>EUR</option><option>CHF</option><option>USD</option><option>GBP</option></select></label>
          {([ ["minimumPriceMinor", "Mindestpreis", "Minimum price"], ["recommendedPriceMinor", "Empfohlener Preis", "Recommended price"], ["maximumPriceMinor", "Höchstpreis / VIP", "Maximum / VIP price"] ] as const).map(([key, de, en]) => <label className={styles.field} key={key}><span>{t(de, en)} ({offer.currency})</span><input type="number" step="0.01" min="0.01" value={offer[key] / 100} onChange={(event) => updateOffer(index, { [key]: Math.round(Number(event.target.value) * 100) })} /></label>)}
          <label className={styles.field}><span>{t("Maximaler Rabatt in %", "Maximum discount %")}</span><input type="number" min="0" max="100" value={offer.maximumDiscountPercent} onChange={(event) => updateOffer(index, { maximumDiscountPercent: Number(event.target.value) })} /></label>
          <label><input type="checkbox" checked={offer.active} onChange={(event) => updateOffer(index, { active: event.target.checked })} /> {t("Angebot freigegeben", "Offer approved")}</label>{" "}
          <label><input type="checkbox" checked={offer.requiresConfirmation} onChange={(event) => updateOffer(index, { requiresConfirmation: event.target.checked })} /> {t("Jedes Mal Creator-Bestätigung erforderlich", "Creator confirmation required each time")}</label>
          <button type="button" onClick={() => update({ playbook: { ...bundle.playbook, offers: bundle.playbook.offers.filter((_, n) => n !== index) } })}>{t("Angebot entfernen", "Remove offer")}</button>
        </div>)}
        <button type="button" disabled={bundle.playbook.offers.length >= 20} onClick={() => update({ playbook: { ...bundle.playbook, offers: [...bundle.playbook.offers, { id: crypto.randomUUID(), name: "", category: "", description: "", currency: "EUR", minimumPriceMinor: 100, recommendedPriceMinor: 100, maximumPriceMinor: 100, maximumDiscountPercent: 0, delivery: "", exclusivity: "", active: false, requiresConfirmation: true }] } })}>{t("Angebot hinzufügen", "Add offer")}</button>
      </fieldset>
      <label><input type="checkbox" disabled={disabled} checked={bundle.approve} onChange={(event) => {
        // Normalize line breaks only at review/save; keep typing and newlines fluid.
        const normalizedVoice = { ...bundle.voice };
        for (const [key] of voiceLists) normalizedVoice[key] = lines(bundle.voice[key].join("\n"));
        setBundle({ ...bundle, voice: normalizedVoice, approve: event.target.checked });
      }} /> {t("Ich habe Persona, eigene Beispielnachrichten und Angebote geprüft und gebe diese Version für Antwortentwürfe frei.", "I have reviewed the persona, my own example messages and offers, and approve this version for reply drafts.")}</label>
      <div className={styles.footerActions}><button className={styles.primaryButton} type="button" disabled={disabled} onClick={() => {
        // Empty lines are presentation, not profile facts.
        const clean = structuredClone(bundle);
        for (const [key] of voiceLists) clean.voice[key] = lines(clean.voice[key].join("\n"));
        clean.persona.languages = lines(clean.persona.languages.join("\n")); clean.persona.platforms = lines(clean.persona.platforms.join("\n"));
        for (const key of ["contentBoundaries", "confirmationRequired", "noGos"] as const) clean.playbook[key] = lines(clean.playbook[key].join("\n"));
        setBundle(clean);
        void saveSnapshot(clean);
      }}>{saving ? t("Speichert …", "Saving…") : t("Creator-Profil speichern", "Save creator profile")}</button></div>
    </>}
    {notice ? <p className={styles.success} role="status">{notice}</p> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
  </section>;

  async function saveSnapshot(snapshot: CreatorBundle) {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/creators", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", bundle: snapshot }) });
      const data = await response.json() as { creators?: CreatorBundle[]; error?: string };
      if (!response.ok || !data.creators?.[0]) throw new Error(data.error ?? t("Speichern nicht möglich.", "Could not save."));
      setBundle(data.creators[0]);
      setNotice(data.creators[0].approve ? t("Geprüfte Version gespeichert. Aktive Profile werden automatisch für diesen Account verwendet.", "Reviewed version saved. Active profiles are used automatically for this account.") : t("Entwurf gespeichert. Vor der KI-Nutzung bitte prüfen und freigeben.", "Draft saved. Review and approve before AI use."));
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("Speichern nicht möglich.", "Could not save.")); }
    finally { setSaving(false); }
  }
}
