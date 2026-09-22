#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const SQL_PATH = "supabase/controlled/20260922213000_account_deletion_workspace_inventory.sql";
const EXPECTED_SHA256 = "a37ee42baa5a2e8ec6e0ffe42eecc92142f014319d0a50abc8de32de85bb4202";

const sql = await readFile(SQL_PATH, "utf8");
const hash = createHash("sha256").update(sql).digest("hex");
if (hash !== EXPECTED_SHA256) throw new Error("account_deletion_workspace_inventory_checksum_mismatch");

for (const pattern of [
  /alter table public\.account_deletion_requests[\s\S]*add column if not exists owned_workspace_ids uuid\[\]/u,
  /cardinality\(owned_workspace_ids\) <= 100/u,
  /array_position\(owned_workspace_ids, null\) is null/u,
  /Service-role-only snapshot of Workspace IDs owned immediately before Auth deletion/u,
]) {
  if (!pattern.test(sql)) throw new Error("account_deletion_workspace_inventory_contract_invalid");
}
if (/grant\s+.+authenticated|grant\s+.+anon|grant\s+.+public/iu.test(sql)) {
  throw new Error("account_deletion_workspace_inventory_client_grant_forbidden");
}
console.log("ACCOUNT_DELETION_WORKSPACE_INVENTORY_CHECK=verified");
