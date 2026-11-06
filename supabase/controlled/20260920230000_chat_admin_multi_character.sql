-- CONTROLLED / UNAPPLIED: repository contract only. Never run from normal deploy.
-- ChatAdmin is a workspace capability, never a Platform-Admin role.
begin;

create table if not exists public.workspace_chat_admin_capabilities (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  chat_admin_multi_character boolean not null default false,
  granted_to_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint chat_admin_enabled_only check (chat_admin_multi_character = true)
);
-- Owner decision: at most one enabled Workspace in the complete installation.
create unique index if not exists one_chat_admin_workspace_global on public.workspace_chat_admin_capabilities ((chat_admin_multi_character)) where chat_admin_multi_character;

create table if not exists public.chat_characters (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  profile_image_path text, public_age smallint not null check (public_age between 18 and 99),
  bio text not null, location text, languages text[] not null default '{}', personality text not null,
  writing_style text not null, emoji_style text not null, sentence_style text not null,
  typical_phrases text[] not null default '{}', forbidden_phrases text[] not null default '{}',
  flirt_style text not null, sales_rules text not null, example_messages text[] not null default '{}',
  status text not null default 'active' check (status in ('active','inactive')), revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (workspace_id,id),
  constraint chat_character_image_private_path check (profile_image_path is null or profile_image_path ~ '^chat-characters/[0-9a-f-]+/[0-9a-f-]+/[A-Za-z0-9._-]+$')
);

create table if not exists public.chat_character_conversations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, character_id uuid not null,
  fan_reference text not null check (char_length(btrim(fan_reference)) between 1 and 120),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(workspace_id,character_id,id), foreign key(workspace_id,character_id) references public.chat_characters(workspace_id,id) on delete cascade
);
create table if not exists public.chat_character_messages (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null, character_id uuid not null, conversation_id uuid not null,
  direction text not null check(direction in ('fan_inbound','suggested_reply','confirmed_reply')),
  content text not null check(char_length(content) between 1 and 4000), character_revision integer not null check(character_revision > 0),
  created_at timestamptz not null default now(),
  foreign key(workspace_id,character_id,conversation_id) references public.chat_character_conversations(workspace_id,character_id,id) on delete cascade
);

create or replace function public.is_current_chat_admin_workspace(target_workspace_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.workspace_chat_admin_capabilities c join public.workspaces w on w.id=c.workspace_id where c.workspace_id=target_workspace_id and c.chat_admin_multi_character and c.granted_to_user_id=auth.uid() and w.owner_user_id=auth.uid());
$$;
revoke all on function public.is_current_chat_admin_workspace(uuid) from public, anon, service_role;
grant execute on function public.is_current_chat_admin_workspace(uuid) to authenticated;

alter table public.workspace_chat_admin_capabilities enable row level security;
alter table public.chat_characters enable row level security;
alter table public.chat_character_conversations enable row level security;
alter table public.chat_character_messages enable row level security;
create policy chat_admin_capability_owner_read on public.workspace_chat_admin_capabilities for select to authenticated using (
  chat_admin_multi_character and granted_to_user_id=auth.uid() and
  exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_user_id=auth.uid())
);
create policy chat_admin_characters_owner_all on public.chat_characters for all to authenticated using (public.is_current_chat_admin_workspace(workspace_id)) with check (public.is_current_chat_admin_workspace(workspace_id) and created_by_user_id=auth.uid());
create policy chat_admin_conversations_owner_all on public.chat_character_conversations for all to authenticated using (public.is_current_chat_admin_workspace(workspace_id)) with check (public.is_current_chat_admin_workspace(workspace_id));
create policy chat_admin_messages_owner_all on public.chat_character_messages for all to authenticated using (public.is_current_chat_admin_workspace(workspace_id)) with check (public.is_current_chat_admin_workspace(workspace_id));
revoke all on table public.workspace_chat_admin_capabilities,public.chat_characters,public.chat_character_conversations,public.chat_character_messages from public,anon,authenticated,service_role;
grant select on table public.workspace_chat_admin_capabilities to authenticated;
grant select,insert,update,delete on table public.chat_characters,public.chat_character_conversations,public.chat_character_messages to authenticated;
grant select,insert,update,delete on table public.workspace_chat_admin_capabilities,public.chat_characters,public.chat_character_conversations,public.chat_character_messages to service_role;
commit;
