import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  cleanupWorkerErrorCode,
  normalizeCleanupCount,
  normalizeCleanupErrorCodes,
  parseEnvText,
  runDemoCleanup,
} from "../scripts/operations/run-demo-cleanup.mjs";

const cleanupPolicyPath = "src/lib/demoCleanupPolicy.ts";
const supabaseServerPath = "src/lib/supabase/server.ts";
const cleanupRoutePath = "src/app/api/demo/cleanup/route.ts";
const demoStartRoutePath = "src/app/api/demo/start/route.ts";
const demoProtectionPath = "src/lib/demoProtection.ts";
const workspaceMigrationPath =
  "supabase/migrations/20260726120000_workspace_provisioning_rpc.sql";

test("parseEnvText reads quoted and unquoted values without comments", () => {
  const values = parseEnvText(`
# comment
FANMIND_PUBLIC_DEMO_ENABLED=false
FANMIND_DEMO_CLEANUP_SECRET="quoted-secret"
EMPTY=
`);

  assert.equal(values.get("FANMIND_PUBLIC_DEMO_ENABLED"), "false");
  assert.equal(values.get("FANMIND_DEMO_CLEANUP_SECRET"), "quoted-secret");
  assert.equal(values.get("EMPTY"), "");
});

test("normalizeCleanupErrorCodes accepts only bounded machine-readable codes", () => {
  assert.deepEqual(
    normalizeCleanupErrorCodes([
      "demo_delete_workspace_failed",
      "DEMO_DELETE_WORKSPACE_FAILED",
      "demo_identity_not_temporary",
      "contains spaces",
      "plausible_but_unknown_code",
      "secret=value",
      123,
      null,
    ]),
    ["demo_delete_workspace_failed", "demo_identity_not_temporary"],
  );
});

test("cleanup counts and worker exceptions are bounded before logging", () => {
  assert.equal(normalizeCleanupCount(0), 0);
  assert.equal(normalizeCleanupCount(100), 100);
  assert.equal(normalizeCleanupCount(101), null);
  assert.equal(normalizeCleanupCount("1"), null);
  assert.equal(normalizeCleanupCount(Number.NaN), null);
  assert.equal(
    cleanupWorkerErrorCode(
      Object.assign(new Error("token=live-secret"), {
        code: "demo_cleanup_request_failed",
      }),
    ),
    "demo_cleanup_request_failed",
  );
  assert.equal(
    cleanupWorkerErrorCode(new Error("token=live-secret\nhttps://private.example")),
    "demo_cleanup_failed",
  );
});

test("temporary demo cleanup deletes the workspace by primary key and preserves identity guards", async () => {
  const [policy, server, route] = await Promise.all([
    readFile(cleanupPolicyPath, "utf8"),
    readFile(supabaseServerPath, "utf8"),
    readFile(cleanupRoutePath, "utf8"),
  ]);

  assert.match(
    policy,
    /table:\s*"workspaces",\s*filterColumn:\s*"id",\s*optional:\s*false,\s*errorCode:\s*"demo_delete_workspace_failed"/su,
  );
  assert.doesNotMatch(
    policy,
    /table:\s*"workspaces",\s*filterColumn:\s*"workspace_id"/su,
  );
  assert.match(server, /DEMO_CLEANUP_DELETE_STEPS/u);
  assert.match(
    server,
    /postgrestDelete\(table, accessToken, \[\s*\[filterColumn, workspaceId\],?\s*\]\)/su,
  );
  assert.match(
    server,
    /serverIdentity\.authUserId !== user\.id[\s\S]*serverIdentity\.workspaceId !== workspace\.id[\s\S]*workspace\.owner_user_id !== serverIdentity\.authUserId[\s\S]*workspace\.billing_status !== "demo_free"[\s\S]*TEMPORARY_DEMO_ACCESS_FLAG/su,
  );
  assert.doesNotMatch(
    server,
    /workspace\.name !== TEMPORARY_DEMO_WORKSPACE_NAME/su,
  );
  assert.match(
    route,
    /id,name,owner_user_id,billing_status,test_access_flags/u,
  );
  assert.match(
    route,
    /authUserId: candidate\.authUserId[\s\S]*workspaceId: candidate\.workspaceId/u,
  );
  assert.match(route, /finishClaimedTemporaryDemoCleanup/u);
  assert.doesNotMatch(route, /orphaned_demo_identity/u);
  assert.doesNotMatch(route, /incomplete_cleanup_identity/u);
  assert.match(
    route,
    /candidate\.authUserId\s*\?\s*fetchAdminUser[\s\S]*candidate\.workspaceId\s*\?\s*fetchWorkspaceIdentity/u,
  );
  assert.match(
    server,
    /type TemporaryDemoServerIdentity = \{\s*authUserId: string \| null;\s*workspaceId: string \| null;\s*\}/u,
  );
  assert.match(
    server,
    /if \(workspace\)[\s\S]*if \(user\)/u,
  );
  assert.match(
    server,
    /export async function finishClaimedTemporaryDemoCleanup\([\s\S]*deleteServerVerifiedTemporaryDemo\([\s\S]*false/u,
  );
  assert.match(
    route,
    /deletion\.errorCode \?\? "demo_delete_failed"/u,
  );
});

test("pre-activation resources and stale cleanup leases remain recoverable", async () => {
  const [startRoute, protection, migration] = await Promise.all([
    readFile(demoStartRoutePath, "utf8"),
    readFile(demoProtectionPath, "utf8"),
    readFile(workspaceMigrationPath, "utf8"),
  ]);

  const userCreatedAt = startRoute.indexOf(
    "const userId = createdUser.id ?? createdUser.user?.id",
  );
  const authRecordedAt = startRoute.indexOf(
    "recordPublicDemoStartResources({",
    userCreatedAt,
  );
  const workspaceCreatedAt = startRoute.indexOf(
    "createTemporaryDemoWorkspace({",
    authRecordedAt,
  );
  const workspaceRecordedAt = startRoute.indexOf(
    "workspaceId: workspaceResult.workspace.id",
    workspaceCreatedAt,
  );
  const tokenCreatedAt = startRoute.indexOf(
    'getSupabaseAuthUrl("/token?grant_type=password")',
    workspaceRecordedAt,
  );

  assert.ok(userCreatedAt >= 0, "Auth user creation result missing");
  assert.ok(
    userCreatedAt < authRecordedAt &&
      authRecordedAt < workspaceCreatedAt &&
      workspaceCreatedAt < workspaceRecordedAt &&
      workspaceRecordedAt < tokenCreatedAt,
    "resource IDs must be persisted before later demo-start stages",
  );
  assert.match(
    protection,
    /export async function recordPublicDemoStartResources\([\s\S]*status", "eq\.reserved"[\s\S]*method: "PATCH"[\s\S]*Prefer: "return=representation"/u,
  );
  assert.match(
    startRoute,
    /settleFailedDemoStart\([\s\S]*cleanupSucceeded[\s\S]*authUserId[\s\S]*queuePublicDemoCleanup/u,
  );
  assert.match(
    protection,
    /export async function queuePublicDemoCleanup\([\s\S]*authUserId\?: string \| null[\s\S]*status: "cleanup_failed"[\s\S]*cleanup_started_at: null[\s\S]*auth_user_id: input\.authUserId[\s\S]*row\.auth_user_id === input\.authUserId/u,
  );
  assert.match(
    startRoute,
    /errorCode: "auth_user_record_failed"[\s\S]*authUserId: authDeleted \? null : userId/u,
  );
  assert.match(
    migration,
    /create or replace function public\.fail_public_demo_start[\s\S]*auth_user_id is not null or workspace_id is not null[\s\S]*then 'cleanup_failed'/u,
  );
  assert.match(
    migration,
    /create or replace function public\.claim_expired_demo_cleanup[\s\S]*'reserved'[\s\S]*session\.status = 'failed'[\s\S]*auth_user_id is not null[\s\S]*workspace_id is not null[\s\S]*status = 'cleanup_pending'[\s\S]*interval '15 minutes'/u,
  );
  assert.match(
    migration,
    /cleanup_started_at = statement_timestamp\(\)/u,
  );
});

test("runDemoCleanup skips safely when cleanup secret is missing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fanmind-demo-cleanup-"));
  const envFile = join(directory, ".env.production");
  await writeFile(envFile, "FANMIND_PUBLIC_DEMO_ENABLED=false\n", "utf8");

  let fetchCalled = false;
  const logs = [];
  try {
    const result = await runDemoCleanup({
      envFile,
      fetchImpl: async () => {
        fetchCalled = true;
        throw new Error("must not be called");
      },
      log: (message) => logs.push(message),
      errorLog: (message) => logs.push(message),
    });

    assert.equal(result.skipped, true);
    assert.equal(result.ok, true);
    assert.equal(result.reason, "secret_missing");
    assert.equal(fetchCalled, false);
    assert.match(logs.join("\n"), /cleanup secret is not configured/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("runDemoCleanup does not expose unreadable ENV paths or filesystem details", async () => {
  const logs = [];
  const sensitivePath = "/private/customer/token=live-secret/.env.production";
  const result = await runDemoCleanup({
    envFile: sensitivePath,
    errorLog: (message) => logs.push(message),
  });

  assert.deepEqual(result, {
    skipped: true,
    ok: false,
    reason: "env_unreadable",
  });
  assert.equal(logs.join("\n"), "FANMIND_DEMO_CLEANUP_SKIPPED=env_unreadable");
  assert.doesNotMatch(logs.join("\n"), /private|token|live-secret|ENOENT/u);
});

test("runDemoCleanup sends a bearer secret and reports counts", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fanmind-demo-cleanup-"));
  const envFile = join(directory, ".env.production");
  const secret = "a".repeat(64);
  await writeFile(
    envFile,
    `FANMIND_DEMO_CLEANUP_SECRET=${secret}\nFANMIND_DEMO_CLEANUP_LIMIT=12\n`,
    "utf8",
  );

  const logs = [];
  try {
    const result = await runDemoCleanup({
      envFile,
      cleanupUrl: "https://fanmind.example/api/demo/cleanup",
      fetchImpl: async (url, init) => {
        assert.equal(url, "https://fanmind.example/api/demo/cleanup");
        assert.equal(init.method, "POST");
        assert.equal(init.headers.Authorization, `Bearer ${secret}`);
        assert.deepEqual(JSON.parse(init.body), { limit: 12 });
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, claimed: 3, deleted: 3, failed: 0 }),
        };
      },
      log: (message) => logs.push(message),
    });

    assert.deepEqual(result, {
      skipped: false,
      ok: true,
      claimed: 3,
      deleted: 3,
      failed: 0,
    });
    assert.match(logs.join("\n"), /claimed=3 deleted=3 failed=0/u);
    assert.doesNotMatch(logs.join("\n"), new RegExp(secret, "u"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("runDemoCleanup reports only safe endpoint error codes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fanmind-demo-cleanup-"));
  const envFile = join(directory, ".env.production");
  await writeFile(
    envFile,
    `FANMIND_DEMO_CLEANUP_SECRET=${"b".repeat(64)}\n`,
    "utf8",
  );

  const logs = [];
  try {
    await assert.rejects(
      runDemoCleanup({
        envFile,
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            ok: false,
            claimed: 1,
            deleted: 0,
            failed: 1,
            errorCodes: [
              "demo_delete_workspace_failed",
              "unsafe code secret=value",
            ],
          }),
        }),
        log: (message) => logs.push(message),
      }),
      /demo_cleanup_items_failed/u,
    );

    const output = logs.join("\n");
    assert.match(output, /error_codes=demo_delete_workspace_failed/u);
    assert.doesNotMatch(output, /unsafe|secret=value/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("runDemoCleanup reduces network and malformed-response failures to fixed codes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fanmind-demo-cleanup-"));
  const envFile = join(directory, ".env.production");
  await writeFile(
    envFile,
    `FANMIND_DEMO_CLEANUP_SECRET=${"c".repeat(64)}\n`,
    "utf8",
  );

  try {
    await assert.rejects(
      runDemoCleanup({
        envFile,
        fetchImpl: async () => {
          throw new Error("token=live-secret https://private.example/customer");
        },
      }),
      (error) => {
        assert.equal(error.message, "demo_cleanup_request_failed");
        assert.doesNotMatch(error.message, /token|private|customer/u);
        return true;
      },
    );

    await assert.rejects(
      runDemoCleanup({
        envFile,
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            claimed: "1",
            deleted: 1,
            failed: 0,
          }),
        }),
      }),
      /demo_cleanup_response_invalid/u,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
