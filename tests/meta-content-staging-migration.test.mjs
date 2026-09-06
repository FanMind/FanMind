import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { evaluateMetaContentStagingMigrationEnvironment } from "../src/lib/metaContentStagingMigrationPolicy.mjs";
import {
  MIGRATIONS,
  POSTFLIGHT_SQL,
  STATE_SQL,
  evaluateMetaContentMigrationSql,
} from "../scripts/operations/meta-content-migration-runner.mjs";

const execFileAsync = promisify(execFile);
const runnerPath = "scripts/operations/meta-content-migration-runner.mjs";

function baseEnvironment(mode = "apply") {
  const apply = mode === "apply";
  return {
    ...process.env,
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.example",
    NEXT_PUBLIC_SUPABASE_URL: "https://stagingref123.supabase.co",
    FANMIND_TARGET_API_ORIGIN: "https://staging.fanmind.example",
    FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
    FANMIND_TARGET_SUPABASE_PROJECT_REF: "stagingref123",
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: apply ? "true" : "false",
    FANMIND_NON_PRODUCTION_WRITE_ACK: apply
      ? "I_UNDERSTAND_NON_PRODUCTION_ONLY"
      : "",
    FANMIND_META_CONTENT_REVIEWED_COMMIT: "a".repeat(40),
    FANMIND_META_CONTENT_STAGING_MIGRATION_CONFIRM:
      "apply-meta-content-intelligence-migrations",
    FANMIND_META_CONTENT_STAGING_VERIFY_CONFIRM:
      "verify-meta-content-intelligence-schema",
    FANMIND_META_CONTENT_STAGING_RESOURCE_CONFIRM:
      "verify-meta-content-staging-resources",
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: "a".repeat(40),
    PGHOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_TARGET_DB_HOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_PRODUCTION_DB_HOST: "aws-0-eu-central-1.pooler.supabase.com",
    PGPORT: "5432",
    PGDATABASE: "postgres",
    PGUSER: "postgres.stagingref123",
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: "/etc/ssl/certs/ca-certificates.crt",
  };
}

async function withFakeDatabase(state, callback) {
  const root = await mkdtemp(join(tmpdir(), "fanmind-meta-migration-test-"));
  try {
    const fakePsql = join(root, "psql");
    const passfile = join(root, "pgpass");
    const appliedMarker = join(root, "applied");
    const callLog = join(root, "calls.log");
    await writeFile(
      fakePsql,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "psql (PostgreSQL) synthetic"
  exit 0
fi
input="$(mktemp)"
cat > "$input"
printf '%s\n' "$*" >> "$FANMIND_TEST_PSQL_CALL_LOG"
if grep -q 'META_CONTENT_MIGRATION_STATE=' "$input"; then
  echo "META_CONTENT_MIGRATION_STATE=$FANMIND_TEST_META_STATE"
  rm -f "$input"
  exit 0
fi
if grep -q 'META_CONTENT_FOUNDATION_POSTFLIGHT=PASS' "$input"; then
  if [ "$FANMIND_TEST_META_STATE" = "foundation" ] || [ "$FANMIND_TEST_META_STATE" = "installed" ]; then
    echo "META_CONTENT_FOUNDATION_POSTFLIGHT=PASS"
    rm -f "$input"
    exit 0
  fi
  rm -f "$input"
  exit 1
fi
if grep -q 'META_CONTENT_MIGRATION_POSTFLIGHT=PASS' "$input"; then
  if [ "$FANMIND_TEST_META_STATE" = "installed" ] || [ -f "$FANMIND_TEST_APPLIED_MARKER" ]; then
    echo "META_CONTENT_MIGRATION_POSTFLIGHT=PASS"
    rm -f "$input"
    exit 0
  fi
  rm -f "$input"
  exit 1
fi
if { grep -q 'create table if not exists public.workspace_analysis_settings' "$input" &&
     grep -q 'drop trigger if exists conversation_messages_trim_to_latest_50' "$input"; } ||
   grep -q 'conversation_messages_meta_external_message_unique_idx' "$input"; then
  touch "$FANMIND_TEST_APPLIED_MARKER"
  rm -f "$input"
  exit 0
fi
rm -f "$input"
exit 1
`,
      { mode: 0o700 },
    );
    await writeFile(
      passfile,
      "aws-0-eu-central-1.pooler.supabase.com:5432:postgres:postgres.stagingref123:private-password\n",
      { mode: 0o600 },
    );
    await chmod(passfile, 0o600);

    const mode = state === "verify"
      ? "verify"
      : state.startsWith("readiness-")
        ? "readiness"
        : "apply";
    const databaseState = state === "verify"
      ? "installed"
      : state.replace(/^readiness-/u, "");
    const environment = {
      ...baseEnvironment(mode),
      PATH: `${root}:${process.env.PATH}`,
      PGPASSFILE: passfile,
      FANMIND_TEST_META_STATE: databaseState,
      FANMIND_TEST_APPLIED_MARKER: appliedMarker,
      FANMIND_TEST_PSQL_CALL_LOG: callLog,
    };
    return await callback({ environment, callLog, passfile });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("offline check pins all controlled Meta migrations and their inactive boundary", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    runnerPath,
    "--check",
  ]);
  const output = `${stdout}\n${stderr}`;
  assert.equal(
    output.match(/META_CONTENT_MIGRATION_CHECKSUM=verified/gu)?.length,
    3,
  );
  assert.equal(
    output.match(/META_CONTENT_MIGRATION_CONTRACT=verified/gu)?.length,
    3,
  );
  assert.match(output, /META_CONTENT_MIGRATION_READY=YES/u);

  for (const migration of MIGRATIONS) {
    const sql = await readFile(
      migration.path,
      "utf8",
    );
    assert.equal(
      evaluateMetaContentMigrationSql(migration.id, sql).digest,
      migration.sha256,
    );
    assert.throws(
      () => evaluateMetaContentMigrationSql(migration.id, `${sql}\n-- drift`),
      /migration_checksum_mismatch/u,
    );
  }
});

test("environment policy blocks wrong commits, Production targets and weak TLS", () => {
  assert.equal(
    evaluateMetaContentStagingMigrationEnvironment(baseEnvironment(), {
      mode: "apply",
    }).ok,
    true,
  );
  for (const mutation of [
    { GITHUB_REF: "refs/heads/agent/meta" },
    { GITHUB_SHA: "b".repeat(40) },
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://productionref123.supabase.co",
      FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionref123",
    },
    { FANMIND_PRODUCTION_DB_HOST: "" },
    {
      PGHOST: "db.stagingref123.supabase.co",
      FANMIND_TARGET_DB_HOST: "db.stagingref123.supabase.co",
    },
    { PGPORT: "6543" },
    { PGUSER: "postgres" },
    { PGUSER: "postgres.productionref123" },
    { PGHOSTADDR: "127.0.0.1" },
    { PGSSLMODE: "require" },
    { PGSSLROOTCERT: "relative-ca.pem" },
  ]) {
    const result = evaluateMetaContentStagingMigrationEnvironment(
      { ...baseEnvironment(), ...mutation },
      { mode: "apply" },
    );
    assert.equal(result.ok, false, JSON.stringify(mutation));
  }
});

test("resource readiness is read-only before or after a complete schema", async () => {
  for (const [state, expectedState, expectedCalls] of [
    ["readiness-absent", "absent", 1],
    ["readiness-foundation", "upgrade_required", 2],
    ["readiness-installed", "current", 2],
  ]) {
    await withFakeDatabase(state, async ({ environment, callLog }) => {
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        [runnerPath, "--readiness"],
        { env: environment },
      );
      const output = `${stdout}\n${stderr}`;
      const calls = await readFile(callLog, "utf8");
      assert.match(output, /META_CONTENT_MIGRATION_MODE=readiness/u);
      assert.match(
        output,
        new RegExp(`META_CONTENT_STAGING_SCHEMA=${expectedState}`, "u"),
      );
      assert.match(output, /META_CONTENT_MIGRATION_APPLY=not_requested/u);
      assert.match(output, /META_CONTENT_STAGING_RESOURCES=PASS/u);
      assert.match(output, /META_CONTENT_ANALYSIS_ACTIVATION=disabled/u);
      assert.equal(calls.trim().split("\n").length, expectedCalls);
      assert.doesNotMatch(output, /private-password|stagingref123|pooler/u);
    });
  }
});

test("resource readiness blocks a partial schema without applying SQL", async () => {
  await withFakeDatabase(
    "readiness-partial",
    async ({ environment, callLog }) => {
      let rejection;
      try {
        await execFileAsync(process.execPath, [runnerPath, "--readiness"], {
          env: environment,
        });
      } catch (error) {
        rejection = error;
      }
      assert.ok(rejection);
      const output = `${rejection.stdout ?? ""}\n${rejection.stderr ?? ""}`;
      const calls = await readFile(callLog, "utf8");
      assert.match(
        output,
        /META_CONTENT_MIGRATION_ERROR=existing_schema_invalid/u,
      );
      assert.equal(calls.trim().split("\n").length, 1);
      assert.doesNotMatch(output, /private-password|stagingref123|pooler/u);
    },
  );
});

test("resource workflow cannot invoke the Meta migration apply mode", async () => {
  const workflow = await readFile(
    ".github/workflows/meta-content-staging-resource-readiness.yml",
    "utf8",
  );
  assert.match(workflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'/u);
  assert.match(workflow, /db:meta-content:readiness/u);
  assert.match(workflow, /verify-meta-content-staging-resources/u);
  assert.match(
    workflow,
    /format\('postgres\.\{0\}', vars\.FANMIND_STAGING_SUPABASE_PROJECT_REF\)/u,
  );
  assert.doesNotMatch(workflow, /db:meta-content:apply/u);
  assert.doesNotMatch(workflow, /I_UNDERSTAND_NON_PRODUCTION_ONLY/u);
});

test("verify runs only the read-only metadata, RLS and column postflight", async () => {
  await withFakeDatabase("verify", async ({ environment, callLog }) => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [runnerPath, "--verify"],
      { env: environment },
    );
    const output = `${stdout}\n${stderr}`;
    const calls = await readFile(callLog, "utf8");
    assert.match(output, /META_CONTENT_MIGRATION_APPLY=not_requested/u);
    assert.match(output, /META_CONTENT_MIGRATION_POSTFLIGHT=PASS/u);
    assert.match(output, /META_CONTENT_ANALYSIS_ACTIVATION=disabled/u);
    assert.equal(calls.trim().split("\n").length, 1);
    assert.match(POSTFLIGHT_SQL, /set transaction read only/iu);
    assert.match(POSTFLIGHT_SQL, /token_column_privilege_invalid/iu);
    assert.match(POSTFLIGHT_SQL, /browser_write_policy_invalid/iu);
    assert.match(POSTFLIGHT_SQL, /cmd <> 'SELECT'[\s\S]*?permissive = 'RESTRICTIVE'[\s\S]*?browser_write_policy_invalid/iu);
    assert.match(POSTFLIGHT_SQL, /browser_write_privilege_invalid/iu);
    assert.match(POSTFLIGHT_SQL, /cmd in \('INSERT', 'UPDATE', 'DELETE'\)/u);
    assert.match(POSTFLIGHT_SQL, /roles = array\['authenticated'\]::name\[\]/u);
    assert.match(POSTFLIGHT_SQL, /_requires_workspace_owner/u);
    assert.match(POSTFLIGHT_SQL, /service_role_privilege_invalid/iu);
    assert.match(POSTFLIGHT_SQL, /obsolete_retention_trigger_present/iu);
    assert.match(
      POSTFLIGHT_SQL,
      /conversation_messages_meta_external_message_unique_idx/iu,
    );
    assert.match(
      POSTFLIGHT_SQL,
      /conversation_messages_meta_external_comment_unique_idx/iu,
    );
    assert.match(STATE_SQL, /META_CONTENT_MIGRATION_STATE=/u);
    assert.match(STATE_SQL, /foundation_all and not idempotency_any/iu);
    assert.doesNotMatch(output, /private-password|stagingref123|pooler/u);
  });
});

test("apply is atomic, postflight-bound and safely repeatable", async () => {
  await withFakeDatabase("absent", async ({ environment, callLog }) => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [runnerPath, "--apply"],
      { env: environment },
    );
    const output = `${stdout}\n${stderr}`;
    const calls = await readFile(callLog, "utf8");
    assert.match(output, /META_CONTENT_MIGRATION_APPLY=completed/u);
    assert.match(output, /META_CONTENT_MIGRATION_POSTFLIGHT=PASS/u);
    assert.equal(calls.trim().split("\n").length, 4);
    assert.doesNotMatch(output, /private-password|stagingref123|pooler/u);
  });

  await withFakeDatabase("foundation", async ({ environment, callLog }) => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [runnerPath, "--apply"],
      { env: environment },
    );
    const output = `${stdout}\n${stderr}`;
    const calls = await readFile(callLog, "utf8");
    assert.match(output, /META_CONTENT_MIGRATION_APPLY=completed/u);
    assert.match(output, /META_CONTENT_MIGRATION_POSTFLIGHT=PASS/u);
    assert.equal(calls.trim().split("\n").length, 5);
    assert.doesNotMatch(output, /private-password|stagingref123|pooler/u);
  });

  await withFakeDatabase("installed", async ({ environment, callLog }) => {
    const { stdout } = await execFileAsync(
      process.execPath,
      [runnerPath, "--apply"],
      { env: environment },
    );
    const calls = await readFile(callLog, "utf8");
    assert.match(stdout, /META_CONTENT_MIGRATION_APPLY=already_current/u);
    assert.match(stdout, /META_CONTENT_MIGRATION_POSTFLIGHT=PASS/u);
    assert.equal(calls.trim().split("\n").length, 2);
  });
});

test("partial schemas and unsafe password files fail closed without details", async () => {
  await withFakeDatabase("partial", async ({ environment }) => {
    await assert.rejects(
      execFileAsync(process.execPath, [runnerPath, "--apply"], {
        env: environment,
      }),
      (error) => {
        const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
        assert.match(
          output,
          /META_CONTENT_MIGRATION_ERROR=existing_schema_invalid/u,
        );
        assert.doesNotMatch(
          output,
          /private-password|stagingref123|pooler/u,
        );
        return true;
      },
    );
  });

  await withFakeDatabase("installed", async ({ environment, passfile }) => {
    await chmod(passfile, 0o644);
    await assert.rejects(
      execFileAsync(process.execPath, [runnerPath, "--apply"], {
        env: environment,
      }),
      (error) => {
        const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
        assert.match(output, /META_CONTENT_MIGRATION_ERROR=passfile_invalid/u);
        assert.doesNotMatch(output, /private-password/u);
        return true;
      },
    );
  });
});

test("Facebook comment OAuth is read-only and diagnostics include Insights", async () => {
  const [scopes, policy, actions] = await Promise.all([
    readFile("src/lib/facebookScopes.ts", "utf8"),
    readFile("src/lib/metaIntegrationPolicy.mjs", "utf8"),
    readFile("src/app/channels/facebookWebhookActions.ts", "utf8"),
  ]);
  for (const source of [scopes, policy, actions]) {
    assert.doesNotMatch(source, /pages_manage_engagement/u);
    assert.doesNotMatch(source, /business_management/u);
  }
  assert.match(
    scopes,
    /FACEBOOK_COMMENT_FEED_SCOPES[\s\S]*FACEBOOK_PAGES_READ_USER_CONTENT_SCOPE/u,
  );
  assert.match(actions, /"pages_read_user_content"[\s\S]*"read_insights"/u);
  assert.match(policy, /comments:[\s\S]*"pages_read_user_content"/u);
});
