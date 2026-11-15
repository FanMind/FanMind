import {createHash} from 'node:crypto';
export const MEDIA_ACCEPTANCE_MODEL='FM1425-20261114-1945-A';
export const MEDIA_ACCEPTANCE_ORIGIN='https://staging.fanmind.ch';
export const MEDIA_ACCEPTANCE_REF='vshyhvgcmrlagvfnvomc';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
export const block=code=>{throw Error(`MEDIA_ACCEPTANCE_BLOCKED=${code}`);};
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
export const digest=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
export function mediaAcceptanceBinding(e){
 const mode=e.FANMIND_CHAT_ADMIN_MEDIA_MODE;
 if(!['media-probe','media-acceptance'].includes(mode)||e.GITHUB_REPOSITORY!=='FanMind/FanMind'||e.GITHUB_REF!=='refs/heads/main'||e.GITHUB_EVENT_NAME!=='workflow_dispatch'||!/^[a-f0-9]{40}$/u.test(e.GITHUB_SHA??'')||e.FANMIND_CHAT_ADMIN_REVIEWED_COMMIT!==e.GITHUB_SHA||e.FANMIND_RUNTIME_ENVIRONMENT!=='staging'||e.NEXT_PUBLIC_APP_URL!==MEDIA_ACCEPTANCE_ORIGIN||e.FANMIND_TARGET_API_ORIGIN!==MEDIA_ACCEPTANCE_ORIGIN||e.FANMIND_PRODUCTION_API_ORIGIN!=='https://fanmind.ch'||e.FANMIND_TARGET_SUPABASE_PROJECT_REF!==MEDIA_ACCEPTANCE_REF||e.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF!=='drqkpdvtbbrrdwmtrodz'||e.NEXT_PUBLIC_SUPABASE_URL!==`https://${MEDIA_ACCEPTANCE_REF}.supabase.co`||e.FANMIND_CHAT_ADMIN_MANUAL_CONFIRM!==`run-chat-admin-${mode}`||!/^\d+$/u.test(e.GITHUB_RUN_ID??'')||!/^\d+$/u.test(e.GITHUB_RUN_ATTEMPT??''))block('target');
 if(mode==='media-probe'&&(e.FANMIND_ENABLE_NON_PRODUCTION_WRITES!=='false'||e.FANMIND_NON_PRODUCTION_WRITE_ACK!==''))block('probe_write_gate');
 const keys=['MEDIA_CHARACTER_ID','STAGING_WORKSPACE_ID','SECOND_WORKSPACE_ID','OWNER_ID','FOREIGN_OWNER_ID'];
 const ids=Object.fromEntries(keys.map(k=>[k,e[`FANMIND_CHAT_ADMIN_${k}`]]));
 if(Object.values(ids).some(v=>!uuid.test(v??''))||new Set(Object.values(ids)).size!==keys.length)block('fixture_binding');
 return {version:1,sha:e.GITHUB_SHA,run:e.GITHUB_RUN_ID,attempt:e.GITHUB_RUN_ATTEMPT,mode,ids,marker:`FM1425-E2E-${e.GITHUB_RUN_ID}-${e.GITHUB_RUN_ATTEMPT}`};
}
export function assertMediaWriteApproval(e){
 if(e.FANMIND_CHAT_ADMIN_MEDIA_MODE!=='media-acceptance'||e.FANMIND_CHAT_ADMIN_MEDIA_WRITE_APPROVAL!=='approve-synthetic-media-lifecycle-and-cleanup'||e.FANMIND_ENABLE_NON_PRODUCTION_WRITES!=='true'||e.FANMIND_NON_PRODUCTION_WRITE_ACK!=='I_UNDERSTAND_NON_PRODUCTION_ONLY')block('write_approval');
}
export function assertMediaFixture(library,binding){
 const c=library?.character;
 if(!c||c.id!==binding.ids.MEDIA_CHARACTER_ID||c.workspace_id!==binding.ids.STAGING_WORKSPACE_ID||c.display_name!==MEDIA_ACCEPTANCE_MODEL||c.status!=='active'||!Number.isSafeInteger(c.revision)||!library.catalogue_enabled||!library.video_enabled||!library.pricing_v2_enabled||!Array.isArray(library.assets)||!Array.isArray(library.folders))block('model_or_flags');
 for(const row of [...library.assets,...library.folders])if(row.workspace_id!==c.workspace_id||row.character_id!==c.id||!uuid.test(row.id)||!Number.isSafeInteger(row.revision))block('resource_binding');
 const evening=library.folders.filter(f=>f.name==='Abendkleidung');
 if(evening.length!==1)block('preserved_category');
 const price=c.sales_playbook?.offers?.find(o=>o.id===evening[0].offer_id);
 if(price?.currency!=='EUR'||price.recommendedPriceMinor!==2500)block('preserved_price');
 return c;
}
export function ownsMediaResource(row,binding,kind){
 return row?.workspace_id===binding.ids.STAGING_WORKSPACE_ID&&row.character_id===binding.ids.MEDIA_CHARACTER_ID&&uuid.test(row.id??'')&&(kind==='asset'?[`${binding.marker}.png`,`${binding.marker}.mp4`].includes(row.original_filename):[`${binding.marker}-images`,`${binding.marker}-child`,`${binding.marker}-renamed`,`${binding.marker}-videos`].includes(row.name));
}
export function originalState(library,binding){
 const ownAssets=library.assets.filter(a=>ownsMediaResource(a,binding,'asset'));
 const ownFolders=library.folders.filter(f=>ownsMediaResource(f,binding,'folder'));
 const ownOffers=new Set([...ownAssets,...ownFolders].map(r=>`media_${r.id.replaceAll('-','')}`));
 const {revision,updated_at,...character}=library.character;
 void revision;void updated_at;
 return {character:{...character,sales_playbook:{...character.sales_playbook,offers:character.sales_playbook.offers.filter(o=>!ownOffers.has(o.id))}},assets:library.assets.filter(a=>!ownAssets.includes(a)),folders:library.folders.filter(f=>!ownFolders.includes(f)),policy:library.policy};
}
export function mediaRequestAllowed(raw,method,binding,body){
 let u;try{u=new URL(raw);}catch{return false;}
 if(u.username||u.password||u.hash)return false;
 if(u.origin===`https://${MEDIA_ACCEPTANCE_REF}.supabase.co`)return method==='POST'&&['/auth/v1/token','/auth/v1/logout'].includes(u.pathname)||method==='GET'&&u.pathname==='/auth/v1/user';
 if(u.origin!==MEDIA_ACCEPTANCE_ORIGIN)return false;
 if(['GET','HEAD'].includes(method))return true;
 if(method==='POST'&&u.pathname==='/api/auth/session')return true;
 if(binding.mode!=='media-acceptance'||!body||body.character_id!==binding.ids.MEDIA_CHARACTER_ID)return false;
 return u.pathname==='/api/chatadmin/media/catalogue'&&(method==='POST'||method==='PATCH'&&['save_folder','delete_folder','move_asset','save_asset_price'].includes(body.action))||u.pathname==='/api/chatadmin/media'&&method==='DELETE';
}
