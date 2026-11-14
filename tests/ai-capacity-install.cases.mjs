import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {capacityInstallSourceReady} from '../scripts/operations/ai-capacity-install-source.mjs';
import {REQUIRED_MAIN_CHECKS,REQUIRED_PR_CHECKS} from '../scripts/operations/production-release-preflight.mjs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {sourcePackage,installSql,catalogueSql,markerSql,PATHS,REFERENCE,literal,hash} from '../scripts/operations/ai-capacity-install-contract.mjs';
import {installationRequest,backupReceipt} from '../scripts/operations/ai-capacity-staging-install.mjs';
import {syntheticAcceptanceSql} from '../scripts/operations/ai-capacity-synthetic-acceptance.mjs';
import {capacityEntitlementCommand} from '../src/lib/aiCapacityEntitlementWriter.mjs';
import {supportCapacityConfiguration} from '../src/lib/supportCapacityConfiguration.mjs';
import {buildStripeBillingReconciliation} from '../src/lib/stripeBillingReconciliation.mjs';
const wA='10000000-0000-4000-8000-000000000001',wB='20000000-0000-4000-8000-000000000002',wC='30000000-0000-4000-8000-000000000003';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fixture=`create schema auth;create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;
 grant usage on schema auth,public to anon,authenticated,service_role;revoke create on schema public from public;
 create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{"capacity1350_synthetic":true}');
 create table public.workspaces(id uuid primary key,owner_user_id uuid,test_access_flags jsonb default '{"capacity1350_synthetic":true}',billing_status text,workspace_access_mode text,billing_suspended_at timestamptz,stripe_customer_id text,stripe_subscription_id text,billing_current_period_end_at timestamptz);alter table public.workspaces enable row level security;
 create table public.workspace_stripe_billing_reconciliations(stripe_request_id text primary key,workspace_id uuid,event_stream text,stripe_customer_id text,stripe_subscription_id text,snapshot_observed_at timestamptz,snapshot_fingerprint text,expected_revision bigint,resulting_revision bigint);
 create table public.workspace_stripe_billing_streams(workspace_id uuid,event_stream text,sync_state text,projection_revision bigint,stripe_customer_id text,stripe_subscription_id text,lifecycle_terminal boolean,primary key(workspace_id,event_stream));
 alter table public.workspace_stripe_billing_reconciliations enable row level security;alter table public.workspace_stripe_billing_reconciliations force row level security;alter table public.workspace_stripe_billing_streams enable row level security;alter table public.workspace_stripe_billing_streams force row level security;
 create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[]);
 insert into auth.users(id,email) values ('11111111-1111-4111-8111-111111111111','capacity1350-a@test.fanmind.invalid'),('22222222-2222-4222-8222-222222222222','capacity1350-b@test.fanmind.invalid');
 insert into public.workspaces(id,owner_user_id,billing_status) values('${wA}','11111111-1111-4111-8111-111111111111','active'),('${wB}','22222222-2222-4222-8222-222222222222','active');`;
export function canonicalFixture(now=Date.now()){
 const start=Math.floor((now-86400000)/1000),end=start+30*86400;
 const snapshot={workspaceId:wC,customerId:'cus_SyntheticCapacity',subscriptionId:'sub_SyntheticCapacity',requestId:'req_SyntheticCapacity',observedAt:new Date(now-1000).toISOString(),status:'active',basePriceId:'price_SyntheticCapacity',items:[{id:'si_SyntheticCapacity',priceId:'price_SyntheticCapacity',start,end}],latestInvoice:{status:'paid',amountRemaining:0}};
 const command=buildStripeBillingReconciliation({workspaceId:wC,stream:'lifecycle',requestId:snapshot.requestId,observedAt:snapshot.observedAt,expectedRevision:0,customerId:snapshot.customerId,subscriptionId:snapshot.subscriptionId,projection:{billing_status:'active',workspace_access_mode:'active',billing_suspended_at:null,billing_suspended_reason:null},resolvedEventIds:[],objectBindings:[{type:'customer',id:snapshot.customerId},{type:'subscription',id:snapshot.subscriptionId}],providerSnapshotFingerprint:digest(snapshot)});
 const observation={status:'read',snapshot,fingerprint:digest(snapshot)};
 return {snapshot,command,observation,body:capacityEntitlementCommand({observation,command,expectedRevision:0})};
}
test('Capacity install keeps every source pin and refuses Production, stale source, inherited writes and wrong action',()=>{
 sourcePackage();
 const e={GITHUB_REPOSITORY:'FanMind/FanMind',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR_ID:'270165082',GITHUB_REF:'refs/heads/main',GITHUB_SHA:'a'.repeat(40),REVIEWED_COMMIT:'a'.repeat(40),EXPECTED_LIVE:'b'.repeat(40),CAPACITY_ACTION:'verify',CONFIRMATION:'capacity-staging-verify',FANMIND_RUNTIME_ENVIRONMENT:'staging',FANMIND_TARGET_API_ORIGIN:'https://staging.fanmind.ch',NEXT_PUBLIC_SUPABASE_URL:'https://vshyhvgcmrlagvfnvomc.supabase.co',FANMIND_TARGET_SUPABASE_PROJECT_REF:'vshyhvgcmrlagvfnvomc',FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:'drqkpdvtbbrrdwmtrodz',PGHOST:'aws-0-eu-west-3.pooler.supabase.com',FANMIND_TARGET_DB_HOST:'aws-0-eu-west-3.pooler.supabase.com',PGPORT:'5432',PGDATABASE:'postgres',PGUSER:'postgres.vshyhvgcmrlagvfnvomc',PGSSLMODE:'verify-full',PGSSLROOTCERT:process.cwd()+'/config/certificates/supabase-root-2021-ca.crt',REVIEWED_MARKER_SHA256:'c'.repeat(64),PACKAGE_SHA256:hash(readFileSync('docs/operations/ai-capacity-install.json')),FANMIND_ENABLE_NON_PRODUCTION_WRITES:'false',FANMIND_NON_PRODUCTION_WRITE_ACK:''};
 assert.doesNotThrow(()=>installationRequest(e));
 for(const patch of [{GITHUB_ACTOR_ID:'other'},{FANMIND_RUNTIME_ENVIRONMENT:'production'},{PGUSER:'postgres.drqkpdvtbbrrdwmtrodz'},{GITHUB_REF:'refs/heads/feature'},{PGPORT:'6543'},{CAPACITY_ACTION:'apply'},{REVIEWED_COMMIT:'b'.repeat(40)},{PACKAGE_SHA256:'d'.repeat(64)},{FANMIND_ENABLE_NON_PRODUCTION_WRITES:'true'},{NEXT_PUBLIC_SUPABASE_URL:'https://drqkpdvtbbrrdwmtrodz.supabase.co'}])assert.throws(()=>installationRequest({...e,...patch}));
});
test('Apply preserves the existing exact-head required-check policy and rejects failed shared controls',()=>{
 const sha='a'.repeat(40),e={GITHUB_REPOSITORY:'FanMind/FanMind',GITHUB_SHA:sha,GITHUB_RUN_ID:'1350'},branch={protected:true,commit:{sha}},run={id:1350,head_sha:sha,event:'workflow_dispatch',path:'.github/workflows/ai-capacity-staging-install.yml',repository:{full_name:'FanMind/FanMind'},actor:{id:270165082},check_suite_id:99},pr={merge_commit_sha:sha,merged_at:'2026-11-14T12:00:00Z',base:{ref:'main'},head:{repo:{full_name:'FanMind/FanMind'}}};
 const checks=names=>({total_count:names.length,check_runs:names.map((name,i)=>({id:i+1,name,status:'completed',conclusion:'success',app:{slug:'github-actions'},check_suite:{id:1}}))});
 const main=checks(REQUIRED_MAIN_CHECKS),head=checks(REQUIRED_PR_CHECKS);
 assert.equal(capacityInstallSourceReady(e,branch,run,pr,main,head),true);
 for(const name of ['control',...REQUIRED_MAIN_CHECKS]){const failed=structuredClone(main);failed.check_runs.push({id:100,name,status:'completed',conclusion:'failure',app:{slug:'github-actions'},check_suite:{id:2}});failed.total_count++;assert.equal(capacityInstallSourceReady(e,branch,run,pr,failed,head),false);}
 assert.equal(capacityInstallSourceReady(e,{...branch,protected:false},run,pr,main,head),false);
 assert.equal(capacityInstallSourceReady(e,branch,{...run,path:'other'},pr,main,head),false);
});
test('Private backup receipt requires the owner-bound digest, fresh database/roles proof and bounded restore age',()=>{
 const dir=mkdtempSync(join(tmpdir(),'capacity-backup-test-')),file=join(dir,'receipt.json'),now=Date.now();
 const receipt={version:1,project:'vshyhvgcmrlagvfnvomc',database_sha256:'a'.repeat(64),roles_sha256:'b'.repeat(64),verified_at:new Date(now-1000).toISOString(),restore_run_id:'1350',restore_verified_at:new Date(now-1000).toISOString()};
 try{for(const [patch,ok] of [[{},true],[{project:'drqkpdvtbbrrdwmtrodz'},false],[{verified_at:new Date(now-2*86400000).toISOString()},false],[{restore_verified_at:new Date(now-31*86400000).toISOString()},false],[{roles_sha256:''},false]]){const raw=JSON.stringify({...receipt,...patch});writeFileSync(file,raw,{mode:0o600});const e={CAPACITY_BACKUP_RECEIPT:file,BACKUP_RECEIPT_SHA256:hash(raw)};if(ok){assert.doesNotThrow(()=>backupReceipt(e,now));assert.throws(()=>backupReceipt({...e,BACKUP_RECEIPT_SHA256:'c'.repeat(64)},now));}else assert.throws(()=>backupReceipt(e,now));}}finally{rmSync(dir,{recursive:true,force:true});}
});
test('Canonical capacity command preserves the existing receipt envelope; foreign evidence and client changes fail',()=>{
 const f=canonicalFixture();assert.equal(hash(f.body.p_envelope),f.command.p_snapshot_fingerprint);
 for(const patch of [{expectedRevision:-1},{observation:{...f.observation,fingerprint:'a'.repeat(64)}},{command:{...f.command,p_workspace_id:wA}}])assert.throws(()=>capacityEntitlementCommand({observation:f.observation,command:f.command,expectedRevision:0,...patch}));
});
test('FX is exact integer, dated and bounded; unknown quality, expired/future and duplicate rates reject',()=>{
 const xml=`<Cube time='2026-11-13'><Cube currency='USD' rate='1.1052'/></Cube>`;const now=Date.parse('2026-11-14T12:00Z');
 const c=supportCapacityConfiguration({xml,now});assert.equal(c.FANMIND_SUPPORT_AI_QUALITY_MODE,'balanced');assert.equal(JSON.parse(c.FANMIND_AI_CAPACITY_FX_SNAPSHOT).eurPerUsdNanos,904813608);
 for(const options of [{now:now+4*86400000},{now:now-4*86400000},{qualityMode:'unknown'},{xml:xml+xml}])assert.throws(()=>supportCapacityConfiguration({xml,now,...options}));
});
export async function exerciseCapacityInstall({sql,select,context}){
 sql(fixture);
 sql(readFileSync(PATHS.foundation,'utf8'));sql(readFileSync(PATHS.activation,'utf8'));
 sql(`update public.ai_capacity_admin_policy set revision=2;alter table public.ai_capacity_admin_policy alter column package_99_budget_eur_microcents drop default,alter column package_199_budget_eur_microcents drop default,alter column package_312_budget_eur_microcents drop default;
 grant all on public.ai_capacity_admin_policy,public.ai_capacity_grants,public.ai_capacity_reservations,public.ai_capacity_reservation_allocations,public.ai_capacity_ledger_events to service_role;
 grant execute on function public.ai_capacity_ledger_immutable() to anon,authenticated,service_role;grant execute on function public.ai_capacity_admin_activation_guard() to service_role;
 insert into supabase_migrations.schema_migrations values('20260101000000','capacity_v2_ci_foundation',ARRAY['synthetic historical source']),('20260102000000','capacity_v2_ci_activation',ARRAY['synthetic historical source']);`);
 const marker=select(markerSql());const reference=JSON.parse(readFileSync(REFERENCE,'utf8'));
 const install=installSql(marker,reference);
 await context.test('unknown marker identity and partial schema block without modifications',()=>{
  assert.throws(()=>sql(installSql('0'.repeat(64),reference)));assert.equal(select("select to_regclass('public.ai_capacity_workspace_entitlements') is null;"),'t');
  sql('create table public.ai_capacity_workspace_entitlements(x int);');assert.throws(()=>sql(install));sql('drop table public.ai_capacity_workspace_entitlements;');
 });
 await context.test('real postflight mutation rolls back DDL, ACL and defaults; valid transaction then installs',()=>{
  const before=JSON.parse(select(catalogueSql()));
  assert.throws(()=>sql(install.replace('CREATE TEMP TABLE capacity_after','GRANT SELECT ON public.ai_capacity_workspace_entitlements TO anon;CREATE TEMP TABLE capacity_after')));
  assert.equal(select("select to_regclass('public.ai_capacity_workspace_entitlements') is null;"),'t');
  assert.equal(select("select has_table_privilege('service_role','public.ai_capacity_grants','INSERT');"),'t');
  assert.deepEqual(JSON.parse(select(catalogueSql())),before);assert.equal(select(markerSql()),marker);
  sql(install);assert.deepEqual(JSON.parse(select(catalogueSql())),reference.catalogue);assert.equal(select(markerSql()),marker);
 });
 await context.test('browser/private writer privileges deny; canonical receipt, mapping, CAS, replay and revocation execute',()=>{
  assert.equal(select("select not has_function_privilege('anon','public.sync_ai_capacity_entitlement(text,text,bigint)','EXECUTE') and not has_schema_privilege('service_role','fanmind_capacity_private','USAGE') and not has_table_privilege('service_role','public.ai_capacity_workspace_entitlements','INSERT');"),'t');
  const {snapshot:s,command:c,body:b}=canonicalFixture();
  const call=`public.sync_ai_capacity_entitlement(${literal(b.p_snapshot)},${literal(b.p_envelope)},0)`;
  assert.throws(()=>sql(`begin;set local role service_role;set local "request.jwt.claim.role"='service_role';select ${call};commit;`));
  const setup=`insert into public.workspaces(id,billing_status,workspace_access_mode,stripe_customer_id,stripe_subscription_id,billing_current_period_end_at) values('${wC}','active','active',${literal(s.customerId)},${literal(s.subscriptionId)},to_timestamp(${s.items[0].end}));
 insert into public.workspace_stripe_billing_streams values('${wC}','lifecycle','in_sync',1,${literal(s.customerId)},${literal(s.subscriptionId)},false);
 insert into public.workspace_stripe_billing_reconciliations values(${literal(s.requestId)},'${wC}','lifecycle',${literal(s.customerId)},${literal(s.subscriptionId)},${literal(s.observedAt)},${literal(c.p_snapshot_fingerprint)},0,1);
 insert into fanmind_capacity_private.package_prices values(${literal(s.basePriceId)},'capacity_99',1,true);`;
  sql(`begin;${setup} set local role service_role;set local "request.jwt.claim.role"='service_role';
 DO $$declare rejected boolean:=false;begin if ${call}<>1 or ${call}<>1 then raise exception 'writer_replay_invalid';end if;
 begin perform public.sync_ai_capacity_entitlement(${literal(b.p_snapshot)},${literal(b.p_envelope)},1);exception when others then if SQLERRM<>'capacity_writer_replay_conflict' then raise;end if;rejected:=true;end;
 if not rejected then raise exception 'writer_cas_accepted';end if;end$$;reset role;
 update public.workspaces set billing_status='suspended' where id='${wC}';
 DO $$begin if exists(select from public.ai_capacity_workspace_entitlements where workspace_id='${wC}' and (active or revision<>2)) then raise exception 'writer_revocation_invalid';end if;end$$;
 rollback;`);
  assert.equal(select('select count(*) from public.ai_capacity_workspace_entitlements;'),'0');
  for(const mutation of ["update public.workspace_stripe_billing_streams set projection_revision=2","delete from public.workspace_stripe_billing_streams","update fanmind_capacity_private.package_prices set active=false"]){
   sql(`begin;${setup} set local \"request.jwt.claim.role\"='service_role';select ${call};${mutation};DO $$begin if exists(select from public.ai_capacity_workspace_entitlements where active) then raise exception 'writer_invalidation_failed';end if;end$$;rollback;`);
  }
 });
 await context.test('authorized two-Creator grant, reserve, exact settlement, duplicate, empty balance, hold and withdrawal fully roll back',()=>{
  const fx={eurPerUsdNanos:900000000,version:'synthetic-local-fx',validFrom:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+60000).toISOString()};
  sql(syntheticAcceptanceSql({workspaceA:wA,workspaceB:wB,runId:'1350',fx}));
  assert.equal(select('select count(*) from public.ai_capacity_ledger_events;'),'0');assert.equal(select('select count(*) from public.ai_capacity_workspace_entitlements;'),'0');
  assert.equal(select('select emergency_spend_freeze and not global_capacity_enabled and not runtime_activation_ready from public.ai_capacity_admin_policy;'),'t');
  assert.throws(()=>sql(syntheticAcceptanceSql({workspaceA:wB,workspaceB:wA,runId:'1350',fx})));
 });
}
const required=process.env.FANMIND_CAPACITY_PG17_REQUIRED==='true';
test('Capacity installation and canonical Writer execute in the existing isolated PG17 transport',{skip:!required},async context=>{
 const container=process.env.FANMIND_CREATOR_PG17_CONTAINER_ID;assert.match(container??'',/^[a-f0-9]{12,64}$/u);
 const database='fanmind_capacity_install_ci';
 const query=(s,db=database)=>execFileSync('docker',['--host=unix:///var/run/docker.sock','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],{input:s,encoding:'utf8',timeout:90000,maxBuffer:8*1024*1024,stdio:['pipe','pipe','pipe']}).trim();
 query(`create database ${database};`,'postgres');
 try{await exerciseCapacityInstall({sql:query,select:query,context});}finally{query(`drop database ${database} with(force);`,'postgres');}
});
