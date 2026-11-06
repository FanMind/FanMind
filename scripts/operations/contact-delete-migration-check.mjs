#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const SQL_PATH =
  "supabase/controlled/20260920200000_contact_delete_with_meta_queue.sql";
const EXPECTED_SHA256 =
  "7f1063bcf9a267632f7bfdf6ee6237cd908e04512649f0f29c30ad8a28dbae31";

const sql = await readFile(SQL_PATH, "utf8");
const checksum = createHash("sha256").update(sql).digest("hex");
if (checksum !== EXPECTED_SHA256) throw new Error("contact_delete_sql_checksum_mismatch");

for (const pattern of [
  /auth\.role\(\) is distinct from 'service_role'/u,
  /contact\.id = p_contact_id[\s\S]*contact\.workspace_id = p_workspace_id/u,
  /job\.workspace_id = p_workspace_id[\s\S]*job\.contact_id = p_contact_id/u,
  /status = 'claimed'[\s\S]*lease_until >= now\(\)/u,
  /revoke all on function[\s\S]*from public, anon, authenticated/u,
  /grant execute on function[\s\S]*to service_role/u,
]) {
  if (!pattern.test(sql)) throw new Error("contact_delete_sql_scope_invalid");
}

if (process.argv.some((argument) => argument !== process.argv[0] && argument !== process.argv[1])) {
  throw new Error("contact_delete_check_is_offline_only");
}

console.log("CONTACT_DELETE_MIGRATION_CHECK=passed");
console.log(`CONTACT_DELETE_MIGRATION_SHA256=${checksum}`);

