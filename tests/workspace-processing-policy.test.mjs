import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import "./workspace-authorization-policy.test.mjs";

import { evaluateWorkspaceProcessingEntitlement } from "../src/lib/workspaceProcessingPolicy.mjs";

const NOW = new Date("2026-08-11T18:00:00.000Z");

function workspace(overrides = {}) {
  return {
    workspace_access_mode: "active",
    subscription_effective_end_at: null,
    billing_status: "active",
    billing_manual_override: false,
    billing_grace_until: null,
    billing_suspended_at: null,
    test_access_flags: {},
    ...overrides,
  };
}

test("workspace processing entitlement allows only explicit active states", () => {
  assert.deepEqual(evaluateWorkspaceProcessingEntitlement(workspace(), NOW), {
    allowed: true,
    reason: "active_billing",
  });
  assert.deepEqual(
    evaluateWorkspaceProcessingEntitlement(
      workspace({
        billing_status: "payment_failed",
        billing_grace_until: "2026-08-12T18:00:00.000Z",
      }),
      NOW,
    ),
    { allowed: true, reason: "billing_grace" },
  );
  assert.deepEqual(
    evaluateWorkspaceProcessingEntitlement(
      workspace({
        billing_status: "suspended",
        billing_manual_override: true,
      }),
      NOW,
    ),
    { allowed: true, reason: "manual_override" },
  );
  assert.deepEqual(
    evaluateWorkspaceProcessingEntitlement(
      workspace({
        billing_status: "demo_free",
        test_access_flags: {
          temporary_processing_access: true,
          temporary_processing_access_expires_at:
            "2026-08-11T19:00:00.000Z",
        },
      }),
      NOW,
    ),
    { allowed: true, reason: "temporary_access" },
  );
  assert.deepEqual(
    evaluateWorkspaceProcessingEntitlement(
      workspace({
        billing_status: "demo_free",
        test_access_flags: {
          fixed_demo_seed_version: "2026-07-26-v1",
        },
      }),
      NOW,
    ),
    { allowed: true, reason: "trusted_demo" },
  );
  assert.deepEqual(
    evaluateWorkspaceProcessingEntitlement(
      workspace({
        billing_status: "demo_free",
        test_access_flags: {
          temporary_demo: true,
          temporary_processing_access: true,
          temporary_processing_access_expires_at:
            "2026-08-11T19:00:00.000Z",
        },
      }),
      NOW,
    ),
    { allowed: true, reason: "temporary_access" },
  );
});

test("workspace processing entitlement fails closed for ended and blocked states", () => {
  assert.deepEqual(evaluateWorkspaceProcessingEntitlement(null, NOW), {
    allowed: false,
    reason: "workspace_missing",
  });
  assert.deepEqual(
    evaluateWorkspaceProcessingEntitlement(
      workspace({ workspace_access_mode: "archived_readonly" }),
      NOW,
    ),
    { allowed: false, reason: "workspace_archived" },
  );
  assert.deepEqual(
    evaluateWorkspaceProcessingEntitlement(
      workspace({
        subscription_effective_end_at: "2026-08-11T18:00:00.000Z",
      }),
      NOW,
    ),
    { allowed: false, reason: "contract_ended" },
  );
  assert.deepEqual(
    evaluateWorkspaceProcessingEntitlement(
      workspace({ billing_status: "suspended" }),
      NOW,
    ),
    { allowed: false, reason: "billing_suspended" },
  );
  assert.deepEqual(
    evaluateWorkspaceProcessingEntitlement(
      workspace({
        billing_status: "cancelled",
        billing_manual_override: true,
      }),
      NOW,
    ),
    { allowed: false, reason: "billing_ended" },
  );
  assert.deepEqual(
    evaluateWorkspaceProcessingEntitlement(
      workspace({
        billing_status: "refunded",
        test_access_flags: {
          temporary_processing_access: true,
          temporary_processing_access_expires_at:
            "2026-08-11T19:00:00.000Z",
        },
      }),
      NOW,
    ),
    { allowed: false, reason: "billing_ended" },
  );
  assert.deepEqual(
    evaluateWorkspaceProcessingEntitlement(
      workspace({
        billing_status: "payment_failed",
        billing_grace_until: "2026-08-11T17:59:59.000Z",
      }),
      NOW,
    ),
    { allowed: false, reason: "billing_grace_expired" },
  );
  assert.deepEqual(
    evaluateWorkspaceProcessingEntitlement(
      workspace({ billing_status: "unknown" }),
      NOW,
    ),
    { allowed: false, reason: "billing_ineligible" },
  );
  assert.deepEqual(
    evaluateWorkspaceProcessingEntitlement(
      workspace({
        billing_status: "demo_free",
        test_access_flags: { temporary_demo: true },
      }),
      NOW,
    ),
    { allowed: false, reason: "billing_ineligible" },
  );
  assert.deepEqual(
    evaluateWorkspaceProcessingEntitlement(
      workspace({
        billing_status: "demo_free",
        test_access_flags: {
          temporary_processing_access: true,
          temporary_processing_access_expires_at:
            "2026-08-11T17:59:59.000Z",
        },
      }),
      NOW,
    ),
    { allowed: false, reason: "temporary_access_expired" },
  );
  assert.deepEqual(
    evaluateWorkspaceProcessingEntitlement(
      workspace({
        billing_status: "demo_free",
        test_access_flags: {
          temporary_processing_access: true,
          temporary_processing_access_expires_at: "not-a-timestamp",
        },
      }),
      NOW,
    ),
    { allowed: false, reason: "temporary_access_invalid" },
  );
  assert.deepEqual(
    evaluateWorkspaceProcessingEntitlement(
      workspace({ billing_status: "demo_free" }),
      NOW,
    ),
    { allowed: false, reason: "billing_ineligible" },
  );
  assert.deepEqual(
    evaluateWorkspaceProcessingEntitlement(
      workspace({
        billing_status: "demo_free",
        test_access_flags: { fixed_demo_seed_version: "wrong-version" },
      }),
      NOW,
    ),
    { allowed: false, reason: "billing_ineligible" },
  );
});


async function readSource(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

function sourceFrom(source, marker, length = 2_500) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Missing source marker: ${marker}`);
  return source.slice(start, start + length);
}

test("Meta ingress and manual syncs share the workspace processing gate", async () => {
  const [server, facebookActions, instagramActions] = await Promise.all([
    readSource("src/lib/supabase/server.ts"),
    readSource("src/app/channels/facebookWebhookActions.ts"),
    readSource("src/app/channels/instagramWebhookActions.ts"),
  ]);

  const resolver = sourceFrom(
    server,
    "export async function getWorkspaceProcessingEntitlement",
  );
  assert.match(resolver, /getServiceAccessToken\(\)/u);
  assert.match(resolver, /WORKSPACE_PROCESSING_COLUMNS/u);
  assert.match(resolver, /evaluateWorkspaceProcessingEntitlement/u);

  const ingress = sourceFrom(
    server,
    "export async function findMetaSocialConnectionByPageId",
  );
  assert.match(ingress, /getWorkspaceProcessingEntitlement\(/u);
  assert.match(
    ingress,
    /if \(!entitlement\.allowed\) \{[\s\S]*return \{ connection: null, error: null, processingBlocked: true \}/u,
  );

  for (const [label, source, marker] of [
    ["Facebook", facebookActions, "async function getCurrentFacebookConnection"],
    ["Instagram", instagramActions, "async function getCurrentInstagramConnection"],
  ]) {
    const currentConnection = sourceFrom(source, marker);
    const entitlementPosition = currentConnection.indexOf(
      "getWorkspaceProcessingEntitlement(",
    );
    const connectionReadPosition = currentConnection.indexOf(
      "getWorkspaceSocialConnectionsServer(",
    );
    assert.ok(
      entitlementPosition >= 0,
      `${label} must check workspace processing entitlement`,
    );
    assert.ok(
      connectionReadPosition > entitlementPosition,
      `${label} must check entitlement before reading the provider connection`,
    );
    assert.match(
      currentConnection,
      /entitlement\.error \|\| !entitlement\.allowed/u,
    );
  }
});
