-- Re-enable checksum-only backup verification after the read-only verifier shipped.
-- Apply manually after all earlier Phase 5 operations migrations.

alter table public.admin_operation_jobs drop constraint if exists admin_operation_jobs_job_type_check;
alter table public.admin_operation_jobs add constraint admin_operation_jobs_job_type_check check (job_type in ('health_check','backup_check','backup_snapshot','deployment_check','maintenance_note','manual_review','backup_server_config','backup_database','backup_storage','backup_full','verify_backup'));

alter table public.backup_runs drop constraint if exists backup_runs_backup_type_check;
alter table public.backup_runs add constraint backup_runs_backup_type_check check (backup_type in ('database','storage','configuration','server_config','full','verification'));

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
grant execute on function public.claim_admin_backup_job(text, integer) to service_role;
