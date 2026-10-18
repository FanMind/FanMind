// Repository-only admission contract. No host I/O or transport is implemented.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
export const HOST_EVIDENCE_POLICY_SHA256="368e0f65a1a386d05a3273f9861f89a3edca028aaff4142de6f811fa4e50dcde";
const path=new URL("../../docs/operations/staging-host-evidence-policy.json",import.meta.url);
export function loadHostEvidencePolicy(read=()=>readFileSync(path)){
 const bytes=read();
 if(createHash("sha256").update(bytes).digest("hex")!==HOST_EVIDENCE_POLICY_SHA256)throw new Error("policy_checksum");
 return JSON.parse(bytes.toString());
}
