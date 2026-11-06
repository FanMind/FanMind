import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

import {
  APPLY_CONFIRMATION,
  BASE_PREFLIGHT_SQL,
  EXPECTED_MIGRATION_SHA256,
  POSTFLIGHT_SQL,
  VERIFY_CONFIRMATION,
  triggerFunctionHardeningProductionMode,
  verifyTriggerFunctionHardeningProductionSource,
} from "../scripts/operations/trigger-function-hardening-production-runner.mjs";
import {
  formatTriggerFunctionHardeningProductionDiagnostic,
  verifyTriggerFunctionHardeningProductionLog,
} from "../scripts/operations/verify-trigger-function-hardening-production-log.mjs";

const execFileAsync = promisify(execFile);
const runnerPath =
  "scripts/operations/trigger-function-hardening-production-runner.mjs";
const workflowPath =
  ".github/workflows/trigger-function-hardening-production-control.yml";
const servicePath =
  "ops/systemd/fanmind-trigger-function-hardening@.service";
const deployPath = ".github/workflows/deploy-fanmind.yml";
const runbookPath =
  "docs/operations/TRIGGER_FUNCTION_HARDENING_PRODUCTION.md";
const guardrailPath = "AGENTS.md";
const securityCheckPath = "docs/SECURITY_RLS_SECRETS_CHECK.md";
const schemaTruthPath = "docs/database/fanmind_current_schema.md";

test("Production hardening source stays checksum-pinned and offline-checkable", async () => {
  assert.equal(
    EXPECTED_MIGRATION_SHA256,
    "6eb928fe7df73072ce03d6e78dfca7feb5c77c950fbdd70ffe1169e4dabf1132",
  );
  const sql = verifyTriggerFunctionHardeningProductionSource();
  assert.match(sql, /^begin;/mu);
  assert.match(
    sql,
    /revoke all on function public\.set_social_connections_updated_at\(\)/u,
  );
  assert.doesNotMatch(sql, /\b(?:insert|update|delete|grant)\b/iu);

  const { stdout, stderr } = await execFileAsync(process.execPath, [
    runnerPath,
    "--check",
  ]);
  const output = `${stdout}\n${stderr}`;
  assert.match(output, /"action":"check"/u);
  assert.match(output, /"status":"ready"/u);
  assert.doesNotMatch(output, /supabase\.co|postgres\.|password|secret/iu);
});

test("Production verify and apply use distinct explicit confirmations", () => {
  assert.equal(
    triggerFunctionHardeningProductionMode([
      "--verify",
      VERIFY_CONFIRMATION,
    ]),
    "--verify",
  );
  assert.equal(
    triggerFunctionHardeningProductionMode(["--apply", APPLY_CONFIRMATION]),
    "--apply",
  );
  assert.throws(
    () =>
      triggerFunctionHardeningProductionMode([
        "--apply",
        VERIFY_CONFIRMATION,
      ]),
    /apply_confirmation_invalid/u,
  );
  assert.throws(
    () =>
      triggerFunctionHardeningProductionMode([
        "--verify",
        APPLY_CONFIRMATION,
      ]),
    /verify_confirmation_invalid/u,
  );
});

test("Production preflight and postflight are read-only and narrow", () => {
  for (const sql of [BASE_PREFLIGHT_SQL, POSTFLIGHT_SQL]) {
    assert.match(sql, /begin;/u);
    assert.match(sql, /set transaction read only/u);
    assert.match(sql, /set local statement_timeout = '15s'/u);
    assert.match(sql, /rollback;/u);
    assert.doesNotMatch(
      sql,
      /\b(?:alter|create|drop|truncate|insert|update|delete|grant|revoke)\b/iu,
    );
  }
  for (const functionName of [
    "set_social_connections_updated_at",
    "set_referral_updated_at",
    "set_demo_start_session_updated_at",
    "trim_conversation_messages_to_latest_50",
  ]) {
    assert.match(BASE_PREFLIGHT_SQL, new RegExp(functionName, "u"));
    assert.match(POSTFLIGHT_SQL, new RegExp(functionName, "u"));
  }
  assert.match(BASE_PREFLIGHT_SQL, /pg_trigger/u);
  assert.match(
    POSTFLIGHT_SQL,
    /proconfig @> array\['search_path=pg_catalog, pg_temp'\]/u,
  );
  assert.match(POSTFLIGHT_SQL, /has_function_privilege\('anon'/u);
  assert.match(POSTFLIGHT_SQL, /function_acl\.grantee = 0/u);
});

test("Production hardening control is manual, main-only and release-bound", async () => {
  const [workflow, service, deploy, runbook, guardrails, securityCheck, schema] =
    await Promise.all(
      [
        workflowPath,
        servicePath,
        deployPath,
        runbookPath,
        guardrailPath,
        securityCheckPath,
        schemaTruthPath,
      ].map((path) => readFile(path, "utf8")),
    );

  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /environment: production/u);
  assert.match(
    workflow,
    /runs-on: \[self-hosted, fanmind-prod, exoscale, linux, x64\]/u,
  );
  assert.match(workflow, /EXPECTED_COMMIT[\s\S]*REVIEWED_COMMIT/u);
  assert.match(workflow, /read-only-production-audit\.sh/u);
  assert.match(
    workflow,
    /Verify installed Production runtime after the hardening action[\s\S]*if: \$\{\{ always\(\) \}\}/u,
  );
  assert.match(
    workflow,
    /fanmind-trigger-function-hardening@\$\{HARDENING_ACTION\}\.service/u,
  );
  assert.match(
    workflow,
    /verify-trigger-function-hardening-production-log\.mjs/u,
  );
  assert.doesNotMatch(workflow, /actions\/checkout|\bschedule:/u);

  assert.match(service, /User=root/u);
  assert.match(service, /FANMIND_RUNTIME_ENVIRONMENT=production/u);
  assert.match(
    service,
    /flock --exclusive --wait 120 \/run\/lock\/fanmind-trigger-function-hardening\.lock/u,
  );
  assert.match(service, /NoNewPrivileges=true/u);
  assert.match(service, /ProtectSystem=strict/u);
  assert.match(service, /ProtectHome=true/u);
  assert.match(service, /CapabilityBoundingSet=/u);
  assert.doesNotMatch(service, /\[Install\]/u);

  assert.match(
    deploy,
    /trigger-function-hardening-production-runner\.mjs \/usr\/local\/lib\/fanmind-ops\/trigger-function-hardening-production-runner\.mjs/u,
  );
  assert.match(
    deploy,
    /20260806203023_harden_trigger_function_privileges\.sql \/usr\/local\/lib\/fanmind-ops\/20260806203023_harden_trigger_function_privileges\.sql/u,
  );
  assert.match(
    deploy,
    /fanmind-trigger-function-hardening@\.service \/etc\/systemd\/system\/fanmind-trigger-function-hardening@\.service/u,
  );
  assert.doesNotMatch(
    deploy,
    /systemctl (?:start|enable).*fanmind-trigger-function-hardening/u,
  );
  assert.match(runbook, /keine automatische Datenbankänderung/iu);
  assert.match(runbook, /trigger-function-hardening-production-apply/u);
  for (const truth of [guardrails, securityCheck, schema]) {
    assert.match(truth, /Production-Apply|Production apply/iu);
    assert.match(truth, /ausdrückliche(?:n)? Freigabe|explicit approval/iu);
    assert.match(truth, /nicht aktiviert|non-enabled/iu);
  }
});

test("Production journal verifier emits only allowlisted diagnostics", () => {
  const timestamp = new Date().toISOString();
  const success = verifyTriggerFunctionHardeningProductionLog(
    `${JSON.stringify({
      ts: timestamp,
      version: "fanmind-trigger-function-hardening-production-1",
      level: "info",
      event: "hardening_status",
      action: "apply",
      status: "applied",
      ignored_private_value: "must-not-be-forwarded",
    })}\n`,
    new Date(Date.now() - 1000).toISOString(),
    "apply",
  );
  assert.deepEqual(success, {
    action: "apply",
    status: "applied",
    errorCode: null,
  });
  const formatted = formatTriggerFunctionHardeningProductionDiagnostic(success);
  assert.match(
    formatted,
    /TRIGGER_FUNCTION_HARDENING_PRODUCTION_RESULT=applied/u,
  );
  assert.doesNotMatch(formatted, /must-not-be-forwarded/u);

  const failed = verifyTriggerFunctionHardeningProductionLog(
    `${JSON.stringify({
      ts: timestamp,
      version: "fanmind-trigger-function-hardening-production-1",
      level: "error",
      event: "hardening_failed",
      action: "verify",
      error_code: "hardening_not_ready",
    })}\n`,
    new Date(Date.now() - 1000).toISOString(),
    "verify",
  );
  assert.equal(failed.status, "failed");
  assert.equal(failed.errorCode, "hardening_not_ready");
  assert.throws(
    () =>
      verifyTriggerFunctionHardeningProductionLog(
        `${JSON.stringify({
          ts: timestamp,
          version: "fanmind-trigger-function-hardening-production-1",
          level: "error",
          event: "hardening_failed",
          action: "verify",
          error_code: "private-database-error",
        })}\n`,
        new Date(Date.now() - 1000).toISOString(),
        "verify",
      ),
    /diagnostic_missing/u,
  );
});
