alter table public.contacts
  add column if not exists is_top_fan boolean not null default false;

create index if not exists contacts_workspace_top_fan_created_at_idx
  on public.contacts (workspace_id, is_top_fan, created_at desc);
