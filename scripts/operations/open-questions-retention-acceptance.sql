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
       :'next_status'::text as next_status;
begin;
set local role service_role;

do $preflight$
declare input record;
begin
  select * into input from pg_temp.open_question_acceptance_input;
  if input.current_status = input.next_status
     or input.current_status not in ('open','in_review','resolved')
     or input.next_status not in ('open','in_review','resolved')
     or not exists (
       select 1 from public.website_chat_open_questions
        where id = input.question_id
          and workspace_id = input.workspace_id
          and inbound_message_id = input.message_id
          and status = input.current_status
     ) then
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
         and after_status = input.next_status) <> 1 then
    raise exception 'open_question_atomic_audit_invalid';
  end if;
end
$audit$;

reset role;
delete from public.conversation_messages
 where id = :'message_id'::uuid and workspace_id = :'workspace_id'::uuid;

do $cascade$
declare input record;
begin
  select * into input from pg_temp.open_question_acceptance_input;
  if exists (select 1 from public.website_chat_open_questions where id = input.question_id)
     or exists (select 1 from public.website_chat_open_question_audit_events where open_question_id = input.question_id) then
    raise exception 'open_question_delete_cascade_invalid';
  end if;
  if not exists (
    select 1 from pg_trigger
     where tgname = 'conversation_messages_trim_to_latest_50'
       and tgenabled <> 'D'
  ) then
    raise exception 'conversation_message_retention_trigger_missing';
  end if;
end
$cascade$;

select 'OPEN_QUESTION_ATOMIC_AUDIT=PASS';
select 'OPEN_QUESTION_DELETE_CASCADE=PASS';
select 'CONVERSATION_MESSAGE_RETENTION_TRIGGER=PASS';
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
