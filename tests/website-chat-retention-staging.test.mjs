import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  WEBSITE_CHAT_RETENTION_ACCEPTANCE_CONFIRMATION,
  WEBSITE_CHAT_RETENTION_MIGRATION_CONFIRMATION,
  WEBSITE_CHAT_RETENTION_SCHEMA_CONFIRMATION,
  evaluateWebsiteChatRetentionStagingEnvironment,
} from "../src/lib/websiteChatRetentionStagingPolicy.mjs";
import {
  WEBSITE_CHAT_RETENTION_POSTFLIGHT_SQL,
  classifyWebsiteChatRetentionDatabaseError,
} from "../scripts/operations/website-chat-retention-staging-runner.mjs";
import {
  buildWebsiteChatRetentionAcceptanceSql,
  buildWebsiteChatRetentionRoleDenialSql,
  deriveWebsiteChatRetentionMaterial,
} from "../scripts/operations/website-chat-retention-staging-acceptance.mjs";

const REVIEWED_COMMIT = "a".repeat(40);
const STAGING_REF = "stagingref0123456789";
const PRODUCTION_REF = "prodref0123456789012";
const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const execFileAsync = promisify(execFile);
const RUNNER = "scripts/operations/website-chat-retention-staging-runner.mjs";
const ACCEPTANCE = "scripts/operations/website-chat-retention-staging-acceptance.mjs";

function baseEnvironment() {
  return {
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: REVIEWED_COMMIT,
    FANMIND_WEBSITE_CHAT_RETENTION_REVIEWED_COMMIT: REVIEWED_COMMIT,
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.invalid",
    FANMIND_TARGET_API_ORIGIN: "https://staging.fanmind.invalid",
    FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
    NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
    FANMIND_TARGET_SUPABASE_PROJECT_REF: STAGING_REF,
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "",
    FANMIND_WEBSITE_CHAT_RETENTION_SCHEMA_CONFIRM: WEBSITE_CHAT_RETENTION_SCHEMA_CONFIRMATION,
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
    FANMIND_WEBSITE_CHAT_RETENTION_SCHEMA_CONFIRM: "",
    [key]: confirmation,
  };
}

test("retention verification accepts only the exact reviewed main commit on isolated Staging", () => {
  const result = evaluateWebsiteChatRetentionStagingEnvironment(baseEnvironment(), { mode: "schema" });
  assert.equal(result.ok, true);
  assert.equal(result.writeEnabled, false);
  for (const mutation of [
    { GITHUB_REF: "refs/heads/feature/retention" },
    { GITHUB_SHA: "b".repeat(40) },
    { FANMIND_WEBSITE_CHAT_RETENTION_REVIEWED_COMMIT: "b".repeat(40) },
    { NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co` },
    { PGHOST: "production-db.fanmind.invalid" },
    { PGHOSTADDR: "127.0.0.1" },
    { PGSERVICE: "production" },
    { PGSSLMODE: "require" },
  ]) {
    assert.equal(evaluateWebsiteChatRetentionStagingEnvironment(
      { ...baseEnvironment(), ...mutation }, { mode: "schema" },
    ).ok, false, JSON.stringify(mutation));
  }
});

test("retention apply and acceptance use distinct confirmations", () => {
  assert.equal(evaluateWebsiteChatRetentionStagingEnvironment(writeEnvironment(
    "FANMIND_WEBSITE_CHAT_RETENTION_MIGRATION_CONFIRM",
    WEBSITE_CHAT_RETENTION_MIGRATION_CONFIRMATION,
  ), { mode: "migration" }).ok, true);
  assert.equal(evaluateWebsiteChatRetentionStagingEnvironment(writeEnvironment(
    "FANMIND_WEBSITE_CHAT_RETENTION_ACCEPTANCE_CONFIRM",
    WEBSITE_CHAT_RETENTION_ACCEPTANCE_CONFIRMATION,
  ), { mode: "acceptance" }).ok, true);
  assert.equal(evaluateWebsiteChatRetentionStagingEnvironment(writeEnvironment(
    "FANMIND_WEBSITE_CHAT_RETENTION_ACCEPTANCE_CONFIRM",
    WEBSITE_CHAT_RETENTION_MIGRATION_CONFIRMATION,
  ), { mode: "acceptance" }).ok, false);
});

test("retention acceptance rejects missing or malformed synthetic Workspaces", () => {
  for (const workspaceId of ["", "production", "00000000-0000-0000-0000-000000000000"]) {
    const result = evaluateWebsiteChatRetentionStagingEnvironment({
      ...writeEnvironment(
        "FANMIND_WEBSITE_CHAT_RETENTION_ACCEPTANCE_CONFIRM",
        WEBSITE_CHAT_RETENTION_ACCEPTANCE_CONFIRMATION,
      ),
      FANMIND_WEBSITE_CHAT_STAGING_WORKSPACE_ID: workspaceId,
    }, { mode: "acceptance" });
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes("synthetic_workspace"));
  }
});

test("retention postflight is read-only and proves the complete service-role boundary", () => {
  assert.match(WEBSITE_CHAT_RETENTION_POSTFLIGHT_SQL, /set transaction read only/u);
  assert.match(WEBSITE_CHAT_RETENTION_POSTFLIGHT_SQL, /manage_website_chat_retention\(integer,boolean,uuid\)/u);
  assert.match(WEBSITE_CHAT_RETENTION_POSTFLIGHT_SQL, /manage_website_chat_retention\(integer,boolean\)/u);
  assert.match(WEBSITE_CHAT_RETENTION_POSTFLIGHT_SQL, /function\.proname = 'manage_website_chat_retention'/u);
  assert.match(WEBSITE_CHAT_RETENTION_POSTFLIGHT_SQL, /proowner = to_regrole\('postgres'\)/u);
  assert.match(WEBSITE_CHAT_RETENTION_POSTFLIGHT_SQL, /rolbypassrls/u);
  assert.match(WEBSITE_CHAT_RETENTION_POSTFLIGHT_SQL, /relrowsecurity/u);
  assert.match(WEBSITE_CHAT_RETENTION_POSTFLIGHT_SQL, /has_table_privilege/u);
  assert.match(WEBSITE_CHAT_RETENTION_POSTFLIGHT_SQL, /'anon', guarded_table/u);
  assert.match(WEBSITE_CHAT_RETENTION_POSTFLIGHT_SQL, /'authenticated', guarded_table/u);
  assert.match(WEBSITE_CHAT_RETENTION_POSTFLIGHT_SQL, /'DELETE'/u);
  assert.match(WEBSITE_CHAT_RETENTION_POSTFLIGHT_SQL, /'TRUNCATE'/u);
  assert.match(WEBSITE_CHAT_RETENTION_POSTFLIGHT_SQL, /confdeltype = 'c'/u);
  assert.match(WEBSITE_CHAT_RETENTION_POSTFLIGHT_SQL, /deleted_session_count <> 0/u);
  assert.doesNotMatch(WEBSITE_CHAT_RETENTION_POSTFLIGHT_SQL, /\bcommit\s*;/iu);
});

test("retention database diagnostics expose only stable non-secret error classes", () => {
  assert.equal(classifyWebsiteChatRetentionDatabaseError(
    "psql:<stdin>:42: ERROR: permission denied for table private_table",
  ), "database_permission_denied");
  assert.equal(classifyWebsiteChatRetentionDatabaseError(
    "psql:<stdin>:9: ERROR: relation missing_table does not exist",
  ), "database_relation_missing");
  assert.equal(classifyWebsiteChatRetentionDatabaseError(
    "psql: error: connection to server failed: password authentication failed",
  ), "database_connection_failed");
  assert.equal(classifyWebsiteChatRetentionDatabaseError(
    "psql:<stdin>:12: ERROR: unexpected internal detail",
  ), "database_apply_rejected");
});

test("retention acceptance material is deterministic and unique", () => {
  const material = deriveWebsiteChatRetentionMaterial(WORKSPACE_ID);
  assert.deepEqual(material, deriveWebsiteChatRetentionMaterial(WORKSPACE_ID));
  const ids = Object.entries(material).filter(([key]) => key.endsWith("Id")).map(([, value]) => value);
  assert.equal(new Set(ids).size, ids.length);
});

test("rollback-only acceptance proves bounded workspace retention without providers", () => {
  const sql = buildWebsiteChatRetentionAcceptanceSql(WORKSPACE_ID);
  assert.match(sql, /manage_website_chat_retention\(0, false/u);
  assert.match(sql, /manage_website_chat_retention\(1001, false/u);
  assert.match(sql, /manage_website_chat_retention\(1, null/u);
  assert.match(sql, /WEBSITE_CHAT_RETENTION_INVALID_INPUTS=PASS/u);
  assert.match(sql, /WEBSITE_CHAT_RETENTION_BOUNDED_DELETE=PASS/u);
  assert.match(sql, /WEBSITE_CHAT_RETENTION_CRM_PRESERVED=PASS/u);
  assert.match(sql, /WEBSITE_CHAT_RETENTION_ACTIVE_HANDOFF=PASS/u);
  assert.match(sql, /WEBSITE_CHAT_RETENTION_WORKSPACE_SCOPE=PASS/u);
  assert.match(
    sql,
    new RegExp(deriveWebsiteChatRetentionMaterial(WORKSPACE_ID).foreignWorkspaceId, "u"),
  );
  assert.match(sql, /WEBSITE_CHAT_RETENTION_ROLLBACK=PASS/u);
  assert.equal((sql.match(/\brollback\s*;/giu) ?? []).length, 2);
  assert.doesNotMatch(sql, /\bcommit\s*;/iu);
  assert.doesNotMatch(sql, /resend|sendgrid|mailgun|postmark|smtp|openai|http_post|net\.http/iu);
  assert.match(buildWebsiteChatRetentionRoleDenialSql("anon", "table"), /website_chat_message_receipts/u);
  assert.match(buildWebsiteChatRetentionRoleDenialSql("authenticated"), /manage_website_chat_retention/u);
});

test("offline retention acceptance needs no database or provider credential", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [ACCEPTANCE, "--check"]);
  const output = `${stdout}\n${stderr}`;
  assert.match(output, /WEBSITE_CHAT_RETENTION_ACCEPTANCE_READY=YES/u);
  assert.doesNotMatch(output, /postgres|supabase|password|secret|11111111/iu);
});

test("fake psql proves redacted retention verification and rollback-only acceptance", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fanmind-retention-test-"));
  const bin = join(directory, "bin");
  const passfile = join(directory, "pgpass");
  const fakePsql = join(bin, "psql");
  await mkdir(bin);
  await writeFile(passfile, "host:5432:postgres:user:test-password\n", { mode: 0o600 });
  await writeFile(fakePsql, `#!/bin/sh
if [ "\${1:-}" = "--version" ]; then exit 0; fi
INPUT="$(/bin/cat)"
case "$INPUT" in
  *"set local role anon;"*|*"set local role authenticated;"*)
    printf '%s\n' 'WEBSITE_CHAT_RETENTION_ROLE_SWITCH=PASS'
    case "$INPUT" in
      *"website_chat_message_receipts limit 1"*)
        printf '%s\n' 'ERROR: permission denied for table website_chat_message_receipts' >&2 ;;
      *)
        printf '%s\n' 'ERROR: permission denied for function manage_website_chat_retention' >&2 ;;
    esac
    exit 1 ;;
  *"WEBSITE_CHAT_RETENTION_ACCEPTANCE_STAGE=preflight"*)
    printf '%s\n' \
      'WEBSITE_CHAT_RETENTION_INVALID_INPUTS=PASS' \
      'WEBSITE_CHAT_RETENTION_DRY_RUN=PASS' \
      'WEBSITE_CHAT_RETENTION_BOUNDED_DELETE=PASS' \
      'WEBSITE_CHAT_RETENTION_CRM_PRESERVED=PASS' \
      'WEBSITE_CHAT_RETENTION_ACTIVE_HANDOFF=PASS' \
      'WEBSITE_CHAT_RETENTION_WORKSPACE_SCOPE=PASS' \
      'WEBSITE_CHAT_RETENTION_ROLLBACK=PASS'
    exit 0 ;;
esac
printf '%s\n' 'WEBSITE_CHAT_RETENTION_POSTFLIGHT=PASS'
`, { mode: 0o700 });
  await chmod(fakePsql, 0o700);
  const path = `${bin}:${process.env.PATH ?? "/usr/bin:/bin"}`;
  try {
    const verify = await execFileAsync(process.execPath, [RUNNER, "--verify"], {
      env: { ...baseEnvironment(), PATH: path, PGPASSFILE: passfile },
    });
    const acceptance = await execFileAsync(process.execPath, [ACCEPTANCE, "--run"], {
      env: {
        ...writeEnvironment(
          "FANMIND_WEBSITE_CHAT_RETENTION_ACCEPTANCE_CONFIRM",
          WEBSITE_CHAT_RETENTION_ACCEPTANCE_CONFIRMATION,
        ),
        PATH: path,
        PGPASSFILE: passfile,
      },
    });
    const output = `${verify.stdout}\n${verify.stderr}\n${acceptance.stdout}\n${acceptance.stderr}`;
    assert.match(output, /WEBSITE_CHAT_RETENTION_STAGING_READY=YES/u);
    assert.match(output, /WEBSITE_CHAT_RETENTION_BROWSER_DENIALS=4/u);
    assert.match(output, /WEBSITE_CHAT_RETENTION_TRANSACTION=ROLLED_BACK/u);
    assert.match(output, /WEBSITE_CHAT_RETENTION_STAGING_ACCEPTANCE=PASS/u);
    assert.match(output, /SECRETS_WURDEN_NICHT_AUSGEGEBEN=true/u);
    assert.doesNotMatch(output, /test-password|stagingref0123456789|11111111/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("retention workflows are manual exact-main Staging controls with separate confirmations", async () => {
  const [schemaWorkflow, acceptanceWorkflow] = await Promise.all([
    readFile(new URL("../.github/workflows/website-chat-retention-staging.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/website-chat-retention-staging-acceptance.yml", import.meta.url), "utf8"),
  ]);
  const combined = `${schemaWorkflow}\n${acceptanceWorkflow}`;
  assert.equal((combined.match(/workflow_dispatch:/gu) ?? []).length, 2);
  assert.doesNotMatch(combined, /^\s*(?:push|pull_request|schedule):/mu);
  assert.match(combined, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(combined, /inputs\.reviewed_commit == github\.sha/u);
  assert.match(combined, /environment: staging/u);
  assert.match(combined, /PGSSLMODE: verify-full/u);
  assert.match(schemaWorkflow, /verify-website-chat-retention-schema/u);
  assert.match(schemaWorkflow, /apply-website-chat-retention-migration/u);
  assert.match(acceptanceWorkflow, /run-website-chat-retention-acceptance/u);
  assert.match(combined, /fanmind-website-chat-staging-write/u);
  assert.match(combined, /actions\/checkout@[0-9a-f]{40}/u);
});
