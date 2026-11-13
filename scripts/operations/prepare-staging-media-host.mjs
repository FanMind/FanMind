#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,lstatSync,existsSync,mkdirSync,renameSync,symlinkSync,unlinkSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const SAFE={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',DEBIAN_FRONTEND:'noninteractive',NEEDRESTART_MODE:'l'};
const BASE='/usr/local/lib/fanmind-staging-media';
export const MEDIA_LIMITS='[Service]\nMemoryMax=1G\nCPUQuota=100%\nTasksMax=256\n';
const fail=code=>{throw Error(code);};
const run=(cmd,args,timeout=30000)=>execFileSync(cmd,args,{env:SAFE,encoding:'utf8',timeout,maxBuffer:2*1024*1024,stdio:['ignore','pipe','pipe']});
export function assertStagingMediaPrepare(env,action){
 if(!['inspect','prepare'].includes(action)||env.GITHUB_REPOSITORY!=='FanMind/FanMind'||env.GITHUB_REPOSITORY_ID!=='1259448985'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.GITHUB_ACTOR_ID!=='270165082'||env.RUNNER_NAME!=='fanmind-prod-01-exoscale'||
  !/^[a-f0-9]{40}$/u.test(env.GITHUB_SHA??'')||env.REVIEWED_COMMIT!==env.GITHUB_SHA||! /^[a-f0-9]{40}$/u.test(env.EXPECTED_LIVE_COMMIT??'')||env.CONFIRMATION!==`${action}-staging-media-toolchain`)fail('prepare_target');
}
export function assertNoPackageUpgrade(plan){if(!/\b0 upgraded, [0-9]+ newly installed, 0 to remove\b/u.test(plan))fail('package_upgrade_not_allowed');}
function directory(path){mkdirSync(path,{recursive:true,mode:0o755});const st=lstatSync(path);if(!st.isDirectory()||st.isSymbolicLink()||st.uid!==0||(st.mode&0o022))fail('prepare_path');}
function install(path,bytes,mode=0o644){
 if(existsSync(path)){const st=lstatSync(path);if(!st.isFile()||st.isSymbolicLink()||st.uid!==0||st.nlink!==1||(st.mode&0o022))fail('prepare_existing_file');}
 const temp=path+`.${process.pid}`;writeFileSync(temp,bytes,{mode,flag:'wx'});renameSync(temp,path);
}
async function live(expected){const r=await fetch('https://staging.fanmind.ch/api/version',{redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)fail('prepare_live');const v=await r.json();if(v.application!=='fanmind'||v.runtimeEnvironment!=='staging'||v.releaseCommit!==expected)fail('prepare_live');}
export async function prepareStagingMediaHost(action,env=process.env){
 assertStagingMediaPrepare(env,action);if(process.getuid()!==0)fail('prepare_root');
 process.umask(0o022); // installed public diagnostic source must remain application-readable
 console.log('STAGING_MEDIA_PREPARE_PHASE=target');
 if(run('/usr/bin/git',['-c',`safe.directory=${process.cwd()}`,'rev-parse','HEAD']).trim()!==env.GITHUB_SHA)fail('prepare_source');
 console.log('STAGING_MEDIA_PREPARE_PHASE=source');
 if(readFileSync('/etc/systemd/system/fanmind-staging.service','utf8')!==readFileSync('ops/systemd/fanmind-staging.service','utf8')||run('/usr/bin/systemctl',['show','fanmind-staging.service','--property=User','--value']).trim()!=='fanmind-staging'||run('/usr/bin/systemctl',['show','fanmind-staging.service','--property=WorkingDirectory','--value']).trim()!=='/var/www/fanmind-staging')fail('prepare_unit');
 console.log('STAGING_MEDIA_PREPARE_PHASE=unit');
 await live(env.EXPECTED_LIVE_COMMIT);
 console.log('STAGING_MEDIA_BOOTSTRAP_AUTHORITY=existing_root_runner');
 if(action==='inspect'){console.log(`STAGING_MEDIA_FFMPEG_PRESENT=${existsSync('/usr/bin/ffmpeg')&&existsSync('/usr/bin/ffprobe')}`);console.log('STAGING_MEDIA_PREPARE=INSPECTED');return;}
 const privatePaths=['/var/www/fanmind-staging/.env.production','/var/www/fanmind-staging/.release.env','/etc/fanmind-staging/runtime-secrets.env'];
 const fingerprint=()=>privatePaths.map(p=>createHash('sha256').update(readFileSync(p)).digest('hex')).join(':');
 const before=fingerprint();
 console.log('STAGING_MEDIA_PREPARE_PHASE=private_config');
 if(!existsSync('/usr/bin/ffmpeg')||!existsSync('/usr/bin/ffprobe')){
  run('/usr/bin/apt-get',['update'],180000);
  assertNoPackageUpgrade(run('/usr/bin/apt-get',['--simulate','--no-upgrade','--no-install-recommends','install','ffmpeg']));
  run('/usr/bin/apt-get',['--assume-yes','--no-upgrade','--no-install-recommends','install','ffmpeg'],240000);
 }
 console.log('STAGING_MEDIA_PREPARE_PHASE=packages');
 for(const binary of ['/usr/bin/ffmpeg','/usr/bin/ffprobe']){const s=lstatSync(binary);if(!s.isFile()||s.uid!==0||(s.mode&0o022))fail('prepare_binary');}
 for(const path of ['/usr/local','/usr/local/lib','/usr/local/sbin','/var/lib','/etc/sudoers.d',BASE,BASE+'/releases',BASE+'/releases/'+env.GITHUB_SHA,'/var/lib/fanmind-staging-media','/etc/systemd/system/fanmind-staging.service.d'])directory(path);
 console.log('STAGING_MEDIA_PREPARE_PHASE=paths');
 const target=BASE+'/releases/'+env.GITHUB_SHA,host=readFileSync('scripts/operations/chat-admin-media-host-readiness.mjs'),control=readFileSync('scripts/operations/staging-media-probe-control.mjs');
 install(target+'/host.mjs',host);install(target+'/control.mjs',control);
 install(target+'/manifest.json',JSON.stringify({version:1,source:env.GITHUB_SHA,hostSha256:createHash('sha256').update(host).digest('hex'),controlSha256:createHash('sha256').update(control).digest('hex')})+'\n');
 const next=BASE+'/current.'+process.pid;symlinkSync(target,next);renameSync(next,BASE+'/current');
 if(!existsSync('/var/lib/fanmind-staging-media/probe.lock'))install('/var/lib/fanmind-staging-media/probe.lock','',0o600);
 install('/usr/local/sbin/fanmind-staging-media-probe','#!/bin/sh\numask 077\nexec /usr/bin/flock --nonblock /var/lib/fanmind-staging-media/probe.lock /usr/bin/node /usr/local/lib/fanmind-staging-media/current/control.mjs "$@"\n',0o755);
 console.log('STAGING_MEDIA_PREPARE_PHASE=installed');
 const sudoers='fanmind-staging ALL=(root) NOPASSWD: /usr/local/sbin/fanmind-staging-media-probe\n';
 const check='/etc/sudoers.d/fanmind-staging-media-probe.check';
 try{install(check,sudoers,0o440);run('/usr/sbin/visudo',['--check','--file',check]);renameSync(check,'/etc/sudoers.d/fanmind-staging-media-probe');}finally{try{unlinkSync(check);}catch{}}
 console.log('STAGING_MEDIA_PREPARE_PHASE=sudoers');
 const limits='/etc/systemd/system/fanmind-staging.service.d/20-chat-admin-media.conf';
 if(existsSync(limits)&&readFileSync(limits,'utf8')!==MEDIA_LIMITS)fail('prepare_limits_drift');
 install(limits,MEDIA_LIMITS);run('/usr/bin/systemctl',['daemon-reload']);
 console.log('STAGING_MEDIA_PREPARE_PHASE=limits');
 if(fingerprint()!==before)fail('prepare_config_changed');
 await live(env.EXPECTED_LIVE_COMMIT);
 console.log('STAGING_MEDIA_PRIVATE_CONFIG=UNCHANGED');console.log('STAGING_MEDIA_DEPLOYMENT=NOT_PERFORMED');console.log('STAGING_MEDIA_PREPARE=PASS');
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){try{await prepareStagingMediaHost(process.argv[2]);}catch{console.error('STAGING_MEDIA_PREPARE=BLOCK');process.exitCode=1;}}
