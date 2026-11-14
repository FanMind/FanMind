begin;
-- No rows, grants, sales or runtime activation. Apply only after the pinned lifecycle.
create schema fanmind_capacity_private authorization postgres;
revoke all on schema fanmind_capacity_private from public, anon, authenticated, service_role;
create table fanmind_capacity_private.package_prices (
 price_id text primary key check(price_id ~ '^price_[A-Za-z0-9]+$'),
 package_id text not null check(package_id in ('capacity_99','capacity_199','capacity_312')),
 mapping_revision bigint not null check(mapping_revision>0),
 active boolean not null default false
);
alter table fanmind_capacity_private.package_prices enable row level security;
revoke all on fanmind_capacity_private.package_prices from public,anon,authenticated,service_role;

create function fanmind_capacity_private.write_entitlement(
 w uuid, package text, period text, starts timestamptz, ends timestamptz,
 expected bigint, enabled boolean, fingerprint text
) returns bigint language plpgsql security definer set search_path='' as $writer$
declare old public.ai_capacity_workspace_entitlements%rowtype; next_revision bigint;
begin
 if w is null or package is null or package not in ('capacity_99','capacity_199','capacity_312')
 or period is null or btrim(period)='' or starts is null or ends is null or ends<=starts
 or expected is null or expected<0 or expected>=9007199254740991 or enabled is null
 or fingerprint is null or fingerprint !~ '^[a-f0-9]{64}$' then raise exception 'capacity_writer_invalid'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(w::text,41001));
 if not exists(select from public.workspaces where id=w) then raise exception 'capacity_writer_workspace_missing'; end if;
 select * into old from public.ai_capacity_workspace_entitlements where workspace_id=w for update;
 if found and old.source_fingerprint=fingerprint then
  if old.package_id is distinct from package or old.billing_period_key is distinct from period or old.period_start is distinct from starts
   or old.period_end is distinct from ends or old.active is distinct from enabled or old.revision<>expected+1 then raise exception 'capacity_writer_replay_conflict'; end if;
  return old.revision;
 end if;
 if coalesce(old.revision,0)<>expected then raise exception 'capacity_writer_revision_conflict'; end if;
 next_revision:=expected+1;
 insert into public.ai_capacity_workspace_entitlements(workspace_id,billing_contract_version,package_id,billing_period_key,period_start,period_end,revision,active,source_fingerprint)
 values(w,'capacity_v2',package,period,starts,ends,next_revision,enabled,fingerprint)
 on conflict(workspace_id) do update set package_id=excluded.package_id,billing_period_key=excluded.billing_period_key,
 period_start=excluded.period_start,period_end=excluded.period_end,revision=excluded.revision,active=excluded.active,source_fingerprint=excluded.source_fingerprint;
 return next_revision;
end $writer$;
revoke all on function fanmind_capacity_private.write_entitlement(uuid,text,text,timestamptz,timestamptz,bigint,boolean,text) from public,anon,authenticated,service_role;

-- Only a completed, current canonical Billing reconciliation can project paid Capacity.
-- Exact original JSON bytes bind the normalized provider snapshot to its existing receipt.
-- No package, balance, period or arbitrary customer may be selected by a browser.
create function public.sync_ai_capacity_entitlement(p_snapshot text,p_envelope text,p_expected_revision bigint)
returns bigint language plpgsql security definer set search_path='' as $canonical$
declare s jsonb; e jsonb; b jsonb; w uuid; r record; stream record; ws record; mapping record; item jsonb;
 snapshot_hash text; envelope_hash text; start_at timestamptz; end_at timestamptz; allowed boolean; period text; fingerprint text; result bigint;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'ai_capacity_service_role_required'; end if;
 if p_snapshot is null or p_envelope is null or octet_length(p_snapshot)>65536 or octet_length(p_envelope)>65536 then raise exception 'capacity_writer_invalid'; end if;
 s:=p_snapshot::jsonb; e:=p_envelope::jsonb; b:=e->0;
 snapshot_hash:=encode(sha256(convert_to(p_snapshot,'UTF8')),'hex'); envelope_hash:=encode(sha256(convert_to(p_envelope,'UTF8')),'hex');
 if jsonb_typeof(s) is distinct from 'object' or jsonb_typeof(e) is distinct from 'array' or jsonb_array_length(e)<>2
 or e->>1 is distinct from snapshot_hash or b->>'p_event_stream' is distinct from 'lifecycle'
 or b->>'p_workspace_id' is distinct from s->>'workspaceId' or b->>'p_stripe_request_id' is distinct from s->>'requestId'
 or b->>'p_customer_id' is distinct from s->>'customerId' or b->>'p_subscription_id' is distinct from s->>'subscriptionId'
 or b->>'p_snapshot_observed_at' is distinct from s->>'observedAt' then raise exception 'capacity_writer_evidence_invalid'; end if;
 if exists(select from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('workspace_stripe_billing_reconciliations','workspace_stripe_billing_streams') and (not c.relrowsecurity or not c.relforcerowsecurity or c.relowner<>to_regrole('postgres') or exists(select from unnest(array['anon','authenticated','service_role']) role_name where has_table_privilege(role_name,c.oid,'SELECT,INSERT,UPDATE,DELETE') or has_any_column_privilege(role_name,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))) then raise exception 'capacity_writer_billing_boundary_invalid';end if;
 w:=(s->>'workspaceId')::uuid;
 perform pg_advisory_xact_lock(hashtextextended(w::text,41001));
 select * into r from public.workspace_stripe_billing_reconciliations where stripe_request_id=s->>'requestId' and workspace_id=w and event_stream='lifecycle' for share;
 if not found or r.snapshot_fingerprint<>envelope_hash or r.stripe_customer_id is distinct from s->>'customerId'
 or r.stripe_subscription_id is distinct from s->>'subscriptionId' or r.expected_revision is distinct from (b->>'p_expected_revision')::bigint
 or r.snapshot_observed_at is distinct from (s->>'observedAt')::timestamptz then raise exception 'capacity_writer_receipt_missing'; end if;
 select * into stream from public.workspace_stripe_billing_streams where workspace_id=w and event_stream='lifecycle' for share;
 if not found or stream.sync_state<>'in_sync' or stream.projection_revision<>r.resulting_revision
 or stream.stripe_customer_id is distinct from r.stripe_customer_id or stream.stripe_subscription_id is distinct from r.stripe_subscription_id
 then raise exception 'capacity_writer_billing_changed'; end if;
 if r.snapshot_observed_at<clock_timestamp()-interval '15 minutes' or r.snapshot_observed_at>clock_timestamp() then raise exception 'capacity_writer_snapshot_expired'; end if;
 select * into ws from public.workspaces where id=w for share;
 if not found or ws.stripe_customer_id is distinct from r.stripe_customer_id or ws.stripe_subscription_id is distinct from r.stripe_subscription_id
 or ws.billing_status is distinct from b->'p_projection'->>'billing_status' or ws.workspace_access_mode is distinct from b->'p_projection'->>'workspace_access_mode'
 then raise exception 'capacity_writer_workspace_changed'; end if;
 select * into mapping from fanmind_capacity_private.package_prices where price_id=s->>'basePriceId' and active for share;
 if not found then raise exception 'capacity_writer_mapping_missing'; end if;
 if jsonb_typeof(s->'items') is distinct from 'array' or (select count(*) from jsonb_array_elements(s->'items') x where x->>'priceId'=mapping.price_id)<>1 then raise exception 'capacity_writer_period_invalid'; end if;
 select x into item from jsonb_array_elements(s->'items') x where x->>'priceId'=mapping.price_id;
 start_at:=to_timestamp((item->>'start')::bigint); end_at:=to_timestamp((item->>'end')::bigint);
 if start_at>=end_at or end_at is distinct from ws.billing_current_period_end_at then raise exception 'capacity_writer_period_invalid'; end if;
 allowed:=s->>'status'='active' and ws.billing_status='active' and ws.workspace_access_mode='active' and ws.billing_suspended_at is null
 and s->'latestInvoice'->>'status'='paid' and (s->'latestInvoice'->>'amountRemaining')::bigint=0
 and start_at<=clock_timestamp() and end_at>clock_timestamp() and not stream.lifecycle_terminal;
 period:=encode(sha256(convert_to(jsonb_build_array(w,r.stripe_subscription_id,mapping.price_id,start_at,end_at)::text,'UTF8')),'hex');
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(envelope_hash,mapping.mapping_revision,mapping.package_id,period,allowed)::text,'UTF8')),'hex');
 result:=fanmind_capacity_private.write_entitlement(w,mapping.package_id,period,start_at,end_at,p_expected_revision,coalesce(allowed,false),fingerprint);
 return result;
end $canonical$;
revoke all on function public.sync_ai_capacity_entitlement(text,text,bigint) from public,anon,authenticated;
grant execute on function public.sync_ai_capacity_entitlement(text,text,bigint) to service_role;

-- Billing changes invalidate Capacity immediately; only fresh canonical evidence can restore it.
create function fanmind_capacity_private.invalidate_entitlement()
returns trigger language plpgsql security definer set search_path='' as $invalidate$
declare w uuid;
begin
 if tg_op='DELETE' then w:=old.workspace_id;elsif tg_table_name='workspaces' then w:=new.id;else w:=new.workspace_id;end if;
 update public.ai_capacity_workspace_entitlements set active=false,revision=revision+1,
 source_fingerprint=encode(sha256(convert_to(source_fingerprint||':billing-invalidated:'||(revision+1)::text,'UTF8')),'hex') where workspace_id=w and active;
 return new;
end $invalidate$;
revoke all on function fanmind_capacity_private.invalidate_entitlement() from public,anon,authenticated,service_role;
create trigger capacity_workspace_invalidate after update of billing_status,workspace_access_mode,billing_suspended_at,stripe_customer_id,stripe_subscription_id,billing_current_period_end_at on public.workspaces
 for each row when (old.billing_status is distinct from new.billing_status or old.workspace_access_mode is distinct from new.workspace_access_mode or old.billing_suspended_at is distinct from new.billing_suspended_at or old.stripe_customer_id is distinct from new.stripe_customer_id or old.stripe_subscription_id is distinct from new.stripe_subscription_id or old.billing_current_period_end_at is distinct from new.billing_current_period_end_at)
 execute function fanmind_capacity_private.invalidate_entitlement();
create trigger capacity_billing_invalidate after update of projection_revision,sync_state,lifecycle_terminal on public.workspace_stripe_billing_streams
 for each row when (new.event_stream='lifecycle' and (old.projection_revision is distinct from new.projection_revision or old.sync_state is distinct from new.sync_state or old.lifecycle_terminal is distinct from new.lifecycle_terminal))
 execute function fanmind_capacity_private.invalidate_entitlement();
create function fanmind_capacity_private.invalidate_mapping()
returns trigger language plpgsql security definer set search_path='' as $mapping$
begin
 update public.ai_capacity_workspace_entitlements set active=false,revision=revision+1,
 source_fingerprint=encode(sha256(convert_to(source_fingerprint||':mapping-invalidated:'||(revision+1)::text,'UTF8')),'hex') where active;
 return null;
end $mapping$;
revoke all on function fanmind_capacity_private.invalidate_mapping() from public,anon,authenticated,service_role;
create trigger capacity_mapping_invalidate after update or delete on fanmind_capacity_private.package_prices
 for each statement execute function fanmind_capacity_private.invalidate_mapping();
create trigger capacity_billing_delete after delete on public.workspace_stripe_billing_streams for each row when(old.event_stream='lifecycle') execute function fanmind_capacity_private.invalidate_entitlement();
commit;
