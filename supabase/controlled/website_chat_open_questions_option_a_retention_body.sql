create table if not exists public.website_chat_retention_controls (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  policy_version text not null check (policy_version = 'option-a-2026-11-03'),
  configured_at timestamptz not null default statement_timestamp(),
  contract_ended_at timestamptz,
  deletion_instructed_at timestamptz,
  legal_hold_started_at timestamptz,
  legal_hold_released_at timestamptz,
  legal_hold_reason text,
  check (
    (legal_hold_started_at is null and legal_hold_released_at is null and legal_hold_reason is null)
    or (
      legal_hold_started_at is not null
      and nullif(btrim(legal_hold_reason), '') is not null
      and (legal_hold_released_at is null or legal_hold_released_at >= legal_hold_started_at)
    )
  )
);

alter table public.website_chat_open_questions
  add column if not exists retention_extended_until timestamptz,
  add column if not exists retention_extension_reason text;

alter table public.website_chat_open_questions
  drop constraint if exists website_chat_open_questions_retention_extension_check;
alter table public.website_chat_open_questions
  add constraint website_chat_open_questions_retention_extension_check
  check (
    (retention_extended_until is null and retention_extension_reason is null)
    or (
      retention_extended_until is not null
      and nullif(btrim(retention_extension_reason), '') is not null
    )
  );

create index if not exists website_chat_open_questions_retention_idx
  on public.website_chat_open_questions (workspace_id, status, updated_at, created_at);
create index if not exists website_chat_open_question_audit_retention_idx
  on public.website_chat_open_question_audit_events (workspace_id, occurred_at);

alter table public.website_chat_retention_controls enable row level security;
revoke all on public.website_chat_retention_controls from public, anon, authenticated, service_role;
revoke update, delete on public.website_chat_open_questions from service_role;
revoke insert, update, delete on public.website_chat_open_question_audit_events from service_role;

create or replace function public.run_website_chat_option_a_retention(
  p_workspace_id uuid
)
returns table (
  deleted_audit_events bigint,
  deleted_open_questions bigint,
  deleted_conversation_messages bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_control public.website_chat_retention_controls%rowtype;
  v_now timestamptz := statement_timestamp();
  v_audit_count bigint := 0;
  v_question_count bigint := 0;
  v_message_count bigint := 0;
begin
  if p_workspace_id is null then
    raise exception using errcode = '22023', message = 'invalid_retention_scope';
  end if;

  select control.* into v_control
    from public.website_chat_retention_controls as control
   where control.workspace_id = p_workspace_id
     and control.policy_version = 'option-a-2026-11-03'
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'retention_control_not_configured';
  end if;

  if v_control.legal_hold_started_at is not null
     and v_control.legal_hold_started_at <= v_now
     and (v_control.legal_hold_released_at is null or v_control.legal_hold_released_at > v_now) then
    return query select 0::bigint, 0::bigint, 0::bigint;
    return;
  end if;

  delete from public.website_chat_open_question_audit_events as audit
   where audit.workspace_id = p_workspace_id
     and audit.occurred_at <= v_now - interval '12 months';
  get diagnostics v_audit_count = row_count;

  delete from public.website_chat_open_questions as question
   where question.workspace_id = p_workspace_id
     and (
       (question.status = 'resolved'
        and question.updated_at <= v_now - interval '30 days')
       or
       (question.status in ('open', 'in_review')
        and question.created_at <= v_now - interval '180 days'
        and (question.retention_extended_until is null
             or question.retention_extended_until <= v_now))
     );
  get diagnostics v_question_count = row_count;

  delete from public.conversation_messages as message
   where message.workspace_id = p_workspace_id
     and (
       message.created_at <= v_now - interval '24 months'
       or (v_control.contract_ended_at is not null
           and v_control.contract_ended_at <= v_now - interval '30 days')
       or (v_control.deletion_instructed_at is not null
           and v_control.deletion_instructed_at <= v_now - interval '30 days')
     );
  get diagnostics v_message_count = row_count;

  return query select v_audit_count, v_question_count, v_message_count;
end;
$function$;

revoke all on function public.run_website_chat_option_a_retention(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.run_website_chat_option_a_retention(uuid)
  to service_role;

do $postflight$
declare
  retention_function regprocedure := to_regprocedure(
    'public.run_website_chat_option_a_retention(uuid)'
  );
begin
  if retention_function is null
     or not exists (
       select 1 from pg_proc
        where oid = retention_function
          and proowner = to_regrole('postgres')
          and prosecdef
          and proconfig = array['search_path=pg_catalog, public, pg_temp']::text[]
     )
     or has_table_privilege('anon', 'public.website_chat_retention_controls', 'SELECT')
     or has_table_privilege('authenticated', 'public.website_chat_retention_controls', 'SELECT')
     or has_table_privilege('service_role', 'public.website_chat_retention_controls', 'SELECT')
     or has_function_privilege('anon', retention_function, 'EXECUTE')
     or has_function_privilege('authenticated', retention_function, 'EXECUTE')
     or not has_function_privilege('service_role', retention_function, 'EXECUTE') then
    raise exception 'option_a_retention_boundary_postflight_failed';
  end if;
end
$postflight$;

comment on table public.website_chat_retention_controls is
  'Fail-closed per-workspace Option A control. Missing configuration or an active legal hold prevents retention deletion.';
comment on function public.run_website_chat_option_a_retention(uuid) is
  'Workspace-bound Option A retention: audit <=12 months, resolved <=30 days, open/in-review <=180 days unless documented extension, messages <=24 months or <=30 days after contract end/deletion instruction. Active legal hold returns a no-op.';

