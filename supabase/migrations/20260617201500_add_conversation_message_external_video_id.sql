alter table public.conversation_messages
  add column if not exists external_video_id text;

create index if not exists conversation_messages_workspace_external_video_idx
  on public.conversation_messages (workspace_id, source_platform, external_video_id)
  where external_video_id is not null;
