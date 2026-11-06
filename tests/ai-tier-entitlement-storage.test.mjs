import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeWorkspaceAiTierStorageRows,
} from "../src/lib/workspaceAiTierStorage.mjs";

const migrationPath =
  "supabase/migrations/20260727090000_workspace_ai_tier_entitlements.sql";
const loaderPath = "src/lib/workspaceAiTierEntitlements.ts";
const migrationRunnerPath =
  "scripts/operations/ai-tier-entitlement-migration-runner.mjs";
const workspaceId = "11111111-1111-4111-8111-111111111111";

function validRow(overrides = {}) {
  return {
    workspace_id: workspaceId,
    tier_id: "plus",
    status: "active",
    source: "stripe",
    stripe_subscription_id: "sub_DO_NOT_PRINT",
    stripe_subscription_item_id: "si_DO_NOT_PRINT",
    stripe_price_id: "price_DO_NOT_PRINT",
    effective_at: "2026-07-01T00:00:00.000Z",
    expires_at: "2026-08-01T00:00:00.000Z",
    last_stripe_event_id: "evt_DO_NOT_PRINT",
    last_stripe_event_created_at: 1_753_056_000,
    stripe_sync_state: "in_sync",
    stripe_sync_revision: 1,
    ...overrides,
  };
}

test("storage row is reduced to the redacted resolver contract", () => {
  const result = normalizeWorkspaceAiTierStorageRows(
    [validRow()],
    workspaceId,
  );

  assert.deepEqual(result, {
    status: "found",
    reason: null,
    entitlement: {
      tierId: "plus",
      status: "active",
      source: "stripe",
      effectiveAt: "2026-07-01T00:00:00.000Z",
      expiresAt: "2026-08-01T00:00:00.000Z",
      stripeSubscriptionItemLinked: true,
      serverOwned: true,
    },
  });
  assert.doesNotMatch(JSON.stringify(result), /DO_NOT_PRINT/u);
});

test("missing row means Standard while ambiguous or corrupt state is unavailable", () => {
  assert.deepEqual(normalizeWorkspaceAiTierStorageRows([], workspaceId), {
    status: "not_found",
    reason: null,
    entitlement: null,
  });

  for (const [payload, reason] of [
    [null, "invalid_payload"],
    [[validRow(), validRow()], "ambiguous_rows"],
    [[validRow({ workspace_id: "22222222-2222-4222-8222-222222222222" })], "invalid_row"],
    [[validRow({ tier_id: "standard" })], "invalid_row"],
    [[validRow({ status: "unknown" })], "invalid_row"],
    [[validRow({ stripe_sync_state: "reconciliation_needed" })], "invalid_row"],
    [[validRow({ stripe_sync_revision: 0 })], "invalid_row"],
    [[validRow({ source: "client" })], "invalid_row"],
    [[validRow({ stripe_subscription_item_id: "" })], "invalid_row"],
    [[validRow({ expires_at: "2026-06-01T00:00:00.000Z" })], "invalid_row"],
  ]) {
    assert.deepEqual(
      normalizeWorkspaceAiTierStorageRows(payload, workspaceId),
      {
        status: "unavailable",
        reason,
        entitlement: null,
      },
    );
  }
});

test("migration creates a service-role-only Stripe entitlement boundary", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(
    migration,
    /create table public\.workspace_ai_tier_entitlements/u,
  );
  assert.match(
    migration,
    /tier_id in \('plus', 'ultra'\)/u,
  );
  assert.match(
    migration,
    /status in \('active', 'pending', 'paused', 'canceled', 'expired'\)/u,
  );
  assert.match(
    migration,
    /source = 'stripe'/u,
  );
  assert.match(
    migration,
    /enable row level security;[\s\S]*force row level security;/u,
  );
  assert.match(
    migration,
    /revoke all on table public\.workspace_ai_tier_entitlements[\s\S]*from public, anon, authenticated/u,
  );
  assert.match(
    migration,
    /revoke select \(%1\$s\), insert \(%1\$s\), update \(%1\$s\), references \(%1\$s\)[\s\S]*from public, anon, authenticated/u,
  );
  assert.match(
    migration,
    /grant select, insert, update, delete[\s\S]*to service_role/u,
  );
  assert.match(
    migration,
    /workspace_ai_tier_entitlement_policy_boundary_failed/u,
  );
  assert.doesNotMatch(
    migration,
    /create policy[\s\S]*to authenticated/u,
  );
  assert.doesNotMatch(
    migration,
    /grant (?:select|insert|update|delete)[\s\S]*to (?:public|anon|authenticated)/u,
  );
});

test("base entitlement postflight distinguishes exact pre-ledger, post-ledger and partial ACL states", async () => {
  const runner = await readFile(migrationRunnerPath, "utf8");
  assert.match(
    runner,
    /ledger_object_count = 0 and ledger_function_count = 0[\s\S]*pre_ledger/u,
  );
  assert.match(
    runner,
    /ledger_object_count = 6 and ledger_function_count = 2[\s\S]*post_ledger/u,
  );
  assert.match(runner, /raise exception 'ledger_state_partial'/u);
  assert.match(
    runner,
    /ledger_state = 'pre_ledger'[\s\S]*not has_table_privilege\('service_role', entitlements_table, 'INSERT'\)[\s\S]*UPDATE[\s\S]*DELETE/u,
  );
  assert.match(
    runner,
    /ledger_state = 'post_ledger'[\s\S]*has_table_privilege\([\s\S]*'INSERT,UPDATE,DELETE'/u,
  );
  assert.match(
    runner,
    /ledger_state = 'post_ledger'[\s\S]*has_column_privilege\([\s\S]*'service_role'[\s\S]*'INSERT,UPDATE,REFERENCES'/u,
  );
  assert.match(runner, /stripe_sync_state[\s\S]*reconciliation_needed[\s\S]*::text/u);
  assert.match(runner, /stripe_sync_revision[\s\S]*pg_get_expr[\s\S]*= '0'/u);
  assert.match(
    runner,
    /case when ledger_state = 'post_ledger' then 12 else 10 end/u,
  );
});

test("server loader queries at most two rows and fails closed to Standard", async () => {
  const loader = await readFile(loaderPath, "utf8");

  assert.match(loader, /import "server-only";/u);
  assert.match(loader, /SUPABASE_SERVICE_ROLE_KEY/u);
  assert.match(loader, /workspace_ai_tier_entitlements/u);
  assert.match(loader, /url\.searchParams\.set\("limit", "2"\)/u);
  assert.match(loader, /cache: "no-store"/u);
  assert.match(loader, /AbortSignal\.timeout\(12_000\)/u);
  assert.match(loader, /resolveWorkspaceAiTierEntitlement\(\)/u);
  assert.match(loader, /normalizeWorkspaceAiTierStorageRows/u);
  assert.doesNotMatch(loader, /console\.(?:log|warn|error)/u);
});
