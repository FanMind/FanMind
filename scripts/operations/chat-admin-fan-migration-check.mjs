import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const path = "supabase/controlled/20260927200000_chat_admin_character_fans.sql";
const source = await readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const expected = "36990f58521e3986542f5b9b206af93f9fa4a6e6439352b4b11ead7685e4275a";
if (process.argv.length !== 2) throw new Error("chat_admin_fan_check_is_offline_only");
if (createHash("sha256").update(source).digest("hex") !== expected) throw new Error("chat_admin_fan_checksum_mismatch");
for (const required of ["CONTROLLED / UNAPPLIED", "chat_character_fans", "chat_admin_fan_schema_ready", "persist_chat_admin_generation", "persist_chat_admin_confirmed_reply", "enable row level security"]) {
  if (!source.includes(required)) throw new Error(`chat_admin_fan_contract_missing:${required}`);
}
console.log(`CHAT_ADMIN_FAN_MIGRATION_CHECK=passed sha256=${expected}`);
