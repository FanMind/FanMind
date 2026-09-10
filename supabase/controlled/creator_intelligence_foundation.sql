-- Additive Creator foundation. Not part of generic db push or Web deployment.
-- Apply only to an explicitly bound, preflighted target. No implicit backfill or activation.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.creators (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 100),
  bio text not null default '' check (length(bio) <= 1200),
  public_age integer check (public_age between 18 and 120),
  location text not null default '' check (length(location) <= 160),
  languages text[] not null default '{}' check (cardinality(languages) <= 10),
  platforms text[] not null default '{}' check (cardinality(platforms) <= 10),
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  internal_notes text not null default '' check (length(internal_notes) <= 1500),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id,id),
  unique (workspace_id)
);

create table public.creator_voice_profiles (
  workspace_id uuid not null,
  creator_id uuid not null,
  fingerprint jsonb not null check (jsonb_typeof(fingerprint) = 'object' and octet_length(fingerprint::text) <= 18000),
  revision integer not null check (revision > 0),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  primary key (workspace_id,creator_id),
  foreign key (workspace_id,creator_id) references public.creators(workspace_id,id) on delete cascade,
  check (approved_by is null or approved_at is not null)
);
create table public.creator_sales_playbooks (
  workspace_id uuid not null,
  creator_id uuid not null,
  rules jsonb not null check (jsonb_typeof(rules) = 'object' and octet_length(rules::text) <= 18000),
  revision integer not null check (revision > 0),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  primary key (workspace_id,creator_id),
  foreign key (workspace_id,creator_id) references public.creators(workspace_id,id) on delete cascade,
  check (approved_by is null or approved_at is not null)
);

-- One Creator per independently owned Workspace. Existing fans/conversations
-- already inherit their Creator through workspace_id; no guessed re-assignment.
alter table public.contacts add constraint contacts_workspace_identity_unique unique (workspace_id,id);

alter table public.conversations add column sales_state text not null default 'CONNECT'
  check (sales_state in ('CONNECT','ENGAGE','BUILD_INTEREST','QUALIFY','TEASE','OFFER','NEGOTIATE','CLOSE','AFTERCARE','REACTIVATE'));
alter table public.conversations add column sales_state_updated_at timestamptz;
alter table public.conversations add column sales_state_source text check (sales_state_source in ('manual','confirmed_purchase'));
alter table public.conversations add constraint conversations_parent_identity_unique unique (workspace_id,contact_id,id);

alter table public.contact_ai_profiles add column commercial_profile jsonb not null default '{}'::jsonb
  check (jsonb_typeof(commercial_profile) = 'object' and octet_length(commercial_profile::text) <= 6000);
create table public.creator_commercial_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  creator_id uuid not null,
  contact_id uuid not null,
  conversation_id uuid,
  kind text not null check (kind in ('purchase','offer','offer_declined')),
  occurred_at timestamptz not null check (occurred_at <= now()),
  amount_minor bigint check (amount_minor between 1 and 100000000),
  currency text check (currency ~ '^[A-Z]{3}$'),
  category text check (length(category) <= 80),
  evidence_reference text not null check (length(btrim(evidence_reference)) between 1 and 200),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz not null default now(),
  foreign key (workspace_id,creator_id) references public.creators(workspace_id,id) on delete cascade,
  foreign key (workspace_id,contact_id) references public.contacts(workspace_id,id) on delete cascade,
  foreign key (workspace_id,contact_id,conversation_id) references public.conversations(workspace_id,contact_id,id) on delete cascade,
  check ((amount_minor is null) = (currency is null)),
  check (kind <> 'purchase' or amount_minor is not null),
  unique (workspace_id,creator_id,contact_id,kind,evidence_reference)
);
create index creator_commercial_events_contact_idx on public.creator_commercial_events(workspace_id,creator_id,contact_id,occurred_at desc);

-- Workspace identity cannot be moved by a profile edit. Direct authenticated
-- writes also receive the actual actor/time, never a client-supplied approver.
create function public.guard_creator_identity() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.workspace_id is distinct from old.workspace_id then
    raise exception 'creator_workspace_immutable' using errcode='23514';
  end if;
  if tg_table_name = 'creators' then
    if tg_op = 'UPDATE' and new.id is distinct from old.id then raise exception 'creator_identity_immutable' using errcode='23514'; end if;
  elsif tg_table_name = 'creator_commercial_events' then
    if (select auth.uid()) is null then raise exception 'creator_actor_required' using errcode='42501'; end if;
    new.confirmed_by := (select auth.uid()); new.confirmed_at := now();
  else
    if tg_op = 'UPDATE' and new.creator_id is distinct from old.creator_id then raise exception 'creator_identity_immutable' using errcode='23514'; end if;
    if new.approved_by is not null and (select auth.uid()) is not null then
      new.approved_by := (select auth.uid()); new.approved_at := now();
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_creator_identity() from public, anon, authenticated;
create trigger creators_identity_guard before update on public.creators for each row execute function public.guard_creator_identity();
create trigger creator_voice_identity_guard before insert or update on public.creator_voice_profiles for each row execute function public.guard_creator_identity();
create trigger creator_playbook_identity_guard before insert or update on public.creator_sales_playbooks for each row execute function public.guard_creator_identity();
create trigger creator_event_actor_guard before insert on public.creator_commercial_events for each row execute function public.guard_creator_identity();

-- RLS: authenticated Workspace members may read; only the owner manages profiles.
do $$
declare tab text;
begin
  foreach tab in array array['creators','creator_voice_profiles','creator_sales_playbooks','creator_commercial_events'] loop
    execute format('alter table public.%I enable row level security', tab);
    execute format('revoke all on public.%I from public, anon, authenticated', tab);
    execute format('grant select, insert on public.%I to authenticated', tab);
    execute format('grant all on public.%I to service_role', tab);
    execute format('create policy %I on public.%I for select to authenticated using (exists (select 1 from public.workspace_members m where m.workspace_id = %I.workspace_id and m.user_id = (select auth.uid())) or exists (select 1 from public.workspaces w where w.id = %I.workspace_id and w.owner_user_id = (select auth.uid())))', tab || '_member_read', tab, tab, tab);
    execute format('create policy %I on public.%I for insert to authenticated with check (exists (select 1 from public.workspaces w where w.id = %I.workspace_id and w.owner_user_id = (select auth.uid())))', tab || '_owner_insert', tab, tab);
    if tab <> 'creator_commercial_events' then
      execute format('grant update on public.%I to authenticated', tab);
      execute format('create policy %I on public.%I for update to authenticated using (exists (select 1 from public.workspaces w where w.id = %I.workspace_id and w.owner_user_id = (select auth.uid()))) with check (exists (select 1 from public.workspaces w where w.id = %I.workspace_id and w.owner_user_id = (select auth.uid())))', tab || '_owner_update', tab, tab, tab);
    end if;
  end loop;
end $$;

-- Atomic optimistic revision: a partial save must never become a current voice.
create function public.save_creator_bundle(p_workspace_id uuid, p_creator_id uuid, p_expected_revision integer, p_persona jsonb, p_voice jsonb, p_playbook jsonb, p_approve boolean)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare target uuid; next_revision integer; approver uuid;
begin
  if (select auth.uid()) is null or not exists (select 1 from public.workspaces w where w.id = p_workspace_id and w.owner_user_id = (select auth.uid())) then
    raise exception 'creator_owner_required' using errcode = '42501';
  end if;
  if p_creator_id is null then
    if p_expected_revision <> 0 then raise exception 'creator_revision_conflict' using errcode = '40001'; end if;
    insert into public.creators(workspace_id,display_name) values(p_workspace_id,p_persona->>'displayName') returning id into target;
    next_revision := 1;
  else
    select id, revision + 1 into target,next_revision from public.creators where workspace_id = p_workspace_id and id = p_creator_id and revision = p_expected_revision for update;
    if target is null then raise exception 'creator_revision_conflict' using errcode = '40001'; end if;
  end if;
  update public.creators set display_name = p_persona->>'displayName', bio = p_persona->>'bio',
    public_age = (p_persona->>'publicAge')::integer, location = p_persona->>'location',
    languages = array(select jsonb_array_elements_text(p_persona->'languages')),
    platforms = array(select jsonb_array_elements_text(p_persona->'platforms')),
    status = p_persona->>'status', internal_notes = p_persona->>'internalNotes', revision = next_revision, updated_at = now()
    where workspace_id = p_workspace_id and id = target;
  if p_approve and (coalesce(jsonb_typeof(p_voice->'goodExamples'),'null') <> 'array' or
      coalesce(jsonb_array_length(p_voice->'goodExamples'),0) < 3 or
      coalesce(jsonb_array_length(p_persona->'languages'),0) = 0) then
    raise exception 'creator_review_incomplete' using errcode = '23514';
  end if;
  approver := case when p_approve then (select auth.uid()) else null end;
  insert into public.creator_voice_profiles(workspace_id,creator_id,fingerprint,revision,approved_by,approved_at)
    values(p_workspace_id,target,p_voice,next_revision,approver,case when p_approve then now() else null end)
    on conflict(workspace_id,creator_id) do update set fingerprint=excluded.fingerprint,revision=excluded.revision,approved_by=excluded.approved_by,approved_at=excluded.approved_at;
  insert into public.creator_sales_playbooks(workspace_id,creator_id,rules,revision,approved_by,approved_at)
    values(p_workspace_id,target,p_playbook,next_revision,approver,case when p_approve then now() else null end)
    on conflict(workspace_id,creator_id) do update set rules=excluded.rules,revision=excluded.revision,approved_by=excluded.approved_by,approved_at=excluded.approved_at;
  return target;
end $$;
revoke all on function public.save_creator_bundle(uuid,uuid,integer,jsonb,jsonb,jsonb,boolean) from public, anon;
grant execute on function public.save_creator_bundle(uuid,uuid,integer,jsonb,jsonb,jsonb,boolean) to authenticated;

-- Existing contact_ai_profiles deliberately stays SELECT-only for authenticated.
-- This narrowly scoped definer writes only commercial_profile after an explicit
-- owner + parent check, with no dynamic SQL or caller-selected actor/Workspace.
create function public.record_creator_fan_review(p_workspace_id uuid, p_contact_id uuid, p_commercial jsonb, p_event jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare creator uuid;
begin
  if (select auth.uid()) is null or not exists(select 1 from public.workspaces where id=p_workspace_id and owner_user_id=(select auth.uid())) then
    raise exception 'creator_owner_required' using errcode='42501';
  end if;
  if not exists(select 1 from public.contacts where id=p_contact_id and workspace_id=p_workspace_id) then
    raise exception 'creator_contact_mismatch' using errcode='23514';
  end if;
  select id into strict creator from public.creators where workspace_id=p_workspace_id;
  if p_commercial is null or jsonb_typeof(p_commercial) <> 'object' or coalesce(length(btrim(p_commercial->>'sourceReference')),0)=0 then
    raise exception 'creator_source_required' using errcode='23514';
  end if;
  insert into public.contact_ai_profiles(workspace_id,contact_id,commercial_profile)
    values(p_workspace_id,p_contact_id,p_commercial || jsonb_build_object('reviewStatus','confirmed','reviewedAt',now(),'reviewedBy',(select auth.uid())))
    on conflict(workspace_id,contact_id) do update set commercial_profile=excluded.commercial_profile;
  if p_event is not null and p_event <> 'null'::jsonb then
    insert into public.creator_commercial_events(workspace_id,creator_id,contact_id,kind,occurred_at,amount_minor,currency,category,evidence_reference,confirmed_by)
      values(p_workspace_id,creator,p_contact_id,p_event->>'kind',(p_event->>'occurredAt')::timestamptz,
        (p_event->>'amountMinor')::bigint,p_event->>'currency',p_event->>'category',p_event->>'evidenceReference',(select auth.uid()));
  end if;
end $$;
revoke all on function public.record_creator_fan_review(uuid,uuid,jsonb,jsonb) from public, anon;
grant execute on function public.record_creator_fan_review(uuid,uuid,jsonb,jsonb) to authenticated;
commit;
