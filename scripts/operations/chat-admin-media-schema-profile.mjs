import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export const INITIAL_MEDIA_SHA256='3c4fa2214b5721dd8a7bc85d9ea3ef3b6b8c592c5305315eb623cf99cf1d59fe';
export const CATALOGUE_MEDIA_SHA256='10626902dcd7e4ad35508191afad89aad25292f28965fae75351ec758c4248d2';
const hash=value=>createHash('sha256').update(value).digest('hex');
const literal=value=>JSON.stringify(value).replaceAll("'","''");

// Expected state comes only from reviewed source recreation, never the live DB.
// Keep the original initial reference/query unchanged. This broader collector
// also sees folders, additional media relations and their policies/triggers.
export function loadMediaSchemaProfile(profile='initial',root=process.cwd()){
 if(!['initial','extended'].includes(profile))throw Error('media_schema_profile_invalid');
 const read=path=>readFileSync(resolve(root,path),'utf8');
 const initialSource=read('supabase/controlled/chat_admin_media.sql');
 const extensionSource=read('supabase/controlled/chat_admin_media_catalogue.sql');
 const initial=JSON.parse(read('docs/operations/chat-admin-media-runtime-reference.json'));
 const extended=JSON.parse(read('docs/operations/chat-admin-media-catalogue-reference.json'));
 const catalogue=read('scripts/operations/chat-admin-media-catalogue-state.sql');
 if(hash(initialSource)!==INITIAL_MEDIA_SHA256||hash(extensionSource)!==CATALOGUE_MEDIA_SHA256||
  initial.version!==1||initial.source!=='supabase/controlled/chat_admin_media.sql'||initial.sourceSha256!==INITIAL_MEDIA_SHA256||
  extended.version!==1||extended.source!=='supabase/controlled/chat_admin_media_catalogue.sql'||
  extended.sourceSha256!==CATALOGUE_MEDIA_SHA256||extended.initialSourceSha256!==INITIAL_MEDIA_SHA256||
  extended.collectorSha256!==hash(catalogue)||!initial.catalogue||!extended.catalogue)throw Error('media_schema_source_mismatch');
 return {profile,initialSource,extensionSource,initial,extended,catalogue,reference:profile==='initial'?initial:extended};
}

export function mediaSchemaStateSql({initial,extended,catalogue}){
 if(initial?.version!==1||extended?.version!==1||!initial.catalogue||!extended.catalogue||!catalogue?.trim().startsWith('SELECT jsonb_build_object('))throw Error('media_schema_reference_invalid');
 const query=catalogue.trim().replace(/;$/u,'');
 return `SELECT CASE WHEN integrity_ok IS NOT TRUE THEN 'block' WHEN catalogue='${literal(initial.catalogue)}'::jsonb THEN 'initial' WHEN catalogue='${literal(extended.catalogue)}'::jsonb THEN 'extended' ELSE 'block' END AS media_schema_state FROM (${query}) media_schema_catalogue`;
}

export function mediaSchemaProfileSql(bundle){
 if(!['initial','extended'].includes(bundle?.profile))throw Error('media_schema_profile_invalid');
 return `BEGIN READ ONLY; SET LOCAL statement_timeout='10s'; SELECT 1/(CASE WHEN (SELECT media_schema_state FROM (${mediaSchemaStateSql(bundle)}) state)='${bundle.profile}' THEN 1 ELSE 0 END); ROLLBACK;`;
}
