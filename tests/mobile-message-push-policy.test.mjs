import test from "node:test";
import assert from "node:assert/strict";

import {
  aggregateUnseenMessagesForPush,
  buildMessagePushPayload,
  deriveMessagePushDecision,
  getMessagePushPolicyConstants,
} from "../src/lib/mobileMessagePushPolicy.mjs";

const baseMessage = Object.freeze({
  id: "msg-1",
  workspaceId: "ws-1",
  contactId: "contact-1",
  direction: "inbound",
  seenAt: null,
  createdAt: "2026-08-31T18:00:00Z",
});

test("message push policy is bounded to one 30-minute reminder", () => {
  assert.deepEqual(getMessagePushPolicyConstants(), {
    eventTypes: ["message_received", "message_reminder"],
    reminderDelayMinutes: 30,
    maxReminders: 1,
  });
});

test("initial unseen inbound message produces privacy-minimal push", () => {
  const decision = deriveMessagePushDecision({
    runtimeEnvironment: "staging",
    message: baseMessage,
    now: new Date("2026-08-31T18:01:00Z"),
  });

  assert.equal(decision.status, "send");
  assert.equal(decision.eventType, "message_received");
  assert.equal(decision.dedupeKey, "message:ws-1:contact-1:msg-1:received");
  assert.deepEqual(decision.payload, {
    title: "FanMind",
    body: "Du hast eine neue Nachricht.",
    ttl: 3600,
    data: {
      type: "message_received",
      contactId: "contact-1",
      section: "messages",
    },
  });
  assert.equal(JSON.stringify(decision.payload).includes("msg-1"), false);
  assert.equal(JSON.stringify(decision.payload).includes("ws-1"), false);
});

test("production and non-inbound or seen messages fail closed", () => {
  assert.deepEqual(
    deriveMessagePushDecision({ runtimeEnvironment: "production", message: baseMessage }),
    { status: "blocked", reason: "staging_only" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: { ...baseMessage, direction: "outbound" },
    }),
    { status: "blocked", reason: "not_inbound" },
  );
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: { ...baseMessage, seenAt: "2026-08-31T18:05:00Z" },
    }),
    { status: "blocked", reason: "already_seen" },
  );
});

test("one reminder is allowed only after the delay and while still unseen", () => {
  const priorDelivery = {
    workspaceId: "ws-1",
    contactId: "contact-1",
    messageId: "msg-1",
    initialSentAt: "2026-08-31T18:02:00Z",
    reminderCount: 0,
  };

  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      now: new Date("2026-08-31T18:31:59Z"),
      priorDelivery,
    }),
    { status: "blocked", reason: "reminder_not_due" },
  );

  const due = deriveMessagePushDecision({
    runtimeEnvironment: "staging",
    message: baseMessage,
    now: new Date("2026-08-31T18:32:00Z"),
    priorDelivery,
  });
  assert.equal(due.status, "send");
  assert.equal(due.eventType, "message_reminder");
  assert.equal(due.dedupeKey, "message:ws-1:contact-1:msg-1:reminder:1");
  assert.equal(due.payload.body, "Eine Nachricht wartet noch auf dich.");

  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      priorDelivery: { ...priorDelivery, reminderCount: 1 },
    }),
    { status: "blocked", reason: "reminder_limit_reached" },
  );
});

test("prior delivery binding mismatch fails closed", () => {
  assert.deepEqual(
    deriveMessagePushDecision({
      runtimeEnvironment: "staging",
      message: baseMessage,
      priorDelivery: {
        workspaceId: "other",
        contactId: "contact-1",
        messageId: "msg-1",
        initialSentAt: "2026-08-31T18:02:00Z",
        reminderCount: 0,
      },
    }),
    { status: "blocked", reason: "delivery_binding_mismatch" },
  );
});

test("aggregation keeps one newest candidate per fan and counts unseen messages", () => {
  const result = aggregateUnseenMessagesForPush([
    baseMessage,
    { ...baseMessage, id: "msg-2", createdAt: "2026-08-31T18:10:00Z" },
    { ...baseMessage, id: "msg-seen", seenAt: "2026-08-31T18:11:00Z" },
    {
      ...baseMessage,
      id: "msg-contact-2",
      contactId: "contact-2",
      createdAt: "2026-08-31T18:12:00Z",
    },
  ]);

  assert.equal(result.length, 2);
  assert.deepEqual(result.find((item) => item.contactId === "contact-1"), {
    workspaceId: "ws-1",
    contactId: "contact-1",
    messageId: "msg-2",
    createdAt: "2026-08-31T18:10:00Z",
    unseenCount: 2,
  });
});

test("payload rejects unsupported types and missing contact id", () => {
  assert.throws(() => buildMessagePushPayload({ contactId: "", eventType: "message_received" }));
  assert.throws(() => buildMessagePushPayload({ contactId: "contact-1", eventType: "x" }));
});
