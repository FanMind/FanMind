create extension if not exists pgcrypto;

create table if not exists public.conversation_summaries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  summary text,
  key_points text[] default '{}',
  open_questions text[] default '{}',
  last_summarized_message_at timestamptz,
  message_count_seen integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, conversation_id)
);

create table if not exists public.contact_ai_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  language text,
  tone text,
  sentiment text,
  interests text[] default '{}',
  buying_signals text[] default '{}',
  no_gos text[] default '{}',
  preferred_style text,
  response_triggers text[] default '{}',
  risk_notes text[] default '{}',
  confidence_score integer default 0,
  source_message_count integer default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, contact_id)
);

create table if not exists public.workspace_voice_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid,
  owner_label text,
  language text,
  tone text,
  sentence_length text,
  emoji_style text,
  greeting_style text,
  closing_style text,
  common_phrases text[] default '{}',
  avoided_phrases text[] default '{}',
  sales_style text,
  examples_count integer default 0,
  confidence_score integer default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists conversation_summaries_workspace_conversation_idx on public.conversation_summaries (workspace_id, conversation_id);
create index if not exists contact_ai_profiles_workspace_contact_idx on public.contact_ai_profiles (workspace_id, contact_id);
create index if not exists workspace_voice_profiles_workspace_user_idx on public.workspace_voice_profiles (workspace_id, user_id);
create index if not exists workspace_voice_profiles_workspace_idx on public.workspace_voice_profiles (workspace_id);

alter table public.conversation_summaries enable row level security;
alter table public.contact_ai_profiles enable row level security;
alter table public.workspace_voice_profiles enable row level security;

create or replace function public.set_memory_profiles_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'conversation_summaries_set_updated_at' and tgrelid = 'public.conversation_summaries'::regclass) then
    create trigger conversation_summaries_set_updated_at before update on public.conversation_summaries for each row execute function public.set_memory_profiles_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'contact_ai_profiles_set_updated_at' and tgrelid = 'public.contact_ai_profiles'::regclass) then
    create trigger contact_ai_profiles_set_updated_at before update on public.contact_ai_profiles for each row execute function public.set_memory_profiles_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'workspace_voice_profiles_set_updated_at' and tgrelid = 'public.workspace_voice_profiles'::regclass) then
    create trigger workspace_voice_profiles_set_updated_at before update on public.workspace_voice_profiles for each row execute function public.set_memory_profiles_updated_at();
  end if;
end;
$$;

do $$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array['conversation_summaries', 'contact_ai_profiles', 'workspace_voice_profiles'] loop
    policy_name := table_name || '_workspace_member_all';
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = table_name and policyname = policy_name) then
      execute format('create policy %I on public.%I for all using (exists (select 1 from public.workspace_members wm where wm.workspace_id = %I.workspace_id and wm.user_id = auth.uid())) with check (exists (select 1 from public.workspace_members wm where wm.workspace_id = %I.workspace_id and wm.user_id = auth.uid()))', policy_name, table_name, table_name, table_name);
    end if;
  end loop;
end;
$$;
