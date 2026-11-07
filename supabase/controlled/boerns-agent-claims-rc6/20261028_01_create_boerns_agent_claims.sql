-- BOERNS-CLAIM-SUPABASE-001 / Revision 16 / RC6
-- Draft only. Target: FanMind Supabase project drqkpdvtbbrrdwmtrodz (PostgreSQL 17).
-- This file has not been applied to FanMind. Production execution requires a separate Owner gate.

begin;

do $preflight$
begin
  if current_setting('server_version_num')::integer < 170000
     or current_setting('server_version_num')::integer >= 180000 then
    raise exception 'boerns_agent_claims RC6 requires PostgreSQL 17.x';
  end if;

  if to_regnamespace('boerns_agent_claims') is not null then
    raise exception 'schema boerns_agent_claims already exists; refusing non-versioned overwrite';
  end if;

  if exists (
    select 1 from pg_roles
     where rolname in ('boerns_claims_owner', 'boerns_claims_runtime')
  ) then
    raise exception 'one or more boerns claim roles already exist; refusing ambiguous ownership';
  end if;
  if exists (
    select required_role
      from unnest(array['anon', 'authenticated', 'service_role']) required_role
     where not exists (select 1 from pg_roles where rolname = required_role)
  ) then
    raise exception 'required Supabase application roles are missing';
  end if;
end
$preflight$;

create role boerns_claims_owner
  nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
create role boerns_claims_runtime
  nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;

create schema boerns_agent_claims authorization boerns_claims_owner;
revoke all on schema boerns_agent_claims from public;
revoke all on schema boerns_agent_claims from anon, authenticated, service_role;

grant boerns_claims_owner to current_user;
set local role boerns_claims_owner;

alter default privileges in schema boerns_agent_claims
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges in schema boerns_agent_claims
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema boerns_agent_claims
  revoke all on sequences from public, anon, authenticated, service_role;

create sequence boerns_agent_claims.fencing_token_seq
  as bigint
  minvalue 1
  start with 1
  increment by 1
  no cycle;

create table boerns_agent_claims.control_state (
  singleton boolean primary key default true check (singleton),
  service_enabled boolean not null default false,
  fence_epoch uuid not null default gen_random_uuid(),
  changed_at timestamptz not null default transaction_timestamp(),
  change_reason text not null default 'INITIAL_DISABLED'
    check (change_reason ~ '^[A-Z0-9_.:-]{1,64}$')
);

insert into boerns_agent_claims.control_state
  (singleton, service_enabled, change_reason)
values
  (true, false, 'INITIAL_DISABLED');

create table boerns_agent_claims.principals (
  agent_id text primary key
    check (agent_id ~ '^BT-[0-9]{3}$'),
  auth_issuer text not null
    check (char_length(auth_issuer) between 1 and 256),
  auth_subject text not null
    check (char_length(auth_subject) between 1 and 256),
  enabled boolean not null default false,
  can_offer boolean not null default false,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  unique (auth_issuer, auth_subject)
);

create table boerns_agent_claims.claims (
  claim_id uuid primary key default gen_random_uuid(),
  task_id text not null
    check (task_id ~ '^[A-Za-z0-9._-]{1,128}$'),
  step_id text not null
    check (step_id ~ '^[A-Za-z0-9._-]{1,128}$'),
  revision bigint not null check (revision >= 0),
  claim_key text generated always as
    (task_id || ':' || step_id || ':' || revision::text) stored,
  intended_agent_id text not null
    references boerns_agent_claims.principals(agent_id),
  state text not null default 'OFFERED'
    check (state in ('OFFERED', 'CLAIMED', 'COMPLETED')),
  holder_agent_id text null
    references boerns_agent_claims.principals(agent_id),
  lease_expires_at timestamptz null,
  fence_epoch uuid null,
  fence_token bigint null check (fence_token is null or fence_token > 0),
  completion_id uuid null,
  terminal_status text null
    check (terminal_status is null or terminal_status in ('SUCCEEDED', 'FAILED', 'BLOCKED')),
  evidence_ref text null
    check (
      evidence_ref is null
      or evidence_ref ~ '^[A-Za-z][A-Za-z0-9_-]{1,31}:[A-Za-z0-9._/-]{1,223}$'
    ),
  evidence_sha256 text null
    check (evidence_sha256 is null or evidence_sha256 ~ '^[0-9a-f]{64}$'),
  offered_by_agent_id text not null
    references boerns_agent_claims.principals(agent_id),
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  completed_at timestamptz null,
  unique (task_id, step_id, revision),
  check ((evidence_ref is null) = (evidence_sha256 is null)),
  check (
    (state = 'OFFERED'
      and holder_agent_id is null
      and lease_expires_at is null
      and fence_epoch is null
      and fence_token is null
      and completion_id is null
      and terminal_status is null
      and completed_at is null)
    or
    (state = 'CLAIMED'
      and holder_agent_id is not null
      and lease_expires_at is not null
      and fence_epoch is not null
      and fence_token is not null
      and completion_id is null
      and terminal_status is null
      and completed_at is null)
    or
    (state = 'COMPLETED'
      and holder_agent_id is not null
      and lease_expires_at is null
      and fence_epoch is not null
      and fence_token is not null
      and completion_id is not null
      and terminal_status is not null
      and completed_at is not null)
  )
);

create index claims_recovery_idx
  on boerns_agent_claims.claims (lease_expires_at, claim_id)
  where state = 'CLAIMED';

create index claims_intended_agent_idx
  on boerns_agent_claims.claims (intended_agent_id, state, created_at);

create table boerns_agent_claims.request_receipts (
  actor_agent_id text not null
    references boerns_agent_claims.principals(agent_id),
  request_id uuid not null,
  operation text not null
    check (operation in ('OFFER', 'ACQUIRE', 'RENEW', 'COMPLETE')),
  system_epoch uuid not null,
  fingerprint jsonb not null check (jsonb_typeof(fingerprint) = 'object'),
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default transaction_timestamp(),
  primary key (actor_agent_id, request_id)
);

create table boerns_agent_claims.audit_events (
  event_id bigint generated always as identity primary key,
  claim_id uuid null,
  claim_key text null,
  event_type text not null
    check (event_type in (
      'OFFERED', 'ACQUIRED', 'ACQUIRE_OBSERVED', 'RENEWED',
      'RECOVERED', 'COMPLETED', 'EPOCH_ROTATED'
    )),
  actor_agent_id text null,
  request_id uuid null,
  fence_epoch uuid null,
  fence_token bigint null,
  database_role text not null default session_user,
  occurred_at timestamptz not null default clock_timestamp(),
  details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object')
);

create index audit_events_claim_idx
  on boerns_agent_claims.audit_events (claim_id, event_id);

create index audit_events_request_idx
  on boerns_agent_claims.audit_events (request_id)
  where request_id is not null;

alter table boerns_agent_claims.control_state enable row level security;
alter table boerns_agent_claims.control_state force row level security;
alter table boerns_agent_claims.principals enable row level security;
alter table boerns_agent_claims.principals force row level security;
alter table boerns_agent_claims.claims enable row level security;
alter table boerns_agent_claims.claims force row level security;
alter table boerns_agent_claims.request_receipts enable row level security;
alter table boerns_agent_claims.request_receipts force row level security;
alter table boerns_agent_claims.audit_events enable row level security;
alter table boerns_agent_claims.audit_events force row level security;

create policy owner_control_state on boerns_agent_claims.control_state
  for all to boerns_claims_owner using (true) with check (true);
create policy owner_principals on boerns_agent_claims.principals
  for all to boerns_claims_owner using (true) with check (true);
create policy owner_claims on boerns_agent_claims.claims
  for all to boerns_claims_owner using (true) with check (true);
create policy owner_request_receipts on boerns_agent_claims.request_receipts
  for all to boerns_claims_owner using (true) with check (true);
create policy owner_audit_events on boerns_agent_claims.audit_events
  for all to boerns_claims_owner using (true) with check (true);

revoke all on all tables in schema boerns_agent_claims from public;
revoke all on all sequences in schema boerns_agent_claims from public;
revoke all on all tables in schema boerns_agent_claims from anon, authenticated, service_role;
revoke all on all sequences in schema boerns_agent_claims from anon, authenticated, service_role;

create function boerns_agent_claims.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55000';
end
$function$;

create trigger request_receipts_append_only
before update or delete on boerns_agent_claims.request_receipts
for each row execute function boerns_agent_claims.forbid_mutation();

create trigger request_receipts_no_truncate
before truncate on boerns_agent_claims.request_receipts
for each statement execute function boerns_agent_claims.forbid_mutation();

create trigger audit_events_append_only
before update or delete on boerns_agent_claims.audit_events
for each row execute function boerns_agent_claims.forbid_mutation();

create trigger audit_events_no_truncate
before truncate on boerns_agent_claims.audit_events
for each statement execute function boerns_agent_claims.forbid_mutation();

create function boerns_agent_claims.lock_service_gate()
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_enabled boolean;
  v_epoch uuid;
begin
  select service_enabled, fence_epoch
    into v_enabled, v_epoch
    from boerns_agent_claims.control_state
   where singleton
   for share;

  if coalesce(v_enabled, false) is not true then
    raise exception 'claim service is disabled' using errcode = 'BC006';
  end if;
  return v_epoch;
end
$function$;

create function boerns_agent_claims.current_agent(
  p_auth_issuer text,
  p_auth_subject text
)
returns text
language plpgsql
security definer
stable
set search_path = ''
as $function$
declare
  v_agent_id text;
begin
  if p_auth_issuer is null or char_length(p_auth_issuer) not between 1 and 256
     or p_auth_subject is null or char_length(p_auth_subject) not between 1 and 256 then
    raise exception 'missing or invalid verified workload identity' using errcode = 'BC002';
  end if;

  select agent_id
    into v_agent_id
    from boerns_agent_claims.principals
   where auth_issuer = p_auth_issuer
     and auth_subject = p_auth_subject
     and enabled;

  if v_agent_id is null then
    raise exception 'subject is not an enabled claim principal' using errcode = 'BC002';
  end if;

  return v_agent_id;
end
$function$;

create function boerns_agent_claims.request_replay(
  p_actor_agent_id text,
  p_request_id uuid,
  p_operation text,
  p_fingerprint jsonb,
  p_system_epoch uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_receipt boerns_agent_claims.request_receipts%rowtype;
begin
  if p_request_id is null then
    raise exception 'request_id is required' using errcode = 'BC001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_actor_agent_id || ':' || p_request_id::text, 0)
  );

  select *
    into v_receipt
    from boerns_agent_claims.request_receipts
   where actor_agent_id = p_actor_agent_id
     and request_id = p_request_id;

  if found then
    if v_receipt.system_epoch is distinct from p_system_epoch then
      raise exception 'request receipt belongs to a stale epoch' using errcode = 'BC005';
    end if;
    if v_receipt.operation <> p_operation or v_receipt.fingerprint <> p_fingerprint then
      raise exception 'request_id reuse with a different operation or payload'
        using errcode = 'BC004';
    end if;
    return v_receipt.response || jsonb_build_object('replayed', true);
  end if;

  return null;
end
$function$;

create function boerns_agent_claims.record_request(
  p_actor_agent_id text,
  p_request_id uuid,
  p_operation text,
  p_system_epoch uuid,
  p_fingerprint jsonb,
  p_response jsonb
)
returns void
language sql
security definer
set search_path = ''
as $function$
  insert into boerns_agent_claims.request_receipts
    (actor_agent_id, request_id, operation, system_epoch, fingerprint, response)
  values
    (p_actor_agent_id, p_request_id, p_operation, p_system_epoch, p_fingerprint, p_response);
$function$;

create function boerns_agent_claims.claim_response(p_claim_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'claim_id', claim_id,
    'claim_key', claim_key,
    'task_id', task_id,
    'step_id', step_id,
    'revision', revision,
    'intended_agent_id', intended_agent_id,
    'state', state,
    'holder_agent_id', holder_agent_id,
    'lease_expires_at', lease_expires_at,
    'fence_epoch', fence_epoch,
    'fence_token', fence_token,
    'completion_id', completion_id,
    'terminal_status', terminal_status,
    'evidence_ref', evidence_ref,
    'evidence_sha256', evidence_sha256,
    'created_at', created_at,
    'updated_at', updated_at,
    'completed_at', completed_at
  )
  from boerns_agent_claims.claims
  where claim_id = p_claim_id;
$function$;

create function boerns_agent_claims.write_audit(
  p_claim_id uuid,
  p_claim_key text,
  p_event_type text,
  p_actor_agent_id text,
  p_request_id uuid,
  p_fence_epoch uuid,
  p_fence_token bigint,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $function$
  insert into boerns_agent_claims.audit_events
    (claim_id, claim_key, event_type, actor_agent_id, request_id,
     fence_epoch, fence_token, details)
  values
    (p_claim_id, p_claim_key, p_event_type, p_actor_agent_id, p_request_id,
     p_fence_epoch, p_fence_token, coalesce(p_details, '{}'::jsonb));
$function$;

create function boerns_agent_claims.offer(
  p_auth_issuer text,
  p_auth_subject text,
  p_task_id text,
  p_step_id text,
  p_revision bigint,
  p_intended_agent_id text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor text;
  v_can_offer boolean;
  v_fingerprint jsonb;
  v_replay jsonb;
  v_claim boerns_agent_claims.claims%rowtype;
  v_response jsonb;
  v_epoch uuid;
begin
  v_epoch := boerns_agent_claims.lock_service_gate();
  v_actor := boerns_agent_claims.current_agent(p_auth_issuer, p_auth_subject);

  select can_offer into v_can_offer
    from boerns_agent_claims.principals
   where agent_id = v_actor;
  if coalesce(v_can_offer, false) is not true then
    raise exception 'principal may not offer work' using errcode = 'BC008';
  end if;

  if p_task_id is null or p_task_id !~ '^[A-Za-z0-9._-]{1,128}$'
     or p_step_id is null or p_step_id !~ '^[A-Za-z0-9._-]{1,128}$'
     or p_revision is null or p_revision < 0 then
    raise exception 'invalid task key' using errcode = 'BC001';
  end if;

  if not exists (
    select 1 from boerns_agent_claims.principals
     where agent_id = p_intended_agent_id and enabled
  ) then
    raise exception 'intended agent is not enabled' using errcode = 'BC001';
  end if;

  v_fingerprint := jsonb_build_object(
    'task_id', p_task_id,
    'step_id', p_step_id,
    'revision', p_revision,
    'intended_agent_id', p_intended_agent_id
  );
  v_replay := boerns_agent_claims.request_replay(
    v_actor, p_request_id, 'OFFER', v_fingerprint, v_epoch
  );
  if v_replay is not null then return v_replay; end if;

  insert into boerns_agent_claims.claims
    (task_id, step_id, revision, intended_agent_id, offered_by_agent_id)
  values
    (p_task_id, p_step_id, p_revision, p_intended_agent_id, v_actor)
  on conflict (task_id, step_id, revision) do nothing
  returning * into v_claim;

  if found then
    perform boerns_agent_claims.write_audit(
      v_claim.claim_id, v_claim.claim_key, 'OFFERED', v_actor, p_request_id,
      null, null, jsonb_build_object('intended_agent_id', p_intended_agent_id)
    );
    v_response := boerns_agent_claims.claim_response(v_claim.claim_id)
      || jsonb_build_object('operation_status', 'OFFERED');
  else
    select * into v_claim
      from boerns_agent_claims.claims
     where task_id = p_task_id
       and step_id = p_step_id
       and revision = p_revision
     for update;

    if not found then
      raise exception 'concurrent offer status is unknown' using errcode = 'BC006';
    end if;
    if v_claim.intended_agent_id <> p_intended_agent_id then
      raise exception 'task key already offered to a different agent' using errcode = 'BC007';
    end if;
    v_response := boerns_agent_claims.claim_response(v_claim.claim_id)
      || jsonb_build_object('operation_status', 'ALREADY_EXISTS');
  end if;

  v_response := v_response || jsonb_build_object('replayed', false);
  perform boerns_agent_claims.record_request(
    v_actor, p_request_id, 'OFFER', v_epoch, v_fingerprint, v_response
  );
  return v_response;
end
$function$;

create function boerns_agent_claims.acquire(
  p_auth_issuer text,
  p_auth_subject text,
  p_task_id text,
  p_step_id text,
  p_revision bigint,
  p_request_id uuid,
  p_lease_seconds integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor text;
  v_fingerprint jsonb;
  v_replay jsonb;
  v_claim boerns_agent_claims.claims%rowtype;
  v_response jsonb;
  v_epoch uuid;
  v_token bigint;
begin
  v_epoch := boerns_agent_claims.lock_service_gate();
  v_actor := boerns_agent_claims.current_agent(p_auth_issuer, p_auth_subject);
  if p_lease_seconds is null or p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception 'lease_seconds must be between 15 and 900' using errcode = 'BC001';
  end if;
  if p_task_id is null or p_task_id !~ '^[A-Za-z0-9._-]{1,128}$'
     or p_step_id is null or p_step_id !~ '^[A-Za-z0-9._-]{1,128}$'
     or p_revision is null or p_revision < 0 then
    raise exception 'invalid task key' using errcode = 'BC001';
  end if;

  v_fingerprint := jsonb_build_object(
    'task_id', p_task_id,
    'step_id', p_step_id,
    'revision', p_revision,
    'lease_seconds', p_lease_seconds
  );
  v_replay := boerns_agent_claims.request_replay(
    v_actor, p_request_id, 'ACQUIRE', v_fingerprint, v_epoch
  );
  if v_replay is not null then return v_replay; end if;

  select * into v_claim
    from boerns_agent_claims.claims
   where task_id = p_task_id
     and step_id = p_step_id
     and revision = p_revision
   for update;
  if not found then
    raise exception 'claim not found' using errcode = 'BC003';
  end if;
  if v_claim.intended_agent_id <> v_actor then
    raise exception 'claim is intended for a different agent' using errcode = 'BC003';
  end if;

  if v_claim.state = 'OFFERED' then
    v_token := nextval('boerns_agent_claims.fencing_token_seq');

    update boerns_agent_claims.claims
       set state = 'CLAIMED',
           holder_agent_id = v_actor,
           lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
           fence_epoch = v_epoch,
           fence_token = v_token,
           updated_at = clock_timestamp()
     where claim_id = v_claim.claim_id
     returning * into v_claim;

    perform boerns_agent_claims.write_audit(
      v_claim.claim_id, v_claim.claim_key, 'ACQUIRED', v_actor, p_request_id,
      v_claim.fence_epoch, v_claim.fence_token,
      jsonb_build_object('lease_seconds', p_lease_seconds)
    );
    v_response := boerns_agent_claims.claim_response(v_claim.claim_id)
      || jsonb_build_object('operation_status', 'ACQUIRED');
  elsif v_claim.state = 'CLAIMED' then
    if v_claim.lease_expires_at <= clock_timestamp() then
      v_token := nextval('boerns_agent_claims.fencing_token_seq');

      update boerns_agent_claims.claims
         set holder_agent_id = v_actor,
             lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
             fence_epoch = v_epoch,
             fence_token = v_token,
             updated_at = clock_timestamp()
       where claim_id = v_claim.claim_id
       returning * into v_claim;

      perform boerns_agent_claims.write_audit(
        v_claim.claim_id, v_claim.claim_key, 'RECOVERED', v_actor, p_request_id,
        v_claim.fence_epoch, v_claim.fence_token,
        jsonb_build_object('lease_seconds', p_lease_seconds)
      );
      v_response := boerns_agent_claims.claim_response(v_claim.claim_id)
        || jsonb_build_object('operation_status', 'RECOVERED');
    else
      v_response := boerns_agent_claims.claim_response(v_claim.claim_id)
        || jsonb_build_object('operation_status', 'ALREADY_CLAIMED');
      perform boerns_agent_claims.write_audit(
        v_claim.claim_id, v_claim.claim_key, 'ACQUIRE_OBSERVED', v_actor, p_request_id,
        v_claim.fence_epoch, v_claim.fence_token,
        jsonb_build_object('operation_status', 'ALREADY_CLAIMED')
      );
    end if;
  else
    v_response := boerns_agent_claims.claim_response(v_claim.claim_id)
      || jsonb_build_object('operation_status', 'ALREADY_COMPLETED');
  end if;

  v_response := v_response || jsonb_build_object('replayed', false);
  perform boerns_agent_claims.record_request(
    v_actor, p_request_id, 'ACQUIRE', v_epoch, v_fingerprint, v_response
  );
  return v_response;
end
$function$;

create function boerns_agent_claims.renew(
  p_auth_issuer text,
  p_auth_subject text,
  p_claim_id uuid,
  p_fence_epoch uuid,
  p_fence_token bigint,
  p_request_id uuid,
  p_lease_seconds integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor text;
  v_fingerprint jsonb;
  v_replay jsonb;
  v_claim boerns_agent_claims.claims%rowtype;
  v_response jsonb;
  v_epoch uuid;
begin
  v_epoch := boerns_agent_claims.lock_service_gate();
  v_actor := boerns_agent_claims.current_agent(p_auth_issuer, p_auth_subject);
  if p_lease_seconds is null or p_lease_seconds < 15 or p_lease_seconds > 900 then
    raise exception 'lease_seconds must be between 15 and 900' using errcode = 'BC001';
  end if;
  if p_claim_id is null or p_fence_epoch is null
     or p_fence_token is null or p_fence_token <= 0 then
    raise exception 'claim_id and positive fencing tuple are required' using errcode = 'BC001';
  end if;

  v_fingerprint := jsonb_build_object(
    'claim_id', p_claim_id,
    'fence_epoch', p_fence_epoch,
    'fence_token', p_fence_token,
    'lease_seconds', p_lease_seconds
  );
  v_replay := boerns_agent_claims.request_replay(
    v_actor, p_request_id, 'RENEW', v_fingerprint, v_epoch
  );
  if v_replay is not null then return v_replay; end if;

  select * into v_claim
    from boerns_agent_claims.claims
   where claim_id = p_claim_id
   for update;
  if not found then raise exception 'claim not found' using errcode = 'BC003'; end if;
  -- Visibility precedes fence validation. A foreign and an unknown claim_id
  -- therefore have the same externally mapped result and cannot be enumerated.
  if v_claim.holder_agent_id is distinct from v_actor then
    raise exception 'claim not found' using errcode = 'BC003';
  end if;
  if v_claim.state <> 'CLAIMED'
     or v_claim.fence_epoch is distinct from p_fence_epoch
     or v_claim.fence_token is distinct from p_fence_token then
    raise exception 'stale lease' using errcode = 'BC005';
  end if;
  if v_claim.lease_expires_at <= clock_timestamp() then
    raise exception 'lease expired; recovery is required' using errcode = 'BC005';
  end if;

  update boerns_agent_claims.claims
     set lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
         updated_at = clock_timestamp()
   where claim_id = p_claim_id
   returning * into v_claim;

  perform boerns_agent_claims.write_audit(
    v_claim.claim_id, v_claim.claim_key, 'RENEWED', v_actor, p_request_id,
    v_claim.fence_epoch, v_claim.fence_token,
    jsonb_build_object('lease_seconds', p_lease_seconds)
  );
  v_response := boerns_agent_claims.claim_response(v_claim.claim_id)
    || jsonb_build_object('operation_status', 'RENEWED');
  v_response := v_response || jsonb_build_object('replayed', false);
  perform boerns_agent_claims.record_request(
    v_actor, p_request_id, 'RENEW', v_epoch, v_fingerprint, v_response
  );
  return v_response;
end
$function$;

create function boerns_agent_claims.complete(
  p_auth_issuer text,
  p_auth_subject text,
  p_claim_id uuid,
  p_fence_epoch uuid,
  p_fence_token bigint,
  p_completion_id uuid,
  p_terminal_status text,
  p_evidence_ref text,
  p_evidence_sha256 text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor text;
  v_fingerprint jsonb;
  v_replay jsonb;
  v_claim boerns_agent_claims.claims%rowtype;
  v_response jsonb;
  v_epoch uuid;
begin
  v_epoch := boerns_agent_claims.lock_service_gate();
  v_actor := boerns_agent_claims.current_agent(p_auth_issuer, p_auth_subject);
  if p_completion_id is null then
    raise exception 'completion_id is required' using errcode = 'BC001';
  end if;
  if p_claim_id is null or p_fence_epoch is null
     or p_fence_token is null or p_fence_token <= 0 then
    raise exception 'claim_id and positive fencing tuple are required' using errcode = 'BC001';
  end if;
  if p_terminal_status is null
     or p_terminal_status not in ('SUCCEEDED', 'FAILED', 'BLOCKED') then
    raise exception 'invalid terminal_status' using errcode = 'BC001';
  end if;
  if p_evidence_ref is not null
     and p_evidence_ref !~ '^[A-Za-z][A-Za-z0-9_-]{1,31}:[A-Za-z0-9._/-]{1,223}$' then
    raise exception 'invalid evidence_ref' using errcode = 'BC001';
  end if;
  if p_evidence_sha256 is not null and p_evidence_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid evidence_sha256' using errcode = 'BC001';
  end if;
  if (p_evidence_ref is null) <> (p_evidence_sha256 is null) then
    raise exception 'evidence_ref and evidence_sha256 must be supplied together'
      using errcode = 'BC001';
  end if;

  v_fingerprint := jsonb_build_object(
    'claim_id', p_claim_id,
    'fence_epoch', p_fence_epoch,
    'fence_token', p_fence_token,
    'completion_id', p_completion_id,
    'terminal_status', p_terminal_status,
    'evidence_ref', p_evidence_ref,
    'evidence_sha256', p_evidence_sha256
  );
  v_replay := boerns_agent_claims.request_replay(
    v_actor, p_completion_id, 'COMPLETE', v_fingerprint, v_epoch
  );
  if v_replay is not null then return v_replay; end if;

  select * into v_claim
    from boerns_agent_claims.claims
   where claim_id = p_claim_id
   for update;
  if not found then raise exception 'claim not found' using errcode = 'BC003'; end if;
  if v_claim.intended_agent_id <> v_actor or v_claim.holder_agent_id <> v_actor then
    raise exception 'claim is held by a different agent' using errcode = 'BC003';
  end if;

  if v_claim.state = 'COMPLETED' then
    if v_claim.completion_id = p_completion_id
       and v_claim.terminal_status = p_terminal_status
       and v_claim.evidence_ref is not distinct from p_evidence_ref
       and v_claim.evidence_sha256 is not distinct from p_evidence_sha256 then
      v_response := boerns_agent_claims.claim_response(v_claim.claim_id)
        || jsonb_build_object('operation_status', 'ALREADY_COMPLETED', 'replayed', false);
      perform boerns_agent_claims.record_request(
        v_actor, p_completion_id, 'COMPLETE', v_epoch, v_fingerprint, v_response
      );
      return v_response;
    end if;
    raise exception 'claim was completed with a different result' using errcode = 'BC004';
  end if;

  if v_claim.state <> 'CLAIMED'
     or v_claim.fence_epoch is distinct from p_fence_epoch
     or v_claim.fence_token is distinct from p_fence_token
     or v_claim.lease_expires_at <= clock_timestamp() then
    raise exception 'stale, expired, or invalid fencing token' using errcode = 'BC005';
  end if;

  update boerns_agent_claims.claims
     set state = 'COMPLETED',
         lease_expires_at = null,
         completion_id = p_completion_id,
         terminal_status = p_terminal_status,
         evidence_ref = p_evidence_ref,
         evidence_sha256 = p_evidence_sha256,
         completed_at = clock_timestamp(),
         updated_at = clock_timestamp()
   where claim_id = p_claim_id
   returning * into v_claim;

  perform boerns_agent_claims.write_audit(
    v_claim.claim_id, v_claim.claim_key, 'COMPLETED', v_actor, p_completion_id,
    v_claim.fence_epoch, v_claim.fence_token,
    jsonb_build_object(
      'terminal_status', p_terminal_status,
      'evidence_ref', p_evidence_ref,
      'evidence_sha256', p_evidence_sha256
    )
  );
  v_response := boerns_agent_claims.claim_response(v_claim.claim_id)
    || jsonb_build_object('operation_status', 'COMPLETED');
  v_response := v_response || jsonb_build_object('replayed', false);
  perform boerns_agent_claims.record_request(
    v_actor, p_completion_id, 'COMPLETE', v_epoch, v_fingerprint, v_response
  );
  return v_response;
end
$function$;

create function boerns_agent_claims.read(
  p_auth_issuer text,
  p_auth_subject text,
  p_claim_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor text;
  v_can_offer boolean;
  v_claim boerns_agent_claims.claims%rowtype;
begin
  perform boerns_agent_claims.lock_service_gate();
  v_actor := boerns_agent_claims.current_agent(p_auth_issuer, p_auth_subject);
  if p_claim_id is null then
    raise exception 'claim_id is required' using errcode = 'BC001';
  end if;
  select can_offer into v_can_offer
    from boerns_agent_claims.principals where agent_id = v_actor;

  select * into v_claim
    from boerns_agent_claims.claims
   where claim_id = p_claim_id;
  if not found then raise exception 'claim not found' using errcode = 'BC003'; end if;
  if coalesce(v_can_offer, false) is not true
     and v_claim.intended_agent_id <> v_actor
     and v_claim.holder_agent_id is distinct from v_actor then
    raise exception 'claim is not visible to this principal' using errcode = 'BC003';
  end if;

  return boerns_agent_claims.claim_response(v_claim.claim_id);
end
$function$;

-- Restore-only runbook primitive. It is intentionally not exposed or granted.
-- A restore procedure must invoke this while the API is unavailable, then verify
-- the new epoch before separately enabling the service.
create function boerns_agent_claims.rotate_epoch_after_restore(p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_new_epoch uuid;
begin
  if p_reason is null or p_reason !~ '^[A-Z0-9_.:-]{1,64}$' then
    raise exception 'restore reason is required' using errcode = 'BC001';
  end if;

  perform 1
    from boerns_agent_claims.control_state
   where singleton
   for update;
  if not found then
    raise exception 'claim service control state is missing' using errcode = 'BC006';
  end if;

  v_new_epoch := gen_random_uuid();

  update boerns_agent_claims.control_state
     set service_enabled = false,
         fence_epoch = v_new_epoch,
         changed_at = clock_timestamp(),
         change_reason = p_reason
   where singleton;

  update boerns_agent_claims.claims
     set state = 'OFFERED',
         holder_agent_id = null,
         lease_expires_at = null,
         fence_epoch = null,
         fence_token = null,
         updated_at = clock_timestamp()
   where state = 'CLAIMED';

  perform boerns_agent_claims.write_audit(
    null, null, 'EPOCH_ROTATED', null, null, v_new_epoch, null,
    jsonb_build_object('reason', p_reason, 'service_enabled', false)
  );
  return v_new_epoch;
end
$function$;

revoke all on all functions in schema boerns_agent_claims from public;
revoke all on all functions in schema boerns_agent_claims from anon, authenticated, service_role;
revoke all on all functions in schema boerns_agent_claims from boerns_claims_runtime;
revoke all on schema boerns_agent_claims from boerns_claims_runtime;

grant usage on schema boerns_agent_claims to boerns_claims_runtime;
grant execute on function boerns_agent_claims.offer(text,text,text,text,bigint,text,uuid)
  to boerns_claims_runtime;
grant execute on function boerns_agent_claims.acquire(text,text,text,text,bigint,uuid,integer)
  to boerns_claims_runtime;
grant execute on function boerns_agent_claims.renew(text,text,uuid,uuid,bigint,uuid,integer)
  to boerns_claims_runtime;
grant execute on function boerns_agent_claims.complete(text,text,uuid,uuid,bigint,uuid,text,text,text)
  to boerns_claims_runtime;
grant execute on function boerns_agent_claims.read(text,text,uuid)
  to boerns_claims_runtime;

comment on schema boerns_agent_claims is
  'Private claim, lease, fencing, idempotency, and audit state for Boerns agents.';
comment on table boerns_agent_claims.principals is
  'Explicit allow-list mapping an agent ID to a verified workload issuer and subject. Empty after base migration.';
comment on table boerns_agent_claims.claims is
  'One claim row per task_id:step_id:revision; no task payload or business data.';
comment on table boerns_agent_claims.request_receipts is
  'Append-only per-principal idempotency receipts.';
comment on table boerns_agent_claims.audit_events is
  'Append-only minimal technical audit events without task content.';

reset role;
revoke boerns_claims_owner from current_user;

commit;
