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
  unique (workspace_id, inbound_message_id)
);
create index if not exists website_chat_open_questions_workspace_status_idx
 on public.website_chat_open_questions (workspace_id, status, created_at desc);
alter table public.website_chat_open_questions enable row level security;
revoke all on public.website_chat_open_questions from public, anon, authenticated;
grant select, insert, update, delete on public.website_chat_open_questions to service_role;
comment on table public.website_chat_open_questions is
 'Workspace-scoped unanswered-question candidates; no duplicated message content or email. Source text remains in CRM with its retention rules.';
commit;
