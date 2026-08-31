const MESSAGE_PUSH_EVENT_TYPES = Object.freeze([
  "message_received",
  "message_reminder",
]);

const MESSAGE_PUSH_DEFAULT_REMINDER_DELAY_MINUTES = 30;
const MESSAGE_PUSH_MAX_REMINDERS = 1;

function asNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function asValidInstant(value) {
  const normalized = asNonEmptyString(value);
  if (!normalized) return null;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function getMessagePushPolicyConstants() {
  return Object.freeze({
    eventTypes: MESSAGE_PUSH_EVENT_TYPES,
    reminderDelayMinutes: MESSAGE_PUSH_DEFAULT_REMINDER_DELAY_MINUTES,
    maxReminders: MESSAGE_PUSH_MAX_REMINDERS,
  });
}

export function buildMessagePushPayload({ contactId, eventType }) {
  const normalizedContactId = asNonEmptyString(contactId);
  if (!normalizedContactId) {
    throw new TypeError("contactId is required");
  }
  if (!MESSAGE_PUSH_EVENT_TYPES.includes(eventType)) {
    throw new TypeError("unsupported message push eventType");
  }

  return Object.freeze({
    title: "FanMind",
    body:
      eventType === "message_received"
        ? "Du hast eine neue Nachricht."
        : "Eine Nachricht wartet noch auf dich.",
    ttl: 3600,
    data: Object.freeze({
      type: eventType,
      contactId: normalizedContactId,
      section: "messages",
    }),
  });
}

export function deriveMessagePushDecision({
  runtimeEnvironment,
  message,
  now = new Date(),
  priorDelivery = null,
  reminderDelayMinutes = MESSAGE_PUSH_DEFAULT_REMINDER_DELAY_MINUTES,
}) {
  if (runtimeEnvironment !== "staging") {
    return Object.freeze({ status: "blocked", reason: "staging_only" });
  }
  if (!message || typeof message !== "object") {
    return Object.freeze({ status: "blocked", reason: "invalid_message" });
  }
  if (message.direction !== "inbound") {
    return Object.freeze({ status: "blocked", reason: "not_inbound" });
  }
  if (message.seenAt != null) {
    return Object.freeze({ status: "blocked", reason: "already_seen" });
  }

  const workspaceId = asNonEmptyString(message.workspaceId);
  const contactId = asNonEmptyString(message.contactId);
  const messageId = asNonEmptyString(message.id);
  const createdAt = asValidInstant(message.createdAt);
  const nowTimestamp = now instanceof Date ? now.getTime() : Date.parse(String(now));

  if (!workspaceId || !contactId || !messageId || createdAt == null || !Number.isFinite(nowTimestamp)) {
    return Object.freeze({ status: "blocked", reason: "invalid_identity_or_time" });
  }
  if (!Number.isInteger(reminderDelayMinutes) || reminderDelayMinutes < 1 || reminderDelayMinutes > 1440) {
    return Object.freeze({ status: "blocked", reason: "invalid_reminder_delay" });
  }

  if (!priorDelivery) {
    return Object.freeze({
      status: "send",
      eventType: "message_received",
      dedupeKey: `message:${workspaceId}:${contactId}:${messageId}:received`,
      payload: buildMessagePushPayload({ contactId, eventType: "message_received" }),
    });
  }

  if (priorDelivery.workspaceId !== workspaceId || priorDelivery.contactId !== contactId || priorDelivery.messageId !== messageId) {
    return Object.freeze({ status: "blocked", reason: "delivery_binding_mismatch" });
  }
  if (priorDelivery.reminderCount >= MESSAGE_PUSH_MAX_REMINDERS) {
    return Object.freeze({ status: "blocked", reason: "reminder_limit_reached" });
  }

  const initialSentAt = asValidInstant(priorDelivery.initialSentAt);
  if (initialSentAt == null) {
    return Object.freeze({ status: "blocked", reason: "invalid_initial_delivery_time" });
  }
  const reminderDueAt = initialSentAt + reminderDelayMinutes * 60_000;
  if (nowTimestamp < reminderDueAt) {
    return Object.freeze({ status: "blocked", reason: "reminder_not_due" });
  }

  return Object.freeze({
    status: "send",
    eventType: "message_reminder",
    dedupeKey: `message:${workspaceId}:${contactId}:${messageId}:reminder:1`,
    payload: buildMessagePushPayload({ contactId, eventType: "message_reminder" }),
  });
}

export function aggregateUnseenMessagesForPush(messages) {
  if (!Array.isArray(messages)) return [];
  const byContact = new Map();

  for (const message of messages) {
    if (!message || message.direction !== "inbound" || message.seenAt != null) continue;
    const workspaceId = asNonEmptyString(message.workspaceId);
    const contactId = asNonEmptyString(message.contactId);
    const messageId = asNonEmptyString(message.id);
    const createdAt = asValidInstant(message.createdAt);
    if (!workspaceId || !contactId || !messageId || createdAt == null) continue;

    const key = `${workspaceId}:${contactId}`;
    const existing = byContact.get(key);
    if (!existing || createdAt > existing.createdAtTimestamp) {
      byContact.set(key, {
        workspaceId,
        contactId,
        messageId,
        createdAt: message.createdAt,
        createdAtTimestamp: createdAt,
        unseenCount: (existing?.unseenCount ?? 0) + 1,
      });
    } else {
      existing.unseenCount += 1;
    }
  }

  return [...byContact.values()].map(({ createdAtTimestamp: _createdAtTimestamp, ...value }) => Object.freeze(value));
}
