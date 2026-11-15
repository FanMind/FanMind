#!/usr/bin/env node
import {readFileSync,writeFileSync,renameSync,existsSync,rmSync,openSync,closeSync,fstatSync,constants} from 'node:fs';
import {join,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {normalizeChatAdminSalesPlaybook} from '../../src/lib/chatAdminSalesPlaybook.mjs';
import {privatePassfileSnapshot} from './website-chat-retention-staging-runner.mjs';
import {storageGuardStateSql} from './chat-admin-media-storage-control.mjs';
import {MEDIA_ACCEPTANCE_MODEL,MEDIA_ACCEPTANCE_ORIGIN as APP,MEDIA_ACCEPTANCE_REF,mediaAcceptanceBinding,assertMediaWriteApproval,assertMediaFixture,ownsMediaResource,originalState,mediaRequestAllowed,block,digest} from './chat-admin-media-acceptance-policy.mjs';
const sources=['scripts/operations/chat-admin-media-acceptance.mjs','scripts/operations/chat-admin-media-acceptance-policy.mjs','.github/workflows/chat-admin-manual-flow-staging.yml'];
const sourceHash=()=>createHash('sha256').update(Buffer.concat(sources.map(f=>readFileSync(f)))).digest('hex');
const fixtureHashes={png:'9422141015adb7dd3fd44443c1bc03f25d7755f6b3f0049f4fa076f20c8da08f',mp4:'68cc1c8984f7388ecd79a54ff7c94869ae305ff9f41158b455a7f12b909287f2'};
function fixture(ext){const bytes=readFileSync(`tests/fixtures/chat-admin-media/neutral.${ext}`);if(createHash('sha256').update(bytes).digest('hex')!==fixtureHashes[ext])block('fixture_hash');return bytes;}
function receiptPath(e){if(!isAbsolute(e.RUNNER_TEMP??''))block('receipt_path');return join(e.RUNNER_TEMP,'fanmind-chatadmin-media-recovery.json');}
export function saveMediaRecovery(e,value){const p=receiptPath(e),tmp=`${p}.tmp`;writeFileSync(tmp,JSON.stringify(value),{mode:0o600,flag:'wx'});renameSync(tmp,p);}
export function loadMediaRecovery(e,b){
 const p=receiptPath(e);if(!existsSync(p))block('receipt_missing');
 let fd;let r;
 try{fd=openSync(p,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const stat=fstatSync(fd);if(!stat.isFile()||stat.nlink!==1||(stat.mode&0o777)!==0o600||stat.uid!==process.getuid()||stat.size>16384)block('receipt_file');r=JSON.parse(readFileSync(fd,'utf8'));}
 catch(error){if(error?.code==='ELOOP')block('receipt_file');throw error;}finally{if(fd!==undefined)closeSync(fd);}
 if(!r||digest(r.binding)!==digest(b)||r.source!==sourceHash()||!Array.isArray(r.offerIds)||r.offerIds.length>5||new Set(r.offerIds).size!==r.offerIds.length||r.offerIds.some(id=>!/^media_[a-f0-9]{32}$/u.test(id))||!Array.isArray(r.assetIds)||r.assetIds.length>2||r.assetIds.some(id=>!/^[a-f0-9-]{36}$/u.test(id))||!Array.isArray(r.folderIds)||r.folderIds.length!==3||new Set(r.folderIds).size!==3||r.folderIds.some(id=>!/^[a-f0-9-]{36}$/u.test(id))||!/^[a-f0-9]{64}$/u.test(r.baseline??'')||!/^\d+:[a-f0-9]{32}$/u.test(r.storage??''))block('receipt_binding');return r;
}

function database(e,b){
 if(e.FANMIND_PRODUCTION_DB_HOST!=='db.drqkpdvtbbrrdwmtrodz.supabase.co'||!e.PGHOST||e.PGHOST!==e.FANMIND_TARGET_DB_HOST||e.PGHOST===e.FANMIND_PRODUCTION_DB_HOST||e.PGUSER!==`postgres.${MEDIA_ACCEPTANCE_REF}`||e.PGSSLMODE!=='verify-full'||e.PGPORT!=='5432'||e.PGDATABASE!=='postgres'||!e.PGSSLROOTCERT||!e.PGPASSFILE)block('database_binding');
 const frozen=privatePassfileSnapshot(e);
 const query=sql=>{const p=spawnSync('psql',['--no-password','--no-psqlrc','-Atq','-v','ON_ERROR_STOP=1'],{env:{PATH:'/usr/bin:/bin',LANG:'C',PGHOST:e.PGHOST,PGPORT:'5432',PGDATABASE:'postgres',PGUSER:e.PGUSER,PGSSLMODE:'verify-full',PGSSLROOTCERT:e.PGSSLROOTCERT,PGPASSFILE:frozen.snapshotPath,PGCONNECT_TIMEOUT:'10',PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=10000'},input:`BEGIN READ ONLY;${sql};ROLLBACK;`,encoding:'utf8',timeout:15000,maxBuffer:65536});if(p.status!==0||p.error)block('database_read');return p.stdout.trim();};
 const c=b.ids.MEDIA_CHARACTER_ID,w=b.ids.STAGING_WORKSPACE_ID,o=b.ids.OWNER_ID;
 return {query,close:()=>rmSync(frozen.directory,{force:true,recursive:true}),
  preflight(){if(query(storageGuardStateSql())!=='ready')block('guard_not_ready');
   if(query(`SELECT count(*) FROM public.chat_characters c JOIN public.workspaces w ON w.id=c.workspace_id JOIN public.workspace_chat_admin_capabilities cap ON cap.workspace_id=w.id JOIN auth.users u ON u.id=w.owner_user_id WHERE c.id='${c}' AND c.workspace_id='${w}' AND c.display_name='${MEDIA_ACCEPTANCE_MODEL}' AND c.status='active' AND w.owner_user_id='${o}' AND w.test_access_flags->>'staging_synthetic_fixture'='true' AND u.raw_user_meta_data->>'fanmind_staging_fixture_version'='1' AND cap.granted_to_user_id=u.id AND cap.chat_admin_multi_character AND NOT EXISTS(SELECT 1 FROM public.account_deletion_requests d WHERE d.user_id=u.id AND d.status='processing')`)!=='1')block('synthetic_owner_model_mapping');
   if(query(`SELECT count(*) FROM public.workspaces w JOIN auth.users u ON u.id=w.owner_user_id WHERE w.id='${b.ids.SECOND_WORKSPACE_ID}' AND u.id='${b.ids.FOREIGN_OWNER_ID}' AND w.test_access_flags->>'staging_synthetic_fixture'='true' AND u.raw_user_meta_data->>'fanmind_staging_fixture_version'='1'`)!=='1')block('secondary_fixture_mapping');},
  storage(){return query(`SELECT count(*)::text||':'||md5(coalesce(string_agg(name||':'||coalesce(owner_id,''),',' ORDER BY name),'')) FROM storage.objects WHERE bucket_id='chat-character-media' AND name LIKE '${w}/${c}/%'`);},
  present(asset){const extension=asset.media_type==='video'?'mp4':'webp';if(!ownsMediaResource(asset,b,'asset'))block('storage_scope');if(query(`SELECT count(*) FROM storage.objects WHERE bucket_id='chat-character-media' AND name='${w}/${c}/${asset.id}.${extension}' AND owner_id='${o}'`)!=='1')block('storage_presence');}
 };
}
async function version(request,b){const response=await request.get(`${APP}/api/version`,{maxRedirects:0,timeout:15000});if(response.status()!==200)block('version');const v=await response.json();if(v.application!=='fanmind'||v.runtimeEnvironment!=='staging'||v.releaseCommit!==b.sha)block('release_mismatch');}
async function session(browser,e,b,secondary=false){
 const {expect}=await import('@playwright/test');
 const context=await browser.newContext({baseURL:APP,serviceWorkers:'block',acceptDownloads:false});const page=await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(30000);let violation=false,auth;
 await context.route('**/*',async route=>{const r=route.request();let body;try{body=r.postDataJSON();}catch{/* non-JSON */}if(!mediaRequestAllowed(r.url(),r.method(),b,body)){violation=true;await route.abort();return;}try{const response=await route.fetch({maxRedirects:0,maxRetries:0,timeout:45000});if(response.status()>=300&&response.status()<400){violation=true;await route.abort();return;}await route.fulfill({response});}catch{violation=true;await route.abort().catch(()=>{});}});
 const prefix=secondary?'FANMIND_STAGING_E2E_SECONDARY':'FANMIND_STAGING_E2E';
 try{for(const suffix of ['EMAIL','PASSWORD'])if(typeof e[`${prefix}_${suffix}`]!=='string'||!e[`${prefix}_${suffix}`]||/[\r\n]/u.test(e[`${prefix}_${suffix}`]))block('credentials_missing');
 await page.goto('/login');await page.getByRole('textbox',{name:'E-Mail',exact:true}).fill(e[`${prefix}_EMAIL`]);await page.locator('input[name="password"]').fill(e[`${prefix}_PASSWORD`]);
 const pending=page.waitForResponse(r=>new URL(r.url()).origin===`https://${MEDIA_ACCEPTANCE_REF}.supabase.co`&&new URL(r.url()).pathname==='/auth/v1/token',{timeout:30000});await page.getByRole('button',{name:/Einloggen/u}).click();const response=await pending;if(response.status()!==200)block('login');auth=await response.json();auth.apikey=response.request().headers().apikey;if(auth.user?.id!==b.ids[secondary?'FOREIGN_OWNER_ID':'OWNER_ID']||typeof auth.access_token!=='string')block('login_identity');await expect(page).toHaveURL(/\/dashboard(?:\?|$)/u,{timeout:30000});
 return {context,page,check(){if(violation)block('network_boundary');},async close(){try{if(auth?.access_token){const r=await context.request.post(`https://${MEDIA_ACCEPTANCE_REF}.supabase.co/auth/v1/logout?scope=local`,{headers:{apikey:auth.apikey,Authorization:`Bearer ${auth.access_token}`},maxRedirects:0,timeout:15000});if(!r.ok())block('session_cleanup');}}finally{await context.close();}}};
 }catch(error){try{if(auth?.access_token)await context.request.post(`https://${MEDIA_ACCEPTANCE_REF}.supabase.co/auth/v1/logout?scope=local`,{headers:{apikey:auth.apikey,Authorization:`Bearer ${auth.access_token}`},maxRedirects:0,timeout:15000});}finally{await context.close();}throw error;}
}
async function appRequest(actor,b,path,method='GET',body){if(!mediaRequestAllowed(`${APP}${path}`,method,b,body))block('request_boundary');const r=await actor.context.request.fetch(`${APP}${path}`,{method,data:body,headers:{Origin:APP},maxRedirects:0,timeout:45000});return r;}
async function library(actor,b){const r=await appRequest(actor,b,`/api/chatadmin/media?character_id=${b.ids.MEDIA_CHARACTER_ID}`);if(r.status()!==200)block('library_unavailable');const value=await r.json();assertMediaFixture(value,b);return value;}
function preserved(l,b,offerIds=[]){const value=originalState(l,b);value.character.sales_playbook.offers=value.character.sales_playbook.offers.filter(o=>!offerIds.includes(o.id));return digest(value);}
async function catalogue(actor,b,body){const l=await library(actor,b);const r=await appRequest(actor,b,'/api/chatadmin/media/catalogue','PATCH',{...body,character_id:b.ids.MEDIA_CHARACTER_ID,character_revision:l.character.revision});if(r.status()!==200)block('catalogue_mutation');return library(actor,b);}
async function denied(actor,b,asset){for(const path of [`/api/chatadmin/media?character_id=${b.ids.MEDIA_CHARACTER_ID}`,...(asset?[`/api/chatadmin/media?character_id=${b.ids.MEDIA_CHARACTER_ID}&id=${asset.id}`]:[])]){const r=await appRequest(actor,b,path);if(![401,403].includes(r.status()))block('foreign_read');}}
const price=name=>({name,currency:'EUR',start_minor:3500,minimum_minor:3500,maximum_minor:3500,requires_confirmation:true,negotiation_allowed:false,special_discounts_allowed:false});
async function cleanup(actor,b,e,db,receipt){
 const {expect}=await import('@playwright/test');
 await version(actor.context.request,b);db.preflight();let l=await library(actor,b);
 for(const a of l.assets.filter(a=>ownsMediaResource(a,b,'asset'))){if(!receipt.assetIds.includes(a.id))receipt.assetIds.push(a.id);const offer=`media_${a.id.replaceAll('-','')}`;if(!receipt.offerIds.includes(offer))receipt.offerIds.push(offer);}
 for(const id of receipt.folderIds){const offer=`media_${id.replaceAll('-','')}`;if(!receipt.offerIds.includes(offer))receipt.offerIds.push(offer);}saveMediaRecovery(e,receipt);
 if(preserved(l,b,receipt.offerIds)!==receipt.baseline)block('baseline_drift');
 // Remove only newly introduced offers through the normal revision-bound Model API.
 const ours=l.character.sales_playbook.offers.filter(o=>receipt.offerIds.includes(o.id));
 if(ours.some(o=>!o.name.startsWith(b.marker)))block('price_cleanup_binding');
 if(ours.length){assertMediaFixture(l,b);const body={...l.character,sales_playbook:{...l.character.sales_playbook,offers:l.character.sales_playbook.offers.filter(o=>!receipt.offerIds.includes(o.id))}};const r=await actor.context.request.patch(`${APP}/api/chatadmin/characters`,{headers:{Origin:APP},data:body,maxRedirects:0,timeout:30000});if(r.status()!==200)block('price_cleanup');l=await library(actor,b);}
 for(const a of l.assets.filter(a=>ownsMediaResource(a,b,'asset'))){l=await library(actor,b);const current=l.assets.find(x=>x.id===a.id);if(!current)continue;const r=await appRequest(actor,b,'/api/chatadmin/media','DELETE',{character_id:b.ids.MEDIA_CHARACTER_ID,character_revision:l.character.revision,id:a.id,revision:current.revision});if(r.status()!==200)block('media_cleanup');const gone=await appRequest(actor,b,`/api/chatadmin/media?character_id=${b.ids.MEDIA_CHARACTER_ID}&id=${a.id}`);if(![400,403].includes(gone.status()))block('deleted_preview');}
 // Children first; a nonempty or foreign folder never reaches a delete request.
 for(const id of [...receipt.folderIds].reverse()){l=await library(actor,b);const folder=l.folders.find(f=>f.id===id);if(!folder)continue;if(!ownsMediaResource(folder,b,'folder')||l.assets.some(a=>a.folder_id===id)||l.folders.some(f=>f.parent_id===id))block('folder_cleanup_scope');await catalogue(actor,b,{action:'delete_folder',id,revision:folder.revision});}
 l=await library(actor,b);if(preserved(l,b)!==receipt.baseline||db.storage()!==receipt.storage)block('cleanup_postflight');
 await expect.poll(async()=>preserved(await library(actor,b),b),{timeout:10000}).toBe(receipt.baseline);
 receipt.cleaned=true;saveMediaRecovery(e,receipt);
}
async function exercise(owner,foreign,b,e,db,receipt){
 const {expect}=await import('@playwright/test');const page=owner.page;
 let l=await library(owner,b);if(preserved(l,b)!==receipt.baseline||db.storage()!==receipt.storage)block('prewrite_drift');assertMediaWriteApproval(e);
 const [parent,videoFolder,child]=receipt.folderIds;
 for(const [id,name,kind,parent_id] of [[parent,`${b.marker}-images`,'image',null],[videoFolder,`${b.marker}-videos`,'video',null],[child,`${b.marker}-child`,'image',parent]])await catalogue(owner,b,{action:'save_folder',folder:{id,name,kind,parent_id,revision:0},price:null});
 await page.goto('/chatadmin');await page.getByRole('button',{name:`${MEDIA_ACCEPTANCE_MODEL} Aktiv`,exact:true}).click();await page.getByRole('button',{name:'Model-Einstellungen',exact:true}).click();await page.getByRole('button',{name:'Medien & Preise',exact:true}).click();
 await page.getByRole('button',{name:`${b.marker}-images öffnen`,exact:true}).click();await expect(page.getByRole('heading',{name:`Ordnerinhalt: ${b.marker}-images`,exact:true})).toBeVisible();await page.getByRole('navigation',{name:'Unterordner',exact:true}).getByRole('button',{name:`📁 ${b.marker}-child öffnen`,exact:true}).click();await expect(page.getByRole('heading',{name:`Ordnerinhalt: ${b.marker}-child`,exact:true})).toBeVisible();await page.getByRole('button',{name:'Eine Ebene zurück',exact:true}).click();
 l=await library(owner,b);let folder=l.folders.find(f=>f.id===child);await catalogue(owner,b,{action:'save_folder',folder:{...folder,name:`${b.marker}-renamed`,parent_id:null},price:null});l=await library(owner,b);folder=l.folders.find(f=>f.id===child);if(folder.name!==`${b.marker}-renamed`||folder.parent_id!==null)block('rename_move');await catalogue(owner,b,{action:'save_folder',folder:{...folder,parent_id:parent},price:null});
 for(const [ext,kind,folderId] of [['png','image',child],['mp4','video',videoFolder]]){
  const upload=page.getByRole('group',{name:'Medien hochladen',exact:true});await upload.getByRole('combobox',{name:'Medientyp',exact:true}).selectOption(kind);await upload.getByRole('combobox',{name:'Zielordner',exact:true}).selectOption(folderId);await upload.locator('input[type="file"]').setInputFiles({name:`${b.marker}.${ext}`,mimeType:kind==='image'?'image/png':'video/mp4',buffer:fixture(ext)});await upload.getByRole('checkbox').check();
  const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/chatadmin/media/catalogue'&&r.request().method()==='POST',{timeout:45000});await upload.getByRole('button',{name:'Hochladen',exact:true}).click();if((await response).status()!==200)block('upload');
  l=await library(owner,b);const assets=l.assets.filter(a=>a.original_filename===`${b.marker}.${ext}`);if(assets.length!==1||assets[0].media_type!==kind||assets[0].folder_id!==folderId||!assets[0].available||assets[0].deleted)block('upload_binding');const a=assets[0];receipt.assetIds.push(a.id);saveMediaRecovery(e,receipt);db.present(a);await denied(foreign,b,a);const anonymous=await owner.context.browser().newContext({baseURL:APP,serviceWorkers:'block'});try{const deniedPreview=await anonymous.request.get(`${APP}/api/chatadmin/media?character_id=${b.ids.MEDIA_CHARACTER_ID}&id=${a.id}`,{maxRedirects:0,timeout:15000});if(![401,403].includes(deniedPreview.status()))block('anonymous_preview');}finally{await anonymous.close();}
  const preview=await appRequest(owner,b,`/api/chatadmin/media?character_id=${b.ids.MEDIA_CHARACTER_ID}&id=${a.id}`);if(preview.status()!==200||preview.headers()['content-type']!==(kind==='image'?'image/webp':'video/mp4')||!preview.headers()['cache-control']?.includes('private')||(await preview.body()).length===0)block('private_preview');
 }
 // Show actual decoded media in Chromium, with all browser requests still restricted.
 await page.reload();await page.getByRole('button',{name:`${MEDIA_ACCEPTANCE_MODEL} Aktiv`,exact:true}).click();await page.getByRole('button',{name:'Model-Einstellungen',exact:true}).click();await page.getByRole('button',{name:'Medien & Preise',exact:true}).click();
 const imageCard=page.locator('article').filter({has:page.getByText(`${b.marker}.png`,{exact:true})});await expect(imageCard.locator('img')).toBeVisible();await expect.poll(()=>imageCard.locator('img').evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
 const videoCard=page.locator('article').filter({has:page.getByText(`${b.marker}.mp4`,{exact:true})});const video=videoCard.locator('video');await expect(video).toBeVisible();await video.evaluate(async el=>{el.muted=true;await el.play();});await expect.poll(()=>video.evaluate(el=>el.currentTime>0)).toBe(true);await video.evaluate(el=>el.pause());
 l=await library(owner,b);const a=l.assets.find(x=>x.original_filename===`${b.marker}.png`);const offer=`media_${a.id.replaceAll('-','')}`;receipt.offerIds.push(offer);saveMediaRecovery(e,receipt);await catalogue(owner,b,{action:'save_asset_price',id:a.id,revision:a.revision,price:price(`${b.marker}-file`)});
 l=await library(owner,b);const saved=l.assets.find(x=>x.id===a.id);if(saved.offer_id!==offer||l.character.sales_playbook.offers.find(o=>o.id===offer)?.recommendedPriceMinor!==3500)block('file_price_reload');
 // No other Model is mutated; the existing foreign Owner must be denied.
 const foreignMutation=await appRequest(foreign,b,'/api/chatadmin/media','DELETE',{character_id:b.ids.MEDIA_CHARACTER_ID,character_revision:l.character.revision,id:saved.id,revision:saved.revision});if(![401,403].includes(foreignMutation.status()))block('foreign_write');
 const folderPrice=price(`${b.marker}-category`);l=await library(owner,b);folder=l.folders.find(f=>f.id===child);await catalogue(owner,b,{action:'save_folder',folder,price:folderPrice});assertMediaFixture(await library(owner,b),b);
 owner.check();foreign.check();
}
export async function runMediaAcceptance(action,e=process.env){
 if(!['--prepare','--run','--cleanup'].includes(action))block('action');const b=mediaAcceptanceBinding(e);fixture('png');fixture('mp4');if(b.mode==='media-acceptance')assertMediaWriteApproval(e);const db=database(e,b);let browser,owner,foreign;let result;
 try{db.preflight();const {chromium}=await import('@playwright/test');browser=await chromium.launch({headless:true});owner=await session(browser,e,b);foreign=await session(browser,e,b,true);await version(owner.context.request,b);const l=await library(owner,b);await denied(foreign,b);owner.check();foreign.check();
 if(action==='--prepare'){
  if(l.assets.length>98||l.folders.length>97||l.character.sales_playbook.offers.length>18)block('fixture_capacity');
  if(digest(normalizeChatAdminSalesPlaybook(l.character.sales_playbook))!==digest(l.character.sales_playbook))block('playbook_normalization_required');
  if(l.assets.some(a=>a.original_filename?.startsWith('FM1425-E2E-'))||l.folders.some(f=>f.name.startsWith('FM1425-E2E-'))||l.character.sales_playbook.offers.some(o=>o.name.startsWith('FM1425-E2E-')))block('unfinished_previous_run');
  const receipt={binding:b,source:sourceHash(),baseline:preserved(l,b),storage:db.storage(),folderIds:[randomUUID(),randomUUID(),randomUUID()],assetIds:[],offerIds:[],cleaned:false};saveMediaRecovery(e,receipt);result='PREFLIGHT';
 }else{
 assertMediaWriteApproval(e);const receipt=loadMediaRecovery(e,b);
 if(action==='--cleanup'){await cleanup(owner,b,e,db,receipt);result='CLEANUP';}else{
 if(!e.FANMIND_CHAT_ADMIN_MEDIA_RECOVERY_ARTIFACT_ID?.match(/^\d+$/u)||!e.FANMIND_CHAT_ADMIN_MEDIA_RECOVERY_ARTIFACT_DIGEST?.match(/^(?:sha256:)?[a-f0-9]{64}$/u))block('durable_receipt_required');
 let completed=false;try{await exercise(owner,foreign,b,e,db,receipt);completed=true;}finally{await cleanup(owner,b,e,db,receipt);}if(!completed)block('incomplete');result='E2E';
 }}
 }finally{let failed=false;for(const s of [foreign,owner])if(s)try{await s.close();}catch{failed=true;}try{await browser?.close();}finally{db.close();}if(failed)block('session_cleanup');}
 console.log(`CHATADMIN_MEDIA_${result}=PASS`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{await runMediaAcceptance(process.argv[2]);}catch(error){const code=/^MEDIA_ACCEPTANCE_BLOCKED=([a-z_]+)$/u.exec(error?.message??'')?.[1]??'runner_failure';console.error(`CHATADMIN_MEDIA_E2E=BLOCKED:${code}`);process.exitCode=1;}}
