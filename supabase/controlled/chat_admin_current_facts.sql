-- CONTROLLED / UNAPPLIED. Separate protected install and acceptance required.
-- Never invoked by normal deploy or generic migration push.
begin;
alter table public.chat_character_fans add column current_facts_version smallint not null default 0 check(current_facts_version in (0,1));
create schema fanmind_chat_knowledge;
revoke all on schema fanmind_chat_knowledge from public,anon,authenticated,service_role;
grant usage on schema fanmind_chat_knowledge to authenticated;

-- A complete source identity; UPDATEs of referenced evidence cannot drift.
create unique index chat_character_messages_current_fact_source
 on public.chat_character_messages(workspace_id,character_id,fan_id,conversation_id,id,sequence);
create table public.chat_character_current_facts (
 workspace_id uuid not null,
 character_id uuid not null,
 fan_id uuid not null,
 topic text not null check(topic in ('music','cats','dogs','travel','sports','photos','videos','cooking')),
 polarity text not null check(polarity in ('positive','negative')),
 quote text not null check(char_length(quote) between 1 and 240 and quote=btrim(quote)),
 conversation_id uuid not null,
 source_message_id uuid not null,
 source_sequence bigint not null check(source_sequence>0),
 source_statement_index integer not null check(source_statement_index between 0 and 3999),
 primary key(workspace_id,character_id,fan_id,topic),
 foreign key(workspace_id,character_id,fan_id) references public.chat_character_fans(workspace_id,character_id,id) on delete cascade,
 foreign key(workspace_id,character_id,fan_id,conversation_id,source_message_id,source_sequence)
  references public.chat_character_messages(workspace_id,character_id,fan_id,conversation_id,id,sequence)
  deferrable initially deferred
);
alter table public.chat_character_current_facts enable row level security;
create policy chat_current_facts_owner_read on public.chat_character_current_facts for select to authenticated
 using(public.is_current_chat_admin_workspace(workspace_id));
revoke all on table public.chat_character_current_facts from public,anon,authenticated,service_role;
grant select on table public.chat_character_current_facts to authenticated,service_role;

-- Match only complete narrow DE/EN statements. No client-provided classification.
create function fanmind_chat_knowledge.literal_interest(value text)
 returns table(topic text,polarity text) language plpgsql immutable security invoker set search_path='' as $fn$
declare tokens text[]; word text;
begin
 if value is null or char_length(value)>240 or value<>btrim(value) then return; end if;
 tokens:=regexp_match(value,$re$^(?:ich (?:mag|liebe|bevorzuge)|i (?:like|love|prefer)) (musik|music|katzen|cats|hunde|dogs|reisen|travel|sport|sports|fotos|photos|videos|kochen|cooking)[.!]?$$re$,'i');
 polarity:='positive';
 if tokens is null then
  tokens:=regexp_match(value,$re$^(?:ich (?:mag|liebe|bevorzuge) (?:keine (musik|music|katzen|cats|hunde|dogs|reisen|travel|sport|sports|fotos|photos|videos|kochen|cooking) mehr|(musik|music|katzen|cats|hunde|dogs|reisen|travel|sport|sports|fotos|photos|videos|kochen|cooking) nicht mehr)|i (?:(?:do not|don['’]t) like (musik|music|katzen|cats|hunde|dogs|reisen|travel|sport|sports|fotos|photos|videos|kochen|cooking) anymore|no longer like (musik|music|katzen|cats|hunde|dogs|reisen|travel|sport|sports|fotos|photos|videos|kochen|cooking)))[.!]?$$re$,'i');
  polarity:='negative';
 end if;
 if tokens is null then return; end if;
 select lower(t) into word from unnest(tokens) t where t is not null limit 1;
 topic:=case word when 'musik' then 'music' when 'katzen' then 'cats' when 'hunde' then 'dogs' when 'reisen' then 'travel' when 'sport' then 'sports' when 'fotos' then 'photos' when 'kochen' then 'cooking' else word end;
 return next;
end $fn$;

-- Existing safe communication/boundary clauses can accompany an interest.
create function fanmind_chat_knowledge.neutral_statement(value text) returns boolean language sql immutable security invoker set search_path='' as $fn$
 select value ~* $re$^(?:(?:ich (?:mag|bevorzuge)|bitte (?:schreibe|schreib)) (?:(?:kurze|lange|direkte|lockere|freundliche) (?:antworten|nachrichten))(?: (?:ohne|mit) emojis)?|(?:bitte )?(?:keine|ohne|mit) emojis|(?:with|without) emojis|i prefer (?:short|long|direct|casual|friendly) (?:replies|messages)(?: (?:with|without) emojis)?|(?:bitte keine|ich (?:will|möchte) keine) (?:angebote|verkaufsgespräche|nachfragen|emojis)|(?:please no|i do not want) (?:offers|sales|questions|emojis))[.!]?$$re$
$fn$;
-- Entire-message validation declines quoted/hypothetical/mixed unknown context.
create function fanmind_chat_knowledge.source_interests(content text)
 returns table(topic text,polarity text,quote text,source_statement_index integer)
 language sql immutable security invoker set search_path='' as $fn$
 with statements as (
  select btrim(s) quote,(row_number() over(order by n)-1)::integer ordinal
  from regexp_split_to_table(content,$re$(?<=[.!?])\s+|\n$re$) with ordinality parts(s,n) where btrim(s)<>''
 ), parsed as (
  select p.topic,p.polarity,s.quote,s.ordinal from statements s left join lateral fanmind_chat_knowledge.literal_interest(s.quote) p on true
 )
 select distinct on(p.topic) p.topic,p.polarity,p.quote,p.ordinal from parsed p
 where p.topic is not null and not exists(select 1 from parsed where topic is null and not fanmind_chat_knowledge.neutral_statement(quote))
 order by p.topic,p.ordinal desc
$fn$;

-- No write grants on the table. Only this checked operation can create facts.
-- Definer is private; public RPC is invoker. Same auth predicate as existing RPCs.
create function fanmind_chat_knowledge.apply_generation(
 target_workspace_id uuid,target_character_id uuid,target_fan_id uuid,target_conversation_id uuid,
 target_character_revision integer,target_fan_revision integer,target_generation_id uuid
) returns boolean language plpgsql security definer set search_path='' as $fn$
declare message public.chat_character_messages; candidate record; old public.chat_character_current_facts; changed boolean:=false; legacy jsonb; legacy_cutoff bigint:=0; raw_notes text;
begin
 if auth.uid() is null or not public.is_current_chat_admin_workspace(target_workspace_id) then raise exception 'current_fact_forbidden' using errcode='42501'; end if;
 perform 1 from public.workspace_chat_admin_capabilities cap join public.workspaces w on w.id=cap.workspace_id where cap.workspace_id=target_workspace_id and cap.chat_admin_multi_character and cap.granted_to_user_id=auth.uid() and w.owner_user_id=auth.uid() for share of cap,w;
 if not found then raise exception 'current_fact_forbidden' using errcode='42501'; end if;
 -- Lock order matches persist_chat_admin_generation: Character -> Fan -> Conversation.
 perform 1 from public.chat_characters where workspace_id=target_workspace_id and id=target_character_id and status='active' and revision=target_character_revision for update;
 if not found then raise exception 'current_fact_revision' using errcode='40001'; end if;
 perform 1 from public.chat_character_fans where workspace_id=target_workspace_id and character_id=target_character_id and id=target_fan_id and status='active' and revision=target_fan_revision for update;
 if not found then raise exception 'current_fact_revision' using errcode='40001'; end if;
 perform 1 from public.chat_character_conversations where workspace_id=target_workspace_id and character_id=target_character_id and fan_id=target_fan_id and id=target_conversation_id for update;
 if not found then raise exception 'current_fact_source' using errcode='42501'; end if;
 select * into message from public.chat_character_messages where workspace_id=target_workspace_id and character_id=target_character_id and fan_id=target_fan_id and conversation_id=target_conversation_id and generation_id=target_generation_id and direction='fan_inbound' for share;
 if not found or message.sequence<=0 or (select count(*) from public.chat_character_messages where workspace_id=target_workspace_id and character_id=target_character_id and fan_id=target_fan_id and conversation_id=target_conversation_id and generation_id=target_generation_id)<>4
  or (select count(*) from public.chat_character_messages where workspace_id=target_workspace_id and character_id=target_character_id and fan_id=target_fan_id and conversation_id=target_conversation_id and generation_id=target_generation_id and direction='suggested_reply')<>3
 then raise exception 'current_fact_source' using errcode='42501'; end if;
 -- Preserve the existing conservative legacy ordering cutoff during dual read.
 select notes into raw_notes from public.chat_character_fans where id=target_fan_id and workspace_id=target_workspace_id and character_id=target_character_id;
 if strpos(raw_notes,E'\n\n[FanMind-Kontaktwissen v1]\n')>0 then
  begin
   legacy:=(regexp_split_to_array(raw_notes,E'\n\n\\[FanMind-Kontaktwissen v1\\]\n'))[array_length(regexp_split_to_array(raw_notes,E'\n\n\\[FanMind-Kontaktwissen v1\\]\n'),1)]::jsonb;
   if legacy->>'version'='1' and jsonb_typeof(legacy->'facts')='array' and jsonb_array_length(legacy->'facts')<=8 then
    select coalesce(max(case when (f->>'source_sequence')~'^[0-9]{1,16}$' and (f->>'source_sequence')::numeric between 1 and 9007199254740991 then (f->>'source_sequence')::bigint else 0 end),0) into legacy_cutoff from jsonb_array_elements(legacy->'facts') f;
   end if;
  exception when invalid_text_representation then legacy_cutoff:=0;
  end;
 end if;
 if message.sequence<=legacy_cutoff then return false; end if;
 for candidate in select * from fanmind_chat_knowledge.source_interests(message.content) loop
  select * into old from public.chat_character_current_facts where workspace_id=target_workspace_id and character_id=target_character_id and fan_id=target_fan_id and topic=candidate.topic;
  if found then
   if old.source_sequence>message.sequence then continue; end if;
   if old.source_sequence=message.sequence then
    if old.source_message_id=message.id and old.quote=candidate.quote and old.polarity=candidate.polarity and old.source_statement_index=candidate.source_statement_index then continue; end if;
    raise exception 'current_fact_order_conflict' using errcode='40001';
   end if;
  end if;
  insert into public.chat_character_current_facts values(target_workspace_id,target_character_id,target_fan_id,candidate.topic,candidate.polarity,candidate.quote,target_conversation_id,message.id,message.sequence,candidate.source_statement_index)
   on conflict(workspace_id,character_id,fan_id,topic) do update set polarity=excluded.polarity,quote=excluded.quote,conversation_id=excluded.conversation_id,source_message_id=excluded.source_message_id,source_sequence=excluded.source_sequence,source_statement_index=excluded.source_statement_index;
  changed:=true;
 end loop;
 if changed then update public.chat_character_fans set current_facts_version=1,revision=revision+1,updated_at=now() where workspace_id=target_workspace_id and character_id=target_character_id and id=target_fan_id; end if;
 return changed;
end $fn$;
create function public.apply_chat_admin_current_interests(target_workspace_id uuid,target_character_id uuid,target_fan_id uuid,target_conversation_id uuid,target_character_revision integer,target_fan_revision integer,target_generation_id uuid)
 returns boolean language sql security invoker set search_path='' as $fn$
 select fanmind_chat_knowledge.apply_generation(target_workspace_id,target_character_id,target_fan_id,target_conversation_id,target_character_revision,target_fan_revision,target_generation_id)
$fn$;
-- Referenced source contents/direction/generation cannot mutate behind a fact.
create function fanmind_chat_knowledge.guard_source() returns trigger language plpgsql security definer set search_path='' as $fn$
begin
 if row(new.content,new.direction,new.generation_id) is distinct from row(old.content,old.direction,old.generation_id)
 and exists(select 1 from public.chat_character_current_facts where source_message_id=old.id)
 then raise exception 'current_fact_source_immutable' using errcode='23514'; end if;
 return new;
end $fn$;
create function fanmind_chat_knowledge.guard_authority_marker() returns trigger language plpgsql security definer set search_path='' as $fn$
begin
 if old.current_facts_version=1 and new.current_facts_version<>1 then raise exception 'current_fact_authority_immutable' using errcode='23514'; end if;
 if old.current_facts_version=0 and new.current_facts_version=1 and not exists(select 1 from public.chat_character_current_facts where workspace_id=new.workspace_id and character_id=new.character_id and fan_id=new.id) then raise exception 'current_fact_authority_invalid' using errcode='23514'; end if;
 return new;
end $fn$;
create trigger chat_current_fact_authority_immutable before update on public.chat_character_fans for each row execute function fanmind_chat_knowledge.guard_authority_marker();
create index chat_current_fact_source_lookup on public.chat_character_current_facts(source_message_id);
create trigger chat_current_fact_source_immutable before update on public.chat_character_messages for each row execute function fanmind_chat_knowledge.guard_source();
revoke all on all functions in schema fanmind_chat_knowledge from public,anon,authenticated,service_role;
grant execute on function fanmind_chat_knowledge.apply_generation(uuid,uuid,uuid,uuid,integer,integer,uuid) to authenticated;
revoke all on function public.apply_chat_admin_current_interests(uuid,uuid,uuid,uuid,integer,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.apply_chat_admin_current_interests(uuid,uuid,uuid,uuid,integer,integer,uuid) to authenticated;
commit;
