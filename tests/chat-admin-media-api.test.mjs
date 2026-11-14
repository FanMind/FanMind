import assert from "node:assert/strict";
import './chat-admin-media-schema.cases.mjs';
import './chat-admin-media-host-readiness.cases.mjs';
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as mediaPolicy from "../src/lib/chatAdminMediaPolicy.mjs";
import * as mutationPolicy from "../src/lib/httpMutationPolicy.mjs";
import { WorkspaceAuthorizationError } from "../src/lib/workspaceAuthorizationPolicy.mjs";
import { deleteOwnedChatAdminMedia } from "../src/lib/chatAdminMediaDeletion.mjs";
const w="11111111-1111-4111-8111-111111111111",c="22222222-2222-4222-8222-222222222222",id="33333333-3333-4333-8333-333333333333";
const compile=path=>ts.transpileModule(readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
class NextResponse extends Response{static json(value,init){return new NextResponse(JSON.stringify(value),{...init,headers:{"content-type":"application/json",...init?.headers}});}}
function harness(options={}){
 let revision=1;const calls={objects:[],writes:[],providers:0,usage:0};
 const asset={id,workspace_id:w,character_id:c,description:"",tags:[],folder:"",offer_id:"",reviewed:false,available:true,deleted:false,revision:1,...options.asset};
 const character=()=>({id:c,workspace_id:w,revision,status:"active",sales_playbook:{offers:[]}});
 const context={workspace:{id:w},user:{id:"owner"}};
 const deps={
  "next/server":{NextResponse},
  "@/lib/chatAdmin":{requireChatAdminCapability:async()=>{if(options.denied||options.revokeAfterProvider&&calls.providers)throw new WorkspaceAuthorizationError("Denied","resource_forbidden");return context;}},
  "@/lib/chatAdminMediaPolicy.mjs":mediaPolicy,
  "@/lib/chatAdminMedia":{
   requireMediaEnabled(){if(options.disabled)throw new mediaPolicy.ChatAdminMediaError("media_not_enabled");},
   async assertMediaCharacter(workspaceId,characterId,expected){if(options.revokeAfterStorage&&calls.objects.length||workspaceId!==w||characterId!==c)throw new WorkspaceAuthorizationError("Denied","resource_forbidden");if(expected!==undefined&&expected!==revision)throw new mediaPolicy.ChatAdminMediaError("stale_media_context");return character();},
   async getMediaAsset(workspaceId,characterId,assetId){if(workspaceId!==w||characterId!==c||assetId!==id)throw new WorkspaceAuthorizationError("Denied","resource_forbidden");return {...asset};},
   loadCharacterMedia:async()=>({assets:[{...asset}],policy:{enabled:false,revision:0}}),
   mediaScope:(workspaceId,characterId)=>`workspace_id=eq.${workspaceId}&character_id=eq.${characterId}`,
   mediaRest:async(path,init)=>{calls.writes.push({path,body:JSON.parse(init.body??"{}"),headers:init.headers});revision++;if(init.method==="DELETE"&&options.emptyMetadataDelete)return [];if(options.minimalPolicyResponse&&path==="chat_character_media_policies"&&init.headers?.Prefer!=="return=representation")throw new SyntaxError("Empty PostgREST 201 response is not JSON");return [{...asset}];},
   mediaObject:async(...args)=>{calls.objects.push(args);if(options.objectFails)throw new mediaPolicy.ChatAdminMediaError("media_object_unavailable");return Buffer.from("synthetic-private-image");},
   updateMediaAsset:async(workspaceId,characterId,previous,patch)=>{calls.writes.push({patch,workspaceId,characterId});Object.assign(asset,patch,{revision:asset.revision+1});revision++;return {...asset};},
  },
  "@/lib/chatAdminMediaImage":{normalizeMediaImage:async bytes=>bytes},
  "@/lib/httpMutationPolicy.mjs":mutationPolicy,
  "@/lib/workspaceAuthorization":{WorkspaceAuthorizationError},
  "@/lib/sharedRateLimit":{consumeSharedRateLimit:async()=>({allowed:!options.rateDenied})},
  "@/lib/chatAdminModelPolicy.mjs":{getChatAdminModelProfile:()=>({model:"synthetic-test"}),CHAT_ADMIN_MODEL_TIMEOUT_MS:55_000},
  "@/lib/aiUsage":{recordAiUsageEvent:async()=>{calls.usage++;}},
 };
 const load=path=>{const exports={};runInNewContext(compile(path),{exports,process:{env:{FANMIND_CHAT_ADMIN_MEDIA_ANALYSIS_ENABLED:options.analysisDisabled?"false":"true",OPENAI_API_KEY:"synthetic-placeholder"}},Request,Response,Buffer,AbortSignal,crypto,fetch:async()=>{calls.providers++;return Response.json({status:"completed",usage:{input_tokens:100,output_tokens:20,total_tokens:120},output_text:JSON.stringify({description:"Rotes Kleid am Strand",tags:["Strand","rotes Kleid"]})});},require:name=>{assert.ok(Object.hasOwn(deps,name),name);return deps[name];}});return exports;};
 const route=load("src/app/api/chatadmin/media/route.ts"),analyze=load("src/app/api/chatadmin/media/analyze/route.ts");
 const request=(body={},method="PATCH",origin="https://fanmind.invalid")=>new Request("https://fanmind.invalid/api/chatadmin/media",{method,headers:{origin,"Content-Type":"application/json"},body:JSON.stringify({character_id:c,character_revision:1,id,revision:1,description:"Strand",tags:["Strand"],folder:"Sommer",offer_id:"",reviewed:true,available:true,...body})});
 const get=(query="")=>{const request=new Request(`https://fanmind.invalid/api/chatadmin/media?character_id=${c}${query}`);Object.defineProperty(request,"nextUrl",{value:new URL(request.url)});return request;};
 return {route,analyze,request,get,calls,asset};
}
test("media API refuses foreign origin, missing capability, inactive runtime and stale binding before writes",async()=>{
 for(const [options,body,origin,status] of [[{}, {},"https://foreign.invalid",403],[{denied:true},{},undefined,403],[{disabled:true},{},undefined,503],[{}, {character_revision:0},undefined,409],[{}, {character_id:crypto.randomUUID()},undefined,403],[{}, {id:crypto.randomUUID()},undefined,403]]){
  const h=harness(options);const result=await h.route.PATCH(h.request(body,"PATCH",origin));assert.equal(result.status,status);assert.equal(h.calls.writes.length,0);assert.equal(h.calls.objects.length,0);
 }
});
test("media metadata uses authorized Workspace and Character and requires an explicit review",async()=>{
 const h=harness();const result=await h.route.PATCH(h.request({workspace_id:crypto.randomUUID()}));assert.equal(result.status,200);assert.equal(h.calls.writes[0].workspaceId,w);assert.equal(h.calls.writes[0].characterId,c);assert.equal(h.calls.writes[0].patch.reviewed,true);
 const invalid=harness();assert.equal((await invalid.route.PATCH(invalid.request({description:"",tags:[]}))).status,400);assert.equal(invalid.calls.writes.length,0);
 const foreignOffer=harness();assert.equal((await foreignOffer.route.PATCH(foreignOffer.request({offer_id:"foreign-offer"}))).status,400);assert.equal(foreignOffer.calls.writes.length,0);
});
test("private preview reauthorizes, denies tombstones and disables browser caching",async()=>{
 const h=harness();const result=await h.route.GET(h.get(`&id=${id}`));assert.equal(result.status,200);assert.equal(result.headers.get("cache-control"),"private, no-store");assert.equal(result.headers.get("content-type"),"image/webp");
 const deleted=harness({asset:{deleted:true}});assert.equal((await deleted.route.GET(deleted.get(`&id=${id}`))).status,400);assert.equal(deleted.calls.objects.length,0);
 const denied=harness({denied:true});assert.equal((await denied.route.GET(denied.get(`&id=${id}`))).status,403);assert.equal(denied.calls.objects.length,0);
});
test("deletion revokes availability before deleting the file and preserves metadata after a failed file delete",async()=>{
 const h=harness({objectFails:true});const result=await h.route.DELETE(h.request({},"DELETE"));assert.equal(result.status,503);assert.equal(h.calls.writes.length,1);assert.equal(h.calls.writes[0].patch.deleted,true);assert.equal(h.calls.writes[0].patch.available,false);
 const retry=harness({asset:{deleted:true}});assert.equal((await retry.route.DELETE(retry.request({},"DELETE"))).status,200);assert.equal(retry.calls.objects[0][3],"DELETE");assert.ok(retry.calls.writes.some(call=>call.path));
});
test("analysis requires explicit consent, rate budget and authority, then stores unreviewed output",async()=>{
 for(const [options,body,status] of [[{}, {analysis_consent:false},400],[{analysisDisabled:true},{analysis_consent:true},400],[{rateDenied:true},{analysis_consent:true},429],[{denied:true},{analysis_consent:true},403]]){
  const h=harness(options);assert.equal((await h.analyze.POST(h.request(body,"POST"))).status,status);assert.equal(h.calls.providers,0);assert.equal(h.calls.writes.length,0);
 }
 const h=harness();const result=await h.analyze.POST(h.request({analysis_consent:true},"POST"));assert.equal(result.status,200);assert.equal(h.calls.providers,1);assert.equal(h.calls.usage,1);assert.equal(h.calls.writes[0].patch.reviewed,false);
 const revoked=harness({revokeAfterProvider:true});assert.equal((await revoked.analyze.POST(revoked.request({analysis_consent:true},"POST"))).status,403);assert.equal(revoked.calls.writes.length,0);assert.equal(revoked.calls.usage,1);
});
test("account deletion requires exact owned metadata, physical absence and fails closed before removing metadata",async()=>{
 const config={supabaseUrl:"https://database.invalid",serviceKey:"synthetic-placeholder"},path=`${w}/${c}/${id}.webp`;
 for(const absent of [true,false]){
  const calls=[];
  const fetchImpl=async(url,init={})=>{calls.push({url,method:init.method??"GET"});if(url.includes("&select="))return Response.json([{id,workspace_id:w,character_id:c}]);if(init.method==="DELETE"&&url.endsWith("/chat-character-media"))return Response.json([{name:path}]);if(url.includes("/authenticated/"))return Response.json(absent?{statusCode:"404",error:"not_found",message:"Object not found",code:"NoSuchKey"}:{},{status:absent?400:200});return new Response(null,{status:204});};
  if(absent){await deleteOwnedChatAdminMedia({fetchImpl,config,workspaceIds:[w]});assert.ok(calls.at(-1).url.includes("deleted=eq.true"));}
  else{await assert.rejects(deleteOwnedChatAdminMedia({fetchImpl,config,workspaceIds:[w]}),/media_deletion_absence_failed/u);assert.ok(!calls.some(call=>call.method==="DELETE"&&call.url.includes("/rest/")));}
 }
});

import "./chat-admin-media-storage.cases.mjs";

test("video preview is private, range-aware and budgeted; video analysis never invokes the image provider",async()=>{
 const h=harness({asset:{media_type:"video"}}),request=h.get(`&id=${id}`);request.headers.set("range","bytes=0-3");
 const response=await h.route.GET(request);assert.equal(response.status,206);assert.equal(response.headers.get("content-type"),"video/mp4");assert.equal((await response.arrayBuffer()).byteLength,4);
 const invalid=harness({asset:{media_type:"video"}}),bad=invalid.get(`&id=${id}`);bad.headers.set("range","bytes=1-2,4-5");assert.equal((await invalid.route.GET(bad)).status,416);assert.equal(invalid.calls.objects.length,0);
 const denied=harness({rateDenied:true,asset:{media_type:"video"}});assert.equal((await denied.route.GET(denied.get(`&id=${id}`))).status,429);assert.equal(denied.calls.objects.length,0);
 const video=harness({asset:{media_type:"video"}});assert.equal((await video.analyze.POST(video.request({analysis_consent:true},"POST"))).status,400);assert.equal(video.calls.providers,0);
});
test("account erasure deletes video MP4 paths with authenticated absence before metadata",async()=>{
 const calls=[],path=`${w}/${c}/${id}.mp4`,config={supabaseUrl:"https://database.invalid",serviceKey:"synthetic-placeholder"};
 const fetchImpl=async(url,init={})=>{calls.push({url,method:init.method??"GET",body:init.body});if(url.includes("&select="))return Response.json([{id,workspace_id:w,character_id:c,media_type:"video"}]);if(init.method==="DELETE"&&url.endsWith("/chat-character-media"))return Response.json([{name:path}]);if(url.includes("/authenticated/"))return Response.json({statusCode:"404",error:"not_found",message:"Object not found",code:"NoSuchKey"},{status:400});return new Response(null,{status:204});};
 await deleteOwnedChatAdminMedia({fetchImpl,config,workspaceIds:[w]});assert.ok(calls.some(call=>call.url.endsWith(`/${path}`)));assert.ok(calls.some(call=>call.body===JSON.stringify({prefixes:[path]})));assert.ok(calls.at(-1).url.includes("deleted=eq.true"));
});

import "./chat-admin-media-catalogue.cases.mjs";
import "./chat-admin-media-catalogue-api.cases.mjs";

// PostgREST commits a default-minimal INSERT but returns no JSON body.
test("first custom policy save returns success after a committed PostgREST insert",async()=>{
 const h=harness({minimalPolicyResponse:true});
 const result=await h.route.PATCH(h.request({action:"policy",revision:0,policy:{enabled:false,offer_id:"",delivery_hours:null,motifs:[],requires_confirmation:true}}));
 assert.equal(result.status,200);
 assert.equal(h.calls.writes.length,1);
 assert.equal(h.calls.writes[0].path,"chat_character_media_policies");
 assert.equal(h.calls.writes[0].headers.Prefer,"return=representation");
 assert.equal(h.calls.writes[0].body.workspace_id,w);
 assert.equal(h.calls.writes[0].body.character_id,c);
});

function portraitHarness(options={}){
 const calls={storage:[],characters:0,decode:0};
 const path=`chat-characters/${w}/${c}/portrait.jpg`;
 const deps={
  "next/server":{NextResponse},
  "next/headers":{cookies:async()=>({get:()=>options.noToken?undefined:{value:"synthetic-owner-jwt"}})},
  "@/lib/chatAdmin":{
   requireChatAdminCapability:async()=>{if(options.denied)throw new WorkspaceAuthorizationError("Denied","resource_forbidden");return {workspace:{id:w}};},
   getChatCharacter:async(workspace,id)=>{assert.equal(workspace,w);assert.equal(id,c);calls.characters++;return {id:c,workspace_id:w,revision:options.stale&&calls.characters>1?2:1,profile_image_path:options.path===undefined?path:options.path};},
  },
  "@/lib/supabase/config":{SUPABASE_ACCESS_TOKEN_COOKIE:"synthetic",getSupabaseHeaders:token=>({Authorization:`Bearer ${token}`}),requireSupabasePublicConfig:()=>({url:"https://storage.invalid"})},
  "@/lib/chatAdminMediaImage":{normalizeMediaImage:async bytes=>{calls.decode++;if(options.invalidImage)throw Error("bad image");return bytes;}},
  "@/lib/chatAdminMediaPolicy.mjs":mediaPolicy,
  "@/lib/workspaceAuthorization":{WorkspaceAuthorizationError},
 };
 const route={};runInNewContext(compile("src/app/api/chatadmin/characters/portrait/route.ts"),{exports:route,Response,Buffer,Uint8Array,AbortSignal,require:name=>{assert.ok(Object.hasOwn(deps,name),name);return deps[name];},fetch:async(url,init)=>{calls.storage.push({url,init});return new Response(options.oversized?new Uint8Array(mediaPolicy.MEDIA_MAX_BYTES+1):"synthetic decoded portrait",{status:options.missing?404:200});}});
 return {calls,get:()=>route.GET({nextUrl:new URL(`https://fanmind.invalid/api/chatadmin/characters/portrait?character_id=${c}&revision=1`)})};
}
test("Model portraits use the assigned private path, owner JWT, no-store and a final revision check",async()=>{
 const h=portraitHarness(),response=await h.get();assert.equal(response.status,200);assert.equal(response.headers.get("content-type"),"image/webp");assert.equal(response.headers.get("cache-control"),"private, no-store");
 assert.equal(h.calls.storage[0].url,`https://storage.invalid/storage/v1/object/authenticated/chat-characters/${w}/${c}/portrait.jpg`);
 assert.equal(h.calls.storage[0].init.headers.Authorization,"Bearer synthetic-owner-jwt");assert.equal(h.calls.storage[0].init.redirect,"error");assert.equal(h.calls.characters,2);assert.equal(h.calls.decode,1);
});
test("Model portrait fallback never reads another workspace, Model, public URL or unassigned media",async()=>{
 for(const path of [null,`chat-characters/${id}/${c}/portrait.jpg`,`chat-characters/${w}/${id}/portrait.jpg`,"https://external.invalid/photo.jpg",`chat-characters/${w}/${c}/../secret.jpg`,`chat-characters/${w}/${c}/.`,`chat-characters/${w}/${c}/..`]){const h=portraitHarness({path});assert.equal((await h.get()).status,404);assert.equal(h.calls.storage.length,0);}
 for(const options of [{denied:true},{noToken:true}]){const h=portraitHarness(options);assert.ok([401,403].includes((await h.get()).status));assert.equal(h.calls.storage.length,0);}
});
test("Model portrait read fails closed for changed revision, missing object, invalid and oversized images",async()=>{
 for(const options of [{stale:true},{missing:true},{invalidImage:true},{oversized:true}]){const h=portraitHarness(options);assert.equal((await h.get()).status,404);}
});

test("authority revoked during Storage deletion keeps the metadata tombstone",async()=>{const h=harness({revokeAfterStorage:true});assert.equal((await h.route.DELETE(h.request({},"DELETE"))).status,403);assert.ok(h.asset.deleted);assert.equal(h.calls.writes.filter(call=>call.path).length,0);});
test("metadata cleanup must acknowledge the exact row instead of silently accepting an RLS no-op",async()=>{const h=harness({emptyMetadataDelete:true});assert.equal((await h.route.DELETE(h.request({},"DELETE"))).status,400);assert.ok(h.asset.deleted);assert.equal(h.calls.writes.at(-1).headers.Prefer,"return=representation");});
