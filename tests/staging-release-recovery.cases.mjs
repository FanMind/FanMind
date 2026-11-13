import assert from 'node:assert/strict';
import test from 'node:test';
import * as fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {recoverRelease,assertRecoveryBoundary,treeFingerprint} from '../scripts/operations/staging-release-recovery.mjs';

const previous='a'.repeat(40),source='b'.repeat(40);
const env={GITHUB_REPOSITORY:'FanMind/FanMind',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_SHA:source,REVIEWED_RELEASE_COMMIT:source,EXPECTED_CURRENT_RELEASE:previous,GITHUB_RUN_ID:'12345',BILLING_WRITE_FREEZE:'preserve',STAGING_OPERATOR_SESSION_ENABLED:'true',OPERATOR_SESSION_PRESERVATION_CONFIRMATION:'preserve-approved-operator-session'};
const metadata=sha=>`FANMIND_RELEASE_COMMIT=${sha}\nFANMIND_RUNTIME_ENVIRONMENT=staging\nNODE_ENV=production\nFANMIND_STAGING_OPERATOR_SESSION_ENABLED=true\nFANMIND_STRIPE_BILLING_WRITE_FREEZE=false\n`;
function harness({realCopy=false}={}){
 const root=fs.mkdtempSync(join(tmpdir(),'fanmind-release-recovery-')),runtime=join(root,'runtime'),home=join(root,'home');
 fs.mkdirSync(runtime);fs.mkdirSync(home);fs.mkdirSync(join(runtime,'.next'));fs.mkdirSync(join(runtime,'src'));
 fs.writeFileSync(join(runtime,'.next','BUILD_ID'),'old-build');fs.writeFileSync(join(runtime,'src','page.js'),'old-runtime');fs.writeFileSync(join(runtime,'.release.env'),metadata(previous),{mode:0o600});fs.writeFileSync(join(runtime,'.env.production'),'PRIVATE_CONFIGURATION=unchanged\n',{mode:0o600});
 const secretPath=join(root,'private-secrets'),unitPath=join(root,'service'),reviewedUnit=join(root,'reviewed-service');
 fs.writeFileSync(secretPath,'PRIVATE_SECRET=never-output');fs.writeFileSync(unitPath,'reviewed unit');fs.writeFileSync(reviewedUnit,'reviewed unit');
 const commands=[],probes=[];let live=previous;
 const copy=(from,to)=>{
  if(realCopy){const r=spawnSync('rsync',['--archive','--checksum','--delete','--exclude','.env.production','--exclude','.creator-runtime-recovery.env','--exclude','.git','--exclude','.next/cache',from+'/',to+'/'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return;}
  const exclude=name=>['.env.production','.creator-runtime-recovery.env','.git'].includes(name);
  for(const n of fs.readdirSync(to))if(!exclude(n))fs.rmSync(join(to,n),{recursive:true,force:true});
  for(const n of fs.readdirSync(from))if(!exclude(n))fs.cpSync(join(from,n),join(to,n),{recursive:true});
 };
 const options={source:runtime,home,secretPath,unitPath,reviewedUnit,copy,execute:(c,a)=>{commands.push([c,a]);if(c==='sudo')live=fs.readFileSync(join(runtime,'.release.env'),'utf8').includes(previous)?previous:source;},probe:async sha=>{probes.push(sha);assert.equal(live,sha);}};
 const sameTime=new Date('2026-01-01T00:00:00Z');for(const file of ['.release.env','.next/BUILD_ID','src/page.js'])fs.utimesSync(join(runtime,file),sameTime,sameTime);
 return {root,runtime,home,options,commands,probes,prepare:()=>recoverRelease('prepare',env,options),run:(action,e=env)=>recoverRelease(action,e,options),deploy:()=>{live=source;fs.writeFileSync(join(runtime,'.release.env'),metadata(source));fs.writeFileSync(join(runtime,'.next','BUILD_ID'),'new-build');fs.writeFileSync(join(runtime,'src','page.js'),'new-runtime');for(const file of ['.release.env','.next/BUILD_ID','src/page.js'])fs.utimesSync(join(runtime,file),sameTime,sameTime);fs.writeFileSync(join(runtime,'src','new-only.js'),'new-file');},cleanup:()=>fs.rmSync(root,{recursive:true,force:true})};
}
test('recovery is manual exact-Main, old-target and preservation bound',()=>{
 assert.doesNotThrow(()=>assertRecoveryBoundary(env,'prepare'));
 for(const patch of [{GITHUB_REPOSITORY:'other/repo'},{GITHUB_REF:'refs/heads/feat/other'},{GITHUB_EVENT_NAME:'push'},{GITHUB_SHA:'wrong'},{REVIEWED_RELEASE_COMMIT:previous},{EXPECTED_CURRENT_RELEASE:''},{EXPECTED_CURRENT_RELEASE:source},{GITHUB_RUN_ID:'../escape'},{RECOVERY_RUN_ID:'../../escape'},{BILLING_WRITE_FREEZE:'false'},{STAGING_OPERATOR_SESSION_ENABLED:'false'},{OPERATOR_SESSION_PRESERVATION_CONFIRMATION:''},{FANMIND_STAGING_RELEASE_RECOVERY_CONFIRM:'recover-live-staging-release-state'}])assert.throws(()=>assertRecoveryBoundary({...env,...patch},'prepare'));
 assert.throws(()=>assertRecoveryBoundary({...env,RECOVERY_RUN_ID:'54321'},'prepare'));
});
for(const realCopy of [false,true])test(`private snapshot, accepted successor and explicit old-build rollback (${realCopy?'actual rsync':'filesystem seam'})`,{skip:realCopy&&!process.env.CI&&spawnSync('rsync',['--version']).status!==0?'rsync not installed locally':false},async()=>{
 const h=harness({realCopy});try{
  const original=treeFingerprint(h.runtime).hash,rootMode=fs.statSync(h.runtime).mode&0o777;assert.equal(await h.prepare(),'SNAPSHOT_READY');
  const backup=join(h.home,'.fanmind-staging-recovery','12345');assert.equal(fs.statSync(backup).mode&0o777,0o700);assert.equal(fs.statSync(join(backup,'receipt.json')).mode&0o777,0o600);assert.equal(fs.existsSync(join(backup,'runtime','.env.production')),false);
  await assert.rejects(h.prepare(),/snapshot_already_exists/);h.deploy();assert.equal(await h.run('accept'),'RELEASE_ACCEPTED_SNAPSHOT_RETAINED');
  assert.equal(await h.run('restore',{...env,GITHUB_RUN_ID:'54321',RECOVERY_RUN_ID:'12345'}),'PREVIOUS_RELEASE_RESTORED');
  assert.equal(treeFingerprint(h.runtime).hash,original);assert.equal(fs.statSync(h.runtime).mode&0o777,rootMode);assert.equal(fs.existsSync(join(h.runtime,'src','new-only.js')),false);assert.equal(fs.readFileSync(join(h.runtime,'.env.production'),'utf8'),'PRIVATE_CONFIGURATION=unchanged\n');
  assert.ok(h.commands.some(([c,a])=>c==='sudo'&&a.join(' ')==='-n systemctl restart fanmind-staging.service'));assert.ok(h.probes.includes(source)&&h.probes.includes(previous));
 }finally{h.cleanup();}
});
test('snapshot corruption, configuration drift and foreign live release prevent any restore command',async()=>{
 for(const mode of ['snapshot','configuration','foreign','metadata','receipt','unit']){
  const h=harness();try{await h.prepare();h.deploy();const base=join(h.home,'.fanmind-staging-recovery','12345');
   if(mode==='snapshot')fs.writeFileSync(join(base,'runtime','src','page.js'),'tampered');
   if(mode==='configuration')fs.writeFileSync(join(h.runtime,'.env.production'),'new-config');
   if(mode==='foreign')fs.writeFileSync(join(h.runtime,'.release.env'),metadata('c'.repeat(40)));
   if(mode==='metadata')fs.appendFileSync(join(h.runtime,'.release.env'),'FANMIND_STRIPE_BILLING_CAPTURE_ONLY=true\n');
   if(mode==='receipt')fs.chmodSync(join(base,'receipt.json'),0o644);
   if(mode==='unit')fs.writeFileSync(h.options.unitPath,'new-unit');
   const before=fs.readFileSync(join(h.runtime,'src','page.js'),'utf8');await assert.rejects(h.run('restore'));assert.equal(fs.readFileSync(join(h.runtime,'src','page.js'),'utf8'),before);assert.ok(!h.commands.some(([c])=>c==='sudo'));
  }finally{h.cleanup();}
 }
});
test('unknown source, disabled continuation, changing copy and unsafe private paths stop preparation',async()=>{
 for(const mode of ['unknown','off','changed-copy','symlink','external-link']){
  const h=harness();try{
   if(mode==='unknown')fs.writeFileSync(join(h.runtime,'.release.env'),metadata('c'.repeat(40)));
   if(mode==='off')fs.writeFileSync(join(h.runtime,'.release.env'),metadata(previous).replace('SESSION_ENABLED=true','SESSION_ENABLED=false'));
   if(mode==='changed-copy'){const copy=h.options.copy;h.options.copy=(a,b)=>{copy(a,b);fs.writeFileSync(join(a,'src','page.js'),'racing-write');};}
   if(mode==='symlink')fs.symlinkSync(h.runtime,join(h.home,'.fanmind-staging-recovery'));
   if(mode==='external-link')fs.symlinkSync(h.options.secretPath,join(h.runtime,'unsafe-link'));
   await assert.rejects(h.prepare());assert.ok(!h.commands.some(([c])=>c==='sudo'));
  }finally{h.cleanup();}
 }
});
test('automatic failure before snapshot never fabricates a successful restore; explicit missing snapshot fails',async()=>{
 const h=harness();try{
  assert.equal(await h.run('restore',{...env,AUTOMATIC_FAILURE_RECOVERY:'true'}),'NO_SNAPSHOT_NO_RESTORE');await assert.rejects(h.run('restore'),/snapshot_missing/);assert.equal(h.commands.length,0);
 }finally{h.cleanup();}
});
test('workflow takes snapshot before copying, accepts only after smoke and keeps same protected restore lease',()=>{
 const w=fs.readFileSync('.github/workflows/deploy-staging.yml','utf8');
 assert.ok(w.indexOf('staging-release-recovery.mjs" prepare')<w.indexOf('rsync --archive --delete'));
 assert.ok(w.indexOf('staging-release-recovery.mjs" accept')>w.indexOf('npm run smoke:public'));
 assert.match(w,/BILLING_WRITE_FREEZE=preserve node[^\n]*staging-release-recovery.mjs" prepare/u);
 assert.match(w,/BILLING_WRITE_FREEZE=preserve node[^\n]*staging-release-recovery.mjs" accept/u);
 assert.match(w,/group:.*fanmind-staging-deploy/u);assert.match(w,/restore-support-release:[\s\S]*environment: staging/u);assert.match(w,/restore-staging-support-release/u);assert.match(w,/failure\(\) \|\| cancelled\(\)/u);
 const script=fs.readFileSync('scripts/operations/staging-release-recovery.mjs','utf8');assert.match(script,/'--archive','--checksum','--delete'/u);assert.doesNotMatch(script,/service_role|supabase\.co|eval\(|console\.log\(.*receipt/u);
});
