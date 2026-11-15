#!/usr/bin/env node
import {rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {loadMediaSchemaProfile} from './chat-admin-media-schema-profile.mjs';
import {storageFinalizationCatalogue,storageFinalizationSource} from './chat-admin-media-storage-finalization.mjs';
import {privatePassfileSnapshot} from './website-chat-retention-staging-runner.mjs';
const fail=()=>{throw Error('media_storage_control_blocked');};
const literal=value=>JSON.stringify(value).replaceAll("'","''");
export function storageGuardStateSql(){
 const bundle=loadMediaSchemaProfile('extended'),query=bundle.catalogue.trim().replace(/;$/u,'');
 return `SELECT CASE WHEN integrity_ok IS NOT TRUE THEN 'block' WHEN catalogue='${literal(bundle.extended.catalogue)}'::jsonb THEN 'pending' WHEN catalogue='${literal(storageFinalizationCatalogue(bundle.extended.catalogue))}'::jsonb THEN 'ready' ELSE 'block' END FROM (${query}) media_guard_state`;
}
export function storageGuardTransaction(){
 const state=storageGuardStateSql(),{statement}=storageFinalizationSource();
 return `BEGIN;SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='20s';
 SELECT pg_advisory_xact_lock(hashtextextended('fanmind-staging-chatadmin-media-catalogue-1425',0));
 LOCK TABLE public.chat_characters,public.chat_character_media,storage.objects IN SHARE ROW EXCLUSIVE MODE;
 DO $fm1425_guard$ DECLARE before_state text;BEGIN
 SELECT * INTO before_state FROM (${state}) before_guard;
 IF before_state='pending' THEN ${statement}
 ELSIF before_state<>'ready' THEN RAISE EXCEPTION 'media_storage_control_blocked';END IF;
 IF (SELECT * FROM (${state}) after_guard) IS DISTINCT FROM 'ready' THEN RAISE EXCEPTION 'media_storage_control_blocked';END IF;
 END $fm1425_guard$;COMMIT;`;
}
export function assertStorageGuardTarget(e){
 if(e.GITHUB_REPOSITORY!=='FanMind/FanMind'||e.GITHUB_EVENT_NAME!=='workflow_dispatch'||e.GITHUB_REF!=='refs/heads/main'||! /^[a-f0-9]{40}$/.test(e.GITHUB_SHA??'')||e.REVIEWED_COMMIT!==e.GITHUB_SHA||!['verify','apply'].includes(e.STORAGE_GUARD_ACTION)||e.CONFIRMATION!==`staging-media-storage-${e.STORAGE_GUARD_ACTION}`||e.FANMIND_RUNTIME_ENVIRONMENT!=='staging'||e.FANMIND_TARGET_API_ORIGIN!=='https://staging.fanmind.ch'||e.FANMIND_TARGET_SUPABASE_PROJECT_REF!=='vshyhvgcmrlagvfnvomc'||e.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF!=='drqkpdvtbbrrdwmtrodz'||e.NEXT_PUBLIC_SUPABASE_URL!=='https://vshyhvgcmrlagvfnvomc.supabase.co'||!e.PGHOST||e.PGHOST!==e.FANMIND_TARGET_DB_HOST||!e.FANMIND_PRODUCTION_DB_HOST||e.PGHOST===e.FANMIND_PRODUCTION_DB_HOST||e.PGUSER!=='postgres.vshyhvgcmrlagvfnvomc'||e.PGSSLMODE!=='verify-full'||!e.PGSSLROOTCERT||!e.PGPASSFILE)fail();
 if(e.FANMIND_ENABLE_NON_PRODUCTION_WRITES!==(e.STORAGE_GUARD_ACTION==='apply'?'true':'false')||e.FANMIND_NON_PRODUCTION_WRITE_ACK!==(e.STORAGE_GUARD_ACTION==='apply'?'I_UNDERSTAND_NON_PRODUCTION_ONLY':''))fail();
}
export async function runStorageGuard(e=process.env){
 assertStorageGuardTarget(e);
 const checkout=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']});
 if(checkout.status!==0||checkout.stdout.trim()!==e.GITHUB_SHA)fail();
 const live=await fetch(`${e.FANMIND_TARGET_API_ORIGIN}/api/version`,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)}).then(r=>r.ok?r.json():fail());
 if(live.application!=='fanmind'||live.runtimeEnvironment!=='staging'||live.releaseCommit!==e.GITHUB_SHA)fail();
 const frozen=privatePassfileSnapshot(e);
 const query=(q,write=false)=>{const r=spawnSync('psql',['--no-password','--no-psqlrc','-Atq','-v','ON_ERROR_STOP=1'],{env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',PGHOST:e.PGHOST,PGPORT:'5432',PGDATABASE:'postgres',PGUSER:e.PGUSER,PGSSLMODE:'verify-full',PGSSLROOTCERT:e.PGSSLROOTCERT,PGPASSFILE:frozen.snapshotPath,PGCONNECT_TIMEOUT:'10',PGOPTIONS:`-c default_transaction_read_only=${write?'off':'on'}`},input:q,encoding:'utf8',timeout:30000,maxBuffer:65536});if(r.error||r.status!==0)fail();return r.stdout.trim();};
 try{
  const before=query(`BEGIN READ ONLY;${storageGuardStateSql()};ROLLBACK;`);
  if(!['pending','ready'].includes(before))fail();
  if(e.STORAGE_GUARD_ACTION==='verify'){console.log(`STAGING_MEDIA_STORAGE_GUARD=${before.toUpperCase()}`);return;}
  query(storageGuardTransaction(),true);
  if(query(`BEGIN READ ONLY;${storageGuardStateSql()};ROLLBACK;`)!=='ready')fail();
  console.log('STAGING_MEDIA_STORAGE_GUARD=PASS');
 }finally{rmSync(frozen.directory,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{await runStorageGuard();}catch{console.error('STAGING_MEDIA_STORAGE_GUARD=BLOCKED');process.exitCode=1;}}
