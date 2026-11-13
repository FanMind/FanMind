#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {constants,openSync,fstatSync,readFileSync,closeSync,writeFileSync,renameSync,unlinkSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {waitForStagingRelease} from './staging-support-media-runtime.mjs';
const ROOT='/var/www/fanmind-staging',FILE=ROOT+'/.env.production',OVERRIDES=['/etc/fanmind-staging/runtime-secrets.env',ROOT+'/.release.env'];
export const CATALOGUE_FLAGS=['FANMIND_CHAT_ADMIN_MEDIA_CATALOGUE_ENABLED','FANMIND_CHAT_ADMIN_MEDIA_VIDEO_ENABLED'];
const fail=code=>{throw Error(code);};
export function assertCatalogueRuntime(env,action){
 if(!['catalogue-on','video-on','off','verify'].includes(action)||env.GITHUB_REPOSITORY!=='FanMind/FanMind'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||! /^[a-f0-9]{40}$/u.test(env.GITHUB_SHA??'')||env.REVIEWED_COMMIT!==env.GITHUB_SHA||env.CONFIRMATION!==`staging-media-${action}`||env.SCHEMA_VERIFIED!=='extended'||env.TARGET_PROJECT!=='vshyhvgcmrlagvfnvomc'||env.PRODUCTION_PROJECT!=='drqkpdvtbbrrdwmtrodz')fail('catalogue_target');
}
export function renderCatalogueFlags(original,overrides,action){
 if(!['catalogue-on','video-on','off'].includes(action))fail('catalogue_action');
 let text=original;
 for(const [index,key] of CATALOGUE_FLAGS.entries()){
  const re=new RegExp(`^[ \\t]*(?:export[ \\t]+)?${key}[ \\t]*=.*$`,'gm'),rows=[...text.matchAll(re)];
  if(rows.length>1||rows.some(r=>!/=\s*(?:true|false)\s*$/u.test(r[0]))||overrides.some(v=>new RegExp(re.source,'m').test(v)))fail('catalogue_flag_ambiguous');
  const value=action==='video-on'||(action==='catalogue-on'&&index===0),line=`${key}=${value}`;
  text=rows.length?text.replace(re,line):text+(text.endsWith('\n')?'':'\n')+line+'\n';
 }
 return text;
}
export function assertMediaProbeReceipt(receipt,stat,source,pid,now=Date.now()){
 if(stat.uid!==0||stat.nlink!==1||(stat.mode&0o022)||receipt.version!==1||receipt.source!==source||receipt.live!==source||receipt.pid!==Number(pid)||receipt.result!=='PASS'||!Number.isFinite(Date.parse(receipt.completedAt))||now-Date.parse(receipt.completedAt)<0||now-Date.parse(receipt.completedAt)>30*60000)fail('catalogue_video_probe_required');
}
function privateFile(path,kind='private'){
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{const s=fstatSync(fd);if(!s.isFile()||s.nlink!==1||s.size<1||s.size>1048576||(kind==='private'?(s.uid!==process.getuid()||(s.mode&0o777)!==0o600):(kind==='root'?(s.uid!==0||(s.mode&0o777)!==0o640):(s.uid!==0||(s.mode&0o022)))))fail('catalogue_file');
 const bytes=readFileSync(fd),after=fstatSync(fd);if(s.ino!==after.ino||s.size!==after.size||s.mtimeMs!==after.mtimeMs||s.ctimeMs!==after.ctimeMs)fail('catalogue_file_changed');return {bytes,stat:s};}finally{closeSync(fd);}
}
function run(cmd,args){const r=spawnSync(cmd,args,{env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'},encoding:'utf8',timeout:60000,stdio:['ignore','pipe','pipe'],maxBuffer:65536});if(r.error||r.status!==0)fail('catalogue_host_operation');return r.stdout.trim();}
const pid=()=>run('/usr/bin/systemctl',['show','fanmind-staging.service','--property=MainPID','--value']);
function processFlags(){const value=pid();if(!/^[1-9][0-9]{0,9}$/u.test(value))fail('catalogue_process');return Object.fromEntries(readFileSync(`/proc/${value}/environ`,'utf8').split('\0').filter(Boolean).map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));}
const preserved=env=>Object.fromEntries(Object.entries(env).filter(([k])=>/^(?:FANMIND_(?:SUPPORT|META|STAGING_OPERATOR|BILLING|STRIPE|CHAT_ADMIN_MEDIA_(?:ENABLED|ANALYSIS))|STRIPE_|NEXT_PUBLIC_ENABLE_INAPP_HELP)/u.test(k)).sort(([a],[b])=>a.localeCompare(b)));
async function live(sha){const r=await fetch('https://staging.fanmind.ch/api/version',{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)fail('target_read_failed');const v=await r.json();if(v.application!=='fanmind'||v.runtimeEnvironment!=='staging'||v.releaseCommit!==sha)fail('live_release_mismatch');}
function replace(bytes){const temp=FILE+'.catalogue-'+randomBytes(12).toString('hex');try{writeFileSync(temp,bytes,{mode:0o600,flag:'wx'});renameSync(temp,FILE);}finally{try{unlinkSync(temp);}catch{}}}
export async function catalogueRuntime(env=process.env,action=env.ACTION){
 assertCatalogueRuntime(env,action);if(run('/usr/bin/git',['rev-parse','HEAD'])!==env.GITHUB_SHA)fail('catalogue_source');await live(env.GITHUB_SHA);
 const original=privateFile(FILE).bytes,overrides=OVERRIDES.map((p,i)=>privateFile(p,i===0?'root':'private').bytes),before=processFlags();
 if(before.FANMIND_RUNTIME_ENVIRONMENT!=='staging'||before.NEXT_PUBLIC_SUPABASE_URL!=='https://vshyhvgcmrlagvfnvomc.supabase.co'||before.FANMIND_CHAT_ADMIN_MEDIA_ENABLED!=='true'||!['false',undefined].includes(before.FANMIND_CHAT_ADMIN_MEDIA_ANALYSIS_ENABLED))fail('catalogue_effective_boundary');
 if(action==='verify'){for(const key of CATALOGUE_FLAGS)console.log(`${key}=${before[key]==='true'}`);console.log('STAGING_MEDIA_CATALOGUE_RUNTIME=VERIFIED');return;}
 if(action==='video-on'){const receipt=privateFile('/var/lib/fanmind-staging-media/receipt.json','receipt');assertMediaProbeReceipt(JSON.parse(receipt.bytes),receipt.stat,env.GITHUB_SHA,pid());}
 const next=Buffer.from(renderCatalogueFlags(original.toString('utf8'),overrides.map(x=>x.toString('utf8')),action));
 const unchanged=()=>{if(!privateFile(FILE).bytes.equals(next)||!OVERRIDES.every((p,i)=>privateFile(p,i===0?'root':'private').bytes.equals(overrides[i])))fail('catalogue_concurrent_config');};
 if(!privateFile(FILE).bytes.equals(original))fail('catalogue_concurrent_config');
 replace(next);
 try{
  unchanged();run('/usr/bin/sudo',['-n','/usr/bin/systemctl','restart','fanmind-staging.service']);await waitForStagingRelease(()=>live(env.GITHUB_SHA));
  unchanged();const after=processFlags();
  if(JSON.stringify(preserved(before))!==JSON.stringify(preserved(after)))fail('catalogue_other_flags_changed');
  for(const [i,key] of CATALOGUE_FLAGS.entries())if(after[key]!==String(action==='video-on'||(action==='catalogue-on'&&i===0)))fail('catalogue_flags_not_effective');
  console.log('STAGING_MEDIA_OTHER_FLAGS=UNCHANGED');console.log('STAGING_MEDIA_CATALOGUE_RUNTIME=PASS');
 }catch(error){
  unchanged();replace(original);run('/usr/bin/sudo',['-n','/usr/bin/systemctl','restart','fanmind-staging.service']);await waitForStagingRelease(()=>live(env.GITHUB_SHA));
  const restored=processFlags();if(JSON.stringify(preserved(restored))!==JSON.stringify(preserved(before))||CATALOGUE_FLAGS.some(key=>(restored[key]??'false')!==(before[key]??'false'))||!privateFile(FILE).bytes.equals(original))fail('catalogue_rollback_failed');
  console.log('STAGING_MEDIA_CATALOGUE_ROLLBACK=PASS');throw error;
 }
}
if(process.argv[1]?.endsWith('/staging-media-catalogue-runtime.mjs')){try{await catalogueRuntime();}catch{console.error('STAGING_MEDIA_CATALOGUE_RUNTIME=BLOCK');process.exitCode=1;}}
