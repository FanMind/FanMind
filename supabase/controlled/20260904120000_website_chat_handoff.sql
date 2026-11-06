begin;

-- CONTROLLED / DORMANT BY DEFAULT
-- A normal deploy, Supabase migration push or application start must never
-- apply this file. It adds no worker, timer, provider request or email send.

create extension if not exists pgcrypto;

do $preflight$
begin
  if current_user <> 'postgres'
     or to_regclass('public.website_chat_installations') is null
     or to_regclass('public.website_chat_allowed_origins') is null
     or to_regclass('public.website_chat_visitor_sessions') is null
     or to_regclass('public.website_chat_message_receipts') is null
     or to_regclass('public.contacts') is null
     or to_regclass('public.conversations') is null
     or to_regclass('public.conversation_messages') is null
     or to_regclass('public.workspaces') is null
     or to_regprocedure(
       'public.ingest_website_chat_message(uuid,text,text,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)'
     ) is null then
    raise exception 'website_chat_handoff_prerequisite_missing';
  end if;
end
$preflight$;

create table if not exists public.website_chat_handoffs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.website_chat_visitor_sessions(id) on delete cascade,
  installation_id uuid not null
    references public.website_chat_installations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_handoff_id uuid not null,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  note_message_id uuid not null
    references public.conversation_messages(id) on delete cascade,
  visitor_email_fingerprint text not null,
  consent_version text not null,
  consent_purpose text not null default 'human_reply_by_email',
  consent_granted_at timestamptz not null,
  status text not null default 'requested',
  expires_at timestamptz not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint website_chat_handoffs_one_per_session unique (session_id),
  constraint website_chat_handoffs_client_id_unique
    unique (session_id, client_handoff_id),
  constraint website_chat_handoffs_email_fingerprint_check check (
    visitor_email_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  constraint website_chat_handoffs_consent_version_check check (
    char_length(consent_version) between 1 and 80
  ),
  constraint website_chat_handoffs_consent_purpose_check check (
    consent_purpose = 'human_reply_by_email'
  ),
  constraint website_chat_handoffs_status_check check (
    status in ('requested', 'resolved', 'expired')
  ),
  constraint website_chat_handoffs_expiry_check check (
    expires_at > consent_granted_at
    and expires_at <= consent_granted_at + interval '90 days'
  )
);

create index if not exists website_chat_handoffs_workspace_status_created_idx
  on public.website_chat_handoffs (workspace_id, status, created_at desc);
create index if not exists website_chat_handoffs_expiry_idx
  on public.website_chat_handoffs (expires_at, id);

alter table public.website_chat_handoffs enable row level security;
revoke all on table public.website_chat_handoffs
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.website_chat_handoffs
  to service_role;

create or replace function public.website_chat_processing_allowed(
  p_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
set row_security = on
as $function$
  select coalesce((
    select public.workspace_processing_allowed_contract(
      workspace.workspace_access_mode,
      workspace.subscription_effective_end_at::text,
      workspace.billing_status,
      workspace.billing_manual_override,
      workspace.billing_grace_until::text,
      workspace.billing_suspended_at::text,
      workspace.test_access_flags,
      statement_timestamp()
    )
      from public.workspaces as workspace
     where workspace.id = p_workspace_id
  ), false);
$function$;

revoke all on function public.website_chat_processing_allowed(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.website_chat_processing_allowed(uuid)
  to service_role;

-- The application switches to the v2 name only after this controlled schema
-- exists. The legacy service-role RPC is revoked to prevent a processing-gate
-- bypass after the controlled cutover.
revoke execute on function public.ingest_website_chat_message(
  uuid, text, text, uuid, text
) from service_role;

create or replace function public.ingest_website_chat_message_v2(
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
as $function$
declare
  v_now timestamptz := statement_timestamp();
  v_session record;
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

  select session.*
    into v_session
    from public.website_chat_visitor_sessions as session
    join public.website_chat_installations as installation
      on installation.id = session.installation_id
     and installation.workspace_id = session.workspace_id
     and installation.enabled = true
    join public.website_chat_allowed_origins as allowed_origin
      on allowed_origin.installation_id = session.installation_id
     and allowed_origin.workspace_id = session.workspace_id
     and allowed_origin.origin = session.origin
     and allowed_origin.verified_at is not null
   where installation.public_installation_id = p_public_installation_id
     and session.origin = p_origin
     and session.visitor_subject_hash = p_visitor_subject_hash
     and session.revoked_at is null
     and session.expires_at > v_now
     and public.website_chat_processing_allowed(session.workspace_id)
   for update of session;

  if not found then
    return query select false, false, null::uuid, null::uuid;
    return;
  end if;

  select receipt.*
    into v_receipt
    from public.website_chat_message_receipts as receipt
   where receipt.session_id = v_session.id
     and receipt.client_message_id = p_client_message_id;

  if found then
    return query
      select true, true, v_receipt.conversation_id, v_receipt.message_id;
    return;
  end if;

  select receipt.contact_id, receipt.conversation_id
    into v_contact_id, v_conversation_id
    from public.website_chat_message_receipts as receipt
   where receipt.session_id = v_session.id
   order by receipt.created_at asc
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
      workspace_id, contact_id, status, priority, source_platform,
      source_type, source_url, reply_target_url, last_inbound_at,
      last_message_preview, ai_status, next_step
    ) values (
      v_session.workspace_id, v_contact_id, 'open', 'normal',
      'website-chat', 'form', p_origin, p_origin, v_now,
      left(btrim(p_content), 240), 'not_ready', 'Antwort vorbereiten'
    )
    returning id into v_conversation_id;
  end if;

  insert into public.conversation_messages (
    workspace_id, conversation_id, contact_id, direction, message_type,
    source_platform, source_type, source_url, reply_target_url,
    external_message_id, author_label, original_author_label,
    original_text_excerpt, content, created_at
  ) values (
    v_session.workspace_id, v_conversation_id, v_contact_id, 'inbound',
    'form', 'website-chat', 'form', p_origin, p_origin,
    p_client_message_id::text, 'Website-Besucher', 'Website-Besucher',
    left(btrim(p_content), 280), btrim(p_content), v_now
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
    session_id, installation_id, workspace_id, client_message_id,
    contact_id, conversation_id, message_id, created_at
  ) values (
    v_session.id, v_session.installation_id, v_session.workspace_id,
    p_client_message_id, v_contact_id, v_conversation_id, v_message_id, v_now
  );

  update public.website_chat_visitor_sessions
     set last_seen_at = v_now
   where id = v_session.id;

  return query select true, false, v_conversation_id, v_message_id;
end;
$function$;

revoke all on function public.ingest_website_chat_message_v2(
  uuid, text, text, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.ingest_website_chat_message_v2(
  uuid, text, text, uuid, text
) to service_role;

create or replace function public.request_website_chat_handoff(
  p_public_installation_id uuid,
  p_origin text,
  p_visitor_subject_hash text,
  p_client_handoff_id uuid,
  p_email text,
  p_consent_version text
)
returns table (
  accepted boolean,
  duplicate boolean,
  conversation_id uuid,
  handoff_id uuid
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_now timestamptz := statement_timestamp();
  v_session record;
  v_existing public.website_chat_handoffs%rowtype;
  v_contact_id uuid;
  v_conversation_id uuid;
  v_note_message_id uuid;
  v_handoff_id uuid;
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if p_origin is null
     or p_visitor_subject_hash !~ '^[0-9a-f]{64}$'
     or p_client_handoff_id is null
     or p_email is distinct from v_email
     or char_length(v_email) not between 3 and 254
     or v_email ~ '[[:space:]]'
     or v_email !~ '^[^@]+@[^@]+[.][^@]+$'
     or p_consent_version is null
     or char_length(p_consent_version) not between 1 and 80 then
    return query select false, false, null::uuid, null::uuid;
    return;
  end if;

  select session.*, installation.message_retention_days
    into v_session
    from public.website_chat_visitor_sessions as session
    join public.website_chat_installations as installation
      on installation.id = session.installation_id
     and installation.workspace_id = session.workspace_id
     and installation.enabled = true
     and installation.consent_version = p_consent_version
    join public.website_chat_allowed_origins as allowed_origin
      on allowed_origin.installation_id = session.installation_id
     and allowed_origin.workspace_id = session.workspace_id
     and allowed_origin.origin = session.origin
     and allowed_origin.verified_at is not null
   where installation.public_installation_id = p_public_installation_id
     and session.origin = p_origin
     and session.visitor_subject_hash = p_visitor_subject_hash
     and session.consent_version = p_consent_version
     and session.revoked_at is null
     and session.expires_at > v_now
     and public.website_chat_processing_allowed(session.workspace_id)
   for update of session;

  if not found then
    return query select false, false, null::uuid, null::uuid;
    return;
  end if;

  select handoff.*
    into v_existing
    from public.website_chat_handoffs as handoff
   where handoff.session_id = v_session.id;
  if found then
    return query
      select true, true, v_existing.conversation_id, v_existing.id;
    return;
  end if;

  select receipt.contact_id, receipt.conversation_id
    into v_contact_id, v_conversation_id
    from public.website_chat_message_receipts as receipt
   where receipt.session_id = v_session.id
   order by receipt.created_at asc
   limit 1;
  if v_contact_id is null or v_conversation_id is null then
    return query select false, false, null::uuid, null::uuid;
    return;
  end if;

  insert into public.conversation_messages (
    workspace_id, conversation_id, contact_id, direction, message_type,
    source_platform, source_type, source_url, external_message_id,
    author_label, content, created_at
  ) values (
    v_session.workspace_id, v_conversation_id, v_contact_id, 'note', 'note',
    'website-chat', 'form', p_origin, p_client_handoff_id::text,
    'FanMind Website-Assistent',
    'Besucher bittet um eine persönliche Antwort per E-Mail.', v_now
  )
  returning id into v_note_message_id;

  update public.contacts
     set handle = v_email,
         tags = array(
           select distinct tag
             from unnest(coalesce(tags, '{}'::text[]) ||
                         array['website-chat', 'website-chat-handoff']) as tag
         )
   where id = v_contact_id
     and workspace_id = v_session.workspace_id
     and source_platform = 'website-chat';
  if not found then
    raise exception 'website_chat_handoff_contact_update_failed';
  end if;

  update public.conversations
     set status = 'open',
         priority = 'high',
         ai_status = 'partial',
         next_step = 'Persönlich per E-Mail antworten'
   where id = v_conversation_id
     and workspace_id = v_session.workspace_id
     and contact_id = v_contact_id;
  if not found then
    raise exception 'website_chat_handoff_conversation_update_failed';
  end if;

  insert into public.website_chat_handoffs (
    session_id, installation_id, workspace_id, client_handoff_id,
    contact_id, conversation_id, note_message_id, visitor_email_fingerprint,
    consent_version, consent_purpose, consent_granted_at, status,
    expires_at, created_at
  ) values (
    v_session.id, v_session.installation_id, v_session.workspace_id,
    p_client_handoff_id, v_contact_id, v_conversation_id, v_note_message_id,
    encode(extensions.digest(convert_to(v_email, 'UTF8'), 'sha256'), 'hex'),
    p_consent_version, 'human_reply_by_email', v_now, 'requested',
    v_now + make_interval(
      days => least(v_session.message_retention_days, 90)
    ), v_now
  )
  returning id into v_handoff_id;

  update public.website_chat_visitor_sessions
     set last_seen_at = v_now
   where id = v_session.id;

  return query select true, false, v_conversation_id, v_handoff_id;
end;
$function$;

revoke all on function public.request_website_chat_handoff(
  uuid, text, text, uuid, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.request_website_chat_handoff(
  uuid, text, text, uuid, text, text
) to service_role;

comment on table public.website_chat_handoffs is
  'Consent evidence, email fingerprint and CRM linkage for one manual reply request per visitor session. No delivery state implies an email was sent.';
comment on function public.website_chat_processing_allowed(uuid) is
  'Service-role-only security-definer adapter to the canonical Workspace processing contract.';
comment on function public.ingest_website_chat_message_v2(uuid, text, text, uuid, text) is
  'Service-role-only Website Chat ingestion with atomic session, origin and Workspace processing revalidation.';
comment on function public.request_website_chat_handoff(uuid, text, text, uuid, text, text) is
  'Service-role-only consent-bound CRM handoff. It records no outbound email and invokes no provider.';

do $postflight$
declare
  handoff_table oid := to_regclass('public.website_chat_handoffs');
  processing_function oid := to_regprocedure(
    'public.website_chat_processing_allowed(uuid)'
  );
  message_function oid := to_regprocedure(
    'public.ingest_website_chat_message_v2(uuid,text,text,uuid,text)'
  );
  handoff_function oid := to_regprocedure(
    'public.request_website_chat_handoff(uuid,text,text,uuid,text,text)'
  );
begin
  if handoff_table is null
     or not exists (
       select 1 from pg_class
        where oid = handoff_table and relkind = 'r' and relrowsecurity
     )
     or exists (
       select 1 from pg_policies
        where schemaname = 'public' and tablename = 'website_chat_handoffs'
     )
     or exists (
       select 1
         from pg_class as relation,
              lateral aclexplode(
                coalesce(relation.relacl, acldefault('r', relation.relowner))
              ) as acl
        where relation.oid = handoff_table
          and acl.grantee = 0
          and acl.privilege_type in (
            'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'
          )
     )
     or has_table_privilege(
       'anon', handoff_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
     )
     or has_table_privilege(
       'authenticated', handoff_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'
     )
     or not has_table_privilege('service_role', handoff_table, 'SELECT')
     or not has_table_privilege('service_role', handoff_table, 'INSERT')
     or not has_table_privilege('service_role', handoff_table, 'UPDATE')
     or not has_table_privilege('service_role', handoff_table, 'DELETE')
     or has_table_privilege('service_role', handoff_table, 'TRUNCATE') then
    raise exception 'website_chat_handoff_table_postflight_failed';
  end if;

  if processing_function is null
     or message_function is null
     or handoff_function is null
     or not exists (
       select 1 from pg_proc
        where oid = processing_function
          and prosecdef
          and proconfig = array[
            'search_path=pg_catalog, public, pg_temp',
            'row_security=on'
          ]::text[]
     )
     or exists (
       select 1 from pg_proc
        where oid in (message_function, handoff_function)
          and (prosecdef or proconfig <> array['search_path=public, pg_temp']::text[])
     ) then
    raise exception 'website_chat_handoff_function_shape_postflight_failed';
  end if;

  if has_function_privilege(
       'anon', processing_function, 'EXECUTE'
     )
     or has_function_privilege(
       'authenticated', processing_function, 'EXECUTE'
     )
     or not has_function_privilege(
       'service_role', processing_function, 'EXECUTE'
     )
     or has_function_privilege('anon', message_function, 'EXECUTE')
     or has_function_privilege('authenticated', message_function, 'EXECUTE')
     or not has_function_privilege('service_role', message_function, 'EXECUTE')
     or has_function_privilege('anon', handoff_function, 'EXECUTE')
     or has_function_privilege('authenticated', handoff_function, 'EXECUTE')
     or not has_function_privilege('service_role', handoff_function, 'EXECUTE')
     or has_function_privilege(
       'service_role',
       'public.ingest_website_chat_message(uuid,text,text,uuid,text)',
       'EXECUTE'
     ) then
    raise exception 'website_chat_handoff_function_acl_postflight_failed';
  end if;
end
$postflight$;

commit;
