import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm,readdir,readFile,writeFile,chmod,symlink} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createDurableStagingBillingAdapters as create} from "../scripts/operations/staging-billing-attempt-journal.mjs";
import {buildStripeBillingReconciliation as build,recoverStripeBillingReconciliation as recover} from "../src/lib/stripeBillingReconciliation.mjs";
const target={stagingRef:"s".repeat(20),productionRef:"p".repeat(20)};
const environment={FANMIND_RUNTIME_ENVIRONMENT:"staging",NEXT_PUBLIC_APP_URL:"https://staging.fanmind.ch",NEXT_PUBLIC_SUPABASE_URL:`https://${target.stagingRef}.supabase.co`,FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:target.productionRef,FANMIND_ENABLE_NON_PRODUCTION_WRITES:"true",FANMIND_NON_PRODUCTION_WRITE_ACK:"I_UNDERSTAND_NON_PRODUCTION_ONLY",FANMIND_STAGING_BILLING_RECONCILIATION_ENABLED:"true",SUPABASE_SERVICE_ROLE_KEY:"synthetic-private-key"};
const input=()=>({workspaceId:"11111111-1111-4111-8111-111111111111",stream:"lifecycle",requestId:"req_journal",observedAt:"2026-09-06T12:00:00.000Z",providerSnapshotFingerprint:"a".repeat(64),expectedRevision:0,customerId:"cus_owner",subscriptionId:"sub_base",projection:{billing_status:"active",workspace_access_mode:"active",billing_suspended_at:null,billing_suspended_reason:null},resolvedEventIds:["evt_one"],objectBindings:[{type:"customer",id:"cus_owner"},{type:"subscription",id:"sub_base"}]});
const receipt=(b,component)=>({component,status:"reconciled",workspaceId:b.p_workspace_id,requestId:b.p_stripe_request_id,snapshotFingerprint:b.p_snapshot_fingerprint,providerSnapshotFingerprint:b.providerSnapshotFingerprint});
async function fixture(fn){const directory=await mkdtemp(join(tmpdir(),"canonical-journal-"));try{await fn(directory);}finally{await rm(directory,{recursive:true,force:true});}}
function options(directory,fetchImplementation){return {directory,environment,reviewedTarget:target,reconcileAi:async b=>receipt(b,"ai"),reconcileReferral:async b=>receipt(b,"referral"),fetchImplementation};}
async function prepare(adapters,body){await adapters.reconcileAi(body,{});await adapters.reconcileReferral(body,{});}

test("both receipts and durable exact command precede the first Billing request",()=>fixture(async directory=>{
 const body=build(input());let calls=0;const adapters=await create(options(directory,async()=>{calls++;const files=await readdir(directory);assert.equal(files.length,1);const saved=JSON.parse(await readFile(join(directory,files[0]),"utf8"));assert.deepEqual(saved.command,body);assert.equal(saved.phase,"billing_attempted");assert.equal(saved.aiReceipt.component,"ai");assert.equal(saved.referralReceipt.component,"referral");assert.ok(!JSON.stringify(saved).includes("synthetic-private-key"));return {ok:true,json:async()=>[{result_status:"reconciled",result_revision:1}]};}));
 await assert.rejects(adapters.commitBilling(body),/canonical_attempt_storage_invalid/u);assert.equal(calls,0);assert.deepEqual(await readdir(directory),[]);
 await prepare(adapters,body);await adapters.commitBilling(body);assert.equal(calls,1);
}));
test("lost response survives a fresh adapter and exact delayed recovery without rerunning downstream",()=>fixture(async directory=>{
 const body=build(input());const first=await create(options(directory,async()=>{throw Error("private network body");}));await prepare(first,body);await assert.rejects(first.commitBilling(body),/canonical_attempt_storage_invalid/u);
 let downstream=0;const second=await create({...options(directory,async()=>({ok:true,json:async()=>[{result_status:"duplicate_reconciliation",result_revision:1}]})),reconcileAi:async()=>{downstream++;},reconcileReferral:async()=>{downstream++;}});
 assert.deepEqual(await recover({input:input(),adapters:second,environment,reviewedTarget:target}),{status:"duplicate_reconciliation",revision:1});assert.equal(downstream,0);
 const changed=build({...input(),expectedRevision:1});await assert.rejects(second.loadPersistedBillingAttempt(changed),/canonical_attempt_storage_invalid/u);
}));
test("unsafe directories, record permissions and incomplete records never reach Billing",()=>fixture(async directory=>{
 let calls=0;await chmod(directory,0o755);await assert.rejects(create(options(directory,async()=>{calls++;})));await chmod(directory,0o700);
 const body=build(input());const adapters=await create(options(directory,async()=>{calls++;return {ok:true,json:async()=>[{result_status:"reconciled",result_revision:1}]};}));await prepare(adapters,body);await adapters.commitBilling(body);calls=0;
 const path=join(directory,(await readdir(directory))[0]);await chmod(path,0o644);await assert.rejects(adapters.commitBilling(body));await chmod(path,0o600);await writeFile(path,"{incomplete");await assert.rejects(adapters.commitBilling(body));assert.equal(calls,0);
 await rm(path);await symlink("/etc/passwd",path);await assert.rejects(adapters.commitBilling(body));assert.equal(calls,0);
}));

test("journal target is immutable after construction and Production never opens storage",()=>fixture(async directory=>{
 await assert.rejects(create({...options(directory,async()=>{throw Error("unexpected");}),environment:{...environment,FANMIND_RUNTIME_ENVIRONMENT:"production"}}),/canonical_attempt_storage_invalid/u);assert.deepEqual(await readdir(directory),[]);
 const mutable={...target};const body=build(input());const adapters=await create({...options(directory,async url=>{assert.ok(url.includes(target.stagingRef));return {ok:true,json:async()=>[{result_status:"reconciled",result_revision:1}]};}),reviewedTarget:mutable});mutable.stagingRef="x".repeat(20);await prepare(adapters,body);await adapters.commitBilling(body);assert.equal((await adapters.loadPersistedBillingAttempt(body)).targetRef,target.stagingRef);
}));
