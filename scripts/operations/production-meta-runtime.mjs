#!/usr/bin/env node
// Production-only controller. No connection/token copying, schema or CRM writes.
import { constants, openSync, fstatSync, closeSync, readFileSync, writeFileSync, renameSync, unlinkSync, fsyncSync, chownSync, lstatSync, realpathSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderMetaConfiguration, validMetaKey } from './staging-meta-runtime.mjs';
import { changeStagingRuntime, waitForStagingRelease } from './staging-support-media-runtime.mjs';
import { buildSupabaseApiKeyHeaders } from '../../src/lib/supabase/apiKeyPolicy.mjs';
import { META_GRAPH_API_VERSION } from '../../src/lib/metaIntegrationPolicy.mjs';
export const APP = '2214477125984114';
const ROOT = '/var/www/fanmind', ENV = ROOT + '/.env.production', CURRENT = '/var/www/fanmind-current';
const ORIGIN = 'https://fanmind.ch', CALLBACK = ORIGIN + '/api/integrations/facebook/callback';
const PROJECT = 'drqkpdvtbbrrdwmtrodz';
const FIELDS = ['FACEBOOK_APP_ID','FACEBOOK_APP_SECRET','FACEBOOK_REDIRECT_URI','FANMIND_TOKEN_ENCRYPTION_KEY','FACEBOOK_WEBHOOK_VERIFY_TOKEN'];
const SHA = /^[a-f0-9]{40}$/u;
const fail = code => { throw new Error(code); };
export function assertProductionMetaTarget(values, control, action) {
  if (!['inspect','configure','subscribe-webhook'].includes(action) || control.GITHUB_REPOSITORY !== 'FanMind/FanMind' ||
      control.GITHUB_REF !== 'refs/heads/main' || control.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
      control.GITHUB_ACTOR_ID !== '270165082' || !SHA.test(control.GITHUB_SHA ?? '') ||
      control.REVIEWED_COMMIT !== control.GITHUB_SHA || !SHA.test(control.LIVE_COMMIT ?? '') ||
      control.CONFIRMATION !== `production-meta-${action}` || control.META_SETUP_APP_ID !== APP ||
      !/^\d{1,20}$/u.test(control.GITHUB_RUN_ID ?? '')) fail('control_binding');
  if (values.NEXT_PUBLIC_APP_URL !== ORIGIN || values.NEXT_PUBLIC_SUPABASE_URL !== `https://${PROJECT}.supabase.co` ||
      values.FANMIND_RUNTIME_ENVIRONMENT !== 'production') fail('target_binding');
  for (const name of ['FACEBOOK_APP_ID','META_APP_ID']) {
    if (/^\d{5,32}$/u.test(values[name] ?? '') && values[name] !== APP) fail('app_conflict');
  }
}
export function productionMetaReadiness(values) {
  return { appId: values.FACEBOOK_APP_ID === APP,
    appSecret: /^[a-f0-9]{32}$/iu.test(values.FACEBOOK_APP_SECRET ?? ''),
    callback: values.FACEBOOK_REDIRECT_URI === CALLBACK,
    encryption: validMetaKey(values.FANMIND_TOKEN_ENCRYPTION_KEY),
    webhook: /^[A-Za-z0-9_-]{32,128}$/u.test(values.FACEBOOK_WEBHOOK_VERIFY_TOKEN ?? '') };
}
function execute(bin,args,env={PATH:'/usr/local/bin:/usr/bin:/bin',LANG:'C.UTF-8'}) {
  const r=spawnSync(bin,args,{encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024,env});
  if(r.error || r.status !== 0) fail('host_command_failed'); return r.stdout.trim();
}
function privateFile(path,owner) {
  const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try {
    const a=fstatSync(fd);
    if(!a.isFile() || a.nlink!==1 || ![0,owner].includes(a.uid) || ![0o600,0o640].includes(a.mode&0o777) || a.size<1 || a.size>1048576) fail('private_file_invalid');
    const text=readFileSync(fd,'utf8'), b=fstatSync(fd);
    if(a.ino!==b.ino || a.size!==b.size || a.mtimeMs!==b.mtimeMs || a.ctimeMs!==b.ctimeMs) fail('private_file_changed');
    return {text,stat:a};
  } finally {closeSync(fd);}
}
async function json(url,headers={},options={},request=fetch) {
  const r=await request(url,{...options,headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!r.ok) fail('provider_request_failed');
  const reader=r.body.getReader(),chunks=[];let size=0;
  try {for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>65536)fail('response_too_large');chunks.push(part.value);}}
  finally {await reader.cancel().catch(()=>{});}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function productionAppSubscription(values,write=false,request=fetch) {
  if(!Object.values(productionMetaReadiness(values)).every(Boolean)) fail('configuration_incomplete');
  const url=`https://graph.facebook.com/${META_GRAPH_API_VERSION}/${APP}/subscriptions`;
  const headers={Authorization:`Bearer ${APP}|${values.FACEBOOK_APP_SECRET}`};
  const validate=data=>{
    if(!Array.isArray(data?.data)||data.data.length>20||data.paging?.next)fail('subscription_inventory_invalid');
    const pages=data.data.filter(x=>x.object==='page');
    if(pages.length>1)fail('subscription_inventory_invalid');
    const p=pages[0];
    if(p && (p.callback_url!==ORIGIN+'/api/webhooks/meta'||!Array.isArray(p.fields)||p.fields.some(f=>!['messages','feed'].includes(f.name))))fail('subscription_conflict');
    return p?.active===true && new Set(p.fields.map(f=>f.name)).size===2;
  };
  if(validate(await json(url,headers,{},request)))return true;
  if(!write)return false;
  const body=new URLSearchParams({object:'page',callback_url:ORIGIN+'/api/webhooks/meta',verify_token:values.FACEBOOK_WEBHOOK_VERIFY_TOKEN,fields:'messages,feed'});
  if((await json(url,{...headers,'Content-Type':'application/x-www-form-urlencoded'},{method:'POST',body},request))?.success!==true)fail('subscription_unconfirmed');
  if(!validate(await json(url,headers,{},request)))fail('subscription_readback_failed');
  return true;
}
export async function runProductionMeta(action,control=process.env) {
  const owner=Number(execute('/usr/bin/id',['-u','ubuntu']));
  const {text:before,stat}=privateFile(ENV,owner), values=parseEnv(before);
  assertProductionMetaTarget({...values,FANMIND_RUNTIME_ENVIRONMENT:values.FANMIND_RUNTIME_ENVIRONMENT ?? 'production'},control,action);
  if(realpathSync(CURRENT)!==`/var/www/fanmind-releases/${control.LIVE_COMMIT}`)fail('release_link_mismatch');
  for(const filename of ['.env.local','.env.production.local'])if(lstatExists(CURRENT+'/'+filename)||lstatExists(ROOT+'/'+filename))fail('unmanaged_env_override');
  if(realpathSync(CURRENT+'/.env.production')!==ENV)fail('environment_link_mismatch');
  const pm2=['/usr/bin/pm2','/usr/local/bin/pm2'].find(lstatExists);if(!pm2)fail('pm2_missing');
  const processes=()=>{
    const list=JSON.parse(execute('/usr/bin/sudo',['-n','-u','ubuntu','-H',pm2,'jlist'])).filter(p=>p.name==='fanmind');
    const p=list[0];if(list.length!==1||p.pm2_env.status!=='online'||p.pm2_env.exec_mode!=='cluster_mode'||p.pm2_env.pm_cwd!==CURRENT||p.pm2_env.FANMIND_RELEASE_COMMIT!==control.LIVE_COMMIT)fail('process_contract');
    return p;
  };
  const processEnv=p=>Object.fromEntries(readFileSync(`/proc/${p.pid}/environ`,'utf8').split('\0').filter(s=>s.indexOf('=')>0).map(s=>{const i=s.indexOf('=');return[s.slice(0,i),s.slice(i+1)];}));
  const initial=processes(), baseline=processEnv(initial);
  if(initial.pm2_env.FANMIND_RUNTIME_ENVIRONMENT!=='production')fail('target_binding');
  // Next loads .env after process creation; inherited values must never override it.
  for(const name of FIELDS)if(baseline[name]!==undefined && baseline[name]!==values[name])fail('inherited_configuration_conflict');
  const live=async()=>{let v;try{v=await json(ORIGIN+'/api/version');}catch{fail('target_read_failed');}if(v.application!=='fanmind'||v.runtimeEnvironment!=='production'||v.releaseCommit!==control.LIVE_COMMIT)fail('live_release_mismatch');};
  await live();
  if(action==='inspect') {console.log(`PRODUCTION_META_READINESS=${JSON.stringify(productionMetaReadiness(values))}`);return;}
  if(action==='subscribe-webhook'){await productionAppSubscription(values,true);console.log('PRODUCTION_META_APP_SUBSCRIPTION=PASS');return;}
  const secret=[values.FACEBOOK_APP_SECRET,values.META_APP_SECRET,control.META_SETUP_APP_SECRET].find(v=>/^[a-f0-9]{32}$/iu.test(v??''));
  // Existing shared aliases must agree with this app; never overwrite them.
  for(const name of ['META_APP_SECRET','META_WEBHOOK_APP_SECRET'])if(values[name] && !/replace_with_|^your_/iu.test(values[name]) && values[name]!==secret)fail('secret_alias_conflict');
  let tokensPresent=true;
  if(!validMetaKey(values.FANMIND_TOKEN_ENCRYPTION_KEY)){
    const u=new URL(values.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/social_connections');
    u.searchParams.set('select','id');u.searchParams.set('page_access_token_encrypted','not.is.null');u.searchParams.set('limit','1');
    const rows=await json(u,buildSupabaseApiKeyHeaders(values.SUPABASE_SERVICE_ROLE_KEY));
    if(!Array.isArray(rows)||rows.length>1)fail('token_inventory_invalid');tokensPresent=rows.length>0;
  }
  const after=renderMetaConfiguration(before,[],{appId:APP,appSecret:secret,webhookToken:randomBytes(32).toString('base64url')},{tokensPresent,callback:CALLBACK});
  const desired=parseEnv(after);
  for(const name of FIELDS)if(baseline[name]!==undefined && baseline[name]!==desired[name])fail('inherited_configuration_conflict');
  const snapshot=ENV+'.meta-before-'+control.GITHUB_RUN_ID;
  const fd=openSync(snapshot,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600);
  try{writeFileSync(fd,before);fsyncSync(fd);}finally{closeSync(fd);}
  const write=text=>{
    if(privateFile(ENV,owner).text!==(text===after?before:after))fail('configuration_changed');
    const temp=ENV+'.meta-'+randomBytes(12).toString('hex');let f;
    try{f=openSync(temp,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,stat.mode&0o777);writeFileSync(f,text);chownSync(temp,stat.uid,stat.gid);fsyncSync(f);closeSync(f);f=undefined;renameSync(temp,ENV);const d=openSync(ROOT,constants.O_DIRECTORY);try{fsyncSync(d);}finally{closeSync(d);}}
    finally{if(f!==undefined)closeSync(f);try{unlinkSync(temp);}catch{}}
  };
  const restart=()=>execute('/usr/bin/sudo',['-n','-u','ubuntu','-H','/usr/bin/env',`FANMIND_RELEASE_COMMIT=${control.LIVE_COMMIT}`,`FANMIND_CURRENT_RELEASE_LINK=${CURRENT}`,'FANMIND_PM2_APP_NAME=fanmind',pm2,'reload',CURRENT+'/ops/pm2/fanmind.production.config.cjs','--only','fanmind','--update-env']);
  const verify=async()=>{
    await waitForStagingRelease(live);const p=processes(),running=processEnv(p);
    for(const name of Object.keys(values))if(!FIELDS.includes(name)&&baseline[name]!==undefined&&running[name]!==baseline[name])fail('unrelated_process_drift');
    if(p.pm2_env.FANMIND_SUPPORT_CENTRE_ENABLED!==initial.pm2_env.FANMIND_SUPPORT_CENTRE_ENABLED)fail('support_drift');
    const health=await json(ORIGIN+'/api/health');if(health.status!=='ok'&&health.status!=='healthy')fail('health_failed');
  };
  await changeStagingRuntime({before,after,read:()=>privateFile(ENV,owner).text,write,restart,verify,verifyRollback:verify});
  console.log('PRODUCTION_META_CONFIGURATION=PASS');
  console.log(`PRODUCTION_META_READINESS=${JSON.stringify(productionMetaReadiness(desired))}`);
}
function lstatExists(p){try{return Boolean(lstatSync(p));}catch{return false;}}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{await runProductionMeta(process.argv[2]);}catch(error){
    const allowed=['control_binding','target_binding','app_conflict','private_file_invalid','private_file_changed','release_link_mismatch','unmanaged_env_override','environment_link_mismatch','pm2_missing','process_contract','inherited_configuration_conflict','live_release_mismatch','secret_alias_conflict','token_inventory_invalid','input_invalid','existing_tokens_require_key_recovery','configuration_incomplete','subscription_conflict','provider_request_failed','host_command_failed','unrelated_process_drift','support_drift','health_failed'];
    console.error('PRODUCTION_META_CONFIGURATION=FAIL');console.error('PRODUCTION_META_CODE='+ (allowed.includes(error.message)?error.message:'operation_failed'));process.exitCode=1;
  }
}
