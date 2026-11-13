import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,existsSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {assertMediaHostDispatch,assessMediaApplicationContext,mediaCodecsAvailable,syntheticMediaProbe} from '../scripts/operations/chat-admin-media-host-readiness.mjs';
const env={GITHUB_REPOSITORY:'FanMind/FanMind',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_SHA:'a'.repeat(40),REVIEWED_COMMIT:'a'.repeat(40),EXPECTED_LIVE_COMMIT:'b'.repeat(40),CONFIRMATION:'inspect-staging-media-host',FANMIND_RUNTIME_ENVIRONMENT:'staging',FANMIND_TARGET_SUPABASE_PROJECT_REF:'vshyhvgcmrlagvfnvomc',FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:'drqkpdvtbbrrdwmtrodz',GITHUB_RUN_ID:'1234',GITHUB_RUN_ATTEMPT:'1'};
test('media host diagnostic requires manual exact Main and actual distinct Staging target',()=>{
 assert.doesNotThrow(()=>assertMediaHostDispatch(env,'inspect'));
 for(const patch of [{GITHUB_REF:'refs/heads/feature'},{GITHUB_EVENT_NAME:'pull_request'},{REVIEWED_COMMIT:'b'.repeat(40)},{EXPECTED_LIVE_COMMIT:'main'},{FANMIND_RUNTIME_ENVIRONMENT:'production'},{FANMIND_TARGET_SUPABASE_PROJECT_REF:'drqkpdvtbbrrdwmtrodz'},{CONFIRMATION:'deploy-staging-only'},{GITHUB_RUN_ID:'../../tmp'}])assert.throws(()=>assertMediaHostDispatch({...env,...patch},'inspect'));
 assert.throws(()=>assertMediaHostDispatch(env,'probe'));assert.throws(()=>assertMediaHostDispatch(env,'install'));
});
const context={active:'active',sub:'running',user:'fanmind-staging',group:'fanmind-staging',sameUid:true,sameGid:true,sameMount:true,sameCgroup:true,sameSecurity:true,sameProcessLimits:true,privateTmp:'yes',umask:'0077',noNewPrivileges:'yes',protectSystem:'strict',tempAccessible:true,tempFreeBytes:1024**3,memoryMax:1024**3,cpuQuota:1000000,tasksMax:128};
test('same runner or same UID never proves application namespace, cgroup, sandbox or quotas',()=>{
 assert.deepEqual(assessMediaApplicationContext(context),[]);
 for(const patch of [{sameMount:false},{sameCgroup:false},{sameSecurity:false},{sameProcessLimits:false},{sameUid:false},{privateTmp:'no'},{umask:'0022'},{tempAccessible:false},{tempFreeBytes:1},{memoryMax:Infinity},{cpuQuota:Infinity},{tasksMax:Infinity}])assert.ok(assessMediaApplicationContext({...context,...patch}).length>0,JSON.stringify(patch));
});
test('missing codecs fail closed and failure cleanup cannot delete a pre-existing directory',()=>{
 assert.equal(mediaCodecsAvailable({encoders:'',decoders:'',demuxers:''}),false);
 const parent=mkdtempSync(join(tmpdir(),'fm1425-host-case-'));
 try{
  const directory=join(parent,'probe');let created;
  assert.throws(()=>syntheticMediaProbe(directory,{execute:()=>{throw Error('synthetic failure');},onDirectory:value=>{created=value;}}),/synthetic failure/);
  assert.equal(created,undefined);assert.equal(existsSync(directory),false);
  writeFileSync(join(parent,'keep'),'untouched');
  assert.throws(()=>syntheticMediaProbe(parent),/EEXIST/);
  assert.equal(readFileSync(join(parent,'keep'),'utf8'),'untouched');
 }finally{rmSync(parent,{recursive:true,force:true});}
});
test('actual local MP4/WebM with audio normalize and cleanup, without claiming target acceptance',{skip:process.env.FANMIND_MEDIA_HOST_PROBE_TEST_REQUIRED!=='true'},()=>{
 const parent=mkdtempSync(join(tmpdir(),'fm1425-host-real-')),directory=join(parent,'probe');
 try{syntheticMediaProbe(directory);assert.equal(existsSync(directory),false);}
 finally{rmSync(parent,{recursive:true,force:true});}
});

import "./staging-media-toolchain.cases.mjs";
