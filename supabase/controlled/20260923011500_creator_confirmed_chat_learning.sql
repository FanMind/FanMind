-- Controlled Creator confirmed-chat learning persistence contract.
-- Repository-only preparation: normal deploys MUST NOT apply this file.
-- Apply only through a separately authorized, exact-target, fail-closed rollout.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.creator_confirmed_chat_learning (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  creator_id uuid not null,
  contact_id uuid not null,
  conversation_id uuid not null,
  proposal_id uuid not null,
  generation_id uuid not null,
  creator_revision integer not null check (creator_revision > 0),
  prompt_revision text not null check (length(btrim(prompt_revision)) between 1 and 120),
  selected_variant text not null check (selected_variant in ('recommended','softer','stronger')),
  proposed_text text not null check (length(btrim(proposed_text)) between 1 and 4000),
  generated_at timestamptz not null,
  outbound_message_id uuid,
  actual_text text check (actual_text is null or length(btrim(actual_text)) between 1 and 4000),
  outbound_confirmed_at timestamptz,
  outbound_confirmed_by uuid references auth.users(id) on delete set null,
  reaction_message_id uuid,
  reaction_occurred_at timestamptz,
  purchase_event_id uuid,
  purchase_evidence_reference text check (purchase_evidence_reference is null or length(btrim(purchase_evidence_reference)) between 1 and 200),
  purchase_occurred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id,creator_id) references public.creators(workspace_id,id) on delete cascade,
  foreign key (workspace_id,contact_id) references public.contacts(workspace_id,id) on delete cascade,
  foreign key (workspace_id,contact_id,conversation_id) references public.conversations(workspace_id,contact_id,id) on delete cascade,
  unique (workspace_id,proposal_id),
  unique (workspace_id,generation_id),
  check (
    (outbound_message_id is null and actual_text is null and outbound_confirmed_at is null)
    or
    (outbound_message_id is not null and actual_text is not null and outbound_confirmed_at is not null)
  ),
  check ((reaction_message_id is null) = (reaction_occurred_at is null)),
  check ((purchase_event_id is null) = (purchase_evidence_reference is null)
         and (purchase_event_id is null) = (purchase_occurred_at is null)),
  check (reaction_message_id is null or outbound_message_id is not null),
  check (purchase_event_id is null or outbound_message_id is not null),
  check (outbound_confirmed_at is null or outbound_confirmed_at >= generated_at),
  check (reaction_occurred_at is null or reaction_occurred_at >= outbound_confirmed_at),
  check (purchase_occurred_at is null or purchase_occurred_at >= outbound_confirmed_at)
);

create unique index creator_confirmed_chat_outbound_message_unique_idx
  on public.creator_confirmed_chat_learning(workspace_id,outbound_message_id)
  where outbound_message_id is not null;
create unique index creator_confirmed_chat_reaction_message_unique_idx
  on public.creator_confirmed_chat_learning(workspace_id,reaction_message_id)
  where reaction_message_id is not null;
create unique index creator_confirmed_chat_purchase_event_unique_idx
  on public.creator_confirmed_chat_learning(workspace_id,purchase_event_id)
  where purchase_event_id is not null;
create index creator_confirmed_chat_scope_created_idx
  on public.creator_confirmed_chat_learning(workspace_id,creator_id,contact_id,created_at desc);

alter table public.creator_confirmed_chat_learning enable row level security;
revoke all on public.creator_confirmed_chat_learning from public, anon, authenticated, service_role;
grant select on public.creator_confirmed_chat_learning to authenticated;
grant all on public.creator_confirmed_chat_learning to service_role;
create policy creator_confirmed_chat_learning_member_read
  on public.creator_confirmed_chat_learning for select to authenticated
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

-- Monotonic evidence writer. A proposal may advance from proposal-only to
-- confirmed outbound, reaction and explicitly linked purchase, but existing
-- evidence cannot be retracted or rewritten. Browser callers cannot choose the
-- actor: auth.uid() is written by this definer after the owner/scope checks.
create function public.record_creator_confirmed_chat_learning(
  p_workspace_id uuid,
  p_contact_id uuid,
  p_record jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  proposal jsonb;
  outbound jsonb;
  reaction jsonb;
  purchase jsonb;
  attribution jsonb;
  target_creator uuid;
  target_conversation uuid;
  target_proposal uuid;
  target_generation uuid;
  target_creator_revision integer;
  target_prompt_revision text;
  target_variant text;
  target_proposed_text text;
  target_generated_at timestamptz;
  outbound_id uuid;
  outbound_text text;
  outbound_at timestamptz;
  reaction_id uuid;
  reaction_at timestamptz;
  purchase_id uuid;
  purchase_evidence text;
  purchase_at timestamptz;
  has_outbound boolean := false;
  has_reaction boolean := false;
  has_purchase boolean := false;
  existing public.creator_confirmed_chat_learning%rowtype;
begin
  if actor is null then
    raise exception 'creator_learning_actor_required' using errcode='42501';
  end if;
  if not public.creator_workspace_access_allowed(p_workspace_id) then
    raise exception 'workspace_inactive' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.workspaces w
    where w.id = p_workspace_id and w.owner_user_id = actor
  ) then
    raise exception 'creator_owner_required' using errcode='42501';
  end if;
  if p_record is null or jsonb_typeof(p_record) <> 'object' then
    raise exception 'creator_learning_record_required' using errcode='23514';
  end if;

  proposal := p_record->'proposal';
  if proposal is null or proposal = 'null'::jsonb or jsonb_typeof(proposal) <> 'object' then
    raise exception 'creator_learning_proposal_required' using errcode='23514';
  end if;

  target_creator := (proposal->>'creatorId')::uuid;
  target_conversation := (proposal->>'conversationId')::uuid;
  target_proposal := (proposal->>'proposalId')::uuid;
  target_generation := (proposal->>'generationId')::uuid;
  target_creator_revision := (proposal->>'creatorRevision')::integer;
  target_prompt_revision := btrim(proposal->>'promptRevision');
  target_variant := proposal->>'selectedVariant';
  target_proposed_text := btrim(proposal->>'proposedText');
  target_generated_at := (proposal->>'generatedAt')::timestamptz;

  if (proposal->>'workspaceId')::uuid <> p_workspace_id
     or (proposal->>'contactId')::uuid <> p_contact_id then
    raise exception 'creator_learning_scope_mismatch' using errcode='23514';
  end if;
  if target_creator_revision <= 0
     or length(target_prompt_revision) not between 1 and 120
     or target_variant not in ('recommended','softer','stronger')
     or length(target_proposed_text) not between 1 and 4000
     or target_generated_at > now() + interval '30 seconds' then
    raise exception 'creator_learning_proposal_invalid' using errcode='23514';
  end if;
  if not exists (
    select 1 from public.creators c
    where c.workspace_id = p_workspace_id and c.id = target_creator
  ) then
    raise exception 'creator_learning_creator_mismatch' using errcode='23514';
  end if;
  if not exists (
    select 1 from public.contacts c
    where c.workspace_id = p_workspace_id and c.id = p_contact_id
  ) then
    raise exception 'creator_learning_contact_mismatch' using errcode='23514';
  end if;
  if not exists (
    select 1 from public.conversations c
    where c.workspace_id = p_workspace_id
      and c.contact_id = p_contact_id
      and c.id = target_conversation
  ) then
    raise exception 'creator_learning_conversation_mismatch' using errcode='23514';
  end if;

  has_outbound := p_record ? 'outbound'
    and p_record->'outbound' is not null
    and p_record->'outbound' <> 'null'::jsonb;
  if has_outbound then
    outbound := p_record->'outbound';
    if jsonb_typeof(outbound) <> 'object' then
      raise exception 'creator_learning_outbound_invalid' using errcode='23514';
    end if;
    if (outbound->>'workspaceId')::uuid <> p_workspace_id
       or (outbound->>'creatorId')::uuid <> target_creator
       or (outbound->>'contactId')::uuid <> p_contact_id
       or (outbound->>'conversationId')::uuid <> target_conversation
       or (outbound->>'proposalId')::uuid <> target_proposal
       or (outbound->>'generationId')::uuid <> target_generation
       or (outbound->>'creatorRevision')::integer <> target_creator_revision
       or btrim(outbound->>'promptRevision') <> target_prompt_revision
       or (outbound->>'confirmedBy')::uuid <> actor then
      raise exception 'creator_learning_outbound_binding_mismatch' using errcode='23514';
    end if;
    outbound_id := (outbound->>'messageId')::uuid;
    outbound_text := btrim(outbound->>'actualText');
    outbound_at := (outbound->>'confirmedAt')::timestamptz;
    if length(outbound_text) not between 1 and 4000
       or outbound_at < target_generated_at
       or outbound_at > now() + interval '30 seconds' then
      raise exception 'creator_learning_outbound_invalid' using errcode='23514';
    end if;
  end if;

  has_reaction := p_record ? 'reaction'
    and p_record->'reaction' is not null
    and p_record->'reaction' <> 'null'::jsonb;
  if has_reaction then
    if not has_outbound then
      raise exception 'creator_learning_reaction_without_outbound' using errcode='23514';
    end if;
    reaction := p_record->'reaction';
    if jsonb_typeof(reaction) <> 'object'
       or (reaction->>'workspaceId')::uuid <> p_workspace_id
       or (reaction->>'creatorId')::uuid <> target_creator
       or (reaction->>'contactId')::uuid <> p_contact_id
       or (reaction->>'conversationId')::uuid <> target_conversation
       or (reaction->>'reactedToMessageId')::uuid <> outbound_id then
      raise exception 'creator_learning_reaction_binding_mismatch' using errcode='23514';
    end if;
    reaction_id := (reaction->>'messageId')::uuid;
    reaction_at := (reaction->>'occurredAt')::timestamptz;
    if reaction_at < outbound_at or reaction_at > now() + interval '30 seconds' then
      raise exception 'creator_learning_reaction_invalid' using errcode='23514';
    end if;
  end if;

  has_purchase := p_record ? 'purchase'
    and p_record->'purchase' is not null
    and p_record->'purchase' <> 'null'::jsonb;
  if has_purchase then
    if not has_outbound then
      raise exception 'creator_learning_purchase_without_outbound' using errcode='23514';
    end if;
    purchase := p_record->'purchase';
    attribution := purchase->'attribution';
    if jsonb_typeof(purchase) <> 'object'
       or jsonb_typeof(attribution) <> 'object'
       or (purchase->>'workspaceId')::uuid <> p_workspace_id
       or (purchase->>'creatorId')::uuid <> target_creator
       or (purchase->>'contactId')::uuid <> p_contact_id
       or (purchase->>'conversationId')::uuid <> target_conversation
       or (attribution->>'proposalId')::uuid <> target_proposal
       or (attribution->>'generationId')::uuid <> target_generation
       or (attribution->>'creatorRevision')::integer <> target_creator_revision
       or btrim(attribution->>'promptRevision') <> target_prompt_revision
       or (attribution->>'outboundMessageId')::uuid <> outbound_id then
      raise exception 'creator_learning_purchase_binding_mismatch' using errcode='23514';
    end if;
    purchase_id := (purchase->>'commercialEventId')::uuid;
    purchase_evidence := btrim(purchase->>'evidenceReference');
    purchase_at := (purchase->>'occurredAt')::timestamptz;
    if length(purchase_evidence) not between 1 and 200
       or purchase_at < outbound_at
       or purchase_at > now() + interval '30 seconds' then
      raise exception 'creator_learning_purchase_invalid' using errcode='23514';
    end if;
    if not exists (
      select 1 from public.creator_commercial_events e
      where e.id = purchase_id
        and e.workspace_id = p_workspace_id
        and e.creator_id = target_creator
        and e.contact_id = p_contact_id
        and e.kind = 'purchase'
        and e.evidence_reference = purchase_evidence
        and e.occurred_at = purchase_at
    ) then
      raise exception 'creator_learning_purchase_evidence_missing' using errcode='23514';
    end if;
  end if;

  insert into public.creator_confirmed_chat_learning (
    workspace_id, creator_id, contact_id, conversation_id,
    proposal_id, generation_id, creator_revision, prompt_revision,
    selected_variant, proposed_text, generated_at,
    outbound_message_id, actual_text, outbound_confirmed_at, outbound_confirmed_by,
    reaction_message_id, reaction_occurred_at,
    purchase_event_id, purchase_evidence_reference, purchase_occurred_at
  ) values (
    p_workspace_id, target_creator, p_contact_id, target_conversation,
    target_proposal, target_generation, target_creator_revision, target_prompt_revision,
    target_variant, target_proposed_text, target_generated_at,
    case when has_outbound then outbound_id end,
    case when has_outbound then outbound_text end,
    case when has_outbound then outbound_at end,
    case when has_outbound then actor end,
    case when has_reaction then reaction_id end,
    case when has_reaction then reaction_at end,
    case when has_purchase then purchase_id end,
    case when has_purchase then purchase_evidence end,
    case when has_purchase then purchase_at end
  ) on conflict (workspace_id,proposal_id) do nothing;

  select * into strict existing
  from public.creator_confirmed_chat_learning
  where workspace_id = p_workspace_id and proposal_id = target_proposal
  for update;

  if existing.creator_id <> target_creator
     or existing.contact_id <> p_contact_id
     or existing.conversation_id <> target_conversation
     or existing.generation_id <> target_generation
     or existing.creator_revision <> target_creator_revision
     or existing.prompt_revision <> target_prompt_revision
     or existing.selected_variant <> target_variant
     or existing.proposed_text <> target_proposed_text
     or existing.generated_at <> target_generated_at then
    raise exception 'creator_learning_proposal_rewrite' using errcode='23514';
  end if;

  if existing.outbound_message_id is not null and not has_outbound then
    raise exception 'creator_learning_outbound_retraction' using errcode='23514';
  end if;
  if existing.outbound_message_id is not null and (
       existing.outbound_message_id <> outbound_id
       or existing.actual_text <> outbound_text
       or existing.outbound_confirmed_at <> outbound_at
     ) then
    raise exception 'creator_learning_outbound_rewrite' using errcode='23514';
  end if;
  if existing.reaction_message_id is not null and not has_reaction then
    raise exception 'creator_learning_reaction_retraction' using errcode='23514';
  end if;
  if existing.reaction_message_id is not null and (
       existing.reaction_message_id <> reaction_id
       or existing.reaction_occurred_at <> reaction_at
     ) then
    raise exception 'creator_learning_reaction_rewrite' using errcode='23514';
  end if;
  if existing.purchase_event_id is not null and not has_purchase then
    raise exception 'creator_learning_purchase_retraction' using errcode='23514';
  end if;
  if existing.purchase_event_id is not null and (
       existing.purchase_event_id <> purchase_id
       or existing.purchase_evidence_reference <> purchase_evidence
       or existing.purchase_occurred_at <> purchase_at
     ) then
    raise exception 'creator_learning_purchase_rewrite' using errcode='23514';
  end if;

  update public.creator_confirmed_chat_learning set
    outbound_message_id = coalesce(outbound_message_id, case when has_outbound then outbound_id end),
    actual_text = coalesce(actual_text, case when has_outbound then outbound_text end),
    outbound_confirmed_at = coalesce(outbound_confirmed_at, case when has_outbound then outbound_at end),
    outbound_confirmed_by = coalesce(outbound_confirmed_by, case when has_outbound then actor end),
    reaction_message_id = coalesce(reaction_message_id, case when has_reaction then reaction_id end),
    reaction_occurred_at = coalesce(reaction_occurred_at, case when has_reaction then reaction_at end),
    purchase_event_id = coalesce(purchase_event_id, case when has_purchase then purchase_id end),
    purchase_evidence_reference = coalesce(purchase_evidence_reference, case when has_purchase then purchase_evidence end),
    purchase_occurred_at = coalesce(purchase_occurred_at, case when has_purchase then purchase_at end),
    updated_at = case
      when (outbound_message_id is null and has_outbound)
        or (reaction_message_id is null and has_reaction)
        or (purchase_event_id is null and has_purchase)
      then now() else updated_at end
  where id = existing.id;

  return existing.id;
end $$;

revoke all on function public.record_creator_confirmed_chat_learning(uuid,uuid,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.record_creator_confirmed_chat_learning(uuid,uuid,jsonb)
  to authenticated;

commit;
