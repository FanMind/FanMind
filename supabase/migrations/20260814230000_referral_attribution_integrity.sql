-- FanMind Referral attribution integrity.
-- First valid workspace attribution wins; self-referrals stay fail-closed.
-- This migration does not activate referral billing or perform Stripe writes.

begin;

do $duplicates$
begin
  if exists (
    select referred_workspace_id
      from public.referrals
     where referred_workspace_id is not null
     group by referred_workspace_id
    having count(*) > 1
  ) then
    raise exception 'referral_attribution_duplicates_require_manual_review';
  end if;
end
$duplicates$;

drop index if exists public.referrals_referred_workspace_unique_idx;

-- A regular unique index remains null-friendly in PostgreSQL and can be
-- inferred by PostgREST's ON CONFLICT (referred_workspace_id) upsert.
create unique index referrals_referred_workspace_unique_idx
  on public.referrals (referred_workspace_id);

alter table public.referrals
  drop constraint if exists referrals_no_self_user_check;

alter table public.referrals
  add constraint referrals_no_self_user_check
  check (
    referred_user_id is null
    or referrer_user_id is null
    or referred_user_id <> referrer_user_id
  ) not valid;

alter table public.referrals
  validate constraint referrals_no_self_user_check;

create or replace function public.protect_referral_attribution()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  if new.referrer_workspace_id is distinct from old.referrer_workspace_id
    or lower(new.referral_code) is distinct from lower(old.referral_code)
    or (
      new.referred_workspace_id is not null
      and new.referred_workspace_id is distinct from old.referred_workspace_id
    )
    or (
      new.referrer_user_id is not null
      and new.referrer_user_id is distinct from old.referrer_user_id
    )
    or (
      new.referred_user_id is not null
      and new.referred_user_id is distinct from old.referred_user_id
    ) then
    raise exception 'referral_attribution_immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_referral_attribution_trigger
  on public.referrals;

create trigger protect_referral_attribution_trigger
before update of
  referrer_workspace_id,
  referrer_user_id,
  referred_workspace_id,
  referred_user_id,
  referral_code
on public.referrals
for each row
execute function public.protect_referral_attribution();

revoke all on function public.protect_referral_attribution() from public;
revoke all on function public.protect_referral_attribution() from anon;
revoke all on function public.protect_referral_attribution() from authenticated;

commit;
