const MAX_META_PAGING_CURSOR_LENGTH = 2_048;
const META_PAGING_CURSOR_PATTERN = /^[A-Za-z0-9._~+/=-]+$/u;
export const META_CONVERSATION_SYNC_EXECUTION_BUDGET_MS = 45_000;

export function assertMetaConversationSyncBudget(deadlineMs, nowMs = Date.now()) {
  if (
    !Number.isFinite(deadlineMs) ||
    !Number.isFinite(nowMs) ||
    nowMs >= deadlineMs
  ) {
    throw new Error("Zeitbudget des Meta-Nachrichten-Syncs ist ausgeschöpft.");
  }
}

export function createMetaConversationSyncAbortSignal(
  deadlineMs,
  nowMs = Date.now(),
) {
  assertMetaConversationSyncBudget(deadlineMs, nowMs);
  return AbortSignal.timeout(Math.max(1, Math.ceil(deadlineMs - nowMs)));
}

export function normalizeMetaPagingCursor(value) {
  if (typeof value !== "string") return null;
  const cursor = value.trim();
  if (
    !cursor ||
    cursor.length > MAX_META_PAGING_CURSOR_LENGTH ||
    !META_PAGING_CURSOR_PATTERN.test(cursor)
  ) {
    return null;
  }
  return cursor;
}

export function resolveMetaConversationSyncCheckpoint(input) {
  const runStartedAt = normalizeIsoTimestamp(input.runStartedAt);
  if (!runStartedAt) {
    throw new Error("Meta conversation sync start is invalid.");
  }

  const existingCursor = normalizeMetaPagingCursor(
    input.existingContinuationAfter,
  );
  const existingStartedAt = normalizeIsoTimestamp(
    input.existingContinuationStartedAt,
  );
  const hasExistingCursor = input.existingContinuationAfter != null;
  const hasExistingStartedAt = input.existingContinuationStartedAt != null;

  if (
    hasExistingCursor !== hasExistingStartedAt ||
    (hasExistingCursor && (!existingCursor || !existingStartedAt))
  ) {
    throw new Error("Meta conversation sync continuation is invalid.");
  }

  const nextCursor = input.nextAfter == null
    ? null
    : normalizeMetaPagingCursor(input.nextAfter);
  if (input.nextAfter != null && !nextCursor) {
    throw new Error("Meta conversation paging cursor is invalid.");
  }
  if (existingCursor && nextCursor === existingCursor) {
    throw new Error("Meta conversation paging cursor did not advance.");
  }

  const intervalStartedAt = existingStartedAt ?? runStartedAt;
  if (nextCursor) {
    return {
      completedSyncAt: null,
      continuationAfter: nextCursor,
      continuationStartedAt: intervalStartedAt,
      intervalStartedAt,
    };
  }

  return {
    completedSyncAt: intervalStartedAt,
    continuationAfter: null,
    continuationStartedAt: null,
    intervalStartedAt,
  };
}

function normalizeIsoTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}
