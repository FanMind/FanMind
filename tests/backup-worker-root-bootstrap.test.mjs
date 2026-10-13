import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,mkdtemp,lstat,rm,open} from 'node:fs/promises';
import {join} from 'node:path';
import {FILES,SOURCE,WORKER,APP,input,metadata,sha,create} from '../scripts/operations/backup-worker-root-bootstrap.mjs';
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
