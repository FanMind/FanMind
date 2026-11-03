import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateOpenQuestionRetentionAcceptanceSource } from "../scripts/operations/open-questions-retention-staging-acceptance.mjs";

const migrationPath = new URL("../supabase/migrations/20261103090000_website_chat_open_questions.sql", import.meta.url);
const retentionPath = new URL("../supabase/migrations/20260614120000_conversation_message_retention.sql", import.meta.url);
const actionPath = new URL("../src/app/admin/open-questions/actions.ts", import.meta.url);
const contractPath = new URL("../docs/operations/OPEN_QUESTIONS_PRIVACY_RETENTION.md", import.meta.url);
const acceptancePath = new URL("../scripts/operations/open-questions-retention-acceptance.sql", import.meta.url);
const acceptanceRunnerPath = new URL("../scripts/operations/open-questions-retention-staging-acceptance.mjs", import.meta.url);
const optionARetentionWrapperPath = new URL("../supabase/controlled/website_chat_open_questions_option_a_retention.sql", import.meta.url);
const optionARetentionPath = new URL("../supabase/controlled/website_chat_open_questions_option_a_retention_body.sql", import.meta.url);
const readinessPath = new URL("../docs/operations/OPEN_QUESTIONS_RETENTION_STAGING_READINESS.md", import.meta.url);
const retentionStagingPolicyPath = new URL("../src/lib/websiteChatRetentionStagingPolicy.mjs", import.meta.url);

test("status mutation and audit event are one workspace-bound transaction", async () => {
  const [sql, action] = await Promise.all([readFile(migrationPath, "utf8"), readFile(actionPath, "utf8")]);
  assert.match(sql, /for update/u);
  assert.match(sql, /question\.id = p_question_id and question\.workspace_id = p_workspace_id/gu);
  assert.match(sql, /update public\.website_chat_open_questions[\s\S]*insert into public\.website_chat_open_question_audit_events/u);
  assert.match(sql, /actor_id[\s\S]*before_status[\s\S]*after_status[\s\S]*occurred_at/u);
  assert.match(sql, /if v_question\.status <> p_after_status then/u);
  assert.match(action, /const actor = await requirePlatformAdmin\(\)/u);
  assert.match(action, /rpc\/update_website_chat_open_question_status/u);
  assert.match(action, /p_actor_id: actor\.id/u);
});

test("candidate and audit storage remain service-role-only and contain no raw message text", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.doesNotMatch(sql, /\b(?:content|question_text|message_text)\s+text\b/iu);
  assert.match(sql, /revoke all on public\.website_chat_open_questions from public, anon, authenticated/u);
  assert.match(sql, /revoke all on public\.website_chat_open_question_audit_events from public, anon, authenticated/u);
  assert.match(sql, /revoke update, delete on public\.website_chat_open_questions from service_role/u);
  assert.match(sql, /revoke insert, update, delete on public\.website_chat_open_question_audit_events from service_role/u);
  assert.match(sql, /grant select, insert on public\.website_chat_open_questions to service_role/u);
  assert.match(sql, /grant select on public\.website_chat_open_question_audit_events to service_role/u);
  assert.match(sql, /security definer[\s\S]*set search_path = pg_catalog, public, pg_temp/u);
  assert.match(sql, /has_table_privilege\('service_role', 'public\.website_chat_open_questions', 'UPDATE'\)/u);
  assert.match(sql, /has_table_privilege\('service_role', 'public\.website_chat_open_question_audit_events', 'INSERT'\)/u);
  assert.match(sql, /revoke all on function public\.update_website_chat_open_question_status[\s\S]*from public, anon, authenticated, service_role/u);
  assert.match(sql, /grant execute on function public\.update_website_chat_open_question_status[\s\S]*to service_role/u);
  assert.doesNotMatch(sql, /create\s+policy/iu);
});

test("original-message lifecycle has a target-bound rollback-only acceptance harness", async () => {
  const [sql, retention, contract, acceptance, runner] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(retentionPath, "utf8"),
    readFile(contractPath, "utf8"),
    readFile(acceptancePath, "utf8"),
    readFile(acceptanceRunnerPath, "utf8"),
  ]);
  assert.match(sql, /inbound_message_id uuid not null references public\.conversation_messages\(id\) on delete cascade/u);
  assert.match(retention, /row_number\(\) over[\s\S]*partition by conversation_id[\s\S]*where ranked\.rn > 50/u);
  assert.match(retention, /after insert on public\.conversation_messages/u);
  assert.match(contract, /keine Anonymisierung/iu);
  assert.match(contract, /BT-051/u);
  assert.match(contract, /Backup-Aufbewahrung/iu);
  assert.match(contract, /isolierte Staging-Abnahme/iu);
  assert.doesNotMatch(acceptance, /\bcommit\s*;/iu);
  assert.equal(acceptance.match(/\brollback\s*;/giu)?.length, 2);
  assert.match(acceptance, /OPEN_QUESTION_ATOMIC_AUDIT=PASS/u);
  assert.match(acceptance, /OPEN_QUESTION_DELETE_CASCADE=PASS/u);
  assert.match(acceptance, /generate_series\(1, 51\)/u);
  assert.match(acceptance, /CONVERSATION_MESSAGE_LATEST_50=PASS/u);
  assert.match(acceptance, /OPEN_QUESTION_ACCEPTANCE_ROLLBACK=PASS/u);
  assert.match(acceptance, /staging_synthetic_fixture/u);
  assert.match(acceptance, /workspace_processing_acceptance/u);
  assert.match(acceptance, /input\.audit_before \+ 1/u);
  assert.match(runner, /evaluateWebsiteChatRetentionStagingEnvironment\(environment, \{[\s\S]*mode: "acceptance",[\s\S]*allowReviewedBranch: true/u);
  assert.match(runner, /OPEN_QUESTION_RETENTION_TARGET=staging/u);
});


test("Option A retention is fail-closed, workspace-bound, and legal-hold aware", async () => {
  const sql = await readFile(optionARetentionPath, "utf8");
  assert.match(sql, /retention_control_not_configured/u);
  assert.match(sql, /control\.workspace_id = p_workspace_id/u);
  assert.match(sql, /v_now timestamptz := statement_timestamp\(\)/u);
  assert.doesNotMatch(sql, /p_as_of/u);
  assert.match(sql, /legal_hold_started_at <= v_now[\s\S]*legal_hold_released_at > v_now/u);
  assert.match(sql, /return query select 0::bigint, 0::bigint, 0::bigint/u);
  assert.match(sql, /audit\.workspace_id = p_workspace_id[\s\S]*interval '12 months'/u);
  assert.match(sql, /question\.workspace_id = p_workspace_id[\s\S]*interval '30 days'/u);
  assert.match(sql, /question\.status in \('open', 'in_review'\)[\s\S]*interval '180 days'/u);
  assert.match(sql, /retention_extended_until <= v_now/u);
  assert.match(sql, /message\.workspace_id = p_workspace_id[\s\S]*interval '24 months'/u);
  assert.match(sql, /contract_ended_at <= v_now - interval '30 days'/u);
  assert.match(sql, /deletion_instructed_at <= v_now - interval '30 days'/u);
  assert.match(sql, /revoke all on public\.website_chat_retention_controls from public, anon, authenticated, service_role/u);
  assert.match(sql, /security definer[\s\S]*set search_path = pg_catalog, public, pg_temp/u);
  assert.doesNotMatch(sql, /\b(?:content|message_text|question_text)\s+text\b/iu);
});

test("Option A acceptance covers exact boundaries, isolation, no-op repetition, and rollback", async () => {
  const [acceptance, runner, readiness, wrapper] = await Promise.all([
    readFile(acceptancePath, "utf8"),
    readFile(acceptanceRunnerPath, "utf8"),
    readFile(readinessPath, "utf8"),
    readFile(optionARetentionWrapperPath, "utf8"),
  ]);
  assert.match(acceptance, /website_chat_open_questions_option_a_retention_body\.sql/u);
  assert.match(acceptance, /option_a_schema_baseline_not_absent/u);
  assert.match(acceptance, /option_a_schema_rollback_failed/u);
  assert.match(wrapper, /begin;[\s\S]*\\ir website_chat_open_questions_option_a_retention_body\.sql[\s\S]*commit;/u);
  assert.doesNotMatch(wrapper, /retention_acceptance_mode/u);
  assert.match(acceptance, /interval '180 days'/u);
  assert.match(acceptance, /interval '30 days'/u);
  assert.match(acceptance, /interval '24 months'/u);
  assert.match(acceptance, /interval '12 months'/u);
  assert.match(acceptance, /OPTION_A_DEADLINE_BOUNDARIES=PASS/u);
  assert.match(acceptance, /OPTION_A_LEGAL_HOLD=PASS/u);
  assert.match(acceptance, /OPTION_A_WORKSPACE_ISOLATION=PASS/u);
  assert.match(acceptance, /OPTION_A_IDEMPOTENCE=PASS/u);
  assert.match(acceptance, /workspace_id <> :'workspace_id'::uuid/u);
  assert.match(acceptance, /option_a_repeat_result/u);
  assert.equal(acceptance.match(/\brollback\s*;/giu)?.length, 2);
  assert.match(runner, /OPTION_A_DEADLINE_BOUNDARIES=PASS/u);
  assert.match(runner, /OPTION_A_LEGAL_HOLD=PASS/u);
  assert.match(readiness, /STAGING_EXECUTOR_READINESS: BLOCKED/u);
  assert.match(readiness, /kein Staging-Lauf gestartet/iu);
});


test("retention harness rejects fixture, snapshot, ACL, interpolation, and role-order drift", async () => {
  const source = await readFile(acceptancePath, "utf8");
  assert.doesNotThrow(() => validateOpenQuestionRetentionAcceptanceSource(source));

  const extraFixture = source.replace(
    "from public.website_chat_open_questions\n        where workspace_id = :'workspace_id'::uuid) = 1",
    "from public.website_chat_open_questions\n        where workspace_id = :'workspace_id'::uuid) = 2",
  );
  const missingMarker = source.replace(
    "test_access_flags->>'open_question_retention_acceptance' = 'true'",
    "test_access_flags->>'open_question_retention_acceptance' = 'missing'",
  );
  const snapshotDrift = source.replace("is distinct from", "is not distinct from");
  const aclDrift = source.replace(
    "'website_chat_open_question_audit_events'\n   )",
    "'website_chat_open_questions'\n   )",
  );
  const quotedPsqlVariable = source.replace(
    "if session_user <> 'postgres'\n     or input.current_status",
    "if session_user <> 'postgres'\n     or :'workspace_id'::uuid is null\n     or input.current_status",
  );
  const prematureRole = source.replace(
    "do $preflight$\ndeclare input record;",
    "set local role service_role;\ndo $preflight$\ndeclare input record;",
  );

  for (const changed of [
    extraFixture,
    missingMarker,
    snapshotDrift,
    aclDrift,
    quotedPsqlVariable,
    prematureRole,
  ]) {
    assert.notEqual(changed, source);
    assert.throws(
      () => validateOpenQuestionRetentionAcceptanceSource(changed),
      /OPEN_QUESTION_RETENTION_ACCEPTANCE_ERROR=source_contract_invalid/u,
    );
  }
});

test("readiness uses the retention-specific reviewed head pin", async () => {
  const [readiness, policy, runner] = await Promise.all([
    readFile(readinessPath, "utf8"),
    readFile(retentionStagingPolicyPath, "utf8"),
    readFile(acceptanceRunnerPath, "utf8"),
  ]);
  assert.match(policy, /environment\.FANMIND_WEBSITE_CHAT_RETENTION_REVIEWED_COMMIT/u);
  assert.match(policy, /reviewedBranchAllowed/u);
  assert.match(policy, /retention_reviewed_ref/u);
  assert.match(runner, /evaluateWebsiteChatRetentionStagingEnvironment\(environment, \{[\s\S]*mode: "acceptance",[\s\S]*allowReviewedBranch: true/u);
  assert.match(readiness, /FANMIND_WEBSITE_CHAT_RETENTION_REVIEWED_COMMIT/u);
  assert.match(readiness, /FANMIND_WEBSITE_CHAT_RETENTION_REVIEWED_REF=refs\/heads\/feat\/admin-open-questions-followup-20261103/u);
  assert.doesNotMatch(readiness, /FANMIND_WEBSITE_CHAT_REVIEWED_COMMIT/u);
  assert.doesNotMatch(readiness, /^GITHUB_REF=refs\/heads\/main$/mu);
  assert.match(readiness, /GITHUB_REF=refs\/heads\/main[^\n]*fail-closed/u);
});
