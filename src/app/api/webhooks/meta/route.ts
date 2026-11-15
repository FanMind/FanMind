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
  const body = await readWebhookBody(request);
  if (!body.ok) return Response.json(
    { received: false, error: "invalid_payload" }, { status: body.status },
  );
  const rawBody = body.text;

  let payload: unknown;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return Response.json(
      { received: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  if (!payload || typeof payload !== "object" ||
      !("object" in payload) || !["page", "instagram"].includes(String(payload.object))) {
    return Response.json({ received: false, error: "invalid_payload" }, { status: 400 });
  }

  const webhookSecrets = getWebhookAppSecrets(String(payload.object));
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

  let result;
  try { result = await processMetaWebhookPayload(payload); }
  catch {
    console.error("Meta webhook processing failed", { errorCode: "processing_failed" });
    return Response.json({ received: false, error: "processing_failed" }, { status: 500 });
  }
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

// Bound chunked requests before allocation/HMAC; a stalled sender cannot hold
// this endpoint indefinitely. Never log rejected bodies or provider exceptions.
async function readWebhookBody(request: Request): Promise<
  { ok: true; text: string } | { ok: false; status: number }
> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/u.test(declared) || !Number.isSafeInteger(Number(declared)))) {
    return { ok: false, status: 400 };
  }
  if (declared && Number(declared) > MAX_WEBHOOK_BODY_BYTES) return { ok: false, status: 413 };
  if (!request.body) return { ok: true, text: "" };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("body_timeout")), 5000);
  });
  try {
    while (true) {
      const part = await Promise.race([reader.read(), timeout]);
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_WEBHOOK_BODY_BYTES) return { ok: false, status: 413 };
      chunks.push(part.value);
    }
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)) };
  } catch { return { ok: false, status: 400 }; }
  finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}

function getWebhookVerifyToken(): string | undefined {
  return (
    process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN ??
    process.env.META_WEBHOOK_VERIFY_TOKEN
  );
}

function getWebhookAppSecrets(object: string): string[] {
  // Provider-specific App secrets cannot authenticate the other envelope.
  // META aliases deliberately represent an explicitly shared Meta App only.
  return [
    object === "page" ? process.env.FACEBOOK_APP_SECRET : process.env.INSTAGRAM_APP_SECRET,
    process.env.META_WEBHOOK_APP_SECRET,
    process.env.META_APP_SECRET,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index);
}
