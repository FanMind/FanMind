import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { isChatAdminStorageObjectAbsent, waitForChatAdminStorageObjectAbsent } from "../src/lib/chatAdminStorageAbsence.mjs";

const workspace = "11111111-1111-4111-8111-111111111111";
const character = "22222222-2222-4222-8222-222222222222";
const asset = "33333333-3333-4333-8333-333333333333";
const objectPath = `${workspace}/${character}/${asset}.webp`;
const bucketUrl = "https://storage.invalid/storage/v1/object/chat-character-media";
const probeUrl = `https://storage.invalid/storage/v1/object/authenticated/chat-character-media/${objectPath}`;

function storageHarness({ deletion = [{ name: objectPath }], status = 404, probeError = false, malformed = false, revoked=false,metadataMissing=false,probeSequence=[],cacheStatus,deleteDuration=0,kind="image",probeBody={statusCode:"404",error:"not_found",message:"Object not found",code:"NoSuchKey"} } = {}) {
  const calls = [];
  let cancelled = false,clock=0,probeIndex=0;
  const waits=[],budgets=[];
  class MediaError extends Error { constructor(code) { super(code); this.code = code; } }
  const source = stripTypeScriptTypes(readFileSync("src/lib/chatAdminMedia.ts", "utf8"));
  // Execute the real storage helper with only its imports replaced. No provider,
  // framework, credentials or live Storage target is used by this regression.
  const code = source.replace(/^import[^\n]*;\s*$/gmu, "").replace(/^export /gmu, "");
  assert.doesNotMatch(code, /^import /mu);
  const context = {
    Buffer, AbortSignal,performance:{now:()=>clock},
    process: { env: {} },
    cookies: async () => ({ get: () => ({ value: "synthetic-owner-jwt" }) }),
    SUPABASE_ACCESS_TOKEN_COOKIE: "synthetic-session",
    getSupabaseHeaders: token => ({ apikey: "synthetic-public-key", Authorization: `Bearer ${token}` }),
    getSupabaseRestUrl: path => `https://rest.invalid/${path}`,
    getChatCharacter: async () => {if(revoked)throw new MediaError('resource_forbidden');return {id:character,workspace_id:workspace,status:'active'};},
    requireSupabasePublicConfig: () => ({ url: "https://storage.invalid" }),
    ChatAdminMediaError: MediaError,
    WorkspaceAuthorizationError: MediaError,
    MEDIA_BUCKET: "chat-character-media",
    MEDIA_MAX_BYTES: 5 * 1024 * 1024,
    MEDIA_MAX_ITEMS: 100,
    isChatAdminStorageObjectAbsent,
    mediaExtension:()=>kind==='video'?'mp4':'webp',
    waitForChatAdminStorageObjectAbsent:(probe,options)=>{budgets.push(options.budgetMs);return waitForChatAdminStorageObjectAbsent(probe,{...options,now:()=>clock,sleep:async ms=>{waits.push(ms);clock+=ms;}});},
    mediaId: value => value,
    fetch: async (url, init) => {
      calls.push({ url, init });
      if(url.startsWith('https://rest.invalid/'))return Response.json(metadataMissing&&init.method==='DELETE'?[]:[{id:asset,workspace_id:workspace,character_id:character,revision:2}]);
      if (init.method === "DELETE") {clock+=deleteDuration;return malformed ? new Response("not-json") : Response.json(deletion);}
      const next=probeSequence[probeIndex++]??{};clock+=next.elapsed??0;
      if (probeError||next.error) throw new Error("synthetic_transport_failure");
      const currentStatus=next.status??status,cache=next.cacheStatus??cacheStatus;
      const response=Response.json(next.body??probeBody,{status:currentStatus,headers:cache?{"cf-cache-status":cache}:{}}),reader=response.body.getReader();
      return {status:currentStatus,headers:response.headers,body:{getReader:()=>({read:()=>reader.read(),cancel:async()=>{cancelled=true;await reader.cancel();}})}};
    },
  };
  runInNewContext(`${code}\nglobalThis.mediaObjectUnderTest = mediaObject;globalThis.cleanupUnderTest = cleanupFailedMediaUpload;`, context);
  return { calls, waits,budgets,time:()=>clock,cancelled: () => cancelled, cleanup: () => context.cleanupUnderTest(workspace,character,{id:asset,workspace_id:workspace,character_id:character,revision:1,media_type:'image'}), remove: () => context.mediaObjectUnderTest(workspace, character, asset, "DELETE",undefined,kind) };
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

test('failed upload cleanup tombstones first, verifies physical absence, reauthorizes and removes only the exact tombstone revision',async()=>{
 const h=storageHarness();await h.cleanup();
 assert.equal(h.calls.length,4);
 assert.equal(h.calls[0].init.method,'PATCH');
 assert.deepEqual(JSON.parse(h.calls[0].init.body),{deleted:true,available:false,reviewed:false});
 assert.equal(h.calls[1].url,bucketUrl);assert.equal(h.calls[2].url,probeUrl);
 assert.equal(h.calls[3].init.method,'DELETE');
 assert.match(h.calls[3].url,/workspace_id=eq\./);assert.match(h.calls[3].url,/character_id=eq\./);
 assert.match(h.calls[3].url,/revision=eq\.2&deleted=eq\.true/);
 for(const opts of [{status:200,probeBody:{}},{probeError:true},{revoked:true}]){
  const h=storageHarness(opts);await assert.rejects(h.cleanup());
  assert.ok(!h.calls.some(x=>x.url.startsWith('https://rest.invalid/')&&x.init.method==='DELETE'),'uncertain absence or revoked authority must retain the tracked tombstone');
 }
 await assert.rejects(storageHarness({metadataMissing:true}).cleanup(),/media_cleanup_unverified/);
});

test('acknowledged DELETE waits for cached positives to become strict absence using only the same authenticated GET',async()=>{
 for(const deletion of [[{name:objectPath}],[]]){
  const h=storageHarness({deletion,status:400,probeSequence:Array.from({length:5},()=>({status:200,cacheStatus:'HIT',elapsed:200}))});
  assert.equal((await h.remove()).length,0);
  assert.equal(h.calls.filter(c=>c.init.method==='DELETE').length,1);
  assert.equal(h.calls.length,7);
  for(const call of h.calls.slice(1)){
   assert.equal(call.url,probeUrl);assert.equal(call.init.method,undefined);
   assert.equal(call.init.headers.Authorization,h.calls[0].init.headers.Authorization);
   assert.equal(call.init.cache,'no-store');assert.equal(call.init.redirect,'error');
   assert.ok(call.init.signal instanceof AbortSignal);
  }
  assert.equal(h.time(),19_000); // Network elapsed time is included in absolute offsets.
  assert.deepEqual(h.waits,[800,1_800,3_800,7_800,3_800]);
 }
});

test('a persistent CDN HIT never proves absence and stops after six reads without metadata deletion',async()=>{
 const h=storageHarness({status:200,cacheStatus:'HIT'});
 await assert.rejects(h.cleanup(),/media_cleanup_unverified/);
 assert.equal(h.calls.filter(c=>c.url===bucketUrl&&c.init.method==='DELETE').length,1);
 assert.equal(h.calls.filter(c=>c.url===probeUrl).length,6);
 assert.ok(!h.calls.some(c=>c.url.startsWith('https://rest.invalid/')&&c.init.method==='DELETE'));
 assert.equal(h.time(),19_000);assert.equal(h.cancelled(),true);
});

test('cache rechecks stop on readable origin, uncertain absence, authorization and transport errors',async()=>{
 for(const next of [
  {status:200,cacheStatus:'BYPASS'},{status:200,cacheStatus:'MISS'},
  {status:401},{status:403},{status:429},{status:500},
  {status:404,body:{code:'AccessDenied',message:'Object not found'}},{error:true},
 ]){
  const h=storageHarness({probeSequence:[{status:200,cacheStatus:'HIT'},next]});
  await assert.rejects(h.remove(),next.error?/synthetic_transport_failure/:/media_cleanup_unverified/);
  assert.equal(h.calls.length,3);assert.equal(h.time(),1_000);
 }
});

test('absence budget includes DELETE latency and retains the original image/video upper bounds',async()=>{
 for(const [kind,deleteDuration,limit] of [['image',14_500,25_000],['video',29_000,40_000]]){
  const path=kind==='video'?objectPath.replace('.webp','.mp4'):objectPath;
  const h=storageHarness({kind,deletion:[{name:path}],deleteDuration,status:200,cacheStatus:'HIT'});
  await assert.rejects(h.remove(),/media_cleanup_unverified/);
  assert.equal(h.budgets[0],limit-deleteDuration);
  assert.equal(h.calls.length,5);assert.ok(h.time()<limit);
 }
});

test('expired or invalid budgets and late absence cannot produce success',async()=>{
 for(const budgetMs of [0,-1,NaN,Infinity,20_001]){
  let calls=0;
  assert.equal(await waitForChatAdminStorageObjectAbsent(async()=>{calls++;return Response.json({});},{budgetMs}),false);
  assert.equal(calls,0);
 }
 let clock=0,calls=0;
 const absent=()=>Response.json({code:'NoSuchKey',message:'Object not found'},{status:404});
 assert.equal(await waitForChatAdminStorageObjectAbsent(async()=>{calls++;clock=20_001;return absent();},{now:()=>clock}),false);
 assert.equal(calls,1);
});
