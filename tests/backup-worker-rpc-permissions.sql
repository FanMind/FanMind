-- Documented non-Production SQL proof for the backup worker RPC permission fix.
-- Run only against a local/test Supabase database after applying these migrations in order:
-- 1. 20260711120000_phase_5_operations_foundation.sql
-- 2. 20260711143000_phase_5_backup_worker.sql
-- 3. 20260711161500_disable_verify_backup_until_safe_validation.sql
-- 4. 20260711170000_grant_backup_worker_rpc_service_role.sql

begin;

select plan(7);

select ok(
  to_regprocedure('public.claim_admin_backup_job(text, integer)') is not null,
  'claim_admin_backup_job(text, integer) exists'
);

select ok(
  has_schema_privilege('service_role', 'public', 'USAGE'),
  'service_role has USAGE on schema public for PostgREST RPC lookup'
);

select ok(
  has_function_privilege('service_role', 'public.claim_admin_backup_job(text, integer)', 'EXECUTE'),
  'service_role can execute backup worker claim RPC'
);

select ok(
  not has_function_privilege('anon', 'public.claim_admin_backup_job(text, integer)', 'EXECUTE'),
  'anon cannot execute backup worker claim RPC'
);

select ok(
  not has_function_privilege('authenticated', 'public.claim_admin_backup_job(text, integer)', 'EXECUTE'),
  'authenticated cannot execute backup worker claim RPC'
);

select ok(
  not has_function_privilege('public', 'public.claim_admin_backup_job(text, integer)', 'EXECUTE'),
  'PUBLIC has no general execute privilege on backup worker claim RPC'
);

insert into public.admin_operation_jobs (job_type, status, priority, requested_by, requested_at, metadata)
values ('backup_database', 'queued', 10, null, now(), '{"test":"rpc-permission-fixture-redacted"}'::jsonb);

set local role service_role;

with claimed as (
  select * from public.claim_admin_backup_job('rpc-permission-fixture-worker', 900)
)
select is(
  (select status from claimed),
  'claimed',
  'service_role atomically claims one queued backup job through the RPC function'
);

select * from finish();

rollback;
