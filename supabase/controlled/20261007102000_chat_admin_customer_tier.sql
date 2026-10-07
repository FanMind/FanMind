-- CONTROLLED / UNAPPLIED: repository contract only. Never run from normal deploy.
-- Add manual ChatAdmin customer classification independently from technical fan status.
begin;

alter table public.chat_character_fans
  add column customer_tier text not null default 'red'
  constraint chat_character_fans_customer_tier_check
  check (customer_tier in ('red','blue','yellow','green'));

create or replace function public.create_chat_admin_fan(
  target_workspace_id uuid, target_character_id uuid, target_creation_id uuid, fan_data jsonb
) returns setof public.chat_character_fans language plpgsql security definer set search_path='' as $$
declare saved public.chat_character_fans;
begin
  if target_creation_id is null or not public.is_current_chat_admin_workspace(target_workspace_id)
  then raise exception 'chat_admin_fan_binding_invalid' using errcode='42501'; end if;
  perform 1 from public.chat_characters c where c.workspace_id=target_workspace_id and c.id=target_character_id for update;
  if not found then raise exception 'chat_admin_fan_binding_invalid' using errcode='42501'; end if;
  select * into saved from public.chat_character_fans f where f.workspace_id=target_workspace_id and f.character_id=target_character_id and f.creation_id=target_creation_id;
  if found then
    if saved.display_name <> btrim(fan_data->>'display_name') or saved.platform <> btrim(fan_data->>'platform')
       or saved.handle is distinct from nullif(btrim(fan_data->>'handle'),'') or saved.language is distinct from nullif(btrim(fan_data->>'language'),'')
       or saved.summary <> coalesce(fan_data->>'summary','') or saved.notes <> coalesce(fan_data->>'notes','')
       or saved.status <> coalesce(fan_data->>'status','active')
       or saved.customer_tier <> coalesce(fan_data->>'customer_tier','red')
    then raise exception 'chat_admin_fan_creation_id_conflict' using errcode='23505'; end if;
    return next saved; return;
  end if;
  insert into public.chat_character_fans(workspace_id,character_id,creation_id,display_name,handle,platform,language,status,customer_tier,summary,notes)
  values(target_workspace_id,target_character_id,target_creation_id,btrim(fan_data->>'display_name'),nullif(btrim(fan_data->>'handle'),''),btrim(fan_data->>'platform'),nullif(btrim(fan_data->>'language'),''),coalesce(fan_data->>'status','active'),coalesce(fan_data->>'customer_tier','red'),coalesce(fan_data->>'summary',''),coalesce(fan_data->>'notes',''))
  returning * into saved;
  return next saved;
end $$;

revoke all on function public.create_chat_admin_fan(uuid,uuid,uuid,jsonb) from public,anon,service_role;
grant execute on function public.create_chat_admin_fan(uuid,uuid,uuid,jsonb) to authenticated;

commit;
