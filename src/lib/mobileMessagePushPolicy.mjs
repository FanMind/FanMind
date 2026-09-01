const MESSAGE_PUSH_EVENT_TYPES = Object.freeze([
  "message_received",
  "message_reminder",
]);

const MESSAGE_PUSH_DEFAULT_REMINDER_DELAY_MINUTES = 30;
const MESSAGE_PUSH_INITIAL_FRESHNESS_MINUTES = 60;
const MESSAGE_PUSH_REMINDER_FRESHNESS_MINUTES = 60;
const MESSAGE_PUSH_MAX_REMINDERS = 1;
const MESSAGE_PUSH_TTL_SECONDS = 3600;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function asCanonicalUuid(value) {
  const normalized = asNonEmptyString(value);
  return normalized && UUID_PATTERN.test(normalized)
    ? normalized.toLowerCase()
    : null;
}

function asValidInstant(value) {
  const normalized = asNonEmptyString(value);
  if (!normalized) return null;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function normalizeRecipientBinding(recipient) {
  if (!recipient || typeof recipient !== "object" || Array.isArray(recipient)) {
    return null;
  }
  const workspaceId = asCanonicalUuid(recipient.workspaceId);
  const userId = asCanonicalUuid(recipient.userId);
  const registrationId = asCanonicalUuid(recipient.registrationId);
  const easProjectId = asCanonicalUuid(recipient.easProjectId);
  if (!workspaceId || !userId || !registrationId || !easProjectId) return null;
  return Object.freeze({ workspaceId, userId, registrationId, easProjectId });
}

function buildDeliveryBinding({ workspaceId, contactId, messageId, recipient }) {
  return Object.freeze({
    workspaceId,
    contactId,
    messageId,
    userId: recipient.userId,
    registrationId: recipient.registrationId,
    easProjectId: recipient.easProjectId,
  });
}

function deliveryBindingMatches(priorDelivery, binding) {
  return (
    asCanonicalUuid(priorDelivery?.workspaceId) === binding.workspaceId &&
    asCanonicalUuid(priorDelivery?.contactId) === binding.contactId &&
    asCanonicalUuid(priorDelivery?.messageId) === binding.messageId &&
    asCanonicalUuid(priorDelivery?.userId) === binding.userId &&
    asCanonicalUuid(priorDelivery?.registrationId) === binding.registrationId &&
    asCanonicalUuid(priorDelivery?.easProjectId) === binding.easProjectId
  );
}

function buildDedupeKey(binding, suffix) {
  return [
    "message",
    binding.workspaceId,
    binding.userId,
    binding.registrationId,
    binding.easProjectId,
    binding.contactId,
    binding.messageId,
    suffix,
  ].join(":");
}

function classifySeenState(message) {
  if (!Object.prototype.hasOwnProperty.call(message, "seenAt")) {
    return "invalid";
  }
  if (message.seenAt === null) {
    return "unseen";
  }
  return asValidInstant(message.seenAt) == null ? "invalid" : "seen";
}

export function getMessagePushPolicyConstants() {
  return Object.freeze({
    eventTypes: MESSAGE_PUSH_EVENT_TYPES,
    reminderDelayMinutes: MESSAGE_PUSH_DEFAULT_REMINDER_DELAY_MINUTES,
    initialFreshnessMinutes: MESSAGE_PUSH_INITIAL_FRESHNESS_MINUTES,
    reminderFreshnessMinutes: MESSAGE_PUSH_REMINDER_FRESHNESS_MINUTES,
    maxReminders: MESSAGE_PUSH_MAX_REMINDERS,
    ttlSeconds: MESSAGE_PUSH_TTL_SECONDS,
  });
}

export function buildMessagePushPayload({ contactId, eventType }) {
  const normalizedContactId = asCanonicalUuid(contactId);
  if (!normalizedContactId) {
    throw new TypeError("canonical contactId is required");
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
    ttl: MESSAGE_PUSH_TTL_SECONDS,
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
  recipient,
  now = new Date(),
  priorDelivery = null,
  reminderDelayMinutes = MESSAGE_PUSH_DEFAULT_REMINDER_DELAY_MINUTES,
  initialFreshnessMinutes = MESSAGE_PUSH_INITIAL_FRESHNESS_MINUTES,
  reminderFreshnessMinutes = MESSAGE_PUSH_REMINDER_FRESHNESS_MINUTES,
}) {
  if (runtimeEnvironment !== "staging") {
    return Object.freeze({ status: "blocked", reason: "staging_only" });
  }
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return Object.freeze({ status: "blocked", reason: "invalid_message" });
  }
  if (message.direction !== "inbound") {
    return Object.freeze({ status: "blocked", reason: "not_inbound" });
  }

  const seenState = classifySeenState(message);
  if (seenState === "invalid") {
    return Object.freeze({ status: "blocked", reason: "invalid_seen_state" });
  }
  if (seenState === "seen") {
    return Object.freeze({ status: "blocked", reason: "already_seen" });
  }

  const workspaceId = asCanonicalUuid(message.workspaceId);
  const contactId = asCanonicalUuid(message.contactId);
  const messageId = asCanonicalUuid(message.id);
  const createdAt = asValidInstant(message.createdAt);
  const normalizedRecipient = normalizeRecipientBinding(recipient);
  const nowTimestamp = now instanceof Date ? now.getTime() : Date.parse(String(now));

  if (!workspaceId || !contactId || !messageId || createdAt == null || !Number.isFinite(nowTimestamp)) {
    return Object.freeze({ status: "blocked", reason: "invalid_identity_or_time" });
  }
  if (!normalizedRecipient) {
    return Object.freeze({ status: "blocked", reason: "invalid_recipient_binding" });
  }
  if (normalizedRecipient.workspaceId !== workspaceId) {
    return Object.freeze({ status: "blocked", reason: "recipient_workspace_mismatch" });
  }
  if (createdAt > nowTimestamp) {
    return Object.freeze({ status: "blocked", reason: "message_from_future" });
  }
  if (!Number.isInteger(reminderDelayMinutes) || reminderDelayMinutes < 1 || reminderDelayMinutes > 1440) {
    return Object.freeze({ status: "blocked", reason: "invalid_reminder_delay" });
  }
  if (!Number.isInteger(initialFreshnessMinutes) || initialFreshnessMinutes < 1 || initialFreshnessMinutes > 1440) {
    return Object.freeze({ status: "blocked", reason: "invalid_initial_freshness" });
  }
  if (!Number.isInteger(reminderFreshnessMinutes) || reminderFreshnessMinutes < 1 || reminderFreshnessMinutes > 1440) {
    return Object.freeze({ status: "blocked", reason: "invalid_reminder_freshness" });
  }

  const binding = buildDeliveryBinding({
    workspaceId,
    contactId,
    messageId,
    recipient: normalizedRecipient,
  });
  const initialExpiresAt = createdAt + initialFreshnessMinutes * 60_000;

  if (!priorDelivery) {
    if (nowTimestamp > initialExpiresAt) {
      return Object.freeze({ status: "blocked", reason: "initial_notification_expired" });
    }
    return Object.freeze({
      status: "send",
      eventType: "message_received",
      binding,
      dedupeKey: buildDedupeKey(binding, "received"),
      payload: buildMessagePushPayload({ contactId, eventType: "message_received" }),
    });
  }

  if (!deliveryBindingMatches(priorDelivery, binding)) {
    return Object.freeze({ status: "blocked", reason: "delivery_binding_mismatch" });
  }
  if (
    !Number.isInteger(priorDelivery.reminderCount) ||
    priorDelivery.reminderCount < 0 ||
    priorDelivery.reminderCount >= MESSAGE_PUSH_MAX_REMINDERS
  ) {
    return Object.freeze({
      status: "blocked",
      reason:
        priorDelivery.reminderCount >= MESSAGE_PUSH_MAX_REMINDERS
          ? "reminder_limit_reached"
          : "invalid_reminder_count",
    });
  }

  const initialSentAt = asValidInstant(priorDelivery.initialSentAt);
  if (
    initialSentAt == null ||
    initialSentAt < createdAt ||
    initialSentAt > initialExpiresAt ||
    initialSentAt > nowTimestamp
  ) {
    return Object.freeze({ status: "blocked", reason: "invalid_initial_delivery_time" });
  }
  const reminderDueAt = initialSentAt + reminderDelayMinutes * 60_000;
  if (nowTimestamp < reminderDueAt) {
    return Object.freeze({ status: "blocked", reason: "reminder_not_due" });
  }
  const reminderExpiresAt = reminderDueAt + reminderFreshnessMinutes * 60_000;
  if (nowTimestamp > reminderExpiresAt) {
    return Object.freeze({ status: "blocked", reason: "reminder_expired" });
  }

  return Object.freeze({
    status: "send",
    eventType: "message_reminder",
    binding,
    dedupeKey: buildDedupeKey(binding, "reminder:1"),
    payload: buildMessagePushPayload({ contactId, eventType: "message_reminder" }),
  });
}

export function aggregateUnseenMessagesForPush(messages) {
  if (!Array.isArray(messages)) return [];
  const byContact = new Map();

  for (const message of messages) {
    if (!message || message.direction !== "inbound") continue;
    if (classifySeenState(message) !== "unseen") continue;
    const workspaceId = asCanonicalUuid(message.workspaceId);
    const contactId = asCanonicalUuid(message.contactId);
    const messageId = asCanonicalUuid(message.id);
    const createdAt = asValidInstant(message.createdAt);
    if (!workspaceId || !contactId || !messageId || createdAt == null) continue;

    const key = `${workspaceId}:${contactId}`;
    const existing = byContact.get(key);
    const shouldReplace =
      !existing ||
      createdAt > existing.createdAtTimestamp ||
      (createdAt === existing.createdAtTimestamp &&
        messageId.localeCompare(existing.messageId) > 0);

    if (shouldReplace) {
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

  return [...byContact.values()]
    .sort(
      (left, right) =>
        right.createdAtTimestamp - left.createdAtTimestamp ||
        right.messageId.localeCompare(left.messageId),
    )
    .map((value) =>
      Object.freeze({
        workspaceId: value.workspaceId,
        contactId: value.contactId,
        messageId: value.messageId,
        createdAt: value.createdAt,
        unseenCount: value.unseenCount,
      }),
    );
}
