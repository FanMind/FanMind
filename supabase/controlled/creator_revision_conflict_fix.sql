create or replace function public.creator_workspace_access_allowed(p_workspace_id uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare allowed boolean;
begin
  if to_regprocedure('public.admin_crm_read_allowed(uuid)') is null then
    return true;
  end if;
  execute 'select public.admin_crm_read_allowed($1)' into allowed using p_workspace_id;
  return coalesce(allowed, false);
end $$;
revoke all on function public.creator_workspace_access_allowed(uuid) from public, anon, authenticated, service_role;
grant execute on function public.creator_workspace_access_allowed(uuid) to authenticated, service_role;


-- Controlled forward correction: an optimistic application conflict is HTTP 409.
-- Preserve the function identity, owner, ACLs and every other statement.
create or replace function public.save_creator_bundle(p_workspace_id uuid, p_creator_id uuid, p_expected_revision integer, p_persona jsonb, p_voice jsonb, p_playbook jsonb, p_approve boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target uuid; next_revision integer; approver uuid;
begin
  if not public.creator_workspace_access_allowed(p_workspace_id) then
    raise exception 'workspace_inactive' using errcode='42501';
  end if;
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

create or replace function public.record_creator_fan_review(p_workspace_id uuid, p_contact_id uuid, p_commercial jsonb, p_event jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare creator uuid;
begin
  if not public.creator_workspace_access_allowed(p_workspace_id) then
    raise exception 'workspace_inactive' using errcode='42501';
  end if;
  if (select auth.uid()) is null or not exists(select 1 from public.workspaces where id=p_workspace_id and owner_user_id=(select auth.uid())) then
    raise exception 'creator_owner_required' using errcode='42501';
  end if;
  if not exists(select 1 from public.contacts where id=p_contact_id and workspace_id=p_workspace_id) then
    raise exception 'creator_contact_mismatch' using errcode='23514';
  end if;
  select id into strict creator from public.creators where workspace_id=p_workspace_id;
  if p_commercial is null or jsonb_typeof(p_commercial) <> 'object' or coalesce(length(btrim(p_commercial->>'sourceReference')),0)=0 then
    raise exception 'creator_source_required' using errcode='23514';
  end if;
  insert into public.contact_ai_profiles(workspace_id,contact_id,commercial_profile)
    values(p_workspace_id,p_contact_id,p_commercial || jsonb_build_object('reviewStatus','confirmed','reviewedAt',now(),'reviewedBy',(select auth.uid())))
    on conflict(workspace_id,contact_id) do update set commercial_profile=excluded.commercial_profile;
  if p_event is not null and p_event <> 'null'::jsonb then
    insert into public.creator_commercial_events(workspace_id,creator_id,contact_id,kind,occurred_at,amount_minor,currency,category,evidence_reference,confirmed_by)
      values(p_workspace_id,creator,p_contact_id,p_event->>'kind',(p_event->>'occurredAt')::timestamptz,
        (p_event->>'amountMinor')::bigint,p_event->>'currency',p_event->>'category',p_event->>'evidenceReference',(select auth.uid()));
  end if;
end $$;
