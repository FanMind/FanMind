import { createHash } from "node:crypto";

export const CREATOR_FOUNDATION_SHA256 = "8065596853f07feffd419ac1473a34fe727a6152f1f742161af16a909d2f457f";
export const CREATOR_TABLES = ["creators", "creator_voice_profiles", "creator_sales_playbooks", "creator_commercial_events"];
const FUNCTIONS = [
  ["guard_creator_identity()", false, "trigger"],
  ["save_creator_bundle(uuid,uuid,integer,jsonb,jsonb,jsonb,boolean)", true, "uuid"],
  ["record_creator_fan_review(uuid,uuid,jsonb,jsonb)", true, "void"],
];
export function checkCreatorArtifact(sql) {
  if (typeof sql !== "string" || createHash("sha256").update(sql).digest("hex") !== CREATOR_FOUNDATION_SHA256) {
    throw new Error("CREATOR_FOUNDATION_ERROR=artifact_checksum");
  }
  return sql;
}

// Catalog only. Counts classify absence; complete presence still requires the
// exact reference comparison below. No catalog count is an acceptance receipt.
export const CREATOR_STATE_SQL = `
with objects as (
 select count(*) as tables from pg_class c
 join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname in ('creators','creator_voice_profiles','creator_sales_playbooks','creator_commercial_events')
), columns as (
 select count(*) as columns from pg_attribute a
 where a.attrelid in (to_regclass('public.conversations'),to_regclass('public.contact_ai_profiles'))
 and a.attname in ('sales_state','sales_state_updated_at','sales_state_source','commercial_profile') and not a.attisdropped
), functions as (
 select count(*) as functions from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('guard_creator_identity','save_creator_bundle','record_creator_fan_review')
), constraints as (
 select count(*) as constraints from pg_constraint c
 where c.conrelid in (to_regclass('public.contacts'),to_regclass('public.conversations'),to_regclass('public.contact_ai_profiles'))
 and c.conname in ('contacts_workspace_identity_unique','conversations_parent_identity_unique','conversations_sales_state_check','conversations_sales_state_source_check','contact_ai_profiles_commercial_profile_check')
)
select 'CREATOR_FOUNDATION_STATE=' || case
 when tables=0 and columns=0 and functions=0 and constraints=0 then 'absent'
 when tables=4 and columns=4 and functions=3 and constraints=5 then 'present'
 else 'partial' end from objects cross join columns cross join functions cross join constraints;
`;

export const CREATOR_PREFLIGHT_BODY = `
do $preflight$
declare tab text; col record; privilege text;
begin
 if current_setting('server_version_num')::integer / 10000 <> 17 then raise exception 'creator_pg17_required'; end if;
 foreach tab in array array['workspaces','workspace_members','contacts','conversations','contact_ai_profiles'] loop
  if not exists(select 1 from pg_class where oid=to_regclass('public.'||tab) and relkind='r' and relrowsecurity) then
   raise exception 'creator_parent_rls_required';
  end if;
 end loop;
 for col in select * from (values
  ('workspaces','id'),('workspaces','owner_user_id'),('workspace_members','workspace_id'),('workspace_members','user_id'),
  ('contacts','id'),('contacts','workspace_id'),('conversations','id'),('conversations','workspace_id'),('conversations','contact_id'),
  ('contact_ai_profiles','workspace_id'),('contact_ai_profiles','contact_id')
 ) as expected(tab,name) loop
  if not exists(select 1 from pg_attribute where attrelid=to_regclass('public.'||col.tab) and attname=col.name and atttypid='uuid'::regtype and not attisdropped)
   or not has_column_privilege('authenticated','public.'||col.tab,col.name,'SELECT') then raise exception 'creator_parent_column_invalid'; end if;
 end loop;
 if to_regclass('auth.users') is null or to_regprocedure('auth.uid()') is null then raise exception 'creator_auth_missing'; end if;
 if has_table_privilege('anon','public.contact_ai_profiles','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') then raise exception 'creator_anon_profile_privilege'; end if;
 foreach privilege in array array['INSERT','UPDATE','REFERENCES'] loop
  if has_any_column_privilege('authenticated','public.contact_ai_profiles',privilege) then raise exception 'creator_profile_write_privilege'; end if;
 end loop;
 if has_table_privilege('authenticated','public.contact_ai_profiles','DELETE,TRUNCATE,TRIGGER') then raise exception 'creator_profile_write_privilege'; end if;
 if not exists(select 1 from pg_constraint where conrelid='public.contact_ai_profiles'::regclass and contype='u' and convalidated
   and conkey=array[(select attnum from pg_attribute where attrelid='public.contact_ai_profiles'::regclass and attname='workspace_id'),
                   (select attnum from pg_attribute where attrelid='public.contact_ai_profiles'::regclass and attname='contact_id')]::smallint[]) then
  raise exception 'creator_profile_parent_unique_required';
 end if;
end $preflight$;
`;

// Only session-temporary reference objects. They contain no customer rows and
// disappear on disconnect. The public artifact is never executed by Verify.
// PostgreSQL itself parses the pinned expressions, defaults, keys and policies,
// avoiding approximate string matching or accepting a check with weakened logic.
function referenceSql(sql) {
  const start = sql.indexOf("create table public.creators");
  const end = sql.indexOf("-- Workspace identity cannot");
  const rlsStart = sql.indexOf("do $$\ndeclare tab text;");
  const rlsEnd = sql.indexOf("\nend $$;", rlsStart) + "\nend $$;".length;
  if (start < 0 || end < start || rlsStart < 0 || rlsEnd <= rlsStart) throw new Error("CREATOR_FOUNDATION_ERROR=reference_contract");
  const ddl = sql.slice(start,end).replaceAll("public.","pg_temp.").replaceAll("auth.users","pg_temp.users").replaceAll("create table pg_temp.","create temporary table pg_temp.");
  const policies = sql.slice(rlsStart,rlsEnd).replaceAll("public.","pg_temp.");
  return `set search_path = pg_catalog;
create temporary table pg_temp.users(id uuid primary key);
create temporary table pg_temp.workspaces(id uuid primary key,owner_user_id uuid);
create temporary table pg_temp.workspace_members(workspace_id uuid,user_id uuid);
create temporary table pg_temp.contacts(id uuid primary key,workspace_id uuid);
create temporary table pg_temp.conversations(id uuid primary key,workspace_id uuid,contact_id uuid);
create temporary table pg_temp.contact_ai_profiles(workspace_id uuid,contact_id uuid);
${ddl}
${policies}
create function pg_temp.creator_normalize(def text) returns text language sql immutable as $norm$
 select replace(regexp_replace(def,'(public|pg_temp(_[0-9]+)?)\\.','','g'),'auth.users','users')
$norm$;
`;
}

function functionChecks(sql) {
  return FUNCTIONS.map(([signature,definer,returns]) => {
    const name=signature.split("(")[0];
    const match=sql.match(new RegExp(`create function public\\.${name}\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`,"u"));
    if (!match) throw new Error("CREATOR_FOUNDATION_ERROR=function_contract");
    const body=Buffer.from(match[1],"utf8").toString("hex");
    return `
 f := to_regprocedure('public.${signature}');
 if not exists(select 1 from pg_proc p join pg_language l on l.oid=p.prolang
  where p.oid=f and p.prosrc=convert_from(decode('${body}','hex'),'UTF8')
  and p.prosecdef=${definer} and not p.proleakproof and p.prokind='f' and p.proparallel='u'
  and p.proconfig=array['search_path=""']::text[] and l.lanname='plpgsql'
  and p.prorettype='${returns}'::regtype and not p.proretset and p.provolatile='v'
  and p.proowner=(select oid from pg_roles where rolname=session_user)) then raise exception 'creator_function_drift'; end if;
 if has_function_privilege('anon',f,'EXECUTE') or has_function_privilege('service_role',f,'EXECUTE') or
  has_function_privilege('authenticated',f,'EXECUTE') <> ${name !== "guard_creator_identity"} or
  exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   where p.oid=f and (a.grantee not in (p.proowner${name !== "guard_creator_identity" ? ",(select oid from pg_roles where rolname='authenticated')" : ""}) or (a.is_grantable and a.grantee<>p.proowner)))
 then raise exception 'creator_function_acl_drift'; end if;
`;
  }).join("\n");
}

export function buildCreatorVerification(sql) {
 checkCreatorArtifact(sql);
 const reference=referenceSql(sql);
 const body=`${CREATOR_PREFLIGHT_BODY}
do $verify$
declare tab text; actual oid; expected oid; a jsonb; e jsonb; f oid; role_name text; privilege text; allowed boolean;
begin
 foreach tab in array array['creators','creator_voice_profiles','creator_sales_playbooks','creator_commercial_events','contacts','conversations','contact_ai_profiles'] loop
  actual:=to_regclass('public.'||tab); expected:=to_regclass('pg_temp.'||tab);
  if actual is null or expected is null then raise exception 'creator_table_missing'; end if;
  -- Exact column types, bounds, defaults, nullability, identity/generated flags and collation.
  select jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull,attidentity,attgenerated,
    pg_temp.creator_normalize(pg_get_expr(d.adbin,d.adrelid)),attcollation) order by attname) into a
   from pg_attribute c left join pg_attrdef d on d.adrelid=c.attrelid and d.adnum=c.attnum
   where c.attrelid=actual and c.attnum>0 and not c.attisdropped and
    (tab=any(array['creators','creator_voice_profiles','creator_sales_playbooks','creator_commercial_events']) or
     (tab='conversations' and attname in ('sales_state','sales_state_updated_at','sales_state_source')) or
     (tab='contact_ai_profiles' and attname='commercial_profile'));
  select jsonb_agg(jsonb_build_array(attname,format_type(atttypid,atttypmod),attnotnull,attidentity,attgenerated,
    pg_temp.creator_normalize(pg_get_expr(d.adbin,d.adrelid)),attcollation) order by attname) into e
   from pg_attribute c left join pg_attrdef d on d.adrelid=c.attrelid and d.adnum=c.attnum
   where c.attrelid=expected and c.attnum>0 and not c.attisdropped and
    (tab=any(array['creators','creator_voice_profiles','creator_sales_playbooks','creator_commercial_events']) or
     (tab='conversations' and attname in ('sales_state','sales_state_updated_at','sales_state_source')) or
     (tab='contact_ai_profiles' and attname='commercial_profile'));
  if a is distinct from e then raise exception 'creator_columns_drift'; end if;
  select jsonb_agg(jsonb_build_array(conname,contype,convalidated,condeferrable,condeferred,pg_temp.creator_normalize(pg_get_constraintdef(oid))) order by conname) into a
   from pg_constraint where conrelid=actual and
    (tab=any(array['creators','creator_voice_profiles','creator_sales_playbooks','creator_commercial_events']) or
     conname in ('contacts_workspace_identity_unique','conversations_parent_identity_unique','conversations_sales_state_check','conversations_sales_state_source_check','contact_ai_profiles_commercial_profile_check'));
  select jsonb_agg(jsonb_build_array(conname,contype,convalidated,condeferrable,condeferred,pg_temp.creator_normalize(pg_get_constraintdef(oid))) order by conname) into e
   from pg_constraint where conrelid=expected and
    (tab=any(array['creators','creator_voice_profiles','creator_sales_playbooks','creator_commercial_events']) or
     conname in ('contacts_workspace_identity_unique','conversations_parent_identity_unique','conversations_sales_state_check','conversations_sales_state_source_check','contact_ai_profiles_commercial_profile_check'));
  if a is distinct from e then raise exception 'creator_constraints_drift'; end if;
  if exists(select 1 from pg_constraint ac join pg_constraint ec on ec.conrelid=expected and ec.conname=ac.conname
    join pg_class er on er.oid=ec.confrelid
    where ac.conrelid=actual and ac.contype='f' and ac.confrelid is distinct from to_regclass((case when er.relname='users' then 'auth.' else 'public.' end)||er.relname)) then
   raise exception 'creator_foreign_parent_drift';
  end if;
  if tab=any(array['creators','creator_voice_profiles','creator_sales_playbooks','creator_commercial_events']) then
   if not exists(select 1 from pg_class where oid=actual and relkind='r' and relrowsecurity and not relforcerowsecurity and relpersistence='p'
     and relowner=(select oid from pg_roles where rolname=session_user)) then raise exception 'creator_rls_drift'; end if;
   select jsonb_agg(jsonb_build_array(polname,polcmd,polpermissive,polroles,pg_temp.creator_normalize(pg_get_expr(polqual,polrelid)),pg_temp.creator_normalize(pg_get_expr(polwithcheck,polrelid))) order by polname) into a from pg_policy where polrelid=actual;
   select jsonb_agg(jsonb_build_array(polname,polcmd,polpermissive,polroles,pg_temp.creator_normalize(pg_get_expr(polqual,polrelid)),pg_temp.creator_normalize(pg_get_expr(polwithcheck,polrelid))) order by polname) into e from pg_policy where polrelid=expected;
   if a is distinct from e then raise exception 'creator_policies_drift'; end if;
   select jsonb_agg(jsonb_build_array(i.indisvalid,i.indisready,pg_temp.creator_normalize(pg_get_indexdef(i.indexrelid))) order by c.relname) into a
    from pg_index i join pg_class c on c.oid=i.indexrelid where i.indrelid=actual;
   select jsonb_agg(jsonb_build_array(i.indisvalid,i.indisready,pg_temp.creator_normalize(pg_get_indexdef(i.indexrelid))) order by c.relname) into e
    from pg_index i join pg_class c on c.oid=i.indexrelid where i.indrelid=expected;
   if a is distinct from e then raise exception 'creator_indexes_drift'; end if;
   foreach role_name in array array['anon','authenticated','service_role'] loop
    foreach privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
     allowed:=role_name='service_role' or (role_name='authenticated' and privilege='SELECT');
     if has_table_privilege(role_name,actual,privilege) <> allowed then raise exception 'creator_table_acl_drift'; end if;
     if privilege in ('SELECT','INSERT','UPDATE','REFERENCES') and not allowed and has_any_column_privilege(role_name,actual,privilege) then raise exception 'creator_column_acl_drift'; end if;
    end loop;
   end loop;
   if exists(select 1 from pg_attribute c cross join lateral aclexplode(c.attacl) a where c.attrelid=actual and not c.attisdropped
    and a.grantee<>(select oid from pg_roles where rolname=session_user)) then raise exception 'creator_column_grant_drift'; end if;
   if exists(select 1 from pg_class c cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where c.oid=actual
    and (a.grantee not in (c.relowner,(select oid from pg_roles where rolname='authenticated'),(select oid from pg_roles where rolname='service_role')) or (a.is_grantable and a.grantee<>c.relowner))) then raise exception 'creator_public_grant_drift'; end if;
  end if;
 end loop;
 ${functionChecks(sql)}
 select jsonb_agg(jsonb_build_array(c.relname,t.tgname,t.tgtype,t.tgenabled,p.proname,t.tgnargs,encode(t.tgargs,'hex'),pg_get_expr(t.tgqual,t.tgrelid)) order by c.relname) into a
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_proc p on p.oid=t.tgfoid
  where c.oid in ('public.creators'::regclass,'public.creator_voice_profiles'::regclass,'public.creator_sales_playbooks'::regclass,'public.creator_commercial_events'::regclass) and not t.tgisinternal;
 e:='[["creator_commercial_events","creator_event_actor_guard",7,"O","guard_creator_identity",0,"",null],["creator_sales_playbooks","creator_playbook_identity_guard",23,"O","guard_creator_identity",0,"",null],["creator_voice_profiles","creator_voice_identity_guard",23,"O","guard_creator_identity",0,"",null],["creators","creators_identity_guard",19,"O","guard_creator_identity",0,"",null]]'::jsonb;
 if a is distinct from e or exists(select 1 from pg_trigger t where t.tgrelid in ('public.creators'::regclass,'public.creator_voice_profiles'::regclass,'public.creator_sales_playbooks'::regclass,'public.creator_commercial_events'::regclass) and not t.tgisinternal and t.tgfoid<>'public.guard_creator_identity()'::regprocedure) then raise exception 'creator_trigger_drift'; end if;
end $verify$;
`;
 return { reference, body, verify: `\\set ON_ERROR_STOP on\n${reference}\nbegin read only;\nset local statement_timeout='60s';\n${body}\nselect 'CREATOR_FOUNDATION_POSTFLIGHT=PASS';\nrollback;\n` };
}

export function buildCreatorApply(sql) {
 const {reference,body}=buildCreatorVerification(sql);
 const artifact=sql.replace(/^begin;$/mu,"").replace(/commit;\s*$/u,"");
 return `\\set ON_ERROR_STOP on
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(617041729113::bigint);
${CREATOR_PREFLIGHT_BODY}
-- The artifact uses CREATE and ADD without IF NOT EXISTS. A concurrent,
-- repeated or partially installed target cannot be silently overwritten.
${artifact}
${reference}
${body}
commit;
select 'CREATOR_FOUNDATION_APPLY=COMMITTED';
`;
}
