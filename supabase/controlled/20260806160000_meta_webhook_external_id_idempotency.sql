do $verify$
begin
  if to_regclass('public.conversation_messages') is null then
    raise exception 'conversation_messages_missing';
  end if;

  if exists (
    select 1
      from public.conversation_messages
     where source_platform in ('facebook', 'instagram')
       and external_message_id is not null
     group by workspace_id, source_platform, external_message_id
    having count(*) > 1
  ) then
    raise exception 'duplicate_meta_external_message_id';
  end if;

  if exists (
    select 1
      from public.conversation_messages
     where source_platform in ('facebook', 'instagram')
       and external_comment_id is not null
     group by workspace_id, source_platform, external_comment_id
    having count(*) > 1
  ) then
    raise exception 'duplicate_meta_external_comment_id';
  end if;
end
$verify$;

create unique index if not exists
  conversation_messages_meta_external_message_unique_idx
  on public.conversation_messages (
    workspace_id,
    source_platform,
    external_message_id
  )
  where source_platform in ('facebook', 'instagram')
    and external_message_id is not null;

create unique index if not exists
  conversation_messages_meta_external_comment_unique_idx
  on public.conversation_messages (
    workspace_id,
    source_platform,
    external_comment_id
  )
  where source_platform in ('facebook', 'instagram')
    and external_comment_id is not null;
