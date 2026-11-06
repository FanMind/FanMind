alter table public.conversation_messages
  add column if not exists seen_at timestamptz;

create index if not exists conversation_messages_workspace_unseen_inbound_idx
  on public.conversation_messages (workspace_id, contact_id, created_at desc)
  where direction = 'inbound' and seen_at is null;
