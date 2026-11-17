import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const RECOVERY_PATH = "supabase/controlled/workspace_provisioning_existing_recovery.sql";
export const RPC_SOURCE = "supabase/migrations/20260813210000_fix_workspace_provisioning_conflict_ambiguity.sql";
export const RPC_SOURCE_SHA256 = "874caa0399822e07d6618f502906853c5187021cc7fe4fc2bcfe5389926c03a3";
export const CONTRACT_PATH = "supabase/controlled/workspace_server_owned_columns_mvp.sql";
export const CONTRACT_SHA256 = "a8fcffc7d473f222129c95a581a3dc8a41460c3f0d8df260835a2821163abc1b";
export const hash = value => createHash("sha256").update(value).digest("hex");
const literal = value => `'${value.replaceAll("'", "''")}'`;
const signature = "public.ensure_current_user_workspace(text,text,boolean)";
function once(source, value) {
  const index = source.indexOf(value);
  if (index < 0 || source.indexOf(value, index + value.length) >= 0) throw Error("workspace_recovery_source_drift");
  return index;
}

// Reuse caller identity, lock, signature and result contract. Existing-only
// recovery is read-only SECURITY INVOKER: caller RLS remains authoritative,
// no new definer cohort or self-service membership repair is introduced.
export function recoveryFunctionSql() {
  const source = readFileSync(RPC_SOURCE, "utf8");
  if (hash(source) !== RPC_SOURCE_SHA256 || hash(readFileSync(CONTRACT_PATH)) !== CONTRACT_SHA256) throw Error("workspace_recovery_source_drift");
  const start = once(source, "create or replace function public.ensure_current_user_workspace(");
  const end = once(source, "$function$;") + "$function$;".length;
  let functionSql = source.slice(start, end);
  const branchStart = once(functionSql, "  if v_workspace_id is null then\n");
  const branchEndText = "    v_created := true;\n  end if;";
  const branchEnd = once(functionSql, branchEndText) + branchEndText.length;
  functionSql = functionSql.slice(0, branchStart) + `  if v_workspace_id is null then
    raise exception using errcode = '42501',
      message = 'workspace_provisioning_new_admission_disabled';
  end if;` + functionSql.slice(branchEnd);
  const membershipStart = once(functionSql, "  insert into public.workspace_members as workspace_member (");
  const returnStart = once(functionSql, "  return query\n");
  functionSql = functionSql.slice(0,membershipStart) + `  if not exists (
    select 1 from public.workspace_members as workspace_member
     where workspace_member.workspace_id = v_workspace_id
       and workspace_member.user_id = v_user_id
       and workspace_member.role = 'owner'
  ) then
    raise exception using errcode = '42501',
      message = 'workspace_provisioning_owner_membership_required';
  end if;

` + functionSql.slice(returnStart);
  once(functionSql,"security definer");
  functionSql = functionSql.replace("security definer","security invoker");
  for (const declaration of ["  v_workspace_name text;\n", "  v_setup_fee_cents integer;\n", "  v_commitment_months integer;\n"]) {
    once(functionSql, declaration);
    functionSql = functionSql.replace(declaration, "");
  }
  if (/\b(?:insert|update|delete)\b|security definer|starter_paid_setup|starter_no_setup_commitment|2026-06-v1/iu.test(functionSql)) throw Error("workspace_recovery_admission_remaining");
  return functionSql;
}

const ownerUnique = `exists(select 1 from pg_index i where i.indrelid='public.workspaces'::regclass
  and i.indisunique and i.indisvalid and i.indisready and i.indislive and i.indimmediate
  and i.indpred is null and i.indexprs is null and i.indnkeyatts=1 and i.indnatts=1
  and i.indkey::text=(select attnum::text from pg_attribute where attrelid=i.indrelid and attname='owner_user_id' and not attisdropped))`;
const membershipUnique = `exists(select 1 from pg_constraint c join pg_index i on i.indexrelid=c.conindid
  where c.conrelid='public.workspace_members'::regclass and c.conname='workspace_members_workspace_id_user_id_key'
  and c.contype='u' and c.convalidated and not c.condeferrable
  and c.conkey=array[(select attnum from pg_attribute where attrelid=c.conrelid and attname='workspace_id' and not attisdropped),
    (select attnum from pg_attribute where attrelid=c.conrelid and attname='user_id' and not attisdropped)]::smallint[]
  and i.indisunique and i.indisvalid and i.indisready and i.indislive and i.indimmediate
  and i.indpred is null and i.indexprs is null and i.indnkeyatts=2 and i.indnatts=2)`;

function functionPostflight() {
  const source = recoveryFunctionSql();
  const body = source.slice(source.indexOf("as $function$") + "as $function$".length, source.lastIndexOf("$function$;"));
  return `exists(select 1 from pg_proc p where p.oid=to_regprocedure('${signature}')
    and p.proowner='postgres'::regrole and not p.prosecdef and p.prolang=(select oid from pg_language where lanname='plpgsql')
    and p.pronargs=3 and p.pronargdefaults=0 and p.provariadic=0
    and p.proargnames=array['p_workspace_name','p_commercial_option','p_payment_terms_accepted','workspace_id','created']::text[]
    and pg_get_function_result(p.oid)='TABLE(workspace_id uuid, created boolean)'
    and p.proconfig=array['search_path=pg_catalog, public, pg_temp']::text[]
    and encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='${hash(body)}')
    and (select count(*) from pg_proc where pronamespace='public'::regnamespace and proname='ensure_current_user_workspace')=1
    and has_function_privilege('authenticated',to_regprocedure('${signature}'),'EXECUTE')
    and not has_function_privilege('anon',to_regprocedure('${signature}'),'EXECUTE')
    and not has_function_privilege('service_role',to_regprocedure('${signature}'),'EXECUTE')
    and not exists(select 1 from pg_proc p,lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where p.oid=to_regprocedure('${signature}') and a.privilege_type='EXECUTE'
        and (a.grantee not in('postgres'::regrole,'authenticated'::regrole)
          or a.grantee='authenticated'::regrole and a.is_grantable))`;
}

export function recoveryPostflightSql() {
  return `select jsonb_build_object('owner_unique',${ownerUnique},'membership_unique',${membershipUnique},
    'rpc_exact',${functionPostflight()}) as workspace_recovery_state;`;
}

export function buildWorkspaceRecoverySql() {
  const fn = recoveryFunctionSql();
  return `-- CONTROLLED SOURCE PREPARATION ONLY. Not a generic migration.
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
  if not (${membershipUnique}) then raise exception 'workspace_recovery_membership_constraint_invalid'; end if;
  if exists(select 1 from public.workspaces where owner_user_id is null)
    or exists(select 1 from public.workspaces group by owner_user_id having count(*)>1) then
    raise exception 'workspace_recovery_owner_identity_invalid';
  end if;
  if not (${ownerUnique}) then
    if to_regclass('public.workspaces_owner_user_id_uidx') is not null then raise exception 'workspace_recovery_owner_index_collision'; end if;
    create unique index workspaces_owner_user_id_uidx on public.workspaces(owner_user_id);
  end if;
end
$preflight$;
${fn}
alter function ${signature} owner to postgres;
revoke all on function ${signature} from public,anon,authenticated,service_role;
grant execute on function ${signature} to authenticated;
comment on function ${signature} is ${literal("Controlled recovery: existing owning Workspace only; new admission denied; no inferred terms or package activation.")};
-- POSTFLIGHT: any deviation rolls back the index and function together.
do $postflight$
begin
  if not (${ownerUnique}) or not (${membershipUnique}) or not (${functionPostflight()}) then
    raise exception 'workspace_recovery_postflight_failed';
  end if;
end
$postflight$;
commit;
`;
}

// Offline only: deliberately no database URL, credentials, psql or apply mode.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const mode = process.argv[2];
    const sql = buildWorkspaceRecoverySql();
    if (mode === "--write") writeFileSync(RECOVERY_PATH, sql);
    else if (mode !== "--check" || readFileSync(RECOVERY_PATH, "utf8") !== sql) throw Error("workspace_recovery_artifact_drift");
    console.log(`WORKSPACE_RECOVERY_SOURCE=PASS\nWORKSPACE_RECOVERY_SHA256=${hash(sql)}\nTARGET_EXECUTIONS=0`);
  } catch {
    console.error("WORKSPACE_RECOVERY_SOURCE=BLOCKED");
    process.exitCode = 1;
  }
}
