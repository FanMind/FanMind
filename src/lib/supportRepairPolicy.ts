/**
 * Repair policy for the FanMind in-app support assistant.
 *
 * This module classifies actions; it does not execute repairs. Any future
 * executor must independently enforce the classification server-side.
 */
export type SupportRepairAction =
  | "check_connection"
  | "refresh_readonly_status"
  | "retry_safe_status_probe"
  | "restart_message_sync"
  | "renew_authorization"
  | "disconnect_connection"
  | "change_permissions"
  | "replace_credentials";

export type SupportRepairPolicy = {
  classification: "automatic" | "confirmation_required";
  reason: string;
};

const policy: Record<SupportRepairAction, SupportRepairPolicy> = {
  check_connection: {
    classification: "automatic",
    reason: "Nur lesende Verbindungsprüfung ohne Änderung am Kundenkonto.",
  },
  refresh_readonly_status: {
    classification: "automatic",
    reason: "Nur lesende Aktualisierung des Status ohne Änderung am Kundenkonto.",
  },
  retry_safe_status_probe: {
    classification: "automatic",
    reason: "Wiederholung einer lesenden Statusprüfung ohne externe Änderung.",
  },
  restart_message_sync: {
    classification: "confirmation_required",
    reason: "Ein Neustart der Synchronisierung kann externe Aufrufe oder Nachrichteneffekte auslösen und benötigt zunächst eine gesonderte Sicherheitsprüfung.",
  },
  renew_authorization: {
    classification: "confirmation_required",
    reason: "Eine neue Anmeldung oder Autorisierung benötigt die ausdrückliche Zustimmung des Kunden.",
  },
  disconnect_connection: {
    classification: "confirmation_required",
    reason: "Das Trennen einer Verbindung kann laufende Funktionen unterbrechen.",
  },
  change_permissions: {
    classification: "confirmation_required",
    reason: "Eine Berechtigungsänderung verändert den Zugriff auf das Kundenkonto.",
  },
  replace_credentials: {
    classification: "confirmation_required",
    reason: "Der Austausch von Zugangsdaten ist ein sicherheitsrelevanter Eingriff.",
  },
};

export function getSupportRepairPolicy(action: string): SupportRepairPolicy | null {
  return Object.prototype.hasOwnProperty.call(policy, action)
    ? policy[action as SupportRepairAction]
    : null;
}
