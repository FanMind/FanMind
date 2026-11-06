-- Grant the backup worker RPC only to Supabase's server-side service role.
-- Idempotent follow-up for environments that already applied the Phase 5 backup worker migrations.

do $$
begin
  if to_regprocedure('public.claim_admin_backup_job(text, integer)') is null then
    raise exception 'required function public.claim_admin_backup_job(text, integer) does not exist';
  end if;
end
$$;

revoke all on function public.claim_admin_backup_job(text, integer) from public, anon, authenticated;
grant execute on function public.claim_admin_backup_job(text, integer) to service_role;
