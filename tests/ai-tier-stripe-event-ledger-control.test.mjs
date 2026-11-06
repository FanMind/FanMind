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

const execFileAsync = promisify(execFile);
const runnerPath =
  "scripts/operations/ai-tier-stripe-event-ledger-runner.mjs";
const reviewedCommit = "a".repeat(40);

async function withFakeDatabase(callback) {
  const root = await mkdtemp(join(tmpdir(), "fanmind-ai-tier-ledger-test-"));
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
[ "$PGSSLMODE" = "verify-full" ] || exit 81
[ "$PGGSSENCMODE" = "disable" ] || exit 82
case "$PGSSLROOTCERT" in /*) ;; *) exit 83 ;; esac
printf '%s\n' "$*" >> "$FANMIND_TEST_PSQL_CALL_LOG"
cat >> "$FANMIND_TEST_PSQL_INPUT_LOG"
printf '\n-- FANMIND TEST CALL END --\n' >> "$FANMIND_TEST_PSQL_INPUT_LOG"
echo "AI_TIER_STRIPE_EVENT_LEDGER_POSTFLIGHT=PASS"
`,
      { mode: 0o700 },
    );
    await writeFile(
      passfile,
      "aws-0-eu-central-1.pooler.supabase.com:5432:postgres:postgres.stagingref12345:synthetic-password\n",
      { mode: 0o600 },
    );
    await chmod(passfile, 0o600);

    const environment = {
      ...process.env,
      PATH: `${root}:${process.env.PATH}`,
      FANMIND_TEST_PSQL_CALL_LOG: callLog,
      FANMIND_TEST_PSQL_INPUT_LOG: inputLog,
      FANMIND_RUNTIME_ENVIRONMENT: "staging",
      NEXT_PUBLIC_APP_URL: "https://staging.fanmind.invalid",
      NEXT_PUBLIC_SUPABASE_URL: "https://stagingref12345.supabase.co",
      FANMIND_TARGET_API_ORIGIN: "https://staging.fanmind.invalid",
      FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
      FANMIND_TARGET_SUPABASE_PROJECT_REF: "stagingref12345",
      FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
      FANMIND_NON_PRODUCTION_WRITE_ACK: "",
      FANMIND_AI_TIER_STRIPE_EVENT_LEDGER_REVIEWED_COMMIT: reviewedCommit,
      FANMIND_AI_TIER_STRIPE_EVENT_LEDGER_CONFIRM: "",
      GITHUB_REF: "refs/heads/main",
      GITHUB_SHA: reviewedCommit,
      PGHOST: "aws-0-eu-central-1.pooler.supabase.com",
      FANMIND_TARGET_DB_HOST: "aws-0-eu-central-1.pooler.supabase.com",
      FANMIND_PRODUCTION_DB_HOST: "db.productionref123.supabase.co",
      PGPORT: "5432",
      PGDATABASE: "postgres",
      PGUSER: "postgres.stagingref12345",
      PGSSLMODE: "verify-full",
      PGSSLROOTCERT: "/etc/ssl/certs/ca-certificates.crt",
      PGPASSFILE: passfile,
    };
    return await callback({ environment, callLog, inputLog });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("offline control check pins the reviewed SQL without a database", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    runnerPath,
    "--check",
  ]);
  const output = `${stdout}\n${stderr}`;
  assert.match(output, /AI_TIER_STRIPE_EVENT_LEDGER_CHECKSUM=verified/u);
  assert.match(output, /AI_TIER_STRIPE_EVENT_LEDGER_CONTRACT=verified/u);
  assert.match(output, /AI_TIER_STRIPE_EVENT_LEDGER_MODE=check/u);
  assert.match(output, /AI_TIER_STRIPE_EVENT_LEDGER_READY=YES/u);
});

test("canonical AI reconciliation rotates the base subscription and seals the snapshot cutoff", async () => {
  const [sql, runner] = await Promise.all([
    readFile(
      "supabase/controlled/20260816190000_workspace_ai_tier_stripe_event_ledger.sql",
      "utf8",
    ),
    readFile(runnerPath, "utf8"),
  ]);
  assert.match(
    sql,
    /p_expected_previous_subscription_id text[\s\S]*v_workspace_subscription_id is distinct from p_subscription_id/u,
  );
  assert.match(
    sql,
    /v_current\.stripe_subscription_id is distinct from\s+p_expected_previous_subscription_id/u,
  );
  assert.match(
    sql,
    /processing_reason = 'subscription_mismatch'[\s\S]*stripe_subscription_id = p_subscription_id/u,
  );
  assert.match(
    sql,
    /previous_stripe_subscription_id[\s\S]*snapshot_event_created_cutoff bigint not null/u,
  );
  assert.match(
    sql,
    /v_snapshot_event_created_cutoff :=\s+floor\(extract\(epoch from p_snapshot_observed_at\)\)::bigint/u,
  );
  assert.match(
    sql,
    /last_stripe_event_created_at = v_snapshot_event_created_cutoff/u,
  );
  assert.match(
    sql,
    /max\(reconciliation\.snapshot_event_created_cutoff\)[\s\S]*p_event_created_at < v_latest_reconciliation_cutoff[\s\S]*stale_event/u,
  );
  assert.match(
    sql,
    /v_latest_reconciliation_cutoff is not null[\s\S]*p_event_created_at = v_latest_reconciliation_cutoff[\s\S]*event_order_conflict/u,
  );
  assert.match(
    sql,
    /previous_stripe_subscription_id =\s+p_subscription_id[\s\S]*v_canonical_previous_subscription_event[\s\S]*stale_event/u,
  );
  assert.match(
    sql,
    /revoke insert, update, delete[\s\S]*workspace_ai_tier_entitlements[\s\S]*from service_role/u,
  );
  assert.match(runner, /ledger_function_set_invalid/u);
});

test("verify is Staging-bound and executes only metadata read-only SQL", async () => {
  await withFakeDatabase(async ({ environment, callLog, inputLog }) => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [runnerPath, "--verify"],
      { env: environment },
    );
    const output = `${stdout}\n${stderr}`;
    const calls = await readFile(callLog, "utf8");
    const sql = await readFile(inputLog, "utf8");
    assert.match(output, /AI_TIER_STRIPE_EVENT_LEDGER_APPLY=not_requested/u);
    assert.match(output, /AI_TIER_STRIPE_EVENT_LEDGER_POSTFLIGHT=PASS/u);
    assert.equal(calls.trim().split("\n").length, 1);
    assert.match(sql, /set transaction read only/iu);
    assert.match(sql, /pg_class|information_schema|pg_constraint/iu);
    assert.doesNotMatch(sql, /select\s+\*\s+from\s+public\.workspaces/iu);
    assert.doesNotMatch(
      `${output}\n${calls}`,
      /synthetic-password|stagingref12345|db\.stagingref12345\.supabase\.co/u,
    );
  });
});

test("apply requires every non-production write gate and exact confirmation", async () => {
  await withFakeDatabase(async ({ environment }) => {
    for (const override of [
      {},
      { FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true" },
      {
        FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
        FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
        FANMIND_AI_TIER_STRIPE_EVENT_LEDGER_CONFIRM: "yes",
      },
    ]) {
      await assert.rejects(
        execFileAsync(process.execPath, [runnerPath, "--apply"], {
          env: { ...environment, ...override },
        }),
        (error) => {
          const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
          assert.match(
            output,
            /AI_TIER_STRIPE_EVENT_LEDGER_ERROR=(environment_invalid|apply_confirmation_invalid)/u,
          );
          assert.doesNotMatch(output, /synthetic-password/u);
          return true;
        },
      );
    }
  });
});

test("an explicitly confirmed Staging apply runs control and postflight once", async () => {
  await withFakeDatabase(async ({ environment, callLog, inputLog }) => {
    const applyEnvironment = {
      ...environment,
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
      FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
      FANMIND_AI_TIER_STRIPE_EVENT_LEDGER_CONFIRM:
        "apply-ai-tier-stripe-event-ledger",
    };
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [runnerPath, "--apply"],
      { env: applyEnvironment },
    );
    const output = `${stdout}\n${stderr}`;
    const calls = await readFile(callLog, "utf8");
    const sql = await readFile(inputLog, "utf8");
    assert.match(output, /AI_TIER_STRIPE_EVENT_LEDGER_APPLY=completed/u);
    assert.match(output, /AI_TIER_STRIPE_EVENT_LEDGER_POSTFLIGHT=PASS/u);
    assert.equal(calls.trim().split("\n").length, 2);
    assert.match(sql, /create table public\.workspace_ai_tier_stripe_events/iu);
    assert.match(sql, /set transaction read only/iu);
    assert.doesNotMatch(
      `${output}\n${calls}`,
      /synthetic-password|stagingref12345|db\.stagingref12345\.supabase\.co/u,
    );
  });
});

test("the ledger runner refuses every Production target even with write gates", async () => {
  await withFakeDatabase(async ({ environment }) => {
    await assert.rejects(
      execFileAsync(process.execPath, [runnerPath, "--apply"], {
        env: {
          ...environment,
          FANMIND_RUNTIME_ENVIRONMENT: "production",
          NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
          NEXT_PUBLIC_SUPABASE_URL: "https://productionref123.supabase.co",
          FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionref123",
          FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
          FANMIND_NON_PRODUCTION_WRITE_ACK:
            "I_UNDERSTAND_NON_PRODUCTION_ONLY",
          FANMIND_AI_TIER_STRIPE_EVENT_LEDGER_CONFIRM:
            "apply-ai-tier-stripe-event-ledger",
        },
      }),
      (error) => {
        const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
        assert.match(
          output,
          /AI_TIER_STRIPE_EVENT_LEDGER_ERROR=environment_invalid/u,
        );
        return true;
      },
    );
  });
});

test("the database identity must carry the exact Staging project reference", async () => {
  await withFakeDatabase(async ({ environment }) => {
    await assert.rejects(
      execFileAsync(process.execPath, [runnerPath, "--verify"], {
        env: {
          ...environment,
          PGHOST: "db.unbound.supabase.co",
          FANMIND_TARGET_DB_HOST: "db.unbound.supabase.co",
        },
      }),
      (error) => {
        const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
        assert.match(
          output,
          /AI_TIER_STRIPE_EVENT_LEDGER_ERROR=database_binding_invalid/u,
        );
        assert.doesNotMatch(output, /synthetic-password/u);
        return true;
      },
    );
  });
});

test("the runner requires exact reviewed main, pinned TLS and no libpq redirect", async () => {
  await withFakeDatabase(async ({ environment }) => {
    for (const override of [
      { GITHUB_REF: "refs/heads/feature" },
      { GITHUB_SHA: "b".repeat(40) },
      { FANMIND_AI_TIER_STRIPE_EVENT_LEDGER_REVIEWED_COMMIT: "b".repeat(40) },
      { FANMIND_PRODUCTION_DB_HOST: "" },
      { FANMIND_PRODUCTION_DB_HOST: environment.PGHOST },
      { PGHOST: "db.stagingref12345.supabase.co", FANMIND_TARGET_DB_HOST: "db.stagingref12345.supabase.co" },
      { PGUSER: "postgres.productionref123" },
      { PGSSLMODE: "require" },
      { PGSSLROOTCERT: "relative-ca.crt" },
      { DATABASE_URL: "postgres://redirect.invalid/db" },
      { PGSSLCERT: "/tmp/client.crt" },
    ]) {
      await assert.rejects(
        execFileAsync(process.execPath, [runnerPath, "--verify"], {
          env: { ...environment, ...override },
        }),
        (error) => {
          const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
          assert.match(
            output,
            /AI_TIER_STRIPE_EVENT_LEDGER_ERROR=(database_binding_invalid|database_redirect_invalid)/u,
          );
          assert.doesNotMatch(output, /redirect\.invalid|client\.crt/u);
          return true;
        },
      );
    }
  });
});

test("the workflow is manual main-only Staging transport and never enables runtime", async () => {
  const workflow = await readFile(
    ".github/workflows/ai-tier-stripe-event-ledger-staging.yml",
    "utf8",
  );
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /inputs\.reviewed_commit == github\.sha/u);
  assert.match(workflow, /environment: staging/u);
  assert.match(workflow, /FANMIND_AI_TIER_STRIPE_EVENT_LEDGER_REVIEWED_COMMIT/u);
  assert.match(workflow, /FANMIND_PRODUCTION_DB_HOST/u);
  assert.match(workflow, /PGUSER: \$\{\{ format\('postgres\.\{0\}'/u);
  assert.match(workflow, /PGSSLMODE: verify-full/u);
  assert.match(workflow, /supabase-root-2021-ca\.crt/u);
  assert.match(workflow, /persist-credentials: false/u);
  assert.match(workflow, /inputs\.confirmation == 'apply-ai-tier-stripe-event-ledger'/u);
  assert.match(workflow, /npm run db:ai-tier-stripe-ledger:check/u);
  assert.match(workflow, /npm run --silent db:staging-rollout-state:run/u);
  assert.match(
    workflow,
    /STAGING_DATABASE_ROLLOUT_AI_TIER_STRIPE_LEDGER=apply/u,
  );
  assert.match(workflow, /npm run db:ai-tier-stripe-ledger:apply/u);
  assert.doesNotMatch(workflow, /\b(?:push|schedule):/u);
  assert.doesNotMatch(
    workflow,
    /FANMIND_AI_TIER_STRIPE_EVENT_LEDGER_ENABLED:\s*['"]?true/iu,
  );
});
