import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,mkdtempSync,rmSync,openSync,fstatSync,closeSync,constants,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {assertStagingMediaPrepare,assertNoPackageUpgrade,MEDIA_LIMITS} from '../scripts/operations/prepare-staging-media-host.mjs';
import {validateProbeArguments,probeLimitArguments,writeMediaProbeReceipt} from '../scripts/operations/staging-media-probe-control.mjs';
import {assertInstalledMediaManifest} from '../scripts/operations/chat-admin-media-host-readiness.mjs';
const sha='a'.repeat(40),live='b'.repeat(40);
const env={GITHUB_REPOSITORY:'FanMind/FanMind',GITHUB_REPOSITORY_ID:'1259448985',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR_ID:'270165082',RUNNER_NAME:'fanmind-prod-01-exoscale',GITHUB_SHA:sha,REVIEWED_COMMIT:sha,EXPECTED_LIVE_COMMIT:live,CONFIRMATION:'prepare-staging-media-toolchain'};
test('bootstrap is bound to reviewed manual Main, Owner, existing root runner and fixed Staging only',()=>{
 assert.doesNotThrow(()=>assertStagingMediaPrepare(env,'prepare'));
 for(const patch of [{GITHUB_REF:'refs/heads/feature'},{GITHUB_EVENT_NAME:'pull_request'},{GITHUB_REPOSITORY_ID:'1'},{GITHUB_ACTOR_ID:'1'},{RUNNER_NAME:'other'},{REVIEWED_COMMIT:live},{EXPECTED_LIVE_COMMIT:'main'},{CONFIRMATION:'deploy'}])assert.throws(()=>assertStagingMediaPrepare({...env,...patch},'prepare'));
 assert.throws(()=>assertStagingMediaPrepare(env,'restart'));
 assertNoPackageUpgrade('0 upgraded, 42 newly installed, 0 to remove and 9 not upgraded.');
 for(const text of ['1 upgraded, 2 newly installed, 0 to remove','0 upgraded, 2 newly installed, 1 to remove','unexpected'])assert.throws(()=>assertNoPackageUpgrade(text));
 assert.match(MEDIA_LIMITS,/MemoryMax=1G\nCPUQuota=100%\nTasksMax=256/);
});
test('privileged helper accepts only fixed probe with immutable hashes and numeric run identity',()=>{
 assert.deepEqual(validateProbeArguments(['probe',sha,live,'1234','1']),{source:sha,live,run:'1234',attempt:'1'});
 for(const args of [['sh',sha,live,'1','1'],['probe','../../tmp',live,'1','1'],['probe',sha,live,'1;id','1'],['probe',sha,live,'1','1','--command=sh'],['cleanup',sha,live,'1','1']])assert.throws(()=>validateProbeArguments(args));
});
test('all sixteen application rlimits must be copied; unknown resources, duplication and shell text fail',()=>{
 const text=['AS','CORE','CPU','DATA','FSIZE','LOCKS','MEMLOCK','MSGQUEUE','NICE','NOFILE','NPROC','RSS','RTPRIO','RTTIME','SIGPENDING','STACK'].map(k=>`${k} unlimited unlimited`).join('\n');
 assert.equal(probeLimitArguments(text).length,16);
 for(const invalid of [text.replace('AS ','UNKNOWN '),text+'\nAS 1 1',text.replace('CORE unlimited unlimited','CORE $(id) unlimited'),text.split('\n').slice(1).join('\n')])assert.throws(()=>probeLimitArguments(invalid));
});
test('gitless application diagnostic still requires exact reviewed bytes and root-owned installation',()=>{
 const bytes=Buffer.from('reviewed probe'),manifest={version:1,source:sha,hostSha256:createHash('sha256').update(bytes).digest('hex')},st={uid:0,nlink:1,mode:0o100644};
 assert.doesNotThrow(()=>assertInstalledMediaManifest(sha,manifest,bytes,st));
 for(const [m,b,s] of [[{...manifest,source:live},bytes,st],[manifest,Buffer.from('modified'),st],[manifest,bytes,{...st,uid:1000}],[manifest,bytes,{...st,mode:0o100666}],[manifest,bytes,{...st,nlink:2}]])assert.throws(()=>assertInstalledMediaManifest(sha,m,b,s));
});
test('root helper joins fixed cgroup, exact mount and dropped identity; bounded cleanup and no production operations',()=>{
 const control=readFileSync('scripts/operations/staging-media-probe-control.mjs','utf8');
 for(const text of ["CGROUP='/system.slice/fanmind-staging.service'","writeFileSync(cgroup+'/cgroup.procs',String(process.pid))","'--mount'","'--bounding-set=-all'","'--no-new-privs'","execute('cleanup')","timeout:150000","killSignal:'SIGKILL'","process.kill(-result.pid,'SIGKILL')"])assert.ok(control.includes(text),text);
 const prepare=readFileSync('scripts/operations/prepare-staging-media-host.mjs','utf8');
 assert.doesNotMatch(prepare,/systemctl'?,\[?'restart|fanmind-production\.service|\/var\/www\/fanmind-production/u);
 assert.match(prepare,/--no-upgrade/u);assert.match(prepare,/visudo/u);assert.match(prepare,/--nonblock/u);
});

import {assertCatalogueRuntime,renderCatalogueFlags,assertMediaProbeReceipt,CATALOGUE_FLAGS} from '../scripts/operations/staging-media-catalogue-runtime.mjs';
import {mediaCatalogueTransaction} from '../scripts/operations/chat-admin-media-catalogue-apply.mjs';
import {loadMediaSchemaProfile} from '../scripts/operations/chat-admin-media-schema-profile.mjs';
test('catalogue/video switches are separate, preserve every other setting and refuse ambiguous overrides',()=>{
 const original='FANMIND_SUPPORT_CENTRE_ENABLED=true\nFANMIND_META_ENABLED=false\nFANMIND_STAGING_OPERATOR_SESSION_ENABLED=true\nFANMIND_CHAT_ADMIN_MEDIA_ANALYSIS_ENABLED=false\nSTRIPE_SYNTHETIC=preserved\n';
 const catalogue=renderCatalogueFlags(original,[],'catalogue-on');assert.ok(catalogue.startsWith(original));assert.ok(catalogue.endsWith(CATALOGUE_FLAGS[0]+'=true\n'+CATALOGUE_FLAGS[1]+'=false\n'));
 const video=renderCatalogueFlags(catalogue,[],'video-on');assert.ok(video.endsWith(CATALOGUE_FLAGS[1]+'=true\n'));
 assert.ok(renderCatalogueFlags(video,[],'off').endsWith(CATALOGUE_FLAGS[0]+'=false\n'+CATALOGUE_FLAGS[1]+'=false\n'));
 for(const text of [CATALOGUE_FLAGS[0]+'=maybe\n',CATALOGUE_FLAGS[0]+'=true\n'+CATALOGUE_FLAGS[0]+'=false\n'])assert.throws(()=>renderCatalogueFlags(text,[],'video-on'));
 assert.throws(()=>renderCatalogueFlags(original,[CATALOGUE_FLAGS[1]+'=false'],'video-on'));
 const runtime={...env,CONFIRMATION:'staging-media-video-on',SCHEMA_VERIFIED:'extended',TARGET_PROJECT:'vshyhvgcmrlagvfnvomc',PRODUCTION_PROJECT:'drqkpdvtbbrrdwmtrodz'};
 assertCatalogueRuntime(runtime,'video-on');
 for(const patch of [{GITHUB_REF:'refs/heads/other'},{REVIEWED_COMMIT:live},{SCHEMA_VERIFIED:'initial'},{TARGET_PROJECT:'drqkpdvtbbrrdwmtrodz'}])assert.throws(()=>assertCatalogueRuntime({...runtime,...patch},'video-on'));
});
test('video activation requires root-owned fresh exact source/live/application-PID probe receipt',()=>{
 const now=Date.now(),r={version:1,source:sha,live:sha,pid:123,result:'PASS',completedAt:new Date(now-60000).toISOString()},st={uid:0,nlink:1,mode:0o100644};
 assertMediaProbeReceipt(r,st,sha,'123',now);
 for(const patch of [{source:live},{live},{pid:124},{result:'BLOCK'},{completedAt:new Date(now-31*60000).toISOString()},{completedAt:new Date(now+60000).toISOString()}])assert.throws(()=>assertMediaProbeReceipt({...r,...patch},st,sha,'123',now));
 for(const stat of [{...st,uid:1000},{...st,nlink:2},{...st,mode:0o100666}])assert.throws(()=>assertMediaProbeReceipt(r,stat,sha,'123',now));
});
test('controlled catalogue apply binds exact source, initial/complete state and atomic postflight',()=>{
 const sql=mediaCatalogueTransaction();
 for(const text of ['pg_advisory_xact_lock',"current_state='initial'","current_state<>'extended'",'catalogue_extended_postflight_required',"lock_timeout='5s'",'COMMIT;'])assert.ok(sql.includes(text),text);
 assert.throws(()=>mediaCatalogueTransaction(loadMediaSchemaProfile('initial')));
});

test('private probe umask cannot make the non-secret root receipt unreadable by the application',()=>{
 const directory=mkdtempSync(join(tmpdir(),'fm1425-receipt-')),prior=process.umask(0o077);
 try{const path=join(directory,'receipt.json'),receipt={version:1,source:sha,live:sha,result:'PASS'};writeMediaProbeReceipt(path,receipt);const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{assert.equal(fstatSync(fd).mode&0o777,0o644);assert.deepEqual(JSON.parse(readFileSync(fd,'utf8')),receipt);}finally{closeSync(fd);}}
 finally{process.umask(prior);rmSync(directory,{recursive:true,force:true});}
});

test('installed current-symlink entry executes the same guarded CLI instead of silently returning success',()=>{
 const directory=mkdtempSync(join(tmpdir(),'fm1425-entry-'));
 try{const target=resolve('scripts/operations/staging-media-probe-control.mjs'),link=join(directory,'control.mjs');symlinkSync(target,link);
 for(const path of [target,link]){const r=spawnSync(process.execPath,[path,'invalid'],{encoding:'utf8',timeout:10000,env:{PATH:'/usr/bin:/bin'}});assert.equal(r.status,1);assert.match(r.stderr,/STAGING_MEDIA_PROBE=BLOCK/u);assert.equal(r.stdout,'');}}
 finally{rmSync(directory,{recursive:true,force:true});}
});
