"use client";

import { useEffect, useState } from "react";

type Connection = {
  platform: string;
  status: "connected" | "attention_required";
  issue: "connection" | "message_sync";
};
type DiagnosticState = "idle" | "loading" | "ready" | "unavailable";
type RepairState =
  | "idle"
  | "loading"
  | "succeeded"
  | "partial"
  | "rate_limited"
  | "failed";
const providerNames: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
};

export function WorkspaceHelpLauncher() {
  const [open, setOpen] = useState(false);
  const [diagnosticState, setDiagnosticState] =
    useState<DiagnosticState>("idle");
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [repairConsent, setRepairConsent] = useState(false);
  const [repairRequestId, setRepairRequestId] = useState<string | null>(null);
  const [repairState, setRepairState] = useState<RepairState>("idle");
  const [checkState, setCheckState] = useState<
    "idle" | "loading" | "connected" | "attention_required" | "unavailable"
  >("idle");

  const selectedConnection =
    connections.find((connection) => connection.platform === selectedProvider) ??
    null;

  async function recheckConnection(platform: string) {
    setCheckState("loading");
    try {
      const response = await fetch("/api/support/automatic-check", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check_connection", platform }),
      });
      if (!response.ok) throw new Error("check_unavailable");
      const result: unknown = await response.json();
      if (!result || typeof result !== "object") {
        throw new Error("invalid_result");
      }
      const data = result as Record<string, unknown>;
      setCheckState(
        data.verified === true && data.status === "connected"
          ? "connected"
          : "attention_required",
      );
    } catch {
      setCheckState("unavailable");
    }
  }

  async function restartMessageSync(platform: string) {
    if (!repairConsent || !repairRequestId) return;
    setRepairState("loading");
    try {
      const response = await fetch("/api/support/repair-request", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restart_message_sync",
          platform,
          confirmed: true,
          requestId: repairRequestId,
        }),
      });
      const result: unknown = await response.json();
      if (
        response.ok &&
        result &&
        typeof result === "object" &&
        (result as Record<string, unknown>).verified === true
      ) {
        setRepairState("succeeded");
        return;
      }
      const status =
        result && typeof result === "object"
          ? (result as Record<string, unknown>).status
          : null;
      if (response.status === 429) setRepairState("rate_limited");
      else if (status === "partial") setRepairState("partial");
      else setRepairState("failed");
    } catch {
      setRepairState("failed");
    }
  }

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
    fetch("/api/support/diagnostics", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("diagnostics_unavailable");
        const payload: unknown = await response.json();
        if (
          !payload ||
          typeof payload !== "object" ||
          !("connections" in payload) ||
          !Array.isArray(payload.connections)
        ) {
          throw new Error("invalid_diagnostics");
        }
        const safeConnections = payload.connections.filter(
          (item: unknown): item is Connection => {
            if (!item || typeof item !== "object") return false;
            const record = item as Record<string, unknown>;
            return (
              typeof record.platform === "string" &&
              Object.hasOwn(providerNames, record.platform) &&
              (record.status === "connected" ||
                record.status === "attention_required") &&
              (record.issue === "connection" ||
                record.issue === "message_sync")
            );
          },
        );
        if (!controller.signal.aborted) {
          setConnections(safeConnections);
          setDiagnosticState("ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setDiagnosticState("unavailable");
      });
    return () => controller.abort();
  }, [open]);

  function selectProvider(platform: string) {
    setSelectedProvider(platform);
    setRepairConsent(false);
    setRepairRequestId(crypto.randomUUID());
    setRepairState("idle");
    setCheckState("idle");
  }

  return (
    <aside
      aria-label="FanMind Hilfe"
      style={{ position: "fixed", right: 20, bottom: 20, zIndex: 1000 }}
    >
      {open ? (
        <section
          id="fanmind-inapp-help-panel"
          aria-label="FanMind Hilfe"
          style={{
            width: "min(340px, calc(100vw - 40px))",
            background: "#fff",
            color: "#14243a",
            border: "1px solid #cbd5e1",
            borderRadius: 12,
            padding: 16,
            marginBottom: 8,
            boxShadow: "0 12px 36px #0003",
          }}
        >
          <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>
            Wie können wir helfen?
          </h2>
          <p>
            Hier kannst du den Verbindungsstatus deiner Kanäle prüfen. Die
            Prüfung verändert keine Einstellungen.
          </p>
          {diagnosticState === "loading" ? (
            <p role="status">Verbindungen werden geprüft …</p>
          ) : null}
          {diagnosticState === "unavailable" ? (
            <p role="status">
              Die Kontoprüfung ist derzeit nicht verfügbar. Bitte versuche es
              später erneut.
            </p>
          ) : null}
          {diagnosticState === "ready" ? (
            connections.length ? (
              <ul aria-label="Verbindungsstatus">
                {connections.map((connection) => (
                  <li key={connection.platform}>
                    <strong>{providerNames[connection.platform]}</strong>:{" "}
                    {connection.status === "connected"
                      ? "Verbunden"
                      : "Verbindung prüfen"}
                    {connection.status === "attention_required" ? (
                      <button
                        type="button"
                        onClick={() => selectProvider(connection.platform)}
                      >
                        Hilfe anzeigen
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status">Keine unterstützten Verbindungen gefunden.</p>
            )
          ) : null}
          {selectedConnection ? (
            <section aria-label="Geführte Fehlerbehebung" role="status">
              <h3>{providerNames[selectedConnection.platform]} überprüfen</h3>
              {selectedConnection.issue === "message_sync" ? (
                <>
                  <p>
                    FanMind hat einen Fehler bei der Nachrichtensynchronisierung
                    erkannt. Mit deiner Zustimmung kann FanMind genau diese
                    Synchronisierung einmal neu starten. Dabei werden keine
                    Zugangsdaten, Berechtigungen oder Provider-Einstellungen
                    geändert.
                  </p>
                  <label style={{ display: "block", marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={repairConsent}
                      onChange={(event) =>
                        setRepairConsent(event.target.checked)
                      }
                    />
                    Ich stimme diesem einmaligen Neustart ausdrücklich zu.
                  </label>
                  <button
                    type="button"
                    disabled={!repairConsent || repairState === "loading"}
                    onClick={() =>
                      void restartMessageSync(selectedConnection.platform)
                    }
                  >
                    Synchronisierung neu starten
                  </button>
                  {repairState === "loading" ? (
                    <p role="status">Reparatur wird ausgeführt und geprüft …</p>
                  ) : null}
                  {repairState === "succeeded" ? (
                    <p role="status">
                      Synchronisierung wurde neu gestartet und anschließend
                      bestätigt.
                    </p>
                  ) : null}
                  {repairState === "partial" ? (
                    <p role="status">
                      Die Synchronisierung läuft weiter. Bitte später erneut
                      prüfen.
                    </p>
                  ) : null}
                  {repairState === "rate_limited" ? (
                    <p role="status">
                      Diese Reparatur wurde kürzlich bereits versucht. Bitte
                      später erneut prüfen.
                    </p>
                  ) : null}
                  {repairState === "failed" ? (
                    <p role="status">
                      Die Reparatur konnte nicht sicher bestätigt werden. Bitte
                      die Verbindungseinstellungen öffnen.
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <p>
                    Diese Verbindung benötigt eine erneute Anmeldung oder
                    Berechtigungsprüfung. Das kann FanMind nicht ohne deine
                    bewusste Provider-Anmeldung erledigen.
                  </p>
                  <button
                    type="button"
                    disabled={checkState === "loading"}
                    onClick={() =>
                      void recheckConnection(selectedConnection.platform)
                    }
                  >
                    Verbindung erneut prüfen (ohne Änderungen)
                  </button>
                  {checkState === "loading" ? (
                    <p role="status">Verbindung wird geprüft …</p>
                  ) : null}
                  {checkState === "connected" ? (
                    <p role="status">
                      Verbindung bestätigt. Es wurden keine Einstellungen
                      geändert.
                    </p>
                  ) : null}
                  {checkState === "attention_required" ? (
                    <p role="status">
                      Verbindung weiterhin nicht bestätigt. Bitte die
                      Verbindungseinstellungen prüfen.
                    </p>
                  ) : null}
                  {checkState === "unavailable" ? (
                    <p role="status">
                      Die automatische Prüfung ist derzeit nicht verfügbar.
                    </p>
                  ) : null}
                  <a href="/channels">Zu den Verbindungseinstellungen</a>
                </>
              )}
              <div>
                <button type="button" onClick={() => setSelectedProvider(null)}>
                  Zurück zur Übersicht
                </button>
              </div>
            </section>
          ) : null}
          <p>
            Automatische Reparaturen sind auf bestätigte, sichere Aktionen
            begrenzt. OAuth, Berechtigungen und Zugangsdaten bleiben immer
            manuell.
          </p>
          <a href="/channels">Kanäle öffnen</a>
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={() => setOpen(false)}>
              Schließen
            </button>
          </div>
        </section>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="fanmind-inapp-help-panel"
        onClick={() => {
          if (!open) {
            setDiagnosticState("loading");
            setConnections([]);
            setSelectedProvider(null);
            setRepairConsent(false);
            setRepairRequestId(null);
            setRepairState("idle");
            setCheckState("idle");
          }
          setOpen((current) => !current);
        }}
        style={{
          background: "#0877d9",
          color: "#fff",
          border: 0,
          borderRadius: 24,
          padding: "12px 18px",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {open ? "Hilfe schließen" : "Hilfe"}
      </button>
    </aside>
  );
}
