-- Controlled forward correction: an optimistic application conflict is HTTP 409.
-- Preserve the function identity, owner, ACLs and every other statement.
create or replace function public.save_creator_bundle(p_workspace_id uuid, p_creator_id uuid, p_expected_revision integer, p_persona jsonb, p_voice jsonb, p_playbook jsonb, p_approve boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target uuid; next_revision integer; approver uuid;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.workspaces w where w.id = p_workspace_id and w.owner_user_id = (select auth.uid())) then
    raise exception 'creator_owner_required' using errcode = '42501';
  end if;
  if p_creator_id is null then
    if p_expected_revision is distinct from 0 then raise exception 'creator_revision_conflict' using errcode = 'PT409'; end if;
    insert into public.creators(workspace_id,display_name) values(p_workspace_id,p_persona->>'displayName') returning id into target;
    next_revision := 1;
  else
    select id, revision + 1 into target,next_revision from public.creators where workspace_id = p_workspace_id and id = p_creator_id and revision = p_expected_revision for update;
    if target is null then raise exception 'creator_revision_conflict' using errcode = 'PT409'; end if;
  end if;
  update public.creators set display_name = p_persona->>'displayName', bio = p_persona->>'bio',
    public_age = (p_persona->>'publicAge')::integer, location = p_persona->>'location',
    languages = array(select jsonb_array_elements_text(p_persona->'languages')),
    platforms = array(select jsonb_array_elements_text(p_persona->'platforms')),
    status = p_persona->>'status', internal_notes = p_persona->>'internalNotes', revision = next_revision, updated_at = now()
    where workspace_id = p_workspace_id and id = target;
  if p_approve and (coalesce(jsonb_typeof(p_voice->'goodExamples'),'null') <> 'array' or
      coalesce(jsonb_array_length(p_voice->'goodExamples'),0) < 3 or
      coalesce(jsonb_array_length(p_persona->'languages'),0) = 0) then
    raise exception 'creator_review_incomplete' using errcode = '23514';
  end if;
  approver := case when p_approve then (select auth.uid()) else null end;
  insert into public.creator_voice_profiles(workspace_id,creator_id,fingerprint,revision,approved_by,approved_at)
    values(p_workspace_id,target,p_voice,next_revision,approver,case when p_approve then now() else null end)
    on conflict(workspace_id,creator_id) do update set fingerprint=excluded.fingerprint,revision=excluded.revision,approved_by=excluded.approved_by,approved_at=excluded.approved_at;
  insert into public.creator_sales_playbooks(workspace_id,creator_id,rules,revision,approved_by,approved_at)
    values(p_workspace_id,target,p_playbook,next_revision,approver,case when p_approve then now() else null end)
    on conflict(workspace_id,creator_id) do update set rules=excluded.rules,revision=excluded.revision,approved_by=excluded.approved_by,approved_at=excluded.approved_at;
  return target;
end $$;
