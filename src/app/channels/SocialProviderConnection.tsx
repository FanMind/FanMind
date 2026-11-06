"use client";

import { useCallback, useEffect, useState } from "react";
import { ChannelConnectionSteps } from "./ChannelConnectionSteps";
import styles from "./channels.module.css";

type Status = { available: boolean; connected: boolean; accountName: string | null; expiresAt: string | null; nextReadAt: string | null; initialReadPending: boolean };
type Message = { id: string; senderId: string; text: string; receivedAt: string; openUrl: string };
const errors: Record<string, string> = {
  rate_limited: "Bitte später erneut versuchen. Der Lesezugriff ist auf einen Abruf alle 15 Minuten begrenzt.",
  reconnect_required: "Bitte verbinde dein Konto erneut.",
  provider_access_required: "Die Plattform hat den Zugriff noch nicht freigegeben. Bei X muss auch das API-Guthaben verfügbar sein.",
  oauth_denied: "Die Anmeldung wurde abgebrochen.",
  oauth_invalid: "Diese Anmeldung ist abgelaufen oder bereits verwendet. Bitte starte sie erneut.",
  connection_changed: "Die Verbindung hat sich geändert. Bitte lade ihren Status erneut.",
  provider_cleanup_required: "Die Anmeldung konnte nicht abgeschlossen und die Plattformfreigabe nicht bestätigt entfernt werden. Entferne FanMind bitte in den App-Berechtigungen der Plattform.",
};
function errorMessage(code: unknown) {
  return typeof code === "string" && Object.hasOwn(errors, code)
    ? errors[code] : "Die Verbindung konnte nicht abgeschlossen werden.";
}
export function SocialProviderConnection({ provider, demo }: { provider: "tiktok" | "x"; demo: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const endpoint = `/api/integrations/social/${provider}`;
  const name = provider === "x" ? "X / Twitter" : "TikTok";
  const perform = useCallback(async (action: "start" | "disconnect" | "messages" | "initial-messages", signal?: AbortSignal) => {
    setBusy(true); setMessages([]);
    if (action === "initial-messages") setNotice("Dein Konto ist verbunden. Die ersten verfügbaren Nachrichten werden geladen …");
    try {
      const response = await fetch(`${endpoint}/${action}`, { method: "POST", cache: "no-store", redirect: "error", signal });
      const result = await response.json();
      if (signal?.aborted) return;
      if (!response.ok) { setNotice(errorMessage(result.error)); return; }
      if (action === "start") {
        const target = new URL(result.authorizationUrl);
        const expected = provider === "x" ? "https://x.com/i/oauth2/authorize" : "https://www.tiktok.com/v2/auth/authorize/";
        if (`${target.origin}${target.pathname}` !== expected || target.username || target.password || target.hash) throw new Error();
        // Top-level navigation after a same-origin POST respects form-action 'self'.
        window.location.assign(target.href);
      } else if (action === "disconnect") {
        setStatus(current => current ? { ...current, connected: false, accountName: null, initialReadPending: false } : null);
        setNotice(result.providerRevoked ? "Verbindung getrennt und Zugriff bei der Plattform widerrufen." : "Verbindung in FanMind getrennt. Entferne FanMind zusätzlich in den App-Berechtigungen der Plattform.");
      } else {
        setMessages(result.messages);
        setNotice(`${result.messages.length} eingehende Nachrichten zur Prüfung geladen. ${result.skipped} nicht unterstützte Einträge ausgelassen.${result.hasMore ? " Weitere Nachrichten sind vorhanden; diese Vorschau lädt höchstens 20 Ereignisse." : ""}`);
      }
    } catch { if (!signal?.aborted) setNotice("Die Aktion konnte nicht abgeschlossen werden. Bitte prüfe den Verbindungsstatus."); }
    finally { if (!signal?.aborted) setBusy(false); }
  }, [endpoint, provider]);
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    fetch(`${endpoint}/status`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error();
        const nextStatus = await response.json();
        if (controller.signal.aborted) return;
        setStatus(nextStatus);
        const query = new URLSearchParams(window.location.search);
        if (query.get("social") === provider) {
          const code = query.get("social_result");
          if (code) setNotice(code === "connected" && nextStatus.connected === true
            ? "Dein Konto wurde verbunden." : errorMessage(code));
        }
        // The database grants this once; URL text cannot create an initial read.
        if (provider === "x" && nextStatus.available === true && nextStatus.connected === true && nextStatus.initialReadPending === true) {
          await perform("initial-messages", controller.signal);
        }
      })
      .catch(() => { if (!controller.signal.aborted) setNotice("Verbindungsstatus derzeit nicht verfügbar."); });
    return () => controller.abort();
  }, [demo, endpoint, provider, perform]);
  return <section className={styles.releaseBox} aria-label={`${name} verbinden`}>
    <strong>{name} · Anbindung in Vorbereitung</strong>
    <ChannelConnectionSteps name={name} />
    <p>{provider === "tiktok"
      ? "Die offizielle Anmeldung verbindet dein Profil. Nachrichten und Kommentare benötigen einen gesondert freigegebenen Zugang und sind hier noch nicht abrufbar."
      : "Nach der freigegebenen Anmeldung lädt FanMind einmalig die ersten verfügbaren Direktnachrichten als Vorschau. Ein Abruf umfasst bis zu 20 aktuelle Ereignisse."}</p>
    <p>Für alle Kanäle gilt derselbe persönliche Schreibstil deines Accounts.</p>
    {status?.connected ? <p>Verbundenes Konto: <strong>{status.accountName}</strong></p> : null}
    <p>{demo ? "Verbindungen sind im Demo-Modus deaktiviert." : status?.available ? "Für diesen Testaccount freigegeben." : "Die Verbindung wird nach Einrichtung der Plattform-App und Freigabe des Testzugangs verfügbar."}</p>
    <div className={styles.connectionCardActions}>
      <button type="button" disabled={demo || busy || !status?.available} onClick={() => perform("start")}>{status?.connected ? "Anmeldung erneuern" : `Eigenes ${name}-Konto verbinden`}</button>
      {status?.connected ? <button type="button" disabled={busy} onClick={() => perform("disconnect")}>Verbindung trennen</button> : null}
      {provider === "x" && status?.connected ? <button type="button" disabled={busy || !status.available} onClick={() => perform("messages")}>Direktnachrichten prüfen</button> : null}
    </div>
    {provider === "x" ? <p>Die Vorschau zeigt eingehende Einzelchats. Sie speichert keine Fans oder Nachrichten im CRM. X kann API-Abrufe berechnen. Antworten werden auf X manuell gesendet.</p> : null}
    {notice ? <p role="status">{notice}</p> : null}
    {messages.length ? <ul className={styles.compactStatusList}>{messages.map(message => <li key={message.id}>
      <strong>X-Nutzer {message.senderId}</strong><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.text}</p>
      <a href="https://x.com/messages" target="_blank" rel="noopener noreferrer">X-Nachrichten öffnen</a>
    </li>)}</ul> : null}
  </section>;
}
