import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mediaAcceptanceBinding,assertMediaWriteApproval,assertMediaFixture,MEDIA_ACCEPTANCE_MODEL,mediaRequestAllowed,ownsMediaResource,originalState,digest} from '../scripts/operations/chat-admin-media-acceptance-policy.mjs';
import {saveMediaRecovery,loadMediaRecovery} from '../scripts/operations/chat-admin-media-acceptance.mjs';
const ids=Array.from({length:6},(_,i)=>`${i+1}0000000-1111-4111-8111-111111111111`);
const env={GITHUB_REPOSITORY:'FanMind/FanMind',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_SHA:'a'.repeat(40),GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1',FANMIND_CHAT_ADMIN_REVIEWED_COMMIT:'a'.repeat(40),FANMIND_RUNTIME_ENVIRONMENT:'staging',NEXT_PUBLIC_APP_URL:'https://staging.fanmind.ch',FANMIND_TARGET_API_ORIGIN:'https://staging.fanmind.ch',FANMIND_PRODUCTION_API_ORIGIN:'https://fanmind.ch',FANMIND_TARGET_SUPABASE_PROJECT_REF:'vshyhvgcmrlagvfnvomc',FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:'drqkpdvtbbrrdwmtrodz',NEXT_PUBLIC_SUPABASE_URL:'https://vshyhvgcmrlagvfnvomc.supabase.co',FANMIND_ENABLE_NON_PRODUCTION_WRITES:'false',FANMIND_NON_PRODUCTION_WRITE_ACK:'',FANMIND_CHAT_ADMIN_MEDIA_MODE:'media-probe',FANMIND_CHAT_ADMIN_MANUAL_CONFIRM:'run-chat-admin-media-probe',FANMIND_CHAT_ADMIN_MEDIA_CHARACTER_ID:ids[0],FANMIND_CHAT_ADMIN_STAGING_WORKSPACE_ID:ids[1],FANMIND_CHAT_ADMIN_SECOND_WORKSPACE_ID:ids[2],FANMIND_CHAT_ADMIN_OWNER_ID:ids[3],FANMIND_CHAT_ADMIN_FOREIGN_OWNER_ID:ids[4]};
const b=mediaAcceptanceBinding(env),app='https://staging.fanmind.ch';
const original={character:{id:ids[0],workspace_id:ids[1],display_name:MEDIA_ACCEPTANCE_MODEL,status:'active',revision:1,sales_playbook:{offers:[{id:'evening',name:'Abendkleidung',currency:'EUR',recommendedPriceMinor:2500}]}},assets:[],folders:[{id:ids[5],workspace_id:ids[1],character_id:ids[0],name:'Abendkleidung',offer_id:'evening',revision:1}],policy:{enabled:false},catalogue_enabled:true,video_enabled:true,pricing_v2_enabled:true};
test('media dispatch rejects Production, stale sources, missing dedicated Model binding and duplicate identities',()=>{
 assert.equal(b.marker,'FM1425-E2E-123-1');
 for(const patch of [{GITHUB_REPOSITORY:'other/repo'},{GITHUB_REF:'refs/heads/feature'},{GITHUB_EVENT_NAME:'push'},{GITHUB_SHA:'b'.repeat(40)},{NEXT_PUBLIC_APP_URL:'https://fanmind.ch'},{FANMIND_TARGET_API_ORIGIN:'https://fanmind.ch'},{FANMIND_TARGET_SUPABASE_PROJECT_REF:'drqkpdvtbbrrdwmtrodz'},{FANMIND_RUNTIME_ENVIRONMENT:'production'},{FANMIND_CHAT_ADMIN_MEDIA_CHARACTER_ID:''},{FANMIND_CHAT_ADMIN_OWNER_ID:ids[4]},{FANMIND_CHAT_ADMIN_MANUAL_CONFIRM:'run-chat-admin-manual-flow'},{GITHUB_RUN_ID:'../../private'}])assert.throws(()=>mediaAcceptanceBinding({...env,...patch}),/BLOCKED/);
});
test('probe never authorizes media writes; acceptance requires every independent acknowledgement',()=>{
 assert.throws(()=>assertMediaWriteApproval(env));
 const approved={...env,FANMIND_CHAT_ADMIN_MEDIA_MODE:'media-acceptance',FANMIND_CHAT_ADMIN_MEDIA_WRITE_APPROVAL:'approve-synthetic-media-lifecycle-and-cleanup',FANMIND_ENABLE_NON_PRODUCTION_WRITES:'true',FANMIND_NON_PRODUCTION_WRITE_ACK:'I_UNDERSTAND_NON_PRODUCTION_ONLY'};
 assert.doesNotThrow(()=>assertMediaWriteApproval(approved));
 for(const k of ['FANMIND_CHAT_ADMIN_MEDIA_MODE','FANMIND_CHAT_ADMIN_MEDIA_WRITE_APPROVAL','FANMIND_ENABLE_NON_PRODUCTION_WRITES','FANMIND_NON_PRODUCTION_WRITE_ACK'])assert.throws(()=>assertMediaWriteApproval({...approved,[k]:''}));
});
test('only the exact existing synthetic Model with live catalogue and preserved category25EUR is admissible',()=>{
 assert.doesNotThrow(()=>assertMediaFixture(original,b));
 for(const patch of [{display_name:'Aurela Foss'},{id:ids[5]},{workspace_id:ids[2]},{status:'inactive'}])assert.throws(()=>assertMediaFixture({...original,character:{...original.character,...patch}},b));
 assert.throws(()=>assertMediaFixture({...original,video_enabled:false},b));
 assert.throws(()=>assertMediaFixture({...original,character:{...original.character,sales_playbook:{offers:[{...original.character.sales_playbook.offers[0],recommendedPriceMinor:2499}]}}},b));
 assert.throws(()=>assertMediaFixture({...original,assets:[{id:ids[5],workspace_id:ids[2],character_id:ids[0],revision:1}]},b));
});
test('network boundary denies direct Storage, SQL, providers, redirects, analysis, foreign Models and probe mutations',()=>{
 for(const url of ['https://fanmind.ch/api/chatadmin/media','https://api.openai.com/v1/responses','https://vshyhvgcmrlagvfnvomc.supabase.co/storage/v1/object/x','https://vshyhvgcmrlagvfnvomc.supabase.co/rest/v1/chat_characters'])assert.equal(mediaRequestAllowed(url,'POST',b,{}),false);
 const write={...b,mode:'media-acceptance'},body={character_id:ids[0],action:'save_folder'};
 assert.equal(mediaRequestAllowed(`${app}/api/chatadmin/media/catalogue`,'PATCH',b,body),false);
 assert.equal(mediaRequestAllowed(`${app}/api/chatadmin/media/catalogue`,'PATCH',write,body),true);
 for(const [path,method,data] of [['/api/chatadmin/media/analyze','POST',body],['/api/chatadmin/characters','DELETE',body],['/api/chatadmin/media/catalogue','PATCH',{...body,character_id:ids[5]}],['/api/chatadmin/reply-suggestions','POST',body]])assert.equal(mediaRequestAllowed(app+path,method,write,data),false);
});
test('cleanup ownership requires run marker AND exact Model and Workspace; real and earlier fixtures never qualify',()=>{
 const asset={id:ids[5],workspace_id:ids[1],character_id:ids[0],original_filename:`${b.marker}.png`};assert.equal(ownsMediaResource(asset,b,'asset'),true);
 for(const patch of [{workspace_id:ids[2]},{character_id:ids[4]},{original_filename:'Abendkleidung.png'},{original_filename:'FM1425-E2E-122-1.png'}])assert.equal(ownsMediaResource({...asset,...patch},b,'asset'),false);
 assert.equal(ownsMediaResource({...asset,name:'Abendkleidung'},b,'folder'),false);
});
test('preservation baseline detects changed existing prices and unrelated rows while ignoring only this run resources',()=>{
 const asset={id:ids[4],workspace_id:ids[1],character_id:ids[0],original_filename:`${b.marker}.png`};
 assert.equal(digest(originalState({...original,assets:[asset]},b)),digest(originalState(original,b)));
 const changed=structuredClone(original);changed.character.sales_playbook.offers[0].recommendedPriceMinor=3500;assert.notEqual(digest(originalState(changed,b)),digest(originalState(original,b)));
 const foreign={...asset,original_filename:'other.png'};assert.notEqual(digest(originalState({...original,assets:[foreign]},b)),digest(originalState(original,b)));
});
test('recovery reader rejects stale runs, changed source, symlinks and insecure files before cleanup',()=>{
 const dir=mkdtempSync(join(tmpdir(),'fm-media-receipt-test-'));try{
  const e={...env,RUNNER_TEMP:dir},file=join(dir,'fanmind-chatadmin-media-recovery.json');
  const source=['scripts/operations/chat-admin-media-acceptance.mjs','scripts/operations/chat-admin-media-acceptance-policy.mjs','.github/workflows/chat-admin-manual-flow-staging.yml'];
  // A foreign-source receipt must fail even with a matching target and run.
  const receipt={binding:b,source:'0'.repeat(64),baseline:'a'.repeat(64),storage:`0:${'a'.repeat(32)}`,folderIds:ids.slice(0,3),assetIds:[],offerIds:[]};
  saveMediaRecovery(e,receipt);assert.throws(()=>loadMediaRecovery(e,b),/receipt_binding/);rmSync(file);
  receipt.source=createHash('sha256').update(Buffer.concat(source.map(f=>readFileSync(f)))).digest('hex');
  saveMediaRecovery(e,receipt);assert.deepEqual(loadMediaRecovery(e,b),receipt);assert.throws(()=>loadMediaRecovery(e,{...b,run:'124'}),/receipt_binding/);rmSync(file);
  symlinkSync(join(process.cwd(),source[0]),file);assert.throws(()=>loadMediaRecovery(e,b),/receipt_file/);rmSync(file);
  writeFileSync(file,'{}',{mode:0o644});assert.throws(()=>loadMediaRecovery(e,b),/receipt_file/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('workflow keeps the old runner isolated, serializes media with deployment and persists recovery before mutation',()=>{
 const workflow=readFileSync('.github/workflows/chat-admin-manual-flow-staging.yml','utf8');const media=workflow.slice(workflow.indexOf('\n  media:\n'));
 assert.match(media,/group: fanmind-staging-deploy/);assert.match(media,/environment: staging/);assert.match(media,/runs-on: ubuntu-24.04/);assert.ok(media.indexOf(' --prepare')<media.indexOf('id: media_recovery'));assert.ok(media.indexOf('id: media_recovery')<media.indexOf(' --run'));assert.match(media,/always\(\).*media-acceptance.*media_recovery.outcome == 'success'/);assert.doesNotMatch(media,/--apply|SERVICE_ROLE|db push|ssh /);
});
