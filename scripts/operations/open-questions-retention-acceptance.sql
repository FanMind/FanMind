\set ON_ERROR_STOP on
-- Required psql variables: workspace_id, question_id, message_id, actor_id,
-- current_status, next_status. Use only the exactly marked synthetic fixture in
-- an isolated Staging workspace. The transaction always rolls back.

-- Read-only and intentionally before every temporary-table, DDL, status, audit
-- or retention mutation.
do $fixture_preflight$
begin
  if session_user <> 'postgres'
     or :'current_status'::text = :'next_status'::text
     or :'current_status'::text not in ('open','in_review','resolved')
     or :'next_status'::text not in ('open','in_review','resolved')
     or (select count(*) from public.workspaces
          where id = :'workspace_id'::uuid
            and test_access_flags->>'staging_synthetic_fixture' = 'true'
            and test_access_flags->>'workspace_processing_acceptance' = 'true'
            and test_access_flags->>'open_question_retention_acceptance' = 'true') <> 1
     or (select count(*) from public.website_chat_open_questions
          where workspace_id = :'workspace_id'::uuid) <> 1
     or not exists (
       select 1
         from public.website_chat_open_questions as question
         join public.conversation_messages as message
           on message.id = question.inbound_message_id
          and message.workspace_id = question.workspace_id
          and message.conversation_id = question.conversation_id
        where question.id = :'question_id'::uuid
          and question.workspace_id = :'workspace_id'::uuid
          and question.inbound_message_id = :'message_id'::uuid
          and question.status = :'current_status'::text
          and question.reason = 'assistant_uncertainty'
          and message.direction = 'inbound'
          and message.source_platform = 'staging_synthetic'
          and message.external_message_id =
              'staging-synthetic-open-question:' || :'question_id'::uuid::text
          and message.content =
              'open-question-retention-fixture:' || :'question_id'::uuid::text
     )
     or (select count(*) from public.conversation_messages
          where workspace_id = :'workspace_id'::uuid) <> 1 then
    raise exception 'open_question_retention_fixture_not_exactly_one_synthetic';
  end if;

  if to_regclass('public.website_chat_retention_controls') is not null
     or to_regprocedure('public.run_website_chat_option_a_retention(uuid)') is not null
     or exists (
       select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'website_chat_open_questions'
          and column_name in ('retention_extended_until', 'retention_extension_reason')
     )
     or to_regclass('public.website_chat_open_questions_retention_idx') is not null
     or to_regclass('public.website_chat_open_question_audit_retention_idx') is not null then
    raise exception 'option_a_schema_baseline_not_absent';
  end if;
end
$fixture_preflight$;

create temporary table open_question_acceptance_input on commit preserve rows as
select :'workspace_id'::uuid as workspace_id,
       :'question_id'::uuid as question_id,
       :'message_id'::uuid as message_id,
       :'actor_id'::uuid as actor_id,
       :'current_status'::text as current_status,
       :'next_status'::text as next_status,
       date_trunc('second', statement_timestamp()) as as_of,
       (select conversation_id from public.website_chat_open_questions
         where id = :'question_id'::uuid
           and workspace_id = :'workspace_id'::uuid) as conversation_id,
       (select count(*) from public.website_chat_open_question_audit_events
         where open_question_id = :'question_id'::uuid
           and workspace_id = :'workspace_id'::uuid
           and actor_id = :'actor_id'::uuid
           and before_status = :'current_status'
           and after_status = :'next_status') as audit_before;

create temporary table open_question_acceptance_target_before on commit preserve rows as
select to_jsonb(question) as question_row,
       to_jsonb(message) as message_row,
       coalesce((
         select jsonb_agg(to_jsonb(audit) order by audit.id)
           from public.website_chat_open_question_audit_events as audit
          where audit.workspace_id = question.workspace_id
            and audit.open_question_id = question.id
       ), '[]'::jsonb) as audit_rows
  from public.website_chat_open_questions as question
  join public.conversation_messages as message
    on message.id = question.inbound_message_id
   and message.workspace_id = question.workspace_id
 where question.id = :'question_id'::uuid
   and question.workspace_id = :'workspace_id'::uuid;

create temporary table open_question_acceptance_foreign_before on commit preserve rows as
select
  coalesce((
    select jsonb_agg(to_jsonb(question) order by question.id)
      from public.website_chat_open_questions as question
     where question.workspace_id <> :'workspace_id'::uuid
  ), '[]'::jsonb) as question_rows,
  coalesce((
    select jsonb_agg(to_jsonb(audit) order by audit.id)
      from public.website_chat_open_question_audit_events as audit
     where audit.workspace_id <> :'workspace_id'::uuid
  ), '[]'::jsonb) as audit_rows,
  coalesce((
    select jsonb_agg(to_jsonb(message) order by message.id)
      from public.conversation_messages as message
     where message.workspace_id <> :'workspace_id'::uuid
  ), '[]'::jsonb) as message_rows;

create temporary table open_question_acceptance_acl_before on commit preserve rows as
select namespace.nspname as schema_name,
       relation.relname as table_name,
       coalesce(to_jsonb(relation.relacl), 'null'::jsonb) as acl
  from pg_class as relation
  join pg_namespace as namespace on namespace.oid = relation.relnamespace
 where namespace.nspname = 'public'
   and relation.relname in (
     'workspaces',
     'conversation_messages',
     'website_chat_open_questions',
     'website_chat_open_question_audit_events'
   )
 order by relation.relname;

begin;
\ir ../../supabase/controlled/website_chat_open_questions_option_a_retention_body.sql

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
reset role;

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

savepoint latest_50_check;
insert into public.conversation_messages (
  id, workspace_id, conversation_id, contact_id, direction,
  message_type, source_platform, source_type, content, created_at
)
select gen_random_uuid(), message.workspace_id, message.conversation_id,
       message.contact_id, message.direction, message.message_type,
       message.source_platform, message.source_type,
       'open-question-retention:' || input.question_id::text || ':' || series.value::text,
       input.as_of + make_interval(secs => series.value)
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
rollback to savepoint latest_50_check;

savepoint extension_check;
insert into public.website_chat_retention_controls (workspace_id, policy_version)
select workspace_id, 'option-a-2026-11-03' from pg_temp.open_question_acceptance_input;
update public.website_chat_open_questions as question
   set status = 'open',
       created_at = input.as_of - interval '180 days',
       retention_extended_until = input.as_of + interval '1 day',
       retention_extension_reason = 'synthetic acceptance extension'
  from pg_temp.open_question_acceptance_input as input
 where question.id = input.question_id and question.workspace_id = input.workspace_id;
set local role service_role;
create temporary table option_a_extension_hold as
select * from public.run_website_chat_option_a_retention(:'workspace_id'::uuid);
reset role;
do $extension_hold$
declare input record;
begin
  select * into input from pg_temp.open_question_acceptance_input;
  if not exists (select 1 from public.website_chat_open_questions where id = input.question_id)
     or (select deleted_open_questions from pg_temp.option_a_extension_hold) <> 0 then
    raise exception 'option_a_documented_extension_invalid';
  end if;
end
$extension_hold$;
update public.website_chat_open_questions as question
   set retention_extended_until = input.as_of
  from pg_temp.open_question_acceptance_input as input
 where question.id = input.question_id and question.workspace_id = input.workspace_id;
set local role service_role;
create temporary table option_a_extension_due as
select * from public.run_website_chat_option_a_retention(:'workspace_id'::uuid);
reset role;
do $extension_due$
declare input record;
begin
  select * into input from pg_temp.open_question_acceptance_input;
  if exists (select 1 from public.website_chat_open_questions where id = input.question_id)
     or (select deleted_open_questions from pg_temp.option_a_extension_due) <> 1 then
    raise exception 'option_a_180_day_boundary_invalid';
  end if;
end
$extension_due$;
rollback to savepoint extension_check;

savepoint contract_end_check;
insert into public.website_chat_retention_controls (
  workspace_id, policy_version, contract_ended_at
)
select workspace_id, 'option-a-2026-11-03', as_of - interval '30 days'
  from pg_temp.open_question_acceptance_input;
set local role service_role;
create temporary table option_a_contract_due as
select * from public.run_website_chat_option_a_retention(:'workspace_id'::uuid);
reset role;
do $contract_due$
declare input record;
begin
  select * into input from pg_temp.open_question_acceptance_input;
  if exists (select 1 from public.conversation_messages where id = input.message_id)
     or (select deleted_conversation_messages from pg_temp.option_a_contract_due) <> 1 then
    raise exception 'option_a_contract_end_30_day_boundary_invalid';
  end if;
end
$contract_due$;
rollback to savepoint contract_end_check;

insert into public.website_chat_retention_controls (
  workspace_id, policy_version, legal_hold_started_at, legal_hold_reason
)
select workspace_id, 'option-a-2026-11-03', as_of - interval '1 day',
       'synthetic acceptance legal hold'
  from pg_temp.open_question_acceptance_input;
update public.website_chat_open_questions as question
   set status = 'resolved',
       updated_at = input.as_of - interval '30 days'
  from pg_temp.open_question_acceptance_input as input
 where question.id = input.question_id and question.workspace_id = input.workspace_id;
update public.conversation_messages as message
   set created_at = input.as_of - interval '24 months'
  from pg_temp.open_question_acceptance_input as input
 where message.id = input.message_id and message.workspace_id = input.workspace_id;
update public.website_chat_open_question_audit_events as audit
   set occurred_at = input.as_of - interval '12 months'
  from pg_temp.open_question_acceptance_input as input
 where audit.open_question_id = input.question_id and audit.workspace_id = input.workspace_id;

create temporary table option_a_other_workspace_before as
select
  (select count(*) from public.website_chat_open_questions
    where workspace_id <> :'workspace_id'::uuid)::bigint as questions,
  (select count(*) from public.website_chat_open_question_audit_events
    where workspace_id <> :'workspace_id'::uuid)::bigint as audits,
  (select count(*) from public.conversation_messages
    where workspace_id <> :'workspace_id'::uuid)::bigint as messages;

set local role service_role;
create temporary table option_a_legal_hold_result as
select * from public.run_website_chat_option_a_retention(:'workspace_id'::uuid);
reset role;

do $legal_hold$
declare input record;
begin
  select * into input from pg_temp.open_question_acceptance_input;
  if not exists (select 1 from public.website_chat_open_questions where id = input.question_id)
     or not exists (select 1 from public.conversation_messages where id = input.message_id)
     or (select deleted_audit_events + deleted_open_questions + deleted_conversation_messages
           from pg_temp.option_a_legal_hold_result) <> 0 then
    raise exception 'option_a_legal_hold_noop_invalid';
  end if;
end
$legal_hold$;

update public.website_chat_retention_controls as control
   set legal_hold_released_at = input.as_of
  from pg_temp.open_question_acceptance_input as input
 where control.workspace_id = input.workspace_id;

set local role service_role;
create temporary table option_a_due_result as
select * from public.run_website_chat_option_a_retention(:'workspace_id'::uuid);
create temporary table option_a_repeat_result as
select * from public.run_website_chat_option_a_retention(:'workspace_id'::uuid);
reset role;

do $option_a_due$
declare input record;
begin
  select * into input from pg_temp.open_question_acceptance_input;
  if exists (select 1 from public.website_chat_open_questions where id = input.question_id)
     or exists (select 1 from public.conversation_messages where id = input.message_id)
     or (select deleted_audit_events from pg_temp.option_a_due_result) <> 1
     or (select deleted_open_questions from pg_temp.option_a_due_result) <> 1
     or (select deleted_conversation_messages from pg_temp.option_a_due_result) <> 1
     or (select deleted_audit_events + deleted_open_questions + deleted_conversation_messages
           from pg_temp.option_a_repeat_result) <> 0
     or (select questions from pg_temp.option_a_other_workspace_before) <>
        (select count(*) from public.website_chat_open_questions
          where workspace_id <> input.workspace_id)
     or (select audits from pg_temp.option_a_other_workspace_before) <>
        (select count(*) from public.website_chat_open_question_audit_events
          where workspace_id <> input.workspace_id)
     or (select messages from pg_temp.option_a_other_workspace_before) <>
        (select count(*) from public.conversation_messages
          where workspace_id <> input.workspace_id) then
    raise exception 'option_a_due_or_isolation_invalid';
  end if;
end
$option_a_due$;

select 'OPEN_QUESTION_ATOMIC_AUDIT=PASS';
select 'OPEN_QUESTION_DELETE_CASCADE=PASS';
select 'CONVERSATION_MESSAGE_LATEST_50=PASS';
select 'OPTION_A_DEADLINE_BOUNDARIES=PASS';
select 'OPTION_A_LEGAL_HOLD=PASS';
select 'OPTION_A_WORKSPACE_ISOLATION=PASS';
select 'OPTION_A_IDEMPOTENCE=PASS';
rollback;

begin;
set transaction read only;
do $rollback_check$
declare
  input record;
  current_question jsonb;
  current_message jsonb;
  current_audits jsonb;
  current_foreign_questions jsonb;
  current_foreign_audits jsonb;
  current_foreign_messages jsonb;
begin
  select * into input from pg_temp.open_question_acceptance_input;
  select to_jsonb(question) into current_question
    from public.website_chat_open_questions as question
   where question.id = input.question_id
     and question.workspace_id = input.workspace_id;
  select to_jsonb(message) into current_message
    from public.conversation_messages as message
   where message.id = input.message_id
     and message.workspace_id = input.workspace_id;
  select coalesce(jsonb_agg(to_jsonb(audit) order by audit.id), '[]'::jsonb)
    into current_audits
    from public.website_chat_open_question_audit_events as audit
   where audit.open_question_id = input.question_id
     and audit.workspace_id = input.workspace_id;

  if current_question is distinct from
       (select question_row from pg_temp.open_question_acceptance_target_before)
     or current_message is distinct from
       (select message_row from pg_temp.open_question_acceptance_target_before)
     or current_audits is distinct from
       (select audit_rows from pg_temp.open_question_acceptance_target_before) then
    raise exception 'open_question_acceptance_target_snapshot_mismatch';
  end if;

  select coalesce(jsonb_agg(to_jsonb(question) order by question.id), '[]'::jsonb)
    into current_foreign_questions
    from public.website_chat_open_questions as question
   where question.workspace_id <> input.workspace_id;
  select coalesce(jsonb_agg(to_jsonb(audit) order by audit.id), '[]'::jsonb)
    into current_foreign_audits
    from public.website_chat_open_question_audit_events as audit
   where audit.workspace_id <> input.workspace_id;
  select coalesce(jsonb_agg(to_jsonb(message) order by message.id), '[]'::jsonb)
    into current_foreign_messages
    from public.conversation_messages as message
   where message.workspace_id <> input.workspace_id;

  if current_foreign_questions is distinct from
       (select question_rows from pg_temp.open_question_acceptance_foreign_before)
     or current_foreign_audits is distinct from
       (select audit_rows from pg_temp.open_question_acceptance_foreign_before)
     or current_foreign_messages is distinct from
       (select message_rows from pg_temp.open_question_acceptance_foreign_before) then
    raise exception 'open_question_acceptance_foreign_snapshot_mismatch';
  end if;

  if exists (
    (select schema_name, table_name, acl
       from pg_temp.open_question_acceptance_acl_before
     except
     select namespace.nspname, relation.relname,
            coalesce(to_jsonb(relation.relacl), 'null'::jsonb)
       from pg_class as relation
       join pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname in (
          'workspaces',
          'conversation_messages',
          'website_chat_open_questions',
          'website_chat_open_question_audit_events'
        ))
    union all
    (select namespace.nspname, relation.relname,
            coalesce(to_jsonb(relation.relacl), 'null'::jsonb)
       from pg_class as relation
       join pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname in (
          'workspaces',
          'conversation_messages',
          'website_chat_open_questions',
          'website_chat_open_question_audit_events'
        )
     except
     select schema_name, table_name, acl
       from pg_temp.open_question_acceptance_acl_before)
  ) then
    raise exception 'open_question_acceptance_acl_snapshot_mismatch';
  end if;

  if to_regclass('public.website_chat_retention_controls') is not null
     or to_regprocedure('public.run_website_chat_option_a_retention(uuid)') is not null
     or exists (
       select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'website_chat_open_questions'
          and column_name in ('retention_extended_until', 'retention_extension_reason')
     )
     or to_regclass('public.website_chat_open_questions_retention_idx') is not null
     or to_regclass('public.website_chat_open_question_audit_retention_idx') is not null then
    raise exception 'option_a_schema_rollback_failed';
  end if;
end
$rollback_check$;
select 'OPEN_QUESTION_ACCEPTANCE_ROLLBACK=PASS';
rollback;
