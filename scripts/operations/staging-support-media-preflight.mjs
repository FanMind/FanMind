#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {readFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runSupportStaging} from './support-centre-staging.mjs';
import {privatePassfileSnapshot} from './website-chat-retention-staging-runner.mjs';
import {canonical} from './support-centre-schema.mjs';
import {loadMediaSchemaProfile,mediaSchemaProfileSql,CATALOGUE_MEDIA_SHA256} from './chat-admin-media-schema-profile.mjs';
export const RETENTION_PROOF_PATHS=['supabase/controlled','src/lib/environmentBoundaryPolicy.mjs','src/lib/websiteChatStagingControlPolicy.mjs','src/lib/websiteChatRetentionStagingPolicy.mjs','scripts/operations/support-centre-staging.mjs','scripts/operations/support-centre-schema.mjs','scripts/operations/website-chat-retention-staging-runner.mjs','scripts/operations/website-chat-retention-migration-check.mjs','docs/operations/support-centre-reference.json','.github/workflows/website-chat-retention-staging.yml','config/certificates/supabase-root-2021-ca.crt','package-lock.json'];
export function assertRetentionSourceEquivalent(source,commit,cwd=process.cwd()){
 if(!/^[a-f0-9]{40}$/.test(source??'')||! /^[a-f0-9]{40}$/.test(commit??''))throw Error('retention_source_invalid');
 const git=args=>{const r=spawnSync('git',args,{cwd,encoding:'utf8',timeout:10000,maxBuffer:65536});if(r.error||r.status!==0)throw Error('retention_source_not_equivalent');return r.stdout;};
 git(['merge-base','--is-ancestor',source,commit]);
 for(const path of [...RETENTION_PROOF_PATHS,'package.json']){git(['cat-file','-e',`${source}:${path}`]);git(['cat-file','-e',`${commit}:${path}`]);}
 const paths=[...RETENTION_PROOF_PATHS],media='supabase/controlled/chat_admin_media_catalogue.sql';
 // The independently reviewed media extension touches no Support/retention
 // object. Admit only its exact additive source, never a modified/deleted SQL
 // file or a general exclusion of the controlled migration directory.
 if(git(['diff','--no-renames','--name-status',source,commit,'--',media]).trim()===`A\t${media}`){
  if(createHash('sha256').update(git(['show',`${commit}:${media}`])).digest('hex')!==CATALOGUE_MEDIA_SHA256)throw Error('retention_source_not_equivalent');
  paths.push(`:(exclude)${media}`);
 }
 git(['diff','--quiet',source,commit,'--',...paths]);
 // The pinned Support workflow invokes node directly, never an npm script.
 const manifestAt=ref=>{try{const value=JSON.parse(git(['show',`${ref}:package.json`]));if(!value||Array.isArray(value)||typeof value!=='object')throw Error();delete value.scripts;return canonical(value);}catch{throw Error('retention_source_not_equivalent');}};
 if(manifestAt(source)!==manifestAt(commit))throw Error('retention_source_not_equivalent');
}

// Source-derived function bodies: never adopt a desired body from a live target.
export function mediaRuntimePreflightSql(source,commit,owner,retentionSource=commit,schema={profile:'initial'}){
 if(!['initial','extended'].includes(schema.profile))throw Error('media_schema_profile_invalid');
 if(!/^[a-f0-9]{40}$/.test(commit??'')||!/^[a-f0-9]{40}$/.test(retentionSource??'')||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(owner??''))throw Error('invalid_binding');
 const definitions=[...source.matchAll(/create function public\.(chat_admin_media_[a-z_]+)\([^]*?as \$\$([^]*?)\$\$;/g)];
 if(definitions.length!==3)throw Error('media_source_contract');
 if(schema.profile==='extended'){
  const additions=[...(schema.extensionSource??'').matchAll(/create (?:or replace )?function public\.(chat_admin_media_[a-z_]+)\([^]*?as \$\$([^]*?)\$\$;/g)];
  if(additions.length!==5)throw Error('media_source_contract');
  definitions.push(...additions);
 }
 const functions=[...new Map(definitions.map(item=>[item[1],item])).values()];
 const bodies=functions.map(([,name,body])=>`EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='${name}' AND md5(p.prosrc)='${createHash('md5').update(body).digest('hex')}' AND p.proconfig=ARRAY['search_path=""'])`).join(' AND ');
 return `BEGIN READ ONLY; SET LOCAL statement_timeout='10s';
 SELECT 1/(CASE WHEN
 (SELECT count(*) FROM public.support_centre_owners)=1 AND EXISTS(SELECT 1 FROM public.support_centre_owners WHERE user_id='${owner}')
 AND EXISTS(SELECT 1 FROM auth.users WHERE id='${owner}' AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<now()))
 AND EXISTS(SELECT 1 FROM public.support_retention_runs WHERE status='succeeded' AND source_commit='${retentionSource}' AND completed_at BETWEEN clock_timestamp()-interval '30 hours' AND clock_timestamp())
 AND (SELECT status='succeeded' FROM public.support_retention_runs ORDER BY started_at DESC LIMIT 1)
 AND (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('chat_character_media','chat_character_media_policies'${schema.profile==='extended'?",'chat_character_media_folders'":''}) AND c.relkind='r' AND c.relrowsecurity)=${schema.profile==='extended'?3:2}
 AND EXISTS(SELECT 1 FROM storage.buckets WHERE id='chat-character-media' AND NOT public AND file_size_limit=${schema.profile==='extended'?26214400:5242880} AND allowed_mime_types=ARRAY['image/webp'${schema.profile==='extended'?",'video/mp4'":''}])
 AND (SELECT count(*) FROM pg_policies WHERE schemaname IN('public','storage') AND policyname IN('chat_media_read','chat_media_insert','chat_media_update','chat_media_delete','chat_media_policy_owner','chat_media_object_select','chat_media_object_insert','chat_media_object_delete'${schema.profile==='extended'?",'chat_media_folder_read','chat_media_folder_insert','chat_media_folder_update','chat_media_folder_delete'":''}) AND roles=ARRAY['authenticated']::name[])=${schema.profile==='extended'?12:8}
 AND NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND cmd IN('ALL','INSERT','UPDATE','DELETE') AND 'public'=ANY(roles))
 AND ${bodies}
 THEN 1 ELSE 0 END);
 ROLLBACK;
 SELECT 'STAGING_SUPPORT_MEDIA_PREFLIGHT=PASS';`;
}
export function mediaCatalogueEqualitySql(reference,catalogue){
 if(reference.version!==1||!reference.catalogue||typeof reference.catalogue!=="object")throw Error('media_reference_invalid');
 const expected=JSON.stringify(reference.catalogue).replaceAll("'","''");
 return `BEGIN READ ONLY;SET LOCAL statement_timeout='10s';SELECT 1/(CASE WHEN (SELECT catalogue FROM (${catalogue.trim().replace(/;$/, '')}) media_state)='${expected}'::jsonb THEN 1 ELSE 0 END);ROLLBACK;`;
}
export function preflight(env=process.env){
 runSupportStaging('verify',env);
 const source=readFileSync('supabase/controlled/chat_admin_media.sql','utf8');
 const reference=JSON.parse(readFileSync('docs/operations/chat-admin-media-runtime-reference.json','utf8'));
 if(reference.version!==1||reference.source!=='supabase/controlled/chat_admin_media.sql'||reference.sourceSha256!==createHash('sha256').update(source).digest('hex'))throw Error('media_reference_source_mismatch');
 const catalogue=readFileSync('scripts/operations/chat-admin-media-runtime-catalogue.sql','utf8').trim().replace(/;$/, '');
 const schema=loadMediaSchemaProfile(env.FANMIND_CHAT_ADMIN_MEDIA_SCHEMA_PROFILE??'initial');
 const exact=mediaSchemaProfileSql(schema)+(schema.profile==='initial'?mediaCatalogueEqualitySql(reference,catalogue):'');
 const {directory,snapshotPath}=privatePassfileSnapshot(env);
 try{
  const safe=Object.fromEntries(['PATH','PGHOST','PGPORT','PGDATABASE','PGUSER','PGSSLMODE','PGSSLROOTCERT'].map(k=>[k,env[k]]));
  const proof=spawnSync('psql',['--no-password','--no-psqlrc','-qAt','-v','ON_ERROR_STOP=1'],{env:{...safe,PGPASSFILE:snapshotPath,PGCONNECT_TIMEOUT:'10',PGOPTIONS:'-c default_transaction_read_only=on'},input:"BEGIN READ ONLY;SET LOCAL statement_timeout='10s';SELECT source_commit FROM public.support_retention_runs WHERE status='succeeded' AND completed_at BETWEEN clock_timestamp()-interval '30 hours' AND clock_timestamp() ORDER BY started_at DESC LIMIT 1;ROLLBACK;",encoding:'utf8',timeout:30000,maxBuffer:65536});
  if(proof.error||proof.status!==0)throw Error('retention_proof_read_failed');
  const retentionSource=proof.stdout.trim();
  assertRetentionSourceEquivalent(retentionSource,env.GITHUB_SHA);
  const sql=exact+'\n'+mediaRuntimePreflightSql(source,env.GITHUB_SHA,env.SUPPORT_OWNER_UUID,retentionSource,schema);
  const r=spawnSync('psql',['--no-password','--no-psqlrc','-qAt','-v','ON_ERROR_STOP=1'],{env:{...safe,PGPASSFILE:snapshotPath,PGCONNECT_TIMEOUT:'10',PGOPTIONS:'-c default_transaction_read_only=on'},input:sql,encoding:'utf8',timeout:30000,maxBuffer:65536});
  if(r.error||r.status!==0||!r.stdout.split(/\r?\n/).includes('STAGING_SUPPORT_MEDIA_PREFLIGHT=PASS'))throw Error('preflight_failed');
  console.log(`STAGING_SUPPORT_RETENTION_PROOF_SOURCE=${retentionSource}`);
  console.log('STAGING_SUPPORT_RETENTION_SOURCE_EQUIVALENT=PASS');
  console.log(`STAGING_MEDIA_SCHEMA_PROFILE=${schema.profile}`);
  console.log('STAGING_SUPPORT_MEDIA_PREFLIGHT=PASS');
 }finally{rmSync(directory,{recursive:true,force:true});}
}
if(process.argv[1]?.endsWith('/staging-support-media-preflight.mjs')){try{preflight();}catch{console.error('STAGING_SUPPORT_MEDIA_PREFLIGHT=FAIL');process.exitCode=1;}}
