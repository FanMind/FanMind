import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {
  AI_CAPACITY_PACKAGES,
  DEFAULT_AI_CAPACITY_ADMIN_POLICY,
  normalizeAiCapacityAdminPolicy,
  resolveAiCapacityAdmission,
  resolveAiCapacitySalesAdmission,
} from "../src/lib/aiCapacityPolicy.mjs";

function enabledPolicy(overrides = {}) {
  return {
    ...DEFAULT_AI_CAPACITY_ADMIN_POLICY,
    globalCapacityEnabled: true,
    emergencySpendFreeze: false,
    topUpSalesEnabled: false,
    packageSalesEnabled: {
      ...DEFAULT_AI_CAPACITY_ADMIN_POLICY.packageSalesEnabled,
      capacity_99: true,
    },
    qualityModeEnabled: {
      ...DEFAULT_AI_CAPACITY_ADMIN_POLICY.qualityModeEnabled,
      fast: true,
    },
    includedBudgetEurMicrocents: {
      ...DEFAULT_AI_CAPACITY_ADMIN_POLICY.includedBudgetEurMicrocents,
      capacity_99: 500_000_000,
    },
    ...overrides,
  };
}

test("target package prices and approved included budgets are canonical", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(AI_CAPACITY_PACKAGES).map(([id, value]) => [id, value.monthlyPriceCents])),
    { capacity_99: 9_900, capacity_199: 19_900, capacity_312: 31_200 },
  );
  assert.deepEqual(
    Object.fromEntries(Object.entries(AI_CAPACITY_PACKAGES).map(([id, value]) => [id, value.includedBudgetEurMicrocents])),
    { capacity_99: 1_500_000_000, capacity_199: 3_000_000_000, capacity_312: 5_000_000_000 },
  );
});

test("default admin policy keeps capacity v2 fully fail closed", () => {
  assert.equal(
    resolveAiCapacityAdmission({
      billingContractVersion: "capacity_v2",
      packageId: "capacity_99",
      qualityMode: "fast",
    }).reason,
    "capacity_disabled",
  );
});

test("legacy and unknown billing contracts never enter capacity v2", () => {
  for (const billingContractVersion of ["legacy_v1", "future_v3", null]) {
    const result = resolveAiCapacityAdmission({
      billingContractVersion,
      packageId: "capacity_99",
      qualityMode: "fast",
      adminPolicy: enabledPolicy(),
    });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, billingContractVersion === "legacy_v1" ? "legacy_contract" : "billing_contract_unknown");
  }
});

test("usage switches fail closed independently", () => {
  const base = enabledPolicy();
  assert.equal(resolveAiCapacityAdmission({ billingContractVersion: "capacity_v2", packageId: "missing", qualityMode: "fast", adminPolicy: base }).reason, "package_unknown");
  assert.equal(resolveAiCapacityAdmission({ billingContractVersion: "capacity_v2", packageId: "capacity_99", qualityMode: "missing", adminPolicy: base }).reason, "quality_mode_unknown");
  assert.equal(resolveAiCapacityAdmission({ billingContractVersion: "capacity_v2", packageId: "capacity_99", qualityMode: "fast", adminPolicy: { ...base, emergencySpendFreeze: true } }).reason, "emergency_spend_freeze");
  assert.equal(resolveAiCapacityAdmission({ billingContractVersion: "capacity_v2", packageId: "capacity_99", qualityMode: "fast", adminPolicy: { ...base, qualityModeEnabled: { ...base.qualityModeEnabled, fast: false, balanced: true } } }).reason, "quality_mode_disabled");
  assert.equal(resolveAiCapacityAdmission({ billingContractVersion: "capacity_v2", packageId: "capacity_99", qualityMode: "fast", adminPolicy: { ...base, includedBudgetEurMicrocents: { ...base.includedBudgetEurMicrocents, capacity_99: null } } }).reason, "included_budget_unset");
});

test("new-sales package switch does not cancel already-entitled usage", () => {
  const policy = enabledPolicy({
    packageSalesEnabled: {
      ...DEFAULT_AI_CAPACITY_ADMIN_POLICY.packageSalesEnabled,
      capacity_99: false,
    },
  });
  assert.equal(
    resolveAiCapacityAdmission({
      billingContractVersion: "capacity_v2",
      packageId: "capacity_99",
      qualityMode: "fast",
      adminPolicy: policy,
    }).allowed,
    true,
  );
  assert.equal(
    resolveAiCapacitySalesAdmission({
      billingContractVersion: "capacity_v2",
      packageId: "capacity_99",
      adminPolicy: policy,
    }).reason,
    "package_sales_disabled",
  );
});

test("admission succeeds only with explicit capacity-v2 package, mode and approved budget", () => {
  const result = resolveAiCapacityAdmission({
    billingContractVersion: "capacity_v2",
    packageId: "capacity_99",
    qualityMode: "fast",
    adminPolicy: enabledPolicy({ topUpSalesEnabled: true }),
  });
  assert.deepEqual(result, {
    allowed: true,
    reason: "allowed",
    packageId: "capacity_99",
    qualityMode: "fast",
    monthlyPriceCents: 9_900,
    includedBudgetEurMicrocents: 500_000_000,
    topUpSalesEnabled: true,
  });
});

test("globally enabled policy requires at least one quality mode", () => {
  const invalid = enabledPolicy({
    qualityModeEnabled: { fast: false, balanced: false, premium: false },
  });
  assert.throws(
    () => normalizeAiCapacityAdminPolicy(invalid),
    { name: "TypeError", message: "invalid_ai_capacity_admin_policy" },
  );
});

test("missing budget keys are rejected instead of becoming null", () => {
  const base = enabledPolicy();
  const { capacity_312: omitted, ...partialBudgets } = base.includedBudgetEurMicrocents;
  assert.equal(omitted, 5_000_000_000);
  assert.throws(
    () => normalizeAiCapacityAdminPolicy({
      ...base,
      includedBudgetEurMicrocents: partialBudgets,
    }),
    { name: "TypeError", message: "invalid_ai_capacity_admin_policy" },
  );
});

test("malformed admin policy is rejected and cannot enable capacity", () => {
  assert.throws(
    () => normalizeAiCapacityAdminPolicy({}),
    { name: "TypeError", message: "invalid_ai_capacity_admin_policy" },
  );
  const result = resolveAiCapacityAdmission({
    billingContractVersion: "capacity_v2",
    packageId: "capacity_99",
    qualityMode: "fast",
    adminPolicy: { globalCapacityEnabled: true },
  });
  assert.deepEqual(result, { allowed: false, reason: "admin_policy_invalid" });
});


test("undefined budget values are rejected", () => {
  const base = enabledPolicy();
  assert.throws(
    () => normalizeAiCapacityAdminPolicy({
      ...base,
      includedBudgetEurMicrocents: {
        ...base.includedBudgetEurMicrocents,
        capacity_312: undefined,
      },
    }),
    { name: "TypeError", message: "invalid_ai_capacity_admin_policy" },
  );
});


test("sales admission remains independent from usage freeze switches", () => {
  const base = enabledPolicy();
  for (const policy of [
    { ...base, globalCapacityEnabled: false },
    { ...base, emergencySpendFreeze: true },
  ]) {
    assert.equal(
      resolveAiCapacitySalesAdmission({
        billingContractVersion: "capacity_v2",
        packageId: "capacity_99",
        adminPolicy: policy,
      }).allowed,
      true,
    );
  }
});


test("capacity persistence source is default-off and browser inaccessible", () => {
  const sql = fs.readFileSync("supabase/controlled/ai_capacity_billing_v2.sql", "utf8");
  assert.match(sql, /global_capacity_enabled boolean not null default false/u);
  assert.match(sql, /emergency_spend_freeze boolean not null default true/u);
  assert.match(sql, /revoke all on table public\.ai_capacity_admin_policy from public, anon, authenticated/u);
  assert.match(sql, /grant select on table public\.ai_capacity_admin_policy to service_role/u);
  assert.match(sql, /package_99_budget_eur_microcents bigint default 1500000000/u);
  assert.match(sql, /package_199_budget_eur_microcents bigint default 3000000000/u);
  assert.match(sql, /package_312_budget_eur_microcents bigint default 5000000000/u);
});

test("capacity ledger persistence is append-only and tenant keyed", () => {
  const sql = fs.readFileSync("supabase/controlled/ai_capacity_billing_v2.sql", "utf8");
  assert.match(sql, /create table if not exists public\.ai_capacity_grants/u);
  assert.match(sql, /create table if not exists public\.ai_capacity_reservations/u);
  assert.match(sql, /create table if not exists public\.ai_capacity_ledger_events/u);
  assert.match(sql, /unique \(workspace_id, generation_key\)/u);
  assert.match(sql, /before update or delete on public\.ai_capacity_ledger_events/u);
});

test("protected capacity activation gates remain default-off", () => {
  const sql = fs.readFileSync("supabase/controlled/ai_capacity_billing_v2_activation_gates.sql", "utf8");
  assert.match(sql, /runtime_activation_ready boolean not null default false/u);
  assert.match(sql, /package_sales_activation_ready boolean not null default false/u);
  assert.match(sql, /top_up_activation_ready boolean not null default false/u);
  assert.match(sql, /ai_capacity_runtime_activation_not_ready/u);
  assert.match(sql, /ai_capacity_package_sales_activation_not_ready/u);
  assert.match(sql, /ai_capacity_top_up_activation_not_ready/u);
  assert.match(sql, /ai_capacity_budget_approval_required/u);
});

test("Platform Admin capacity controls are server-owned and schema-gated", () => {
  const adapter = fs.readFileSync("src/lib/aiCapacityAdmin.ts", "utf8");
  const route = fs.readFileSync("src/app/api/admin/settings/ai-capacity/route.ts", "utf8");
  const page = fs.readFileSync("src/app/admin/settings/page.tsx", "utf8");
  assert.match(adapter, /SUPABASE_SERVICE_ROLE_KEY/u);
  assert.match(adapter, /admin_get_ai_capacity_policy/u);
  assert.match(adapter, /admin_update_ai_capacity_policy/u);
  assert.match(adapter, /schema_not_installed/u);
  assert.match(route, /isTrustedFanMindMutationRequest/u);
  assert.match(route, /requirePlatformAdmin/u);
  assert.match(page, /getAiCapacityAdminState/u);
  assert.match(page, /AI Capacity v2/u);
  assert.match(page, /disabled=\{!aiCapacity\.installed\}/u);
});
