import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const source=readFileSync('supabase/controlled/support_ai_consent.sql','utf8');
const EXPECTED_SHA='cd610fc3775b5d6e9f074b6f8af0125effd5bc360367bf992e5809b45c0f8e61';
const fail=()=>{throw Error('consent_schema_control_blocked');};
const query=q=>execFileSync('psql',['-X','-v','ON_ERROR_STOP=1','-Atq'],{input:q,encoding:'utf8',timeout:30000,stdio:['pipe','pipe','pipe']}).trim();
try{
 const e=process.env,action=e.CONSENT_SCHEMA_ACTION;
 if(!['verify','apply'].includes(action)||e.GITHUB_REF!=='refs/heads/main'||e.FANMIND_RUNTIME_ENVIRONMENT!=='staging'||e.FANMIND_SUPPORT_REVIEWED_COMMIT!==e.GITHUB_SHA||!/^\w{40}$/.test(e.GITHUB_SHA??'')||e.PGSSLMODE!=='verify-full'||!e.PGPASSFILE||e.PGUSER!==`postgres.${e.FANMIND_TARGET_SUPABASE_PROJECT_REF}`||e.FANMIND_TARGET_SUPABASE_PROJECT_REF===e.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF||e.FANMIND_TARGET_API_ORIGIN!=='https://staging.fanmind.ch'||!e.PGHOST||e.PGHOST===e.FANMIND_PRODUCTION_DB_HOST||e.PGHOST!==e.FANMIND_TARGET_DB_HOST||createHash('sha256').update(source).digest('hex')!==EXPECTED_SHA)fail();
 if(e.FANMIND_ENABLE_NON_PRODUCTION_WRITES!=='true'||e.FANMIND_NON_PRODUCTION_WRITE_ACK!=='I_UNDERSTAND_NON_PRODUCTION_ONLY'||new URL(e.NEXT_PUBLIC_SUPABASE_URL).hostname!==`${e.FANMIND_TARGET_SUPABASE_PROJECT_REF}.supabase.co`)fail();
 if(!/^[a-f0-9]{40}$/.test(e.CONSENT_EXPECTED_RELEASE??''))fail();
 const live=await fetch(`${e.FANMIND_TARGET_API_ORIGIN}/api/version`,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)}).then(r=>r.ok?r.json():fail());
 if(live.runtimeEnvironment!=='staging'||live.releaseCommit!==e.CONSENT_EXPECTED_RELEASE)fail();
 const exists=query("SELECT (to_regclass('public.support_ai_consents') IS NOT NULL)::int;")==='1';
 if(!exists&&action==='apply'){query(source);}
 if(!exists&&action==='verify'){console.log('SUPPORT_AI_CONSENT_SCHEMA=ABSENT');process.exit(0);}
 const functions=[...source.matchAll(/CREATE FUNCTION public\.(\w+)\(([^)]*)\)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/g)];
 if(functions.length!==2)fail();
 for(const [,name,,body]of functions){
  const hash=createHash('md5').update(body).digest('hex');
  if(query(`SELECT count(*) FROM pg_proc WHERE oid='public.${name}(${name.endsWith('_state')?'uuid,text':'uuid,text,boolean,bigint,uuid'})'::regprocedure AND prosecdef AND md5(prosrc)='${hash}' AND proconfig=ARRAY['search_path=pg_catalog, public'];`)!=='1')fail();
 }
 const ok=query(`SELECT (c.relrowsecurity AND (SELECT count(*)=7 FROM information_schema.columns WHERE table_schema='public' AND table_name='support_ai_consents') AND (SELECT count(*)=6 FROM pg_constraint WHERE conrelid=c.oid) AND (SELECT count(*)=1 FROM pg_constraint WHERE conrelid=c.oid AND contype='f' AND confrelid='auth.users'::regclass AND confdeltype='c') AND NOT has_table_privilege('anon',c.oid,'SELECT') AND NOT has_table_privilege('authenticated',c.oid,'SELECT') AND NOT has_table_privilege('service_role',c.oid,'INSERT') AND NOT has_function_privilege('anon','public.support_ai_consent_decide(uuid,text,boolean,bigint,uuid)','EXECUTE') AND NOT has_function_privilege('authenticated','public.support_ai_consent_state(uuid,text)','EXECUTE') AND has_function_privilege('service_role','public.support_ai_consent_state(uuid,text)','EXECUTE'))::int FROM pg_class c WHERE c.oid='public.support_ai_consents'::regclass;`);
 if(ok!=='1')fail();console.log('SUPPORT_AI_CONSENT_SCHEMA=PASS');
}catch{console.error('SUPPORT_AI_CONSENT_SCHEMA=BLOCKED');process.exitCode=1;}
