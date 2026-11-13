import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";

const workspace = "11111111-1111-4111-8111-111111111111";
const character = "22222222-2222-4222-8222-222222222222";
const asset = "33333333-3333-4333-8333-333333333333";
const objectPath = `${workspace}/${character}/${asset}.webp`;
const bucketUrl = "https://storage.invalid/storage/v1/object/chat-character-media";
const probeUrl = `https://storage.invalid/storage/v1/object/authenticated/chat-character-media/${objectPath}`;

function storageHarness({ deletion = [{ name: objectPath }], status = 404, probeError = false, malformed = false } = {}) {
  const calls = [];
  let cancelled = false;
  class MediaError extends Error { constructor(code) { super(code); this.code = code; } }
  const source = stripTypeScriptTypes(readFileSync("src/lib/chatAdminMedia.ts", "utf8"));
  // Execute the real storage helper with only its imports replaced. No provider,
  // framework, credentials or live Storage target is used by this regression.
  const code = source.replace(/^import[^\n]*;\s*$/gmu, "").replace(/^export /gmu, "");
  assert.doesNotMatch(code, /^import /mu);
  const context = {
    Buffer, AbortSignal,
    process: { env: {} },
    cookies: async () => ({ get: () => ({ value: "synthetic-owner-jwt" }) }),
    SUPABASE_ACCESS_TOKEN_COOKIE: "synthetic-session",
    getSupabaseHeaders: token => ({ apikey: "synthetic-public-key", Authorization: `Bearer ${token}` }),
    requireSupabasePublicConfig: () => ({ url: "https://storage.invalid" }),
    ChatAdminMediaError: MediaError,
    WorkspaceAuthorizationError: MediaError,
    MEDIA_BUCKET: "chat-character-media",
    MEDIA_MAX_BYTES: 5 * 1024 * 1024,
    MEDIA_MAX_ITEMS: 100,
    mediaId: value => value,
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (init.method === "DELETE") return malformed ? new Response("not-json") : Response.json(deletion);
      if (probeError) throw new Error("synthetic_transport_failure");
      return { status, body: { cancel: async () => { cancelled = true; } } };
    },
  };
  runInNewContext(`${code}\nglobalThis.mediaObjectUnderTest = mediaObject;`, context);
  return { calls, cancelled: () => cancelled, remove: () => context.mediaObjectUnderTest(workspace, character, asset, "DELETE") };
}

test("Storage deletion acknowledgment and retry both require the same authenticated absence probe", async () => {
  for (const deletion of [[{ name: objectPath }], []]) {
    const h = storageHarness({ deletion });
    assert.equal((await h.remove()).length, 0);
    assert.equal(h.calls.length, 2);
    assert.equal(h.calls[0].url, bucketUrl);
    assert.deepEqual(JSON.parse(h.calls[0].init.body), { prefixes: [objectPath] });
    assert.equal(h.calls[1].url, probeUrl);
    assert.equal(h.calls[1].init.headers.Authorization, h.calls[0].init.headers.Authorization);
    assert.equal(h.calls[1].init.cache, "no-store");
    assert.equal(h.calls[1].init.redirect, "error");
    assert.ok(h.calls[1].init.signal instanceof AbortSignal);
    assert.equal(h.cancelled(), true);
  }
});

test("Storage deletion cannot succeed when acknowledged or retried objects are still readable or absence is uncertain", async () => {
  for (const deletion of [[{ name: objectPath }], []]) {
    for (const status of [200, 204, 301, 400, 401, 403, 429, 500]) {
      const h = storageHarness({ deletion, status });
      await assert.rejects(h.remove(), /media_cleanup_unverified/u);
      assert.equal(h.calls.length, 2);
      assert.equal(h.cancelled(), true);
    }
    const h = storageHarness({ deletion, probeError: true });
    await assert.rejects(h.remove(), /synthetic_transport_failure/u);
    assert.equal(h.calls.length, 2);
  }
});

test("Storage deletion rejects ambiguous response identities before probing", async () => {
  for (const deletion of [null, {}, [{ name: "foreign.webp" }], [{ name: objectPath }, { name: objectPath }], [null]]) {
    const h = storageHarness({ deletion });
    await assert.rejects(h.remove(), /media_cleanup_unverified/u);
    assert.equal(h.calls.length, 1);
  }
  const h = storageHarness({ malformed: true });
  await assert.rejects(h.remove(), SyntaxError);
  assert.equal(h.calls.length, 1);
});
