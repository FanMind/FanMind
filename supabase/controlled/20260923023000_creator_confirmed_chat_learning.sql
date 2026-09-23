-- Controlled Creator confirmed-chat learning persistence contract.
-- Repository-only preparation: normal Web/Staging deploy paths MUST NOT apply this file.
-- Apply only after an explicitly authorized target-bound preflight. This file does
-- not enable provider access, automatic sending, profile mutation or learning-driven
-- pricing/playbook changes.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Fail closed when the already accepted Creator foundation or the canonical
-- owner/processing mutation guard is not installed.
do $$
begin
  if to_regclass('public.creators') is null
     or to_regclass('public.creator_commercial_events') is null
     or to_regclass('public.conversation_messages') is null
     or to_regprocedure('public.creator_workspace_access_allowed(uuid)') is null
     or to_regprocedure('public.workspace_owner_active_mutation_allowed(uuid)') is null
     or to_regprocedure('public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)') is null then
    raise exception 'creator_learning_foundation_missing' using errcode = '55000';
  end if;
end $$;

-- Durable, server-owned human-send provenance. Existing provider rows are not
-- backfilled. The trigger stamps only new authenticated outbound writes and never
-- trusts a client-supplied marker. Updates preserve provenance only while every
-- evidence-defining field stays identical; any later text/scope/provenance rewrite
-- clears the marker permanently instead of turning edited data into send evidence.
alter table public.conversation_messages
  add column if not exists creator_learning_manual_send boolean not null default false;

create or replace function public.stamp_creator_learning_manual_send()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.creator_learning_manual_send :=
      (select auth.role()) = 'authenticated'
      and (select auth.uid()) is not null
      and new.direction = 'outbound'
      and new.message_type in ('dm','manual')
      and coalesce(new.source_type, '') <> 'manual_note';
  else
    new.creator_learning_manual_send :=
      old.creator_learning_manual_send
      and new.workspace_id is not distinct from old.workspace_id
      and new.conversation_id is not distinct from old.conversation_id
      and new.contact_id is not distinct from old.contact_id
      and new.direction is not distinct from old.direction
      and new.message_type is not distinct from old.message_type
      and new.source_type is not distinct from old.source_type
      and new.source_platform is not distinct from old.source_platform
      and new.external_message_id is not distinct from old.external_message_id
      and new.content is not distinct from old.content
      and new.created_at is not distinct from old.created_at;
  end if;
  return new;
end $$;

revoke all on function public.stamp_creator_learning_manual_send()
  from public, anon, authenticated, service_role;

drop trigger if exists conversation_messages_stamp_creator_learning_manual_send
  on public.conversation_messages;
create trigger conversation_messages_stamp_creator_learning_manual_send
  before insert or update on public.conversation_messages
  for each row execute function public.stamp_creator_learning_manual_send();

create table public.creator_confirmed_chat_learning (
  proposal_id uuid primary key,
  generation_id uuid not null,
  workspace_id uuid not null,
  creator_id uuid not null,
  contact_id uuid not null,
  conversation_id uuid not null,
  creator_revision integer not null check (creator_revision > 0),
  prompt_revision text not null check (length(btrim(prompt_revision)) between 1 and 120),
  selected_variant text not null check (selected_variant in ('recommended','softer','stronger')),
  -- PostgreSQL length() counts Unicode code points, not extended grapheme clusters.
  -- The database therefore keeps only the authoritative validator's 4,000-code-unit
  -- storage envelope. Exact <=512 NFC grapheme validation happens server-side before
  -- either service-role persistence call, so multi-code-point emoji are never rejected
  -- merely because PostgreSQL counts their component code points separately.
  proposed_text text not null check (length(btrim(proposed_text)) between 1 and 4000),
  generated_at timestamptz not null,
  outbound_message_id uuid,
  actual_text text,
  confirmed_at timestamptz,
  -- The actor is audit metadata, not the confirmation fact itself. Account deletion
  -- anonymizes it while confirmed_at + immutable message binding retain valid history.
  confirmed_by uuid references auth.users(id) on delete set null,
  reaction_message_id uuid,
  reaction_at timestamptz,
  purchase_event_id uuid,
  purchase_evidence_reference text,
  purchase_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id,creator_id)
    references public.creators(workspace_id,id) on delete cascade,
  foreign key (workspace_id,contact_id,conversation_id)
    references public.conversations(workspace_id,contact_id,id) on delete cascade,
  unique (workspace_id,generation_id),
  unique (workspace_id,outbound_message_id),
  unique (workspace_id,reaction_message_id),
  unique (workspace_id,purchase_event_id),
  check (
    (outbound_message_id is null and actual_text is null and confirmed_at is null and confirmed_by is null
      and reaction_message_id is null and reaction_at is null
      and purchase_event_id is null and purchase_evidence_reference is null and purchase_at is null)
    or
    (outbound_message_id is not null and actual_text is not null
      and length(btrim(actual_text)) between 1 and 4000
      and confirmed_at is not null)
  ),
  check ((reaction_message_id is null) = (reaction_at is null)),
  check (
    (purchase_event_id is null and purchase_evidence_reference is null and purchase_at is null)
    or
    (purchase_event_id is not null and purchase_evidence_reference is not null
      and length(btrim(purchase_evidence_reference)) between 1 and 200
      and purchase_at is not null)
  ),
  check (confirmed_at is null or confirmed_at >= generated_at),
  check (reaction_at is null or reaction_at >= confirmed_at),
  check (purchase_at is null or purchase_at >= confirmed_at)
);

create index creator_confirmed_chat_learning_contact_idx
  on public.creator_confirmed_chat_learning(workspace_id,creator_id,contact_id,generated_at desc);

alter table public.creator_confirmed_chat_learning enable row level security;
revoke all on public.creator_confirmed_chat_learning from public, anon, authenticated, service_role;
grant select on public.creator_confirmed_chat_learning to authenticated;
grant all on public.creator_confirmed_chat_learning to service_role;

create policy creator_confirmed_chat_learning_member_read
  on public.creator_confirmed_chat_learning
  for select
  to authenticated
  using (
    public.creator_workspace_access_allowed(workspace_id)
    and (
      exists (
        select 1 from public.workspace_members m
        where m.workspace_id = creator_confirmed_chat_learning.workspace_id
          and m.user_id = (select auth.uid())
      )
      or exists (
        select 1 from public.workspaces w
        where w.id = creator_confirmed_chat_learning.workspace_id
          and w.owner_user_id = (select auth.uid())
      )
    )
  );

-- Proposal origins are server-only. The browser cannot mint a proposal or a
-- generation ID and therefore cannot poison the learning chain with an invented
-- "AI suggestion". The caller supplies the already server-validated three reply
-- texts; IDs and generated_at are created inside this transaction.
create function public.record_creator_confirmed_chat_proposals(
  p_workspace_id uuid,
  p_contact_id uuid,
  p_conversation_id uuid,
  p_creator_id uuid,
  p_creator_revision integer,
  p_prompt_revision text,
  p_proposals jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  variant text;
  proposal_text text;
  proposal uuid;
  generation uuid;
  seen_variants text[] := '{}'::text[];
  result jsonb := '[]'::jsonb;
begin
  if not public.creator_workspace_access_allowed(p_workspace_id) then
    raise exception 'workspace_inactive' using errcode = '42501';
  end if;
  if p_prompt_revision is null or length(btrim(p_prompt_revision)) not between 1 and 120 then
    raise exception 'prompt_revision_invalid' using errcode = '23514';
  end if;
  if jsonb_typeof(p_proposals) <> 'array' or jsonb_array_length(p_proposals) <> 3 then
    raise exception 'creator_learning_three_proposals_required' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.creators c
    where c.workspace_id = p_workspace_id
      and c.id = p_creator_id
      and c.revision = p_creator_revision
      and c.status = 'active'
  ) then
    raise exception 'creator_learning_revision_mismatch' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.conversations c
    where c.workspace_id = p_workspace_id
      and c.contact_id = p_contact_id
      and c.id = p_conversation_id
  ) then
    raise exception 'creator_learning_conversation_mismatch' using errcode = '23514';
  end if;

  for item in select value from jsonb_array_elements(p_proposals)
  loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'creator_learning_proposal_invalid' using errcode = '23514';
    end if;
    variant := btrim(coalesce(item->>'selectedVariant',''));
    proposal_text := btrim(coalesce(item->>'proposedText',''));
    if variant not in ('recommended','softer','stronger')
       or variant = any(seen_variants)
       or length(proposal_text) not between 1 and 4000 then
      raise exception 'creator_learning_proposal_invalid' using errcode = '23514';
    end if;
    seen_variants := array_append(seen_variants, variant);
    proposal := gen_random_uuid();
    generation := gen_random_uuid();
    insert into public.creator_confirmed_chat_learning(
      proposal_id,generation_id,workspace_id,creator_id,contact_id,conversation_id,
      creator_revision,prompt_revision,selected_variant,proposed_text,generated_at
    ) values (
      proposal,generation,p_workspace_id,p_creator_id,p_contact_id,p_conversation_id,
      p_creator_revision,btrim(p_prompt_revision),variant,proposal_text,now()
    );
    result := result || jsonb_build_array(jsonb_build_object(
      'proposalId', proposal,
      'generationId', generation,
      'selectedVariant', variant
    ));
  end loop;

  if not (seen_variants @> array['recommended','softer','stronger']::text[]) then
    raise exception 'creator_learning_variants_incomplete' using errcode = '23514';
  end if;
  return result;
end $$;
revoke all on function public.record_creator_confirmed_chat_proposals(uuid,uuid,uuid,uuid,integer,text,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.record_creator_confirmed_chat_proposals(uuid,uuid,uuid,uuid,integer,text,jsonb)
  to service_role;

-- Confirmation is evidence binding, not message sending. Only the server route may
-- call this RPC after reading the exact owner-visible message and applying the
-- authoritative <=512 NFC-grapheme validator. The RPC independently rechecks the
-- actor's owner/processing entitlement and requires the exact message text observed
-- by that validator, closing the read/confirm race. The message timestamp must also
-- be no more than 30 seconds ahead of database statement time, matching the pure
-- validator's bounded future-clock skew. Browser callers cannot bypass measurement
-- with a direct RPC. Provider/service imports and manual-note rows are never eligible;
-- replays are idempotent and a different second message fails closed.
create function public.confirm_creator_confirmed_chat_outbound(
  p_workspace_id uuid,
  p_contact_id uuid,
  p_proposal_id uuid,
  p_outbound_message_id uuid,
  p_actor_user_id uuid,
  p_expected_actual_text text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.creator_confirmed_chat_learning%rowtype;
  message_text text;
  message_time timestamptz;
begin
  if (select auth.role()) is distinct from 'service_role'
     or p_actor_user_id is null
     or not public.creator_workspace_access_allowed(p_workspace_id)
     or not exists (
       select 1
       from public.workspaces w
       where w.id = p_workspace_id
         and w.owner_user_id = p_actor_user_id
         and public.workspace_processing_allowed_contract(
           w.workspace_access_mode,
           w.subscription_effective_end_at::text,
           w.billing_status,
           w.billing_manual_override,
           w.billing_grace_until::text,
           w.billing_suspended_at::text,
           w.test_access_flags,
           statement_timestamp()
         )
     ) then
    raise exception 'creator_learning_owner_processing_required' using errcode = '42501';
  end if;

  select * into target
  from public.creator_confirmed_chat_learning l
  where l.workspace_id=p_workspace_id
    and l.contact_id=p_contact_id
    and l.proposal_id=p_proposal_id
  for update;
  if not found then
    raise exception 'creator_learning_proposal_not_found' using errcode = '23503';
  end if;

  if target.outbound_message_id is not null then
    if target.outbound_message_id <> p_outbound_message_id then
      raise exception 'creator_learning_outbound_conflict' using errcode = '40001';
    end if;
    return jsonb_build_object('proposalId',target.proposal_id,'outboundMessageId',target.outbound_message_id,'confirmed',true);
  end if;

  select m.content,m.created_at into message_text,message_time
  from public.conversation_messages m
  where m.id=p_outbound_message_id
    and m.workspace_id=target.workspace_id
    and m.contact_id=target.contact_id
    and m.conversation_id=target.conversation_id
    and m.direction='outbound'
    and m.creator_learning_manual_send is true;
  if not found
     or message_text is distinct from p_expected_actual_text
     or length(btrim(coalesce(message_text,''))) not between 1 and 4000
     or message_time < target.generated_at
     or message_time > statement_timestamp() + interval '30 seconds' then
    raise exception 'creator_learning_outbound_evidence_mismatch' using errcode = '23514';
  end if;

  update public.creator_confirmed_chat_learning
  set outbound_message_id=p_outbound_message_id,
      actual_text=message_text,
      confirmed_at=message_time,
      confirmed_by=p_actor_user_id,
      updated_at=now()
  where proposal_id=target.proposal_id;

  return jsonb_build_object('proposalId',target.proposal_id,'outboundMessageId',p_outbound_message_id,'confirmed',true);
end $$;
revoke all on function public.confirm_creator_confirmed_chat_outbound(uuid,uuid,uuid,uuid,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.confirm_creator_confirmed_chat_outbound(uuid,uuid,uuid,uuid,uuid,text)
  to service_role;

-- Outcomes may only enrich an already confirmed outbound. "Reaction" means an
-- independently stored inbound Fan message, excluding internal manual-note rows,
-- whose timestamp is after the outbound and no more than the validator's bounded
-- 30-second future-clock skew at link time. A purchase must be an independently
-- confirmed creator_commercial_events purchase in the same tenant/Creator/Fan and
-- either already carry the exact conversation_id or be an unbound legacy/current
-- record_creator_fan_review event. For an unbound event, this explicit owner action
-- is the durable conversation association; the learning row stores both IDs and the
-- unique purchase_event_id prevents reuse by another learned proposal. The purchase
-- confirmer is audit metadata: ON DELETE SET NULL anonymizes it, while confirmed_at
-- remains the durable confirmation fact.
-- IDs are append-only: conflicting re-attribution is rejected.
create function public.link_creator_confirmed_chat_outcomes(
  p_workspace_id uuid,
  p_contact_id uuid,
  p_proposal_id uuid,
  p_reaction_message_id uuid,
  p_purchase_event_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.creator_confirmed_chat_learning%rowtype;
  reaction_time timestamptz;
  purchase_time timestamptz;
  purchase_reference text;
begin
  if (select auth.uid()) is null
     or not public.workspace_owner_active_mutation_allowed(p_workspace_id)
     or not public.creator_workspace_access_allowed(p_workspace_id) then
    raise exception 'creator_learning_owner_processing_required' using errcode = '42501';
  end if;
  if p_reaction_message_id is null and p_purchase_event_id is null then
    raise exception 'creator_learning_outcome_required' using errcode = '23514';
  end if;

  select * into target
  from public.creator_confirmed_chat_learning l
  where l.workspace_id=p_workspace_id
    and l.contact_id=p_contact_id
    and l.proposal_id=p_proposal_id
  for update;
  if not found or target.outbound_message_id is null then
    raise exception 'creator_learning_confirmed_outbound_required' using errcode = '23514';
  end if;

  if p_reaction_message_id is not null then
    if target.reaction_message_id is not null and target.reaction_message_id <> p_reaction_message_id then
      raise exception 'creator_learning_reaction_conflict' using errcode = '40001';
    end if;
    if target.reaction_message_id is null then
      select m.created_at into reaction_time
      from public.conversation_messages m
      where m.id=p_reaction_message_id
        and m.workspace_id=target.workspace_id
        and m.contact_id=target.contact_id
        and m.conversation_id=target.conversation_id
        and m.direction='inbound'
        and coalesce(m.source_type,'') <> 'manual_note';
      if not found
         or reaction_time < target.confirmed_at
         or reaction_time > statement_timestamp() + interval '30 seconds' then
        raise exception 'creator_learning_reaction_evidence_mismatch' using errcode = '23514';
      end if;
      target.reaction_message_id := p_reaction_message_id;
      target.reaction_at := reaction_time;
    end if;
  end if;

  if p_purchase_event_id is not null then
    if target.purchase_event_id is not null and target.purchase_event_id <> p_purchase_event_id then
      raise exception 'creator_learning_purchase_conflict' using errcode = '40001';
    end if;
    if target.purchase_event_id is null then
      select e.occurred_at,e.evidence_reference into purchase_time,purchase_reference
      from public.creator_commercial_events e
      where e.id=p_purchase_event_id
        and e.workspace_id=target.workspace_id
        and e.creator_id=target.creator_id
        and e.contact_id=target.contact_id
        and (e.conversation_id is null or e.conversation_id=target.conversation_id)
        and e.kind='purchase'
        and e.confirmed_at is not null;
      if not found or purchase_time < target.confirmed_at then
        raise exception 'creator_learning_purchase_evidence_mismatch' using errcode = '23514';
      end if;
      target.purchase_event_id := p_purchase_event_id;
      target.purchase_at := purchase_time;
      target.purchase_evidence_reference := purchase_reference;
    end if;
  end if;

  update public.creator_confirmed_chat_learning
  set reaction_message_id=target.reaction_message_id,
      reaction_at=target.reaction_at,
      purchase_event_id=target.purchase_event_id,
      purchase_at=target.purchase_at,
      purchase_evidence_reference=target.purchase_evidence_reference,
      updated_at=now()
  where proposal_id=target.proposal_id;

  return jsonb_build_object(
    'proposalId',target.proposal_id,
    'reactionLinked',target.reaction_message_id is not null,
    'purchaseLinked',target.purchase_event_id is not null
  );
end $$;
revoke all on function public.link_creator_confirmed_chat_outcomes(uuid,uuid,uuid,uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.link_creator_confirmed_chat_outcomes(uuid,uuid,uuid,uuid,uuid)
  to authenticated;

commit;