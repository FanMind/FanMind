-- CONTROLLED SOURCE PREPARATION ONLY. Not a generic migration.
-- Target: FanMind Production drqkpdvtbbrrdwmtrodz; no target execution by this generator.
-- Future execution requires reviewed Main, exact SHA, protected target binding,
-- backup/recovery evidence and a separate explicit Owner approval.
-- Only structural recovery. Existing Billing contract remains unchanged/unapplied.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
set local search_path=pg_catalog,public;
select pg_advisory_xact_lock(hashtextextended('fanmind-workspace-structure-recovery-v1',0));
lock table public.workspaces,public.workspace_members in share row exclusive mode;
do $preflight$
begin
  if current_user <> 'postgres' or current_setting('server_version_num')::int/10000 <> 17
    or to_regprocedure('auth.uid()') is null or to_regprocedure('auth.role()') is null
    or to_regrole('anon') is null or to_regrole('authenticated') is null or to_regrole('service_role') is null
    or has_schema_privilege('anon','public','CREATE') or has_schema_privilege('authenticated','public','CREATE') then
    raise exception 'workspace_recovery_target_roles_invalid';
  end if;
  if (select count(*) from pg_class where oid in('public.workspaces'::regclass,'public.workspace_members'::regclass)
    and relkind='r' and relpersistence='p' and relrowsecurity and relowner='postgres'::regrole)<>2 then
    raise exception 'workspace_recovery_relations_invalid';
  end if;
  if exists(select 1 from pg_proc where pronamespace='public'::regnamespace and proname='ensure_current_user_workspace') then
    raise exception 'workspace_recovery_rpc_already_present';
  end if;
  if exists(select 1 from(values
    ('workspaces','id','uuid'),('workspaces','owner_user_id','uuid'),
    ('workspace_members','workspace_id','uuid'),('workspace_members','user_id','uuid'),('workspace_members','role','text')
  ) required(table_name,column_name,type_name) where not exists(
    select 1 from pg_attribute a where a.attrelid=to_regclass('public.'||required.table_name)
      and a.attname=required.column_name and not a.attisdropped
      and a.atttypid=to_regtype(required.type_name) and a.attgenerated='' and a.attidentity='')) then
    raise exception 'workspace_recovery_columns_invalid';
  end if;
  if not (exists(select 1 from pg_constraint c join pg_index i on i.indexrelid=c.conindid
  where c.conrelid='public.workspace_members'::regclass and c.conname='workspace_members_workspace_id_user_id_key'
  and c.contype='u' and c.convalidated and not c.condeferrable
  and c.conkey=array[(select attnum from pg_attribute where attrelid=c.conrelid and attname='workspace_id' and not attisdropped),
    (select attnum from pg_attribute where attrelid=c.conrelid and attname='user_id' and not attisdropped)]::smallint[]
  and i.indisunique and i.indisvalid and i.indisready and i.indislive and i.indimmediate
  and i.indpred is null and i.indexprs is null and i.indnkeyatts=2 and i.indnatts=2)) then raise exception 'workspace_recovery_membership_constraint_invalid'; end if;
  if exists(select 1 from public.workspaces where owner_user_id is null)
    or exists(select 1 from public.workspaces group by owner_user_id having count(*)>1) then
    raise exception 'workspace_recovery_owner_identity_invalid';
  end if;
  if not (exists(select 1 from pg_index i where i.indrelid='public.workspaces'::regclass
  and i.indisunique and i.indisvalid and i.indisready and i.indislive and i.indimmediate
  and i.indpred is null and i.indexprs is null and i.indnkeyatts=1 and i.indnatts=1
  and i.indkey::text=(select attnum::text from pg_attribute where attrelid=i.indrelid and attname='owner_user_id' and not attisdropped))) then
    if to_regclass('public.workspaces_owner_user_id_uidx') is not null then raise exception 'workspace_recovery_owner_index_collision'; end if;
    create unique index workspaces_owner_user_id_uidx on public.workspaces(owner_user_id);
  end if;
end
$preflight$;
create or replace function public.ensure_current_user_workspace(
  p_workspace_name text,
  p_commercial_option text,
  p_payment_terms_accepted boolean
)
returns table (
  workspace_id uuid,
  created boolean
)
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
  v_created boolean := false;
begin
  if v_user_id is null
    or auth.role() is distinct from 'authenticated' then
    raise exception
      using
        errcode = '42501',
        message = 'workspace_provisioning_auth_required';
  end if;

  -- Serialize provisioning attempts for one authenticated identity. The
  -- unique owner index remains the final concurrency invariant.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select workspace.id
    into v_workspace_id
    from public.workspaces as workspace
   where workspace.owner_user_id = v_user_id;

  if v_workspace_id is null then
    raise exception using errcode = '42501',
      message = 'workspace_provisioning_new_admission_disabled';
  end if;

  if not exists (
    select 1 from public.workspace_members as workspace_member
     where workspace_member.workspace_id = v_workspace_id
       and workspace_member.user_id = v_user_id
       and workspace_member.role = 'owner'
  ) then
    raise exception using errcode = '42501',
      message = 'workspace_provisioning_owner_membership_required';
  end if;

  return query
    select v_workspace_id, v_created;
end
$function$;
alter function public.ensure_current_user_workspace(text,text,boolean) owner to postgres;
revoke all on function public.ensure_current_user_workspace(text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.ensure_current_user_workspace(text,text,boolean) to authenticated;
comment on function public.ensure_current_user_workspace(text,text,boolean) is 'Controlled recovery: existing owning Workspace only; new admission denied; no inferred terms or package activation.';
-- POSTFLIGHT: any deviation rolls back the index and function together.
do $postflight$
begin
  if not (exists(select 1 from pg_index i where i.indrelid='public.workspaces'::regclass
  and i.indisunique and i.indisvalid and i.indisready and i.indislive and i.indimmediate
  and i.indpred is null and i.indexprs is null and i.indnkeyatts=1 and i.indnatts=1
  and i.indkey::text=(select attnum::text from pg_attribute where attrelid=i.indrelid and attname='owner_user_id' and not attisdropped))) or not (exists(select 1 from pg_constraint c join pg_index i on i.indexrelid=c.conindid
  where c.conrelid='public.workspace_members'::regclass and c.conname='workspace_members_workspace_id_user_id_key'
  and c.contype='u' and c.convalidated and not c.condeferrable
  and c.conkey=array[(select attnum from pg_attribute where attrelid=c.conrelid and attname='workspace_id' and not attisdropped),
    (select attnum from pg_attribute where attrelid=c.conrelid and attname='user_id' and not attisdropped)]::smallint[]
  and i.indisunique and i.indisvalid and i.indisready and i.indislive and i.indimmediate
  and i.indpred is null and i.indexprs is null and i.indnkeyatts=2 and i.indnatts=2)) or not (exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.ensure_current_user_workspace(text,text,boolean)')
    and p.proowner='postgres'::regrole and not p.prosecdef and p.prolang=(select oid from pg_language where lanname='plpgsql')
    and p.pronargs=3 and p.pronargdefaults=0 and p.provariadic=0
    and p.proargnames=array['p_workspace_name','p_commercial_option','p_payment_terms_accepted','workspace_id','created']::text[]
    and pg_get_function_result(p.oid)='TABLE(workspace_id uuid, created boolean)'
    and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
    and encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='a291aa2b73613d4a4ad214364072b289f520c9013b2a1fdf6ecea43688d3e837')
    and (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='ensure_current_user_workspace')=1
    and has_function_privilege('authenticated',to_regprocedure('public.ensure_current_user_workspace(text,text,boolean)'),'EXECUTE')
    and not has_function_privilege('anon',to_regprocedure('public.ensure_current_user_workspace(text,text,boolean)'),'EXECUTE')
    and not has_function_privilege('service_role',to_regprocedure('public.ensure_current_user_workspace(text,text,boolean)'),'EXECUTE')
    and not exists(select 1 from pg_proc p,lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where p.oid=to_regprocedure('public.ensure_current_user_workspace(text,text,boolean)') and a.privilege_type='EXECUTE'
        and (a.grantee not in('postgres'::regrole,'authenticated'::regrole)
          or a.grantee='authenticated'::regrole and a.is_grantable))) then
    raise exception 'workspace_recovery_postflight_failed';
  end if;
end
$postflight$;
commit;
