-- Draft only. Apply after independent security review and owner deployment gate.
begin;
create table if not exists public.website_chat_open_questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  inbound_message_id uuid not null references public.conversation_messages(id) on delete cascade,
  reason text not null default 'assistant_uncertainty' check (reason in ('assistant_uncertainty')),
  status text not null default 'open' check (status in ('open','in_review','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, inbound_message_id),
  unique (id, workspace_id)
);
create index if not exists website_chat_open_questions_workspace_status_idx
 on public.website_chat_open_questions (workspace_id, status, created_at desc);

create table if not exists public.website_chat_open_question_audit_events (
  id uuid primary key default gen_random_uuid(),
  open_question_id uuid not null,
  workspace_id uuid not null,
  actor_id uuid not null,
  before_status text not null check (before_status in ('open','in_review','resolved')),
  after_status text not null check (after_status in ('open','in_review','resolved')),
  occurred_at timestamptz not null default statement_timestamp(),
  foreign key (open_question_id, workspace_id)
    references public.website_chat_open_questions(id, workspace_id) on delete cascade
);
create index if not exists website_chat_open_question_audit_workspace_idx
 on public.website_chat_open_question_audit_events (workspace_id, occurred_at desc);

alter table public.website_chat_open_questions enable row level security;
alter table public.website_chat_open_question_audit_events enable row level security;
revoke all on public.website_chat_open_questions from public, anon, authenticated;
revoke all on public.website_chat_open_question_audit_events from public, anon, authenticated;
grant select, insert on public.website_chat_open_questions to service_role;
grant select on public.website_chat_open_question_audit_events to service_role;

create or replace function public.update_website_chat_open_question_status(
  p_workspace_id uuid,
  p_question_id uuid,
  p_actor_id uuid,
  p_after_status text
)
returns table (id uuid, workspace_id uuid, before_status text, after_status text, occurred_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_question public.website_chat_open_questions%rowtype;
  v_occurred_at timestamptz := statement_timestamp();
begin
  if p_workspace_id is null or p_question_id is null or p_actor_id is null
     or p_after_status not in ('open','in_review','resolved') then
    raise exception using errcode = '22023', message = 'invalid_open_question_status_change';
  end if;

  select question.* into v_question
    from public.website_chat_open_questions as question
   where question.id = p_question_id and question.workspace_id = p_workspace_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'open_question_not_found';
  end if;

  if v_question.status <> p_after_status then
    update public.website_chat_open_questions as question
       set status = p_after_status, updated_at = v_occurred_at
     where question.id = p_question_id and question.workspace_id = p_workspace_id;
    insert into public.website_chat_open_question_audit_events (
      open_question_id, workspace_id, actor_id, before_status, after_status, occurred_at
    ) values (
      p_question_id, p_workspace_id, p_actor_id, v_question.status, p_after_status, v_occurred_at
    );
  end if;

  return query select p_question_id, p_workspace_id, v_question.status, p_after_status, v_occurred_at;
end;
$function$;

revoke all on function public.update_website_chat_open_question_status(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.update_website_chat_open_question_status(uuid, uuid, uuid, text)
  to service_role;

do $postflight$
declare
  status_function regprocedure := to_regprocedure(
    'public.update_website_chat_open_question_status(uuid,uuid,uuid,text)'
  );
begin
  if status_function is null
     or not exists (
       select 1 from pg_proc
        where oid = status_function
          and proowner = to_regrole('postgres')
          and prosecdef
          and proconfig = array['search_path=pg_catalog, public, pg_temp']::text[]
     )
     or has_table_privilege('service_role', 'public.website_chat_open_questions', 'UPDATE')
     or has_table_privilege('service_role', 'public.website_chat_open_questions', 'DELETE')
     or has_table_privilege('service_role', 'public.website_chat_open_question_audit_events', 'INSERT')
     or has_table_privilege('service_role', 'public.website_chat_open_question_audit_events', 'UPDATE')
     or has_table_privilege('service_role', 'public.website_chat_open_question_audit_events', 'DELETE')
     or has_function_privilege('anon', status_function, 'EXECUTE')
     or has_function_privilege('authenticated', status_function, 'EXECUTE')
     or not has_function_privilege('service_role', status_function, 'EXECUTE') then
    raise exception 'open_question_status_boundary_postflight_failed';
  end if;
end
$postflight$;

comment on table public.website_chat_open_questions is
 'Workspace-scoped unanswered-question candidates; no duplicated message content or email. Source text remains in CRM under the explicit conversation-message retention contract.';
comment on table public.website_chat_open_question_audit_events is
 'Append-only service-role audit events for atomic open-question status transitions; actor is the authenticated platform-admin user id.';
comment on function public.update_website_chat_open_question_status(uuid, uuid, uuid, text) is
 'Atomically changes one workspace-bound status and appends actor, before/after status and timestamp. Repeated no-op transitions do not append duplicate events.';
commit;
