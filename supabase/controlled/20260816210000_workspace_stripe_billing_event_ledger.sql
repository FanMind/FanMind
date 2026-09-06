begin;

-- CONTROLLED / DORMANT BY DEFAULT
--
-- This file intentionally lives outside supabase/migrations. It must be
-- applied only by the dedicated runner after a target-bound preflight. Merely
-- deploying the application never installs or activates this ledger.

do $preflight$
declare
  v_missing text;
begin
  select string_agg(required.name, ', ' order by required.name)
    into v_missing
    from (
      values
        ('id'), ('owner_user_id'), ('billing_status'),
        ('billing_provider'), ('workspace_access_mode'),
        ('billing_suspended_at'), ('billing_suspended_reason'),
        ('billing_last_payment_at'), ('billing_last_payment_failed_at'),
        ('billing_retry_count'), ('billing_next_retry_at'),
        ('billing_grace_until'), ('billing_contract_started_at'),
        ('billing_current_period_end_at'), ('billing_next_invoice_at'),
        ('subscription_cancel_at_period_end'),
        ('subscription_effective_end_at'),
        ('subscription_cancel_requested_at'), ('stripe_customer_id'),
        ('stripe_subscription_id'), ('stripe_checkout_session_id'),
        ('stripe_payment_intent_id'), ('stripe_mandate_id'),
        ('billing_note'), ('last_invoice_id'), ('last_invoice_status'),
        ('last_invoice_amount_due_cents'),
        ('last_invoice_amount_paid_cents'),
        ('last_invoice_hosted_url'), ('last_invoice_pdf_url'),
        ('billing_updated_at')
    ) as required(name)
   where not exists (
     select 1
       from information_schema.columns as column_info
      where column_info.table_schema = 'public'
        and column_info.table_name = 'workspaces'
        and column_info.column_name = required.name
   );
  if v_missing is not null then
    raise exception using
      errcode = '55000',
      message = 'workspace_stripe_billing_required_columns_missing',
      detail = v_missing;
  end if;

  if to_regclass('public.demo_start_sessions') is null then
    raise exception using
      errcode = '55000',
      message = 'workspace_stripe_billing_demo_guard_missing';
  end if;

  if exists (
    select 1
      from public.workspaces as workspace
     where workspace.stripe_customer_id is not null
     group by workspace.stripe_customer_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'workspace_stripe_billing_customer_binding_collision';
  end if;
  if exists (
    select 1
      from public.workspaces as workspace
     where workspace.stripe_subscription_id is not null
     group by workspace.stripe_subscription_id
    having count(*) > 1
  ) then
    raise exception using
      errcode = '23505',
      message = 'workspace_stripe_billing_subscription_binding_collision';
  end if;
end
$preflight$;

create table public.workspace_stripe_billing_streams (
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  event_stream text not null,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  sync_state text not null,
  reconciliation_reason text,
  last_event_created_at bigint,
  last_event_id text,
  lifecycle_terminal boolean not null default false,
  projection_revision bigint not null default 0,
  updated_at timestamptz not null default statement_timestamp(),
  primary key (workspace_id, event_stream),
  constraint workspace_stripe_billing_stream_name_check
    check (event_stream in ('lifecycle', 'tax')),
  constraint workspace_stripe_billing_stream_customer_check
    check (stripe_customer_id ~ '^cus_[A-Za-z0-9_]+$'),
  constraint workspace_stripe_billing_stream_subscription_check
    check (
      stripe_subscription_id is null
      or stripe_subscription_id ~ '^sub_[A-Za-z0-9_]+$'
    ),
  constraint workspace_stripe_billing_stream_state_check
    check (
      (sync_state = 'in_sync' and reconciliation_reason is null)
      or (
        sync_state = 'reconciliation_needed'
        and reconciliation_reason in (
          'controlled_cutover', 'event_identity_conflict',
          'event_order_conflict', 'reconciliation_pending',
          'tenant_binding_conflict', 'terminal_subscription_conflict',
          'unresolved_event'
        )
      )
    ),
  constraint workspace_stripe_billing_stream_order_check
    check (
      (last_event_created_at is null and last_event_id is null)
      or (
        last_event_created_at >= 0
        and (
          last_event_id is null
          or last_event_id ~ '^evt_[A-Za-z0-9_]+$'
        )
      )
    ),
  constraint workspace_stripe_billing_stream_revision_check
    check (projection_revision >= 0)
);

create table public.workspace_stripe_billing_object_bindings (
  stripe_object_type text not null,
  stripe_object_id text not null,
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  stripe_customer_id text not null,
  first_event_id text,
  last_event_id text,
  first_seen_at timestamptz not null default statement_timestamp(),
  last_seen_at timestamptz not null default statement_timestamp(),
  primary key (stripe_object_type, stripe_object_id),
  constraint workspace_stripe_billing_object_type_check
    check (
      stripe_object_type in (
        'customer', 'subscription', 'checkout_session', 'payment_intent',
        'invoice', 'charge', 'refund', 'dispute', 'tax_id'
      )
    ),
  constraint workspace_stripe_billing_object_id_check
    check (
      (stripe_object_type = 'customer' and stripe_object_id ~ '^cus_[A-Za-z0-9_]+$')
      or (stripe_object_type = 'subscription' and stripe_object_id ~ '^sub_[A-Za-z0-9_]+$')
      or (stripe_object_type = 'checkout_session' and stripe_object_id ~ '^cs_[A-Za-z0-9_]+$')
      or (stripe_object_type = 'payment_intent' and stripe_object_id ~ '^pi_[A-Za-z0-9_]+$')
      or (stripe_object_type = 'invoice' and stripe_object_id ~ '^in_[A-Za-z0-9_]+$')
      or (stripe_object_type = 'charge' and stripe_object_id ~ '^ch_[A-Za-z0-9_]+$')
      or (stripe_object_type = 'refund' and stripe_object_id ~ '^re_[A-Za-z0-9_]+$')
      or (stripe_object_type = 'dispute' and stripe_object_id ~ '^dp_[A-Za-z0-9_]+$')
      or (stripe_object_type = 'tax_id' and stripe_object_id ~ '^txi_[A-Za-z0-9_]+$')
    ),
  constraint workspace_stripe_billing_object_customer_check
    check (stripe_customer_id ~ '^cus_[A-Za-z0-9_]+$'),
  constraint workspace_stripe_billing_object_event_check
    check (
      (first_event_id is null or first_event_id ~ '^evt_[A-Za-z0-9_]+$')
      and (last_event_id is null or last_event_id ~ '^evt_[A-Za-z0-9_]+$')
    )
);

create index workspace_stripe_billing_object_workspace_idx
  on public.workspace_stripe_billing_object_bindings
    (workspace_id, stripe_object_type, last_seen_at desc);

create table public.workspace_stripe_billing_reconciliations (
  stripe_request_id text primary key,
  workspace_id uuid not null
    references public.workspaces(id) on delete cascade,
  event_stream text not null,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  snapshot_observed_at timestamptz not null,
  snapshot_fingerprint text not null,
  expected_revision bigint not null,
  resulting_revision bigint not null,
  resolved_event_ids text[] not null default '{}',
  created_at timestamptz not null default statement_timestamp(),
  constraint workspace_stripe_billing_reconciliation_request_check
    check (stripe_request_id ~ '^req_[A-Za-z0-9_]+$'),
  constraint workspace_stripe_billing_reconciliation_stream_check
    check (event_stream in ('lifecycle', 'tax')),
  constraint workspace_stripe_billing_reconciliation_customer_check
    check (stripe_customer_id ~ '^cus_[A-Za-z0-9_]+$'),
  constraint workspace_stripe_billing_reconciliation_subscription_check
    check (
      stripe_subscription_id is null
      or stripe_subscription_id ~ '^sub_[A-Za-z0-9_]+$'
    ),
  constraint workspace_stripe_billing_reconciliation_fingerprint_check
    check (snapshot_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint workspace_stripe_billing_reconciliation_revision_check
    check (
      expected_revision >= 0
      and resulting_revision = expected_revision + 1
    )
);

create index workspace_stripe_billing_reconciliation_workspace_idx
  on public.workspace_stripe_billing_reconciliations
    (workspace_id, event_stream, created_at desc);

create table public.workspace_stripe_billing_events (
  event_id text primary key,
  workspace_id uuid
    references public.workspaces(id) on delete cascade,
  event_created_at bigint not null,
  event_type text not null,
  event_stream text not null,
  binding_mode text not null,
  workspace_id_candidate uuid,
  workspace_candidate_conflict boolean not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_invoice_id text,
  stripe_charge_id text,
  stripe_refund_id text,
  stripe_dispute_id text,
  stripe_tax_id text,
  payload_fingerprint text not null,
  processing_state text not null,
  processing_reason text,
  projection_revision bigint not null default 0,
  signature_verified_at timestamptz not null default statement_timestamp(),
  processed_at timestamptz,
  reconciled_by_request_id text
    references public.workspace_stripe_billing_reconciliations(
      stripe_request_id
    ) on delete restrict,
  constraint workspace_stripe_billing_event_id_check
    check (event_id ~ '^evt_[A-Za-z0-9_]+$'),
  constraint workspace_stripe_billing_event_created_check
    check (event_created_at >= 0),
  constraint workspace_stripe_billing_event_type_check
    check (event_type in (
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed',
      'payment_intent.processing', 'payment_intent.succeeded',
      'payment_intent.payment_failed', 'invoice.paid', 'invoice.updated',
      'invoice.payment_failed', 'customer.subscription.created',
      'customer.subscription.updated', 'customer.subscription.resumed',
      'customer.subscription.paused', 'customer.subscription.deleted',
      'charge.refunded', 'refund.created', 'refund.updated', 'refund.failed',
      'charge.dispute.created', 'customer.tax_id.created',
      'customer.tax_id.updated', 'customer.tax_id.deleted'
    )),
  constraint workspace_stripe_billing_event_stream_check
    check (event_stream in ('lifecycle', 'tax')),
  constraint workspace_stripe_billing_event_mode_check
    check (binding_mode in (
      'checkout', 'customer_transaction', 'customer_subscription',
      'reversal', 'tax'
    )),
  constraint workspace_stripe_billing_event_refs_check
    check (
      (stripe_customer_id is null or stripe_customer_id ~ '^cus_[A-Za-z0-9_]+$')
      and (stripe_subscription_id is null or stripe_subscription_id ~ '^sub_[A-Za-z0-9_]+$')
      and (stripe_checkout_session_id is null or stripe_checkout_session_id ~ '^cs_[A-Za-z0-9_]+$')
      and (stripe_payment_intent_id is null or stripe_payment_intent_id ~ '^pi_[A-Za-z0-9_]+$')
      and (stripe_invoice_id is null or stripe_invoice_id ~ '^in_[A-Za-z0-9_]+$')
      and (stripe_charge_id is null or stripe_charge_id ~ '^ch_[A-Za-z0-9_]+$')
      and (stripe_refund_id is null or stripe_refund_id ~ '^re_[A-Za-z0-9_]+$')
      and (stripe_dispute_id is null or stripe_dispute_id ~ '^dp_[A-Za-z0-9_]+$')
      and (stripe_tax_id is null or stripe_tax_id ~ '^txi_[A-Za-z0-9_]+$')
    ),
  constraint workspace_stripe_billing_event_fingerprint_check
    check (payload_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint workspace_stripe_billing_event_processing_check
    check (
      (processing_state = 'received' and processing_reason is null)
      or (processing_state = 'applied' and processing_reason is null)
      or (
        processing_state = 'ignored'
        and processing_reason in (
          'stale_event', 'protected_workspace'
        )
      )
      or (
        processing_state = 'unresolved'
        and processing_reason in (
          'tenant_binding_missing', 'object_binding_missing'
        )
      )
      or (
        processing_state = 'reconciliation_needed'
        and processing_reason in (
          'event_identity_conflict', 'event_order_conflict',
          'reconciliation_pending', 'tenant_binding_conflict',
          'terminal_subscription_conflict'
        )
      )
      or (processing_state = 'reconciled' and processing_reason is null)
    ),
  constraint workspace_stripe_billing_event_revision_check
    check (projection_revision >= 0),
  constraint workspace_stripe_billing_event_processed_check
    check (
      (processing_state = 'received' and processed_at is null)
      or (processing_state <> 'received' and processed_at is not null)
    )
);

create index workspace_stripe_billing_event_workspace_order_idx
  on public.workspace_stripe_billing_events
    (workspace_id, event_stream, event_created_at desc)
  where workspace_id is not null;
create index workspace_stripe_billing_event_pending_idx
  on public.workspace_stripe_billing_events
    (event_stream, event_created_at, event_id)
  where processing_state in ('unresolved', 'reconciliation_needed');

alter table public.workspace_stripe_billing_streams enable row level security;
alter table public.workspace_stripe_billing_streams force row level security;
alter table public.workspace_stripe_billing_object_bindings enable row level security;
alter table public.workspace_stripe_billing_object_bindings force row level security;
alter table public.workspace_stripe_billing_reconciliations enable row level security;
alter table public.workspace_stripe_billing_reconciliations force row level security;
alter table public.workspace_stripe_billing_events enable row level security;
alter table public.workspace_stripe_billing_events force row level security;

revoke all on table public.workspace_stripe_billing_streams
  from public, anon, authenticated, service_role;
revoke all on table public.workspace_stripe_billing_object_bindings
  from public, anon, authenticated, service_role;
revoke all on table public.workspace_stripe_billing_reconciliations
  from public, anon, authenticated, service_role;
revoke all on table public.workspace_stripe_billing_events
  from public, anon, authenticated, service_role;

create function public.workspace_stripe_billing_projection_valid(
  p_projection jsonb
)
returns boolean
language plpgsql
stable
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_key text;
  v_timestamp_key text;
begin
  if p_projection is null or jsonb_typeof(p_projection) <> 'object' then
    return false;
  end if;
  for v_key in select jsonb_object_keys(p_projection)
  loop
    if v_key not in (
      'billing_status', 'workspace_access_mode',
      'billing_suspended_reason', 'billing_note',
      'billing_last_payment_at', 'billing_last_payment_failed_at',
      'billing_retry_count', 'billing_next_retry_at',
      'billing_grace_until', 'billing_suspended_at',
      'billing_contract_started_at', 'billing_current_period_end_at',
      'billing_next_invoice_at', 'subscription_cancel_at_period_end',
      'subscription_effective_end_at', 'subscription_cancel_requested_at',
      'stripe_customer_id', 'stripe_subscription_id',
      'stripe_checkout_session_id', 'stripe_payment_intent_id',
      'stripe_mandate_id', 'last_invoice_id', 'last_invoice_status',
      'last_invoice_amount_due_cents', 'last_invoice_amount_paid_cents',
      'last_invoice_hosted_url', 'last_invoice_pdf_url'
    ) then
      return false;
    end if;
  end loop;

  if p_projection ? 'billing_status'
     and (
       p_projection->'billing_status' = 'null'::jsonb
       or p_projection->>'billing_status' not in (
         'pending_sepa_mandate', 'active', 'past_due', 'payment_failed',
         'suspended', 'cancelled', 'expired'
       )
     ) then return false; end if;
  if p_projection ? 'workspace_access_mode'
     and (
       p_projection->'workspace_access_mode' = 'null'::jsonb
       or p_projection->>'workspace_access_mode' not in (
         'active', 'archived_readonly'
       )
     ) then return false; end if;
  if p_projection ? 'subscription_cancel_at_period_end'
     and p_projection->'subscription_cancel_at_period_end' <> 'null'::jsonb
     and jsonb_typeof(p_projection->'subscription_cancel_at_period_end') <> 'boolean'
  then return false; end if;

  foreach v_key in array array[
    'billing_retry_count', 'last_invoice_amount_due_cents',
    'last_invoice_amount_paid_cents'
  ] loop
    if p_projection ? v_key
       and p_projection->v_key <> 'null'::jsonb
       and (
         jsonb_typeof(p_projection->v_key) <> 'number'
         or (p_projection->>v_key)::numeric < 0
         or (p_projection->>v_key)::numeric > 2147483647
         or trunc((p_projection->>v_key)::numeric) <>
            (p_projection->>v_key)::numeric
       ) then return false; end if;
  end loop;

  foreach v_key in array array[
    'billing_status', 'workspace_access_mode',
    'billing_suspended_reason', 'billing_note', 'stripe_customer_id',
    'stripe_subscription_id', 'stripe_checkout_session_id',
    'stripe_payment_intent_id', 'stripe_mandate_id', 'last_invoice_id',
    'last_invoice_status', 'last_invoice_hosted_url', 'last_invoice_pdf_url'
  ] loop
    if p_projection ? v_key
       and p_projection->v_key <> 'null'::jsonb
       and (
         jsonb_typeof(p_projection->v_key) <> 'string'
         or length(p_projection->>v_key) > 4096
       ) then return false; end if;
  end loop;

  foreach v_timestamp_key in array array[
    'billing_last_payment_at', 'billing_last_payment_failed_at',
    'billing_next_retry_at', 'billing_grace_until',
    'billing_suspended_at', 'billing_contract_started_at',
    'billing_current_period_end_at', 'billing_next_invoice_at',
    'subscription_effective_end_at', 'subscription_cancel_requested_at'
  ] loop
    if p_projection ? v_timestamp_key
       and p_projection->v_timestamp_key <> 'null'::jsonb then
      if jsonb_typeof(p_projection->v_timestamp_key) <> 'string' then
        return false;
      end if;
      begin
        perform (p_projection->>v_timestamp_key)::timestamptz;
      exception when others then
        return false;
      end;
    end if;
  end loop;
  if (p_projection ? 'stripe_customer_id' and (
        p_projection->'stripe_customer_id' = 'null'::jsonb
        or p_projection->>'stripe_customer_id' !~ '^cus_[A-Za-z0-9_]+$'
      ))
     or (p_projection ? 'stripe_subscription_id' and (
        p_projection->'stripe_subscription_id' = 'null'::jsonb
        or p_projection->>'stripe_subscription_id' !~ '^sub_[A-Za-z0-9_]+$'
      ))
     or (p_projection ? 'stripe_checkout_session_id' and (
        p_projection->'stripe_checkout_session_id' = 'null'::jsonb
        or p_projection->>'stripe_checkout_session_id' !~ '^cs_[A-Za-z0-9_]+$'
      ))
     or (p_projection ? 'stripe_payment_intent_id' and (
        p_projection->'stripe_payment_intent_id' = 'null'::jsonb
        or p_projection->>'stripe_payment_intent_id' !~ '^pi_[A-Za-z0-9_]+$'
      ))
     or (p_projection ? 'stripe_mandate_id' and (
        p_projection->'stripe_mandate_id' = 'null'::jsonb
        or p_projection->>'stripe_mandate_id' !~ '^(seti|mandate)_[A-Za-z0-9_]+$'
      ))
     or (p_projection ? 'last_invoice_id' and (
        p_projection->'last_invoice_id' = 'null'::jsonb
        or p_projection->>'last_invoice_id' !~ '^in_[A-Za-z0-9_]+$'
      )) then return false; end if;
  return true;
exception when others then
  return false;
end
$function$;

create function public.apply_workspace_stripe_billing_projection(
  p_workspace_id uuid,
  p_projection jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  if not public.workspace_stripe_billing_projection_valid(p_projection) then
    raise exception using errcode = '22023',
      message = 'workspace_stripe_billing_projection_invalid';
  end if;
  update public.workspaces as workspace
     set billing_status = case
           when workspace.billing_status = 'manual_suspended'
                and p_projection ? 'billing_status'
             then workspace.billing_status
           when p_projection ? 'billing_status'
             then p_projection->>'billing_status'
           else workspace.billing_status end,
         workspace_access_mode = case
           when workspace.billing_status = 'manual_suspended'
                and p_projection ? 'workspace_access_mode'
             then workspace.workspace_access_mode
           when p_projection ? 'workspace_access_mode'
             then p_projection->>'workspace_access_mode'
           else workspace.workspace_access_mode end,
         billing_suspended_reason = case
           when workspace.billing_status = 'manual_suspended'
                and p_projection ? 'billing_suspended_reason'
             then workspace.billing_suspended_reason
           when p_projection ? 'billing_suspended_reason'
             then p_projection->>'billing_suspended_reason'
           else workspace.billing_suspended_reason end,
         billing_note = case when p_projection ? 'billing_note' then p_projection->>'billing_note' else workspace.billing_note end,
         billing_last_payment_at = case when p_projection ? 'billing_last_payment_at' then (p_projection->>'billing_last_payment_at')::timestamptz else workspace.billing_last_payment_at end,
         billing_last_payment_failed_at = case when p_projection ? 'billing_last_payment_failed_at' then (p_projection->>'billing_last_payment_failed_at')::timestamptz else workspace.billing_last_payment_failed_at end,
         billing_retry_count = case when p_projection ? 'billing_retry_count' then (p_projection->>'billing_retry_count')::integer else workspace.billing_retry_count end,
         billing_next_retry_at = case when p_projection ? 'billing_next_retry_at' then (p_projection->>'billing_next_retry_at')::timestamptz else workspace.billing_next_retry_at end,
         billing_grace_until = case when p_projection ? 'billing_grace_until' then (p_projection->>'billing_grace_until')::timestamptz else workspace.billing_grace_until end,
         billing_suspended_at = case
           when workspace.billing_status = 'manual_suspended'
                and p_projection ? 'billing_suspended_at'
             then workspace.billing_suspended_at
           when p_projection ? 'billing_suspended_at'
             then (p_projection->>'billing_suspended_at')::timestamptz
           else workspace.billing_suspended_at end,
         billing_contract_started_at = case when p_projection ? 'billing_contract_started_at' then (p_projection->>'billing_contract_started_at')::timestamptz else workspace.billing_contract_started_at end,
         billing_current_period_end_at = case when p_projection ? 'billing_current_period_end_at' then (p_projection->>'billing_current_period_end_at')::timestamptz else workspace.billing_current_period_end_at end,
         billing_next_invoice_at = case when p_projection ? 'billing_next_invoice_at' then (p_projection->>'billing_next_invoice_at')::timestamptz else workspace.billing_next_invoice_at end,
         subscription_effective_end_at = case when p_projection ? 'subscription_effective_end_at' then (p_projection->>'subscription_effective_end_at')::timestamptz else workspace.subscription_effective_end_at end,
         subscription_cancel_requested_at = case when p_projection ? 'subscription_cancel_requested_at' then (p_projection->>'subscription_cancel_requested_at')::timestamptz else workspace.subscription_cancel_requested_at end,
         subscription_cancel_at_period_end = case when p_projection ? 'subscription_cancel_at_period_end' then (p_projection->>'subscription_cancel_at_period_end')::boolean else workspace.subscription_cancel_at_period_end end,
         stripe_customer_id = case when p_projection ? 'stripe_customer_id' then p_projection->>'stripe_customer_id' else workspace.stripe_customer_id end,
         stripe_subscription_id = case when p_projection ? 'stripe_subscription_id' then p_projection->>'stripe_subscription_id' else workspace.stripe_subscription_id end,
         stripe_checkout_session_id = case when p_projection ? 'stripe_checkout_session_id' then p_projection->>'stripe_checkout_session_id' else workspace.stripe_checkout_session_id end,
         stripe_payment_intent_id = case when p_projection ? 'stripe_payment_intent_id' then p_projection->>'stripe_payment_intent_id' else workspace.stripe_payment_intent_id end,
         stripe_mandate_id = case when p_projection ? 'stripe_mandate_id' then p_projection->>'stripe_mandate_id' else workspace.stripe_mandate_id end,
         last_invoice_id = case when p_projection ? 'last_invoice_id' then p_projection->>'last_invoice_id' else workspace.last_invoice_id end,
         last_invoice_status = case when p_projection ? 'last_invoice_status' then p_projection->>'last_invoice_status' else workspace.last_invoice_status end,
         last_invoice_amount_due_cents = case when p_projection ? 'last_invoice_amount_due_cents' then (p_projection->>'last_invoice_amount_due_cents')::integer else workspace.last_invoice_amount_due_cents end,
         last_invoice_amount_paid_cents = case when p_projection ? 'last_invoice_amount_paid_cents' then (p_projection->>'last_invoice_amount_paid_cents')::integer else workspace.last_invoice_amount_paid_cents end,
         last_invoice_hosted_url = case when p_projection ? 'last_invoice_hosted_url' then p_projection->>'last_invoice_hosted_url' else workspace.last_invoice_hosted_url end,
         last_invoice_pdf_url = case when p_projection ? 'last_invoice_pdf_url' then p_projection->>'last_invoice_pdf_url' else workspace.last_invoice_pdf_url end,
         billing_provider = 'stripe',
         billing_updated_at = statement_timestamp()
   where workspace.id = p_workspace_id;
  if not found then
    raise exception using errcode = 'P0002',
      message = 'workspace_stripe_billing_projection_workspace_missing';
  end if;
end
$function$;

create function public.mark_workspace_stripe_billing_reconciliation(
  p_workspace_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
begin
  update public.workspaces as workspace
     set billing_status = 'suspended',
         workspace_access_mode = 'archived_readonly',
         billing_suspended_at = coalesce(
           workspace.billing_suspended_at, statement_timestamp()
         ),
         billing_suspended_reason = 'stripe_reconciliation_required',
         billing_note = 'Stripe-Abgleich erforderlich; automatische Aktivierung gesperrt.',
         billing_updated_at = statement_timestamp()
   where workspace.id = p_workspace_id
     and workspace.billing_status is distinct from 'manual_suspended'
     and not exists (
       select 1
         from auth.users as owner_user
        where owner_user.id = workspace.owner_user_id
          and lower(btrim(coalesce(owner_user.email, ''))) =
              'sandra.m@fanmind.ch'
     )
     and not exists (
       select 1 from public.demo_start_sessions as demo_session
        where demo_session.workspace_id = workspace.id
     );
end
$function$;

create function public.apply_workspace_stripe_billing_event(
  p_signature_verified boolean,
  p_projection_enabled boolean,
  p_event_id text,
  p_event_created_at bigint,
  p_event_type text,
  p_event_stream text,
  p_binding_mode text,
  p_workspace_id_candidate uuid,
  p_workspace_candidate_conflict boolean,
  p_customer_id text,
  p_subscription_id text,
  p_checkout_session_id text,
  p_payment_intent_id text,
  p_invoice_id text,
  p_charge_id text,
  p_refund_id text,
  p_dispute_id text,
  p_tax_id text,
  p_payload_fingerprint text,
  p_projection jsonb
)
returns table (
  result_status text,
  result_reason text,
  result_workspace_id uuid,
  result_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_inserted boolean;
  v_rows bigint;
  v_event public.workspace_stripe_billing_events%rowtype;
  v_workspace public.workspaces%rowtype;
  v_stream public.workspace_stripe_billing_streams%rowtype;
  v_candidates uuid[];
  v_workspace_id uuid;
  v_anchor_count integer;
  v_reason text;
  v_expected_revision bigint;
  v_protected boolean;
  v_demo_protected boolean;
  v_manual_protected boolean;
  v_effective_customer_id text;
  v_object record;
  v_conflict_workspace_id uuid;
  v_prior_pending boolean;
  v_stream_bootstrap_allowed boolean;
begin
  if p_signature_verified is distinct from true
     or p_projection_enabled is null
     or p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9_]+$'
     or p_event_created_at is null or p_event_created_at < 0
     or p_event_created_at > floor(extract(epoch from
          statement_timestamp() + interval '5 minutes'))::bigint
     or p_event_stream not in ('lifecycle', 'tax')
     or p_binding_mode not in (
       'checkout', 'customer_transaction', 'customer_subscription',
       'reversal', 'tax'
     )
     or p_workspace_candidate_conflict is null
     or p_payload_fingerprint is null
     or p_payload_fingerprint !~ '^[a-f0-9]{64}$'
     or not public.workspace_stripe_billing_projection_valid(p_projection)
  then
    raise exception using errcode = '22023',
      message = 'workspace_stripe_billing_event_invalid';
  end if;

  if (p_binding_mode = 'checkout' and (
        p_event_type not like 'checkout.session.%'
        or p_event_stream <> 'lifecycle'
      ))
     or (p_binding_mode = 'customer_transaction' and (
        p_event_type not like 'payment_intent.%'
        or p_event_stream <> 'lifecycle'
      ))
     or (p_binding_mode = 'customer_subscription' and (
        not (
          p_event_type like 'invoice.%'
          or p_event_type like 'customer.subscription.%'
        )
        or p_event_stream <> 'lifecycle'
      ))
     or (p_binding_mode = 'reversal' and (
        p_event_type not in (
          'charge.refunded', 'refund.created', 'refund.updated',
          'refund.failed', 'charge.dispute.created'
        )
        or p_event_stream <> 'lifecycle'
      ))
     or (p_binding_mode = 'tax' and (
        p_event_type not like 'customer.tax_id.%'
        or p_event_stream <> 'tax'
      ))
  then
    raise exception using errcode = '22023',
      message = 'workspace_stripe_billing_event_contract_invalid';
  end if;

  -- References that are only observations for one event family must never
  -- become accidental tenant anchors for another. Invoices may observe their
  -- PaymentIntent and Charge, but resolution above/below deliberately anchors
  -- them only on Customer + Subscription.
  if (p_binding_mode = 'checkout' and (
        p_invoice_id is not null or p_charge_id is not null
        or p_refund_id is not null or p_dispute_id is not null
        or p_tax_id is not null
      ))
     or (p_binding_mode = 'customer_transaction' and (
        p_subscription_id is not null or p_checkout_session_id is not null
        or p_invoice_id is not null or p_charge_id is not null
        or p_refund_id is not null or p_dispute_id is not null
        or p_tax_id is not null
      ))
     or (p_event_type like 'invoice.%' and (
        p_invoice_id is null or p_checkout_session_id is not null
        or p_refund_id is not null or p_dispute_id is not null
        or p_tax_id is not null
      ))
     or (p_event_type like 'customer.subscription.%' and (
        p_checkout_session_id is not null or p_payment_intent_id is not null
        or p_invoice_id is not null or p_charge_id is not null
        or p_refund_id is not null or p_dispute_id is not null
        or p_tax_id is not null
      ))
     or (p_binding_mode = 'reversal' and (
        p_subscription_id is not null or p_checkout_session_id is not null
        or p_invoice_id is not null or p_tax_id is not null
      ))
     or (p_binding_mode = 'tax' and (
        p_subscription_id is not null or p_checkout_session_id is not null
        or p_payment_intent_id is not null or p_invoice_id is not null
        or p_charge_id is not null or p_refund_id is not null
        or p_dispute_id is not null
      ))
  then
    raise exception using errcode = '22023',
      message = 'workspace_stripe_billing_event_reference_contract_invalid';
  end if;

  if p_event_stream = 'tax' and exists (
    select 1 from jsonb_object_keys(p_projection) as projection_key(key)
     where projection_key.key <> 'billing_note'
  ) then
    raise exception using errcode = '22023',
      message = 'workspace_stripe_billing_tax_projection_invalid';
  end if;

  if (p_projection ? 'stripe_customer_id'
      and p_projection->>'stripe_customer_id' is distinct from p_customer_id)
     or (p_projection ? 'stripe_subscription_id'
      and p_projection->>'stripe_subscription_id' is distinct from p_subscription_id)
     or (p_projection ? 'stripe_checkout_session_id'
      and p_projection->>'stripe_checkout_session_id' is distinct from p_checkout_session_id)
     or (p_projection ? 'stripe_payment_intent_id'
      and p_projection->>'stripe_payment_intent_id' is distinct from p_payment_intent_id)
     or (p_projection ? 'last_invoice_id'
      and p_projection->>'last_invoice_id' is distinct from p_invoice_id)
  then
    raise exception using errcode = '22023',
      message = 'workspace_stripe_billing_projection_reference_mismatch';
  end if;

  -- Serialize on stable provider identities before inserting/reading an event
  -- row. This closes the bootstrap race where a terminal event could commit as
  -- unresolved just after a later Checkout had already activated the tenant.
  for v_object in
    select event_anchor.anchor_type, event_anchor.anchor_id
      from (values
      ('charge', p_charge_id),
      ('checkout_session', p_checkout_session_id),
      ('customer', p_customer_id),
      ('dispute', p_dispute_id),
      ('invoice', p_invoice_id),
      ('payment_intent', p_payment_intent_id),
      ('refund', p_refund_id),
      ('subscription', p_subscription_id),
      ('tax_id', p_tax_id),
      ('workspace', p_workspace_id_candidate::text)
    ) as event_anchor(anchor_type, anchor_id)
     where event_anchor.anchor_id is not null
     order by event_anchor.anchor_type, event_anchor.anchor_id
  loop
    perform pg_advisory_xact_lock(
      hashtextextended(
        'fanmind-stripe-billing:' || v_object.anchor_type || ':' ||
        v_object.anchor_id,
        7281942
      )
    );
  end loop;

  insert into public.workspace_stripe_billing_events (
    event_id, event_created_at, event_type, event_stream, binding_mode,
    workspace_id_candidate, workspace_candidate_conflict,
    stripe_customer_id, stripe_subscription_id, stripe_checkout_session_id,
    stripe_payment_intent_id, stripe_invoice_id, stripe_charge_id,
    stripe_refund_id, stripe_dispute_id, stripe_tax_id,
    payload_fingerprint, processing_state
  ) values (
    p_event_id, p_event_created_at, p_event_type, p_event_stream,
    p_binding_mode, p_workspace_id_candidate, p_workspace_candidate_conflict,
    p_customer_id, p_subscription_id, p_checkout_session_id,
    p_payment_intent_id, p_invoice_id, p_charge_id, p_refund_id,
    p_dispute_id, p_tax_id, p_payload_fingerprint, 'received'
  ) on conflict (event_id) do nothing;
  get diagnostics v_rows = row_count;
  v_inserted := v_rows = 1;

  if not v_inserted then
    select event.* into strict v_event
      from public.workspace_stripe_billing_events as event
     where event.event_id = p_event_id
     for update;
    if v_event.event_created_at = p_event_created_at
       and v_event.event_type = p_event_type
       and v_event.event_stream = p_event_stream
       and v_event.payload_fingerprint = p_payload_fingerprint then
      result_workspace_id := v_event.workspace_id;
      result_revision := v_event.projection_revision;
      if v_event.processing_state = 'applied' then
        result_status := 'ignored'; result_reason := 'duplicate_event';
      elsif v_event.processing_state = 'reconciled' then
        -- The canonical snapshot, not this event's original projection, won.
        -- A replay must never run downstream AI/referral side effects from the
        -- stale signed payload.
        result_status := 'ignored'; result_reason := 'reconciled_event';
      elsif v_event.processing_state = 'ignored' then
        result_status := 'ignored'; result_reason := v_event.processing_reason;
      else
        result_status := v_event.processing_state;
        result_reason := v_event.processing_reason;
      end if;
      return next; return;
    end if;

    update public.workspace_stripe_billing_events as event
       set processing_state = 'reconciliation_needed',
           processing_reason = 'event_identity_conflict',
           processed_at = statement_timestamp()
     where event.event_id = p_event_id;
    -- A conflicting delivery may make a formerly unresolved event attributable
    -- to one or more tenants. Resolve every durable anchor from both identities
    -- and fail-close every identifiable lifecycle workspace. The event row is
    -- already locked; UUID order preserves event -> Workspace -> stream order.
    select coalesce(
             array_agg(
               distinct candidate.workspace_id order by candidate.workspace_id
             ),
             '{}'
           )
      into v_candidates
      from (
        select v_event.workspace_id as workspace_id
        where v_event.workspace_id is not null
        union all
        select binding.workspace_id
          from public.workspace_stripe_billing_object_bindings as binding
         where (binding.stripe_object_type, binding.stripe_object_id) in (
           ('customer', v_event.stripe_customer_id),
           ('subscription', v_event.stripe_subscription_id),
           ('checkout_session', v_event.stripe_checkout_session_id),
           ('payment_intent', v_event.stripe_payment_intent_id),
           ('invoice', v_event.stripe_invoice_id),
           ('charge', v_event.stripe_charge_id),
           ('refund', v_event.stripe_refund_id),
           ('dispute', v_event.stripe_dispute_id),
           ('tax_id', v_event.stripe_tax_id),
           ('customer', p_customer_id),
           ('subscription', p_subscription_id),
           ('checkout_session', p_checkout_session_id),
           ('payment_intent', p_payment_intent_id),
           ('invoice', p_invoice_id),
           ('charge', p_charge_id),
           ('refund', p_refund_id),
           ('dispute', p_dispute_id),
           ('tax_id', p_tax_id)
         )
        union all
        select workspace.id
          from public.workspaces as workspace
         where workspace.stripe_customer_id in (
           v_event.stripe_customer_id, p_customer_id
         )
            or workspace.stripe_subscription_id in (
              v_event.stripe_subscription_id, p_subscription_id
            )
            or workspace.id in (
              v_event.workspace_id_candidate, p_workspace_id_candidate
            )
      ) as candidate;
    foreach v_conflict_workspace_id in array v_candidates
    loop
      select workspace.* into strict v_workspace
        from public.workspaces as workspace
       where workspace.id = v_conflict_workspace_id for update;
      v_effective_customer_id := v_workspace.stripe_customer_id;
      if v_effective_customer_id is not null then
        insert into public.workspace_stripe_billing_streams (
          workspace_id, event_stream, stripe_customer_id,
          stripe_subscription_id, sync_state, reconciliation_reason
        ) values (
          v_conflict_workspace_id,
          case
            when v_event.event_stream = 'lifecycle'
                 or p_event_stream = 'lifecycle' then 'lifecycle'
            else 'tax'
          end,
          v_effective_customer_id,
          case
            when v_event.event_stream = 'lifecycle'
                 or p_event_stream = 'lifecycle'
              then v_workspace.stripe_subscription_id
            else null
          end,
          'reconciliation_needed', 'event_identity_conflict'
        ) on conflict (workspace_id, event_stream) do update
          set sync_state = 'reconciliation_needed',
              reconciliation_reason = 'event_identity_conflict',
              updated_at = statement_timestamp();
      end if;
      if v_event.event_stream = 'lifecycle'
         or p_event_stream = 'lifecycle' then
        perform public.mark_workspace_stripe_billing_reconciliation(
          v_conflict_workspace_id
        );
      end if;
    end loop;
    result_status := 'reconciliation_needed';
    result_reason := 'event_identity_conflict';
    result_workspace_id := v_event.workspace_id;
    result_revision := v_event.projection_revision;
    return next; return;
  end if;

  if (p_binding_mode = 'checkout' and (
        p_checkout_session_id is null or p_customer_id is null
      ))
     or (p_binding_mode = 'customer_transaction' and (
        p_customer_id is null or p_payment_intent_id is null
      ))
     or (p_binding_mode = 'customer_subscription' and (
        p_customer_id is null or p_subscription_id is null
      ))
     or (p_binding_mode = 'tax' and (
        p_customer_id is null or p_tax_id is null
      )) then
    v_reason := 'tenant_binding_missing';
  elsif p_binding_mode = 'reversal'
        and p_customer_id is null
        and p_payment_intent_id is null
        and p_charge_id is null
        and p_refund_id is null
        and p_dispute_id is null then
    v_reason := 'object_binding_missing';
  else
    select coalesce(
             array_agg(
               distinct candidate.workspace_id order by candidate.workspace_id
             ),
             '{}'
           ),
           count(distinct candidate.workspace_id)
      into v_candidates, v_anchor_count
      from (
        select binding.workspace_id
          from public.workspace_stripe_billing_object_bindings as binding
         where (
           (binding.stripe_object_type = 'customer'
             and binding.stripe_object_id = p_customer_id)
           or (binding.stripe_object_type = 'subscription'
             and p_binding_mode in ('checkout', 'customer_subscription')
             and binding.stripe_object_id = p_subscription_id)
           or (binding.stripe_object_type = 'checkout_session'
             and p_binding_mode = 'checkout'
             and binding.stripe_object_id = p_checkout_session_id)
           or (binding.stripe_object_type = 'payment_intent'
             and p_binding_mode in (
               'checkout', 'customer_transaction', 'reversal'
             )
             and binding.stripe_object_id = p_payment_intent_id)
           or (binding.stripe_object_type = 'charge'
             and p_binding_mode = 'reversal'
             and binding.stripe_object_id = p_charge_id)
           or (binding.stripe_object_type = 'refund'
             and p_binding_mode = 'reversal'
             and binding.stripe_object_id = p_refund_id)
           or (binding.stripe_object_type = 'dispute'
             and p_binding_mode = 'reversal'
             and binding.stripe_object_id = p_dispute_id)
           or (binding.stripe_object_type = 'tax_id'
             and p_binding_mode = 'tax'
             and binding.stripe_object_id = p_tax_id)
         )
        union all
        select workspace.id
          from public.workspaces as workspace
         where p_customer_id is not null
           and workspace.stripe_customer_id = p_customer_id
        union all
        select workspace.id
          from public.workspaces as workspace
         where p_binding_mode = 'customer_subscription'
           and p_subscription_id is not null
           and workspace.stripe_subscription_id = p_subscription_id
        union all
        select workspace.id
          from public.workspaces as workspace
         where p_binding_mode = 'checkout'
           and p_workspace_id_candidate is not null
           and workspace.id = p_workspace_id_candidate
      ) as candidate;

    if v_anchor_count = 0 then
      v_reason := case
        when p_workspace_candidate_conflict then 'tenant_binding_conflict'
        when p_binding_mode = 'reversal' then 'object_binding_missing'
        else 'tenant_binding_missing'
      end;
    elsif v_anchor_count > 1 then
      v_reason := 'tenant_binding_conflict';
    else
      v_workspace_id := v_candidates[1];
      if p_workspace_candidate_conflict
         or (p_workspace_id_candidate is not null
             and p_workspace_id_candidate <> v_workspace_id) then
        v_reason := 'tenant_binding_conflict';
      end if;
    end if;
  end if;

  if v_reason in ('tenant_binding_missing', 'object_binding_missing') then
    update public.workspace_stripe_billing_events as event
       set processing_state = 'unresolved', processing_reason = v_reason,
           processed_at = statement_timestamp()
     where event.event_id = p_event_id;
    result_status := 'unresolved'; result_reason := v_reason;
    result_workspace_id := null; result_revision := 0;
    return next; return;
  end if;
  if v_reason = 'tenant_binding_conflict' then
    update public.workspace_stripe_billing_events as event
       set workspace_id = v_workspace_id,
           processing_state = 'reconciliation_needed',
           processing_reason = v_reason, processed_at = statement_timestamp()
     where event.event_id = p_event_id;
    -- Every identifiable side of a multi-anchor conflict is fail-closed. UUID
    -- order above gives concurrent conflicts one deterministic lock order.
    foreach v_conflict_workspace_id in array coalesce(v_candidates, '{}')
    loop
      select workspace.* into strict v_workspace
        from public.workspaces as workspace
       where workspace.id = v_conflict_workspace_id for update;
      v_effective_customer_id := v_workspace.stripe_customer_id;
      if v_effective_customer_id is not null then
        insert into public.workspace_stripe_billing_streams (
          workspace_id, event_stream, stripe_customer_id,
          stripe_subscription_id, sync_state, reconciliation_reason
        ) values (
          v_conflict_workspace_id, p_event_stream,
          v_effective_customer_id,
          case when p_event_stream = 'lifecycle'
            then v_workspace.stripe_subscription_id else null end,
          'reconciliation_needed', v_reason
        ) on conflict (workspace_id, event_stream) do update
          set sync_state = 'reconciliation_needed',
              reconciliation_reason = excluded.reconciliation_reason,
              updated_at = statement_timestamp();
      end if;
      if p_event_stream = 'lifecycle' then
        perform public.mark_workspace_stripe_billing_reconciliation(
          v_conflict_workspace_id
        );
      end if;
    end loop;
    result_status := 'reconciliation_needed'; result_reason := v_reason;
    result_workspace_id := v_workspace_id; result_revision := 0;
    return next; return;
  end if;

  select workspace.* into strict v_workspace
    from public.workspaces as workspace
   where workspace.id = v_workspace_id
   for update;
  v_effective_customer_id := coalesce(
    p_customer_id, v_workspace.stripe_customer_id
  );
  if p_customer_id is not null
     and v_workspace.stripe_customer_id is distinct from p_customer_id
     and not (
       p_binding_mode = 'checkout'
       and v_workspace.stripe_customer_id is null
     ) then
    v_reason := 'tenant_binding_conflict';
  end if;
  if p_binding_mode = 'customer_subscription'
     and v_workspace.stripe_subscription_id is not null
     and v_workspace.stripe_subscription_id <> p_subscription_id then
    v_reason := 'tenant_binding_conflict';
  end if;
  if v_reason is not null then
    update public.workspace_stripe_billing_events
       set workspace_id = v_workspace_id,
           processing_state = 'reconciliation_needed',
           processing_reason = v_reason, processed_at = statement_timestamp()
     where event_id = p_event_id;
    insert into public.workspace_stripe_billing_streams (
      workspace_id, event_stream, stripe_customer_id,
      stripe_subscription_id, sync_state, reconciliation_reason
    ) values (
      v_workspace_id, p_event_stream, v_effective_customer_id,
      p_subscription_id,
      'reconciliation_needed', v_reason
    ) on conflict (workspace_id, event_stream) do update
      set sync_state = 'reconciliation_needed',
          reconciliation_reason = excluded.reconciliation_reason,
          updated_at = statement_timestamp();
    if p_event_stream = 'lifecycle' then
      perform public.mark_workspace_stripe_billing_reconciliation(v_workspace_id);
    end if;
    result_status := 'reconciliation_needed'; result_reason := v_reason;
    result_workspace_id := v_workspace_id; result_revision := 0;
    return next; return;
  end if;

  select stream.* into v_stream
    from public.workspace_stripe_billing_streams as stream
   where stream.workspace_id = v_workspace_id
     and stream.event_stream = p_event_stream
   for update;
  if not found then
    -- A missing stream after the one-time seed can represent a Checkout that
    -- crossed the SQL-apply -> capture cutover window. Existing provider state
    -- must therefore never become in_sync merely because the runtime projection
    -- gate is open. Only a pristine Workspace may bootstrap from its first
    -- signed Checkout; every existing binding requires a canonical snapshot.
    select (
      p_projection_enabled
      and p_event_stream = 'lifecycle'
      and p_binding_mode = 'checkout'
      and v_workspace.stripe_customer_id is null
      and v_workspace.stripe_subscription_id is null
      and not exists (
        select 1
          from public.workspace_stripe_billing_object_bindings as binding
         where binding.workspace_id = v_workspace_id
      )
    ) into v_stream_bootstrap_allowed;
    insert into public.workspace_stripe_billing_streams (
      workspace_id, event_stream, stripe_customer_id,
      stripe_subscription_id, sync_state, reconciliation_reason
    ) values (
      v_workspace_id, p_event_stream, v_effective_customer_id,
      p_subscription_id,
      case when v_stream_bootstrap_allowed then 'in_sync'
        else 'reconciliation_needed' end,
      case when v_stream_bootstrap_allowed then null
        else 'controlled_cutover' end
    ) returning * into v_stream;
  end if;
  v_expected_revision := v_stream.projection_revision;

  select exists (
    select 1
      from public.workspace_stripe_billing_events as pending
     where pending.event_id <> p_event_id
       and pending.event_stream = p_event_stream
       and pending.processing_state in ('unresolved', 'reconciliation_needed')
       and (
         pending.workspace_id = v_workspace_id
         or pending.workspace_id_candidate = v_workspace_id
         or pending.stripe_customer_id = v_effective_customer_id
         or (pending.stripe_subscription_id is not null
             and pending.stripe_subscription_id = p_subscription_id)
         or (pending.stripe_checkout_session_id is not null
             and pending.stripe_checkout_session_id = p_checkout_session_id)
         or (pending.stripe_payment_intent_id is not null
             and pending.stripe_payment_intent_id = p_payment_intent_id)
         or (pending.stripe_invoice_id is not null
             and pending.stripe_invoice_id = p_invoice_id)
         or (pending.stripe_charge_id is not null
             and pending.stripe_charge_id = p_charge_id)
         or (pending.stripe_refund_id is not null
             and pending.stripe_refund_id = p_refund_id)
         or (pending.stripe_dispute_id is not null
             and pending.stripe_dispute_id = p_dispute_id)
         or (pending.stripe_tax_id is not null
             and pending.stripe_tax_id = p_tax_id)
         or exists (
           select 1
             from public.workspace_stripe_billing_object_bindings as binding
            where binding.workspace_id = v_workspace_id
              and (binding.stripe_object_type, binding.stripe_object_id) in (
                ('customer', pending.stripe_customer_id),
                ('subscription', pending.stripe_subscription_id),
                ('checkout_session', pending.stripe_checkout_session_id),
                ('payment_intent', pending.stripe_payment_intent_id),
                ('invoice', pending.stripe_invoice_id),
                ('charge', pending.stripe_charge_id),
                ('refund', pending.stripe_refund_id),
                ('dispute', pending.stripe_dispute_id),
                ('tax_id', pending.stripe_tax_id)
              )
         )
       )
  ) into v_prior_pending;

  if not p_projection_enabled then
    -- After SQL apply the two-key capture gate replaces the legacy PATCH path
    -- immediately, while the third key remains false through canonical
    -- cutover. Capture mode persists and fail-closes; it never projects.
    v_reason := 'reconciliation_pending';
  elsif v_stream.sync_state = 'reconciliation_needed' then
    v_reason := 'reconciliation_pending';
  elsif v_prior_pending then
    -- A formerly unresolved signed event is now attributable to this tenant.
    -- Do not let the newer event activate while that earlier state is unknown.
    v_reason := 'reconciliation_pending';
  elsif v_stream.last_event_created_at is not null
        and p_event_created_at < v_stream.last_event_created_at then
    v_reason := 'stale_event';
  elsif v_stream.last_event_created_at is not null
        and p_event_created_at = v_stream.last_event_created_at then
    v_reason := 'event_order_conflict';
  elsif p_event_stream = 'lifecycle'
        and v_stream.lifecycle_terminal
        and p_projection->>'billing_status' = 'active'
        and not (
          p_event_type like 'checkout.session.%'
          and p_subscription_id is not null
          and p_subscription_id is distinct from
              v_stream.stripe_subscription_id
        ) then
    -- A later-created invoice/payment event must not revive a deleted
    -- subscription. Only a new Checkout subscription can establish a fresh
    -- lifecycle automatically; every other revival needs canonical state.
    v_reason := 'terminal_subscription_conflict';
  end if;

  if v_reason = 'stale_event' then
    update public.workspace_stripe_billing_events
       set workspace_id = v_workspace_id, processing_state = 'ignored',
           processing_reason = v_reason,
           projection_revision = v_expected_revision,
           processed_at = statement_timestamp()
     where event_id = p_event_id;
    result_status := 'ignored'; result_reason := v_reason;
    result_workspace_id := v_workspace_id;
    result_revision := v_expected_revision;
    return next; return;
  end if;
  if v_reason in (
    'reconciliation_pending', 'event_order_conflict',
    'terminal_subscription_conflict'
  ) then
    update public.workspace_stripe_billing_streams
       set sync_state = 'reconciliation_needed',
           reconciliation_reason = v_reason,
           updated_at = statement_timestamp()
     where workspace_id = v_workspace_id and event_stream = p_event_stream;
    update public.workspace_stripe_billing_events
       set workspace_id = v_workspace_id,
           processing_state = 'reconciliation_needed',
           processing_reason = v_reason,
           projection_revision = v_expected_revision,
           processed_at = statement_timestamp()
     where event_id = p_event_id;
    if p_event_stream = 'lifecycle' then
      perform public.mark_workspace_stripe_billing_reconciliation(v_workspace_id);
    end if;
    result_status := 'reconciliation_needed'; result_reason := v_reason;
    result_workspace_id := v_workspace_id;
    result_revision := v_expected_revision;
    return next; return;
  end if;

  select (
    lower(btrim(coalesce(owner_user.email, ''))) = 'sandra.m@fanmind.ch'
    or exists (
      select 1 from public.demo_start_sessions as demo_session
       where demo_session.workspace_id = v_workspace_id
    )
  ) into v_demo_protected
    from auth.users as owner_user
   where owner_user.id = v_workspace.owner_user_id;
  v_demo_protected := coalesce(v_demo_protected, true);
  v_manual_protected :=
    (v_workspace.billing_status = 'manual_suspended')
    and (p_projection ? 'billing_status');
  v_protected := v_demo_protected or v_manual_protected;

  if not v_protected then
    perform public.apply_workspace_stripe_billing_projection(
      v_workspace_id, p_projection
    );
  end if;

  if not v_demo_protected then
    for v_object in
      select * from (values
        ('customer', p_customer_id), ('subscription', p_subscription_id),
        ('checkout_session', p_checkout_session_id),
        ('payment_intent', p_payment_intent_id), ('invoice', p_invoice_id),
        ('charge', p_charge_id), ('refund', p_refund_id),
        ('dispute', p_dispute_id), ('tax_id', p_tax_id)
      ) as object_ref(object_type, object_id)
      where object_ref.object_id is not null
      order by object_ref.object_type, object_ref.object_id
    loop
      insert into public.workspace_stripe_billing_object_bindings (
        stripe_object_type, stripe_object_id, workspace_id,
        stripe_customer_id, first_event_id, last_event_id
      ) values (
        v_object.object_type, v_object.object_id, v_workspace_id,
        v_effective_customer_id, p_event_id, p_event_id
      ) on conflict (stripe_object_type, stripe_object_id) do update
        set last_event_id = excluded.last_event_id,
            last_seen_at = statement_timestamp()
        where workspace_stripe_billing_object_bindings.workspace_id =
              excluded.workspace_id
          and workspace_stripe_billing_object_bindings.stripe_customer_id =
              excluded.stripe_customer_id;
      if not found then
        raise exception using errcode = '23514',
          message = 'workspace_stripe_billing_object_rebind_denied';
      end if;
    end loop;
  end if;

  update public.workspace_stripe_billing_streams
     set stripe_customer_id = v_effective_customer_id,
         stripe_subscription_id = coalesce(
           p_subscription_id, stripe_subscription_id
         ),
         sync_state = 'in_sync', reconciliation_reason = null,
         last_event_created_at = p_event_created_at,
         last_event_id = p_event_id,
         lifecycle_terminal = case
           when p_event_stream <> 'lifecycle' then lifecycle_terminal
           when p_event_type = 'customer.subscription.deleted' then true
           when p_event_type like 'checkout.session.%'
                and p_subscription_id is not null
                and p_subscription_id is distinct from
                    stripe_subscription_id then false
           else lifecycle_terminal
         end,
         projection_revision = projection_revision + 1,
         updated_at = statement_timestamp()
   where workspace_id = v_workspace_id
     and event_stream = p_event_stream
     and projection_revision = v_expected_revision
  returning projection_revision into result_revision;
  if not found then
    raise exception using errcode = '40001',
      message = 'workspace_stripe_billing_revision_conflict';
  end if;

  update public.workspace_stripe_billing_events
     set workspace_id = v_workspace_id,
         processing_state = case when v_protected then 'ignored' else 'applied' end,
         processing_reason = case when v_protected then 'protected_workspace' else null end,
         projection_revision = result_revision,
         processed_at = statement_timestamp()
   where event_id = p_event_id;
  result_status := case when v_protected then 'ignored' else 'applied' end;
  result_reason := case when v_protected then 'protected_workspace' else null end;
  result_workspace_id := v_workspace_id;
  return next;
end
$function$;

-- Canonical reconciliation is deliberately a separate operator boundary.
-- The provider snapshot must be fetched before this short transaction. The
-- RPC accepts only normalized fields, a Stripe request ID and a fingerprint;
-- it never performs a network call and never stores the raw Stripe response.
create function public.reconcile_workspace_stripe_billing_projection(
  p_workspace_id uuid,
  p_event_stream text,
  p_stripe_request_id text,
  p_snapshot_observed_at timestamptz,
  p_snapshot_fingerprint text,
  p_expected_revision bigint,
  p_customer_id text,
  p_subscription_id text,
  p_projection jsonb,
  p_resolved_event_ids text[],
  p_object_bindings jsonb
)
returns table (
  result_status text,
  result_revision bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_workspace public.workspaces%rowtype;
  v_stream public.workspace_stripe_billing_streams%rowtype;
  v_existing public.workspace_stripe_billing_reconciliations%rowtype;
  v_cutoff bigint;
  v_pending_max bigint;
  v_binding record;
  v_protected boolean;
  v_checkout_bootstrap boolean;
begin
  if p_event_stream not in ('lifecycle', 'tax')
     or p_stripe_request_id is null
     or p_stripe_request_id !~ '^req_[A-Za-z0-9_]+$'
     or p_snapshot_observed_at is null
     or p_snapshot_observed_at > statement_timestamp() + interval '5 minutes'
     or p_snapshot_fingerprint is null
     or p_snapshot_fingerprint !~ '^[a-f0-9]{64}$'
     or p_expected_revision is null or p_expected_revision < 0
     or p_customer_id is null or p_customer_id !~ '^cus_[A-Za-z0-9_]+$'
     or (p_subscription_id is not null
         and p_subscription_id !~ '^sub_[A-Za-z0-9_]+$')
     or (p_event_stream = 'tax' and p_subscription_id is not null)
     or p_resolved_event_ids is null
     or p_object_bindings is null
     or jsonb_typeof(p_object_bindings) <> 'array'
     or not public.workspace_stripe_billing_projection_valid(p_projection)
     or (
       p_event_stream = 'lifecycle'
       and (
         not (p_projection ?& array[
           'billing_status', 'workspace_access_mode',
           'billing_suspended_at', 'billing_suspended_reason'
         ])
         or (
           p_projection->>'billing_status' = 'active'
           and (
             p_projection->>'workspace_access_mode' <> 'active'
             or p_projection->'billing_suspended_at' <> 'null'::jsonb
             or p_projection->'billing_suspended_reason' <> 'null'::jsonb
           )
         )
         or (
           p_projection->>'billing_status' in (
             'suspended', 'cancelled', 'expired'
           )
           and p_projection->>'workspace_access_mode' <>
               'archived_readonly'
         )
       )
     )
     or (
       p_event_stream = 'tax'
       and exists (
         select 1
           from jsonb_object_keys(p_projection) as projection_key(key)
          where projection_key.key <> 'billing_note'
       )
     )
  then
    raise exception using errcode = '22023',
      message = 'workspace_stripe_billing_reconciliation_invalid';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_object_bindings) as binding(value)
     where jsonb_typeof(binding.value) <> 'object'
        or (binding.value - 'type' - 'id') <> '{}'::jsonb
        or binding.value->>'type' not in (
          'customer', 'subscription', 'checkout_session', 'payment_intent',
          'invoice', 'charge', 'refund', 'dispute', 'tax_id'
        )
        or binding.value->>'id' is null
        or not (
          (binding.value->>'type' = 'customer'
             and binding.value->>'id' ~ '^cus_[A-Za-z0-9_]+$')
          or (binding.value->>'type' = 'subscription'
             and binding.value->>'id' ~ '^sub_[A-Za-z0-9_]+$')
          or (binding.value->>'type' = 'checkout_session'
             and binding.value->>'id' ~ '^cs_[A-Za-z0-9_]+$')
          or (binding.value->>'type' = 'payment_intent'
             and binding.value->>'id' ~ '^pi_[A-Za-z0-9_]+$')
          or (binding.value->>'type' = 'invoice'
             and binding.value->>'id' ~ '^in_[A-Za-z0-9_]+$')
          or (binding.value->>'type' = 'charge'
             and binding.value->>'id' ~ '^ch_[A-Za-z0-9_]+$')
          or (binding.value->>'type' = 'refund'
             and binding.value->>'id' ~ '^re_[A-Za-z0-9_]+$')
          or (binding.value->>'type' = 'dispute'
             and binding.value->>'id' ~ '^dp_[A-Za-z0-9_]+$')
          or (binding.value->>'type' = 'tax_id'
             and binding.value->>'id' ~ '^txi_[A-Za-z0-9_]+$')
        )
        or (
          p_event_stream = 'tax'
          and binding.value->>'type' not in ('customer', 'tax_id')
        )
  ) or (
    select count(*) <> count(distinct (
      binding.value->>'type', binding.value->>'id'
    ))
      from jsonb_array_elements(p_object_bindings) as binding(value)
  ) or p_resolved_event_ids <> array(
    select supplied.event_id
      from unnest(p_resolved_event_ids) as supplied(event_id)
     order by supplied.event_id
  ) or cardinality(p_resolved_event_ids) <>
       cardinality(array(select distinct unnest(p_resolved_event_ids)))
    or exists (
      select 1 from unnest(p_resolved_event_ids) as supplied(event_id)
       where supplied.event_id is null
          or supplied.event_id !~ '^evt_[A-Za-z0-9_]+$'
  ) or p_object_bindings <> coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'type', binding.value->>'type', 'id', binding.value->>'id'
      ) order by binding.value->>'type', binding.value->>'id'
    )
      from jsonb_array_elements(p_object_bindings) as binding(value)
  ), '[]'::jsonb) then
    raise exception using errcode = '22023',
      message = 'workspace_stripe_billing_reconciliation_binding_invalid';
  end if;

  -- Concurrent retries of the same provider request serialize before the
  -- idempotency read. A hash collision only causes harmless serialization.
  perform pg_advisory_xact_lock(
    hashtextextended(p_stripe_request_id, 7281941)
  );

  select reconciliation.* into v_existing
    from public.workspace_stripe_billing_reconciliations as reconciliation
   where reconciliation.stripe_request_id = p_stripe_request_id;
  if found then
    if v_existing.workspace_id = p_workspace_id
       and v_existing.event_stream = p_event_stream
       and v_existing.snapshot_fingerprint = p_snapshot_fingerprint
       and v_existing.expected_revision = p_expected_revision
       and v_existing.stripe_customer_id = p_customer_id
       and v_existing.stripe_subscription_id is not distinct from
           p_subscription_id
       and v_existing.snapshot_observed_at = p_snapshot_observed_at
       and v_existing.resolved_event_ids = p_resolved_event_ids then
      result_status := 'duplicate_reconciliation';
      result_revision := v_existing.resulting_revision;
      return next; return;
    end if;
    raise exception using errcode = '23505',
      message = 'workspace_stripe_billing_reconciliation_identity_conflict';
  end if;

  -- Freshness is checked after request-id idempotency so an old retry of an
  -- already committed receipt remains a harmless duplicate.
  if p_snapshot_observed_at < statement_timestamp() - interval '15 minutes'
  then
    raise exception using errcode = '22023',
      message = 'workspace_stripe_billing_reconciliation_snapshot_expired';
  end if;

  -- Match the event-ingest serialization boundary before locking event rows.
  -- Canonical bindings are sorted so two reconciliations cannot invert locks.
  for v_binding in
    select canonical_anchor.anchor_type, canonical_anchor.anchor_id
      from (
      select binding.value->>'type' as anchor_type,
             binding.value->>'id' as anchor_id
        from jsonb_array_elements(p_object_bindings) as binding(value)
      union
      select 'workspace', p_workspace_id::text
    ) as canonical_anchor
     order by canonical_anchor.anchor_type, canonical_anchor.anchor_id
  loop
    perform pg_advisory_xact_lock(
      hashtextextended(
        'fanmind-stripe-billing:' || v_binding.anchor_type || ':' ||
        v_binding.anchor_id,
        7281942
      )
    );
  end loop;

  -- Apply locks one event identity before its Workspace. Reconciliation must
  -- use the same order. Lexical event-ID order here is only a deadlock-free
  -- multi-row lock order; it is never used as Stripe lifecycle chronology.
  perform event.event_id
    from public.workspace_stripe_billing_events as event
   where event.event_id = any(p_resolved_event_ids)
   order by event.event_id
   for update;

  select workspace.* into strict v_workspace
    from public.workspaces as workspace
   where workspace.id = p_workspace_id for update;
  select exists (
    select 1
      from public.workspace_stripe_billing_events as event
     where event.event_id = any(p_resolved_event_ids)
       and event.binding_mode = 'checkout'
       and event.workspace_id_candidate = p_workspace_id
       and not event.workspace_candidate_conflict
       and event.stripe_checkout_session_id is not null
       and (
         event.stripe_customer_id is null
         or event.stripe_customer_id = p_customer_id
       )
       and exists (
         select 1
           from jsonb_array_elements(p_object_bindings) as binding(value)
          where binding.value->>'type' = 'checkout_session'
            and binding.value->>'id' = event.stripe_checkout_session_id
       )
  ) into v_checkout_bootstrap;
  if v_workspace.stripe_customer_id is distinct from p_customer_id then
    if not (
      v_workspace.stripe_customer_id is null
      and p_event_stream = 'lifecycle'
      and v_checkout_bootstrap
      and p_projection->>'stripe_customer_id' = p_customer_id
      and exists (
        select 1
          from jsonb_array_elements(p_object_bindings) as binding(value)
         where binding.value->>'type' = 'customer'
           and binding.value->>'id' = p_customer_id
      )
    ) then
      raise exception using errcode = '23514',
        message = 'workspace_stripe_billing_reconciliation_customer_mismatch';
    end if;
  end if;
  if (p_projection ? 'stripe_customer_id'
      and p_projection->>'stripe_customer_id' is distinct from p_customer_id)
     or (p_projection ? 'stripe_subscription_id'
      and p_projection->>'stripe_subscription_id' is distinct from p_subscription_id)
  then
    raise exception using errcode = '23514',
      message = 'workspace_stripe_billing_reconciliation_projection_mismatch';
  end if;
  if p_event_stream = 'lifecycle'
     and v_workspace.stripe_subscription_id is not null
     and p_subscription_id is null then
    raise exception using errcode = '23514',
      message = 'workspace_stripe_billing_reconciliation_subscription_mismatch';
  end if;
  if p_event_stream = 'lifecycle'
     and p_subscription_id is distinct from
         v_workspace.stripe_subscription_id
     and (
       not (p_projection ? 'stripe_subscription_id')
       or p_projection->>'stripe_subscription_id' is distinct from
          p_subscription_id
     ) then
    raise exception using errcode = '23514',
      message = 'workspace_stripe_billing_reconciliation_subscription_projection_missing';
  end if;

  select stream.* into v_stream
    from public.workspace_stripe_billing_streams as stream
   where stream.workspace_id = p_workspace_id
     and stream.event_stream = p_event_stream
   for update;
  if not found then
    if p_expected_revision <> 0 then
      raise exception using errcode = '40001',
        message = 'workspace_stripe_billing_reconciliation_cas_conflict';
    end if;
    insert into public.workspace_stripe_billing_streams (
      workspace_id, event_stream, stripe_customer_id,
      stripe_subscription_id, sync_state, reconciliation_reason
    ) values (
      p_workspace_id, p_event_stream, p_customer_id, p_subscription_id,
      'reconciliation_needed', 'unresolved_event'
    ) returning * into v_stream;
  end if;
  if (
       v_stream.sync_state <> 'reconciliation_needed'
       and cardinality(p_resolved_event_ids) = 0
     )
     or v_stream.projection_revision <> p_expected_revision then
    raise exception using errcode = '40001',
      message = 'workspace_stripe_billing_reconciliation_cas_conflict';
  end if;

  if exists (
    select 1 from unnest(p_resolved_event_ids) as supplied(event_id)
    left join public.workspace_stripe_billing_events as event
      on event.event_id = supplied.event_id
   where event.event_id is null
      or event.event_stream <> p_event_stream
      or event.processing_state not in ('unresolved', 'reconciliation_needed')
      or (
        event.workspace_id is not null
        and event.workspace_id <> p_workspace_id
      )
      or (
        event.stripe_customer_id is not null
        and event.stripe_customer_id <> p_customer_id
      )
      or (
        event.stripe_customer_id is null
        and not exists (
          select 1
            from jsonb_array_elements(p_object_bindings) as binding(value)
           where (binding.value->>'type', binding.value->>'id') in (
             ('subscription', event.stripe_subscription_id),
             ('checkout_session', event.stripe_checkout_session_id),
             ('payment_intent', event.stripe_payment_intent_id),
             ('invoice', event.stripe_invoice_id),
             ('charge', event.stripe_charge_id),
             ('refund', event.stripe_refund_id),
             ('dispute', event.stripe_dispute_id),
             ('tax_id', event.stripe_tax_id)
           )
        )
      )
  ) then
    raise exception using errcode = '23514',
      message = 'workspace_stripe_billing_reconciliation_event_mismatch';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(p_object_bindings) as binding(value)
     where binding.value->>'type' = 'customer'
       and binding.value->>'id' = p_customer_id
  ) or (
    p_subscription_id is not null and not exists (
      select 1 from jsonb_array_elements(p_object_bindings) as binding(value)
       where binding.value->>'type' = 'subscription'
         and binding.value->>'id' = p_subscription_id
    )
  ) then
    raise exception using errcode = '23514',
      message = 'workspace_stripe_billing_reconciliation_binding_incomplete';
  end if;
  if exists (
    select 1
      from public.workspace_stripe_billing_events as event
     where event.event_stream = p_event_stream
       and (
         event.workspace_id = p_workspace_id
         or (
           event.workspace_id is null
           and (
             event.stripe_customer_id = p_customer_id
             or event.workspace_id_candidate = p_workspace_id
             or exists (
               select 1
                 from jsonb_array_elements(p_object_bindings) as binding(value)
                where (binding.value->>'type', binding.value->>'id') in (
                  ('subscription', event.stripe_subscription_id),
                  ('checkout_session', event.stripe_checkout_session_id),
                  ('payment_intent', event.stripe_payment_intent_id),
                  ('invoice', event.stripe_invoice_id),
                  ('charge', event.stripe_charge_id),
                  ('refund', event.stripe_refund_id),
                  ('dispute', event.stripe_dispute_id),
                  ('tax_id', event.stripe_tax_id)
                )
             )
           )
         )
       )
       and event.processing_state in ('unresolved', 'reconciliation_needed')
       and not (event.event_id = any(p_resolved_event_ids))
  ) then
    raise exception using errcode = '23514',
      message = 'workspace_stripe_billing_reconciliation_pending_omitted';
  end if;

  select max(event.event_created_at) into v_pending_max
    from public.workspace_stripe_billing_events as event
   where event.event_id = any(p_resolved_event_ids);
  v_cutoff := floor(extract(epoch from p_snapshot_observed_at))::bigint;
  if v_cutoff <= greatest(
    coalesce(v_pending_max, -1),
    coalesce(v_stream.last_event_created_at, -1)
  ) then
    raise exception using errcode = '22023',
      message = 'workspace_stripe_billing_reconciliation_snapshot_too_old';
  end if;

  select (
    lower(btrim(coalesce(owner_user.email, ''))) =
       'sandra.m@fanmind.ch'
    or exists (
      select 1 from public.demo_start_sessions as demo_session
       where demo_session.workspace_id = workspace.id
    )
  ) into v_protected
    from public.workspaces as workspace
    left join auth.users as owner_user on owner_user.id = workspace.owner_user_id
   where workspace.id = p_workspace_id;
  if not coalesce(v_protected, true) then
    perform public.apply_workspace_stripe_billing_projection(
      p_workspace_id, p_projection
    );
  end if;

  for v_binding in
    select value->>'type' as object_type, value->>'id' as object_id
      from jsonb_array_elements(p_object_bindings)
     order by value->>'type', value->>'id'
  loop
    if v_binding.object_type not in (
      'customer', 'subscription', 'checkout_session', 'payment_intent',
      'invoice', 'charge', 'refund', 'dispute', 'tax_id'
    ) or v_binding.object_id is null then
      raise exception using errcode = '22023',
        message = 'workspace_stripe_billing_reconciliation_binding_invalid';
    end if;
    insert into public.workspace_stripe_billing_object_bindings (
      stripe_object_type, stripe_object_id, workspace_id, stripe_customer_id
    ) values (
      v_binding.object_type, v_binding.object_id,
      p_workspace_id, p_customer_id
    ) on conflict (stripe_object_type, stripe_object_id) do update
      set last_seen_at = statement_timestamp()
      where workspace_stripe_billing_object_bindings.workspace_id =
            excluded.workspace_id
        and workspace_stripe_billing_object_bindings.stripe_customer_id =
            excluded.stripe_customer_id;
    if not found then
      raise exception using errcode = '23514',
        message = 'workspace_stripe_billing_reconciliation_rebind_denied';
    end if;
  end loop;

  insert into public.workspace_stripe_billing_reconciliations (
    stripe_request_id, workspace_id, event_stream, stripe_customer_id,
    stripe_subscription_id, snapshot_observed_at, snapshot_fingerprint,
    expected_revision, resulting_revision, resolved_event_ids
  ) values (
    p_stripe_request_id, p_workspace_id, p_event_stream, p_customer_id,
    p_subscription_id, p_snapshot_observed_at, p_snapshot_fingerprint,
    p_expected_revision, p_expected_revision + 1,
    p_resolved_event_ids
  );

  update public.workspace_stripe_billing_events
     set workspace_id = p_workspace_id, processing_state = 'reconciled',
         processing_reason = null, processed_at = statement_timestamp(),
         projection_revision = p_expected_revision + 1,
         reconciled_by_request_id = p_stripe_request_id
   where event_id = any(p_resolved_event_ids);

  update public.workspace_stripe_billing_streams
     set stripe_customer_id = p_customer_id,
         stripe_subscription_id = p_subscription_id,
         sync_state = 'in_sync', reconciliation_reason = null,
         last_event_created_at = v_cutoff, last_event_id = null,
         lifecycle_terminal = case
           when p_event_stream = 'lifecycle' then
             p_projection->>'billing_status' in ('cancelled', 'expired')
           else lifecycle_terminal
         end,
         projection_revision = projection_revision + 1,
         updated_at = statement_timestamp()
   where workspace_id = p_workspace_id
     and event_stream = p_event_stream
     and projection_revision = p_expected_revision
  returning projection_revision into result_revision;
  if not found then
    raise exception using errcode = '40001',
      message = 'workspace_stripe_billing_reconciliation_cas_conflict';
  end if;
  result_status := 'reconciled';
  return next;
end
$function$;

revoke all on function public.workspace_stripe_billing_projection_valid(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.apply_workspace_stripe_billing_projection(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.mark_workspace_stripe_billing_reconciliation(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.apply_workspace_stripe_billing_event(
  boolean, boolean, text, bigint, text, text, text, uuid, boolean, text, text,
  text, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.apply_workspace_stripe_billing_event(
  boolean, boolean, text, bigint, text, text, text, uuid, boolean, text, text,
  text, text, text, text, text, text, text, text, jsonb
) to service_role;
revoke all on function public.reconcile_workspace_stripe_billing_projection(
  uuid, text, text, timestamptz, text, bigint, text, text, jsonb, text[], jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.reconcile_workspace_stripe_billing_projection(
  uuid, text, text, timestamptz, text, bigint, text, text, jsonb, text[], jsonb
) to service_role;

-- FANMIND_STRIPE_BILLING_SCHEMA_REFERENCE_BEGIN
-- These session-local reference objects are the immutable schema oracle. The
-- dedicated runner extracts this exact checksum-pinned block into every
-- independent postflight, creates it only in pg_temp, and then performs the
-- actual comparison inside a READ ONLY transaction. Mutable database comments
-- or a recomputed CHECK token list therefore cannot redefine the expected
-- schema after the reviewed control has shipped.
create temporary table fanmind_expected_workspaces (
  id uuid primary key
);

create temporary table fanmind_expected_workspace_stripe_billing_streams (
  workspace_id uuid not null,
  event_stream text not null,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  sync_state text not null,
  reconciliation_reason text,
  last_event_created_at bigint,
  last_event_id text,
  lifecycle_terminal boolean not null default false,
  projection_revision bigint not null default 0,
  updated_at timestamptz not null default statement_timestamp(),
  constraint workspace_stripe_billing_streams_pkey
    primary key (workspace_id, event_stream),
  constraint workspace_stripe_billing_streams_workspace_id_fkey
    foreign key (workspace_id)
    references fanmind_expected_workspaces(id) on delete cascade,
  constraint workspace_stripe_billing_stream_name_check
    check (event_stream in ('lifecycle', 'tax')),
  constraint workspace_stripe_billing_stream_customer_check
    check (stripe_customer_id ~ '^cus_[A-Za-z0-9_]+$'),
  constraint workspace_stripe_billing_stream_subscription_check
    check (
      stripe_subscription_id is null
      or stripe_subscription_id ~ '^sub_[A-Za-z0-9_]+$'
    ),
  constraint workspace_stripe_billing_stream_state_check
    check (
      (sync_state = 'in_sync' and reconciliation_reason is null)
      or (
        sync_state = 'reconciliation_needed'
        and reconciliation_reason in (
          'controlled_cutover', 'event_identity_conflict',
          'event_order_conflict', 'reconciliation_pending',
          'tenant_binding_conflict', 'terminal_subscription_conflict',
          'unresolved_event'
        )
      )
    ),
  constraint workspace_stripe_billing_stream_order_check
    check (
      (last_event_created_at is null and last_event_id is null)
      or (
        last_event_created_at >= 0
        and (
          last_event_id is null
          or last_event_id ~ '^evt_[A-Za-z0-9_]+$'
        )
      )
    ),
  constraint workspace_stripe_billing_stream_revision_check
    check (projection_revision >= 0)
);

create temporary table fanmind_expected_workspace_stripe_billing_object_bindings (
  stripe_object_type text not null,
  stripe_object_id text not null,
  workspace_id uuid not null,
  stripe_customer_id text not null,
  first_event_id text,
  last_event_id text,
  first_seen_at timestamptz not null default statement_timestamp(),
  last_seen_at timestamptz not null default statement_timestamp(),
  constraint workspace_stripe_billing_object_bindings_pkey
    primary key (stripe_object_type, stripe_object_id),
  constraint workspace_stripe_billing_object_bindings_workspace_id_fkey
    foreign key (workspace_id)
    references fanmind_expected_workspaces(id) on delete cascade,
  constraint workspace_stripe_billing_object_type_check
    check (
      stripe_object_type in (
        'customer', 'subscription', 'checkout_session', 'payment_intent',
        'invoice', 'charge', 'refund', 'dispute', 'tax_id'
      )
    ),
  constraint workspace_stripe_billing_object_id_check
    check (
      (stripe_object_type = 'customer' and stripe_object_id ~ '^cus_[A-Za-z0-9_]+$')
      or (stripe_object_type = 'subscription' and stripe_object_id ~ '^sub_[A-Za-z0-9_]+$')
      or (stripe_object_type = 'checkout_session' and stripe_object_id ~ '^cs_[A-Za-z0-9_]+$')
      or (stripe_object_type = 'payment_intent' and stripe_object_id ~ '^pi_[A-Za-z0-9_]+$')
      or (stripe_object_type = 'invoice' and stripe_object_id ~ '^in_[A-Za-z0-9_]+$')
      or (stripe_object_type = 'charge' and stripe_object_id ~ '^ch_[A-Za-z0-9_]+$')
      or (stripe_object_type = 'refund' and stripe_object_id ~ '^re_[A-Za-z0-9_]+$')
      or (stripe_object_type = 'dispute' and stripe_object_id ~ '^dp_[A-Za-z0-9_]+$')
      or (stripe_object_type = 'tax_id' and stripe_object_id ~ '^txi_[A-Za-z0-9_]+$')
    ),
  constraint workspace_stripe_billing_object_customer_check
    check (stripe_customer_id ~ '^cus_[A-Za-z0-9_]+$'),
  constraint workspace_stripe_billing_object_event_check
    check (
      (first_event_id is null or first_event_id ~ '^evt_[A-Za-z0-9_]+$')
      and (last_event_id is null or last_event_id ~ '^evt_[A-Za-z0-9_]+$')
    )
);

create index workspace_stripe_billing_object_workspace_idx
  on fanmind_expected_workspace_stripe_billing_object_bindings
    (workspace_id, stripe_object_type, last_seen_at desc);

create temporary table fanmind_expected_workspace_stripe_billing_reconciliations (
  stripe_request_id text not null,
  workspace_id uuid not null,
  event_stream text not null,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  snapshot_observed_at timestamptz not null,
  snapshot_fingerprint text not null,
  expected_revision bigint not null,
  resulting_revision bigint not null,
  resolved_event_ids text[] not null default '{}',
  created_at timestamptz not null default statement_timestamp(),
  constraint workspace_stripe_billing_reconciliations_pkey
    primary key (stripe_request_id),
  constraint workspace_stripe_billing_reconciliations_workspace_id_fkey
    foreign key (workspace_id)
    references fanmind_expected_workspaces(id) on delete cascade,
  constraint workspace_stripe_billing_reconciliation_request_check
    check (stripe_request_id ~ '^req_[A-Za-z0-9_]+$'),
  constraint workspace_stripe_billing_reconciliation_stream_check
    check (event_stream in ('lifecycle', 'tax')),
  constraint workspace_stripe_billing_reconciliation_customer_check
    check (stripe_customer_id ~ '^cus_[A-Za-z0-9_]+$'),
  constraint workspace_stripe_billing_reconciliation_subscription_check
    check (
      stripe_subscription_id is null
      or stripe_subscription_id ~ '^sub_[A-Za-z0-9_]+$'
    ),
  constraint workspace_stripe_billing_reconciliation_fingerprint_check
    check (snapshot_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint workspace_stripe_billing_reconciliation_revision_check
    check (
      expected_revision >= 0
      and resulting_revision = expected_revision + 1
    )
);

create index workspace_stripe_billing_reconciliation_workspace_idx
  on fanmind_expected_workspace_stripe_billing_reconciliations
    (workspace_id, event_stream, created_at desc);

create temporary table fanmind_expected_workspace_stripe_billing_events (
  event_id text not null,
  workspace_id uuid,
  event_created_at bigint not null,
  event_type text not null,
  event_stream text not null,
  binding_mode text not null,
  workspace_id_candidate uuid,
  workspace_candidate_conflict boolean not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_invoice_id text,
  stripe_charge_id text,
  stripe_refund_id text,
  stripe_dispute_id text,
  stripe_tax_id text,
  payload_fingerprint text not null,
  processing_state text not null,
  processing_reason text,
  projection_revision bigint not null default 0,
  signature_verified_at timestamptz not null default statement_timestamp(),
  processed_at timestamptz,
  reconciled_by_request_id text,
  constraint workspace_stripe_billing_events_pkey
    primary key (event_id),
  constraint workspace_stripe_billing_events_workspace_id_fkey
    foreign key (workspace_id)
    references fanmind_expected_workspaces(id) on delete cascade,
  constraint workspace_stripe_billing_events_reconciled_by_request_id_fkey
    foreign key (reconciled_by_request_id)
    references fanmind_expected_workspace_stripe_billing_reconciliations(
      stripe_request_id
    ) on delete restrict,
  constraint workspace_stripe_billing_event_id_check
    check (event_id ~ '^evt_[A-Za-z0-9_]+$'),
  constraint workspace_stripe_billing_event_created_check
    check (event_created_at >= 0),
  constraint workspace_stripe_billing_event_type_check
    check (event_type in (
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed',
      'payment_intent.processing', 'payment_intent.succeeded',
      'payment_intent.payment_failed', 'invoice.paid', 'invoice.updated',
      'invoice.payment_failed', 'customer.subscription.created',
      'customer.subscription.updated', 'customer.subscription.resumed',
      'customer.subscription.paused', 'customer.subscription.deleted',
      'charge.refunded', 'refund.created', 'refund.updated', 'refund.failed',
      'charge.dispute.created', 'customer.tax_id.created',
      'customer.tax_id.updated', 'customer.tax_id.deleted'
    )),
  constraint workspace_stripe_billing_event_stream_check
    check (event_stream in ('lifecycle', 'tax')),
  constraint workspace_stripe_billing_event_mode_check
    check (binding_mode in (
      'checkout', 'customer_transaction', 'customer_subscription',
      'reversal', 'tax'
    )),
  constraint workspace_stripe_billing_event_refs_check
    check (
      (stripe_customer_id is null or stripe_customer_id ~ '^cus_[A-Za-z0-9_]+$')
      and (stripe_subscription_id is null or stripe_subscription_id ~ '^sub_[A-Za-z0-9_]+$')
      and (stripe_checkout_session_id is null or stripe_checkout_session_id ~ '^cs_[A-Za-z0-9_]+$')
      and (stripe_payment_intent_id is null or stripe_payment_intent_id ~ '^pi_[A-Za-z0-9_]+$')
      and (stripe_invoice_id is null or stripe_invoice_id ~ '^in_[A-Za-z0-9_]+$')
      and (stripe_charge_id is null or stripe_charge_id ~ '^ch_[A-Za-z0-9_]+$')
      and (stripe_refund_id is null or stripe_refund_id ~ '^re_[A-Za-z0-9_]+$')
      and (stripe_dispute_id is null or stripe_dispute_id ~ '^dp_[A-Za-z0-9_]+$')
      and (stripe_tax_id is null or stripe_tax_id ~ '^txi_[A-Za-z0-9_]+$')
    ),
  constraint workspace_stripe_billing_event_fingerprint_check
    check (payload_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint workspace_stripe_billing_event_processing_check
    check (
      (processing_state = 'received' and processing_reason is null)
      or (processing_state = 'applied' and processing_reason is null)
      or (
        processing_state = 'ignored'
        and processing_reason in (
          'stale_event', 'protected_workspace'
        )
      )
      or (
        processing_state = 'unresolved'
        and processing_reason in (
          'tenant_binding_missing', 'object_binding_missing'
        )
      )
      or (
        processing_state = 'reconciliation_needed'
        and processing_reason in (
          'event_identity_conflict', 'event_order_conflict',
          'reconciliation_pending', 'tenant_binding_conflict',
          'terminal_subscription_conflict'
        )
      )
      or (processing_state = 'reconciled' and processing_reason is null)
    ),
  constraint workspace_stripe_billing_event_revision_check
    check (projection_revision >= 0),
  constraint workspace_stripe_billing_event_processed_check
    check (
      (processing_state = 'received' and processed_at is null)
      or (processing_state <> 'received' and processed_at is not null)
    )
);

create index workspace_stripe_billing_event_workspace_order_idx
  on fanmind_expected_workspace_stripe_billing_events
    (workspace_id, event_stream, event_created_at desc)
  where workspace_id is not null;
create index workspace_stripe_billing_event_pending_idx
  on fanmind_expected_workspace_stripe_billing_events
    (event_stream, event_created_at, event_id)
  where processing_state in ('unresolved', 'reconciliation_needed');
-- FANMIND_STRIPE_BILLING_SCHEMA_REFERENCE_END

-- This verifier is persisted with no runtime-role EXECUTE grant. The
-- dedicated runner pins its exact function body from this checksum-pinned
-- control, calls it inside this transaction, then independently compares and
-- calls the committed copy in a new read-only transaction.
create function public.verify_workspace_stripe_billing_ledger_schema()
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $schema_verify$
declare
  v_table regclass;
  v_column text;
  v_function record;
  v_check record;
  v_definition record;
  v_expected_table regclass;
  v_expected_index regclass;
  v_actual_definition text;
  v_expected_definition text;
  v_actual_hash text;
  v_expected_hash text;
begin
  -- Exact column topology. A full join makes both missing and unexpected
  -- columns fail; ordinal, type, nullability, default, identity and generated
  -- state are all part of the contract.
  if exists (
    with expected(
      table_name, ordinal_position, column_name, data_type,
      is_not_null, default_expression
    ) as (values
      ('workspace_stripe_billing_streams', 1, 'workspace_id', 'uuid', true, null::text),
      ('workspace_stripe_billing_streams', 2, 'event_stream', 'text', true, null::text),
      ('workspace_stripe_billing_streams', 3, 'stripe_customer_id', 'text', true, null::text),
      ('workspace_stripe_billing_streams', 4, 'stripe_subscription_id', 'text', false, null::text),
      ('workspace_stripe_billing_streams', 5, 'sync_state', 'text', true, null::text),
      ('workspace_stripe_billing_streams', 6, 'reconciliation_reason', 'text', false, null::text),
      ('workspace_stripe_billing_streams', 7, 'last_event_created_at', 'bigint', false, null::text),
      ('workspace_stripe_billing_streams', 8, 'last_event_id', 'text', false, null::text),
      ('workspace_stripe_billing_streams', 9, 'lifecycle_terminal', 'boolean', true, 'false'),
      ('workspace_stripe_billing_streams', 10, 'projection_revision', 'bigint', true, '0'),
      ('workspace_stripe_billing_streams', 11, 'updated_at', 'timestamp with time zone', true, 'statement_timestamp()'),
      ('workspace_stripe_billing_object_bindings', 1, 'stripe_object_type', 'text', true, null::text),
      ('workspace_stripe_billing_object_bindings', 2, 'stripe_object_id', 'text', true, null::text),
      ('workspace_stripe_billing_object_bindings', 3, 'workspace_id', 'uuid', true, null::text),
      ('workspace_stripe_billing_object_bindings', 4, 'stripe_customer_id', 'text', true, null::text),
      ('workspace_stripe_billing_object_bindings', 5, 'first_event_id', 'text', false, null::text),
      ('workspace_stripe_billing_object_bindings', 6, 'last_event_id', 'text', false, null::text),
      ('workspace_stripe_billing_object_bindings', 7, 'first_seen_at', 'timestamp with time zone', true, 'statement_timestamp()'),
      ('workspace_stripe_billing_object_bindings', 8, 'last_seen_at', 'timestamp with time zone', true, 'statement_timestamp()'),
      ('workspace_stripe_billing_reconciliations', 1, 'stripe_request_id', 'text', true, null::text),
      ('workspace_stripe_billing_reconciliations', 2, 'workspace_id', 'uuid', true, null::text),
      ('workspace_stripe_billing_reconciliations', 3, 'event_stream', 'text', true, null::text),
      ('workspace_stripe_billing_reconciliations', 4, 'stripe_customer_id', 'text', true, null::text),
      ('workspace_stripe_billing_reconciliations', 5, 'stripe_subscription_id', 'text', false, null::text),
      ('workspace_stripe_billing_reconciliations', 6, 'snapshot_observed_at', 'timestamp with time zone', true, null::text),
      ('workspace_stripe_billing_reconciliations', 7, 'snapshot_fingerprint', 'text', true, null::text),
      ('workspace_stripe_billing_reconciliations', 8, 'expected_revision', 'bigint', true, null::text),
      ('workspace_stripe_billing_reconciliations', 9, 'resulting_revision', 'bigint', true, null::text),
      ('workspace_stripe_billing_reconciliations', 10, 'resolved_event_ids', 'text[]', true, '''{}''::text[]'),
      ('workspace_stripe_billing_reconciliations', 11, 'created_at', 'timestamp with time zone', true, 'statement_timestamp()'),
      ('workspace_stripe_billing_events', 1, 'event_id', 'text', true, null::text),
      ('workspace_stripe_billing_events', 2, 'workspace_id', 'uuid', false, null::text),
      ('workspace_stripe_billing_events', 3, 'event_created_at', 'bigint', true, null::text),
      ('workspace_stripe_billing_events', 4, 'event_type', 'text', true, null::text),
      ('workspace_stripe_billing_events', 5, 'event_stream', 'text', true, null::text),
      ('workspace_stripe_billing_events', 6, 'binding_mode', 'text', true, null::text),
      ('workspace_stripe_billing_events', 7, 'workspace_id_candidate', 'uuid', false, null::text),
      ('workspace_stripe_billing_events', 8, 'workspace_candidate_conflict', 'boolean', true, null::text),
      ('workspace_stripe_billing_events', 9, 'stripe_customer_id', 'text', false, null::text),
      ('workspace_stripe_billing_events', 10, 'stripe_subscription_id', 'text', false, null::text),
      ('workspace_stripe_billing_events', 11, 'stripe_checkout_session_id', 'text', false, null::text),
      ('workspace_stripe_billing_events', 12, 'stripe_payment_intent_id', 'text', false, null::text),
      ('workspace_stripe_billing_events', 13, 'stripe_invoice_id', 'text', false, null::text),
      ('workspace_stripe_billing_events', 14, 'stripe_charge_id', 'text', false, null::text),
      ('workspace_stripe_billing_events', 15, 'stripe_refund_id', 'text', false, null::text),
      ('workspace_stripe_billing_events', 16, 'stripe_dispute_id', 'text', false, null::text),
      ('workspace_stripe_billing_events', 17, 'stripe_tax_id', 'text', false, null::text),
      ('workspace_stripe_billing_events', 18, 'payload_fingerprint', 'text', true, null::text),
      ('workspace_stripe_billing_events', 19, 'processing_state', 'text', true, null::text),
      ('workspace_stripe_billing_events', 20, 'processing_reason', 'text', false, null::text),
      ('workspace_stripe_billing_events', 21, 'projection_revision', 'bigint', true, '0'),
      ('workspace_stripe_billing_events', 22, 'signature_verified_at', 'timestamp with time zone', true, 'statement_timestamp()'),
      ('workspace_stripe_billing_events', 23, 'processed_at', 'timestamp with time zone', false, null::text),
      ('workspace_stripe_billing_events', 24, 'reconciled_by_request_id', 'text', false, null::text)
    ), actual as (
      select relation.relname::text as table_name,
             attribute.attnum::integer as ordinal_position,
             attribute.attname::text as column_name,
             format_type(attribute.atttypid, attribute.atttypmod) as data_type,
             attribute.attnotnull as is_not_null,
             pg_get_expr(default_value.adbin, default_value.adrelid) as default_expression,
             attribute.attidentity, attribute.attgenerated
        from pg_class as relation
        join pg_namespace as namespace on namespace.oid = relation.relnamespace
        join pg_attribute as attribute on attribute.attrelid = relation.oid
        left join pg_attrdef as default_value
          on default_value.adrelid = attribute.attrelid
         and default_value.adnum = attribute.attnum
       where namespace.nspname = 'public'
         and relation.relname in (
           'workspace_stripe_billing_streams',
           'workspace_stripe_billing_object_bindings',
           'workspace_stripe_billing_reconciliations',
           'workspace_stripe_billing_events'
         )
         and relation.relkind = 'r'
         and attribute.attnum > 0 and not attribute.attisdropped
    )
    select 1 from expected
    full join actual using (table_name, column_name)
     where expected.table_name is null or actual.table_name is null
        or expected.ordinal_position is distinct from actual.ordinal_position
        or expected.data_type is distinct from actual.data_type
        or expected.is_not_null is distinct from actual.is_not_null
        or expected.default_expression is distinct from actual.default_expression
        or actual.attidentity <> '' or actual.attgenerated <> ''
  ) then
    raise exception 'stripe_billing_ledger_columns_invalid';
  end if;

  -- Exact named constraint topology; no missing, unexpected, unvalidated,
  -- deferrable or deferred constraint can survive this full comparison.
  if exists (
    with expected(table_name, constraint_name, constraint_type) as (values
      ('workspace_stripe_billing_streams', 'workspace_stripe_billing_streams_pkey', 'p'),
      ('workspace_stripe_billing_streams', 'workspace_stripe_billing_streams_workspace_id_fkey', 'f'),
      ('workspace_stripe_billing_streams', 'workspace_stripe_billing_stream_name_check', 'c'),
      ('workspace_stripe_billing_streams', 'workspace_stripe_billing_stream_customer_check', 'c'),
      ('workspace_stripe_billing_streams', 'workspace_stripe_billing_stream_subscription_check', 'c'),
      ('workspace_stripe_billing_streams', 'workspace_stripe_billing_stream_state_check', 'c'),
      ('workspace_stripe_billing_streams', 'workspace_stripe_billing_stream_order_check', 'c'),
      ('workspace_stripe_billing_streams', 'workspace_stripe_billing_stream_revision_check', 'c'),
      ('workspace_stripe_billing_object_bindings', 'workspace_stripe_billing_object_bindings_pkey', 'p'),
      ('workspace_stripe_billing_object_bindings', 'workspace_stripe_billing_object_bindings_workspace_id_fkey', 'f'),
      ('workspace_stripe_billing_object_bindings', 'workspace_stripe_billing_object_type_check', 'c'),
      ('workspace_stripe_billing_object_bindings', 'workspace_stripe_billing_object_id_check', 'c'),
      ('workspace_stripe_billing_object_bindings', 'workspace_stripe_billing_object_customer_check', 'c'),
      ('workspace_stripe_billing_object_bindings', 'workspace_stripe_billing_object_event_check', 'c'),
      ('workspace_stripe_billing_reconciliations', 'workspace_stripe_billing_reconciliations_pkey', 'p'),
      ('workspace_stripe_billing_reconciliations', 'workspace_stripe_billing_reconciliations_workspace_id_fkey', 'f'),
      ('workspace_stripe_billing_reconciliations', 'workspace_stripe_billing_reconciliation_request_check', 'c'),
      ('workspace_stripe_billing_reconciliations', 'workspace_stripe_billing_reconciliation_stream_check', 'c'),
      ('workspace_stripe_billing_reconciliations', 'workspace_stripe_billing_reconciliation_customer_check', 'c'),
      ('workspace_stripe_billing_reconciliations', 'workspace_stripe_billing_reconciliation_subscription_check', 'c'),
      ('workspace_stripe_billing_reconciliations', 'workspace_stripe_billing_reconciliation_fingerprint_check', 'c'),
      ('workspace_stripe_billing_reconciliations', 'workspace_stripe_billing_reconciliation_revision_check', 'c'),
      ('workspace_stripe_billing_events', 'workspace_stripe_billing_events_pkey', 'p'),
      ('workspace_stripe_billing_events', 'workspace_stripe_billing_events_workspace_id_fkey', 'f'),
      ('workspace_stripe_billing_events', 'workspace_stripe_billing_events_reconciled_by_request_id_fkey', 'f'),
      ('workspace_stripe_billing_events', 'workspace_stripe_billing_event_id_check', 'c'),
      ('workspace_stripe_billing_events', 'workspace_stripe_billing_event_created_check', 'c'),
      ('workspace_stripe_billing_events', 'workspace_stripe_billing_event_type_check', 'c'),
      ('workspace_stripe_billing_events', 'workspace_stripe_billing_event_stream_check', 'c'),
      ('workspace_stripe_billing_events', 'workspace_stripe_billing_event_mode_check', 'c'),
      ('workspace_stripe_billing_events', 'workspace_stripe_billing_event_refs_check', 'c'),
      ('workspace_stripe_billing_events', 'workspace_stripe_billing_event_fingerprint_check', 'c'),
      ('workspace_stripe_billing_events', 'workspace_stripe_billing_event_processing_check', 'c'),
      ('workspace_stripe_billing_events', 'workspace_stripe_billing_event_revision_check', 'c'),
      ('workspace_stripe_billing_events', 'workspace_stripe_billing_event_processed_check', 'c')
    ), actual as (
      select relation.relname::text as table_name,
             constraint_definition.conname::text as constraint_name,
             constraint_definition.contype::text as constraint_type,
             constraint_definition.convalidated,
             constraint_definition.condeferrable,
             constraint_definition.condeferred,
             constraint_definition.oid
        from pg_constraint as constraint_definition
        join pg_class as relation
          on relation.oid = constraint_definition.conrelid
        join pg_namespace as namespace on namespace.oid = relation.relnamespace
       where namespace.nspname = 'public'
         and relation.relname in (
           'workspace_stripe_billing_streams',
           'workspace_stripe_billing_object_bindings',
           'workspace_stripe_billing_reconciliations',
           'workspace_stripe_billing_events'
         )
    )
    select 1 from expected
    full join actual using (table_name, constraint_name)
     where expected.table_name is null or actual.table_name is null
        or expected.constraint_type is distinct from actual.constraint_type
        or not actual.convalidated or actual.condeferrable or actual.condeferred
  ) then
    raise exception 'stripe_billing_ledger_constraints_invalid';
  end if;

  -- Compare every committed constraint to the independently materialized
  -- pg_temp oracle. The oracle DDL is part of the checksum-pinned control and
  -- of the runner-materialized postflight; it is never read from comments or
  -- copied from the current catalog. CHECK and primary-key definitions are
  -- hashed byte-for-byte. Only the REFERENCES target of an FK is mapped from
  -- the session-local oracle name to its fixed public counterpart; no global
  -- replacement can ever rewrite a CHECK string literal.
  for v_definition in
    select relation.relname::text as table_name,
           constraint_definition.oid,
           constraint_definition.conname::text as constraint_name,
           constraint_definition.contype::text as constraint_type
      from pg_constraint as constraint_definition
      join pg_class as relation
        on relation.oid = constraint_definition.conrelid
     where constraint_definition.conrelid in (
       'public.workspace_stripe_billing_streams'::regclass,
       'public.workspace_stripe_billing_object_bindings'::regclass,
       'public.workspace_stripe_billing_reconciliations'::regclass,
       'public.workspace_stripe_billing_events'::regclass
     )
     order by relation.relname, constraint_definition.conname
  loop
    v_expected_table := to_regclass(format(
      'pg_temp.%I', 'fanmind_expected_' || v_definition.table_name
    ));
    if v_expected_table is null then
      raise exception 'stripe_billing_ledger_schema_reference_missing';
    end if;

    select pg_get_constraintdef(expected.oid, true)
      into v_expected_definition
      from pg_constraint as expected
     where expected.conrelid = v_expected_table
       and expected.conname = v_definition.constraint_name;
    if not found then
      raise exception 'stripe_billing_ledger_constraint_reference_missing';
    end if;

    v_actual_definition := pg_get_constraintdef(v_definition.oid, true);
    if v_definition.constraint_type = 'f' then
      v_actual_definition := regexp_replace(
        v_actual_definition,
        'REFERENCES (public[.])?workspaces[(]',
        'REFERENCES workspaces(', 'g'
      );
      v_actual_definition := regexp_replace(
        v_actual_definition,
        'REFERENCES (public[.])?workspace_stripe_billing_reconciliations[(]',
        'REFERENCES workspace_stripe_billing_reconciliations(', 'g'
      );
      v_expected_definition := regexp_replace(
        v_expected_definition,
        'REFERENCES ((pg_temp(_[0-9]+)?)[.])?fanmind_expected_workspaces[(]',
        'REFERENCES workspaces(', 'g'
      );
      v_expected_definition := regexp_replace(
        v_expected_definition,
        'REFERENCES ((pg_temp(_[0-9]+)?)[.])?fanmind_expected_workspace_stripe_billing_reconciliations[(]',
        'REFERENCES workspace_stripe_billing_reconciliations(', 'g'
      );
    end if;
    v_actual_hash := encode(pg_catalog.sha256(
      convert_to(v_actual_definition, 'UTF8')
    ), 'hex');
    v_expected_hash := encode(pg_catalog.sha256(
      convert_to(v_expected_definition, 'UTF8')
    ), 'hex');
    if v_actual_hash is distinct from v_expected_hash then
      raise exception 'stripe_billing_ledger_constraint_source_hash_invalid';
    end if;
  end loop;

  -- Primary/FK column bindings and delete actions are checked structurally.
  if exists (
    select 1 from pg_constraint as definition
     where definition.conname in (
       'workspace_stripe_billing_streams_pkey',
       'workspace_stripe_billing_object_bindings_pkey',
       'workspace_stripe_billing_reconciliations_pkey',
       'workspace_stripe_billing_events_pkey'
     ) and pg_get_constraintdef(definition.oid, true) <>
       case definition.conname
         when 'workspace_stripe_billing_streams_pkey'
           then 'PRIMARY KEY (workspace_id, event_stream)'
         when 'workspace_stripe_billing_object_bindings_pkey'
           then 'PRIMARY KEY (stripe_object_type, stripe_object_id)'
         when 'workspace_stripe_billing_reconciliations_pkey'
           then 'PRIMARY KEY (stripe_request_id)'
         when 'workspace_stripe_billing_events_pkey'
           then 'PRIMARY KEY (event_id)'
       end
  ) or (
    select count(*) from pg_constraint as definition
     where definition.conname in (
       'workspace_stripe_billing_streams_workspace_id_fkey',
       'workspace_stripe_billing_object_bindings_workspace_id_fkey',
       'workspace_stripe_billing_reconciliations_workspace_id_fkey',
       'workspace_stripe_billing_events_workspace_id_fkey'
     ) and definition.confrelid = 'public.workspaces'::regclass
       and definition.confdeltype = 'c' and definition.confupdtype = 'a'
       and definition.confmatchtype = 's'
       and pg_get_constraintdef(definition.oid, true) like
           'FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE'
  ) <> 4 or not exists (
    select 1 from pg_constraint as definition
     where definition.conname =
           'workspace_stripe_billing_events_reconciled_by_request_id_fkey'
       and definition.confrelid =
           'public.workspace_stripe_billing_reconciliations'::regclass
       and definition.confdeltype = 'r' and definition.confupdtype = 'a'
       and definition.confmatchtype = 's'
       and pg_get_constraintdef(definition.oid, true) like
           'FOREIGN KEY (reconciled_by_request_id) REFERENCES workspace_stripe_billing_reconciliations(stripe_request_id) ON DELETE RESTRICT'
  ) then
    raise exception 'stripe_billing_ledger_key_constraints_invalid';
  end if;

  -- Every CHECK must be a real, validated expression containing its complete
  -- invariant vocabulary. The exact named-set check above rejects partial
  -- installs; these guards specifically reject CHECK(true) and weakened
  -- replacements that omit a state, object family or binding field.
  if exists (
    select 1 from pg_constraint as definition
     where definition.conrelid in (
       'public.workspace_stripe_billing_streams'::regclass,
       'public.workspace_stripe_billing_object_bindings'::regclass,
       'public.workspace_stripe_billing_reconciliations'::regclass,
       'public.workspace_stripe_billing_events'::regclass
     ) and definition.contype = 'c'
       and (
         lower(regexp_replace(pg_get_constraintdef(definition.oid, true), '\s+', '', 'g'))
           in ('check(true)', 'check((true))')
         or pg_get_constraintdef(definition.oid, true) !~* '^CHECK \('
       )
  ) then
    raise exception 'stripe_billing_ledger_check_constraint_trivial';
  end if;

  for v_check in
    select expected.constraint_name, expected.required_token
      from (values
        ('workspace_stripe_billing_stream_name_check', 'lifecycle'), ('workspace_stripe_billing_stream_name_check', 'tax'),
        ('workspace_stripe_billing_stream_customer_check', '^cus_'),
        ('workspace_stripe_billing_stream_subscription_check', '^sub_'),
        ('workspace_stripe_billing_stream_state_check', 'in_sync'), ('workspace_stripe_billing_stream_state_check', 'reconciliation_needed'),
        ('workspace_stripe_billing_stream_state_check', 'controlled_cutover'), ('workspace_stripe_billing_stream_state_check', 'event_identity_conflict'),
        ('workspace_stripe_billing_stream_state_check', 'event_order_conflict'), ('workspace_stripe_billing_stream_state_check', 'reconciliation_pending'),
        ('workspace_stripe_billing_stream_state_check', 'tenant_binding_conflict'), ('workspace_stripe_billing_stream_state_check', 'terminal_subscription_conflict'),
        ('workspace_stripe_billing_stream_state_check', 'unresolved_event'),
        ('workspace_stripe_billing_stream_order_check', 'last_event_created_at'), ('workspace_stripe_billing_stream_order_check', 'last_event_id'),
        ('workspace_stripe_billing_stream_revision_check', 'projection_revision'),
        ('workspace_stripe_billing_object_type_check', 'customer'), ('workspace_stripe_billing_object_type_check', 'subscription'),
        ('workspace_stripe_billing_object_type_check', 'checkout_session'), ('workspace_stripe_billing_object_type_check', 'payment_intent'),
        ('workspace_stripe_billing_object_type_check', 'invoice'), ('workspace_stripe_billing_object_type_check', 'charge'),
        ('workspace_stripe_billing_object_type_check', 'refund'), ('workspace_stripe_billing_object_type_check', 'dispute'),
        ('workspace_stripe_billing_object_type_check', 'tax_id'),
        ('workspace_stripe_billing_object_id_check', '^cus_'), ('workspace_stripe_billing_object_id_check', '^sub_'),
        ('workspace_stripe_billing_object_id_check', '^cs_'), ('workspace_stripe_billing_object_id_check', '^pi_'),
        ('workspace_stripe_billing_object_id_check', '^in_'), ('workspace_stripe_billing_object_id_check', '^ch_'),
        ('workspace_stripe_billing_object_id_check', '^re_'), ('workspace_stripe_billing_object_id_check', '^dp_'),
        ('workspace_stripe_billing_object_id_check', '^txi_'),
        ('workspace_stripe_billing_object_customer_check', '^cus_'),
        ('workspace_stripe_billing_object_event_check', 'first_event_id'), ('workspace_stripe_billing_object_event_check', 'last_event_id'),
        ('workspace_stripe_billing_reconciliation_request_check', '^req_'),
        ('workspace_stripe_billing_reconciliation_stream_check', 'lifecycle'), ('workspace_stripe_billing_reconciliation_stream_check', 'tax'),
        ('workspace_stripe_billing_reconciliation_customer_check', '^cus_'),
        ('workspace_stripe_billing_reconciliation_subscription_check', '^sub_'),
        ('workspace_stripe_billing_reconciliation_fingerprint_check', '[a-f0-9]{64}'),
        ('workspace_stripe_billing_reconciliation_revision_check', 'expected_revision'), ('workspace_stripe_billing_reconciliation_revision_check', 'resulting_revision'),
        ('workspace_stripe_billing_event_id_check', '^evt_'),
        ('workspace_stripe_billing_event_created_check', 'event_created_at'),
        ('workspace_stripe_billing_event_type_check', 'checkout.session.completed'), ('workspace_stripe_billing_event_type_check', 'invoice.paid'),
        ('workspace_stripe_billing_event_type_check', 'customer.subscription.deleted'), ('workspace_stripe_billing_event_type_check', 'refund.failed'),
        ('workspace_stripe_billing_event_type_check', 'charge.dispute.created'), ('workspace_stripe_billing_event_type_check', 'customer.tax_id.deleted'),
        ('workspace_stripe_billing_event_stream_check', 'lifecycle'), ('workspace_stripe_billing_event_stream_check', 'tax'),
        ('workspace_stripe_billing_event_mode_check', 'checkout'), ('workspace_stripe_billing_event_mode_check', 'customer_transaction'),
        ('workspace_stripe_billing_event_mode_check', 'customer_subscription'), ('workspace_stripe_billing_event_mode_check', 'reversal'),
        ('workspace_stripe_billing_event_mode_check', 'tax'),
        ('workspace_stripe_billing_event_refs_check', 'stripe_customer_id'), ('workspace_stripe_billing_event_refs_check', 'stripe_subscription_id'),
        ('workspace_stripe_billing_event_refs_check', 'stripe_checkout_session_id'), ('workspace_stripe_billing_event_refs_check', 'stripe_payment_intent_id'),
        ('workspace_stripe_billing_event_refs_check', 'stripe_invoice_id'), ('workspace_stripe_billing_event_refs_check', 'stripe_charge_id'),
        ('workspace_stripe_billing_event_refs_check', 'stripe_refund_id'), ('workspace_stripe_billing_event_refs_check', 'stripe_dispute_id'),
        ('workspace_stripe_billing_event_refs_check', 'stripe_tax_id'),
        ('workspace_stripe_billing_event_fingerprint_check', '[a-f0-9]{64}'),
        ('workspace_stripe_billing_event_processing_check', 'received'), ('workspace_stripe_billing_event_processing_check', 'applied'),
        ('workspace_stripe_billing_event_processing_check', 'ignored'), ('workspace_stripe_billing_event_processing_check', 'unresolved'),
        ('workspace_stripe_billing_event_processing_check', 'reconciliation_needed'), ('workspace_stripe_billing_event_processing_check', 'reconciled'),
        ('workspace_stripe_billing_event_processing_check', 'tenant_binding_missing'), ('workspace_stripe_billing_event_processing_check', 'object_binding_missing'),
        ('workspace_stripe_billing_event_processing_check', 'event_identity_conflict'), ('workspace_stripe_billing_event_processing_check', 'event_order_conflict'),
        ('workspace_stripe_billing_event_processing_check', 'reconciliation_pending'), ('workspace_stripe_billing_event_processing_check', 'tenant_binding_conflict'),
        ('workspace_stripe_billing_event_processing_check', 'terminal_subscription_conflict'),
        ('workspace_stripe_billing_event_revision_check', 'projection_revision'),
        ('workspace_stripe_billing_event_processed_check', 'processed_at')
      ) as expected(constraint_name, required_token)
  loop
    if not exists (
      select 1 from pg_constraint as definition
       where definition.conname = v_check.constraint_name
         and position(
           lower(v_check.required_token)
           in lower(pg_get_constraintdef(definition.oid, true))
         ) > 0
    ) then
      raise exception 'stripe_billing_ledger_check_constraint_weakened';
    end if;
  end loop;

  -- Exact secondary-index set, key order/direction, predicate and readiness.
  if (
    select count(*) from pg_index as definition
    join pg_class as table_relation on table_relation.oid = definition.indrelid
    left join pg_constraint as backing_constraint
      on backing_constraint.conindid = definition.indexrelid
    where table_relation.oid in (
      'public.workspace_stripe_billing_streams'::regclass,
      'public.workspace_stripe_billing_object_bindings'::regclass,
      'public.workspace_stripe_billing_reconciliations'::regclass,
      'public.workspace_stripe_billing_events'::regclass
    ) and backing_constraint.oid is null
  ) <> 4 or exists (
    select 1 from pg_index as definition
    join pg_class as index_relation on index_relation.oid = definition.indexrelid
    join pg_class as table_relation on table_relation.oid = definition.indrelid
    join pg_am as access_method on access_method.oid = index_relation.relam
    where table_relation.relnamespace = 'public'::regnamespace
      and index_relation.relname in (
      'workspace_stripe_billing_object_workspace_idx',
      'workspace_stripe_billing_reconciliation_workspace_idx',
      'workspace_stripe_billing_event_workspace_order_idx',
      'workspace_stripe_billing_event_pending_idx'
    ) and (
      not definition.indisvalid or not definition.indisready
      or definition.indisunique or definition.indisprimary
      or definition.indexprs is not null or access_method.amname <> 'btree'
      or case index_relation.relname
        when 'workspace_stripe_billing_object_workspace_idx' then
          table_relation.relname <> 'workspace_stripe_billing_object_bindings'
          or definition.indnkeyatts <> 3
          or pg_get_indexdef(definition.indexrelid, 1, true) <> 'workspace_id'
          or pg_get_indexdef(definition.indexrelid, 2, true) <> 'stripe_object_type'
          or pg_get_indexdef(definition.indexrelid, 3, true) <> 'last_seen_at'
          or definition.indoption::text <> '0 0 3'
          or definition.indpred is not null
        when 'workspace_stripe_billing_reconciliation_workspace_idx' then
          table_relation.relname <> 'workspace_stripe_billing_reconciliations'
          or definition.indnkeyatts <> 3
          or pg_get_indexdef(definition.indexrelid, 1, true) <> 'workspace_id'
          or pg_get_indexdef(definition.indexrelid, 2, true) <> 'event_stream'
          or pg_get_indexdef(definition.indexrelid, 3, true) <> 'created_at'
          or definition.indoption::text <> '0 0 3'
          or definition.indpred is not null
        when 'workspace_stripe_billing_event_workspace_order_idx' then
          table_relation.relname <> 'workspace_stripe_billing_events'
          or definition.indnkeyatts <> 3
          or pg_get_indexdef(definition.indexrelid, 1, true) <> 'workspace_id'
          or pg_get_indexdef(definition.indexrelid, 2, true) <> 'event_stream'
          or pg_get_indexdef(definition.indexrelid, 3, true) <> 'event_created_at'
          or definition.indoption::text <> '0 0 3'
          or regexp_replace(
            lower(pg_get_expr(definition.indpred, definition.indrelid, true)),
            '\s+', ' ', 'g'
          ) !~ '^\(?workspace_id is not null\)?$'
        when 'workspace_stripe_billing_event_pending_idx' then
          table_relation.relname <> 'workspace_stripe_billing_events'
          or definition.indnkeyatts <> 3
          or pg_get_indexdef(definition.indexrelid, 1, true) <> 'event_stream'
          or pg_get_indexdef(definition.indexrelid, 2, true) <> 'event_created_at'
          or pg_get_indexdef(definition.indexrelid, 3, true) <> 'event_id'
          or regexp_replace(
            lower(pg_get_expr(definition.indpred, definition.indrelid, true)),
            '\s+', ' ', 'g'
          ) !~ '^\(?processing_state = any \(array\[''unresolved''::text, ''reconciliation_needed''::text\]\)\)?$'
        else true
      end
    )
  ) or (
    select count(*) from pg_class as index_relation
    join pg_namespace as namespace on namespace.oid = index_relation.relnamespace
     where namespace.nspname = 'public'
       and index_relation.relkind = 'i'
       and index_relation.relname in (
         'workspace_stripe_billing_object_workspace_idx',
         'workspace_stripe_billing_reconciliation_workspace_idx',
         'workspace_stripe_billing_event_workspace_order_idx',
         'workspace_stripe_billing_event_pending_idx'
       )
  ) <> 4 then
    raise exception 'stripe_billing_ledger_indexes_invalid';
  end if;

  -- Hash every functional index attribute against the checksum-pinned pg_temp
  -- oracle. Names, schema and persistence are intentionally mapped; access
  -- method, keys/includes, opclasses, collation, order/null flags, predicates,
  -- expressions, options, tablespace and readiness remain exact inputs.
  for v_definition in
    select index_relation.oid, index_relation.relname::text as index_name
      from pg_class as index_relation
      join pg_namespace as namespace
        on namespace.oid = index_relation.relnamespace
     where namespace.nspname = 'public'
       and index_relation.relname in (
         'workspace_stripe_billing_object_workspace_idx',
         'workspace_stripe_billing_reconciliation_workspace_idx',
         'workspace_stripe_billing_event_workspace_order_idx',
         'workspace_stripe_billing_event_pending_idx'
       )
     order by index_relation.relname
  loop
    v_expected_index := to_regclass(format(
      'pg_temp.%I', v_definition.index_name
    ));
    if v_expected_index is null then
      raise exception 'stripe_billing_ledger_index_reference_missing';
    end if;

    with fingerprint as (
      select definition.indexrelid,
             encode(pg_catalog.sha256(convert_to(
               jsonb_build_array(
                 access_method.amname,
                 definition.indisunique,
                 definition.indnullsnotdistinct,
                 definition.indisprimary,
                 definition.indisexclusion,
                 definition.indimmediate,
                 definition.indisclustered,
                 definition.indisvalid,
                 definition.indcheckxmin,
                 definition.indisready,
                 definition.indislive,
                 definition.indisreplident,
                 definition.indnatts,
                 definition.indnkeyatts,
                 definition.indkey::text,
                 definition.indcollation::text,
                 definition.indclass::text,
                 definition.indoption::text,
                 pg_get_expr(
                   definition.indexprs, definition.indrelid, true
                 ),
                 pg_get_expr(
                   definition.indpred, definition.indrelid, true
                 ),
                 index_relation.reltablespace,
                 index_relation.reloptions,
                 (
                   select coalesce(
                     jsonb_agg(
                       pg_get_indexdef(
                         definition.indexrelid, key_position.position, true
                       ) order by key_position.position
                     ),
                     '[]'::jsonb
                   )
                     from generate_series(
                       1, definition.indnatts
                     ) as key_position(position)
                 )
               )::text,
               'UTF8'
             )), 'hex') as source_hash
        from pg_index as definition
        join pg_class as index_relation
          on index_relation.oid = definition.indexrelid
        join pg_am as access_method
          on access_method.oid = index_relation.relam
       where definition.indexrelid in (
         v_definition.oid, v_expected_index
       )
    )
    select max(source_hash) filter (
             where indexrelid = v_definition.oid
           ),
           max(source_hash) filter (
             where indexrelid = v_expected_index
           )
      into v_actual_hash, v_expected_hash
      from fingerprint;
    if v_actual_hash is null
       or v_expected_hash is null
       or v_actual_hash is distinct from v_expected_hash then
      raise exception 'stripe_billing_ledger_index_source_hash_invalid';
    end if;
  end loop;

  -- Forced RLS, no policy and no non-owner table/column ACL on every ledger
  -- table. This rejects unknown roles as well as the three runtime roles.
  foreach v_table in array array[
    'public.workspace_stripe_billing_streams'::regclass,
    'public.workspace_stripe_billing_object_bindings'::regclass,
    'public.workspace_stripe_billing_reconciliations'::regclass,
    'public.workspace_stripe_billing_events'::regclass
  ] loop
    if not exists (
      select 1 from pg_class where oid = v_table and relkind = 'r'
        and relrowsecurity and relforcerowsecurity
    ) or exists (select 1 from pg_policy where polrelid = v_table)
      or exists (
        select 1 from pg_class as relation
        cross join lateral aclexplode(
          coalesce(relation.relacl, acldefault('r', relation.relowner))
        ) as acl
        where relation.oid = v_table and acl.grantee <> relation.relowner
      ) then
      raise exception 'stripe_billing_ledger_table_acl_invalid';
    end if;
    for v_column in
      select attribute.attname::text from pg_attribute as attribute
       where attribute.attrelid = v_table and attribute.attnum > 0
         and not attribute.attisdropped
    loop
      if exists (
        select 1 from pg_attribute as attribute
        cross join lateral aclexplode(attribute.attacl) as acl
        join pg_class as relation on relation.oid = attribute.attrelid
        where attribute.attrelid = v_table
          and attribute.attname = v_column
          and acl.grantee <> relation.relowner
      ) then
        raise exception 'stripe_billing_ledger_column_acl_invalid';
      end if;
    end loop;
  end loop;

  -- Exact function set and metadata. Only the two outer RPCs may be SECURITY
  -- DEFINER and executable by service_role; helpers and this verifier remain
  -- owner-only. Search path equality rejects extra or reordered settings.
  if (
    select count(*)
      from pg_proc as definition
      join pg_namespace as namespace on namespace.oid = definition.pronamespace
     where namespace.nspname = 'public'
       and definition.proname in (
         'workspace_stripe_billing_projection_valid',
         'apply_workspace_stripe_billing_projection',
         'mark_workspace_stripe_billing_reconciliation',
         'apply_workspace_stripe_billing_event',
         'reconcile_workspace_stripe_billing_projection',
         'verify_workspace_stripe_billing_ledger_schema'
       )
  ) <> 6 then
    raise exception 'stripe_billing_ledger_function_set_invalid';
  end if;

  for v_function in
    select * from (values
      ('public.workspace_stripe_billing_projection_valid(jsonb)', false, 's', false, 'boolean', false),
      ('public.apply_workspace_stripe_billing_projection(uuid,jsonb)', true, 'v', false, 'void', false),
      ('public.mark_workspace_stripe_billing_reconciliation(uuid)', true, 'v', false, 'void', false),
      ('public.apply_workspace_stripe_billing_event(boolean,boolean,text,bigint,text,text,text,uuid,boolean,text,text,text,text,text,text,text,text,text,text,jsonb)', true, 'v', true, 'record', true),
      ('public.reconcile_workspace_stripe_billing_projection(uuid,text,text,timestamp with time zone,text,bigint,text,text,jsonb,text[],jsonb)', true, 'v', true, 'record', true),
      ('public.verify_workspace_stripe_billing_ledger_schema()', false, 'v', false, 'void', false)
    ) as expected(signature, security_definer, volatility, returns_set, result_type, service_execute)
  loop
    if to_regprocedure(v_function.signature) is null or not exists (
      select 1 from pg_proc as definition
      join pg_language as language_definition
        on language_definition.oid = definition.prolang
       where definition.oid = to_regprocedure(v_function.signature)
         and definition.prokind = 'f'
         and definition.proowner = (
           select oid from pg_roles where rolname = session_user
         )
         and definition.proowner <> (
           select oid from pg_roles where rolname = 'service_role'
         )
         and definition.prosecdef = v_function.security_definer
         and definition.provolatile = v_function.volatility::"char"
         and definition.proretset = v_function.returns_set
         and format_type(definition.prorettype, null) = v_function.result_type
         and definition.proconfig =
             array['search_path=pg_catalog, public, pg_temp']::text[]
         and language_definition.lanname = 'plpgsql'
    ) or has_function_privilege('anon', v_function.signature, 'EXECUTE')
      or has_function_privilege('authenticated', v_function.signature, 'EXECUTE')
      or has_function_privilege('service_role', v_function.signature, 'EXECUTE')
         is distinct from v_function.service_execute
      or exists (
        select 1 from pg_proc as definition
        cross join lateral aclexplode(
          coalesce(definition.proacl, acldefault('f', definition.proowner))
        ) as acl
         where definition.oid = to_regprocedure(v_function.signature)
           and acl.grantee <> definition.proowner
           and not (
             v_function.service_execute
             and acl.grantee = (select oid from pg_roles where rolname = 'service_role')
             and acl.privilege_type = 'EXECUTE'
             and acl.grantor = definition.proowner
             and not acl.is_grantable
           )
      ) then
      raise exception 'stripe_billing_ledger_function_contract_invalid';
    end if;
  end loop;

  -- The runner binds this verifier body byte-for-byte to the checksum-pinned
  -- control. These five immutable source hashes therefore extend that binding
  -- to every helper and outer RPC; metadata-equivalent CREATE OR REPLACE drift
  -- cannot pass either the in-transaction or independent verifier.
  for v_function in
    select * from (values
      ('public.workspace_stripe_billing_projection_valid(jsonb)', 'ccda0d8b8d4c03811daf679f18e391254c6fd96834ba08f9ee7f6d4ed72c5475'),
      ('public.apply_workspace_stripe_billing_projection(uuid,jsonb)', 'e8a552e775a53c44c49f71b02a09a7af97cc07e5de32819e0d46b397ea27dc23'),
      ('public.mark_workspace_stripe_billing_reconciliation(uuid)', '11a56b37595e03967263a658e8752611d3239022661b6bd2a0573cc7e9d00478'),
      ('public.apply_workspace_stripe_billing_event(boolean,boolean,text,bigint,text,text,text,uuid,boolean,text,text,text,text,text,text,text,text,text,text,jsonb)', '59d9389658f797f711fa77f283b635ffa6c7ceb16f91325522c437d14237330b'),
      ('public.reconcile_workspace_stripe_billing_projection(uuid,text,text,timestamp with time zone,text,bigint,text,text,jsonb,text[],jsonb)', '868a07f91840f1e91e40dc0ff2c3af581238e80ac84a312961982f1ce9829fa9')
    ) as expected(signature, body_sha256)
  loop
    select encode(pg_catalog.sha256(convert_to(
             definition.prosrc, 'UTF8'
           )), 'hex')
      into v_actual_hash
      from pg_proc as definition
     where definition.oid = to_regprocedure(v_function.signature);
    if v_actual_hash is distinct from v_function.body_sha256 then
      raise exception 'stripe_billing_ledger_function_body_drift';
    end if;
  end loop;
end
$schema_verify$;

revoke all on function public.verify_workspace_stripe_billing_ledger_schema()
  from public, anon, authenticated, service_role;

select public.verify_workspace_stripe_billing_ledger_schema();

-- Seed provider identities, but deliberately put existing lifecycle
-- projections into controlled_cutover. The runtime gate must remain off until
-- every such row has a fresh canonical reconciliation receipt.
insert into public.workspace_stripe_billing_object_bindings (
  stripe_object_type, stripe_object_id, workspace_id, stripe_customer_id
)
select 'customer', workspace.stripe_customer_id, workspace.id,
       workspace.stripe_customer_id
  from public.workspaces as workspace
 where workspace.stripe_customer_id is not null;
insert into public.workspace_stripe_billing_object_bindings (
  stripe_object_type, stripe_object_id, workspace_id, stripe_customer_id
)
select 'subscription', workspace.stripe_subscription_id, workspace.id,
       workspace.stripe_customer_id
  from public.workspaces as workspace
 where workspace.stripe_customer_id is not null
   and workspace.stripe_subscription_id is not null;
insert into public.workspace_stripe_billing_object_bindings (
  stripe_object_type, stripe_object_id, workspace_id, stripe_customer_id
)
select 'checkout_session', workspace.stripe_checkout_session_id, workspace.id,
       workspace.stripe_customer_id
  from public.workspaces as workspace
 where workspace.stripe_customer_id is not null
   and workspace.stripe_checkout_session_id is not null;
insert into public.workspace_stripe_billing_object_bindings (
  stripe_object_type, stripe_object_id, workspace_id, stripe_customer_id
)
select 'payment_intent', workspace.stripe_payment_intent_id, workspace.id,
       workspace.stripe_customer_id
  from public.workspaces as workspace
 where workspace.stripe_customer_id is not null
   and workspace.stripe_payment_intent_id is not null;

insert into public.workspace_stripe_billing_streams (
  workspace_id, event_stream, stripe_customer_id, stripe_subscription_id,
  sync_state, reconciliation_reason
)
select workspace.id, 'lifecycle', workspace.stripe_customer_id,
       workspace.stripe_subscription_id,
       'reconciliation_needed', 'controlled_cutover'
  from public.workspaces as workspace
 where workspace.stripe_customer_id is not null;

comment on table public.workspace_stripe_billing_events is
  'Signed Stripe event identities and processing outcomes; raw webhook bodies are never stored.';
comment on table public.workspace_stripe_billing_object_bindings is
  'Durable tenant bindings for current and historical Stripe objects, including rotated PaymentIntents.';
comment on function public.reconcile_workspace_stripe_billing_projection(
  uuid, text, text, timestamptz, text, bigint, text, text, jsonb, text[], jsonb
) is
  'Applies an externally fetched canonical Stripe snapshot behind request-id idempotency and revision CAS; performs no provider call.';

commit;
