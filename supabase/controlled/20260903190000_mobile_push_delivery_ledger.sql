begin;

-- CONTROLLED / DORMANT BY DEFAULT
-- Applied only by the dedicated, target-bound Staging control. A normal
-- deploy, Supabase migration push or application start must never apply it.

create extension if not exists pgcrypto;

alter table public.mobile_push_registrations
  drop constraint if exists mobile_push_registrations_status_check;
alter table public.mobile_push_registrations
  add constraint mobile_push_registrations_status_check
  check (status in ('active', 'disabled'));

create table if not exists public.mobile_push_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null,
  attempt_number smallint not null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  followup_id uuid not null references public.followups(id) on delete cascade,
  registration_id uuid not null references public.mobile_push_registrations(id) on delete cascade,
  expo_project_id uuid not null,
  staging_project_ref text not null,
  target_hash text not null,
  registration_token_fingerprint text not null,
  due_date date not null,
  state text not null,
  send_lease_hash text,
  send_lease_expires_at timestamptz,
  receipt_id text,
  ticket_created_at timestamptz,
  receipt_check_count smallint not null default 0,
  receipt_lease_hash text,
  receipt_lease_expires_at timestamptz,
  retry_at timestamptz,
  receipt_check_after timestamptz,
  expires_at timestamptz,
  redacted_error_code text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  terminal_at timestamptz,
  constraint mobile_push_delivery_idempotency_check
    check (idempotency_key ~ '^[0-9a-f]{64}$'),
  constraint mobile_push_delivery_attempt_number_check
    check (attempt_number between 1 and 3),
  constraint mobile_push_delivery_target_hash_check
    check (target_hash ~ '^[0-9a-f]{64}$' and target_hash = idempotency_key),
  constraint mobile_push_delivery_token_fingerprint_check
    check (registration_token_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint mobile_push_delivery_project_ref_check
    check (staging_project_ref ~ '^[a-z0-9]{8,40}$'),
  constraint mobile_push_delivery_state_check
    check (state in (
      'sending', 'retry_scheduled', 'ticket_recorded', 'receipt_checking',
      'receipt_pending', 'accepted', 'rejected', 'indeterminate'
    )),
  constraint mobile_push_delivery_receipt_count_check
    check (receipt_check_count between 0 and 4),
  constraint mobile_push_delivery_receipt_id_check
    check (receipt_id is null or receipt_id ~ '^[A-Za-z0-9_-]{1,256}$'),
  constraint mobile_push_delivery_lease_shape_check check (
    (send_lease_hash is null) = (send_lease_expires_at is null)
    and (receipt_lease_hash is null) = (receipt_lease_expires_at is null)
    and (send_lease_hash is null or send_lease_hash ~ '^[0-9a-f]{64}$')
    and (receipt_lease_hash is null or receipt_lease_hash ~ '^[0-9a-f]{64}$')
  ),
  constraint mobile_push_delivery_terminal_shape_check check (
    (state in ('accepted', 'rejected', 'indeterminate')) = (terminal_at is not null)
  ),
  constraint mobile_push_delivery_attempt_unique
    unique (idempotency_key, attempt_number)
);

create index if not exists mobile_push_delivery_receipt_due_idx
  on public.mobile_push_delivery_attempts (receipt_check_after, id)
  where state in ('ticket_recorded', 'receipt_pending');

create index if not exists mobile_push_delivery_retention_idx
  on public.mobile_push_delivery_attempts (expires_at, id);

alter table public.mobile_push_delivery_attempts enable row level security;
revoke all on table public.mobile_push_delivery_attempts
  from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.mobile_push_delivery_attempts
  to service_role;

create or replace function public.mobile_push_delivery_reserve(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_now timestamptz := statement_timestamp();
  v_requested_at timestamptz;
  v_workspace_id uuid;
  v_user_id uuid;
  v_contact_id uuid;
  v_followup_id uuid;
  v_registration_id uuid;
  v_project_id uuid;
  v_due_date date;
  v_cutoff date;
  v_idempotency_key text;
  v_token_fingerprint text;
  v_project_ref text;
  v_attempt public.mobile_push_delivery_attempts%rowtype;
  v_attempt_number smallint;
  v_attempt_id uuid := gen_random_uuid();
  v_lease_token text := encode(gen_random_bytes(32), 'hex');
begin
  if jsonb_typeof(p_input) <> 'object'
     or (select array_agg(key order by key) from jsonb_object_keys(p_input) as keys(key))
        <> array[
          'contactId','dueDate','dueDateCutoff','expectedRegistrationTokenFingerprint',
          'expectedSupabaseProjectRef','expectedTargetHash','followupId','idempotencyKey',
          'projectId','registrationId','reservedAt','revalidationContract','userId','workspaceId'
        ] then
    raise exception using errcode = '22023', message = 'mobile_push_reservation_input_invalid';
  end if;

  begin
    v_workspace_id := (p_input->>'workspaceId')::uuid;
    v_user_id := (p_input->>'userId')::uuid;
    v_contact_id := (p_input->>'contactId')::uuid;
    v_followup_id := (p_input->>'followupId')::uuid;
    v_registration_id := (p_input->>'registrationId')::uuid;
    v_project_id := (p_input->>'projectId')::uuid;
    v_due_date := (p_input->>'dueDate')::date;
    v_cutoff := (p_input->>'dueDateCutoff')::date;
    v_requested_at := (p_input->>'reservedAt')::timestamptz;
  exception when others then
    raise exception using errcode = '22023', message = 'mobile_push_reservation_input_invalid';
  end;

  v_idempotency_key := p_input->>'idempotencyKey';
  v_token_fingerprint := p_input->>'expectedRegistrationTokenFingerprint';
  v_project_ref := p_input->>'expectedSupabaseProjectRef';
  if p_input->>'revalidationContract' <> 'mobile-push-target-revalidation-v1'
     or v_idempotency_key !~ '^[0-9a-f]{64}$'
     or p_input->>'expectedTargetHash' <> v_idempotency_key
     or v_token_fingerprint !~ '^[0-9a-f]{64}$'
     or v_project_ref !~ '^[a-z0-9]{8,40}$'
     or abs(extract(epoch from (v_now - v_requested_at))) > 60
     or v_cutoff > (v_now at time zone 'UTC')::date
     or v_due_date > v_cutoff then
    raise exception using errcode = '22023', message = 'mobile_push_reservation_input_invalid';
  end if;

  perform 1
    from public.workspaces w
    join public.workspace_members m
      on m.workspace_id = w.id and m.user_id = v_user_id
    join public.followups f
      on f.workspace_id = w.id and f.id = v_followup_id
    join public.contacts c
      on c.workspace_id = w.id and c.id = v_contact_id and c.id = f.contact_id
    join public.mobile_push_registrations r
      on r.workspace_id = w.id and r.user_id = v_user_id
     and r.id = v_registration_id
   where w.id = v_workspace_id
     and m.role in ('owner', 'member')
     and w.workspace_access_mode = 'active'
     and w.billing_status <> 'demo_free'
     and (
       w.billing_status = 'active'
       or w.billing_manual_override is true
       or (
         w.billing_status in ('past_due', 'payment_failed', 'suspended')
         and w.billing_grace_until > v_now
       )
       or (
         w.test_access_flags->>'temporary_processing_access' = 'true'
         and (w.test_access_flags->>'temporary_processing_access_expires_at')::timestamptz > v_now
       )
     )
     and (w.subscription_effective_end_at is null or w.subscription_effective_end_at > v_now)
     and f.status = 'open'
     and f.due_date = v_due_date
     and f.due_date <= v_cutoff
     and r.expo_project_id = v_project_id
     and r.status = 'active'
     and r.expires_at > v_now
     and r.expires_at <= v_now + interval '31 days'
     and r.expo_token_hash = v_token_fingerprint
   for update of w, m, f, c, r;
  if not found then
    raise exception using errcode = '42501', message = 'mobile_push_target_revalidation_failed';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_idempotency_key, 0));

  select * into v_attempt
    from public.mobile_push_delivery_attempts
   where idempotency_key = v_idempotency_key
   order by attempt_number desc
   limit 1
   for update;

  if found then
    if v_attempt.state = 'sending' and v_attempt.send_lease_expires_at > v_now then
      return jsonb_build_object('status', 'inflight');
    end if;
    if v_attempt.state <> 'retry_scheduled'
       or v_attempt.retry_at is null
       or v_attempt.retry_at > v_now
       or v_attempt.attempt_number >= 3 then
      return jsonb_build_object('status', 'duplicate');
    end if;
    v_attempt_number := v_attempt.attempt_number + 1;
  else
    v_attempt_number := 1;
  end if;

  insert into public.mobile_push_delivery_attempts (
    id, idempotency_key, attempt_number, workspace_id, user_id, contact_id,
    followup_id, registration_id, expo_project_id, staging_project_ref,
    target_hash, registration_token_fingerprint, due_date, state,
    send_lease_hash, send_lease_expires_at, expires_at
  ) values (
    v_attempt_id, v_idempotency_key, v_attempt_number, v_workspace_id,
    v_user_id, v_contact_id, v_followup_id, v_registration_id, v_project_id,
    v_project_ref, v_idempotency_key, v_token_fingerprint, v_due_date,
    'sending', encode(digest(v_lease_token, 'sha256'), 'hex'),
    v_now + interval '5 minutes', v_now + interval '30 days'
  );

  return jsonb_build_object(
    'status', 'reserved',
    'attemptId', v_attempt_id,
    'attemptNumber', v_attempt_number,
    'leaseToken', v_lease_token,
    'revalidationContract', 'mobile-push-target-revalidation-v1',
    'revalidatedTargetHash', v_idempotency_key,
    'revalidatedRegistrationTokenFingerprint', v_token_fingerprint,
    'revalidatedSupabaseProjectRef', v_project_ref,
    'revalidatedAt', to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end
$function$;

create or replace function public.mobile_push_delivery_reserve_receipt(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_now timestamptz := statement_timestamp();
  v_requested_at timestamptz;
  v_attempt_id uuid;
  v_attempt public.mobile_push_delivery_attempts%rowtype;
  v_lease_token text := encode(gen_random_bytes(32), 'hex');
begin
  if jsonb_typeof(p_input) <> 'object'
     or (select array_agg(key order by key) from jsonb_object_keys(p_input) as keys(key))
        <> array['attemptId','requestedAt'] then
    raise exception using errcode = '22023', message = 'mobile_push_receipt_input_invalid';
  end if;
  begin
    v_attempt_id := (p_input->>'attemptId')::uuid;
    v_requested_at := (p_input->>'requestedAt')::timestamptz;
  exception when others then
    raise exception using errcode = '22023', message = 'mobile_push_receipt_input_invalid';
  end;
  if abs(extract(epoch from (v_now - v_requested_at))) > 60 then
    raise exception using errcode = '22023', message = 'mobile_push_receipt_input_invalid';
  end if;

  select * into v_attempt
    from public.mobile_push_delivery_attempts
   where id = v_attempt_id
   for update;
  if not found or v_attempt.state in ('accepted', 'rejected', 'indeterminate') then
    return jsonb_build_object('status', 'terminal');
  end if;
  if v_attempt.state = 'receipt_checking' and v_attempt.receipt_lease_expires_at > v_now then
    return jsonb_build_object('status', 'inflight');
  end if;
  if v_attempt.state not in ('ticket_recorded', 'receipt_pending', 'receipt_checking')
     or v_attempt.receipt_id is null
     or v_attempt.ticket_created_at is null then
    return jsonb_build_object('status', 'terminal');
  end if;
  if v_attempt.receipt_check_after > v_now then
    return jsonb_build_object('status', 'not_due');
  end if;
  if v_attempt.receipt_check_count >= 4 then
    return jsonb_build_object('status', 'terminal');
  end if;

  update public.mobile_push_delivery_attempts
     set state = 'receipt_checking',
         receipt_check_count = receipt_check_count + 1,
         receipt_lease_hash = encode(digest(v_lease_token, 'sha256'), 'hex'),
         receipt_lease_expires_at = v_now + interval '5 minutes',
         updated_at = v_now
   where id = v_attempt_id
   returning * into v_attempt;

  return jsonb_build_object(
    'status', 'reserved', 'attemptId', v_attempt.id,
    'receiptId', v_attempt.receipt_id, 'projectId', v_attempt.expo_project_id,
    'registrationId', v_attempt.registration_id,
    'attemptNumber', v_attempt.attempt_number,
    'receiptCheckNumber', v_attempt.receipt_check_count,
    'receiptLeaseToken', v_lease_token,
    'ticketCreatedAt', to_char(v_attempt.ticket_created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end
$function$;

create or replace function public.mobile_push_delivery_transition(
  p_action text,
  p_input jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_now timestamptz := statement_timestamp();
  v_attempt_id uuid;
  v_registration_id uuid;
  v_attempt public.mobile_push_delivery_attempts%rowtype;
  v_lease text := coalesce(p_input->>'leaseToken', p_input->>'receiptLeaseToken');
  v_lease_hash text;
  v_receipt_lease boolean := p_input ? 'receiptLeaseToken';
  v_error text := p_input->>'errorCode';
  v_keys text[];
  v_transition_at timestamptz;
begin
  if jsonb_typeof(p_input) <> 'object' or p_action not in (
    'markTicket', 'markRetry', 'markIndeterminate', 'markTerminal',
    'markReceiptAccepted', 'markReceiptPending', 'markDeviceNotRegistered'
  ) then
    raise exception using errcode = '22023', message = 'mobile_push_transition_invalid';
  end if;
  select array_agg(key order by key) into v_keys
    from jsonb_object_keys(p_input) as keys(key);
  if (p_action = 'markTicket' and v_keys <> array[
        'attemptId','checkAfter','expiresAt','leaseToken','receiptId','ticketCreatedAt'
      ])
     or (p_action in ('markRetry') and v_keys not in (
        array['attemptId','errorCode','leaseToken','retryAt'],
        array['attemptId','errorCode','receiptLeaseToken','retryAt']
      ))
     or (p_action = 'markIndeterminate' and v_keys <>
        array['attemptId','errorCode','leaseToken'])
     or (p_action = 'markTerminal' and v_keys not in (
        array['attemptId','errorCode','leaseToken'],
        array['attemptId','errorCode','receiptLeaseToken']
      ))
     or (p_action = 'markReceiptAccepted' and v_keys <>
        array['acceptedAt','attemptId','receiptLeaseToken'])
     or (p_action = 'markReceiptPending' and v_keys <>
        array['attemptId','errorCode','nextCheckAt','receiptLeaseToken'])
     or (p_action = 'markDeviceNotRegistered' and v_keys not in (
        array['attemptId','leaseToken','reason','registrationId'],
        array['attemptId','reason','receiptLeaseToken','registrationId']
      )) then
    raise exception using errcode = '22023', message = 'mobile_push_transition_input_invalid';
  end if;
  begin
    v_attempt_id := (p_input->>'attemptId')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'mobile_push_transition_invalid';
  end;
  if v_lease is null or char_length(v_lease) not between 16 and 256 then
    raise exception using errcode = '42501', message = 'mobile_push_lease_invalid';
  end if;
  v_lease_hash := encode(digest(v_lease, 'sha256'), 'hex');

  select * into v_attempt
    from public.mobile_push_delivery_attempts
   where id = v_attempt_id
   for update;
  if not found
     or (v_receipt_lease and (
       v_attempt.receipt_lease_hash is distinct from v_lease_hash
       or v_attempt.receipt_lease_expires_at <= v_now
     ))
     or (not v_receipt_lease and (
       v_attempt.send_lease_hash is distinct from v_lease_hash
       or v_attempt.send_lease_expires_at <= v_now
     )) then
    raise exception using errcode = '42501', message = 'mobile_push_lease_invalid';
  end if;

  if p_action = 'markTicket' then
    begin
      v_transition_at := (p_input->>'ticketCreatedAt')::timestamptz;
    exception when others then
      raise exception using errcode = '22023', message = 'mobile_push_transition_time_invalid';
    end;
    if abs(extract(epoch from (v_now - v_transition_at))) > 60
       or (p_input->>'checkAfter')::timestamptz <> v_transition_at + interval '15 minutes'
       or (p_input->>'expiresAt')::timestamptz <> v_transition_at + interval '24 hours' then
      raise exception using errcode = '22023', message = 'mobile_push_transition_time_invalid';
    end if;
    update public.mobile_push_delivery_attempts set
      state = 'ticket_recorded', receipt_id = p_input->>'receiptId',
      ticket_created_at = (p_input->>'ticketCreatedAt')::timestamptz,
      receipt_check_after = (p_input->>'checkAfter')::timestamptz,
      expires_at = (p_input->>'expiresAt')::timestamptz,
      send_lease_hash = null, send_lease_expires_at = null, updated_at = v_now
    where id = v_attempt_id;
  elsif p_action = 'markRetry' then
    if v_error not in ('provider_temporarily_unavailable', 'provider_device_rate_exceeded') then
      raise exception using errcode = '22023', message = 'mobile_push_error_code_invalid';
    end if;
    v_transition_at := (p_input->>'retryAt')::timestamptz;
    if v_transition_at <= v_now or v_transition_at > v_now + interval '15 minutes' then
      raise exception using errcode = '22023', message = 'mobile_push_transition_time_invalid';
    end if;
    update public.mobile_push_delivery_attempts set
      state = 'retry_scheduled', retry_at = (p_input->>'retryAt')::timestamptz,
      redacted_error_code = v_error, send_lease_hash = null,
      send_lease_expires_at = null, receipt_lease_hash = null,
      receipt_lease_expires_at = null, updated_at = v_now
    where id = v_attempt_id;
  elsif p_action = 'markReceiptPending' then
    if v_error not in ('receipt_lookup_unavailable', 'receipt_not_ready', 'receipt_response_invalid') then
      raise exception using errcode = '22023', message = 'mobile_push_error_code_invalid';
    end if;
    v_transition_at := (p_input->>'nextCheckAt')::timestamptz;
    if v_transition_at <= v_now or v_transition_at > v_now + interval '6 hours' then
      raise exception using errcode = '22023', message = 'mobile_push_transition_time_invalid';
    end if;
    update public.mobile_push_delivery_attempts set
      state = 'receipt_pending', receipt_check_after = (p_input->>'nextCheckAt')::timestamptz,
      redacted_error_code = v_error, receipt_lease_hash = null,
      receipt_lease_expires_at = null, updated_at = v_now
    where id = v_attempt_id;
  elsif p_action = 'markReceiptAccepted' then
    v_transition_at := (p_input->>'acceptedAt')::timestamptz;
    if abs(extract(epoch from (v_now - v_transition_at))) > 60 then
      raise exception using errcode = '22023', message = 'mobile_push_transition_time_invalid';
    end if;
    update public.mobile_push_delivery_attempts set
      state = 'accepted', terminal_at = (p_input->>'acceptedAt')::timestamptz,
      redacted_error_code = null, receipt_lease_hash = null,
      receipt_lease_expires_at = null, updated_at = v_now
    where id = v_attempt_id;
  elsif p_action = 'markDeviceNotRegistered' then
    if p_input->>'reason' <> 'device_not_registered' then
      raise exception using errcode = '22023', message = 'mobile_push_error_code_invalid';
    end if;
    begin
      v_registration_id := (p_input->>'registrationId')::uuid;
    exception when others then
      raise exception using errcode = '22023', message = 'mobile_push_transition_invalid';
    end;
    if v_registration_id <> v_attempt.registration_id then
      raise exception using errcode = '42501', message = 'mobile_push_registration_binding_invalid';
    end if;
    update public.mobile_push_registrations set
      status = 'disabled', updated_at = v_now
    where id = v_registration_id
      and expo_token_hash = v_attempt.registration_token_fingerprint;
    if not found then
      raise exception using errcode = '42501', message = 'mobile_push_registration_binding_invalid';
    end if;
    update public.mobile_push_delivery_attempts set
      state = 'rejected', terminal_at = v_now,
      redacted_error_code = 'device_not_registered', send_lease_hash = null,
      send_lease_expires_at = null, receipt_lease_hash = null,
      receipt_lease_expires_at = null, updated_at = v_now
    where id = v_attempt_id;
  else
    if v_error not in (
      'provider_result_indeterminate', 'provider_retry_exhausted',
      'provider_request_rejected', 'provider_ticket_rejected',
      'receipt_expired', 'receipt_request_rejected',
      'receipt_lookup_exhausted', 'provider_receipt_rejected'
    ) then
      raise exception using errcode = '22023', message = 'mobile_push_error_code_invalid';
    end if;
    update public.mobile_push_delivery_attempts set
      state = case when p_action = 'markIndeterminate' then 'indeterminate' else 'rejected' end,
      terminal_at = v_now, redacted_error_code = v_error,
      send_lease_hash = null, send_lease_expires_at = null,
      receipt_lease_hash = null, receipt_lease_expires_at = null,
      updated_at = v_now
    where id = v_attempt_id;
  end if;
  return jsonb_build_object('status', 'recorded');
end
$function$;

revoke all on function public.mobile_push_delivery_reserve(jsonb)
  from public, anon, authenticated;
revoke all on function public.mobile_push_delivery_reserve_receipt(jsonb)
  from public, anon, authenticated;
revoke all on function public.mobile_push_delivery_transition(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.mobile_push_delivery_reserve(jsonb) to service_role;
grant execute on function public.mobile_push_delivery_reserve_receipt(jsonb) to service_role;
grant execute on function public.mobile_push_delivery_transition(text, jsonb) to service_role;

comment on table public.mobile_push_delivery_attempts is
  'Dormant service-role-only Staging delivery ledger. Installing this table does not enable a route, timer, worker or provider send.';

commit;
