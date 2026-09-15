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
  const setterStart = service.indexOf("export async function setAdminRegisteredUserCrmAccess");
  const setterEnd = service.indexOf("export async function listAdminBillingWorkspaces", setterStart);
  const setter = service.slice(setterStart, setterEnd);

  assert.match(service, /export async function listAdminRegisteredUsers/u);
  assert.match(service, /\/admin\/users\?page=/u);
  assert.match(service, /per_page=/u);
  assert.match(service, /email_confirmed_at|confirmed_at/u);
  assert.match(service, /registered_user_email_unconfirmed/u);
  assert.match(service, /deterministicAdminCrmWorkspaceId/u);
  assert.match(service, /resolution=ignore-duplicates,return=minimal/u);
  assert.match(setter, /createAdminCrmWorkspace/u);
  assert.match(setter, /getAdminOwnedWorkspaces/u);
  assert.match(service, /on_conflict", "workspace_id,user_id"/u);
  assert.match(service, /operations_audit_log/u);
  assert.doesNotMatch(setter, /Stripe|createStripeCheckoutSession|getStripeClient/u);
  assert.doesNotMatch(setter, /email_confirm\s*:/u);

  assert.match(route, /isTrustedFanMindMutationRequest/u);
  assert.match(route, /readBoundedFormDataRequest/u);
  assert.match(route, /readBoundedJsonRequest/u);
  assert.match(route, /requirePlatformAdmin/u);
  assert.match(route, /setAdminRegisteredUserCrmAccess/u);
  assert.match(page, /listAdminRegisteredUsers/u);
  assert.match(page, /users_page/u);
  assert.match(page, /registeredUsers\.slice\(registeredUserStart, registeredUserEnd\)/u);
  assert.doesNotMatch(page, /registeredUsers\.slice\(0, 50\)/u);
  assert.match(page, /Dauerhaft kostenlos freigeben/u);
  assert.match(page, /Befristet kostenlos/u);
  assert.match(page, /Zugang sperren/u);
});
