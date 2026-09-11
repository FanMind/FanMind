import { createHash } from "node:crypto";

export const SOCIAL_PROVIDER_SCHEMA_SHA256 = "a9b5519eb66e782cb45a5ae9ae0f35bfcba2c7ea438fa7f9adf22ddf3a6597bf";
export const SOCIAL_TABLES = ["social_provider_connections", "social_provider_oauth_attempts"];
const FUNCTIONS = [
  ["fanmind_social_owner(uuid,uuid)", "boolean", "sql", "s", false],
  ["fanmind_social_begin(uuid,uuid,text,text,text)", "boolean", "plpgsql", "v", false],
  ["fanmind_social_consume(uuid,uuid,text,text)", "text", "plpgsql", "v", false],
  ["fanmind_social_complete(uuid,uuid,text,text,text,text,text,timestamptz)", "boolean", "plpgsql", "v", false],
  ["fanmind_social_disconnect(uuid,uuid,text)", "public.social_provider_connections", "plpgsql", "v", true],
  ["fanmind_social_claim_read(uuid,uuid,text,uuid,uuid,boolean)", "public.social_provider_connections", "plpgsql", "v", true],
  ["fanmind_social_rotate(uuid,uuid,text,uuid,uuid,text,timestamptz)", "boolean", "plpgsql", "v", false],
  ["fanmind_social_finish_read(uuid,uuid,text,uuid,uuid)", "boolean", "plpgsql", "v", false],
];
export function checkSocialArtifact(sql) {
  if (typeof sql !== "string" || createHash("sha256").update(sql).digest("hex") !== SOCIAL_PROVIDER_SCHEMA_SHA256) throw new Error("SOCIAL_PROVIDER_SCHEMA_ERROR=artifact_checksum");
  return sql;
}
export const SOCIAL_STATE_SQL = `
with objects as (
 select count(*) as tables from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname in ('social_provider_connections','social_provider_oauth_attempts')
), functions as (
 select count(*) as functions from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and left(p.proname,15)='fanmind_social_'
)
select 'SOCIAL_PROVIDER_SCHEMA_STATE=' || case when tables=0 and functions=0 then 'absent'
 when tables=2 and functions=8 then 'present' else 'partial' end from objects cross join functions;
`;
export const SOCIAL_PREFLIGHT_BODY = `
do $preflight$
begin
 if current_setting('server_version_num')::integer / 10000 <> 17 then raise exception 'social_pg17_required'; end if;
 if not exists(select 1 from pg_class where oid=to_regclass('public.workspaces') and relkind='r' and relrowsecurity)
   or not exists(select 1 from pg_class where oid=to_regclass('auth.users') and relkind='r')
   or to_regprocedure('auth.uid()') is null then raise exception 'social_parent_required'; end if;
 if (select count(*) from pg_attribute where attrelid='public.workspaces'::regclass and attname in ('id','owner_user_id')
   and atttypid='uuid'::regtype and not attisdropped) <> 2 then raise exception 'social_parent_columns'; end if;
 if not has_table_privilege('service_role','public.workspaces','SELECT')
   or not has_column_privilege('authenticated','public.workspaces','id','SELECT')
   or not has_column_privilege('authenticated','public.workspaces','owner_user_id','SELECT')
   or not exists(select 1 from pg_roles where rolname='service_role' and rolbypassrls)
   then raise exception 'social_parent_privileges'; end if;
end $preflight$;
`;
function referenceSql(sql) {
  const start=sql.indexOf("create table public.social_provider_connections");
  const end=sql.indexOf("-- Service caller");
  if(start<0 || end<start) throw new Error("SOCIAL_PROVIDER_SCHEMA_ERROR=reference_contract");
  const ddl=sql.slice(start,end).replaceAll("public.","pg_temp.").replaceAll("auth.users","pg_temp.users").replaceAll("create table pg_temp.","create temporary table pg_temp.");
  return `set search_path=pg_catalog;
create temporary table pg_temp.users(id uuid primary key);
create temporary table pg_temp.workspaces(id uuid primary key,owner_user_id uuid);
${ddl}
create function pg_temp.social_schema_normalize(def text) returns text language sql immutable as $norm$
 select replace(regexp_replace(def,'(public|pg_temp(_[0-9]+)?)\\.','','g'),'auth.users','users')
$norm$;
create function pg_temp.social_schema_acl(acl aclitem[],owner_id oid,kind \"char\") returns jsonb language sql immutable as $acl$
 select jsonb_agg(jsonb_build_array(grantor,grantee,privilege_type,is_grantable) order by grantor,grantee,privilege_type,is_grantable)
 from aclexplode(coalesce(acl,acldefault(kind,owner_id)))
$acl$;
`;
}
function functionChecks(sql) {
 return FUNCTIONS.map(([signature,returns,language,volatility,retset])=>{
  const name=signature.split("(")[0];
  const match=sql.match(new RegExp(`create function public\\.${name}\\(([\\s\\S]*?)\\)\\s*returns[\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`,"u"));
  if(!match) throw new Error("SOCIAL_PROVIDER_SCHEMA_ERROR=function_contract");
  const body=Buffer.from(match[2],"utf8").toString("hex");
  const names=match[1].split(",").map(a=>a.trim().split(/\s+/u)[0]);
  if(!names.every(n=>/^p_[a-z_]+$/u.test(n))) throw new Error("SOCIAL_PROVIDER_SCHEMA_ERROR=function_arguments");
  const defaults=name==="fanmind_social_claim_read" ? "'false'" : "null";
  return `
 f:=to_regprocedure('public.${signature}');
 if not exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=f
  and p.prosrc=convert_from(decode('${body}','hex'),'UTF8') and not p.prosecdef and not p.proleakproof
  and p.prokind='f' and p.proparallel='u' and p.proconfig=array['search_path=""']::text[]
  and p.proargnames=array[${names.map(n=>`'${n}'`).join(",")}]::text[]
  and pg_get_expr(p.proargdefaults,0) is not distinct from ${defaults}
  and l.lanname='${language}' and p.provolatile='${volatility}' and p.proretset=${retset}
  and p.prorettype='${returns}'::regtype and p.proowner=(select oid from pg_roles where rolname=session_user))
  then raise exception 'social_function_drift'; end if;
 if has_function_privilege('anon',f,'EXECUTE') or has_function_privilege('authenticated',f,'EXECUTE')
  or not has_function_privilege('service_role',f,'EXECUTE')
  or exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid=f
   and (a.grantee not in (p.proowner,(select oid from pg_roles where rolname='service_role')) or (a.is_grantable and a.grantee<>p.proowner)))
  then raise exception 'social_function_acl_drift'; end if;
`;
 }).join("\n");
}
export function buildSocialVerification(sql) {
 checkSocialArtifact(sql);
 const reference=referenceSql(sql);
 const body=`${SOCIAL_PREFLIGHT_BODY}
do $verify$
declare tab text; actual oid; expected oid; a jsonb; e jsonb; f oid;
begin
 if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and left(p.proname,15)='fanmind_social_')<>8
  then raise exception 'social_function_count_drift'; end if;
 foreach tab in array array['social_provider_connections','social_provider_oauth_attempts'] loop
  actual:=to_regclass('public.'||tab); expected:=to_regclass('pg_temp.'||tab);
  if actual is null or expected is null then raise exception 'social_table_missing'; end if;
  if not exists(select 1 from pg_class where oid=actual and relkind='r' and relpersistence='p' and relrowsecurity
   and not relforcerowsecurity and relowner=(select oid from pg_roles where rolname=session_user)) then raise exception 'social_rls_drift'; end if;
  select jsonb_agg(jsonb_build_array(c.attname,format_type(c.atttypid,c.atttypmod),c.attnotnull,c.attidentity,c.attgenerated,c.attcollation,
   pg_temp.social_schema_normalize(pg_get_expr(d.adbin,d.adrelid)),pg_temp.social_schema_acl(c.attacl,t.relowner,'c')) order by c.attname) into a
   from pg_attribute c join pg_class t on t.oid=c.attrelid left join pg_attrdef d on d.adrelid=c.attrelid and d.adnum=c.attnum
   where c.attrelid=actual and c.attnum>0 and not c.attisdropped;
  select jsonb_agg(jsonb_build_array(c.attname,format_type(c.atttypid,c.atttypmod),c.attnotnull,c.attidentity,c.attgenerated,c.attcollation,
   pg_temp.social_schema_normalize(pg_get_expr(d.adbin,d.adrelid)),pg_temp.social_schema_acl(c.attacl,t.relowner,'c')) order by c.attname) into e
   from pg_attribute c join pg_class t on t.oid=c.attrelid left join pg_attrdef d on d.adrelid=c.attrelid and d.adnum=c.attnum
   where c.attrelid=expected and c.attnum>0 and not c.attisdropped;
  if a is distinct from e then raise exception 'social_columns_drift'; end if;
  select jsonb_agg(jsonb_build_array(conname,contype,convalidated,condeferrable,condeferred,pg_temp.social_schema_normalize(pg_get_constraintdef(oid))) order by conname) into a from pg_constraint where conrelid=actual;
  select jsonb_agg(jsonb_build_array(conname,contype,convalidated,condeferrable,condeferred,pg_temp.social_schema_normalize(pg_get_constraintdef(oid))) order by conname) into e from pg_constraint where conrelid=expected;
  if a is distinct from e then raise exception 'social_constraints_drift'; end if;
  if exists(select 1 from pg_constraint ac join pg_constraint ec on ec.conrelid=expected and ec.conname=ac.conname join pg_class er on er.oid=ec.confrelid
   where ac.conrelid=actual and ac.contype='f' and ac.confrelid is distinct from to_regclass((case when er.relname='users' then 'auth.' else 'public.' end)||er.relname))
   then raise exception 'social_foreign_parent_drift'; end if;
  select jsonb_agg(jsonb_build_array(polname,polcmd,polpermissive,polroles,pg_temp.social_schema_normalize(pg_get_expr(polqual,polrelid)),pg_temp.social_schema_normalize(pg_get_expr(polwithcheck,polrelid))) order by polname) into a from pg_policy where polrelid=actual;
  select jsonb_agg(jsonb_build_array(polname,polcmd,polpermissive,polroles,pg_temp.social_schema_normalize(pg_get_expr(polqual,polrelid)),pg_temp.social_schema_normalize(pg_get_expr(polwithcheck,polrelid))) order by polname) into e from pg_policy where polrelid=expected;
  if a is distinct from e then raise exception 'social_policy_drift'; end if;
  select jsonb_agg(jsonb_build_array(i.indisvalid,i.indisready,pg_temp.social_schema_normalize(pg_get_indexdef(i.indexrelid))) order by c.relname) into a from pg_index i join pg_class c on c.oid=i.indexrelid where i.indrelid=actual;
  select jsonb_agg(jsonb_build_array(i.indisvalid,i.indisready,pg_temp.social_schema_normalize(pg_get_indexdef(i.indexrelid))) order by c.relname) into e from pg_index i join pg_class c on c.oid=i.indexrelid where i.indrelid=expected;
  if a is distinct from e then raise exception 'social_index_drift'; end if;
  select pg_temp.social_schema_acl(relacl,relowner,'r') into a from pg_class where oid=actual;
  select pg_temp.social_schema_acl(relacl,relowner,'r') into e from pg_class where oid=expected;
  if a is distinct from e then raise exception 'social_table_acl_drift'; end if;
  if exists(select 1 from pg_trigger where tgrelid=actual and (not tgisinternal or tgenabled<>'O'))
   or exists(select 1 from pg_rewrite where ev_class=actual) then raise exception 'social_trigger_rule_drift'; end if;
 end loop;
 ${functionChecks(sql)}
end $verify$;
`;
 return {reference,body,verify:`\\set ON_ERROR_STOP on\n${reference}\nbegin read only;\nset local statement_timeout='60s';\n${body}\nselect 'SOCIAL_PROVIDER_SCHEMA_POSTFLIGHT=PASS';\nrollback;\n`};
}
export function buildSocialApply(sql) {
 const {reference,body}=buildSocialVerification(sql);
 const artifact=sql.replace(/^begin;$/mu,"").replace(/commit;\s*$/u,"");
 return `\\set ON_ERROR_STOP on
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(617041729114::bigint);
${SOCIAL_PREFLIGHT_BODY}
${artifact}
${reference}
${body}
commit;
select 'SOCIAL_PROVIDER_SCHEMA_APPLY=COMMITTED';
`;
}
