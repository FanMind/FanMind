import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {targetFor,readProductionFile} from './support-production-control.mjs';
import {assertReference,catalogueSql,roleBoundarySql,classify,REFERENCE_PATH} from './support-centre-schema.mjs';
import {consentCatalogueSql,classifyConsent,consentInstallSql,SQL_SHA256,hash} from './support-ai-consent-contract.mjs';
const SHA=/^[a-f0-9]{40}$/;
const fail=code=>{throw Error(code);};
export function consentProductionRequest(env,action){
 if(!['verify','apply'].includes(action)||env.GITHUB_REPOSITORY!=='FanMind/FanMind'||env.GITHUB_REF!=='refs/heads/main'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||env.GITHUB_ACTOR_ID!=='270165082'||env.FANMIND_RUNTIME_ENVIRONMENT!=='production'||!SHA.test(env.GITHUB_SHA??'')||env.FANMIND_SUPPORT_REVIEWED_COMMIT!==env.GITHUB_SHA||!SHA.test(env.CONSENT_EXPECTED_LIVE??'')||env.CONSENT_SQL_SHA256!==SQL_SHA256||env.FANMIND_SUPPORT_CONFIRM!==`support-ai-consent-production-${action}`)fail('consent_request_invalid');
 if(env.FANMIND_SUPPORT_PERSISTENT_CONSENT_VERSION)fail('consent_must_remain_disabled');
 // Reuse the existing Production connection/Owner allowlist validator only
 // after the separate, action-specific consent authorization above succeeds.
 const owner=(env.FANMIND_ADMIN_EMAILS??'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)[0];
 return targetFor({...env,FANMIND_SUPPORT_CONFIRM:'support-production-verify'},'verify',owner);
}
export function classifyConsentPlan(actual,action){const status=classifyConsent(actual);if(status==='DRIFT')fail('consent_schema_drift');return status==='EXACT'?'skip':action==='apply'?'apply':'absent';}
const execute=(bin,args,options={})=>execFileSync(bin,args,{encoding:'utf8',timeout:90000,maxBuffer:8*1024*1024,stdio:['pipe','pipe','pipe'],...options}).trim();
export function runConsentProduction(action,env=process.env){
 const target=consentProductionRequest(env,action);
 if(process.getuid?.()!==0)fail('root_required');
 if(readProductionFile('.support-reviewed-source',[0],[0o600],41).content.trim()!==target.commit)fail('checkout_mismatch');
 const environment=readProductionFile('/var/www/fanmind/.env.production',[0,Number(execute('/usr/bin/id',['-u','ubuntu']))],[0o600,0o640],1048576);
 const fileHash=hash(environment.content);
 const live=()=>{const v=JSON.parse(execute('/usr/bin/curl',['-fsS','--max-time','15','--max-filesize','16384','https://fanmind.ch/api/version']));if(v.application!=='fanmind'||v.runtimeEnvironment!=='production'||v.releaseCommit!==env.CONSENT_EXPECTED_LIVE)fail('live_release_changed');};
 live();
 const baseReference=JSON.parse(readFileSync(REFERENCE_PATH,'utf8'));assertReference(baseReference);
 const dir=mkdtempSync(join(tmpdir(),'fanmind-consent-production-'));
 try{
  const pass=readProductionFile(env.FANMIND_BACKUP_PGPASSFILE,[0],[0o600],65536).content;
  const passfile=join(dir,'pgpass');writeFileSync(passfile,pass,{mode:0o600,flag:'wx'});
  const db=query=>execute('/usr/bin/psql',['--no-password','--no-psqlrc','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],{input:query,env:{PATH:'/usr/bin:/bin',LANG:'C',PGHOST:target.host,PGPORT:'5432',PGDATABASE:'postgres',PGUSER:target.user,PGPASSFILE:passfile,PGSSLMODE:'verify-full',PGSSLROOTCERT:resolve('config/certificates/supabase-root-2021-ca.crt'),PGCONNECT_TIMEOUT:'10',PGAPPNAME:'fanmind-consent-production'}});
  const read=query=>db(`BEGIN READ ONLY; SET LOCAL statement_timeout='10s'; ${query} ROLLBACK;`);
  const base=()=>JSON.parse(read(catalogueSql()));
  const before=base();if(classify(before,baseReference)!=='EXACT'||read(roleBoundarySql())!=='t')fail('base_support_schema_invalid');
  // Existing confirmed Support Owner must remain bound to the server-only
  // Platform Admin allowlist. No owner binding or Auth mutation is performed.
  const quote=s=>"'"+s.replaceAll("'","''")+"'";
  if(read(`SELECT count(*)=1 FROM public.support_centre_owners o JOIN auth.users u ON u.id=o.user_id WHERE lower(u.email) IN(${target.emails.map(quote).join(',')}) AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<clock_timestamp());`)!=='t')fail('existing_owner_not_bound');
  const actual=()=>JSON.parse(read(consentCatalogueSql()));
  const decision=classifyConsentPlan(actual(),action);
  if(decision==='apply'){
   live();
   if(hash(readProductionFile('/var/www/fanmind/.env.production',[0,environment.stat.uid],[0o600,0o640],1048576).content)!==fileHash)fail('configuration_changed');
   db(consentInstallSql(catalogueSql(),before,roleBoundarySql()));
  }
  if(decision!=='absent'&&classifyConsent(actual())!=='EXACT')fail('consent_postflight_invalid');
  if(JSON.stringify(base())!==JSON.stringify(before)||read(roleBoundarySql())!=='t')fail('base_support_changed');
  live();if(hash(readProductionFile('/var/www/fanmind/.env.production',[0,environment.stat.uid],[0o600,0o640],1048576).content)!==fileHash)fail('configuration_changed');
  console.log(`SUPPORT_AI_CONSENT_PRODUCTION_SCHEMA=${decision==='absent'?'ABSENT':'PASS'}`);
  console.log(`SUPPORT_AI_CONSENT_PRODUCTION_ACTION=${decision.toUpperCase()}`);
  console.log('SUPPORT_AI_CONSENT_PRODUCTION_ACTIVATION=DISABLED');
 }finally{rmSync(dir,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv.length!==3)fail('arguments_invalid');runConsentProduction(process.argv[2]);}
 catch(error){const code=/^[a-z_]+$/.test(error?.message??'')?error.message:'operation_failed';console.error(`SUPPORT_AI_CONSENT_PRODUCTION_ERROR=${code}`);process.exitCode=1;}
}
