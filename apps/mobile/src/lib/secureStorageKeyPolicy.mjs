const SECURE_STORE_KEY_PATTERN = /^[A-Za-z0-9._-]+$/u;
const MAX_SECURE_STORE_KEY_LENGTH = 240;
const MAX_SECURE_STORAGE_LOGICAL_KEY_LENGTH = 220;
const SECURE_STORAGE_REGISTRY_KEY = "fanmind.secure-storage-registry.v2";

function assertSecureStoreKey(key) {
  if (
    typeof key !== "string" ||
    key.length === 0 ||
    key.length > MAX_SECURE_STORE_KEY_LENGTH ||
    !SECURE_STORE_KEY_PATTERN.test(key)
  ) {
    throw new Error("Ungültiger sicherer FanMind-Speicherschlüssel.");
  }
  return key;
}

function assertSecureStorageLogicalKey(key) {
  if (
    typeof key !== "string" ||
    key.length === 0 ||
    key.length > MAX_SECURE_STORAGE_LOGICAL_KEY_LENGTH ||
    !SECURE_STORE_KEY_PATTERN.test(key)
  ) {
    throw new Error("Ungültiger logischer FanMind-Speicherschlüssel.");
  }
  return key;
}

function secureStoreCountKey(key) {
  return assertSecureStoreKey(`${assertSecureStorageLogicalKey(key)}.count`);
}

function secureStoreChunkKey(key, index) {
  if (!Number.isInteger(index) || index < 0 || index > 999) {
    throw new Error("Ungültiger FanMind-Speicherblock.");
  }
  return assertSecureStoreKey(
    `${assertSecureStorageLogicalKey(key)}.chunk.${index}`,
  );
}

export {
  MAX_SECURE_STORE_KEY_LENGTH,
  MAX_SECURE_STORAGE_LOGICAL_KEY_LENGTH,
  SECURE_STORAGE_REGISTRY_KEY,
  SECURE_STORE_KEY_PATTERN,
  assertSecureStoreKey,
  assertSecureStorageLogicalKey,
  secureStoreChunkKey,
  secureStoreCountKey,
};
