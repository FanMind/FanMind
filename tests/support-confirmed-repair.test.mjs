import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { canManageMetaConnections } from "../src/lib/metaIntegrationPolicy.mjs";

function loadRepair() {
  const exports = {};
  const code = ts.transpileModule(
    readFileSync("src/lib/supportConfirmedRepair.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  runInNewContext(code, { exports });
  return exports.executeConfirmedMessageSyncRepair;
}

const run = loadRepair();
const now = new Date("2026-10-25T10:00:00.000Z");
function auditDependencies() {
  return {
    startAudit: async () => {},
    completeAudit: async () => {},
  };
}

const workspaceId = "workspace-1";
const connection = {
  id: "connection-1",
  workspace_id: workspaceId,
  platform: "facebook",
  status: "connected",
  last_messenger_sync_at: "2026-10-25T10:00:01.000Z",
  last_messenger_sync_error: null,
};

test("confirmed repair is rate limited before audit and provider work", async () => {
  let auditCalls = 0;
  let syncCalls = 0;
  const result = await run(
    { platform: "facebook", workspaceId, connectionId: connection.id },
    {
      acquireRateLimit: async () => ({ allowed: false }),
      startAudit: async () => {
        auditCalls += 1;
      },
      completeAudit: async () => {},
      syncMessages: async () => {
        syncCalls += 1;
        return { ok: true };
      },
      readConnections: async () => ({ connections: [connection], error: null }),
      now: () => now,
    },
  );
  assert.deepEqual(result, {
    status: "rate_limited",
    repairExecuted: false,
    verified: false,
  });
  assert.equal(auditCalls, 0);
  assert.equal(syncCalls, 0);
});

test("audit start failure blocks provider work", async () => {
  let syncCalls = 0;
  const result = await run(
    { platform: "facebook", workspaceId, connectionId: connection.id },
    {
      acquireRateLimit: async () => ({ allowed: true }),
      startAudit: async () => {
        throw new Error("repair_audit_write_failed");
      },
      completeAudit: async () => {},
      syncMessages: async () => {
        syncCalls += 1;
        return { ok: true };
      },
      readConnections: async () => ({ connections: [connection], error: null }),
      now: () => now,
    },
  );
  assert.equal(result.status, "unavailable");
  assert.equal(result.repairExecuted, false);
  assert.equal(syncCalls, 0);
});

test("duplicate request blocks provider work", async () => {
  let syncCalls = 0;
  const result = await run(
    { platform: "facebook", workspaceId, connectionId: connection.id },
    {
      acquireRateLimit: async () => ({ allowed: true }),
      startAudit: async () => {
        throw new Error("repair_request_replayed");
      },
      completeAudit: async () => {},
      syncMessages: async () => {
        syncCalls += 1;
        return { ok: true };
      },
      readConnections: async () => ({ connections: [connection], error: null }),
      now: () => now,
    },
  );
  assert.equal(result.status, "replayed");
  assert.equal(result.repairExecuted, false);
  assert.equal(syncCalls, 0);
});

test("terminal audit retries fail closed without claiming success", async () => {
  let completionCalls = 0;
  const result = await run(
    { platform: "facebook", workspaceId, connectionId: connection.id },
    {
      acquireRateLimit: async () => ({ allowed: true }),
      startAudit: async () => {},
      completeAudit: async () => {
        completionCalls += 1;
        throw new Error("audit unavailable");
      },
      syncMessages: async () => ({ ok: true }),
      readConnections: async () => ({ connections: [connection], error: null }),
      now: () => now,
    },
  );
  assert.equal(completionCalls, 3);
  assert.deepEqual(result, {
    status: "audit_incomplete",
    repairExecuted: true,
    verified: false,
  });
});

test("confirmed repair requires exact post-action connection evidence", async () => {
  const result = await run(
    { platform: "facebook", workspaceId, connectionId: connection.id },
    {
      acquireRateLimit: async () => ({ allowed: true }),
      ...auditDependencies(),
      syncMessages: async () => ({ ok: true }),
      readConnections: async () => ({
        connections: [{ ...connection, id: "foreign-connection" }],
        error: null,
      }),
      now: () => now,
    },
  );
  assert.deepEqual(result, {
    status: "verification_failed",
    repairExecuted: true,
    verified: false,
  });
});

test("postcheck rejects stale, errored, disconnected, duplicate, and wrong-platform evidence", async () => {
  const variants = [
    [{ ...connection, last_messenger_sync_at: "2026-10-25T09:59:59.000Z" }],
    [{ ...connection, last_messenger_sync_error: "still failing" }],
    [{ ...connection, status: "disconnected" }],
    [connection, { ...connection }],
    [{ ...connection, platform: "instagram" }],
    [{ ...connection, workspace_id: "foreign-workspace" }],
  ];
  for (const connections of variants) {
    const result = await run(
      { platform: "facebook", workspaceId, connectionId: connection.id },
      {
        acquireRateLimit: async () => ({ allowed: true }),
        ...auditDependencies(),
        syncMessages: async () => ({ ok: true }),
        readConnections: async () => ({ connections, error: null }),
        now: () => now,
      },
    );
    assert.equal(result.status, "verification_failed");
    assert.equal(result.verified, false);
  }
});

test("only owner and admin roles can manage a repair", () => {
  assert.equal(canManageMetaConnections("owner"), true);
  assert.equal(canManageMetaConnections("admin"), true);
  for (const role of ["member", "viewer", "", null, "platform_admin"]) {
    assert.equal(canManageMetaConnections(role), false);
  }
});

test("provider timeout is recorded as failed and never verified", async () => {
  const completions = [];
  const result = await run(
    { platform: "facebook", workspaceId, connectionId: connection.id },
    {
      acquireRateLimit: async () => ({ allowed: true }),
      startAudit: async () => {},
      completeAudit: async (status) => {
        completions.push(status);
      },
      syncMessages: async () => {
        throw new Error("meta_sync_timeout");
      },
      readConnections: async () => ({ connections: [connection], error: null }),
      now: () => now,
    },
  );
  assert.deepEqual(completions, ["failed"]);
  assert.deepEqual(result, {
    status: "failed",
    repairExecuted: true,
    verified: false,
  });
});

test("successful flow preserves rate-audit-provider-postcheck-terminal order", async () => {
  const events = [];
  const result = await run(
    { platform: "facebook", workspaceId, connectionId: connection.id },
    {
      acquireRateLimit: async () => {
        events.push("rate");
        return { allowed: true };
      },
      startAudit: async () => {
        events.push("started");
      },
      completeAudit: async (status) => {
        events.push(`completed:${status}`);
      },
      syncMessages: async () => {
        events.push("provider");
        return { ok: true };
      },
      readConnections: async () => {
        events.push("postcheck");
        return { connections: [connection], error: null };
      },
      now: () => now,
    },
  );
  assert.equal(result.status, "succeeded");
  assert.deepEqual(events, [
    "rate",
    "started",
    "provider",
    "postcheck",
    "completed:succeeded",
  ]);
});

test("provider failure and partial continuation never claim success", async () => {
  for (const [sync, status] of [
    [{ ok: false }, "failed"],
    [{ ok: true, continuationPending: true }, "partial"],
  ]) {
    const result = await run(
      { platform: "instagram", workspaceId, connectionId: connection.id },
      {
        acquireRateLimit: async () => ({ allowed: true }),
        ...auditDependencies(),
        syncMessages: async () => sync,
        readConnections: async () => ({
          connections: [{ ...connection, platform: "instagram" }],
          error: null,
        }),
        now: () => now,
      },
    );
    assert.equal(result.status, status);
    assert.equal(result.verified, false);
  }
});

test("successful repair is bound to a fresh exact postcheck", async () => {
  const result = await run(
    { platform: "facebook", workspaceId, connectionId: connection.id },
    {
      acquireRateLimit: async () => ({ allowed: true }),
      ...auditDependencies(),
      syncMessages: async () => ({ ok: true, continuationPending: false }),
      readConnections: async () => ({ connections: [connection], error: null }),
      now: () => now,
    },
  );
  assert.deepEqual(result, {
    status: "succeeded",
    repairExecuted: true,
    verified: true,
  });
});

test("route audits before execution and keeps protected actions out", () => {
  const route = readFileSync(
    "src/app/api/support/repair-request/route.ts",
    "utf8",
  );
  const role = route.indexOf("!canManageMetaConnections(");
  const entitlement = route.indexOf(
    "const entitlement = await getWorkspaceProcessingEntitlement(",
  );
  const acquire = route.indexOf("acquireRateLimit:");
  const audit = route.indexOf("startAudit:");
  const execute = route.indexOf("syncMessages:");
  assert.ok(
    role >= 0 &&
      entitlement > role &&
      acquire > entitlement &&
      audit > acquire &&
      execute > audit,
  );
  assert.match(route, /FANMIND_INAPP_HELP_REPAIR_ENABLED/u);
  assert.match(route, /body\.confirmed !== true/u);
  assert.match(route, /body\.requestId/u);
  assert.match(route, /restart_message_sync/u);
  assert.match(route, /\{ platform, workspaceId, connectionId: connection\.id \}/u);
  assert.match(route, /connection\.workspace_id === workspaceId/u);
  assert.match(route, /expectedConnectionId: connection\.id/u);
  assert.equal(route.match(/connection_id: connection\.id/gu)?.length, 2);
  assert.doesNotMatch(route, /renew_authorization|replace_credentials/u);
  assert.match(route, /maxRequests:\s*1/u);
  assert.match(route, /windowMs:\s*15 \* 60 \* 1000/u);
});

test("sync entrypoints bind provider work to the exact connection", () => {
  const facebook = readFileSync(
    "src/app/channels/facebookWebhookActions.ts",
    "utf8",
  );
  const instagram = readFileSync(
    "src/app/channels/instagramWebhookActions.ts",
    "utf8",
  );
  for (const source of [facebook, instagram]) {
    assert.match(source, /input\?\.expectedConnectionId/u);
    assert.match(source, /entry\.id === expectedConnectionId/u);
  }
});

test("audit transition and draft schema block replay", () => {
  const server = readFileSync(
    "src/lib/supportRepairAuditServer.ts",
    "utf8",
  );
  const sql = readFileSync(
    "docs/operations/sql/support_repair_audit_draft.sql",
    "utf8",
  );
  assert.match(server, /method: "PATCH"/u);
  assert.match(server, /connection_id", `eq\.\$\{record\.connection_id\}`/u);
  assert.match(server, /platform", `eq\.\$\{record\.platform\}`/u);
  assert.match(server, /action", `eq\.\$\{record\.action\}`/u);
  assert.match(server, /in\.\(started,\$\{record\.status\}\)/u);
  assert.match(server, /response\.status === 409/u);
  assert.match(sql, /request_id uuid not null unique/u);
  assert.match(sql, /connection_id uuid not null/u);
  assert.match(sql, /alter table public\.support_repair_audit enable row level security/u);
  assert.match(sql, /revoke all .* from anon, authenticated/u);
});

test("support UI requires consent, explains the repair, and exposes no secrets", () => {
  const launcher = readFileSync(
    "src/components/WorkspaceHelpLauncher.tsx",
    "utf8",
  );
  const diagnostics = readFileSync(
    "src/app/api/support/diagnostics/route.ts",
    "utf8",
  );
  assert.match(launcher, /if \(!repairConsent \|\| !repairRequestId\) return/u);
  assert.match(launcher, /confirmed: true/u);
  assert.match(
    launcher,
    /FanMind hat einen Fehler bei der Nachrichtensynchronisierung/u,
  );
  assert.match(launcher, /Zugangsdaten, Berechtigungen oder Provider-Einstellungen/u);
  assert.match(launcher, /nicht sicher bestätigt/u);
  assert.doesNotMatch(diagnostics, /page_access_token_encrypted|SUPABASE_SERVICE_ROLE_KEY/u);
  assert.doesNotMatch(diagnostics, /last_messenger_sync_error\s*[,}]/u);
});

test("staging schema verifier is read-only and classifies absent or drifted state", () => {
  const verifier = readFileSync(
    "docs/operations/sql/support_repair_audit_verify.sql",
    "utf8",
  );
  assert.match(verifier, /begin transaction read only/iu);
  assert.match(verifier, /SUPPORT_REPAIR_AUDIT_SCHEMA_STATE/u);
  assert.match(verifier, /ABSENT/u);
  assert.match(verifier, /INSTALLED/u);
  assert.match(verifier, /DRIFT/u);
  assert.match(verifier, /column_default is not distinct from e\.column_default/u);
  assert.match(verifier, /pg_get_constraintdef\(c\.oid\) = e\.definition/u);
  assert.match(verifier, /i\.indexdef = e\.definition/u);
  assert.match(verifier, /from pg_policy p/u);
  assert.match(verifier, /coalesce\(sec\.no_policies, false\)/u);
  assert.match(verifier, /support_repair_audit_platform_check/u);
  assert.match(verifier, /support_repair_audit_status_check/u);
  assert.match(verifier, /SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER/u);
  assert.doesNotMatch(
    verifier,
    /^\s*(create|alter|drop|insert|update|delete|grant|revoke|truncate)\b/imu,
  );
});

