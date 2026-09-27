import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildAtomicCreatorTransitionSql,
  buildTrustedCreatorTransitionReference,
  CREATOR_TARGET_TRANSITION_REFERENCE,
  evaluateCreatorTargetEnvironment,
} from "../scripts/operations/creator-foundation-transition-staging-runner.mjs";

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
  PGSSLMODE: "verify-full",
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
