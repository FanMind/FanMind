import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  chmod,
  mkdtemp,
  readFile,
  readdir,
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
  EXPECTED_CONTROLLED_SQL_SHA256,
  POSTFLIGHT_SQL,
  PRECHECK_SQL,
  evaluateInternalDailyTestProvisioningSql,
  materializeInternalDailyTestProvisioningPostflight,
} from "../scripts/operations/internal-daily-test-provisioning-migration-runner.mjs";
import {
  INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_APPLY_CONFIRMATION,
  INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_VERIFY_CONFIRMATION,
  evaluateInternalDailyTestWorkspaceProvisioningStagingEnvironment,
} from "../src/lib/internalDailyTestWorkspaceProvisioningStagingPolicy.mjs";

const execFileAsync = promisify(execFile);
const runnerPath =
  "scripts/operations/internal-daily-test-provisioning-migration-runner.mjs";
const controlledSqlPath =
  "supabase/controlled/20260808230102_internal_daily_test_workspace_provisioning.sql";
const formerGenericMigrationPath =
  "supabase/migrations/20260808230102_internal_daily_test_workspace_provisioning.sql";
const runbookPath =
  "docs/operations/INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING.md";
const REVIEWED_COMMIT = "a".repeat(40);
const STAGING_REF = "stagingref0123456789";
const PRODUCTION_REF = "prodref0123456789012";

function baseEnvironment() {
  return {
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: REVIEWED_COMMIT,
    FANMIND_INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_REVIEWED_COMMIT:
      REVIEWED_COMMIT,
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.invalid",
    FANMIND_TARGET_API_ORIGIN: "https://staging.fanmind.invalid",
    FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
    NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
    FANMIND_TARGET_SUPABASE_PROJECT_REF: STAGING_REF,
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "",
    FANMIND_INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_VERIFY_CONFIRM:
      INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_VERIFY_CONFIRMATION,
    PGHOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_TARGET_DB_HOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_PRODUCTION_DB_HOST: "aws-0-eu-central-1.pooler.supabase.com",
    PGPORT: "5432",
    PGDATABASE: "postgres",
    PGUSER: `postgres.${STAGING_REF}`,
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: "/etc/ssl/certs/ca-certificates.crt",
  };
}

function applyEnvironment() {
  const environment = baseEnvironment();
  delete environment.FANMIND_INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_VERIFY_CONFIRM;
  return {
    ...environment,
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    FANMIND_INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_APPLY_CONFIRM:
      INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_APPLY_CONFIRMATION,
  };
}

async function withFakeDatabase(callback, overrides = {}) {
  const root = await mkdtemp(
    join(tmpdir(), "fanmind-daily-provisioning-test-"),
  );
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
INPUT="$(cat)"
printf '%s\\n' "$INPUT" >> "$FANMIND_TEST_PSQL_INPUT_LOG"
printf '%s\\n' '-- FANMIND TEST CALL END --' >> "$FANMIND_TEST_PSQL_INPUT_LOG"
if [ "$FANMIND_TEST_PSQL_RESULT" = "fail" ]; then
  echo "raw-private-db-error staging-secret-value" >&2
  exit 1
fi
case "$INPUT" in
  *INTERNAL_DAILY_TEST_PROVISIONING_PREFLIGHT=PASS*)
    echo "INTERNAL_DAILY_TEST_PROVISIONING_PREFLIGHT=PASS"
    ;;
  *INTERNAL_DAILY_TEST_PROVISIONING_POSTFLIGHT=PASS*)
    echo "INTERNAL_DAILY_TEST_PROVISIONING_POSTFLIGHT=PASS"
    ;;
esac
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

test("offline check pins the controlled Daily SQL outside generic discovery", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    runnerPath,
    "--check",
  ]);
  const output = `${stdout}\n${stderr}`;
  assert.match(output, /INTERNAL_DAILY_TEST_PROVISIONING_CHECKSUM=verified/u);
  assert.match(output, /INTERNAL_DAILY_TEST_PROVISIONING_CONTRACT=verified/u);
  assert.match(output, /INTERNAL_DAILY_TEST_PROVISIONING_MODE=check/u);
  assert.match(output, /INTERNAL_DAILY_TEST_PROVISIONING_READY=YES/u);

  const sql = await readFile(controlledSqlPath, "utf8");
  const result = evaluateInternalDailyTestProvisioningSql(sql);
  assert.equal(result.digest, EXPECTED_CONTROLLED_SQL_SHA256);
  const materializedPostflight =
    materializeInternalDailyTestProvisioningPostflight(sql);
  assert.doesNotMatch(materializedPostflight, /__FANMIND_[A-Z_]+__/u);
  assert.match(
    materializedPostflight,
    new RegExp(
      Buffer.from("\ndeclare\n  v_workspace_id uuid;", "utf8")
        .toString("hex"),
      "u",
    ),
  );
  assert.throws(
    () => evaluateInternalDailyTestProvisioningSql(`${sql}\n-- drift`),
    /controlled_sql_checksum_mismatch/u,
  );
  await assert.rejects(stat(formerGenericMigrationPath), /ENOENT/u);

  const genericSqlFiles = (await readdir("supabase/migrations")).filter(
    (file) => file.endsWith(".sql"),
  );
  const genericSql = (
    await Promise.all(
      genericSqlFiles.map((file) =>
        readFile(join("supabase/migrations", file), "utf8"),
      ),
    )
  ).join("\n");
  assert.doesNotMatch(
    genericSql,
    /ensure_internal_daily_test_workspace|internal_daily_test_workspace_provisioning_ready|workspaces_commercial_option_daily_check/u,
  );
});

test("read-only verify and apply require separate exact gates", () => {
  const verify = evaluateInternalDailyTestWorkspaceProvisioningStagingEnvironment(
    baseEnvironment(),
    { mode: "verify" },
  );
  assert.equal(verify.ok, true);
  assert.equal(verify.writeEnabled, false);

  const apply = evaluateInternalDailyTestWorkspaceProvisioningStagingEnvironment(
    applyEnvironment(),
    { mode: "apply" },
  );
  assert.equal(apply.ok, true);
  assert.equal(apply.writeEnabled, true);

  const crossed =
    evaluateInternalDailyTestWorkspaceProvisioningStagingEnvironment(
      {
        ...applyEnvironment(),
        FANMIND_INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_APPLY_CONFIRM:
          INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_VERIFY_CONFIRMATION,
      },
      { mode: "apply" },
    );
  assert.equal(crossed.ok, false);
  assert.ok(crossed.errors.includes("confirmation"));
});

test("control policy rejects Production, commit, TLS and libpq drift", () => {
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
    { GITHUB_REF: "refs/heads/agent/security" },
    { GITHUB_SHA: "b".repeat(40) },
    {
      FANMIND_INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_REVIEWED_COMMIT:
        "invalid",
    },
    { PGUSER: "postgres" },
    { PGPORT: "6543" },
    { PGSSLMODE: "require" },
    { PGSSLROOTCERT: "relative-ca.crt" },
    { PGHOSTADDR: "192.0.2.10" },
    { PGSERVICE: "production" },
    { PGPASSWORD: "redirect-password" },
    { DATABASE_URL: "postgresql://unexpected.invalid/postgres" },
  ];
  for (const mutation of mutations) {
    const result =
      evaluateInternalDailyTestWorkspaceProvisioningStagingEnvironment(
        { ...baseEnvironment(), ...mutation },
        { mode: "verify" },
      );
    assert.equal(result.ok, false, JSON.stringify(mutation));
  }
});

test("verify runs exactly one read-only postflight", async () => {
  await withFakeDatabase(async ({ environment, callLog, inputLog }) => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [runnerPath, "--verify"],
      { env: environment },
    );
    const output = `${stdout}\n${stderr}`;
    const calls = await readFile(callLog, "utf8");
    const sql = await readFile(inputLog, "utf8");

    assert.match(
      output,
      /INTERNAL_DAILY_TEST_PROVISIONING_APPLY=not_requested/u,
    );
    assert.match(output, /INTERNAL_DAILY_TEST_PROVISIONING_POSTFLIGHT=PASS/u);
    assert.equal(calls.trim().split("\n").length, 1);
    assert.match(sql, /set transaction read only/iu);
    assert.match(sql, /internal_daily_test_workspace_provisioning_ready/iu);
    assert.doesNotMatch(sql, /create or replace function/iu);
    assert.doesNotMatch(
      `${output}\n${calls}`,
      /stagingref0123456789|pooler\.supabase|staging-secret-value/u,
    );
  });
});

test("apply runs preflight, exact SQL and postflight in that order", async () => {
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

      assert.match(output, /INTERNAL_DAILY_TEST_PROVISIONING_PREFLIGHT=PASS/u);
      assert.match(output, /INTERNAL_DAILY_TEST_PROVISIONING_APPLY=completed/u);
      assert.match(output, /INTERNAL_DAILY_TEST_PROVISIONING_POSTFLIGHT=PASS/u);
      assert.equal(calls.trim().split("\n").length, 3);
      assert.match(
        calls,
        /--no-password --no-psqlrc --quiet --tuples-only --no-align/u,
      );
      assert.ok(
        sql.indexOf("INTERNAL_DAILY_TEST_PROVISIONING_PREFLIGHT=PASS") <
          sql.indexOf("create or replace function public.ensure_internal"),
      );
      assert.ok(
        sql.indexOf("create or replace function public.ensure_internal") <
          sql.indexOf("INTERNAL_DAILY_TEST_PROVISIONING_POSTFLIGHT=PASS"),
      );
      assert.doesNotMatch(
        `${output}\n${calls}`,
        /stagingref0123456789|pooler\.supabase|staging-secret-value/u,
      );
    },
    applyEnvironment(),
  );
});

test("preflight is count-only, ledger-aware and checks exact prerequisites", () => {
  assert.match(PRECHECK_SQL, /set transaction read only/iu);
  assert.match(PRECHECK_SQL, /supabase_migrations\.schema_migrations/iu);
  assert.match(PRECHECK_SQL, /version = '20260808230102'/u);
  assert.match(PRECHECK_SQL, /generic_migration_ledger_missing/u);
  assert.match(PRECHECK_SQL, /ensure_current_user_workspace\(text,text,boolean\)/u);
  assert.match(PRECHECK_SQL, /workspaces_owner_user_id_uidx/u);
  assert.match(PRECHECK_SQL, /workspace_members_workspace_user_uidx/u);
  assert.match(PRECHECK_SQL, /indpred is null/u);
  assert.match(PRECHECK_SQL, /indnkeyatts = 2/u);
  assert.match(PRECHECK_SQL, /has_any_column_privilege/iu);
  assert.match(PRECHECK_SQL, /workspace_value_contract_incompatible/u);
  assert.doesNotMatch(PRECHECK_SQL, /select\s+(?:id|email|name)\b/iu);
  assert.match(PRECHECK_SQL, /rollback;/u);
});

test("postflight independently verifies functions, ACL, constraints and indexes", () => {
  assert.match(POSTFLIGHT_SQL, /set transaction read only/iu);
  assert.match(POSTFLIGHT_SQL, /supabase_migrations\.schema_migrations/iu);
  assert.match(
    POSTFLIGHT_SQL,
    /bool_and\([\s\S]*coalesce\([\s\S]*proconfig = array\['search_path=pg_catalog, public, pg_temp'\][\s\S]*false[\s\S]*\)/u,
  );
  assert.doesNotMatch(POSTFLIGHT_SQL, /bool_and\(\s*proconfig @>/u);
  assert.match(
    POSTFLIGHT_SQL,
    /select count\(\*\) = 2[\s\S]*bool_and\(prosecdef\)/u,
  );
  assert.doesNotMatch(POSTFLIGHT_SQL, /group by true/iu);
  assert.match(POSTFLIGHT_SQL, /proowner = to_regrole\('postgres'\)/u);
  assert.match(POSTFLIGHT_SQL, /function_language\.lanname = 'plpgsql'/u);
  assert.match(POSTFLIGHT_SQL, /function_language\.lanname = 'sql'/u);
  assert.match(POSTFLIGHT_SQL, /provolatile = 'v'/u);
  assert.match(POSTFLIGHT_SQL, /provolatile = 's'/u);
  assert.match(
    POSTFLIGHT_SQL,
    /oid = readiness_rpc[\s\S]*prorettype = 'boolean'::regtype/u,
  );
  assert.match(POSTFLIGHT_SQL, /proargmodes =/u);
  assert.match(
    POSTFLIGHT_SQL,
    /prosrc = convert_from\([\s\S]*__FANMIND_DAILY_RPC_BODY_HEX__/u,
  );
  assert.match(
    POSTFLIGHT_SQL,
    /prosrc = convert_from\([\s\S]*__FANMIND_READINESS_RPC_BODY_HEX__/u,
  );
  assert.match(
    POSTFLIGHT_SQL,
    /select count\(\*\) = 2[\s\S]*function_acl\.privilege_type = 'EXECUTE'/u,
  );
  assert.match(POSTFLIGHT_SQL, /bool_and\(not function_acl\.is_grantable\)/u);
  assert.match(
    POSTFLIGHT_SQL,
    /function_acl\.grantor = function_definition\.proowner/u,
  );
  assert.match(
    POSTFLIGHT_SQL,
    /function_acl\.grantee = function_definition\.proowner/u,
  );
  assert.match(
    POSTFLIGHT_SQL,
    /function_acl\.grantee = to_regrole\('service_role'\)/u,
  );
  assert.match(POSTFLIGHT_SQL, /workspaces_commercial_option_check/u);
  assert.match(POSTFLIGHT_SQL, /pg_get_constraintdef/u);
  assert.match(POSTFLIGHT_SQL, /workspaces_owner_user_id_uidx/u);
  assert.match(POSTFLIGHT_SQL, /workspace_members_workspace_user_uidx/u);
  assert.match(POSTFLIGHT_SQL, /has_any_column_privilege/iu);
  assert.match(POSTFLIGHT_SQL, /where ready/u);
  assert.match(POSTFLIGHT_SQL, /rollback;/u);
});

test("database failures and unsafe passfiles expose only fixed codes", async () => {
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
            /INTERNAL_DAILY_TEST_PROVISIONING_ERROR=postflight_failed/u,
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
        /INTERNAL_DAILY_TEST_PROVISIONING_ERROR=passfile_invalid/u,
      );

      await chmod(passfile, 0o600);
      const link = `${passfile}.link`;
      await symlink(passfile, link);
      await assert.rejects(
        execFileAsync(process.execPath, [runnerPath, "--verify"], {
          env: { ...environment, PGPASSFILE: link },
        }),
        /INTERNAL_DAILY_TEST_PROVISIONING_ERROR=passfile_invalid/u,
      );
    },
    { FANMIND_TEST_PSQL_RESULT: "fail" },
  );
});

test("manual workflows are pinned, exact-main and protected-Staging bound", async () => {
  const [verifyWorkflow, applyWorkflow] = await Promise.all(
    [
      "internal-daily-test-workspace-provisioning-staging-verify.yml",
      "internal-daily-test-workspace-provisioning-staging-apply.yml",
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
    assert.match(workflow, /PGSSLMODE: verify-full/u);
    assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/u);
    assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/u);
    assert.match(workflow, /chmod 600 "\$PGPASSFILE"/u);
    assert.match(workflow, /rm -f "\$PGPASSFILE"/u);
    assert.doesNotMatch(workflow, /\bschedule:/u);
  }
  assert.match(
    verifyWorkflow,
    /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'/u,
  );
  assert.match(
    verifyWorkflow,
    /verify-internal-daily-test-workspace-provisioning/u,
  );
  assert.match(verifyWorkflow, /db:daily-workspace-provisioning:verify/u);
  assert.doesNotMatch(verifyWorkflow, /db:daily-workspace-provisioning:apply/u);
  assert.match(
    applyWorkflow,
    /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'true'/u,
  );
  assert.match(
    applyWorkflow,
    /FANMIND_NON_PRODUCTION_WRITE_ACK: I_UNDERSTAND_NON_PRODUCTION_ONLY/u,
  );
  assert.match(
    applyWorkflow,
    /apply-internal-daily-test-workspace-provisioning/u,
  );
  assert.match(applyWorkflow, /db:daily-workspace-provisioning:apply/u);
});

test("normal deploy and generic migration paths cannot apply the control", async () => {
  const [deploy, packageJson, runbook, sourceOfTruth, schema] =
    await Promise.all(
      [
        "scripts/operations/deploy-isolated-release.sh",
        "package.json",
        runbookPath,
        "docs/SOURCE_OF_TRUTH.md",
        "docs/database/fanmind_current_schema.md",
      ].map((file) => readFile(file, "utf8")),
    );
  assert.doesNotMatch(
    deploy,
    /internal-daily-test-provisioning|20260808230102/iu,
  );
  assert.match(packageJson, /db:daily-workspace-provisioning:check/u);
  assert.match(
    runbook,
    /generisches[\s\S]{0,30}`supabase db push`[\s\S]{0,30}weder/iu,
  );
  assert.match(runbook, new RegExp(EXPECTED_CONTROLLED_SQL_SHA256, "u"));
  assert.match(
    runbook,
    /Production-Kontrollpfad/iu,
  );
  for (const reader of [sourceOfTruth, schema]) {
    assert.match(reader, /supabase\/controlled/iu);
    assert.match(reader, /(?:db push|Web-Deploy)/iu);
  }
});
