import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isTrustedFanMindMutationRequest,
  readBoundedFormDataRequest,
  readBoundedJsonRequest,
} from "../src/lib/httpMutationPolicy.mjs";
import {
  CURRENT_PAYMENT_TERMS_VERSION,
  PAYMENT_TERMS_ACTIVATION_ENABLED,
  PAYMENT_TERMS_ACTIVATION_BLOCK_CODE,
  evaluateCurrentPaymentTermsUserEvidence,
  isPaymentTermsActivationEnabled,
} from "../src/lib/paymentTermsActivationPolicy.mjs";

function mutationRequest({
  url = "https://fanmind.ch/api/test",
  origin = "https://fanmind.ch",
  fetchSite = "same-origin",
  body = "{}",
  contentType = "application/json",
} = {}) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": contentType,
      origin,
      "sec-fetch-site": fetchSite,
    },
    body,
  });
}

test("FanMind cookie mutations accept only configured same-site browser origins", () => {
  const environment = {
    NEXT_PUBLIC_APP_URL: "https://app.fanmind.ch",
    NEXT_PUBLIC_SITE_URL: "https://fanmind.ch",
  };

  assert.equal(isTrustedFanMindMutationRequest(mutationRequest(), environment), true);
  assert.equal(
    isTrustedFanMindMutationRequest(
      mutationRequest({ origin: "https://app.fanmind.ch" }),
      environment,
    ),
    true,
  );
  assert.equal(
    isTrustedFanMindMutationRequest(
      mutationRequest({ origin: "https://evil.invalid" }),
      environment,
    ),
    false,
  );
  assert.equal(
    isTrustedFanMindMutationRequest(
      mutationRequest({ fetchSite: "cross-site" }),
      environment,
    ),
    false,
  );
  const missingOrigin = mutationRequest();
  missingOrigin.headers.delete("origin");
  assert.equal(isTrustedFanMindMutationRequest(missingOrigin, environment), false);
});

test("chunked bodies are cancelled as soon as the streamed byte limit is exceeded", async () => {
  let cancelled = false;
  const chunks = [
    new TextEncoder().encode('{"value":"1234'),
    new TextEncoder().encode('567890"}'),
    new TextEncoder().encode("never-read"),
  ];
  const stream = new ReadableStream({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });

  const result = await readBoundedJsonRequest(
    {
      headers: new Headers({ "content-type": "application/json" }),
      body: stream,
      text: async () => {
        throw new Error("stream fallback must not run");
      },
    },
    16,
  );

  assert.deepEqual(result, { ok: false, reason: "payload_too_large", value: null });
  assert.equal(cancelled, true);
  assert.equal(chunks.length, 1, "the final chunk must not be consumed");
});

test("bounded form parsing accepts urlencoded data and rejects wrong content types", async () => {
  const accepted = await readBoundedFormDataRequest(
    mutationRequest({
      body: "status=contacted",
      contentType: "Application/X-Www-Form-Urlencoded; Charset=UTF-8",
    }),
    128,
  );
  assert.equal(accepted.ok, true);
  assert.equal(accepted.ok ? accepted.value.get("status") : null, "contacted");

  const rejected = await readBoundedFormDataRequest(mutationRequest(), 128);
  assert.deepEqual(rejected, { ok: false, reason: "invalid_form_data", value: null });

  const misleadingPrefix = await readBoundedFormDataRequest(
    mutationRequest({
      body: "status=contacted",
      contentType: "application/x-www-form-urlencoded-dangerous",
    }),
    128,
  );
  assert.deepEqual(misleadingPrefix, {
    ok: false,
    reason: "invalid_form_data",
    value: null,
  });
});

test("cookie-authenticated mutation routes enforce the shared origin boundary", async () => {
  const paths = [
    "src/app/api/auth/session/route.ts",
    "src/app/api/auth/logout/route.ts",
    "src/app/api/demo/start/route.ts",
    "src/app/api/inquiries/route.ts",
    "src/app/api/referrals/attribution/route.ts",
    "src/app/api/register/daily-test-window/route.ts",
    "src/app/api/register/workspace/route.ts",
    "src/app/api/admin/notifications/[id]/read/route.ts",
    "src/app/api/admin/operations/backup-jobs/route.ts",
    "src/app/api/admin/settings/daily-test-plan/route.ts",
    "src/app/api/admin/inquiries/[inquiryId]/status/route.ts",
    "src/app/api/admin/assets/upload/route.ts",
    "src/app/api/admin/billing/users/[userId]/confirm-email/route.ts",
    "src/app/api/admin/billing/workspaces/[workspaceId]/internal-test/route.ts",
    "src/app/api/admin/billing/workspaces/[workspaceId]/internal-daily-test/route.ts",
    "src/app/api/admin/billing/workspaces/[workspaceId]/internal-daily-test/cancel/route.ts",
    "src/app/api/admin/billing/workspaces/[workspaceId]/mark-paid/route.ts",
    "src/app/api/admin/billing/workspaces/[workspaceId]/note/route.ts",
    "src/app/api/admin/billing/workspaces/[workspaceId]/suspend/route.ts",
    "src/app/api/admin/billing/workspaces/[workspaceId]/unsuspend/route.ts",
    "src/app/api/integrations/facebook/disconnect/route.ts",
    "src/app/api/webhooks/meta/self-test/route.ts",
  ];

  for (const path of paths) {
    const source = await readFile(path, "utf8");
    assert.match(source, /isTrustedFanMindMutationRequest/u, path);
  }
});

test("productive JSON and form routes parse only through bounded readers", async () => {
  const jsonPaths = [
    "src/app/api/auth/session/route.ts",
    "src/app/api/demo/start/route.ts",
    "src/app/api/demo/cleanup/route.ts",
    "src/app/api/inquiries/route.ts",
    "src/app/api/referrals/attribution/route.ts",
    "src/app/api/register/daily-test-window/route.ts",
    "src/app/api/register/workspace/route.ts",
    "src/app/api/admin/notifications/[id]/read/route.ts",
    "src/app/api/admin/operations/backup-jobs/route.ts",
    "src/app/api/ai/prompt-settings/route.ts",
    "src/app/api/ai/reply-suggestions/route.ts",
    "src/app/api/ai/fan-analysis/route.ts",
    "src/app/api/account-deletion/route.ts",
  ];
  const formPaths = [
    "src/app/api/admin/assets/upload/route.ts",
    "src/app/api/admin/settings/daily-test-plan/route.ts",
    "src/app/api/admin/inquiries/[inquiryId]/status/route.ts",
    "src/app/api/admin/billing/workspaces/[workspaceId]/mark-paid/route.ts",
    "src/app/api/admin/billing/workspaces/[workspaceId]/note/route.ts",
  ];

  for (const path of jsonPaths) {
    const source = await readFile(path, "utf8");
    assert.match(source, /readBoundedJsonRequest/u, path);
    assert.doesNotMatch(source, /request\.json\(\)/u, path);
  }
  for (const path of formPaths) {
    const source = await readFile(path, "utf8");
    assert.match(source, /readBoundedFormDataRequest/u, path);
    assert.doesNotMatch(source, /request\.formData\(\)/u, path);
  }
});

test("selected browser and admin boundaries never forward provider error text", async () => {
  const paths = [
    "src/app/api/ai/prompt-settings/route.ts",
    "src/app/api/referrals/attribution/route.ts",
    "src/app/api/referrals/reconcile/route.ts",
    "src/app/api/admin/notifications/route.ts",
    "src/app/api/admin/notifications/[id]/read/route.ts",
    "src/app/api/admin/inquiries/[inquiryId]/status/route.ts",
    "src/app/settings/actions.ts",
    "src/app/fans/actions.ts",
    "src/app/fans/[id]/analysisActions.ts",
    "src/lib/adminBilling.ts",
    "src/lib/adminAiUsage.ts",
    "src/lib/adminReferrals.ts",
    "src/lib/workspaceAiUsage.ts",
    "src/lib/inquiries.ts",
  ];
  const sources = await Promise.all(paths.map((path) => readFile(path, "utf8")));
  const combined = sources.join("\n");

  assert.doesNotMatch(combined, /\{\s*error:\s*result\.error\s*\}/u);
  assert.doesNotMatch(combined, /json\.error\?\.message/u);
  assert.doesNotMatch(combined, /encodeURIComponent\(result\.error\.message\)/u);
  assert.doesNotMatch(combined, /new Error\(await response\.text\(\)\)/u);
  assert.doesNotMatch(
    combined,
    /error instanceof Error \? error\.message : "Unbekannter Fehler"/u,
  );
});

test("paid activation stays fail-closed and checkout uses only server-owned workspace evidence", async () => {
  assert.equal(CURRENT_PAYMENT_TERMS_VERSION, "2026-06-v1");
  assert.equal(PAYMENT_TERMS_ACTIVATION_ENABLED, false);
  assert.equal(isPaymentTermsActivationEnabled(), false);
  assert.equal(PAYMENT_TERMS_ACTIVATION_BLOCK_CODE, "payment_terms_version_unresolved");

  const validMetadataShape = {
    payment_terms_accepted: true,
    payment_terms_version: CURRENT_PAYMENT_TERMS_VERSION,
    payment_terms_accepted_at: "2026-08-09T12:00:00.000Z",
  };
  assert.deepEqual(
    evaluateCurrentPaymentTermsUserEvidence(validMetadataShape, {
      now: Date.parse("2026-08-09T12:01:00.000Z"),
    }).blockers,
    ["version_unresolved"],
  );
  assert.deepEqual(
    evaluateCurrentPaymentTermsUserEvidence(
      {
        ...validMetadataShape,
        payment_terms_accepted_at: "2026-05-31T23:59:59.999Z",
      },
      {
        now: Date.parse("2026-08-09T12:01:00.000Z"),
        activationEnabled: true,
      },
    ).blockers,
    ["accepted_at_before_window"],
  );

  const [
    registerPage,
    registerClient,
    registrationRoute,
    workspaceSetup,
    checkoutApi,
    checkoutDirect,
    billingStart,
    serverEvidence,
    provisioning,
  ] = await Promise.all([
    readFile("src/app/register/page.tsx", "utf8"),
    readFile("src/app/register/RegisterClient.tsx", "utf8"),
    readFile("src/app/api/register/workspace/route.ts", "utf8"),
    readFile("src/app/workspace/setup/page.tsx", "utf8"),
    readFile("src/app/api/billing/checkout/route.ts", "utf8"),
    readFile("src/app/billing/checkout/route.ts", "utf8"),
    readFile("src/app/billing/start/page.tsx", "utf8"),
    readFile("src/lib/paymentTermsServerEvidence.ts", "utf8"),
    readFile("src/lib/workspaceProvisioning.ts", "utf8"),
  ]);

  assert.match(registerPage, /!isPaymentTermsActivationEnabled\(\)/u);
  assert.match(registerPage, /Kostenlose Demo starten/u);
  assert.match(
    registerClient,
    /body: JSON\.stringify\(\{[\s\S]*planId: selectedPlanId[\s\S]*commercialOption: selectedCommercialOption[\s\S]*paymentTermsAccepted/u,
  );
  assert.match(registrationRoute, /parseTrustedProvisioningSelection/u);
  assert.match(registrationRoute, /buildTrustedProvisioningUser/u);
  assert.doesNotMatch(registrationRoute, /ensureUserWorkspace\(data\.user\)/u);
  assert.doesNotMatch(workspaceSetup, /ensureUserWorkspace\(data\.user\)/u);
  assert.match(workspaceSetup, /paymentTermsAccepted/u);

  for (const checkoutSource of [checkoutApi, checkoutDirect, billingStart]) {
    assert.match(checkoutSource, /hasCurrentWorkspacePaymentTermsEvidence/u);
    assert.doesNotMatch(checkoutSource, /hasCurrentPaymentTermsUserEvidence/u);
  }
  assert.match(serverEvidence, /SUPABASE_SERVICE_ROLE_KEY/u);
  assert.match(serverEvidence, /payment_terms_accepted_by_user_id/u);
  assert.match(serverEvidence, /owner_user_id/u);
  assert.match(serverEvidence, /CURRENT_PAYMENT_TERMS_VERSION/u);
  assert.match(serverEvidence, /PAYMENT_TERMS_ACCEPTED_NOT_BEFORE_MS/u);
  assert.match(
    serverEvidence,
    /acceptedAt < PAYMENT_TERMS_ACCEPTED_NOT_BEFORE_MS[\s\S]*accepted_at_before_window/u,
  );
  assert.doesNotMatch(serverEvidence, /user_metadata/u);

  assert.match(provisioning, /WORKSPACE_DIRECT_INSERT_COMPATIBILITY_ENABLED = false/u);
  assert.match(
    provisioning,
    /isMissingWorkspaceProvisioningRpc[\s\S]*!WORKSPACE_DIRECT_INSERT_COMPATIBILITY_ENABLED\) return false/u,
  );
});

test("staging host provisioning validates a repeatable runner prerequisite before host mutation", async () => {
  const workflow = await readFile(
    ".github/workflows/provision-staging-host.yml",
    "utf8",
  );
  const prerequisite = workflow.indexOf(
    "Fresh staging runner registration token is required before any host mutation.",
  );
  const firstMutation = workflow.indexOf(
    "Provision isolated operating-system boundary",
  );
  assert.ok(prerequisite >= 0 && firstMutation > prerequisite);
  assert.match(
    workflow,
    /if ! sudo test -f "\$RUNNER_DIR\/\.runner" && \[ -z "\$STAGING_RUNNER_REGISTRATION_TOKEN" \]/u,
  );
  assert.match(
    workflow,
    /if ! sudo test -f "\$RUNNER_DIR\/\.runner"; then/u,
  );
  assert.match(workflow, /STAGING_RUNNER_PREREQUISITE=ready/u);
  assert.match(workflow, /FANMIND_STAGING_STRIPE_PRICE_INTERNAL_DAILY_TEST/u);
  assert.match(workflow, /STRIPE_PRICE_INTERNAL_DAILY_TEST/u);
});
