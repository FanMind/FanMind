import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateUnseenMessagesForPush,
  buildMessagePushPayload,
  deriveMessagePushDecision,
  getMessagePushPolicyConstants,
} from "../src/lib/mobileMessagePushPolicy.mjs";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const contactId = "22222222-2222-4222-8222-222222222222";
const messageId = "33333333-3333-4333-8333-333333333333";
const userId = "44444444-4444-4444-8444-444444444444";
const registrationId = "55555555-5555-4555-8555-555555555555";
const easProjectId = "66666666-6666-4666-8666-666666666666";
const secondContactId = "77777777-7777-4777-8777-777777777777";
const secondMessageId = "88888888-8888-4888-8888-888888888888";
const seenMessageId = "99999999-9999-4999-8999-999999999999";

const recipient = Object.freeze({
  workspaceId,
  userId,
  registrationId,
  easProjectId,
  workspaceRole: "owner",
});
const baseMessage = Object.freeze({
  id: messageId,
  workspaceId,
  contactId,
  direction: "inbound",
  seenAt: null,
  createdAt: "2026-08-31T18:00:00Z",
});

function boundPriorDelivery(overrides = {}) {
  return {
    workspaceId,
    contactId,
    messageId,
    userId,
    registrationId,
    easProjectId,
    initialDeliveryStatus: "accepted",
    initialSentAt: "2026-08-31T18:02:00Z",
    reminderCount: 0,
    ...overrides,
  };
}

test("message push policy is bounded to one fresh 30-minute reminder", () => {
  assert.deepEqual(getMessagePushPolicyConstants(), {
    eventTypes: ["message_received", "message_reminder"],
    reminderDelayMinutes: 30,
    initialFreshnessMinutes: 60,
    reminderFreshnessMinutes: 60,
    maxReminders: 1,
    ttlSeconds: 3600,
    androidChannelId: "message-alerts",
  });
});

test("initial unseen inbound message produces privacy-minimal recipient-bound owner push", () => {
  const decision = deriveMessagePushDecision({
    runtimeEnvironment: "staging",
    message: baseMessage,
    recipient,
    now: new Date("2026-08-31T18:01:00Z"),
  });

  assert.equal(decision.status, "send");
  assert.equal(decision.eventType, "message_received");
  assert.deepEqual(decision.binding, {
    workspaceId,
    contactId,
    messageId,
    userId,
    registrationId,
    easProjectId,
  });
  assert.equal(
    decision.dedupeKey,
    `message:${workspaceId}:${userId}:${registrationId}:${easProjectId}:${contactId}:${messageId}:received`,
  );
  assert.deepEqual(decision.payload, {
    title: "FanMind",
    body: "Du hast eine neue Nachricht.",
    ttl: 3600,
    channelId: "message-alerts",
    data: {
      type: "message_received",
      contactId,
      section: "messages",
    },
  });
  const serializedPayload = JSON.stringify(decision.payload);
  assert.equal(serializedPayload.includes(messageId), false);
  assert.equal(serializedPayload.includes(workspaceId), false);
  assert.equal(serializedPayload.includes(userId), false);
  assert.equal(serializedPayload.includes(registrationId), false);
  assert.equal(serializedPayload.includes(easProjectId), false);
});

test("production, non-inbound, seen, future and stale messages fail closed", () => {
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "production",
      message: baseMessage,
      recipient,
    }),
    { status: "blocked", reason: "staging_only" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: { ...baseMessage, direction: "outbound" },
      recipient,
    }),
    { status: "blocked", reason: "not_inbound" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: { ...baseMessage, seenAt: "2026-08-31T18:05:00Z" },
      recipient,
    }),
    { status: "blocked", reason: "already_seen" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: { ...baseMessage, createdAt: "2026-08-31T19:00:00Z" },
      recipient,
      now: new Date("2026-08-31T18:30:00Z"),
    }),
    { status: "blocked", reason: "message_from_future" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      recipient,
      now: new Date("2026-08-31T19:00:01Z"),
    }),
    { status: "blocked", reason: "initial_notification_expired" },
  );
});

test("noncanonical or impossible persisted timestamps fail closed", () => {
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: { ...baseMessage, createdAt: "2026-02-30T18:00:00Z" },
      recipient,
      now: new Date("2026-03-02T18:01:00Z"),
    }),
    { status: "blocked", reason: "invalid_identity_or_time" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: { ...baseMessage, seenAt: "2026-02-30T18:00:00Z" },
      recipient,
      now: new Date("2026-08-31T18:01:00Z"),
    }),
    { status: "blocked", reason: "invalid_seen_state" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      recipient,
      now: new Date("2026-08-31T18:40:00Z"),
      priorDelivery: boundPriorDelivery({
        initialSentAt: "2026-02-30T18:02:00Z",
      }),
    }),
    { status: "blocked", reason: "invalid_initial_delivery_time" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      recipient,
      now: "2026-08-31T18:01:00Z",
    }),
    { status: "blocked", reason: "invalid_identity_or_time" },
  );
});

test("missing or malformed seen state fails closed instead of being treated as unseen", () => {
  const withoutSeenAt = { ...baseMessage };
  delete withoutSeenAt.seenAt;

  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: withoutSeenAt,
      recipient,
      now: new Date("2026-08-31T18:01:00Z"),
    }),
    { status: "blocked", reason: "invalid_seen_state" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: { ...baseMessage, seenAt: undefined },
      recipient,
      now: new Date("2026-08-31T18:01:00Z"),
    }),
    { status: "blocked", reason: "invalid_seen_state" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: { ...baseMessage, seenAt: "not-a-timestamp" },
      recipient,
      now: new Date("2026-08-31T18:01:00Z"),
    }),
    { status: "blocked", reason: "invalid_seen_state" },
  );
});

test("missing, malformed, member or cross-workspace recipient binding blocks before send", () => {
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      now: new Date("2026-08-31T18:01:00Z"),
    }),
    { status: "blocked", reason: "invalid_recipient_binding" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      recipient: { ...recipient, workspaceId: undefined },
      now: new Date("2026-08-31T18:01:00Z"),
    }),
    { status: "blocked", reason: "invalid_recipient_binding" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      recipient: { ...recipient, registrationId: "not-a-uuid" },
      now: new Date("2026-08-31T18:01:00Z"),
    }),
    { status: "blocked", reason: "invalid_recipient_binding" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      recipient: { ...recipient, workspaceRole: undefined },
      now: new Date("2026-08-31T18:01:00Z"),
    }),
    { status: "blocked", reason: "invalid_recipient_binding" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      recipient: { ...recipient, workspaceRole: "member" },
      now: new Date("2026-08-31T18:01:00Z"),
    }),
    { status: "blocked", reason: "recipient_role_not_supported" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      recipient: { ...recipient, workspaceId: secondContactId },
      now: new Date("2026-08-31T18:01:00Z"),
    }),
    { status: "blocked", reason: "recipient_workspace_mismatch" },
  );
});

test("one reminder is allowed only after an accepted initial delivery, the delay, and within freshness", () => {
  const priorDelivery = boundPriorDelivery();

  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      recipient,
      now: new Date("2026-08-31T18:31:59Z"),
      priorDelivery,
    }),
    { status: "blocked", reason: "reminder_not_due" },
  );

  const due = deriveMessagePushDecision({
    runtimeEnvironment: "staging",
    message: baseMessage,
    recipient,
    now: new Date("2026-08-31T18:32:00Z"),
    priorDelivery,
  });
  assert.equal(due.status, "send");
  assert.equal(due.eventType, "message_reminder");
  assert.equal(
    due.dedupeKey,
    `message:${workspaceId}:${userId}:${registrationId}:${easProjectId}:${contactId}:${messageId}:reminder:1`,
  );
  assert.equal(due.payload.body, "Eine Nachricht wartet noch auf dich.");
  assert.equal(due.payload.channelId, "message-alerts");

  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      recipient,
      now: new Date("2026-08-31T19:32:01Z"),
      priorDelivery,
    }),
    { status: "blocked", reason: "reminder_expired" },
  );

  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      recipient,
      priorDelivery: boundPriorDelivery({ reminderCount: 1 }),
    }),
    { status: "blocked", reason: "reminder_limit_reached" },
  );
});

test("queued, failed, indeterminate or missing initial outcome never schedules an automatic reminder", () => {
  for (const initialDeliveryStatus of [undefined, "queued", "rejected", "indeterminate"]) {
    assert.deepEqual(
      deriveMessagePushDecision({
        runtimeEnvironment: "staging",
        message: baseMessage,
        recipient,
        now: new Date("2026-08-31T18:40:00Z"),
        priorDelivery: boundPriorDelivery({ initialDeliveryStatus }),
      }),
      { status: "blocked", reason: "initial_delivery_not_accepted" },
    );
  }
});

test("invalid or inconsistent prior delivery state fails closed", () => {
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      recipient,
      priorDelivery: boundPriorDelivery({ workspaceId: secondContactId }),
    }),
    { status: "blocked", reason: "delivery_binding_mismatch" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      recipient,
      priorDelivery: boundPriorDelivery({ userId: secondContactId }),
    }),
    { status: "blocked", reason: "delivery_binding_mismatch" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      recipient,
      priorDelivery: boundPriorDelivery({ registrationId: secondContactId }),
    }),
    { status: "blocked", reason: "delivery_binding_mismatch" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      recipient,
      priorDelivery: boundPriorDelivery({ easProjectId: secondContactId }),
    }),
    { status: "blocked", reason: "delivery_binding_mismatch" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      recipient,
      priorDelivery: boundPriorDelivery({ reminderCount: "0" }),
    }),
    { status: "blocked", reason: "invalid_reminder_count" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      recipient,
      now: new Date("2026-08-31T18:30:00Z"),
      priorDelivery: boundPriorDelivery({
        initialSentAt: "2026-08-31T17:59:59Z",
      }),
    }),
    { status: "blocked", reason: "invalid_initial_delivery_time" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      recipient,
      now: new Date("2026-08-31T19:30:00Z"),
      priorDelivery: boundPriorDelivery({
        initialSentAt: "2026-08-31T19:00:01Z",
      }),
    }),
    { status: "blocked", reason: "invalid_initial_delivery_time" },
  );
});

test("aggregation keeps one deterministic newest candidate per fan and counts only explicitly unseen messages", () => {
  const equalTimestampLowId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
  const equalTimestampHighId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
  const malformedSeenId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
  const missingSeenId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4";
  const messageWithoutSeenAt = { ...baseMessage };
  delete messageWithoutSeenAt.seenAt;
  const result = aggregateUnseenMessagesForPush([
    { ...baseMessage, id: equalTimestampLowId, createdAt: "2026-08-31T18:10:00Z" },
    { ...baseMessage, id: equalTimestampHighId, createdAt: "2026-08-31T18:10:00Z" },
    { ...baseMessage, id: seenMessageId, seenAt: "2026-08-31T18:11:00Z" },
    { ...baseMessage, id: malformedSeenId, seenAt: undefined },
    { ...messageWithoutSeenAt, id: missingSeenId },
    {
      ...baseMessage,
      id: secondMessageId,
      contactId: secondContactId,
      createdAt: "2026-08-31T18:12:00Z",
    },
    {
      ...baseMessage,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5",
      createdAt: "2026-02-30T18:12:00Z",
    },
  ]);

  assert.equal(result.length, 2);
  assert.deepEqual(result.find((item) => item.contactId === contactId), {
    workspaceId,
    contactId,
    messageId: equalTimestampHighId,
    createdAt: "2026-08-31T18:10:00Z",
    unseenCount: 2,
  });

  const reversed = aggregateUnseenMessagesForPush([
    { ...baseMessage, id: equalTimestampHighId, createdAt: "2026-08-31T18:10:00Z" },
    { ...baseMessage, id: equalTimestampLowId, createdAt: "2026-08-31T18:10:00Z" },
  ]);
  assert.equal(reversed[0].messageId, equalTimestampHighId);
  assert.equal(reversed[0].unseenCount, 2);
});

test("payload rejects unsupported types and non-canonical contact ids", () => {
  assert.throws(() =>
    buildMessagePushPayload({ contactId: "", eventType: "message_received" }),
  );
  assert.throws(() =>
    buildMessagePushPayload({ contactId: "contact-1", eventType: "message_received" }),
  );
  assert.throws(() =>
    buildMessagePushPayload({ contactId, eventType: "x" }),
  );
});
