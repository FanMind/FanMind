import { buildStripeBillingLedgerCommand, buildStripeBillingLedgerRpcBody } from "../../src/lib/stripeBillingEventLedger.mjs";
import { buildStripeBillingReconciliation } from "../../src/lib/stripeBillingReconciliation.mjs";

const literal = value => value === null ? "null" : typeof value === "boolean" || typeof value === "number" ? String(value) : `'${String(value).replaceAll("'","''")}'`;
function call(name,body) {
  return `public.${name}(${Object.entries(body).filter(([key])=>key.startsWith("p_")).map(([key,value])=>{
    const encoded = Array.isArray(value) && key==="p_resolved_event_ids" ? `array[${value.map(literal).join(",")}]::text[]` : value && typeof value === "object" ? `${literal(JSON.stringify(value))}::jsonb` : literal(value);
    return `${key} => ${encoded}`;
  }).join(",")})`;
}

export function buildStagingBillingCanonicalAcceptanceSql({workspaceId,runId,now=Date.now()}) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(workspaceId??"") || !/^[0-9]{1,20}$/u.test(runId??"") || !Number.isSafeInteger(now)) throw Error("canonical_fixture_invalid");
  const workspace=literal(workspaceId);
  const customer=`cus_fanmind_canonical_${runId}`, subscription=`sub_fanmind_canonical_${runId}`, eventId=`evt_fanmind_canonical_${runId}`;
  const requestId=`req_fanmind_canonical_${runId}`;
  const at=new Date(now-1000).toISOString();
  const event={id:eventId,created:Math.floor(now/1000)-120,type:"checkout.session.completed",data:{object:{id:`cs_test_fanmind_canonical_${runId}`,customer,subscription,metadata:{workspace_id:workspaceId}}}};
  const command=buildStripeBillingLedgerCommand({event,signedEventVerified:true,projection:{billing_status:"active",workspace_access_mode:"active"}}).command;
  if (!command) throw Error("canonical_fixture_invalid");
  const capture=buildStripeBillingLedgerRpcBody(command,{projectionEnabled:false});
  const input={workspaceId,stream:"lifecycle",requestId,observedAt:at,providerSnapshotFingerprint:"a".repeat(64),expectedRevision:0,customerId:customer,subscriptionId:subscription,
    projection:{billing_status:"active",workspace_access_mode:"active",billing_suspended_at:null,billing_suspended_reason:null},resolvedEventIds:[eventId],
    objectBindings:[{type:"customer",id:customer},{type:"subscription",id:subscription},{type:"checkout_session",id:event.data.object.id}]};
  const reconciliation=buildStripeBillingReconciliation(input);
  const bad=buildStripeBillingReconciliation({...input,requestId:`${requestId}_stale`,expectedRevision:99});
  const reconcileSql=call("reconcile_workspace_stripe_billing_projection",reconciliation);
  return String.raw`\set ON_ERROR_STOP on
create temp table canonical_original_workspace on commit preserve rows as select to_jsonb(w) as original from public.workspaces w where id=${workspace};
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $fixture$
begin
  perform 1 from public.workspaces where id=${workspace} for update;
  if not found or (select count(*) from canonical_original_workspace)<>1 then raise exception 'canonical_fixture_missing'; end if;
  if exists(select 1 from public.workspaces where id=${workspace} and (stripe_customer_id is not null or stripe_subscription_id is not null))
     or exists(select 1 from public.workspace_stripe_billing_streams where workspace_id=${workspace})
     or exists(select 1 from public.workspace_stripe_billing_events where workspace_id=${workspace})
     or exists(select 1 from public.workspace_stripe_billing_object_bindings where workspace_id=${workspace})
     or exists(select 1 from public.workspace_ai_tier_entitlements where workspace_id=${workspace})
     or exists(select 1 from public.workspace_ai_tier_stripe_events where workspace_id=${workspace})
     or exists(select 1 from public.referrals where referred_workspace_id=${workspace} or referrer_workspace_id=${workspace})
     or exists(select 1 from public.demo_start_sessions where workspace_id=${workspace})
  then raise exception 'canonical_fixture_not_empty'; end if;
  -- Start from a deliberately different lifecycle projection. A protected
  -- Workspace for which canonical Billing intentionally skips projection can
  -- therefore never pass the later active/active postflight accidentally.
  update public.workspaces
     set stripe_customer_id=${literal(customer)},
         stripe_subscription_id=${literal(subscription)},
         billing_status='suspended',
         workspace_access_mode='archived_readonly',
         billing_suspended_at=statement_timestamp(),
         billing_suspended_reason='stripe_reconciliation_required'
   where id=${workspace};
end $fixture$;
${["anon","authenticated"].map(role=>`set local role ${role};
do $browser$
begin
  begin
    perform * from ${reconcileSql};
    raise exception 'canonical_browser_write_allowed';
  exception when insufficient_privilege then null;
  end;
end $browser$;
reset role;`).join("\n")}
set local role service_role;
do $capture$
declare r record;
begin
  select * into strict r from ${call("apply_workspace_stripe_billing_event",capture)};
  if r.result_status<>'reconciliation_needed' or r.result_revision<>0 then raise exception 'canonical_capture_failed'; end if;
end $capture$;
reset role;
-- The workspace lock is held for the complete transaction. Standard-only and
-- no-referral absence are revalidated immediately before the Billing RPC.
do $downstream$
begin
  if exists(select 1 from public.workspace_ai_tier_entitlements where workspace_id=${workspace})
     or exists(select 1 from public.workspace_ai_tier_stripe_events where workspace_id=${workspace})
     or exists(select 1 from public.referrals where referred_workspace_id=${workspace} or referrer_workspace_id=${workspace})
  then raise exception 'canonical_downstream_changed'; end if;
end $downstream$;
set local role service_role;
do $reconcile$
declare r record;
begin
  begin
    perform * from ${call("reconcile_workspace_stripe_billing_projection",bad)};
    raise exception 'canonical_stale_revision_accepted';
  exception when serialization_failure then null;
  end;
  select * into strict r from ${reconcileSql};
  if r.result_status<>'reconciled' or r.result_revision<>1 then raise exception 'canonical_reconcile_failed'; end if;
  select * into strict r from ${reconcileSql};
  if r.result_status<>'duplicate_reconciliation' or r.result_revision<>1 then raise exception 'canonical_duplicate_failed'; end if;
end $reconcile$;
reset role;
do $postflight$
begin
  if not exists(select 1 from public.workspaces where id=${workspace} and billing_status='active' and workspace_access_mode='active' and billing_suspended_at is null and billing_suspended_reason is null)
     or not exists(select 1 from public.workspace_stripe_billing_streams where workspace_id=${workspace} and sync_state='in_sync' and projection_revision=1)
     or not exists(select 1 from public.workspace_stripe_billing_events where event_id=${literal(eventId)} and processing_state='reconciled' and projection_revision=1)
  then raise exception 'canonical_postflight_failed'; end if;
end $postflight$;
rollback;
begin;
set transaction read only;
do $cleanup$
begin
  if (select to_jsonb(w) from public.workspaces w where id=${workspace}) is distinct from (select original from canonical_original_workspace)
     or exists(select 1 from public.workspace_stripe_billing_events where event_id=${literal(eventId)})
     or exists(select 1 from public.workspace_stripe_billing_reconciliations where stripe_request_id in (${literal(requestId)},${literal(`${requestId}_stale`)}))
     or exists(select 1 from public.workspace_stripe_billing_streams where workspace_id=${workspace})
     or exists(select 1 from public.workspace_stripe_billing_object_bindings where workspace_id=${workspace})
  then raise exception 'canonical_rollback_failed'; end if;
end $cleanup$;
rollback;
select 'STAGING_CANONICAL_BILLING_ACCEPTANCE=PASS';
select 'STAGING_CANONICAL_BILLING_TRANSACTION=ROLLED_BACK';
select 'STAGING_CANONICAL_BILLING_CLEANUP=PASS';
`;
}
