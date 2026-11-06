-- Service-role-only foundation for consented website-chat visitor sessions.
-- No anonymous role can read or write these tables directly, and this
-- migration does not enable AI replies or outbound/automatic messaging.

begin;

create table if not exists public.website_chat_installations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  public_installation_id uuid not null default gen_random_uuid() unique,
  label text not null check (char_length(label) between 1 and 120),
  enabled boolean not null default false,
  consent_version text not null check (
    char_length(consent_version) between 1 and 80
    and consent_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$'
  ),
  session_ttl_minutes integer not null default 60
    check (session_ttl_minutes between 5 and 1440),
  message_retention_days integer not null default 30
    check (message_retention_days between 1 and 90),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);

create table if not exists public.website_chat_allowed_origins (
  installation_id uuid not null,
  workspace_id uuid not null,
  origin text not null check (
    origin = lower(origin)
    and origin ~ '^https://[a-z0-9][a-z0-9.-]*([:][0-9]{1,5})?$'
    and char_length(origin) <= 253
  ),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (installation_id, origin),
  foreign key (installation_id, workspace_id)
    references public.website_chat_installations(id, workspace_id)
    on delete cascade
);

create table if not exists public.website_chat_visitor_sessions (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null,
  workspace_id uuid not null,
  origin text not null,
  visitor_subject_hash text not null check (
    visitor_subject_hash ~ '^[0-9a-f]{64}$'
  ),
  consent_version text not null check (
    char_length(consent_version) between 1 and 80
  ),
  consent_granted_at timestamptz not null,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (installation_id, workspace_id)
    references public.website_chat_installations(id, workspace_id)
    on delete cascade,
  foreign key (installation_id, origin)
    references public.website_chat_allowed_origins(installation_id, origin)
    on delete restrict,
  constraint website_chat_session_expiry_check check (
    expires_at > consent_granted_at
    and expires_at <= consent_granted_at + interval '24 hours'
  ),
  constraint website_chat_session_last_seen_check check (
    last_seen_at >= consent_granted_at
  ),
  unique (installation_id, visitor_subject_hash)
);

create index if not exists website_chat_installations_workspace_enabled_idx
  on public.website_chat_installations (workspace_id, enabled);
create index if not exists website_chat_sessions_workspace_active_idx
  on public.website_chat_visitor_sessions (workspace_id, expires_at)
  where revoked_at is null;
create index if not exists website_chat_sessions_expiry_idx
  on public.website_chat_visitor_sessions (expires_at);

alter table public.website_chat_installations enable row level security;
alter table public.website_chat_allowed_origins enable row level security;
alter table public.website_chat_visitor_sessions enable row level security;

revoke all on table public.website_chat_installations
  from public, anon, authenticated;
revoke all on table public.website_chat_allowed_origins
  from public, anon, authenticated;
revoke all on table public.website_chat_visitor_sessions
  from public, anon, authenticated;

grant select, insert, update, delete on table public.website_chat_installations
  to service_role;
grant select, insert, update, delete on table public.website_chat_allowed_origins
  to service_role;
grant select, insert, update, delete on table public.website_chat_visitor_sessions
  to service_role;

comment on table public.website_chat_installations is
  'Disabled-by-default server-only Website Chat installations. Public IDs are routing identifiers, never secrets.';
comment on table public.website_chat_allowed_origins is
  'Exact HTTPS origins for Website Chat. Verification is explicit and a public installation ID alone grants no access.';
comment on table public.website_chat_visitor_sessions is
  'Short-lived consent-bound visitor sessions. Only HMAC-SHA256 token subjects are stored; raw tokens and IP addresses are forbidden.';

commit;
