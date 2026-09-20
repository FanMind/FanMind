-- CONTROLLED / UNAPPLIED. Requires the existing private `chat-characters` bucket.
-- This file never creates a bucket and must not run in a normal deploy.
begin;

do $contract$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'chat-characters'
      and public = false
  ) then
    raise exception 'chat_characters_private_bucket_required';
  end if;
end $contract$;

create policy chat_admin_character_images_owner_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-characters'
  and array_length(storage.foldername(name), 1) = 2
  and public.is_current_chat_admin_workspace(
    case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (storage.foldername(name))[1]::uuid
      else null
    end
  )
  and exists (
    select 1
    from public.chat_characters c
    where c.workspace_id = case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (storage.foldername(name))[1]::uuid
      else null
    end
      and c.id = case
        when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (storage.foldername(name))[2]::uuid
        else null
      end
  )
);

create policy chat_admin_character_images_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-characters'
  and array_length(storage.foldername(name), 1) = 2
  and public.is_current_chat_admin_workspace(
    case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (storage.foldername(name))[1]::uuid
      else null
    end
  )
  and exists (
    select 1
    from public.chat_characters c
    where c.workspace_id = case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (storage.foldername(name))[1]::uuid
      else null
    end
      and c.id = case
        when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (storage.foldername(name))[2]::uuid
        else null
      end
  )
);

create policy chat_admin_character_images_owner_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'chat-characters'
  and array_length(storage.foldername(name), 1) = 2
  and public.is_current_chat_admin_workspace(
    case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (storage.foldername(name))[1]::uuid
      else null
    end
  )
  and exists (
    select 1
    from public.chat_characters c
    where c.workspace_id = case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (storage.foldername(name))[1]::uuid
      else null
    end
      and c.id = case
        when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (storage.foldername(name))[2]::uuid
        else null
      end
  )
)
with check (
  bucket_id = 'chat-characters'
  and array_length(storage.foldername(name), 1) = 2
  and public.is_current_chat_admin_workspace(
    case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (storage.foldername(name))[1]::uuid
      else null
    end
  )
  and exists (
    select 1
    from public.chat_characters c
    where c.workspace_id = case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (storage.foldername(name))[1]::uuid
      else null
    end
      and c.id = case
        when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (storage.foldername(name))[2]::uuid
        else null
      end
  )
);

create policy chat_admin_character_images_owner_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat-characters'
  and array_length(storage.foldername(name), 1) = 2
  and public.is_current_chat_admin_workspace(
    case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (storage.foldername(name))[1]::uuid
      else null
    end
  )
  and exists (
    select 1
    from public.chat_characters c
    where c.workspace_id = case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (storage.foldername(name))[1]::uuid
      else null
    end
      and c.id = case
        when (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (storage.foldername(name))[2]::uuid
        else null
      end
  )
);

commit;
