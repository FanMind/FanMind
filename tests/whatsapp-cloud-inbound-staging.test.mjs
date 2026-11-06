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
  STATE_SQL,
  applySql,
  materializeWhatsAppCloudInboundPostflight,
} from "../scripts/operations/whatsapp-cloud-inbound-migration-runner.mjs";
import {
  WHATSAPP_CLOUD_INBOUND_APPLY_CONFIRMATION,
  WHATSAPP_CLOUD_INBOUND_VERIFY_CONFIRMATION,
  evaluateWhatsAppCloudInboundStagingEnvironment,
} from "../src/lib/whatsappCloudInboundStagingPolicy.mjs";

const execFileAsync = promisify(execFile);
const runnerPath =
  "scripts/operations/whatsapp-cloud-inbound-migration-runner.mjs";
const controlPath =
  "supabase/controlled/20260817230000_whatsapp_cloud_inbound_foundation.sql";
const REVIEWED_COMMIT = "a".repeat(40);
const STAGING_REF = "stagingref0123456789";
const PRODUCTION_REF = "prodref0123456789012";

function baseEnvironment() {
  return {
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: REVIEWED_COMMIT,
    FANMIND_WHATSAPP_CLOUD_INBOUND_REVIEWED_COMMIT: REVIEWED_COMMIT,
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.invalid",
    FANMIND_TARGET_API_ORIGIN: "https://staging.fanmind.invalid",
    FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
    NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
    FANMIND_TARGET_SUPABASE_PROJECT_REF: STAGING_REF,
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "",
    FANMIND_WHATSAPP_CLOUD_INBOUND_VERIFY_CONFIRM:
      WHATSAPP_CLOUD_INBOUND_VERIFY_CONFIRMATION,
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
  delete environment.FANMIND_WHATSAPP_CLOUD_INBOUND_VERIFY_CONFIRM;
  return {
    ...environment,
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    FANMIND_WHATSAPP_CLOUD_INBOUND_APPLY_CONFIRM:
      WHATSAPP_CLOUD_INBOUND_APPLY_CONFIRMATION,
  };
}

async function withFakeDatabase(
  callback,
  { mode = "verify", failure = "", controlState = "absent" } = {},
) {
  const root = await mkdtemp(join(tmpdir(), "fanmind-whatsapp-staging-test-"));
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
  *WORKSPACE_MEMBER_DATA_BOUNDARY_POSTFLIGHT=PASS*)
    if [ '${failure}' = 'member' ]; then
      echo 'raw-private-member staging-secret-value' >&2
      exit 1
    fi
    echo 'WORKSPACE_MEMBER_DATA_BOUNDARY_POSTFLIGHT=PASS'
    ;;
  *WHATSAPP_CLOUD_INBOUND_PREFLIGHT=PASS*)
    if [ '${failure}' = 'preflight' ]; then
      echo 'raw-private-preflight staging-secret-value' >&2
      exit 1
    fi
    echo 'WHATSAPP_CLOUD_INBOUND_OBJECT_STATE=${controlState}'
    echo 'WHATSAPP_CLOUD_INBOUND_PREFLIGHT=PASS'
    ;;
  *WHATSAPP_CLOUD_INBOUND_APPLY_COMMIT=PASS*)
    if [ '${failure}' = 'apply' ]; then
      echo 'raw-private-apply staging-secret-value' >&2
      exit 1
    fi
    echo 'WHATSAPP_CLOUD_INBOUND_APPLY_COMMIT=PASS'
    ;;
  *WHATSAPP_CLOUD_INBOUND_POSTFLIGHT=PASS*)
    if [ '${failure}' = 'postflight' ]; then
      echo 'raw-private-postflight staging-secret-value' >&2
      exit 1
    fi
    echo 'WHATSAPP_CLOUD_INBOUND_POSTFLIGHT=PASS'
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

test("verify and apply are bound to exact main and different Staging/Production targets", () => {
  assert.equal(
    evaluateWhatsAppCloudInboundStagingEnvironment(baseEnvironment(), {
      mode: "verify",
    }).ok,
    true,
  );
  assert.equal(
    evaluateWhatsAppCloudInboundStagingEnvironment(applyEnvironment(), {
      mode: "apply",
    }).ok,
    true,
  );

  for (const mutation of [
    { GITHUB_REF: "refs/heads/feature" },
    { GITHUB_SHA: "b".repeat(40) },
    {
      NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
      FANMIND_TARGET_API_ORIGIN: "https://fanmind.ch",
    },
    { FANMIND_TARGET_SUPABASE_PROJECT_REF: PRODUCTION_REF },
    { PGHOST: `db.${PRODUCTION_REF}.supabase.co` },
    { PGUSER: `postgres.${PRODUCTION_REF}` },
    { PGPORT: "6543" },
    { PGSSLMODE: "require" },
    { PGSSLROOTCERT: "/etc/ssl/certs/ca-certificates.crt" },
    { DATABASE_URL: "postgres://redirect.invalid" },
    { PGOPTIONS: "-c role=service_role" },
  ]) {
    const result = evaluateWhatsAppCloudInboundStagingEnvironment(
      { ...baseEnvironment(), ...mutation },
      { mode: "verify" },
    );
    assert.equal(result.ok, false, JSON.stringify(mutation));
  }
});

test("preflight and independent postflight are read-only, exact and Member-bound", async () => {
  const control = await readFile(controlPath, "utf8");
  const postflight = materializeWhatsAppCloudInboundPostflight(control);
  for (const sql of [STATE_SQL, PRECHECK_SQL, postflight]) {
    assert.match(sql, /begin;[\s\S]*set transaction read only;[\s\S]*rollback;/u);
    assert.match(
      sql,
      /set local search_path = pg_catalog, public, pg_temp;/u,
    );
    assert.doesNotMatch(
      sql,
      /\b(?:insert\s+into|update\s+public\.|delete\s+from|alter\s+(?:table|function)|create\s+(?:table|policy|function)|drop\s+(?:table|policy|function)|truncate\s+(?:table\s+)?|grant\s+\w+\s+on|revoke\s+\w+\s+on)\b/iu,
    );
  }
  assert.match(PRECHECK_SQL, /where version = '20260817230000'/u);
  assert.match(PRECHECK_SQL, /WHATSAPP_CLOUD_INBOUND_OBJECT_STATE=/u);
  assert.match(postflight, /whatsapp_cloud_member_control_postflight_failed/u);
  assert.match(postflight, /fixed_demo_seed_version/u);
  assert.match(postflight, /whatsapp_cloud_receipt_constraint_postflight_failed/u);
  assert.match(postflight, /function_definition\.proowner/u);
  assert.match(postflight, /function_definition\.prokind/u);
  assert.match(postflight, /function_definition\.prolang/u);
  assert.match(postflight, /function_definition\.provolatile/u);
  assert.match(postflight, /function_definition\.proretset/u);
  assert.doesNotMatch(postflight, /__FANMIND_WHATSAPP_[A-Z_]+__/u);
  assert.ok(postflight.length > POSTFLIGHT_SQL.length);
  assert.match(
    applySql(control),
    /select pg_advisory_lock\(20260817, 230000\)[\s\S]*WHATSAPP_CLOUD_INBOUND_APPLY_COMMIT=PASS/u,
  );
});

test("verify requires Member postflight before one independent WhatsApp postflight", async () => {
  await withFakeDatabase(async ({ environment, callLog, inputLog }) => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [runnerPath, "--verify"],
      { env: environment },
    );
    const output = `${stdout}\n${stderr}`;
    const calls = await readFile(callLog, "utf8");
    const input = await readFile(inputLog, "utf8");
    assert.match(output, /WHATSAPP_CLOUD_INBOUND_MEMBER_CONTROL=verified/u);
    assert.match(output, /WHATSAPP_CLOUD_INBOUND_APPLY=not_requested/u);
    assert.match(output, /WHATSAPP_CLOUD_INBOUND_POSTFLIGHT=PASS/u);
    assert.match(output, /WHATSAPP_CLOUD_INBOUND_READY=VERIFIED_APPLIED/u);
    assert.equal(calls.trim().split("\n").length, 2);
    assert.ok(
      input.indexOf("WORKSPACE_MEMBER_DATA_BOUNDARY_POSTFLIGHT=PASS") <
        input.indexOf("WHATSAPP_CLOUD_INBOUND_POSTFLIGHT=PASS"),
    );
    assert.doesNotMatch(output, /staging-secret-value|pooler\.supabase/u);
  });
});

test("apply requires Member, preflight, one pinned transaction and independent postflight", async () => {
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
      assert.match(output, /WHATSAPP_CLOUD_INBOUND_PREFLIGHT=PASS/u);
      assert.match(output, /WHATSAPP_CLOUD_INBOUND_APPLY=completed/u);
      assert.match(output, /WHATSAPP_CLOUD_INBOUND_POSTFLIGHT=PASS/u);
      assert.match(output, /WHATSAPP_CLOUD_INBOUND_READY=APPLIED_AND_VERIFIED/u);
      assert.equal(calls.trim().split("\n").length, 4);
      assert.match(input, /select pg_advisory_lock\(20260817, 230000\)/u);
      assert.match(input, /create table public\.whatsapp_cloud_webhook_receipts/u);
      assert.match(input, /WHATSAPP_CLOUD_INBOUND_APPLY_COMMIT=PASS/u);
      assert.doesNotMatch(output, /staging-secret-value|pooler\.supabase/u);
    },
    { mode: "apply" },
  );
});

test("present state is verified before no-op while partial state fails closed", async () => {
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
      assert.match(output, /WHATSAPP_CLOUD_INBOUND_APPLY=already_current/u);
      assert.equal(calls.trim().split("\n").length, 4);
      assert.doesNotMatch(input, /WHATSAPP_CLOUD_INBOUND_APPLY_COMMIT=PASS/u);
    },
    { mode: "apply", controlState: "present" },
  );

  await withFakeDatabase(
    async ({ environment, callLog }) => {
      await assert.rejects(
        execFileAsync(process.execPath, [runnerPath, "--apply"], {
          env: environment,
        }),
        /WHATSAPP_CLOUD_INBOUND_ERROR=partial_state/u,
      );
      const calls = await readFile(callLog, "utf8");
      assert.equal(calls.trim().split("\n").length, 2);
    },
    { mode: "apply", controlState: "invalid" },
  );
});

test("database failures use fixed codes, hide provider data and are never retried", async () => {
  for (const [failure, expected, expectedCalls] of [
    ["member", "member_control_failed", 1],
    ["preflight", "preflight_failed", 2],
    ["apply", "apply_outcome_indeterminate", 3],
    ["postflight", "applied_unverified", 4],
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
              new RegExp(`WHATSAPP_CLOUD_INBOUND_ERROR=${expected}`, "u"),
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
      /WHATSAPP_CLOUD_INBOUND_ERROR=passfile_invalid/u,
    );

    await chmod(passfile, 0o600);
    const link = `${passfile}.link`;
    await symlink(passfile, link);
    await assert.rejects(
      execFileAsync(process.execPath, [runnerPath, "--verify"], {
        env: { ...environment, PGPASSFILE: link },
      }),
      /WHATSAPP_CLOUD_INBOUND_ERROR=passfile_invalid/u,
    );
  });
});

test("manual workflows are protected, exact-release, shared-state and mode-separated", async () => {
  const [verifyWorkflow, applyWorkflow] = await Promise.all(
    [
      ".github/workflows/whatsapp-cloud-inbound-staging-verify.yml",
      ".github/workflows/whatsapp-cloud-inbound-staging-apply.yml",
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
    assert.match(
      workflow,
      /STAGING_DATABASE_ROLLOUT_WORKSPACE_MEMBER_BOUNDARY=verify/u,
    );
    assert.doesNotMatch(workflow, /pull_request:|\bpush:|\bschedule:/u);
    assert.doesNotMatch(workflow, /WHATSAPP_CLOUD_(?:APP_SECRET|WEBHOOK_VERIFY_TOKEN)/u);
  }
  assert.match(verifyWorkflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'/u);
  assert.match(verifyWorkflow, /STAGING_DATABASE_ROLLOUT_WHATSAPP_CLOUD_INBOUND=verify/u);
  assert.match(verifyWorkflow, /db:whatsapp-cloud-inbound:verify/u);
  assert.doesNotMatch(verifyWorkflow, /db:whatsapp-cloud-inbound:apply/u);
  assert.match(applyWorkflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'true'/u);
  assert.match(applyWorkflow, /I_UNDERSTAND_NON_PRODUCTION_ONLY/u);
  assert.match(applyWorkflow, /STAGING_DATABASE_ROLLOUT_WHATSAPP_CLOUD_INBOUND=apply/u);
  assert.match(applyWorkflow, /db:whatsapp-cloud-inbound:apply/u);
});
