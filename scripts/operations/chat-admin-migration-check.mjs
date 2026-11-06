import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
const path="supabase/controlled/20260920230000_chat_admin_multi_character.sql";
const source=await readFile(new URL(`../../${path}`,import.meta.url),"utf8");
const digest=createHash("sha256").update(source).digest("hex");
if(process.argv.length!==2) throw new Error("chat_admin_check_is_offline_only");
for(const required of ["one_chat_admin_workspace_global","public_age between 18 and 99","is_current_chat_admin_workspace","enable row level security","CONTROLLED / UNAPPLIED"]){if(!source.includes(required)) throw new Error(`chat_admin_contract_missing:${required}`)}
console.log(`CHAT_ADMIN_MIGRATION_CHECK=passed sha256=${digest}`);
