import { canonicalStripeBillingProjection } from "../src/lib/stripeBillingCanonicalProjection.mjs";
import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import { recoverStripeBillingReconciliation as recover, buildStripeBillingReconciliation as build, executeStripeBillingReconciliation as execute, normalizeStripeBillingReconciliationResult as result, createStagingBillingReconciliationCommitter as committer } from '../src/lib/stripeBillingReconciliation.mjs';
const now = Date.parse('2026-09-06T16:00:00Z');
const fixture = () => ({workspaceId:'11111111-1111-4111-8111-111111111111', stream:'lifecycle', providerSnapshotFingerprint:'a'.repeat(64), requestId:'req_snapshot', observedAt:new Date(now).toISOString(), expectedRevision:7, customerId:'cus_owner', subscriptionId:'sub_base', projection:{billing_status:'active',workspace_access_mode:'active',billing_suspended_at:null,billing_suspended_reason:null},resolvedEventIds:['evt_b','evt_a'],objectBindings:[{type:'subscription',id:'sub_base'},{type:'customer',id:'cus_owner'}]});
const target = {stagingRef:'s'.repeat(20), productionRef:'p'.repeat(20)};
const environment = {FANMIND_RUNTIME_ENVIRONMENT:'staging',NEXT_PUBLIC_APP_URL:'https://staging.fanmind.ch',FANMIND_ENABLE_NON_PRODUCTION_WRITES:'true',FANMIND_NON_PRODUCTION_WRITE_ACK:'I_UNDERSTAND_NON_PRODUCTION_ONLY',NEXT_PUBLIC_SUPABASE_URL:`https://${target.stagingRef}.supabase.co`,FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:target.productionRef,FANMIND_STAGING_BILLING_RECONCILIATION_ENABLED:'true'};
const receipt = (body,component) => ({component,status:'reconciled',workspaceId:body.p_workspace_id,requestId:body.p_stripe_request_id,snapshotFingerprint:body.p_snapshot_fingerprint,providerSnapshotFingerprint:body.providerSnapshotFingerprint});
function harness() { const calls=[]; const input=fixture(); const snapshot={workspaceId:input.workspaceId,customerId:input.customerId,subscriptionId:input.subscriptionId,requestId:input.requestId,observedAt:input.observedAt,createdAt:Math.floor(now/1000)-100,status:'active',basePriceId:'price_base',cancelAtPeriodEnd:false,cancelAt:null,canceledAt:null,endedAt:null,items:[{id:'si_base',priceId:'price_base',start:Math.floor(now/1000)-100,end:Math.floor(now/1000)+86400}],latestInvoice:{id:'in_paid',status:'paid',amountRemaining:0,amountDue:31200,amountPaid:31200,created:Math.floor(now/1000)-100,attemptCount:1,nextPaymentAttempt:null,hostedUrl:null,pdfUrl:null,paidAt:Math.floor(now/1000)-50}}; const fingerprint=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');input.providerSnapshotFingerprint=fingerprint; input.projection=canonicalStripeBillingProjection(snapshot,now); return {calls, input, observation:{status:'read',snapshot,fingerprint}, environment, reviewedTarget:target, clock:()=>now, adapters:{withBillingReservation:async(body,run)=>run({contract:'stripe-billing-reservation-v1',held:true,command:body}),reconcileAi:async b=>{calls.push('ai');return receipt(b,'ai');},reconcileReferral:async b=>{calls.push('referral');return receipt(b,'referral');},commitBilling:async b=>{calls.push('billing');return [{result_status:'reconciled',result_revision:b.p_expected_revision+1}];}}}; }
test('canonical payload hashes identity, revision, projection and complete normalized lists',()=>{
 const a=fixture(); const b=fixture(); b.resolvedEventIds.reverse();b.objectBindings.reverse();b.projection={billing_suspended_reason:null,billing_suspended_at:null,workspace_access_mode:'active',billing_status:'active'};
 assert.deepEqual(build(a),build(b));
 for(const [key,value] of [['providerSnapshotFingerprint','b'.repeat(64)],['requestId','req_other'],['expectedRevision',8],['observedAt',new Date(now+1000).toISOString()],['resolvedEventIds',['evt_a']]]) {assert.notEqual(build({...a,[key]:value}).p_snapshot_fingerprint,build(a).p_snapshot_fingerprint);}
 assert.ok(Object.isFrozen(build(a).p_projection));assert.ok(Object.isFrozen(build(a).p_object_bindings[0]));
});
test('incomplete identity, duplicate events and cross-customer bindings are rejected',()=>{
 for(const patch of [{customerId:'cus_bad/secret'},{subscriptionId:undefined},{expectedRevision:-1},{expectedRevision:Number.MAX_SAFE_INTEGER},{resolvedEventIds:['evt_a','evt_a']},{objectBindings:[{type:'customer',id:'cus_other'}]},{objectBindings:[{type:'customer',id:'cus_owner',email:'private'}]}]) assert.throws(()=>build({...fixture(),...patch}),/billing_reconciliation_invalid/);
});
test('active projection cannot retain suspension or override provider binding',()=>{
 for(const patch of [{billing_suspended_reason:'manual_suspended'},{billing_suspended_at:new Date(now).toISOString()},{workspace_access_mode:'archived_readonly'},{stripe_customer_id:'cus_other'},{untrusted:'private'},{billing_suspended_reason:undefined}]) assert.throws(()=>build({...fixture(),projection:{...fixture().projection,...patch}}));
 assert.throws(()=>build({...fixture(),projection:{billing_status:'cancelled',workspace_access_mode:'active',billing_suspended_at:null,billing_suspended_reason:null}}));
});
test('tax reconciliation cannot alter lifecycle or bind subscriptions',()=>{
 const a={...fixture(),stream:'tax',subscriptionId:null,projection:{billing_note:'verified'},objectBindings:[{type:'customer',id:'cus_owner'}]};assert.equal(build(a).p_event_stream,'tax');
 assert.throws(()=>build({...a,subscriptionId:'sub_base'}));assert.throws(()=>build({...a,projection:fixture().projection}));
});
test('both downstream receipts are required before the billing commit',async()=>{const h=harness();assert.deepEqual(await execute(h),{status:'reconciled',revision:8});assert.deepEqual(h.calls,['ai','referral','billing']);});
test('stale or unrelated downstream receipts never reach billing',async()=>{
 for(const component of ['ai','referral']) for(const field of ['workspaceId','requestId','snapshotFingerprint','component','status']) {
  const h=harness();h.adapters[component==='ai'?'reconcileAi':'reconcileReferral']=async b=>({...receipt(b,component),[field]:'wrong'});
  assert.equal((await execute(h)).reason,`${component}_receipt_invalid`);assert.ok(!h.calls.includes('billing'));
 }
});
test('transport ambiguity neither retries nor advances to later stages',async()=>{
 for(const [method,reason] of [['reconcileAi','downstream_transport'],['reconcileReferral','downstream_transport'],['commitBilling','billing_transport']]) {
  const h=harness();let attempts=0;h.adapters[method]=async()=>{attempts++;throw Error('private provider response');};
  assert.deepEqual(await execute(h),{status:'indeterminate',reason});assert.equal(attempts,1);
  if(method!=='commitBilling') assert.ok(!h.calls.includes('billing'));
 }
});
test('expired snapshot after downstream work cannot activate billing',async()=>{const h=harness();let reads=0;h.clock=()=>now+(reads++ > 1 ? 900001:0);assert.equal((await execute(h)).reason,'snapshot_expired');assert.deepEqual(h.calls,['ai','referral']);});
test('Production, absent approval and wrong independently bound target do zero work',async()=>{
 for(const patch of [{FANMIND_RUNTIME_ENVIRONMENT:'production'},{FANMIND_STAGING_BILLING_RECONCILIATION_ENABLED:'false'},{FANMIND_ENABLE_NON_PRODUCTION_WRITES:'false'},{NEXT_PUBLIC_SUPABASE_URL:`https://${target.productionRef}.supabase.co`}]){const h=harness();h.environment={...environment,...patch};assert.equal((await execute(h)).reason,'target_not_confirmed');assert.deepEqual(h.calls,[]);}
 const h=harness();h.reviewedTarget={...target,stagingRef:target.productionRef};assert.equal((await execute(h)).reason,'target_not_confirmed');assert.deepEqual(h.calls,[]);
});
test('database receipt requires exactly the expected CAS result',()=>{
 assert.deepEqual(result([{result_status:'duplicate_reconciliation',result_revision:8}],7),{status:'duplicate_reconciliation',revision:8});
 for(const payload of [[],[{result_status:'reconciled',result_revision:9}],[{result_status:'reconciled',result_revision:'8'}],[{result_status:'unexpected',result_revision:8}]]) assert.equal(result(payload,7),null);
});


test('commit adapter uses only the exact bound RPC and rejects altered fingerprints before I/O',async()=>{
 const calls=[];
 const commit=committer({environment:{...environment,SUPABASE_SERVICE_ROLE_KEY:'test-service-role'},reviewedTarget:target,fetchImplementation:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>[{result_status:'reconciled',result_revision:8}]};}});
 await assert.rejects(commit({...build(fixture()),p_snapshot_fingerprint:'0'.repeat(64)}));assert.equal(calls.length,0);
 await commit(build(fixture()));assert.equal(calls.length,1);
 assert.equal(calls[0].url,`https://${target.stagingRef}.supabase.co/rest/v1/rpc/reconcile_workspace_stripe_billing_projection`);
 assert.equal(calls[0].options.method,'POST');assert.equal(calls[0].options.redirect,'error');
 assert.equal(JSON.parse(calls[0].options.body).p_expected_revision,7);
 assert.throws(()=>committer({environment:{...environment,FANMIND_RUNTIME_ENVIRONMENT:'production'},reviewedTarget:target}));
});


test('downstream adapters receive the identical immutable provider observation',async()=>{
 const h=harness();const seen=[];
 for(const [method,component] of [['reconcileAi','ai'],['reconcileReferral','referral']])h.adapters[method]=async(body,snapshot)=>{seen.push(snapshot);assert.ok(Object.isFrozen(snapshot.items[0]));assert.throws(()=>{snapshot.items[0].priceId='price_wrong';});return receipt(body,component);};
 assert.equal((await execute(h)).status,'reconciled');assert.equal(seen[0],seen[1]);
 const bad=harness();bad.observation.snapshot.items[0].priceId='price_changed';assert.equal((await execute(bad)).reason,'provider_snapshot_invalid');assert.deepEqual(bad.calls,[]);
});


test('a canceled provider snapshot cannot commit a separately supplied active projection',async()=>{
 const h=harness();h.observation.snapshot.status='canceled';h.observation.snapshot.endedAt=Math.floor(now/1000)-1;
 h.observation.fingerprint=createHash('sha256').update(JSON.stringify(h.observation.snapshot)).digest('hex');h.input.providerSnapshotFingerprint=h.observation.fingerprint;
 assert.equal((await execute(h)).reason,'projection_snapshot_mismatch');assert.deepEqual(h.calls,[]);
});
test('paid canonical invoice records provider payment time and clears old failure history',()=>{
 const h=harness();assert.equal(h.input.projection.billing_last_payment_at,new Date(now-50000).toISOString());assert.equal(h.input.projection.billing_last_payment_failed_at,null);
});

test('tax reconciliation reaches only the fixed billing commit without lifecycle adapters',async()=>{
 const h=harness();h.input.stream='tax';h.input.subscriptionId=null;h.input.projection={billing_note:'Stripe-Steuer-ID wurde entfernt.'};h.input.objectBindings=[{type:'customer',id:h.input.customerId},{type:'tax_id',id:'txi_removed'}];h.observation.snapshot.subscriptionId=null;h.observation.snapshot.tax={id:'txi_removed',customerId:h.input.customerId,deleted:true,verificationStatus:null};
 h.observation.fingerprint=createHash('sha256').update(JSON.stringify(h.observation.snapshot)).digest('hex');h.input.providerSnapshotFingerprint=h.observation.fingerprint;
 assert.deepEqual(await execute(h),{status:'reconciled',revision:8});assert.deepEqual(h.calls,['billing']);
});

test('delayed recovery uses only the persisted attempted command and both durable receipts',async()=>{
 const h=harness();h.clock=()=>now+3600000;
 const body=build(h.input);h.adapters.loadPersistedBillingAttempt=async()=>({phase:'billing_attempted',command:body,aiReceipt:receipt(body,'ai'),referralReceipt:receipt(body,'referral')});
 h.adapters.commitBilling=async b=>{h.calls.push('billing');assert.deepEqual(b,body);return [{result_status:'duplicate_reconciliation',result_revision:8}];};
 assert.deepEqual(await recover(h),{status:'duplicate_reconciliation',revision:8});assert.deepEqual(h.calls,['billing']);
 for(const patch of [{phase:'prepared'},{command:{...body,p_expected_revision:8}},{aiReceipt:null},{referralReceipt:receipt({...body,providerSnapshotFingerprint:'b'.repeat(64)},'referral')}]){
   h.calls.length=0;h.adapters.loadPersistedBillingAttempt=async()=>({phase:'billing_attempted',command:body,aiReceipt:receipt(body,'ai'),referralReceipt:receipt(body,'referral'),...patch});
   assert.equal((await recover(h)).reason,'recovery_evidence_invalid');assert.deepEqual(h.calls,[]);
 }
});
test('custom scheduled cancellation preserves the existing local request marker',()=>{
 const h=harness();h.observation.snapshot.cancelAt=Math.floor(now/1000)+86400;
 const p=canonicalStripeBillingProjection(h.observation.snapshot,now);
 assert.equal(Object.hasOwn(p,'subscription_cancel_requested_at'),false);assert.equal(p.subscription_effective_end_at,new Date(now+86400000).toISOString());
});

test('persisted JSON key order cannot prevent exact delayed recovery',async()=>{
 const h=harness();const body=build(h.input);const reorder=value=>value && typeof value==='object'?(Array.isArray(value)?value.map(reorder):Object.fromEntries(Object.entries(value).reverse().map(([k,v])=>[k,reorder(v)]))):value;
 h.adapters.loadPersistedBillingAttempt=async()=>({phase:'billing_attempted',command:reorder(body),aiReceipt:receipt(body,'ai'),referralReceipt:receipt(body,'referral')});
 h.adapters.commitBilling=async()=>[{result_status:'duplicate_reconciliation',result_revision:8}];assert.deepEqual(await recover(h),{status:'duplicate_reconciliation',revision:8});
});
test('current delinquency records the bounded observation time',()=>{
 const h=harness();h.observation.snapshot.status='past_due';h.observation.snapshot.latestInvoice.status='open';h.observation.snapshot.latestInvoice.paidAt=null;
 assert.equal(canonicalStripeBillingProjection(h.observation.snapshot,now).billing_last_payment_failed_at,h.observation.snapshot.observedAt);
});

test('changed inventory and invalid reservations prevent all downstream writes',async()=>{
 const h=harness();h.adapters.withBillingReservation=async()=>{throw Error('billing_state_changed');};assert.equal((await execute(h)).reason,'billing_state_changed');assert.deepEqual(h.calls,[]);
 const wrong=harness();wrong.adapters.withBillingReservation=async(body,run)=>run({contract:'stripe-billing-reservation-v1',held:true,command:{...body,p_expected_revision:99}});assert.equal((await execute(wrong)).reason,'billing_reservation_invalid');assert.deepEqual(wrong.calls,[]);
 const absent=harness();delete absent.adapters.withBillingReservation;assert.equal((await execute(absent)).reason,'adapter_missing');assert.deepEqual(absent.calls,[]);
});
