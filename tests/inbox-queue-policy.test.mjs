import assert from "node:assert/strict";
import test from "node:test";
import { buildUnifiedInboxQueue } from "../src/lib/inboxQueuePolicy.mjs";

const describe = (item) => ({
  dedupeKey: item.fan,
  priorityScore: item.priority,
  waitingMinutes: item.waiting,
  stableKey: item.id,
});

test("keeps conversations and uncovered open follow-ups in one queue", () => {
  const result = buildUnifiedInboxQueue(
    {
      conversations: [
        { id: "conversation-a", fan: "fan-a", priority: 40, waiting: 10 },
      ],
      followups: [
        { id: "followup-a", fan: "fan-a", priority: 100, waiting: 100 },
        { id: "followup-b", fan: "fan-b", priority: 75, waiting: 20 },
      ],
    },
    describe,
  );

  assert.deepEqual(result.map((item) => item.id), ["followup-b", "conversation-a"]);
});

test("deduplicates each fan deterministically and uses a stable final order", () => {
  const input = {
    conversations: [
      { id: "conversation-z", fan: "fan-a", priority: 75, waiting: 20 },
      { id: "conversation-a", fan: "fan-a", priority: 75, waiting: 20 },
      { id: "conversation-b", fan: "fan-b", priority: 75, waiting: 20 },
    ],
    followups: [
      { id: "followup-d", fan: "fan-d", priority: 40, waiting: 5 },
      { id: "followup-c", fan: "fan-c", priority: 40, waiting: 5 },
    ],
  };

  const first = buildUnifiedInboxQueue(input, describe);
  const second = buildUnifiedInboxQueue(
    {
      conversations: [...input.conversations].reverse(),
      followups: [...input.followups].reverse(),
    },
    describe,
  );

  assert.deepEqual(first.map((item) => item.id), [
    "conversation-a",
    "conversation-b",
    "followup-c",
    "followup-d",
  ]);
  assert.deepEqual(second, first);
});

test("does not mutate either candidate list", () => {
  const conversations = [
    { id: "conversation-a", fan: "fan-a", priority: 40, waiting: 10 },
  ];
  const followups = [
    { id: "followup-b", fan: "fan-b", priority: 75, waiting: 20 },
  ];
  const conversationsBefore = structuredClone(conversations);
  const followupsBefore = structuredClone(followups);

  buildUnifiedInboxQueue({ conversations, followups }, describe);

  assert.deepEqual(conversations, conversationsBefore);
  assert.deepEqual(followups, followupsBefore);
});
