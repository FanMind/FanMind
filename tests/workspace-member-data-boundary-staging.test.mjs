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

import {
  POSTFLIGHT_SQL,
  PRECHECK_SQL,
  materializeWorkspaceMemberDataBoundaryPostflight,
} from "../scripts/operations/workspace-member-data-boundary-runner.mjs";
import {
  WORKSPACE_MEMBER_DATA_BOUNDARY_APPLY_CONFIRMATION,
  WORKSPACE_MEMBER_DATA_BOUNDARY_VERIFY_CONFIRMATION,
  evaluateWorkspaceMemberDataBoundaryStagingEnvironment,
} from "../src/lib/workspaceMemberDataBoundaryStagingPolicy.mjs";

const execFileAsync = promisify(execFile);
const runnerPath =
  "scripts/operations/workspace-member-data-boundary-runner.mjs";
const controlPath =
  "supabase/controlled/20260816120000_workspace_member_data_boundary.sql";
const REVIEWED_COMMIT = "a".repeat(40);
const STAGING_REF = "stagingref0123456789";
const PRODUCTION_REF = "prodref0123456789012";

function baseEnvironment() {
  return {
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: REVIEWED_COMMIT,
    FANMIND_WORKSPACE_MEMBER_DATA_BOUNDARY_REVIEWED_COMMIT: REVIEWED_COMMIT,
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.invalid",
    FANMIND_TARGET_API_ORIGIN: "https://staging.fanmind.invalid",
    FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
    NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
    FANMIND_TARGET_SUPABASE_PROJECT_REF: STAGING_REF,
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "",
    FANMIND_WORKSPACE_MEMBER_DATA_BOUNDARY_VERIFY_CONFIRM:
      WORKSPACE_MEMBER_DATA_BOUNDARY_VERIFY_CONFIRMATION,
    PGHOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_TARGET_DB_HOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_PRODUCTION_DB_HOST: `db.${PRODUCTION_REF}.supabase.co`,
    PGPORT: "5432",
    PGDATABASE: "postgres",
    PGUSER: `postgres.${STAGING_REF}`,
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT:
      "/workspace/config/certificates/supabase-root-2021-ca.crt",
  };
}

function applyEnvironment() {
  const environment = baseEnvironment();
  delete environment.FANMIND_WORKSPACE_MEMBER_DATA_BOUNDARY_VERIFY_CONFIRM;
  return {
    ...environment,
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    FANMIND_WORKSPACE_MEMBER_DATA_BOUNDARY_APPLY_CONFIRM:
      WORKSPACE_MEMBER_DATA_BOUNDARY_APPLY_CONFIRMATION,
  };
}

async function withFakeDatabase(
  callback,
  { mode = "verify", failure = "", controlState = "absent" } = {},
) {
  const root = await mkdtemp(join(tmpdir(), "fanmind-member-boundary-test-"));
  try {
    const fakePsql = join(root, "psql");
    const passfile = join(root, "pgpass");
    const callLog = join(root, "psql-calls.log");
    const inputLog = join(root, "psql-input.log");
    await writeFile(
      fakePsql,
      `#!/bin/sh
if [ "\${1:-}" = "--version" ]; then
  exit 0
fi
printf '%s\\n' "$*" >> '${callLog}'
input="$(cat)"
printf '%s\\n-- FANMIND TEST CALL END --\\n' "$input" >> '${inputLog}'
case "$input" in
  *WORKSPACE_MEMBER_DATA_BOUNDARY_PREFLIGHT=PASS*)
    if [ '${failure}' = 'preflight' ]; then
      echo 'raw-private-preflight staging-secret-value' >&2
      exit 1
    fi
    echo 'WORKSPACE_MEMBER_DATA_BOUNDARY_PREFLIGHT_STATE=${controlState}'
    echo 'WORKSPACE_MEMBER_DATA_BOUNDARY_PREFLIGHT=PASS'
    ;;
  *WORKSPACE_MEMBER_DATA_BOUNDARY_APPLY_COMMIT=PASS*)
    if [ '${failure}' = 'apply' ]; then
      echo 'raw-private-apply staging-secret-value' >&2
      exit 1
    fi
    echo 'WORKSPACE_MEMBER_DATA_BOUNDARY_APPLY_COMMIT=PASS'
    ;;
  *WORKSPACE_MEMBER_DATA_BOUNDARY_POSTFLIGHT=PASS*)
    if [ '${failure}' = 'postflight' ]; then
      echo 'raw-private-postflight staging-secret-value' >&2
      exit 1
    fi
    echo 'WORKSPACE_MEMBER_DATA_BOUNDARY_POSTFLIGHT=PASS'
    ;;
  *) exit 91 ;;
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
      ...(mode === "apply" ? applyEnvironment() : baseEnvironment()),
      PATH: `${root}:${process.env.PATH}`,
      PGPASSFILE: passfile,
    };
    return await callback({ environment, callLog, inputLog, passfile });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("verify and apply use separate exact-main non-production gates", () => {
  assert.equal(
    evaluateWorkspaceMemberDataBoundaryStagingEnvironment(baseEnvironment(), {
      mode: "verify",
    }).ok,
    true,
  );
  assert.equal(
    evaluateWorkspaceMemberDataBoundaryStagingEnvironment(applyEnvironment(), {
      mode: "apply",
    }).ok,
    true,
  );

  for (const mutation of [
    { GITHUB_REF: "refs/heads/feature" },
    { GITHUB_SHA: "b".repeat(40) },
    { NEXT_PUBLIC_APP_URL: "https://fanmind.ch", FANMIND_TARGET_API_ORIGIN: "https://fanmind.ch" },
    { FANMIND_TARGET_SUPABASE_PROJECT_REF: PRODUCTION_REF },
    { PGUSER: `postgres.${PRODUCTION_REF}` },
    { PGPORT: "6543" },
    { PGSSLMODE: "require" },
    { PGSSLROOTCERT: "/etc/ssl/certs/ca-certificates.crt" },
    { DATABASE_URL: "postgres://redirect.invalid" },
    { PGOPTIONS: "-c role=service_role" },
  ]) {
    const result = evaluateWorkspaceMemberDataBoundaryStagingEnvironment(
      { ...baseEnvironment(), ...mutation },
      { mode: "verify" },
    );
    assert.equal(result.ok, false, JSON.stringify(mutation));
  }
});

test("preflight and materialized postflight are read-only and complete", async () => {
  const control = await readFile(controlPath, "utf8");
  const postflight = materializeWorkspaceMemberDataBoundaryPostflight(control);
  for (const sql of [PRECHECK_SQL, postflight]) {
    assert.match(sql, /begin;[\s\S]*set transaction read only;[\s\S]*rollback;/u);
    assert.doesNotMatch(
      sql,
      /\b(?:insert\s+into|update\s+public\.|delete\s+from|alter\s+(?:table|function)|create\s+(?:table|policy|function)|drop\s+(?:table|policy|function)|truncate\s+(?:table\s+)?|grant\s+\w+\s+on|revoke\s+\w+\s+on)\b/iu,
    );
  }
  for (const sql of [control, PRECHECK_SQL, postflight]) {
    assert.match(
      sql,
      /where version = '20260809141141'\s+and name = 'workspace_server_owned_columns_controlled'/u,
    );
    assert.doesNotMatch(
      sql,
      /where version = '20260726121000'[\s\S]{0,180}workspace_server_owned_columns_controlled/u,
    );
  }
  assert.match(PRECHECK_SQL, /current_user <> 'postgres'/u);
  assert.match(PRECHECK_SQL, /workspace_member_boundary_member_read_invalid/u);
  assert.match(PRECHECK_SQL, /workspace_member_boundary_partial_control_state/u);
  assert.match(
    postflight,
    /workspace_member_boundary_workspace_acl_postflight_failed/u,
  );
  assert.match(
    postflight,
    /workspace_member_boundary_foundation_postflight_failed/u,
  );
  assert.match(postflight, /workspace_member_boundary_function_acl_invalid/u);
  assert.match(postflight, /workspace_member_boundary_social_column_acl_invalid/u);
  assert.match(postflight, /has_any_column_privilege\('anon',[\s\S]*'INSERT'/u);
  assert.match(postflight, /function_definition\.prokind = 'f'/u);
  assert.match(postflight, /not function_definition\.proretset/u);
  assert.doesNotMatch(postflight, /__FANMIND_[A-Z_]+__/u);
  assert.ok(postflight.length > POSTFLIGHT_SQL.length);
});

test("verify runs exactly one independent read-only postflight", async () => {
  await withFakeDatabase(async ({ environment, callLog, inputLog }) => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [runnerPath, "--verify"],
      { env: environment },
    );
    const output = `${stdout}\n${stderr}`;
    const calls = await readFile(callLog, "utf8");
    const input = await readFile(inputLog, "utf8");
    assert.match(output, /WORKSPACE_MEMBER_DATA_BOUNDARY_APPLY=not_requested/u);
    assert.match(output, /WORKSPACE_MEMBER_DATA_BOUNDARY_POSTFLIGHT=PASS/u);
    assert.match(output, /WORKSPACE_MEMBER_DATA_BOUNDARY_READY=VERIFIED_APPLIED/u);
    assert.equal(calls.trim().split("\n").length, 1);
    assert.match(input, /set transaction read only/u);
    assert.doesNotMatch(input, /create policy workspaces_select_requires_owner/u);
    assert.doesNotMatch(output, /staging-secret-value|pooler\.supabase/u);
  });
});

test("apply runs preflight, the pinned transaction and external postflight", async () => {
  await withFakeDatabase(
    async ({ environment, callLog, inputLog }) => {
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        [runnerPath, "--apply"],
        { env: environment },
      );
      const output = `${stdout}\n${stderr}`;
      const calls = await readFile(callLog, "utf8");
      const input = await readFile(inputLog, "utf8");
      assert.match(output, /WORKSPACE_MEMBER_DATA_BOUNDARY_PREFLIGHT=PASS/u);
      assert.match(output, /WORKSPACE_MEMBER_DATA_BOUNDARY_APPLY=completed/u);
      assert.match(output, /WORKSPACE_MEMBER_DATA_BOUNDARY_POSTFLIGHT=PASS/u);
      assert.match(output, /WORKSPACE_MEMBER_DATA_BOUNDARY_READY=APPLIED_AND_VERIFIED/u);
      assert.equal(calls.trim().split("\n").length, 3);
      assert.match(input, /select pg_advisory_lock\(20260816, 120000\)/u);
      assert.match(input, /create policy workspaces_select_requires_owner/u);
      assert.match(input, /WORKSPACE_MEMBER_DATA_BOUNDARY_APPLY_COMMIT=PASS/u);
      assert.doesNotMatch(output, /staging-secret-value|pooler\.supabase/u);
    },
    { mode: "apply" },
  );
});

test("a repeat apply requires an exact independent current-state postflight first", async () => {
  await withFakeDatabase(
    async ({ environment, callLog }) => {
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        [runnerPath, "--apply"],
        { env: environment },
      );
      const output = `${stdout}\n${stderr}`;
      const calls = await readFile(callLog, "utf8");
      assert.match(
        output,
        /WORKSPACE_MEMBER_DATA_BOUNDARY_PREFLIGHT_CURRENT_STATE=verified/u,
      );
      assert.match(
        output,
        /WORKSPACE_MEMBER_DATA_BOUNDARY_READY=APPLIED_AND_VERIFIED/u,
      );
      assert.equal(calls.trim().split("\n").length, 4);
    },
    { mode: "apply", controlState: "present" },
  );

  await withFakeDatabase(
    async ({ environment, callLog }) => {
      await assert.rejects(
        execFileAsync(process.execPath, [runnerPath, "--apply"], {
          env: environment,
        }),
        /WORKSPACE_MEMBER_DATA_BOUNDARY_ERROR=preflight_failed/u,
      );
      const calls = await readFile(callLog, "utf8");
      assert.equal(calls.trim().split("\n").length, 2);
    },
    { mode: "apply", controlState: "present", failure: "postflight" },
  );
});

test("failed database stages are fixed-code, fail-closed and never auto-retried", async () => {
  for (const [failure, expected, expectedCalls] of [
    ["preflight", "preflight_failed", 1],
    ["apply", "apply_outcome_indeterminate", 2],
    ["postflight", "applied_unverified", 3],
  ]) {
    await withFakeDatabase(
      async ({ environment, callLog }) => {
        await assert.rejects(
          execFileAsync(process.execPath, [runnerPath, "--apply"], {
            env: environment,
          }),
          (error) => {
            const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
            assert.match(
              output,
              new RegExp(`WORKSPACE_MEMBER_DATA_BOUNDARY_ERROR=${expected}`, "u"),
            );
            assert.doesNotMatch(output, /raw-private|staging-secret-value/u);
            return true;
          },
        );
        const calls = await readFile(callLog, "utf8");
        assert.equal(calls.trim().split("\n").length, expectedCalls);
      },
      { mode: "apply", failure },
    );
  }
});

test("unsafe passfiles are rejected without exposing their contents", async () => {
  await withFakeDatabase(async ({ environment, passfile }) => {
    await chmod(passfile, 0o644);
    await assert.rejects(
      execFileAsync(process.execPath, [runnerPath, "--verify"], {
        env: environment,
      }),
      /WORKSPACE_MEMBER_DATA_BOUNDARY_ERROR=passfile_invalid/u,
    );

    await chmod(passfile, 0o600);
    const link = `${passfile}.link`;
    await symlink(passfile, link);
    await assert.rejects(
      execFileAsync(process.execPath, [runnerPath, "--verify"], {
        env: { ...environment, PGPASSFILE: link },
      }),
      /WORKSPACE_MEMBER_DATA_BOUNDARY_ERROR=passfile_invalid/u,
    );
  });
});

test("manual workflows are exact-release, protected-Staging and mode-separated", async () => {
  const [verifyWorkflow, applyWorkflow, acceptanceWorkflow] = await Promise.all(
    [
      ".github/workflows/workspace-member-data-boundary-staging-verify.yml",
      ".github/workflows/workspace-member-data-boundary-staging-apply.yml",
      ".github/workflows/browser-e2e-staging-write.yml",
    ].map((path) => readFile(path, "utf8")),
  );
  for (const workflow of [verifyWorkflow, applyWorkflow]) {
    assert.match(workflow, /workflow_dispatch:/u);
    assert.match(workflow, /validate-dispatch:/u);
    assert.match(workflow, /environment: staging/u);
    assert.match(workflow, /REQUESTED_REVIEWED_COMMIT[\s\S]*GITHUB_SHA/u);
    assert.match(workflow, /persist-credentials: false/u);
    assert.match(workflow, /\/api\/version/u);
    assert.match(workflow, /payload\.releaseCommit/u);
    assert.match(workflow, /\/api\/health/u);
    assert.match(workflow, /evaluatePublicHealth/u);
    assert.match(workflow, /PGSSLMODE: verify-full/u);
    assert.match(workflow, /supabase-root-2021-ca\.crt/u);
    assert.match(workflow, /chmod 600 "\$PGPASSFILE"/u);
    assert.match(workflow, /if: \$\{\{ always\(\) \}\}/u);
    assert.match(workflow, /group: fanmind-staging-core-csv-write/u);
    assert.doesNotMatch(workflow, /pull_request:|\bpush:|\bschedule:/u);
  }
  assert.match(verifyWorkflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'/u);
  assert.match(verifyWorkflow, /db:workspace-member-data-boundary:verify/u);
  assert.doesNotMatch(verifyWorkflow, /db:workspace-member-data-boundary:apply/u);
  assert.match(applyWorkflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'true'/u);
  assert.match(applyWorkflow, /I_UNDERSTAND_NON_PRODUCTION_ONLY/u);
  assert.match(applyWorkflow, /db:workspace-member-data-boundary:apply/u);
  assert.match(
    acceptanceWorkflow,
    /Verify the applied member boundary before fixture writes[\s\S]*db:workspace-member-data-boundary:verify/u,
  );
  assert.equal(
    (acceptanceWorkflow.match(/db:workspace-member-data-boundary:verify/gu) ?? [])
      .length,
    2,
  );
  assert.match(
    acceptanceWorkflow,
    /STAGING_DATABASE_ROLLOUT_WORKSPACE_MEMBER_BOUNDARY=verify/u,
  );
});
