"use client";

import { useEffect, useState } from "react";

type Connection = { platform: string; status: "connected" | "attention_required" };
type DiagnosticState = "idle" | "loading" | "ready" | "unavailable";
const providerNames: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
};

/** Read-only support diagnostics; never triggers a repair or sends credentials. */
export function WorkspaceHelpLauncher() {
  const [open, setOpen] = useState(false);
  const [diagnosticState, setDiagnosticState] = useState<DiagnosticState>("idle");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [repairConsent, setRepairConsent] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setDiagnosticState("loading");
    setConnections([]);
    setSelectedProvider(null);
    setRepairConsent(false);
    fetch("/api/support/diagnostics", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("diagnostics_unavailable");
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || !("connections" in payload) ||
          !Array.isArray(payload.connections)) throw new Error("invalid_diagnostics");
      const safeConnections = payload.connections.filter((item: unknown): item is Connection => {
        if (!item || typeof item !== "object") return false;
        const record = item as Record<string, unknown>;
        return typeof record.platform === "string" &&
          Object.hasOwn(providerNames, record.platform) &&
          (record.status === "connected" || record.status === "attention_required");
      });
      if (!controller.signal.aborted) {
        setConnections(safeConnections);
        setDiagnosticState("ready");
      }
    }).catch(() => {
      if (!controller.signal.aborted) setDiagnosticState("unavailable");
    });
    return () => controller.abort();
  }, [open]);

  return (
    <aside aria-label="FanMind Hilfe" style={{ position: "fixed", right: 20, bottom: 20, zIndex: 1000 }}>
      {open ? (
        <section
          id="fanmind-inapp-help-panel"
          aria-label="FanMind Hilfe"
          style={{ width: "min(340px, calc(100vw - 40px))", background: "#fff", color: "#14243a", border: "1px solid #cbd5e1", borderRadius: 12, padding: 16, marginBottom: 8, boxShadow: "0 12px 36px #0003" }}
        >
          <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Wie können wir helfen?</h2>
          <p>Hier kannst du den Verbindungsstatus deiner Kanäle prüfen. Die Prüfung verändert keine Einstellungen.</p>
          {diagnosticState === "loading" ? <p role="status">Verbindungen werden geprüft …</p> : null}
          {diagnosticState === "unavailable" ? (
            <p role="status">Die Kontoprüfung ist derzeit nicht verfügbar. Bitte versuche es später erneut.</p>
          ) : null}
          {diagnosticState === "ready" ? (
            connections.length ? (
              <ul aria-label="Verbindungsstatus">
                {connections.map((connection) => (
                  <li key={connection.platform}>
                    <strong>{providerNames[connection.platform]}</strong>: {connection.status === "connected" ? "Verbunden" : "Verbindung prüfen"}
                    {connection.status === "attention_required" ? <button type="button" onClick={() => { setSelectedProvider(connection.platform); setRepairConsent(false); }}>Hilfe anzeigen</button> : null}
                  </li>
                ))}
              </ul>
            ) : <p role="status">Keine unterstützten Verbindungen gefunden.</p>
          ) : null}
          {selectedProvider ? (
            <section aria-label="Geführte Fehlerbehebung" role="status">
              <h3>{providerNames[selectedProvider]} überprüfen</h3>
              <p>Die Verbindung benötigt Aufmerksamkeit. Der genaue Grund ist noch nicht bekannt. Prüfe zuerst in den Kanäle-Einstellungen, ob eine erneute Anmeldung angeboten wird.</p>
              <p>Eine erneute Anmeldung kann Berechtigungen aktualisieren. Sie darf nur durch deine bewusste Aktion gestartet werden. Diese Hilfe führt selbst keine Reparatur aus.</p>
              <label style={{ display: "block", marginBottom: 8 }}>
                <input type="checkbox" checked={repairConsent} onChange={(event) => setRepairConsent(event.target.checked)} />
                Ich möchte die Verbindung selbst erneut einrichten und verstehe, dass dabei eine neue Anmeldung erforderlich sein kann.
              </label>
              {repairConsent ? (
                <a href="/channels">Zu den Verbindungseinstellungen wechseln</a>
              ) : (
                <p>Bestätige zuerst, dass du die erneute Einrichtung selbst starten möchtest.</p>
              )}
              <p>Diese Bestätigung startet keine Änderung. Eine automatische Reparatur wird erst nach gesonderter serverseitiger Freigabe implementiert.</p>
              <div><button type="button" onClick={() => setSelectedProvider(null)}>Zurück zur Übersicht</button></div>
            </section>
          ) : null}
          <p>Automatische Reparaturen sind noch nicht verfügbar. Keine Verbindung wird ohne deine ausdrückliche Bestätigung geändert.</p>
          <a href="/channels">Kanäle öffnen</a>
          <div style={{ marginTop: 12 }}><button type="button" onClick={() => setOpen(false)}>Schließen</button></div>
        </section>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="fanmind-inapp-help-panel"
        onClick={() => setOpen((current) => !current)}
        style={{ background: "#0877d9", color: "#fff", border: 0, borderRadius: 24, padding: "12px 18px", fontWeight: 700, cursor: "pointer" }}
      >
        {open ? "Hilfe schließen" : "Hilfe"}
      </button>
    </aside>
  );
}
