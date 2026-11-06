-- Transactional, idempotent Website Chat ingestion into the existing CRM
-- inbox. The function is SECURITY INVOKER and callable only by service_role.
-- It creates inbound messages only; no AI request or outbound delivery exists.

begin;

create table if not exists public.website_chat_message_receipts (
  session_id uuid not null
    references public.website_chat_visitor_sessions(id) on delete cascade,
  installation_id uuid not null
    references public.website_chat_installations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_message_id uuid not null,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.conversation_messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (session_id, client_message_id),
  unique (message_id)
);

create index if not exists website_chat_receipts_workspace_created_idx
  on public.website_chat_message_receipts (workspace_id, created_at desc);

alter table public.website_chat_message_receipts enable row level security;
revoke all on table public.website_chat_message_receipts
  from public, anon, authenticated;
grant select, insert, update, delete on table public.website_chat_message_receipts
  to service_role;

create or replace function public.ingest_website_chat_message(
  p_public_installation_id uuid,
  p_origin text,
  p_visitor_subject_hash text,
  p_client_message_id uuid,
  p_content text
)
returns table (
  accepted boolean,
  duplicate boolean,
  conversation_id uuid,
  message_id uuid
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_session public.website_chat_visitor_sessions%rowtype;
  v_receipt public.website_chat_message_receipts%rowtype;
  v_contact_id uuid;
  v_conversation_id uuid;
  v_message_id uuid;
begin
  if p_origin is null
    or p_visitor_subject_hash !~ '^[0-9a-f]{64}$'
    or p_content is null
    or char_length(btrim(p_content)) < 1
    or char_length(p_content) > 4000
  then
    return query select false, false, null::uuid, null::uuid;
    return;
  end if;

  select s.*
    into v_session
    from public.website_chat_visitor_sessions s
    join public.website_chat_installations i
      on i.id = s.installation_id
     and i.workspace_id = s.workspace_id
     and i.enabled = true
    join public.website_chat_allowed_origins o
      on o.installation_id = s.installation_id
     and o.workspace_id = s.workspace_id
     and o.origin = s.origin
     and o.verified_at is not null
   where i.public_installation_id = p_public_installation_id
     and s.origin = p_origin
     and s.visitor_subject_hash = p_visitor_subject_hash
     and s.revoked_at is null
     and s.expires_at > v_now
   for update of s;

  if not found then
    return query select false, false, null::uuid, null::uuid;
    return;
  end if;

  select r.*
    into v_receipt
    from public.website_chat_message_receipts r
   where r.session_id = v_session.id
     and r.client_message_id = p_client_message_id;

  if found then
    return query
      select true, true, v_receipt.conversation_id, v_receipt.message_id;
    return;
  end if;

  select r.contact_id, r.conversation_id
    into v_contact_id, v_conversation_id
    from public.website_chat_message_receipts r
   where r.session_id = v_session.id
   order by r.created_at asc
   limit 1;

  if v_contact_id is null then
    insert into public.contacts (
      workspace_id, display_name, source_platform, language, status, tags
    ) values (
      v_session.workspace_id,
      'Website-Besucher',
      'website-chat',
      'de',
      'new',
      array['website-chat']::text[]
    )
    returning id into v_contact_id;
  end if;

  if v_conversation_id is null then
    insert into public.conversations (
      workspace_id,
      contact_id,
      status,
      priority,
      source_platform,
      source_type,
      source_url,
      reply_target_url,
      last_inbound_at,
      last_message_preview,
      ai_status,
      next_step
    ) values (
      v_session.workspace_id,
      v_contact_id,
      'open',
      'normal',
      'website-chat',
      'form',
      p_origin,
      p_origin,
      v_now,
      left(btrim(p_content), 240),
      'not_ready',
      'Antwort vorbereiten'
    )
    returning id into v_conversation_id;
  end if;

  insert into public.conversation_messages (
    workspace_id,
    conversation_id,
    contact_id,
    direction,
    message_type,
    source_platform,
    source_type,
    source_url,
    reply_target_url,
    external_message_id,
    author_label,
    original_author_label,
    original_text_excerpt,
    content,
    created_at
  ) values (
    v_session.workspace_id,
    v_conversation_id,
    v_contact_id,
    'inbound',
    'form',
    'website-chat',
    'form',
    p_origin,
    p_origin,
    p_client_message_id::text,
    'Website-Besucher',
    'Website-Besucher',
    left(btrim(p_content), 280),
    btrim(p_content),
    v_now
  )
  returning id into v_message_id;

  update public.conversations
     set status = 'open',
         source_platform = 'website-chat',
         source_type = 'form',
         source_url = p_origin,
         reply_target_url = p_origin,
         external_message_id = p_client_message_id::text,
         last_inbound_at = v_now,
         last_message_preview = left(btrim(p_content), 240),
         next_step = 'Antwort vorbereiten'
   where id = v_conversation_id
     and workspace_id = v_session.workspace_id;

  insert into public.website_chat_message_receipts (
    session_id,
    installation_id,
    workspace_id,
    client_message_id,
    contact_id,
    conversation_id,
    message_id,
    created_at
  ) values (
    v_session.id,
    v_session.installation_id,
    v_session.workspace_id,
    p_client_message_id,
    v_contact_id,
    v_conversation_id,
    v_message_id,
    v_now
  );

  update public.website_chat_visitor_sessions
     set last_seen_at = v_now
   where id = v_session.id;

  return query select true, false, v_conversation_id, v_message_id;
end;
$$;

revoke all on function public.ingest_website_chat_message(uuid, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.ingest_website_chat_message(uuid, text, text, uuid, text)
  to service_role;

comment on table public.website_chat_message_receipts is
  'Content-free idempotency and CRM linkage for consented Website Chat inbound messages.';
comment on function public.ingest_website_chat_message(uuid, text, text, uuid, text) is
  'Service-role-only SECURITY INVOKER ingestion. Creates inbound CRM records and never sends or invokes AI.';

commit;
