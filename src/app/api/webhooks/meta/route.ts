import { processMetaWebhookPayload } from "@/lib/metaWebhook";
import {
  normalizeWebhookErrorCode,
  validateMetaHmacSignature,
  validateMetaVerifyToken,
} from "@/lib/webhookSecurityPolicy.mjs";

export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const validation = validateMetaVerifyToken({
    configuredToken: getWebhookVerifyToken(),
    receivedToken: verifyToken,
  });

  if (validation.errorCode === "verify_token_not_configured") {
    console.error("Meta webhook verification unavailable", {
      errorCode: validation.errorCode,
    });
    return Response.json(
      { received: false, error: "webhook_unavailable" },
      { status: 503 },
    );
  }

  if (mode === "subscribe" && validation.ok && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  }

  return Response.json(
    { received: false, error: "verification_failed" },
    { status: 403 },
  );
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BODY_BYTES) {
    return Response.json(
      { received: false, error: "invalid_payload" },
      { status: 413 },
    );
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BODY_BYTES) {
    return Response.json(
      { received: false, error: "invalid_payload" },
      { status: 413 },
    );
  }

  const webhookSecrets = getWebhookAppSecrets();
  if (!webhookSecrets.length) {
    const errorCode = normalizeWebhookErrorCode("secret_not_configured");
    if (errorCode === "secret_not_configured") {
      console.error("Meta webhook signature validation unavailable", {
        errorCode,
      });
    }
    return Response.json(
      {
        received: false,
        error: "webhook_unavailable",
      },
      { status: 503 },
    );
  }

  const signatureValid = webhookSecrets.some((configuredSecret) =>
    validateMetaHmacSignature({
      rawBody,
      signatureHeader: request.headers.get("x-hub-signature-256"),
      configuredSecret,
    }).ok,
  );
  if (!signatureValid) {
    return Response.json(
      { received: false, error: "invalid_signature" },
      { status: 403 },
    );
  }

  let payload: unknown;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return Response.json(
      { received: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const result = await processMetaWebhookPayload(payload);
  const errorCode = result.errorCode
    ? normalizeWebhookErrorCode(result.errorCode)
    : null;

  if (errorCode) {
    console.error("Meta webhook processing failed", {
      eventCount: result.eventCount,
      saved: result.saved,
      skipped: result.skipped,
      errorCode,
    });
  } else {
    console.info("Meta webhook processed", {
      eventCount: result.eventCount,
      saved: result.saved,
      skipped: result.skipped,
    });
  }

  return Response.json(
    {
      received: !errorCode,
      saved: result.saved,
      skipped: result.skipped,
      error: errorCode ? "processing_failed" : null,
    },
    { status: errorCode ? 500 : 200 },
  );
}

function getWebhookVerifyToken(): string | undefined {
  return (
    process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN ??
    process.env.META_WEBHOOK_VERIFY_TOKEN
  );
}

function getWebhookAppSecrets(): string[] {
  return [
    process.env.FACEBOOK_APP_SECRET,
    process.env.INSTAGRAM_APP_SECRET,
    process.env.META_WEBHOOK_APP_SECRET,
    process.env.META_APP_SECRET,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index);
}
