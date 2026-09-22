import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ACCOUNT_DELETION_CANCEL_PHRASE,
  ACCOUNT_DELETION_CONFIRMATION_PHRASE,
  AccountDeletionPolicyError,
  getAccountDeletionDeadline,
  isAccountDeletionCancellable,
  publicAccountDeletionStatus,
  requiresSubscriptionResolution,
  validateAccountDeletionCancellation,
  validateAccountDeletionRequest,
} from "../src/lib/accountDeletionPolicy.mjs";
import {
  MOBILE_ACCOUNT_DELETION_CANCEL_PHRASE,
  MOBILE_ACCOUNT_DELETION_CONFIRMATION_PHRASE,
  validateMobileAccountDeletionCancellation,
  validateMobileAccountDeletionConfirmation,
} from "../apps/mobile/src/lib/accountDeletionPolicy.mjs";
import {
  AccountDeletionProcessorError,
  evaluateAccountDeletionEligibility,
  processAccountDeletion,
  recoverWorkspaceIdsForResume,
  workspaceSubscriptionRequiresResolution,
} from "../scripts/operations/process-account-deletion.mjs";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";
const ACCOUNT_EMAIL = "owner@example.com";
const SERVICE_KEY = "service-role-test-key-that-must-never-be-logged";
const HASH_SECRET = "account-deletion-hash-secret-at-least-32-bytes";

function makeProcessorFetch({ completionMailOk = true } = {}) {
  const calls = [];
  const deletionRequest = {
    id: REQUEST_ID,
    user_id: USER_ID,
    workspace_id: WORKSPACE_ID,
    notification_email: ACCOUNT_EMAIL,
    request_source: "mobile",
    status: "pending",
    requires_ownership_transfer: false,
    requires_subscription_resolution: false,
    requested_at: "2026-07-24T00:00:00.000Z",
    processing_deadline_at: "2026-08-23T00:00:00.000Z",
  };

  const fetchImpl = async (url, init = {}) => {
    const value = String(url);
    const method = String(init.method ?? "GET").toUpperCase();
    calls.push({ url: value, method, body: init.body });

    if (value === "https://api.resend.com/emails") {
      return new Response(JSON.stringify({ id: "mail-test" }), {
        status: completionMailOk ? 200 : 503,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (value.includes(`/auth/v1/admin/users/${USER_ID}`)) {
      if (method === "DELETE") {
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ id: USER_ID, email: ACCOUNT_EMAIL }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (value.includes("/rest/v1/account_deletion_requests")) {
      if (method === "PATCH") {
        const body = JSON.parse(String(init.body ?? "{}"));
        return new Response(
          JSON.stringify([{ id: REQUEST_ID, status: body.status ?? "pending" }]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify([deletionRequest]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (value.includes("/rest/v1/workspaces") && value.includes("owner_user_id=eq")) {
      return new Response(JSON.stringify(method === "GET" && !calls.some(
        (call) => call.method === "DELETE" && call.url.includes("/auth/v1/admin/users/"),
      ) ? [{ id: WORKSPACE_ID, owner_user_id: USER_ID, billing_status: "demo_free" }] : []), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (
      value.includes("/rest/v1/workspaces") ||
      value.includes("/rest/v1/workspace_members") ||
      value.includes("/rest/v1/profiles") ||
      value.includes("/rest/v1/")
    ) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    throw new Error(`unexpected_fetch:${method}:${value}`);
  };

  return { fetchImpl, calls };
}

test("Web and Mobile require exact email and explicit destructive confirmation", () => {
  assert.deepEqual(
    validateAccountDeletionRequest(
      {
        emailConfirmation: " Owner@Example.com ",
        confirmation: ACCOUNT_DELETION_CONFIRMATION_PHRASE,
      },
      ACCOUNT_EMAIL,
      "web",
    ),
    {
      email: ACCOUNT_EMAIL,
      source: "web",
      confirmationVersion: "v1",
    },
  );

  assert.deepEqual(
    validateMobileAccountDeletionConfirmation(
      {
        emailConfirmation: ACCOUNT_EMAIL,
        confirmation: MOBILE_ACCOUNT_DELETION_CONFIRMATION_PHRASE,
      },
      ACCOUNT_EMAIL,
    ),
    { email: ACCOUNT_EMAIL },
  );

  assert.throws(
    () =>
      validateAccountDeletionRequest(
        {
          emailConfirmation: "other@example.com",
          confirmation: ACCOUNT_DELETION_CONFIRMATION_PHRASE,
        },
        ACCOUNT_EMAIL,
        "mobile",
      ),
    (error) =>
      error instanceof AccountDeletionPolicyError &&
      error.code === "email_confirmation_mismatch",
  );
  assert.throws(
    () =>
      validateMobileAccountDeletionConfirmation(
        {
          emailConfirmation: ACCOUNT_EMAIL,
          confirmation: "delete",
        },
        ACCOUNT_EMAIL,
      ),
    /confirmation_phrase_invalid/u,
  );
});

test("cancellation is explicit, request-bound and allowed only before processing", () => {
  assert.deepEqual(
    validateAccountDeletionCancellation({
      requestId: REQUEST_ID,
      confirmation: ACCOUNT_DELETION_CANCEL_PHRASE,
    }),
    { requestId: REQUEST_ID },
  );
  assert.deepEqual(
    validateMobileAccountDeletionCancellation({
      requestId: REQUEST_ID,
      confirmation: MOBILE_ACCOUNT_DELETION_CANCEL_PHRASE,
    }),
    { requestId: REQUEST_ID },
  );
  assert.equal(isAccountDeletionCancellable("pending"), true);
  assert.equal(isAccountDeletionCancellable("blocked"), true);
  assert.equal(isAccountDeletionCancellable("processing"), false);
  assert.throws(
    () =>
      validateAccountDeletionCancellation({
        requestId: "not-a-request-id",
        confirmation: ACCOUNT_DELETION_CANCEL_PHRASE,
      }),
    /request_id_invalid/u,
  );
});

test("deadline and public status expose no email, user id or provider details", () => {
  const requestedAt = new Date("2026-07-24T12:00:00.000Z");
  assert.equal(
    getAccountDeletionDeadline(requestedAt).toISOString(),
    "2026-08-23T12:00:00.000Z",
  );
  const status = publicAccountDeletionStatus({
    id: REQUEST_ID,
    user_id: USER_ID,
    notification_email: ACCOUNT_EMAIL,
    status: "blocked",
    requested_at: requestedAt.toISOString(),
    processing_deadline_at: "2026-08-23T12:00:00.000Z",
    requires_ownership_transfer: true,
    requires_subscription_resolution: false,
  });
  assert.deepEqual(status, {
    id: REQUEST_ID,
    status: "blocked",
    requestedAt: requestedAt.toISOString(),
    processingDeadlineAt: "2026-08-23T12:00:00.000Z",
    requiresOwnershipTransfer: true,
    requiresSubscriptionResolution: false,
    cancellable: true,
  });
  assert.doesNotMatch(JSON.stringify(status), /owner@example|22222222/u);
});

test("active or unresolved subscriptions block destructive processing", () => {
  const active = {
    stripe_subscription_id: "sub_test",
    billing_status: "active",
    subscription_effective_end_at: null,
  };
  const ended = {
    stripe_subscription_id: "sub_test",
    billing_status: "cancelled",
    subscription_effective_end_at: "2026-07-01T00:00:00.000Z",
  };
  assert.equal(requiresSubscriptionResolution(active), true);
  assert.equal(workspaceSubscriptionRequiresResolution(active), true);
  assert.equal(
    requiresSubscriptionResolution(ended, new Date("2026-07-24T00:00:00.000Z")),
    false,
  );
  assert.equal(
    workspaceSubscriptionRequiresResolution(
      ended,
      new Date("2026-07-24T00:00:00.000Z"),
    ),
    false,
  );
});

test("null historical Workspace stays valid only when the account owns no Workspace", async () => {
  const base = {
    request: {
      user_id: USER_ID,
      workspace_id: null,
      notification_email: ACCOUNT_EMAIL,
    },
    authUser: { id: USER_ID, email: ACCOUNT_EMAIL },
    config: { supabaseUrl: "https://example.supabase.co", serviceKey: SERVICE_KEY },
    fetchImpl: async () => new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  };
  const noWorkspace = await evaluateAccountDeletionEligibility({
    ...base,
    workspaces: [],
  });
  assert.equal(noWorkspace.eligible, true);

  await assert.rejects(
    evaluateAccountDeletionEligibility({
      ...base,
      workspaces: [{ id: WORKSPACE_ID, owner_user_id: USER_ID, billing_status: "demo_free" }],
    }),
    (error) => error instanceof AccountDeletionProcessorError &&
      error.code === "request_workspace_mismatch",
  );
});

test("resume reconstructs a deleted request Workspace but excludes a surviving transferred Workspace", async () => {
  const config = { supabaseUrl: "https://example.supabase.co", serviceKey: SERVICE_KEY };
  const request = { workspace_id: WORKSPACE_ID };

  const deleted = await recoverWorkspaceIdsForResume(
    async () => new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
    config,
    request,
  );
  assert.deepEqual(deleted, [WORKSPACE_ID]);

  const transferred = await recoverWorkspaceIdsForResume(
    async () => new Response(JSON.stringify([{ id: WORKSPACE_ID }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
    config,
    request,
  );
  assert.deepEqual(transferred, []);

  assert.deepEqual(
    await recoverWorkspaceIdsForResume(
      async () => { throw new Error("should not fetch"); },
      config,
      { workspace_id: null },
    ),
    [],
  );
});

test("historical request Workspace permits transfer retry but never bypasses remaining owned-Workspace safety", async () => {
  const request = {
    user_id: USER_ID,
    workspace_id: WORKSPACE_ID,
    notification_email: ACCOUNT_EMAIL,
  };
  const authUser = { id: USER_ID, email: ACCOUNT_EMAIL };
  const calls = [];
  const fetchImpl = async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    if (url.pathname.endsWith("/workspace_members")) {
      if (url.searchParams.get("workspace_id") === `eq.${WORKSPACE_ID}`) {
        return new Response(JSON.stringify([{
          id: "membership-after-transfer",
          workspace_id: WORKSPACE_ID,
          user_id: USER_ID,
        }]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error(`unexpected ${url}`);
  };
  const config = { supabaseUrl: "https://example.supabase.co", serviceKey: SERVICE_KEY };

  const transferred = await evaluateAccountDeletionEligibility({
    request, authUser, workspaces: [], fetchImpl, config,
  });
  assert.equal(transferred.eligible, true);
  assert.equal(transferred.ownedWorkspaceCount, 0);

  const remainingOwned = await evaluateAccountDeletionEligibility({
    request,
    authUser,
    workspaces: [{
      id: "44444444-4444-4444-8444-444444444444",
      owner_user_id: USER_ID,
      billing_status: "active",
      stripe_subscription_id: "sub_remaining",
    }],
    fetchImpl,
    config,
  });
  assert.equal(remainingOwned.eligible, false);
  assert.equal(remainingOwned.requiresSubscriptionResolution, true);
  assert.ok(calls.some((url) =>
    url.searchParams.get("workspace_id") === `eq.${WORKSPACE_ID}` &&
    url.searchParams.get("user_id") === `eq.${USER_ID}`,
  ));
});

test("an owned Workspace with another member remains blocked before transfer", async () => {
  const eligibility = await evaluateAccountDeletionEligibility({
    request: {
      user_id: USER_ID,
      workspace_id: WORKSPACE_ID,
      notification_email: ACCOUNT_EMAIL,
    },
    authUser: { id: USER_ID, email: ACCOUNT_EMAIL },
    workspaces: [{ id: WORKSPACE_ID, owner_user_id: USER_ID, billing_status: "demo_free" }],
    config: { supabaseUrl: "https://example.supabase.co", serviceKey: SERVICE_KEY },
    fetchImpl: async () => new Response(JSON.stringify([{ id: "other-member" }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  });
  assert.equal(eligibility.eligible, false);
  assert.equal(eligibility.requiresOwnershipTransfer, true);
  assert.equal(eligibility.otherMemberCount, 1);
});

test("foreign or manipulated historical request Workspace fails closed", async () => {
  await assert.rejects(
    evaluateAccountDeletionEligibility({
      request: {
        user_id: USER_ID,
        workspace_id: "55555555-5555-4555-8555-555555555555",
        notification_email: ACCOUNT_EMAIL,
      },
      authUser: { id: USER_ID, email: ACCOUNT_EMAIL },
      workspaces: [],
      config: { supabaseUrl: "https://example.supabase.co", serviceKey: SERVICE_KEY },
      fetchImpl: async () => new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    }),
    (error) => error instanceof AccountDeletionProcessorError &&
      error.code === "request_workspace_mismatch",
  );
});

test("migration keeps the request queue service-role only, bounded and available after auth deletion", async () => {
  const source = await readFile(
    "supabase/migrations/20260724103000_account_deletion_requests.sql",
    "utf8",
  );
  assert.match(source, /create table if not exists public\.account_deletion_requests/u);
  assert.match(source, /alter table public\.account_deletion_requests enable row level security/u);
  assert.match(
    source,
    /revoke all on table public\.account_deletion_requests from public, anon, authenticated/u,
  );
  assert.match(
    source,
    /grant select, insert, update, delete on table public\.account_deletion_requests to service_role/u,
  );
  assert.match(source, /one_active_per_user/u);
  assert.match(source, /status in \('pending', 'blocked', 'processing'\)/u);
  assert.match(source, /processing_deadline_at <= requested_at \+ interval '31 days'/u);
  assert.match(source, /user_id uuid,/u);
  assert.doesNotMatch(source, /user_id uuid[^\n]*references auth\.users/u);
  assert.doesNotMatch(source, /create policy/u);
});

test("authenticated API accepts cookie or Mobile bearer sessions and returns stable errors only", async () => {
  const source = await readFile("src/app/api/account-deletion/route.ts", "utf8");
  assert.match(source, /getOptionalBearerAccessToken/u);
  assert.match(source, /getSupabaseServerUser\(accessToken\)/u);
  assert.match(source, /source: accessToken \? \("mobile" as const\) : \("web" as const\)/u);
  assert.match(source, /validateAccountDeletionRequest/u);
  assert.match(source, /validateAccountDeletionCancellation/u);
  assert.match(source, /isTemporaryDemoUser/u);
  assert.match(source, /Cache-Control": "private, no-store/u);
  assert.doesNotMatch(source, /response\.text\(|console\.(?:log|error)/u);
});

test("Mobile settings make deletion easy to find and accepted requests trigger secure local purge", async () => {
  const [settings, screen, client, authProvider] = await Promise.all([
    readFile("apps/mobile/app/(app)/settings.tsx", "utf8"),
    readFile("apps/mobile/app/(app)/account-deletion.tsx", "utf8"),
    readFile("apps/mobile/src/lib/accountDeletion.ts", "utf8"),
    readFile("apps/mobile/src/providers/AuthProvider.tsx", "utf8"),
  ]);
  assert.match(settings, /Account und Daten löschen/u);
  assert.match(settings, /account-deletion/u);
  assert.match(screen, /requestAccountDeletion/u);
  assert.match(screen, /await signOut\(\)/u);
  assert.match(screen, /MOBILE_ACCOUNT_DELETION_CONFIRMATION_PHRASE/u);
  assert.match(screen, /https:\/\/fanmind\.ch\/account-deletion/u);
  assert.match(client, /Authorization: `Bearer \$\{accessToken\}`/u);
  assert.match(authProvider, /clearSecureLocalStorage/u);
  assert.doesNotMatch(
    `${settings}\n${screen}\n${client}`,
    /SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|STRIPE_SECRET_KEY/u,
  );
});

test("public Web resource links directly into the authenticated deletion flow", async () => {
  const [publicPage, protectedPage, profileSettings] = await Promise.all([
    readFile("src/app/account-deletion/page.tsx", "utf8"),
    readFile("src/app/settings/account-deletion/page.tsx", "utf8"),
    readFile("src/app/settings/AccountSections.tsx", "utf8"),
  ]);
  assert.match(publicPage, /FanMind-Account vollständig löschen/u);
  assert.match(publicPage, /returnTo=%2Fsettings%2Faccount-deletion/u);
  assert.match(publicPage, /30 Tagen/u);
  assert.match(protectedPage, /getSupabaseServerUser/u);
  assert.match(protectedPage, /AccountDeletionClient/u);
  assert.match(profileSettings, /href="\/settings\/account-deletion"/u);
});

test("manual processor defaults to redacted dry-run and performs no deletion", async () => {
  const { fetchImpl, calls } = makeProcessorFetch();
  const lines = [];
  const result = await processAccountDeletion({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    },
    requestId: REQUEST_ID,
    fetchImpl,
    log: (line) => lines.push(String(line)),
    now: new Date("2026-07-24T12:00:00.000Z"),
  });
  assert.equal(result.executed, false);
  assert.equal(result.eligibility.eligible, true);
  assert.equal(
    calls.some(
      (call) =>
        call.method === "DELETE" && call.url.includes("/auth/v1/admin/users/"),
    ),
    false,
  );
  const output = lines.join("\n");
  assert.match(output, /ACCOUNT_DELETION_MODE=dry_run/u);
  assert.match(output, /ACCOUNT_DELETION_RESULT=dry_run_success/u);
  assert.doesNotMatch(output, new RegExp(ACCOUNT_EMAIL, "u"));
  assert.doesNotMatch(output, new RegExp(USER_ID, "u"));
  assert.doesNotMatch(output, new RegExp(SERVICE_KEY, "u"));
});

test("manual processor requires both execution gate and exact request confirmation", async () => {
  const { fetchImpl, calls } = makeProcessorFetch();
  await assert.rejects(
    () =>
      processAccountDeletion({
        env: {
          NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
          FANMIND_ACCOUNT_DELETION_EXECUTION_ENABLED: "false",
        },
        requestId: REQUEST_ID,
        execute: true,
        confirmation: REQUEST_ID,
        fetchImpl,
        log: () => undefined,
      }),
    (error) =>
      error instanceof AccountDeletionProcessorError &&
      error.code === "execution_gate_disabled",
  );
  assert.equal(
    calls.some(
      (call) =>
        call.method === "DELETE" && call.url.includes("/auth/v1/admin/users/"),
    ),
    false,
  );
});

test("explicit eligible execution deletes only through Supabase Admin and retains a pseudonymous completion record", async () => {
  const { fetchImpl, calls } = makeProcessorFetch();
  const lines = [];
  const result = await processAccountDeletion({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
      FANMIND_ACCOUNT_DELETION_EXECUTION_ENABLED: "true",
      FANMIND_ACCOUNT_DELETION_HASH_SECRET: HASH_SECRET,
      RESEND_API_KEY: "resend-test-key-that-must-never-be-logged",
      FANMIND_NOTIFICATION_FROM: "FanMind <noreply@example.com>",
    },
    requestId: REQUEST_ID,
    execute: true,
    confirmation: REQUEST_ID,
    fetchImpl,
    log: (line) => lines.push(String(line)),
    now: new Date("2026-07-24T12:00:00.000Z"),
  });
  assert.equal(result.executed, true);
  assert.equal(result.finalStatus, "completed");
  const authDeletes = calls.filter(
    (call) =>
      call.method === "DELETE" && call.url.includes("/auth/v1/admin/users/"),
  );
  assert.equal(authDeletes.length, 1);
  for (const table of [
    "contacts",
    "conversations",
    "conversation_messages",
    "contact_ai_profiles",
    "creators",
    "creator_voice_profiles",
    "creator_sales_playbooks",
    "creator_commercial_events",
  ]) {
    assert.ok(
      calls.some(
        (call) =>
          call.method === "GET" &&
          call.url.includes(`/rest/v1/${table}?`) &&
          call.url.includes(`workspace_id=eq.${WORKSPACE_ID}`),
      ),
      `post-delete verification must cover ${table}`,
    );
  }
  const completionPatch = calls
    .filter(
      (call) =>
        call.method === "PATCH" &&
        call.url.includes("/rest/v1/account_deletion_requests"),
    )
    .map((call) => JSON.parse(String(call.body ?? "{}")))
    .find((body) => body.status === "completed");
  assert.ok(completionPatch);
  assert.equal(completionPatch.user_id, null);
  assert.equal(completionPatch.workspace_id, null);
  assert.equal(completionPatch.notification_email, null);
  assert.match(completionPatch.user_reference_hash, /^[0-9a-f]{64}$/u);
  const output = lines.join("\n");
  assert.match(output, /ACCOUNT_DELETION_RESULT=completed/u);
  assert.doesNotMatch(output, new RegExp(ACCOUNT_EMAIL, "u"));
  assert.doesNotMatch(output, new RegExp(USER_ID, "u"));
  assert.doesNotMatch(output, new RegExp(HASH_SECRET, "u"));
});

test("deployment installs the processor but no timer or automatic execution exists", async () => {
  const [deploy, processor] = await Promise.all([
    readFile(".github/workflows/deploy-fanmind.yml", "utf8"),
    readFile("scripts/operations/process-account-deletion.mjs", "utf8"),
  ]);
  assert.match(deploy, /process-account-deletion\.mjs/u);
  assert.doesNotMatch(deploy, /process-account-deletion\.mjs --execute/u);
  assert.doesNotMatch(deploy, /fanmind-account-deletion\.timer/u);
  assert.match(processor, /PROCESSABLE_STATUSES = new Set\(\["pending", "blocked", "processing"\]\)/u);
  assert.match(processor, /FANMIND_ACCOUNT_DELETION_EXECUTION_ENABLED/u);
  assert.match(processor, /confirmation !== requestId/u);
  assert.match(processor, /createHmac\("sha256"/u);
});
