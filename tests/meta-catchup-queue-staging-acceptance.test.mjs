import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

import {
  buildMetaCatchupQueueAcceptanceSql,
  buildMetaCatchupQueueRoleDenialSql,
  deriveMetaCatchupAcceptanceUuid,
} from "../scripts/operations/meta-catchup-queue-staging-acceptance.mjs";
import {
  META_CATCHUP_QUEUE_ACCEPTANCE_CONFIRMATION,
  evaluateMetaCatchupQueueStagingEnvironment,
} from "../src/lib/metaCatchupQueueStagingPolicy.mjs";

const execFileAsync = promisify(execFile);
const scriptPath =
  "scripts/operations/meta-catchup-queue-staging-acceptance.mjs";
const workflowPath =
  ".github/workflows/meta-catchup-queue-staging-acceptance.yml";
const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const COMMIT = "a".repeat(40);

function stagingEnvironment(overrides = {}) {
  return {
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.example",
    NEXT_PUBLIC_SUPABASE_URL: "https://stagingref12345.supabase.co",
    FANMIND_TARGET_API_ORIGIN: "https://staging.fanmind.example",
    FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
    FANMIND_TARGET_SUPABASE_PROJECT_REF: "stagingref12345",
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    FANMIND_META_CATCHUP_QUEUE_REVIEWED_COMMIT: COMMIT,
    FANMIND_META_CATCHUP_QUEUE_ACCEPTANCE_CONFIRM:
      META_CATCHUP_QUEUE_ACCEPTANCE_CONFIRMATION,
    FANMIND_META_CATCHUP_QUEUE_STAGING_WORKSPACE_ID: WORKSPACE_ID,
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: COMMIT,
    PGHOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_TARGET_DB_HOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_PRODUCTION_DB_HOST: "aws-0-eu-west-1.pooler.supabase.com",
    PGPORT: "5432",
    PGDATABASE: "postgres",
    PGUSER: "postgres.stagingref12345",
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: "/etc/ssl/certs/ca-certificates.crt",
    ...overrides,
  };
}

test("acceptance environment is exact-commit Staging-only and write acknowledged", () => {
  assert.deepEqual(
    evaluateMetaCatchupQueueStagingEnvironment(stagingEnvironment(), {
      mode: "acceptance",
    }),
    { ok: true, mode: "acceptance", writeEnabled: true, errors: [] },
  );

  const unsafe = evaluateMetaCatchupQueueStagingEnvironment(
    stagingEnvironment({
      FANMIND_RUNTIME_ENVIRONMENT: "production",
      NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
      FANMIND_TARGET_API_ORIGIN: "https://fanmind.ch",
      NEXT_PUBLIC_SUPABASE_URL: "https://productionref123.supabase.co",
      FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionref123",
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
      FANMIND_NON_PRODUCTION_WRITE_ACK: "",
      FANMIND_META_CATCHUP_QUEUE_REVIEWED_COMMIT: "b".repeat(40),
      FANMIND_META_CATCHUP_QUEUE_ACCEPTANCE_CONFIRM: "",
      FANMIND_META_CATCHUP_QUEUE_STAGING_WORKSPACE_ID: "customer",
      GITHUB_REF: "refs/heads/release",
      PGUSER: "postgres.productionref123",
      PGSSLMODE: "disable",
      PGSERVICE: "unsafe",
    }),
    { mode: "acceptance" },
  );
  assert.equal(unsafe.ok, false);
  for (const error of [
    "environment_boundary",
    "runtime_environment",
    "production_target",
    "main_ref",
    "reviewed_commit",
    "database_project_binding",
    "database_tls",
    "libpq_redirect",
    "confirmation",
    "synthetic_workspace",
    "write_acknowledgement",
  ]) {
    assert.ok(unsafe.errors.includes(error), `missing ${error}`);
  }
  assert.doesNotMatch(JSON.stringify(unsafe), /postgres:\/\//u);
});

test("synthetic identifiers are stable, distinct UUIDs", () => {
  const contact = deriveMetaCatchupAcceptanceUuid(WORKSPACE_ID, "contact");
  const connection = deriveMetaCatchupAcceptanceUuid(WORKSPACE_ID, "connection");
  assert.match(
    contact,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
  );
  assert.equal(
    deriveMetaCatchupAcceptanceUuid(WORKSPACE_ID, "contact"),
    contact,
  );
  assert.notEqual(contact, connection);
});

test("rollback-only SQL proves scope, coalescing, leases and retry budget", () => {
  const sql = buildMetaCatchupQueueAcceptanceSql(WORKSPACE_ID);
  assert.match(sql, /FanMind Staging Processing Acceptance/u);
  assert.match(sql, /workspace_processing_acceptance/u);
  assert.match(sql, /stripe_customer_id is null/u);
  assert.match(sql, /stripe_subscription_id is null/u);
  assert.match(
    sql,
    /lock table public\.meta_conversation_catchup_jobs in share row exclusive mode/u,
  );
  assert.match(sql, /active_staging_queue_must_be_empty/u);
  assert.match(sql, /wrong_workspace_unexpected_success/u);
  assert.match(sql, /disconnected_connection_unexpected_success/u);
  assert.match(sql, /wrong_contact_unexpected_success/u);
  assert.match(sql, /invalid_platform_unexpected_success/u);
  assert.match(sql, /coalescing_invalid/u);
  assert.match(sql, /lease_exclusivity_invalid/u);
  assert.match(sql, /new_generation_preservation_invalid/u);
  assert.match(sql, /lease_restart_invalid/u);
  assert.equal(sql.match(/from public\.claim_meta_conversation_catchup_job/gu)?.length, 9);
  assert.equal(sql.match(/'retry',\s*'meta_sync_failed'/gu)?.length, 5);
  assert.match(sql, /attempt_count = 5/u);
  assert.match(sql, /status = 'dead_letter'/u);
  assert.match(sql, /rollback;/u);
  assert.match(sql, /rollback_cleanup_invalid/u);
  assert.doesNotMatch(sql, /\bcommit\s*;/iu);
  assert.doesNotMatch(sql, /conversation_messages|content_sources|analysis|send_message/iu);
});

test("anon and authenticated runtime probes attempt table and function access", () => {
  for (const role of ["anon", "authenticated"]) {
  const tableProbe = buildMetaCatchupQueueRoleDenialSql(role, "table");
    const functionProbe = buildMetaCatchupQueueRoleDenialSql(role, "function");
    assert.match(tableProbe, new RegExp(`set role ${role}`, "u"));
    assert.match(tableProbe, /META_CATCHUP_QUEUE_STAGING_ROLE_SWITCH=PASS/u);
    assert.match(tableProbe, /meta_conversation_catchup_jobs/u);
    assert.match(functionProbe, /enqueue_meta_conversation_catchup/u);
  }
  assert.throws(
    () => buildMetaCatchupQueueRoleDenialSql("service_role", "table"),
    /role_probe_invalid/u,
  );
});

test("offline check needs no database, workspace or provider credentials", async () => {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [scriptPath, "--check"],
    { env: process.env },
  );
  const output = `${stdout}\n${stderr}`;
  assert.match(output, /META_CATCHUP_QUEUE_STAGING_ACCEPTANCE_MODE=check/u);
  assert.match(output, /META_CATCHUP_QUEUE_STAGING_ACCEPTANCE_READY=YES/u);
  assert.doesNotMatch(output, /11111111|postgres|supabase|token|secret/iu);
});

test("run mode accepts only four denied role probes and fixed rollback markers", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fanmind-meta-acceptance-test-"));
  const binDirectory = join(directory, "bin");
  const passfile = join(directory, "pgpass");
  const fakePsql = join(binDirectory, "psql");
  await mkdir(binDirectory);
  await writeFile(passfile, "host:5432:postgres:user:test-password\n", {
    mode: 0o600,
  });
  await writeFile(
    fakePsql,
    `#!/bin/sh
if [ "\${1:-}" = "--version" ]; then
  exit 0
fi
INPUT="$(/bin/cat)"
case "$INPUT" in
  *"set role anon;"*|*"set role authenticated;"*)
    printf '%s\n' 'META_CATCHUP_QUEUE_STAGING_ROLE_SWITCH=PASS'
    exit 1
    ;;
esac
printf '%s\n' \\
  'META_CATCHUP_QUEUE_STAGING_SCOPE_DENIALS=4' \\
  'META_CATCHUP_QUEUE_STAGING_COALESCING=PASS' \\
  'META_CATCHUP_QUEUE_STAGING_LEASE_RESTART=PASS' \\
  'META_CATCHUP_QUEUE_STAGING_RETRY_ATTEMPTS=5' \\
  'META_CATCHUP_QUEUE_STAGING_DEAD_LETTER=PASS' \\
  'META_CATCHUP_QUEUE_STAGING_ROLLBACK=PASS'
`,
    { mode: 0o700 },
  );
  await chmod(fakePsql, 0o700);

  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [scriptPath, "--run"],
      {
        env: {
          ...stagingEnvironment(),
          PATH: `${binDirectory}:${process.env.PATH ?? "/usr/bin:/bin"}`,
          PGPASSFILE: passfile,
        },
      },
    );
    const output = `${stdout}\n${stderr}`;
    assert.match(output, /META_CATCHUP_QUEUE_STAGING_BROWSER_DENIALS=4/u);
    assert.match(output, /META_CATCHUP_QUEUE_STAGING_SCOPE_DENIALS=4/u);
    assert.match(output, /META_CATCHUP_QUEUE_STAGING_RETRY_ATTEMPTS=5/u);
    assert.match(output, /META_CATCHUP_QUEUE_STAGING_ROLLBACK=PASS/u);
    assert.match(output, /META_CATCHUP_QUEUE_STAGING_PROVIDER_CALLS=0/u);
    assert.match(output, /META_CATCHUP_QUEUE_STAGING_ANALYSIS_CALLS=0/u);
    assert.match(output, /META_CATCHUP_QUEUE_STAGING_SEND_CALLS=0/u);
    assert.match(output, /SECRETS_WURDEN_NICHT_AUSGEGEBEN=true/u);
    assert.doesNotMatch(output, /test-password|11111111|fanmind-acceptance-sender/iu);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("manual workflow requires migrated Staging and performs no provider work", async () => {
  const [workflow, script] = await Promise.all([
    readFile(workflowPath, "utf8"),
    readFile(scriptPath, "utf8"),
  ]);
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /inputs\.reviewed_commit == github\.sha/u);
  assert.match(workflow, /environment: staging/u);
  assert.match(workflow, /timeout-minutes: 12/u);
  assert.match(
    workflow,
    /inputs\.confirmation == 'run-meta-catchup-queue-staging-acceptance'/u,
  );
  assert.match(workflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'true'/u);
  assert.match(workflow, /npm run db:staging-rollout-state:run/u);
  assert.match(workflow, /STAGING_DATABASE_ROLLOUT_META_CATCHUP=verify/u);
  assert.match(workflow, /STAGING_DATABASE_ROLLOUT_STATE=PASS/u);
  assert.match(workflow, /npm run db:meta-catchup-queue:verify/u);
  assert.match(workflow, /npm run meta:catchup-queue:staging:run/u);
  assert.doesNotMatch(
    workflow,
    /META_ACCESS|META_CATCHUP_WORKER_SECRET|OPENAI_API|STRIPE_SECRET/u,
  );
  assert.doesNotMatch(script, /fetch\(|https?:\/\//u);
});
