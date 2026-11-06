alter table public.conversations
  add column if not exists assigned_user_id uuid references auth.users(id) on delete set null;

create index if not exists conversations_workspace_assigned_user_idx
  on public.conversations (workspace_id, assigned_user_id)
  where assigned_user_id is not null;

comment on column public.conversations.assigned_user_id is
  'Stable authenticated assignee identity; assigned_owner is display-only.';
