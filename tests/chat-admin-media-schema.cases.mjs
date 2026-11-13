import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {loadMediaSchemaProfile,mediaSchemaStateSql,mediaSchemaProfileSql,CATALOGUE_MEDIA_SHA256} from '../scripts/operations/chat-admin-media-schema-profile.mjs';
import {mediaRuntimePreflightSql} from '../scripts/operations/staging-support-media-preflight.mjs';

test('media schema profiles are explicit, pinned and retain the original reference',()=>{
 const initial=loadMediaSchemaProfile(),extended=loadMediaSchemaProfile('extended');
 assert.deepEqual(initial.reference,JSON.parse(readFileSync('docs/operations/chat-admin-media-runtime-reference.json')));
 assert.equal(extended.extended.sourceSha256,CATALOGUE_MEDIA_SHA256);
 assert.deepEqual(extended.reference.catalogue.tables.map(t=>t.name),['chat_character_media','chat_character_media_folders','chat_character_media_policies']);
 assert.equal(extended.reference.catalogue.functions.length,7);
 assert.throws(()=>loadMediaSchemaProfile('auto'),/profile_invalid/);
 assert.throws(()=>mediaSchemaProfileSql({...extended,profile:"extended' OR true"}),/profile_invalid/);
 assert.match(mediaSchemaStateSql(extended),/ELSE 'block'/);
 const sql=mediaSchemaProfileSql(extended);
 assert.match(sql,/BEGIN READ ONLY/);assert.match(sql,/ROLLBACK/);
 const guards=mediaRuntimePreflightSql(extended.initialSource,'a'.repeat(40),'11111111-1111-4111-8111-111111111111','a'.repeat(40),extended);
 assert.match(guards,/file_size_limit=26214400/);assert.match(guards,/chat_media_folder_update/);
 assert.equal((guards.match(/md5\(p.prosrc\)/g)||[]).length,7);
});

// Executed on the source-recreated isolated PG17 DB, never on a target project.
export async function runMediaSchemaNativeCases(sql,profile){
 const bundle=loadMediaSchemaProfile(profile);
 assert.equal((await sql(mediaSchemaStateSql(bundle))).trim(),profile);
 await sql(mediaSchemaProfileSql(bundle));
 const wrong=profile==='initial'?'extended':'initial';
 await assert.rejects(()=>sql(mediaSchemaProfileSql({...bundle,profile:wrong})),/division by zero/);
 const drifts=[
  "create table public.chat_character_media_unreviewed(id integer);",
  'alter table public.chat_character_media disable row level security;',
  'alter table public.chat_character_media disable trigger all;',
  'alter table public.chat_character_media force row level security;',
  'grant select on public.chat_character_media to anon;',
  'alter policy chat_media_read on public.chat_character_media using(true);',
  'create policy media_extra on public.chat_character_media for select to authenticated using(true);',
  'create policy media_storage_extra on storage.objects for select to anon using(true);',
  'alter table public.chat_character_media disable trigger chat_media_revision;',
  "update storage.buckets set public=true where id='chat-character-media';",
  "update storage.buckets set file_size_limit=42 where id='chat-character-media';",
  "update storage.buckets set allowed_mime_types=array['image/webp','video/mp4','video/webm'] where id='chat-character-media';",
 ];
 if(profile==='extended')drifts.push(
  'alter table public.chat_character_media drop constraint chat_media_folder_scope;',
  'alter table public.chat_character_media_folders disable row level security;',
  'grant update on public.chat_character_media_folders to authenticated;',
  'revoke update(name) on public.chat_character_media_folders from authenticated;',
  'drop index public.chat_media_folder_sibling_name;',
  'alter policy chat_media_folder_update on public.chat_character_media_folders with check(true);',
  'alter function public.chat_admin_media_object_path(uuid,uuid,uuid,text) security definer;',
  'grant execute on function public.chat_admin_media_catalogue_write(uuid,uuid,integer,text,jsonb,jsonb) to service_role;',
  'alter table public.chat_character_media_folders disable trigger chat_media_catalogue_folder_guard;',
 );
 for(const drift of drifts){
  assert.equal((await sql(`begin;${drift}${mediaSchemaStateSql(bundle)};rollback;`)).trim().split('\n').at(-1),'block',drift);
  const exact=mediaSchemaProfileSql(bundle).replace('BEGIN READ ONLY;','').replace(/ROLLBACK;$/,'');
  await assert.rejects(()=>sql(`begin;${drift}${exact}rollback;`),/division by zero/,drift);
 }
}
