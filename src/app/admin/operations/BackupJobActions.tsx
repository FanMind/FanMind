"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../billing/adminBilling.module.css";

const actions = [
  ["backup_server_config", "Server-Konfiguration"],
  ["backup_database", "Datenbank"],
  ["backup_storage", "Storage"],
  ["backup_full", "Vollbackup"],
  ["verify_backup", "Letztes Backup prüfen"],
] as const;

function errorMessage(error: string | undefined) {
  if (error === "backup_job_rate_limited") {
    return "Zu viele manuelle Backup-Aktionen. Bitte warte kurz und versuche es erneut.";
  }
  if (error === "operations_rate_limit_unavailable") {
    return "Die Sicherheitsprüfung ist gerade nicht verfügbar. Es wurde kein Job eingereiht.";
  }
  return error ?? "Job konnte nicht eingereiht werden";
}

export function BackupJobActions() {
  const router = useRouter();
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState<string>("");
  const [pendingAction, setPendingAction] = useState<(typeof actions)[number] | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const submitLockRef = useRef(false);

  const closeConfirmation = useCallback(() => {
    setPendingAction(null);
    window.setTimeout(() => returnFocusRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (!pendingAction) return;
    confirmButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeConfirmation();
        return;
      }

      if (event.key === "Tab") {
        const dialog = dialogRef.current;
        const focusableElements = Array.from(
          dialog?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ) ?? [],
        );
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements.at(-1);
        const activeElement = document.activeElement;

        if (!dialog || !firstFocusable || !lastFocusable) return;
        if (event.shiftKey && (activeElement === firstFocusable || !dialog.contains(activeElement))) {
          event.preventDefault();
          lastFocusable.focus();
        } else if (!event.shiftKey && (activeElement === lastFocusable || !dialog.contains(activeElement))) {
          event.preventDefault();
          firstFocusable.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeConfirmation, pendingAction]);

  function openConfirmation(
    action: (typeof actions)[number],
    trigger: HTMLButtonElement,
  ) {
    setMessage("");
    returnFocusRef.current = trigger;
    setPendingAction(action);
  }

  async function enqueue() {
    if (!pendingAction || submitLockRef.current) return;
    submitLockRef.current = true;
    const [jobType] = pendingAction;
    setBusy(jobType); setMessage("");
    const idempotencyKey = jobType === "verify_backup"
      ? `manual:${jobType}:${globalThis.crypto.randomUUID()}`
      : `manual:${jobType}:${new Date().toISOString().slice(0,10)}`;
    try {
      const response = await fetch("/api/admin/operations/backup-jobs", { method:"POST", headers:{ "Content-Type":"application/json", "Idempotency-Key": idempotencyKey }, body:JSON.stringify({ jobType }) });
      const body = await response.json().catch(() => ({})) as { message?: string; error?: string };
      setMessage(response.ok ? (body.message ?? "Job wurde eingereiht") : errorMessage(body.error));
      if (response.ok) router.refresh();
    } catch {
      setMessage("Job konnte nicht eingereiht werden");
    } finally {
      submitLockRef.current = false;
      setBusy("");
      setPendingAction(null);
      window.setTimeout(() => returnFocusRef.current?.focus(), 0);
    }
  }

  const pendingJobType = pendingAction?.[0];
  const pendingLabel = pendingAction?.[1];
  const isVerification = pendingJobType === "verify_backup";

  return (
    <div className={styles.actions}>
      {actions.map((action) => {
        const [jobType, label] = action;
        return (
          <button
            key={jobType}
            type="button"
            className={styles.buttonSecondary}
            disabled={Boolean(busy)}
            onClick={(event) => openConfirmation(action, event.currentTarget)}
          >
            {busy === jobType
              ? "Wird eingereiht…"
              : jobType === "verify_backup"
                ? label
                : `${label} anfordern`}
          </button>
        );
      })}

      {message ? <p className={styles.emptyState}>{message}</p> : null}

      {pendingAction ? (
        <div
          className={styles.confirmationBackdrop}
          onMouseDown={closeConfirmation}
        >
          <section
            ref={dialogRef}
            className={styles.confirmationDialog}
            role="dialog"
            aria-modal="true"
            aria-busy={Boolean(busy)}
            aria-labelledby="backup-job-confirm-title"
            aria-describedby="backup-job-confirm-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className={styles.confirmationCloseButton}
              type="button"
              aria-label={busy ? "Dialog schließen" : "Backup-Aktion abbrechen"}
              onClick={closeConfirmation}
            >
              ×
            </button>
            <h2 id="backup-job-confirm-title">
              {isVerification
                ? "Letztes Backup prüfen?"
                : `${pendingLabel}-Backup einreihen?`}
            </h2>
            <p id="backup-job-confirm-description">
              {isVerification
                ? "FanMind prüft das neueste lokale Backup im Modus checksum-only, also ausschließlich per Prüfsumme. Es findet kein Restore und keine Entschlüsselung statt; der private Schlüssel bleibt außerhalb von Production."
                : "Die Web-App startet keinen Shell-Befehl. Sie reiht nur den geprüften Auftrag ein; der externe Backup-Worker verarbeitet ihn anschließend."}
            </p>
            <div className={styles.confirmationActions}>
              <button
                ref={confirmButtonRef}
                className={styles.confirmationPrimaryButton}
                type="button"
                onClick={enqueue}
                disabled={Boolean(busy)}
              >
                {busy
                  ? "Wird eingereiht…"
                  : isVerification
                    ? "Prüfung starten"
                    : "Backup einreihen"}
              </button>
              <button
                className={styles.confirmationSecondaryButton}
                type="button"
                onClick={closeConfirmation}
              >
                {busy ? "Dialog schließen" : "Abbrechen"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
