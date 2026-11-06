import {
  MAX_SECURE_STORAGE_LOGICAL_KEY_LENGTH,
  SECURE_STORE_KEY_PATTERN,
} from "./secureStorageKeyPolicy.mjs";

const MAX_SECURE_STORAGE_KEYS = 32;
const MAX_SECURE_STORAGE_KEY_LENGTH = MAX_SECURE_STORAGE_LOGICAL_KEY_LENGTH;

function validKey(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_SECURE_STORAGE_KEY_LENGTH &&
    SECURE_STORE_KEY_PATTERN.test(value)
  );
}

function normalizeSecureStorageRegistry(raw) {
  if (typeof raw !== "string" || raw.length > 8192) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return [...new Set(parsed.filter(validKey))].slice(0, MAX_SECURE_STORAGE_KEYS);
}

function addSecureStorageRegistryKey(keys, key) {
  const current = Array.isArray(keys) ? keys.filter(validKey) : [];
  if (!validKey(key)) return [...new Set(current)].slice(0, MAX_SECURE_STORAGE_KEYS);
  return [...new Set([...current, key])].slice(0, MAX_SECURE_STORAGE_KEYS);
}

function removeSecureStorageRegistryKey(keys, key) {
  return (Array.isArray(keys) ? keys : [])
    .filter(validKey)
    .filter((candidate) => candidate !== key)
    .slice(0, MAX_SECURE_STORAGE_KEYS);
}

export {
  MAX_SECURE_STORAGE_KEYS,
  MAX_SECURE_STORAGE_KEY_LENGTH,
  addSecureStorageRegistryKey,
  normalizeSecureStorageRegistry,
  removeSecureStorageRegistryKey,
};
