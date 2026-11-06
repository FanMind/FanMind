begin;

-- Controlled, one-time upgrade for the dormant AI add-on lifecycle. This file
-- is intentionally outside supabase/migrations: a Web deploy or generic
-- `supabase db push` must never apply it.

alter table public.workspace_ai_tier_entitlements
  add column stripe_sync_state text not null
    default 'reconciliation_needed',
  add column stripe_sync_revision bigint not null default 0;

alter table public.workspace_ai_tier_entitlements
  add constraint workspace_ai_tier_entitlements_sync_state_check
    check (stripe_sync_state in ('in_sync', 'reconciliation_needed')),
  add constraint workspace_ai_tier_entitlements_sync_revision_check
    check (stripe_sync_revision >= 0);

-- A provider request ID makes every explicit reconciliation replay-safe. The
-- raw Stripe response and its customer data are never stored.
create table public.workspace_ai_tier_stripe_reconciliations (
  stripe_request_id text primary key,
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null,
  previous_stripe_subscription_id text,
  snapshot_observed_at timestamptz not null,
  snapshot_event_created_cutoff bigint not null,
  snapshot_fingerprint text not null,
  expected_revision bigint not null,
  resulting_revision bigint not null,
  snapshot_kind text not null,
  created_at timestamptz not null default statement_timestamp(),
  constraint workspace_ai_tier_reconciliations_request_check
    check (stripe_request_id ~ '^req_[A-Za-z0-9_]+$'),
  constraint workspace_ai_tier_reconciliations_customer_check
    check (stripe_customer_id ~ '^cus_[A-Za-z0-9_]+$'),
  constraint workspace_ai_tier_reconciliations_subscription_check
    check (stripe_subscription_id ~ '^sub_[A-Za-z0-9_]+$'),
  constraint workspace_ai_tier_reconciliations_previous_subscription_check
    check (
      previous_stripe_subscription_id is null
      or previous_stripe_subscription_id ~ '^sub_[A-Za-z0-9_]+$'
    ),
  constraint workspace_ai_tier_reconciliations_cutoff_check
    check (snapshot_event_created_cutoff >= 0),
  constraint workspace_ai_tier_reconciliations_fingerprint_check
    check (snapshot_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint workspace_ai_tier_reconciliations_revision_check
    check (
      expected_revision >= 0
      and resulting_revision = expected_revision + 1
    ),
  constraint workspace_ai_tier_reconciliations_kind_check
    check (snapshot_kind in ('paid_item', 'no_paid_item'))
);

create index workspace_ai_tier_reconciliations_workspace_idx
  on public.workspace_ai_tier_stripe_reconciliations
    (workspace_id, created_at desc);

create table public.workspace_ai_tier_stripe_events (
  event_id text primary key,
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  event_created_at bigint not null,
  event_type text not null,
  stripe_customer_id text not null,
  stripe_subscription_id text not null,
  payload_fingerprint text not null,
  has_paid_item boolean not null,
  tier_id text,
  lifecycle_status text,
  stripe_subscription_item_id text,
  stripe_price_id text,
  effective_at timestamptz,
  expires_at timestamptz,
  processing_state text not null,
  processing_reason text,
  projection_revision bigint not null,
  signature_verified_at timestamptz not null default statement_timestamp(),
  processed_at timestamptz,
  reconciled_by_request_id text
    references public.workspace_ai_tier_stripe_reconciliations(
      stripe_request_id
    ) on delete restrict,
  constraint workspace_ai_tier_events_id_check
    check (event_id ~ '^evt_[A-Za-z0-9_]+$'),
  constraint workspace_ai_tier_events_created_check
    check (event_created_at >= 0),
  constraint workspace_ai_tier_events_type_check
    check (
      event_type in (
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted'
      )
    ),
  constraint workspace_ai_tier_events_customer_check
    check (stripe_customer_id ~ '^cus_[A-Za-z0-9_]+$'),
  constraint workspace_ai_tier_events_subscription_check
    check (stripe_subscription_id ~ '^sub_[A-Za-z0-9_]+$'),
  constraint workspace_ai_tier_events_fingerprint_check
    check (payload_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint workspace_ai_tier_events_projection_check
    check (
      (
        has_paid_item
        and tier_id in ('plus', 'ultra')
        and lifecycle_status in (
          'active', 'pending', 'paused', 'canceled', 'expired'
        )
        and stripe_subscription_item_id ~ '^si_[A-Za-z0-9_]+$'
        and stripe_price_id ~ '^price_[A-Za-z0-9_]+$'
        and effective_at is not null
        and (expires_at is null or expires_at > effective_at)
      )
      or
      (
        not has_paid_item
        and tier_id is null
        and lifecycle_status is null
        and stripe_subscription_item_id is null
        and stripe_price_id is null
        and effective_at is null
        and expires_at is null
      )
    ),
  constraint workspace_ai_tier_events_processing_check
    check (
      (processing_state = 'received' and processing_reason is null)
      or (processing_state = 'applied' and processing_reason is null)
      or (
        processing_state = 'ignored'
        and processing_reason in (
          'duplicate_event', 'stale_event', 'unrelated_price'
        )
      )
      or (
        processing_state = 'reconciliation_needed'
        and processing_reason in (
          'event_identity',
          'event_order_conflict',
          'reconciliation_pending',
          'subscription_mismatch'
        )
      )
    ),
  constraint workspace_ai_tier_events_revision_check
    check (projection_revision >= 0),
  constraint workspace_ai_tier_events_processed_check
    check (
      (processing_state = 'received' and processed_at is null)
      or (processing_state <> 'received' and processed_at is not null)
    )
);

create index workspace_ai_tier_events_workspace_order_idx
  on public.workspace_ai_tier_stripe_events
    (workspace_id, event_created_at desc, event_id);

create index workspace_ai_tier_events_subscription_order_idx
  on public.workspace_ai_tier_stripe_events
    (stripe_subscription_id, event_created_at desc, event_id);

create index workspace_ai_tier_events_reconciliation_idx
  on public.workspace_ai_tier_stripe_events
    (workspace_id, event_created_at, event_id)
  where processing_state = 'reconciliation_needed'
    and reconciled_by_request_id is null;

alter table public.workspace_ai_tier_stripe_reconciliations
  enable row level security;
alter table public.workspace_ai_tier_stripe_reconciliations
  force row level security;
alter table public.workspace_ai_tier_stripe_events
  enable row level security;
alter table public.workspace_ai_tier_stripe_events
  force row level security;

revoke all on table public.workspace_ai_tier_stripe_reconciliations
  from public, anon, authenticated, service_role;
revoke all on table public.workspace_ai_tier_stripe_events
  from public, anon, authenticated, service_role;

-- Runtime reads retain the redacted entitlement loader, but every write moves
-- behind the two atomic RPCs below.
revoke insert, update, delete
  on table public.workspace_ai_tier_entitlements
  from service_role;
do $revoke_projection_columns$
declare
  v_all_columns text;
begin
  select string_agg(
    format('%I', attribute.attname),
    ', ' order by attribute.attnum
  )
    into v_all_columns
    from pg_attribute as attribute
   where attribute.attrelid =
         'public.workspace_ai_tier_entitlements'::regclass
     and attribute.attnum > 0
     and not attribute.attisdropped;
  if v_all_columns is null then
    raise exception using
      errcode = '55000',
      message = 'workspace_ai_tier_ledger_projection_columns_missing';
  end if;
  execute format(
    'revoke insert (%1$s), update (%1$s), references (%1$s) on table public.workspace_ai_tier_entitlements from service_role',
    v_all_columns
  );
end
$revoke_projection_columns$;
grant select
  on table public.workspace_ai_tier_entitlements
  to service_role;

create function public.apply_workspace_ai_tier_stripe_event(
  p_workspace_id uuid,
  p_signature_verified boolean,
  p_event_id text,
  p_event_created_at bigint,
  p_event_type text,
  p_customer_id text,
  p_subscription_id text,
  p_payload_fingerprint text,
  p_has_paid_item boolean,
  p_tier_id text,
  p_lifecycle_status text,
  p_subscription_item_id text,
  p_price_id text,
  p_effective_at timestamptz,
  p_expires_at timestamptz
)
returns table (
  result_status text,
  result_reason text,
  result_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_inserted_event boolean;
  v_existing_event public.workspace_ai_tier_stripe_events%rowtype;
  v_current public.workspace_ai_tier_entitlements%rowtype;
  v_workspace_customer_id text;
  v_workspace_subscription_id text;
  v_expected_revision bigint;
  v_rows bigint;
  v_identity_conflict boolean := false;
  v_same_second_conflict boolean;
  v_unresolved_conflict boolean;
  v_latest_ledger_created_at bigint;
  v_latest_reconciliation_cutoff bigint;
  v_canonical_previous_subscription_event boolean := false;
  v_conflict_reason text;
begin
  if p_signature_verified is distinct from true then
    raise exception using
      errcode = '22023',
      message = 'workspace_ai_tier_event_signature_unverified';
  end if;

  if p_event_id is null
     or p_event_id !~ '^evt_[A-Za-z0-9_]+$'
     or p_event_created_at is null
     or p_event_created_at < 0
     or p_event_type is null
     or p_event_type not in (
       'customer.subscription.created',
       'customer.subscription.updated',
       'customer.subscription.deleted'
     )
     or p_customer_id is null
     or p_customer_id !~ '^cus_[A-Za-z0-9_]+$'
     or p_subscription_id is null
     or p_subscription_id !~ '^sub_[A-Za-z0-9_]+$'
     or p_payload_fingerprint is null
     or p_payload_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception using
      errcode = '22023',
      message = 'workspace_ai_tier_event_identity_invalid';
  end if;

  if p_has_paid_item is null or (
    p_has_paid_item and (
      p_tier_id is null
      or p_tier_id not in ('plus', 'ultra')
      or p_lifecycle_status is null
      or p_lifecycle_status not in (
        'active', 'pending', 'paused', 'canceled', 'expired'
      )
      or p_subscription_item_id is null
      or p_subscription_item_id !~ '^si_[A-Za-z0-9_]+$'
      or p_price_id is null
      or p_price_id !~ '^price_[A-Za-z0-9_]+$'
      or p_effective_at is null
      or (p_expires_at is not null and p_expires_at <= p_effective_at)
    )
  ) or (
    not p_has_paid_item and (
      p_tier_id is not null
      or p_lifecycle_status is not null
      or p_subscription_item_id is not null
      or p_price_id is not null
      or p_effective_at is not null
      or p_expires_at is not null
    )
  ) then
    raise exception using
      errcode = '22023',
      message = 'workspace_ai_tier_event_projection_invalid';
  end if;

  -- Lock the tenant before inserting either FK row. All events for a
  -- Workspace therefore share one short, deterministic serialization point;
  -- this also avoids concurrent foreign-key lock upgrades. No provider call
  -- is made while the lock is held.
  select workspace.stripe_customer_id, workspace.stripe_subscription_id
    into v_workspace_customer_id, v_workspace_subscription_id
    from public.workspaces as workspace
   where workspace.id = p_workspace_id
   for update;
  if not found
     or v_workspace_customer_id is distinct from p_customer_id then
    raise exception using
      errcode = '23514',
      message = 'workspace_ai_tier_event_workspace_binding_invalid';
  end if;
  if v_workspace_subscription_id is distinct from p_subscription_id then
    select exists (
      select 1
        from public.workspace_ai_tier_stripe_reconciliations as reconciliation
       where reconciliation.workspace_id = p_workspace_id
         and reconciliation.stripe_customer_id = p_customer_id
         and reconciliation.stripe_subscription_id =
             v_workspace_subscription_id
         and reconciliation.previous_stripe_subscription_id =
             p_subscription_id
    ) into v_canonical_previous_subscription_event;
    if not v_canonical_previous_subscription_event then
      raise exception using
        errcode = '23514',
        message = 'workspace_ai_tier_event_workspace_binding_invalid';
    end if;
  end if;

  -- The event primary key is the second serialization boundary. Concurrent
  -- deliveries of one signed event become an exact idempotent replay; event
  -- IDs are never sorted to invent an order.
  insert into public.workspace_ai_tier_stripe_events (
    event_id,
    workspace_id,
    event_created_at,
    event_type,
    stripe_customer_id,
    stripe_subscription_id,
    payload_fingerprint,
    has_paid_item,
    tier_id,
    lifecycle_status,
    stripe_subscription_item_id,
    stripe_price_id,
    effective_at,
    expires_at,
    processing_state,
    processing_reason,
    projection_revision
  ) values (
    p_event_id,
    p_workspace_id,
    p_event_created_at,
    p_event_type,
    p_customer_id,
    p_subscription_id,
    p_payload_fingerprint,
    p_has_paid_item,
    p_tier_id,
    p_lifecycle_status,
    p_subscription_item_id,
    p_price_id,
    p_effective_at,
    p_expires_at,
    'received',
    null,
    0
  )
  on conflict (event_id) do nothing;
  get diagnostics v_rows = row_count;
  v_inserted_event := v_rows = 1;

  if not v_inserted_event then
    select event.*
      into strict v_existing_event
      from public.workspace_ai_tier_stripe_events as event
     where event.event_id = p_event_id;

    if v_existing_event.workspace_id = p_workspace_id
       and v_existing_event.event_created_at = p_event_created_at
       and v_existing_event.event_type = p_event_type
       and v_existing_event.stripe_customer_id = p_customer_id
       and v_existing_event.stripe_subscription_id = p_subscription_id
       and v_existing_event.payload_fingerprint = p_payload_fingerprint then
      result_revision := v_existing_event.projection_revision;
      if v_existing_event.processing_state = 'reconciliation_needed'
         and v_existing_event.reconciled_by_request_id is null then
        result_status := 'reconciliation_needed';
        result_reason := v_existing_event.processing_reason;
      else
        result_status := 'ignored';
        result_reason := 'duplicate_event';
      end if;
      return next;
      return;
    end if;
    v_identity_conflict := true;
  end if;

  -- Lock order is Workspace -> event identity -> entitlement.
  select entitlement.*
    into v_current
    from public.workspace_ai_tier_entitlements as entitlement
   where entitlement.workspace_id = p_workspace_id
   for update;

  if found then
    v_expected_revision := v_current.stripe_sync_revision;
  else
    v_expected_revision := 0;
  end if;

  -- The entitlement row is not the only ordering boundary: a complete
  -- Starter-only event is deliberately ledgered without creating a paid
  -- projection. Compare against that durable history as well, otherwise a
  -- paid event from the same Stripe second could bypass conflict handling.
  select
    exists (
      select 1
        from public.workspace_ai_tier_stripe_events as prior
       where prior.workspace_id = p_workspace_id
         and prior.stripe_subscription_id = p_subscription_id
         and prior.event_id <> p_event_id
         and prior.event_created_at = p_event_created_at
    ),
    exists (
      select 1
        from public.workspace_ai_tier_stripe_events as prior
       where prior.workspace_id = p_workspace_id
         and prior.stripe_subscription_id = p_subscription_id
         and prior.event_id <> p_event_id
         and prior.processing_state = 'reconciliation_needed'
         and prior.reconciled_by_request_id is null
    ),
    max(prior_event.event_created_at)
    into
      v_same_second_conflict,
      v_unresolved_conflict,
      v_latest_ledger_created_at
    from public.workspace_ai_tier_stripe_events as prior_event
   where prior_event.workspace_id = p_workspace_id
     and prior_event.stripe_subscription_id = p_subscription_id
     and prior_event.event_id <> p_event_id;

  -- A canonical reconciliation receipt is also an ordering boundary. This
  -- remains effective when a Starter-only snapshot intentionally has no paid
  -- entitlement row on which to persist last_stripe_event_created_at.
  select max(reconciliation.snapshot_event_created_cutoff)
    into v_latest_reconciliation_cutoff
    from public.workspace_ai_tier_stripe_reconciliations as reconciliation
   where reconciliation.workspace_id = p_workspace_id
     and reconciliation.stripe_customer_id = p_customer_id;

  if v_identity_conflict then
    -- A reused Stripe event ID is durable reconciliation evidence, not only
    -- a transient return value. Preserve that conflict on the original event
    -- and fail-close both the requested tenant and the tenant already bound
    -- to the event. This also gives the canonical reconciliation RPC a real
    -- unresolved row to consume instead of leaving it permanently blocked.
    update public.workspace_ai_tier_stripe_events
       set processing_state = 'reconciliation_needed',
           processing_reason = 'event_identity',
           processed_at = statement_timestamp(),
           reconciled_by_request_id = null
     where event_id = p_event_id;

    update public.workspace_ai_tier_entitlements
       set stripe_sync_state = 'reconciliation_needed',
           stripe_sync_revision = stripe_sync_revision + 1
     where workspace_id in (
       p_workspace_id,
       v_existing_event.workspace_id
     );

    select entitlement.stripe_sync_revision
      into result_revision
      from public.workspace_ai_tier_entitlements as entitlement
     where entitlement.workspace_id = p_workspace_id;
    result_revision := coalesce(result_revision, 0);
    result_status := 'reconciliation_needed';
    result_reason := 'event_identity';
    return next;
    return;
  end if;

  if v_current.workspace_id is not null
     and v_current.last_stripe_event_id = p_event_id then
    update public.workspace_ai_tier_stripe_events
       set processing_state = 'ignored',
           processing_reason = 'duplicate_event',
           projection_revision = v_expected_revision,
           processed_at = statement_timestamp()
     where event_id = p_event_id;
    result_status := 'ignored';
    result_reason := 'duplicate_event';
    result_revision := v_expected_revision;
    return next;
    return;
  end if;

  if (
       v_canonical_previous_subscription_event
     ) or (
       v_current.workspace_id is not null
       and p_event_created_at < v_current.last_stripe_event_created_at
     ) or (
       v_latest_ledger_created_at is not null
       and p_event_created_at < v_latest_ledger_created_at
     ) or (
       v_latest_reconciliation_cutoff is not null
       and p_event_created_at < v_latest_reconciliation_cutoff
     ) then
    update public.workspace_ai_tier_stripe_events
       set processing_state = 'ignored',
           processing_reason = 'stale_event',
           projection_revision = v_expected_revision,
           processed_at = statement_timestamp()
     where event_id = p_event_id;
    result_status := 'ignored';
    result_reason := 'stale_event';
    result_revision := v_expected_revision;
    return next;
    return;
  end if;

  if v_current.workspace_id is not null
     and v_current.stripe_subscription_id <> p_subscription_id then
    update public.workspace_ai_tier_entitlements
       set stripe_sync_state = 'reconciliation_needed',
           stripe_sync_revision = stripe_sync_revision + 1
     where workspace_id = p_workspace_id
       and stripe_sync_revision = v_expected_revision;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception using
        errcode = '40001',
        message = 'workspace_ai_tier_event_cas_failed';
    end if;
    result_revision := v_expected_revision + 1;
    update public.workspace_ai_tier_stripe_events
       set processing_state = 'reconciliation_needed',
           processing_reason = 'subscription_mismatch',
           projection_revision = result_revision,
           processed_at = statement_timestamp()
     where event_id = p_event_id;
    result_status := 'reconciliation_needed';
    result_reason := 'subscription_mismatch';
    return next;
    return;
  end if;

  if v_same_second_conflict or (
    v_current.workspace_id is not null
    and p_event_created_at = v_current.last_stripe_event_created_at
  ) or (
    v_latest_reconciliation_cutoff is not null
    and p_event_created_at = v_latest_reconciliation_cutoff
  ) then
    v_conflict_reason := 'event_order_conflict';
  elsif v_unresolved_conflict or (
    v_current.workspace_id is not null
    and v_current.stripe_sync_state = 'reconciliation_needed'
  ) then
    v_conflict_reason := 'reconciliation_pending';
  end if;

  if v_conflict_reason is not null then
    if v_current.workspace_id is not null and (
      v_conflict_reason = 'event_order_conflict'
      or v_current.stripe_sync_state <> 'reconciliation_needed'
    ) then
      update public.workspace_ai_tier_entitlements
         set stripe_sync_state = 'reconciliation_needed',
             stripe_sync_revision = stripe_sync_revision + 1
       where workspace_id = p_workspace_id
         and stripe_sync_revision = v_expected_revision;
      get diagnostics v_rows = row_count;
      if v_rows <> 1 then
        raise exception using
          errcode = '40001',
          message = 'workspace_ai_tier_event_cas_failed';
      end if;
      result_revision := v_expected_revision + 1;
    elsif v_current.workspace_id is not null then
      result_revision := v_expected_revision;
    elsif p_has_paid_item then
      -- The conflict itself must never activate a paid tier. Preserve enough
      -- normalized state for a later canonical reconciliation, but make the
      -- row immediately fail closed.
      insert into public.workspace_ai_tier_entitlements (
        workspace_id,
        tier_id,
        status,
        source,
        stripe_subscription_id,
        stripe_subscription_item_id,
        stripe_price_id,
        effective_at,
        expires_at,
        last_stripe_event_id,
        last_stripe_event_created_at,
        stripe_sync_state,
        stripe_sync_revision
      ) values (
        p_workspace_id,
        p_tier_id,
        p_lifecycle_status,
        'stripe',
        p_subscription_id,
        p_subscription_item_id,
        p_price_id,
        p_effective_at,
        p_expires_at,
        p_event_id,
        p_event_created_at,
        'reconciliation_needed',
        1
      );
      result_revision := 1;
    else
      result_revision := 0;
    end if;

    update public.workspace_ai_tier_stripe_events
       set processing_state = 'reconciliation_needed',
           processing_reason = v_conflict_reason,
           projection_revision = result_revision,
           processed_at = statement_timestamp()
     where event_id = p_event_id;
    result_status := 'reconciliation_needed';
    result_reason := v_conflict_reason;
    return next;
    return;
  end if;

  if v_current.workspace_id is null then
    if not p_has_paid_item then
      update public.workspace_ai_tier_stripe_events
         set processing_state = 'ignored',
             processing_reason = 'unrelated_price',
             projection_revision = 0,
             processed_at = statement_timestamp()
       where event_id = p_event_id;
      result_status := 'ignored';
      result_reason := 'unrelated_price';
      result_revision := 0;
      return next;
      return;
    end if;

    insert into public.workspace_ai_tier_entitlements (
      workspace_id,
      tier_id,
      status,
      source,
      stripe_subscription_id,
      stripe_subscription_item_id,
      stripe_price_id,
      effective_at,
      expires_at,
      last_stripe_event_id,
      last_stripe_event_created_at,
      stripe_sync_state,
      stripe_sync_revision
    ) values (
      p_workspace_id,
      p_tier_id,
      p_lifecycle_status,
      'stripe',
      p_subscription_id,
      p_subscription_item_id,
      p_price_id,
      p_effective_at,
      p_expires_at,
      p_event_id,
      p_event_created_at,
      'in_sync',
      1
    );
    result_revision := 1;
  elsif p_has_paid_item then
    update public.workspace_ai_tier_entitlements
       set tier_id = p_tier_id,
           status = p_lifecycle_status,
           source = 'stripe',
           stripe_subscription_id = p_subscription_id,
           stripe_subscription_item_id = p_subscription_item_id,
           stripe_price_id = p_price_id,
           effective_at = p_effective_at,
           expires_at = p_expires_at,
           last_stripe_event_id = p_event_id,
           last_stripe_event_created_at = p_event_created_at,
           stripe_sync_state = 'in_sync',
           stripe_sync_revision = stripe_sync_revision + 1
     where workspace_id = p_workspace_id
       and stripe_sync_revision = v_expected_revision;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception using
        errcode = '40001',
        message = 'workspace_ai_tier_event_cas_failed';
    end if;
    result_revision := v_expected_revision + 1;
  elsif p_event_type in (
    'customer.subscription.updated',
    'customer.subscription.deleted'
  ) then
    update public.workspace_ai_tier_entitlements
       set status = 'canceled',
           expires_at = case
             when to_timestamp(p_event_created_at) > effective_at
               then to_timestamp(p_event_created_at)
             else null
           end,
           last_stripe_event_id = p_event_id,
           last_stripe_event_created_at = p_event_created_at,
           stripe_sync_state = 'in_sync',
           stripe_sync_revision = stripe_sync_revision + 1
     where workspace_id = p_workspace_id
       and stripe_sync_revision = v_expected_revision;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception using
        errcode = '40001',
        message = 'workspace_ai_tier_event_cas_failed';
    end if;
    result_revision := v_expected_revision + 1;
  else
    update public.workspace_ai_tier_stripe_events
       set processing_state = 'ignored',
           processing_reason = 'unrelated_price',
           projection_revision = v_expected_revision,
           processed_at = statement_timestamp()
     where event_id = p_event_id;
    result_status := 'ignored';
    result_reason := 'unrelated_price';
    result_revision := v_expected_revision;
    return next;
    return;
  end if;

  update public.workspace_ai_tier_stripe_events
     set processing_state = 'applied',
         processing_reason = null,
         projection_revision = result_revision,
         processed_at = statement_timestamp()
   where event_id = p_event_id;
  result_status := 'applied';
  result_reason := null;
  return next;
end
$function$;

create function public.reconcile_workspace_ai_tier_stripe_subscription(
  p_workspace_id uuid,
  p_stripe_request_id text,
  p_customer_id text,
  p_subscription_id text,
  p_expected_previous_subscription_id text,
  p_snapshot_observed_at timestamptz,
  p_snapshot_fingerprint text,
  p_expected_revision bigint,
  p_has_paid_item boolean,
  p_tier_id text,
  p_lifecycle_status text,
  p_subscription_item_id text,
  p_price_id text,
  p_effective_at timestamptz,
  p_expires_at timestamptz
)
returns table (
  result_status text,
  result_reason text,
  result_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_existing public.workspace_ai_tier_stripe_reconciliations%rowtype;
  v_current public.workspace_ai_tier_entitlements%rowtype;
  v_workspace_customer_id text;
  v_workspace_subscription_id text;
  v_latest_unresolved_at timestamptz;
  v_latest_unresolved_created_at bigint;
  v_latest_reconciliation_cutoff bigint;
  v_snapshot_event_created_cutoff bigint;
  v_subscription_change boolean;
  v_has_current boolean;
  v_rows bigint;
begin
  if p_stripe_request_id is null
     or p_stripe_request_id !~ '^req_[A-Za-z0-9_]+$'
     or p_customer_id is null
     or p_customer_id !~ '^cus_[A-Za-z0-9_]+$'
     or p_subscription_id is null
     or p_subscription_id !~ '^sub_[A-Za-z0-9_]+$'
     or (
       p_expected_previous_subscription_id is not null
       and p_expected_previous_subscription_id !~ '^sub_[A-Za-z0-9_]+$'
     )
     or p_snapshot_fingerprint is null
     or p_snapshot_fingerprint !~ '^[a-f0-9]{64}$'
     or p_snapshot_observed_at is null
     or p_expected_revision is null
     or p_expected_revision < 0
     or p_has_paid_item is null then
    raise exception using
      errcode = '22023',
      message = 'workspace_ai_tier_reconciliation_identity_invalid';
  end if;

  v_snapshot_event_created_cutoff :=
    floor(extract(epoch from p_snapshot_observed_at))::bigint;
  if v_snapshot_event_created_cutoff < 0 then
    raise exception using
      errcode = '22023',
      message = 'workspace_ai_tier_reconciliation_snapshot_time_invalid';
  end if;

  if p_has_paid_item and (
    p_tier_id is null
    or p_tier_id not in ('plus', 'ultra')
    or p_lifecycle_status is null
    or p_lifecycle_status not in (
      'active', 'pending', 'paused', 'canceled', 'expired'
    )
    or p_subscription_item_id is null
    or p_subscription_item_id !~ '^si_[A-Za-z0-9_]+$'
    or p_price_id is null
    or p_price_id !~ '^price_[A-Za-z0-9_]+$'
    or p_effective_at is null
    or (p_expires_at is not null and p_expires_at <= p_effective_at)
  ) or (not p_has_paid_item and (
    p_tier_id is not null
    or p_lifecycle_status is not null
    or p_subscription_item_id is not null
    or p_price_id is not null
    or p_effective_at is not null
    or p_expires_at is not null
  )) then
    raise exception using
      errcode = '22023',
      message = 'workspace_ai_tier_reconciliation_projection_invalid';
  end if;

  select reconciliation.*
    into v_existing
    from public.workspace_ai_tier_stripe_reconciliations as reconciliation
   where reconciliation.stripe_request_id = p_stripe_request_id;
  if found then
    if v_existing.workspace_id = p_workspace_id
       and v_existing.stripe_customer_id = p_customer_id
       and v_existing.stripe_subscription_id = p_subscription_id
       and v_existing.previous_stripe_subscription_id is not distinct from
           p_expected_previous_subscription_id
       and v_existing.snapshot_observed_at = p_snapshot_observed_at
       and v_existing.snapshot_event_created_cutoff =
           v_snapshot_event_created_cutoff
       and v_existing.snapshot_fingerprint = p_snapshot_fingerprint
       and v_existing.expected_revision = p_expected_revision
       and v_existing.snapshot_kind = (case
         when p_has_paid_item then 'paid_item'
         else 'no_paid_item'
       end) then
      result_status := 'ignored';
      result_reason := 'duplicate_event';
      result_revision := v_existing.resulting_revision;
      return next;
      return;
    end if;
    raise exception using
      errcode = '23505',
      message = 'workspace_ai_tier_reconciliation_request_conflict';
  end if;

  select workspace.stripe_customer_id, workspace.stripe_subscription_id
    into v_workspace_customer_id, v_workspace_subscription_id
    from public.workspaces as workspace
   where workspace.id = p_workspace_id
   for update;
  if not found
     or v_workspace_customer_id is distinct from p_customer_id
     or v_workspace_subscription_id is distinct from p_subscription_id then
    raise exception using
      errcode = '23514',
      message = 'workspace_ai_tier_reconciliation_binding_invalid';
  end if;

  select entitlement.*
    into v_current
    from public.workspace_ai_tier_entitlements as entitlement
   where entitlement.workspace_id = p_workspace_id
   for update;
  v_has_current := found;
  v_subscription_change := p_expected_previous_subscription_id is not null
                           and p_expected_previous_subscription_id <>
                               p_subscription_id;

  select
    max(event.signature_verified_at),
    max(event.event_created_at)
    into v_latest_unresolved_at, v_latest_unresolved_created_at
    from public.workspace_ai_tier_stripe_events as event
   where event.workspace_id = p_workspace_id
     and event.stripe_customer_id = p_customer_id
     and event.stripe_subscription_id in (
       p_subscription_id,
       coalesce(p_expected_previous_subscription_id, p_subscription_id)
     )
     and event.processing_state = 'reconciliation_needed'
     and event.reconciled_by_request_id is null;

  select max(reconciliation.snapshot_event_created_cutoff)
    into v_latest_reconciliation_cutoff
    from public.workspace_ai_tier_stripe_reconciliations as reconciliation
   where reconciliation.workspace_id = p_workspace_id
     and reconciliation.stripe_customer_id = p_customer_id;

  if v_latest_unresolved_at is null
     or (
       v_has_current and (
         v_current.stripe_subscription_id is distinct from
             p_expected_previous_subscription_id
         or v_current.stripe_sync_state <> 'reconciliation_needed'
         or v_current.stripe_sync_revision <> p_expected_revision
       )
     )
     or (
       not v_has_current and (
         p_expected_previous_subscription_id is not null
         or p_expected_revision <> 0
         or p_has_paid_item
       )
     )
     or (
       v_subscription_change
       and not exists (
         select 1
           from public.workspace_ai_tier_stripe_events as event
          where event.workspace_id = p_workspace_id
            and event.stripe_customer_id = p_customer_id
            and event.stripe_subscription_id = p_subscription_id
            and event.processing_state = 'reconciliation_needed'
            and event.processing_reason = 'subscription_mismatch'
            and event.reconciled_by_request_id is null
       )
     ) then
    raise exception using
      errcode = '40001',
      message = 'workspace_ai_tier_reconciliation_cas_failed';
  end if;

  if (
       v_has_current
       and p_snapshot_observed_at < v_current.updated_at
     )
     or (
       v_latest_unresolved_at is not null
       and p_snapshot_observed_at < v_latest_unresolved_at
     )
     or v_snapshot_event_created_cutoff <= greatest(
       coalesce(v_latest_unresolved_created_at, -1),
       coalesce(
         case when v_has_current then v_current.last_stripe_event_created_at end,
         -1
       ),
       coalesce(v_latest_reconciliation_cutoff, -1)
     )
     or p_snapshot_observed_at < statement_timestamp() - interval '15 minutes'
     or p_snapshot_observed_at > statement_timestamp() + interval '5 minutes'
  then
    raise exception using
      errcode = '22023',
      message = 'workspace_ai_tier_reconciliation_snapshot_time_invalid';
  end if;

  insert into public.workspace_ai_tier_stripe_reconciliations (
    stripe_request_id,
    workspace_id,
    stripe_customer_id,
    stripe_subscription_id,
    previous_stripe_subscription_id,
    snapshot_observed_at,
    snapshot_event_created_cutoff,
    snapshot_fingerprint,
    expected_revision,
    resulting_revision,
    snapshot_kind
  ) values (
    p_stripe_request_id,
    p_workspace_id,
    p_customer_id,
    p_subscription_id,
    p_expected_previous_subscription_id,
    p_snapshot_observed_at,
    v_snapshot_event_created_cutoff,
    p_snapshot_fingerprint,
    p_expected_revision,
    p_expected_revision + 1,
    case when p_has_paid_item then 'paid_item' else 'no_paid_item' end
  );

  if not v_has_current then
    -- A conflict between Starter-only snapshots has no paid projection to
    -- mutate. The provider request still resolves the durable ledger rows;
    -- a later paid event starts at revision 1 and remains independently
    -- subject to the event boundary.
    v_rows := 1;
  elsif p_has_paid_item then
    update public.workspace_ai_tier_entitlements
       set tier_id = p_tier_id,
           status = p_lifecycle_status,
           source = 'stripe',
           stripe_subscription_id = p_subscription_id,
           stripe_subscription_item_id = p_subscription_item_id,
           stripe_price_id = p_price_id,
           effective_at = p_effective_at,
           expires_at = p_expires_at,
           last_stripe_event_created_at = v_snapshot_event_created_cutoff,
           stripe_sync_state = 'in_sync',
           stripe_sync_revision = stripe_sync_revision + 1
     where workspace_id = p_workspace_id
       and stripe_sync_revision = p_expected_revision;
    get diagnostics v_rows = row_count;
  else
    update public.workspace_ai_tier_entitlements
       set status = 'canceled',
           stripe_subscription_id = p_subscription_id,
           expires_at = case
             when p_snapshot_observed_at > effective_at
               then p_snapshot_observed_at
             else null
           end,
           last_stripe_event_created_at = v_snapshot_event_created_cutoff,
           stripe_sync_state = 'in_sync',
           stripe_sync_revision = stripe_sync_revision + 1
     where workspace_id = p_workspace_id
       and stripe_sync_revision = p_expected_revision;
    get diagnostics v_rows = row_count;
  end if;
  if v_rows <> 1 then
    raise exception using
      errcode = '40001',
      message = 'workspace_ai_tier_reconciliation_cas_failed';
  end if;

  update public.workspace_ai_tier_stripe_events
     set reconciled_by_request_id = p_stripe_request_id
   where workspace_id = p_workspace_id
     and stripe_customer_id = p_customer_id
     and stripe_subscription_id in (
       p_subscription_id,
       coalesce(p_expected_previous_subscription_id, p_subscription_id)
     )
     and processing_state = 'reconciliation_needed'
     and reconciled_by_request_id is null;

  result_status := 'applied';
  result_reason := null;
  result_revision := p_expected_revision + 1;
  return next;
end
$function$;

revoke all
  on function public.apply_workspace_ai_tier_stripe_event(
    uuid, boolean, text, bigint, text, text, text, text, boolean,
    text, text, text, text, timestamptz, timestamptz
  )
  from public, anon, authenticated, service_role;
grant execute
  on function public.apply_workspace_ai_tier_stripe_event(
    uuid, boolean, text, bigint, text, text, text, text, boolean,
    text, text, text, text, timestamptz, timestamptz
  )
  to service_role;

revoke all
  on function public.reconcile_workspace_ai_tier_stripe_subscription(
    uuid, text, text, text, text, timestamptz, text, bigint, boolean,
    text, text, text, text, timestamptz, timestamptz
  )
  from public, anon, authenticated, service_role;
grant execute
  on function public.reconcile_workspace_ai_tier_stripe_subscription(
    uuid, text, text, text, text, timestamptz, text, bigint, boolean,
    text, text, text, text, timestamptz, timestamptz
  )
  to service_role;

-- Transactional metadata-only boundary. No browser role may read the ledger
-- or execute either SECURITY DEFINER function, and service_role has no direct
-- write path around the atomic projection functions.
do $verify$
declare
  v_table regclass;
  v_column text;
  v_function regprocedure;
begin
  foreach v_table in array array[
    'public.workspace_ai_tier_stripe_events'::regclass,
    'public.workspace_ai_tier_stripe_reconciliations'::regclass
  ]
  loop
    if not exists (
      select 1 from pg_class
       where oid = v_table
         and relrowsecurity
         and relforcerowsecurity
    ) or exists (
      select 1
        from pg_policies as policy
        join pg_class as relation
          on relation.relname = policy.tablename
        join pg_namespace as namespace
          on namespace.oid = relation.relnamespace
         and namespace.nspname = policy.schemaname
       where relation.oid = v_table
    ) or has_table_privilege(
      'anon', v_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ) or has_table_privilege(
      'authenticated', v_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ) or has_table_privilege(
      'service_role', v_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ) then
      raise exception using
        errcode = '42501',
        message = 'workspace_ai_tier_ledger_table_boundary_failed';
    end if;

    for v_column in
      select attribute.attname::text
        from pg_attribute as attribute
       where attribute.attrelid = v_table
         and attribute.attnum > 0
         and not attribute.attisdropped
    loop
      if has_column_privilege(
        'anon', v_table, v_column, 'SELECT,INSERT,UPDATE,REFERENCES'
      ) or has_column_privilege(
        'authenticated', v_table, v_column, 'SELECT,INSERT,UPDATE,REFERENCES'
      ) or has_column_privilege(
        'service_role', v_table, v_column, 'SELECT,INSERT,UPDATE,REFERENCES'
      ) then
        raise exception using
          errcode = '42501',
          message = 'workspace_ai_tier_ledger_column_boundary_failed';
      end if;
    end loop;
  end loop;

  if not has_table_privilege(
    'service_role',
    'public.workspace_ai_tier_entitlements',
    'SELECT'
  ) or has_table_privilege(
    'service_role',
    'public.workspace_ai_tier_entitlements',
    'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
  ) then
    raise exception using
      errcode = '42501',
      message = 'workspace_ai_tier_ledger_projection_boundary_failed';
  end if;

  for v_column in
    select attribute.attname::text
      from pg_attribute as attribute
     where attribute.attrelid =
           'public.workspace_ai_tier_entitlements'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  loop
    if has_column_privilege(
      'service_role',
      'public.workspace_ai_tier_entitlements',
      v_column,
      'INSERT,UPDATE,REFERENCES'
    ) then
      raise exception using
        errcode = '42501',
        message = 'workspace_ai_tier_ledger_projection_column_boundary_failed';
    end if;
  end loop;

  foreach v_function in array array[
    'public.apply_workspace_ai_tier_stripe_event(uuid,boolean,text,bigint,text,text,text,text,boolean,text,text,text,text,timestamp with time zone,timestamp with time zone)'::regprocedure,
    'public.reconcile_workspace_ai_tier_stripe_subscription(uuid,text,text,text,text,timestamp with time zone,text,bigint,boolean,text,text,text,text,timestamp with time zone,timestamp with time zone)'::regprocedure
  ]
  loop
    if not exists (
      select 1 from pg_proc
       where oid = v_function
         and prosecdef
         and proconfig @> array['search_path=pg_catalog, public, pg_temp']
    ) or has_function_privilege('anon', v_function, 'EXECUTE')
      or has_function_privilege('authenticated', v_function, 'EXECUTE')
      or not has_function_privilege('service_role', v_function, 'EXECUTE')
      or exists (
        select 1
          from pg_proc as definition
          cross join lateral aclexplode(
            coalesce(definition.proacl, acldefault('f', definition.proowner))
          ) as acl
         where definition.oid = v_function
           and acl.grantee = 0
           and acl.privilege_type = 'EXECUTE'
      ) then
      raise exception using
        errcode = '42501',
        message = 'workspace_ai_tier_ledger_function_boundary_failed';
    end if;
  end loop;
end
$verify$;

commit;
