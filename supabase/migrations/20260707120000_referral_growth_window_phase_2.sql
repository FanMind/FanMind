-- FanMind Referral Growth Window Phase 2: public codes, signup attribution and safe user status view.
-- No payout, no second level and no automatic billing application are activated here.

create unique index if not exists referral_program_members_workspace_unique_idx
  on public.referral_program_members (workspace_id);

create unique index if not exists referrals_referred_workspace_unique_idx
  on public.referrals (referred_workspace_id)
  where referred_workspace_id is not null;

create or replace function public.set_referral_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists referral_program_members_updated_at on public.referral_program_members;
create trigger referral_program_members_updated_at
before update on public.referral_program_members
for each row execute function public.set_referral_updated_at();

drop trigger if exists referrals_updated_at on public.referrals;
create trigger referrals_updated_at
before update on public.referrals
for each row execute function public.set_referral_updated_at();

comment on table public.referral_program_members is
  'Referral Growth Window members. Phase 2 exposes own workspace code/status only via server-side app code; discounts are not applied automatically.';

comment on table public.referrals is
  'Referral Growth Window signup attributions. Active status is an admin/billing-reviewed state, not an automatic payout or billing change.';

comment on column public.referral_program_state.active_paid_workspace_cap is
  'Global Growth Window cap. Default 2000 active paying FanMind customers/workspaces.';

comment on column public.referral_program_members.override_active_referral_count is
  'Admin correction for reviewed active referral count. Max billable active referrals remains 20 in app logic.';

comment on column public.referral_program_members.override_discount_percent is
  'Admin correction for displayed referral discount percent. This remains a prepared status value and is not automatic billing.';
