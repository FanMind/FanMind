begin;

-- CONTROLLED / DORMANT BY DEFAULT
-- This file creates only a bounded, service-role-only retention RPC. It adds
-- no timer, worker, provider call, AI request or outbound delivery.

do $preflight$
begin
  if current_user <> 'postgres'
     or to_regclass('public.website_chat_installations') is null
     or to_regclass('public.website_chat_visitor_sessions') is null
     or to_regclass('public.website_chat_message_receipts') is null
     or to_regclass('public.website_chat_handoffs') is null
     or to_regclass('public.contacts') is null
     or to_regclass('public.conversations') is null
     or to_regclass('public.conversation_messages') is null then
    raise exception 'website_chat_retention_prerequisite_missing';
  end if;
end
$preflight$;

-- Retention needs bounded DELETE only. Supabase projects can inherit a
-- default TRUNCATE grant for service_role, which would bypass that boundary.
revoke truncate on table public.website_chat_visitor_sessions
  from service_role;

drop function if exists public.manage_website_chat_retention(integer, boolean);

create or replace function public.manage_website_chat_retention(
  p_limit integer default 500,
  p_execute boolean default false,
  p_workspace_id uuid default null
)
returns table (
  candidate_session_count integer,
  candidate_receipt_count integer,
  candidate_handoff_count integer,
  deleted_session_count integer,
  has_more boolean
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_now timestamptz := statement_timestamp();
  v_session_ids uuid[] := '{}'::uuid[];
  v_candidate_sessions integer := 0;
  v_candidate_receipts integer := 0;
  v_candidate_handoffs integer := 0;
  v_deleted_sessions integer := 0;
  v_has_more boolean := false;
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception using
      errcode = '22023',
      message = 'invalid_website_chat_retention_limit';
  end if;
  if p_execute is null then
    raise exception using
      errcode = '22023',
      message = 'invalid_website_chat_retention_mode';
  end if;

  if p_execute then
    select coalesce(array_agg(candidate.id order by candidate.expires_at, candidate.id), '{}'::uuid[])
      into v_session_ids
      from (
        select session.id, session.expires_at
          from public.website_chat_visitor_sessions as session
         where (session.revoked_at is not null or session.expires_at <= v_now)
           and (p_workspace_id is null or session.workspace_id = p_workspace_id)
           and not exists (
             select 1
               from public.website_chat_handoffs as handoff
              where handoff.session_id = session.id
                and handoff.expires_at > v_now
           )
         order by session.expires_at asc, session.id asc
         limit p_limit
         for update of session skip locked
      ) as candidate;
  else
    select coalesce(array_agg(candidate.id order by candidate.expires_at, candidate.id), '{}'::uuid[])
      into v_session_ids
      from (
        select session.id, session.expires_at
          from public.website_chat_visitor_sessions as session
         where (session.revoked_at is not null or session.expires_at <= v_now)
           and (p_workspace_id is null or session.workspace_id = p_workspace_id)
           and not exists (
             select 1
               from public.website_chat_handoffs as handoff
              where handoff.session_id = session.id
                and handoff.expires_at > v_now
           )
         order by session.expires_at asc, session.id asc
         limit p_limit
      ) as candidate;
  end if;

  v_candidate_sessions := cardinality(v_session_ids);

  if v_candidate_sessions > 0 then
    select count(*)::integer
      into v_candidate_receipts
      from public.website_chat_message_receipts
     where session_id = any(v_session_ids);

    select count(*)::integer
      into v_candidate_handoffs
      from public.website_chat_handoffs
     where session_id = any(v_session_ids);
  end if;

  if p_execute and v_candidate_sessions > 0 then
    delete from public.website_chat_visitor_sessions
     where id = any(v_session_ids);
    get diagnostics v_deleted_sessions = row_count;

    if v_deleted_sessions <> v_candidate_sessions then
      raise exception 'website_chat_retention_delete_count_mismatch';
    end if;
  end if;

  select exists (
    select 1
      from public.website_chat_visitor_sessions as session
     where (session.revoked_at is not null or session.expires_at <= v_now)
       and (p_workspace_id is null or session.workspace_id = p_workspace_id)
       and not exists (
         select 1
           from public.website_chat_handoffs as handoff
          where handoff.session_id = session.id
            and handoff.expires_at > v_now
       )
     limit 1
  ) into v_has_more;

  return query select
    v_candidate_sessions,
    v_candidate_receipts,
    v_candidate_handoffs,
    v_deleted_sessions,
    v_has_more;
end;
$function$;

revoke all on function public.manage_website_chat_retention(integer, boolean, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.manage_website_chat_retention(integer, boolean, uuid)
  to service_role;

comment on function public.manage_website_chat_retention(integer, boolean, uuid) is
  'Plans or executes a bounded deletion of expired/revoked Website Chat sessions and their technical receipts/handoff evidence after its expiry. CRM contacts, conversations and messages are never deleted.';

do $postflight$
declare
  retention_function oid := to_regprocedure(
    'public.manage_website_chat_retention(integer,boolean,uuid)'
  );
begin
  if retention_function is null
     or to_regprocedure(
       'public.manage_website_chat_retention(integer,boolean)'
     ) is not null
     or (
       select count(*)
         from pg_proc as function
         join pg_namespace as namespace on namespace.oid = function.pronamespace
        where namespace.nspname = 'public'
          and function.proname = 'manage_website_chat_retention'
     ) <> 1
     or not exists (
       select 1
         from pg_proc
        where oid = retention_function
          and proowner = to_regrole('postgres')
          and not prosecdef
          and proconfig = array['search_path=public, pg_temp']::text[]
     )
     or has_function_privilege('anon', retention_function, 'EXECUTE')
     or has_function_privilege('authenticated', retention_function, 'EXECUTE')
     or not has_function_privilege('service_role', retention_function, 'EXECUTE')
     or exists (
       select 1
         from pg_proc as function,
              lateral aclexplode(
                coalesce(function.proacl, acldefault('f', function.proowner))
              ) as acl
        where function.oid = retention_function
          and acl.grantee = 0
          and acl.privilege_type = 'EXECUTE'
     )
     or exists (
       select 1
         from pg_proc as function,
              lateral aclexplode(
                coalesce(function.proacl, acldefault('f', function.proowner))
              ) as acl
        where function.oid = retention_function
          and acl.privilege_type = 'EXECUTE'
          and acl.grantee <> all(array[
            to_regrole('postgres')::oid,
            to_regrole('service_role')::oid
          ])
     ) then
    raise exception 'website_chat_retention_postflight_failed';
  end if;
end
$postflight$;

commit;
