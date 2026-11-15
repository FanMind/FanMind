import {estimateOpenAiReservationCost,calculateOpenAiSettlementCost} from '../../src/lib/aiCapacityAccounting.mjs';
import {resolveFanMindAiQualityProfile} from '../../src/config/openAiPriceCatalog.mjs';
import {literal} from './ai-capacity-install-contract.mjs';
const uuid=s=>/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(s??'');
export function syntheticAcceptanceSql({workspaceA,workspaceB,runId,fx,now=Date.now()}){
 if(!uuid(workspaceA)||!uuid(workspaceB)||workspaceA===workspaceB||! /^[0-9]{1,20}$/u.test(runId??'')||!Number.isSafeInteger(now)||!fx||!Number.isFinite(Date.parse(fx.validFrom))||Date.parse(fx.validFrom)>now||!(Date.parse(fx.validUntil)>now)||Date.parse(fx.validUntil)-Date.parse(fx.validFrom)>72*3600000)throw Error('capacity_fixture_invalid');
 const quality=resolveFanMindAiQualityProfile('balanced');const occurredAt=new Date(now).toISOString();
 const usage={input_tokens:120,output_tokens:40,total_tokens:160,input_tokens_details:{cached_tokens:20},output_tokens_details:{reasoning_tokens:5}};
 const reservation=estimateOpenAiReservationCost({...quality,occurredAt,estimatedInputTokens:200,maxOutputTokens:800,...fx,fxVersion:fx.version});
 const settlement=calculateOpenAiSettlementCost({...quality,occurredAt,providerUsage:usage,...fx,fxVersion:fx.version});
 const a=literal(workspaceA),b=literal(workspaceB),key=literal('support1350:'+runId),model=literal(quality.model),pricing=literal(reservation.pricingVersion),fxVersion=literal(fx.version);
 const reserve=(w,k)=>`public.ai_capacity_reserve(${w},${k},${key},'capacity_99','balanced',${reservation.reservedEurMicrocents},2,1,'openai',${model},${pricing},${fxVersion},'{}')`;
 return `BEGIN;SET LOCAL statement_timeout='30s';SET LOCAL lock_timeout='2s';SET LOCAL search_path=pg_catalog,public;SET LOCAL row_security=off;
 SELECT pg_advisory_xact_lock(hashtextextended('fanmind-capacity-install-v1',0));
 LOCK TABLE public.ai_capacity_admin_policy,public.ai_capacity_grants,public.ai_capacity_reservations,public.ai_capacity_reservation_allocations,public.ai_capacity_ledger_events,public.ai_capacity_workspace_entitlements,fanmind_capacity_private.package_prices IN SHARE ROW EXCLUSIVE MODE;
 DO $guard$ BEGIN
 IF (SELECT count(*) FROM public.workspaces w JOIN auth.users u ON u.id=w.owner_user_id WHERE w.id=${a} AND u.email='capacity1350-a@test.fanmind.invalid' AND u.raw_app_meta_data @> '{"capacity1350_synthetic":true}'::jsonb AND w.test_access_flags @> '{"capacity1350_synthetic":true}'::jsonb AND w.stripe_customer_id IS NULL AND w.stripe_subscription_id IS NULL)<>1
 OR (SELECT count(*) FROM public.workspaces w JOIN auth.users u ON u.id=w.owner_user_id WHERE w.id=${b} AND u.email='capacity1350-b@test.fanmind.invalid' AND u.raw_app_meta_data @> '{"capacity1350_synthetic":true}'::jsonb AND w.test_access_flags @> '{"capacity1350_synthetic":true}'::jsonb AND w.stripe_customer_id IS NULL AND w.stripe_subscription_id IS NULL)<>1
 OR EXISTS(SELECT FROM public.ai_capacity_workspace_entitlements) OR EXISTS(SELECT FROM public.ai_capacity_grants) OR EXISTS(SELECT FROM public.ai_capacity_reservations) OR EXISTS(SELECT FROM public.ai_capacity_ledger_events) OR EXISTS(SELECT FROM public.ai_capacity_reservation_allocations)
 OR NOT EXISTS(SELECT FROM public.ai_capacity_admin_policy WHERE singleton_id=1 AND revision=2 AND NOT runtime_activation_ready AND NOT global_capacity_enabled AND emergency_spend_freeze AND NOT fast_enabled AND NOT balanced_enabled AND NOT premium_enabled AND NOT top_up_sales_enabled AND NOT package_99_sales_enabled AND NOT package_199_sales_enabled AND NOT package_312_sales_enabled)
 THEN RAISE EXCEPTION 'capacity_fixture_boundary_invalid';END IF;END $guard$;
 SELECT fanmind_capacity_private.write_entitlement(${a},'capacity_99',${key},statement_timestamp()-interval '1 second',statement_timestamp()+interval '1 day',0,true,encode(sha256(convert_to('synthetic-A:'||${key},'UTF8')),'hex'));
 SELECT fanmind_capacity_private.write_entitlement(${b},'capacity_99',${key},statement_timestamp()-interval '1 second',statement_timestamp()+interval '1 day',0,true,encode(sha256(convert_to('synthetic-B:'||${key},'UTF8')),'hex'));
 -- Temporary policy and all synthetic rows ALWAYS roll back. Never commit an activation.
 UPDATE public.ai_capacity_admin_policy SET runtime_activation_ready=true,global_capacity_enabled=true,emergency_spend_freeze=false,balanced_enabled=true;
 SET LOCAL ROLE service_role;SET LOCAL "request.jwt.claim.role"='service_role';
 SELECT public.ai_capacity_grant_credit(${a},'included_period',${key},'capacity_99',${key},(SELECT period_start FROM public.ai_capacity_workspace_entitlements WHERE workspace_id=${a}),(SELECT period_end FROM public.ai_capacity_workspace_entitlements WHERE workspace_id=${a}),null,1500000000,'{"synthetic":true}');
 DO $tests$ DECLARE r record; replay record; settled record; rejected boolean:=false; held record;BEGIN
 BEGIN PERFORM * FROM ${reserve(b,key)};EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'ai_capacity_insufficient_balance' THEN RAISE;END IF;rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'capacity_empty_balance_accepted';END IF;
 SELECT * INTO r FROM ${reserve(a,key)};
 SELECT * INTO replay FROM ${reserve(a,key)};
 IF NOT r.created OR replay.created OR r.reservation_id<>replay.reservation_id THEN RAISE EXCEPTION 'capacity_duplicate';END IF;
 SELECT * INTO settled FROM public.ai_capacity_settle(r.reservation_id,${settlement.actualEurMicrocents},'openai',${model},120,20,0,40,5,${pricing},${fxVersion},'{}');
 PERFORM * FROM public.ai_capacity_settle(r.reservation_id,${settlement.actualEurMicrocents},'openai',${model},120,20,0,40,5,${pricing},${fxVersion},'{}');
 SELECT * INTO held FROM ${reserve(a,literal('unknown:'+runId))};
 PERFORM * FROM public.ai_capacity_mark_indeterminate(held.reservation_id,'synthetic_provider_timeout');
 IF NOT EXISTS(SELECT FROM public.ai_capacity_reservations WHERE id=held.reservation_id AND state='indeterminate') THEN RAISE EXCEPTION 'capacity_unknown_refunded';END IF;
 SELECT * INTO held FROM ${reserve(a,literal('rejection:'+runId))};
 PERFORM * FROM public.ai_capacity_release(held.reservation_id,'synthetic_definitive_rejection');
 IF EXISTS(SELECT FROM public.ai_capacity_ledger_events WHERE workspace_id<>${a}) OR (SELECT count(*) FROM public.ai_capacity_ledger_events WHERE event_type='reservation_settled')<>1
 OR (SELECT settled_eur_microcents FROM public.ai_capacity_reservations WHERE id=r.reservation_id)<>${settlement.actualEurMicrocents}
 THEN RAISE EXCEPTION 'capacity_charge_or_isolation_invalid';END IF;
 END $tests$;
 RESET ROLE;
 UPDATE public.workspaces SET billing_status='suspended' WHERE id=${a};
 SET LOCAL ROLE service_role;SET LOCAL "request.jwt.claim.role"='service_role';
 DO $withdraw$ DECLARE denied boolean:=false;BEGIN
 BEGIN PERFORM * FROM ${reserve(a,literal('withdrawal:'+runId))};EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'ai_capacity_entitlement_invalid' THEN RAISE;END IF;denied:=true;END;
 IF NOT denied THEN RAISE EXCEPTION 'capacity_revocation_bypass';END IF;END $withdraw$;
 ROLLBACK;`;
}
