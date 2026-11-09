import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { facebookCommentTarget } from "../src/lib/facebookCommentTarget.mjs";
import { matchesInboxView, normalizeInboxView } from "../src/lib/inboxViewPolicy.mjs";
import * as dataPolicy from "../src/lib/metaDataHandlingPolicy.mjs";
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

test("preserves separate conversations for one fan and uses a stable final order", () => {
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
    "conversation-z",
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


function load(path, dependencies) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { exports, URL, Date, console: { error() {} }, require(name) {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected import ${name}`);
    return dependencies[name];
  } });
  return exports;
}

test("a DM and different post threads from one fan remain individually actionable", () => {
  const conversations = [
    { id: "dm", fan: "fan-a", conversationId: "dm", sourceType: "dm" },
    { id: "post-a", fan: "fan-a", conversationId: "post-a", sourceType: "comment" },
    { id: "post-b", fan: "fan-a", conversationId: "post-b", sourceType: "comment" },
  ];
  const result = buildUnifiedInboxQueue({ conversations, followups: [
    { id: "followup-a", fan: "fan-a" }, { id: "followup-b", fan: "fan-b" },
  ] }, item => ({ dedupeKey: item.fan, stableKey: item.id, priorityScore: 0, waitingMinutes: 0 }));
  assert.equal(result.length, 4);
  assert.deepEqual(result.filter(item => matchesInboxView(item, "chats")).map(item => item.id), ["dm"]);
  assert.deepEqual(result.filter(item => matchesInboxView(item, "comments")).map(item => item.id), ["post-a", "post-b"]);
  assert.equal(normalizeInboxView("forged"), "all");
});

test("comment links retain the exact comment and strip credentials and unrelated query", () => {
  assert.equal(facebookCommentTarget({ postId: "101_202", commentId: "202_303" }),
    "https://www.facebook.com/101/posts/202?comment_id=303");
  assert.equal(facebookCommentTarget({ permalink: "https://m.facebook.com/permalink.php?story_fbid=202&id=101&access_token=secret&next=https://evil.invalid", commentId: "303" }),
    "https://www.facebook.com/permalink.php?story_fbid=202&id=101&comment_id=303");
  assert.equal(facebookCommentTarget({ permalink: "https://www.facebook.com/101/posts/202?comment_id=303&reply_comment_id=404", commentId: "404" }),
    "https://www.facebook.com/101/posts/202?comment_id=303&reply_comment_id=404");
  for (const permalink of ["javascript:alert(1)", "https://facebook.com.evil.invalid/post/1", "https://user:secret@facebook.com/1", "https://facebook.com/l.php?u=https://evil.invalid", "https://facebook.com/login.php", "https://facebook.com/", "https://facebook.com//evil.invalid/path"]) {
    assert.equal(facebookCommentTarget({ permalink }), null);
  }
  assert.equal(facebookCommentTarget({ postId: "../../operator", commentId: "303" }), null);
  assert.equal(facebookCommentTarget({ postId: "101_202", commentId: "javascript:303" }), null);
});

function webhookHarness() {
  const writes = [], diagnostics = [];
  const webhook = load("src/lib/metaWebhook.ts", {
    "@/lib/facebookCommentTarget.mjs": { facebookCommentTarget },
    "@/lib/metaDataHandlingPolicy.mjs": dataPolicy,
    "@/lib/metaCatchupQueuePolicy.mjs": { isMetaCatchupQueueEnabled: () => false },
    "@/lib/webhookSecurityPolicy.mjs": { buildMetaWebhookDiagnosticPayload: () => ({ synthetic: true }) },
    "@/lib/messageAttachments": {
      buildAttachmentFallbackText: () => null, getMessageKindFromAttachments: () => "text",
      normalizeAttachmentType: () => "unknown", normalizeMessageAttachments: () => [],
    },
    "@/lib/supabase/server": {
      findMetaSocialConnectionByPageId: async (platform, page) => ({
        connection: ["101", "102"].includes(page) ? { id: `connection-${page}`, workspace_id: `workspace-${page}`, page_name: "Synthetic" } : null,
        error: null, processingBlocked: page === "103",
      }),
      createMetaWebhookConversationMessage: async input => { writes.push(input); return { error: null }; },
      createMetaWebhookDebugEvent: async input => { diagnostics.push(input); return { error: null }; },
    },
  });
  return { webhook, writes, diagnostics };
}
const commentEntry = (page, sender = "500") => ({ id: page, changes: [{ field: "feed", value: {
  item: "comment", post_id: `${page}_202`, comment_id: "303", from: { id: sender, name: "Synthetic" }, message: "Synthetic comment",
} }] });

test("actual webhook parser gives posts distinct fan threads and comment targets", () => {
  const { webhook } = webhookHarness();
  const entries = [commentEntry("101"), commentEntry("101", "501")];
  const events = webhook.extractMetaWebhookEvents({ object: "page", entry: entries });
  assert.equal(events[0].externalThreadId, "101_202:500");
  assert.equal(events[1].externalThreadId, "101_202:501");
  assert.equal(events[0].replyTargetUrl, "https://www.facebook.com/101/posts/202?comment_id=303");
  assert.equal(events[0].direction, "inbound");
});

test("webhook routing uses each page's workspace, skips unknown and inactive pages without fallback", async () => {
  const { webhook, writes } = webhookHarness();
  await webhook.processMetaWebhookPayload({ object: "page", entry: ["101", "102", "103", "999"].map(page => commentEntry(page)) });
  assert.deepEqual(writes.map(item => item.workspaceId), ["workspace-101", "workspace-102"]);
  for (const write of writes) assert.ok(write.replyTargetUrl.includes(write.workspaceId.replace("workspace-", "")));
});

test("legacy stored comments get the same safe target in the real source-action resolver", () => {
  const { buildReplyTargetAction } = load("src/lib/sourceContext.ts", {
    "@/lib/facebookCommentTarget.mjs": { facebookCommentTarget },
    "@/lib/socialHandoffPolicy.mjs": {},
  });
  const action = buildReplyTargetAction({ source_platform: "facebook", source_type: "facebook_comments", external_post_id: "101_202", external_comment_id: "303" });
  assert.equal(action.href, "https://www.facebook.com/101/posts/202?comment_id=303");
  assert.equal(buildReplyTargetAction({ source_platform: "facebook", source_type: "facebook_comments", reply_target_url: "https://evil.invalid" }).href, null);
  const differentPost = { source_platform: "facebook", source_type: "facebook_comments",
    source_url: "https://www.facebook.com/101/posts/999", external_post_id: "101_999", external_comment_id: "888" };
  assert.equal(buildReplyTargetAction({ source_platform: "facebook", source_type: "facebook_comments",
    external_post_id: "101_202", external_comment_id: "303" }, differentPost).href,
  "https://www.facebook.com/101/posts/202?comment_id=303");
  assert.equal(buildReplyTargetAction({ source_platform: "facebook", source_type: "facebook_comments" }, differentPost).href, null);
  assert.equal(buildReplyTargetAction(null, differentPost).href,
    "https://www.facebook.com/101/posts/999?comment_id=888");
});
