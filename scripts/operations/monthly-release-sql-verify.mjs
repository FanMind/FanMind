// Read-only adapters for the existing monthly controller. No apply entry point.
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {SQL_PROOFS,sha256} from './monthly-release-control.mjs';
import {sourcePackage,catalogueSql as capacityCatalogueSql,REFERENCE} from './ai-capacity-install-contract.mjs';
import {loadMediaSchemaProfile,mediaSchemaStateSql} from './chat-admin-media-schema-profile.mjs';
import {storageGuardStateSql} from './chat-admin-media-storage-control.mjs';
import {priceSchemaPostflight} from './chat-admin-media-prices-schema.mjs';
import {consentCatalogueSql,classifyConsent} from './support-ai-consent-contract.mjs';
import {assertReference,catalogueSql as supportCatalogueSql,roleBoundarySql,classify as classifySupport,REFERENCE_PATH as SUPPORT_REFERENCE} from './support-centre-schema.mjs';
import {targetFor,readProductionFile} from './support-production-control.mjs';
const SHA=/^[a-f0-9]{40}$/u;
const fail=()=>{throw Error('monthly_sql_verification_blocked');};
const literal=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export function sqlAdapter(id){const entry=Object.entries(SQL_PROOFS).find(([,a])=>a.evidenceVersion===2&&a.id===id);if(!entry)fail();return {path:entry[0],...entry[1]};}
export function assertMonthlySqlRequest(e){
 const adapter=sqlAdapter(e.MONTHLY_SQL_ADAPTER);
 if(e.MONTHLY_SQL_ACTION!=='verify'||e.MONTHLY_SQL_CONFIRMATION!=='verify-monthly-sql-only'||e.GITHUB_EVENT_NAME!=='workflow_dispatch'||e.GITHUB_ACTOR_ID!=='270165082'||e.GITHUB_REF!=='refs/heads/main'||e.GITHUB_REPOSITORY!=='FanMind/FanMind'||!SHA.test(e.GITHUB_SHA??'')||e.MONTHLY_SQL_CANDIDATE!==e.GITHUB_SHA||!SHA.test(e.MONTHLY_SQL_BASE??'')||![e.MONTHLY_SQL_BASE,e.MONTHLY_SQL_CANDIDATE].includes(e.MONTHLY_SQL_LIVE)||!SHA.test(e.MONTHLY_SQL_TREE??'')||e.MONTHLY_SQL_SHA256!==adapter.sqlSha256)fail();
 if(adapter.id==='support_consent'&&e.FANMIND_SUPPORT_PERSISTENT_CONSENT_VERSION)fail();
 const owner=(e.FANMIND_ADMIN_EMAILS??'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)[0];
 const target=targetFor({...e,FANMIND_SUPPORT_REVIEWED_COMMIT:e.GITHUB_SHA,FANMIND_SUPPORT_CONFIRM:'support-production-verify'},'verify',owner);
 return {adapter,target};
}

// Reuse the existing price body/ACL/RLS postflight, then close its structural
// gaps. This is a verifier only; no change to the specialist apply controller.
export function monthlyPriceStructureSql(){
 const columns={
  revisions:[['id','bigint',true,'a','',null],['workspace_id','uuid',true,'','',null],['character_id','uuid',true,'','',null],['actor_id','uuid',false,'','',null],['recorded_at','timestamp with time zone',true,'','','clock_timestamp()'],['previous_revision','integer',true,'','',null],['next_revision','integer',true,'','',null],['previous_playbook','jsonb',true,'','',null],['next_playbook','jsonb',true,'','',null]],
  offers:[['workspace_id','uuid',true,'','',null],['character_id','uuid',true,'','',null],['generation_id','uuid',true,'','',null],['inbound_id','uuid',true,'','',null],['fan_id','uuid',true,'','',null],['conversation_id','uuid',true,'','',null],['character_revision','integer',true,'','',null],['actor_id','uuid',true,'','',null],['recorded_at','timestamp with time zone',true,'','','clock_timestamp()'],['binding','jsonb',true,'','',null],['playbook_offer','jsonb',true,'','',null]],
 };
 const functions=[...readFileSync('supabase/controlled/chat_admin_media_prices.sql','utf8').matchAll(/create function ((?:public|fanmind_media_price_evidence)\.\w+)\(([^]*?)\) returns (trigger|boolean|text\[\])\s+language plpgsql/gu)];
 if(functions.length!==4)fail();
 const functionShape=functions.map(([,name,args,result])=>`EXISTS(SELECT FROM pg_proc p WHERE p.oid=to_regprocedure('${name}(${args.trim()?args.trim().split(',').map(a=>a.trim().split(/\s+/u).slice(1).join(' ')).join(','):''})') AND pg_get_function_result(p.oid)='${result}' AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql') AND p.proargmodes IS NULL AND p.proallargtypes IS NULL AND NOT p.proleakproof AND p.prosupport=0 AND p.procost=100 AND p.prorows=0 AND coalesce(to_jsonb(p.proargnames),'[]'::jsonb)=${literal(args.trim()?args.trim().split(',').map(a=>a.trim().split(/\s+/u)[0]):[])})`).join(' AND ');
 const constraints={revisions:['PRIMARY KEY (id)','FOREIGN KEY (workspace_id, character_id) REFERENCES chat_characters(workspace_id, id) ON DELETE CASCADE'],offers:['PRIMARY KEY (workspace_id, character_id, generation_id)','FOREIGN KEY (inbound_id) REFERENCES chat_character_messages(id) ON DELETE CASCADE','FOREIGN KEY (workspace_id, character_id) REFERENCES chat_characters(workspace_id, id) ON DELETE CASCADE']};
 const clauses=Object.entries(columns).map(([table,expected])=>`(SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=to_regclass('fanmind_media_price_evidence.${table}') AND a.attnum>0 AND NOT a.attisdropped)=${literal(expected)} AND (SELECT jsonb_agg(pg_get_constraintdef(oid) ORDER BY pg_get_constraintdef(oid)) FROM pg_constraint WHERE conrelid=to_regclass('fanmind_media_price_evidence.${table}'))=${literal([...constraints[table]].sort())}`);
 return `SELECT 1/(CASE WHEN ${clauses.join(' AND ')} AND ${functionShape}
 AND NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid IN(to_regclass('fanmind_media_price_evidence.revisions'),to_regclass('fanmind_media_price_evidence.offers')) AND attnum>0 AND NOT attisdropped AND attacl IS NOT NULL)
 AND NOT EXISTS(SELECT FROM pg_index WHERE indrelid IN(to_regclass('fanmind_media_price_evidence.revisions'),to_regclass('fanmind_media_price_evidence.offers')) AND (NOT indisvalid OR NOT indisready))
 AND (SELECT array_agg(c.relname::text||':'||c.relkind::text ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='fanmind_media_price_evidence' AND c.relkind NOT IN('i','I'))=ARRAY['offers:r','revisions:r','revisions_id_seq:S']
 AND (SELECT count(*)=4 AND bool_and(typname IN('offers','revisions','_offers','_revisions')) FROM pg_type WHERE typnamespace=to_regnamespace('fanmind_media_price_evidence'))
 AND pg_get_serial_sequence('fanmind_media_price_evidence.revisions','id')='fanmind_media_price_evidence.revisions_id_seq'
 AND EXISTS(SELECT FROM pg_sequence WHERE seqrelid=to_regclass('fanmind_media_price_evidence.revisions_id_seq') AND seqtypid='bigint'::regtype AND seqstart=1 AND seqincrement=1 AND seqmin=1 AND seqmax=9223372036854775807 AND seqcache=1 AND NOT seqcycle)
 AND NOT EXISTS(SELECT FROM pg_constraint WHERE conrelid IN(to_regclass('fanmind_media_price_evidence.revisions'),to_regclass('fanmind_media_price_evidence.offers')) AND (NOT convalidated OR condeferrable OR condeferred))
 AND (SELECT count(*)=3 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='fanmind_media_price_evidence' AND c.relkind NOT IN('i','I'))
 AND NOT EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='fanmind_media_price_evidence' AND (c.relowner<>to_regrole('postgres') OR c.relpersistence<>'p' OR c.reloptions IS NOT NULL OR c.relforcerowsecurity OR EXISTS(SELECT FROM aclexplode(coalesce(c.relacl,acldefault(CASE WHEN c.relkind='S' THEN 'S'::"char" ELSE 'r'::"char" END,c.relowner))) a WHERE a.grantee<>to_regrole('postgres'))))
 AND (SELECT count(*)=4 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='fanmind_media_price_evidence' OR n.nspname='public' AND (p.proname LIKE 'chat_admin_price_%' OR p.proname='persist_chat_admin_media_generation'))
 AND NOT EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='fanmind_media_price_evidence' OR n.nspname='public' AND (p.proname LIKE 'chat_admin_price_%' OR p.proname='persist_chat_admin_media_generation')) AND (p.provolatile<>'v' OR p.proparallel<>'u' OR p.proisstrict OR p.proretset OR p.proargdefaults IS NOT NULL OR p.prokind<>'f' OR EXISTS(SELECT FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.is_grantable AND a.grantee<>p.proowner)))
 AND NOT EXISTS(SELECT FROM pg_namespace n, LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='fanmind_media_price_evidence' AND a.grantee<>n.nspowner)
 AND (SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY pg_get_indexdef(i.indexrelid)) FROM pg_index i WHERE i.indrelid IN(to_regclass('fanmind_media_price_evidence.revisions'),to_regclass('fanmind_media_price_evidence.offers')) AND i.indisvalid AND i.indisready)=${literal([
 'CREATE UNIQUE INDEX revisions_pkey ON fanmind_media_price_evidence.revisions USING btree (id)',
 'CREATE UNIQUE INDEX offers_pkey ON fanmind_media_price_evidence.offers USING btree (workspace_id, character_id, generation_id)',
 'CREATE INDEX media_price_revision_character ON fanmind_media_price_evidence.revisions USING btree (workspace_id, character_id, next_revision)',
 'CREATE INDEX media_price_offer_inbound ON fanmind_media_price_evidence.offers USING btree (inbound_id)',
 ].sort())}
 AND NOT EXISTS(SELECT FROM pg_trigger WHERE tgrelid IN(to_regclass('fanmind_media_price_evidence.revisions'),to_regclass('fanmind_media_price_evidence.offers')) AND NOT tgisinternal)
 THEN 1 ELSE 0 END);`;
}
export function monthlySqlQueries(id){
 const adapter=sqlAdapter(id);
 if(sha256(readFileSync(adapter.path))!==adapter.sqlSha256)fail();
 if(id==='capacity_writer'){
  sourcePackage();const ref=JSON.parse(readFileSync(REFERENCE,'utf8'));
  if(sha256(JSON.stringify(ref.catalogue))!==ref.catalogue_sha256)fail();
  return [{query:capacityCatalogueSql(),accept:raw=>canonical(JSON.parse(raw))===canonical(ref.catalogue)}];
 }
 if(id==='support_consent'){
  const ref=JSON.parse(readFileSync(SUPPORT_REFERENCE,'utf8'));assertReference(ref);
  return [{query:consentCatalogueSql(),accept:raw=>classifyConsent(JSON.parse(raw))==='EXACT'},
   {query:supportCatalogueSql(),accept:raw=>classifySupport(JSON.parse(raw),ref)==='EXACT'},
   {query:roleBoundarySql(),accept:raw=>raw==='t'}];
 }
 const catalogue={query:mediaSchemaStateSql(loadMediaSchemaProfile('extended')),accept:raw=>raw==='extended'};
 if(id==='media_catalogue')return [catalogue];
 if(id==='media_storage')return [{query:storageGuardStateSql(),accept:raw=>raw==='ready'}];
 if(id==='media_prices')return [catalogue,
  {query:priceSchemaPostflight().replace('BEGIN READ ONLY;','').replace('ROLLBACK;',''),accept:raw=>raw==='1'},
  {query:monthlyPriceStructureSql(),accept:raw=>raw==='1'}];
 fail();
}
export async function collectMonthlySql(e,deps){
 const {adapter,target}=assertMonthlySqlRequest(e);
 await deps.assertSource();await deps.assertLive(e.MONTHLY_SQL_LIVE);
 const checks=monthlySqlQueries(adapter.id);
 if(adapter.id==='support_consent'){
  const quote=s=>"'"+s.replaceAll("'","''")+"'";
  checks.push({query:`SELECT count(*)=1 FROM public.support_centre_owners o JOIN auth.users u ON u.id=o.user_id WHERE lower(u.email) IN(${target.emails.map(quote).join(',')}) AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<clock_timestamp());`,accept:raw=>raw==='t'});
 }
 // One read-only repeatable-read snapshot for all checks; never call a DB RPC.
 const results=await deps.readSnapshot(checks.map(c=>c.query),target);
 if(!Array.isArray(results)||results.length!==checks.length||!checks.every((c,i)=>c.accept(results[i])))fail();
 await deps.assertLive(e.MONTHLY_SQL_LIVE);await deps.assertSource();
 return {ADAPTER:adapter.id,PATH:adapter.path,SHA256:adapter.sqlSha256,TARGET:'production',PROJECT:'drqkpdvtbbrrdwmtrodz',BASE:e.MONTHLY_SQL_BASE,LIVE:e.MONTHLY_SQL_LIVE,CANDIDATE:e.MONTHLY_SQL_CANDIDATE,TREE:e.MONTHLY_SQL_TREE,ACTION:'verify',STATE:'EXACT',RESULT:'verified'};
}
function run(){
 const e=process.env;assertMonthlySqlRequest(e);if(process.getuid()!==0)fail();
 const exec=(file,args,input,env={PATH:'/usr/bin:/bin',LANG:'C'})=>execFileSync(file,args,{input,env,encoding:'utf8',timeout:45000,maxBuffer:2*1024*1024,stdio:['pipe','pipe','pipe']}).trim();
 const dir=mkdtempSync(join(tmpdir(),'fanmind-monthly-sql-'));
 try{
  const pass=readProductionFile(e.FANMIND_BACKUP_PGPASSFILE,[0],[0o600],65536).content;
  const passfile=join(dir,'pgpass');writeFileSync(passfile,pass,{flag:'wx',mode:0o600});
  return collectMonthlySql(e,{
   assertSource:()=>{const r=JSON.parse(readProductionFile('.monthly-reviewed-source',[0],[0o600],256).content);if(r.commit!==e.GITHUB_SHA||r.tree!==e.MONTHLY_SQL_TREE)fail();},
   assertLive:base=>{const v=JSON.parse(exec('/usr/bin/curl',['-q','-fsS','--proto','=https','--max-time','15','--max-filesize','16384','https://fanmind.ch/api/version']));if(v.application!=='fanmind'||v.runtimeEnvironment!=='production'||v.releaseCommit!==base)fail();},
   readSnapshot:(queries,target)=>{
    const sql="BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SET LOCAL statement_timeout='10s';SET LOCAL lock_timeout='3s';SET LOCAL row_security=off;SET LOCAL search_path=pg_catalog,public;"+queries.map(q=>q.trim().replace(/;$/u,'')+';').join('\n')+'ROLLBACK;';
    const raw=exec('/usr/bin/psql',['--no-password','--no-psqlrc','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],sql,{PATH:'/usr/bin:/bin',LANG:'C',PGHOST:target.host,PGPORT:'5432',PGDATABASE:'postgres',PGUSER:target.user,PGPASSFILE:passfile,PGSSLMODE:'verify-full',PGSSLROOTCERT:resolve('config/certificates/supabase-root-2021-ca.crt'),PGCONNECT_TIMEOUT:'10',PGOPTIONS:'-c default_transaction_read_only=on'});
    return raw.split('\n');
   },
  }).finally(()=>rmSync(dir,{recursive:true,force:true}));
 }catch(error){rmSync(dir,{recursive:true,force:true});throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const result=await run();for(const [key,value]of Object.entries(result))console.log(`MONTHLY_SQL_${key}=${value}`);}
 catch{console.error('MONTHLY_SQL_RESULT=blocked');process.exitCode=1;}
}
