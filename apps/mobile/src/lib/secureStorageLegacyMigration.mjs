import {
  LEGACY_SECURE_STORAGE_MAX_CHUNKS,
  LEGACY_SECURE_STORAGE_PURGE_MAX_CHUNKS,
  legacySecureStoreChunkKey,
  legacySecureStoreCountKey,
  parseLegacySecureStoreChunkCount,
  parseLegacySecureStorePurgeChunkCount,
} from "./secureStorageLegacyPolicy.mjs";

function legacyPhysicalKeys(key, chunkCount = LEGACY_SECURE_STORAGE_MAX_CHUNKS) {
  if (
    !Number.isInteger(chunkCount) ||
    chunkCount < 1 ||
    chunkCount > LEGACY_SECURE_STORAGE_PURGE_MAX_CHUNKS
  ) {
    throw new Error(
      "Alte sichere FanMind-Daten überschreiten die bestätigte Löschgrenze.",
    );
  }
  return [
    legacySecureStoreCountKey(key),
    ...Array.from(
      { length: chunkCount },
      (_, index) => legacySecureStoreChunkKey(key, index),
    ),
  ];
}

async function purgeLegacySecureStorageValue({
  key,
  deleteValue,
  chunkCount,
}) {
  const [countKey, ...chunkKeys] = legacyPhysicalKeys(key, chunkCount);
  const chunkResults = await Promise.allSettled(
    chunkKeys.map((physicalKey) =>
      deleteValue(physicalKey),
    ),
  );
  if (chunkResults.some((result) => result.status === "rejected")) {
    throw new Error(
      "Alte sichere FanMind-Daten konnten nicht vollständig entfernt werden.",
    );
  }
  try {
    await deleteValue(countKey);
  } catch {
    throw new Error(
      "Alte sichere FanMind-Daten konnten nicht vollständig entfernt werden.",
    );
  }
}

async function inspectLegacySecureStorageValue({
  key,
  readValue,
  deleteValue,
}) {
  const countKey = legacySecureStoreCountKey(key);
  const rawCount = await readValue(countKey);
  const count = parseLegacySecureStoreChunkCount(rawCount);
  const purgeCount = parseLegacySecureStorePurgeChunkCount(rawCount);

  if (!count) {
    const firstChunk = await readValue(legacySecureStoreChunkKey(key, 0));
    if (rawCount === null && firstChunk === null) {
      return { status: "absent", value: null };
    }
    if (
      typeof rawCount === "string" &&
      /^\d+$/u.test(rawCount) &&
      Number(rawCount) > LEGACY_SECURE_STORAGE_PURGE_MAX_CHUNKS
    ) {
      throw new Error(
        "Alte sichere FanMind-Daten überschreiten die bestätigte Löschgrenze.",
      );
    }
    await purgeLegacySecureStorageValue({
      key,
      deleteValue,
      chunkCount: Math.max(
        LEGACY_SECURE_STORAGE_MAX_CHUNKS,
        purgeCount,
      ),
    });
    return { status: "corrupt", value: null };
  }

  const chunks = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      readValue(legacySecureStoreChunkKey(key, index)),
    ),
  );
  if (chunks.some((chunk) => chunk === null)) {
    await purgeLegacySecureStorageValue({
      key,
      deleteValue,
      chunkCount: LEGACY_SECURE_STORAGE_MAX_CHUNKS,
    });
    return { status: "corrupt", value: null };
  }

  return { status: "complete", value: chunks.join("") };
}

async function migrateLegacySecureStorageValue({
  key,
  readValue,
  deleteValue,
  writeCurrentValue,
  returnValueWhenCleanupFails = false,
}) {
  const inspected = await inspectLegacySecureStorageValue({
    key,
    readValue,
    deleteValue,
  });
  if (inspected.status !== "complete") return null;

  await writeCurrentValue(inspected.value);
  try {
    await purgeLegacySecureStorageValue({
      key,
      deleteValue,
      chunkCount: LEGACY_SECURE_STORAGE_MAX_CHUNKS,
    });
  } catch (error) {
    if (!returnValueWhenCleanupFails) throw error;
  }
  return inspected.value;
}

async function purgeLegacySecureStorageValueIfPresent({
  key,
  readValue,
  deleteValue,
}) {
  const inspected = await inspectLegacySecureStorageValue({
    key,
    readValue,
    deleteValue,
  });
  if (inspected.status === "complete") {
    await purgeLegacySecureStorageValue({
      key,
      deleteValue,
      chunkCount: LEGACY_SECURE_STORAGE_MAX_CHUNKS,
    });
  }
}

export {
  inspectLegacySecureStorageValue,
  migrateLegacySecureStorageValue,
  purgeLegacySecureStorageValue,
  purgeLegacySecureStorageValueIfPresent,
};
