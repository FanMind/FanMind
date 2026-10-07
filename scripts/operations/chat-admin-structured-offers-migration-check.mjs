import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const path="supabase/controlled/20261007190000_chat_admin_structured_offers.sql";
const source=await readFile(new URL(`../../${path}`,import.meta.url),"utf8");
const digest=createHash("sha256").update(source).digest("hex");
if(process.argv.length!==2)throw new Error("chat_admin_structured_offers_check_is_offline_only");
for(const required of ["CONTROLLED / UNAPPLIED","add column sales_playbook jsonb","chat_characters_sales_playbook_object","creator_sales_playbooks.rules","commit;"]){
 if(!source.includes(required))throw new Error(`chat_admin_structured_offers_contract_missing:${required}`);
}
console.log(`CHAT_ADMIN_STRUCTURED_OFFERS_MIGRATION_CHECK=passed sha256=${digest}`);
