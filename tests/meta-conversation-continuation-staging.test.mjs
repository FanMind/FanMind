import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  EXPECTED_MIGRATION_SHA256,
  POSTFLIGHT_SQL,
  PREFLIGHT_SQL,
  STATE_SQL,
  evaluateMetaConversationContinuationMigrationSql,
} from "../scripts/operations/meta-conversation-continuation-migration-runner.mjs";
import {
  META_CONVERSATION_CONTINUATION_APPLY_CONFIRMATION,
  META_CONVERSATION_CONTINUATION_VERIFY_CONFIRMATION,
  evaluateMetaConversationContinuationStagingEnvironment,
} from "../src/lib/metaConversationContinuationStagingPolicy.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "..");
const runnerPath = resolve(
  repositoryRoot,
  "scripts/operations/meta-conversation-continuation-migration-runner.mjs",
);
const migrationPath = resolve(
  repositoryRoot,
  "supabase/migrations/20260811220000_meta_conversation_sync_continuation.sql",
);
const applyWorkflowPath = resolve(
  repositoryRoot,
  ".github/workflows/meta-conversation-continuation-staging-apply.yml",
);
const verifyWorkflowPath = resolve(
  repositoryRoot,
  ".github/workflows/meta-conversation-continuation-staging-verify.yml",
);
const normalDeployWorkflowPaths = [
  resolve(repositoryRoot, ".github/workflows/deploy-fanmind.yml"),
  resolve(repositoryRoot, ".github/workflows/deploy-staging.yml"),
];
const REVIEWED_COMMIT = "a".repeat(40);
const STAGING_REF = "stagingref0123456789";
const PRODUCTION_REF = "prodref0123456789012";

function baseEnvironment(mode = "verify") {
  return {
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: REVIEWED_COMMIT,
    FANMIND_META_CONVERSATION_CONTINUATION_REVIEWED_COMMIT: REVIEWED_COMMIT,
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.invalid",
    FANMIND_TARGET_API_ORIGIN: "https://staging.fanmind.invalid",
    FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
    NEXT_PUBLIC_SUPABASE_URL: "https://" + STAGING_REF + ".supabase.co",
    FANMIND_TARGET_SUPABASE_PROJECT_REF: STAGING_REF,
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
    FANMIND_ENABLE_NON_PRODUCTION_WRITES:
      mode === "apply" ? "true" : "false",
    FANMIND_NON_PRODUCTION_WRITE_ACK:
      mode === "apply" ? "I_UNDERSTAND_NON_PRODUCTION_ONLY" : "",
    FANMIND_META_CONVERSATION_CONTINUATION_VERIFY_CONFIRM:
      mode === "verify"
        ? META_CONVERSATION_CONTINUATION_VERIFY_CONFIRMATION
        : "",
    FANMIND_META_CONVERSATION_CONTINUATION_APPLY_CONFIRM:
      mode === "apply"
        ? META_CONVERSATION_CONTINUATION_APPLY_CONFIRMATION
        : "",
    PGHOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_TARGET_DB_HOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_PRODUCTION_DB_HOST:
      "aws-0-eu-central-1.pooler.supabase.com",
    PGPORT: "5432",
    PGDATABASE: "postgres",
    PGUSER: "postgres." + STAGING_REF,
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: "/etc/ssl/certs/ca-certificates.crt",
  };
}

async function withFakeDatabase(initialState, callback) {
  const root = await mkdtemp(join(tmpdir(), "fanmind-meta-continuation-test-"));
  try {
    const fakePsql = join(root, "psql");
    const passfile = join(root, "pgpass");
    const callLog = join(root, "psql-calls.log");
    const marker = join(root, "migration-applied");
    await writeFile(
      fakePsql,
      [
        "#!/bin/sh",
        "if [ \"$1\" = \"--version\" ]; then exit 0; fi",
        "input=\"$(cat)\"",
        "printf 'call\\n' >> \"$FANMIND_TEST_CALL_LOG\"",
        "case \"$input\" in",
        "  *META_CONVERSATION_CONTINUATION_STATE=*)",
        "    if [ -f \"$FANMIND_TEST_APPLIED_MARKER\" ]; then",
        "      echo 'META_CONVERSATION_CONTINUATION_STATE=present'",
        "    else",
        "      echo \"META_CONVERSATION_CONTINUATION_STATE=$FANMIND_TEST_INITIAL_STATE\"",
        "    fi",
        "    ;;",
        "  *META_CONVERSATION_CONTINUATION_PREFLIGHT=PASS*)",
        "    echo 'META_CONVERSATION_CONTINUATION_PREFLIGHT=PASS'",
        "    ;;",
        "  *'alter table public.social_connections'*)",
        "    touch \"$FANMIND_TEST_APPLIED_MARKER\"",
        "    ;;",
        "  *META_CONVERSATION_CONTINUATION_POSTFLIGHT=PASS*)",
        "    if [ -f \"$FANMIND_TEST_APPLIED_MARKER\" ] || [ \"$FANMIND_TEST_INITIAL_STATE\" = \"present\" ]; then",
        "      echo 'META_CONVERSATION_CONTINUATION_POSTFLIGHT=PASS'",
        "    else",
        "      exit 1",
        "    fi",
        "    ;;",
        "  *) exit 1 ;;",
        "esac",
        "",
      ].join("\n"),
      { mode: 0o700 },
    );
    await writeFile(
      passfile,
      "host:5432:postgres:postgres." + STAGING_REF + ":private-password\n",
      { mode: 0o600 },
    );
    await chmod(passfile, 0o600);
    const environment = {
      ...process.env,
      ...baseEnvironment("verify"),
      PATH: root + ":" + process.env.PATH,
      PGPASSFILE: passfile,
      FANMIND_TEST_CALL_LOG: callLog,
      FANMIND_TEST_APPLIED_MARKER: marker,
      FANMIND_TEST_INITIAL_STATE: initialState,
    };
    return await callback({ environment, callLog, passfile });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("offline control pins the exact continuation migration", async () => {
  const migrationSql = await readFile(migrationPath, "utf8");
  const result = evaluateMetaConversationContinuationMigrationSql(migrationSql);
  assert.equal(result.digest, EXPECTED_MIGRATION_SHA256);
  assert.throws(
    () =>
      evaluateMetaConversationContinuationMigrationSql(
        migrationSql + "\n-- unexpected drift\n",
      ),
    /migration_checksum_mismatch/u,
  );
  const { stdout } = await execFileAsync(
    process.execPath,
    [runnerPath, "--check"],
    { cwd: repositoryRoot },
  );
  assert.match(stdout, /META_CONVERSATION_CONTINUATION_CHECKSUM=verified/u);
  assert.match(stdout, /META_CONVERSATION_CONTINUATION_CONTRACT=verified/u);
  assert.match(stdout, /META_CONVERSATION_CONTINUATION_READY=YES/u);
});

test("state, preflight and postflight probes are read-only and rollback-only", () => {
  for (const sql of [STATE_SQL, PREFLIGHT_SQL, POSTFLIGHT_SQL]) {
    assert.match(sql, /begin;[\s\S]*set transaction read only;[\s\S]*rollback;/u);
    assert.doesNotMatch(
      sql,
      /^\s*(?:insert|update|delete|alter|create|drop|truncate|grant|revoke)\b/imu,
    );
  }
  assert.match(POSTFLIGHT_SQL, /social_connections_rls_invalid/u);
  assert.match(PREFLIGHT_SQL, /browser_table_privilege_invalid/u);
  assert.match(PREFLIGHT_SQL, /service_role_table_privilege_invalid/u);
  assert.match(POSTFLIGHT_SQL, /continuation_column_default_invalid/u);
  assert.match(POSTFLIGHT_SQL, /length\(messenger_sync_continuation_after\) >= 1/u);
  assert.match(POSTFLIGHT_SQL, /length\(messenger_sync_continuation_after\) <= 2048/u);
  assert.match(POSTFLIGHT_SQL, /browser_continuation_privilege_invalid/u);
  assert.match(POSTFLIGHT_SQL, /service_role_continuation_privilege_invalid/u);
  assert.match(POSTFLIGHT_SQL, /public_continuation_privilege_invalid/u);
});

test("verify and apply require independent exact Staging gates", () => {
  const verify = evaluateMetaConversationContinuationStagingEnvironment(
    baseEnvironment("verify"),
    { mode: "verify" },
  );
  assert.equal(verify.ok, true);
  assert.equal(verify.writeEnabled, false);

  const apply = evaluateMetaConversationContinuationStagingEnvironment(
    baseEnvironment("apply"),
    { mode: "apply" },
  );
  assert.equal(apply.ok, true);
  assert.equal(apply.writeEnabled, true);

  for (const mutation of [
    { GITHUB_REF: "refs/heads/agent/meta" },
    { GITHUB_SHA: "b".repeat(40) },
    { PGSSLMODE: "require" },
    { PGSSLROOTCERT: "relative-ca.crt" },
    { PGUSER: "postgres." + PRODUCTION_REF },
    { PGPORT: "6543" },
    { DATABASE_URL: "postgresql://redirect.invalid/postgres" },
    {
      NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
      FANMIND_TARGET_API_ORIGIN: "https://fanmind.ch",
    },
    {
      FANMIND_META_CONVERSATION_CONTINUATION_VERIFY_CONFIRM:
        META_CONVERSATION_CONTINUATION_APPLY_CONFIRMATION,
    },
  ]) {
    const evaluation =
      evaluateMetaConversationContinuationStagingEnvironment(
        { ...baseEnvironment("verify"), ...mutation },
        { mode: "verify" },
      );
    assert.equal(evaluation.ok, false, JSON.stringify(mutation));
  }
});

test("verify observes present metadata without applying SQL", async () => {
  await withFakeDatabase("present", async ({ environment, callLog }) => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [runnerPath, "--verify"],
      { cwd: repositoryRoot, env: environment },
    );
    const calls = (await readFile(callLog, "utf8")).trim().split("\n");
    assert.equal(calls.length, 2);
    assert.match(stdout, /META_CONVERSATION_CONTINUATION_APPLY=not_requested/u);
    assert.match(stdout, /META_CONVERSATION_CONTINUATION_POSTFLIGHT=PASS/u);
    assert.doesNotMatch(
      stdout + "\n" + stderr,
      /private-password|stagingref0123456789|pooler\.supabase/u,
    );
  });
});

test("apply writes only from absent and otherwise remains idempotent", async () => {
  await withFakeDatabase("absent", async ({ environment, callLog }) => {
    const applyEnvironment = {
      ...environment,
      ...baseEnvironment("apply"),
      PATH: environment.PATH,
      PGPASSFILE: environment.PGPASSFILE,
      FANMIND_TEST_CALL_LOG: environment.FANMIND_TEST_CALL_LOG,
      FANMIND_TEST_APPLIED_MARKER:
        environment.FANMIND_TEST_APPLIED_MARKER,
      FANMIND_TEST_INITIAL_STATE: environment.FANMIND_TEST_INITIAL_STATE,
    };
    const { stdout } = await execFileAsync(
      process.execPath,
      [runnerPath, "--apply"],
      { cwd: repositoryRoot, env: applyEnvironment },
    );
    const calls = (await readFile(callLog, "utf8")).trim().split("\n");
    assert.equal(calls.length, 4);
    assert.match(stdout, /META_CONVERSATION_CONTINUATION_PREFLIGHT=PASS/u);
    assert.match(stdout, /META_CONVERSATION_CONTINUATION_APPLY=completed/u);
    assert.match(stdout, /META_CONVERSATION_CONTINUATION_ACTIVATION=disabled/u);
  });

  await withFakeDatabase("present", async ({ environment, callLog }) => {
    const applyEnvironment = {
      ...environment,
      ...baseEnvironment("apply"),
      PATH: environment.PATH,
      PGPASSFILE: environment.PGPASSFILE,
      FANMIND_TEST_CALL_LOG: environment.FANMIND_TEST_CALL_LOG,
      FANMIND_TEST_APPLIED_MARKER:
        environment.FANMIND_TEST_APPLIED_MARKER,
      FANMIND_TEST_INITIAL_STATE: environment.FANMIND_TEST_INITIAL_STATE,
    };
    const { stdout } = await execFileAsync(
      process.execPath,
      [runnerPath, "--apply"],
      { cwd: repositoryRoot, env: applyEnvironment },
    );
    const calls = (await readFile(callLog, "utf8")).trim().split("\n");
    assert.equal(calls.length, 2);
    assert.match(
      stdout,
      /META_CONVERSATION_CONTINUATION_APPLY=already_current/u,
    );
  });
});

test("partial schema and unsafe passfiles fail closed with fixed codes", async () => {
  await withFakeDatabase(
    "partial",
    async ({ environment, callLog, passfile }) => {
      const applyEnvironment = {
        ...environment,
        ...baseEnvironment("apply"),
        PATH: environment.PATH,
        PGPASSFILE: environment.PGPASSFILE,
        FANMIND_TEST_CALL_LOG: environment.FANMIND_TEST_CALL_LOG,
        FANMIND_TEST_APPLIED_MARKER:
          environment.FANMIND_TEST_APPLIED_MARKER,
        FANMIND_TEST_INITIAL_STATE: environment.FANMIND_TEST_INITIAL_STATE,
      };
      await assert.rejects(
        execFileAsync(process.execPath, [runnerPath, "--apply"], {
          cwd: repositoryRoot,
          env: applyEnvironment,
        }),
        /META_CONVERSATION_CONTINUATION_ERROR=existing_schema_invalid/u,
      );
      assert.equal(
        (await readFile(callLog, "utf8")).trim().split("\n").length,
        1,
      );

      await chmod(passfile, 0o644);
      await assert.rejects(
        execFileAsync(process.execPath, [runnerPath, "--verify"], {
          cwd: repositoryRoot,
          env: environment,
        }),
        /META_CONVERSATION_CONTINUATION_ERROR=passfile_invalid/u,
      );
      await chmod(passfile, 0o600);
      const link = passfile + ".link";
      await symlink(passfile, link);
      await assert.rejects(
        execFileAsync(process.execPath, [runnerPath, "--verify"], {
          cwd: repositoryRoot,
          env: { ...environment, PGPASSFILE: link },
        }),
        /META_CONVERSATION_CONTINUATION_ERROR=passfile_read_failed/u,
      );
    },
  );
});

test("manual workflows are commit-exact, TLS-pinned, and never activate Meta", async () => {
  const [applyWorkflow, verifyWorkflow] = await Promise.all([
    readFile(applyWorkflowPath, "utf8"),
    readFile(verifyWorkflowPath, "utf8"),
  ]);
  for (const workflow of [applyWorkflow, verifyWorkflow]) {
    assert.match(workflow, /workflow_dispatch/u);
    assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
    assert.match(workflow, /inputs\.reviewed_commit == github\.sha/u);
    assert.match(workflow, /environment: staging/u);
    assert.match(workflow, /PGSSLMODE: verify-full/u);
    assert.match(workflow, /supabase-root-2021-ca\.crt/u);
    assert.match(workflow, /PGUSER:.*postgres\.\{0\}/u);
    assert.match(workflow, /npm run db:staging-rollout-state:run/u);
    assert.match(workflow, /STAGING_DATABASE_ROLLOUT_META_CONTENT=verify/u);
    assert.match(workflow, /STAGING_DATABASE_ROLLOUT_STATE=PASS/u);
    assert.doesNotMatch(
      workflow,
      /FANMIND_META_(?:CATCHUP_QUEUE_)?ENABLED|provider_token|provider_secret/iu,
    );
  }
  assert.match(applyWorkflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'true'/u);
  assert.match(applyWorkflow, /STAGING_DATABASE_ROLLOUT_META_CONTENT=verify/u);
  assert.match(applyWorkflow, /STAGING_DATABASE_ROLLOUT_META_CONTINUATION=apply/u);
  assert.match(applyWorkflow, /STAGING_DATABASE_ROLLOUT_STATE=PASS/u);
  assert.match(verifyWorkflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'/u);
  assert.match(verifyWorkflow, /STAGING_DATABASE_ROLLOUT_META_CONTINUATION=verify/u);
  assert.doesNotMatch(verifyWorkflow, /:apply|--apply/iu);
});

test("normal Web deploys cannot invoke the continuation database control", async () => {
  for (const deployWorkflow of await Promise.all(
    normalDeployWorkflowPaths.map((path) => readFile(path, "utf8")),
  )) {
    assert.doesNotMatch(
      deployWorkflow,
      /meta-conversation-continuation|20260811220000|supabase\s+db\s+push/iu,
    );
  }
});
