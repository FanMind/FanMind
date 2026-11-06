import type { PilotInquiry } from "@/lib/inquiries";

const DEFAULT_NOTIFICATION_TO = "Fanmind@fanmind.ch";
const SUBJECT = "Neue FanMind Pilot-Anfrage";

type NotificationResult = { sent: boolean; provider: string | null; error: string | null };

function textBody(inquiry: PilotInquiry): string {
  return [
    "Neue FanMind Pilot-Anfrage",
    "",
    `E-Mail: ${inquiry.email}`,
    inquiry.name ? `Name: ${inquiry.name}` : null,
    inquiry.message ? `Nachricht / Use Case: ${inquiry.message}` : null,
    `Quelle: ${inquiry.source}`,
    `Zeitpunkt: ${inquiry.created_at ?? new Date().toISOString()}`,
  ].filter(Boolean).join("\n");
}

export function getInquiryNotificationConfigStatus(): string {
  if (process.env.RESEND_API_KEY) return "Resend API ist konfiguriert.";
  return "Kein Mail-Provider konfiguriert. Setze RESEND_API_KEY, um Pilot-Anfrage-Benachrichtigungen zu senden.";
}

export async function sendPilotInquiryNotification(inquiry: PilotInquiry): Promise<NotificationResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { sent: false, provider: null, error: "RESEND_API_KEY ist nicht konfiguriert." };

  const from = process.env.FANMIND_NOTIFICATION_FROM || "FanMind <noreply@fanmind.ch>";
  const to = process.env.FANMIND_INQUIRY_TO || DEFAULT_NOTIFICATION_TO;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject: SUBJECT, reply_to: inquiry.email, text: textBody(inquiry) }),
    cache: "no-store",
  });

  if (!response.ok) return { sent: false, provider: "resend", error: `Resend konnte nicht senden (${response.status}).` };
  return { sent: true, provider: "resend", error: null };
}
