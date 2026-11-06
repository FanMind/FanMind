import {
  MAX_SECURE_STORAGE_LOGICAL_KEY_LENGTH,
  SECURE_STORE_KEY_PATTERN,
  assertSecureStorageLogicalKey,
} from "./secureStorageKeyPolicy.mjs";

const LEGACY_SECURE_STORAGE_REGISTRY_KEY =
  "fanmind:secure-storage-registry:v1";
const LEGACY_SECURE_STORAGE_MAX_CHUNKS = 64;
const LEGACY_SECURE_STORAGE_PURGE_MAX_CHUNKS = 999;
const LEGACY_SECURE_STORAGE_MAX_KEYS = 32;
const LEGACY_SECURE_STORAGE_REGISTRY_MAX_LENGTH = 8192;

function legacySecureStoreCountKey(key) {
  return `${assertSecureStorageLogicalKey(key)}:count`;
}

function legacySecureStoreChunkKey(key, index) {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= LEGACY_SECURE_STORAGE_PURGE_MAX_CHUNKS
  ) {
    throw new Error("Ungültiger alter FanMind-Speicherblock.");
  }
  return `${assertSecureStorageLogicalKey(key)}:chunk:${index}`;
}

function parseLegacySecureStoreChunkCount(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) &&
    parsed > 0 &&
    parsed <= LEGACY_SECURE_STORAGE_MAX_CHUNKS
    ? parsed
    : 0;
}

function parseLegacySecureStorePurgeChunkCount(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) &&
    parsed > 0 &&
    parsed <= LEGACY_SECURE_STORAGE_PURGE_MAX_CHUNKS
    ? parsed
    : 0;
}

function validLegacyLogicalKey(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_SECURE_STORAGE_LOGICAL_KEY_LENGTH &&
    SECURE_STORE_KEY_PATTERN.test(value)
  );
}

function parseLegacySecureStorageRegistry(raw) {
  if (raw === null) {
    return { present: false, valid: true, keys: [] };
  }
  if (
    typeof raw !== "string" ||
    raw.length > LEGACY_SECURE_STORAGE_REGISTRY_MAX_LENGTH
  ) {
    return { present: true, valid: false, keys: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { present: true, valid: false, keys: [] };
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length > LEGACY_SECURE_STORAGE_MAX_KEYS ||
    !parsed.every(validLegacyLogicalKey)
  ) {
    return { present: true, valid: false, keys: [] };
  }

  return {
    present: true,
    valid: true,
    keys: [...new Set(parsed)],
  };
}

function createSecureStoragePurgePlan(currentKeys, legacyRegistry) {
  const trustedLegacyKeys = legacyRegistry.valid ? legacyRegistry.keys : [];
  return {
    keys: [...new Set([...currentKeys, ...trustedLegacyKeys])],
    legacyRegistryPresent: legacyRegistry.present,
    legacyRegistryValid: legacyRegistry.valid,
    trustedLegacyKeys,
  };
}

export {
  createSecureStoragePurgePlan,
  LEGACY_SECURE_STORAGE_MAX_CHUNKS,
  LEGACY_SECURE_STORAGE_MAX_KEYS,
  LEGACY_SECURE_STORAGE_PURGE_MAX_CHUNKS,
  LEGACY_SECURE_STORAGE_REGISTRY_KEY,
  legacySecureStoreChunkKey,
  legacySecureStoreCountKey,
  parseLegacySecureStorageRegistry,
  parseLegacySecureStoreChunkCount,
  parseLegacySecureStorePurgeChunkCount,
};
