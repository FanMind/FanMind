// Offline checksum check only: no connection, apply, credential or dispatch.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const manifest=JSON.parse(await readFile(new URL("../../docs/operations/chat-admin-current-facts-manifest.json",import.meta.url),"utf8"));
if(manifest.version!==1 || manifest.sql!=="supabase/controlled/chat_admin_current_facts.sql" || manifest.state!=="SOURCE_ONLY_UNAPPLIED" || manifest.runtimeDefault!=="disabled" || manifest.genericDeployApply!==false)throw new Error("current_facts_control_invalid");
const source=await readFile(new URL(`../../${manifest.sql}`,import.meta.url));
if(createHash("sha256").update(source).digest("hex")!==manifest.sha256)throw new Error("current_facts_checksum_invalid");
console.log("CHAT_ADMIN_CURRENT_FACTS_CHECK=verified_unapplied");
