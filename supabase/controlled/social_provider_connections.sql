-- Controlled pilot foundation. Never apply through a normal deploy/db push.
-- Browser roles receive only owner-scoped disclosure columns, never credentials.
-- No provider calls, no activation.
begin;
create table public.social_provider_connections (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('tiktok','x')),
  external_account_id text not null check (length(external_account_id) between 1 and 128),
  display_name text not null check (length(display_name) between 1 and 200),
  encrypted_token text not null check (length(encrypted_token) between 1 and 32768),
  expires_at timestamptz not null,
  revision uuid not null default gen_random_uuid(),
  connected_at timestamptz not null default now(),
  next_read_at timestamptz not null default now(),
  lease_id uuid,
  lease_until timestamptz,
  primary key(workspace_id,provider),
  unique(provider,external_account_id),
  check ((lease_id is null) = (lease_until is null))
);
create table public.social_provider_oauth_attempts (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('tiktok','x')),
  state_hash text not null unique check (state_hash ~ '^[a-f0-9]{64}$'),
  encrypted_verifier text not null check (length(encrypted_verifier) between 1 and 2048),
  expires_at timestamptz not null default now() + interval '10 minutes',
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  primary key(workspace_id,provider)
);
alter table public.social_provider_connections enable row level security;
alter table public.social_provider_oauth_attempts enable row level security;
revoke all on public.social_provider_connections, public.social_provider_oauth_attempts from public, anon, authenticated;
grant select,insert,update,delete on public.social_provider_connections, public.social_provider_oauth_attempts to service_role;
grant select(workspace_id,provider,external_account_id,display_name,expires_at,connected_at)
  on public.social_provider_connections to authenticated;
create policy social_provider_owner_metadata on public.social_provider_connections for select to authenticated
  using (exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_user_id=(select auth.uid())));

-- Service caller supplies only the independently authenticated actor. Recheck the
-- actual owner at the storage boundary too; user metadata never grants access.
create function public.fanmind_social_owner(p_workspace uuid, p_user uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists(select 1 from public.workspaces where id=p_workspace and owner_user_id=p_user)
$$;
create function public.fanmind_social_begin(p_workspace uuid,p_user uuid,p_provider text,p_hash text,p_verifier text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if not public.fanmind_social_owner(p_workspace,p_user) then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_workspace::text || ':' || p_provider, 0));
  if exists(select 1 from public.social_provider_oauth_attempts where workspace_id=p_workspace and provider=p_provider and created_at > now()-interval '1 minute') then return false; end if;
  insert into public.social_provider_oauth_attempts(workspace_id,user_id,provider,state_hash,encrypted_verifier)
  values(p_workspace,p_user,p_provider,p_hash,p_verifier)
  on conflict(workspace_id,provider) do update set user_id=excluded.user_id,state_hash=excluded.state_hash,
    encrypted_verifier=excluded.encrypted_verifier,expires_at=now()+interval '10 minutes',created_at=now(),consumed_at=null;
  return true;
end $$;
create function public.fanmind_social_consume(p_workspace uuid,p_user uuid,p_provider text,p_hash text)
returns text language plpgsql security invoker set search_path = '' as $$
declare result text;
begin
  if not public.fanmind_social_owner(p_workspace,p_user) then return null; end if;
  update public.social_provider_oauth_attempts set consumed_at=now()
  where workspace_id=p_workspace and user_id=p_user and provider=p_provider and state_hash=p_hash
    and expires_at>now() and consumed_at is null returning encrypted_verifier into result;
  return result;
end $$;
create function public.fanmind_social_complete(p_workspace uuid,p_user uuid,p_provider text,p_hash text,
  p_account text,p_name text,p_token text,p_expires timestamptz)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if not public.fanmind_social_owner(p_workspace,p_user) or p_expires<=now() then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_workspace::text || ':' || p_provider, 0));
  delete from public.social_provider_oauth_attempts where workspace_id=p_workspace and user_id=p_user and provider=p_provider
    and state_hash=p_hash and consumed_at is not null and expires_at>now();
  if not found then return false; end if;
  -- A reconnect may renew the same external identity, never silently switch it.
  if exists(select 1 from public.social_provider_connections where workspace_id=p_workspace and provider=p_provider and external_account_id<>p_account) then
    raise exception using message='social_account_conflict',errcode='23505';
  end if;
  insert into public.social_provider_connections(workspace_id,provider,external_account_id,display_name,encrypted_token,expires_at)
  values(p_workspace,p_provider,p_account,p_name,p_token,p_expires)
  on conflict(workspace_id,provider) do update set display_name=excluded.display_name,encrypted_token=excluded.encrypted_token,
    expires_at=excluded.expires_at,revision=gen_random_uuid(),connected_at=now(),lease_id=null,lease_until=null;
  return true;
end $$;
create function public.fanmind_social_disconnect(p_workspace uuid,p_user uuid,p_provider text)
returns setof public.social_provider_connections language plpgsql security invoker set search_path = '' as $$
begin
  if not public.fanmind_social_owner(p_workspace,p_user) then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_workspace::text || ':' || p_provider, 0));
  delete from public.social_provider_oauth_attempts where workspace_id=p_workspace and provider=p_provider;
  return query delete from public.social_provider_connections where workspace_id=p_workspace and provider=p_provider returning *;
end $$;
create function public.fanmind_social_claim_read(p_workspace uuid,p_user uuid,p_provider text,p_revision uuid,p_lease uuid)
returns setof public.social_provider_connections language plpgsql security invoker set search_path = '' as $$
begin
  if not public.fanmind_social_owner(p_workspace,p_user) or p_provider<>'x' or p_lease is null then return; end if;
  return query update public.social_provider_connections set lease_id=p_lease,lease_until=now()+interval '2 minutes',next_read_at=now()+interval '15 minutes'
  where workspace_id=p_workspace and provider=p_provider and revision=p_revision and next_read_at<=now()
    and (lease_until is null or lease_until<now()) returning *;
end $$;
create function public.fanmind_social_rotate(p_workspace uuid,p_user uuid,p_provider text,p_revision uuid,p_lease uuid,p_token text,p_expires timestamptz)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if not public.fanmind_social_owner(p_workspace,p_user) or p_expires<=now() then return false; end if;
  update public.social_provider_connections set encrypted_token=p_token,expires_at=p_expires
  where workspace_id=p_workspace and provider=p_provider and revision=p_revision and lease_id=p_lease and lease_until>now();
  return found;
end $$;
create function public.fanmind_social_finish_read(p_workspace uuid,p_user uuid,p_provider text,p_revision uuid,p_lease uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if not public.fanmind_social_owner(p_workspace,p_user) then return false; end if;
  update public.social_provider_connections set lease_id=null,lease_until=null
  where workspace_id=p_workspace and provider=p_provider and revision=p_revision and lease_id=p_lease and lease_until>now();
  return found;
end $$;
revoke all on function public.fanmind_social_owner(uuid,uuid),
 public.fanmind_social_begin(uuid,uuid,text,text,text),public.fanmind_social_consume(uuid,uuid,text,text),
 public.fanmind_social_complete(uuid,uuid,text,text,text,text,text,timestamptz),public.fanmind_social_disconnect(uuid,uuid,text),
 public.fanmind_social_claim_read(uuid,uuid,text,uuid,uuid),public.fanmind_social_rotate(uuid,uuid,text,uuid,uuid,text,timestamptz),
 public.fanmind_social_finish_read(uuid,uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.fanmind_social_owner(uuid,uuid),
 public.fanmind_social_begin(uuid,uuid,text,text,text),public.fanmind_social_consume(uuid,uuid,text,text),
 public.fanmind_social_complete(uuid,uuid,text,text,text,text,text,timestamptz),public.fanmind_social_disconnect(uuid,uuid,text),
 public.fanmind_social_claim_read(uuid,uuid,text,uuid,uuid),public.fanmind_social_rotate(uuid,uuid,text,uuid,uuid,text,timestamptz),
 public.fanmind_social_finish_read(uuid,uuid,text,uuid,uuid) to service_role;
commit;
