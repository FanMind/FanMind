"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import styles from "./account-deletion.module.css";

const REQUEST_PHRASE = "KONTO LÖSCHEN";
const CANCEL_PHRASE = "LÖSCHANFRAGE ABBRECHEN";

type PublicDeletionRequest = {
  id?: string;
  status: string;
  requestedAt?: string;
  processingDeadlineAt?: string;
  requiresOwnershipTransfer?: boolean;
  requiresSubscriptionResolution?: boolean;
  cancellable: boolean;
};

type ApiPayload = {
  ok?: boolean;
  request?: PublicDeletionRequest;
  message?: string;
  error?: string;
};

function formatDate(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleDateString("de-DE", {
        year: "numeric",
        month: "long",
        day: "2-digit",
      });
}

function statusLabel(status: string) {
  if (status === "pending") return "Aufgenommen";
  if (status === "blocked") return "Klärung erforderlich";
  if (status === "processing") return "In Bearbeitung";
  return status === "none" ? "Keine aktive Anfrage" : "Status wird geprüft";
}

export function AccountDeletionClient({
  accountEmail,
  workspaceName,
}: {
  accountEmail: string;
  workspaceName: string | null;
}) {
  const [request, setRequest] = useState<PublicDeletionRequest>({
    status: "none",
    cancellable: false,
  });
  const [emailConfirmation, setEmailConfirmation] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [cancelConfirmation, setCancelConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/account-deletion", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as ApiPayload | null;
        if (!active) return;
        if (!response.ok || !payload?.request) {
          setError(payload?.error ?? "Der Löschstatus konnte nicht geladen werden.");
          return;
        }
        setRequest(payload.request);
      })
      .catch(() => {
        if (active) setError("Der Löschstatus konnte nicht geladen werden.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const hasActiveRequest = useMemo(
    () => ["pending", "blocked", "processing"].includes(request.status),
    [request.status],
  );

  async function submitDeletionRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/account-deletion", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ emailConfirmation, confirmation }),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload | null;
      if (!response.ok || !payload?.request) {
        setError(payload?.error ?? "Die Löschanfrage konnte nicht aufgenommen werden.");
        return;
      }
      setRequest(payload.request);
      setConfirmation("");
      setSuccess(payload.message ?? "Die Löschanfrage wurde aufgenommen.");
    } catch {
      setError("Die Löschanfrage konnte nicht aufgenommen werden.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelDeletionRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!request.id) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/account-deletion", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          requestId: request.id,
          confirmation: cancelConfirmation,
        }),
      });
      const payload = (await response.json().catch(() => null)) as ApiPayload | null;
      if (!response.ok) {
        setError(payload?.error ?? "Die Löschanfrage konnte nicht widerrufen werden.");
        return;
      }
      setRequest({ status: "none", cancellable: false });
      setCancelConfirmation("");
      setEmailConfirmation("");
      setSuccess(payload?.message ?? "Die Löschanfrage wurde widerrufen.");
    } catch {
      setError("Die Löschanfrage konnte nicht widerrufen werden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Einstellungen · Datenschutz</p>
        <h1>Account und zugehörige Daten löschen</h1>
        <p>
          Diese Funktion leitet die vollständige Löschung des angemeldeten
          FanMind-Accounts ein. Sie ist von einer Abo-Kündigung getrennt und bietet
          keine bloße Deaktivierung an.
        </p>
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {success ? <p className={styles.success} role="status">{success}</p> : null}

      {loading ? (
        <section className={styles.card} aria-live="polite">
          <p>Löschstatus wird sicher geladen…</p>
        </section>
      ) : hasActiveRequest ? (
        <>
          <section className={styles.card} aria-labelledby="deletion-status-title">
            <h2 id="deletion-status-title">Aktive Löschanfrage</h2>
            <div className={styles.statusGrid}>
              <div className={styles.statusItem}>
                <span>Status</span>
                <strong>{statusLabel(request.status)}</strong>
              </div>
              <div className={styles.statusItem}>
                <span>Aufgenommen</span>
                <strong>{formatDate(request.requestedAt)}</strong>
              </div>
              <div className={styles.statusItem}>
                <span>Späteste Bearbeitung</span>
                <strong>{formatDate(request.processingDeadlineAt)}</strong>
              </div>
              <div className={styles.statusItem}>
                <span>Workspace</span>
                <strong>{workspaceName ?? "Kein Workspace"}</strong>
              </div>
            </div>
            {request.requiresOwnershipTransfer ? (
              <p>
                Der Workspace hat weitere Mitglieder. Vor der Löschung muss die
                Verantwortung geklärt oder übertragen werden; fremde Workspace-Daten
                werden nicht gelöscht.
              </p>
            ) : null}
            {request.requiresSubscriptionResolution ? (
              <p>
                Ein aktives oder noch laufendes Abo muss vor der destruktiven
                Bearbeitung geklärt werden, damit keine unbeabsichtigte
                Weiterbelastung entsteht.
              </p>
            ) : null}
          </section>

          {request.cancellable ? (
            <section className={`${styles.card} ${styles.warning}`} aria-labelledby="cancel-title">
              <h2 id="cancel-title">Löschanfrage widerrufen</h2>
              <p>
                Solange die Bearbeitung noch nicht begonnen hat, kannst du die
                Anfrage widerrufen. Gib dafür exakt
                {" "}<strong className={styles.phrase}>{CANCEL_PHRASE}</strong> ein.
              </p>
              <form className={styles.form} onSubmit={cancelDeletionRequest}>
                <label className={styles.label}>
                  <span>Bestätigungsphrase</span>
                  <input
                    className={styles.input}
                    value={cancelConfirmation}
                    onChange={(event) => setCancelConfirmation(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    required
                  />
                </label>
                <div className={styles.actions}>
                  <button
                    className={styles.secondary}
                    type="submit"
                    disabled={busy || cancelConfirmation !== CANCEL_PHRASE}
                  >
                    Löschanfrage widerrufen
                  </button>
                </div>
              </form>
            </section>
          ) : null}
        </>
      ) : (
        <section className={`${styles.card} ${styles.danger}`} aria-labelledby="request-title">
          <h2 id="request-title">Vollständige Löschung einleiten</h2>
          <p>
            Account-E-Mail: <strong>{accountEmail}</strong>. Der Prozess entfernt
            den Login und die zugehörigen nicht aufbewahrungspflichtigen Daten aus
            dem aktiven FanMind-System. Die maximale Bearbeitungsfrist beträgt 30
            Tage.
          </p>
          <form className={styles.form} onSubmit={submitDeletionRequest}>
            <label className={styles.label}>
              <span>Account-E-Mail zur Bestätigung</span>
              <input
                className={styles.input}
                type="email"
                value={emailConfirmation}
                onChange={(event) => setEmailConfirmation(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label className={styles.label}>
              <span>
                Gib exakt <strong className={styles.phrase}>{REQUEST_PHRASE}</strong> ein
              </span>
              <input
                className={styles.input}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                required
              />
            </label>
            <div className={styles.actions}>
              <button
                className={styles.dangerButton}
                type="submit"
                disabled={
                  busy ||
                  confirmation !== REQUEST_PHRASE ||
                  emailConfirmation.trim().toLowerCase() !== accountEmail.toLowerCase()
                }
              >
                Vollständige Account-Löschung anfragen
              </button>
              <a className={styles.secondary} href="/settings/profile">
                Zurück zum Profil
              </a>
            </div>
          </form>
        </section>
      )}

      <section className={styles.card} aria-labelledby="scope-title">
        <h2 id="scope-title">Sichere Grenzen</h2>
        <ul>
          <li>Keine Service-Role-, Mail- oder Billing-Secrets im Browser.</li>
          <li>Keine Löschung fremder Workspace-Daten.</li>
          <li>Keine automatische Abo-Manipulation als Nebenwirkung.</li>
          <li>
            Rechnungsnachweise und Sicherungskopien können gesetzlichen oder
            technischen Aufbewahrungsfristen unterliegen.
          </li>
        </ul>
        <div className={styles.actions}>
          <a className={styles.secondary} href="/settings/profile/data-export">
            Vorher PDF-Datenauskunft herunterladen
          </a>
          <a className={styles.secondary} href="/account-deletion">
            Öffentliche Prozessbeschreibung
          </a>
        </div>
      </section>
    </div>
  );
}
