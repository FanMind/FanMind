import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as policy from '../src/lib/chatAdminMediaPolicy.mjs';
import * as catalogue from '../src/lib/chatAdminMediaCatalogue.mjs';
import {defaultChatAdminSalesPlaybook} from '../src/lib/chatAdminSalesPlaybook.mjs';
import * as mutation from '../src/lib/httpMutationPolicy.mjs';
import {WorkspaceAuthorizationError} from '../src/lib/workspaceAuthorizationPolicy.mjs';
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,w=id(1),c=id(2),folder=id(3),asset=id(4);
function harness(options={}){
 const calls={writes:[],objects:[],normalized:0,auth:0};
 const character={id:c,workspace_id:w,revision:1,status:'active',sales_playbook:defaultChatAdminSalesPlaybook()};
 const folders=[{id:folder,workspace_id:w,character_id:c,parent_id:null,kind:'image',name:'Wald',offer_id:'',price_rules:{negotiation_allowed:false,special_discounts_allowed:false},revision:1}];
 const assets=[{id:asset,workspace_id:w,character_id:c,revision:1,media_type:'image',folder_id:null,deleted:false,offer_id:''}];
 const deps={
 'next/server':{NextResponse:class extends Response{static json(body,init){return Response.json(body,init);}}},
 '@/lib/chatAdmin':{requireChatAdminCapability:async()=>{calls.auth++;if(options.denied||options.revoke&&calls.auth>1)throw new WorkspaceAuthorizationError('denied','resource_forbidden');return {workspace:{id:w},user:{id:id(5)}};}},
 '@/lib/chatAdminMedia':{requireMediaCatalogue(){if(options.disabled)throw new policy.ChatAdminMediaError('media_catalogue_not_enabled');},mediaVideoEnabled:()=>options.video===true,assertMediaCharacter:async(ws,ch,rev)=>{if(ws!==w||ch!==c)throw new WorkspaceAuthorizationError('denied','resource_forbidden');if(rev!==undefined&&rev!==1)throw new policy.ChatAdminMediaError('stale_media_context');return character;},loadCharacterMedia:async()=>({assets,folders}),getMediaAsset:async(ws,ch,aid)=>{if(aid!==asset)throw new WorkspaceAuthorizationError('denied','resource_forbidden');return assets[0];},mediaRest:async(path,init)=>{calls.writes.push({path,body:JSON.parse(init.body)});return path.startsWith('rpc/')?true:[{...assets[0],id:JSON.parse(init.body).id}];},mediaObject:async(...args)=>{calls.objects.push(args);},updateMediaAsset:async()=>{}},
 '@/lib/chatAdminMediaPolicy.mjs':policy,'@/lib/chatAdminMediaCatalogue.mjs':catalogue,
 '@/lib/chatAdminMediaImage':{normalizeMediaImage:async bytes=>{calls.normalized++;return bytes;}},'@/lib/chatAdminMediaVideo':{normalizeMediaVideo:async bytes=>{calls.normalized++;return {bytes,duration_ms:1000};}},
 '@/lib/httpMutationPolicy.mjs':mutation,'@/lib/workspaceAuthorization':{WorkspaceAuthorizationError},'@/lib/sharedRateLimit':{consumeSharedRateLimit:async()=>({allowed:!options.rateDenied})}};
 const exports={};runInNewContext(ts.transpileModule(readFileSync('src/app/api/chatadmin/media/catalogue/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Buffer,crypto,require:name=>{assert.ok(deps[name],name);return deps[name];}});
 const request=(body,origin='https://fanmind.invalid')=>new Request('https://fanmind.invalid/api/chatadmin/media/catalogue',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({character_id:c,character_revision:1,...body})});
 return {route:exports,request,calls};
}
test('catalogue API binds authority, origin, current revision and runtime before writes',async()=>{
 for(const [options,body,origin,status] of [[{}, {},'https://foreign.invalid',403],[{denied:true},{},undefined,403],[{disabled:true},{},undefined,503],[{}, {character_revision:0},undefined,409],[{}, {character_id:id(9)},undefined,403],[{rateDenied:true},{},undefined,429]]){const h=harness(options);assert.equal((await h.route.PATCH(h.request(body,origin))).status,status);assert.equal(h.calls.writes.length,0);}
});
test('category price is atomically saved in existing Character playbook with scoped reference',async()=>{
 const h=harness();const response=await h.route.PATCH(h.request({action:'save_folder',folder:{id:folder,revision:1,name:'Wald',kind:'image',parent_id:null},price:{name:'Wald',start_minor:2350,minimum_minor:1700,currency:'EUR',requires_confirmation:false,negotiation_allowed:true,special_discounts_allowed:false}}));assert.equal(response.status,200);
 const write=h.calls.writes[0];assert.equal(write.path,'rpc/chat_admin_media_catalogue_write');assert.equal(write.body.p_workspace,w);assert.equal(write.body.p_character,c);assert.equal(write.body.p_playbook.offers[0].recommendedPriceMinor,2350);assert.equal(write.body.p_payload.offer_id,write.body.p_playbook.offers[0].id);
});
test('foreign folders, wrong media type, nonempty delete and stale assets never mutate',async()=>{
 for(const [body,status] of [[{action:'move_asset',id:asset,revision:1,folder_id:id(9)},400],[{action:'move_asset',id:asset,revision:0,folder_id:folder},409],[{action:'delete_folder',id:folder,revision:0},409],[{action:'save_folder',folder:{id:id(8),revision:0,name:'Video',kind:'video',parent_id:folder},price:null},400]]){const h=harness();assert.equal((await h.route.PATCH(h.request(body))).status,status);assert.equal(h.calls.writes.length,0);}
});
test('uploads require rights, video gate and matching folder, then recheck revoked authority after processing',async()=>{
 const upload={media_type:'image',folder_id:null,data:Buffer.from('synthetic').toString('base64'),rights_confirmed:true,original_name:'synthetic-blue.png'};
 for(const [options,body,status] of [[{}, {rights_confirmed:false},400],[{}, {media_type:'video'},503],[{video:true},{media_type:'video',folder_id:folder},400],[{revoke:true},{},403]]){const h=harness(options);assert.equal((await h.route.POST(h.request({...upload,...body}))).status,status);assert.equal(h.calls.writes.length,0);assert.equal(h.calls.objects.length,0);}
 const h=harness();assert.equal((await h.route.POST(h.request(upload))).status,200);assert.equal(h.calls.writes[0].body.workspace_id,w);assert.equal(h.calls.objects[0][5],'image');assert.equal(h.calls.objects[1][3],'PROBE');assert.equal(h.calls.writes[0].body.original_filename,'synthetic-blue.png');
});
