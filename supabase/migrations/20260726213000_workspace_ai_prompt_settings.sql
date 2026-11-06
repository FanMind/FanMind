begin;

create table if not exists public.workspace_ai_prompt_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  company_prompt text not null default '',
  profiles jsonb not null default '[]'::jsonb,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint workspace_ai_prompt_settings_company_prompt_length
    check (char_length(company_prompt) <= 3000),
  constraint workspace_ai_prompt_settings_profiles_array
    check (jsonb_typeof(profiles) = 'array'),
  constraint workspace_ai_prompt_settings_profiles_count
    check (jsonb_array_length(profiles) <= 8)
);

alter table public.workspace_ai_prompt_settings enable row level security;

drop policy if exists workspace_ai_prompt_settings_select_member
  on public.workspace_ai_prompt_settings;

create policy workspace_ai_prompt_settings_select_member
  on public.workspace_ai_prompt_settings
  for select
  to authenticated
  using (
    exists (
      select 1
        from public.workspace_members as member
       where member.workspace_id =
             workspace_ai_prompt_settings.workspace_id
         and member.user_id = auth.uid()
    )
  );

-- Mutations are deliberately server-only. The API derives the Workspace from
-- the authenticated session, restricts editing to the Workspace owner or a
-- platform admin and validates the complete bounded JSON document.
revoke all on table public.workspace_ai_prompt_settings
  from public, anon, authenticated;
grant select on table public.workspace_ai_prompt_settings
  to authenticated;
grant all on table public.workspace_ai_prompt_settings
  to service_role;

create or replace function public.set_workspace_ai_prompt_settings_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  new.updated_at = statement_timestamp();
  return new;
end
$function$;

drop trigger if exists workspace_ai_prompt_settings_set_updated_at
  on public.workspace_ai_prompt_settings;

create trigger workspace_ai_prompt_settings_set_updated_at
before update on public.workspace_ai_prompt_settings
for each row
execute function public.set_workspace_ai_prompt_settings_updated_at();

commit;
