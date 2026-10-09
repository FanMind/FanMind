import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  execute,
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
