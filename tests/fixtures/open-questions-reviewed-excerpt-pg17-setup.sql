create table public.workspaces (
  id uuid primary key
);

create table public.conversations (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade
);

create table public.conversation_messages (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade
);

create table public.website_chat_open_questions (
  id uuid primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  inbound_message_id uuid not null references public.conversation_messages(id) on delete cascade,
  reason text not null default 'assistant_uncertainty',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, inbound_message_id)
);

insert into public.workspaces(id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002');
insert into public.conversations(id, workspace_id) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002');
insert into public.conversation_messages(id, workspace_id, conversation_id) values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001'),
  ('50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002');
insert into public.website_chat_open_questions(id, workspace_id, conversation_id, inbound_message_id) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000003');
