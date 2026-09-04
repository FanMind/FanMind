// Imported by the canonical Mobile Push staging control test entrypoint.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  buildMobilePushLedgerAcceptanceSql,
  buildMobilePushLedgerRoleDenialSql,
  deriveMobilePushLedgerAcceptanceUuid,
  latestMobilePushLedgerAcceptanceStage,
} from "../scripts/operations/mobile-push-delivery-ledger-staging-acceptance.mjs";
import {
  MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_CONFIRMATION,
  evaluateMobilePushStagingControlEnvironment,
} from "../src/lib/mobilePushStagingControlPolicy.mjs";

const execFileAsync = promisify(execFile);
const SCRIPT = "scripts/operations/mobile-push-delivery-ledger-staging-acceptance.mjs";
const COMMIT = "a".repeat(40);
const IDS = Object.freeze({
  workspaceId: "11111111-1111-4111-8111-111111111111",
  ownerUserId: "22222222-2222-4222-8222-222222222222",
  memberUserId: "33333333-3333-4333-8333-333333333333",
  easProjectId: "44444444-4444-4444-8444-444444444444",
  deviceId: "55555555-5555-4555-8555-555555555555",
  targetSupabaseProjectRef: "stagingref12345",
});

function environment(overrides = {}) {
  return {
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.ch",
    NEXT_PUBLIC_SUPABASE_URL: "https://stagingref12345.supabase.co",
    FANMIND_TARGET_API_ORIGIN: "https://staging.fanmind.ch",
    FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
    FANMIND_TARGET_SUPABASE_PROJECT_REF: "stagingref12345",
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    FANMIND_MOBILE_PUSH_REVIEWED_COMMIT: COMMIT,
    FANMIND_MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_CONFIRM:
      MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_CONFIRMATION,
    FANMIND_MOBILE_PUSH_STAGING_WORKSPACE_ID: IDS.workspaceId,
    FANMIND_MOBILE_PUSH_STAGING_OWNER_USER_ID: IDS.ownerUserId,
    FANMIND_MOBILE_PUSH_STAGING_MEMBER_USER_ID: IDS.memberUserId,
    FANMIND_MOBILE_PUSH_STAGING_EAS_PROJECT_ID: IDS.easProjectId,
    FANMIND_MOBILE_PUSH_STAGING_DEVICE_ID: IDS.deviceId,
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: COMMIT,
    PGHOST: "staging-db.fanmind.invalid",
    FANMIND_TARGET_DB_HOST: "staging-db.fanmind.invalid",
    FANMIND_PRODUCTION_DB_HOST: "production-db.fanmind.invalid",
    PGPORT: "5432",
    PGDATABASE: "postgres",
    PGUSER: "postgres.stagingref12345",
    ...overrides,
  };
}

test("ledger acceptance has a separate exact Staging write confirmation", () => {
  const result = evaluateMobilePushStagingControlEnvironment(environment(), {
    mode: "ledger_acceptance",
  });
  assert.equal(result.ok, true);
  assert.equal(result.writeEnabled, true);
  for (const unsafe of [
    { FANMIND_MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_CONFIRM: "apply-mobile-push-delivery-ledger" },
    { FANMIND_RUNTIME_ENVIRONMENT: "production" },
    { FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false" },
    { FANMIND_MOBILE_PUSH_REVIEWED_COMMIT: "b".repeat(40) },
  ]) {
    assert.equal(
      evaluateMobilePushStagingControlEnvironment(environment(unsafe), {
        mode: "ledger_acceptance",
      }).ok,
      false,
      JSON.stringify(unsafe),
    );
  }
});

test("synthetic ledger identifiers are stable, distinct UUIDs", () => {
  const contact = deriveMobilePushLedgerAcceptanceUuid(IDS.deviceId, "contact");
  const followup = deriveMobilePushLedgerAcceptanceUuid(IDS.deviceId, "followup");
  assert.match(contact, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  assert.equal(deriveMobilePushLedgerAcceptanceUuid(IDS.deviceId, "contact"), contact);
  assert.notEqual(contact, followup);
});

test("rollback-only SQL proves reservations, leases, receipts and atomic revocation", () => {
  const sql = buildMobilePushLedgerAcceptanceSql(IDS);
  for (const boundary of [
    /mobile_push_delivery_reserve\(/u,
    /mobile_push_delivery_reserve_receipt\(/u,
    /markTicket/u,
    /markReceiptAccepted/u,
    /markDeviceNotRegistered/u,
    /lease_exclusivity_invalid/u,
    /atomic_device_revocation_invalid/u,
    /rollback_cleanup_invalid/u,
    /MOBILE_PUSH_DELIVERY_LEDGER_ROLLBACK=PASS/u,
  ]) assert.match(sql, boundary);
  assert.equal(sql.match(/\brollback\s*;/giu)?.length, 2);
  assert.equal((sql.match(/'v1:[0-9a-f]{16}:[0-9a-f]{32}:[0-9a-f]{16}'/gu) ?? []).length, 2);
  assert.match(sql, new RegExp(`user_id in \\(\\s*'${IDS.ownerUserId}'::uuid, '${IDS.memberUserId}'::uuid\\s*\\)`, "u"));
  assert.match(sql, new RegExp(`'${IDS.ownerUserId}'::uuid, '${IDS.workspaceId}'::uuid`, "u"));
  assert.match(sql, new RegExp(`'${IDS.memberUserId}'::uuid, '${IDS.workspaceId}'::uuid`, "u"));
  assert.match(sql, /temporary_processing_access_expires_at/u);
  assert.match(sql, /statement_timestamp\(\) \+ interval '1 hour'/u);
  for (const stage of ["reservation_membership", "reservation_workspace", "reservation_target"]) {
    assert.match(sql, new RegExp(`MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_STAGE=${stage}`, "u"));
  }
  assert.doesNotMatch(sql, /\bcommit\s*;|ExpoPushToken|push\/send|fetch\(/iu);
});

test("ledger acceptance diagnostics expose only the latest fixed stage", () => {
  assert.equal(
    latestMobilePushLedgerAcceptanceStage(
      "MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_STAGE=fixtures\nNOTICE: MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_STAGE=receipt\n",
    ),
    "receipt",
  );
  assert.equal(latestMobilePushLedgerAcceptanceStage("password=do-not-echo"), "unknown");
});

test("browser probes exercise table and RPC denial", () => {
  for (const role of ["anon", "authenticated"]) {
    assert.match(buildMobilePushLedgerRoleDenialSql(role, "table"), new RegExp(`set local role ${role}`, "u"));
    assert.match(buildMobilePushLedgerRoleDenialSql(role, "reserve"), /mobile_push_delivery_reserve/u);
  }
  assert.throws(() => buildMobilePushLedgerRoleDenialSql("service_role", "table"), /role_probe_invalid/u);
});

test("offline check needs no database or provider credential", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [SCRIPT, "--check"], { env: process.env });
  const output = `${stdout}\n${stderr}`;
  assert.match(output, /MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_READY=YES/u);
  assert.doesNotMatch(output, /postgres|supabase|token|secret|11111111/iu);
});

test("run mode accepts only four denied probes and fixed rollback markers", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fanmind-push-ledger-test-"));
  const bin = join(directory, "bin");
  const passfile = join(directory, "pgpass");
  const fakePsql = join(bin, "psql");
  await mkdir(bin);
  await writeFile(passfile, "host:5432:postgres:user:test-password\n", { mode: 0o600 });
  await writeFile(fakePsql, `#!/bin/sh
if [ "\${1:-}" = "--version" ]; then exit 0; fi
INPUT="$(/bin/cat)"
case "$INPUT" in
  *"set local role anon;"*|*"set local role authenticated;"*)
    printf '%s\n' 'MOBILE_PUSH_DELIVERY_LEDGER_ROLE_SWITCH=PASS'
    exit 1 ;;
esac
printf '%s\n' \
  'MOBILE_PUSH_DELIVERY_LEDGER_RESERVATION=PASS' \
  'MOBILE_PUSH_DELIVERY_LEDGER_LEASE_EXCLUSIVITY=PASS' \
  'MOBILE_PUSH_DELIVERY_LEDGER_RECEIPT_LIFECYCLE=PASS' \
  'MOBILE_PUSH_DELIVERY_LEDGER_ATOMIC_DEVICE_REVOCATION=PASS' \
  'MOBILE_PUSH_DELIVERY_LEDGER_ROLLBACK=PASS'
`, { mode: 0o700 });
  await chmod(fakePsql, 0o700);
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [SCRIPT, "--run"], {
      env: { ...environment(), PATH: `${bin}:${process.env.PATH ?? "/usr/bin:/bin"}`, PGPASSFILE: passfile },
    });
    const output = `${stdout}\n${stderr}`;
    assert.match(output, /MOBILE_PUSH_DELIVERY_LEDGER_BROWSER_DENIALS=4/u);
    assert.match(output, /MOBILE_PUSH_DELIVERY_LEDGER_STAGING_ACCEPTANCE=PASS/u);
    assert.match(output, /MOBILE_PUSH_PROVIDER_SEND=disabled/u);
    assert.match(output, /SECRETS_WURDEN_NICHT_AUSGEGEBEN=true/u);
    assert.doesNotMatch(output, /test-password|stagingref12345|11111111/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("workflow is manual, exact-main, protected and provider-free", async () => {
  const workflow = await readFile(".github/workflows/mobile-push-delivery-ledger-staging-acceptance.yml", "utf8");
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /inputs\.reviewed_commit == github\.sha/u);
  assert.match(workflow, /environment: staging/u);
  assert.match(workflow, /run-mobile-push-delivery-ledger-acceptance/u);
  assert.match(workflow, /db:mobile-push-delivery-ledger:verify/u);
  assert.match(workflow, /mobile:push:delivery-ledger:staging:run/u);
  assert.match(workflow, /fanmind-mobile-push-staging-write/u);
  assert.doesNotMatch(workflow, /\bschedule:|eas (?:build|submit|update)|push\/send|ExpoPushToken/iu);
});
