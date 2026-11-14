import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { isChatAdminStorageObjectAbsent } from "../src/lib/chatAdminStorageAbsence.mjs";

const workspace = "11111111-1111-4111-8111-111111111111";
const character = "22222222-2222-4222-8222-222222222222";
const asset = "33333333-3333-4333-8333-333333333333";
const objectPath = `${workspace}/${character}/${asset}.webp`;
const bucketUrl = "https://storage.invalid/storage/v1/object/chat-character-media";
const probeUrl = `https://storage.invalid/storage/v1/object/authenticated/chat-character-media/${objectPath}`;

function storageHarness({ deletion = [{ name: objectPath }], status = 404, probeError = false, malformed = false, probeBody={statusCode:"404",error:"not_found",message:"Object not found",code:"NoSuchKey"} } = {}) {
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
    isChatAdminStorageObjectAbsent,
    mediaId: value => value,
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (init.method === "DELETE") return malformed ? new Response("not-json") : Response.json(deletion);
      if (probeError) throw new Error("synthetic_transport_failure");
      const response=Response.json(probeBody,{status}),reader=response.body.getReader();
      return {status,headers:response.headers,body:{getReader:()=>({read:()=>reader.read(),cancel:async()=>{cancelled=true;await reader.cancel();}})}};
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
    for (const status of [200, 301, 400, 401, 403, 429, 500]) {
      const h = storageHarness({ deletion, status,probeBody:{statusCode:String(status),error:"AccessDenied",message:"Denied",code:"AccessDenied"} });
      await assert.rejects(h.remove(), /media_cleanup_unverified/u);
      assert.equal(h.calls.length, 2);
      assert.equal(h.cancelled(), true);
    }
    const h = storageHarness({ deletion, probeError: true });
    await assert.rejects(h.remove(), /synthetic_transport_failure/u);
    assert.equal(h.calls.length, 2);
  }
});

test("actual legacy NoSuchKey HTTP400 is accepted only with its exact bounded error envelope",async()=>{
 for(const deletion of [[{name:objectPath}],[]]){
  const h=storageHarness({deletion,status:400});assert.equal((await h.remove()).length,0);assert.equal(h.calls[1].url,probeUrl);assert.equal(h.cancelled(),true);
 }
 for(const status of [400,404])for(const probeBody of [
  null,[],{}, {code:"NoSuchBucket",message:"Object not found",statusCode:"404",error:"not_found"},
  {code:"AccessDenied",message:"Object not found",statusCode:"404",error:"not_found"},
  {code:"NoSuchKey",message:"Permission denied",statusCode:"404",error:"not_found"},
  {code:"NoSuchKey",message:"Object not found",statusCode:"403",error:"not_found"},
  {code:"NoSuchKey",message:"Object not found",statusCode:"404",error:"unauthorized"},
  {code:"NoSuchKey",message:"Object not found",statusCode:"404",error:"not_found",resource:"foreign.webp"},
 ])await assert.rejects(storageHarness({status,probeBody}).remove(),/media_cleanup_unverified/u);
 assert.equal(await isChatAdminStorageObjectAbsent(Response.json({code:"NoSuchKey",message:"Object not found"},{status:404})),true);
 assert.equal(await isChatAdminStorageObjectAbsent(Response.json({code:"NoSuchKey",message:"Object not found"},{status:400})),false);
});

test("absence cannot be inferred from empty, malformed, oversized, non-JSON or failed streams",async()=>{
 for(const response of [new Response(null,{status:404}),new Response("not-json",{status:400,headers:{"content-type":"application/json"}}),new Response("{}",{status:400}),new Response("x".repeat(1025),{status:400,headers:{"content-type":"application/json"}}),new Response("{}",{status:400,headers:{"content-type":"application/json","content-length":"1025"}}),new Response(null,{status:204})])assert.equal(await isChatAdminStorageObjectAbsent(response),false);
 for(const body of ['{"code":"AccessDenied","code":"NoSuchKey","message":"Object not found","statusCode":"404","error":"not_found"}','{"co\\u0064e":"NoSuchKey","message":"Object not found"}'])assert.equal(await isChatAdminStorageObjectAbsent(new Response(body,{status:404,headers:{"content-type":"application/json"}})),false);
 const broken=new Response(new ReadableStream({pull(controller){controller.error(Error("stream_failed"));}}),{status:400,headers:{"content-type":"application/json"}});
 await assert.rejects(isChatAdminStorageObjectAbsent(broken),/stream_failed/u);
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
