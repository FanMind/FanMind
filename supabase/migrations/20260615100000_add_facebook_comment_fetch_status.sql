alter table public.social_connections
  add column if not exists last_comment_fetch_at timestamptz,
  add column if not exists last_comment_fetch_count integer not null default 0,
  add column if not exists last_comment_fetch_error text;
