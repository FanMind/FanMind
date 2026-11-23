-- Revision 16 / RC6 synthetic functional tests. Run only in a disposable PostgreSQL 17 database.
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned

create temporary table test_context (
  key text primary key,
  value jsonb not null
);
grant select, insert, update on test_context to boerns_claims_runtime;

-- The base migration must remain fail-closed and contain no principal mappings.
do $assert_initial$
begin
  if (select service_enabled from boerns_agent_claims.control_state where singleton) then
    raise exception 'initial service state must be disabled';
  end if;
  if (select count(*) from boerns_agent_claims.principals) <> 0 then
    raise exception 'base migration must not create principal mappings';
  end if;
  if exists (
    select 1
      from pg_proc p,
           lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
     where p.oid = to_regprocedure(
       'boerns_agent_claims.acquire(text,text,text,text,bigint,uuid,integer)'
     )
       and a.grantee = 0
       and a.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC must not have API execute permission';
  end if;
  if not has_function_privilege(
    'boerns_claims_runtime',
    'boerns_agent_claims.acquire(text,text,text,text,bigint,uuid,integer)',
    'EXECUTE'
  ) then
    raise exception 'runtime role is missing API execute permission';
  end if;
  if has_table_privilege('boerns_claims_runtime', 'boerns_agent_claims.claims', 'SELECT') then
    raise exception 'boerns_claims_runtime must not have direct claims table access';
  end if;
  if has_schema_privilege('anon', 'boerns_agent_claims', 'USAGE')
     or has_schema_privilege('authenticated', 'boerns_agent_claims', 'USAGE')
     or has_schema_privilege('service_role', 'boerns_agent_claims', 'USAGE') then
    raise exception 'standard Supabase application roles must not enter the private schema';
  end if;
  if has_function_privilege(
       'service_role',
       'boerns_agent_claims.acquire(text,text,text,text,bigint,uuid,integer)',
       'EXECUTE'
     ) then
    raise exception 'service_role must not execute the private claim RPC';
  end if;
end
$assert_initial$;

-- Local-only identities; no secrets and no production data.
insert into boerns_agent_claims.principals
  (agent_id, auth_issuer, auth_subject, enabled, can_offer)
values
  ('BT-001', 'https://claims.test.local', 'subject-bt001', true, true),
  ('BT-006', 'https://claims.test.local', 'subject-bt006', true, false),
  ('BT-010', 'https://claims.test.local', 'subject-bt010', true, false);

-- Fail closed while disabled, even for a registered principal.
set role boerns_claims_runtime;
do $disabled$
declare
  v_rejected boolean := false;
begin
  begin
    perform boerns_agent_claims.offer(
      'https://claims.test.local', 'subject-bt001',
      'SYNTH-DISABLED', 'T1', 1, 'BT-006',
      '10000000-0000-0000-0000-000000000001'
    );
  exception
    when sqlstate 'BC006' then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'disabled service unexpectedly accepted an offer';
  end if;
end
$disabled$;
reset role;

-- Activation is a protected production step. It is performed here only locally.
update boerns_agent_claims.control_state
   set service_enabled = true,
       changed_at = clock_timestamp(),
       change_reason = 'LOCAL_SYNTHETIC_TEST_ONLY'
 where singleton;

-- Authentication succeeded, but BT-006 lacks the coordinator capability.
set role boerns_claims_runtime;
do $authorization_class$
begin
  perform boerns_agent_claims.offer(
    'https://claims.test.local', 'subject-bt006',
    'SYNTH-FORBIDDEN', 'T1', 1, 'BT-006',
    '10000000-0000-0000-0000-000000000002'
  );
  raise exception 'principal without can_offer was accepted';
exception
  when sqlstate 'BC008' then null;
end
$authorization_class$;
reset role;

-- BT-001 offers exactly one task to BT-006.
set role boerns_claims_runtime;
select boerns_agent_claims.offer(
  'https://claims.test.local', 'subject-bt001',
  'SYNTH-CLAIM', 'T1', 1, 'BT-006',
  '10000000-0000-0000-0000-000000000010'
) as offer_response \gset
reset role;
insert into test_context values ('offer', :'offer_response'::jsonb);

do $offer_assert$
begin
  if (select value ->> 'operation_status' from test_context where key = 'offer') <> 'OFFERED' then
    raise exception 'offer did not return OFFERED';
  end if;
end
$offer_assert$;

-- Reusing a request_id with a different payload must fail.
set role boerns_claims_runtime;
do $request_reuse$
begin
  perform boerns_agent_claims.offer(
    'https://claims.test.local', 'subject-bt001',
    'SYNTH-CLAIM', 'DIFFERENT', 1, 'BT-006',
    '10000000-0000-0000-0000-000000000010'
  );
  raise exception 'request_id payload conflict was accepted';
exception
  when sqlstate 'BC004' then null;
end
$request_reuse$;
reset role;

-- An unintended agent cannot acquire the task.
set role boerns_claims_runtime;
do $wrong_agent$
begin
  perform boerns_agent_claims.acquire(
    'https://claims.test.local', 'subject-bt010',
    'SYNTH-CLAIM', 'T1', 1,
    '10000000-0000-0000-0000-000000000011', 120
  );
  raise exception 'wrong agent acquired claim';
exception
  when sqlstate 'BC003' then null;
end
$wrong_agent$;
reset role;

-- BT-006 acquires; replay of the same request returns the same token.
set role boerns_claims_runtime;
select boerns_agent_claims.acquire(
  'https://claims.test.local', 'subject-bt006',
  'SYNTH-CLAIM', 'T1', 1,
  '10000000-0000-0000-0000-000000000012', 120
) as acquire_response \gset
select boerns_agent_claims.acquire(
  'https://claims.test.local', 'subject-bt006',
  'SYNTH-CLAIM', 'T1', 1,
  '10000000-0000-0000-0000-000000000012', 120
) as acquire_replay \gset
select boerns_agent_claims.acquire(
  'https://claims.test.local', 'subject-bt006',
  'SYNTH-CLAIM', 'T1', 1,
  '10000000-0000-0000-0000-000000000013', 120
) as acquire_observed \gset
select boerns_agent_claims.read(
  'https://claims.test.local', 'subject-bt006',
  (:'acquire_response'::jsonb ->> 'claim_id')::uuid
) as read_response \gset
select boerns_agent_claims.renew(
  'https://claims.test.local', 'subject-bt006',
  (:'acquire_response'::jsonb ->> 'claim_id')::uuid,
  (:'acquire_response'::jsonb ->> 'fence_epoch')::uuid,
  (:'acquire_response'::jsonb ->> 'fence_token')::bigint,
  '10000000-0000-0000-0000-000000000019', 120
) as renew_response \gset
reset role;

-- A foreign existing claim and an unknown claim_id must be indistinguishable.
set role boerns_claims_runtime;
do $renew_enumeration_resistance$
declare
  v_acquire jsonb := :'acquire_response'::jsonb;
  v_foreign_rejected boolean := false;
  v_unknown_rejected boolean := false;
begin
  begin
    perform boerns_agent_claims.renew(
      'https://claims.test.local', 'subject-bt010',
      (v_acquire ->> 'claim_id')::uuid,
      (v_acquire ->> 'fence_epoch')::uuid,
      (v_acquire ->> 'fence_token')::bigint,
      '10000000-0000-0000-0000-000000000022', 120
    );
  exception
    when sqlstate 'BC003' then v_foreign_rejected := true;
  end;

  begin
    perform boerns_agent_claims.renew(
      'https://claims.test.local', 'subject-bt010',
      'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid,
      (v_acquire ->> 'fence_epoch')::uuid,
      (v_acquire ->> 'fence_token')::bigint,
      '10000000-0000-0000-0000-000000000023', 120
    );
  exception
    when sqlstate 'BC003' then v_unknown_rejected := true;
  end;

  if not v_foreign_rejected or not v_unknown_rejected then
    raise exception 'renew disclosed whether a foreign claim_id exists';
  end if;
end
$renew_enumeration_resistance$;
reset role;

insert into test_context values
  ('acquire', :'acquire_response'::jsonb),
  ('acquire_replay', :'acquire_replay'::jsonb),
  ('acquire_observed', :'acquire_observed'::jsonb),
  ('read', :'read_response'::jsonb),
  ('renew', :'renew_response'::jsonb);

do $acquire_assert$
declare
  v_acquire jsonb := (select value from test_context where key = 'acquire');
  v_replay jsonb := (select value from test_context where key = 'acquire_replay');
  v_observed jsonb := (select value from test_context where key = 'acquire_observed');
  v_read jsonb := (select value from test_context where key = 'read');
  v_renew jsonb := (select value from test_context where key = 'renew');
begin
  if (v_acquire ->> 'operation_status') <> 'ACQUIRED' then
    raise exception 'first acquire did not return ACQUIRED';
  end if;
  if (v_acquire - 'replayed') <> (v_replay - 'replayed')
     or (v_acquire ->> 'replayed')::boolean is not false
     or (v_replay ->> 'replayed')::boolean is not true then
    raise exception 'request replay changed data or omitted its replay signal';
  end if;
  if (v_observed ->> 'operation_status') <> 'ALREADY_CLAIMED' then
    raise exception 'second request did not observe ALREADY_CLAIMED';
  end if;
  if (v_acquire ->> 'fence_token') <> (v_observed ->> 'fence_token') then
    raise exception 'duplicate acquire minted another fencing token';
  end if;
  if (v_read ->> 'state') <> 'CLAIMED'
     or (v_read ->> 'fence_token') <> (v_acquire ->> 'fence_token') then
    raise exception 'read-back does not match acquired state';
  end if;
  if (v_renew ->> 'operation_status') <> 'RENEWED'
     or (v_renew ->> 'fence_token') <> (v_acquire ->> 'fence_token') then
    raise exception 'renew changed or lost the active fencing token';
  end if;
end
$acquire_assert$;

-- Missing fencing values must fail closed; SQL NULL must never bypass checks.
set role boerns_claims_runtime;
do $null_fence$
declare
  v_acquire jsonb := (select value from test_context where key = 'acquire');
  v_short_rejected boolean := false;
  v_long_rejected boolean := false;
begin
  begin
    perform boerns_agent_claims.renew(
      'https://claims.test.local', 'subject-bt006',
      (v_acquire ->> 'claim_id')::uuid,
      null,
      (v_acquire ->> 'fence_token')::bigint,
      '10000000-0000-0000-0000-000000000017', 120
    );
    raise exception 'NULL fence epoch was accepted';
  exception
    when sqlstate 'BC001' then null;
  end;

  begin
    perform boerns_agent_claims.complete(
      'https://claims.test.local', 'subject-bt006',
      (v_acquire ->> 'claim_id')::uuid,
      (v_acquire ->> 'fence_epoch')::uuid,
      null,
      '10000000-0000-0000-0000-000000000018',
      'SUCCEEDED', 'synthetic://null-fence', repeat('c', 64)
    );
    raise exception 'NULL fence token was accepted';
  exception
    when sqlstate 'BC001' then null;
  end;

  begin
    perform boerns_agent_claims.renew(
      'https://claims.test.local', 'subject-bt006',
      (v_acquire ->> 'claim_id')::uuid,
      (v_acquire ->> 'fence_epoch')::uuid,
      (v_acquire ->> 'fence_token')::bigint,
      '10000000-0000-0000-0000-000000000020', 14
    );
  exception
    when sqlstate 'BC001' then v_short_rejected := true;
  end;
  begin
    perform boerns_agent_claims.renew(
      'https://claims.test.local', 'subject-bt006',
      (v_acquire ->> 'claim_id')::uuid,
      (v_acquire ->> 'fence_epoch')::uuid,
      (v_acquire ->> 'fence_token')::bigint,
      '10000000-0000-0000-0000-000000000021', 901
    );
  exception
    when sqlstate 'BC001' then v_long_rejected := true;
  end;
  if not v_short_rejected or not v_long_rejected then
    raise exception 'lease duration boundary was accepted';
  end if;
end
$null_fence$;
reset role;

-- Expire the lease locally, recover it, and prove the fencing token increases.
update boerns_agent_claims.claims
   set lease_expires_at = clock_timestamp() - interval '1 second'
 where claim_id = (
   select (value ->> 'claim_id')::uuid from test_context where key = 'acquire'
 );

set role boerns_claims_runtime;
select boerns_agent_claims.acquire(
  'https://claims.test.local', 'subject-bt006',
  'SYNTH-CLAIM', 'T1', 1,
  '10000000-0000-0000-0000-000000000014', 120
) as recover_response \gset
reset role;
insert into test_context values ('recover', :'recover_response'::jsonb);

do $recover_assert$
declare
  v_acquire jsonb := (select value from test_context where key = 'acquire');
  v_recover jsonb := (select value from test_context where key = 'recover');
begin
  if (v_recover ->> 'operation_status') <> 'RECOVERED' then
    raise exception 'recover did not return RECOVERED';
  end if;
  if (v_recover ->> 'fence_token')::bigint <= (v_acquire ->> 'fence_token')::bigint then
    raise exception 'recovery did not advance fencing token';
  end if;
end
$recover_assert$;

-- Stale fencing data cannot complete the recovered claim.
set role boerns_claims_runtime;
do $stale_token$
declare
  v_acquire jsonb := (select value from test_context where key = 'acquire');
begin
  perform boerns_agent_claims.complete(
    'https://claims.test.local', 'subject-bt006',
    (v_acquire ->> 'claim_id')::uuid,
    (v_acquire ->> 'fence_epoch')::uuid,
    (v_acquire ->> 'fence_token')::bigint,
    '10000000-0000-0000-0000-000000000015',
    'SUCCEEDED', 'synthetic://stale', repeat('a', 64)
  );
  raise exception 'stale fencing token completed the claim';
exception
  when sqlstate 'BC005' then null;
end
$stale_token$;

-- The current token completes exactly once; the same completion_id is replayed.
select boerns_agent_claims.complete(
  'https://claims.test.local', 'subject-bt006',
  (:'recover_response'::jsonb ->> 'claim_id')::uuid,
  (:'recover_response'::jsonb ->> 'fence_epoch')::uuid,
  (:'recover_response'::jsonb ->> 'fence_token')::bigint,
  '10000000-0000-0000-0000-000000000016',
  'SUCCEEDED', 'synthetic://evidence', repeat('b', 64)
) as complete_response \gset
select boerns_agent_claims.complete(
  'https://claims.test.local', 'subject-bt006',
  (:'recover_response'::jsonb ->> 'claim_id')::uuid,
  (:'recover_response'::jsonb ->> 'fence_epoch')::uuid,
  (:'recover_response'::jsonb ->> 'fence_token')::bigint,
  '10000000-0000-0000-0000-000000000016',
  'SUCCEEDED', 'synthetic://evidence', repeat('b', 64)
) as complete_replay \gset
reset role;

insert into test_context values
  ('complete', :'complete_response'::jsonb),
  ('complete_replay', :'complete_replay'::jsonb);

do $complete_assert$
declare
  v_complete jsonb := (select value from test_context where key = 'complete');
  v_replay jsonb := (select value from test_context where key = 'complete_replay');
begin
  if (v_complete ->> 'operation_status') <> 'COMPLETED' then
    raise exception 'completion did not return COMPLETED';
  end if;
  if (v_complete - 'replayed') <> (v_replay - 'replayed')
     or (v_complete ->> 'replayed')::boolean is not false
     or (v_replay ->> 'replayed')::boolean is not true then
    raise exception 'completion replay changed data or omitted its replay signal';
  end if;
end
$complete_assert$;

-- Append-only controls and minimal audit cardinality.
do $audit_assert$
declare
  v_claim_id uuid := (
    select (value ->> 'claim_id')::uuid from test_context where key = 'complete'
  );
begin
  if (select count(*) from boerns_agent_claims.audit_events
       where claim_id = v_claim_id and event_type = 'ACQUIRED') <> 1 then
    raise exception 'expected exactly one ACQUIRED audit event';
  end if;
  if (select count(*) from boerns_agent_claims.audit_events
       where claim_id = v_claim_id and event_type = 'COMPLETED') <> 1 then
    raise exception 'expected exactly one COMPLETED audit event';
  end if;

  begin
    update boerns_agent_claims.audit_events
       set details = '{}'::jsonb
     where claim_id = v_claim_id;
    raise exception 'audit update was accepted';
  exception
    when object_not_in_prerequisite_state then null;
  end;

  begin
    execute 'truncate table boerns_agent_claims.audit_events';
    raise exception 'audit truncate was accepted';
  exception
    when object_not_in_prerequisite_state then null;
  end;

  begin
    delete from boerns_agent_claims.audit_events where claim_id = v_claim_id;
    raise exception 'audit delete was accepted';
  exception
    when object_not_in_prerequisite_state then null;
  end;

  begin
    update boerns_agent_claims.request_receipts
       set fingerprint = '{}'::jsonb
     where actor_agent_id = 'BT-006';
    raise exception 'request receipt update was accepted';
  exception
    when object_not_in_prerequisite_state then null;
  end;

  begin
    delete from boerns_agent_claims.request_receipts
     where actor_agent_id = 'BT-006';
    raise exception 'request receipt delete was accepted';
  exception
    when object_not_in_prerequisite_state then null;
  end;

  begin
    execute 'truncate table boerns_agent_claims.request_receipts';
    raise exception 'request receipt truncate was accepted';
  exception
    when object_not_in_prerequisite_state then null;
  end;
end
$audit_assert$;

-- A disabled principal cannot acquire, even when the task was already offered.
set role boerns_claims_runtime;
select boerns_agent_claims.offer(
  'https://claims.test.local', 'subject-bt001',
  'SYNTH-REVOKE', 'T1', 1, 'BT-006',
  '10000000-0000-0000-0000-000000000030'
) as revoke_offer \gset
reset role;

update boerns_agent_claims.principals
   set enabled = false, updated_at = clock_timestamp()
 where agent_id = 'BT-006';

set role boerns_claims_runtime;
do $revoked_principal$
declare
  v_rejected boolean := false;
begin
  begin
    perform boerns_agent_claims.acquire(
      'https://claims.test.local', 'subject-bt006',
      'SYNTH-REVOKE', 'T1', 1,
      '10000000-0000-0000-0000-000000000031', 120
    );
  exception
    when sqlstate 'BC002' then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'revoked principal acquired a claim';
  end if;
end
$revoked_principal$;
reset role;

update boerns_agent_claims.principals
   set enabled = true, updated_at = clock_timestamp()
 where agent_id = 'BT-006';

-- Restore primitive: disable service, rotate epoch, and invalidate every active lease.
set role boerns_claims_runtime;
select boerns_agent_claims.offer(
  'https://claims.test.local', 'subject-bt001',
  'SYNTH-RESTORE', 'T1', 1, 'BT-006',
  '10000000-0000-0000-0000-000000000040'
) as restore_offer \gset
select boerns_agent_claims.acquire(
  'https://claims.test.local', 'subject-bt006',
  'SYNTH-RESTORE', 'T1', 1,
  '10000000-0000-0000-0000-000000000041', 120
) as restore_before \gset
reset role;
insert into test_context values ('restore_before', :'restore_before'::jsonb);

select boerns_agent_claims.rotate_epoch_after_restore('LOCAL_RESTORE_TEST')
  as rotated_epoch \gset
insert into test_context values (
  'rotated_epoch', jsonb_build_object('epoch', :'rotated_epoch')
);

do $restore_closed$
declare
  v_before jsonb := (select value from test_context where key = 'restore_before');
  v_rotated uuid := (
    select (value ->> 'epoch')::uuid from test_context where key = 'rotated_epoch'
  );
  v_claim boerns_agent_claims.claims%rowtype;
begin
  if (select service_enabled from boerns_agent_claims.control_state where singleton) then
    raise exception 'restore rotation did not disable service';
  end if;
  if v_rotated = (v_before ->> 'fence_epoch')::uuid then
    raise exception 'restore rotation reused the old epoch';
  end if;
  select * into v_claim from boerns_agent_claims.claims
   where task_id = 'SYNTH-RESTORE' and step_id = 'T1' and revision = 1;
  if v_claim.state <> 'OFFERED' or v_claim.holder_agent_id is not null
     or v_claim.lease_expires_at is not null or v_claim.fence_epoch is not null
     or v_claim.fence_token is not null then
    raise exception 'restore rotation did not invalidate the active lease';
  end if;
end
$restore_closed$;

set role boerns_claims_runtime;
do $read_closed_during_restore$
declare
  v_rejected boolean := false;
  v_before jsonb := (select value from test_context where key = 'restore_before');
begin
  begin
    perform boerns_agent_claims.read(
      'https://claims.test.local', 'subject-bt006',
      (v_before ->> 'claim_id')::uuid
    );
  exception
    when sqlstate 'BC006' then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'agent read-back remained open during restore lock';
  end if;
end
$read_closed_during_restore$;
reset role;

update boerns_agent_claims.control_state
   set service_enabled = true,
       changed_at = clock_timestamp(),
       change_reason = 'LOCAL_RESTORE_REOPEN'
 where singleton;

set role boerns_claims_runtime;
do $stale_receipt_after_restore$
declare
  v_rejected boolean := false;
begin
  begin
    perform boerns_agent_claims.acquire(
      'https://claims.test.local', 'subject-bt006',
      'SYNTH-RESTORE', 'T1', 1,
      '10000000-0000-0000-0000-000000000041', 120
    );
  exception
    when sqlstate 'BC005' then v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'pre-restore request receipt was replayed in the new epoch';
  end if;
end
$stale_receipt_after_restore$;

select boerns_agent_claims.acquire(
  'https://claims.test.local', 'subject-bt006',
  'SYNTH-RESTORE', 'T1', 1,
  '10000000-0000-0000-0000-000000000042', 120
) as restore_after \gset
reset role;
insert into test_context values ('restore_after', :'restore_after'::jsonb);

do $restore_reopen$
declare
  v_before jsonb := (select value from test_context where key = 'restore_before');
  v_after jsonb := (select value from test_context where key = 'restore_after');
begin
  if (v_after ->> 'operation_status') <> 'ACQUIRED' then
    raise exception 'restored claim did not require a fresh acquisition';
  end if;
  if (v_after ->> 'fence_epoch') = (v_before ->> 'fence_epoch') then
    raise exception 'fresh acquisition reused the pre-restore epoch';
  end if;
end
$restore_reopen$;

select 'FUNCTIONAL_SMOKE_PASS';
