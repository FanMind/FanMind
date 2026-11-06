import * as SecureStore from "expo-secure-store";
import type { SupportedStorage } from "@supabase/supabase-js";

import {
  addSecureStorageRegistryKey,
  normalizeSecureStorageRegistry,
  removeSecureStorageRegistryKey,
} from "@/lib/secureStorageRegistry.mjs";
import {
  assertSecureStorageLogicalKey,
  SECURE_STORAGE_REGISTRY_KEY,
  secureStoreChunkKey,
  secureStoreCountKey,
} from "@/lib/secureStorageKeyPolicy.mjs";
import {
  migrateLegacySecureStorageValue,
  purgeLegacySecureStorageValueIfPresent,
} from "@/lib/secureStorageLegacyMigration.mjs";
import {
  createSecureStoragePurgePlan,
  LEGACY_SECURE_STORAGE_REGISTRY_KEY,
  parseLegacySecureStorageRegistry,
} from "@/lib/secureStorageLegacyPolicy.mjs";
import {
  deleteLegacySecureStoreValue,
  readLegacySecureStoreValue,
} from "@/lib/legacySecureStoreNative";
import { createSerialOperationQueue } from "@/lib/serialOperationQueue.mjs";
import { splitUtf8String } from "@/lib/utf8StoragePolicy.mjs";

const CHUNK_SIZE_BYTES = 1800;
const MAX_SESSION_CHUNKS = 64;
const SECURE_OPTIONS = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
} as const;
const secureStorageOperations = createSerialOperationQueue();

function chunkKey(key: string, index: number): string {
  return secureStoreChunkKey(key, index);
}

async function readChunkCount(key: string): Promise<number> {
  const value = await SecureStore.getItemAsync(secureStoreCountKey(key));
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= MAX_SESSION_CHUNKS
    ? parsed
    : 0;
}

async function readRegistry(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(SECURE_STORAGE_REGISTRY_KEY);
  return normalizeSecureStorageRegistry(raw);
}

async function writeRegistry(keys: string[]): Promise<void> {
  if (!keys.length) {
    await SecureStore.deleteItemAsync(SECURE_STORAGE_REGISTRY_KEY);
    return;
  }
  await SecureStore.setItemAsync(
    SECURE_STORAGE_REGISTRY_KEY,
    JSON.stringify(keys),
    SECURE_OPTIONS,
  );
}

async function readLegacyRegistry() {
  const raw = await readLegacySecureStoreValue(
    LEGACY_SECURE_STORAGE_REGISTRY_KEY,
  );
  return parseLegacySecureStorageRegistry(raw);
}

async function purgeLegacyKeyIfPresent(key: string): Promise<void> {
  await purgeLegacySecureStorageValueIfPresent({
    key,
    readValue: readLegacySecureStoreValue,
    deleteValue: deleteLegacySecureStoreValue,
  });
}

async function registerKey(key: string): Promise<void> {
  assertSecureStorageLogicalKey(key);
  const keys = addSecureStorageRegistryKey(await readRegistry(), key);
  if (!keys.includes(key)) {
    throw new Error("SecureStore-Schlüssel konnte nicht sicher registriert werden.");
  }
  await writeRegistry(keys);
}

async function unregisterKey(key: string): Promise<void> {
  const keys = removeSecureStorageRegistryKey(await readRegistry(), key);
  await writeRegistry(keys);
}

async function removeChunks(key: string): Promise<void> {
  const count = await readChunkCount(key);
  await Promise.all(
    Array.from({ length: count }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, index)),
    ),
  );
  await SecureStore.deleteItemAsync(secureStoreCountKey(key));
}

async function clearSecureLocalStorageInternal(): Promise<void> {
  const currentKeys = await readRegistry();
  const legacyRegistry = await readLegacyRegistry();
  const {
    keys,
    legacyRegistryPresent,
    legacyRegistryValid,
    trustedLegacyKeys,
  } = createSecureStoragePurgePlan(currentKeys, legacyRegistry);
  const failedKeys: string[] = [];
  let legacyPurgeFailed = !legacyRegistryValid;

  for (const key of keys) {
    let failed = false;
    try {
      await removeChunks(key);
    } catch {
      failed = true;
    }
    try {
      await purgeLegacyKeyIfPresent(key);
    } catch {
      failed = true;
      if (trustedLegacyKeys.includes(key)) {
        legacyPurgeFailed = true;
      }
    }
    if (failed) {
      failedKeys.push(key);
    }
  }

  await writeRegistry(failedKeys);

  if (
    legacyRegistryPresent &&
    !legacyPurgeFailed &&
    legacyRegistryValid &&
    failedKeys.every((key) => !trustedLegacyKeys.includes(key))
  ) {
    try {
      await deleteLegacySecureStoreValue(
        LEGACY_SECURE_STORAGE_REGISTRY_KEY,
      );
    } catch {
      legacyPurgeFailed = true;
    }
  }

  if (!legacyRegistryValid) {
    throw new Error(
      "Die alte sichere FanMind-Registry konnte nicht bestätigt werden. Aktuelle sichere Daten wurden unabhängig davon verarbeitet.",
    );
  }

  if (failedKeys.length > 0 || legacyPurgeFailed) {
    throw new Error("Nicht alle sicheren FanMind-Schlüssel konnten entfernt werden.");
  }
}

async function getItemInternal(key: string): Promise<string | null> {
  assertSecureStorageLogicalKey(key);
  const count = await readChunkCount(key);
  if (!count) {
    return migrateLegacySecureStorageValue({
      key,
      readValue: readLegacySecureStoreValue,
      deleteValue: deleteLegacySecureStoreValue,
      writeCurrentValue: (value) => setItemInternal(key, value, false),
      returnValueWhenCleanupFails: true,
    });
  }
  const chunks = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      SecureStore.getItemAsync(chunkKey(key, index)),
    ),
  );
  if (chunks.some((chunk) => chunk === null)) {
    await removeChunks(key);
    const recovered = await migrateLegacySecureStorageValue({
      key,
      readValue: readLegacySecureStoreValue,
      deleteValue: deleteLegacySecureStoreValue,
      writeCurrentValue: (value) => setItemInternal(key, value, false),
      returnValueWhenCleanupFails: true,
    });
    if (recovered === null) await unregisterKey(key);
    return recovered;
  }

  // Existing valid keys that predate registry enrollment are added on first
  // successful read so the next logout can purge them.
  await registerKey(key);
  // A valid v2 value always wins. Any older duplicate is removed only after
  // the current value has been confirmed. Cleanup remains retryable through
  // the current registry and must never make the confirmed read unavailable.
  try {
    await purgeLegacyKeyIfPresent(key);
  } catch {
    // The registered current key lets logout retry legacy cleanup safely.
  }
  return chunks.join("");
}

async function setItemInternal(
  key: string,
  value: string,
  purgeLegacy = true,
): Promise<void> {
  assertSecureStorageLogicalKey(key);
  await removeChunks(key);
  const chunks = splitUtf8String(value, CHUNK_SIZE_BYTES);
  if (chunks.length > MAX_SESSION_CHUNKS) {
    throw new Error(
      "Sichere lokale FanMind-Daten überschreiten die Speichergrenze.",
    );
  }

  // Register first and persist the expected count before the chunks. If any
  // subsequent write fails, the cleanup path can still find every expected
  // chunk and the registry keeps failed cleanup work retryable.
  await registerKey(key);
  try {
    await SecureStore.setItemAsync(
      secureStoreCountKey(key),
      String(chunks.length),
      SECURE_OPTIONS,
    );
    for (const [index, chunk] of chunks.entries()) {
      await SecureStore.setItemAsync(chunkKey(key, index), chunk, SECURE_OPTIONS);
    }
  } catch (error) {
    let chunksRemoved = false;
    try {
      await removeChunks(key);
      chunksRemoved = true;
    } catch {
      // Keep the key registered so a later logout can retry the purge.
    }
    if (chunksRemoved) {
      try {
        await unregisterKey(key);
      } catch {
        // A stale registry entry is safer than unregistered local data.
      }
    }
    throw error;
  }

  if (purgeLegacy) {
    await purgeLegacyKeyIfPresent(key);
  }
}

async function removeItemInternal(key: string): Promise<void> {
  assertSecureStorageLogicalKey(key);
  await removeChunks(key);
  await purgeLegacyKeyIfPresent(key);
  await unregisterKey(key);
}

export function clearSecureLocalStorage(): Promise<void> {
  return secureStorageOperations.run(clearSecureLocalStorageInternal);
}

// Kept as a compatibility alias for existing callers while the generic name
// makes the session plus bounded offline-cache purge explicit.
export const clearSecureSessionStorage = clearSecureLocalStorage;

export const secureSessionStorage: SupportedStorage = {
  getItem(key: string): Promise<string | null> {
    return secureStorageOperations.run(() => getItemInternal(key));
  },

  setItem(key: string, value: string): Promise<void> {
    return secureStorageOperations.run(() => setItemInternal(key, value));
  },

  removeItem(key: string): Promise<void> {
    return secureStorageOperations.run(() => removeItemInternal(key));
  },
};
