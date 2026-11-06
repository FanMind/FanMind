alter table public.social_connections
  add column if not exists last_messenger_sync_at timestamptz,
  add column if not exists last_messenger_sync_checked_count integer not null default 0,
  add column if not exists last_messenger_sync_imported_inbound_count integer not null default 0,
  add column if not exists last_messenger_sync_imported_outbound_count integer not null default 0,
  add column if not exists last_messenger_sync_skipped_count integer not null default 0,
  add column if not exists last_messenger_sync_error text,
  add column if not exists last_messenger_sync_outbound_at timestamptz;
