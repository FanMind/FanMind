import { utf8ByteLength } from "./utf8StoragePolicy.mjs";

const OFFLINE_READ_CACHE_VERSION = 2;
const OFFLINE_READ_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const OFFLINE_READ_CACHE_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const OFFLINE_READ_CACHE_MAX_CONTACTS = 50;
const OFFLINE_READ_CACHE_MAX_SERIALIZED_LENGTH = 80_000;
const OFFLINE_READ_CACHE_KEY = "fanmind.offline-read-cache.v2";

function safeIdentifier(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 160 &&
    !/[\s\u0000-\u001f\u007f]/u.test(value)
  );
}

function boundedText(value, maximum, required = false) {
  if (value === null || value === undefined || typeof value !== "string") {
    return null;
  }
  const normalized = value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, " ")
    .trim()
    .slice(0, maximum);
  if (!normalized && required) return null;
  return normalized || null;
}

function boundedTimestamp(value) {
  if (typeof value !== "string" || value.length > 64) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}

function validCacheAge(cachedAt, cacheValidUntil, now) {
  if (!Number.isFinite(cachedAt) || !Number.isFinite(cacheValidUntil) || !Number.isFinite(now)) return false;
  const age = now - cachedAt;
  return (
    age >= -OFFLINE_READ_CACHE_MAX_FUTURE_SKEW_MS &&
    now < cacheValidUntil &&
    cacheValidUntil <= cachedAt + OFFLINE_READ_CACHE_MAX_AGE_MS
  );
}

function normalizeContactListItem(contact, workspaceId) {
  if (
    !contact ||
    typeof contact !== "object" ||
    !safeIdentifier(contact.id) ||
    contact.workspace_id !== workspaceId
  ) {
    return null;
  }
  const displayName = boundedText(contact.display_name, 160, true);
  if (!displayName) return null;
  return {
    id: contact.id,
    workspace_id: workspaceId,
    display_name: displayName,
    handle: boundedText(contact.handle, 160),
    source_platform: boundedText(contact.source_platform, 80),
    status: boundedText(contact.status, 32),
    // Summaries are useful online but deliberately excluded from this first
    // encrypted offline overview together with all richer CRM content.
    summary: null,
    updated_at: boundedTimestamp(contact.updated_at),
  };
}

function createOfflineReadCache({
  userId,
  workspaceId,
  workspaceName,
  contacts,
  cachedAt = Date.now(),
  accessExpiresAt = null,
}) {
  if (
    !safeIdentifier(userId) ||
    !safeIdentifier(workspaceId) ||
    !Array.isArray(contacts) ||
    !Number.isFinite(cachedAt)
  ) {
    throw new Error("Ungültiger Offline-Kontaktcache.");
  }
  const parsedAccessExpiry = accessExpiresAt === null
    ? null
    : Date.parse(accessExpiresAt);
  if (accessExpiresAt !== null && !Number.isFinite(parsedAccessExpiry)) {
    throw new Error("Ungültiger Offline-Kontaktcache.");
  }
  const cacheValidUntil = Math.min(
    cachedAt + OFFLINE_READ_CACHE_MAX_AGE_MS,
    parsedAccessExpiry ?? Number.POSITIVE_INFINITY,
  );
  if (cacheValidUntil <= cachedAt) {
    throw new Error("Der Workspace-Zugang ist nicht mehr aktiv.");
  }
  const normalizedWorkspaceName = boundedText(workspaceName, 160, true);
  if (!normalizedWorkspaceName) {
    throw new Error("Ungültiger Offline-Kontaktcache.");
  }
  const boundedContacts = contacts.slice(0, OFFLINE_READ_CACHE_MAX_CONTACTS);
  const normalizedContacts = boundedContacts
    .map((contact) => normalizeContactListItem(contact, workspaceId))
    .filter((contact) => contact !== null);
  if (normalizedContacts.length !== boundedContacts.length) {
    throw new Error("Offline-Kontaktcache enthält fremde oder ungültige Kontakte.");
  }
  const cache = {
    version: OFFLINE_READ_CACHE_VERSION,
    cachedAt,
    cacheValidUntil,
    userId,
    workspaceId,
    workspaceName: normalizedWorkspaceName,
    contacts: normalizedContacts,
  };

  while (
    cache.contacts.length > 0 &&
    utf8ByteLength(JSON.stringify(cache)) >
      OFFLINE_READ_CACHE_MAX_SERIALIZED_LENGTH
  ) {
    cache.contacts.pop();
  }
  if (
    utf8ByteLength(JSON.stringify(cache)) >
    OFFLINE_READ_CACHE_MAX_SERIALIZED_LENGTH
  ) {
    throw new Error("Offline-Kontaktcache überschreitet die sichere Speichergrenze.");
  }
  return cache;
}

function normalizeOfflineReadCache(
  raw,
  { userId, workspaceId = null, now = Date.now() },
) {
  if (
    typeof raw !== "string" ||
    raw.length === 0 ||
    utf8ByteLength(raw) > OFFLINE_READ_CACHE_MAX_SERIALIZED_LENGTH
  ) {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    parsed.version !== OFFLINE_READ_CACHE_VERSION ||
    parsed.userId !== userId ||
    (workspaceId !== null && parsed.workspaceId !== workspaceId) ||
    !safeIdentifier(parsed.workspaceId) ||
    !validCacheAge(parsed.cachedAt, parsed.cacheValidUntil, now) ||
    !Array.isArray(parsed.contacts) ||
    parsed.contacts.length > OFFLINE_READ_CACHE_MAX_CONTACTS
  ) {
    return null;
  }
  const workspaceName = boundedText(parsed.workspaceName, 160, true);
  if (!workspaceName) return null;
  const contacts = parsed.contacts
    .map((contact) => normalizeContactListItem(contact, parsed.workspaceId))
    .filter((contact) => contact !== null);
  if (contacts.length !== parsed.contacts.length) return null;
  return {
    version: OFFLINE_READ_CACHE_VERSION,
    cachedAt: parsed.cachedAt,
    cacheValidUntil: parsed.cacheValidUntil,
    userId,
    workspaceId: parsed.workspaceId,
    workspaceName,
    contacts,
  };
}

function filterOfflineContacts(contacts, search = "") {
  if (!Array.isArray(contacts)) return [];
  const term = search.trim().toLocaleLowerCase().slice(0, 160);
  if (!term) return contacts.slice(0, OFFLINE_READ_CACHE_MAX_CONTACTS);
  return contacts.filter((contact) =>
    [contact.display_name, contact.handle, contact.source_platform]
      .filter((value) => typeof value === "string")
      .some((value) => value.toLocaleLowerCase().includes(term)),
  );
}

function isOfflineEligibleStatus(status) {
  return status === 0;
}

export {
  OFFLINE_READ_CACHE_KEY,
  OFFLINE_READ_CACHE_MAX_AGE_MS,
  OFFLINE_READ_CACHE_MAX_CONTACTS,
  OFFLINE_READ_CACHE_MAX_SERIALIZED_LENGTH,
  OFFLINE_READ_CACHE_VERSION,
  createOfflineReadCache,
  filterOfflineContacts,
  isOfflineEligibleStatus,
  normalizeOfflineReadCache,
};
