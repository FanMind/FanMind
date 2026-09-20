-- Atomic, service-role-only Contact deletion with exact Meta catch-up cleanup.
-- Controlled migration: never applied by the normal Web deploy path.

begin;

create or replace function public.delete_contact_with_meta_catchup(
  p_workspace_id uuid,
  p_contact_id uuid
)
returns table (deleted_contact_id uuid, deleted_workspace_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  target_contact public.contacts%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_workspace_id is null or p_contact_id is null then
    raise exception 'contact_delete_input_invalid' using errcode = '22023';
  end if;

  select contact.*
    into target_contact
    from public.contacts as contact
   where contact.id = p_contact_id
     and contact.workspace_id = p_workspace_id
   for update;
  if not found then
    return;
  end if;

  perform 1
    from public.meta_conversation_catchup_jobs as job
   where job.workspace_id = p_workspace_id
     and job.contact_id = p_contact_id
   for update;

  if exists (
    select 1
      from public.meta_conversation_catchup_jobs as job
     where job.workspace_id = p_workspace_id
       and job.contact_id = p_contact_id
       and job.status = 'claimed'
       and job.lease_until >= now()
  ) then
    raise exception 'contact_delete_active_catchup_lease'
      using errcode = '55006';
  end if;

  delete from public.meta_conversation_catchup_jobs as job
   where job.workspace_id = p_workspace_id
     and job.contact_id = p_contact_id;

  return query
  delete from public.contacts as contact
   where contact.id = p_contact_id
     and contact.workspace_id = p_workspace_id
  returning contact.id, contact.workspace_id;
end
$function$;

revoke all on function public.delete_contact_with_meta_catchup(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_contact_with_meta_catchup(uuid, uuid)
  to service_role;

commit;

