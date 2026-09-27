#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { buildCreatorFoundationCatalogSql } from "./creator-foundation-reconciliation-catalog.mjs";
import {
  buildCreatorFoundationReference,
  classifyCreatorFoundationSnapshot,
} from "./creator-foundation-reconciliation-preflight.mjs";
import { creatorFoundationHostedPg17RoleProfile } from "./creator-foundation-reconciliation-provider.mjs";
import {
  buildCreatorFoundationTransitionSource,
  CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS,
  CREATOR_FOUNDATION_TRANSITION_QUERY_SHA256,
} from "./creator-foundation-transition-generator.mjs";

const TABLES = Object.freeze([
  "creators",
  "creator_voice_profiles",
  "creator_sales_playbooks",
  "creator_commercial_events",
]);
const EXPECTED_PROJECT = "vshyhvgcmrlagvfnvomc";
const EXPECTED_PRODUCTION_PROJECT = "drqkpdvtbbrrdwmtrodz";
const EXPECTED_REFERENCE_ARTIFACT = 10916053961;
const EXPECTED_REFERENCE_RUN = 36273161074;
const EXPECTED_REFERENCE_HEAD = "3cd67cedbcdc051be855d09de8d5ea3225179217";
const MAX_REFERENCE_BYTES = 2 * 1024 * 1024;
const sha256 = value => createHash("sha256").update(value).digest("hex");
const fail = code => { throw new Error(`CREATOR_TARGET_TRANSITION_ERROR=${code}`); };
const clean = value => typeof value === "string" ? value.trim() : "";
const normalizedHost = value => clean(value).toLowerCase().replace(/\.$/u, "");

export const CREATOR_TARGET_TRANSITION_REFERENCE = Object.freeze({
  artifactId: EXPECTED_REFERENCE_ARTIFACT,
  runId: EXPECTED_REFERENCE_RUN,
  sourceHead: EXPECTED_REFERENCE_HEAD,
  referenceSha256: CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS.referenceSha256,
});

function readJson(path) {
  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.nlink !== 1 || opened.size < 2 || opened.size > MAX_REFERENCE_BYTES) {
      fail("reference_file_invalid");
    }
    const buffer = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < buffer.length) {
      const bytesRead = readSync(descriptor, buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) fail("reference_file_invalid");
      offset += bytesRead;
    }
    const settled = fstatSync(descriptor);
    if (
      settled.dev !== opened.dev ||
      settled.ino !== opened.ino ||
      settled.size !== opened.size ||
      settled.mtimeMs !== opened.mtimeMs ||
      settled.ctimeMs !== opened.ctimeMs
    ) {
      fail("reference_file_changed");
    }
    return JSON.parse(buffer.toString("utf8"));
  } catch (error) {
    if (error instanceof Error && /^CREATOR_TARGET_TRANSITION_ERROR=/u.test(error.message)) throw error;
    if (error && typeof error === "object" && "code" in error && error.code === "ELOOP") fail("reference_file_invalid");
    fail("reference_file_invalid");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

export function buildTrustedCreatorTransitionReference(referenceDirectory) {
  const legacy = readJson(resolve(referenceDirectory, "legacy.json"));
  const current = readJson(resolve(referenceDirectory, "current.json"));
  const reference = buildCreatorFoundationReference({
    legacy,
    current,
    roleProfile: creatorFoundationHostedPg17RoleProfile(),
    querySha256: CREATOR_FOUNDATION_TRANSITION_QUERY_SHA256,
  });
  const referenceJson = JSON.stringify(reference);
  if (sha256(referenceJson) !== CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS.referenceSha256) fail("reference_contract");
  return {legacy, current, reference, referenceJson};
}

function expectedHostedCatalog(snapshot) {
  const profile = creatorFoundationHostedPg17RoleProfile();
  return {
    ...structuredClone(snapshot.catalog),
    namespaces: structuredClone(profile.providerContract.namespaces),
    authUidFunctions: structuredClone(profile.providerContract.authUidFunctions),
    roles: structuredClone(profile.roles),
    memberships: structuredClone(profile.memberships),
  };
}

function catalogQueryBody() {
  const sql = buildCreatorFoundationCatalogSql();
  const start = sql.indexOf("WITH RECURSIVE");
  const rollback = sql.lastIndexOf("ROLLBACK;");
  if (start < 0 || rollback < 0) fail("catalog_query_contract");
  return sql.slice(start, rollback).trim().replace(/;\s*$/u, "");
}

function dollarJson(value, tag) {
  const json = JSON.stringify(value);
  const marker = `$${tag}$`;
  if (json.includes(marker)) fail("reference_delimiter");
  return `${marker}${json}${marker}::jsonb`;
}

export function buildAtomicCreatorTransitionSql({legacy, current}) {
  const legacyCatalog = expectedHostedCatalog(legacy);
  const currentCatalog = expectedHostedCatalog(current);
  const query = catalogQueryBody();
  const artifact = buildCreatorFoundationTransitionSource();
  const tableList = TABLES.map(table => `public.${table}`).join(", ");
  return `BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '5s';
SET LOCAL idle_in_transaction_session_timeout = '60s';
SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fanmind_creator_foundation_transition_v1', 0));
LOCK TABLE ${tableList} IN SHARE ROW EXCLUSIVE MODE;
DO $fm_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.creators LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.creator_voice_profiles LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.creator_sales_playbooks LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.creator_commercial_events LIMIT 1) THEN
    RAISE EXCEPTION 'CREATOR_TARGET_TRANSITION_DATA_PRESENT';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_stat_activity
    WHERE pid <> pg_catalog.pg_backend_pid()
      AND state <> 'idle'
      AND query ~* '(save_creator_bundle|record_creator_fan_review|creator_workspace_access_allowed)'
  ) THEN
    RAISE EXCEPTION 'CREATOR_TARGET_TRANSITION_RPC_ACTIVE';
  END IF;
END
$fm_guard$;
DO $fm_legacy$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM (${query}) AS snapshot
    WHERE snapshot.jsonb_build_object->'catalog' = ${dollarJson(legacyCatalog, "fm_legacy_catalog")}
  ) THEN
    RAISE EXCEPTION 'CREATOR_TARGET_TRANSITION_PRECONDITION_DRIFT';
  END IF;
END
$fm_legacy$;
${artifact.sql}
DO $fm_current$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM (${query}) AS snapshot
    WHERE snapshot.jsonb_build_object->'catalog' = ${dollarJson(currentCatalog, "fm_current_catalog")}
  ) THEN
    RAISE EXCEPTION 'CREATOR_TARGET_TRANSITION_POSTFLIGHT_DRIFT';
  END IF;
END
$fm_current$;
COMMIT;
SELECT 'CREATOR_TARGET_TRANSITION_APPLY=COMMITTED';
SELECT 'CREATOR_TARGET_TRANSITION_POSTFLIGHT=CURRENT_EXACT';
`;
}

function creatorTargetGuardBody() {
  return `IF EXISTS (SELECT 1 FROM public.creators LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.creator_voice_profiles LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.creator_sales_playbooks LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.creator_commercial_events LIMIT 1) THEN
    RAISE EXCEPTION 'CREATOR_TARGET_TRANSITION_DATA_PRESENT';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_stat_activity
    WHERE pid <> pg_catalog.pg_backend_pid()
      AND state <> 'idle'
      AND query ~* '(save_creator_bundle|record_creator_fan_review|creator_workspace_access_allowed)'
  ) THEN
    RAISE EXCEPTION 'CREATOR_TARGET_TRANSITION_RPC_ACTIVE';
  END IF;`;
}

export function buildCreatorTargetSafetySql() {
  const tableList = TABLES.map(table => `public.${table}`).join(", ");
  return `BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '5s';
LOCK TABLE ${tableList} IN SHARE ROW EXCLUSIVE MODE;
DO $fm_guard$
BEGIN
  ${creatorTargetGuardBody()}
END
$fm_guard$;
COMMIT;
SELECT 'CREATOR_TARGET_TRANSITION_SAFETY=PASS';
`;
}

export function buildCreatorRpcAdmissionGateSql() {
  return `BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '60s';
SELECT pg_catalog.pg_advisory_lock(pg_catalog.hashtextextended('fanmind_creator_foundation_transition_v1', 0));
REVOKE EXECUTE ON FUNCTION public.save_creator_bundle(uuid,uuid,integer,jsonb,jsonb,jsonb,boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.record_creator_fan_review(uuid,uuid,jsonb,jsonb) FROM authenticated;
COMMIT;
DO $fm_drain$
DECLARE
  deadline timestamptz := pg_catalog.clock_timestamp() + interval '30 seconds';
BEGIN
  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM pg_catalog.pg_stat_activity
      WHERE pid <> pg_catalog.pg_backend_pid()
        AND state <> 'idle'
        AND query ~* '(save_creator_bundle|record_creator_fan_review)'
    );
    IF pg_catalog.clock_timestamp() >= deadline THEN
      RAISE EXCEPTION 'CREATOR_TARGET_TRANSITION_RPC_DRAIN_TIMEOUT';
    END IF;
    PERFORM pg_catalog.pg_sleep(0.1);
  END LOOP;
END
$fm_drain$;
SELECT 'CREATOR_TARGET_TRANSITION_ADMISSION=CLOSED';
`;
}

export function buildCreatorRpcAdmissionRestoreSql() {
  return `BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '60s';
SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fanmind_creator_foundation_transition_v1', 0));
GRANT EXECUTE ON FUNCTION public.save_creator_bundle(uuid,uuid,integer,jsonb,jsonb,jsonb,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_creator_fan_review(uuid,uuid,jsonb,jsonb) TO authenticated;
COMMIT;
SELECT 'CREATOR_TARGET_TRANSITION_ADMISSION=OPEN';
`;
}

export function evaluateCreatorTargetEnvironment(environment, {mode}) {
  const apply = mode === "apply";
  const target = clean(environment.FANMIND_TARGET_SUPABASE_PROJECT_REF);
  const production = clean(environment.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF);
  const reviewed = clean(environment.FANMIND_CREATOR_TRANSITION_REVIEWED_COMMIT);
  const pgHost = normalizedHost(environment.PGHOST);
  const targetDbHost = normalizedHost(environment.FANMIND_TARGET_DB_HOST);
  const productionDbHost = normalizedHost(environment.FANMIND_PRODUCTION_DB_HOST);
  const directTargetHost = `db.${target}.supabase.co`;
  const expectedPgUser = pgHost === directTargetHost ? "postgres" : `postgres.${target}`;
  const hiddenLibpqOverride = [
    "DATABASE_URL",
    "POSTGRES_URL",
    "SUPABASE_DB_URL",
    "PGHOSTADDR",
    "PGPASSWORD",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR",
  ].some(name => clean(environment[name]).length > 0);
  const ok =
    environment.GITHUB_REF === "refs/heads/main" &&
    /^[0-9a-f]{40}$/u.test(environment.GITHUB_SHA ?? "") &&
    reviewed === environment.GITHUB_SHA &&
    environment.FANMIND_RUNTIME_ENVIRONMENT === "staging" &&
    environment.NEXT_PUBLIC_APP_URL === "https://staging.fanmind.ch" &&
    environment.FANMIND_PRODUCTION_API_ORIGIN === "https://fanmind.ch" &&
    target === EXPECTED_PROJECT &&
    production === EXPECTED_PRODUCTION_PROJECT &&
    target !== production &&
    pgHost.length > 0 &&
    pgHost === targetDbHost &&
    pgHost !== productionDbHost &&
    productionDbHost === `db.${production}.supabase.co` &&
    (pgHost === directTargetHost || /(?:^|\.)pooler\.supabase\.com$/u.test(pgHost)) &&
    clean(environment.PGPORT) === "5432" &&
    clean(environment.PGDATABASE) === "postgres" &&
    clean(environment.PGUSER) === expectedPgUser &&
    environment.PGSSLMODE === "verify-full" &&
    isAbsolute(clean(environment.PGSSLROOTCERT)) &&
    clean(environment.PGPASSFILE).length > 0 &&
    !hiddenLibpqOverride &&
    (!apply || (
      environment.FANMIND_ENABLE_NON_PRODUCTION_WRITES === "true" &&
      environment.FANMIND_NON_PRODUCTION_WRITE_ACK === "I_UNDERSTAND_NON_PRODUCTION_ONLY" &&
      environment.FANMIND_CREATOR_TRANSITION_CONFIRM === "apply-creator-foundation-transition"
    ));
  return {ok, target, production, reviewed};
}

function psqlEnvironment(environment) {
  const safe = Object.fromEntries([
    "PATH","LANG","LC_ALL","PGHOST","PGPORT","PGDATABASE","PGUSER","PGSSLMODE","PGSSLROOTCERT","PGPASSFILE",
  ].filter(key => typeof environment[key] === "string").map(key => [key, environment[key]]));
  safe.PGCONNECT_TIMEOUT = "10";
  safe.PGOPTIONS = "-c statement_timeout=60000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=60000";
  return safe;
}

export function requireCreatorTransitionPsqlSuccess(result, failureCode = "psql_failed") {
  if (result.error || result.status !== 0) fail(failureCode);
  return clean(result.stdout);
}

function runPsql(sql, environment, failureCode = "psql_failed") {
  const result = spawnSync("psql", [
    "--no-password","--no-psqlrc","--quiet","--tuples-only","--no-align","--set=ON_ERROR_STOP=1",
  ], {
    env: psqlEnvironment(environment),
    input: sql,
    encoding: "utf8",
    timeout: 180000,
    maxBuffer: 4 * 1024 * 1024,
    stdio: ["pipe","pipe","pipe"],
  });
  return requireCreatorTransitionPsqlSuccess(result, failureCode);
}

function withCreatorRpcAdmissionClosed(environment, operation) {
  const gated = runPsql(buildCreatorRpcAdmissionGateSql(), environment, "admission_gate_failed");
  if (!gated.includes("CREATOR_TARGET_TRANSITION_ADMISSION=CLOSED")) fail("admission_gate_failed");
  let operationResult;
  let operationError;
  try {
    operationResult = operation();
  } catch (error) {
    operationError = error;
  }
  const restored = runPsql(
    buildCreatorRpcAdmissionRestoreSql(),
    environment,
    "admission_restore_failed",
  );
  if (!restored.includes("CREATOR_TARGET_TRANSITION_ADMISSION=OPEN")) fail("admission_restore_failed");
  if (operationError) throw operationError;
  return operationResult;
}

export function classifyCreatorTargetSnapshot(snapshot, referenceJson) {
  return classifyCreatorFoundationSnapshot(snapshot, {
    referenceJson,
    trustedReferenceSha256: CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS.referenceSha256,
    expectedQuerySha256: CREATOR_FOUNDATION_TRANSITION_QUERY_SHA256,
  });
}

function verifyTarget(environment, trusted) {
  const output = runPsql(buildCreatorFoundationCatalogSql(), environment);
  let snapshot;
  try { snapshot = JSON.parse(output); } catch { fail("snapshot_invalid"); }
  const classification = classifyCreatorTargetSnapshot(snapshot, trusted.referenceJson);
  return {snapshot, classification};
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  const mode = args[0] ?? "--check";
  const referenceDirectory = clean(environment.FANMIND_CREATOR_TRANSITION_REFERENCE_DIR);
  if (mode === "--check") {
    buildCreatorFoundationTransitionSource();
    return {
      exitCode: 0,
      output: `CREATOR_TARGET_TRANSITION_SOURCE=VERIFIED\nCREATOR_TARGET_TRANSITION_REFERENCE_ARTIFACT=${EXPECTED_REFERENCE_ARTIFACT}\nCREATOR_TARGET_TRANSITION_TRANSPORT=PROTECTED_STAGING_ONLY`,
    };
  }
  if (mode === "--restore-admission") {
    if (!evaluateCreatorTargetEnvironment(environment, {mode: "apply"}).ok) fail("environment_invalid");
    const restored = runPsql(
      buildCreatorRpcAdmissionRestoreSql(),
      environment,
      "admission_restore_failed",
    );
    if (!restored.includes("CREATOR_TARGET_TRANSITION_ADMISSION=OPEN")) fail("admission_restore_failed");
    return {exitCode: 0, output: "CREATOR_TARGET_TRANSITION_ADMISSION=OPEN"};
  }
  if (!["--verify","--apply"].includes(mode) || !referenceDirectory) fail("mode_invalid");
  const requested = mode.slice(2);
  if (!evaluateCreatorTargetEnvironment(environment, {mode: requested}).ok) fail("environment_invalid");
  const trusted = buildTrustedCreatorTransitionReference(referenceDirectory);
  const before = verifyTarget(environment, trusted);
  if (mode === "--verify") {
    return {exitCode: before.classification.status.endsWith("_EXACT") ? 0 : 2,
      output: `CREATOR_TARGET_TRANSITION_STATE=${before.classification.status}\nCREATOR_TARGET_TRANSITION_APPLY=not_requested\nCREATOR_TARGET_TRANSITION_RUNTIME_ACTIVATED=false`};
  }
  if (before.classification.status === "CURRENT_EXACT") {
    const safety = withCreatorRpcAdmissionClosed(
      environment,
      () => runPsql(buildCreatorTargetSafetySql(), environment, "target_safety_failed"),
    );
    if (!safety.includes("CREATOR_TARGET_TRANSITION_SAFETY=PASS")) fail("target_safety_failed");
    return {exitCode: 0, output: "CREATOR_TARGET_TRANSITION_STATE=CURRENT_EXACT\nCREATOR_TARGET_TRANSITION_APPLY=not_requested\nCREATOR_TARGET_TRANSITION_POSTFLIGHT=CURRENT_EXACT"};
  }
  if (before.classification.status !== "LEGACY_EXACT") fail("precondition_not_legacy_exact");
  const applied = withCreatorRpcAdmissionClosed(
    environment,
    () => runPsql(
      buildAtomicCreatorTransitionSql(trusted),
      environment,
      "apply_indeterminate_verify_before_retry",
    ),
  );
  if (!applied.includes("CREATOR_TARGET_TRANSITION_APPLY=COMMITTED") ||
      !applied.includes("CREATOR_TARGET_TRANSITION_POSTFLIGHT=CURRENT_EXACT")) fail("apply_indeterminate_verify_before_retry");
  const after = verifyTarget(environment, trusted);
  if (after.classification.status !== "CURRENT_EXACT") fail("postflight_failed");
  return {exitCode: 0, output: "CREATOR_TARGET_TRANSITION_STATE=CURRENT_EXACT\nCREATOR_TARGET_TRANSITION_APPLY=committed\nCREATOR_TARGET_TRANSITION_POSTFLIGHT=CURRENT_EXACT"};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(({output, exitCode}) => {
    console.log(output); process.exitCode = exitCode;
  }).catch(error => {
    const message = error instanceof Error && /^CREATOR_TARGET_TRANSITION_ERROR=[a-z_]+$/u.test(error.message)
      ? error.message : "CREATOR_TARGET_TRANSITION_ERROR=operation_failed";
    console.error(message); process.exitCode = 1;
  });
}
