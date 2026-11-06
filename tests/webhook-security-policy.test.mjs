import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildMetaWebhookDiagnosticPayload,
  evaluateWebhookSecret,
  minimizeWebhookDiagnosticPayload,
  normalizeWhatsAppCloudDiagnosticPayload,
  normalizeWebhookErrorCode,
  validateMetaHmacSignature,
  validateMetaVerifyToken,
  validateStaticWebhookSecret,
} from "../src/lib/webhookSecurityPolicy.mjs";

const production = {
  NODE_ENV: "production",
  FANMIND_RUNTIME_ENVIRONMENT: "production",
};
const development = { NODE_ENV: "development" };
const secret = "webhook-test-secret-that-is-long-enough-2026";

test("production webhook secrets fail closed while local development remains explicit", () => {
  assert.deepEqual(
    evaluateWebhookSecret({ secret: "", environment: production }),
    {
      configured: false,
      acceptable: false,
      secret: null,
      errorCode: "secret_not_configured",
    },
  );
  assert.deepEqual(
    evaluateWebhookSecret({ secret: "", environment: development }),
    {
      configured: false,
      acceptable: true,
      secret: null,
      errorCode: null,
    },
  );
  assert.equal(
    validateStaticWebhookSecret({
      configuredSecret: "",
      receivedSecret: null,
      environment: production,
    }).ok,
    false,
  );
  assert.equal(
    validateStaticWebhookSecret({
      configuredSecret: "",
      receivedSecret: null,
      environment: development,
    }).ok,
    true,
  );
});

test("Meta HMAC and verify-token checks are strict and timing-safe compatible", () => {
  const body = JSON.stringify({ object: "page" });
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  assert.deepEqual(
    validateMetaHmacSignature({
      rawBody: body,
      signatureHeader: signature,
      configuredSecret: secret,
      environment: production,
    }),
    { ok: true, errorCode: null },
  );
  assert.equal(
    validateMetaHmacSignature({
      rawBody: body,
      signatureHeader: "sha256=not-hex",
      configuredSecret: secret,
      environment: production,
    }).ok,
    false,
  );
  assert.equal(
    validateMetaHmacSignature({
      rawBody: `${body}changed`,
      signatureHeader: signature,
      configuredSecret: secret,
      environment: production,
    }).ok,
    false,
  );

  assert.equal(
    validateMetaVerifyToken({
      configuredToken: secret,
      receivedToken: secret,
      environment: production,
    }).ok,
    true,
  );
  assert.equal(
    validateMetaVerifyToken({
      configuredToken: "",
      receivedToken: "",
      environment: production,
    }).errorCode,
    "verify_token_not_configured",
  );
});

test("recursive diagnostic minimization removes text, identifiers and credentials", () => {
  const raw = {
    sender: { id: "123456", username: "private-user" },
    message: {
      text: "This is private message content",
      access_token: "very-secret-token",
      attachments: [
        {
          type: "image",
          payload: { url: "https://example.invalid/private.jpg" },
        },
      ],
    },
    nested: {
      password: "secret-password",
      profile: { email: "person@example.com", enabled: true },
    },
  };

  const minimized = minimizeWebhookDiagnosticPayload(raw);
  const serialized = JSON.stringify(minimized);

  assert.doesNotMatch(serialized, /123456|private-user|private message/u);
  assert.doesNotMatch(serialized, /very-secret-token|secret-password/u);
  assert.doesNotMatch(serialized, /person@example\.com|private\.jpg/u);
  assert.match(serialized, /\[identifier_present\]/u);
  assert.match(serialized, /\[text_present\]/u);
  assert.match(serialized, /\[redacted\]/u);
  assert.match(serialized, /\[truncated\]/u);
  assert.equal(minimized.nested.profile.enabled, true);
  assert.deepEqual(
    minimizeWebhookDiagnosticPayload({
      url: "https://example.invalid/private.jpg",
    }),
    { url: "[url_present]" },
  );
});

test("validated WhatsApp diagnostics preserve only bounded counters", () => {
  const diagnostic = {
    schema_version: 1,
    connector_whatsapp_cloud: true,
    event_count: 2,
    saved_count: 1,
    duplicate_count: 0,
    unsupported_count: 1,
    processing_blocked: false,
    schema_ready: true,
  };
  assert.deepEqual(normalizeWhatsAppCloudDiagnosticPayload(diagnostic), diagnostic);
  assert.equal(
    normalizeWhatsAppCloudDiagnosticPayload({ ...diagnostic, event_count: 26 }),
    null,
  );
  assert.equal(
    normalizeWhatsAppCloudDiagnosticPayload({ ...diagnostic, sender_id: "secret" }),
    null,
  );
});

test("Meta diagnostic payload keeps only aggregate shape and presence flags", () => {
  const payload = buildMetaWebhookDiagnosticPayload({
    sourcePlatform: "instagram",
    eventType: "messages",
    messageType: "dm",
    direction: "inbound",
    messageKind: "mixed",
    content: "Sensitive message",
    attachments: [
      { type: "image", url: "https://example.invalid/a" },
      { type: "image", url: "https://example.invalid/b" },
      { type: "video", url: "https://example.invalid/c" },
    ],
    sourceUrl: "https://example.invalid/source",
    replyTargetUrl: "https://example.invalid/reply",
    pageId: "page-1",
    senderId: "sender-1",
    recipientId: "recipient-1",
    externalMessageId: "message-1",
    externalThreadId: "thread-1",
    externalPostId: null,
    externalCommentId: null,
    rawEvent: {
      sender: { id: "sender-1" },
      message: { text: "Sensitive message" },
    },
  });
  const serialized = JSON.stringify(payload);

  assert.equal(payload.has_text, true);
  assert.equal(payload.attachment_count, 3);
  assert.deepEqual(payload.attachment_types, ["image", "video"]);
  assert.equal(payload.identifiers_present.sender, true);
  assert.doesNotMatch(serialized, /Sensitive message|sender-1|page-1/u);
});

test("only reviewed machine-readable error codes can cross the boundary", () => {
  assert.equal(
    normalizeWebhookErrorCode("message_persist_failed"),
    "message_persist_failed",
  );
  assert.equal(
    normalizeWebhookErrorCode("database password leaked: abc"),
    "processing_failed",
  );
});

test("idempotency conflict remains a reviewed diagnostic error code", () => {
  assert.equal(
    normalizeWebhookErrorCode("idempotency_conflict"),
    "idempotency_conflict",
  );
});

test("Meta and Telegram routes contain no fail-open secret path or free provider error output", async () => {
  const [metaRoute, telegramRoute, telegramProcessor] = await Promise.all([
    readFile("src/app/api/webhooks/meta/route.ts", "utf8"),
    readFile("src/app/api/integrations/telegram/webhook/route.ts", "utf8"),
    readFile("src/lib/telegramWebhook.ts", "utf8"),
  ]);

  assert.match(metaRoute, /validateMetaHmacSignature/u);
  assert.match(metaRoute, /secret_not_configured[\s\S]*503/u);
  assert.doesNotMatch(metaRoute, /if \(!appSecret\) return true/u);
  assert.doesNotMatch(metaRoute, /result\.error\b/u);

  assert.match(telegramRoute, /validateStaticWebhookSecret/u);
  assert.match(telegramRoute, /secret_not_configured[\s\S]*503/u);
  assert.doesNotMatch(telegramRoute, /error: result\.error/u);
  assert.doesNotMatch(telegramRoute, /error: workspace\.error/u);
  assert.doesNotMatch(telegramProcessor, /error\?: string/u);
  assert.doesNotMatch(telegramProcessor, /rawUpdate/u);
});
