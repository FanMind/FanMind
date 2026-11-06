import { processTelegramWebhookUpdate } from "@/lib/telegramWebhook";
import {
  normalizeWebhookErrorCode,
  validateStaticWebhookSecret,
} from "@/lib/webhookSecurityPolicy.mjs";

const MAX_WEBHOOK_BODY_BYTES = 1_000_000;

export async function POST(request: Request) {
  const secretValidation = validateStaticWebhookSecret({
    configuredSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
    receivedSecret: request.headers.get("X-Telegram-Bot-Api-Secret-Token"),
  });
  if (!secretValidation.ok) {
    const errorCode = normalizeWebhookErrorCode(secretValidation.errorCode);
    if (errorCode === "secret_not_configured") {
      console.error("Telegram webhook validation unavailable", { errorCode });
    }
    return Response.json(
      {
        ok: false,
        error:
          errorCode === "secret_not_configured"
            ? "webhook_unavailable"
            : "unauthorized",
      },
      { status: errorCode === "secret_not_configured" ? 503 : 401 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BODY_BYTES) {
    return Response.json(
      { ok: false, error: "invalid_payload" },
      { status: 413 },
    );
  }

  let update: unknown;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BODY_BYTES) {
      return Response.json(
        { ok: false, error: "invalid_payload" },
        { status: 413 },
      );
    }
    update = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return Response.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const result = await processTelegramWebhookUpdate(update);
  const errorCode = result.errorCode
    ? normalizeWebhookErrorCode(result.errorCode)
    : null;

  if (errorCode && !result.skipped) {
    console.error("Telegram webhook processing failed", {
      reason: result.reason ?? "processing_failed",
      errorCode,
    });
    return Response.json(
      { ok: false, error: "processing_failed" },
      { status: 500 },
    );
  }

  if (result.skipped && result.reason === "no_workspace") {
    console.warn("Telegram webhook skipped without workspace mapping", {
      reason: result.reason,
      errorCode: errorCode ?? "workspace_not_configured",
    });
  }

  return Response.json({
    ok: true,
    saved: result.saved,
    skipped: result.skipped,
  });
}
