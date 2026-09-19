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

test("date-only expiry rejects nonexistent calendar dates", () => {
  assert.deepEqual(
    resolveAdminCrmAccessTransition(
      { mode: "temporary", expiresAt: "2026-02-31" },
      now,
    ),
    { ok: false, error: "temporary_access_expiry_required" },
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
  const billingStart = fs.readFileSync("src/app/billing/start/page.tsx", "utf8");
  const billingCheckout = fs.readFileSync("src/app/billing/checkout/route.ts", "utf8");
  const billingPending = fs.readFileSync("src/app/billing/pending/page.tsx", "utf8");
  const billingSuccess = fs.readFileSync("src/app/billing/success/page.tsx", "utf8");
  const billingCancel = fs.readFileSync("src/app/billing/cancel/page.tsx", "utf8");
  const billingSuspended = fs.readFileSync("src/app/billing/suspended/page.tsx", "utf8");
  const workspaceAuthorization = fs.readFileSync("src/lib/workspaceAuthorization.ts", "utf8");
  const supabaseServer = fs.readFileSync("src/lib/supabase/server.ts", "utf8");
  const demoMode = fs.readFileSync("src/lib/demoMode.ts", "utf8");
  const inbox = fs.readFileSync("src/app/inbox/page.tsx", "utf8");
  const fanDetail = fs.readFileSync("src/app/fans/[id]/page.tsx", "utf8");
  const mobilePush = fs.readFileSync("src/app/api/mobile/push-registration/route.ts", "utf8");
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
  const creatorFoundation = fs.readFileSync(
    "supabase/controlled/creator_intelligence_foundation.sql",
    "utf8",
  );
  const creatorRevisionFix = fs.readFileSync(
    "supabase/controlled/creator_revision_conflict_fix.sql",
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
  assert.match(migration, /p_mode is null or p_mode not in/u);
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
  assert.match(migration, /on public\.workspaces[\s\S]*as restrictive[\s\S]*admin_crm_read_allowed\(id\)/u);
  assert.match(migration, /current_admin_crm_access_state/u);
  assert.match(migration, /admin_crm_access_existing_membership/u);
  assert.match(migration, /membership\.workspace_id <> v_workspace_id/u);
  assert.doesNotMatch(migration, /revoke execute on function public\.save_creator_bundle/u);
  assert.match(creatorFoundation, /creator_workspace_access_allowed/u);
  assert.match(creatorFoundation, /using \(\(exists[\s\S]*\) and public\.creator_workspace_access_allowed\(%I\.workspace_id\)\)'/u);
  assert.match(creatorFoundation, /to_regprocedure\('public\.admin_crm_read_allowed\(uuid\)'\)/u);
  assert.match(creatorFoundation, /if not public\.creator_workspace_access_allowed\(p_workspace_id\)[\s\S]*workspace_inactive/u);
  assert.match(creatorRevisionFix, /creator_workspace_access_allowed\(p_workspace_id\)/u);

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
  assert.match(page, /CRM-Zugang in „Registrierte Nutzer“ verwalten/u);
  assert.match(page, /!workspace \? <>[\s\S]*mode" value="permanent"[\s\S]*mode" value="temporary"/u);
  assert.match(page, /isAdminCrmAccessWorkspace\(selectedWorkspace\)/u);
  assert.match(preActivation, /isAdminCrmAccessWorkspace/u);
  assert.match(preActivation, /if \(isAdminCrmAccessWorkspace\(workspace\)\)[\s\S]*evaluateWorkspaceProcessingEntitlement\(workspace\)\.allowed[\s\S]*\? null[\s\S]*workspace\/access-paused/u);
  assert.match(billingStart, /isAdminCrmAccessWorkspace\(workspace\)[\s\S]*redirect\(redirectTarget \?\? "\/dashboard"\)/u);
  assert.match(billingCheckout, /isAdminCrmAccessWorkspace\(workspace\)[\s\S]*redirectTo\(redirectTarget \?\? "\/dashboard"\)/u);
  for (const billingPage of [billingPending, billingSuccess, billingCancel, billingSuspended]) {
    assert.match(billingPage, /isAdminCrmAccessWorkspace\(workspace\)/u);
    assert.match(billingPage, /getBillingContinuationHref/u);
  }
  assert.match(workspaceAuthorization, /assertAdminCrmReadAccess/u);
  assert.match(workspaceAuthorization, /ADMIN_CRM_ACCESS_INACTIVE/u);
  assert.match(supabaseServer, /current_admin_crm_access_state/u);
  assert.match(supabaseServer, /ADMIN_CRM_ACCESS_INACTIVE/u);
  assert.match(inbox, /error\.code === "workspace_inactive"[\s\S]*workspace\/access-paused/u);
  assert.match(fanDetail, /WorkspaceAuthorizationError/u);
  assert.match(fanDetail, /error\.code === "workspace_inactive"[\s\S]*workspace\/access-paused/u);
  assert.match(demoMode, /admin_crm_access !== true/u);
  assert.match(mobilePush, /workspaceTestAccessFlags/u);
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
