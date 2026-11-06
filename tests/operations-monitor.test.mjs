import assert from "node:assert/strict";
import test from "node:test";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const monitor = await import("../scripts/operations/operations-monitor.mjs");
const lifecycle = await import("../scripts/operations/operations-monitor-lifecycle.mjs");
const probeLogVerifier = await import("../scripts/operations/verify-operations-monitor-probe-log.mjs");
const lifecycleLogVerifier = await import("../scripts/operations/verify-operations-monitor-lifecycle-log.mjs");
const migrationLogVerifier = await import("../scripts/operations/verify-operations-monitor-migration-log.mjs");
const migrationRunner = await import("../scripts/operations/operations-monitor-migration-runner.mjs");
const source = await readFile(new URL("../scripts/operations/operations-monitor.mjs", import.meta.url), "utf8");
const service = await readFile(new URL("../ops/systemd/fanmind-operations-monitor.service", import.meta.url), "utf8");
const probeService = await readFile(new URL("../ops/systemd/fanmind-operations-monitor-probe.service", import.meta.url), "utf8");
const lifecycleService = await readFile(new URL("../ops/systemd/fanmind-operations-monitor-lifecycle.service", import.meta.url), "utf8");
const timer = await readFile(new URL("../ops/systemd/fanmind-operations-monitor.timer", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260718190000_operations_monitor_components.sql", import.meta.url), "utf8");
const productionControl = await readFile(new URL("../.github/workflows/operations-monitor-production-control.yml", import.meta.url), "utf8");
const migrationControl = await readFile(new URL("../.github/workflows/operations-monitor-production-migration.yml", import.meta.url), "utf8");
const migrationService = await readFile(new URL("../ops/systemd/fanmind-operations-monitor-migration@.service", import.meta.url), "utf8");
const deployment = await readFile(new URL("../.github/workflows/deploy-fanmind.yml", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const enableScriptPath = "scripts/operations/enable-operations-monitor.sh";
const enableScript = await readFile(new URL("../scripts/operations/enable-operations-monitor.sh", import.meta.url), "utf8");
const execFileAsync = promisify(execFile);

function lifecycleFetchStore() {
  const events = [];
  const notifications = [];
  const audits = [];
  let sequence = 0;
  const timestamp = () => new Date(Date.now() + (++sequence * 10)).toISOString();
  const response = (payload, status = 200) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });
  const parseBody = (init) => JSON.parse(String(init?.body ?? "{}"));

  const fetchImpl = async (input, init = {}) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").pop();
    const method = String(init.method ?? "GET").toUpperCase();
    if (table === "system_health_events") {
      if (method === "POST") {
        const row = { id: `event-${sequence + 1}`, created_at: timestamp(), ...parseBody(init) };
        events.push(row);
        return response([row], 201);
      }
      const component = url.searchParams.get("component")?.replace(/^eq\./u, "");
      return response([...events].reverse().filter((row) => !component || row.component === component));
    }
    if (table === "admin_notifications") {
      if (method === "POST") {
        const row = { id: `notification-${sequence + 1}`, created_at: timestamp(), ...parseBody(init) };
        notifications.push(row);
        return response([row], 201);
      }
      if (method === "PATCH") {
        const id = url.searchParams.get("id")?.replace(/^eq\./u, "");
        const row = notifications.find((item) => item.id === id);
        if (!row) return response({ code: "not_found" }, 404);
        Object.assign(row, parseBody(init));
        return response([row]);
      }
      const activeOnly = url.searchParams.has("status");
      const rows = [...notifications].reverse().filter((row) =>
        !activeOnly || ["open", "read", "acknowledged"].includes(row.status)
      );
      return response(rows);
    }
    if (table === "operations_audit_log") {
      if (method === "POST") {
        const row = { id: `audit-${sequence + 1}`, created_at: timestamp(), ...parseBody(init) };
        audits.push(row);
        return response([row], 201);
      }
      return response([...audits].reverse().slice(0, 10));
    }
    return response({ code: "unexpected_table" }, 404);
  };

  return { audits, events, fetchImpl, notifications };
}

test("operations monitor remains disabled unless explicitly enabled", () => {
  assert.equal(monitor.monitorEnabled({}), false);
  assert.equal(monitor.monitorEnabled({ FANMIND_OPERATIONS_MONITOR_ENABLED: "false" }), false);
  assert.equal(monitor.monitorEnabled({ FANMIND_OPERATIONS_MONITOR_ENABLED: "true" }), true);
});

test("the production probe can require every collected check to stay healthy", () => {
  assert.doesNotThrow(() => monitor.requireHealthyChecks([{ status: "healthy" }], { FANMIND_OPERATIONS_REQUIRE_HEALTHY: "true" }));
  assert.throws(
    () => monitor.requireHealthyChecks([{ component: "application", status: "healthy" }, { component: "pm2", status: "degraded" }], { FANMIND_OPERATIONS_REQUIRE_HEALTHY: "true" }),
    /operations_monitor_health_gate_failed\|pm2:degraded/,
  );
  assert.doesNotThrow(() => monitor.requireHealthyChecks([{ status: "degraded" }], {}));
});

test("the probe journal verifier exposes only allowlisted technical status", () => {
  const notBefore = "2026-07-31T20:52:11.000Z";
  const source = [
    "unrelated journal text",
    JSON.stringify({
      ts: "2026-07-31T20:52:12.000Z",
      level: "error",
      event: "monitor_failed",
      version: "fanmind-operations-monitor-1",
      error_code: "operations_monitor_health_gate_failed|pm2:unavailable,backup_worker:degraded",
      secret: "must-not-be-output",
    }),
  ].join("\n");
  const result = probeLogVerifier.verifyOperationsMonitorProbeLog(source, notBefore);
  assert.deepEqual(result, {
    diagnosis: "health_gate",
    checks: ["backup_worker:degraded", "pm2:unavailable"],
  });
  const output = probeLogVerifier.formatOperationsMonitorProbeDiagnostic(result);
  assert.equal(
    output,
    "OPERATIONS_MONITOR_PROBE_DIAGNOSIS=health_gate\n" +
      "OPERATIONS_MONITOR_UNHEALTHY_CHECK=backup_worker:degraded\n" +
      "OPERATIONS_MONITOR_UNHEALTHY_CHECK=pm2:unavailable\n",
  );
  assert.doesNotMatch(output, /secret|must-not-be-output/u);
});

test("the monitor log replaces unexpected exception text with a generic code", () => {
  assert.equal(monitor.operationsErrorCode(new Error("token=should-never-appear")), "operations_monitor_failed");
  assert.equal(
    monitor.operationsErrorCode(new Error("operations_monitor_health_gate_failed|host_disk:degraded")),
    "operations_monitor_health_gate_failed|host_disk:degraded",
  );
});

test("the lifecycle log verifier exposes only one allowlisted failure code", () => {
  const notBefore = "2026-08-01T09:30:00.000Z";
  const source = [
    "unrelated journal text",
    JSON.stringify({
      ts: "2026-08-01T09:30:01.000Z",
      level: "error",
      event: "lifecycle_failed",
      version: "fanmind-operations-monitor-lifecycle-1",
      error_code: "operations_monitor_lifecycle_recovery_state",
      secret: "must-not-be-output",
    }),
  ].join("\n");
  const result = lifecycleLogVerifier.verifyOperationsMonitorLifecycleLog(source, notBefore);
  assert.deepEqual(result, {
    status: "failed",
    errorCode: "operations_monitor_lifecycle_recovery_state",
  });
  const output = lifecycleLogVerifier.formatOperationsMonitorLifecycleDiagnostic(result);
  assert.equal(
    output,
    "OPERATIONS_MONITOR_LIFECYCLE=failed\n" +
      "OPERATIONS_MONITOR_LIFECYCLE_ERROR=operations_monitor_lifecycle_recovery_state\n",
  );
  assert.doesNotMatch(output, /secret|must-not-be-output/u);
});

test("email-disabled lifecycle opens one warning, escalates it and resolves the same notification", async () => {
  const store = lifecycleFetchStore();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = store.fetchImpl;
  try {
    const result = await monitor.runLifecycleAcceptance({
      FANMIND_OPERATIONS_LIFECYCLE_ACCEPTANCE_ACK: "operations-monitor-production-lifecycle",
      FANMIND_OPERATIONS_MONITOR_ENABLED: "true",
      FANMIND_OPERATIONS_EMAIL_ENABLED: "false",
      NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-only-service-role",
    });
    assert.deepEqual(result, {
      component: "operations_monitor",
      transitions: ["warning", "critical", "recovered"],
      emailEnabled: false,
    });
    assert.deepEqual(store.events.map((row) => row.status), [
      "healthy",
      "degraded",
      "unavailable",
      "healthy",
    ]);
    assert.equal(store.notifications.length, 1);
    assert.equal(store.notifications[0].status, "resolved");
    assert.equal(store.notifications[0].severity, "resolved");
    assert.deepEqual(store.audits.map((row) => [row.outcome, row.metadata.reason]), [
      ["noop", "disabled"],
      ["noop", "disabled"],
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("lifecycle acceptance requires explicit email-off and a fixed acknowledgement", async () => {
  await assert.rejects(
    monitor.runLifecycleAcceptance({}),
    /operations_monitor_lifecycle_contract/u,
  );
  await assert.rejects(
    monitor.runLifecycleAcceptance({
      FANMIND_OPERATIONS_LIFECYCLE_ACCEPTANCE_ACK: "operations-monitor-production-lifecycle",
      FANMIND_OPERATIONS_MONITOR_ENABLED: "true",
      FANMIND_OPERATIONS_EMAIL_ENABLED: "true",
    }),
    /operations_monitor_lifecycle_email_not_disabled/u,
  );
  assert.equal(
    lifecycle.lifecycleErrorCode(new Error("private-value-must-not-escape")),
    "operations_monitor_failed",
  );
});

test("the migration diagnostic exposes only allowlisted schema status", () => {
  const notBefore = "2026-08-01T06:00:00.000Z";
  const source = [
    "unrelated systemd text",
    JSON.stringify({
      ts: "2026-08-01T06:00:01.000Z",
      version: "fanmind-operations-monitor-migration-1",
      level: "error",
      event: "migration_failed",
      action: "apply",
      error_code: "schema_not_ready",
      secret: "must-not-be-output",
    }),
  ].join("\n");
  const result = migrationLogVerifier.verifyOperationsMonitorMigrationLog(
    source,
    notBefore,
    "apply",
  );
  assert.deepEqual(result, {
    action: "apply",
    status: "failed",
    errorCode: "schema_not_ready",
  });
  const output = migrationLogVerifier.formatOperationsMonitorMigrationDiagnostic(result);
  assert.equal(
    output,
    "OPERATIONS_MONITOR_MIGRATION_ACTION=apply\n" +
      "OPERATIONS_MONITOR_MIGRATION_RESULT=failed\n" +
      "OPERATIONS_MONITOR_MIGRATION_ERROR=schema_not_ready\n",
  );
  assert.doesNotMatch(output, /secret|must-not-be-output/u);
});

test("disk and memory thresholds distinguish normal, warning and critical states", () => {
  assert.deepEqual(monitor.classifyPercent(50, 80, 90), { status: "healthy", severity: "info" });
  assert.deepEqual(monitor.classifyPercent(85, 80, 90), { status: "degraded", severity: "warning" });
  assert.deepEqual(monitor.classifyPercent(95, 80, 90), { status: "unavailable", severity: "critical" });
});

test("SSL and backup-age thresholds escalate only at configured boundaries", () => {
  assert.deepEqual(monitor.classifyRemainingDays(45, 30, 7), { status: "healthy", severity: "info" });
  assert.deepEqual(monitor.classifyRemainingDays(20, 30, 7), { status: "degraded", severity: "warning" });
  assert.deepEqual(monitor.classifyRemainingDays(3, 30, 7), { status: "unavailable", severity: "critical" });
  assert.deepEqual(monitor.classifyAgeHours(12, 36), { status: "healthy", severity: "info" });
  assert.deepEqual(monitor.classifyAgeHours(40, 36), { status: "degraded", severity: "warning" });
  assert.deepEqual(monitor.classifyAgeHours(80, 36), { status: "unavailable", severity: "critical" });
});

test("backup freshness reports all required backup types without file paths", () => {
  const now = Date.parse("2026-07-18T12:00:00.000Z");
  const rows = [
    { backup_type: "database", finished_at: "2026-07-18T06:00:00.000Z" },
    { backup_type: "storage", finished_at: "2026-07-18T05:00:00.000Z" },
    { backup_type: "server_config", finished_at: "2026-07-18T04:00:00.000Z" },
    { backup_type: "full", finished_at: "2026-07-15T12:00:00.000Z" },
  ];
  const result = monitor.classifyBackupFreshness(rows, now, {});
  assert.equal(result.status, "healthy");
  assert.match(result.summary, /database/);
  assert.match(result.summary, /storage/);
  assert.match(result.summary, /server_config/);
  assert.match(result.summary, /full/);
  assert.doesNotMatch(result.summary, /\/var\/|storage_reference|checksum_reference/);
});

test("notification transition opens once, escalates, resolves and avoids duplicate email storms", () => {
  assert.deepEqual(
    monitor.notificationTransition({ previousStatus: "healthy", currentStatus: "degraded", hasActiveNotification: false }),
    { event: "degraded", notification: "open", sendEmail: false },
  );
  assert.deepEqual(
    monitor.notificationTransition({ previousStatus: "degraded", currentStatus: "degraded", hasActiveNotification: true, activeSeverity: "warning" }),
    { event: "steady", notification: "none", sendEmail: false },
  );
  assert.deepEqual(
    monitor.notificationTransition({ previousStatus: "degraded", currentStatus: "unavailable", hasActiveNotification: true, activeSeverity: "warning" }),
    { event: "escalated", notification: "reopen", sendEmail: true },
  );
  assert.deepEqual(
    monitor.notificationTransition({ previousStatus: "unavailable", currentStatus: "healthy", hasActiveNotification: true, activeSeverity: "critical" }),
    { event: "recovered", notification: "resolve", sendEmail: true },
  );
});

test("operations email is fail-closed and recipients are validated", () => {
  assert.deepEqual(monitor.operationsEmailConfig({}), { enabled: false, reason: "disabled", recipients: [] });
  const incomplete = monitor.operationsEmailConfig({ FANMIND_OPERATIONS_EMAIL_ENABLED: "true", FANMIND_ADMIN_EMAILS: "admin@example.com" });
  assert.equal(incomplete.enabled, false);
  assert.equal(incomplete.reason, "incomplete");
  const configured = monitor.operationsEmailConfig({
    FANMIND_OPERATIONS_EMAIL_ENABLED: "true",
    FANMIND_ADMIN_EMAILS: "Admin@Example.com,invalid,admin@example.com,second@example.com",
    RESEND_API_KEY: "test-only",
    FANMIND_NOTIFICATION_FROM: "FanMind <noreply@fanmind.ch>",
  });
  assert.equal(configured.enabled, true);
  assert.deepEqual(configured.recipients, ["admin@example.com", "second@example.com"]);
});

test("PM2 parsing accepts only the configured online app", () => {
  const online = monitor.parsePm2Status(JSON.stringify([{ name: "fanmind", pm2_env: { status: "online" } }]));
  assert.deepEqual(online, { status: "healthy", processStatus: "online" });
  const stopped = monitor.parsePm2Status(JSON.stringify([{ name: "fanmind", pm2_env: { status: "stopped" } }]));
  assert.deepEqual(stopped, { status: "unavailable", processStatus: "stopped" });
  assert.deepEqual(monitor.parsePm2Status("invalid"), { status: "unknown", processStatus: "unreadable" });
});

test("nginx monitoring stores only a normalized read-only service state", async () => {
  const calls = [];
  const active = await monitor.checkNginx(async (command, args) => {
    calls.push([command, args]);
    return "active\n";
  });
  assert.deepEqual(calls, [["/usr/bin/systemctl", ["is-active", "nginx.service"]]]);
  assert.equal(active.component, "nginx");
  assert.equal(active.status, "healthy");
  assert.equal(active.severity, "info");
  assert.deepEqual(active.metadata, { service_status: "active" });
  assert.doesNotMatch(active.summary, /path|config|journal|secret/u);

  assert.deepEqual(monitor.parseSystemdServiceStatus("activating\n"), {
    status: "degraded",
    serviceStatus: "activating",
  });
  assert.deepEqual(monitor.parseSystemdServiceStatus("failed\n"), {
    status: "unavailable",
    serviceStatus: "failed",
  });
  assert.deepEqual(monitor.parseSystemdServiceStatus("private-output\n"), {
    status: "unknown",
    serviceStatus: "unreadable",
  });

  const unavailable = await monitor.checkNginx(async () => {
    throw new Error("private-command-error");
  });
  assert.equal(unavailable.status, "unavailable");
  assert.deepEqual(unavailable.metadata, { service_status: "unavailable" });
  assert.doesNotMatch(JSON.stringify(unavailable), /private-command-error/u);
});

test("monitor source never reads customer content tables or logs environment values", () => {
  assert.doesNotMatch(source, /rest\(["'](?:contacts|messages|contact_memories|ai_generations|workspace_members)/);
  assert.doesNotMatch(source, /console\.log\([^\n]*(?:process\.env|RESEND_API_KEY|SUPABASE_SERVICE_ROLE_KEY)/);
  assert.match(source, /metadata: \{ component:/);
  assert.match(source, /Operations Center: https:\/\/fanmind\.ch\/admin\/operations/);
});

test("systemd monitor is hardened and timer stays opt-in", () => {
  assert.match(service, /User=ubuntu/);
  assert.match(service, /ExecStart=\/usr\/bin\/flock --exclusive --wait 120 \/run\/lock\/fanmind-operations-monitor\.lock \/usr\/bin\/node \/usr\/local\/lib\/fanmind-monitor\/operations-monitor\.mjs/);
  assert.match(service, /NoNewPrivileges=true/);
  assert.match(service, /PrivateTmp=true/);
  assert.match(service, /ProtectSystem=strict/);
  assert.match(service, /ProtectHome=read-only/);
  assert.match(service, /ReadWritePaths=\/run\/lock/);
  assert.match(service, /RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6/);
  assert.match(timer, /OnUnitActiveSec=10min/);
  assert.doesNotMatch(service, /FANMIND_OPERATIONS_MONITOR_ENABLED=true/);

  assert.match(probeService, /Type=oneshot/);
  assert.match(probeService, /Environment=FANMIND_OPERATIONS_MONITOR_ENABLED=true/);
  assert.match(probeService, /Environment=FANMIND_OPERATIONS_EMAIL_ENABLED=false/);
  assert.match(probeService, /Environment=FANMIND_OPERATIONS_REQUIRE_HEALTHY=true/);
  assert.match(probeService, /ExecStart=\/usr\/bin\/flock --exclusive --wait 120 \/run\/lock\/fanmind-operations-monitor\.lock \/usr\/bin\/node \/usr\/local\/lib\/fanmind-monitor\/operations-monitor\.mjs/);
  assert.match(probeService, /NoNewPrivileges=true/);
  assert.match(probeService, /ProtectSystem=strict/);
  assert.doesNotMatch(service, /fanmind-ops\/operations-monitor\.mjs/);
  assert.doesNotMatch(probeService, /fanmind-ops\/operations-monitor\.mjs/);
  assert.doesNotMatch(probeService, /\[Install\]/);

  assert.match(lifecycleService, /Type=oneshot/);
  assert.match(lifecycleService, /User=ubuntu/);
  assert.match(lifecycleService, /FANMIND_OPERATIONS_LIFECYCLE_ACCEPTANCE_ACK=operations-monitor-production-lifecycle/);
  assert.match(lifecycleService, /FANMIND_OPERATIONS_EMAIL_ENABLED=false/);
  assert.match(lifecycleService, /ExecStart=\/usr\/bin\/flock --exclusive --wait 120 \/run\/lock\/fanmind-operations-monitor\.lock \/usr\/bin\/node \/usr\/local\/lib\/fanmind-monitor\/operations-monitor-lifecycle\.mjs/);
  assert.match(lifecycleService, /ReadWritePaths=\/run\/lock/);
  assert.doesNotMatch(lifecycleService, /\[Install\]/);
});

test("Production control is main-only, release-bound and runs installed root-owned code", async () => {
  await execFileAsync("bash", ["-n", enableScriptPath]);

  assert.match(productionControl, /github\.ref == 'refs\/heads\/main'/);
  assert.match(productionControl, /environment: production/);
  assert.match(productionControl, /runs-on: \[self-hosted, fanmind-prod, exoscale, linux, x64\]/);
  assert.match(productionControl, /probe-operations-monitor-production/);
  assert.match(productionControl, /lifecycle-operations-monitor-production/);
  assert.match(productionControl, /activate-operations-monitor-production/);
  assert.match(productionControl, /EXPECTED_COMMIT[\s\S]*REVIEWED_COMMIT/);
  assert.match(productionControl, /read-only-production-audit\.sh/);
  assert.match(productionControl, /fanmind-operations-monitor-probe\.service/);
  assert.match(productionControl, /verify-operations-monitor-probe-log\.mjs/);
  assert.match(productionControl, /fanmind-operations-monitor-lifecycle\.service/);
  assert.match(productionControl, /verify-operations-monitor-lifecycle-log\.mjs/);
  assert.match(productionControl, /OPERATIONS_MONITOR_LIFECYCLE_TRANSITIONS=warning,critical,recovered/);
  assert.match(productionControl, /OPERATIONS_MONITOR_LIFECYCLE_EMAIL_ENABLED=false/);
  assert.match(productionControl, /journalctl[\s\S]*--since "\$NOT_BEFORE"/);
  assert.match(productionControl, /\/usr\/local\/lib\/fanmind-ops\/enable-operations-monitor\.sh/);
  assert.doesNotMatch(productionControl, /actions\/checkout|source .*\.env\.production|cat .*\.env\.production|journalctl.*(?:tail|head|grep)/);

  assert.match(enableScript, /\[\[ "\$\(id -u\)" -eq 0 \]\]/);
  assert.match(enableScript, /release_commit_mismatch/);
  assert.match(enableScript, /environment_file_size_invalid/);
  assert.match(enableScript, /--max-filesize 16384/);
  assert.match(enableScript, /FANMIND_OPERATIONS_MONITOR_ENABLED=true/);
  assert.match(enableScript, /FANMIND_OPERATIONS_EMAIL_ENABLED=false/);
  assert.match(enableScript, /cp --preserve=mode,ownership,timestamps/);
  assert.match(enableScript, /systemctl enable --now "\$TIMER_UNIT"/);
  assert.match(enableScript, /read-only-production-audit\.sh/);
  assert.match(enableScript, /verify-production-audit-output\.mjs/);
  assert.match(enableScript, /AUDIT_USER="ubuntu"/);
  assert.match(
    enableScript,
    /sudo -n -u "\$AUDIT_USER" -H[\s\S]*read-only-production-audit\.sh/u,
  );
  assert.match(enableScript, /> "\$audit_file" 2>&1/u);
  assert.match(enableScript, /post_activation_audit_failed/u);
  assert.match(enableScript, /post_activation_audit_verification_failed/u);
  assert.doesNotMatch(enableScript, /set -x|printenv|cat "\$ENV_FILE"|source "\$ENV_FILE"/);

  assert.match(deployment, /scripts\/operations\/enable-operations-monitor\.sh \/usr\/local\/lib\/fanmind-ops\/enable-operations-monitor\.sh/);
  assert.match(deployment, /install -d -o root -g root -m 0755 \/usr\/local\/lib\/fanmind-monitor/);
  assert.match(deployment, /install -o root -g root -m 0644 scripts\/operations\/operations-monitor\.mjs \/usr\/local\/lib\/fanmind-monitor\/operations-monitor\.mjs/);
  assert.match(deployment, /scripts\/operations\/verify-operations-monitor-probe-log\.mjs \/usr\/local\/lib\/fanmind-audit\/verify-operations-monitor-probe-log\.mjs/);
  assert.match(deployment, /scripts\/operations\/verify-operations-monitor-lifecycle-log\.mjs \/usr\/local\/lib\/fanmind-audit\/verify-operations-monitor-lifecycle-log\.mjs/);
  assert.match(deployment, /scripts\/operations\/operations-monitor-lifecycle\.mjs \/usr\/local\/lib\/fanmind-monitor\/operations-monitor-lifecycle\.mjs/);
  assert.match(deployment, /ops\/systemd\/fanmind-operations-monitor-probe\.service \/etc\/systemd\/system\/fanmind-operations-monitor-probe\.service/);
  assert.match(deployment, /ops\/systemd\/fanmind-operations-monitor-lifecycle\.service \/etc\/systemd\/system\/fanmind-operations-monitor-lifecycle\.service/);
  assert.match(deployment, /test -x \/usr\/bin\/flock/);
  assert.doesNotMatch(deployment, /scripts\/operations\/operations-monitor\.mjs \/usr\/local\/lib\/fanmind-ops\/operations-monitor\.mjs/);
});

test("Production monitor migration is checksum-pinned, transactional and separately controlled", async () => {
  const checkedMigration = migrationRunner.verifyOperationsMonitorMigrationSource();
  assert.match(checkedMigration, /^begin;/mu);
  assert.equal(
    packageJson.scripts["db:operations-monitor:check"],
    "node scripts/operations/operations-monitor-migration-runner.mjs",
  );

  assert.match(migration, /^begin;/mu);
  assert.match(migration, /set local lock_timeout = '5s'/u);
  assert.match(migration, /set local statement_timeout = '60s'/u);
  assert.match(migration, /commit;\s*$/u);

  assert.match(migrationControl, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(migrationControl, /environment: production/u);
  assert.match(migrationControl, /runs-on: \[self-hosted, fanmind-prod, exoscale, linux, x64\]/u);
  assert.match(migrationControl, /operations-monitor-components-production-verify/u);
  assert.match(migrationControl, /operations-monitor-components-production-apply/u);
  assert.match(migrationControl, /EXPECTED_COMMIT[\s\S]*REVIEWED_COMMIT/u);
  assert.match(migrationControl, /read-only-production-audit\.sh/u);
  assert.match(migrationControl, /fanmind-operations-monitor-migration@\$\{MIGRATION_ACTION\}\.service/u);
  assert.match(migrationControl, /verify-operations-monitor-migration-log\.mjs/u);
  assert.doesNotMatch(migrationControl, /actions\/checkout|source .*\.env\.production|cat .*\.env\.production|printenv/u);

  assert.match(migrationService, /User=root/u);
  assert.match(migrationService, /EnvironmentFile=\/var\/www\/fanmind\/\.env\.production/u);
  assert.match(migrationService, /EnvironmentFile=\/etc\/fanmind-backup\/worker\.env/u);
  assert.match(migrationService, /EnvironmentFile=\/etc\/fanmind-backup\/release\.env/u);
  assert.match(migrationService, /ExecStart=\/usr\/bin\/node \/usr\/local\/lib\/fanmind-ops\/operations-monitor-migration-runner\.mjs --%i operations-monitor-components-production-%i/u);
  assert.match(migrationService, /NoNewPrivileges=true/u);
  assert.match(migrationService, /ProtectSystem=strict/u);
  assert.match(migrationService, /CapabilityBoundingSet=/u);
  assert.doesNotMatch(migrationService, /\[Install\]/u);

  assert.match(deployment, /scripts\/operations\/operations-monitor-migration-runner\.mjs \/usr\/local\/lib\/fanmind-ops\/operations-monitor-migration-runner\.mjs/u);
  assert.match(deployment, /-m 0600 supabase\/migrations\/20260718190000_operations_monitor_components\.sql \/usr\/local\/lib\/fanmind-ops\/20260718190000_operations_monitor_components\.sql/u);
  assert.match(deployment, /scripts\/operations\/verify-operations-monitor-migration-log\.mjs \/usr\/local\/lib\/fanmind-audit\/verify-operations-monitor-migration-log\.mjs/u);
  assert.match(deployment, /ops\/systemd\/fanmind-operations-monitor-migration@\.service \/etc\/systemd\/system\/fanmind-operations-monitor-migration@\.service/u);
});

test("migration allows only metadata components and keeps monitor notifications indexed", () => {
  for (const component of ["host_disk", "host_memory", "ssl_certificate", "backup_freshness", "operations_monitor", "nginx"]) {
    assert.match(migration, new RegExp(`'${component}'`));
  }
  assert.match(migration, /admin_notifications_active_monitor_idx/);
  assert.doesNotMatch(migration, /(?:alter|insert|update|delete)\s+(?:table\s+)?public\.(?:contacts|messages|contact_memories|ai_generations|workspace_members)/i);
});
