-- Durable, workspace-scoped Meta conversation catch-up queue.
-- Controlled migration: never applied by the normal application deploy path.

begin;

create table public.meta_conversation_catchup_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  social_connection_id uuid not null,
  platform text not null check (platform in ('facebook', 'instagram')),
  fan_sender_id text not null check (
    char_length(fan_sender_id) between 1 and 255
    and fan_sender_id = btrim(fan_sender_id)
  ),
  contact_id uuid,
  status text not null default 'pending' check (
    status in ('pending', 'claimed', 'retry', 'succeeded', 'dead_letter', 'cancelled')
  ),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  generation bigint not null default 1 check (generation >= 1),
  claimed_generation bigint check (
    claimed_generation is null or claimed_generation between 1 and generation
  ),
  available_at timestamptz not null default now(),
  worker_id text check (
    worker_id is null or worker_id ~ '^[a-z0-9][a-z0-9-]{2,95}$'
  ),
  lease_token uuid,
  lease_until timestamptz,
  last_error_code text check (
    last_error_code is null or last_error_code in (
      'catchup_request_failed',
      'connection_unavailable',
      'entitlement_unavailable',
      'internal_route_unavailable',
      'meta_sync_failed',
      'worker_response_invalid'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint meta_conversation_catchup_connection_workspace_fk
    foreign key (social_connection_id, workspace_id)
    references public.social_connections (id, workspace_id)
    on delete cascade,
  constraint meta_conversation_catchup_contact_workspace_fk
    foreign key (contact_id, workspace_id)
    references public.contacts (id, workspace_id)
    on delete no action,
  check (
    (status = 'claimed' and worker_id is not null and lease_token is not null and lease_until is not null)
    or
    (status <> 'claimed' and worker_id is null and lease_token is null and lease_until is null)
  )
);

create unique index meta_conversation_catchup_active_thread_unique_idx
  on public.meta_conversation_catchup_jobs (
    workspace_id,
    social_connection_id,
    platform,
    fan_sender_id
  )
  where status in ('pending', 'claimed', 'retry');

create index meta_conversation_catchup_ready_idx
  on public.meta_conversation_catchup_jobs (available_at, created_at)
  where status in ('pending', 'claimed', 'retry');

alter table public.meta_conversation_catchup_jobs enable row level security;
alter table public.meta_conversation_catchup_jobs force row level security;

revoke all on table public.meta_conversation_catchup_jobs
  from public, anon, authenticated, service_role;
grant select on table public.meta_conversation_catchup_jobs to service_role;

create function public.enqueue_meta_conversation_catchup(
  p_workspace_id uuid,
  p_social_connection_id uuid,
  p_platform text,
  p_fan_sender_id text,
  p_contact_id uuid default null
)
returns setof public.meta_conversation_catchup_jobs
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  normalized_sender_id text := btrim(coalesce(p_fan_sender_id, ''));
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_platform not in ('facebook', 'instagram')
     or char_length(normalized_sender_id) not between 1 and 255 then
    raise exception 'catchup_input_invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1
      from public.social_connections as connection
     where connection.id = p_social_connection_id
       and connection.workspace_id = p_workspace_id
       and connection.platform = p_platform
       and connection.status = 'connected'
  ) then
    raise exception 'connection_unavailable' using errcode = '23503';
  end if;
  if p_contact_id is not null and not exists (
    select 1
      from public.contacts as contact
     where contact.id = p_contact_id
       and contact.workspace_id = p_workspace_id
  ) then
    raise exception 'contact_unavailable' using errcode = '23503';
  end if;

  return query
  insert into public.meta_conversation_catchup_jobs as job (
    workspace_id,
    social_connection_id,
    platform,
    fan_sender_id,
    contact_id
  ) values (
    p_workspace_id,
    p_social_connection_id,
    p_platform,
    normalized_sender_id,
    p_contact_id
  )
  on conflict (
    workspace_id,
    social_connection_id,
    platform,
    fan_sender_id
  ) where status in ('pending', 'claimed', 'retry')
  do update set
    contact_id = coalesce(excluded.contact_id, job.contact_id),
    status = case
      when job.status in ('pending', 'retry') then 'pending'
      else job.status
    end,
    attempt_count = job.attempt_count,
    generation = job.generation + 1,
    available_at = case
      when job.status in ('pending', 'retry') then least(job.available_at, now())
      else job.available_at
    end,
    last_error_code = case
      when job.status in ('pending', 'retry') then null
      else job.last_error_code
    end,
    finished_at = null,
    updated_at = now()
  returning job.*;
end
$function$;

create function public.claim_meta_conversation_catchup_job(
  p_worker_id text,
  p_lease_seconds integer default 120
)
returns setof public.meta_conversation_catchup_jobs
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  claimed_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_worker_id !~ '^[a-z0-9][a-z0-9-]{2,95}$'
     or p_lease_seconds not between 30 and 900 then
    raise exception 'claim_input_invalid' using errcode = '22023';
  end if;

  update public.meta_conversation_catchup_jobs as job
     set status = case
           when job.generation > job.claimed_generation then 'pending'
           else 'dead_letter'
         end,
         attempt_count = case
           when job.generation > job.claimed_generation then 0
           else job.attempt_count
         end,
         claimed_generation = null,
         worker_id = null,
         lease_token = null,
         lease_until = null,
         available_at = case
           when job.generation > job.claimed_generation then now()
           else job.available_at
         end,
         last_error_code = case
           when job.generation > job.claimed_generation then null
           else 'catchup_request_failed'
         end,
         finished_at = case
           when job.generation > job.claimed_generation then null
           else now()
         end,
         updated_at = now()
   where job.status = 'claimed'
     and job.lease_until < now()
     and job.attempt_count >= 5;

  select job.id
    into claimed_id
    from public.meta_conversation_catchup_jobs as job
   where job.attempt_count < 5
     and (
       (job.status in ('pending', 'retry') and job.available_at <= now())
       or
       (job.status = 'claimed' and job.lease_until < now())
     )
   order by job.available_at asc, job.created_at asc
   for update skip locked
   limit 1;

  if claimed_id is null then
    return;
  end if;

  return query
  update public.meta_conversation_catchup_jobs as job
     set status = 'claimed',
         attempt_count = job.attempt_count + 1,
         claimed_generation = job.generation,
         worker_id = p_worker_id,
         lease_token = gen_random_uuid(),
         lease_until = now() + make_interval(secs => p_lease_seconds),
         last_error_code = null,
         finished_at = null,
         updated_at = now()
   where job.id = claimed_id
  returning job.*;
end
$function$;

create function public.finish_meta_conversation_catchup_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_outcome text,
  p_error_code text default null,
  p_retry_seconds integer default 30
)
returns setof public.meta_conversation_catchup_jobs
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  claimed_job public.meta_conversation_catchup_jobs%rowtype;
  next_status text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_outcome not in ('success', 'retry', 'terminal', 'cancelled')
     or p_retry_seconds not between 1 and 86400
     or (
       p_error_code is not null
       and p_error_code not in (
         'catchup_request_failed',
         'connection_unavailable',
         'entitlement_unavailable',
         'internal_route_unavailable',
         'meta_sync_failed',
         'worker_response_invalid'
       )
     )
     or (p_outcome <> 'success' and p_error_code is null) then
    raise exception 'finish_input_invalid' using errcode = '22023';
  end if;

  select job.*
    into claimed_job
    from public.meta_conversation_catchup_jobs as job
   where job.id = p_job_id
     and job.status = 'claimed'
     and job.worker_id = p_worker_id
     and job.lease_token = p_lease_token
     and job.lease_until >= now()
   for update;

  if not found then
    return;
  end if;

  next_status := case
    when p_outcome = 'success'
      and claimed_job.generation > claimed_job.claimed_generation then 'pending'
    when p_outcome = 'success' then 'succeeded'
    when p_outcome = 'retry' and claimed_job.attempt_count < 5 then 'retry'
    when p_outcome = 'retry'
      and claimed_job.generation > claimed_job.claimed_generation then 'pending'
    when p_outcome = 'cancelled' then 'cancelled'
    else 'dead_letter'
  end;

  return query
  update public.meta_conversation_catchup_jobs as job
     set status = next_status,
         attempt_count = case
           when next_status = 'pending' then 0
           else job.attempt_count
         end,
         claimed_generation = null,
         worker_id = null,
         lease_token = null,
         lease_until = null,
         available_at = case
           when next_status = 'pending' then now()
           when next_status = 'retry' then now() + make_interval(secs => p_retry_seconds)
           else job.available_at
         end,
         last_error_code = case
           when next_status in ('pending', 'succeeded') then null
           else p_error_code
         end,
         finished_at = case
           when next_status in ('succeeded', 'dead_letter', 'cancelled') then now()
           else null
         end,
         updated_at = now()
   where job.id = claimed_job.id
  returning job.*;
end
$function$;

revoke all on function public.enqueue_meta_conversation_catchup(uuid, uuid, text, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_meta_conversation_catchup_job(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.finish_meta_conversation_catchup_job(uuid, text, uuid, text, text, integer)
  from public, anon, authenticated, service_role;

grant execute on function public.enqueue_meta_conversation_catchup(uuid, uuid, text, text, uuid)
  to service_role;
grant execute on function public.claim_meta_conversation_catchup_job(text, integer)
  to service_role;
grant execute on function public.finish_meta_conversation_catchup_job(uuid, text, uuid, text, text, integer)
  to service_role;

commit;
