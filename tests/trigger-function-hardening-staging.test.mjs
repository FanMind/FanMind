import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  EXPECTED_MIGRATION_SHA256,
  POSTFLIGHT_SQL,
  evaluateTriggerFunctionHardeningMigrationSql,
} from "../scripts/operations/trigger-function-hardening-migration-runner.mjs";
import {
  TRIGGER_FUNCTION_HARDENING_APPLY_CONFIRMATION,
  TRIGGER_FUNCTION_HARDENING_VERIFY_CONFIRMATION,
  evaluateTriggerFunctionHardeningStagingEnvironment,
} from "../src/lib/triggerFunctionHardeningStagingPolicy.mjs";

const execFileAsync = promisify(execFile);
const runnerPath =
  "scripts/operations/trigger-function-hardening-migration-runner.mjs";
const controlledSqlPath =
  "supabase/controlled/20260806203023_harden_trigger_function_privileges.sql";
const formerGenericMigrationPath =
  "supabase/migrations/20260806203023_harden_trigger_function_privileges.sql";
const runbookPath =
  "docs/operations/TRIGGER_FUNCTION_HARDENING_STAGING.md";
const REVIEWED_COMMIT = "a".repeat(40);
const STAGING_REF = "stagingref0123456789";
const PRODUCTION_REF = "prodref0123456789012";

function baseEnvironment() {
  return {
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: REVIEWED_COMMIT,
    FANMIND_TRIGGER_FUNCTION_HARDENING_REVIEWED_COMMIT: REVIEWED_COMMIT,
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.invalid",
    FANMIND_TARGET_API_ORIGIN: "https://staging.fanmind.invalid",
    FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
    NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
    FANMIND_TARGET_SUPABASE_PROJECT_REF: STAGING_REF,
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "",
    FANMIND_TRIGGER_FUNCTION_HARDENING_VERIFY_CONFIRM:
      TRIGGER_FUNCTION_HARDENING_VERIFY_CONFIRMATION,
    PGHOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_TARGET_DB_HOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_PRODUCTION_DB_HOST:
      "aws-0-eu-central-1.pooler.supabase.com",
    PGPORT: "5432",
    PGDATABASE: "postgres",
    PGUSER: `postgres.${STAGING_REF}`,
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: "/etc/ssl/certs/ca-certificates.crt",
  };
}

function applyEnvironment() {
  const environment = baseEnvironment();
  delete environment.FANMIND_TRIGGER_FUNCTION_HARDENING_VERIFY_CONFIRM;
  return {
    ...environment,
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    FANMIND_TRIGGER_FUNCTION_HARDENING_APPLY_CONFIRM:
      TRIGGER_FUNCTION_HARDENING_APPLY_CONFIRMATION,
  };
}

async function withFakeDatabase(callback, overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), "fanmind-trigger-hardening-test-"));
  try {
    const fakePsql = join(root, "psql");
    const passfile = join(root, "pgpass");
    const callLog = join(root, "psql-calls.log");
    const inputLog = join(root, "psql-input.log");
    await writeFile(
      fakePsql,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  exit 0
fi
printf '%s\\n' "$*" >> "$FANMIND_TEST_PSQL_CALL_LOG"
cat >> "$FANMIND_TEST_PSQL_INPUT_LOG"
printf '\\n-- FANMIND TEST CALL END --\\n' >> "$FANMIND_TEST_PSQL_INPUT_LOG"
if [ "$FANMIND_TEST_PSQL_RESULT" = "fail" ]; then
  echo "raw-private-db-error staging-secret-value" >&2
  exit 1
fi
echo "TRIGGER_FUNCTION_HARDENING_POSTFLIGHT=PASS"
`,
      { mode: 0o700 },
    );
    await writeFile(
      passfile,
      "aws-0-eu-central-1.pooler.supabase.com:5432:postgres:postgres.stagingref0123456789:staging-secret-value\n",
      { mode: 0o600 },
    );
    await chmod(passfile, 0o600);

    const environment = {
      ...process.env,
      ...baseEnvironment(),
      PATH: `${root}:${process.env.PATH}`,
      FANMIND_TEST_PSQL_CALL_LOG: callLog,
      FANMIND_TEST_PSQL_INPUT_LOG: inputLog,
      PGPASSFILE: passfile,
      ...overrides,
    };

    return await callback({ environment, callLog, inputLog, passfile });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("offline check pins the controlled hardening SQL and narrow contract", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    runnerPath,
    "--check",
  ]);
  const output = `${stdout}\n${stderr}`;
  assert.match(output, /TRIGGER_FUNCTION_HARDENING_CHECKSUM=verified/u);
  assert.match(output, /TRIGGER_FUNCTION_HARDENING_CONTRACT=verified/u);
  assert.match(output, /TRIGGER_FUNCTION_HARDENING_MODE=check/u);
  assert.match(output, /TRIGGER_FUNCTION_HARDENING_READY=YES/u);

  const sql = await readFile(controlledSqlPath, "utf8");
  const result = evaluateTriggerFunctionHardeningMigrationSql(sql);
  assert.equal(result.digest, EXPECTED_MIGRATION_SHA256);
  assert.throws(
    () => evaluateTriggerFunctionHardeningMigrationSql(`${sql}\n-- drift`),
    /migration_checksum_mismatch/u,
  );
  await assert.rejects(stat(formerGenericMigrationPath), /ENOENT/u);
});

test("read-only verify and apply require separate explicit gates", () => {
  const verify = evaluateTriggerFunctionHardeningStagingEnvironment(
    baseEnvironment(),
    { mode: "verify" },
  );
  assert.equal(verify.ok, true);
  assert.equal(verify.writeEnabled, false);

  const apply = evaluateTriggerFunctionHardeningStagingEnvironment(
    applyEnvironment(),
    { mode: "apply" },
  );
  assert.equal(apply.ok, true);
  assert.equal(apply.writeEnabled, true);

  const crossed = evaluateTriggerFunctionHardeningStagingEnvironment(
    {
      ...applyEnvironment(),
      FANMIND_TRIGGER_FUNCTION_HARDENING_APPLY_CONFIRM:
        TRIGGER_FUNCTION_HARDENING_VERIFY_CONFIRMATION,
    },
    { mode: "apply" },
  );
  assert.equal(crossed.ok, false);
  assert.ok(crossed.errors.includes("confirmation"));
});

test("shared regional Supavisor host stays project-ref and PGUSER bound", () => {
  const sharedPooler = evaluateTriggerFunctionHardeningStagingEnvironment(
    baseEnvironment(),
    { mode: "verify" },
  );
  assert.equal(sharedPooler.ok, true);

  for (const mutation of [
    { FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "" },
    { FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: STAGING_REF },
    { PGUSER: `postgres.${PRODUCTION_REF}` },
    { PGUSER: `postgres.${STAGING_REF}.extra` },
    {
      PGHOST: "shared-database.internal",
      FANMIND_TARGET_DB_HOST: "shared-database.internal",
      FANMIND_PRODUCTION_DB_HOST: "shared-database.internal",
    },
  ]) {
    const result = evaluateTriggerFunctionHardeningStagingEnvironment(
      { ...baseEnvironment(), ...mutation },
      { mode: "verify" },
    );
    assert.equal(result.ok, false, JSON.stringify(mutation));
  }
});

test("control policy rejects Production, target drift and libpq redirects", () => {
  const mutations = [
    {
      NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
      FANMIND_TARGET_API_ORIGIN: "https://fanmind.ch",
    },
    {
      NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co`,
      FANMIND_TARGET_SUPABASE_PROJECT_REF: PRODUCTION_REF,
      PGUSER: `postgres.${PRODUCTION_REF}`,
    },
    {
      PGHOST: "production-db.internal",
      FANMIND_TARGET_DB_HOST: "production-db.internal",
      FANMIND_PRODUCTION_DB_HOST: "production-db.internal",
    },
    { FANMIND_PRODUCTION_DB_HOST: "" },
    { GITHUB_REF: "refs/heads/agent/security" },
    { GITHUB_SHA: "b".repeat(40) },
    { FANMIND_TRIGGER_FUNCTION_HARDENING_REVIEWED_COMMIT: "invalid" },
    { PGUSER: "postgres" },
    { PGPORT: "6543" },
    { PGSSLMODE: "require" },
    { PGSSLROOTCERT: "relative-ca.crt" },
    { PGHOSTADDR: "192.0.2.10" },
    { PGSERVICE: "production" },
  ];
  for (const mutation of mutations) {
    const result = evaluateTriggerFunctionHardeningStagingEnvironment(
      { ...baseEnvironment(), ...mutation },
      { mode: "verify" },
    );
    assert.equal(result.ok, false, JSON.stringify(mutation));
  }
});

test("verify runs exactly one read-only metadata postflight", async () => {
  await withFakeDatabase(async ({ environment, callLog, inputLog }) => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [runnerPath, "--verify"],
      { env: environment },
    );
    const output = `${stdout}\n${stderr}`;
    const calls = await readFile(callLog, "utf8");
    const sql = await readFile(inputLog, "utf8");

    assert.match(output, /TRIGGER_FUNCTION_HARDENING_APPLY=not_requested/u);
    assert.match(output, /TRIGGER_FUNCTION_HARDENING_POSTFLIGHT=PASS/u);
    assert.equal(calls.trim().split("\n").length, 1);
    assert.match(sql, /set transaction read only/iu);
    assert.match(sql, /pg_proc/iu);
    assert.match(sql, /aclexplode/iu);
    assert.doesNotMatch(sql, /alter function|revoke all/iu);
    assert.doesNotMatch(
      `${output}\n${calls}`,
      /stagingref0123456789|pooler\.supabase|staging-secret-value/u,
    );
  });
});

test("apply runs only the pinned SQL and the read-only postflight", async () => {
  await withFakeDatabase(
    async ({ environment, callLog, inputLog }) => {
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        [runnerPath, "--apply"],
        { env: environment },
      );
      const output = `${stdout}\n${stderr}`;
      const calls = await readFile(callLog, "utf8");
      const sql = await readFile(inputLog, "utf8");

      assert.match(output, /TRIGGER_FUNCTION_HARDENING_APPLY=completed/u);
      assert.match(output, /TRIGGER_FUNCTION_HARDENING_POSTFLIGHT=PASS/u);
      assert.equal(calls.trim().split("\n").length, 2);
      assert.match(
        calls,
        /--no-password --no-psqlrc --quiet --tuples-only --no-align/u,
      );
      assert.match(
        sql,
        /alter function public\.set_social_connections_updated_at\(\)/u,
      );
      assert.match(sql, /set transaction read only/iu);
      assert.doesNotMatch(
        `${output}\n${calls}`,
        /stagingref0123456789|pooler\.supabase|staging-secret-value/u,
      );
    },
    applyEnvironment(),
  );
});

test("postflight covers fixed search paths and every browser execute grant", () => {
  for (const functionName of [
    "set_social_connections_updated_at",
    "set_referral_updated_at",
    "set_demo_start_session_updated_at",
    "trim_conversation_messages_to_latest_50",
  ]) {
    assert.match(POSTFLIGHT_SQL, new RegExp(functionName, "u"));
  }
  assert.match(
    POSTFLIGHT_SQL,
    /proconfig @> array\['search_path=pg_catalog, pg_temp'\]/u,
  );
  assert.match(POSTFLIGHT_SQL, /has_function_privilege\('anon'/u);
  assert.match(POSTFLIGHT_SQL, /has_function_privilege\([\s\S]*'authenticated'/u);
  assert.match(POSTFLIGHT_SQL, /function_acl\.grantee = 0/u);
  assert.match(POSTFLIGHT_SQL, /function_acl\.privilege_type = 'EXECUTE'/u);
  assert.match(POSTFLIGHT_SQL, /prosecdef/u);
  assert.match(POSTFLIGHT_SQL, /rollback;/u);
});

test("database failures and unsafe passfiles expose fixed codes only", async () => {
  await withFakeDatabase(
    async ({ environment, passfile }) => {
      await assert.rejects(
        execFileAsync(process.execPath, [runnerPath, "--verify"], {
          env: environment,
        }),
        (error) => {
          const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
          assert.match(
            output,
            /TRIGGER_FUNCTION_HARDENING_ERROR=postflight_failed/u,
          );
          assert.doesNotMatch(
            output,
            /raw-private-db-error|staging-secret-value|pooler\.supabase/u,
          );
          return true;
        },
      );

      delete environment.FANMIND_TEST_PSQL_RESULT;
      await chmod(passfile, 0o644);
      await assert.rejects(
        execFileAsync(process.execPath, [runnerPath, "--verify"], {
          env: environment,
        }),
        /TRIGGER_FUNCTION_HARDENING_ERROR=passfile_invalid/u,
      );

      await chmod(passfile, 0o600);
      const link = `${passfile}.link`;
      await symlink(passfile, link);
      await assert.rejects(
        execFileAsync(process.execPath, [runnerPath, "--verify"], {
          env: { ...environment, PGPASSFILE: link },
        }),
        /TRIGGER_FUNCTION_HARDENING_ERROR=passfile_invalid/u,
      );
    },
    { FANMIND_TEST_PSQL_RESULT: "fail" },
  );
});

test("manual workflows are exact-main, reviewed-commit and Staging bound", async () => {
  const [verifyWorkflow, applyWorkflow] = await Promise.all(
    [
      "trigger-function-hardening-staging-verify.yml",
      "trigger-function-hardening-staging-apply.yml",
    ].map((file) =>
      readFile(new URL(`../.github/workflows/${file}`, import.meta.url), "utf8"),
    ),
  );
  for (const workflow of [verifyWorkflow, applyWorkflow]) {
    assert.match(workflow, /workflow_dispatch:/u);
    assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
    assert.match(workflow, /inputs\.reviewed_commit == github\.sha/u);
    assert.match(workflow, /environment: staging/u);
    assert.match(workflow, /FANMIND_PRODUCTION_SUPABASE_PROJECT_REF/u);
    assert.match(workflow, /FANMIND_PRODUCTION_DB_HOST/u);
    assert.match(workflow, /FANMIND_PRODUCTION_API_ORIGIN/u);
    assert.match(workflow, /PGSSLMODE: verify-full/u);
    assert.match(workflow, /PGPASSFILE:.*fanmind-trigger-function-hardening/iu);
    assert.match(workflow, /chmod 600 "\$PGPASSFILE"/u);
    assert.match(workflow, /rm -f "\$PGPASSFILE"/u);
    assert.doesNotMatch(workflow, /\bschedule:/u);
  }
  assert.match(
    verifyWorkflow,
    /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'/u,
  );
  assert.match(verifyWorkflow, /db:trigger-function-hardening:verify/u);
  assert.doesNotMatch(verifyWorkflow, /db:trigger-function-hardening:apply/u);
  assert.match(
    applyWorkflow,
    /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'true'/u,
  );
  assert.match(
    applyWorkflow,
    /FANMIND_NON_PRODUCTION_WRITE_ACK: I_UNDERSTAND_NON_PRODUCTION_ONLY/u,
  );
  assert.match(applyWorkflow, /db:trigger-function-hardening:apply/u);
});

test("normal deploy and generic migration discovery cannot apply the control", async () => {
  const [deploy, packageJson, runbook, agents, security, schema] =
    await Promise.all(
      [
        "scripts/operations/deploy-isolated-release.sh",
        "package.json",
        runbookPath,
        "AGENTS.md",
        "docs/SECURITY_RLS_SECRETS_CHECK.md",
        "docs/database/fanmind_current_schema.md",
      ].map((file) => readFile(file, "utf8")),
    );
  assert.doesNotMatch(
    deploy,
    /trigger-function-hardening|20260806203023_harden_trigger_function_privileges/iu,
  );
  assert.match(packageJson, /db:trigger-function-hardening:check/u);
  assert.match(runbook, /generisches `supabase db push`[^]*niemals/iu);
  assert.match(runbook, /keinen Production-Apply/iu);
  assert.match(runbook, /6eb928fe7df73072ce03d6e78dfca7feb5c77c950fbdd70ffe1169e4dabf1132/u);
  for (const reader of [agents, security, schema]) {
    assert.match(reader, /supabase\/controlled/iu);
    assert.match(reader, /(?:db push|Web deploy|Web-Deploy)/iu);
  }
});
