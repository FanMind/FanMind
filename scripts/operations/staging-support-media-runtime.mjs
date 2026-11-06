#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { constants,openSync,fstatSync,readFileSync,closeSync,writeFileSync,renameSync,unlinkSync,fsyncSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildSupabaseApiKeyHeaders } from '../../src/lib/supabase/apiKeyPolicy.mjs';

export const STAGING_PROJECT='vshyhvgcmrlagvfnvomc';
const PRODUCTION_PROJECT='drqkpdvtbbrrdwmtrodz';
const ORIGIN='https://staging.fanmind.ch';
const ROOT='/var/www/fanmind-staging';
const ENV_FILE=ROOT+'/.env.production';
const OVERRIDES=['/etc/fanmind-staging/runtime-secrets.env',ROOT+'/.release.env'];
export const FLAGS=['FANMIND_SUPPORT_CENTRE_ENABLED','FANMIND_CHAT_ADMIN_MEDIA_ENABLED'];
const ANALYSIS='FANMIND_CHAT_ADMIN_MEDIA_ANALYSIS_ENABLED';
const SHA=/^[a-f0-9]{40}$/u;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const fail=code=>{throw new Error(code);};

export function assertStagingRuntimeTarget(env,action){
 if(!['activate','deactivate'].includes(action)||env.GITHUB_REPOSITORY!=='FanMind/FanMind'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_EVENT_NAME!=='workflow_dispatch')fail('execution_boundary');
 if(!SHA.test(env.GITHUB_SHA??'')||env.REVIEWED_COMMIT!==env.GITHUB_SHA||env.CONFIRMATION!==`staging-support-media-${action}`)fail('source_binding');
 if(env.FANMIND_RUNTIME_ENVIRONMENT!=='staging'||env.NEXT_PUBLIC_APP_URL!==ORIGIN||env.NEXT_PUBLIC_SUPABASE_URL!==`https://${STAGING_PROJECT}.supabase.co`||env.FANMIND_TARGET_SUPABASE_PROJECT_REF!==STAGING_PROJECT||env.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF!==PRODUCTION_PROJECT)fail('target_binding');
 if(env[ANALYSIS]!==undefined&&env[ANALYSIS]!=='false')fail('analysis_must_remain_disabled');
 for(const key of ['FANMIND_OPERATIONS_EMAIL_ENABLED','FANMIND_SERVER_ERROR_EMAIL_ENABLED','FANMIND_ENABLE_TELEGRAM_SEND'])if(env[key]!=='false')fail('external_delivery_not_disabled');
 if(!UUID.test(env.SUPPORT_OWNER_UUID??'')||!/^\d{1,20}$/u.test(env.GITHUB_RUN_ID??''))fail('owner_or_run_binding');
 if(action==='activate'&&(env.SUPPORT_SCHEMA_VERIFIED!=='true'||env.SUPPORT_RETENTION_VERIFIED!=='true'))fail('schema_verification_required');
}

export function renderStagingRuntimeFlags(original,overrides,enabled){
 let text=original;
 for(const key of [...FLAGS,ANALYSIS]){
  const pattern=new RegExp(`^[ \\t]*(?:export[ \\t]+)?${key}[ \\t]*=.*$`,'gm');
  const rows=[...text.matchAll(pattern)];
  if(rows.length>1||rows.some(r=>!/=\s*(?:true|false)\s*$/u.test(r[0])))fail('ambiguous_flag');
  if(overrides.some(value=>new RegExp(`^[ \\t]*(?:export[ \\t]+)?${key}[ \\t]*=`,'m').test(value)))fail('override_flag');
  const line=`${key}=${key===ANALYSIS?'false':String(enabled)}`;
  text=rows.length?text.replace(pattern,line):text+(text.endsWith('\n')?'':'\n')+line+'\n';
 }
 return text;
}

function execute(command,args){
 const result=spawnSync(command,args,{encoding:'utf8',timeout:60000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});
 if(result.error||result.status!==0)fail('host_operation_failed');
 return result.stdout;
}
function privateFile(path,{secret=false}={}){
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{
  const before=fstatSync(fd);
  if(!before.isFile()||before.nlink!==1||before.size<1||before.size>1048576||
   (secret?(before.uid!==0||(before.mode&0o777)!==0o640):(before.uid!==process.getuid()||(before.mode&0o777)!==0o600)))fail('protected_file_invalid');
  const text=readFileSync(fd,'utf8'),after=fstatSync(fd);
  if(before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)fail('protected_file_changed');
  return text;
 }finally{closeSync(fd);}
}
function replace(text){
 const temporary=ENV_FILE+'.support-media-'+randomBytes(12).toString('hex');
 try{writeFileSync(temporary,text,{mode:0o600,flag:'wx'});renameSync(temporary,ENV_FILE);}
 finally{try{unlinkSync(temporary);}catch{}}
}
async function json(url,headers){
 const r=await fetch(url,{headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!r.ok)fail('target_read_failed');
 const reader=r.body.getReader();let size=0;const chunks=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536)fail('target_read_failed');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function verifyRelease(env){
 const value=await json(ORIGIN+'/api/version');
 if(value.application!=='fanmind'||value.runtimeEnvironment!=='staging'||value.releaseCommit!==env.GITHUB_SHA)fail('live_release_mismatch');
}
function processFlags(){
 const pid=execute('/usr/bin/systemctl',['show','fanmind-staging.service','--property=MainPID','--value']).trim();
 if(!/^[1-9][0-9]{0,9}$/u.test(pid))fail('service_not_running');
 // No new sudo rights are installed. Missing existing authority stops before writes.
 const bytes=readFileSync(`/proc/${pid}/environ`,'utf8');
 if(bytes.length>1048576)fail('process_environment_invalid');
 return Object.fromEntries(bytes.split('\0').map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}).filter(([key])=>[...FLAGS,ANALYSIS].includes(key)));
}
export async function changeStagingRuntime({before,after,write,restart,verify,verifyRollback,read,restoreOnFailure=true}){
 try{write(after);restart();await verify();}
 catch{
  if(!restoreOnFailure)fail('deactivation_failed_reconciliation_required');
  // A concurrent config change must never be overwritten by rollback.
  if(read()!==after)fail('rollback_configuration_changed');
  try{write(before);restart();await verifyRollback();}catch{fail('rollback_failed');}
  fail('activation_failed_rolled_back');
 }
}
export async function runStagingRuntime(action,env=process.env){
 assertStagingRuntimeTarget(env,action);
 await verifyRelease(env);
 const headers=buildSupabaseApiKeyHeaders(env.SUPABASE_SERVICE_ROLE_KEY);
 if(!headers.apikey)fail('staging_service_key_missing');
 const api=`https://${STAGING_PROJECT}.supabase.co/rest/v1/`;
 if(action==='activate'){
  const owners=await json(api+'support_centre_owners?select=user_id&limit=2',headers);
  if(!Array.isArray(owners)||owners.length!==1||owners[0].user_id!==env.SUPPORT_OWNER_UUID)fail('existing_owner_binding_missing');
 }
 const before=privateFile(ENV_FILE),overrides=OVERRIDES.map((p,i)=>privateFile(p,{secret:i===0}));
 const verifyOverrides=()=>{if(OVERRIDES.some((p,i)=>privateFile(p,{secret:i===0})!==overrides[i]))fail('override_configuration_changed');};
 const after=renderStagingRuntimeFlags(before,overrides,action==='activate');
 const current=processFlags();
 if(current[ANALYSIS]!==undefined&&current[ANALYSIS]!=='false')fail('running_analysis_not_disabled');
 const prior=Object.fromEntries([...FLAGS,ANALYSIS].map(key=>[key,current[key]==='true']));
 const receiptPath=ROOT+`/.support-media-runtime-${env.GITHUB_RUN_ID}.json`;
 const receipt={version:1,source:env.GITHUB_SHA,run:env.GITHUB_RUN_ID,action,prior,phase:'prepared'};
 const receiptFd=openSync(receiptPath,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
 let receiptStat;
 try{writeFileSync(receiptFd,JSON.stringify(receipt)+'\n');fsyncSync(receiptFd);receiptStat=fstatSync(receiptFd);}finally{closeSync(receiptFd);}
 const directoryFd=openSync(ROOT,constants.O_RDONLY|constants.O_DIRECTORY);
 try{fsyncSync(directoryFd);}finally{closeSync(directoryFd);}
 const updateReceipt=phase=>{
  const fd=openSync(receiptPath,constants.O_WRONLY|constants.O_APPEND|constants.O_NOFOLLOW);
  try{const stat=fstatSync(fd);if(!stat.isFile()||stat.nlink!==1||stat.ino!==receiptStat.ino||stat.dev!==receiptStat.dev||stat.uid!==process.getuid()||(stat.mode&0o777)!==0o600)fail('receipt_changed');writeFileSync(fd,JSON.stringify({...receipt,phase})+'\n');fsyncSync(fd);}finally{closeSync(fd);}
 };
 try{await changeStagingRuntime({before,after,restoreOnFailure:action!=='deactivate',read:()=>privateFile(ENV_FILE),write:text=>{verifyOverrides();if(privateFile(ENV_FILE)!==(text===after?before:after))fail('configuration_changed');replace(text);},restart:()=>{
  execute('/usr/bin/sudo',['-n','/usr/bin/systemctl','restart','fanmind-staging.service']);
  execute('/usr/bin/systemctl',['is-active','--quiet','fanmind-staging.service']);
 },verify:async()=>{
  verifyOverrides();
  const flags=processFlags();
  if(FLAGS.some(key=>flags[key]!==String(action==='activate'))||flags[ANALYSIS]!=='false')fail('effective_flags_mismatch');
  await verifyRelease(env);
 },verifyRollback:async()=>{
  verifyOverrides();
  const restored=processFlags();
  if([...FLAGS,ANALYSIS].some(key=>(restored[key]??'false')!==(current[key]??'false')))fail('rollback_effective_flags_mismatch');
  await verifyRelease(env);
 }});updateReceipt('verified');}
 catch(error){updateReceipt(error?.message==='activation_failed_rolled_back'?'rolled_back_verified':'reconciliation_required');throw error;}
 console.log(`STAGING_SUPPORT_MEDIA_ACTION=${action}`);
 console.log(`STAGING_SUPPORT_MEDIA_SOURCE=${env.GITHUB_SHA}`);
 console.log(`STAGING_SUPPORT_MEDIA_RUN=${env.GITHUB_RUN_ID}`);
 console.log(`STAGING_SUPPORT_MEDIA_PRIOR=${JSON.stringify(prior)}`);
 console.log('STAGING_SUPPORT_MEDIA_CONTROL=PASS');
 console.log('STAGING_SUPPORT_MEDIA_LIVE_ACCEPTANCE=PENDING');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 runStagingRuntime(process.argv[2]).catch(error=>{console.error(`STAGING_SUPPORT_MEDIA_ERROR=${/^[a-z_]+$/u.test(error?.message??'')?error.message:'operation_failed'}`);process.exitCode=1;});
}
