-- Phase 5 backup worker hardening. Idempotent metadata-only migration; apply manually in Supabase.

alter table public.admin_operation_jobs add column if not exists requested_at timestamptz not null default now();
alter table public.admin_operation_jobs add column if not exists requested_by uuid;
alter table public.admin_operation_jobs add column if not exists claimed_at timestamptz;
alter table public.admin_operation_jobs add column if not exists started_at timestamptz;
alter table public.admin_operation_jobs add column if not exists finished_at timestamptz;
alter table public.admin_operation_jobs add column if not exists worker_id text;
alter table public.admin_operation_jobs add column if not exists attempt_count integer not null default 0;
alter table public.admin_operation_jobs add column if not exists error_code text;
alter table public.admin_operation_jobs add column if not exists error_message text;
alter table public.admin_operation_jobs add column if not exists result_reference text;
alter table public.admin_operation_jobs add column if not exists idempotency_key text;
alter table public.admin_operation_jobs add column if not exists lease_until timestamptz;
alter table public.admin_operation_jobs add column if not exists priority integer not null default 100;

update public.admin_operation_jobs set requested_by = requested_by_user_id where requested_by is null and requested_by_user_id is not null;
update public.admin_operation_jobs set requested_at = created_at where requested_at is null;
update public.admin_operation_jobs set finished_at = completed_at where finished_at is null and completed_at is not null;
update public.admin_operation_jobs set status = 'succeeded' where status = 'completed';

alter table public.backup_runs add column if not exists validation_status text not null default 'unknown';
alter table public.backup_runs add column if not exists sha256 text;
alter table public.backup_runs add column if not exists manifest jsonb not null default '{}'::jsonb;
alter table public.backup_runs add column if not exists offsite_status text not null default 'not_configured';
alter table public.backup_runs add column if not exists offsite_reference text;
alter table public.backup_runs add column if not exists job_id uuid;
alter table public.backup_runs add column if not exists worker_id text;
alter table public.backup_runs add column if not exists duration_ms integer;

alter table public.system_health_events drop constraint if exists system_health_events_component_check;
alter table public.system_health_events add constraint system_health_events_component_check check (component in ('application','supabase_config','supabase_database','supabase_storage','stripe_config','openai_config','email_config','backup','backup_worker','backup_offsite','backup_retention','deployment','nginx','pm2'));

alter table public.admin_operation_jobs drop constraint if exists admin_operation_jobs_job_type_check;
alter table public.admin_operation_jobs add constraint admin_operation_jobs_job_type_check check (job_type in ('health_check','backup_check','backup_snapshot','deployment_check','maintenance_note','manual_review','backup_server_config','backup_database','backup_storage','backup_full','verify_backup'));

alter table public.admin_operation_jobs drop constraint if exists admin_operation_jobs_status_check;
alter table public.admin_operation_jobs add constraint admin_operation_jobs_status_check check (status in ('queued','claimed','running','succeeded','failed','cancelled','blocked'));

alter table public.admin_operation_jobs drop constraint if exists admin_operation_jobs_error_message_safe_check;
alter table public.admin_operation_jobs add constraint admin_operation_jobs_error_message_safe_check check (coalesce(error_message, '') !~* '(secret|token|apikey|api_key|password|bearer|service_role|pgpass)');

alter table public.backup_runs drop constraint if exists backup_runs_backup_type_check;
alter table public.backup_runs add constraint backup_runs_backup_type_check check (backup_type in ('database','storage','configuration','server_config','full','verification'));

alter table public.backup_runs drop constraint if exists backup_runs_status_check;
alter table public.backup_runs add constraint backup_runs_status_check check (status in ('running','completed','succeeded','failed','skipped','unknown','degraded','offsite_pending'));

alter table public.backup_runs drop constraint if exists backup_runs_validation_status_check;
alter table public.backup_runs add constraint backup_runs_validation_status_check check (validation_status in ('unknown','passed','failed','skipped'));

alter table public.backup_runs drop constraint if exists backup_runs_offsite_status_check;
alter table public.backup_runs add constraint backup_runs_offsite_status_check check (offsite_status in ('not_configured','pending','uploaded','failed','skipped'));

create unique index if not exists admin_operation_jobs_idempotency_key_idx on public.admin_operation_jobs (idempotency_key) where idempotency_key is not null;
create index if not exists admin_operation_jobs_worker_queue_idx on public.admin_operation_jobs (priority asc, requested_at asc) where status in ('queued','claimed','running');
create index if not exists admin_operation_jobs_lease_idx on public.admin_operation_jobs (lease_until) where status in ('claimed','running');
create index if not exists backup_runs_type_status_started_idx on public.backup_runs (backup_type, status, started_at desc);

create or replace function public.claim_admin_backup_job(p_worker_id text, p_lease_seconds integer default 900)
returns public.admin_operation_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_job public.admin_operation_jobs;
begin
  if coalesce(trim(p_worker_id), '') = '' then
    raise exception 'worker_id_required';
  end if;

  -- At most one active backup job globally; expired leases are eligible for retry.
  if exists (
    select 1 from public.admin_operation_jobs
    where job_type in ('backup_server_config','backup_database','backup_storage','backup_full','verify_backup')
      and status in ('claimed','running')
      and lease_until > now()
  ) then
    return null;
  end if;

  with next_job as (
    select id
    from public.admin_operation_jobs
    where job_type in ('backup_server_config','backup_database','backup_storage','backup_full','verify_backup')
      and (
        status = 'queued'
        or (status in ('claimed','running') and lease_until <= now())
      )
    order by priority asc, requested_at asc
    for update skip locked
    limit 1
  )
  update public.admin_operation_jobs j
  set status = 'claimed',
      worker_id = p_worker_id,
      claimed_at = now(),
      lease_until = now() + make_interval(secs => greatest(60, least(coalesce(p_lease_seconds, 900), 3600))),
      attempt_count = j.attempt_count + 1,
      updated_at = now(),
      error_code = null,
      error_message = null
  from next_job
  where j.id = next_job.id
  returning j.* into claimed_job;

  return claimed_job;
end;
$$;

revoke all on function public.claim_admin_backup_job(text, integer) from public, anon, authenticated;
