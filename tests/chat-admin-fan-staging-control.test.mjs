import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { POSTFLIGHT_SQL, SQL_PATH, SQL_SHA256 } from "../scripts/operations/chat-admin-fan-staging-runner.mjs";

test("fan migration runner pins the only controlled SQL", () => {
  assert.equal(SQL_PATH, "supabase/controlled/20260927200000_chat_admin_character_fans.sql");
  assert.match(SQL_SHA256, /^[0-9a-f]{64}$/u);
  assert.match(POSTFLIGHT_SQL, /set transaction read only/u);
  assert.match(POSTFLIGHT_SQL, /CHAT_ADMIN_FAN_SCHEMA_STATE=VERIFIED/u);
  assert.match(POSTFLIGHT_SQL, /persist_chat_admin_generation/u);
  assert.match(POSTFLIGHT_SQL, /has_function_privilege/u);
  assert.match(POSTFLIGHT_SQL, /base_present/u);
  assert.match(POSTFLIGHT_SQL, /base_rls_enabled<>4/u);
  assert.match(POSTFLIGHT_SQL, /exact_function_mismatch/u);
  assert.match(POSTFLIGHT_SQL, /rpc_contract_mismatch/u);
  assert.match(POSTFLIGHT_SQL, /column_default_mismatch/u);
  assert.match(POSTFLIGHT_SQL, /chat_character_conversations_one_per_fan/u);
  assert.match(POSTFLIGHT_SQL, /one_chat_admin_workspace_global/u);
  assert.match(POSTFLIGHT_SQL, /unique_message_index_mismatch/u);
  assert.match(POSTFLIGHT_SQL, /binding_default_mismatch/u);
  assert.match(POSTFLIGHT_SQL, /seqincrement=1/u);
  assert.match(POSTFLIGHT_SQL, /authenticated_conversation_message_write_grant_mismatch/u);
  assert.match(POSTFLIGHT_SQL, /CHAT_ADMIN_FAN_SCHEMA_STATE=ABSENT/u);
  assert.doesNotMatch(POSTFLIGHT_SQL, /\bcommit\s*;/iu);
});

test("fan workflow is manual, exact-main, staging-only and has no production mutation", () => {
  const workflow = readFileSync(".github/workflows/chat-admin-fan-staging-migration.yml", "utf8");
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /environment: staging/u);
  assert.match(workflow, /\[\[ "\$REQUESTED_COMMIT" == "\$GITHUB_SHA" \]\]/u);
  assert.match(workflow, /FANMIND_PRODUCTION_DB_HOST/u);
  assert.doesNotMatch(workflow, /environment: production/u);
  assert.doesNotMatch(workflow, /supabase db push/u);
});
