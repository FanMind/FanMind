#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {readFileSync,readlinkSync,statSync,lstatSync,statfsSync,mkdirSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const ORIGIN='https://staging.fanmind.ch',UNIT='fanmind-staging.service';
const SAFE_ENV={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'};
const SHA=/^[a-f0-9]{40}$/u;
const PROPERTIES=['ActiveState','SubState','MainPID','User','Group','PrivateTmp','UMask','NoNewPrivileges','ProtectSystem','ControlGroup','MemoryMax','MemoryHigh','CPUQuotaPerSecUSec','TasksMax'];
const run=(command,args)=>execFileSync(command,args,{env:SAFE_ENV,encoding:'utf8',timeout:30000,killSignal:'SIGKILL',maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']});
const fail=code=>{throw Error(code);};

export function assertMediaHostDispatch(env,action){
 if(!['inspect','probe','cleanup'].includes(action)||env.GITHUB_REPOSITORY!=='FanMind/FanMind'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||
  !SHA.test(env.GITHUB_SHA??'')||env.REVIEWED_COMMIT!==env.GITHUB_SHA||!SHA.test(env.EXPECTED_LIVE_COMMIT??'')||
  env.CONFIRMATION!==`${action==='cleanup'?'probe':action}-staging-media-host`||env.FANMIND_RUNTIME_ENVIRONMENT!=='staging'||
  env.FANMIND_TARGET_SUPABASE_PROJECT_REF!=='vshyhvgcmrlagvfnvomc'||env.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF!=='drqkpdvtbbrrdwmtrodz'||
  !/^[1-9][0-9]{0,19}$/u.test(env.GITHUB_RUN_ID??'')||!/^[1-9][0-9]{0,3}$/u.test(env.GITHUB_RUN_ATTEMPT??''))fail('dispatch_boundary');
}

export function assessMediaApplicationContext(snapshot){
 const blockers=[];
 if(snapshot.active!=='active'||snapshot.sub!=='running'||snapshot.user!=='fanmind-staging'||snapshot.group!=='fanmind-staging')blockers.push('application_identity');
 if(!snapshot.sameUid||!snapshot.sameGid)blockers.push('application_uid_context');
 if(!snapshot.sameMount)blockers.push('application_mount_namespace_entry_required');
 if(!snapshot.sameCgroup)blockers.push('application_cgroup_execution_required');
 if(!snapshot.sameSecurity||!snapshot.sameProcessLimits)blockers.push('application_security_context');
 if(!['yes','disconnected'].includes(snapshot.privateTmp)||snapshot.umask!=='0077'||snapshot.noNewPrivileges!=='yes'||snapshot.protectSystem!=='strict')blockers.push('application_sandbox');
 if(!snapshot.tempAccessible||snapshot.tempFreeBytes<256*1024*1024)blockers.push('application_private_temp');
 if(!Number.isFinite(snapshot.memoryMax)||snapshot.memoryMax<512*1024*1024||!Number.isFinite(snapshot.cpuQuota)||snapshot.cpuQuota<=0||!Number.isFinite(snapshot.tasksMax)||snapshot.tasksMax<8)blockers.push('application_resource_limits');
 return blockers;
}

function numberOrInfinity(text){return /^[0-9]+$/u.test(text??'')?Number(text):Infinity;}
function cpuQuota(text){
 const match=/^([0-9]+(?:\.[0-9]+)?)(us|ms|s)$/u.exec(text??'');
 return match?Number(match[1])*({us:1,ms:1000,s:1000000}[match[2]]):Infinity;
}
function service(){
 let text;
 try{text=run('/usr/bin/systemctl',['show',UNIT,'--no-pager',...PROPERTIES.map(key=>`--property=${key}`)]);}
 catch{fail('service_metadata_inspection_required');}
 const values=Object.fromEntries(text.trim().split('\n').map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
 if(!/^[1-9][0-9]{0,9}$/u.test(values.MainPID??''))fail('application_process_unavailable');
 return values;
}
function processIdentity(pid){
 const status=readFileSync(`/proc/${pid}/status`,'utf8');
 const ids=key=>new RegExp(`^${key}:\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)`,'m').exec(status)?.slice(1).map(Number);
 return {uids:ids('Uid'),gids:ids('Gid')};
}
function hostSnapshot(){
 const state=service(),pid=state.MainPID,identity=processIdentity(pid);
 const temp=`/proc/${pid}/root/tmp`;
 let tempAccessible=false,tempFreeBytes=0;
 try{const data=statfsSync(temp);tempFreeBytes=Number(data.bavail)*Number(data.bsize);tempAccessible=statSync(temp).isDirectory();}catch{/* fixed blocker only */}
 const sameMount=readlinkSync('/proc/self/ns/mnt')===readlinkSync(`/proc/${pid}/ns/mnt`);
 // Joining a cgroup namespace is not cgroup membership. Compare membership.
 const cgroup=readFileSync(`/proc/${pid}/cgroup`,'utf8');
 if(!cgroup.split('\n').some(line=>line.split(':').at(-1)===state.ControlGroup))fail('application_cgroup_binding');
 if(readlinkSync(`/proc/${pid}/cwd`)!=='/var/www/fanmind-staging')fail('application_directory_binding');
 const security=target=>{
  const status=readFileSync(`/proc/${target}/status`,'utf8');
  return ['Umask','Groups','NoNewPrivs','Seccomp','Seccomp_filters','CapEff'].map(key=>status.match(new RegExp(`^${key}:\\s*(.+)$`,'m'))?.[1]?.trim()??'missing').join('|');
 };
 const sameSecurity=security('self')===security(pid)&&readFileSync('/proc/self/attr/current','utf8')===readFileSync(`/proc/${pid}/attr/current`,'utf8');
 return {pid,active:state.ActiveState,sub:state.SubState,user:state.User,group:state.Group,
  sameUid:identity.uids?.every(id=>id===process.getuid())===true,sameGid:identity.gids?.every(id=>id===process.getgid())===true,
  sameMount,sameCgroup:readFileSync('/proc/self/cgroup','utf8')===cgroup,
  sameSecurity,sameProcessLimits:readFileSync('/proc/self/limits','utf8')===readFileSync(`/proc/${pid}/limits`,'utf8'),
  privateTmp:state.PrivateTmp,umask:state.UMask,noNewPrivileges:state.NoNewPrivileges,protectSystem:state.ProtectSystem,
  memoryMax:numberOrInfinity(state.MemoryMax),cpuQuota:cpuQuota(state.CPUQuotaPerSecUSec),tasksMax:numberOrInfinity(state.TasksMax),tempAccessible,tempFreeBytes};
}

function protectedBinary(path,pid){
 let host,application;
 try{host=statSync(path);application=statSync(`/proc/${pid}/root${path}`);}
 catch(error){fail(['EACCES','EPERM'].includes(error?.code)?'application_binary_inspection_required':'video_tooling_unavailable');}
 if(!host.isFile()||host.uid!==0||(host.mode&0o022)!==0||(host.mode&0o111)===0||host.dev!==application.dev||host.ino!==application.ino)fail('application_binary_binding');
}
export function mediaCodecsAvailable(listings){
 const has=(list,name)=>new RegExp(`(?:^|\\n)\\s*\\S+\\s+${name}(?:\\s|$)`,'u').test(list);
 return ['libx264','aac'].every(name=>has(listings.encoders,name))&&
  ['h264','hevc','av1','vp8','vp9','aac','opus','vorbis'].every(name=>has(listings.decoders,name))&&
  /\bmov,mp4,m4a,3gp,3g2,mj2\b/u.test(listings.demuxers)&&/\bmatroska,webm\b/u.test(listings.demuxers);
}

export function syntheticMediaProbe(directory,{execute=run,onDirectory=()=>{},marker={}}={}){
 // Only a fresh owned 0700 directory, never user paths or existing data.
 mkdirSync(directory,{mode:0o700});
 const root=lstatSync(directory);
 if(root.isSymbolicLink()||!root.isDirectory()||root.uid!==process.getuid()||(root.mode&0o777)!==0o700)fail('synthetic_directory_unsafe');
 onDirectory(directory);
 try{
  writeFileSync(join(directory,'probe-owner'),JSON.stringify({...marker,pid:process.pid}),{mode:0o600,flag:'wx'});
  for(const kind of ['mp4','webm']){
   const input=join(directory,`synthetic.${kind}`),output=join(directory,`normalized-${kind}.mp4`);
   // Neutral generated signal. Extra fixture encoders are diagnostic tooling,
   // not additional production input-format requirements.
   execute('/usr/bin/ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=64x64:r=10:d=1','-f','lavfi','-i','sine=frequency=440:duration=1','-threads','1','-c:v',kind==='mp4'?'libx264':'libvpx-vp9','-c:a',kind==='mp4'?'aac':'libopus','-shortest',input]);
   execute('/usr/bin/ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-max_alloc','67108864','-threads','1','-protocol_whitelist','file','-f',kind==='mp4'?'mov':'matroska,webm',...(kind==='mp4'?['-enable_drefs','0','-use_absolute_path','0']:[]),'-i',input,'-map','0:v:0','-map','0:a:0?','-sn','-dn','-map_metadata','-1','-map_chapters','-1','-c:v','libx264','-pix_fmt','yuv420p','-threads','1','-c:a','aac','-movflags','+faststart','-fs','26214400','-f','mp4',output]);
   const probe=JSON.parse(execute('/usr/bin/ffprobe',['-v','error','-protocol_whitelist','file','-f','mov','-enable_drefs','0','-use_absolute_path','0','-show_entries','format=duration:stream=codec_type,codec_name,width,height','-of','json',output]));
   const video=probe.streams?.filter(s=>s.codec_type==='video'),audio=probe.streams?.filter(s=>s.codec_type==='audio');
   if(video?.length!==1||video[0].codec_name!=='h264'||video[0].width!==64||video[0].height!==64||audio?.length!==1||audio[0].codec_name!=='aac'||!Number.isFinite(Number(probe.format?.duration))||Number(probe.format?.duration)<0.5||Number(probe.format?.duration)>2||statSync(output).size>26214400)fail('synthetic_conversion_invalid');
  }
  writeFileSync(join(directory,'invalid.mp4'),'invalid',{mode:0o600,flag:'wx'});
  let rejected=false;
  try{execute('/usr/bin/ffprobe',['-v','error','-protocol_whitelist','file','-f','mov','-show_entries','format=duration','-of','json',join(directory,'invalid.mp4')]);}catch{rejected=true;}
  if(!rejected)fail('synthetic_invalid_input_accepted');
 }finally{
  rmSync(directory,{recursive:true,force:true});
  if(existsSync(directory))fail('synthetic_cleanup_failed');
  onDirectory(undefined);
 }
}

function probeDirectory(env){return `/tmp/fanmind-media-readiness-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`;}
async function version(expected,origin=ORIGIN){
 const response=await fetch(origin+'/api/version',{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok)fail('live_version_unavailable');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536)fail('live_version_unavailable');chunks.push(value);}}
 finally{await reader.cancel().catch(()=>{});}
 const body=Buffer.concat(chunks).toString('utf8');
 const value=JSON.parse(body);
 if(value.application!=='fanmind'||value.runtimeEnvironment!=='staging'||value.releaseCommit!==expected)fail('live_version_changed');
}
export async function runMediaHostReadiness(action,env=process.env){
 assertMediaHostDispatch(env,action);
 if(run('/usr/bin/git',['rev-parse','HEAD']).trim()!==env.GITHUB_SHA)fail('checkout_binding');
 await version(env.EXPECTED_LIVE_COMMIT);
 await version(env.EXPECTED_LIVE_COMMIT,'http://127.0.0.1:3001');
 let snapshot;
 try{snapshot=hostSnapshot();}catch(error){
  if(['EACCES','EPERM'].includes(error?.code))fail('application_proc_inspection_required');
  throw error;
 }
 console.log('MEDIA_HOST_SERVICE_OBSERVED=true');
 const blockers=assessMediaApplicationContext(snapshot);
 for(const code of blockers)console.log(`MEDIA_HOST_BLOCKER=${code}`);
 for(const [key,value] of Object.entries({sameUid:snapshot.sameUid,sameGid:snapshot.sameGid,sameMount:snapshot.sameMount,sameCgroup:snapshot.sameCgroup,sameSecurity:snapshot.sameSecurity,sameProcessLimits:snapshot.sameProcessLimits,privateTempAccessible:snapshot.tempAccessible,boundedMemory:Number.isFinite(snapshot.memoryMax),boundedCpu:Number.isFinite(snapshot.cpuQuota),boundedTasks:Number.isFinite(snapshot.tasksMax)}))console.log(`MEDIA_HOST_${key}=${value}`);
 for(const path of ['/usr/bin/ffmpeg','/usr/bin/ffprobe']){
  protectedBinary(path,snapshot.pid);
  const output=run(path,['-version']),name=path.endsWith('ffprobe')?'ffprobe':'ffmpeg';
  const detected=new RegExp(`^${name} version ([0-9]+(?:\\.[0-9]+){1,3})`,'u').exec(output);
  if(!detected)fail('video_tooling_unavailable');
  console.log(`MEDIA_HOST_${name.toUpperCase()}_VERSION=${detected[1]}`);
 }
 const codecs=mediaCodecsAvailable({encoders:run('/usr/bin/ffmpeg',['-hide_banner','-encoders']),decoders:run('/usr/bin/ffmpeg',['-hide_banner','-decoders']),demuxers:run('/usr/bin/ffmpeg',['-hide_banner','-demuxers'])});
 console.log(`MEDIA_HOST_REQUIRED_CODECS=${codecs}`);
 for(const [key,value] of Object.entries({MEMORY_MAX_BYTES:snapshot.memoryMax,CPU_QUOTA_US_PER_SECOND:snapshot.cpuQuota,TASKS_MAX:snapshot.tasksMax,TEMP_FREE_BYTES:snapshot.tempFreeBytes}))console.log(`MEDIA_HOST_${key}=${Number.isFinite(value)?value:'unbounded'}`);
 if(!codecs)blockers.push('video_codecs_unavailable');
 if(action==='probe'||action==='cleanup'){
  // Never mistake execution on the same host/UID for application execution.
  if(blockers.length)fail('application_context_not_proven');
  const directory=probeDirectory(env);
  const marker={source:env.GITHUB_SHA,run:env.GITHUB_RUN_ID,attempt:env.GITHUB_RUN_ATTEMPT,live:env.EXPECTED_LIVE_COMMIT};
  if(action==='cleanup'){
   if(existsSync(directory)){
    const state=lstatSync(directory),marker=JSON.parse(readFileSync(join(directory,'probe-owner'),'utf8'));
    if(state.isSymbolicLink()||state.uid!==process.getuid()||(state.mode&0o777)!==0o700||!Number.isSafeInteger(marker.pid)||
      marker.source!==env.GITHUB_SHA||marker.run!==env.GITHUB_RUN_ID||marker.attempt!==env.GITHUB_RUN_ATTEMPT||marker.live!==env.EXPECTED_LIVE_COMMIT)fail('synthetic_directory_unsafe');
    rmSync(directory,{recursive:true,force:true});
   }
  }else{
   let owned;
   const cleanup=()=>{if(owned)rmSync(owned,{recursive:true,force:true});process.exit(2);};
   process.once('SIGTERM',cleanup);process.once('SIGINT',cleanup);
   try{syntheticMediaProbe(directory,{marker,onDirectory:value=>{owned=value;}});console.log('MEDIA_HOST_MP4_WEBM_PROBES=PASS');}
   finally{process.removeListener('SIGTERM',cleanup);process.removeListener('SIGINT',cleanup);}
  }
  console.log(`MEDIA_HOST_SYNTHETIC_CLEANUP=${existsSync(directory)?'FAIL':'PASS'}`);
 }
 if(service().MainPID!==snapshot.pid)fail('application_process_changed');
 await version(env.EXPECTED_LIVE_COMMIT);
 await version(env.EXPECTED_LIVE_COMMIT,'http://127.0.0.1:3001');
 console.log(`MEDIA_HOST_READINESS=${blockers.length?'BLOCK':action==='probe'?'PASS':action==='cleanup'?'CLEANED':'INSPECTED'}`);
 if(blockers.length)process.exitCode=2;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 try{await runMediaHostReadiness(process.argv[2]);}
 catch(error){
  const allowed=['dispatch_boundary','service_metadata_inspection_required','application_proc_inspection_required','application_binary_inspection_required','application_process_unavailable','application_cgroup_binding','application_directory_binding','application_binary_binding','application_context_not_proven','video_tooling_unavailable','synthetic_directory_unsafe','synthetic_conversion_invalid','synthetic_invalid_input_accepted','synthetic_cleanup_failed','live_version_unavailable','live_version_changed','checkout_binding','application_process_changed'];
  console.error(`MEDIA_HOST_BLOCKER=${allowed.includes(error?.message)?error.message:'host_probe_unavailable'}`);process.exitCode=2;
 }
}
