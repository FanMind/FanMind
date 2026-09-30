import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const baseSql = fs.readFileSync("supabase/controlled/ai_capacity_billing_v2.sql", "utf8");
const gateSql = fs.readFileSync("supabase/controlled/ai_capacity_billing_v2_activation_gates.sql", "utf8");
const adminAdapter = fs.readFileSync("src/lib/aiCapacityAdmin.ts", "utf8");
const adminRoute = fs.readFileSync("src/app/api/admin/settings/ai-capacity/route.ts", "utf8");
const adminPage = fs.readFileSync("src/app/admin/settings/page.tsx", "utf8");

test("capacity persistence source is default-off and browser inaccessible", () => {
  assert.match(baseSql, /global_capacity_enabled boolean not null default false/u);
  assert.match(baseSql, /emergency_spend_freeze boolean not null default true/u);
  assert.match(baseSql, /revoke all on table public\.ai_capacity_admin_policy from public, anon, authenticated/u);
  assert.match(baseSql, /grant select on table public\.ai_capacity_admin_policy to service_role/u);
});

test("capacity ledger persistence is append-only and tenant keyed", () => {
  assert.match(baseSql, /create table if not exists public\.ai_capacity_grants/u);
  assert.match(baseSql, /create table if not exists public\.ai_capacity_reservations/u);
  assert.match(baseSql, /create table if not exists public\.ai_capacity_ledger_events/u);
  assert.match(baseSql, /unique \(workspace_id, generation_key\)/u);
  assert.match(baseSql, /before update or delete on public\.ai_capacity_ledger_events/u);
  assert.match(baseSql, /revoke all on table public\.ai_capacity_ledger_events from public, anon, authenticated/u);
});

test("protected activation gates remain default-off", () => {
  assert.match(gateSql, /runtime_activation_ready boolean not null default false/u);
  assert.match(gateSql, /package_sales_activation_ready boolean not null default false/u);
  assert.match(gateSql, /top_up_activation_ready boolean not null default false/u);
  assert.match(gateSql, /ai_capacity_runtime_activation_not_ready/u);
  assert.match(gateSql, /ai_capacity_package_sales_activation_not_ready/u);
  assert.match(gateSql, /ai_capacity_top_up_activation_not_ready/u);
  assert.match(gateSql, /ai_capacity_budget_approval_required/u);
});

test("Platform Admin controls are server-owned and schema-gated", () => {
  assert.match(adminAdapter, /SUPABASE_SERVICE_ROLE_KEY/u);
  assert.match(adminAdapter, /admin_get_ai_capacity_policy/u);
  assert.match(adminAdapter, /admin_update_ai_capacity_policy/u);
  assert.match(adminAdapter, /schema_not_installed/u);
  assert.match(adminRoute, /isTrustedFanMindMutationRequest/u);
  assert.match(adminRoute, /requirePlatformAdmin/u);
  assert.match(adminPage, /getAiCapacityAdminState/u);
  assert.match(adminPage, /AI Capacity v2/u);
  assert.match(adminPage, /disabled=\{!aiCapacity\.installed\}/u);
});
