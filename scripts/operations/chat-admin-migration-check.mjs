import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
const path="supabase/controlled/20260927200000_chat_admin_character_fans.sql";
const source=await readFile(new URL(`../../${path}`,import.meta.url),"utf8");
const digest=createHash("sha256").update(source).digest("hex");
if(process.argv.length!==2) throw new Error("chat_admin_check_is_offline_only");
for(const required of ["chat_character_fans","create_chat_admin_fan","persist_chat_admin_generation","persist_chat_admin_confirmed_reply","chat_admin_fan_schema_ready","CONTROLLED / UNAPPLIED"]){if(!source.includes(required)) throw new Error(`chat_admin_contract_missing:${required}`)}
console.log(`CHAT_ADMIN_MIGRATION_CHECK=passed sha256=${digest}`);
