#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const SQL_PATH = "supabase/controlled/20260922213000_account_deletion_workspace_inventory.sql";
// Superseded pre-review checksum retained as a historical regression marker:
// 0138a2a8484b526f8064abb45f6f0026174c38717e3bf04fc484f9dcb3a2624c
const EXPECTED_SHA256 = "cae7d0a6d59c1185dd751f8e28bb1f026bb1f2022bff6006994cbf33ea131a6b";

const sql = await readFile(SQL_PATH, "utf8");
const hash = createHash("sha256").update(sql).digest("hex");
if (hash !== EXPECTED_SHA256) throw new Error("account_deletion_workspace_inventory_checksum_mismatch");

for (const pattern of [
  /alter table public\.account_deletion_requests[\s\S]*add column if not exists owned_workspace_ids uuid\[\]/u,
  /cardinality\(owned_workspace_ids\) <= 100/u,
  /array_position\(owned_workspace_ids, null\) is null/u,
  /create or replace function public\.begin_account_deletion_processing/u,
  /if v_request\.status = 'processing'[\s\S]*v_request\.owned_workspace_ids is null[\s\S]*owned_workspace_ids := v_request\.owned_workspace_ids[\s\S]*return next/u,
  /lock table public\.workspaces in share mode/u,
  /lock table public\.workspace_members in share mode/u,
  /array_agg\(w\.id order by w\.id\)/u,
  /if v_requires_ownership_transfer or v_requires_subscription_resolution then[\s\S]*status = 'blocked'[\s\S]*requires_ownership_transfer = v_requires_ownership_transfer[\s\S]*requires_subscription_resolution = v_requires_subscription_resolution[\s\S]*return next/u,
  /status = 'processing'[\s\S]*owned_workspace_ids = v_owned_workspace_ids/u,
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
