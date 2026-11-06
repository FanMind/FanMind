create index if not exists conversation_messages_conversation_created_desc_idx
  on public.conversation_messages (conversation_id, created_at desc, id desc);

create index if not exists conversations_workspace_contact_idx
  on public.conversations (workspace_id, contact_id);

create index if not exists conversations_workspace_platform_thread_idx
  on public.conversations (workspace_id, source_platform, external_thread_id)
  where external_thread_id is not null;

create index if not exists social_connections_workspace_platform_status_idx
  on public.social_connections (workspace_id, platform, status);

create index if not exists social_connections_platform_page_idx
  on public.social_connections (platform, page_id)
  where page_id is not null;

create or replace function public.trim_conversation_messages_to_latest_50()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.conversation_id is null then
    return new;
  end if;

  delete from public.conversation_messages cm
  using (
    select id
    from (
      select
        id,
        row_number() over (
          partition by conversation_id
          order by created_at desc, id desc
        ) as rn
      from public.conversation_messages
      where conversation_id = new.conversation_id
    ) ranked
    where ranked.rn > 50
  ) old_messages
  where cm.id = old_messages.id;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'conversation_messages_trim_to_latest_50'
      and tgrelid = 'public.conversation_messages'::regclass
  ) then
    create trigger conversation_messages_trim_to_latest_50
      after insert on public.conversation_messages
      for each row
      execute function public.trim_conversation_messages_to_latest_50();
  end if;
end;
$$;
