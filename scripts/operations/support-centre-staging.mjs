#!/usr/bin/env node
import {readFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {privatePassfileSnapshot} from './website-chat-retention-staging-runner.mjs';
import {evaluateWebsiteChatStagingControlEnvironment} from '../../src/lib/websiteChatStagingControlPolicy.mjs';
import {sourceManifest,catalogueSql,classify,assertReference,installSql,rollbackSql,REFERENCE_PATH} from './support-centre-schema.mjs';
const STAGING='vshyhvgcmrlagvfnvomc',PRODUCTION='drqkpdvtbbrrdwmtrodz';
export const CONFIRMATIONS={verify:'verify-support-centre-schema',apply:'apply-support-centre-schema',retention:'run-support-retention',monitor:'verify-support-retention',owner:'bind-support-platform-owner','rollback-empty':'rollback-empty-support-centre'};
export function evaluateSupportEnvironment(env,mode,checkout){
 const errors=[];const write=!['verify','monitor'].includes(mode);
 if(!Object.hasOwn(CONFIRMATIONS,mode)||env.FANMIND_SUPPORT_CONFIRM!==CONFIRMATIONS[mode])errors.push('support_confirmation');
 const reviewed=env.FANMIND_SUPPORT_REVIEWED_COMMIT;
 if(!/^[a-f0-9]{40}$/.test(reviewed??'')||reviewed!==checkout)errors.push('checkout_binding');
 const scheduled=env.GITHUB_EVENT_NAME==='schedule';
 if(scheduled&&!['retention','monitor'].includes(mode))errors.push('scheduled_action');
 if(scheduled&&env.FANMIND_SUPPORT_RETENTION_SCHEDULE_ENABLED!=='true')errors.push('schedule_disabled');
 if(!scheduled&&env.GITHUB_SHA!==reviewed)errors.push('event_commit');
 if(env.FANMIND_TARGET_SUPABASE_PROJECT_REF!==STAGING||env.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF!==PRODUCTION)errors.push('fixed_project_binding');
 const direct=env.PGHOST===`db.${STAGING}.supabase.co`&&env.PGUSER==='postgres';
 const pool=/^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(env.PGHOST??'')&&env.PGUSER===`postgres.${STAGING}`;
 if((!direct&&!pool)||env.PGPORT!=='5432'||env.PGDATABASE!=='postgres')errors.push('database_project_binding');
 if(env.PGPASSWORD||env.PGOPTIONS)errors.push('libpq_override');
 const mapped={...env,GITHUB_SHA:reviewed,FANMIND_WEBSITE_CHAT_REVIEWED_COMMIT:reviewed,
  ...(write?{FANMIND_WEBSITE_CHAT_MIGRATION_CONFIRM:'apply-website-chat-handoff-migration'}:{FANMIND_WEBSITE_CHAT_SCHEMA_CONFIRM:'verify-website-chat-handoff-schema'})};
 const inherited=evaluateWebsiteChatStagingControlEnvironment(mapped,{mode:write?'migration':'schema'});
 errors.push(...inherited.errors);return {ok:errors.length===0,errors:[...new Set(errors)]};
}
export function runSupportStaging(mode,env=process.env){
 const reference=JSON.parse(readFileSync(REFERENCE_PATH,'utf8'));assertReference(reference);
 if(mode==='check'){console.log(`SUPPORT_MANIFEST_TABLES=${sourceManifest().tables.length}`);console.log(`SUPPORT_MANIFEST_FUNCTIONS=${sourceManifest().functions.length}`);console.log('SUPPORT_OFFLINE_CHECK=PASS');return;}
 const checkout=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout?.trim();
 if(!evaluateSupportEnvironment(env,mode,checkout).ok)throw new Error('environment_rejected');
 const {directory,snapshotPath}=privatePassfileSnapshot(env);
 const run=sql=>{
  const safe={...env,PGPASSFILE:snapshotPath,PGCONNECT_TIMEOUT:'10',PGAPPNAME:'fanmind-support-staging'};
  for(const key of ['DATABASE_URL','POSTGRES_URL','SUPABASE_DB_URL','PGHOSTADDR','PGSERVICE','PGSERVICEFILE','PGSYSCONFDIR','PGPASSWORD','PGOPTIONS'])delete safe[key];
  const r=spawnSync('psql',['--no-password','--no-psqlrc','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],{env:safe,input:sql,encoding:'utf8',timeout:90000,maxBuffer:4*1024*1024});
  if(r.error||r.status!==0)throw new Error('database_operation_failed');return r.stdout.trim();
 };
 const inspect=()=>JSON.parse(run(`BEGIN READ ONLY;SET LOCAL statement_timeout='10s';${catalogueSql()}ROLLBACK;`));
 try{
  let state=classify(inspect(),reference);console.log(`SUPPORT_SCHEMA_STATE=${state}`);
  if(mode==='apply'){
   if(state==='ABSENT'){run(installSql(reference));state=classify(inspect(),reference);}
   if(state!=='EXACT')throw new Error('schema_not_exact');
  }else if(state!=='EXACT')throw new Error('schema_not_exact');
  if(mode==='rollback-empty'){run(rollbackSql(reference));if(classify(inspect(),reference)!=='ABSENT')throw new Error('rollback_verification_failed');}
  if(mode==='owner'){
   const owner=env.FANMIND_SUPPORT_OWNER_UUID;
   if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(owner??''))throw new Error('approved_owner_required');
   const emails=(env.FANMIND_SUPPORT_ADMIN_EMAILS??'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
   if(!emails.length||emails.some(v=>! /^[a-z0-9.!#$%&*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(v)))throw new Error('approved_admin_allowlist_required');
   const allowed=emails.map(v=>"'"+v.replaceAll("'","''")+"'").join(',');
   run(`BEGIN;SELECT pg_advisory_xact_lock(1350,1417);LOCK TABLE public.support_centre_owners IN SHARE ROW EXCLUSIVE MODE;DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id='${owner}'::uuid AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<clock_timestamp()) AND lower(email) IN(${allowed})) OR EXISTS(SELECT 1 FROM public.support_centre_owners WHERE user_id<>'${owner}'::uuid) THEN RAISE EXCEPTION 'owner_binding_rejected';END IF;END $$;INSERT INTO public.support_centre_owners(user_id)VALUES('${owner}')ON CONFLICT DO NOTHING;SELECT 1/(CASE WHEN (SELECT count(*) FROM public.support_centre_owners)=1 AND EXISTS(SELECT 1 FROM public.support_centre_owners WHERE user_id='${owner}') THEN 1 ELSE 0 END);COMMIT;`);
  }
  if(mode==='retention'){
   const hashed=env.GITHUB_RUN_ID?createHash('sha256').update('support-retention:'+env.GITHUB_RUN_ID).digest('hex'):null;
   const derived=hashed?`${hashed.slice(0,8)}-${hashed.slice(8,12)}-4${hashed.slice(13,16)}-a${hashed.slice(17,20)}-${hashed.slice(20,32)}`:randomUUID();
   const id=env.FANMIND_SUPPORT_RETENTION_RUN_ID||derived;
   if(Number(env.GITHUB_RUN_ATTEMPT??1)>3)throw new Error('retention_retry_limit');if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id))throw new Error('run_identity_invalid');
   const result=JSON.parse(run(`SELECT public.run_support_retention('${id}'::uuid,'${checkout}',${env.FANMIND_SUPPORT_RETENTION_RETRY==='true'});`));
   console.log(`SUPPORT_RETENTION_RESULT=${JSON.stringify(result)}`);
   if(!['succeeded','already_completed'].includes(result.status))throw new Error('retention_failed');
  }
  if(mode==='monitor'){
   const result=JSON.parse(run("BEGIN READ ONLY;SELECT jsonb_build_object('healthy',coalesce(max(completed_at)>clock_timestamp()-interval '30 hours',false),'latest_status',(SELECT status FROM public.support_retention_runs ORDER BY started_at DESC LIMIT 1)) FROM public.support_retention_runs WHERE status='succeeded';ROLLBACK;"));
   if(!result.healthy||result.latest_status!=='succeeded')throw new Error('retention_health_failed');
  }
  console.log(`SUPPORT_${mode.toUpperCase().replaceAll('-','_')}=PASS`);
 }finally{rmSync(directory,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const arg=process.argv[2];if(process.argv.length!==3||!/^--(check|verify|apply|retention|monitor|owner|rollback-empty)$/.test(arg??''))throw new Error('argument_invalid');runSupportStaging(arg.slice(2));}
 catch(error){const code=error instanceof Error&&/^[a-z_]+$/.test(error.message)?error.message:'operation_failed';console.error(`SUPPORT_STAGING_ERROR=${code}`);console.error('SECRETS_NOT_PRINTED=true');process.exitCode=1;}
}
