import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  execute,
  parseCharacterCount,
  POSTFLIGHT_SQL,
  SQL_PATH,
  SQL_SHA256,
} from "../scripts/operations/chat-admin-structured-offers-staging-runner.mjs";

test("structured offers runner pins the only controlled SQL and exact schema contract", () => {
  assert.equal(SQL_PATH, "supabase/controlled/20261007190000_chat_admin_structured_offers.sql");
  const source = readFileSync(SQL_PATH, "utf8");
  assert.equal(createHash("sha256").update(source).digest("hex"), SQL_SHA256);
  assert.match(POSTFLIGHT_SQL, /set transaction read only/u);
  assert.match(POSTFLIGHT_SQL, /CHAT_ADMIN_STRUCTURED_OFFERS_SCHEMA_STATE=ABSENT/u);
  assert.match(POSTFLIGHT_SQL, /CHAT_ADMIN_STRUCTURED_OFFERS_SCHEMA_STATE=PARTIAL/u);
  assert.match(POSTFLIGHT_SQL, /CHAT_ADMIN_STRUCTURED_OFFERS_SCHEMA_STATE=VERIFIED/u);
  assert.match(POSTFLIGHT_SQL, /chat_admin_characters_owner_all/u);
  assert.match(POSTFLIGHT_SQL, /c\.relrowsecurity/u);
  assert.match(POSTFLIGHT_SQL, /sales_playbook/u);
  assert.match(POSTFLIGHT_SQL, /data_type='jsonb'/u);
  assert.match(POSTFLIGHT_SQL, /is_nullable='NO'/u);
  assert.match(POSTFLIGHT_SQL, /expected_default/u);
  assert.match(POSTFLIGHT_SQL, /chat_characters_sales_playbook_object/u);
  assert.match(POSTFLIGHT_SQL, /octet_length\(sales_playbook::text\) <= 18000/u);
  assert.match(POSTFLIGHT_SQL, /column_acl_count/u);
  assert.match(POSTFLIGHT_SQL, /sales_rules remains supplemental free text/u);
  assert.doesNotMatch(POSTFLIGHT_SQL, /\bcommit\s*;/iu);
});

test("structured offers runner fails closed before database access outside the staging boundary", () => {
  assert.throws(
    () => execute("verify", {}),
    /CHAT_ADMIN_STRUCTURED_OFFERS_STAGING_ERROR=environment_invalid/u,
  );
  assert.throws(
    () => execute("apply", {}),
    /CHAT_ADMIN_STRUCTURED_OFFERS_STAGING_ERROR=environment_invalid/u,
  );
});

test("structured offers workflow is manual, exact-main, staging-only and production-write-free", () => {
  const workflow = readFileSync(
    ".github/workflows/chat-admin-structured-offers-staging-migration.yml",
    "utf8",
  );
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /environment: staging/u);
  assert.match(workflow, /\[\[ "\$GITHUB_REF" == refs\/heads\/main \]\]/u);
  assert.match(workflow, /\[\[ "\$REQUESTED_COMMIT" == "\$GITHUB_SHA" \]\]/u);
  assert.match(workflow, /VERIFY:verify-chat-admin-structured-offers/u);
  assert.match(workflow, /APPLY:apply-chat-admin-structured-offers/u);
  assert.match(workflow, /FANMIND_PRODUCTION_DB_HOST/u);
  assert.match(workflow, /PGSSLMODE: verify-full/u);
  assert.match(workflow, /db:chat-admin-offers:verify/u);
  assert.match(workflow, /db:chat-admin-offers:apply/u);
  assert.doesNotMatch(workflow, /environment: production/u);
  assert.doesNotMatch(workflow, /supabase db push/u);
});


test("structured offers row count parser accepts the controlled psql shape only", () => {
  assert.equal(parseCharacterCount("7\n"), "7");
  assert.equal(parseCharacterCount("  0  \n"), "0");
  assert.throws(
    () => parseCharacterCount(" count\n-------\n     7\n(1 row)\n"),
    /CHAT_ADMIN_STRUCTURED_OFFERS_STAGING_ERROR=row_count_invalid/u,
  );
  assert.throws(
    () => parseCharacterCount("7\n8\n"),
    /CHAT_ADMIN_STRUCTURED_OFFERS_STAGING_ERROR=row_count_invalid/u,
  );
  const runner = readFileSync(
    "scripts/operations/chat-admin-structured-offers-staging-runner.mjs",
    "utf8",
  );
  assert.match(runner, /\["--tuples-only", "--no-align"\]/u);
});

test("structured offers APPLY permits only a clean schema and preserves fail-closed states", () => {
  const runner = readFileSync(
    "scripts/operations/chat-admin-structured-offers-staging-runner.mjs",
    "utf8",
  );
  assert.match(runner, /before!==\"ABSENT\"/u);
  assert.match(runner, /apply_requires_absent_schema/u);
  assert.match(runner, /schema_partial/u);
  assert.match(runner, /after!==\"VERIFIED\"/u);
  assert.match(runner, /row_count_changed/u);
});

function stagingEnvironment(overrides = {}) {
  const commit = "a".repeat(40);
  return {
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.ch",
    FANMIND_TARGET_API_ORIGIN: "https://staging.fanmind.ch",
    FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
    NEXT_PUBLIC_SUPABASE_URL: "https://vshyhvgcmrlagvfnvomc.supabase.co",
    FANMIND_TARGET_SUPABASE_PROJECT_REF: "vshyhvgcmrlagvfnvomc",
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "drqkpdvtbbrrdwmtrodz",
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: commit,
    FANMIND_CHAT_ADMIN_REVIEWED_COMMIT: commit,
    PGHOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_TARGET_DB_HOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_PRODUCTION_DB_HOST: "db.drqkpdvtbbrrdwmtrodz.supabase.co",
    PGPORT: "5432",
    PGDATABASE: "postgres",
    PGUSER: "postgres.vshyhvgcmrlagvfnvomc",
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: "/tmp/config/certificates/supabase-root-2021-ca.crt",
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "",
    FANMIND_CHAT_ADMIN_SCHEMA_CONFIRM: "verify-chat-admin-schema",
    ...overrides,
  };
}

test("structured offers runner rejects production and mismatched target identity before database access", () => {
  assert.throws(
    () => execute("verify", stagingEnvironment({
      FANMIND_RUNTIME_ENVIRONMENT: "production",
      NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
      FANMIND_TARGET_API_ORIGIN: "https://fanmind.ch",
    })),
    /CHAT_ADMIN_STRUCTURED_OFFERS_STAGING_ERROR=environment_invalid/u,
  );
  assert.throws(
    () => execute("verify", stagingEnvironment({
      FANMIND_TARGET_SUPABASE_PROJECT_REF: "drqkpdvtbbrrdwmtrodz",
    })),
    /CHAT_ADMIN_STRUCTURED_OFFERS_STAGING_ERROR=environment_invalid/u,
  );
  assert.throws(
    () => execute("verify", stagingEnvironment({
      FANMIND_CHAT_ADMIN_REVIEWED_COMMIT: "b".repeat(40),
    })),
    /CHAT_ADMIN_STRUCTURED_OFFERS_STAGING_ERROR=environment_invalid/u,
  );
});

test("structured offers VERIFY stays read-only and APPLY requires its exact confirmation", () => {
  assert.match(POSTFLIGHT_SQL, /set transaction read only/u);
  const workflow = readFileSync(
    ".github/workflows/chat-admin-structured-offers-staging-migration.yml",
    "utf8",
  );
  assert.match(workflow, /if: \$\{\{ inputs\.mode == 'VERIFY' \}\}/u);
  assert.match(workflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'/u);
  assert.match(workflow, /APPLY:apply-chat-admin-structured-offers/u);
  assert.throws(
    () => execute("apply", stagingEnvironment({
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
      FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
      FANMIND_CHAT_ADMIN_SCHEMA_CONFIRM: "",
      FANMIND_CHAT_ADMIN_MIGRATION_CONFIRM: "wrong-confirmation",
    })),
    /CHAT_ADMIN_STRUCTURED_OFFERS_STAGING_ERROR=environment_invalid/u,
  );
});
