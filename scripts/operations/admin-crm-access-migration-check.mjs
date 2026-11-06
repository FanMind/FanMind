#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const ADMIN_CRM_ACCESS_MIGRATION_ID = "20260915221500_admin_crm_access";
export const ADMIN_CRM_ACCESS_MIGRATION_PATH = resolve(
  process.cwd(),
  `supabase/migrations/${ADMIN_CRM_ACCESS_MIGRATION_ID}.sql`,
);
export const EXPECTED_ADMIN_CRM_ACCESS_SHA256 =
  "7d1201fc5b45b571d2944b301eb1f5f197ea4f25ad643c8e8010d9d0ba3c1efd";

function fail(code) {
  throw new Error(`ADMIN_CRM_ACCESS_MIGRATION_ERROR=${code}`);
}

export function evaluateAdminCrmAccessMigration(sql) {
  if (typeof sql !== "string") fail("sql_unreadable");
  const digest = createHash("sha256").update(sql).digest("hex");
  if (digest !== EXPECTED_ADMIN_CRM_ACCESS_SHA256) fail("sql_checksum_mismatch");
  const required = [
    /^begin;/iu,
    /create or replace function public\.admin_crm_read_allowed/u,
    /as restrictive for all to authenticated/u,
    /on public\.workspaces[\s\S]*as restrictive/u,
    /create or replace function public\.current_admin_crm_access_state/u,
    /returns table \([\s\S]*workspace_id uuid[\s\S]*test_access_flags jsonb/u,
    /admin_crm_access_existing_membership/u,
    /create or replace function public\.admin_set_registered_user_crm_access/u,
    /pg_advisory_xact_lock/u,
    /insert into public\.operations_audit_log/u,
    /grant execute[\s\S]*to service_role/u,
    /commit;\s*$/iu,
  ];
  const forbidden = [
    /\btruncate\b/iu,
    /\bdrop\s+(?:table|schema|database)\b/iu,
    /\bcreate\s+extension\b/iu,
    /\b(?:http|net)\.(?:post|get)\b/iu,
  ];
  if (required.some((contract) => !contract.test(sql))) fail("sql_contract_missing");
  if (forbidden.some((contract) => contract.test(sql))) fail("sql_contract_forbidden");
  return Object.freeze({ digest, migrationId: ADMIN_CRM_ACCESS_MIGRATION_ID });
}

export function checkAdminCrmAccessMigration() {
  const result = evaluateAdminCrmAccessMigration(
    readFileSync(ADMIN_CRM_ACCESS_MIGRATION_PATH, "utf8"),
  );
  console.log(`ADMIN_CRM_ACCESS_MIGRATION_ID=${result.migrationId}`);
  console.log(`ADMIN_CRM_ACCESS_SHA256=${result.digest}`);
  console.log("ADMIN_CRM_ACCESS_OFFLINE_CHECK=PASS");
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 2) fail("argument_invalid");
  checkAdminCrmAccessMigration();
}
