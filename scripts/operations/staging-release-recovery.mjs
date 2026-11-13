// Private host-local recovery for the existing in-place Staging deployment.
import {createHash,randomBytes} from 'node:crypto';
import * as fs from 'node:fs';
import {homedir} from 'node:os';
import {join,resolve,relative,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {readOperatorSessionState} from './staging-reviewed-source-policy.mjs';
import {evaluatePublicHealth} from '../public-health-policy.mjs';

const SHA=/^[a-f0-9]{40}$/u, RUN=/^[1-9][0-9]{0,19}$/u;
const ORIGIN='https://staging.fanmind.ch';
const EXCLUDES=['.env.production','.creator-runtime-recovery.env','.git','.next/cache'];
const fail=code=>{throw Error(code);};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function regular(path){const s=fs.lstatSync(path);if(!s.isFile()||s.isSymbolicLink())fail('unsafe_file');return s;}
function directory(path,privateMode=false){const s=fs.lstatSync(path);if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==process.getuid()&&privateMode||(privateMode&&(s.mode&0o777)!==0o700))fail('unsafe_directory');}
function privateDirectory(path){if(!fs.existsSync(path))fs.mkdirSync(path,{mode:0o700});directory(path,true);}
function envMap(text){
 const out={};for(const line of text.split(/\r?\n/u)){if(!line)continue;const m=/^([A-Z][A-Z0-9_]*)=(.*)$/u.exec(line);if(!m||Object.hasOwn(out,m[1]))fail('release_metadata_invalid');out[m[1]]=m[2];}return out;
}
function stableRelease(text){const map=envMap(text);delete map.FANMIND_RELEASE_COMMIT;return JSON.stringify(Object.entries(map).sort(([a],[b])=>a.localeCompare(b)));}
function excluded(path){return EXCLUDES.some(x=>path===x||path.startsWith(x+'/'));}
export function treeFingerprint(root){
 directory(root);const hash=createHash('sha256');let bytes=0,entries=0;
 function walk(folder){for(const name of fs.readdirSync(folder).sort()){
  const path=join(folder,name),rel=relative(root,path);if(excluded(rel))continue;
  if(++entries>200000)fail('snapshot_too_large');const s=fs.lstatSync(path);hash.update(JSON.stringify([rel,s.mode&0o777,s.isDirectory()?'d':s.isSymbolicLink()?'l':'f']));
  if(s.isSymbolicLink()){
   const target=fs.readlinkSync(path),dest=resolve(dirname(path),target);if(dest!==root&&!dest.startsWith(root+'/'))fail('external_symlink');hash.update(target);
  }else if(s.isDirectory())walk(path);
  else if(s.isFile()){
   bytes+=s.size;if(bytes>8*1024**3)fail('snapshot_too_large');const fd=fs.openSync(path,'r');const buffer=Buffer.alloc(1024*1024);try{let n;while((n=fs.readSync(fd,buffer,0,buffer.length,null))>0)hash.update(buffer.subarray(0,n));const after=fs.fstatSync(fd);if(after.ino!==s.ino||after.size!==s.size||after.mtimeMs!==s.mtimeMs||after.ctimeMs!==s.ctimeMs)fail('snapshot_file_changed');}finally{fs.closeSync(fd);}
  }else fail('unsupported_file');
 }}walk(root);return {hash:hash.digest('hex'),bytes,entries};
}
export function assertRecoveryBoundary(env,action){
 if(!['prepare','accept','restore'].includes(action)||env.GITHUB_REPOSITORY!=='FanMind/FanMind'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||!SHA.test(env.GITHUB_SHA??'')||env.REVIEWED_RELEASE_COMMIT!==env.GITHUB_SHA||!SHA.test(env.EXPECTED_CURRENT_RELEASE??'')||env.EXPECTED_CURRENT_RELEASE===env.GITHUB_SHA||!RUN.test(env.GITHUB_RUN_ID??'')||!RUN.test(env.RECOVERY_RUN_ID||env.GITHUB_RUN_ID))fail('recovery_boundary');
 if(action==='prepare'&&env.RECOVERY_RUN_ID&&env.RECOVERY_RUN_ID!==env.GITHUB_RUN_ID)fail('recovery_run_mismatch');
 if(env.BILLING_WRITE_FREEZE!=='preserve'||env.STAGING_OPERATOR_SESSION_ENABLED!=='true'||env.OPERATOR_SESSION_PRESERVATION_CONFIRMATION!=='preserve-approved-operator-session'||env.FANMIND_STAGING_RELEASE_RECOVERY_CONFIRM||env.FANMIND_STAGING_RELEASE_RECOVERY_PREVIOUS_COMMIT)fail('preservation_boundary');
}
function execute(command,args){const r=spawnSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:300000,maxBuffer:1024*1024});if(r.status!==0||r.error)fail('host_command_failed');return r.stdout;}
async function publicJson(path){const r=await fetch(ORIGIN+path,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)fail('public_probe_failed');const text=await r.text();if(text.length>65536)fail('public_probe_failed');return JSON.parse(text);}
async function probe(commit){const v=await publicJson('/api/version');if(v.application!=='fanmind'||v.runtimeEnvironment!=='staging'||v.releaseCommit!==commit)fail('live_release_changed');const h=await publicJson('/api/health');if(!evaluatePublicHealth(h).ok)fail('health_failed');}
function copy(source,dest){execute('rsync',['--archive','--delete',...EXCLUDES.flatMap(x=>['--exclude',x]),source+'/',dest+'/']);}
async function waitProbe(fn,commit){const deadline=Date.now()+45000;for(;;){try{return await fn(commit);}catch(error){if(Date.now()>=deadline)throw error;await new Promise(r=>setTimeout(r,1000));}}}

// Dependencies are explicit solely to exercise real private-directory/metadata
// recovery and negative paths on disposable filesystems without host access.
export async function recoverRelease(action,env,options={}){
 assertRecoveryBoundary(env,action);
 const source=options.source??'/var/www/fanmind-staging';
 const home=options.home??homedir();directory(home);
 const store=join(home,'.fanmind-staging-recovery');
 if(store===source||store.startsWith(source+'/'))fail('snapshot_inside_runtime');
 const run=env.RECOVERY_RUN_ID||env.GITHUB_RUN_ID;
 const backup=join(store,run),runtime=join(backup,'runtime'),receiptPath=join(backup,'receipt.json');
 const invoke=options.execute??execute,copyFiles=options.copy??copy,check=options.probe??probe;
 const secretPath=options.secretPath??'/etc/fanmind-staging/runtime-secrets.env';
 const unitPath=options.unitPath??'/etc/systemd/system/fanmind-staging.service';
 const reviewedUnit=options.reviewedUnit??resolve('ops/systemd/fanmind-staging.service');
 function config(){regular(join(source,'.env.production'));regular(secretPath);regular(unitPath);if(fs.readFileSync(unitPath).compare(fs.readFileSync(reviewedUnit)))fail('service_unit_changed');return {environment:digest(fs.readFileSync(join(source,'.env.production'))),secrets:digest(fs.readFileSync(secretPath)),unit:digest(fs.readFileSync(unitPath))};}
 function release(){regular(join(source,'.release.env'));return fs.readFileSync(join(source,'.release.env'),'utf8');}
 function save(r){const temp=receiptPath+'.'+randomBytes(8).toString('hex');try{fs.writeFileSync(temp,JSON.stringify(r),{mode:0o600,flag:'wx'});const fd=fs.openSync(temp,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(temp,receiptPath);const dir=fs.openSync(backup,'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}}finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}}
 if(action==='prepare'){
  directory(source);const before=release(),map=envMap(before);
  if(map.FANMIND_RELEASE_COMMIT!==env.EXPECTED_CURRENT_RELEASE||map.FANMIND_RUNTIME_ENVIRONMENT!=='staging'||readOperatorSessionState(before)!=='true'||!['true','false'].includes(map.FANMIND_STRIPE_BILLING_WRITE_FREEZE))fail('old_release_mismatch');
  regular(join(source,'.next','BUILD_ID'));const flags=config();
  invoke('systemctl',['is-active','--quiet','fanmind-staging.service']);await check(env.EXPECTED_CURRENT_RELEASE);
  privateDirectory(store);if(fs.existsSync(backup))fail('snapshot_already_exists');
  const initial=treeFingerprint(source),disk=fs.statfsSync(store);if(Number(disk.bavail)*Number(disk.bsize)<initial.bytes*1.2+100*1024**2)fail('snapshot_space_missing');
  privateDirectory(backup);privateDirectory(runtime);copyFiles(source,runtime);fs.chmodSync(runtime,0o700);
  const copied=treeFingerprint(runtime),after=treeFingerprint(source);
  if(initial.hash!==copied.hash||initial.hash!==after.hash||release()!==before||JSON.stringify(config())!==JSON.stringify(flags))fail('snapshot_changed');
  await check(env.EXPECTED_CURRENT_RELEASE);
  save({version:1,run,source:env.GITHUB_SHA,previous:env.EXPECTED_CURRENT_RELEASE,status:'ready',fingerprint:copied.hash,flags,stableRelease:stableRelease(before)});
  return 'SNAPSHOT_READY';
 }
 if(!fs.existsSync(receiptPath)){
  if(action==='restore'&&env.AUTOMATIC_FAILURE_RECOVERY==='true')return 'NO_SNAPSHOT_NO_RESTORE';
  fail('snapshot_missing');
 }
 directory(store,true);directory(backup,true);directory(runtime,true);const stat=regular(receiptPath);if((stat.mode&0o777)!==0o600||stat.uid!==process.getuid())fail('receipt_unsafe');
 const receipt=JSON.parse(fs.readFileSync(receiptPath,'utf8'));
 if(receipt.version!==1||receipt.run!==run||receipt.source!==env.GITHUB_SHA||receipt.previous!==env.EXPECTED_CURRENT_RELEASE||!['ready','accepted','restored'].includes(receipt.status))fail('receipt_binding');
 if(JSON.stringify(config())!==JSON.stringify(receipt.flags))fail('configuration_changed');
 if(treeFingerprint(runtime).hash!==receipt.fingerprint)fail('snapshot_corrupted');
 const live=release(),metadata=envMap(live);
 if(![receipt.previous,receipt.source].includes(metadata.FANMIND_RELEASE_COMMIT)||stableRelease(live)!==receipt.stableRelease)fail('release_state_changed');
 if(action==='accept'){
  if(metadata.FANMIND_RELEASE_COMMIT!==receipt.source)fail('new_release_missing');
  await check(receipt.source);save({...receipt,status:'accepted'});return 'RELEASE_ACCEPTED_SNAPSHOT_RETAINED';
 }
 // The backup excludes private configuration; restoration cannot overwrite it.
 // Shared database/provider/session state is never copied or restored.
 copyFiles(runtime,source);if(treeFingerprint(source).hash!==receipt.fingerprint)fail('restore_mismatch');
 invoke('sudo',['-n','systemctl','restart','fanmind-staging.service']);
 invoke('systemctl',['is-active','--quiet','fanmind-staging.service']);
 await waitProbe(check,receipt.previous);
 if(JSON.stringify(config())!==JSON.stringify(receipt.flags)||release()!==fs.readFileSync(join(runtime,'.release.env'),'utf8'))fail('restored_state_changed');
 save({...receipt,status:'restored'});return 'PREVIOUS_RELEASE_RESTORED';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 recoverRelease(process.argv[2],process.env).then(result=>console.log(`STAGING_RELEASE_RECOVERY=${result}`)).catch(error=>{console.error(`STAGING_RELEASE_RECOVERY_ERROR=${/^[a-z_]+$/u.test(error?.message??'')?error.message:'operation_failed'}`);process.exitCode=1;});
}
