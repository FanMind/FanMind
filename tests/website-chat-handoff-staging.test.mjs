import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  chmod, mkdir, mkdtemp, readFile, rm, writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  WEBSITE_CHAT_ACCEPTANCE_CONFIRMATION,
  WEBSITE_CHAT_MIGRATION_CONFIRMATION,
  WEBSITE_CHAT_SCHEMA_CONFIRMATION,
  evaluateWebsiteChatStagingControlEnvironment,
} from "../src/lib/websiteChatStagingControlPolicy.mjs";
import {
  WEBSITE_CHAT_HANDOFF_POSTFLIGHT_SQL,
} from "../scripts/operations/website-chat-handoff-staging-runner.mjs";
import {
  buildWebsiteChatAcceptanceSql,
  buildWebsiteChatRoleDenialSql,
  deriveWebsiteChatAcceptanceMaterial,
} from "../scripts/operations/website-chat-handoff-staging-acceptance.mjs";

const REVIEWED_COMMIT = "a".repeat(40);
const STAGING_REF = "stagingref0123456789";
const PRODUCTION_REF = "prodref0123456789012";
const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const execFileAsync = promisify(execFile);
const RUNNER = "scripts/operations/website-chat-handoff-staging-runner.mjs";
const ACCEPTANCE = "scripts/operations/website-chat-handoff-staging-acceptance.mjs";

function baseEnvironment() {
  return {
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: REVIEWED_COMMIT,
    FANMIND_WEBSITE_CHAT_REVIEWED_COMMIT: REVIEWED_COMMIT,
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.invalid",
    FANMIND_TARGET_API_ORIGIN: "https://staging.fanmind.invalid",
    FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
    NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
    FANMIND_TARGET_SUPABASE_PROJECT_REF: STAGING_REF,
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "",
    FANMIND_WEBSITE_CHAT_SCHEMA_CONFIRM: WEBSITE_CHAT_SCHEMA_CONFIRMATION,
    FANMIND_WEBSITE_CHAT_STAGING_WORKSPACE_ID: WORKSPACE_ID,
    PGHOST: "staging-db.fanmind.invalid",
    FANMIND_TARGET_DB_HOST: "staging-db.fanmind.invalid",
    FANMIND_PRODUCTION_DB_HOST: "production-db.fanmind.invalid",
    PGPORT: "5432",
    PGDATABASE: "fanmind_staging",
    PGUSER: "fanmind_staging_control",
    PGSSLMODE: "verify-full",
  };
}

function writeEnvironment(key, confirmation) {
  return {
    ...baseEnvironment(),
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    [key]: confirmation,
  };
}

test("read-only schema verification accepts only exact-main isolated Staging", () => {
  const result = evaluateWebsiteChatStagingControlEnvironment(
    baseEnvironment(),
    { mode: "schema" },
  );
  assert.equal(result.ok, true);
  assert.equal(result.writeEnabled, false);
});

test("apply and acceptance require distinct write confirmations", () => {
  const migration = evaluateWebsiteChatStagingControlEnvironment(
    writeEnvironment(
      "FANMIND_WEBSITE_CHAT_MIGRATION_CONFIRM",
      WEBSITE_CHAT_MIGRATION_CONFIRMATION,
    ),
    { mode: "migration" },
  );
  assert.equal(migration.ok, true);
  assert.equal(migration.writeEnabled, true);

  const acceptance = evaluateWebsiteChatStagingControlEnvironment(
    writeEnvironment(
      "FANMIND_WEBSITE_CHAT_ACCEPTANCE_CONFIRM",
      WEBSITE_CHAT_ACCEPTANCE_CONFIRMATION,
    ),
    { mode: "acceptance" },
  );
  assert.equal(acceptance.ok, true);
  assert.equal(acceptance.workspaceId, WORKSPACE_ID);

  const crossed = evaluateWebsiteChatStagingControlEnvironment(
    writeEnvironment(
      "FANMIND_WEBSITE_CHAT_ACCEPTANCE_CONFIRM",
      WEBSITE_CHAT_MIGRATION_CONFIRMATION,
    ),
    { mode: "acceptance" },
  );
  assert.equal(crossed.ok, false);
  assert.ok(crossed.errors.includes("confirmation"));
});

test("Staging policy fails closed on Production, indirect libpq and weak TLS targets", () => {
  const mutations = [
    { GITHUB_REF: "refs/heads/feature/website-chat" },
    { GITHUB_SHA: "b".repeat(40) },
    { FANMIND_WEBSITE_CHAT_REVIEWED_COMMIT: "b".repeat(40) },
    {
      NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
      FANMIND_TARGET_API_ORIGIN: "https://fanmind.ch",
    },
    {
      NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co`,
      FANMIND_TARGET_SUPABASE_PROJECT_REF: PRODUCTION_REF,
    },
    {
      PGHOST: "production-db.fanmind.invalid",
      FANMIND_TARGET_DB_HOST: "production-db.fanmind.invalid",
    },
    { PGHOSTADDR: "127.0.0.1" },
    { PGSERVICE: "production" },
    { PGSSLMODE: "require" },
    { FANMIND_PRODUCTION_DB_HOST: "" },
  ];
  for (const mutation of mutations) {
    const result = evaluateWebsiteChatStagingControlEnvironment(
      { ...baseEnvironment(), ...mutation },
      { mode: "schema" },
    );
    assert.equal(result.ok, false, JSON.stringify(mutation));
  }
});

test("acceptance rejects a missing or malformed synthetic Workspace", () => {
  for (const workspaceId of ["", "production", "00000000-0000-0000-0000-000000000000"]) {
    const result = evaluateWebsiteChatStagingControlEnvironment(
      {
        ...writeEnvironment(
          "FANMIND_WEBSITE_CHAT_ACCEPTANCE_CONFIRM",
          WEBSITE_CHAT_ACCEPTANCE_CONFIRMATION,
        ),
        FANMIND_WEBSITE_CHAT_STAGING_WORKSPACE_ID: workspaceId,
      },
      { mode: "acceptance" },
    );
    assert.equal(result.ok, false, workspaceId);
    assert.ok(result.errors.includes("synthetic_workspace"));
  }
});

test("postflight is read-only and proves RLS plus service-role-only ACLs", () => {
  assert.match(WEBSITE_CHAT_HANDOFF_POSTFLIGHT_SQL, /set transaction read only/u);
  assert.match(WEBSITE_CHAT_HANDOFF_POSTFLIGHT_SQL, /relrowsecurity/u);
  assert.match(WEBSITE_CHAT_HANDOFF_POSTFLIGHT_SQL, /pg_policies/u);
  assert.match(WEBSITE_CHAT_HANDOFF_POSTFLIGHT_SQL, /aclexplode/u);
  assert.match(WEBSITE_CHAT_HANDOFF_POSTFLIGHT_SQL, /acl\.grantee = 0/u);
  assert.match(WEBSITE_CHAT_HANDOFF_POSTFLIGHT_SQL, /has_table_privilege\('anon'/u);
  assert.match(WEBSITE_CHAT_HANDOFF_POSTFLIGHT_SQL, /has_function_privilege\('authenticated'/u);
  assert.match(WEBSITE_CHAT_HANDOFF_POSTFLIGHT_SQL, /ingest_website_chat_message\(uuid,text,text,uuid,text\)/u);
  assert.match(WEBSITE_CHAT_HANDOFF_POSTFLIGHT_SQL, /WEBSITE_CHAT_HANDOFF_POSTFLIGHT=PASS/u);
  assert.doesNotMatch(WEBSITE_CHAT_HANDOFF_POSTFLIGHT_SQL, /\bcommit\s*;/iu);
});

test("synthetic material is deterministic and unique per lifecycle object", () => {
  const material = deriveWebsiteChatAcceptanceMaterial(WORKSPACE_ID);
  assert.deepEqual(material, deriveWebsiteChatAcceptanceMaterial(WORKSPACE_ID));
  assert.equal(new Set([
    material.installationId,
    material.publicInstallationId,
    material.sessionId,
    material.emptySessionId,
    material.clientMessageId,
    material.clientHandoffId,
    material.emptyClientHandoffId,
  ]).size, 7);
  assert.match(material.visitorSubjectHash, /^[0-9a-f]{64}$/u);
  assert.match(material.emptyVisitorSubjectHash, /^[0-9a-f]{64}$/u);
  assert.notEqual(material.emptyVisitorSubjectHash, material.visitorSubjectHash);
});

test("rollback-only acceptance covers boundary, lifecycle and cleanup without delivery", () => {
  const sql = buildWebsiteChatAcceptanceSql(WORKSPACE_ID);
  assert.match(sql, /website_chat_processing_allowed/u);
  assert.match(sql, /website_chat_message_idempotency_failed/u);
  assert.match(sql, /website_chat_handoff_idempotency_failed/u);
  assert.match(sql, /website_chat_handoff_without_message_not_rejected/u);
  assert.match(sql, /website_chat_wrong_origin_not_rejected/u);
  assert.match(sql, /website_chat_handoff_wrong_origin_not_rejected/u);
  assert.match(sql, /staging_synthetic_fixture/u);
  assert.match(sql, /workspace_processing_acceptance/u);
  assert.match(sql, /human_reply_by_email/u);
  assert.match(sql, /visitor_email_fingerprint/u);
  assert.match(sql, /direction = 'outbound'/u);
  assert.match(sql, /WEBSITE_CHAT_HANDOFF_ROLLBACK=PASS/u);
  assert.equal((sql.match(/\brollback\s*;/giu) ?? []).length, 2);
  assert.doesNotMatch(sql, /\bcommit\s*;/iu);
  assert.doesNotMatch(sql, /resend|sendgrid|mailgun|postmark|smtp|openai|http_post|net\.http/iu);

  assert.match(buildWebsiteChatRoleDenialSql("anon", "table"), /set local role anon/u);
  assert.match(buildWebsiteChatRoleDenialSql("authenticated", "table"), /website_chat_handoffs/u);
  assert.match(buildWebsiteChatRoleDenialSql("anon", "handoff"), /request_website_chat_handoff/u);
});

test("offline acceptance check needs no database or provider credential", async () => {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [ACCEPTANCE, "--check"],
    { env: process.env },
  );
  const output = `${stdout}\n${stderr}`;
  assert.match(output, /WEBSITE_CHAT_HANDOFF_ACCEPTANCE_READY=YES/u);
  assert.doesNotMatch(output, /postgres|supabase|password|secret|11111111/iu);
});

test("fake-psql controls prove redacted verify and rollback-only acceptance", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fanmind-website-chat-test-"));
  const bin = join(directory, "bin");
  const passfile = join(directory, "pgpass");
  const fakePsql = join(bin, "psql");
  await mkdir(bin);
  await writeFile(
    passfile,
    "host:5432:postgres:user:test-password\n",
    { mode: 0o600 },
  );
  await writeFile(fakePsql, `#!/bin/sh
if [ "\${1:-}" = "--version" ]; then exit 0; fi
INPUT="$(/bin/cat)"
case "$INPUT" in
  *"set local role anon;"*)
    printf '%s\n' 'WEBSITE_CHAT_HANDOFF_ROLE_SWITCH=PASS'
    case "$INPUT" in
      *"website_chat_handoffs limit 1"*)
        printf '%s\n' 'ERROR: permission denied for table website_chat_handoffs' >&2 ;;
      *)
        printf '%s\n' 'ERROR: permission denied for function request_website_chat_handoff' >&2 ;;
    esac
    exit 1 ;;
  *"set local role authenticated;"*)
    printf '%s\n' 'WEBSITE_CHAT_HANDOFF_ROLE_SWITCH=PASS'
    printf '%s\n' 'ERROR: permission denied for table website_chat_handoffs' >&2
    exit 1 ;;
  *"WEBSITE_CHAT_HANDOFF_ACCEPTANCE_STAGE=preflight"*)
    printf '%s\n' \\
      'WEBSITE_CHAT_HANDOFF_MESSAGE=PASS' \\
      'WEBSITE_CHAT_HANDOFF_MESSAGE_REQUIRED=PASS' \\
      'WEBSITE_CHAT_HANDOFF_IDEMPOTENCY=PASS' \\
      'WEBSITE_CHAT_HANDOFF_ORIGIN_REJECTION=PASS' \\
      'WEBSITE_CHAT_HANDOFF_WRONG_ORIGIN_REJECTION=PASS' \\
      'WEBSITE_CHAT_HANDOFF_CRM_LINKAGE=PASS' \\
      'WEBSITE_CHAT_HANDOFF_ROLLBACK=PASS'
    exit 0 ;;
esac
printf '%s\n' 'WEBSITE_CHAT_HANDOFF_POSTFLIGHT=PASS'
`, { mode: 0o700 });
  await chmod(fakePsql, 0o700);
  const path = `${bin}:${process.env.PATH ?? "/usr/bin:/bin"}`;
  try {
    const verify = await execFileAsync(process.execPath, [RUNNER, "--verify"], {
      env: {
        ...baseEnvironment(),
        PATH: path,
        PGPASSFILE: passfile,
      },
    });
    const verifyOutput = `${verify.stdout}\n${verify.stderr}`;
    assert.match(verifyOutput, /WEBSITE_CHAT_HANDOFF_STAGING_READY=YES/u);
    assert.match(verifyOutput, /WEBSITE_CHAT_HANDOFF_APPLY=not_requested/u);

    const acceptance = await execFileAsync(process.execPath, [ACCEPTANCE, "--run"], {
      env: {
        ...writeEnvironment(
          "FANMIND_WEBSITE_CHAT_ACCEPTANCE_CONFIRM",
          WEBSITE_CHAT_ACCEPTANCE_CONFIRMATION,
        ),
        PATH: path,
        PGPASSFILE: passfile,
      },
    });
    const output = `${verifyOutput}\n${acceptance.stdout}\n${acceptance.stderr}`;
    assert.match(output, /WEBSITE_CHAT_HANDOFF_BROWSER_DENIALS=3/u);
    assert.match(output, /WEBSITE_CHAT_HANDOFF_TRANSACTION=ROLLED_BACK/u);
    assert.match(output, /WEBSITE_CHAT_HANDOFF_STAGING_ACCEPTANCE=PASS/u);
    assert.match(output, /WEBSITE_CHAT_AI=disabled/u);
    assert.match(output, /WEBSITE_CHAT_EMAIL_DELIVERY=disabled/u);
    assert.match(output, /SECRETS_WURDEN_NICHT_AUSGEGEBEN=true/u);
    assert.doesNotMatch(output, /test-password|stagingref0123456789|11111111/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("manual workflows bind exact main, isolated Staging and separate confirmations", async () => {
  const [schemaWorkflow, acceptanceWorkflow] = await Promise.all([
    readFile(new URL("../.github/workflows/website-chat-handoff-staging.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/website-chat-handoff-staging-acceptance.yml", import.meta.url), "utf8"),
  ]);
  const combined = `${schemaWorkflow}\n${acceptanceWorkflow}`;
  assert.equal((combined.match(/workflow_dispatch:/gu) ?? []).length, 2);
  assert.doesNotMatch(combined, /^\s*(?:push|pull_request|schedule):/mu);
  assert.match(combined, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(combined, /inputs\.reviewed_commit == github\.sha/u);
  assert.match(combined, /environment: staging/u);
  assert.match(combined, /PGSSLMODE: verify-full/u);
  assert.match(schemaWorkflow, /verify-website-chat-handoff-schema/u);
  assert.match(schemaWorkflow, /apply-website-chat-handoff-migration/u);
  assert.match(acceptanceWorkflow, /run-website-chat-handoff-acceptance/u);
  assert.match(acceptanceWorkflow, /FANMIND_WEBSITE_CHAT_STAGING_WORKSPACE_ID/u);
  assert.match(combined, /I_UNDERSTAND_NON_PRODUCTION_ONLY/u);
  assert.match(combined, /fanmind-website-chat-staging-write/u);
});
