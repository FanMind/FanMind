#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const SQL_PATH = "supabase/controlled/20260922213000_account_deletion_workspace_inventory.sql";
// Superseded pre-review checksum retained as a historical regression marker:
// 0138a2a8484b526f8064abb45f6f0026174c38717e3bf04fc484f9dcb3a2624c
const EXPECTED_SHA256 = "498f6fc91c46023fe0d38b38e05c8db452f41aca0f9939ff8a86b9a334e7add9";

const sql = await readFile(SQL_PATH, "utf8");
const hash = createHash("sha256").update(sql).digest("hex");
if (hash !== EXPECTED_SHA256) throw new Error("account_deletion_workspace_inventory_checksum_mismatch");

for (const pattern of [
  /alter table public\.account_deletion_requests[\s\S]*add column if not exists owned_workspace_ids uuid\[\]/u,
  /cardinality\(owned_workspace_ids\) <= 100/u,
  /array_position\(owned_workspace_ids, null\) is null/u,
  /create or replace function public\.guard_processing_account_deletion_workspace_ownership/u,
  /where r\.user_id = new\.owner_user_id[\s\S]*r\.status = 'processing'/u,
  /old\.owner_user_id is distinct from new\.owner_user_id[\s\S]*r\.user_id in \(old\.owner_user_id, new\.owner_user_id\)/u,
  /create trigger guard_processing_account_deletion_workspace_ownership[\s\S]*before insert or update of owner_user_id on public\.workspaces/u,
  /create or replace function public\.begin_account_deletion_processing/u,
  /select r\.\*[\s\S]*from public\.account_deletion_requests r[\s\S]*r\.status in \('pending', 'blocked', 'processing'\)/u,
  /if v_request\.status = 'processing'[\s\S]*v_request\.owned_workspace_ids is null[\s\S]*lock table public\.workspaces in share mode[\s\S]*v_owned_workspace_ids is distinct from v_request\.owned_workspace_ids[\s\S]*message = 'workspace_inventory_drift'[\s\S]*owned_workspace_ids := v_request\.owned_workspace_ids[\s\S]*return next/u,
  /lock table public\.workspaces in share mode/u,
  /lock table public\.workspace_members in share mode/u,
  /array_agg\(w\.id order by w\.id\)/u,
  /if v_requires_ownership_transfer or v_requires_subscription_resolution then[\s\S]*status = 'blocked'[\s\S]*requires_ownership_transfer = v_requires_ownership_transfer[\s\S]*requires_subscription_resolution = v_requires_subscription_resolution[\s\S]*return next/u,
  /status = 'processing'[\s\S]*owned_workspace_ids = v_owned_workspace_ids/u,
  /revoke all on function public\.guard_processing_account_deletion_workspace_ownership\(\)[\s\S]*from public, anon, authenticated/u,
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
// This checker is intentionally offline and never applies the controlled SQL.
