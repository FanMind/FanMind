type AccountDeletionNotificationResult = {
  sent: boolean;
  errorCode: string | null;
};

const DEFAULT_OPERATIONS_TO = "fanmind@fanmind.ch";

async function sendResendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<AccountDeletionNotificationResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, errorCode: "mail_provider_not_configured" };

  const from =
    process.env.FANMIND_NOTIFICATION_FROM || "FanMind <noreply@fanmind.ch>";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: input.to, subject: input.subject, text: input.text }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);

  if (!response?.ok) return { sent: false, errorCode: "mail_delivery_failed" };
  return { sent: true, errorCode: null };
}

export async function sendAccountDeletionAcknowledgement(input: {
  email: string;
  requestId: string;
  processingDeadlineAt: string;
  requiresOwnershipTransfer: boolean;
  requiresSubscriptionResolution: boolean;
}): Promise<AccountDeletionNotificationResult> {
  const notes = [
    input.requiresOwnershipTransfer
      ? "Vor der Löschung muss die Workspace-Verantwortung geklärt oder übertragen werden."
      : null,
    input.requiresSubscriptionResolution
      ? "Vor der destruktiven Bearbeitung muss ein aktives oder noch laufendes Abo geklärt werden."
      : null,
  ].filter(Boolean);

  return sendResendEmail({
    to: input.email,
    subject: "FanMind Löschanfrage wurde aufgenommen",
    text: [
      "Deine Anfrage zur vollständigen Löschung des FanMind-Accounts wurde authentifiziert aufgenommen.",
      "",
      `Referenz: ${input.requestId}`,
      `Spätester Bearbeitungszeitpunkt: ${input.processingDeadlineAt}`,
      ...notes,
      "",
      "Solange die Bearbeitung noch nicht begonnen hat, kannst du die Anfrage nach erneuter Anmeldung in der App oder im Web widerrufen.",
      "Rechnungs- und gesetzlich aufzubewahrende Nachweise sowie technisch nicht selektiv bearbeitbare Sicherungskopien können den veröffentlichten Aufbewahrungsfristen unterliegen.",
      "",
      "FanMind",
    ].join("\n"),
  });
}

export async function sendAccountDeletionOperationsNotice(input: {
  requestId: string;
  source: "web" | "mobile";
  processingDeadlineAt: string;
  requiresOwnershipTransfer: boolean;
  requiresSubscriptionResolution: boolean;
}): Promise<AccountDeletionNotificationResult> {
  const to =
    process.env.FANMIND_ACCOUNT_DELETION_TO || DEFAULT_OPERATIONS_TO;
  return sendResendEmail({
    to,
    subject: "FanMind Account-Löschanfrage zur Bearbeitung",
    text: [
      "Eine authentifizierte FanMind Account-Löschanfrage liegt vor.",
      "",
      `Request-ID: ${input.requestId}`,
      `Quelle: ${input.source}`,
      `Deadline: ${input.processingDeadlineAt}`,
      `Ownership-Transfer erforderlich: ${input.requiresOwnershipTransfer}`,
      `Subscription-Klärung erforderlich: ${input.requiresSubscriptionResolution}`,
      "",
      "Keine E-Mail-Adresse, User-ID, Tokens oder Kundendaten sind in dieser Benachrichtigung enthalten.",
    ].join("\n"),
  });
}

export async function sendAccountDeletionCompletionNotice(input: {
  email: string;
  requestId: string;
}): Promise<AccountDeletionNotificationResult> {
  return sendResendEmail({
    to: input.email,
    subject: "FanMind Account wurde gelöscht",
    text: [
      "Die vollständige Löschung deines FanMind-Accounts wurde abgeschlossen.",
      "",
      `Referenz: ${input.requestId}`,
      "Der Login ist nicht mehr aktiv. Nicht gesetzlich aufzubewahrende Kontodaten wurden aus dem aktiven FanMind-System entfernt.",
      "Rechnungsnachweise und Sicherungskopien unterliegen den veröffentlichten gesetzlichen beziehungsweise technischen Aufbewahrungsfristen.",
      "",
      "FanMind",
    ].join("\n"),
  });
}
