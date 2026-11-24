import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,mkdtemp,lstat,rm,open} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {FILES,SOURCE,WORKER,APP,input,metadata,sha,create,INSPECT_SOURCE,INSPECT_APP,INSPECT_CONTRACT_SHA256,EXPECTED_INSTALLED_PREIMAGE_SHA256,inspectCurrent,lockHeld,lockDirectoryMetadata,timerState} from '../scripts/operations/backup-worker-root-bootstrap.mjs';
import {inspectionRequest,request,INSPECT_WORKER_COMMIT,INSPECT_APP_COMMIT,WORKER_COMMIT,FILES as INSTALL_FILES,EXPECTED_INSTALLED_CONTRACT_SHA256} from '../scripts/operations/backup-worker-install-policy.mjs';
test('bootstrap allows only inspect/bootstrap for exact main-shaped commit and nonroot sudo invoker',()=>{
 assert.equal(input('inspect',SOURCE,1000).action,'inspect');
 for(const args of [['install',SOURCE,1000],['bootstrap','main',1000],['bootstrap',SOURCE,0],['inspect',SOURCE,NaN]])assert.throws(()=>input(...args));
});
test('root source metadata rejects unsafe ownership, links, permissions and oversized files',()=>{
 const s={isFile:()=>true,uid:0,gid:0,nlink:1,mode:0o750,size:10};metadata(s,0o750);
 for(const change of [{isFile:()=>false},{uid:1000},{gid:1000},{nlink:2},{mode:0o777},{size:0},{size:3*1024*1024}])assert.throws(()=>metadata({...s,...change},0o750));
});
test('all staged files are pinned to reviewed sources and never target the installed old worker',()=>{
 assert.equal(FILES.length,6);
 assert.equal(new Set(FILES.map(x=>x[1])).size,6);
 for(const [source,dest,hash,commit]of FILES){assert.match(hash,/^[a-f0-9]{64}$/);assert.ok([SOURCE,WORKER].includes(commit));assert.ok(!dest.endsWith('/release.env'));assert.notEqual(dest,'/usr/local/lib/fanmind-ops/backup-worker.mjs');assert.ok(source.startsWith('scripts/operations/')||source.startsWith('ops/'));}
 assert.notEqual(APP,WORKER);
});
test('privileged bootstrap cannot overwrite existing state or dispatch database/service mutations',async()=>{
 const source=await readFile('scripts/operations/backup-worker-root-bootstrap.mjs','utf8');
 assert.match(source,/O_EXCL/);assert.match(source,/O_NOFOLLOW/);assert.match(source,/status:'PREPARED'/);assert.match(source,/status:'COMPLETED'/);
 assert.match(source,/await absent\(`\$\{ROOT\}\/authorization.json`\)/);
 assert.match(source,/'verify',request.controller,WORKER,APP/);
 assert.doesNotMatch(source,/\['(?:start|stop|restart|daemon-reload)'/);
 assert.doesNotMatch(source,/GRANT|REVOKE|ALTER TABLE|sudoers\.d|enqueue-backup/);
 assert.match(source,/await database\(content\);const before=await inventory/);
});
test('launcher freezes checked bytes before root execution and shares production/host locks',async()=>{
 const w=await readFile('.github/workflows/backup-worker-root-bootstrap.yml','utf8');
 const s=await readFile('scripts/operations/backup-worker-root-bootstrap.mjs');
 assert.ok(w.includes(sha(s)));assert.match(w,/environment: backup-production-recovery/);assert.match(w,/group: fanmind-production-deploy/);
 assert.match(w,/admin-bypass-disabled/);assert.match(w,/SUDO_UID/);assert.match(w,/O_NOFOLLOW/);
 assert.match(w,/spawnSync\(bin,argv,\{input:b,env/);assert.match(w,/--nonblock/);
 const host=w.split('  bootstrap:')[1];assert.doesNotMatch(host,/actions\/(?:checkout|setup-node)@/);
 assert.match(host,/env -i PATH=\/usr\/bin:\/bin/);
});

test('exclusive root create restores exact mode under umask0077 and preserves existing files',async(t)=>{
 if(process.getuid?.()!==0){t.skip('root ownership I/O exercised by protected inspect; unprivileged CI');return;}
 // /root has safe ancestors, unlike world-writable /tmp.
 const dir=await mkdtemp('/root/fanmind-bootstrap-test-');const prior=process.umask(0o077);
 try{const path=join(dir,'worker');await create(path,Buffer.from('known'),0o750);await assert.rejects(create(path,Buffer.from('foreign'),0o750),{code:'EEXIST'});const fd=await open(path,'r');try{assert.equal((await fd.stat()).mode&0o777,0o750);assert.equal(await fd.readFile('utf8'),'known');}finally{await fd.close();}
 const failed=join(dir,'partial');const owned=[];await assert.rejects(create(failed,Buffer.from('known'),0o600,p=>{owned.push(p);throw Error('simulated interruption after exclusive open');}));assert.deepEqual(owned,[failed]);assert.equal((await lstat(failed)).size,0);
 }finally{process.umask(prior);await rm(dir,{recursive:true});}
});

test('bootstrap and install share the claimed-aware fixed queue guard',async()=>{
 const [bootstrap,control,policy]=await Promise.all(['scripts/operations/backup-worker-root-bootstrap.mjs','scripts/operations/backup-worker-install-control.mjs','scripts/operations/backup-worker-install-policy.mjs'].map(x=>readFile(x,'utf8')));
 assert.match(bootstrap,/input:policy\.BACKUP_ACTIVE_JOBS_SQL/u);assert.match(control,/BACKUP_ACTIVE_JOBS_SQL,pgEnv/u);assert.match(policy,/status in \('queued','claimed','running'\)/u);
});

test('current inspection cannot authorize an install or substitute an arbitrary source/application',()=>{
 assert.equal(INSPECT_SOURCE,INSPECT_WORKER_COMMIT);assert.equal(INSPECT_APP,INSPECT_APP_COMMIT);
 assert.equal(inspectionRequest('inspect',SOURCE,INSPECT_SOURCE,INSPECT_APP).action,'inspect');
 for(const args of [
  ['install',SOURCE,INSPECT_SOURCE,INSPECT_APP],['bootstrap',SOURCE,INSPECT_SOURCE,INSPECT_APP],
  ['inspect','main',INSPECT_SOURCE,INSPECT_APP],['inspect',SOURCE,WORKER,INSPECT_APP],
  ['inspect',SOURCE,INSPECT_SOURCE,APP],['inspect',SOURCE,INSPECT_SOURCE,'0'.repeat(40)]
 ])assert.throws(()=>inspectionRequest(...args));
 assert.throws(()=>request('install',SOURCE,WORKER,APP));
 assert.equal(request('install',SOURCE,INSPECT_SOURCE,INSPECT_APP).workerCommit,INSPECT_SOURCE);
});

const inspectRequest={action:'inspect',controller:SOURCE,runnerUid:1000};
function observation(){return {unitHash:'a'.repeat(64),releaseHash:'b'.repeat(64),workerPid:42,workerArgvHash:'c'.repeat(64),previousHashes:{worker:'d'.repeat(64)}};}
function inspectIo(){
 const calls=[];const io={database:async()=>calls.push('database'),inventory:async()=>{calls.push('inventory');return observation();},extra:async()=>{calls.push('extra');return {controllers:{control:{state:'absent'}}};}};
 for(const name of ['install','create','persist','stop','start','replace','bootstrap'])io[name]=()=>assert.fail(`unexpected mutation ${name}`);
 return {io,calls};
}
test('inspection measures the read boundary twice and never upgrades it to installation authority',async()=>{
 const {io,calls}=inspectIo();const result=await inspectCurrent(inspectRequest,io);
 assert.deepEqual(calls,['database','inventory','extra','inventory','extra']);
 assert.equal(result.installationAuthorized,false);assert.equal(result.databaseContractVerified,true);
 assert.equal(result.expectedApplicationCommit,INSPECT_APP);assert.equal(result.reviewedContractSha256,INSPECT_CONTRACT_SHA256);
 assert.equal(result.controllers.control.state,'absent');
 assert.equal(result.hostWorkloadExclusivityVerified,false);
});
test('database/queue failure retains only bounded host evidence, without an exception or credential leak',async()=>{
 const {io}=inspectIo();io.database=async()=>{throw Error('private-passfile-and-database-details');};
 const result=await inspectCurrent(inspectRequest,io);
 assert.equal(result.databaseContractVerified,false);assert.equal(result.installationAuthorized,false);
 assert.doesNotMatch(JSON.stringify(result),/private-passfile|database-details/u);
});
test('changed unit, release, process identity or worker bytes invalidates the observed inventory',async()=>{
 for(const change of [{unitHash:'e'.repeat(64)},{releaseHash:'e'.repeat(64)},{workerPid:43},{workerArgvHash:'e'.repeat(64)},{previousHashes:{worker:'e'.repeat(64)}}]){
  const {io}=inspectIo();let n=0;io.inventory=async()=>({...observation(),...(n++?change:{})});
  await assert.rejects(inspectCurrent(inspectRequest,io),{code:'inventory_changed'});
 }
 const {io}=inspectIo();io.extra=async()=>{throw Object.assign(Error(),{code:'file_untrusted'});};
 await assert.rejects(inspectCurrent(inspectRequest,io),{code:'file_untrusted'});
});
test('controller, authorization, receipt, rollback and version observations must also remain stable',async()=>{
 for(const key of ['controllers','authorization','bootstrapReceipt','rollbackDirectoryPresent','rollback','installedWorkerVersion']){
  const {io}=inspectIo();let n=0;io.extra=async()=>({[key]:n++?'changed':'initial'});
  await assert.rejects(inspectCurrent(inspectRequest,io),{code:'inventory_changed'});
 }
});
test('kernel lock identity uses device and inode, including blocked-waiter records',()=>{
 const raw='7: FLOCK ADVISORY WRITE 42 08:01:12345 0 EOF\n8: -> FLOCK ADVISORY WRITE 43 08:01:12345 0 EOF\n';
 assert.equal(lockHeld(raw,0x801n,12345n),true);
 assert.equal(lockHeld(raw,0x802n,12345n),false);
 assert.equal(lockHeld(raw,0x801n,12346n),false);
 assert.equal(lockHeld('',0x801n,12345n),false);
});
test('the existing Ubuntu sticky lock directory is read-only admissible, never a writable generic root path',()=>{
 const safe={isDirectory:()=>true,isSymbolicLink:()=>false,uid:0,gid:0,mode:0o1777};
 lockDirectoryMetadata(safe);lockDirectoryMetadata({...safe,mode:0o755});
 for(const change of [{uid:1000},{gid:1000},{isDirectory:()=>false},{isSymbolicLink:()=>true},{mode:0o777},{mode:0o775},{mode:0o3777},{mode:0o5777}])assert.throws(()=>lockDirectoryMetadata({...safe,...change}));
});
test('timer diagnostics reject missing, duplicate, foreign or unknown status and never expose raw properties',()=>{
 const raw='ActiveState=active\nUnitFileState=enabled\nNextElapseUSecRealtime=Sun 2026-11-15 02:30:00 CET';
 assert.equal(timerState(raw).activeState,'active');assert.equal(timerState(raw).unitFileState,'enabled');
 assert.equal(timerState(raw).scheduleSha256,sha(Buffer.from(raw)));assert.doesNotMatch(JSON.stringify(timerState(raw)),/02:30|CET/u);
 for(const bad of ['',raw+'\nActiveState=inactive',raw+'\nEnvironment=private',raw.replace('=active','=unexpected'),raw.replace('=enabled','=unexpected')])assert.throws(()=>timerState(bad));
});
test('inspection bypasses only the stale read path; legacy mutation sources remain pinned and unreachable from inspect',async()=>{
 const source=await readFile('scripts/operations/backup-worker-root-bootstrap.mjs','utf8');
 assert.match(source,/if\(request.action==='inspect'\)\{await currentInspection\(request\);return;\}/u);
 const inspect=source.slice(source.indexOf('async function currentInspection'),source.indexOf('// Exact existing controller upgrade'));
 assert.match(inspect,/database\(content,29\)/u);assert.match(inspect,/inventory\(request,INSPECT_APP\)/u);
 assert.doesNotMatch(inspect,/create\(|mkdir\(|rename\(|unlink\(|\['(?:start|stop|restart)'/u);
 assert.match(inspect,/if\(!result.databaseContractVerified\)process.exitCode=1/u);
 assert.equal(FILES[1][3],SOURCE);assert.equal(FILES[3][3],WORKER);
 const w=await readFile('.github/workflows/backup-worker-root-bootstrap.yml','utf8');
 assert.ok(w.includes(INSPECT_APP)&&w.includes(INSPECT_SOURCE));assert.match(w,/\$CURRENT_MAIN:\$ACTION:\$WORKER_BINDING:\$APP_BINDING:admin-bypass-disabled/u);
});

test('actual GitHub preflight keeps Owner, current-Main and protected-environment gates for inspection',()=>{
 const branch={commit:{sha:SOURCE},protected:true};
 const environment={name:'backup-production-recovery',protection_rules:[{type:'required_reviewers',reviewers:[{type:'User',reviewer:{id:270165082}}]}],can_admins_bypass:false,deployment_branch_policy:{custom_branch_policies:true,protected_branches:false}};
 const branches={total_count:1,branch_policies:[{name:'main',type:'branch'}]};
 const env={PATH:process.env.PATH,GITHUB_REPOSITORY:'FanMind/FanMind',GITHUB_REPOSITORY_ID:'1259448985',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_SHA:SOURCE,GITHUB_ACTOR_ID:'270165082',CONFIRMATION:'backup-worker-inspect',REQUESTED_ACTION:'inspect',REVIEWED_CONTROLLER_COMMIT:SOURCE,WORKER_SOURCE_COMMIT:INSPECT_SOURCE,EXPECTED_APPLICATION_COMMIT:INSPECT_APP};
 function run(overrides={},api={branch,environment,branches}){
  const code="const api=JSON.parse(process.argv[1]);globalThis.fetch=async u=>({ok:true,text:async()=>JSON.stringify(u.includes('deployment-branch-policies')?api.branches:u.endsWith('branches/main')?api.branch:api.environment)});await import('./scripts/operations/backup-worker-install-github-preflight.mjs');";
  return spawnSync(process.execPath,['--input-type=module','-e',code,JSON.stringify(api)],{env:{...env,...overrides},encoding:'utf8',timeout:10000});
 }
 assert.equal(run().status,0);
 for(const overrides of [{GITHUB_ACTOR_ID:'1'},{GITHUB_REF:'refs/heads/foreign'},{GITHUB_EVENT_NAME:'push'},{GITHUB_SHA:'0'.repeat(40)},{CONFIRMATION:'backup-worker-install'},{WORKER_SOURCE_COMMIT:WORKER},{EXPECTED_APPLICATION_COMMIT:APP}]){
  const result=run(overrides);assert.equal(result.status,1);assert.match(result.stderr,/BACKUP_WORKER_GITHUB_PREFLIGHT=BLOCK/u);
 }
 for(const api of [{branch:{...branch,protected:false},environment,branches},{branch:{...branch,commit:{sha:'0'.repeat(40)}},environment,branches},{branch,environment:{...environment,can_admins_bypass:true},branches},{branch,environment:{...environment,protection_rules:[]},branches},{branch,environment,branches:{...branches,branch_policies:[{name:'foreign',type:'branch'}]}}])assert.equal(run({},api).status,1);
});

test('repair inventory accepts only the measured old state under the already held preparation lock',async()=>{
 const {repairInventory,OBSERVED_CONTROL_HASHES}=await import('../scripts/operations/backup-worker-root-bootstrap.mjs');
 const measured={expectedApplicationCommit:INSPECT_APP,databaseContractVerified:true,
  unitHash:'ae4a16dea717bc407274c1623e9dc5fd1aa9f67c0dcd41465bffa9dba3a50896',
  releaseHash:'93cf1b697a3140e286c40ea8b020b44955cb9978518de00f958deea6aec214a7',
  installedWorkerHashes:Object.fromEntries(FILES.slice(3).map(([,dest,hash],index)=>[dest.split('/').at(-1),index===0?EXPECTED_INSTALLED_PREIMAGE_SHA256:hash])),
  controllers:Object.fromEntries(Object.entries(OBSERVED_CONTROL_HASHES).map(([name,hash])=>[name==='backup-worker-install-control.mjs'?'control':name==='backup-worker-install-policy.mjs'?'policy':'wrapper',{state:'present',sha256:hash}])),
  lock:{state:'present',held:true},activeTools:{pg_dump:0,pg_restore:0,rclone:0,age:0,tar:0},
  timers:Object.fromEntries(['database','full','storage','server_config'].map(name=>[name,{activeState:'active',unitFileState:'enabled'}]))};
 repairInventory(measured);
 for(const mutate of [v=>v.expectedApplicationCommit=APP,v=>v.databaseContractVerified=false,
  v=>v.installedWorkerHashes['database-authorization-contract.mjs']=INSPECT_CONTRACT_SHA256,
  v=>v.installedWorkerHashes['backup-worker.mjs']='e'.repeat(64),v=>v.controllers.control.sha256='f'.repeat(64),
  v=>v.unitHash='f'.repeat(64),v=>v.releaseHash='f'.repeat(64),v=>v.lock.held=false,
  v=>v.activeTools.pg_dump=1,v=>delete v.activeTools.tar,v=>v.timers.full.activeState='inactive']){
  const changed=structuredClone(measured);mutate(changed);assert.throws(()=>repairInventory(changed),{code:'repair_inventory_changed'});
 }
});
test('preparation durably saves actual old bytes before control replacement and cannot authorize a failed stage',async()=>{
 const {repairPreparation}=await import('../scripts/operations/backup-worker-root-bootstrap.mjs');
 function fake(failure){const calls=[];return {calls,...Object.fromEntries(['preflight','snapshot','stage','replaceControllers','verifyControllers','authorize','recoverPreparation'].map(name=>[name,async()=>{calls.push(name);if(name===failure)throw Error('injected');}])),persist:async status=>calls.push(status)};}
 const good=fake();assert.equal(await repairPreparation(good),'PREPARED_NOT_INSTALLED');
 assert.deepEqual(good.calls,['preflight','snapshot','stage','preflight','PREPARED','replaceControllers','verifyControllers','authorize','COMPLETED']);
 for(const failure of ['preflight','snapshot','stage','replaceControllers','verifyControllers','authorize']){
  const io=fake(failure);await assert.rejects(repairPreparation(io));
  assert.ok(!io.calls.includes('COMPLETED'));if(['preflight','snapshot','stage'].includes(failure))assert.ok(!io.calls.includes('replaceControllers'));
 }
});
test('immutable hardened module passes exact bootstrap-to-installer source and preimage binding',async()=>{
 const moduleBytes=await readFile('scripts/operations/database-authorization-contract.mjs');
 const root=await readFile('scripts/operations/backup-worker-root-bootstrap.mjs','utf8');
 const control=await readFile('scripts/operations/backup-worker-install-control.mjs','utf8');
 const bootstrapWorkflow=await readFile('.github/workflows/backup-worker-root-bootstrap.yml','utf8');
 const installWorkflow=await readFile('.github/workflows/backup-worker-production-control.yml','utf8');
 const historical=FILES[3][2];
 const newHash=sha(moduleBytes);
 assert.equal(INSPECT_SOURCE,'690ab046d537d6cb910496302208e722054e0d80');
 assert.equal(WORKER_COMMIT,INSPECT_SOURCE);
 assert.equal(newHash,INSPECT_CONTRACT_SHA256);
 assert.equal(INSTALL_FILES['database-authorization-contract.mjs'],newHash);
 assert.equal(EXPECTED_INSTALLED_CONTRACT_SHA256,EXPECTED_INSTALLED_PREIMAGE_SHA256);
 assert.equal(EXPECTED_INSTALLED_PREIMAGE_SHA256,'2f8e2d82f5f0eb2c070f22a7c035feaf1e4112a918853bea76b9fa769be8b441');
 assert.equal(historical,'b80490c17270a830dc409fc4d3755224e23facdc23a6f4ee34fb28189f7544de');
 assert.notEqual(newHash,historical);
 assert.notEqual(newHash,EXPECTED_INSTALLED_PREIMAGE_SHA256);
 assert.match(root,/const moduleBytes=await download\(\['scripts\/operations\/database-authorization-contract\.mjs','',INSPECT_CONTRACT_SHA256,INSPECT_SOURCE\]\)/u);
 assert.match(root,/const bundle=\x60\$\{ROOT\}\/bundles\/\$\{INSPECT_SOURCE\}\x60/u);
 assert.match(root,/workerCommit:INSPECT_SOURCE/u);
 assert.match(root,/hashes\['database-authorization-contract\.mjs'\]!==EXPECTED_INSTALLED_PREIMAGE_SHA256/u);
 assert.match(control,/preparation\.workerCommit !== WORKER_COMMIT/u);
 assert.match(control,/preparation\.moduleSha256 !== FILES\['database-authorization-contract\.mjs'\]/u);
 assert.match(control,/if \(digest\(newBytes\[name\]\) !== hash\) fail\('bundle_hash_mismatch'\)/u);
 assert.match(control,/c\.coreTableAppGrantTupleCount !== 116/u);
 assert.match(control,/c\.restrictedSecurityDefinerFunctionCount !== 29/u);
 assert.ok(bootstrapWorkflow.includes(INSPECT_SOURCE));
 assert.ok(installWorkflow.includes(WORKER_COMMIT));
 assert.ok(!installWorkflow.includes('[[ "$WORKER_COMMIT" == 6bc209851b4a54609747099ec34264318dc7f4c4 ]]'));
 // A historical or made-up bundle cannot satisfy the exact new install pin.
 for(const wrong of [historical,EXPECTED_INSTALLED_PREIMAGE_SHA256,'f'.repeat(64)])assert.notEqual(wrong,newHash);
});
test('new control bytes and root launcher are checksum-pinned; incomplete preparation cannot install',async()=>{
 const {REPAIR_CONTROL_HASHES}=await import('../scripts/operations/backup-worker-root-bootstrap.mjs');
 for(const name of ['backup-worker-install-control.mjs','backup-worker-install-policy.mjs'])assert.equal(sha(await readFile(`scripts/operations/${name}`)),REPAIR_CONTROL_HASHES[name]);
 const root=await readFile('scripts/operations/backup-worker-install-control.mjs','utf8');
 assert.match(root,/preparation.status !== 'COMPLETED'/u);
 assert.match(root,/await flushDirectory\(RECORD\).*await checkSaved\(\)/u);
 assert.match(root,/Object.entries\(RETAINED_FILES\)/u);
 const w=await readFile('.github/workflows/backup-worker-root-bootstrap.yml','utf8');
 assert.match(w,/prepare-contract-repair/u);assert.match(w,/if\(process.argv\[4\]!=='inspect'\)/u);
 assert.match(w,/group: fanmind-production-deploy/u);assert.match(w,/cancel-in-progress: false/u);
});
