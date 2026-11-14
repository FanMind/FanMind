import {canonicalizeStripeBillingReconciliationCommand} from './stripeBillingReconciliation.mjs';
import {createHash} from 'node:crypto';
// Consumes an existing canonical command, never browser input or a new billing event.
// The DB rechecks its completed receipt/current stream and private Price allowlist atomically.
export function capacityEntitlementCommand({observation,command,expectedRevision}) {
 const hash=s=>createHash('sha256').update(s).digest('hex');
 const c=canonicalizeStripeBillingReconciliationCommand(command);
 const snapshot=JSON.stringify(observation?.snapshot);
 if(observation?.status!=='read'||!snapshot||hash(snapshot)!==observation.fingerprint||c.providerSnapshotFingerprint!==observation.fingerprint||c.p_event_stream!=='lifecycle'||!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>=Number.MAX_SAFE_INTEGER)throw Error('capacity_writer_evidence_invalid');
 const body=Object.fromEntries(Object.entries(c).filter(([k])=>k.startsWith('p_')&&k!=='p_snapshot_fingerprint'));
 const envelope=JSON.stringify([body,c.providerSnapshotFingerprint]);
 if(hash(envelope)!==c.p_snapshot_fingerprint)throw Error('capacity_writer_evidence_invalid');
 return Object.freeze({p_snapshot:snapshot,p_envelope:envelope,p_expected_revision:expectedRevision});
}
