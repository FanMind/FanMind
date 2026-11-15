import {proveMonthlySqlNative} from './monthly-release-sql-native.cases.mjs';
import {storageGuardTransaction,storageGuardStateSql} from '../scripts/operations/chat-admin-media-storage-control.mjs';
import assert from 'node:assert/strict';
import {storageFinalizationCatalogue} from '../scripts/operations/chat-admin-media-storage-finalization.mjs';
import {loadMediaSchemaProfile} from '../scripts/operations/chat-admin-media-schema-profile.mjs';
const w='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',c='cccccccc-cccc-4ccc-8ccc-cccccccccccc',otherC='dddddddd-dddd-4ddd-8ddd-dddddddddddd',owner='11111111-1111-4111-8111-111111111111',foreign='22222222-2222-4222-8222-222222222222';
export async function runStorageFinalizationSqlCases(sql){
 await sql(`alter table storage.objects add column owner uuid,add column owner_id text;
 grant usage on schema storage to service_role;grant all on storage.objects to service_role;
 grant select on public.workspaces,public.workspace_chat_admin_capabilities,public.account_deletion_requests to service_role;`);
 const caller=(query,user=owner)=>sql(`set role authenticated;set request.jwt.claim.sub='${user}';${query}`);
 const internal=(query,role='service_role')=>sql(`set role ${role};set request.jwt.claim.sub='';set request.jwt.claims='{"role":"service_role"}';${query}`);
 const id='70000000-0000-4000-8000-000000000001',video='70000000-0000-4000-8000-000000000002';
 await caller(`insert into public.chat_character_media(id,workspace_id,character_id,media_type,byte_size,duration_ms) values('${id}','${w}','${c}','image',100,null),('${video}','${w}','${c}','video',200,1000);`);
 const insert=(asset=id,actor=owner,path=`${w}/${c}/${asset}.${asset===video?'mp4':'webp'}`)=>`insert into storage.objects(bucket_id,name,owner,owner_id) values('chat-character-media','${path}',${actor===null?'null':`'${actor}'`},${actor===null?'null':`'${actor}'`});`;
 // Same object/path/Owner. Only the Storage finalization role/claims differ.
 await caller(`begin;${insert()}rollback;`);
 assert.equal((await internal(`select public.chat_admin_media_writes_allowed('${w}');`)).trim().split('\n').at(-1),'f');
 await assert.rejects(()=>internal(insert()),/media_object_binding_invalid/,'old guard rejects internal finalization after successful caller probe');
 assert.equal((await sql(storageGuardStateSql())).trim(),'pending');
 await sql(storageGuardTransaction());
 await sql(storageGuardTransaction());
 assert.equal((await sql(storageGuardStateSql())).trim(),'ready');
 await proveMonthlySqlNative(sql,'media_storage');
 const bundle=loadMediaSchemaProfile('extended');
 assert.deepEqual(JSON.parse((await sql(`select catalogue from (${bundle.catalogue.trim().replace(/;$/u,'')}) native_guard_state;`)).trim()),storageFinalizationCatalogue(bundle.extended.catalogue),'only the exact guard body changes; ACL/RLS/bucket/schema stay identical');
 for(const asset of [id,video])await internal(`begin;${insert(asset)}rollback;`);
 await assert.rejects(()=>caller(insert(id,foreign)),/media_object_binding_invalid/);
 for(const actor of [null,foreign])await assert.rejects(()=>internal(insert(id,actor)),/media_object_binding_invalid/);
 await assert.rejects(()=>internal(insert(id,owner,`${w}/${otherC}/${id}.webp`)),/media_object_binding_invalid/);
 await assert.rejects(()=>internal(insert(video,owner,`${w}/${c}/${video}.webp`)),/media_object_binding_invalid/);
 // A forged object owner or service_role JWT text cannot elevate a DB caller.
 await assert.rejects(()=>internal(insert(), 'authenticated'),/media_object_binding_invalid/);
 await assert.rejects(()=>caller(insert(),foreign),/media_object_binding_invalid|row-level security/);
 await assert.rejects(()=>sql(`set role anon;${insert()}`));
 await assert.rejects(()=>sql(`set role service_role;set request.jwt.claim.sub='';set request.jwt.claims='{"role":"authenticated"}';${insert()}`),/media_object_binding_invalid/);
 for(const [change,restore] of [
  [`update public.chat_characters set status='inactive' where id='${c}';`,`update public.chat_characters set status='active' where id='${c}';`],
  [`update public.chat_character_media set deleted=true where id='${id}';`,`update public.chat_character_media set deleted=false where id='${id}';`],
  [`delete from public.workspace_chat_admin_capabilities where workspace_id='${w}';`,`insert into public.workspace_chat_admin_capabilities(workspace_id,chat_admin_multi_character,granted_to_user_id) values('${w}',true,'${owner}');`],
  [`insert into public.account_deletion_requests values('${owner}','processing');`,`delete from public.account_deletion_requests;`],
 ]){await sql(change);await assert.rejects(()=>internal(insert()),/media_object_binding_invalid/);await sql(restore);}
 await internal(insert());
 assert.equal((await caller('select count(*) from storage.objects;',foreign)).trim().split('\n').at(-1),'0');
 await caller(`update storage.objects set name='${w}/${otherC}/${id}.webp';`,foreign);
 assert.equal((await sql(`select count(*) from storage.objects where name='${w}/${c}/${id}.webp';`)).trim(),'1');
 await caller(`update public.chat_character_media set deleted=true,available=false,reviewed=false where id in ('${id}','${video}');delete from storage.objects where name='${w}/${c}/${id}.webp';delete from public.chat_character_media where id in ('${id}','${video}');`);
 assert.equal((await sql(`select count(*) from public.chat_character_media where id in ('${id}','${video}');`)).trim(),'0');
}
