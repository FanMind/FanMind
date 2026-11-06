import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { canonicalizeStripeBillingReconciliationCommand, createStagingBillingReconciliationCommitter } from "../../src/lib/stripeBillingReconciliation.mjs";

const invalid = () => { throw Error("canonical_attempt_storage_invalid"); };
const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);
const hash = value => createHash("sha256").update(value).digest("hex");
const LIMIT = 131072;
const canonical=canonicalizeStripeBillingReconciliationCommand;
function receipt(value,body,component) {
  if(value?.component!==component || value.status!=="reconciled" || value.workspaceId!==body.p_workspace_id || value.requestId!==body.p_stripe_request_id ||
     value.snapshotFingerprint!==body.p_snapshot_fingerprint || value.providerSnapshotFingerprint!==body.providerSnapshotFingerprint) invalid();
  return {component,status:"reconciled",workspaceId:value.workspaceId,requestId:value.requestId,snapshotFingerprint:value.snapshotFingerprint,providerSnapshotFingerprint:value.providerSnapshotFingerprint};
}

// The caller provisions an owner-only persistent directory on the Staging host.
// No secret key or raw Stripe response is stored. Commit cannot precede fsync.
export async function createDurableStagingBillingAdapters({directory,environment,reviewedTarget,reconcileAi,reconcileReferral,withBillingReservation,fetchImplementation}={}) {
  try {
  const commit=createStagingBillingReconciliationCommitter({environment,reviewedTarget,fetchImplementation});
  if(typeof reconcileAi!=="function" || typeof reconcileReferral!=="function" || !isAbsolute(directory??"") || resolve(directory)!==directory) invalid();
  if(withBillingReservation!==undefined && typeof withBillingReservation!=="function") invalid();
  const targetRef=reviewedTarget.stagingRef;
  const owner=process.geteuid();
  let root;
  async function checkDirectory() {
    const stat=await lstat(directory);
    if(!stat.isDirectory() || stat.isSymbolicLink() || stat.uid!==owner || (stat.mode&0o777)!==0o700 || await realpath(directory)!==directory ||
       (root && (root.dev!==stat.dev || root.ino!==stat.ino))) invalid();
    root ??= stat;
  }
  await checkDirectory();
  const pending=new Map();
  const pathFor=body=>join(directory,`${hash(`${targetRef}:${body.p_stripe_request_id}`)}.json`);
  async function syncDirectory() {
    const dir=await open(directory,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
    try {await dir.sync();} finally {await dir.close();}
  }
  async function load(body) {
    body=canonical(body);await checkDirectory();
    let file;
    try { file=await open(pathFor(body),constants.O_RDONLY|constants.O_NOFOLLOW); }
    catch(error) {if(error.code==="ENOENT") return null;invalid();}
    try {
      const stat=await file.stat();
      if(!stat.isFile() || stat.uid!==owner || stat.nlink!==1 || (stat.mode&0o777)!==0o600 || stat.size<1 || stat.size>LIMIT) invalid();
      const saved=JSON.parse(await file.readFile("utf8"));
      saved.command=canonical(saved.command);
      if(saved.targetRef!==targetRef || saved.phase!=="billing_attempted" || !same(saved.command,body)) invalid();
      if(body.p_event_stream==="lifecycle") {receipt(saved.aiReceipt,body,"ai");receipt(saved.referralReceipt,body,"referral");}
      await file.sync();await syncDirectory();await checkDirectory();return saved;
    } finally {await file.close();}
  }
  async function persist(body) {
    const existing=await load(body);if(existing) return existing;
    const receipts=pending.get(body.p_snapshot_fingerprint);
    const saved={targetRef,phase:"billing_attempted",command:body,
      ...(body.p_event_stream==="lifecycle"?{aiReceipt:receipt(receipts?.ai,body,"ai"),referralReceipt:receipt(receipts?.referral,body,"referral")}:{})};
    const text=JSON.stringify(saved);
    if(Buffer.byteLength(text)>LIMIT) invalid();
    let file;
    try {file=await open(pathFor(body),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);}
    catch(error) {if(error.code==="EEXIST") {const recovered=await load(body);if(recovered)return recovered;}invalid();}
    try {await file.writeFile(text,"utf8");await file.sync();} finally {await file.close();}
    await syncDirectory();await checkDirectory();return saved;
  }
  const safe=fn=>async(...args)=>{try{return await fn(...args);}catch{invalid();}};
  return {
    ...(withBillingReservation?{withBillingReservation}:{}),
    reconcileAi:safe(async(body,snapshot)=>{body=canonical(body);const value=receipt(await reconcileAi(body,snapshot),body,"ai");pending.set(body.p_snapshot_fingerprint,{ai:value});return value;}),
    reconcileReferral:safe(async(body,snapshot)=>{body=canonical(body);const value=receipt(await reconcileReferral(body,snapshot),body,"referral");const prior=pending.get(body.p_snapshot_fingerprint);if(!prior?.ai)invalid();pending.set(body.p_snapshot_fingerprint,{...prior,referral:value});return value;}),
    loadPersistedBillingAttempt:safe(load),
    commitBilling:safe(async body=>{body=canonical(body);await persist(body);pending.delete(body.p_snapshot_fingerprint);return commit(body);}),
  };
  } catch {invalid();}
}
