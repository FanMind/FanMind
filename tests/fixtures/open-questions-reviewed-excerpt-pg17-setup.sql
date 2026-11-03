\set ON_ERROR_STOP on

create extension if not exists pgcrypto;

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

-- Prove the new controlled table revokes hostile inherited defaults explicitly.
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
\ir ../../supabase/controlled/website_chat_open_question_review_derivatives.sql
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

\ir ../../supabase/controlled/website_chat_open_questions_option_a_retention_body.sql

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
  source_platform, source_type, external_message_id, content, created_at
) values
  ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'inbound', 'dm', 'staging_synthetic', 'acceptance', 'target-message', 'target retention fixture', statement_timestamp() - interval '25 months'),
  ('20000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 'inbound', 'dm', 'staging_synthetic', 'acceptance', 'foreign-message', 'foreign retention fixture', statement_timestamp() - interval '25 months');
insert into public.website_chat_open_questions (
  id, workspace_id, conversation_id, inbound_message_id, reason, status, created_at, updated_at
) values
  ('10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', 'assistant_uncertainty', 'resolved', statement_timestamp() - interval '200 days', statement_timestamp() - interval '31 days'),
  ('20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000004', 'assistant_uncertainty', 'resolved', statement_timestamp() - interval '200 days', statement_timestamp() - interval '31 days');
insert into public.website_chat_open_question_audit_events (
  id, open_question_id, workspace_id, actor_id, before_status, after_status, occurred_at
) values
  ('10000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000006', 'open', 'resolved', statement_timestamp() - interval '13 months'),
  ('20000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000006', 'open', 'resolved', statement_timestamp() - interval '13 months');
insert into public.website_chat_open_question_review_derivatives (
  id, open_question_id, workspace_id, review_version, review_state,
  reviewed_question_excerpt, reviewer_id, reviewed_at
) values
  ('10000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 1, 'approved', 'Wie lange dauert der Versand?', '10000000-0000-4000-8000-000000000006', statement_timestamp()),
  ('10000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 2, 'pending', null, null, null),
  ('20000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 1, 'approved', 'Kann ich per Rechnung zahlen?', '20000000-0000-4000-8000-000000000006', statement_timestamp());
insert into public.website_chat_retention_controls (
  workspace_id, policy_version, legal_hold_started_at, legal_hold_reason
) values (
  '10000000-0000-4000-8000-000000000001', 'option-a-2026-11-03',
  statement_timestamp() - interval '1 day', 'synthetic acceptance legal hold'
);
