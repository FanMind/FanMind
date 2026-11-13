#!/usr/bin/env node
// Root-owned, fixed Staging diagnostic only. No user paths, commands or env.
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,statSync,lstatSync,realpathSync,renameSync,existsSync,unlinkSync,constants,openSync,fstatSync,closeSync,fchmodSync,fsyncSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const SAFE={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'};
const UNIT='fanmind-staging.service',CGROUP='/system.slice/fanmind-staging.service';
const BASE='/usr/local/lib/fanmind-staging-media';
const fail=code=>{throw Error(code);};
const run=(cmd,args)=>execFileSync(cmd,args,{env:SAFE,encoding:'utf8',timeout:15000,maxBuffer:65536,stdio:['ignore','pipe','pipe']}).trim();
export function validateProbeArguments(args){
 if(args.length!==5||args[0]!=='probe'||!args.slice(1,3).every(x=>/^[a-f0-9]{40}$/u.test(x))||!args.slice(3).every(x=>/^[1-9][0-9]{0,19}$/u.test(x)))fail('probe_arguments');
 return {source:args[1],live:args[2],run:args[3],attempt:args[4]};
}
export function probeLimitArguments(text){
 const names=new Set(['AS','CORE','CPU','DATA','FSIZE','LOCKS','MEMLOCK','MSGQUEUE','NICE','NOFILE','NPROC','RSS','RTPRIO','RTTIME','SIGPENDING','STACK']);
 const found=new Set(),args=[];
 for(const line of text.trim().split('\n')){
  const [name,soft,hard,...extra]=line.trim().split(/\s+/u);
  if(!names.has(name)||found.has(name)||extra.length||![soft,hard].every(x=>/^(?:[0-9]+|unlimited)$/u.test(x??'')))fail('probe_limits');
  found.add(name);args.push(`--${name.toLowerCase()}=${soft}:${hard}`);
 }
 if(found.size!==names.size)fail('probe_limits');
 return args;
}
function rootFile(path){
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{const st=fstatSync(fd);
 if(!st.isFile()||st.uid!==0||st.nlink!==1||(st.mode&0o022)||st.size>1048576)fail('probe_source_ownership');
 const bytes=readFileSync(fd),after=fstatSync(fd);
 if(st.ino!==after.ino||st.size!==after.size||st.mtimeMs!==after.mtimeMs||st.ctimeMs!==after.ctimeMs)fail('probe_source_changed');
 return bytes;
 }finally{closeSync(fd);}
}
export function writeMediaProbeReceipt(path,receipt){
 const temporary=path+`.${process.pid}`;
 const fd=openSync(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
 try{writeFileSync(fd,JSON.stringify(receipt)+'\n');fchmodSync(fd,0o644);fsyncSync(fd);}finally{closeSync(fd);}
 renameSync(temporary,path);
}
export async function runStagingProbe(args){
 const input=validateProbeArguments(args);if(process.getuid()!==0)fail('probe_root_required');
 const receiptPath='/var/lib/fanmind-staging-media/receipt.json';
 if(existsSync(receiptPath)){rootFile(receiptPath);unlinkSync(receiptPath);}
 const directory=`${BASE}/releases/${input.source}`;
 for(const path of ['/usr/local/lib',BASE,BASE+'/releases',directory]){const s=lstatSync(path);if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==0||(s.mode&0o022))fail('probe_source_ownership');}
 const manifest=JSON.parse(rootFile(join(directory,'manifest.json')).toString('utf8'));
 if(manifest.source!==input.source||realpathSync(fileURLToPath(import.meta.url))!==join(directory,'control.mjs')||
  createHash('sha256').update(rootFile(join(directory,'host.mjs'))).digest('hex')!==manifest.hostSha256||
  createHash('sha256').update(rootFile(join(directory,'control.mjs'))).digest('hex')!==manifest.controlSha256)fail('probe_source_binding');
 console.log('STAGING_MEDIA_PROBE_PHASE=source');
 const pid=run('/usr/bin/systemctl',['show',UNIT,'--property=MainPID','--value']);
 if(!/^[1-9][0-9]{0,9}$/u.test(pid)||run('/usr/bin/systemctl',['show',UNIT,'--property=ControlGroup','--value'])!==CGROUP)fail('probe_service_binding');
 const uid=run('/usr/bin/id',['-u','fanmind-staging']),gid=run('/usr/bin/id',['-g','fanmind-staging']);
 const status=readFileSync(`/proc/${pid}/status`,'utf8');
 const ids=key=>status.match(new RegExp(`^${key}:\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)`,'m'))?.slice(1);
 if(!ids('Uid')?.every(x=>x===uid)||!ids('Gid')?.every(x=>x===gid)||readFileSync(`/proc/${pid}/cgroup`,'utf8').trim()!==`0::${CGROUP}`)fail('probe_service_binding');
 const groups=status.match(/^Groups:\s*(.*)$/m)?.[1].trim().split(/\s+/u);
 if(!groups?.length||groups.some(x=>!/^\d+$/u.test(x)))fail('probe_service_binding');
 console.log('STAGING_MEDIA_PROBE_PHASE=identity');
 const limits=probeLimitArguments(run('/usr/bin/prlimit',['--pid',pid,'--noheadings','--output','RESOURCE,SOFT,HARD']));
 console.log('STAGING_MEDIA_PROBE_PHASE=limits');
 const cgroup=`/sys/fs/cgroup${CGROUP}`;
 if(realpathSync(cgroup)!==cgroup||statSync(cgroup).uid!==0)fail('probe_cgroup_binding');
 // Only this fixed helper's own PID is attached; no service or config is moved.
 writeFileSync(cgroup+'/cgroup.procs',String(process.pid));
 console.log('STAGING_MEDIA_PROBE_PHASE=cgroup');
 process.umask(0o077);
 const env={...SAFE,GITHUB_REPOSITORY:'FanMind/FanMind',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_SHA:input.source,REVIEWED_COMMIT:input.source,EXPECTED_LIVE_COMMIT:input.live,GITHUB_RUN_ID:input.run,GITHUB_RUN_ATTEMPT:input.attempt,CONFIRMATION:'probe-staging-media-host',FANMIND_RUNTIME_ENVIRONMENT:'staging',FANMIND_TARGET_SUPABASE_PROJECT_REF:'vshyhvgcmrlagvfnvomc',FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:'drqkpdvtbbrrdwmtrodz'};
 const execute=action=>{
  const code=`import {runMediaHostReadiness} from ${JSON.stringify(pathToFileURL(join(directory,'host.mjs')).href)};try{await runMediaHostReadiness('${action}');}catch{console.log('MEDIA_HOST_BLOCKER=installed_probe_execution_failed');process.exitCode=1;}`;
  const result=spawnSync('/usr/bin/prlimit',[...limits,'--','/usr/bin/nsenter','--target',pid,'--mount','--','/usr/bin/setpriv',`--reuid=${uid}`,`--regid=${gid}`,`--groups=${groups.join(',')}`,'--inh-caps=-all','--ambient-caps=-all','--bounding-set=-all','--no-new-privs','/usr/bin/node','--input-type=module','-e',code],{cwd:'/var/www/fanmind-staging',env,encoding:'utf8',timeout:150000,killSignal:'SIGKILL',maxBuffer:65536,detached:true,stdio:['ignore','pipe','pipe']});
  if(result.error||result.status!==0){try{process.kill(-result.pid,'SIGKILL');}catch{/* group already gone */}}
  return result;
 };
 const result=execute('probe'),cleanup=execute('cleanup');
 const output=((result.stdout??'')+'\n'+(result.stderr??'')).split('\n').filter(line=>/^MEDIA_HOST_[A-Za-z0-9_]+=[A-Za-z0-9_.-]+$/u.test(line));
 for(const line of output)console.log(line);
 if(result.error||result.status!==0||cleanup.error||cleanup.status!==0||!output.includes('MEDIA_HOST_READINESS=PASS')||!output.includes('MEDIA_HOST_SYNTHETIC_CLEANUP=PASS'))fail('probe_context_failed');
 if(run('/usr/bin/systemctl',['show',UNIT,'--property=MainPID','--value'])!==pid)fail('probe_process_changed');
 const receipt={version:1,source:input.source,live:input.live,pid:Number(pid),completedAt:new Date().toISOString(),result:'PASS',run:input.run};
 writeMediaProbeReceipt(receiptPath,receipt);
 console.log('STAGING_MEDIA_PROBE_RECEIPT=PASS');
}
if(process.argv[1]&&pathToFileURL(realpathSync(resolve(process.argv[1]))).href===import.meta.url){try{await runStagingProbe(process.argv.slice(2));}catch{console.error('STAGING_MEDIA_PROBE=BLOCK');process.exitCode=1;}}
