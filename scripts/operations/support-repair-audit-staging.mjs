#!/usr/bin/env node
import {readFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {evaluateSupportEnvironment,runSupportStaging} from './support-centre-staging.mjs';
import {privatePassfileSnapshot} from './website-chat-retention-staging-runner.mjs';

export const AUDIT_CONFIRMATIONS={
 'audit-verify':'verify-support-repair-audit',
 'audit-upgrade':'upgrade-empty-support-repair-audit',
 'audit-acceptance':'run-support-repair-audit-acceptance',
};
export const AUDIT_SOURCES={
 'docs/operations/sql/support_repair_audit_staging_empty_upgrade.sql':'178bb5017ac25114ded84213f37f92bda224193bbd9ab0aa5b2812fec6c9faf1',
 'docs/operations/sql/support_repair_audit_verify.sql':'87918c38dd8ca31ef72c982d4f01ea17a0dd07ca897e18bfd21d081af3219168',
 'docs/operations/sql/support_repair_audit_synthetic_acceptance.sql':'1c6fe0c787c2b95c8f1f466b88209370d818b8720ca6654ad47e8fc3bdebbb75',
 'docs/operations/sql/support_centre_synthetic_acceptance.sql':'b425c08400aef6ec95d4fb3e563a9952c8fb0343f804877fcf333ec8361bfe15',
};
const [UPGRADE,VERIFY,ACCEPT,CORE]=Object.keys(AUDIT_SOURCES);

export const AUDIT_BINDING_SQL=String.raw`
SET LOCAL ROLE service_role;
DO $binding$
DECLARE
 ws uuid:='58a18c7e-4af0-459d-b44d-7d924ee7ffe9';
 actor uuid:='3abca6a2-c4f7-4ff7-b72d-915d19181ffc';
 connection uuid:='de135100-2026-4000-8000-000000000001';
 request uuid:='de135102-2026-4000-8000-000000000001';
 finished timestamptz:=clock_timestamp(); affected integer;
BEGIN
 INSERT INTO public.support_repair_audit(workspace_id,actor_user_id,connection_id,platform,action,consent_required,consent_given,status,request_id)
 VALUES(ws,actor,connection,'facebook','restart_message_sync',true,true,'started',request);
 UPDATE public.support_repair_audit SET status='failed',completed_at=finished WHERE request_id=request AND workspace_id=ws AND actor_user_id=actor AND connection_id='de135100-2026-4000-8000-000000000099' AND platform='facebook' AND action='restart_message_sync' AND status IN('started','failed');
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>0 THEN RAISE EXCEPTION 'foreign_connection_completed';END IF;
 UPDATE public.support_repair_audit SET status='failed',completed_at=finished WHERE request_id=request AND workspace_id='de135100-2026-4000-8000-000000000099' AND actor_user_id=actor AND connection_id=connection AND platform='facebook' AND action='restart_message_sync' AND status IN('started','failed');
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>0 THEN RAISE EXCEPTION 'foreign_workspace_completed';END IF;
 UPDATE public.support_repair_audit SET status='failed',completed_at=finished WHERE request_id=request AND workspace_id=ws AND actor_user_id=actor AND connection_id=connection AND platform='facebook' AND action='restart_message_sync' AND status IN('started','failed');
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'exact_completion_missing';END IF;
 UPDATE public.support_repair_audit SET status='failed',completed_at=finished WHERE request_id=request AND workspace_id=ws AND actor_user_id=actor AND connection_id=connection AND platform='facebook' AND action='restart_message_sync' AND status IN('started','failed');
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'completion_not_idempotent';END IF;
 UPDATE public.support_repair_audit SET status='succeeded',completed_at=finished WHERE request_id=request AND workspace_id=ws AND actor_user_id=actor AND connection_id=connection AND platform='facebook' AND action='restart_message_sync' AND status IN('started','succeeded');
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>0 THEN RAISE EXCEPTION 'conflicting_completion_allowed';END IF;
END $binding$;
RESET ROLE;
SELECT 'SUPPORT_AUDIT_BINDING=PASS';
`;

const fail=code=>{throw Error('SUPPORT_AUDIT_ERROR='+code);};
export function checkAuditSources(){
 const sources=Object.fromEntries(Object.entries(AUDIT_SOURCES).map(([path,hash])=>{
  const value=readFileSync(path,'utf8');
  if(createHash('sha256').update(value).digest('hex')!==hash)fail('source_checksum');
  return [path,value];
 }));
 return sources;
}
export function evaluateAuditEnvironment(env,mode,checkout){
 if(!Object.hasOwn(AUDIT_CONFIRMATIONS,mode)||env.FANMIND_SUPPORT_CONFIRM!==AUDIT_CONFIRMATIONS[mode]||
 env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.NEXT_PUBLIC_APP_URL!=='https://staging.fanmind.ch')return {ok:false};
 const mapped=mode==='audit-verify'?'verify':'apply';
 return evaluateSupportEnvironment({...env,FANMIND_SUPPORT_CONFIRM:mapped==='verify'?'verify-support-centre-schema':'apply-support-centre-schema'},mapped,checkout);
}
export function auditState(output){
 const rows=String(output).split(/\r?\n/u).filter(line=>line.startsWith('SUPPORT_REPAIR_AUDIT_SCHEMA_STATE='));
 if(rows.length!==1)fail('classifier_output');
 const state=rows[0].match(/^SUPPORT_REPAIR_AUDIT_SCHEMA_STATE=(INSTALLED|DRIFT|ABSENT) SUPPORT_REPAIR_AUDIT_SCHEMA_DETAILS=/u)?.[1];
 if(!state)fail('classifier_output');return state;
}
export function legacyAuditPreflightSql(sources=checkAuditSources()){
 const match=sources[UPGRADE].match(/IF \((select md5[\s\S]*?)\) IS DISTINCT FROM '5be8a062a7627b88d5f710b9928fd669'/u);
 if(!match)fail('legacy_source');
 return "BEGIN READ ONLY;SELECT jsonb_build_object('exact',("+match[1]+")='5be8a062a7627b88d5f710b9928fd669','empty',NOT EXISTS(SELECT 1 FROM public.support_repair_audit),'dependencies',NOT EXISTS(SELECT 1 FROM pg_constraint WHERE confrelid='public.support_repair_audit'::regclass));ROLLBACK;";
}
export function auditAcceptanceSql(sources=checkAuditSources()){
 return "\\set ON_ERROR_STOP on\nBEGIN;\nSET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';SELECT pg_advisory_xact_lock(1350,1417);SELECT pg_advisory_xact_lock(1350,20261105);\nLOCK TABLE public.support_repair_audit IN SHARE ROW EXCLUSIVE MODE;\nDO $$ BEGIN IF EXISTS(SELECT 1 FROM public.support_repair_audit) THEN RAISE EXCEPTION 'audit_acceptance_requires_empty';END IF;END $$;\n"+
 sources[ACCEPT]+"\n"+sources[CORE]+"\n"+AUDIT_BINDING_SQL+"\nROLLBACK;\nSELECT 'SUPPORT_AUDIT_TRANSACTION=ROLLED_BACK';\n";
}
export const AUDIT_ABSENCE_SQL="BEGIN READ ONLY;SELECT jsonb_build_object('audit',(SELECT count(*) FROM public.support_repair_audit),'owner',(SELECT count(*) FROM public.support_centre_owners WHERE user_id='3abca6a2-c4f7-4ff7-b72d-915d19181ffc'),'threads',(SELECT count(*) FROM public.support_chat_threads WHERE user_id='3abca6a2-c4f7-4ff7-b72d-915d19181ffc'),'connection',(SELECT count(*) FROM public.social_connections WHERE id='de135100-2026-4000-8000-000000000001'),'cases',(SELECT count(*) FROM public.support_centre_cases WHERE connection_id='de135100-2026-4000-8000-000000000001'));ROLLBACK;";

async function verifySupportHttpBoundary(fetchImpl){
 const probes=[
  ['/api/admin/support/overview','GET','support_unavailable'],
  ['/api/support/conversation','GET','support_unavailable'],
  ['/api/support/repair-request','POST',null],
 ];
 for(const [path,method,error] of probes){
  const options={method,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)};
  if(method==='POST'){options.headers={'Content-Type':'application/json',Origin:'https://staging.fanmind.ch'};options.body=JSON.stringify({confirmed:true,action:'restart_message_sync',platform:'facebook',requestId:'de135104-2026-4000-8000-000000000001'});}
  const response=await fetchImpl('https://staging.fanmind.ch'+path,options);
  if(![401,404].includes(response.status)||!response.headers.get('cache-control')?.includes('no-store'))fail('http_boundary');
  let payload;try{payload=JSON.parse(await response.text());}catch{fail('http_boundary');}
  const expected=error??(response.status===404?'not_available':'unauthorized');
  if(Object.keys(payload).length!==1||payload.error!==expected)fail('http_boundary');
 }
 console.log('SUPPORT_HTTP_UNAUTHENTICATED_DENIALS=3');
}

async function verifyRelease(env,fetchImpl){
 const response=await fetchImpl('https://staging.fanmind.ch/api/version',{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(response.status!==200)fail('release');
 const body=await response.text();if(body.length>8192)fail('release');
 let value;try{value=JSON.parse(body);}catch{fail('release');}
 if(value.application!=='fanmind'||value.runtimeEnvironment!=='staging'||value.releaseCommit!==env.GITHUB_SHA)fail('release');
}
export async function runAudit(mode,env=process.env,deps={}){
 const sources=checkAuditSources();
 if(mode==='check'){console.log('SUPPORT_AUDIT_SOURCE_CHECK=PASS');return;}
 const spawn=deps.spawn??spawnSync;
 const checkout=spawn('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout?.trim();
 if(!evaluateAuditEnvironment(env,mode,checkout).ok||spawn('git',['rev-parse','origin/main'],{encoding:'utf8'}).stdout?.trim()!==checkout)fail('environment');
 await verifyRelease(env,deps.fetch??fetch);
 // Reuse the full independent Support catalogue, role checks and existing connection boundary.
 (deps.verifyCore??runSupportStaging)('verify',{...env,FANMIND_SUPPORT_CONFIRM:'verify-support-centre-schema',FANMIND_ENABLE_NON_PRODUCTION_WRITES:'false',FANMIND_NON_PRODUCTION_WRITE_ACK:''});
 const {directory,snapshotPath}=privatePassfileSnapshot(env);
 const run=query=>{
  const safe={...env,PGPASSFILE:snapshotPath,PGCONNECT_TIMEOUT:'10',PGAPPNAME:'fanmind-support-audit-staging'};
  for(const key of ['DATABASE_URL','POSTGRES_URL','SUPABASE_DB_URL','PGHOSTADDR','PGSERVICE','PGSERVICEFILE','PGSYSCONFDIR','PGPASSWORD','PGOPTIONS'])delete safe[key];
  const result=spawn('psql',['--no-password','--no-psqlrc','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],{env:safe,input:query,encoding:'utf8',timeout:90000,maxBuffer:4*1024*1024});
  if(result.error||result.status!==0)fail('database_rejected');
  return result.stdout.trim();
 };
 try{
  const before=auditState(run(sources[VERIFY]));
  console.log('SUPPORT_AUDIT_BEFORE='+before);
  if(mode==='audit-upgrade'&&before!=='INSTALLED'){
   if(before!=='DRIFT')fail('legacy_required');
   let proof;try{proof=JSON.parse(run(legacyAuditPreflightSql(sources)));}catch{fail('legacy_preflight');}
   if(proof.exact!==true||proof.empty!==true||proof.dependencies!==true)fail('legacy_drift_or_data');
   run(sources[UPGRADE]);console.log('SUPPORT_AUDIT_APPLY=completed');
  }else if(mode==='audit-upgrade')console.log('SUPPORT_AUDIT_APPLY=already_installed');
  if(auditState(run(sources[VERIFY]))!=='INSTALLED')fail('postflight');
  console.log('SUPPORT_AUDIT_SCHEMA=INSTALLED');
  if(mode==='audit-acceptance'){
   await verifySupportHttpBoundary(deps.fetch??fetch);
   const output=run(auditAcceptanceSql(sources));
   for(const marker of ['SUPPORT_REPAIR_AUDIT_NATIVE_ACCEPTANCE=PASS','SUPPORT_SYNTHETIC_FUNCTIONS=PASS','SUPPORT_AUDIT_BINDING=PASS','SUPPORT_AUDIT_TRANSACTION=ROLLED_BACK']){
    if(!output.split(/\r?\n/u).includes(marker))fail('acceptance_marker');console.log(marker);
   }
   const absence=JSON.parse(run(AUDIT_ABSENCE_SQL));
   if(Object.keys(absence).length!==5||Object.values(absence).some(n=>n!==0))fail('cleanup');
   if(auditState(run(sources[VERIFY]))!=='INSTALLED')fail('schema_after_rollback');
   console.log('SUPPORT_AUDIT_CLEANUP=PASS');
  }
  await verifyRelease(env,deps.fetch??fetch);
  console.log('SUPPORT_AUDIT_RESULT=PASS');
 }finally{rmSync(directory,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const mode=process.argv.length===3?process.argv[2].replace(/^--/u,''):'';
 try{if(mode!=='check'&&!Object.hasOwn(AUDIT_CONFIRMATIONS,mode))fail('argument');await runAudit(mode);}
 catch(error){console.error(/^SUPPORT_AUDIT_ERROR=[a-z_]+$/u.test(error?.message??'')?error.message:'SUPPORT_AUDIT_ERROR=unexpected');console.error('SECRETS_NOT_PRINTED=true');process.exitCode=1;}
}
