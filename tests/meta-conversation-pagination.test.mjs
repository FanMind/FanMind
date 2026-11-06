import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  resolveFacebookGraphPagingCursor,
} from "../src/lib/facebookGraphPagingPolicy.mjs";
import {
  resolveInstagramGraphPagingCursor,
  validateInstagramGraphPagingUrl,
} from "../src/lib/instagramGraphPagingPolicy.mjs";
import {
  assertMetaConversationSyncBudget,
  createMetaConversationSyncAbortSignal,
  META_CONVERSATION_SYNC_EXECUTION_BUDGET_MS,
  normalizeMetaPagingCursor,
  resolveMetaConversationSyncCheckpoint,
} from "../src/lib/metaConversationPaginationPolicy.mjs";

const STARTED_AT = "2026-08-11T20:00:00.000Z";
const SECOND_RUN_AT = "2026-08-11T20:05:00.000Z";

test("26 conversations require continuation before the global watermark advances", () => {
  const firstPageIds = Array.from({ length: 25 }, (_, index) =>
    `conversation-${index + 1}`,
  );
  const secondPageIds = ["conversation-26"];
  assert.equal(new Set([...firstPageIds, ...secondPageIds]).size, 26);

  const firstCheckpoint = resolveMetaConversationSyncCheckpoint({
    runStartedAt: STARTED_AT,
    existingContinuationAfter: null,
    existingContinuationStartedAt: null,
    nextAfter: "cursor-page-2",
  });
  assert.deepEqual(firstCheckpoint, {
    completedSyncAt: null,
    continuationAfter: "cursor-page-2",
    continuationStartedAt: STARTED_AT,
    intervalStartedAt: STARTED_AT,
  });

  const finalCheckpoint = resolveMetaConversationSyncCheckpoint({
    runStartedAt: SECOND_RUN_AT,
    existingContinuationAfter: firstCheckpoint.continuationAfter,
    existingContinuationStartedAt:
      firstCheckpoint.continuationStartedAt,
    nextAfter: null,
  });
  assert.deepEqual(finalCheckpoint, {
    completedSyncAt: STARTED_AT,
    continuationAfter: null,
    continuationStartedAt: null,
    intervalStartedAt: STARTED_AT,
  });
});

test("empty or short pages continue whenever Meta supplies a next cursor", () => {
  for (const rowCount of [0, 1, 10]) {
    const checkpoint = resolveMetaConversationSyncCheckpoint({
      runStartedAt: STARTED_AT,
      existingContinuationAfter: null,
      existingContinuationStartedAt: null,
      nextAfter: `cursor-after-${rowCount}`,
    });
    assert.equal(checkpoint.completedSyncAt, null);
    assert.equal(checkpoint.continuationAfter, `cursor-after-${rowCount}`);
  }
});

test("partial failures retry the persisted page without advancing completion", () => {
  const persisted = resolveMetaConversationSyncCheckpoint({
    runStartedAt: STARTED_AT,
    existingContinuationAfter: null,
    existingContinuationStartedAt: null,
    nextAfter: "cursor-page-2",
  });

  // A failure while processing page two writes no new checkpoint. The retry
  // therefore receives the exact persisted page-two cursor and interval.
  const retry = resolveMetaConversationSyncCheckpoint({
    runStartedAt: SECOND_RUN_AT,
    existingContinuationAfter: persisted.continuationAfter,
    existingContinuationStartedAt: persisted.continuationStartedAt,
    nextAfter: "cursor-page-3",
  });
  assert.deepEqual(retry, {
    completedSyncAt: null,
    continuationAfter: "cursor-page-3",
    continuationStartedAt: STARTED_AT,
    intervalStartedAt: STARTED_AT,
  });
});

test("conversation sync execution budget fails closed at its boundary", () => {
  assert.equal(META_CONVERSATION_SYNC_EXECUTION_BUDGET_MS, 45_000);
  assert.doesNotThrow(() => assertMetaConversationSyncBudget(45_000, 44_999));
  assert.throws(
    () => assertMetaConversationSyncBudget(45_000, 45_000),
    /Zeitbudget/u,
  );
  assert.throws(
    () => assertMetaConversationSyncBudget(Number.NaN, 0),
    /Zeitbudget/u,
  );
  const signal = createMetaConversationSyncAbortSignal(45_000, 44_999);
  assert.equal(signal.aborted, false);
});

test("paging cursors and continuation pairs fail closed", () => {
  assert.equal(normalizeMetaPagingCursor("safe_Cursor-1=/+"), "safe_Cursor-1=/+");
  for (const invalid of [
    "",
    "cursor with spaces",
    "cursor\nnewline",
    "https://graph.facebook.com/v25.0/page",
    "x".repeat(2_049),
  ]) {
    assert.equal(normalizeMetaPagingCursor(invalid), null);
  }

  assert.throws(
    () =>
      resolveMetaConversationSyncCheckpoint({
        runStartedAt: SECOND_RUN_AT,
        existingContinuationAfter: "cursor-page-2",
        existingContinuationStartedAt: null,
        nextAfter: null,
      }),
    /continuation is invalid/u,
  );
  assert.throws(
    () =>
      resolveMetaConversationSyncCheckpoint({
        runStartedAt: SECOND_RUN_AT,
        existingContinuationAfter: "cursor-page-2",
        existingContinuationStartedAt: STARTED_AT,
        nextAfter: "cursor-page-2",
      }),
    /did not advance/u,
  );
});

test("Facebook and Instagram persist only cursors from strict Graph URLs", () => {
  assert.equal(
    resolveFacebookGraphPagingCursor(
      "https://graph.facebook.com/v25.0/page/conversations?after=fb-cursor",
    ),
    "fb-cursor",
  );
  assert.equal(
    resolveInstagramGraphPagingCursor(
      "https://graph.instagram.com/v25.0/account/conversations?after=ig-cursor",
    ),
    "ig-cursor",
  );
  assert.equal(resolveFacebookGraphPagingCursor(null), null);
  assert.equal(resolveInstagramGraphPagingCursor(null), null);

  for (const manipulated of [
    "http://graph.instagram.com/v25.0/account/conversations?after=x",
    "https://graph.instagram.com.evil.example/v25.0/account/conversations?after=x",
    "https://graph.instagram.com/v24.0/account/conversations?after=x",
    "https://user@graph.instagram.com/v25.0/account/conversations?after=x",
    "https://graph.instagram.com:444/v25.0/account/conversations?after=x",
  ]) {
    assert.equal(validateInstagramGraphPagingUrl(manipulated), null);
    assert.throws(
      () => resolveInstagramGraphPagingCursor(manipulated),
      /blockiert/u,
    );
  }
  assert.throws(
    () =>
      resolveFacebookGraphPagingCursor(
        "https://graph.facebook.com/v24.0/page/conversations?after=x",
      ),
    /blockiert/u,
  );
  assert.throws(
    () =>
      resolveFacebookGraphPagingCursor(
        "https://graph.facebook.com/v25.0/page/conversations",
      ),
    /Cursor/u,
  );
});

test("both providers use the same server-only continuation contract", async () => {
  const [facebook, instagram, facebookProvider, instagramProvider, server, migration] = await Promise.all([
    readFile("src/app/channels/facebookWebhookActions.ts", "utf8"),
    readFile("src/app/channels/instagramWebhookActions.ts", "utf8"),
    readFile("src/lib/facebookIntegration.ts", "utf8"),
    readFile("src/lib/instagramIntegration.ts", "utf8"),
    readFile("src/lib/supabase/server.ts", "utf8"),
    readFile(
      "supabase/migrations/20260811220000_meta_conversation_sync_continuation.sql",
      "utf8",
    ),
  ]);

  for (const source of [facebook, instagram]) {
    assert.match(source, /getMetaMessengerSyncContinuation/u);
    assert.match(source, /resolveMetaConversationSyncCheckpoint/u);
    assert.match(
      source,
      /cursorUpdate:\s*(?:preserveCursor \? )?\{ kind: "preserve" \}/u,
    );
    assert.match(source, /kind: "partial"/u);
    assert.match(source, /kind: "complete"/u);
    assert.match(source, /continuationPending/u);
    assert.match(source, /assertMetaConversationSyncBudget/u);
  }
  assert.match(facebook, /fetchFacebookMessengerConversationPage/u);
  assert.match(instagram, /fetchInstagramConversationPage/u);
  for (const source of [facebookProvider, instagramProvider]) {
    assert.match(source, /createMetaConversationSyncAbortSignal/u);
  }
  assert.doesNotMatch(
    facebookProvider,
    /console\.info\("Facebook Messenger message field fallback active", \{\s*conversationId/u,
  );
  assert.match(
    server,
    /else if \(input\.cursorUpdate\.kind === "partial"\)[\s\S]*messenger_sync_continuation_after[\s\S]*else if \(input\.cursorUpdate\.kind === "complete"\)[\s\S]*last_messenger_sync_at/u,
  );
  assert.match(
    migration,
    /messenger_sync_continuation_after[\s\S]*messenger_sync_continuation_started_at/u,
  );
  assert.match(
    migration,
    /revoke select \([\s\S]*messenger_sync_continuation_after[\s\S]*from public, anon, authenticated/u,
  );
  assert.match(
    migration,
    /messenger_sync_continuation_after ~ '\^\[A-Za-z0-9\._~\+\/=-\]\+\$'/u,
  );
});
