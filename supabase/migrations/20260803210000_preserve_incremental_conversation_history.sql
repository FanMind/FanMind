-- Preserve authorized conversation history for incremental Meta sync.
-- The former fixed 50-row trigger deleted older messages from every thread.
-- Standard/Plus/Ultra now bound only the AI context to 50/100/150 messages;
-- they must never act as a storage-retention rule.

alter table public.workspace_analysis_settings
  add column if not exists meta_sync_mode text not null default 'incremental_cache',
  add column if not exists personal_content_retention_days integer not null default 0,
  add column if not exists content_cache_retention_days integer;

alter table public.workspace_analysis_settings
  drop constraint if exists workspace_analysis_settings_meta_sync_mode_check,
  add constraint workspace_analysis_settings_meta_sync_mode_check
    check (meta_sync_mode = 'incremental_cache'),
  drop constraint if exists workspace_analysis_settings_personal_content_retention_days_check,
  add constraint workspace_analysis_settings_personal_content_retention_days_check
    check (personal_content_retention_days = 0),
  drop constraint if exists workspace_analysis_settings_content_cache_retention_days_check,
  add constraint workspace_analysis_settings_content_cache_retention_days_check
    check (
      content_cache_retention_days is null
      or content_cache_retention_days between 1 and 3650
    );

alter table public.communication_analysis_reports
  drop constraint if exists communication_analysis_reports_source_message_count_check,
  add constraint communication_analysis_reports_source_message_count_check
    check (source_message_count between 0 and 150);

drop trigger if exists conversation_messages_trim_to_latest_50
  on public.conversation_messages;

drop function if exists public.trim_conversation_messages_to_latest_50();

create index if not exists conversation_messages_workspace_contact_created_desc_idx
  on public.conversation_messages (workspace_id, contact_id, created_at desc, id desc);
