#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const SQL_PATH = "supabase/controlled/20260922213000_account_deletion_workspace_inventory.sql";
const EXPECTED_SHA256 = "0138a2a8484b526f8064abb45f6f0026174c38717e3bf04fc484f9dcb3a2624c";

const sql = await readFile(SQL_PATH, "utf8");
const hash = createHash("sha256").update(sql).digest("hex");
if (hash !== EXPECTED_SHA256) throw new Error("account_deletion_workspace_inventory_checksum_mismatch");

for (const pattern of [
  /alter table public\.account_deletion_requests[\s\S]*add column if not exists owned_workspace_ids uuid\[\]/u,
  /cardinality\(owned_workspace_ids\) <= 100/u,
  /array_position\(owned_workspace_ids, null\) is null/u,
  /create or replace function public\.begin_account_deletion_processing/u,
  /lock table public\.workspaces in share mode/u,
  /lock table public\.workspace_members in share mode/u,
  /array_agg\(w\.id order by w\.id\)/u,
  /owned_workspace_ids = v_owned_workspace_ids/u,
  /revoke all on function public\.begin_account_deletion_processing\(uuid, uuid\)[\s\S]*from public, anon, authenticated/u,
  /grant execute on function public\.begin_account_deletion_processing\(uuid, uuid\)[\s\S]*to service_role/u,
  /atomic destructive-start transition/u,
]) {
  if (!pattern.test(sql)) throw new Error("account_deletion_workspace_inventory_contract_invalid");
}
if (/\bgrant\b[^;]*\bto\s+(?:authenticated|anon|public)\b/isu.test(sql)) {
  throw new Error("account_deletion_workspace_inventory_client_grant_forbidden");
}
console.log("ACCOUNT_DELETION_WORKSPACE_INVENTORY_CHECK=verified");
