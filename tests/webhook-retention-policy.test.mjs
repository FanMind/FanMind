import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  parseRpcRow,
  runWebhookDiagnosticRetention,
} from "../scripts/operations/webhook-diagnostic-retention.mjs";

const migrationPath =
  "supabase/migrations/20260723184500_webhook_diagnostic_retention.sql";

test("retention migration is bounded, service-role only and cannot delete CRM data", async () => {
  const source = await readFile(migrationPath, "utf8");

  assert.match(source, /manage_meta_webhook_event_retention/u);
  assert.match(source, /p_execute boolean default false/u);
  assert.match(source, /limit p_limit[\s\S]*for update skip locked/u);
  assert.match(source, /p_limit > 5000/u);
  assert.match(source, /p_retention_days > 365/u);
  assert.match(source, /meta_webhook_events_minimized_diagnostic_check/u);
  assert.match(source, /not valid/u);
  assert.match(source, /page_id is null[\s\S]*message_text is null[\s\S]*message_id is null/u);
  assert.match(source, /jsonb_typeof\(raw_payload\) = 'object'/u);
  assert.match(
    source,
    /revoke all on function public\.manage_meta_webhook_event_retention[\s\S]*from public, anon, authenticated/u,
  );
  assert.match(
    source,
    /grant execute on function public\.manage_meta_webhook_event_retention[\s\S]*to service_role/u,
  );

  const deletedTables = [
    ...source.matchAll(/delete from public\.([a-z0-9_]+)/giu),
  ].map((match) => match[1]);
  assert.deepEqual(
    [...new Set(deletedTables)].sort(),
    ["meta_webhook_events", "server_error_events"],
  );
  assert.doesNotMatch(
    source,
    /delete from public\.(?:contacts|conversations|conversation_messages|memories|followups|workspaces|invoices|billing|backup)/iu,
  );
});

test("optional server-error retention reports an absent table without creating it", async () => {
  const source = await readFile(migrationPath, "utf8");

  assert.match(source, /to_regclass\('public\.server_error_events'\) is null/u);
  assert.match(source, /return query select false, 0, 0, false/u);
  assert.doesNotMatch(source, /create table[^;]*server_error_events/iu);
});

test("retention worker emits aggregates only and defaults to dry-run", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fanmind-webhook-retention-"));
  const envFile = path.join(directory, ".env.production");
  const serviceKey = "service-role-test-key-that-must-never-be-logged";
  const baseUrl = "https://exampleproject.supabase.co";
  await writeFile(
    envFile,
    [
      `NEXT_PUBLIC_SUPABASE_URL=${baseUrl}`,
      `SUPABASE_SERVICE_ROLE_KEY=${serviceKey}`,
      "FANMIND_WEBHOOK_DIAGNOSTIC_RETENTION_DAYS=30",
      "FANMIND_WEBHOOK_DIAGNOSTIC_DELETE_LIMIT=500",
      "",
    ].join("\n"),
    { mode: 0o600 },
  );

  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url).endsWith("manage_meta_webhook_event_retention")) {
      return new Response(
        JSON.stringify([
          {
            candidate_count: 12,
            deleted_count: 0,
            has_more: true,
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify([
        {
          table_present: false,
          candidate_count: 0,
          deleted_count: 0,
          has_more: false,
        },
      ]),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const lines = [];

  try {
    const result = await runWebhookDiagnosticRetention({
      envFile,
      execute: false,
      fetchImpl,
      log: (line) => lines.push(String(line)),
    });

    assert.equal(result.execute, false);
    assert.equal(result.meta.candidateCount, 12);
    assert.equal(result.meta.deletedCount, 0);
    assert.equal(result.serverError.tablePresent, false);
    assert.equal(requests.length, 2);
    for (const request of requests) {
      const body = JSON.parse(String(request.init.body));
      assert.equal(body.p_execute, false);
      assert.equal(body.p_retention_days, 30);
      assert.equal(body.p_limit, 500);
    }

    const output = lines.join("\n");
    assert.match(output, /WEBHOOK_RETENTION_MODE=dry_run/u);
    assert.match(output, /META_DIAGNOSTIC_CANDIDATES=12/u);
    assert.match(output, /SERVER_ERROR_TABLE_PRESENT=false/u);
    assert.doesNotMatch(output, new RegExp(serviceKey, "u"));
    assert.doesNotMatch(output, /exampleproject|supabase\.co/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("retention worker validates response bounds", () => {
  assert.deepEqual(
    parseRpcRow(
      {
        table_present: true,
        candidate_count: 500,
        deleted_count: 500,
        has_more: false,
      },
      "server_error",
    ),
    {
      tablePresent: true,
      candidateCount: 500,
      deletedCount: 500,
      hasMore: false,
    },
  );
  assert.throws(
    () =>
      parseRpcRow(
        {
          candidate_count: 5001,
          deleted_count: 0,
          has_more: false,
        },
        "meta",
      ),
    /meta_response_invalid/u,
  );
});

test("systemd timer stays install-only until migration verification", async () => {
  const [service, timer, deploy] = await Promise.all([
    readFile("ops/systemd/fanmind-webhook-retention.service", "utf8"),
    readFile("ops/systemd/fanmind-webhook-retention.timer", "utf8"),
    readFile(".github/workflows/deploy-fanmind.yml", "utf8"),
  ]);

  assert.match(service, /webhook-diagnostic-retention\.mjs --execute/u);
  assert.match(service, /NoNewPrivileges=true/u);
  assert.match(service, /ProtectSystem=strict/u);
  assert.match(timer, /OnCalendar=\*-\*-\* 03:40:00 UTC/u);
  assert.match(timer, /RandomizedDelaySec=15min/u);
  assert.match(deploy, /webhook-diagnostic-retention\.mjs/u);
  assert.match(deploy, /fanmind-webhook-retention\.timer/u);
  assert.match(
    deploy,
    /is-enabled --quiet fanmind-webhook-retention\.timer[\s\S]*intentionally not enabled before migration verification/u,
  );
  assert.doesNotMatch(
    deploy,
    /systemctl enable --now fanmind-webhook-retention\.timer/u,
  );
});

test("pm2-logrotate is the only PM2 rotation source and journald stays finite", async () => {
  const [runbook, journald, deploy] = await Promise.all([
    readFile("docs/security/WEBHOOK_LOG_RETENTION.md", "utf8"),
    readFile("ops/systemd/journald-fanmind.conf", "utf8"),
    readFile(".github/workflows/deploy-fanmind.yml", "utf8"),
  ]);

  await assert.rejects(
    access("ops/logrotate/fanmind-pm2"),
    (error) => error && typeof error === "object" && error.code === "ENOENT",
  );

  assert.match(runbook, /einzige zulässige PM2-Logrotationsquelle[\s\S]*`pm2-logrotate`/u);
  assert.match(runbook, /maximale Dateigröße: 10 MiB/u);
  assert.match(runbook, /Aufbewahrung: 14 Rotationen/u);
  assert.match(runbook, /Kompression: aktiv/u);
  assert.match(runbook, /keine Production-Datei `\/etc\/logrotate\.d\/fanmind-pm2`/u);
  assert.match(runbook, /niemals gleichzeitig ein PM2-Modul und eine systemweite Logrotate-Regel/u);

  assert.doesNotMatch(deploy, /ops\/logrotate\/fanmind-pm2/u);
  assert.doesNotMatch(deploy, /\/etc\/logrotate\.d\/fanmind-pm2/u);

  assert.match(journald, /SystemMaxUse=512M/u);
  assert.match(journald, /RuntimeMaxUse=128M/u);
  assert.match(journald, /MaxRetentionSec=14day/u);
  assert.match(journald, /Compress=yes/u);
});
