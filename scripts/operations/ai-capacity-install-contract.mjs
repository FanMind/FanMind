import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const hash=s=>createHash('sha256').update(s).digest('hex');
export const literal=s=>"'"+s.replaceAll("'","''")+"'";
export const CONTROL='docs/operations/ai-capacity-install.json';
export const REFERENCE='docs/operations/ai-capacity-installed-reference.json';
export const PATHS={foundation:'supabase/controlled/ai_capacity_billing_v2.sql',activation:'supabase/controlled/ai_capacity_billing_v2_activation_gates.sql',lifecycle:'supabase/controlled/ai_capacity_reserve_settle.sql',writer:'supabase/controlled/ai_capacity_entitlement_writer.sql',observation:'scripts/operations/ai-capacity-staging-preflight.sql'};
const fail=()=>{throw Error('capacity_install_blocked');};
export function sourcePackage(){const c=JSON.parse(readFileSync(CONTROL,'utf8'));for(const [p,sha] of Object.entries(c.sha256))if(hash(readFileSync(p))!==sha)fail();for(const p of Object.values(PATHS))if(!c.sha256[p])fail();if(c.version!==1||c.target!=='vshyhvgcmrlagvfnvomc'||c.production!=='drqkpdvtbbrrdwmtrodz')fail();return c;}
export function body(s){if(!/^begin;\s/u.test(s)||! /commit;\s*$/u.test(s))fail();return s.replace(/^begin;\s/u,'').replace(/commit;\s*$/u,'');}
export function catalogueSql(){return `SELECT jsonb_build_object(
 'relations',coalesce((SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'persistence',c.relpersistence,'access_method',(select amname from pg_am where oid=c.relam),'options',c.reloptions,'replica_identity',c.relreplident,'acl',c.relacl::text,
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid),a.attacl::text,a.attidentity,a.attgenerated,(select collname from pg_collation where oid=a.attcollation)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(x.conname,pg_get_constraintdef(x.oid,true),x.convalidated) ORDER BY x.conname) FROM pg_constraint x WHERE x.conrelid=c.oid),
 'indexes',(SELECT jsonb_agg(jsonb_build_array(pg_get_indexdef(i.indexrelid),i.indisvalid,i.indisready) ORDER BY pg_get_indexdef(i.indexrelid)) FROM pg_index i WHERE i.indrelid=c.oid),
 'policies',(SELECT jsonb_agg(jsonb_build_array(polname,polcmd,polroles::text,pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid)) ORDER BY polname) FROM pg_policy WHERE polrelid=c.oid)) ORDER BY n.nspname,c.relname)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE (n.nspname='public' AND c.relname LIKE 'ai_capacity_%' OR n.nspname='fanmind_capacity_private') AND c.relkind NOT IN('i','I')),'[]'::jsonb),
 'functions',coalesce((SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,'definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='fanmind_capacity_private' OR n.nspname='public' AND (p.proname LIKE 'ai_capacity_%' OR p.proname IN('sync_ai_capacity_entitlement','admin_get_ai_capacity_policy','admin_update_ai_capacity_policy'))),'[]'::jsonb),
 'triggers',coalesce((SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,t.tgname,pg_get_triggerdef(t.oid,true),t.tgenabled) ORDER BY n.nspname,c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND (n.nspname='public' AND c.relname LIKE 'ai_capacity_%' OR t.tgname IN('capacity_workspace_invalidate','capacity_billing_invalidate','capacity_billing_delete'))),'[]'::jsonb),
 'private_schema',(SELECT jsonb_build_array(pg_get_userbyid(nspowner),nspacl::text) FROM pg_namespace WHERE nspname='fanmind_capacity_private'))`;}
export function markerSql(){return `SELECT encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_array(version,name,statements) ORDER BY version)::text,'[]'),'UTF8')),'hex') FROM supabase_migrations.schema_migrations WHERE coalesce(name,'') ~* 'ai[_ -]?capacity|capacity[_ -]?(billing|reserve|v2)' OR version ~* 'ai[_ -]?capacity|capacity[_ -]?(billing|reserve|v2)'`;}
export function observationSql(){return readFileSync(PATHS.observation,'utf8').slice(readFileSync(PATHS.observation,'utf8').indexOf('with table_profiles')).replace(/rollback;\s*$/u,'');}
// Separate, explicit reconciliation profile. The original protected readonly verifier is unchanged.
export function baselinePredicate(alias='o',readOnly=false){
 const c=JSON.parse(readFileSync('docs/operations/ai-capacity-staging-preparation.json','utf8'));
 const expected={...c.expectedObservation,read_only:readOnly};
 for(const k of ['schema_md5','schema_matches_after_budget_default_normalization','function_security_matches','rls_acl_security_matches','policy_package_99_budget_default_matches','policy_package_199_budget_default_matches','policy_package_312_budget_default_matches'])delete expected[k];
 Object.assign(expected,{capacity_generic_migration_marker_absent:false,capacity_unknown_migration_marker_absent:false,capacity_migration_marker_count:2,capacity_unknown_migration_marker_count:2,capacity_unknown_marker_name_only_count:2,capacity_unknown_marker_with_statements_count:2,capacity_all_markers_unknown:true,capacity_all_markers_unknown_name_only:true,capacity_all_markers_have_statements:true});
 return `(${alias} @> ${literal(JSON.stringify(expected))}::jsonb AND ${alias}->'policy'=${literal(JSON.stringify(c.expectedPolicy))}::jsonb AND NOT EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('ai_capacity_admin_policy','ai_capacity_grants','ai_capacity_reservations','ai_capacity_reservation_allocations','ai_capacity_ledger_events') AND (c.relpersistence<>'p' OR c.reloptions IS NOT NULL OR c.relam<>(SELECT oid FROM pg_am WHERE amname='heap'))))`;
}
export const reconcileSql=`ALTER TABLE public.ai_capacity_admin_policy ALTER COLUMN package_99_budget_eur_microcents SET DEFAULT 1500000000, ALTER COLUMN package_199_budget_eur_microcents SET DEFAULT 3000000000, ALTER COLUMN package_312_budget_eur_microcents SET DEFAULT 5000000000;
REVOKE ALL ON public.ai_capacity_admin_policy,public.ai_capacity_grants,public.ai_capacity_reservations,public.ai_capacity_reservation_allocations,public.ai_capacity_ledger_events FROM service_role;
GRANT SELECT ON public.ai_capacity_admin_policy,public.ai_capacity_grants,public.ai_capacity_reservations,public.ai_capacity_reservation_allocations,public.ai_capacity_ledger_events TO service_role;
REVOKE EXECUTE ON FUNCTION public.ai_capacity_ledger_immutable() FROM anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.ai_capacity_admin_activation_guard() FROM service_role;`;
export function installSql(marker,reference){
 sourcePackage();if(!/^[a-f0-9]{64}$/u.test(marker)||hash(JSON.stringify(reference.catalogue))!==reference.catalogue_sha256)fail();
 return `BEGIN; SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='60s';SET LOCAL row_security=off;SET LOCAL search_path=pg_catalog,public;
 SELECT pg_advisory_xact_lock(hashtextextended('fanmind-capacity-install-v1',0));
 LOCK TABLE public.ai_capacity_admin_policy,public.ai_capacity_grants,public.ai_capacity_reservations,public.ai_capacity_reservation_allocations,public.ai_capacity_ledger_events,public.workspaces,public.workspace_stripe_billing_streams,public.workspace_stripe_billing_reconciliations IN SHARE ROW EXCLUSIVE MODE;
 SELECT 1/(CASE WHEN NOT EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN('ai_capacity_admin_policy','ai_capacity_grants','ai_capacity_reservations','ai_capacity_reservation_allocations','ai_capacity_ledger_events') AND (c.relpersistence<>'p' OR c.reloptions IS NOT NULL OR c.relam<>(SELECT oid FROM pg_am WHERE amname='heap'))) THEN 1 ELSE 0 END);
 CREATE TEMP TABLE capacity_before(observation) ON COMMIT DROP AS ${observationSql()}
 SELECT 1/(CASE WHEN (SELECT ${baselinePredicate('observation')} FROM capacity_before) THEN 1 ELSE 0 END);
 SELECT 1/(CASE WHEN (${markerSql()})=${literal(marker)} THEN 1 ELSE 0 END);
 SELECT 1/(CASE WHEN to_regnamespace('fanmind_capacity_private') IS NULL AND to_regprocedure('public.sync_ai_capacity_entitlement(text,text,bigint)') IS NULL THEN 1 ELSE 0 END);
 ${reconcileSql}
 ${body(readFileSync(PATHS.lifecycle,'utf8'))}
 ${body(readFileSync(PATHS.writer,'utf8'))}
 CREATE TEMP TABLE capacity_after(catalogue) ON COMMIT DROP AS ${catalogueSql()};
 SELECT 1/(CASE WHEN (SELECT catalogue FROM capacity_after)=${literal(JSON.stringify(reference.catalogue))}::jsonb THEN 1 ELSE 0 END);
 SELECT 1/(CASE WHEN (${markerSql()})=${literal(marker)} THEN 1 ELSE 0 END);
 COMMIT;`;
}
