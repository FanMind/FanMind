-- Controlled account-deletion resume inventory contract.
-- Repository-only preparation: never applied by the normal Web deploy path.

begin;

alter table public.account_deletion_requests
  add column if not exists owned_workspace_ids uuid[];

alter table public.account_deletion_requests
  drop constraint if exists account_deletion_owned_workspace_ids_check;

alter table public.account_deletion_requests
  add constraint account_deletion_owned_workspace_ids_check check (
    owned_workspace_ids is null
    or (
      cardinality(owned_workspace_ids) <= 100
      and array_position(owned_workspace_ids, null) is null
    )
  );

comment on column public.account_deletion_requests.owned_workspace_ids is
  'Service-role-only snapshot of Workspace IDs owned immediately before Auth deletion; used only for crash-safe deletion completeness verification and cleared on completion.';

commit;
