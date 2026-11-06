import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  OFFLINE_READ_CACHE_KEY,
  OFFLINE_READ_CACHE_MAX_AGE_MS,
  OFFLINE_READ_CACHE_MAX_CONTACTS,
  OFFLINE_READ_CACHE_MAX_SERIALIZED_LENGTH,
  createOfflineReadCache,
  filterOfflineContacts,
  isOfflineEligibleStatus,
  normalizeOfflineReadCache,
} from "../apps/mobile/src/lib/offlineReadCachePolicy.mjs";
import {
  SECURE_STORAGE_REGISTRY_KEY,
  SECURE_STORE_KEY_PATTERN,
  assertSecureStorageLogicalKey,
  secureStoreChunkKey,
  secureStoreCountKey,
} from "../apps/mobile/src/lib/secureStorageKeyPolicy.mjs";
import { createSerialOperationQueue } from "../apps/mobile/src/lib/serialOperationQueue.mjs";
import { normalizeSecureStorageRegistry } from "../apps/mobile/src/lib/secureStorageRegistry.mjs";
import {
  splitUtf8String,
  utf8ByteLength,
} from "../apps/mobile/src/lib/utf8StoragePolicy.mjs";
import { createOfflineReadCacheAccessGate } from "../apps/mobile/src/lib/offlineReadCacheAccessPolicy.mjs";

const NOW = Date.UTC(2026, 6, 25, 12, 0, 0);
const USER_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";

function contact(index = 1, overrides = {}) {
  return {
    id: `33333333-3333-4333-8333-${String(index).padStart(12, "0")}`,
    workspace_id: WORKSPACE_ID,
    display_name: `Kontakt ${index}`,
    handle: `@kontakt${index}`,
    source_platform: index % 2 ? "instagram" : "manual",
    status: index === 1 ? "vip" : "warm",
    summary: `Nicht offline speichern ${index}`,
    internal_notes: `Geheime Notiz ${index}`,
    tags: ["secret"],
    language: "de",
    updated_at: "2026-07-25T10:00:00.000Z",
    created_at: "2026-07-20T10:00:00.000Z",
    ...overrides,
  };
}

test("all SecureStore physical keys follow Expo's device key contract", () => {
  const logicalKeys = [
    "sb-project-auth-token",
    OFFLINE_READ_CACHE_KEY,
  ];
  assert.match(SECURE_STORAGE_REGISTRY_KEY, SECURE_STORE_KEY_PATTERN);
  assert.equal(SECURE_STORAGE_REGISTRY_KEY, "fanmind.secure-storage-registry.v2");
  for (const key of logicalKeys) {
    assert.equal(assertSecureStorageLogicalKey(key), key);
    assert.match(secureStoreCountKey(key), SECURE_STORE_KEY_PATTERN);
    assert.match(secureStoreChunkKey(key, 0), SECURE_STORE_KEY_PATTERN);
    assert.match(secureStoreChunkKey(key, 63), SECURE_STORE_KEY_PATTERN);
    assert.doesNotMatch(secureStoreCountKey(key), /:/u);
    assert.doesNotMatch(secureStoreChunkKey(key, 0), /:/u);
  }
  assert.throws(() => assertSecureStorageLogicalKey("fanmind:invalid"));
  assert.throws(() => secureStoreChunkKey("fanmind.valid", -1));
  assert.deepEqual(
    normalizeSecureStorageRegistry(
      JSON.stringify(["sb-project-auth-token", "fanmind:invalid"]),
    ),
    ["sb-project-auth-token"],
  );
});

test("serialized local-storage operations retain order across failures", async () => {
  const queue = createSerialOperationQueue();
  const order = [];
  let releaseFirst;
  const firstGate = new Promise((resolve) => {
    releaseFirst = resolve;
  });

  const first = queue.run(async () => {
    order.push("first:start");
    await firstGate;
    order.push("first:end");
  });
  const failed = queue.run(async () => {
    order.push("failed");
    throw new Error("expected");
  });
  const last = queue.run(async () => {
    order.push("last");
  });

  await Promise.resolve();
  assert.deepEqual(order, ["first:start"]);
  releaseFirst();
  await first;
  await assert.rejects(failed, /expected/u);
  await last;
  await queue.drain();
  assert.deepEqual(order, ["first:start", "first:end", "failed", "last"]);
});

test("logout suspension rejects stale auth events until an explicit resume", () => {
  const gate = createOfflineReadCacheAccessGate();
  assert.equal(gate.resume(USER_ID), true);
  assert.equal(gate.canUse(USER_ID), true);
  gate.suspend();
  assert.equal(gate.activate(USER_ID), false);
  assert.equal(gate.canUse(USER_ID), false);

  const nextUserId = "44444444-4444-4444-8444-444444444444";
  assert.equal(gate.resume(nextUserId), true);
  assert.equal(gate.canUse(nextUserId), true);
  assert.equal(gate.activate(USER_ID), false);
  assert.equal(gate.canUse(USER_ID), false);
});

test("SecureStore chunks are bounded by UTF-8 bytes without splitting characters", () => {
  const value = "FanMind äöü 🚀 ".repeat(800);
  const chunks = splitUtf8String(value, 1800);
  assert.equal(chunks.join(""), value);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => utf8ByteLength(chunk) <= 1800));
  assert.equal(utf8ByteLength("🚀"), 4);
});

test("offline cache is bounded, minimal and workspace-scoped", () => {
  const contacts = Array.from(
    { length: OFFLINE_READ_CACHE_MAX_CONTACTS + 10 },
    (_, index) => contact(index + 1),
  );
  const cache = createOfflineReadCache({
    userId: USER_ID,
    workspaceId: WORKSPACE_ID,
    workspaceName: "FanMind Test",
    contacts,
    cachedAt: NOW,
  });

  assert.equal(cache.contacts.length, OFFLINE_READ_CACHE_MAX_CONTACTS);
  assert.equal(cache.contacts[0].summary, null);
  assert.deepEqual(Object.keys(cache.contacts[0]).sort(), [
    "display_name",
    "handle",
    "id",
    "source_platform",
    "status",
    "summary",
    "updated_at",
    "workspace_id",
  ]);
  const serialized = JSON.stringify(cache);
  assert.ok(utf8ByteLength(serialized) < OFFLINE_READ_CACHE_MAX_SERIALIZED_LENGTH);
  assert.doesNotMatch(
    serialized,
    /Geheime Notiz|Nicht offline speichern|internal_notes|language|tags/u,
  );
  assert.throws(() =>
    createOfflineReadCache({
      userId: USER_ID,
      workspaceId: WORKSPACE_ID,
      workspaceName: "FanMind Test",
      contacts: [contact(1, { workspace_id: "foreign-workspace" })],
      cachedAt: NOW,
    }),
  );
});

test("offline cache rejects stale, future, corrupt and cross-account data", () => {
  const cache = createOfflineReadCache({
    userId: USER_ID,
    workspaceId: WORKSPACE_ID,
    workspaceName: "FanMind Test",
    contacts: [contact()],
    cachedAt: NOW,
  });
  const raw = JSON.stringify(cache);

  assert.equal(
    normalizeOfflineReadCache(raw, { userId: USER_ID, workspaceId: WORKSPACE_ID, now: NOW })
      ?.contacts.length,
    1,
  );
  assert.equal(
    normalizeOfflineReadCache(raw, { userId: "other-user", now: NOW }),
    null,
  );
  assert.equal(
    normalizeOfflineReadCache(raw, { userId: USER_ID, workspaceId: "other", now: NOW }),
    null,
  );
  assert.equal(
    normalizeOfflineReadCache(raw, {
      userId: USER_ID,
      now: NOW + OFFLINE_READ_CACHE_MAX_AGE_MS + 1,
    }),
    null,
  );
  assert.equal(
    normalizeOfflineReadCache(raw, { userId: USER_ID, now: NOW - 6 * 60 * 1000 }),
    null,
  );
  assert.equal(normalizeOfflineReadCache("{", { userId: USER_ID, now: NOW }), null);
  assert.equal(
    normalizeOfflineReadCache(
      "x".repeat(OFFLINE_READ_CACHE_MAX_SERIALIZED_LENGTH + 1),
      { userId: USER_ID, now: NOW },
    ),
    null,
  );
});

test("temporary Admin CRM cache expires no later than its entitlement", () => {
  const expiresAt = NOW + 60 * 60 * 1000;
  const cache = createOfflineReadCache({
    userId: USER_ID,
    workspaceId: WORKSPACE_ID,
    workspaceName: "Temporary CRM",
    contacts: [contact()],
    cachedAt: NOW,
    accessExpiresAt: new Date(expiresAt).toISOString(),
  });
  assert.equal(cache.cacheValidUntil, expiresAt);
  assert.equal(normalizeOfflineReadCache(JSON.stringify(cache), {
    userId: USER_ID, now: expiresAt - 1,
  })?.contacts.length, 1);
  assert.equal(normalizeOfflineReadCache(JSON.stringify(cache), {
    userId: USER_ID, now: expiresAt,
  }), null);
  assert.equal(normalizeOfflineReadCache(JSON.stringify(cache), {
    userId: USER_ID, now: expiresAt + 1,
  }), null);
  assert.throws(() => createOfflineReadCache({
    userId: USER_ID,
    workspaceId: WORKSPACE_ID,
    workspaceName: "Blocked CRM",
    contacts: [contact()],
    cachedAt: NOW,
    accessExpiresAt: new Date(NOW).toISOString(),
  }));

  const permanent = createOfflineReadCache({
    userId: USER_ID,
    workspaceId: WORKSPACE_ID,
    workspaceName: "Permanent CRM",
    contacts: [contact()],
    cachedAt: NOW,
  });
  assert.equal(permanent.cacheValidUntil, NOW + OFFLINE_READ_CACHE_MAX_AGE_MS);
});

test("offline search is local and fallback eligibility is status-zero only", () => {
  const cached = createOfflineReadCache({
    userId: USER_ID,
    workspaceId: WORKSPACE_ID,
    workspaceName: "FanMind Test",
    contacts: [contact(1), contact(2)],
    cachedAt: NOW,
  });
  assert.deepEqual(
    filterOfflineContacts(cached.contacts, "KONTAKT 2").map(({ id }) => id),
    [contact(2).id],
  );
  assert.equal(filterOfflineContacts(cached.contacts, "instagram").length, 1);
  assert.equal(isOfflineEligibleStatus(0), true);
  assert.equal(isOfflineEligibleStatus(401), false);
  assert.equal(isOfflineEligibleStatus(403), false);
  assert.equal(isOfflineEligibleStatus(500), false);
  assert.equal(isOfflineEligibleStatus(undefined), false);
});

test("mobile cache integration stays read-only and logout drains writes before purge", async () => {
  const [data, cache, contacts, auth, settings, secureStorage] = await Promise.all([
    readFile("apps/mobile/src/lib/data.ts", "utf8"),
    readFile("apps/mobile/src/lib/offlineReadCache.ts", "utf8"),
    readFile("apps/mobile/app/(app)/contacts/index.tsx", "utf8"),
    readFile("apps/mobile/src/providers/AuthProvider.tsx", "utf8"),
    readFile("apps/mobile/app/(app)/settings.tsx", "utf8"),
    readFile("apps/mobile/src/lib/secureStorage.ts", "utf8"),
  ]);

  assert.match(data, /isOfflineEligibleStatus\(result\.status\)/u);
  assert.doesNotMatch(data, /isOfflineEligibleError/u);
  assert.match(cache, /if \(!ownerCanUseCache\(input\.userId\)\) return false/u);
  assert.match(cache, /await cacheOperations\.drain\(\)/u);
  assert.match(contacts, /Offline · nur lesen/u);
  assert.match(contacts, /Offline · keine lokalen Daten/u);
  assert.match(contacts, /disabled=\{offlineReadOnly\}/u);
  assert.match(contacts, /Bis zu 50 zuletzt geladene Kontakte/u);
  assert.match(contacts, /if \(!search\.trim\(\)\)/u);
  assert.match(contacts, /OFFLINE_READ_CACHE_MAX_AGE_MS/u);
  assert.match(contacts, /AppState\.addEventListener\("change"/u);
  assert.match(contacts, /Der gespeicherte Kontaktstand ist abgelaufen/u);
  assert.match(settings, /Kontaktwissen,[\s\S]*KI-Inhalte[\s\S]*nicht offline gespeichert/u);
  assert.match(secureStorage, /createSerialOperationQueue/u);

  const disableIndex = auth.indexOf("await disableOfflineReadCacheWrites()");
  const signOutIndex = auth.indexOf('supabase.auth.signOut({ scope: "local" })');
  const purgeIndex = auth.indexOf("await clearSecureLocalStorage()");
  assert.ok(disableIndex >= 0);
  assert.ok(disableIndex < signOutIndex);
  assert.ok(signOutIndex < purgeIndex);
  assert.match(auth, /resumeOfflineReadCacheOwner/u);
});

test("offline cache truth is synchronized across Mobile readers", async () => {
  const [readme, architecture, beta, sourceOfTruth, roadmap, agents] =
    await Promise.all([
      readFile("README.md", "utf8"),
      readFile("docs/mobile/ARCHITECTURE.md", "utf8"),
      readFile("docs/mobile/BETA_RELEASE.md", "utf8"),
      readFile("docs/SOURCE_OF_TRUTH.md", "utf8"),
      readFile("src/config/roadmap.ts", "utf8"),
      readFile("AGENTS.md", "utf8"),
    ]);
  const readers = `${readme}\n${architecture}\n${beta}\n${sourceOfTruth}\n${roadmap}\n${agents}`;
  assert.match(readers, /maximal 50|at most 50|limited to 50/u);
  assert.match(readers, /24 Stunden|24 hours|24 h/u);
  assert.match(roadmap, /Verschlüsselte Offline-Kontaktübersicht/u);
  assert.doesNotMatch(readers, /aktuelle App besitzt noch keinen Offline-Kontaktcache/u);
  assert.doesNotMatch(readers, /future offline caches/u);
});
