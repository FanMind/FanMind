-- Server-side foundation for internal test workspaces.
-- Defaults keep normal customer workspaces unaffected; flags are set only by admin-only server routes.
alter table public.workspaces
  add column if not exists test_access_flags jsonb not null default '{}'::jsonb;

alter table public.workspaces
  drop constraint if exists workspaces_test_access_flags_object_check;

alter table public.workspaces
  add constraint workspaces_test_access_flags_object_check
  check (jsonb_typeof(test_access_flags) = 'object');

create index if not exists workspaces_test_access_flags_gin_idx
  on public.workspaces using gin (test_access_flags);
