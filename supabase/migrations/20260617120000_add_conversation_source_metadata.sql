alter table public.conversations
  add column if not exists external_post_id text,
  add column if not exists external_comment_id text,
  add column if not exists original_author_label text,
  add column if not exists original_text_excerpt text;

alter table public.conversation_messages
  add column if not exists source_type text,
  add column if not exists external_thread_id text,
  add column if not exists external_post_id text,
  add column if not exists external_comment_id text,
  add column if not exists original_author_label text,
  add column if not exists original_text_excerpt text;

create index if not exists conversations_workspace_external_post_idx
  on public.conversations (workspace_id, source_platform, external_post_id)
  where external_post_id is not null;

create index if not exists conversation_messages_workspace_external_comment_idx
  on public.conversation_messages (workspace_id, source_platform, external_comment_id)
  where external_comment_id is not null;
