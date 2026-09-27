-- CONTROLLED / UNAPPLIED: repository contract only. Never run from normal deploy.
-- Additive ChatAdmin fan identity and strict Character/Fan conversation boundaries.
begin;

create table public.chat_character_fans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  character_id uuid not null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  handle text check (handle is null or char_length(btrim(handle)) between 1 and 120),
  platform text not null check (char_length(btrim(platform)) between 1 and 40),
  language text check (language is null or char_length(btrim(language)) between 1 and 40),
  status text not null default 'active' check (status in ('active','inactive')),
  summary text not null default '' check (char_length(summary) <= 4000),
  notes text not null default '' check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, character_id, id),
  foreign key (workspace_id, character_id) references public.chat_characters(workspace_id, id) on delete cascade
);

alter table public.chat_character_conversations add column fan_id uuid;
create unique index chat_character_conversations_one_per_fan
  on public.chat_character_conversations(workspace_id, character_id, fan_id) where fan_id is not null;
create unique index chat_character_conversations_fan_identity
  on public.chat_character_conversations(workspace_id, character_id, fan_id, id);
alter table public.chat_character_conversations add constraint chat_character_conversations_fan_fk
  foreign key (workspace_id, character_id, fan_id)
  references public.chat_character_fans(workspace_id, character_id, id) on delete cascade;

alter table public.chat_character_messages add column fan_id uuid;
alter table public.chat_character_messages add constraint chat_character_messages_fan_conversation_fk
  foreign key (workspace_id, character_id, fan_id, conversation_id)
  references public.chat_character_conversations(workspace_id, character_id, fan_id, id) on delete cascade;

create function public.require_chat_admin_fan_binding() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.fan_id is null then raise exception 'chat_admin_fan_binding_required' using errcode='23514'; end if;
  return new;
end $$;
create trigger require_chat_admin_conversation_fan before insert or update on public.chat_character_conversations
for each row execute function public.require_chat_admin_fan_binding();
create trigger require_chat_admin_message_fan before insert or update on public.chat_character_messages
for each row execute function public.require_chat_admin_fan_binding();

create function public.create_chat_admin_fan_conversation() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.chat_character_conversations(workspace_id,character_id,fan_id,fan_reference)
  values(new.workspace_id,new.character_id,new.id,new.display_name);
  return new;
end $$;
create trigger create_chat_admin_fan_conversation_after_insert after insert on public.chat_character_fans
for each row execute function public.create_chat_admin_fan_conversation();

alter table public.chat_character_fans enable row level security;
create policy chat_admin_fans_owner_all on public.chat_character_fans for all to authenticated
  using (public.is_current_chat_admin_workspace(workspace_id))
  with check (public.is_current_chat_admin_workspace(workspace_id));

-- Historical V1 rows remain readable/deletable for compatibility, but every new or
-- changed conversation/message must have the complete persistent fan binding.
drop policy chat_admin_conversations_owner_all on public.chat_character_conversations;
create policy chat_admin_conversations_owner_all on public.chat_character_conversations for all to authenticated
  using (public.is_current_chat_admin_workspace(workspace_id))
  with check (
    fan_id is not null and public.is_current_chat_admin_workspace(workspace_id) and
    exists(select 1 from public.chat_character_fans f where f.workspace_id=chat_character_conversations.workspace_id and f.character_id=chat_character_conversations.character_id and f.id=chat_character_conversations.fan_id)
  );
drop policy chat_admin_messages_owner_all on public.chat_character_messages;
create policy chat_admin_messages_owner_all on public.chat_character_messages for all to authenticated
  using (public.is_current_chat_admin_workspace(workspace_id))
  with check (
    fan_id is not null and public.is_current_chat_admin_workspace(workspace_id) and
    exists(select 1 from public.chat_character_conversations c where c.workspace_id=chat_character_messages.workspace_id and c.character_id=chat_character_messages.character_id and c.fan_id=chat_character_messages.fan_id and c.id=chat_character_messages.conversation_id)
  );

revoke all on table public.chat_character_fans from public, anon, authenticated, service_role;
grant select,insert,update,delete on table public.chat_character_fans to authenticated, service_role;
revoke insert,update,delete on table public.chat_character_conversations,public.chat_character_messages from authenticated;

create function public.persist_chat_admin_generation(
  target_workspace_id uuid, target_character_id uuid, target_fan_id uuid,
  target_conversation_id uuid, target_character_revision integer,
  expected_history_ids uuid[], inbound_content text, suggested_contents text[]
) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_current_chat_admin_workspace(target_workspace_id)
     or coalesce(cardinality(suggested_contents),0) <> 3
     or exists(select 1 from unnest(suggested_contents) value where char_length(btrim(value)) not between 1 and 4000)
     or char_length(btrim(inbound_content)) not between 1 and 4000
  then raise exception 'chat_admin_generation_binding_invalid' using errcode='42501'; end if;
  perform 1 from public.chat_characters c where c.workspace_id=target_workspace_id and c.id=target_character_id and c.status='active' and c.revision=target_character_revision for update;
  if not found then raise exception 'chat_admin_generation_binding_invalid' using errcode='42501'; end if;
  perform 1 from public.chat_character_fans f where f.workspace_id=target_workspace_id and f.character_id=target_character_id and f.id=target_fan_id and f.status='active' for update;
  if not found then raise exception 'chat_admin_generation_binding_invalid' using errcode='42501'; end if;
  perform 1 from public.chat_character_conversations c where c.workspace_id=target_workspace_id and c.character_id=target_character_id and c.fan_id=target_fan_id and c.id=target_conversation_id for update;
  if not found or coalesce(expected_history_ids,'{}'::uuid[]) <> coalesce((select array_agg(id order by created_at,id) from (select id,created_at from public.chat_character_messages where workspace_id=target_workspace_id and character_id=target_character_id and fan_id=target_fan_id and conversation_id=target_conversation_id order by created_at desc,id desc limit 20) recent),'{}'::uuid[]) then raise exception 'chat_admin_generation_context_changed' using errcode='40001'; end if;
  insert into public.chat_character_messages(workspace_id,character_id,fan_id,conversation_id,direction,content,character_revision)
    values(target_workspace_id,target_character_id,target_fan_id,target_conversation_id,'fan_inbound',inbound_content,target_character_revision);
  insert into public.chat_character_messages(workspace_id,character_id,fan_id,conversation_id,direction,content,character_revision)
    select target_workspace_id,target_character_id,target_fan_id,target_conversation_id,'suggested_reply',value,target_character_revision from unnest(suggested_contents) value;
end $$;
create function public.persist_chat_admin_confirmed_reply(
  target_workspace_id uuid, target_character_id uuid, target_fan_id uuid,
  target_conversation_id uuid, target_character_revision integer, reply_content text
) returns public.chat_character_messages language plpgsql security definer set search_path='' as $$
declare saved public.chat_character_messages;
begin
  if not public.is_current_chat_admin_workspace(target_workspace_id)
     or char_length(btrim(reply_content)) not between 1 and 4000
  then raise exception 'chat_admin_confirmed_reply_binding_invalid' using errcode='42501'; end if;
  perform 1 from public.chat_characters c where c.workspace_id=target_workspace_id and c.id=target_character_id and c.status='active' and c.revision=target_character_revision for update;
  if not found then raise exception 'chat_admin_confirmed_reply_binding_invalid' using errcode='42501'; end if;
  perform 1 from public.chat_character_fans f where f.workspace_id=target_workspace_id and f.character_id=target_character_id and f.id=target_fan_id and f.status='active' for update;
  if not found then raise exception 'chat_admin_confirmed_reply_binding_invalid' using errcode='42501'; end if;
  perform 1 from public.chat_character_conversations c where c.workspace_id=target_workspace_id and c.character_id=target_character_id and c.fan_id=target_fan_id and c.id=target_conversation_id for update;
  if not found then raise exception 'chat_admin_confirmed_reply_binding_invalid' using errcode='42501'; end if;
  insert into public.chat_character_messages(workspace_id,character_id,fan_id,conversation_id,direction,content,character_revision)
  values(target_workspace_id,target_character_id,target_fan_id,target_conversation_id,'confirmed_reply',reply_content,target_character_revision) returning * into saved;
  return saved;
end $$;
revoke all on function public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,uuid[],text,text[]) from public,anon,service_role;
grant execute on function public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,uuid[],text,text[]) to authenticated;
revoke all on function public.persist_chat_admin_confirmed_reply(uuid,uuid,uuid,uuid,integer,text) from public,anon,service_role;
grant execute on function public.persist_chat_admin_confirmed_reply(uuid,uuid,uuid,uuid,integer,text) to authenticated;
revoke all on function public.create_chat_admin_fan_conversation() from public,anon,authenticated,service_role;
revoke all on function public.require_chat_admin_fan_binding() from public,anon,authenticated,service_role;
commit;
