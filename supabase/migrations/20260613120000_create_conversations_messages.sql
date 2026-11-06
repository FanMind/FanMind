create extension if not exists pgcrypto;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'waiting', 'done', 'archived')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'medium', 'high')),
  source_platform text,
  source_type text,
  source_url text,
  reply_target_url text,
  external_thread_id text,
  external_message_id text,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  last_message_preview text,
  assigned_owner text,
  ai_status text not null default 'not_ready' check (ai_status in ('not_ready', 'ready', 'partial')),
  next_step text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound', 'note')),
  message_type text not null default 'dm' check (message_type in ('dm', 'comment', 'post', 'email', 'form', 'note', 'manual')),
  source_platform text,
  source_url text,
  reply_target_url text,
  external_message_id text,
  author_label text,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists conversations_workspace_status_updated_idx
  on public.conversations (workspace_id, status, updated_at desc);
create index if not exists conversations_workspace_contact_open_idx
  on public.conversations (workspace_id, contact_id, status)
  where status in ('open', 'waiting');
create index if not exists conversation_messages_workspace_contact_created_idx
  on public.conversation_messages (workspace_id, contact_id, created_at desc);
create index if not exists conversation_messages_conversation_created_idx
  on public.conversation_messages (conversation_id, created_at asc);

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

create or replace function public.set_conversations_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'conversations_set_updated_at'
      and tgrelid = 'public.conversations'::regclass
  ) then
    create trigger conversations_set_updated_at
      before update on public.conversations
      for each row
      execute function public.set_conversations_updated_at();
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'conversations' and policyname = 'conversations_workspace_member_all') then
    create policy conversations_workspace_member_all
      on public.conversations for all
      using (exists (select 1 from public.workspace_members wm where wm.workspace_id = conversations.workspace_id and wm.user_id = auth.uid()))
      with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = conversations.workspace_id and wm.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'conversation_messages' and policyname = 'conversation_messages_workspace_member_all') then
    create policy conversation_messages_workspace_member_all
      on public.conversation_messages for all
      using (exists (select 1 from public.workspace_members wm where wm.workspace_id = conversation_messages.workspace_id and wm.user_id = auth.uid()))
      with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = conversation_messages.workspace_id and wm.user_id = auth.uid()));
  end if;
end;
$$;
