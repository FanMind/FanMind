import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const SQL_PATH = "supabase/controlled/20261007190000_chat_admin_structured_offers.sql";
export const SQL_SHA256 = "5f81312e005b9bb3975a66c1c15d3b01b5ec5277ba974273691fcf7c265a67e4";

const source = await readFile(new URL(`../../${SQL_PATH}`, import.meta.url), "utf8");
const digest = createHash("sha256").update(source).digest("hex");
if (process.argv.length !== 2) throw new Error("chat_admin_structured_offers_check_is_offline_only");
if (digest !== SQL_SHA256) throw new Error("chat_admin_structured_offers_checksum_mismatch");
for (const required of [
  "CONTROLLED / UNAPPLIED",
  "add column sales_playbook jsonb",
  "chat_characters_sales_playbook_object",
  "creator_sales_playbooks.rules",
  "commit;",
]) {
  if (!source.includes(required)) throw new Error(`chat_admin_structured_offers_contract_missing:${required}`);
}
console.log(`CHAT_ADMIN_STRUCTURED_OFFERS_MIGRATION_CHECK=passed sha256=${digest}`);
