-- FanMind Referral Growth Window: payment lifecycle, cap reconciliation and
-- invoice-safe discount snapshots. Stripe coupon application remains in the
-- server-side webhook adapter and is guarded by FANMIND_ENABLE_REFERRAL_BILLING.

alter table public.referral_discount_snapshots
  add column if not exists source_event_id text,
  add column if not exists source_event_type text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_coupon_id text,
  add column if not exists stripe_sync_status text not null default 'pending',
  add column if not exists stripe_sync_error text,
  add column if not exists stripe_synced_at timestamptz;

alter table public.referral_discount_snapshots
  drop constraint if exists referral_discount_snapshots_stripe_sync_status_check;

alter table public.referral_discount_snapshots
  add constraint referral_discount_snapshots_stripe_sync_status_check
  check (stripe_sync_status in ('pending','applied','cleared','unchanged','not_applicable','disabled','error'));

create unique index if not exists referral_discount_snapshots_source_event_workspace_idx
  on public.referral_discount_snapshots (source_event_id, workspace_id)
  where source_event_id is not null;

create index if not exists referral_discount_snapshots_sync_status_idx
  on public.referral_discount_snapshots (stripe_sync_status, calculated_at desc);

create or replace function public.refresh_referral_program_state(
  p_event_type text default 'reconcile'
)
returns public.referral_program_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_state public.referral_program_state%rowtype;
begin
  select count(*)::integer
    into v_count
  from public.workspaces w
  where w.billing_status in ('active', 'past_due')
    and coalesce(w.commercial_option, '') <> 'internal_daily_test'
    and (coalesce(w.monthly_fee_cents, 0) > 0 or coalesce(w.setup_fee_cents, 0) > 0);

  select *
    into v_state
  from public.referral_program_state
  order by updated_at desc
  limit 1
  for update;

  if v_state.id is null then
    insert into public.referral_program_state (
      status,
      active_paid_workspace_cap,
      active_paid_workspace_count,
      active_paid_workspace_count_snapshot,
      admin_note
    ) values (
      'open',
      2000,
      v_count,
      v_count,
      'Automatisch durch Referral-Reconciliation angelegt.'
    )
    returning * into v_state;
  elsif v_count >= v_state.active_paid_workspace_cap
    and v_state.status in ('open', 'reopened', 'closing') then
    update public.referral_program_state
       set status = 'closed',
           active_paid_workspace_count = v_count,
           active_paid_workspace_count_snapshot = v_count,
           closed_at = coalesce(closed_at, now()),
           updated_at = now(),
           admin_note = format(
             'Growth Window automatisch bei %s aktiven zahlenden Workspaces geschlossen. Quelle: %s.',
             v_count,
             coalesce(p_event_type, 'reconcile')
           )
     where id = v_state.id
     returning * into v_state;
  else
    update public.referral_program_state
       set active_paid_workspace_count = v_count,
           active_paid_workspace_count_snapshot = v_count,
           updated_at = now()
     where id = v_state.id
     returning * into v_state;
  end if;

  return v_state;
end;
$$;

create or replace function public.sync_referral_for_workspace(
  p_workspace_id uuid,
  p_billing_status text,
  p_event_id text default null,
  p_event_type text default 'manual_reconcile'
)
returns table (
  referral_id uuid,
  referrer_workspace_id uuid,
  snapshot_id uuid,
  active_referral_count integer,
  discount_percent integer,
  monthly_fee_cents_before_discount integer,
  monthly_discount_cents integer,
  monthly_fee_cents_after_discount integer,
  stripe_subscription_id text,
  previous_discount_percent integer,
  previous_stripe_sync_status text,
  program_status text,
  duplicate_event boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.referrals%rowtype;
  v_member public.referral_program_members%rowtype;
  v_referrer public.workspaces%rowtype;
  v_state public.referral_program_state%rowtype;
  v_new_status text;
  v_active_count integer := 0;
  v_effective_count integer := 0;
  v_discount integer := 0;
  v_monthly_before integer := 0;
  v_monthly_discount integer := 0;
  v_monthly_after integer := 0;
  v_snapshot public.referral_discount_snapshots%rowtype;
  v_previous public.referral_discount_snapshots%rowtype;
  v_duplicate boolean := false;
begin
  v_state := public.refresh_referral_program_state(p_event_type);

  select *
    into v_referral
  from public.referrals r
  where r.referred_workspace_id = p_workspace_id
  limit 1
  for update;

  if v_referral.id is null then
    return;
  end if;

  if p_event_id is not null then
    select *
      into v_snapshot
    from public.referral_discount_snapshots s
    where s.source_event_id = p_event_id
      and s.workspace_id = v_referral.referrer_workspace_id
    limit 1;

    if v_snapshot.id is not null then
      v_duplicate := true;
      select *
        into v_referrer
      from public.workspaces w
      where w.id = v_referral.referrer_workspace_id;

      return query select
        v_referral.id,
        v_referral.referrer_workspace_id,
        v_snapshot.id,
        v_snapshot.active_referral_count,
        v_snapshot.discount_percent,
        coalesce(v_snapshot.monthly_fee_cents_before_discount, 0),
        coalesce(v_snapshot.monthly_discount_cents, 0),
        coalesce(v_snapshot.monthly_fee_cents_after_discount, 0),
        v_referrer.stripe_subscription_id,
        v_snapshot.discount_percent,
        v_snapshot.stripe_sync_status,
        v_snapshot.program_status_snapshot,
        true;
      return;
    end if;
  end if;

  v_new_status := v_referral.status;

  if v_referral.status not in ('rejected', 'locked_after_window_closed')
    and coalesce(v_referral.admin_override, false) = false then
    case coalesce(p_billing_status, '')
      when 'active' then v_new_status := 'active';
      when 'past_due' then
        v_new_status := case
          when v_referral.status = 'active' then 'active'
          else 'qualified'
        end;
      when 'pending_payment_setup' then v_new_status := 'pending';
      when 'pending_sepa_mandate' then v_new_status := 'qualified';
      when 'payment_failed' then v_new_status := 'inactive';
      when 'suspended' then v_new_status := 'inactive';
      when 'manual_suspended' then v_new_status := 'inactive';
      when 'cancelled' then v_new_status := 'inactive';
      when 'expired' then v_new_status := 'inactive';
      when 'refunded' then v_new_status := 'inactive';
      else v_new_status := v_referral.status;
    end case;
  end if;

  update public.referrals
     set status = v_new_status,
         billing_status_snapshot = p_billing_status,
         qualified_at = case
           when v_new_status in ('qualified', 'active') then coalesce(qualified_at, now())
           else qualified_at
         end,
         activated_at = case
           when v_new_status = 'active' then coalesce(activated_at, now())
           else activated_at
         end,
         deactivated_at = case
           when v_new_status = 'inactive' then now()
           when v_new_status = 'active' then null
           else deactivated_at
         end,
         deactivation_reason = case
           when v_new_status = 'inactive' then coalesce(p_event_type, p_billing_status)
           when v_new_status = 'active' then null
           else deactivation_reason
         end,
         updated_at = now(),
         admin_note = case
           when coalesce(admin_override, false) then admin_note
           else format(
             'Automatischer Referral-Status %s aus Billing-Status %s; Quelle %s.',
             v_new_status,
             coalesce(p_billing_status, 'unbekannt'),
             coalesce(p_event_type, 'unbekannt')
           )
         end
   where id = v_referral.id
   returning * into v_referral;

  select *
    into v_member
  from public.referral_program_members m
  where m.workspace_id = v_referral.referrer_workspace_id
  limit 1;

  select count(*)::integer
    into v_active_count
  from public.referrals r
  where r.referrer_workspace_id = v_referral.referrer_workspace_id
    and r.status = 'active';

  if v_member.id is null
    or coalesce(v_member.eligible, false) = false
    or v_member.status not in ('active', 'qualified') then
    v_effective_count := 0;
    v_discount := 0;
  else
    v_effective_count := least(
      greatest(coalesce(v_member.override_active_referral_count, v_active_count), 0),
      20
    );
    v_discount := least(
      greatest(
        coalesce(v_member.override_discount_percent, v_effective_count * 5),
        0
      ),
      100
    );
  end if;

  select *
    into v_referrer
  from public.workspaces w
  where w.id = v_referral.referrer_workspace_id;

  v_monthly_before := greatest(coalesce(v_referrer.monthly_fee_cents, 0), 0);
  v_monthly_discount := round(v_monthly_before * (v_discount::numeric / 100.0))::integer;
  v_monthly_after := greatest(v_monthly_before - v_monthly_discount, 0);

  select *
    into v_previous
  from public.referral_discount_snapshots s
  where s.workspace_id = v_referral.referrer_workspace_id
  order by s.calculated_at desc
  limit 1;

  insert into public.referral_discount_snapshots (
    workspace_id,
    active_referral_count,
    discount_percent,
    monthly_fee_cents_before_discount,
    monthly_discount_cents,
    monthly_fee_cents_after_discount,
    program_status_snapshot,
    calculated_at,
    source_event_id,
    source_event_type,
    stripe_subscription_id,
    stripe_sync_status,
    admin_note
  ) values (
    v_referral.referrer_workspace_id,
    v_active_count,
    v_discount,
    v_monthly_before,
    v_monthly_discount,
    v_monthly_after,
    v_state.status,
    now(),
    p_event_id,
    p_event_type,
    v_referrer.stripe_subscription_id,
    case
      when v_referrer.stripe_subscription_id is null or v_monthly_before = 0 then 'not_applicable'
      else 'pending'
    end,
    format(
      'Automatisch berechnet: %s aktive Empfehlungen, %s Prozent Rabatt. Setup-Gebühren bleiben unberührt.',
      v_active_count,
      v_discount
    )
  )
  returning * into v_snapshot;

  return query select
    v_referral.id,
    v_referral.referrer_workspace_id,
    v_snapshot.id,
    v_active_count,
    v_discount,
    v_monthly_before,
    v_monthly_discount,
    v_monthly_after,
    v_referrer.stripe_subscription_id,
    v_previous.discount_percent,
    v_previous.stripe_sync_status,
    v_state.status,
    v_duplicate;
end;
$$;

revoke all on function public.refresh_referral_program_state(text) from public, anon, authenticated;
grant execute on function public.refresh_referral_program_state(text) to service_role;

revoke all on function public.sync_referral_for_workspace(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.sync_referral_for_workspace(uuid, text, text, text) to service_role;

comment on function public.refresh_referral_program_state(text) is
  'Counts active/past-due paid workspaces, updates the 2000-workspace cap, and never reopens a closed program automatically.';

comment on function public.sync_referral_for_workspace(uuid, text, text, text) is
  'Idempotently maps one referred workspace billing lifecycle to referral status and creates a future-invoice discount snapshot.';
