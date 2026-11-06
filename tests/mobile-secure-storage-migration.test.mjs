import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  migrateLegacySecureStorageValue,
  purgeLegacySecureStorageValueIfPresent,
} from "../apps/mobile/src/lib/secureStorageLegacyMigration.mjs";
import {
  createSecureStoragePurgePlan,
  LEGACY_SECURE_STORAGE_MAX_CHUNKS,
  LEGACY_SECURE_STORAGE_PURGE_MAX_CHUNKS,
  LEGACY_SECURE_STORAGE_REGISTRY_KEY,
  legacySecureStoreChunkKey,
  legacySecureStoreCountKey,
  parseLegacySecureStorageRegistry,
} from "../apps/mobile/src/lib/secureStorageLegacyPolicy.mjs";
import {
  assertSecureStorageLogicalKey,
  secureStoreChunkKey,
  secureStoreCountKey,
} from "../apps/mobile/src/lib/secureStorageKeyPolicy.mjs";

const LOGICAL_KEY = "sb-project-auth-token";

function legacyStore(count, chunks) {
  return new Map([
    [LEGACY_SECURE_STORAGE_REGISTRY_KEY, JSON.stringify([LOGICAL_KEY])],
    [legacySecureStoreCountKey(LOGICAL_KEY), String(count)],
    ...chunks.map((chunk, index) => [
      legacySecureStoreChunkKey(LOGICAL_KEY, index),
      chunk,
    ]),
  ]);
}

function ioFor(store, operations, failDeleteKey = null) {
  return {
    readValue: async (key) => {
      operations.push(`read:${key}`);
      return store.get(key) ?? null;
    },
    deleteValue: async (key) => {
      operations.push(`delete:${key}`);
      if (key === failDeleteKey) throw new Error("injected delete failure");
      store.delete(key);
    },
  };
}

function ioWithOneDeleteFailure(store, operations, failDeleteKey) {
  let failed = false;
  return {
    readValue: async (key) => {
      operations.push(`read:${key}`);
      return store.get(key) ?? null;
    },
    deleteValue: async (key) => {
      operations.push(`delete:${key}`);
      if (key === failDeleteKey && !failed) {
        failed = true;
        throw new Error("injected one-time delete failure");
      }
      store.delete(key);
    },
  };
}

test("legacy and current SecureStore namespaces stay strictly separated", () => {
  assert.equal(
    LEGACY_SECURE_STORAGE_REGISTRY_KEY,
    "fanmind:secure-storage-registry:v1",
  );
  assert.equal(
    legacySecureStoreCountKey(LOGICAL_KEY),
    `${LOGICAL_KEY}:count`,
  );
  assert.equal(
    legacySecureStoreChunkKey(LOGICAL_KEY, 0),
    `${LOGICAL_KEY}:chunk:0`,
  );
  assert.equal(secureStoreCountKey(LOGICAL_KEY), `${LOGICAL_KEY}.count`);
  assert.equal(
    secureStoreChunkKey(LOGICAL_KEY, 0),
    `${LOGICAL_KEY}.chunk.0`,
  );
  assert.throws(() => assertSecureStorageLogicalKey("fanmind:invalid"));
  assert.equal(LEGACY_SECURE_STORAGE_MAX_CHUNKS, 64);
  assert.equal(LEGACY_SECURE_STORAGE_PURGE_MAX_CHUNKS, 999);
  assert.equal(
    legacySecureStoreChunkKey(
      LOGICAL_KEY,
      LEGACY_SECURE_STORAGE_PURGE_MAX_CHUNKS - 1,
    ),
    `${LOGICAL_KEY}:chunk:998`,
  );
  assert.throws(() =>
    legacySecureStoreChunkKey(
      LOGICAL_KEY,
      LEGACY_SECURE_STORAGE_PURGE_MAX_CHUNKS,
    ),
  );
});

test("complete legacy data is written to v2 before any legacy deletion", async () => {
  const store = legacyStore(2, ["session-", "value"]);
  const operations = [];
  const io = ioFor(store, operations);
  let currentValue = null;

  const migrated = await migrateLegacySecureStorageValue({
    key: LOGICAL_KEY,
    ...io,
    writeCurrentValue: async (value) => {
      operations.push("write-current");
      currentValue = value;
    },
  });

  assert.equal(migrated, "session-value");
  assert.equal(currentValue, "session-value");
  assert.ok(
    operations.indexOf("write-current") <
      operations.findIndex((operation) => operation.startsWith("delete:")),
  );
  assert.equal(store.get(LEGACY_SECURE_STORAGE_REGISTRY_KEY), JSON.stringify([LOGICAL_KEY]));
  assert.equal(store.has(legacySecureStoreCountKey(LOGICAL_KEY)), false);
  assert.equal(store.has(legacySecureStoreChunkKey(LOGICAL_KEY, 0)), false);
  assert.equal(store.has(legacySecureStoreChunkKey(LOGICAL_KEY, 1)), false);
});

test("v2 write failure preserves every recoverable legacy value", async () => {
  const store = legacyStore(2, ["session-", "value"]);
  const before = [...store.entries()];
  const operations = [];
  const io = ioFor(store, operations);

  await assert.rejects(
    migrateLegacySecureStorageValue({
      key: LOGICAL_KEY,
      ...io,
      writeCurrentValue: async () => {
        throw new Error("injected v2 failure");
      },
    }),
    /injected v2 failure/u,
  );
  assert.deepEqual([...store.entries()], before);
  assert.equal(
    operations.some((operation) => operation.startsWith("delete:")),
    false,
  );
});

test("partial and oversized legacy values are never returned", async () => {
  for (const store of [
    legacyStore(2, ["only-first"]),
    legacyStore(0, ["unexpected"]),
    legacyStore(65, Array.from({ length: 65 }, () => "x")),
  ]) {
    const operations = [];
    let wroteCurrent = false;
    const result = await migrateLegacySecureStorageValue({
      key: LOGICAL_KEY,
      ...ioFor(store, operations),
      writeCurrentValue: async () => {
        wroteCurrent = true;
      },
    });
    assert.equal(result, null);
    assert.equal(wroteCurrent, false);
    assert.equal(store.has(legacySecureStoreCountKey(LOGICAL_KEY)), false);
  }

  const unbounded = legacyStore(1000, ["must-remain"]);
  const operations = [];
  await assert.rejects(
    migrateLegacySecureStorageValue({
      key: LOGICAL_KEY,
      ...ioFor(unbounded, operations),
      writeCurrentValue: async () => undefined,
    }),
    /Löschgrenze/u,
  );
  assert.equal(
    unbounded.get(legacySecureStoreCountKey(LOGICAL_KEY)),
    "1000",
  );
  assert.equal(
    operations.some((operation) => operation.startsWith("delete:")),
    false,
  );
});

test("legacy deletion failure retains v2 result and retry metadata", async () => {
  const failedKey = legacySecureStoreChunkKey(LOGICAL_KEY, 1);
  const store = legacyStore(2, ["session-", "value"]);
  const operations = [];
  let currentValue = null;

  await assert.rejects(
    migrateLegacySecureStorageValue({
      key: LOGICAL_KEY,
      ...ioFor(store, operations, failedKey),
      writeCurrentValue: async (value) => {
        currentValue = value;
      },
    }),
    /nicht vollständig entfernt/u,
  );
  assert.equal(currentValue, "session-value");
  assert.equal(store.get(failedKey), "value");
  assert.equal(
    store.get(LEGACY_SECURE_STORAGE_REGISTRY_KEY),
    JSON.stringify([LOGICAL_KEY]),
  );
  assert.ok(
    operations.filter((operation) => operation.startsWith("delete:")).length >=
      LEGACY_SECURE_STORAGE_MAX_CHUNKS,
  );
});

test("a confirmed v2 migration remains readable when legacy cleanup must retry", async () => {
  const failedKey = legacySecureStoreChunkKey(LOGICAL_KEY, 1);
  const store = legacyStore(2, ["session-", "value"]);
  const operations = [];
  let currentValue = null;

  const migrated = await migrateLegacySecureStorageValue({
    key: LOGICAL_KEY,
    ...ioFor(store, operations, failedKey),
    writeCurrentValue: async (value) => {
      operations.push("write-current");
      currentValue = value;
    },
    returnValueWhenCleanupFails: true,
  });

  assert.equal(migrated, "session-value");
  assert.equal(currentValue, "session-value");
  assert.equal(store.get(failedKey), "value");
  assert.ok(
    operations.indexOf("write-current") <
      operations.findIndex((operation) => operation.startsWith("delete:")),
  );
});

test("legacy chunk cleanup keeps its count until a failed deletion can retry", async () => {
  const countKey = legacySecureStoreCountKey(LOGICAL_KEY);
  const failedKey = legacySecureStoreChunkKey(LOGICAL_KEY, 1);
  const store = legacyStore(2, ["session-", "value"]);
  const operations = [];
  const io = ioWithOneDeleteFailure(store, operations, failedKey);

  const migrated = await migrateLegacySecureStorageValue({
    key: LOGICAL_KEY,
    ...io,
    writeCurrentValue: async () => undefined,
    returnValueWhenCleanupFails: true,
  });

  assert.equal(migrated, "session-value");
  assert.equal(store.get(countKey), "2");
  assert.equal(store.get(failedKey), "value");

  await purgeLegacySecureStorageValueIfPresent({
    key: LOGICAL_KEY,
    ...io,
  });

  assert.equal(store.has(countKey), false);
  assert.equal(store.has(legacySecureStoreChunkKey(LOGICAL_KEY, 0)), false);
  assert.equal(store.has(failedKey), false);
});

test("legacy registry and native bridge reject ambiguous cleanup targets", async () => {
  assert.deepEqual(parseLegacySecureStorageRegistry(null), {
    present: false,
    valid: true,
    keys: [],
  });
  assert.equal(
    parseLegacySecureStorageRegistry(
      JSON.stringify([LOGICAL_KEY, "unsafe:key"]),
    ).valid,
    false,
  );
  assert.equal(parseLegacySecureStorageRegistry("{").valid, false);
  assert.deepEqual(
    createSecureStoragePurgePlan(
      [LOGICAL_KEY],
      parseLegacySecureStorageRegistry("{"),
    ),
    {
      keys: [LOGICAL_KEY],
      legacyRegistryPresent: true,
      legacyRegistryValid: false,
      trustedLegacyKeys: [],
    },
  );

  const [bridge, storage] = await Promise.all([
    readFile(
      new URL(
        "../apps/mobile/src/lib/legacySecureStoreNative.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../apps/mobile/src/lib/secureStorage.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(bridge, /getValueWithKeyAsync/);
  assert.match(bridge, /deleteValueWithKeyAsync/);
  assert.doesNotMatch(bridge, /setValueWithKey/);
  assert.match(storage, /migrateLegacySecureStorageValue/);
  assert.match(storage, /purgeLegacySecureStorageValueIfPresent/);
  assert.match(storage, /writeCurrentValue: \(value\) => setItemInternal\(key, value, false\)/);
  assert.match(storage, /returnValueWhenCleanupFails: true/u);

  const clearCurrentKeys = storage.indexOf(
    "const currentKeys = await readRegistry()",
  );
  const writeCurrentRetryRegistry = storage.indexOf(
    "await writeRegistry(failedKeys)",
  );
  const rejectInvalidLegacyRegistry = storage.indexOf(
    "if (!legacyRegistryValid)",
  );
  assert.ok(clearCurrentKeys >= 0);
  assert.ok(writeCurrentRetryRegistry > clearCurrentKeys);
  assert.ok(rejectInvalidLegacyRegistry > writeCurrentRetryRegistry);

  const incompleteCurrentValue = storage.indexOf(
    "if (chunks.some((chunk) => chunk === null))",
  );
  const recoverLegacyValue = storage.indexOf(
    "const recovered = await migrateLegacySecureStorageValue",
    incompleteCurrentValue,
  );
  const validCurrentValue = storage.indexOf(
    "// Existing valid keys",
    incompleteCurrentValue,
  );
  assert.ok(incompleteCurrentValue >= 0);
  assert.ok(recoverLegacyValue > incompleteCurrentValue);
  assert.ok(recoverLegacyValue < validCurrentValue);
  assert.doesNotMatch(
    storage.slice(incompleteCurrentValue, validCurrentValue),
    /purgeLegacyKeyIfPresent/u,
  );
  assert.match(
    storage.slice(validCurrentValue),
    /try \{[\s\S]*purgeLegacyKeyIfPresent\(key\)[\s\S]*catch \{/u,
  );
});
