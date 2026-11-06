alter table public.conversation_messages
  add column if not exists attachments jsonb,
  add column if not exists message_kind text default 'text';

alter table public.conversation_messages
  drop constraint if exists conversation_messages_message_kind_check;

alter table public.conversation_messages
  add constraint conversation_messages_message_kind_check
  check (message_kind is null or message_kind in ('text', 'image', 'video', 'audio', 'file', 'mixed', 'unknown'));
