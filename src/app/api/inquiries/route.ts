import { NextRequest, NextResponse } from "next/server";
import { createPilotInquiry, isValidInquiryEmail, normalizeInquiryText } from "@/lib/inquiries";
import { sendPilotInquiryNotification } from "@/lib/inquiryNotifications";
import {
  isTrustedFanMindMutationRequest,
  readBoundedJsonRequest,
} from "@/lib/httpMutationPolicy.mjs";
import { getClientIp } from "@/lib/rateLimit";
import { consumeSharedRateLimit } from "@/lib/sharedRateLimit";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const EMAIL_MAX_LENGTH = 254;
const NAME_MAX_LENGTH = 160;
const MESSAGE_MAX_LENGTH = 2000;
const SOURCE_MAX_LENGTH = 120;
const MAX_INQUIRY_BODY_BYTES = 8_000;

type InquiryBody = {
  email?: unknown;
  name?: unknown;
  message?: unknown;
  source?: unknown;
  company?: unknown;
};

export async function POST(request: NextRequest) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json({ error: "ORIGIN_FORBIDDEN" }, { status: 403 });
  }
  const parsedBody = await readBoundedJsonRequest(request, MAX_INQUIRY_BODY_BYTES);
  if (!parsedBody.ok) {
    return NextResponse.json(
      { error: parsedBody.reason === "payload_too_large" ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR" },
      { status: parsedBody.reason === "payload_too_large" ? 413 : 400 },
    );
  }
  const body = parsedBody.value as InquiryBody | null;
  if (!body) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });

  const honeypot = normalizeInquiryText(body.company, 160);
  if (honeypot) {
    return NextResponse.json({ ok: true, notificationSent: false });
  }

  let rateLimit;
  try {
    rateLimit = await consumeSharedRateLimit({
      scope: "inquiry_ip",
      subject: getClientIp(request),
      maxRequests: MAX_REQUESTS_PER_WINDOW,
      windowMs: WINDOW_MS,
    });
  } catch {
    console.error("FanMind inquiry rate limit unavailable.");
    return NextResponse.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
  }

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const email = normalizeInquiryText(body.email, EMAIL_MAX_LENGTH)?.toLowerCase() ?? "";
  if (!email || !isValidInquiryEmail(email)) {
    return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 });
  }

  const name = normalizeInquiryText(body.name, NAME_MAX_LENGTH);
  const message = normalizeInquiryText(body.message, MESSAGE_MAX_LENGTH);
  const source = normalizeInquiryText(body.source, SOURCE_MAX_LENGTH) ?? "landing_footer";

  const { inquiry, error } = await createPilotInquiry({ email, name, message, source }).catch(() => ({
    inquiry: null,
    error: "INQUIRY_SAVE_FAILED",
  }));
  if (error || !inquiry) {
    console.error("FanMind inquiry could not be persisted.");
    return NextResponse.json({ error: "INQUIRY_SAVE_FAILED" }, { status: 500 });
  }

  const notification = await sendPilotInquiryNotification(inquiry).catch(() => ({
    sent: false,
    provider: "resend",
    error: "NOTIFICATION_FAILED",
  }));
  if (notification.error) {
    console.error("FanMind inquiry notification could not be sent.");
  }

  return NextResponse.json({ ok: true, notificationSent: notification.sent });
}
