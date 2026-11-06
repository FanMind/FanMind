export const FACEBOOK_PAGE_SELECTION_COOKIE =
  "fanmind_facebook_page_selection";
export const FACEBOOK_PAGE_SELECTION_MAX_AGE_SECONDS = 10 * 60;

const CONNECTION_TYPES = new Set([
  "facebook_messages",
  "facebook_comments",
  "facebook_insights",
]);

export function normalizeFacebookPageSelectionPayload(
  payload,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const workspaceId = normalizeId(payload.workspaceId);
  const userId = normalizeId(payload.userId);
  const userAccessToken = normalizeToken(payload.userAccessToken);
  const connectionType = String(payload.connectionType ?? "").trim();
  const issuedAt = Number(payload.issuedAt);

  if (
    payload.version !== 1 ||
    !workspaceId ||
    !userId ||
    !userAccessToken ||
    !CONNECTION_TYPES.has(connectionType) ||
    !Number.isSafeInteger(issuedAt) ||
    issuedAt <= 0 ||
    issuedAt > nowSeconds + 30 ||
    nowSeconds - issuedAt > FACEBOOK_PAGE_SELECTION_MAX_AGE_SECONDS
  ) {
    return null;
  }

  return {
    version: 1,
    workspaceId,
    userId,
    userAccessToken,
    connectionType,
    issuedAt,
  };
}

export function normalizeFacebookPageSelectionId(value) {
  const normalized = String(value ?? "").trim();
  return /^[A-Za-z0-9._:-]{1,255}$/u.test(normalized) ? normalized : null;
}

function normalizeId(value) {
  const normalized = String(value ?? "").trim();
  return /^[A-Za-z0-9_-]{8,255}$/u.test(normalized) ? normalized : null;
}

function normalizeToken(value) {
  const normalized = String(value ?? "").trim();
  if (normalized.length < 16 || normalized.length > 2_500) return null;
  if (/\s/u.test(normalized)) return null;
  return normalized;
}
