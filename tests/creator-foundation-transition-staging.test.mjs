import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildAtomicCreatorTransitionSql,
  buildCreatorRpcAdmissionGateSql,
  buildCreatorRpcAdmissionRestoreSql,
  buildCreatorTargetSafetySql,
  buildTrustedCreatorTransitionReference,
  CREATOR_TARGET_TRANSITION_REFERENCE,
  evaluateCreatorTargetEnvironment,
} from "../scripts/operations/creator-foundation-transition-staging-runner.mjs";
import * as creatorTransitionRunner from "../scripts/operations/creator-foundation-transition-staging-runner.mjs";

const baseEnvironment = {
  GITHUB_REF: "refs/heads/main",
  GITHUB_SHA: "a".repeat(40),
  FANMIND_CREATOR_TRANSITION_REVIEWED_COMMIT: "a".repeat(40),
  FANMIND_RUNTIME_ENVIRONMENT: "staging",
  NEXT_PUBLIC_APP_URL: "https://staging.fanmind.ch",
  FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
  FANMIND_TARGET_SUPABASE_PROJECT_REF: "vshyhvgcmrlagvfnvomc",
  FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "drqkpdvtbbrrdwmtrodz",
  FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
  FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
  FANMIND_CREATOR_TRANSITION_CONFIRM: "apply-creator-foundation-transition",
  FANMIND_TARGET_DB_HOST: "aws-0-eu-west-3.pooler.supabase.com",
  FANMIND_PRODUCTION_DB_HOST: "db.drqkpdvtbbrrdwmtrodz.supabase.co",
  PGHOST: "aws-0-eu-west-3.pooler.supabase.com",
  PGPORT: "5432",
  PGDATABASE: "postgres",
  PGUSER: "postgres.vshyhvgcmrlagvfnvomc",
  PGSSLMODE: "verify-full",
  PGSSLROOTCERT: "/tmp/supabase-root.crt",
  PGPASSFILE: "/tmp/private.pgpass",
};

test("Creator target transition is bound to the accepted private reference", () => {
  assert.deepEqual(CREATOR_TARGET_TRANSITION_REFERENCE, {
    artifactId: 10916053961,
    runId: 36273161074,
    sourceHead: "3cd67cedbcdc051be855d09de8d5ea3225179217",
    referenceSha256: "0543eacab3872c71ec289100d62204fb2fd1660be242b14ae55bf007701b456c",
  });
});

test("Creator target transition rejects a symlinked private reference", () => {
  const directory = mkdtempSync(join(tmpdir(), "fanmind-creator-reference-"));
  const sourceDirectory = join(directory, "source");
  const referenceDirectory = join(directory, "reference");
  mkdirSync(sourceDirectory);
  mkdirSync(referenceDirectory);
  writeFileSync(join(sourceDirectory, "legacy.json"), "{}", {mode: 0o600});
  writeFileSync(join(referenceDirectory, "current.json"), "{}", {mode: 0o600});
  symlinkSync(join(sourceDirectory, "legacy.json"), join(referenceDirectory, "legacy.json"));

  try {
    assert.throws(
      () => buildTrustedCreatorTransitionReference(referenceDirectory),
      /CREATOR_TARGET_TRANSITION_ERROR=reference_file_invalid/u,
    );
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test("Creator target environment rejects Production, stale heads and missing write gates", () => {
  assert.equal(evaluateCreatorTargetEnvironment(baseEnvironment, {mode: "apply"}).ok, true);
  assert.equal(evaluateCreatorTargetEnvironment({...baseEnvironment, FANMIND_TARGET_SUPABASE_PROJECT_REF: "drqkpdvtbbrrdwmtrodz"}, {mode: "apply"}).ok, false);
  assert.equal(evaluateCreatorTargetEnvironment({...baseEnvironment, FANMIND_CREATOR_TRANSITION_REVIEWED_COMMIT: "b".repeat(40)}, {mode: "apply"}).ok, false);
  assert.equal(evaluateCreatorTargetEnvironment({...baseEnvironment, FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false"}, {mode: "apply"}).ok, false);
  assert.equal(evaluateCreatorTargetEnvironment({...baseEnvironment, PGSSLMODE: "require"}, {mode: "apply"}).ok, false);
  assert.equal(evaluateCreatorTargetEnvironment({...baseEnvironment, FANMIND_CREATOR_TRANSITION_CONFIRM: "verify-creator-foundation-transition"}, {mode: "apply"}).ok, false);
  assert.equal(evaluateCreatorTargetEnvironment({...baseEnvironment, FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false"}, {mode: "verify"}).ok, true);
});

test("Creator target transition binds the actual PostgreSQL connection to Staging", () => {
  assert.equal(evaluateCreatorTargetEnvironment(baseEnvironment, {mode: "apply"}).ok, true);
  for (const override of [
    {PGHOST: "db.other-project.supabase.co"},
    {FANMIND_TARGET_DB_HOST: "db.other-project.supabase.co"},
    {PGHOST: baseEnvironment.FANMIND_PRODUCTION_DB_HOST},
    {PGDATABASE: "other"},
    {PGUSER: "postgres.other-project"},
    {PGHOSTADDR: "203.0.113.8"},
    {PGSERVICE: "unsafe"},
  ]) {
    assert.equal(evaluateCreatorTargetEnvironment({...baseEnvironment, ...override}, {mode: "apply"}).ok, false);
  }
});

test("Creator target transition classifies every failed APPLY response as indeterminate", () => {
  assert.equal(typeof creatorTransitionRunner.requireCreatorTransitionPsqlSuccess, "function");
  assert.throws(
    () => creatorTransitionRunner.requireCreatorTransitionPsqlSuccess(
      {error: new Error("connection lost"), status: null, stdout: ""},
      "apply_indeterminate_verify_before_retry",
    ),
    /CREATOR_TARGET_TRANSITION_ERROR=apply_indeterminate_verify_before_retry/u,
  );
  assert.throws(
    () => creatorTransitionRunner.requireCreatorTransitionPsqlSuccess(
      {error: null, status: 1, stdout: ""},
      "apply_indeterminate_verify_before_retry",
    ),
    /CREATOR_TARGET_TRANSITION_ERROR=apply_indeterminate_verify_before_retry/u,
  );
});

test("Atomic Creator target SQL rechecks Legacy under lock and Current before commit", () => {
  const legacy = {catalog: {tables: [], columns: [], constraints: [], indexes: [], policies: [], triggers: [], functions: []}};
  const current = {catalog: {tables: [], columns: [], constraints: [], indexes: [], policies: [], triggers: [], functions: []}};
  const sql = buildAtomicCreatorTransitionSql({legacy, current});

  assert.match(sql, /^BEGIN;/u);
  assert.match(sql, /pg_advisory_xact_lock/u);
  assert.match(sql, /LOCK TABLE public\.creators, public\.creator_voice_profiles, public\.creator_sales_playbooks, public\.creator_commercial_events IN SHARE ROW EXCLUSIVE MODE/u);
  assert.match(sql, /CREATOR_TARGET_TRANSITION_DATA_PRESENT/u);
  assert.match(sql, /CREATOR_TARGET_TRANSITION_RPC_ACTIVE/u);
  assert.match(sql, /CREATOR_TARGET_TRANSITION_PRECONDITION_DRIFT/u);
  assert.match(sql, /create or replace function public\.creator_workspace_access_allowed\([^)]*uuid[^)]*\)/iu);
  assert.match(sql, /alter policy creators_member_read on public\.creators/iu);
  assert.match(sql, /CREATOR_TARGET_TRANSITION_POSTFLIGHT_DRIFT/u);
  assert.match(sql, /COMMIT;/u);
  assert.match(sql, /CREATOR_TARGET_TRANSITION_APPLY=COMMITTED/u);
  assert.doesNotMatch(sql, /(?:^|\n)(?:drop table|truncate table|delete from public\.creators)/iu);

  const preconditionIndex = sql.indexOf("CREATOR_TARGET_TRANSITION_PRECONDITION_DRIFT");
  const helperIndex = sql.toLowerCase().indexOf("create or replace function public.creator_workspace_access_allowed");
  const postflightIndex = sql.indexOf("CREATOR_TARGET_TRANSITION_POSTFLIGHT_DRIFT");
  const commitIndex = sql.indexOf("COMMIT;");
  assert.ok(preconditionIndex < helperIndex);
  assert.ok(helperIndex < postflightIndex);
  assert.ok(postflightIndex < commitIndex);
});

test("Creator target safety is enforced even when Current is already exact", () => {
  const sql = buildCreatorTargetSafetySql();
  assert.match(sql, /LOCK TABLE public\.creators, public\.creator_voice_profiles, public\.creator_sales_playbooks, public\.creator_commercial_events IN SHARE ROW EXCLUSIVE MODE/u);
  assert.match(sql, /CREATOR_TARGET_TRANSITION_DATA_PRESENT/u);
  assert.match(sql, /CREATOR_TARGET_TRANSITION_RPC_ACTIVE/u);
  assert.match(sql, /CREATOR_TARGET_TRANSITION_SAFETY=PASS/u);
  assert.doesNotMatch(sql, /(?:insert|update|delete|truncate|alter|grant|revoke)\s/iu);
});

test("Creator RPC admission is closed before drain and restored explicitly", () => {
  const gate = buildCreatorRpcAdmissionGateSql();
  const restore = buildCreatorRpcAdmissionRestoreSql();
  assert.match(gate, /pg_advisory_lock/u);
  assert.match(gate, /revoke execute on function public\.save_creator_bundle\(uuid,uuid,integer,jsonb,jsonb,jsonb,boolean\) from authenticated/iu);
  assert.match(gate, /revoke execute on function public\.record_creator_fan_review\(uuid,uuid,jsonb,jsonb\) from authenticated/iu);
  assert.match(gate, /pg_stat_activity[\s\S]*pg_sleep/iu);
  assert.match(gate, /CREATOR_TARGET_TRANSITION_ADMISSION=CLOSED/u);
  assert.match(restore, /grant execute on function public\.save_creator_bundle\(uuid,uuid,integer,jsonb,jsonb,jsonb,boolean\) to authenticated/iu);
  assert.match(restore, /grant execute on function public\.record_creator_fan_review\(uuid,uuid,jsonb,jsonb\) to authenticated/iu);
  assert.match(restore, /CREATOR_TARGET_TRANSITION_ADMISSION=OPEN/u);
});
