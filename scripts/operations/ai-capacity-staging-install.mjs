import {readFileSync,rmSync,realpathSync,statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {privatePassfileSnapshot} from './website-chat-retention-staging-runner.mjs';
import {capacityInstallSourceReady} from './ai-capacity-install-source.mjs';
import {syntheticAcceptanceSql} from './ai-capacity-synthetic-acceptance.mjs';
import {sourcePackage,hash,catalogueSql,markerSql,installSql,baselinePredicate,observationSql,REFERENCE,CONTROL} from './ai-capacity-install-contract.mjs';
const fail=()=>{throw Error('capacity_install_blocked');};
export function installationRequest(e){
 if(e.GITHUB_REPOSITORY!=='FanMind/FanMind'||e.GITHUB_EVENT_NAME!=='workflow_dispatch'||e.GITHUB_ACTOR_ID!=='270165082'||e.GITHUB_REF!=='refs/heads/main'||! /^[a-f0-9]{40}$/u.test(e.GITHUB_SHA??'')||e.REVIEWED_COMMIT!==e.GITHUB_SHA||! /^[a-f0-9]{40}$/u.test(e.EXPECTED_LIVE??'')||!['verify','apply','acceptance'].includes(e.CAPACITY_ACTION)||e.CONFIRMATION!==`capacity-staging-${e.CAPACITY_ACTION}`)fail();
 if(e.FANMIND_RUNTIME_ENVIRONMENT!=='staging'||e.FANMIND_TARGET_API_ORIGIN!=='https://staging.fanmind.ch'||e.NEXT_PUBLIC_SUPABASE_URL!=='https://vshyhvgcmrlagvfnvomc.supabase.co'||e.FANMIND_TARGET_SUPABASE_PROJECT_REF!=='vshyhvgcmrlagvfnvomc'||e.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF!=='drqkpdvtbbrrdwmtrodz')fail();
 if(!e.PGHOST||e.PGHOST!==e.FANMIND_TARGET_DB_HOST||!/^aws-[a-z0-9-]+\.pooler\.supabase\.com$/u.test(e.PGHOST)||e.PGPORT!=='5432'||e.PGDATABASE!=='postgres'||e.PGUSER!=='postgres.vshyhvgcmrlagvfnvomc'||e.PGSSLMODE!=='verify-full'||realpathSync(e.PGSSLROOTCERT??'')!==resolve('config/certificates/supabase-root-2021-ca.crt'))fail();
 if(!/^[a-f0-9]{64}$/u.test(e.REVIEWED_MARKER_SHA256??'')||e.PACKAGE_SHA256!==hash(readFileSync(CONTROL)))fail();
 if(e.CAPACITY_ACTION!=='verify'&&(e.FANMIND_ENABLE_NON_PRODUCTION_WRITES!=='true'||e.FANMIND_NON_PRODUCTION_WRITE_ACK!=='I_UNDERSTAND_NON_PRODUCTION_ONLY'))fail();
 if(e.CAPACITY_ACTION==='verify'&&(e.FANMIND_ENABLE_NON_PRODUCTION_WRITES!=='false'||e.FANMIND_NON_PRODUCTION_WRITE_ACK!==''))fail();
}
export function backupReceipt(e,now=Date.now()){
 const p=e.CAPACITY_BACKUP_RECEIPT;if(!p||realpathSync(p)!==p||!statSync(p).isFile()||(statSync(p).mode&0o777)!==0o600||statSync(p).uid!==process.getuid()||statSync(p).size>16384)fail();
 const raw=readFileSync(p);if(hash(raw)!==e.BACKUP_RECEIPT_SHA256)fail();const r=JSON.parse(raw);
 if(Object.keys(r).sort().join(',')!=='database_sha256,project,restore_run_id,restore_verified_at,roles_sha256,verified_at,version'||r.version!==1||r.project!=='vshyhvgcmrlagvfnvomc'||! /^[a-f0-9]{64}$/u.test(r.database_sha256)||! /^[a-f0-9]{64}$/u.test(r.roles_sha256)||! /^[0-9]+$/u.test(r.restore_run_id)||!Number.isFinite(Date.parse(r.verified_at))||Date.parse(r.verified_at)>now||Date.parse(r.verified_at)<now-86400000||!Number.isFinite(Date.parse(r.restore_verified_at))||Date.parse(r.restore_verified_at)>now||Date.parse(r.restore_verified_at)<now-30*86400000)fail();
 return r;
}
export async function runInstallation(e=process.env){
 sourcePackage();installationRequest(e);
 const git=(args)=>{const r=spawnSync('git',args,{encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe']});if(r.status!==0)fail();return r.stdout.trim();};
 if(git(['rev-parse','HEAD'])!==e.GITHUB_SHA||git(['status','--porcelain','--untracked-files=normal']))fail();
 if(git(['ls-remote','origin','refs/heads/main']).split(/\s/u)[0]!==e.GITHUB_SHA)fail();
 const live=async()=>{const r=await fetch('https://staging.fanmind.ch/api/version',{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)fail();const v=await r.json();if(v.application!=='fanmind'||v.runtimeEnvironment!=='staging'||v.releaseCommit!==e.EXPECTED_LIVE)fail();};
 await live();
 if(e.CAPACITY_ACTION!=='verify'){
  const backup=backupReceipt(e);if(!/^[1-9][0-9]*$/u.test(e.INSTALL_SOURCE_PR??'')||!e.GITHUB_TOKEN)fail();
  const api=async path=>{const r=await fetch('https://api.github.com/repos/FanMind/FanMind/'+path,{headers:{Authorization:'Bearer '+e.GITHUB_TOKEN,Accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)fail();return r.json();};
  const [branch,run,pr,checks,restore]=await Promise.all([api('branches/main'),api('actions/runs/'+e.GITHUB_RUN_ID),api('pulls/'+e.INSTALL_SOURCE_PR),api('commits/'+e.GITHUB_SHA+'/check-runs?per_page=100'),api('actions/runs/'+backup.restore_run_id)]);
  const prChecks=await api('commits/'+pr.head.sha+'/check-runs?per_page=100');
  if(!capacityInstallSourceReady(e,branch,run,pr,checks,prChecks)||restore.repository?.full_name!=='FanMind/FanMind'||restore.path!=='.github/workflows/restore-drill-database.yml'||restore.conclusion!=='success'||restore.status!=='completed'||!Number.isFinite(Date.parse(restore.updated_at))||Date.parse(restore.updated_at)<Date.parse(backup.restore_verified_at)-60000)fail();
 }
 const reference=JSON.parse(readFileSync(REFERENCE,'utf8'));if(hash(JSON.stringify(reference.catalogue))!==reference.catalogue_sha256)fail();
 const snapshot=privatePassfileSnapshot(e);
 // Reuse the reviewed snapshot mechanism, additionally bind the exact sole pgpass target.
 try{
  const pass=readFileSync(snapshot.snapshotPath,'utf8');const prefix=`${e.PGHOST}:5432:postgres:postgres.vshyhvgcmrlagvfnvomc:`;
  if(!pass.startsWith(prefix)||pass.trimEnd().includes('\n')||!pass.slice(prefix.length).trim())fail();
  const query=(s,write=false)=>{const r=spawnSync('psql',['--no-password','--no-psqlrc','-Atq','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],{input:s,encoding:'utf8',timeout:90000,maxBuffer:1024*1024,env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',PGHOST:e.PGHOST,PGPORT:'5432',PGDATABASE:'postgres',PGUSER:e.PGUSER,PGSSLMODE:'verify-full',PGSSLROOTCERT:resolve('config/certificates/supabase-root-2021-ca.crt'),PGPASSFILE:snapshot.snapshotPath,PGCONNECT_TIMEOUT:'10',PGOPTIONS:`-c default_transaction_read_only=${write?'off':'on'}`}});if(r.error||r.status!==0)fail();return r.stdout.trim();};
  const read=s=>query(`BEGIN READ ONLY;SET LOCAL statement_timeout='10s';SET LOCAL row_security=off;SET LOCAL search_path=pg_catalog,public;${s};ROLLBACK;`);
  if(read(markerSql())!==e.REVIEWED_MARKER_SHA256)fail();
  const actual=JSON.parse(read(catalogueSql()));
  const exact=JSON.stringify(actual)===JSON.stringify(reference.catalogue); // JSONB key order is compared structurally below.
  const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
  if(exact||canonical(actual)===canonical(reference.catalogue)){
   if(e.CAPACITY_ACTION==='acceptance'){
    const before=read(`SELECT jsonb_build_object('policy',to_jsonb(p),'grants',(SELECT count(*) FROM public.ai_capacity_grants),'reservations',(SELECT count(*) FROM public.ai_capacity_reservations),'allocations',(SELECT count(*) FROM public.ai_capacity_reservation_allocations),'ledger',(SELECT count(*) FROM public.ai_capacity_ledger_events),'entitlements',(SELECT count(*) FROM public.ai_capacity_workspace_entitlements)) FROM public.ai_capacity_admin_policy p`);
    const fx=JSON.parse(e.CAPACITY_FX_SNAPSHOT??'null');
    if(fx?.source!=='https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'||!/^ecb-usd-eur-/u.test(fx.version??''))fail();
    await live();query(syntheticAcceptanceSql({workspaceA:e.CAPACITY_WORKSPACE_A,workspaceB:e.CAPACITY_WORKSPACE_B,runId:e.GITHUB_RUN_ID,fx}),true);
    const after=read(`SELECT jsonb_build_object('policy',to_jsonb(p),'grants',(SELECT count(*) FROM public.ai_capacity_grants),'reservations',(SELECT count(*) FROM public.ai_capacity_reservations),'allocations',(SELECT count(*) FROM public.ai_capacity_reservation_allocations),'ledger',(SELECT count(*) FROM public.ai_capacity_ledger_events),'entitlements',(SELECT count(*) FROM public.ai_capacity_workspace_entitlements)) FROM public.ai_capacity_admin_policy p`);
    if(before!==after||canonical(JSON.parse(read(catalogueSql())))!==canonical(reference.catalogue))fail();
    console.log('CAPACITY_STAGING_ACCEPTANCE=PASS_ROLLBACK_VERIFIED');return;
   }
   console.log('CAPACITY_STAGING_INSTALL=EXACT');return;
  }
  if(e.CAPACITY_ACTION==='acceptance')fail();
  if(e.CAPACITY_ACTION==='verify'){
   const observation=observationSql().replace(/;\s*$/u,'');
   if(read(`SELECT ${baselinePredicate('observation',true)} FROM (${observation}) AS v(observation)`)!=='t')fail();
   console.log('CAPACITY_STAGING_INSTALL=RECONCILIATION_REQUIRED_RUNTIME_OFF');return;
  }
  await live();if(git(['ls-remote','origin','refs/heads/main']).split(/\s/u)[0]!==e.GITHUB_SHA)fail();
  query(installSql(e.REVIEWED_MARKER_SHA256,reference),true);
  if(canonical(JSON.parse(read(catalogueSql())))!==canonical(reference.catalogue))fail();
  console.log('CAPACITY_STAGING_INSTALL=INSTALLED_RUNTIME_OFF');
 }finally{rmSync(snapshot.directory,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{await runInstallation();}catch{console.error('CAPACITY_STAGING_INSTALL=BLOCK');process.exitCode=1;}}
