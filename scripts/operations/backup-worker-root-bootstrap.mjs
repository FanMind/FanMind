#!/usr/bin/env node
import {constants} from 'node:fs';
import {open,lstat,realpath,mkdir,rename,unlink,rmdir,readFile,readdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';

export const SOURCE='e3cfbf73d2ed30b5a6ecd5ccfd3bff6aded0169f';
export const WORKER='8e5dcbdca844972fb2f133c188ecfee5d5252273';
export const APP='707d22702a784e3b9999d1c9ae9c1e11c096a1bc';
// Immutable source containing the independently tested 116/29 contract; the
// historical worker provenance remains in FILES and host inventory receipts.
export const INSPECT_SOURCE='690ab046d537d6cb910496302208e722054e0d80';
export const INSPECT_APP='bb799466d2c235195fedcb4d80568f9f0bd56969';
export const INSPECT_CONTRACT_SHA256='2a3203b46dd72d114c73ed006bbf637bffd2c9dcc46657493273fd62b90478bc';
// Historical #1515 INSTALLED receipt is a candidate, not a substitute for an
// actual root-owned preimage readback before a protected preparation.
export const EXPECTED_INSTALLED_PREIMAGE_SHA256='2f8e2d82f5f0eb2c070f22a7c035feaf1e4112a918853bea76b9fa769be8b441';
const ROOT='/var/lib/fanmind-backup-install',OPS='/usr/local/lib/fanmind-ops';
export const FILES=Object.freeze([
 ['scripts/operations/backup-worker-install-control.mjs',`${OPS}/backup-worker-install-control.mjs`,'db47a5bc6ccbba8bde7c6b9148596dbe4a33dfb58ff05545f749402f1a21021d',SOURCE],
 ['scripts/operations/backup-worker-install-policy.mjs',`${OPS}/backup-worker-install-policy.mjs`,'9737770d05650efb1424efa60eb9f9feff3ea61c5d58f3e092a798cb1ac8f8c9',SOURCE],
 ['ops/fanmind-backup-worker-control','/usr/local/sbin/fanmind-backup-worker-control','cd3d53e02f8997e8e9fa7dd89d182bb18a75f28cd5d1387e338a7e9455c41306',SOURCE],
 ['scripts/operations/database-authorization-contract.mjs',`${ROOT}/bundles/${WORKER}/database-authorization-contract.mjs`,'b80490c17270a830dc409fc4d3755224e23facdc23a6f4ee34fb28189f7544de',WORKER],
 ['scripts/operations/verify-backup-artifact.mjs',`${ROOT}/bundles/${WORKER}/verify-backup-artifact.mjs`,'ded9bf771c8111056c9fbb1b0e4d1dbc81b467b0f233031687dcade05f5b44af',WORKER],
 ['scripts/operations/backup-worker.mjs',`${ROOT}/bundles/${WORKER}/backup-worker.mjs`,'71afff4a985f29f0cf235aee5686ed0760bbac0f74bb2ecc1fc7f13977c928d1',WORKER],
]);
const UNIT='/etc/systemd/system/fanmind-backup-worker.service';
const RELEASE='/etc/fanmind-backup/release.env';
const OLD=['database-authorization-contract.mjs','verify-backup-artifact.mjs','backup-worker.mjs'];
const ENV={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'};
export function sha(bytes){return createHash('sha256').update(bytes).digest('hex');}
function fail(code){throw Object.assign(new Error(code),{code});}
export function input(action,controller,runnerUid){
 if(!['inspect','bootstrap','prepare-contract-repair','update-prepared-controllers'].includes(action)||!/^[a-f0-9]{40}$/.test(controller??'')||!Number.isSafeInteger(runnerUid)||runnerUid<=0)fail('invocation_invalid');
 return {action,controller,runnerUid};
}
export function metadata(s,mode){
 if(!s.isFile()||s.uid!==0||s.gid!==0||s.nlink!==1||(s.mode&0o777)!==mode||s.size<1||s.size>2*1024*1024)fail('file_untrusted');
}
async function directory(path){for(let p=path;;p=dirname(p)){const s=await lstat(p);if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==0||s.gid!==0||(s.mode&0o022)||await realpath(p)!==p)fail('directory_untrusted');if(p==='/')break;}}
async function bytes(path,mode){await directory(dirname(path));const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const a=await f.stat();metadata(a,mode);const b=await f.readFile(),z=await f.stat();if(a.ino!==z.ino||a.dev!==z.dev||a.size!==z.size||a.mtimeMs!==z.mtimeMs||a.ctimeMs!==z.ctimeMs||b.length!==a.size)fail('file_changed');return b;}finally{await f.close();}}
async function absent(path){try{await lstat(path);fail('existing_bootstrap_state');}catch(e){if(e.code!=='ENOENT')throw e;}}
async function flush(path){const f=await open(path,constants.O_RDONLY);try{await f.sync();}finally{await f.close();}}
export async function create(path,data,mode,onCreated=()=>{}){await directory(dirname(path));const f=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,mode);try{onCreated(path);await f.writeFile(data);await f.chmod(mode);metadata(await f.stat(),mode);await f.sync();}finally{await f.close();}await flush(dirname(path));}
async function make(path){try{await mkdir(path,{mode:0o700});await flush(dirname(path));}catch(e){if(e.code!=='EEXIST')throw e;}await directory(path);const s=await lstat(path);if((s.mode&0o777)!==0o700)fail('private_directory_invalid');}
function command(bin,args,timeout=30000){const r=spawnSync(bin,args,{env:ENV,encoding:'utf8',timeout,maxBuffer:65536});if(r.error||r.status!==0)fail('host_command_failed');return r.stdout.trim();}
async function version(expectedApp=APP){const r=await fetch('https://fanmind.ch/api/version',{redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)fail('live_probe_failed');const text=await r.text();if(text.length>4096)fail('live_probe_failed');const j=JSON.parse(text);if(j.application!=='fanmind'||j.runtimeEnvironment!=='production'||j.releaseCommit!==expectedApp)fail('live_app_changed');}
async function inventory(request,expectedApp=APP){
 await directory(OPS);await directory('/usr/local/sbin');await directory('/etc/fanmind-backup');await directory('/var/lib');
 const previousHashes={};for(const name of OLD)previousHashes[name]=sha(await bytes(`${OPS}/${name}`,0o750));
 const release=await bytes(RELEASE,0o600);if(release.toString()!==`FANMIND_RELEASE_COMMIT=${expectedApp}\n`)fail('release_binding_invalid');
 const unit=await bytes(UNIT,0o644);const configStat=await lstat('/etc/fanmind-backup/worker.env');metadata(configStat,0o600);if(configStat.isSymbolicLink())fail('file_untrusted');
 const props=command('/usr/bin/systemctl',['show','fanmind-backup-worker.service','--property=FragmentPath,DropInPaths,WorkingDirectory,ExecStart,ActiveState,MainPID']);
 const p=Object.fromEntries(props.split('\n').map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)];}));
 if(p.FragmentPath!==UNIT||p.DropInPaths!==''||p.WorkingDirectory!==OPS||p.ActiveState!=='active'||!p.ExecStart?.startsWith('{ path=/usr/bin/node ;')||!p.ExecStart.includes(`argv[]=/usr/bin/node ${OPS}/backup-worker.mjs ;`))fail('unit_binding_invalid');
 if(!/^[1-9][0-9]*$/.test(p.MainPID))fail('unit_binding_invalid');
 const argv=await readFile(`/proc/${p.MainPID}/cmdline`);if(!argv.equals(Buffer.from(`/usr/bin/node\0${OPS}/backup-worker.mjs\0`)))fail('unit_binding_invalid');
 command('/usr/bin/systemd-analyze',['verify',UNIT]);await version(expectedApp);
 return {schemaVersion:1,controllerCommit:request.controller,controllerProgramSource:SOURCE,workerCommit:WORKER,applicationCommit:APP,runnerUid:request.runnerUid,workerPid:Number(p.MainPID),workerArgvHash:sha(argv),unitHash:sha(unit),releaseHash:sha(release),previousHashes,observedAt:new Date().toISOString()};
}
async function download([path,,hash,commit]){const r=await fetch(`https://raw.githubusercontent.com/FanMind/FanMind/${commit}/${path}`,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)fail('source_fetch_failed');const b=Buffer.from(await r.arrayBuffer());if(!b.length||b.length>2*1024*1024||sha(b)!==hash)fail('source_hash_invalid');return b;}
async function database(content,restrictedCount=13){
 const policy=await import('data:text/javascript;base64,'+content[1].toString('base64'));
 const contract=await import('data:text/javascript;base64,'+content[3].toString('base64'));
 const configBytes=await bytes('/etc/fanmind-backup/worker.env',0o600);
 const config=policy.parseSelectedEnvironment(configBytes.toString());configBytes.fill(0);
 const connection=policy.connection(config);
 let pass,ca,privatePath;const owned=[];
 try{
  pass=await bytes(config.FANMIND_BACKUP_PGPASSFILE,0o600);ca=await bytes(config.FANMIND_BACKUP_DB_CA_CERT_PATH,0o644);
  const passHash=sha(pass),caHash=sha(ca);
  await directory('/run');const candidate=`/run/.fanmind-bootstrap-${randomUUID()}`;
  await mkdir(candidate,{mode:0o700});privatePath=candidate;await directory(privatePath);
  for(const [name,data]of [['pgpass',pass],['ca.pem',ca]]){const path=`${privatePath}/${name}`;await create(path,data,0o600,path=>owned.push(path));}
  pass.fill(0);ca.fill(0);
  const env={...ENV,PGPASSFILE:`${privatePath}/pgpass`,PGSSLROOTCERT:`${privatePath}/ca.pem`,PGSSLMODE:'verify-full',PGGSSENCMODE:'disable',PGCONNECT_TIMEOUT:'10'};
  const c=await contract.captureDatabaseAuthorizationContract({psqlBin:'/usr/lib/postgresql/17/bin/psql',...connection,env});
  if(c.restrictedSecurityDefinerFunctionCount!==restrictedCount||
      (restrictedCount===29&&c.coreTableAppGrantTupleCount!==116))fail('current_contract_required');
  const r=spawnSync('/usr/lib/postgresql/17/bin/psql',['--no-psqlrc','--no-password','--quiet','--tuples-only','--no-align','--set=ON_ERROR_STOP=1','--host',connection.host,'--port',connection.port,'--username',connection.username,'--dbname',connection.database],{env,input:policy.BACKUP_ACTIVE_JOBS_SQL,encoding:'utf8',timeout:30000,maxBuffer:4096});
  if(r.error||r.status!==0||r.stdout.trim()!=='0')fail('backup_jobs_active');
  const afterPass=await bytes(config.FANMIND_BACKUP_PGPASSFILE,0o600);try{if(sha(afterPass)!==passHash||sha(await bytes(config.FANMIND_BACKUP_DB_CA_CERT_PATH,0o644))!==caHash)fail('connection_changed');}finally{afterPass.fill(0);}
 }finally{
  pass?.fill(0);ca?.fill(0);
  if(privatePath){for(const path of owned)await unlink(path);await rmdir(privatePath);}
 }

}
// Inspection never installs a controller, creates an authorization/receipt or
// changes a service. Unknown bytes are measured, never executed or approved.
async function optionalHash(path,mode){
 try{return {state:'present',sha256:sha(await bytes(path,mode))};}
 catch(e){if(e.code==='ENOENT')return {state:'absent'};throw e;}
}
export function lockHeld(text,dev,ino){
 const major=((dev>>8n)&0xfffn)|((dev>>32n)&0xfffff000n);
 const minor=(dev&0xffn)|((dev>>12n)&0xffffff00n);
 return text.split('\n').some(line=>{
  const match=line.match(/\s([a-f0-9]+):([a-f0-9]+):([0-9]+)\s/iu);
  return match&&BigInt(`0x${match[1]}`)===major&&BigInt(`0x${match[2]}`)===minor&&BigInt(match[3])===ino;
 });
}
export function lockDirectoryMetadata(s){
 if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==0||s.gid!==0||
    ((s.mode&0o022)!==0&&(s.mode&0o7777)!==0o1777))fail('lock_directory_untrusted');
}
async function lockState(){
 const path='/run/lock/fanmind-backup-worker-install.lock';await directory('/run');
 lockDirectoryMetadata(await lstat(dirname(path)));if(await realpath(dirname(path))!==dirname(path))fail('lock_directory_untrusted');
 let f;try{
  f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);const a=await f.stat({bigint:true});
  if(!a.isFile()||a.uid!==0n||a.gid!==0n||a.nlink!==1n||(a.mode&0o022n))fail('lock_untrusted');
  const locks=await readFile('/proc/locks','utf8');if(locks.length>1024*1024)fail('lock_inventory_invalid');
  const b=await f.stat({bigint:true});if(a.ino!==b.ino||a.dev!==b.dev||a.ctimeNs!==b.ctimeNs)fail('inventory_changed');
  return {state:'present',held:lockHeld(locks,a.dev,a.ino)};
 }catch(e){if(e.code==='ENOENT')return {state:'absent'};throw e;}finally{await f?.close();}
}
const ACTIVE_TOOLS=Object.freeze(['pg_dump','pg_restore','rclone','age','tar']);
async function processCounts(){
 const names=await readdir('/proc');if(names.length>16384)fail('process_inventory_invalid');
 const counts=Object.fromEntries(ACTIVE_TOOLS.map(name=>[name,0]));
 for(const pid of names.filter(x=>/^[1-9][0-9]*$/u.test(x))){
  try{const name=(await readFile(`/proc/${pid}/comm`,'utf8')).trim();if(Object.hasOwn(counts,name))counts[name]++;}
  catch(e){if(e.code!=='ENOENT'&&e.code!=='ESRCH')throw e;}
 }return counts;
}
export function timerState(raw){
 const pairs=raw.split('\n').filter(Boolean).map(line=>{const i=line.indexOf('=');if(i<1)fail('timer_inventory_invalid');return [line.slice(0,i),line.slice(i+1)];});
 if(new Set(pairs.map(([key])=>key)).size!==pairs.length||pairs.some(([key])=>!['ActiveState','UnitFileState','NextElapseUSecRealtime','NextElapseUSecMonotonic','LastTriggerUSec'].includes(key)))fail('timer_inventory_invalid');
 const entries=Object.fromEntries(pairs);
 if(!['active','inactive','failed','activating','deactivating'].includes(entries.ActiveState)||
    !['enabled','disabled','static','masked','enabled-runtime','masked-runtime'].includes(entries.UnitFileState))fail('timer_inventory_invalid');
 return {activeState:entries.ActiveState,unitFileState:entries.UnitFileState,
  scheduleSha256:sha(Buffer.from(raw))};
}
async function extraInventory(){
 const controllers={};for(const [name,path]of [
  ['control',`${OPS}/backup-worker-install-control.mjs`],['policy',`${OPS}/backup-worker-install-policy.mjs`],
  ['wrapper','/usr/local/sbin/fanmind-backup-worker-control']])controllers[name]=await optionalHash(path,0o750);
 const authorization=await optionalHash(`${ROOT}/authorization.json`,0o600);
 const copyPath=`${ROOT}/contract-repair/c58cf0fc95deccfac60a78dad3805ed049e7d94f/database-authorization-contract.mjs`;
 let preparedCopy;
 try {
  const saved=await bytes(copyPath,0o600);
  const current=await bytes(`${OPS}/database-authorization-contract.mjs`,0o750);
  preparedCopy={state:'present',sha256:sha(saved),matchesInstalledBytes:saved.equals(current)};
 } catch(e) {if(e.code!=='ENOENT')throw e;preparedCopy={state:'absent'};}
 const bootstrapReceipt=await optionalHash(`${ROOT}/bootstrap-receipt.json`,0o600);
 const rollback=[];
 const root=`${ROOT}/rollback`;let rollbackPresent=true;
 try{await directory(root);}catch(e){if(e.code!=='ENOENT')throw e;rollbackPresent=false;}
 if(rollbackPresent){
  const names=await readdir(root);
  if(names.length>32||names.some(n=>!/^[a-f0-9]{40}$/u.test(n)))fail('rollback_inventory_invalid');
  for(const commit of names.sort()){
   const dir=`${root}/${commit}`;await directory(dir);const files={};
   for(const name of [...OLD,'release.env','receipt.json'])files[name]=await optionalHash(`${dir}/${name}`,0o600);
   rollback.push({commit,files});
  }
 }
 const timers={};for(const kind of ['database','full','storage','server_config']){
  const name=`fanmind-backup-${kind}.timer`;
  timers[kind]=timerState(command('/usr/bin/systemctl',['show',name,'--property=ActiveState,UnitFileState,NextElapseUSecRealtime,NextElapseUSecMonotonic,LastTriggerUSec']));
 }
 const workerBytes=await bytes(`${OPS}/backup-worker.mjs`,0o750);
 const workerVersion=workerBytes.toString().match(/const VERSION = '(phase5-backup-worker-[1-9][0-9]{0,2})';/u)?.[1]??'unverified';
 return {controllers,authorization,bootstrapReceipt,preparedCopy,rollbackDirectoryPresent:rollbackPresent,rollback,timers,installedWorkerVersion:workerVersion,lock:await lockState(),activeTools:await processCounts()};
}
export async function inspectCurrent(request,io){
 // No historical install permission is inferred from a successful inspection.
 input(request.action,request.controller,request.runnerUid);if(request.action!=='inspect')fail('invocation_invalid');
 let databaseContractVerified=true;
 try{await io.database();}catch{databaseContractVerified=false;}
 const before=await io.inventory();const extra=await io.extra();const after=await io.inventory();const extraAfter=await io.extra();
 if(before.unitHash!==after.unitHash||before.releaseHash!==after.releaseHash||before.workerPid!==after.workerPid||before.workerArgvHash!==after.workerArgvHash||
    JSON.stringify(before.previousHashes)!==JSON.stringify(after.previousHashes))fail('inventory_changed');
 for(const key of ['controllers','authorization','bootstrapReceipt','preparedCopy','rollbackDirectoryPresent','rollback','installedWorkerVersion'])
  if(JSON.stringify(extra[key])!==JSON.stringify(extraAfter[key]))fail('inventory_changed');
 return {schemaVersion:1,operation:'inspection_only',controllerCommit:request.controller,
  reviewedContractSource:INSPECT_SOURCE,reviewedContractSha256:INSPECT_CONTRACT_SHA256,
  expectedApplicationCommit:INSPECT_APP,installedWorkerHashes:before.previousHashes,
  unitHash:before.unitHash,releaseHash:before.releaseHash,workerPid:before.workerPid,
  workerArgvHash:before.workerArgvHash,...extra,databaseContractVerified,
  observedAt:new Date().toISOString(),hostWorkloadExclusivityVerified:false,installationAuthorized:false};
}
async function currentInspection(request){
 // Reuse the existing verified policy, frozen private connection and exact
 // source-backed 39/29 contract. No installed module is imported as root.
 const content=[];content[1]=await download(FILES[1]);
 content[3]=await download(['scripts/operations/database-authorization-contract.mjs','',INSPECT_CONTRACT_SHA256,INSPECT_SOURCE]);
 const result=await inspectCurrent(request,{database:()=>database(content,29),
  inventory:()=>inventory(request,INSPECT_APP),extra:extraInventory});
 console.log(`BACKUP_CURRENT_HOST_INVENTORY=${JSON.stringify(result)}`);
 if(!result.databaseContractVerified)process.exitCode=1;
}
// Exact existing controller upgrade; no service/worker/DB mutation in preparation.
export const REPAIR_CONTROL_HASHES=Object.freeze({
 'backup-worker-install-control.mjs':'a37e7304be60702e59fb251824dbdd9eded52e516908a0904d3a4062f131d25d',
 'backup-worker-install-policy.mjs':'d6cb694b920bbbc60d4ebd1f6f1ea10985a2ae1c18f9809a9c0d28ad8170d46b',
 'fanmind-backup-worker-control':'cd3d53e02f8997e8e9fa7dd89d182bb18a75f28cd5d1387e338a7e9455c41306',
});
// Separately evidenced post-bootstrap, pre-repair controller generation. The
// immutable FILES manifest retains original bootstrap provenance only.
// All actual root-owned controller bytes must be re-read and compared to these
// exact candidates before any snapshot, replacement or rollback.
export const OBSERVED_CONTROL_HASHES=Object.freeze({
 'backup-worker-install-control.mjs':'0a6e78430ad353136c1091f7160f05c9b5208f89dca55a2843e2987a922437db',
 'backup-worker-install-policy.mjs':'5f8eacb558f45bad8901b30cfb58ee50de39d2311decef6da71dd3b180ade416',
 'fanmind-backup-worker-control':'cd3d53e02f8997e8e9fa7dd89d182bb18a75f28cd5d1387e338a7e9455c41306',
});
export function repairInventory(value,expectedControllers=OBSERVED_CONTROL_HASHES){
 if(value.expectedApplicationCommit!==INSPECT_APP||value.databaseContractVerified!==true||
    value.unitHash!=='ae4a16dea717bc407274c1623e9dc5fd1aa9f67c0dcd41465bffa9dba3a50896'||
    value.releaseHash!=='93cf1b697a3140e286c40ea8b020b44955cb9978518de00f958deea6aec214a7'||
    Object.keys(value.installedWorkerHashes??{}).sort().join('|')!==OLD.slice().sort().join('|')||
    FILES.slice(3).some(([,dest,hash],index)=>value.installedWorkerHashes[dest.split('/').at(-1)]!==(index===0?EXPECTED_INSTALLED_PREIMAGE_SHA256:hash))||
    Object.entries(expectedControllers).some(([key,hash])=>value.controllers?.[key==='backup-worker-install-control.mjs'?'control':key==='backup-worker-install-policy.mjs'?'policy':'wrapper']?.sha256!==hash)||
    value.lock?.state!=='present'||value.lock.held!==true||
    Object.keys(value.activeTools??{}).sort().join('|')!==ACTIVE_TOOLS.slice().sort().join('|')||
    Object.values(value.activeTools).some(x=>x!==0)||
    Object.keys(value.timers??{}).sort().join('|')!=='database|full|server_config|storage'||
    Object.values(value.timers).some(x=>x.activeState!=='active'||x.unitFileState!=='enabled'))fail('repair_inventory_changed');
}
async function replaceControl(path,data,mode=0o750){
 const temp=`${dirname(path)}/.contract-repair-${randomUUID()}`;
 try{await create(temp,data,mode);await rename(temp,path);await flush(dirname(path));}
 finally{try{await unlink(temp);}catch(e){if(e.code!=='ENOENT')throw e;}}
}
export async function repairPreparation(io){
 await io.preflight();
 await io.snapshot(); // actual old module/controller/auth bytes, fsynced and read back
 await io.stage();
 await io.preflight(); // no controller replaced yet; reject queue/target/config drift
 await io.persist('PREPARED');
 try{
  await io.replaceControllers();
  await io.verifyControllers();
  await io.authorize(); // exact new hashes + module-only scope, fresh TTL
  await io.persist('COMPLETED');
 }catch{
  await io.persist('RECONCILIATION_REQUIRED');
  try{await io.recoverPreparation();await io.persist('ROLLED_BACK');}
  catch{fail('repair_preparation_reconciliation_required');}
  // No worker/module/service mutation occurred; preparation is consumed.
  throw Object.assign(new Error('repair_preparation_failed'),{code:'repair_preparation_failed'});
 }
 return 'PREPARED_NOT_INSTALLED';
}
async function prepareContractRepair(request){
 const dir=`${ROOT}/contract-repair/${request.controller}`;
 const bundle=`${ROOT}/bundles/${INSPECT_SOURCE}`;
 const controls=FILES.slice(0,3).map(([path,dest])=>
  [path,dest,OBSERVED_CONTROL_HASHES[dest.split('/').at(-1)]]);
 const replacements=[];
 for(const [path,dest]of controls){
  const hash=REPAIR_CONTROL_HASHES[dest.split('/').at(-1)];
  replacements.push(await download([path,dest,hash,request.controller]));
 }
 const moduleBytes=await download(['scripts/operations/database-authorization-contract.mjs','',INSPECT_CONTRACT_SHA256,INSPECT_SOURCE]);
 const content=[];content[1]=await download(FILES[1]);content[3]=moduleBytes;
 let measured;
 const preflight=async()=>{
  const observed=await inspectCurrent({...request,action:'inspect'},{database:()=>database(content,29),
   inventory:()=>inventory(request,INSPECT_APP),extra:extraInventory});
  repairInventory(observed);measured=observed;
 };
 const savedPaths=[...controls.map(([,dest])=>dest),`${ROOT}/authorization.json`,`${OPS}/database-authorization-contract.mjs`,RELEASE];
 let receipt,newAuthorizationHash;
 const persist=async status=>{
  const next={...receipt,status,updatedAt:new Date().toISOString()};
  const target=`${dir}/receipt.json`,temp=`${dir}/.receipt-${randomUUID()}`;
  try{await create(temp,Buffer.from(JSON.stringify(next)),0o600);await rename(temp,target);await flush(dir);receipt=next;}
  finally{try{await unlink(temp);}catch(e){if(e.code!=='ENOENT')throw e;}}
 };
 const result=await repairPreparation({preflight,
  snapshot:async()=>{
   await directory(ROOT);await absent(dir);await absent(bundle);
   await make(`${ROOT}/contract-repair`);await make(dir);
   const hashes={};
   for(const path of savedPaths){
    const mode=path===RELEASE||path.endsWith('/authorization.json')?0o600:0o750;
    const data=await bytes(path,mode);const name=path.split('/').at(-1);
    await create(`${dir}/${name}`,data,0o600);
    if(sha(await bytes(`${dir}/${name}`,0o600))!==sha(data))fail('repair_snapshot_invalid');
    hashes[name]=sha(data);
   }
   if(controls.some(([,dest,hash])=>hashes[dest.split('/').at(-1)]!==hash)||
      controls.some(([,dest,hash])=>hashes[dest.split('/').at(-1)]!==measured.controllers[dest.endsWith('/fanmind-backup-worker-control')?'wrapper':dest.endsWith('/backup-worker-install-control.mjs')?'control':'policy'].sha256)||
      hashes['database-authorization-contract.mjs']!==EXPECTED_INSTALLED_PREIMAGE_SHA256||
       hashes['database-authorization-contract.mjs']!==measured.installedWorkerHashes['database-authorization-contract.mjs']||
       hashes['release.env']!==measured.releaseHash)fail('repair_snapshot_invalid');
   receipt={schemaVersion:1,operation:'contract_repair_preparation',controllerCommit:request.controller,
    workerCommit:INSPECT_SOURCE,applicationCommit:INSPECT_APP,previousHashes:hashes,newControllerHashes:REPAIR_CONTROL_HASHES,
    moduleSha256:INSPECT_CONTRACT_SHA256,unitHash:measured.unitHash,releaseHash:measured.releaseHash,createdAt:new Date().toISOString()};
   await persist('SNAPSHOT_SAVED');
  },
  stage:async()=>{await make(bundle);await create(`${bundle}/database-authorization-contract.mjs`,moduleBytes,0o750);},
  persist,
  replaceControllers:async()=>{
   for(let i=0;i<controls.length;i++){
    const [,dest,oldHash]=controls[i];
    if(sha(await bytes(dest,0o750))!==oldHash)fail('repair_inventory_changed');
    if(sha(replacements[i])!==oldHash)await replaceControl(dest,replacements[i]);
   }
  },
  verifyControllers:async()=>{
   for(const [,dest]of controls)if(sha(await bytes(dest,0o750))!==REPAIR_CONTROL_HASHES[dest.split('/').at(-1)])fail('repair_controller_invalid');
   for(const name of OLD)if(sha(await bytes(`${OPS}/${name}`,0o750))!==measured.installedWorkerHashes[name])fail('repair_worker_changed');
   if(sha(await bytes(RELEASE,0o600))!==measured.releaseHash)fail('repair_worker_changed');
  },
  recoverPreparation:async()=>{
   for(const [,dest,hash]of controls){
    const name=dest.split('/').at(-1),data=await bytes(`${dir}/${name}`,0o600);
    if(sha(data)!==hash)fail('repair_snapshot_invalid');
    const current=sha(await bytes(dest,0o750));
    if(current!==hash&&current!==REPAIR_CONTROL_HASHES[name])fail('repair_inventory_changed');
    if(current!==hash)await replaceControl(dest,data);
   }
   const target=`${ROOT}/authorization.json`,saved=await bytes(`${dir}/authorization.json`,0o600);
   if(sha(saved)!==receipt.previousHashes['authorization.json'])fail('repair_snapshot_invalid');
   const current=sha(await bytes(target,0o600));
   if(current!==sha(saved)&&current!==newAuthorizationHash)fail('repair_inventory_changed');
   if(current!==sha(saved)){
    const temp=`${ROOT}/.repair-recovery-${randomUUID()}`;
    try{await create(temp,saved,0o600);await rename(temp,target);await flush(ROOT);}
    finally{try{await unlink(temp);}catch(e){if(e.code!=='ENOENT')throw e;}}
   }
   for(const name of OLD)if(sha(await bytes(`${OPS}/${name}`,0o750))!==measured.installedWorkerHashes[name])fail('repair_worker_changed');
  },
  authorize:async()=>{
   const now=new Date();
   const auth={schemaVersion:1,repository:'FanMind/FanMind',environment:'backup-production-recovery',project:'drqkpdvtbbrrdwmtrodz',
    controllerCommit:request.controller,workerCommit:INSPECT_SOURCE,applicationCommit:INSPECT_APP,reviewerId:270165082,
    adminBypassDisabled:true,actions:['verify','install','rollback'],approvedAt:now.toISOString(),expiresAt:new Date(+now+2*3600000).toISOString(),
    unitHash:measured.unitHash,releaseHash:measured.releaseHash,controllerHashes:REPAIR_CONTROL_HASHES,
    previousHashes:{'database-authorization-contract.mjs':measured.installedWorkerHashes['database-authorization-contract.mjs']}};
   // Refuse rotation/unknown authorization between snapshot and replacement.
   if(sha(await bytes(`${ROOT}/authorization.json`,0o600))!==receipt.previousHashes['authorization.json'])fail('repair_inventory_changed');
   const target=`${ROOT}/authorization.json`,temp=`${ROOT}/.repair-authorization-${randomUUID()}`;
   const authBytes=Buffer.from(JSON.stringify(auth));newAuthorizationHash=sha(authBytes);
   try{await create(temp,authBytes,0o600);await rename(temp,target);await flush(ROOT);}
   finally{try{await unlink(temp);}catch(e){if(e.code!=='ENOENT')throw e;}}
  },
 });
 console.log(`BACKUP_CONTRACT_REPAIR=${result}`);
}
const ORIGINAL_PREPARATION='c58cf0fc95deccfac60a78dad3805ed049e7d94f';
const PREPARED_AUTH_HASH='3a3b8741477b60659b3f4379398edf0c1c9384f05a70053c325b016830dfa338';
const PREPARED_CONTROL_HASHES=Object.freeze({
 'backup-worker-install-control.mjs':'aca8951b2a4751fdc9dfa58254814eb5feeeaf30b8dd99b9f436fd0695d80f8a',
 'backup-worker-install-policy.mjs':'5623572e5433a121c692e45d9dc2d757bf66688557ab9d984ed35b9e4dda66e6',
 'fanmind-backup-worker-control':REPAIR_CONTROL_HASHES['fanmind-backup-worker-control'],
});

// Reconcile only from the completed, private snapshot of this exact update.
// Check every participant before writing any old bytes. Restore authorization
// first so the new installer cannot run against a partially restored policy.
export async function restoreControllerUpdate(items,read,replace){
 const states=[];
 for(const item of items){
  const data=await read(item);
  if(!data.equals(item.old)&&!data.equals(item.next))fail('update_unknown_bytes');
  states.push(data);
 }
 for(let i=items.length-1;i>=0;i--){
  const item=items[i];
  if(!(await read(item)).equals(states[i]))fail('update_unknown_bytes');
  if(!states[i].equals(item.old))await replace(item,item.old);
  if(!(await read(item)).equals(item.old))fail('update_readback_invalid');
 }
}
export async function applyControllerUpdate(items,read,replace,complete){
 try{
  for(const item of items){
   if(!(await read(item)).equals(item.old))fail('update_unknown_bytes');
   await replace(item,item.next);
   if(!(await read(item)).equals(item.next))fail('update_readback_invalid');
  }
  for(const item of items)if(!(await read(item)).equals(item.next))fail('update_readback_invalid');
  await complete();
 }catch(e){
  await restoreControllerUpdate(items,read,replace);
  throw e;
 }
}

async function updatePreparedControllers(request){
 const controls=FILES.slice(0,2);
 const preparedDir=`${ROOT}/contract-repair/${ORIGINAL_PREPARATION}`;
 const updateParent=`${ROOT}/controller-update`,dir=`${updateParent}/${request.controller}`;
 const authPath=`${ROOT}/authorization.json`;
 const receipt=JSON.parse(await bytes(`${preparedDir}/receipt.json`,0o600));
 const modulePath='database-authorization-contract.mjs';
 const oldModule=await bytes(`${preparedDir}/${modulePath}`,0o600);
 if(receipt.status!=='COMPLETED'||receipt.operation!=='contract_repair_preparation'||
    receipt.controllerCommit!==ORIGINAL_PREPARATION||receipt.workerCommit!==INSPECT_SOURCE||
    receipt.applicationCommit!==INSPECT_APP||receipt.moduleSha256!==INSPECT_CONTRACT_SHA256||
    receipt.previousHashes?.[modulePath]!==EXPECTED_INSTALLED_PREIMAGE_SHA256||
    sha(oldModule)!==EXPECTED_INSTALLED_PREIMAGE_SHA256||
    Object.entries(PREPARED_CONTROL_HASHES).some(([k,v])=>receipt.newControllerHashes?.[k]!==v))fail('update_preparation_invalid');
 const staged=await Promise.all(controls.map(([path,dest])=>
  download([path,dest,REPAIR_CONTROL_HASHES[dest.split('/').at(-1)],request.controller])));
 const bundle=await bytes(`${ROOT}/bundles/${INSPECT_SOURCE}/${modulePath}`,0o750);
 if(sha(bundle)!==INSPECT_CONTRACT_SHA256)fail('update_bundle_invalid');
 const policy=await download(FILES[1]);
 const preflight=async()=>{
  await absent(`${ROOT}/rollback/${INSPECT_SOURCE}`);
  const state=await inspectCurrent({...request,action:'inspect'},{database:()=>database([null,policy,null,bundle],29),
   inventory:()=>inventory(request,INSPECT_APP),extra:extraInventory});
  if(!state.preparedCopy?.matchesInstalledBytes||!oldModule.equals(await bytes(`${OPS}/${modulePath}`,0o750)))fail('update_preimage_invalid');
  // On recovery each of the two replaceable controllers is checked against
  // the individually journalled old/new bytes before any restoration.
  const measured={...PREPARED_CONTROL_HASHES};
  for(const [i,[,dest]]of controls.entries()){
   const name=dest.split('/').at(-1),hash=state.controllers[i===0?'control':'policy']?.sha256;
   if(hash!==PREPARED_CONTROL_HASHES[name]&&hash!==REPAIR_CONTROL_HASHES[name])fail('update_unknown_bytes');
   measured[name]=hash;
  }
  repairInventory(state,measured);
 };
 await preflight();
 const prior=await optionalHash(`${dir}/READY`,0o600);
 const recovering=prior.state==='present';
 if(recovering){
  if(prior.sha256!==sha(Buffer.from(request.controller)))fail('update_journal_invalid');
  await absent(`${dir}/COMPLETED`);await absent(`${dir}/ROLLED_BACK`);
 }else{
  await make(updateParent);await mkdir(dir,{mode:0o700});await flush(updateParent);
 }
 const items=[];
 for(const [i,[,dest]]of controls.entries()){
  const name=dest.split('/').at(-1),old=await bytes(recovering?`${dir}/${name}`:dest,recovering?0o600:0o750);
  if(sha(old)!==PREPARED_CONTROL_HASHES[name])fail('update_preimage_invalid');
  items.push({name,dest,mode:0o750,old,next:staged[i]});
 }
 const old=await bytes(recovering?`${dir}/authorization.json`:authPath,0o600);
 if(sha(old)!==PREPARED_AUTH_HASH)fail('update_authorization_changed');
 const auth=JSON.parse(old);
 const now=recovering?JSON.parse(await bytes(`${dir}/next-authorization.json`,0o600)).approvedAt:new Date().toISOString();
 const next=Buffer.from(JSON.stringify({...auth,controllerCommit:request.controller,preparationCommit:ORIGINAL_PREPARATION,
  controllerHashes:REPAIR_CONTROL_HASHES,approvedAt:now,expiresAt:new Date(Date.parse(now)+7200000).toISOString()}));
 items.push({name:'authorization.json',dest:authPath,mode:0o600,old,next});
 const read=item=>bytes(item.dest,item.mode);
 const replace=(item,data)=>replaceControl(item.dest,data,item.mode);
 const mark=name=>create(`${dir}/${name}`,Buffer.from(request.controller),0o600);
 if(recovering){
  if(!(await bytes(`${dir}/next-authorization.json`,0o600)).equals(next))fail('update_journal_invalid');
  await restoreControllerUpdate(items,read,replace);await mark('ROLLED_BACK');
  fail('update_rolled_back');
 }
 for(const item of items){
  await create(`${dir}/${item.name}`,item.old,0o600);
  if(!(await bytes(`${dir}/${item.name}`,0o600)).equals(item.old))fail('update_snapshot_invalid');
 }
 await create(`${dir}/next-authorization.json`,next,0o600);
 if(!(await bytes(`${dir}/next-authorization.json`,0o600)).equals(next))fail('update_snapshot_invalid');
 await preflight();await mark('READY');
 await applyControllerUpdate(items,read,replace,()=>mark('COMPLETED'));
 console.log('BACKUP_CONTROLLER_UPDATE=COMPLETED');
}

async function main(){
 if(process.getuid?.()!==0||process.argv.length!==5)fail('invocation_invalid');
 const request=input(process.argv[2],process.argv[3],Number(process.argv[4]));
 if(request.action==='inspect'){await currentInspection(request);return;}
 if(request.action==='update-prepared-controllers'){await updatePreparedControllers(request);return;}
 if(request.action==='prepare-contract-repair'){await prepareContractRepair(request);return;}
 const content=[];for(const item of FILES)content.push(await download(item));await database(content);const before=await inventory(request);
 // No existing authorization, controller, receipt or bundle is overwritten.
 for(const [,dest]of FILES)await absent(dest);await absent(`${ROOT}/authorization.json`);await absent(`${ROOT}/bootstrap-receipt.json`);
 try{await lstat(ROOT);await directory(ROOT);}catch(e){if(e.code!=='ENOENT')throw e;}
 await database(content);const after=await inventory(request);if(after.unitHash!==before.unitHash||after.releaseHash!==before.releaseHash||JSON.stringify(after.previousHashes)!==JSON.stringify(before.previousHashes))fail('inventory_changed');
 // Persistent receipts make partial bootstrap a reconciliation boundary.
 await make(ROOT);await make(`${ROOT}/bundles`);await make(`${ROOT}/bundles/${WORKER}`);await make(`${ROOT}/rollback`);
 const receipt={...before,status:'PREPARED',bootstrapAt:new Date().toISOString()};
 await create(`${ROOT}/bootstrap-receipt.json`,Buffer.from(JSON.stringify(receipt)),0o600);
 for(let i=0;i<FILES.length;i++){await create(FILES[i][1],content[i],0o750);if(sha(await bytes(FILES[i][1],0o750))!==FILES[i][2])fail('copied_hash_invalid');}
 for(const [,dest]of FILES.filter(x=>x[0].endsWith('.mjs')))command('/usr/bin/node',['--check',dest]);
 const approvedAt=new Date(),expiresAt=new Date(approvedAt.getTime()+2*3600*1000);
 const authorization={schemaVersion:1,repository:'FanMind/FanMind',environment:'backup-production-recovery',project:'drqkpdvtbbrrdwmtrodz',controllerCommit:request.controller,workerCommit:WORKER,applicationCommit:APP,reviewerId:270165082,adminBypassDisabled:true,actions:['verify'],approvedAt:approvedAt.toISOString(),expiresAt:expiresAt.toISOString(),unitHash:before.unitHash,controllerHashes:Object.fromEntries(FILES.slice(0,3).map(x=>[x[1].split('/').at(-1),x[2]])),previousHashes:before.previousHashes};
 const provisional=Buffer.from(JSON.stringify(authorization));await create(`${ROOT}/authorization.json`,provisional,0o600);
 // Verify with the original root controller; no install/restart/backup here.
 command('/usr/bin/node',[`${OPS}/backup-worker-install-control.mjs`,'verify',request.controller,WORKER,APP],180000);
 const final=await inventory(request);if(final.unitHash!==before.unitHash||final.releaseHash!==before.releaseHash||JSON.stringify(final.previousHashes)!==JSON.stringify(before.previousHashes))fail('inventory_changed');
 const temporary=`${ROOT}/.receipt-${randomUUID()}`;try{await create(temporary,Buffer.from(JSON.stringify({...receipt,status:'COMPLETED',completedAt:new Date().toISOString()})),0o600);await rename(temporary,`${ROOT}/bootstrap-receipt.json`);await flush(ROOT);}finally{try{await unlink(temporary);}catch(e){if(e.code!=='ENOENT')throw e;}}
 // Only COMPLETED bootstraps may activate later protected install/rollback.
 if(sha(await bytes(`${ROOT}/authorization.json`,0o600))!==sha(provisional))fail('authorization_changed');
 const activated=`${ROOT}/.authorization-${randomUUID()}`;
 try{await create(activated,Buffer.from(JSON.stringify({...authorization,actions:['verify','install','rollback']})),0o600);await rename(activated,`${ROOT}/authorization.json`);await flush(ROOT);}finally{try{await unlink(activated);}catch(e){if(e.code!=='ENOENT')throw e;}}
 console.log(`BACKUP_BOOTSTRAP=COMPLETED controller=${request.controller} worker=${WORKER} app=${APP}`);
}
if(process.argv[1]==='-')try{await main();}catch(e){console.error(`BACKUP_BOOTSTRAP=BLOCK:${['existing_bootstrap_state','release_binding_invalid','unit_binding_invalid','inventory_changed','directory_untrusted','file_untrusted','live_app_changed'].includes(e.code)?e.code:'preflight_or_io_failed'}`);process.exitCode=1;}
