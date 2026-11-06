do $$
begin
  drop policy if exists social_connections_select_workspace_member on public.social_connections;
  drop policy if exists social_connections_insert_workspace_member on public.social_connections;
  drop policy if exists social_connections_update_workspace_member on public.social_connections;

  create policy social_connections_select_workspace_member
    on public.social_connections for select
    using (
      exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = social_connections.workspace_id
          and wm.user_id = auth.uid()
      )
      or exists (
        select 1 from public.workspaces w
        where w.id = social_connections.workspace_id
          and w.owner_user_id = auth.uid()
      )
    );

  create policy social_connections_insert_workspace_member
    on public.social_connections for insert
    with check (
      exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = social_connections.workspace_id
          and wm.user_id = auth.uid()
      )
      or exists (
        select 1 from public.workspaces w
        where w.id = social_connections.workspace_id
          and w.owner_user_id = auth.uid()
      )
    );

  create policy social_connections_update_workspace_member
    on public.social_connections for update
    using (
      exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = social_connections.workspace_id
          and wm.user_id = auth.uid()
      )
      or exists (
        select 1 from public.workspaces w
        where w.id = social_connections.workspace_id
          and w.owner_user_id = auth.uid()
      )
    )
    with check (
      exists (
        select 1 from public.workspace_members wm
        where wm.workspace_id = social_connections.workspace_id
          and wm.user_id = auth.uid()
      )
      or exists (
        select 1 from public.workspaces w
        where w.id = social_connections.workspace_id
          and w.owner_user_id = auth.uid()
      )
    );
end;
$$;
