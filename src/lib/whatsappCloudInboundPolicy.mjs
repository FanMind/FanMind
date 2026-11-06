import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const WHATSAPP_CLOUD_MAX_BODY_BYTES = 256 * 1024;
export const WHATSAPP_CLOUD_MAX_ENTRIES = 8;
export const WHATSAPP_CLOUD_MAX_CHANGES_PER_ENTRY = 8;
export const WHATSAPP_CLOUD_MAX_MESSAGES = 25;
export const WHATSAPP_CLOUD_MAX_CONTACTS_PER_CHANGE = 25;
export const WHATSAPP_CLOUD_MAX_DISTINCT_PHONE_NUMBER_IDS = 4;
export const WHATSAPP_CLOUD_MAX_TEXT_LENGTH = 4096;

const MAX_SECRET_LENGTH = 4096;
const MAX_IDENTIFIER_LENGTH = 512;
const MAX_PROFILE_NAME_LENGTH = 160;
const MIN_RECEIVED_AT_MILLISECONDS = Date.parse("2000-01-01T00:00:00.000Z");
const MAX_RECEIVED_AT_FUTURE_SKEW_MILLISECONDS = 24 * 60 * 60 * 1000;
const NON_PRODUCTION_RUNTIMES = new Set(["development", "test", "staging"]);
const PHONE_NUMBER_ID_PATTERN = /^[1-9][0-9]{5,31}$/u;
const WHATSAPP_USER_ID_PATTERN = /^[1-9][0-9]{5,31}$/u;
const MESSAGE_TIMESTAMP_PATTERN = /^[0-9]{10}$/u;
const SAFE_IDENTIFIER_PATTERN = /^[^\u0000-\u001f\u007f]{1,512}$/u;
const WHATSAPP_MESSAGE_ID_PATTERN = /^wamid\.[A-Za-z0-9+/_=-]{1,505}$/u;
const MESSAGE_TYPE_PATTERN = /^[a-z][a-z_]{0,31}$/u;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function exactText(value) {
  return typeof value === "string" && value === value.trim() ? value : "";
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function boundedIdentifier(value) {
  const candidate = exactText(value);
  return candidate.length <= MAX_IDENTIFIER_LENGTH &&
    SAFE_IDENTIFIER_PATTERN.test(candidate)
    ? candidate
    : null;
}

function phoneNumberId(value) {
  const candidate = exactText(value);
  return PHONE_NUMBER_ID_PATTERN.test(candidate) ? candidate : null;
}

function whatsappUserId(value) {
  const candidate = exactText(value);
  return WHATSAPP_USER_ID_PATTERN.test(candidate) ? candidate : null;
}

function whatsappMessageId(value) {
  const candidate = exactText(value);
  return WHATSAPP_MESSAGE_ID_PATTERN.test(candidate) ? candidate : null;
}

function receivedAt(value, nowMilliseconds) {
  const candidate = exactText(value);
  if (!MESSAGE_TIMESTAMP_PATTERN.test(candidate)) return null;
  const numeric = Number(candidate);
  const milliseconds = numeric * 1000;
  const date = new Date(milliseconds);
  if (
    !Number.isFinite(date.getTime()) ||
    milliseconds < MIN_RECEIVED_AT_MILLISECONDS ||
    milliseconds > nowMilliseconds + MAX_RECEIVED_AT_FUTURE_SKEW_MILLISECONDS
  ) {
    return null;
  }
  return date.toISOString();
}

function safeProfileName(value) {
  const candidate = clean(value);
  if (
    !candidate ||
    candidate.length > MAX_PROFILE_NAME_LENGTH ||
    /[\u0000-\u001f\u007f]/u.test(candidate)
  ) {
    return null;
  }
  return candidate;
}

function fixedCount(value, maximum = WHATSAPP_CLOUD_MAX_MESSAGES) {
  return Number.isInteger(value) && value >= 0
    ? Math.min(value, maximum)
    : 0;
}

export function fingerprintWhatsAppCloudInboundEvent(event) {
  const normalizedValues = [
    event?.sourcePlatform,
    event?.sourceType,
    event?.messageType,
    event?.messageKind,
    event?.direction,
    event?.content,
    event?.externalMessageId,
    event?.externalThreadId,
    event?.authorLabel,
    event?.phoneNumberId,
    event?.senderId,
    event?.receivedAt,
  ];
  if (normalizedValues.some((value) => typeof value !== "string")) {
    throw new TypeError("WhatsApp Cloud normalized event is incomplete.");
  }
  const framed = normalizedValues
    .map((value) => `${Buffer.byteLength(value, "utf8")}:${value}`)
    .join("");
  return createHash("sha256").update(framed, "utf8").digest("hex");
}

export function evaluateWhatsAppCloudInboundRuntime(environment = {}) {
  const runtime = clean(
    environment.FANMIND_RUNTIME_ENVIRONMENT ?? environment.NODE_ENV,
  ).toLowerCase();
  if (!NON_PRODUCTION_RUNTIMES.has(runtime)) {
    return {
      enabled: false,
      reason: runtime === "production" ? "production_forbidden" : "runtime_unknown",
    };
  }
  if (clean(environment.FANMIND_WHATSAPP_CLOUD_INBOUND_ENABLED) !== "true") {
    return { enabled: false, reason: "feature_disabled" };
  }
  return { enabled: true, reason: "enabled_non_production" };
}

export function validateWhatsAppCloudVerifyToken({
  configuredToken,
  receivedToken,
}) {
  const configured =
    typeof configuredToken === "string" ? configuredToken : "";
  if (
    !configured ||
    configured !== configured.trim() ||
    configured.length > MAX_SECRET_LENGTH
  ) {
    return { ok: false, errorCode: "verify_token_not_configured" };
  }
  const received = typeof receivedToken === "string" ? receivedToken : "";
  const configuredBuffer = Buffer.from(configured, "utf8");
  const receivedBuffer = Buffer.from(received, "utf8");
  const ok =
    configuredBuffer.length === receivedBuffer.length &&
    timingSafeEqual(configuredBuffer, receivedBuffer);
  return { ok, errorCode: ok ? null : "invalid_verify_token" };
}

export function validateWhatsAppCloudSignature({
  rawBody,
  signatureHeader,
  configuredAppSecret,
}) {
  const secret =
    typeof configuredAppSecret === "string" ? configuredAppSecret : "";
  if (
    !secret ||
    secret !== secret.trim() ||
    secret.length > MAX_SECRET_LENGTH
  ) {
    return { ok: false, errorCode: "app_secret_not_configured" };
  }
  if (
    !Buffer.isBuffer(rawBody) ||
    typeof signatureHeader !== "string" ||
    !/^sha256=[0-9a-f]{64}$/u.test(signatureHeader)
  ) {
    return { ok: false, errorCode: "invalid_signature" };
  }
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const received = Buffer.from(signatureHeader.slice("sha256=".length), "hex");
  const ok =
    expected.length === received.length && timingSafeEqual(expected, received);
  return { ok, errorCode: ok ? null : "invalid_signature" };
}

export async function readBoundedWhatsAppCloudBody(
  request,
  maximumBytes = WHATSAPP_CLOUD_MAX_BODY_BYTES,
) {
  const lengthHeader = request?.headers?.get?.("content-length");
  if (lengthHeader !== null && lengthHeader !== undefined && lengthHeader !== "") {
    if (!/^[0-9]+$/u.test(lengthHeader)) {
      return { ok: false, errorCode: "invalid_content_length", body: null };
    }
    if (Number(lengthHeader) > maximumBytes) {
      return { ok: false, errorCode: "payload_too_large", body: null };
    }
  }

  const reader = request?.body?.getReader?.();
  if (!reader) return { ok: true, errorCode: null, body: Buffer.alloc(0) };

  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, errorCode: "invalid_body", body: null };
      }
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, errorCode: "payload_too_large", body: null };
      }
      chunks.push(Buffer.from(value));
    }
  } catch {
    return { ok: false, errorCode: "invalid_body", body: null };
  }
  return { ok: true, errorCode: null, body: Buffer.concat(chunks, size) };
}

export function parseWhatsAppCloudInboundPayload(payload, options = {}) {
  const injectedNow = options?.now;
  const injectedNowMilliseconds =
    injectedNow instanceof Date
      ? injectedNow.getTime()
      : Number.isFinite(injectedNow)
        ? injectedNow
        : Number.NaN;
  const nowMilliseconds = Number.isFinite(injectedNowMilliseconds)
    ? injectedNowMilliseconds
    : Date.now();
  if (!isRecord(payload) || payload.object !== "whatsapp_business_account") {
    return invalidPayload("object_invalid");
  }
  if (
    !Array.isArray(payload.entry) ||
    payload.entry.length < 1 ||
    payload.entry.length > WHATSAPP_CLOUD_MAX_ENTRIES
  ) {
    return invalidPayload("entries_invalid");
  }

  const events = [];
  const distinctPhoneNumberIds = new Set();
  let unsupportedCount = 0;
  let duplicateCount = 0;
  let messageCandidateCount = 0;
  const seenMessages = new Map();

  for (const entry of payload.entry) {
    if (!isRecord(entry) || !whatsappUserId(entry.id)) {
      return invalidPayload("entry_invalid");
    }
    if (
      !Array.isArray(entry.changes) ||
      entry.changes.length < 1 ||
      entry.changes.length > WHATSAPP_CLOUD_MAX_CHANGES_PER_ENTRY
    ) {
      return invalidPayload("changes_invalid");
    }

    for (const change of entry.changes) {
      if (!isRecord(change) || change.field !== "messages" || !isRecord(change.value)) {
        return invalidPayload("change_invalid");
      }
      const value = change.value;
      if (value.messaging_product !== "whatsapp" || !isRecord(value.metadata)) {
        return invalidPayload("value_invalid");
      }
      const boundPhoneNumberId = phoneNumberId(value.metadata.phone_number_id);
      if (!boundPhoneNumberId) return invalidPayload("phone_number_id_invalid");
      distinctPhoneNumberIds.add(boundPhoneNumberId);
      if (
        distinctPhoneNumberIds.size >
        WHATSAPP_CLOUD_MAX_DISTINCT_PHONE_NUMBER_IDS
      ) {
        return invalidPayload("phone_number_id_count_exceeded");
      }

      const contacts = value.contacts ?? [];
      if (
        !Array.isArray(contacts) ||
        contacts.length > WHATSAPP_CLOUD_MAX_CONTACTS_PER_CHANGE
      ) {
        return invalidPayload("contacts_invalid");
      }
      const contactNames = new Map();
      for (const contact of contacts) {
        if (!isRecord(contact)) return invalidPayload("contact_invalid");
        const contactId = whatsappUserId(contact.wa_id);
        if (!contactId) return invalidPayload("contact_id_invalid");
        const profile = contact.profile;
        if (profile !== undefined && !isRecord(profile)) {
          return invalidPayload("contact_profile_invalid");
        }
        const profileName = safeProfileName(profile?.name);
        if (profile?.name !== undefined && !profileName) {
          return invalidPayload("contact_profile_name_invalid");
        }
        const priorProfileName = contactNames.get(contactId);
        if (
          contactNames.has(contactId) &&
          priorProfileName !== (profileName ?? null)
        ) {
          return invalidPayload("contact_profile_conflict");
        }
        contactNames.set(contactId, profileName ?? null);
      }

      const messages = value.messages;
      const statuses = value.statuses;
      if (messages !== undefined && statuses !== undefined) {
        return invalidPayload("message_status_shape_invalid");
      }
      if (messages === undefined) {
        if (!Array.isArray(statuses) || statuses.length > WHATSAPP_CLOUD_MAX_MESSAGES) {
          return invalidPayload("messages_missing");
        }
        messageCandidateCount += statuses.length;
        if (messageCandidateCount > WHATSAPP_CLOUD_MAX_MESSAGES) {
          return invalidPayload("message_count_exceeded");
        }
        for (const status of statuses) {
          if (
            !isRecord(status) ||
            !whatsappMessageId(status.id) ||
            !boundedIdentifier(status.status) ||
            !receivedAt(status.timestamp, nowMilliseconds)
          ) {
            return invalidPayload("status_invalid");
          }
        }
        unsupportedCount += statuses.length;
        continue;
      }
      if (!Array.isArray(messages) || messages.length < 1) {
        return invalidPayload("messages_invalid");
      }
      messageCandidateCount += messages.length;
      if (messageCandidateCount > WHATSAPP_CLOUD_MAX_MESSAGES) {
        return invalidPayload("message_count_exceeded");
      }

      for (const message of messages) {
        if (!isRecord(message)) return invalidPayload("message_invalid");
        const senderId = whatsappUserId(message.from);
        const externalMessageId = whatsappMessageId(message.id);
        const timestamp = receivedAt(message.timestamp, nowMilliseconds);
        const messageType = exactText(message.type);
        if (
          !senderId ||
          !externalMessageId ||
          !timestamp ||
          !MESSAGE_TYPE_PATTERN.test(messageType)
        ) {
          return invalidPayload("message_identity_invalid");
        }

        const idempotencyKey = `${boundPhoneNumberId}:${externalMessageId}`;
        if (messageType !== "text") {
          const normalizedUnsupported = JSON.stringify([
            messageType,
            senderId,
            timestamp,
          ]);
          const priorMessage = seenMessages.get(idempotencyKey);
          if (priorMessage !== undefined) {
            if (priorMessage !== normalizedUnsupported) {
              return invalidPayload("duplicate_message_conflict");
            }
            duplicateCount += 1;
            continue;
          }
          seenMessages.set(idempotencyKey, normalizedUnsupported);
          unsupportedCount += 1;
          continue;
        }
        if (!isRecord(message.text) || typeof message.text.body !== "string") {
          return invalidPayload("text_shape_invalid");
        }
        const content = message.text.body.trim();
        if (
          !content ||
          content.length > WHATSAPP_CLOUD_MAX_TEXT_LENGTH ||
          /\u0000/u.test(content)
        ) {
          return invalidPayload("text_invalid");
        }

        const normalizedEventFields = {
          sourcePlatform: "whatsapp",
          sourceType: "whatsapp_messages",
          messageType: "dm",
          messageKind: "text",
          direction: "inbound",
          content,
          externalMessageId,
          externalThreadId: `${boundPhoneNumberId}:${senderId}`,
          authorLabel: contactNames.get(senderId) ?? "WhatsApp Kontakt",
          phoneNumberId: boundPhoneNumberId,
          senderId,
          receivedAt: timestamp,
        };
        const event = Object.freeze({
          ...normalizedEventFields,
          payloadFingerprint: fingerprintWhatsAppCloudInboundEvent(
            normalizedEventFields,
          ),
        });
        const normalizedEvent = JSON.stringify(event);
        const priorMessage = seenMessages.get(idempotencyKey);
        if (priorMessage !== undefined) {
          if (priorMessage !== normalizedEvent) {
            return invalidPayload("duplicate_message_conflict");
          }
          duplicateCount += 1;
          continue;
        }
        seenMessages.set(idempotencyKey, normalizedEvent);
        events.push(event);
      }
    }
  }

  return Object.freeze({
    ok: true,
    errorCode: null,
    events: Object.freeze(events),
    duplicateCount,
    unsupportedCount,
  });
}

function invalidPayload(reason) {
  return Object.freeze({
    ok: false,
    errorCode: "invalid_payload",
    reason,
    events: Object.freeze([]),
    duplicateCount: 0,
    unsupportedCount: 0,
  });
}

export function buildWhatsAppCloudDiagnostic(input = {}) {
  return Object.freeze({
    schema_version: 1,
    connector_whatsapp_cloud: true,
    event_count: fixedCount(input.eventCount),
    saved_count: fixedCount(input.savedCount),
    duplicate_count: fixedCount(input.duplicateCount),
    unsupported_count: fixedCount(input.unsupportedCount),
    processing_blocked: input.processingBlocked === true,
    schema_ready: input.schemaReady === true,
  });
}
