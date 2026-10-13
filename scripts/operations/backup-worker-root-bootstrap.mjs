#!/usr/bin/env node
import {constants} from 'node:fs';
import {open,lstat,realpath,mkdir,rename,unlink,rmdir,readFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';

export const SOURCE='e3cfbf73d2ed30b5a6ecd5ccfd3bff6aded0169f';
export const WORKER='8e5dcbdca844972fb2f133c188ecfee5d5252273';
export const APP='707d22702a784e3b9999d1c9ae9c1e11c096a1bc';
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
 if(!['inspect','bootstrap'].includes(action)||!/^[a-f0-9]{40}$/.test(controller??'')||!Number.isSafeInteger(runnerUid)||runnerUid<=0)fail('invocation_invalid');
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
async function version(){const r=await fetch('https://fanmind.ch/api/version',{redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)fail('live_probe_failed');const text=await r.text();if(text.length>4096)fail('live_probe_failed');const j=JSON.parse(text);if(j.application!=='fanmind'||j.runtimeEnvironment!=='production'||j.releaseCommit!==APP)fail('live_app_changed');}
async function inventory(request){
 await directory(OPS);await directory('/usr/local/sbin');await directory('/etc/fanmind-backup');await directory('/var/lib');
 const previousHashes={};for(const name of OLD)previousHashes[name]=sha(await bytes(`${OPS}/${name}`,0o750));
 const release=await bytes(RELEASE,0o600);if(release.toString()!==`FANMIND_RELEASE_COMMIT=${APP}\n`)fail('release_binding_invalid');
 const unit=await bytes(UNIT,0o644);const configStat=await lstat('/etc/fanmind-backup/worker.env');metadata(configStat,0o600);if(configStat.isSymbolicLink())fail('file_untrusted');
 const props=command('/usr/bin/systemctl',['show','fanmind-backup-worker.service','--property=FragmentPath,DropInPaths,WorkingDirectory,ExecStart,ActiveState,MainPID']);
 const p=Object.fromEntries(props.split('\n').map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)];}));
 if(p.FragmentPath!==UNIT||p.DropInPaths!==''||p.WorkingDirectory!==OPS||p.ActiveState!=='active'||!p.ExecStart?.startsWith('{ path=/usr/bin/node ;')||!p.ExecStart.includes(`argv[]=/usr/bin/node ${OPS}/backup-worker.mjs ;`))fail('unit_binding_invalid');
 if(!/^[1-9][0-9]*$/.test(p.MainPID))fail('unit_binding_invalid');
 const argv=await readFile(`/proc/${p.MainPID}/cmdline`);if(!argv.equals(Buffer.from(`/usr/bin/node\0${OPS}/backup-worker.mjs\0`)))fail('unit_binding_invalid');
 command('/usr/bin/systemd-analyze',['verify',UNIT]);await version();
 return {schemaVersion:1,controllerCommit:request.controller,controllerProgramSource:SOURCE,workerCommit:WORKER,applicationCommit:APP,runnerUid:request.runnerUid,workerPid:Number(p.MainPID),workerArgvHash:sha(argv),unitHash:sha(unit),releaseHash:sha(release),previousHashes,observedAt:new Date().toISOString()};
}
async function download([path,,hash,commit]){const r=await fetch(`https://raw.githubusercontent.com/FanMind/FanMind/${commit}/${path}`,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!r.ok)fail('source_fetch_failed');const b=Buffer.from(await r.arrayBuffer());if(!b.length||b.length>2*1024*1024||sha(b)!==hash)fail('source_hash_invalid');return b;}
async function database(content){
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
  if(c.restrictedSecurityDefinerFunctionCount!==13)fail('current_contract_required');
  const r=spawnSync('/usr/lib/postgresql/17/bin/psql',['--no-psqlrc','--no-password','--quiet','--tuples-only','--no-align','--set=ON_ERROR_STOP=1','--host',connection.host,'--port',connection.port,'--username',connection.username,'--dbname',connection.database],{env,input:policy.BACKUP_ACTIVE_JOBS_SQL,encoding:'utf8',timeout:30000,maxBuffer:4096});
  if(r.error||r.status!==0||r.stdout.trim()!=='0')fail('backup_jobs_active');
  const afterPass=await bytes(config.FANMIND_BACKUP_PGPASSFILE,0o600);try{if(sha(afterPass)!==passHash||sha(await bytes(config.FANMIND_BACKUP_DB_CA_CERT_PATH,0o644))!==caHash)fail('connection_changed');}finally{afterPass.fill(0);}
 }finally{
  pass?.fill(0);ca?.fill(0);
  if(privatePath){for(const path of owned)await unlink(path);await rmdir(privatePath);}
 }

}
async function main(){
 if(process.getuid?.()!==0||process.argv.length!==5)fail('invocation_invalid');
 const request=input(process.argv[2],process.argv[3],Number(process.argv[4]));const content=[];for(const item of FILES)content.push(await download(item));await database(content);const before=await inventory(request);
 if(request.action==='inspect'){console.log(`BACKUP_BOOTSTRAP_INVENTORY=${JSON.stringify(before)}`);return;}
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
