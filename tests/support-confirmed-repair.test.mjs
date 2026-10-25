import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

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
const connection = {
  id: "connection-1",
  platform: "facebook",
  status: "connected",
  last_messenger_sync_at: "2026-10-25T10:00:01.000Z",
  last_messenger_sync_error: null,
};

test("confirmed repair is rate limited before provider work", async () => {
  let syncCalls = 0;
  const result = await run(
    { platform: "facebook", connectionId: connection.id },
    {
      acquireRateLimit: async () => ({ allowed: false }),
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
  assert.equal(syncCalls, 0);
});

test("confirmed repair requires exact post-action connection evidence", async () => {
  const result = await run(
    { platform: "facebook", connectionId: connection.id },
    {
      acquireRateLimit: async () => ({ allowed: true }),
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

test("provider failure and partial continuation never claim success", async () => {
  for (const [sync, status] of [
    [{ ok: false }, "failed"],
    [{ ok: true, continuationPending: true }, "partial"],
  ]) {
    const result = await run(
      { platform: "instagram", connectionId: connection.id },
      {
        acquireRateLimit: async () => ({ allowed: true }),
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
    { platform: "facebook", connectionId: connection.id },
    {
      acquireRateLimit: async () => ({ allowed: true }),
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
  const audit = route.indexOf("await startRepairAuditEvent(");
  const execute = route.indexOf("await executeConfirmedMessageSyncRepair(");
  assert.ok(audit >= 0 && execute > audit);
  assert.match(route, /FANMIND_INAPP_HELP_REPAIR_ENABLED/u);
  assert.match(route, /body\.confirmed !== true/u);
  assert.match(route, /body\.requestId/u);
  assert.match(route, /restart_message_sync/u);
  assert.match(route, /expectedConnectionId: connection\.id/u);
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
  assert.match(server, /status", "eq\.started"/u);
  assert.match(server, /response\.status === 409/u);
  assert.match(sql, /request_id uuid not null unique/u);
  assert.match(sql, /alter table public\.support_repair_audit enable row level security/u);
  assert.match(sql, /revoke all .* from anon, authenticated/u);
});
