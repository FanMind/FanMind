import { processWhatsAppCloudInboundEvents } from "@/lib/whatsappWebhook";
import {
  evaluateWhatsAppCloudInboundRuntime,
  parseWhatsAppCloudInboundPayload,
  readBoundedWhatsAppCloudBody,
  validateWhatsAppCloudSignature,
  validateWhatsAppCloudVerifyToken,
} from "@/lib/whatsappCloudInboundPolicy.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export async function GET(request: Request) {
  if (!evaluateWhatsAppCloudInboundRuntime(process.env).enabled) {
    return unavailableResponse();
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const receivedToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const validation = validateWhatsAppCloudVerifyToken({
    configuredToken: process.env.WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN,
    receivedToken,
  });

  if (validation.errorCode === "verify_token_not_configured") {
    console.error("WhatsApp Cloud webhook verification unavailable", {
      errorCode: "verify_token_not_configured",
    });
    return unavailableResponse();
  }
  if (
    mode === "subscribe" &&
    validation.ok &&
    challenge &&
    challenge.length <= 512 &&
    !/[\u0000-\u001f\u007f]/u.test(challenge)
  ) {
    return new Response(challenge, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        ...NO_STORE_HEADERS,
      },
    });
  }

  return Response.json(
    { received: false, error: "verification_failed" },
    { status: 403, headers: NO_STORE_HEADERS },
  );
}

export async function POST(request: Request) {
  if (!evaluateWhatsAppCloudInboundRuntime(process.env).enabled) {
    return unavailableResponse();
  }

  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    return Response.json(
      { received: false, error: "invalid_payload" },
      { status: 415, headers: NO_STORE_HEADERS },
    );
  }

  const boundedBody = await readBoundedWhatsAppCloudBody(request);
  if (!boundedBody.ok) {
    const status =
      boundedBody.errorCode === "payload_too_large" ? 413 : 400;
    return Response.json(
      { received: false, error: "invalid_payload" },
      { status, headers: NO_STORE_HEADERS },
    );
  }

  const signature = validateWhatsAppCloudSignature({
    rawBody: boundedBody.body,
    signatureHeader: request.headers.get("x-hub-signature-256"),
    configuredAppSecret: process.env.WHATSAPP_CLOUD_APP_SECRET,
  });
  if (signature.errorCode === "app_secret_not_configured") {
    console.error("WhatsApp Cloud webhook signature unavailable", {
      errorCode: "app_secret_not_configured",
    });
    return unavailableResponse();
  }
  if (!signature.ok) {
    return Response.json(
      { received: false, error: "invalid_signature" },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  let payload: unknown;
  try {
    const jsonText = new TextDecoder("utf-8", { fatal: true }).decode(
      boundedBody.body,
    );
    payload = JSON.parse(jsonText);
  } catch {
    return Response.json(
      { received: false, error: "invalid_json" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const parsed = parseWhatsAppCloudInboundPayload(payload);
  if (!parsed.ok) {
    return Response.json(
      { received: false, error: "invalid_payload" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const result = await processWhatsAppCloudInboundEvents({
    events: parsed.events,
    duplicateCount: parsed.duplicateCount,
    unsupportedCount: parsed.unsupportedCount,
  });
  if (result.errorCode) {
    console.error("WhatsApp Cloud webhook processing failed", {
      errorCode: result.errorCode,
      eventCount: result.eventCount,
      savedCount: result.savedCount,
      duplicateCount: result.duplicateCount,
      unsupportedCount: result.unsupportedCount,
    });
  } else {
    console.info("WhatsApp Cloud webhook processed", {
      eventCount: result.eventCount,
      savedCount: result.savedCount,
      duplicateCount: result.duplicateCount,
      unsupportedCount: result.unsupportedCount,
    });
  }

  const unavailable =
    result.errorCode === "schema_not_ready" ||
    result.errorCode === "idempotency_in_progress";
  const conflict = result.errorCode === "idempotency_conflict";
  return Response.json(
    {
      received: !result.errorCode,
      saved: result.saved,
      skipped: result.skipped,
      error: result.errorCode ? "processing_failed" : null,
    },
    {
      status: result.errorCode
        ? unavailable
          ? 503
          : conflict
            ? 409
            : 500
        : 200,
      headers: NO_STORE_HEADERS,
    },
  );
}

function unavailableResponse() {
  return Response.json(
    { received: false, error: "webhook_unavailable" },
    { status: 503, headers: NO_STORE_HEADERS },
  );
}
