create table if not exists public.meta_webhook_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  social_connection_id uuid references public.social_connections(id) on delete set null,
  platform text not null default 'facebook',
  source text not null default 'meta_webhook',
  page_id text,
  sender_id text,
  recipient_id text,
  event_type text not null default 'unknown',
  status text not null default 'received',
  text text,
  message_text text,
  raw_payload jsonb not null default '{}'::jsonb,
  error_reason text,
  message_id uuid references public.conversation_messages(id) on delete set null,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.meta_webhook_events
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade,
  add column if not exists social_connection_id uuid references public.social_connections(id) on delete set null,
  add column if not exists platform text not null default 'facebook',
  add column if not exists source text not null default 'meta_webhook',
  add column if not exists page_id text,
  add column if not exists sender_id text,
  add column if not exists recipient_id text,
  add column if not exists event_type text not null default 'unknown',
  add column if not exists status text not null default 'received',
  add column if not exists text text,
  add column if not exists message_text text,
  add column if not exists raw_payload jsonb not null default '{}'::jsonb,
  add column if not exists error_reason text,
  add column if not exists message_id uuid references public.conversation_messages(id) on delete set null,
  add column if not exists received_at timestamptz not null default now(),
  add column if not exists created_at timestamptz not null default now();

update public.meta_webhook_events
set text = coalesce(text, message_text)
where text is null and message_text is not null;

create index if not exists meta_webhook_events_workspace_received_idx
  on public.meta_webhook_events (workspace_id, received_at desc);

create index if not exists meta_webhook_events_page_received_idx
  on public.meta_webhook_events (page_id, received_at desc);

alter table public.meta_webhook_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'meta_webhook_events'
      and policyname = 'meta_webhook_events_select_workspace_member'
  ) then
    create policy meta_webhook_events_select_workspace_member
      on public.meta_webhook_events for select
      using (
        workspace_id is not null
        and exists (
          select 1 from public.workspace_members wm
          where wm.workspace_id = meta_webhook_events.workspace_id
            and wm.user_id = auth.uid()
        )
      );
  end if;
end;
$$;
