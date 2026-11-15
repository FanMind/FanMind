-- CONTROLLED / UNAPPLIED. Staging-only explicit approval is required.
-- Supabase Storage 1.94.2 first probes caller RLS, then finalizes as its internal
-- service principal without the caller sub. Its server-assigned owner_id is
-- revalidated here; this is never a role-only authorization shortcut.
begin;
create or replace function public.chat_admin_media_object_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
declare target_workspace uuid;target_character uuid;target_owner uuid;actor uuid:=auth.uid();
begin
 if new.bucket_id<>'chat-character-media' then return new;end if;
 select c.workspace_id,c.id,w.owner_user_id into target_workspace,target_character,target_owner
 from public.chat_characters c join public.chat_character_media m on m.workspace_id=c.workspace_id and m.character_id=c.id
 join public.workspaces w on w.id=c.workspace_id
 where new.name=public.chat_admin_media_object_path(m.workspace_id,m.character_id,m.id,m.media_type)
 for update of c;
 if not found then raise exception 'media_object_binding_invalid';end if;
 if actor is not null then
  if not public.chat_admin_media_writes_allowed(target_workspace)
   or (new.owner_id is not null and new.owner_id is distinct from actor::text)
   or (new.owner is not null and new.owner is distinct from actor) then raise exception 'media_object_binding_invalid';end if;
 else
  -- Only Storage's internal finalization context may use its assigned owner.
  -- Authenticated/anon callers cannot select this branch by forging metadata.
  if current_user<>'service_role'
   or coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role','')<>'service_role'
   or new.owner_id is distinct from target_owner::text
   or (new.owner is not null and new.owner is distinct from target_owner)
   or not exists(select 1 from public.workspace_chat_admin_capabilities cap
     where cap.workspace_id=target_workspace and cap.chat_admin_multi_character and cap.granted_to_user_id=target_owner)
   or exists(select 1 from public.account_deletion_requests r where r.user_id=target_owner and r.status='processing')
  then raise exception 'media_object_binding_invalid';end if;
 end if;
 if not exists(select 1 from public.chat_character_media m join public.chat_characters c on c.workspace_id=m.workspace_id and c.id=m.character_id
  where m.workspace_id=target_workspace and m.character_id=target_character and not m.deleted and c.status='active'
  and new.name=public.chat_admin_media_object_path(m.workspace_id,m.character_id,m.id,m.media_type))
 then raise exception 'media_object_binding_invalid';end if;
 return new;
end;$$;
commit;
