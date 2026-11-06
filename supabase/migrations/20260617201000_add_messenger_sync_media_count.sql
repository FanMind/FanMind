alter table public.social_connections
  add column if not exists last_messenger_sync_imported_media_count integer not null default 0;
