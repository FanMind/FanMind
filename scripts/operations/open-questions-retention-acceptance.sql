\set ON_ERROR_STOP on
-- Required psql variables: workspace_id, question_id, message_id, actor_id,
-- current_status, next_status. Use only synthetic rows in an isolated Staging
-- workspace. The transaction always rolls back.
create temporary table open_question_acceptance_input on commit preserve rows as
select :'workspace_id'::uuid as workspace_id,
       :'question_id'::uuid as question_id,
       :'message_id'::uuid as message_id,
       :'actor_id'::uuid as actor_id,
       :'current_status'::text as current_status,
       :'next_status'::text as next_status,
       (select conversation_id from public.website_chat_open_questions
         where id = :'question_id'::uuid
           and workspace_id = :'workspace_id'::uuid) as conversation_id,
       (select count(*) from public.website_chat_open_question_audit_events
         where open_question_id = :'question_id'::uuid
           and workspace_id = :'workspace_id'::uuid
           and actor_id = :'actor_id'::uuid
           and before_status = :'current_status'
           and after_status = :'next_status') as audit_before;
begin;
set local role service_role;

do $preflight$
declare input record;
begin
  select * into input from pg_temp.open_question_acceptance_input;
  if session_user <> 'postgres'
     or input.current_status = input.next_status
     or input.current_status not in ('open','in_review','resolved')
     or input.next_status not in ('open','in_review','resolved')
     or not exists (
       select 1 from public.workspaces
        where id = input.workspace_id
          and test_access_flags->>'staging_synthetic_fixture' = 'true'
          and test_access_flags->>'workspace_processing_acceptance' = 'true'
     )
     or not exists (
       select 1 from public.website_chat_open_questions
        where id = input.question_id
          and workspace_id = input.workspace_id
          and inbound_message_id = input.message_id
          and status = input.current_status
     )
     or input.conversation_id is null
     or (select count(*) from public.conversation_messages
          where conversation_id = input.conversation_id) <> 1 then
    raise exception 'open_question_retention_acceptance_preflight_failed';
  end if;
end
$preflight$;

select * from public.update_website_chat_open_question_status(
  :'workspace_id'::uuid, :'question_id'::uuid, :'actor_id'::uuid, :'next_status'
);

do $audit$
declare input record;
begin
  select * into input from pg_temp.open_question_acceptance_input;
  if (select count(*) from public.website_chat_open_question_audit_events
       where open_question_id = input.question_id
         and workspace_id = input.workspace_id
         and actor_id = input.actor_id
         and before_status = input.current_status
         and after_status = input.next_status) <> input.audit_before + 1 then
    raise exception 'open_question_atomic_audit_invalid';
  end if;
end
$audit$;

reset role;
insert into public.conversation_messages (
  id, workspace_id, conversation_id, contact_id, direction,
  message_type, source_platform, source_type, content, created_at
)
select gen_random_uuid(), message.workspace_id, message.conversation_id,
       message.contact_id, message.direction, message.message_type,
       message.source_platform, message.source_type,
       'open-question-retention:' || input.question_id::text || ':' || series.value::text,
       statement_timestamp() + make_interval(secs => series.value)
  from pg_temp.open_question_acceptance_input as input
  join public.conversation_messages as message on message.id = input.message_id
 cross join generate_series(1, 51) as series(value);

do $cascade$
declare input record;
begin
  select * into input from pg_temp.open_question_acceptance_input;
  if exists (select 1 from public.website_chat_open_questions where id = input.question_id)
     or exists (select 1 from public.website_chat_open_question_audit_events where open_question_id = input.question_id) then
    raise exception 'open_question_delete_cascade_invalid';
  end if;
  if (select count(*) from public.conversation_messages
       where conversation_id = input.conversation_id
         and content like 'open-question-retention:' || input.question_id::text || ':%') <> 50
     or exists (
       select 1 from public.conversation_messages
        where content = 'open-question-retention:' || input.question_id::text || ':1'
     )
     or not exists (
       select 1 from public.conversation_messages
        where content = 'open-question-retention:' || input.question_id::text || ':51'
     ) then
    raise exception 'conversation_message_latest_50_retention_invalid';
  end if;
end
$cascade$;

select 'OPEN_QUESTION_ATOMIC_AUDIT=PASS';
select 'OPEN_QUESTION_DELETE_CASCADE=PASS';
select 'CONVERSATION_MESSAGE_LATEST_50=PASS';
rollback;

begin;
set transaction read only;
do $rollback_check$
declare input record;
begin
  select * into input from pg_temp.open_question_acceptance_input;
  if not exists (
    select 1 from public.website_chat_open_questions
     where id = input.question_id
       and workspace_id = input.workspace_id
       and status = input.current_status
  ) or not exists (
    select 1 from public.conversation_messages
     where id = input.message_id
       and workspace_id = input.workspace_id
  ) then
    raise exception 'open_question_acceptance_rollback_failed';
  end if;
end
$rollback_check$;
select 'OPEN_QUESTION_ACCEPTANCE_ROLLBACK=PASS';
rollback;
