import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {planCanonicalBillingAi as plan} from '../src/lib/stripeBillingCanonicalAiPlan.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function fixture(paid=false){
 const snapshot={workspaceId:'11111111-1111-4111-8111-111111111111',customerId:'cus_owner',subscriptionId:'sub_base',requestId:'req_one',observedAt:'2026-09-06T16:00:00.000Z',status:'active',cancelAtPeriodEnd:false,items:[{id:'si_base',priceId:'price_base',start:1788624000,end:1791216000},...(paid?[{id:'si_plus',priceId:'price_plus',start:1788624000,end:1791216000}]:[])]};
 const fingerprint=hash(snapshot);
 return {observation:{status:'read',snapshot,fingerprint},billingCommand:{providerSnapshotFingerprint:fingerprint,p_workspace_id:snapshot.workspaceId,p_customer_id:snapshot.customerId,p_subscription_id:snapshot.subscriptionId,p_stripe_request_id:snapshot.requestId,p_snapshot_observed_at:snapshot.observedAt,p_snapshot_fingerprint:'a'.repeat(64)},inventory:{workspaceId:snapshot.workspaceId,customerId:snapshot.customerId,subscriptionId:snapshot.subscriptionId,current:null,unresolvedEvents:[]},environment:{STRIPE_PRICE_AI_PLUS:'price_plus',STRIPE_PRICE_AI_ULTRA:'price_ultra'}};
}
function current(f,state='in_sync'){return {workspace_id:f.inventory.workspaceId,source:'stripe',stripe_subscription_id:'sub_base',stripe_sync_revision:4,stripe_sync_state:state,last_stripe_event_created_at:1788623999,tier_id:'plus',status:'active',stripe_subscription_item_id:'si_plus',stripe_price_id:'price_plus',effective_at:new Date(1788624000*1000).toISOString(),expires_at:null};}
const conflict={createdAt:1788623999,verifiedAt:'2026-09-06T15:00:00Z'};
test('no paid item and no entitlement stays blocked until the snapshot cutoff can be persisted atomically',()=>{const r=plan(fixture());assert.equal(r.status,'blocked');assert.equal(r.reason,'ai_cutoff_persistence_unavailable');assert.equal(r.rpcBody,undefined);assert.equal(r.stateFingerprint,undefined);});
test('matching in-sync paid state cannot emit success evidence without a durable cutoff',()=>{const f=fixture(true);f.inventory.current=current(f);let r=plan(f);assert.equal(r.status,'blocked');assert.equal(r.reason,'ai_cutoff_persistence_unavailable');assert.equal(r.rpcBody,undefined);assert.equal(r.stateFingerprint,undefined);f.inventory.current.status='paused';r=plan(f);assert.equal(r.reason,'ai_state_requires_reconciliation');});
test('existing conflict produces the existing canonical AI RPC contract',()=>{const f=fixture(true);f.inventory.current=current(f,'reconciliation_needed');f.inventory.unresolvedEvents=[conflict];const r=plan(f);assert.equal(r.status,'reconcile');assert.equal(r.rpcBody.p_expected_revision,4);assert.equal(r.rpcBody.p_tier_id,'plus');assert.equal(r.rpcBody.p_snapshot_fingerprint,f.billingCommand.p_snapshot_fingerprint);assert.ok(!JSON.stringify(r).includes('evt_canonical_policy_only'));});
test('removed paid item uses the canonical no-paid-item path',()=>{const f=fixture();f.inventory.current=current(f,'reconciliation_needed');f.inventory.unresolvedEvents=[conflict];const r=plan(f);assert.equal(r.status,'reconcile');assert.equal(r.rpcBody.p_has_paid_item,false);assert.equal(r.rpcBody.p_tier_id,null);assert.equal(r.rpcBody.p_price_id,null);});
test('initial paid acquisition cannot be synthesized by reconciliation',()=>{const f=fixture(true);f.inventory.unresolvedEvents=[conflict];assert.equal(plan(f).reason,'ai_state_requires_reconciliation');});
test('same-second conflict or later verified event rejects the old snapshot',()=>{for(const event of [{...conflict,createdAt:Math.floor(Date.parse('2026-09-06T16:00:00Z')/1000)},{...conflict,verifiedAt:'2026-09-06T16:00:01Z'}]){const f=fixture();f.inventory.unresolvedEvents=[event];assert.equal(plan(f).reason,'ai_snapshot_too_old');}});
test('snapshot changes, wrong customer and malformed inventory fail closed',()=>{let f=fixture();f.observation.snapshot.status='canceled';assert.equal(plan(f).status,'blocked');f=fixture();f.inventory.customerId='cus_other';assert.equal(plan(f).status,'blocked');f=fixture();delete f.inventory.current;assert.equal(plan(f).status,'blocked');assert.equal(plan().status,'blocked');});

test('rotation preserves the prior binding only with exact unresolved mismatch evidence',()=>{
 const f=fixture(true);f.inventory.current={...current(f,'reconciliation_needed'),stripe_subscription_id:'sub_previous'};
 const evidence={...conflict,reason:'subscription_mismatch',subscriptionId:f.inventory.subscriptionId,workspaceId:f.inventory.workspaceId,customerId:f.inventory.customerId};f.inventory.unresolvedEvents=[evidence];
 const result=plan(f);assert.equal(result.status,'reconcile');assert.equal(result.rpcBody.p_expected_previous_subscription_id,'sub_previous');assert.equal(result.rpcBody.p_subscription_id,'sub_base');
 for(const patch of [{reason:'other'},{subscriptionId:'sub_other'},{customerId:'cus_other'},{workspaceId:'22222222-2222-4222-8222-222222222222'}]){f.inventory.unresolvedEvents=[{...evidence,...patch}];assert.equal(plan(f).reason,'ai_rotation_evidence_missing');}
 f.inventory.unresolvedEvents=[];assert.equal(plan(f).reason,'ai_rotation_evidence_missing');
});
