import test from 'node:test';
import assert from 'node:assert/strict';
import {readCanonicalStripeBillingSnapshot as read, prepareCanonicalStripeBillingCommand as prepare} from '../src/lib/stripeBillingCanonicalSnapshot.mjs';
const target={workspaceId:'11111111-1111-4111-8111-111111111111',customerId:'cus_owner',subscriptionId:'sub_base',basePriceId:'price_base',aiPriceIds:['price_plus','price_ultra']};
const subscription=()=>({id:'sub_base',object:'subscription',created:1788624000,customer:'cus_owner',livemode:false,status:'active',metadata:{workspace_id:target.workspaceId},pending_update:null,pause_collection:null,cancel_at:null,canceled_at:null,ended_at:null,cancel_at_period_end:false,items:{object:'list',has_more:false,data:[{id:'si_base',subscription:'sub_base',quantity:1,current_period_start:1788624000,current_period_end:1791216000,price:{id:'price_base',object:'price',livemode:false}}]},latest_invoice:{object:'invoice',id:'in_paid',customer:'cus_owner',livemode:false,status:'paid',amount_remaining:0,amount_due:31200,amount_paid:31200,created:1788624000,attempt_count:1,next_payment_attempt:null,hosted_invoice_url:null,invoice_pdf:null,status_transitions:{paid_at:1788624000},parent:{subscription_details:{subscription:'sub_base'}}},lastResponse:{requestId:'req_snapshot'}});
function harness(){const calls=[];const h={target,testSecretKey:'sk_test_fixture',clock:()=>Date.parse('2026-09-06T16:00:00Z'),calls,stripe:{subscriptions:{retrieve:async(id,args)=>{calls.push(['retrieve',id,args]);return subscription();},list:async args=>{calls.push(['list',args]);return {object:'list',has_more:false,data:[subscription()]};}}}};return h;}
test('reads exact subscription and complete all-status inventory without returning raw customer data',async()=>{const h=harness();h.stripe.subscriptions.retrieve=async()=>({...subscription(),description:'PRIVATE',customer_email:'PRIVATE'});const r=await read(h);assert.equal(r.status,'read');assert.equal(r.snapshot.requestId,'req_snapshot');assert.ok(!JSON.stringify(r).includes('PRIVATE'));assert.equal(h.calls[0][1].status,'all');assert.match(r.fingerprint,/^[a-f0-9]{64}$/);});
test('live keys fail before provider access and live responses cannot become snapshots',async()=>{const h=harness();assert.equal((await read({...h,testSecretKey:'sk_live_no'})).reason,'target_invalid');assert.deepEqual(h.calls,[]);h.stripe.subscriptions.retrieve=async()=>({...subscription(),livemode:true});assert.equal((await read(h)).reason,'subscription_unresolved');});
test('binding, pending updates, partial items and unpaid invoices fail closed',async()=>{
 for(const patch of [{customer:'cus_other'},{metadata:{workspace_id:'other'}},{metadata:{}},{pending_update:{}},{pause_collection:{}},{status:'trialing'},{items:{...subscription().items,has_more:true}},{latest_invoice:{...subscription().latest_invoice,status:'open'}},{latest_invoice:'in_not_expanded'}]){const h=harness();h.stripe.subscriptions.retrieve=async()=>({...subscription(),...patch});assert.equal((await read(h)).status,'blocked');}
});
test('unknown price and quantities cannot silently change the commercial contract',async()=>{for(const patch of [{quantity:2},{price:{id:'price_other',object:'price',livemode:false}}]){const h=harness();h.stripe.subscriptions.retrieve=async()=>({...subscription(),items:{...subscription().items,data:[{...subscription().items.data[0],...patch}]}});assert.equal((await read(h)).reason,'items_unresolved');}});
test('second-page competing active subscription blocks reconciliation',async()=>{const h=harness();let pages=0;h.stripe.subscriptions.list=async args=>{pages++;if(pages===1)return {object:'list',has_more:true,data:[subscription()]};assert.equal(args.starting_after,'sub_base');return {object:'list',has_more:false,data:[{...subscription(),id:'sub_competing'}]};};assert.equal((await read(h)).reason,'inventory_unresolved');assert.equal(pages,2);});
test('pagination loops and missing expected subscription are not accepted',async()=>{for(const empty of [false,true]){const h=harness();h.stripe.subscriptions.list=async()=>({object:'list',has_more:!empty,data:empty?[]:[subscription()]});assert.equal((await read(h)).reason,'inventory_unresolved');}});
test('snapshot change between reads requires a fresh reconciliation',async()=>{const h=harness();let reads=0;h.stripe.subscriptions.retrieve=async()=>({...subscription(),cancel_at_period_end:++reads===2});assert.equal((await read(h)).reason,'snapshot_changed');});
test('missing provider request ID and excessive elapsed time cannot produce proof',async()=>{const h=harness();h.stripe.subscriptions.retrieve=async()=>({...subscription(),lastResponse:{}});assert.equal((await read(h)).reason,'provider_receipt_missing');const g=harness();let clocks=0;g.clock=()=>1000000+60001*clocks++;assert.equal((await read(g)).reason,'snapshot_expired');});
test('provider error details are discarded and no automatic retries occur',async()=>{const h=harness();let reads=0;h.stripe.subscriptions.retrieve=async()=>{reads++;throw Error('SECRET customer payload');};assert.deepEqual(await read(h),{status:'blocked',reason:'provider_unavailable'});assert.equal(reads,1);});


const ledger=()=>({workspaceId:target.workspaceId,customerId:target.customerId,subscriptionId:target.subscriptionId,revision:3,protectedWorkspace:false,lastEventCreatedAt:1788623999,pendingEvents:[{id:'evt_old',type:'invoice.paid',createdAt:1788623999}],objectBindings:[]});
test('provider observation becomes a revision-bound command without using stale event projection',async()=>{
 const h=harness();const observation=await read(h);const p=prepare({observation,ledger:ledger(),basePriceId:target.basePriceId,now:h.clock()});
 assert.equal(p.status,'prepared');assert.equal(p.input.projection.billing_status,'active');assert.equal(p.input.expectedRevision,3);assert.equal(p.input.providerSnapshotFingerprint,observation.fingerprint);
 assert.deepEqual(p.input.resolvedEventIds,['evt_old']);
});
test('current canceled subscription overrides an older paid event',async()=>{
 const h=harness();h.stripe.subscriptions.retrieve=async()=>({...subscription(),status:'canceled'});
 h.stripe.subscriptions.list=async()=>({object:'list',has_more:false,data:[{...subscription(),status:'canceled'}]});
 const observation=await read(h);const p=prepare({observation,ledger:ledger(),basePriceId:target.basePriceId,now:h.clock()});
 assert.equal(p.status,'prepared');assert.equal(p.input.projection.billing_status,'cancelled');assert.equal(p.input.projection.workspace_access_mode,'archived_readonly');
});
test('reversals, same-second events, protected workspaces and another customer block preparation',async()=>{
 const h=harness();const observation=await read(h);
 for(const patch of [{protectedWorkspace:true},{customerId:'cus_other'},{pendingEvents:[{id:'evt_refund',type:'charge.refunded',createdAt:1}]},{lastEventCreatedAt:Math.floor(h.clock()/1000)}]) assert.equal(prepare({observation,ledger:{...ledger(),...patch},basePriceId:target.basePriceId,now:h.clock()}).status,'blocked');
 observation.snapshot.status='canceled';assert.equal(prepare({observation,ledger:ledger(),basePriceId:target.basePriceId,now:h.clock()}).reason,'ledger_unresolved');
});


test('canonical cancellation reset and current invoice values replace stale workspace fields',async()=>{
 const h=harness();const observation=await read(h);const r=prepare({observation,ledger:ledger(),basePriceId:target.basePriceId,now:h.clock()});
 assert.equal(r.input.projection.subscription_effective_end_at,null);assert.equal(r.input.projection.subscription_cancel_requested_at,null);
 assert.equal(r.input.projection.last_invoice_id,'in_paid');assert.equal(r.input.projection.last_invoice_amount_paid_cents,31200);
 assert.equal(prepare({observation,ledger:ledger(),basePriceId:'price_plus',now:h.clock()}).reason,'ledger_unresolved');
});
test('past-due and unpaid respect retry/grace policy before suspension',async()=>{
 for(const [status,attempts,expected] of [['past_due',1,'past_due'],['unpaid',2,'payment_failed'],['past_due',3,'suspended']]){
 const h=harness();h.stripe.subscriptions.retrieve=async()=>({...subscription(),status,latest_invoice:{...subscription().latest_invoice,status:'open',amount_paid:0,amount_remaining:31200,attempt_count:attempts}});
 const observation=await read(h);const r=prepare({observation,ledger:ledger(),basePriceId:target.basePriceId,now:h.clock()});
 assert.equal(r.status,'prepared');assert.equal(r.input.projection.billing_status,expected);assert.equal(r.input.projection.workspace_access_mode,expected==='suspended'?'archived_readonly':'active');assert.ok(r.input.projection.billing_grace_until);
 }
});

test('historical canceled and expired subscriptions block until rotation bindings are implemented',async()=>{
 for(const status of ['canceled','incomplete_expired']){const h=harness();h.stripe.subscriptions.list=async()=>({object:'list',has_more:false,data:[subscription(),{...subscription(),id:'sub_historical',status}]});assert.equal((await read(h)).reason,'inventory_unresolved');}
});

test('provider subscription creation remains the contract start after delayed reconciliation',async()=>{
 const h=harness();const observation=await read(h);const result=prepare({observation,ledger:ledger(),basePriceId:target.basePriceId,now:h.clock()});
 assert.equal(result.input.projection.billing_contract_started_at,new Date(subscription().created*1000).toISOString());
});

test('paid latest invoices cannot justify a delinquent canonical snapshot',async()=>{
 for(const status of ['past_due','unpaid']){const h=harness();h.stripe.subscriptions.retrieve=async()=>({...subscription(),status});assert.equal((await read(h)).reason,'invoice_unresolved');}
});

test('workspace UUID is canonicalized before snapshot and command comparison',async()=>{
 const uppercaseWorkspace='AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE';
 const h=harness();h.target={...target,workspaceId:uppercaseWorkspace};
 const providerSubscription=()=>({...subscription(),metadata:{workspace_id:uppercaseWorkspace}});
 h.stripe.subscriptions.retrieve=async()=>providerSubscription();
 h.stripe.subscriptions.list=async()=>({object:'list',has_more:false,data:[providerSubscription()]});
 const observation=await read(h);assert.equal(observation.status,'read');assert.equal(observation.snapshot.workspaceId,uppercaseWorkspace.toLowerCase());
 const result=prepare({observation,ledger:{...ledger(),workspaceId:uppercaseWorkspace.toLowerCase()},basePriceId:target.basePriceId,now:h.clock()});
 assert.equal(result.status,'prepared');assert.equal(result.input.workspaceId,uppercaseWorkspace.toLowerCase());
});

test('terminal subscription without latest invoice omits all last_invoice projection fields',async()=>{
 const h=harness();const terminal=()=>({...subscription(),status:'canceled',latest_invoice:null});
 h.stripe.subscriptions.retrieve=async()=>terminal();
 h.stripe.subscriptions.list=async()=>({object:'list',has_more:false,data:[terminal()]});
 const observation=await read(h);assert.equal(observation.status,'read');
 const result=prepare({observation,ledger:ledger(),basePriceId:target.basePriceId,now:h.clock()});
 assert.equal(result.status,'prepared');assert.deepEqual(Object.keys(result.input.projection).filter(key=>key.startsWith('last_invoice_')),[]);
});
