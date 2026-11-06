import assert from "node:assert/strict";
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
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const runnerPath = "scripts/operations/ai-prompt-migration-runner.mjs";
const runbookPath = "docs/operations/AI_PROMPT_MIGRATION.md";
const migrationPath =
  "supabase/migrations/20260726213000_workspace_ai_prompt_settings.sql";

async function withFakeDatabase(callback, overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), "fanmind-ai-migration-test-"));
  try {
    const fakePsql = join(root, "psql");
    const passfile = join(root, "pgpass");
    const log = join(root, "psql.log");
    await writeFile(
      fakePsql,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "psql (PostgreSQL) synthetic"
  exit 0
fi
printf '%s\\n' "$*" >> "$FANMIND_TEST_PSQL_LOG"
cat >/dev/null
echo "AI_PROMPT_MIGRATION_POSTFLIGHT=PASS"
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
      FANMIND_TEST_PSQL_LOG: log,
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
      FANMIND_AI_PROMPT_MIGRATION_CONFIRM:
        "apply-workspace-ai-prompt-settings",
      FANMIND_PRODUCTION_CHANGE_TICKET: "FM-755-rollout",
      ...overrides,
    };

    return await callback({ environment, log, passfile });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("offline check pins the reviewed migration and RLS contract", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    runnerPath,
  ]);
  const output = `${stdout}\n${stderr}`;

  assert.match(output, /AI_PROMPT_MIGRATION_CHECKSUM=verified/);
  assert.match(output, /AI_PROMPT_MIGRATION_CONTRACT=verified/);
  assert.match(output, /AI_PROMPT_MIGRATION_MODE=check/);
  assert.match(output, /AI_PROMPT_MIGRATION_READY=YES/);

  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /enable row level security/);
  assert.match(migration, /workspace_ai_prompt_settings_select_member/);
  assert.match(migration, /revoke all[\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant all[\s\S]*to service_role/);
});

test("verify mode binds the environment and performs only the read-only postflight", async () => {
  await withFakeDatabase(async ({ environment, log }) => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [runnerPath, "--verify"],
      { env: environment },
    );
    const output = `${stdout}\n${stderr}`;
    const calls = await readFile(log, "utf8");

    assert.match(output, /AI_PROMPT_MIGRATION_TARGET=production/);
    assert.match(output, /AI_PROMPT_MIGRATION_PROJECT_BINDING=verified/);
    assert.match(output, /AI_PROMPT_MIGRATION_DATABASE_BINDING=verified/);
    assert.match(output, /AI_PROMPT_MIGRATION_APPLY=not_requested/);
    assert.match(output, /AI_PROMPT_MIGRATION_POSTFLIGHT=PASS/);
    assert.equal(calls.trim().split("\n").length, 1);
    assert.doesNotMatch(
      output,
      /productionref123|db\.synthetic|synthetic-password/,
    );
    assert.doesNotMatch(calls, /synthetic-password|productionref123/);
  });
});

test("apply mode requires an exact confirmation and a production change ticket", async () => {
  await withFakeDatabase(async ({ environment }) => {
    for (const override of [
      { FANMIND_AI_PROMPT_MIGRATION_CONFIRM: "yes" },
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
            /AI_PROMPT_MIGRATION_ERROR=(apply_confirmation_invalid|production_change_ticket_missing)/,
          );
          assert.doesNotMatch(
            output,
            /productionref123|db\.synthetic|synthetic-password/,
          );
          return true;
        },
      );
    }
  });
});

test("apply mode runs the pinned migration once and postflight once", async () => {
  await withFakeDatabase(async ({ environment, log }) => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [runnerPath, "--apply"],
      { env: environment },
    );
    const output = `${stdout}\n${stderr}`;
    const calls = await readFile(log, "utf8");

    assert.match(output, /AI_PROMPT_MIGRATION_APPLY=completed/);
    assert.match(output, /AI_PROMPT_MIGRATION_POSTFLIGHT=PASS/);
    assert.equal(calls.trim().split("\n").length, 2);
    assert.match(calls, /--no-password --no-psqlrc --set=ON_ERROR_STOP=1/);
    assert.doesNotMatch(calls, /synthetic-password|productionref123/);
  });
});

test("mismatched targets, redirect variables and unsafe passfiles fail closed", async () => {
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
            new RegExp(`AI_PROMPT_MIGRATION_ERROR=${current.code}`),
          );
          assert.doesNotMatch(output, /differentref123|other\.synthetic/);
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
          /AI_PROMPT_MIGRATION_ERROR=passfile_invalid/,
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
          /AI_PROMPT_MIGRATION_ERROR=passfile_invalid/,
        );
        return true;
      },
    );
  });
});

test("runbook keeps application manual and requires postflight before UI smoke", async () => {
  const runbook = await readFile(runbookPath, "utf8");

  assert.match(runbook, /npm run db:ai-prompts:check/);
  assert.match(runbook, /npm run db:ai-prompts:apply/);
  assert.match(runbook, /AI_PROMPT_MIGRATION_POSTFLIGHT=PASS/);
  assert.match(runbook, /keine automatische Production-Migration/);
  assert.match(runbook, /Mitglied.*lesen.*nicht bearbeiten/is);
  assert.match(runbook, /bestehende Antwortgenerierung.*funktionsfähig/is);
});
