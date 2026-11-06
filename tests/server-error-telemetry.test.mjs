import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const telemetryPath = new URL("../src/lib/serverErrorTelemetry.ts", import.meta.url);
const telemetrySource = await readFile(telemetryPath, "utf8");
const apiKeyPolicySource = await readFile(
  new URL("../src/lib/supabase/apiKeyPolicy.mjs", import.meta.url),
  "utf8",
);
const instrumentation = await readFile(new URL("../src/instrumentation.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260718203000_privacy_server_error_tracking.sql", import.meta.url), "utf8");
const errorBoundary = await readFile(new URL("../src/app/error.tsx", import.meta.url), "utf8");
const globalErrorBoundary = await readFile(new URL("../src/app/global-error.tsx", import.meta.url), "utf8");
const migrationRunner = await import("../scripts/operations/server-error-migration-runner.mjs");
const migrationLogVerifier = await import("../scripts/operations/verify-server-error-migration-log.mjs");
const acceptance = await import("../scripts/operations/server-error-production-acceptance.mjs");
const acceptanceLogVerifier = await import("../scripts/operations/verify-server-error-acceptance-log.mjs");
const productionControl = await readFile(new URL("../.github/workflows/server-error-production-control.yml", import.meta.url), "utf8");
const migrationService = await readFile(new URL("../ops/systemd/fanmind-server-error-migration@.service", import.meta.url), "utf8");
const acceptanceService = await readFile(new URL("../ops/systemd/fanmind-server-error-acceptance.service", import.meta.url), "utf8");
const enableScript = await readFile(new URL("../scripts/operations/enable-server-error-tracking.sh", import.meta.url), "utf8");
const deployment = await readFile(new URL("../.github/workflows/deploy-fanmind.yml", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

const executableTelemetrySource = telemetrySource.replace(
  "@/lib/supabase/apiKeyPolicy.mjs",
  "./apiKeyPolicy.mjs",
);
const transpiled = ts.transpileModule(executableTelemetrySource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const temp = await mkdtemp(join(tmpdir(), "fanmind-server-error-telemetry-"));
const modulePath = join(temp, "serverErrorTelemetry.mjs");
await writeFile(modulePath, transpiled);
await writeFile(join(temp, "apiKeyPolicy.mjs"), apiKeyPolicySource);
const telemetry = await import(`${pathToFileURL(modulePath).href}?v=${Date.now()}`);

test("server error tracking is disabled unless explicitly enabled", () => {
  assert.equal(telemetry.serverErrorTrackingEnabled({}), false);
  assert.equal(telemetry.serverErrorTrackingEnabled({ FANMIND_SERVER_ERROR_TRACKING_ENABLED: "false" }), false);
  assert.equal(telemetry.serverErrorTrackingEnabled({ FANMIND_SERVER_ERROR_TRACKING_ENABLED: "true" }), true);
});

test("fingerprints never depend on error messages, stacks, headers or query values", () => {
  const context = { routePath: "/api/fans/[id]", routeType: "route", routerKind: "App Router" };
  const request = { path: "/api/fans/secret-id?access=private", method: "POST", headers: { cookie: "private" } };
  const first = new Error("first private value");
  first.stack = "private stack one";
  const second = new Error("second unrelated private value");
  second.stack = "private stack two";
  const firstRecord = telemetry.buildServerErrorRecord(first, request, context, { NODE_ENV: "production" });
  const secondRecord = telemetry.buildServerErrorRecord(second, request, context, { NODE_ENV: "production" });
  assert.equal(firstRecord.fingerprint, secondRecord.fingerprint);
  assert.equal(firstRecord.routePath, "/api/fans/[id]");
  assert.deepEqual(Object.keys(firstRecord).sort(), [
    "digest",
    "environment",
    "fingerprint",
    "httpMethod",
    "releaseCommit",
    "routePath",
    "routeType",
    "routerKind",
  ]);
  const serialized = JSON.stringify(firstRecord);
  assert.doesNotMatch(serialized, /first private|private stack|cookie|access=|secret-id/);
});

test("safe digest can identify a processed server error without storing its message", () => {
  const first = Object.assign(new Error("private one"), { digest: "digest_ABC123" });
  const second = Object.assign(new Error("private two"), { digest: "digest_ABC123" });
  const context = { routePath: "/dashboard", routeType: "render", routerKind: "App Router" };
  const request = { path: "/dashboard?private=yes", method: "GET" };
  const one = telemetry.buildServerErrorRecord(first, request, context, {
    NODE_ENV: "production",
    FANMIND_RELEASE_COMMIT: "a".repeat(40),
  });
  const two = telemetry.buildServerErrorRecord(second, request, context, { NODE_ENV: "production" });
  assert.equal(one.fingerprint, two.fingerprint);
  assert.equal(one.digest, "digest_ABC123");
  assert.equal(one.releaseCommit, "a".repeat(40));
});

test("missing route templates never persist the raw request path", () => {
  assert.equal(
    telemetry.normalizeRoutePath(undefined, "/reset-password?email=private@example.com#secret"),
    "/unknown",
  );
  assert.equal(
    telemetry.normalizeRoutePath("", "/fans/private-contact-id"),
    "/unknown",
  );
  assert.equal(telemetry.normalizeRoutePath("dashboard spaces", undefined), "/dashboard_spaces");
});

test("disabled capture returns before any remote storage call", async () => {
  const originalFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; throw new Error("should_not_run"); };
  try {
    const result = await telemetry.captureServerRequestError(
      new Error("private"),
      { path: "/dashboard", method: "GET" },
      { routePath: "/dashboard", routeType: "render", routerKind: "App Router" },
      {},
    );
    assert.equal(result.captured, false);
    assert.equal(called, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Next instrumentation is Node-only, opt-in and projects safe request fields", () => {
  assert.match(instrumentation, /NEXT_RUNTIME !== "nodejs"/);
  assert.match(instrumentation, /FANMIND_SERVER_ERROR_TRACKING_ENABLED !== "true"/);
  assert.match(instrumentation, /await captureServerRequestError\(/);
  assert.match(instrumentation, /path: request\.path/);
  assert.match(instrumentation, /method: request\.method/);
  assert.doesNotMatch(instrumentation, /headers: request\.headers/);
});

test("schema stores metadata only, denies browser roles and rate-limits notifications", () => {
  assert.match(migration, /create table if not exists public\.server_error_events/);
  assert.match(migration, /create table if not exists public\.server_error_groups/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.server_error_events from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.record_server_error_event[\s\S]*to service_role/);
  assert.match(migration, /interval '10 minutes'/);
  assert.match(migration, /p_cooldown_minutes/);
  assert.match(migration, /last_notified_severity/);
  assert.match(
    migration,
    /on conflict on constraint server_error_groups_pkey do update set/,
  );
  assert.doesNotMatch(migration, /on conflict \(fingerprint\)/);
  assert.match(migration, /cleanup_server_error_events/);
  assert.doesNotMatch(migration, /error_message|stack_trace|request_headers|request_body|query_string|cookie/i);
});

test("admin error notifications stay generic and exclude route or error contents", () => {
  assert.match(migration, /Neuer Serverfehler erkannt/);
  assert.match(migration, /Serverfehler häufen sich/);
  const notificationBlock = migration.slice(migration.indexOf("v_title :="), migration.indexOf("return query"));
  assert.doesNotMatch(notificationBlock, /p_route_path|p_digest|error_message|stack/i);
});

test("error boundaries do not render technical error content", () => {
  assert.doesNotMatch(errorBoundary, /error\.message|error\.stack|error\.digest/);
  assert.doesNotMatch(globalErrorBoundary, /error\.message|error\.stack|error\.digest/);
  assert.match(errorBoundary, /Erneut versuchen/);
  assert.match(globalErrorBoundary, /Ansicht neu laden/);
});

test("telemetry source never serializes error message, stack, headers or request path", () => {
  const bodyBlock = telemetrySource.slice(telemetrySource.indexOf("body: JSON.stringify({"), telemetrySource.indexOf("cache: \"no-store\""));
  assert.doesNotMatch(bodyBlock, /error\.message|error\.stack|request\.headers|request\.path/);
  assert.match(bodyBlock, /p_route_path: record\.routePath/);
  assert.match(telemetrySource, /fingerprint\.slice\(0, 12\)/);
});

test("Production server-error migration is transactional, checksum-pinned and metadata-only", () => {
  const checked = migrationRunner.verifyServerErrorMigrationSource();
  assert.equal(checked, migration);
  assert.equal(
    packageJson.scripts["db:server-error-tracking:check"],
    "node scripts/operations/server-error-migration-runner.mjs",
  );
  assert.match(migration, /^begin;/mu);
  assert.match(migration, /set local lock_timeout = '5s'/u);
  assert.match(migration, /set local statement_timeout = '60s'/u);
  assert.match(migration, /commit;\s*$/u);
  assert.throws(
    () => migrationRunner.serverErrorMigrationMode(["--apply", "wrong"]),
    /apply_confirmation_invalid/u,
  );
  assert.equal(
    migrationRunner.serverErrorMigrationMode([
      "--verify",
      "server-error-tracking-production-verify",
    ]),
    "--verify",
  );
  assert.equal(
    migrationRunner.serverErrorMigrationApplyPlan({
      schemaReady: true,
      fixedConflictReady: true,
      legacyConflictReady: false,
      schemaAbsent: false,
    }),
    "already_applied",
  );
  assert.equal(
    migrationRunner.serverErrorMigrationApplyPlan({
      schemaReady: true,
      fixedConflictReady: false,
      legacyConflictReady: true,
      schemaAbsent: false,
    }),
    "repair",
  );
  assert.equal(
    migrationRunner.serverErrorMigrationApplyPlan({
      schemaReady: false,
      fixedConflictReady: false,
      legacyConflictReady: false,
      schemaAbsent: true,
    }),
    "apply",
  );
  assert.equal(
    migrationRunner.serverErrorMigrationApplyPlan({
      schemaReady: true,
      fixedConflictReady: false,
      legacyConflictReady: false,
      schemaAbsent: false,
    }),
    "reject",
  );
});

test("migration diagnostics expose only allowlisted Production status", () => {
  const notBefore = new Date(Date.now() - 1000).toISOString();
  const now = new Date().toISOString();
  const source = [
    "private database output that must be ignored",
    JSON.stringify({
      ts: now,
      version: "fanmind-server-error-migration-2",
      level: "error",
      event: "migration_failed",
      action: "verify",
      error_code: "schema_not_ready",
      private_detail: "must-not-pass",
    }),
  ].join("\n");
  const result = migrationLogVerifier.verifyServerErrorMigrationLog(
    source,
    notBefore,
    "verify",
  );
  assert.deepEqual(result, {
    action: "verify",
    status: "failed",
    errorCode: "schema_not_ready",
  });
  const formatted = migrationLogVerifier.formatServerErrorMigrationDiagnostic(result);
  assert.match(formatted, /SERVER_ERROR_MIGRATION_ERROR=schema_not_ready/u);
  assert.doesNotMatch(formatted, /private database output|must-not-pass/u);

  const repaired = migrationLogVerifier.verifyServerErrorMigrationLog(
    JSON.stringify({
      ts: now,
      version: "fanmind-server-error-migration-2",
      level: "info",
      event: "migration_status",
      action: "apply",
      status: "repaired",
    }),
    notBefore,
    "apply",
  );
  assert.deepEqual(repaired, { action: "apply", status: "repaired", errorCode: null });
});

test("email-disabled Production acceptance proves warning critical and cleanup", async () => {
  const originalFetch = global.fetch;
  const releaseCommit = "b".repeat(40);
  const fingerprint = acceptance.serverErrorAcceptanceFingerprint(releaseCommit);
  const state = { events: [], groups: [], notifications: [] };
  global.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const path = url.pathname.replace("/rest/v1", "");
    const method = init.method ?? "GET";
    if (method === "DELETE") {
      if (path === "/server_error_events") state.events = [];
      if (path === "/server_error_groups") state.groups = [];
      if (path === "/admin_notifications") state.notifications = [];
      return new Response(null, { status: 204 });
    }
    if (path === "/rpc/record_server_error_event" && method === "POST") {
      const body = JSON.parse(String(init.body));
      state.events.push({
        fingerprint: body.p_fingerprint,
        digest: body.p_digest,
        route_path: body.p_route_path,
        route_type: body.p_route_type,
        router_kind: body.p_router_kind,
        http_method: body.p_http_method,
        environment: body.p_environment,
        release_commit: body.p_release_commit,
      });
      const severity = state.events.length >= 2 ? "critical" : "warning";
      state.groups = [{
        fingerprint: body.p_fingerprint,
        occurrence_count: state.events.length,
        digest: null,
        route_path: body.p_route_path,
        route_type: body.p_route_type,
        router_kind: body.p_router_kind,
        http_method: body.p_http_method,
        environment: body.p_environment,
        latest_release_commit: body.p_release_commit,
        status: "open",
        last_notified_severity: severity,
      }];
      state.notifications = [{
        category: severity,
        severity,
        status: "open",
        title: severity === "critical" ? "Serverfehler häufen sich" : "Neuer Serverfehler erkannt",
        message: severity === "critical"
          ? `Mehrere serverseitige Fehler wurden derselben Gruppe zugeordnet. Referenz ${fingerprint.slice(0, 12)}.`
          : `Ein serverseitiger Fehler wurde datensparsam gruppiert. Referenz ${fingerprint.slice(0, 12)}.`,
        source: "server_error_tracking",
        technical_reference: `server_error:${fingerprint}`,
        metadata: { fingerprint, recent_count: state.events.length },
      }];
      return Response.json([{
        fingerprint,
        is_new: state.events.length === 1,
        recent_count: state.events.length,
        should_notify: true,
        severity,
      }]);
    }
    if (path === "/server_error_events") return Response.json(state.events);
    if (path === "/server_error_groups") return Response.json(state.groups);
    if (path === "/admin_notifications") return Response.json(state.notifications);
    return new Response(null, { status: 404 });
  };
  try {
    const result = await acceptance.runServerErrorProductionAcceptance({
      FANMIND_RUNTIME_ENVIRONMENT: "production",
      FANMIND_SERVER_ERROR_EMAIL_ENABLED: "false",
      FANMIND_SERVER_ERROR_ACCEPTANCE_ACK: "server-error-production-email-disabled-acceptance",
      FANMIND_RELEASE_COMMIT: releaseCommit,
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "x".repeat(64),
    });
    assert.deepEqual(result, {
      events: 2,
      groups: 1,
      notifications: 1,
      transitions: ["warning", "critical", "cleanup"],
      emailEnabled: false,
    });
    assert.deepEqual(state, { events: [], groups: [], notifications: [] });
  } finally {
    global.fetch = originalFetch;
  }
});

test("acceptance errors are reduced to a strict allowlist", () => {
  const notBefore = new Date(Date.now() - 1000).toISOString();
  const now = new Date().toISOString();
  const source = JSON.stringify({
    ts: now,
    version: "fanmind-server-error-acceptance-1",
    level: "error",
    event: "acceptance_failed",
    error_code: "server_error_acceptance_store_400",
    private_detail: "must-not-pass",
  });
  const result = acceptanceLogVerifier.verifyServerErrorAcceptanceLog(source, notBefore);
  assert.deepEqual(result, {
    status: "failed",
    errorCode: "server_error_acceptance_store_400",
  });
  const formatted = acceptanceLogVerifier.formatServerErrorAcceptanceDiagnostic(result);
  assert.match(formatted, /SERVER_ERROR_ACCEPTANCE_ERROR=server_error_acceptance_store_400/u);
  assert.doesNotMatch(formatted, /private_detail|must-not-pass/u);
  assert.equal(
    acceptance.serverErrorAcceptanceErrorCode(new Error("private secret failure")),
    "server_error_acceptance_unexpected_failure",
  );
});

test("Production control stays main release and email-disabled bound", () => {
  assert.match(productionControl, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(productionControl, /environment: production/u);
  assert.match(productionControl, /runs-on: \[self-hosted, fanmind-prod, exoscale, linux, x64\]/u);
  assert.match(productionControl, /server-error-tracking-production-verify/u);
  assert.match(productionControl, /server-error-tracking-production-apply/u);
  assert.match(productionControl, /accept-server-error-tracking-production/u);
  assert.match(productionControl, /activate-server-error-tracking-production/u);
  assert.match(productionControl, /EXPECTED_COMMIT[\s\S]*REVIEWED_COMMIT/u);
  assert.match(productionControl, /read-only-production-audit\.sh/u);
  assert.match(productionControl, /fanmind-server-error-migration@\$\{SCHEMA_ACTION\}\.service/u);
  assert.match(productionControl, /fanmind-server-error-acceptance\.service/u);
  assert.match(productionControl, /SERVER_ERROR_ACCEPTANCE_EMAIL_ENABLED=false/u);
  assert.doesNotMatch(
    productionControl,
    /actions\/checkout|source .*\.env\.production|cat .*\.env\.production|printenv|api\/internal/u,
  );
});

test("installed server-error controllers are root-owned and sandboxed", () => {
  for (const unit of [migrationService, acceptanceService]) {
    assert.match(unit, /User=root/u);
    assert.match(unit, /NoNewPrivileges=true/u);
    assert.match(unit, /ProtectSystem=strict/u);
    assert.match(unit, /CapabilityBoundingSet=/u);
    assert.doesNotMatch(unit, /\[Install\]/u);
  }
  assert.match(migrationService, /EnvironmentFile=\/etc\/fanmind-backup\/worker\.env/u);
  assert.match(migrationService, /server-error-migration-runner\.mjs --%i server-error-tracking-production-%i/u);
  assert.match(acceptanceService, /FANMIND_SERVER_ERROR_EMAIL_ENABLED=false/u);
  assert.match(acceptanceService, /server-error-production-email-disabled-acceptance/u);
  assert.match(acceptanceService, /flock --exclusive --wait 120 \/run\/lock\/fanmind-server-error\.lock/u);
});

test("activation is atomic, reloads the ubuntu PM2 context and keeps email off", () => {
  assert.match(enableScript, /activate-server-error-tracking-production/u);
  assert.match(enableScript, /FANMIND_SERVER_ERROR_TRACKING_ENABLED=true/u);
  assert.match(enableScript, /FANMIND_SERVER_ERROR_EMAIL_ENABLED=false/u);
  assert.match(enableScript, /sudo -n -u "\$APP_USER" -H/u);
  assert.match(enableScript, /\/usr\/bin\/pm2\|\/usr\/local\/bin\/pm2/u);
  assert.match(enableScript, /"\$PM2_BIN" reload/u);
  assert.match(enableScript, /server-error-migration@verify\.service/u);
  assert.match(enableScript, /fanmind-server-error-acceptance\.service/u);
  assert.match(enableScript, /read-only-production-audit\.sh/u);
  assert.match(enableScript, /mv -f "\$backup_file" "\$ENV_FILE"/u);
  assert.doesNotMatch(enableScript, /cat "?\$ENV_FILE|printenv|set -x/u);

  assert.match(deployment, /verify-server-error-migration-log\.mjs \/usr\/local\/lib\/fanmind-audit\/verify-server-error-migration-log\.mjs/u);
  assert.match(deployment, /server-error-migration-runner\.mjs \/usr\/local\/lib\/fanmind-ops\/server-error-migration-runner\.mjs/u);
  assert.match(deployment, /-m 0600 supabase\/migrations\/20260718203000_privacy_server_error_tracking\.sql/u);
  assert.match(deployment, /fanmind-server-error-migration@\.service \/etc\/systemd\/system\/fanmind-server-error-migration@\.service/u);
  assert.match(deployment, /fanmind-server-error-acceptance\.service \/etc\/systemd\/system\/fanmind-server-error-acceptance\.service/u);
});
