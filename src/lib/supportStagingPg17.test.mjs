import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {sourceManifest,catalogueSql,canonical,digest,classify,assertReference,installSql,rollbackSql,REFERENCE_PATH} from '../../scripts/operations/support-centre-schema.mjs';
const container=process.env.FANMIND_PG17_SOURCE_CONTAINER_ID??'';
const required=process.env.FANMIND_PG17_REQUIRE_SERVICE_CONTAINERS==='true';
const ids=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sql=(query,db)=>execFileSync('docker',['exec','-i','-e',`PGPASSWORD=${process.env.FANMIND_PG17_PASSWORD??''}`,container,'psql','-X','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-Atq'],{input:query,encoding:'utf8',timeout:90000,stdio:['pipe','pipe','pipe'],maxBuffer:4*1024*1024}).trim();
function fixture(db){sql(`CREATE DATABASE ${db};`,'postgres');sql(`CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz,deleted_at timestamptz);CREATE TABLE public.workspaces(id uuid PRIMARY KEY);CREATE TABLE public.social_connections(id uuid PRIMARY KEY,workspace_id uuid,platform text,status text,last_messenger_sync_error text);GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;INSERT INTO auth.users(id)VALUES('${ids(1)}'),('${ids(2)}');INSERT INTO public.workspaces VALUES('${ids(10)}'),('${ids(11)}');INSERT INTO public.social_connections VALUES('${ids(20)}','${ids(10)}','facebook','expired',NULL);`,db);}
function object(db){return JSON.parse(sql(catalogueSql(),db));}
test('new Support rollout PG17: independent reference, hostile defaults, rollback, retention receipts and own erasure',{skip:!required},()=>{
 assert.match(container,/^[a-f0-9]{12,64}$/);const a=`support_reference_${process.pid}`,b=`support_target_${process.pid}`;let madeA=false,madeB=false;
 try{
  fixture(a);madeA=true;
  for(const source of sourceManifest().sources)sql(readFileSync(source.path,'utf8'),a);
  const catalogue=object(a),reference={manifest:sourceManifest(),catalogue,catalogue_sha256:digest(canonical(catalogue)),provenance:{kind:'synthetic_ci_pg17',server_version:sql('SHOW server_version;',a),source_commit:process.env.GITHUB_SHA??'0'.repeat(40)}};
  assert.equal(catalogue.sequences[0].parameters.max,'9223372036854775807','bigint metadata must remain exact across JSON transport');
  assertReference(reference);
  if(existsSync(REFERENCE_PATH))assert.deepEqual(JSON.parse(readFileSync(REFERENCE_PATH,'utf8')).catalogue,catalogue,'committed reference must reproduce exactly');
  console.log('SUPPORT_ROLLOUT_REFERENCE_JSON='+JSON.stringify(reference));
  fixture(b);madeB=true;assert.equal(classify(object(b),reference),'ABSENT');
  sql("CREATE TABLE public.support_retention_unexpected(id integer);",b);assert.equal(classify(object(b),reference),'DRIFT');assert.throws(()=>sql(installSql(reference),b));sql('DROP TABLE public.support_retention_unexpected;',b);
  sql(installSql(reference),b);assert.equal(classify(object(b),reference),'EXACT');
  sql('CREATE POLICY support_synthetic_drift ON public.support_centre_cases USING(true);',b);
  assert.equal(classify(object(b),reference),'DRIFT');assert.throws(()=>sql(rollbackSql(reference),b));
  sql('DROP POLICY support_synthetic_drift ON public.support_centre_cases;',b);
  const audited=sourceManifest().triggers[0];sql(`ALTER TABLE public.${audited.table} DISABLE TRIGGER ${audited.name};`,b);
  assert.equal(classify(object(b),reference),'DRIFT');assert.throws(()=>sql(rollbackSql(reference),b));
  sql(`ALTER TABLE public.${audited.table} ENABLE TRIGGER ${audited.name};`,b);assert.equal(classify(object(b),reference),'EXACT');
  // Exact state is a no-op, while a second blind CREATE is rejected before mutation.
  assert.throws(()=>sql(installSql(reference),b));assert.equal(classify(object(b),reference),'EXACT');
  sql(rollbackSql(reference),b);assert.equal(classify(object(b),reference),'ABSENT');
  // A noncanonical default grant must roll back the entire fresh installation.
  sql('CREATE ROLE support_rollout_unexpected NOLOGIN;',b);
  sql('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO support_rollout_unexpected;',b);
  assert.throws(()=>sql(installSql(reference),b));assert.equal(classify(object(b),reference),'ABSENT');
  sql('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT ON TABLES FROM support_rollout_unexpected;',b);
  sql('DROP ROLE support_rollout_unexpected;',b);
  sql(installSql(reference),b);
  sql(`INSERT INTO public.support_centre_owners VALUES('${ids(1)}');`,b);
  sql(`SELECT public.support_chat_send('${ids(1)}','${ids(10)}','${ids(30)}','old own','answer','support',false);SELECT public.support_chat_handoff('${ids(1)}','${ids(10)}');SELECT public.support_chat_send('${ids(2)}','${ids(11)}','${ids(31)}','old foreign','answer','support',false);SELECT public.support_chat_send('${ids(2)}','${ids(11)}','${ids(32)}','fresh foreign','answer','support',false);UPDATE public.support_chat_turns SET created_at=clock_timestamp()-interval '31 days' WHERE request_id IN('${ids(30)}','${ids(31)}');UPDATE public.support_chat_threads SET updated_at=clock_timestamp()-interval '31 days' WHERE user_id='${ids(1)}';`,b);
  const caseId=sql(`SELECT public.support_centre_report('${ids(10)}','${ids(20)}','facebook','connection_attention');`,b);
  sql(`UPDATE public.support_centre_cases SET status='failed',created_at=clock_timestamp()-interval '40 days',expires_at=clock_timestamp()-interval '39 days',completed_at=clock_timestamp()-interval '31 days' WHERE id='${caseId}';SELECT public.support_centre_notify(NULL,'security_boundary','${ids(2)}');UPDATE public.support_centre_notifications SET created_at=clock_timestamp()-interval '31 days' WHERE code='security_boundary';`,b);
  assert.throws(()=>sql(rollbackSql(reference),b));
  const run=`SELECT public.run_support_retention('${ids(40)}','${'a'.repeat(40)}',false);`;
  const result=JSON.parse(sql(run,b));assert.equal(result.status,'succeeded');assert.deepEqual(result.counts,{turns:2,threads:1,notifications:4,cases:1,case_events:1});
  assert.equal(sql("SELECT count(*) FROM public.support_chat_turns;",b),'1');assert.deepEqual(JSON.parse(sql(run,b)),result);
  assert.equal(JSON.parse(sql(`SELECT public.run_support_retention('${ids(41)}','${'a'.repeat(40)}',false);`,b)).status,'already_completed');
  assert.throws(()=>sql(`SET ROLE service_role;SELECT public.run_support_retention('${ids(42)}','${'a'.repeat(40)}',false);`,b));
  assert.throws(()=>sql('SELECT public.support_centre_purge();',b));
  assert.equal(JSON.parse(sql(`SET ROLE service_role;SELECT public.support_retention_health('${ids(1)}');`,b)).healthy,true);
  // Simulated deletion failure: data rollback + durable failed receipt; retry is bounded.
  sql("UPDATE public.support_retention_runs SET retention_day=retention_day-1;",b);
  sql(`UPDATE public.support_chat_turns SET created_at=clock_timestamp()-interval '31 days';CREATE FUNCTION public.support_test_fail()RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic_failure';END $$;CREATE TRIGGER support_test_fail BEFORE DELETE ON public.support_chat_turns FOR EACH ROW EXECUTE FUNCTION public.support_test_fail();`,b);
  const retry=attempt=>JSON.parse(sql(`SELECT public.run_support_retention('${ids(43)}','${'a'.repeat(40)}',${attempt>1});`,b));
  assert.equal(retry(1).status,'failed');assert.equal(sql('SELECT count(*) FROM public.support_chat_turns;',b),'1');
  assert.equal(retry(1).attempts,1);assert.equal(retry(2).attempts,2);
  sql('DROP TRIGGER support_test_fail ON public.support_chat_turns;DROP FUNCTION public.support_test_fail();',b);
  assert.equal(retry(3).status,'succeeded');assert.equal(retry(4).attempts,3);
  sql(`SELECT public.support_chat_send('${ids(1)}','${ids(10)}','${ids(50)}','own new','answer','support',false);SELECT public.support_chat_send('${ids(2)}','${ids(11)}','${ids(51)}','foreign new','answer','support',false);`,b);
  const snap=JSON.parse(sql(`SELECT public.support_chat_privacy_state('${ids(1)}','${ids(10)}');`,b));
  sql(`SELECT public.support_chat_handoff('${ids(1)}','${ids(10)}');`,b);
  assert.equal(sql(`SET ROLE service_role;SELECT public.support_chat_erase('${ids(1)}','${ids(11)}','${snap.thread}',${snap.sequence});`,b),'f');
  sql(`SELECT public.support_chat_send('${ids(1)}','${ids(10)}','${ids(52)}','newer own','answer','support',false);`,b);
  assert.throws(()=>sql(`SELECT public.support_chat_erase('${ids(1)}','${ids(10)}','${snap.thread}',${snap.sequence});`,b));
  const fresh=JSON.parse(sql(`SELECT public.support_chat_privacy_state('${ids(1)}','${ids(10)}');`,b));
  assert.equal(sql(`SET ROLE service_role;SELECT public.support_chat_erase('${ids(1)}','${ids(10)}','${fresh.thread}',${fresh.sequence});`,b),'t');
  assert.equal(sql(`SELECT count(*) FROM public.support_chat_threads WHERE user_id='${ids(1)}';`,b),'0');
  assert.equal(sql(`SELECT count(*) FROM public.support_chat_turns WHERE user_id='${ids(1)}';`,b),'0');
  assert.equal(sql(`SELECT count(*) FROM public.support_centre_notifications WHERE reference_id='${fresh.thread}';`,b),'0');
  sql(`SELECT public.support_chat_send('${ids(1)}','${ids(10)}','${ids(53)}','future own','answer','support',false);`,b);
  assert.equal(sql(`SELECT public.support_chat_erase('${ids(1)}','${ids(10)}','${fresh.thread}',${fresh.sequence});`,b),'f');
  assert.equal(sql(`SELECT count(*) FROM public.support_chat_turns WHERE user_id='${ids(1)}';`,b),'1');
  assert.equal(sql(`SELECT count(*) FROM public.support_chat_turns WHERE user_id='${ids(2)}';`,b),'1');
  assert.equal(classify(object(b),reference),'EXACT');
  console.log('SUPPORT_ROLLOUT_NATIVE=PASS');
 }finally{
  if(madeB)sql(`DROP DATABASE ${b} WITH(FORCE);`,'postgres');if(madeA)sql(`DROP DATABASE ${a} WITH(FORCE);`,'postgres');
  sql('DROP ROLE IF EXISTS support_rollout_unexpected;','postgres');
 }
});
