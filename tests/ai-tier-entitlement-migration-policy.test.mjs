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
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { POSTFLIGHT_SQL } from "../scripts/operations/ai-tier-entitlement-migration-runner.mjs";

const execFileAsync = promisify(execFile);
const runnerPath =
  "scripts/operations/ai-tier-entitlement-migration-runner.mjs";
const runbookPath =
  "docs/operations/AI_TIER_ENTITLEMENT_STORAGE.md";
const migrationPath =
  "supabase/migrations/20260727090000_workspace_ai_tier_entitlements.sql";
const stagingWorkflowPath =
  ".github/workflows/ai-tier-staging-migration.yml";

test("postflight disambiguates the conditional constraint count expression", () => {
  assert.match(
    POSTFLIGHT_SQL,
    /<> \(case when ledger_state = 'post_ledger' then 12 else 10 end\) then/u,
  );
});

async function withFakeDatabase(callback, overrides = {}) {
  const root = await mkdtemp(
    join(tmpdir(), "fanmind-ai-tier-migration-test-"),
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
  echo "psql (PostgreSQL) synthetic"
  exit 0
fi
printf '%s\\n' "$*" >> "$FANMIND_TEST_PSQL_CALL_LOG"
cat >> "$FANMIND_TEST_PSQL_INPUT_LOG"
printf '\\n-- FANMIND TEST CALL END --\\n' >> "$FANMIND_TEST_PSQL_INPUT_LOG"
if [ "$FANMIND_TEST_PSQL_RESULT" = "fail" ]; then
  echo "raw-private-db-error" >&2
  exit 1
fi
echo "AI_TIER_ENTITLEMENT_MIGRATION_POSTFLIGHT=PASS"
`,
      { mode: 0o700 },
    );
    await writeFile(
      passfile,
      "db.synthetic.example:5432:postgres:postgres:synthetic-password\n",
      { mode: 0o600 },
    );
    await chmod(passfile, 0o600);

    const environment = {
      ...process.env,
      PATH: `${root}:${process.env.PATH}`,
      FANMIND_TEST_PSQL_CALL_LOG: callLog,
      FANMIND_TEST_PSQL_INPUT_LOG: inputLog,
      FANMIND_RUNTIME_ENVIRONMENT: "production",
      NEXT_PUBLIC_SUPABASE_URL: "https://productionref123.supabase.co",
      FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionref123",
      FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
      FANMIND_TARGET_DB_HOST: "db.synthetic.example",
      PGHOST: "db.synthetic.example",
      PGPORT: "5432",
      PGDATABASE: "postgres",
      PGUSER: "postgres",
      PGPASSFILE: passfile,
      FANMIND_AI_TIER_ENTITLEMENT_MIGRATION_CONFIRM:
        "apply-workspace-ai-tier-entitlements",
      FANMIND_PRODUCTION_CHANGE_TICKET: "FM-766-rollout",
      ...overrides,
    };

    return await callback({
      environment,
      callLog,
      inputLog,
      passfile,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("offline check pins the reviewed entitlement migration and boundary", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    runnerPath,
  ]);
  const output = `${stdout}\n${stderr}`;

  assert.match(
    output,
    /AI_TIER_ENTITLEMENT_MIGRATION_CHECKSUM=verified/u,
  );
  assert.match(
    output,
    /AI_TIER_ENTITLEMENT_MIGRATION_CONTRACT=verified/u,
  );
  assert.match(output, /AI_TIER_ENTITLEMENT_MIGRATION_MODE=check/u);
  assert.match(output, /AI_TIER_ENTITLEMENT_MIGRATION_READY=YES/u);

  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /force row level security/u);
  assert.match(
    migration,
    /revoke all[\s\S]*from public, anon, authenticated/u,
  );
  assert.match(
    migration,
    /grant select, insert, update, delete[\s\S]*to service_role/u,
  );
  assert.doesNotMatch(migration, /create\s+policy/iu);
});

test("verify binds the target and runs only the read-only metadata postflight", async () => {
  await withFakeDatabase(
    async ({ environment, callLog, inputLog }) => {
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
        /AI_TIER_ENTITLEMENT_MIGRATION_TARGET=production/u,
      );
      assert.match(
        output,
        /AI_TIER_ENTITLEMENT_MIGRATION_PROJECT_BINDING=verified/u,
      );
      assert.match(
        output,
        /AI_TIER_ENTITLEMENT_MIGRATION_DATABASE_BINDING=verified/u,
      );
      assert.match(
        output,
        /AI_TIER_ENTITLEMENT_MIGRATION_APPLY=not_requested/u,
      );
      assert.match(
        output,
        /AI_TIER_ENTITLEMENT_MIGRATION_POSTFLIGHT=PASS/u,
      );
      assert.equal(calls.trim().split("\n").length, 1);
      assert.match(sql, /set transaction read only/iu);
      assert.match(sql, /pg_class/iu);
      assert.match(sql, /information_schema|pg_constraint|pg_policies/iu);
      assert.doesNotMatch(
        sql,
        /select\s+\*\s+from\s+public\.workspace_ai_tier_entitlements/iu,
      );
      assert.doesNotMatch(
        output,
        /productionref123|db\.synthetic|synthetic-password/u,
      );
      assert.doesNotMatch(
        calls,
        /productionref123|db\.synthetic|synthetic-password/u,
      );
    },
  );
});

test("apply requires the exact confirmation and a production change ticket", async () => {
  await withFakeDatabase(async ({ environment }) => {
    for (const override of [
      { FANMIND_AI_TIER_ENTITLEMENT_MIGRATION_CONFIRM: "yes" },
      { FANMIND_PRODUCTION_CHANGE_TICKET: "" },
      { FANMIND_PRODUCTION_CHANGE_TICKET: undefined },
    ]) {
      await assert.rejects(
        execFileAsync(process.execPath, [runnerPath, "--apply"], {
          env: { ...environment, ...override },
        }),
        (error) => {
          const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
          assert.match(
            output,
            /AI_TIER_ENTITLEMENT_MIGRATION_ERROR=(apply_confirmation_invalid|production_change_ticket_missing)/u,
          );
          assert.doesNotMatch(
            output,
            /productionref123|db\.synthetic|synthetic-password/u,
          );
          return true;
        },
      );
    }
  });
});

test("apply runs the pinned migration once and the postflight once", async () => {
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

      assert.match(
        output,
        /AI_TIER_ENTITLEMENT_MIGRATION_APPLY=completed/u,
      );
      assert.match(
        output,
        /AI_TIER_ENTITLEMENT_MIGRATION_POSTFLIGHT=PASS/u,
      );
      assert.equal(calls.trim().split("\n").length, 2);
      assert.match(
        calls,
        /--no-password --no-psqlrc --set=ON_ERROR_STOP=1/u,
      );
      assert.match(
        sql,
        /create table public\.workspace_ai_tier_entitlements/iu,
      );
      assert.match(sql, /set transaction read only/iu);
      assert.doesNotMatch(
        calls,
        /synthetic-password|productionref123/u,
      );
    },
  );
});

test("staging apply requires both non-production write gates", async () => {
  await withFakeDatabase(async ({ environment, callLog }) => {
    const staging = {
      ...environment,
      FANMIND_RUNTIME_ENVIRONMENT: "staging",
      NEXT_PUBLIC_SUPABASE_URL:
        "https://stagingref12345.supabase.co",
      FANMIND_TARGET_SUPABASE_PROJECT_REF: "stagingref12345",
      FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
      FANMIND_PRODUCTION_CHANGE_TICKET: "",
    };

    for (const override of [
      {},
      { FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false" },
      {
        FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
        FANMIND_NON_PRODUCTION_WRITE_ACK: "yes",
      },
    ]) {
      await assert.rejects(
        execFileAsync(process.execPath, [runnerPath, "--apply"], {
          env: { ...staging, ...override },
        }),
        (error) => {
          const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
          assert.match(
            output,
            /AI_TIER_ENTITLEMENT_MIGRATION_ERROR=staging_write_acknowledgement_invalid/u,
          );
          assert.doesNotMatch(
            output,
            /stagingref12345|productionref123|db\.synthetic|synthetic-password/u,
          );
          return true;
        },
      );
    }

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [runnerPath, "--apply"],
      {
        env: {
          ...staging,
          FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
          FANMIND_NON_PRODUCTION_WRITE_ACK:
            "I_UNDERSTAND_NON_PRODUCTION_ONLY",
        },
      },
    );
    assert.match(
      `${stdout}\n${stderr}`,
      /AI_TIER_ENTITLEMENT_MIGRATION_POSTFLIGHT=PASS/u,
    );
    assert.equal(
      (await readFile(callLog, "utf8")).trim().split("\n").length,
      2,
    );
  });
});

test("manual staging workflow is main-only, target-bound and independently confirmed", async () => {
  const workflow = await readFile(stagingWorkflowPath, "utf8");

  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(
    workflow,
    /inputs\.confirmation == 'apply-workspace-ai-tier-entitlements'/u,
  );
  assert.match(workflow, /environment: staging/u);
  assert.match(
    workflow,
    /FANMIND_RUNTIME_ENVIRONMENT: staging/u,
  );
  assert.match(
    workflow,
    /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'true'/u,
  );
  assert.match(
    workflow,
    /FANMIND_NON_PRODUCTION_WRITE_ACK: I_UNDERSTAND_NON_PRODUCTION_ONLY/u,
  );
  assert.match(
    workflow,
    /npm run db:ai-tier-entitlements:check/u,
  );
  assert.match(
    workflow,
    /npm run db:ai-tier-entitlements:apply/u,
  );
  assert.equal(
    workflow.match(
      /^          PGPASSFILE: \$\{\{ runner\.temp \}\}\/fanmind-ai-tier-staging-migration\.pgpass$/gmu,
    )?.length,
    3,
  );
  assert.match(workflow, /rm -f "\$PGPASSFILE"/u);
  assert.doesNotMatch(
    workflow,
    /FANMIND_RUNTIME_ENVIRONMENT: production|FANMIND_PRODUCTION_CHANGE_TICKET|sk_live_|https:\/\/fanmind\.ch|ai:tiers:staging:run/iu,
  );
});

test("database failures return only a fixed redacted error code", async () => {
  await withFakeDatabase(
    async ({ environment }) => {
      await assert.rejects(
        execFileAsync(process.execPath, [runnerPath, "--verify"], {
          env: environment,
        }),
        (error) => {
          const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
          assert.match(
            output,
            /AI_TIER_ENTITLEMENT_MIGRATION_ERROR=postflight_failed/u,
          );
          assert.doesNotMatch(
            output,
            /raw-private-db-error|productionref123|db\.synthetic|synthetic-password/u,
          );
          return true;
        },
      );
    },
    { FANMIND_TEST_PSQL_RESULT: "fail" },
  );
});

test("target mismatches, redirect variables and unsafe passfiles fail closed", async () => {
  await withFakeDatabase(async ({ environment, passfile }) => {
    const cases = [
      {
        override: {
          FANMIND_TARGET_SUPABASE_PROJECT_REF: "differentref123",
        },
        code: "supabase_url_binding_invalid",
      },
      {
        override: { PGHOST: "other.synthetic.example" },
        code: "database_host_binding_invalid",
      },
      {
        override: { PGHOSTADDR: "192.0.2.10" },
        code: "libpq_redirect_invalid",
      },
      {
        override: {
          FANMIND_RUNTIME_ENVIRONMENT: "staging",
          FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionref123",
        },
        code: "environment_target_binding_invalid",
      },
    ];
    for (const current of cases) {
      await assert.rejects(
        execFileAsync(process.execPath, [runnerPath, "--verify"], {
          env: { ...environment, ...current.override },
        }),
        (error) => {
          const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
          assert.match(
            output,
            new RegExp(
              `AI_TIER_ENTITLEMENT_MIGRATION_ERROR=${current.code}`,
              "u",
            ),
          );
          assert.doesNotMatch(
            output,
            /differentref123|other\.synthetic|192\.0\.2\.10/u,
          );
          return true;
        },
      );
    }

    await chmod(passfile, 0o644);
    await assert.rejects(
      execFileAsync(process.execPath, [runnerPath, "--verify"], {
        env: environment,
      }),
      (error) => {
        assert.match(
          `${error.stdout ?? ""}\n${error.stderr ?? ""}`,
          /AI_TIER_ENTITLEMENT_MIGRATION_ERROR=passfile_invalid/u,
        );
        return true;
      },
    );

    await chmod(passfile, 0o600);
    const linkedPassfile = `${passfile}.link`;
    await symlink(passfile, linkedPassfile);
    await assert.rejects(
      execFileAsync(process.execPath, [runnerPath, "--verify"], {
        env: { ...environment, PGPASSFILE: linkedPassfile },
      }),
      (error) => {
        assert.match(
          `${error.stdout ?? ""}\n${error.stderr ?? ""}`,
          /AI_TIER_ENTITLEMENT_MIGRATION_ERROR=passfile_invalid/u,
        );
        return true;
      },
    );
  });
});

test("runbook keeps application manual and Plus and Ultra blocked", async () => {
  const runbook = await readFile(runbookPath, "utf8");

  assert.match(runbook, /npm run db:ai-tier-entitlements:check/u);
  assert.match(runbook, /npm run db:ai-tier-entitlements:verify/u);
  assert.match(runbook, /npm run db:ai-tier-entitlements:apply/u);
  assert.match(
    runbook,
    /AI_TIER_ENTITLEMENT_MIGRATION_POSTFLIGHT=PASS/u,
  );
  assert.match(runbook, /keine automatische Production-Migration/iu);
  assert.match(runbook, /Plus und Ultra bleiben/iu);
  assert.match(runbook, /synthetisch/iu);
});
