\set ON_ERROR_STOP on

create extension if not exists pgcrypto;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end
$roles$;

create schema auth;
create function auth.uid() returns uuid language sql stable as 'select null::uuid';

create table public.workspaces (
  id uuid primary key,
  test_access_flags jsonb not null default '{}'::jsonb
);
create table public.contacts (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade
);
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  primary key (workspace_id, user_id)
);
create table public.social_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  platform text not null,
  status text not null,
  page_id text
);

\ir ../../supabase/migrations/20260613120000_create_conversations_messages.sql
\ir ../../supabase/migrations/20260617120000_add_conversation_source_metadata.sql
\ir ../../supabase/migrations/20260614120000_conversation_message_retention.sql
\ir ../../supabase/migrations/20261103090000_website_chat_open_questions.sql

insert into public.workspaces (id, test_access_flags) values
  ('10000000-0000-4000-8000-000000000001', '{"staging_synthetic_fixture":true,"workspace_processing_acceptance":true,"open_question_retention_acceptance":true}'),
  ('20000000-0000-4000-8000-000000000001', '{"staging_synthetic_fixture":true,"workspace_processing_acceptance":true}');
insert into public.contacts (id, workspace_id) values
  ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001');
insert into public.conversations (id, workspace_id, contact_id, source_platform, source_type) values
  ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'staging_synthetic', 'acceptance'),
  ('20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'staging_synthetic', 'acceptance');
insert into public.conversation_messages (
  id, workspace_id, conversation_id, contact_id, direction, message_type,
  source_platform, source_type, external_message_id, content
) values
  ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'inbound', 'dm', 'staging_synthetic', 'acceptance', 'staging-synthetic-open-question:10000000-0000-4000-8000-000000000005', 'open-question-retention-fixture:10000000-0000-4000-8000-000000000005'),
  ('20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'inbound', 'dm', 'staging_synthetic', 'acceptance', 'foreign-synthetic-message', 'foreign synthetic retention fixture');
insert into public.website_chat_open_questions (
  id, workspace_id, conversation_id, inbound_message_id, reason, status
) values
  ('10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', 'assistant_uncertainty', 'open'),
  ('20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000004', 'assistant_uncertainty', 'open');
insert into public.website_chat_open_question_audit_events (
  id, open_question_id, workspace_id, actor_id, before_status, after_status
) values (
  '20000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000006',
  'open', 'in_review'
);
