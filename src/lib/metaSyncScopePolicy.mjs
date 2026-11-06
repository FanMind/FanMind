function hasScopedIdentifier(value) {
  if (value == null) return false;
  if (typeof value !== "string") return true;
  return value.trim().length > 0;
}

export function shouldPersistMetaConnectionSyncStatus(input = {}) {
  return !(
    hasScopedIdentifier(input.contactId) ||
    hasScopedIdentifier(input.fanSenderId)
  );
}
