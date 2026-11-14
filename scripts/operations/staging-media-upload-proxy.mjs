#!/usr/bin/env node
import {readFileSync,writeFileSync,renameSync,unlinkSync,openSync,closeSync,fstatSync,lstatSync,realpathSync,constants} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const CONFIG='/etc/nginx/sites-available/fanmind-staging';
const ACTIVE='/etc/nginx/sites-enabled/fanmind-staging';
const ORIGIN='https://staging.fanmind.ch';
const SHA=/^[a-f0-9]{40}$/u;
const fail=code=>{throw Error(code);};
const PROXY=['proxy_pass http://127.0.0.1:3001;','proxy_http_version 1.1;','proxy_set_header Host $host;','proxy_set_header X-Real-IP $remote_addr;','proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;','proxy_set_header X-Forwarded-Proto $scheme;','proxy_set_header Upgrade $http_upgrade;','proxy_set_header Connection "upgrade";'];
export const UPLOAD_LIMITS=[['/api/chatadmin/media',7100000],['/api/chatadmin/media/catalogue',35100000]];
export const UPLOAD_BLOCK='    # FANMIND_CHATADMIN_UPLOAD_LIMITS_BEGIN\n'+UPLOAD_LIMITS.map(([path,bytes])=>'    location = '+path+' {\n        client_max_body_size '+bytes+';\n'+PROXY.map(s=>'        '+s+'\n').join('')+'    }\n').join('')+'    # FANMIND_CHATADMIN_UPLOAD_LIMITS_END\n';
export function assertProxyTarget(env,action){
 if(!['verify','apply'].includes(action)||env.GITHUB_REPOSITORY!=='FanMind/FanMind'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.GITHUB_ACTOR!=='Bernds-tech'||env.RUNNER_NAME!=='fanmind-prod-01-exoscale'||!SHA.test(env.GITHUB_SHA??'')||env.REVIEWED_COMMIT!==env.GITHUB_SHA||env.EXPECTED_STAGING_COMMIT!==env.GITHUB_SHA||env.CONFIRMATION!=='staging-media-upload-proxy-'+action||env.STAGING_APP_URL!==ORIGIN)fail('proxy_target');
}
export function planUploadProxy(source,selectTlsEnd){
 if(typeof source!=='string'||source.length>1048576)fail('proxy_config');
 const marked=source.includes('FANMIND_CHATADMIN_UPLOAD_LIMITS');
 const base=marked?source.replace(UPLOAD_BLOCK,''):source;
 if(base.includes('FANMIND_CHATADMIN_UPLOAD_LIMITS')||base.includes('/api/chatadmin/media'))fail('proxy_existing_route');
 const roots=[...base.matchAll(/^[ \t]*location \/ \{\r?\n([^{}]*)^[ \t]*\}/gm)];
 const normalize=s=>s.split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).join('\n');
 if(roots.length!==1||normalize(roots[0][1])!==PROXY.join('\n'))fail('proxy_upstream_drift');
 const lines=base.split('\n'),end=selectTlsEnd(base);
 if(!Number.isSafeInteger(end)||end<1||lines[end-1].trim()!=='}')fail('proxy_tls_boundary');
 lines.splice(end-1,0,UPLOAD_BLOCK.trimEnd());const next=lines.join('\n');
 if(marked&&source!==next)fail('proxy_block_drift');
 return {state:marked?'READY':'ABSENT',next};
}
// Testable transaction: never overwrite a concurrent change, and never reload
// unrelated nginx configuration that appeared during this operation.
export async function applyProxyPlan({before,next,read,write,global,check,reload,probe,onRollback=()=>{}}){
 const baseline=global();let reloaded=false;
 const unchanged=()=>{if(read()!==next||global().replace(UPLOAD_BLOCK,'')!==baseline)fail('proxy_concurrent_config');};
 if(read()!==before)fail('proxy_concurrent_config');write(next);
 try{check();unchanged();reload();reloaded=true;await probe();unchanged();return 'PASS';}
 catch(error){
  if(read()!==next)fail('proxy_concurrent_config');
  if(reloaded&&global().replace(UPLOAD_BLOCK,'')!==baseline)fail('proxy_concurrent_config');
  write(before);check();
  if(reloaded){if(global()!==baseline)fail('proxy_rollback_drift');reload();}
  if(read()!==before)fail('proxy_rollback_failed');onRollback();throw error;
 }
}
const SAFE={PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C'};
function command(path,args,input){const r=spawnSync(path,args,{env:SAFE,input,encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});if(r.error||r.status!==0)fail('proxy_host_operation');return r.stdout;}
function protectedConfig(){
 const fd=openSync(CONFIG,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{const s=fstatSync(fd);if(!s.isFile()||s.uid!==0||s.nlink!==1||s.gid!==0||(s.mode&0o777)!==0o644||s.size>1048576)fail('proxy_file');return readFileSync(fd,'utf8');}finally{closeSync(fd);}
}
function replace(source){const path=CONFIG+'.media-'+randomBytes(12).toString('hex');try{writeFileSync(path,source,{flag:'wx',mode:0o644});renameSync(path,CONFIG);}finally{try{unlinkSync(path);}catch{}}}
function selectTlsEnd(source){
 const text=command('/usr/bin/awk',['-v','expected_certificate=/etc/letsencrypt/live/staging.fanmind.ch/fullchain.pem','-v','expected_certificate_key=/etc/letsencrypt/live/staging.fanmind.ch/privkey.pem','-v','output_mode=media_end_line','-f',fileURLToPath(new URL('./verify-staging-nginx-whatsapp-boundary.awk',import.meta.url))],source).trim();
 if(!/^[1-9][0-9]*$/u.test(text))fail('proxy_tls_boundary');return Number(text);
}
async function live(sha){const r=await fetch(ORIGIN+'/api/version',{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)fail('proxy_release');const v=await r.json();if(v.application!=='fanmind'||v.runtimeEnvironment!=='staging'||v.releaseCommit!==sha)fail('proxy_release');}
async function transport(){
 for(const [path,size] of UPLOAD_LIMITS){
  const body=Buffer.alloc(size,32);body.write('{}');
  const r=await fetch(ORIGIN+path,{method:'POST',headers:{Origin:ORIGIN,'Content-Type':'application/json'},body,redirect:'error',signal:AbortSignal.timeout(30000)});
  if(r.status!==401||!r.headers.get('content-type')?.includes('application/json')||(await r.text()).trim()!=='{"error":"unauthenticated"}')fail('proxy_transport');
 }
}
export async function runProxy(action,env=process.env){
 assertProxyTarget(env,action);if(process.getuid()!==0)fail('proxy_root');
 for(const path of ['/etc/nginx','/etc/nginx/sites-available','/etc/nginx/sites-enabled']){const s=lstatSync(path);if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==0||(s.mode&0o022))fail('proxy_directory');}
 if(!lstatSync(ACTIVE).isSymbolicLink()||realpathSync(ACTIVE)!==CONFIG)fail('proxy_active_binding');
 await live(env.GITHUB_SHA);const before=protectedConfig(),plan=planUploadProxy(before,selectTlsEnd);
 command('/usr/sbin/nginx',['-t']);
 if(action==='verify'){if(plan.state==='READY')await transport();console.log('STAGING_MEDIA_UPLOAD_PROXY='+plan.state);return;}
 if(plan.state==='READY'){await transport();console.log('STAGING_MEDIA_UPLOAD_PROXY=PASS');return;}
 await applyProxyPlan({before,next:plan.next,read:protectedConfig,write:replace,global:()=>command('/usr/sbin/nginx',['-T']),check:()=>command('/usr/sbin/nginx',['-t']),reload:()=>command('/usr/bin/systemctl',['reload','nginx']),probe:async()=>{await live(env.GITHUB_SHA);await transport();},onRollback:()=>console.log('STAGING_MEDIA_UPLOAD_PROXY_ROLLBACK=PASS')});
 console.log('STAGING_MEDIA_UPLOAD_PROXY=PASS');
}
if(process.argv[1]===fileURLToPath(import.meta.url)){try{await runProxy(process.argv[2]);}catch(error){console.error('STAGING_MEDIA_UPLOAD_PROXY=BLOCK');console.error('STAGING_MEDIA_UPLOAD_PROXY_REASON='+(['proxy_target','proxy_config','proxy_existing_route','proxy_upstream_drift','proxy_tls_boundary','proxy_block_drift','proxy_concurrent_config','proxy_rollback_drift','proxy_rollback_failed','proxy_host_operation','proxy_file','proxy_release','proxy_transport','proxy_root','proxy_directory','proxy_active_binding'].includes(error?.message)?error.message:'operation_failed'));process.exitCode=1;}}
