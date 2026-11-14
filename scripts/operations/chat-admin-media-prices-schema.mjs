#!/usr/bin/env node
import {readFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {privatePassfileSnapshot} from './website-chat-retention-staging-runner.mjs';

export const PRICE_SCHEMA_PATH='supabase/controlled/chat_admin_media_prices.sql';
export const PRICE_SCHEMA_SHA='9c6a323c27821bf10ef24a96fe1ff318da8375d7352b712cbfe28994c7e444d4';
const schema='fanmind_media_price_evidence';
const signatures={
 [`${schema}.audit()`]:true,
 'public.chat_admin_price_write(uuid,uuid,integer,jsonb)':false,
 'public.chat_admin_price_offer_record(uuid,uuid,uuid,uuid,uuid,integer,jsonb)':true,
 'public.persist_chat_admin_media_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[],jsonb)':false,
};
const fail=()=>{throw Error('media_price_schema_blocked');};
export function assertPriceSchemaTarget(e){
 if(e.GITHUB_REPOSITORY!=='FanMind/FanMind'||e.GITHUB_EVENT_NAME!=='workflow_dispatch'||e.GITHUB_REF!=='refs/heads/main'||! /^[a-f0-9]{40}$/.test(e.GITHUB_SHA??'')||e.REVIEWED_COMMIT!==e.GITHUB_SHA||!['verify','apply'].includes(e.PRICE_SCHEMA_ACTION)||e.CONFIRMATION!==`staging-media-prices-${e.PRICE_SCHEMA_ACTION}`||e.FANMIND_RUNTIME_ENVIRONMENT!=='staging'||e.FANMIND_TARGET_API_ORIGIN!=='https://staging.fanmind.ch'||e.FANMIND_TARGET_SUPABASE_PROJECT_REF!=='vshyhvgcmrlagvfnvomc'||e.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF!=='drqkpdvtbbrrdwmtrodz'||e.NEXT_PUBLIC_SUPABASE_URL!=='https://vshyhvgcmrlagvfnvomc.supabase.co'||!e.PGHOST||e.PGHOST!==e.FANMIND_TARGET_DB_HOST||e.PGHOST===e.FANMIND_PRODUCTION_DB_HOST||e.PGUSER!=='postgres.vshyhvgcmrlagvfnvomc'||e.PGSSLMODE!=='verify-full'||!e.PGSSLROOTCERT||!e.PGPASSFILE)fail();
 if(e.PRICE_SCHEMA_ACTION==='apply'&&(e.FANMIND_ENABLE_NON_PRODUCTION_WRITES!=='true'||e.FANMIND_NON_PRODUCTION_WRITE_ACK!=='I_UNDERSTAND_NON_PRODUCTION_ONLY'))fail();
 if(e.PRICE_SCHEMA_ACTION==='verify'&&(e.FANMIND_ENABLE_NON_PRODUCTION_WRITES!=='false'||e.FANMIND_NON_PRODUCTION_WRITE_ACK!==''))fail();
}
export function priceSchemaPostflight(source=readFileSync(PRICE_SCHEMA_PATH,'utf8')){
 if(createHash('sha256').update(source).digest('hex')!==PRICE_SCHEMA_SHA)fail();
 const bodies=[...source.matchAll(/create function ((?:public|fanmind_media_price_evidence)\.\w+)\([^]*?as \$\$([^]*?)\$\$;/g)];
 if(bodies.length!==4)fail();
 const checks=Object.entries(signatures).map(([signature,definer])=>{
  const body=bodies.find(m=>m[1]===signature.split('(')[0])?.[2];if(body===undefined)fail();
  const publicRpc=signature.startsWith('public.');
  return `EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('${signature}') AND p.proowner=to_regrole('postgres') AND p.prosecdef=${definer} AND p.proconfig=ARRAY['search_path=""'] AND md5(p.prosrc)='${createHash('md5').update(body).digest('hex')}' AND NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee NOT IN(to_regrole('postgres')${publicRpc?",to_regrole('authenticated')":''})) AND NOT has_function_privilege('anon',p.oid,'EXECUTE') AND NOT has_function_privilege('service_role',p.oid,'EXECUTE') AND has_function_privilege('authenticated',p.oid,'EXECUTE')=${publicRpc})`;
 });
 return `BEGIN READ ONLY;SET LOCAL statement_timeout='10s';
 SELECT 1/(CASE WHEN
 (SELECT nspowner=to_regrole('postgres') FROM pg_namespace WHERE nspname='${schema}')
 AND NOT EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role']) r WHERE has_schema_privilege(r,'${schema}','USAGE') OR has_schema_privilege(r,'${schema}','CREATE'))
 AND (SELECT count(*)=2 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='${schema}' AND c.relkind='r')
 AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='${schema}' AND c.relkind='r' AND (NOT c.relrowsecurity OR c.relowner<>to_regrole('postgres') OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=c.oid) OR EXISTS(SELECT 1 FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantee<>to_regrole('postgres'))))
 AND (SELECT count(*)=9 FROM pg_attribute WHERE attrelid=to_regclass('${schema}.revisions') AND attnum>0 AND NOT attisdropped)
 AND (SELECT count(*)=11 FROM pg_attribute WHERE attrelid=to_regclass('${schema}.offers') AND attnum>0 AND NOT attisdropped)
 AND (SELECT count(*)=3 FROM pg_constraint WHERE conrelid IN(to_regclass('${schema}.revisions'),to_regclass('${schema}.offers')) AND contype='f' AND confdeltype='c')
 AND EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=to_regclass('${schema}.offers') AND confrelid=to_regclass('public.chat_character_messages') AND confdeltype='c' AND pg_get_constraintdef(oid)='FOREIGN KEY (inbound_id) REFERENCES chat_character_messages(id) ON DELETE CASCADE')
 AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.chat_characters'::regclass AND tgname='chat_media_price_audit' AND tgenabled='O' AND tgfoid=to_regprocedure('${schema}.audit()') AND pg_get_triggerdef(oid,true)='CREATE TRIGGER chat_media_price_audit AFTER UPDATE OF sales_playbook ON chat_characters FOR EACH ROW EXECUTE FUNCTION fanmind_media_price_evidence.audit()')
 AND ${checks.join(' AND ')}
 THEN 1 ELSE 0 END);ROLLBACK;`;
}
export async function runPriceSchema(e=process.env){
 assertPriceSchemaTarget(e);
 const checkout=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']});
 if(checkout.status!==0||checkout.stdout.trim()!==e.GITHUB_SHA)fail();
 const source=readFileSync(PRICE_SCHEMA_PATH,'utf8');const postflight=priceSchemaPostflight(source);
 const live=await fetch(`${e.FANMIND_TARGET_API_ORIGIN}/api/version`,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)}).then(r=>r.ok?r.json():fail());
 if(live.application!=='fanmind'||live.runtimeEnvironment!=='staging'||live.releaseCommit!==e.GITHUB_SHA)fail();
 const frozen=privatePassfileSnapshot(e);
 const query=(q,write=false)=>{const r=spawnSync('psql',['--no-password','--no-psqlrc','-Atq','-v','ON_ERROR_STOP=1'],{env:{PATH:'/usr/bin:/bin',LANG:'C',LC_ALL:'C',PGHOST:e.PGHOST,PGPORT:'5432',PGDATABASE:'postgres',PGUSER:e.PGUSER,PGSSLMODE:'verify-full',PGSSLROOTCERT:e.PGSSLROOTCERT,PGPASSFILE:frozen.snapshotPath,PGCONNECT_TIMEOUT:'10',PGOPTIONS:`-c default_transaction_read_only=${write?'off':'on'}`},input:q,encoding:'utf8',timeout:30000,maxBuffer:65536});if(r.error||r.status!==0)fail();return r.stdout.trim();};
 try{
  const absent=query(`BEGIN READ ONLY;SELECT (to_regnamespace('${schema}') IS NULL AND ${Object.keys(signatures).map(s=>`to_regprocedure('${s}') IS NULL`).join(' AND ')})::int;ROLLBACK;`)==='1';
  if(absent&&e.PRICE_SCHEMA_ACTION==='verify'){console.log('STAGING_MEDIA_PRICE_SCHEMA=ABSENT');return;}
  if(absent){
   // Serialize with other reviewed price-schema executions. No generic migration push.
   const transaction=source.replace('begin;',"begin;set local lock_timeout='5s';set local statement_timeout='20s';select pg_advisory_xact_lock(hashtextextended('fanmind-media-price-schema-v1',0));").replace(/commit;\s*$/u,'');
   query(transaction+postflight.replace('BEGIN READ ONLY;','').replace('ROLLBACK;','COMMIT;'),true);
  }
  query(postflight);console.log('STAGING_MEDIA_PRICE_SCHEMA=PASS');
 }finally{rmSync(frozen.directory,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{await runPriceSchema();}catch{console.error('STAGING_MEDIA_PRICE_SCHEMA=BLOCKED');process.exitCode=1;}}
