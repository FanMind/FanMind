import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  adminCrmAccessLabel,
  resolveAdminCrmAccessTransition,
} from "../src/lib/adminCrmAccessPolicy.mjs";

const now = new Date("2026-09-15T20:00:00.000Z");

test("permanent free CRM access is server-owned and has no expiry", () => {
  const result = resolveAdminCrmAccessTransition({ mode: "permanent" }, now);
  assert.equal(result.ok, true);
  assert.equal(result.values.billing_status, "demo_free");
  assert.equal(result.values.billing_manual_override, true);
  assert.equal(result.values.workspace_access_mode, "active");
  assert.equal(result.values.setup_fee_cents, 0);
  assert.equal(result.values.monthly_fee_cents, 0);
  assert.equal(result.values.test_access_flags.no_expiry, true);
  assert.equal(result.values.test_access_flags.temporary_processing_access, false);
  assert.equal(result.values.test_access_flags.temporary_processing_access_expires_at, undefined);
});

test("temporary free CRM access requires a future expiry and removes permanent override", () => {
  const result = resolveAdminCrmAccessTransition(
    { mode: "temporary", expiresAt: "2026-10-01T22:00:00+02:00" },
    now,
  );
  assert.equal(result.ok, true);
  assert.equal(result.values.billing_status, "demo_free");
  assert.equal(result.values.billing_manual_override, false);
  assert.equal(result.values.test_access_flags.no_expiry, false);
  assert.equal(result.values.test_access_flags.temporary_processing_access, true);
  assert.equal(
    result.values.test_access_flags.temporary_processing_access_expires_at,
    "2026-10-01T20:00:00.000Z",
  );

  assert.deepEqual(
    resolveAdminCrmAccessTransition(
      { mode: "temporary", expiresAt: "2026-09-15T19:59:59.000Z" },
      now,
    ),
    { ok: false, error: "temporary_access_expiry_required" },
  );
});

test("date-only temporary expiry uses the Europe/Zurich end of day", () => {
  const summer = resolveAdminCrmAccessTransition(
    { mode: "temporary", expiresAt: "2026-10-01" },
    now,
  );
  assert.equal(summer.ok, true);
  assert.equal(
    summer.values.test_access_flags.temporary_processing_access_expires_at,
    "2026-10-01T21:59:59.999Z",
  );

  const winter = resolveAdminCrmAccessTransition(
    { mode: "temporary", expiresAt: "2026-12-01" },
    now,
  );
  assert.equal(winter.ok, true);
  assert.equal(
    winter.values.test_access_flags.temporary_processing_access_expires_at,
    "2026-12-01T22:59:59.999Z",
  );
});

test("blocked access clears every bypass without deleting the Workspace", () => {
  const result = resolveAdminCrmAccessTransition({ mode: "blocked" }, now);
  assert.equal(result.ok, true);
  assert.equal(result.values.billing_status, "manual_suspended");
  assert.equal(result.values.billing_manual_override, false);
  assert.equal(result.values.workspace_access_mode, "active");
  assert.equal(result.values.test_access_flags.temporary_processing_access, false);
  assert.equal(result.values.test_access_flags.no_expiry, false);
});

test("access labels distinguish permanent, temporary, expired and blocked", () => {
  assert.equal(adminCrmAccessLabel({ billing_status: "demo_free", billing_manual_override: true, test_access_flags: { no_expiry: true } }, now), "Dauerhaft kostenlos");
  assert.equal(adminCrmAccessLabel({ billing_status: "demo_free", billing_manual_override: false, test_access_flags: { temporary_processing_access: true, temporary_processing_access_expires_at: "2026-10-01T00:00:00.000Z" } }, now), "Befristet kostenlos");
  assert.equal(adminCrmAccessLabel({ billing_status: "demo_free", billing_manual_override: false, test_access_flags: { temporary_processing_access: true, temporary_processing_access_expires_at: "2026-09-01T00:00:00.000Z" } }, now), "Befristet abgelaufen");
  assert.equal(adminCrmAccessLabel({ billing_status: "manual_suspended", billing_manual_override: false, test_access_flags: {} }, now), "Gesperrt");
});

test("Admin service lists Auth registrations and protects provisioning", () => {
  const service = fs.readFileSync("src/lib/adminBilling.ts", "utf8");
  const route = fs.readFileSync(
    "src/app/api/admin/billing/users/[userId]/crm-access/route.ts",
    "utf8",
  );
  const page = fs.readFileSync("src/app/admin/billing/page.tsx", "utf8");
  const preActivation = fs.readFileSync("src/lib/preActivation.ts", "utf8");
  const workspaceAuthorization = fs.readFileSync("src/lib/workspaceAuthorization.ts", "utf8");
  const dashboard = fs.readFileSync("src/app/dashboard/page.tsx", "utf8");
  const accountSections = fs.readFileSync("src/app/settings/AccountSections.tsx", "utf8");
  const workspaceDetail = fs.readFileSync(
    "src/app/admin/billing/workspaces/[workspaceId]/page.tsx",
    "utf8",
  );
  const sourceOfTruth = fs.readFileSync("docs/SOURCE_OF_TRUTH.md", "utf8");
  const readme = fs.readFileSync("README.md", "utf8");
  const rollout = fs.readFileSync("docs/operations/ADMIN_CRM_ACCESS_ROLLOUT.md", "utf8");
  const rolloutCheck = fs.readFileSync(
    "scripts/operations/admin-crm-access-migration-check.mjs",
    "utf8",
  );
  const migration = fs.readFileSync(
    "supabase/migrations/20260915221500_admin_crm_access.sql",
    "utf8",
  );
  const setterStart = service.indexOf("export async function setAdminRegisteredUserCrmAccess");
  const setterEnd = service.indexOf("export async function listAdminBillingWorkspaces", setterStart);
  const setter = service.slice(setterStart, setterEnd);

  assert.match(service, /export async function listAdminRegisteredUsers/u);
  assert.match(service, /\/admin\/users\?page=/u);
  assert.match(service, /per_page=/u);
  assert.match(service, /email_confirmed_at|confirmed_at/u);
  assert.match(service, /registered_user_email_unconfirmed/u);
  assert.match(service, /admin_set_registered_user_crm_access/u);
  assert.match(service, /listAdminBillingWorkspacesForOwners/u);
  assert.match(service, /admin_crm_access_generic_billing_forbidden/u);
  assert.match(setter, /getAdminOwnedWorkspaces/u);
  assert.doesNotMatch(setter, /getSupabaseRestUrl\("workspaces"\)/u);
  assert.doesNotMatch(setter, /operations_audit_log/u);
  assert.doesNotMatch(setter, /Stripe|createStripeCheckoutSession|getStripeClient/u);
  assert.doesNotMatch(setter, /email_confirm\s*:/u);

  assert.match(migration, /pg_advisory_xact_lock/u);
  assert.match(migration, /from auth\.users/u);
  assert.match(migration, /v_confirmed_at is null/u);
  assert.match(migration, /'starter'/u);
  assert.match(migration, /'starter_paid_setup'/u);
  assert.doesNotMatch(migration, /'pilot_only'/u);
  assert.match(migration, /stripe_customer_id is not null/u);
  assert.match(migration, /stripe_subscription_id is not null/u);
  assert.match(migration, /insert into public\.operations_audit_log/u);
  assert.match(migration, /on conflict on constraint workspace_members_workspace_id_user_id_key/u);
  assert.match(migration, /grant execute[\s\S]*service_role/u);
  assert.match(migration, /revoke all[\s\S]*public, anon, authenticated/u);
  assert.match(migration, /admin_crm_read_allowed/u);
  assert.match(migration, /as restrictive[\s\S]*for all[\s\S]*to authenticated/u);
  assert.match(migration, /information_schema\.columns/u);

  assert.match(route, /isTrustedFanMindMutationRequest/u);
  assert.match(route, /readBoundedFormDataRequest/u);
  assert.match(route, /readBoundedJsonRequest/u);
  assert.match(route, /requirePlatformAdmin/u);
  assert.match(route, /setAdminRegisteredUserCrmAccess/u);
  assert.match(page, /listAdminRegisteredUsers/u);
  assert.match(page, /users_page/u);
  assert.doesNotMatch(page, /registeredUsers\.slice/u);
  assert.match(page, /activeTab === "customers"/u);
  assert.match(page, /registeredUserWorkspaces/u);
  assert.match(page, /Dauerhaft kostenlos freigeben/u);
  assert.match(page, /Befristet kostenlos/u);
  assert.match(page, /Zugang sperren/u);
  assert.match(preActivation, /isAdminCrmAccessWorkspace/u);
  assert.match(preActivation, /evaluateWorkspaceProcessingEntitlement/u);
  assert.match(workspaceAuthorization, /assertAdminCrmReadAccess/u);
  assert.match(dashboard, /Starter CRM/u);
  assert.match(accountSections, /Starter CRM · kostenloser Adminzugang/u);
  assert.match(workspaceDetail, /isAdminCrmAccessWorkspace/u);
  assert.match(workspaceDetail, /CRM-Zugang ausschließlich in der Kundenübersicht verwalten/u);
  assert.match(sourceOfTruth, /Administrativ gewährter Starter-CRM-Zugang/u);
  assert.match(readme, /Admin-CRM-Zugang/u);
  assert.match(rollout, /20260915221500_admin_crm_access\.sql/u);
  assert.match(rollout, /separate ausdrückliche\s+Production-Freigabe/u);
  assert.match(rolloutCheck, /EXPECTED_ADMIN_CRM_ACCESS_SHA256/u);
});
