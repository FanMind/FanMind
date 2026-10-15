#!/usr/bin/env node
// Source preparation only: no network client, credentials, psql or APPLY mode.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { evaluateStagingDatabaseRolloutStateEnvironment } from "../../src/lib/stagingDatabaseRolloutStatePolicy.mjs";

const REVIEWED_HEAD = "e9df302f1fd066e8396a385d875c1ff3f669f152";
const STAGING = "vshyhvgcmrlagvfnvomc";
const PRODUCTION = "drqkpdvtbbrrdwmtrodz";
const CONTROL = "docs/operations/ai-capacity-staging-preparation.json";
const QUERY = "scripts/operations/ai-capacity-staging-preflight.sql";
const RECOVERY = "docs/operations/AI_CAPACITY_STAGING_RECOVERY.md";
const sha256 = value => createHash("sha256").update(value).digest("hex");
const fail = code => { throw new Error(`CAPACITY_PREFLIGHT_PREPARATION_ERROR=${code}`); };
const git = (root, args) => execFileSync("git", ["-C", root, ...args], {
  encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 10000,
}).trim();

export function verifyPreparation(root = process.cwd()) {
  const control = JSON.parse(readFileSync(resolve(root, CONTROL), "utf8"));
  if (control.version !== 1 || control.reviewedLifecycleHead !== REVIEWED_HEAD
    || control.targetProject !== STAGING || control.productionProject !== PRODUCTION
    || control.applyMode !== "disabled" || control.sqlPath !== QUERY
    || control.recoveryPath !== RECOVERY) fail("control_binding");
  for (const [path, hash] of Object.entries(control.sha256)) {
    if (sha256(readFileSync(resolve(root, path))) !== hash) fail("checksum");
  }
  const sourcePaths = ["supabase/controlled/ai_capacity_billing_v2.sql",
    "supabase/controlled/ai_capacity_billing_v2_activation_gates.sql",
    "supabase/controlled/ai_capacity_reserve_settle.sql"];
  for (const path of [...sourcePaths, QUERY, RECOVERY,
    "scripts/operations/ai-capacity-staging-preflight-preparation.mjs",
    "src/lib/stagingDatabaseRolloutStatePolicy.mjs", "src/lib/metaContentStagingMigrationPolicy.mjs",
    "src/lib/environmentBoundaryPolicy.mjs", "config/certificates/supabase-root-2021-ca.crt"]) {
    if (!/^[0-9a-f]{64}$/u.test(control.sha256[path] ?? "")) fail("required_checksum");
  }
  for (const path of sourcePaths) {
    const reviewed = execFileSync("git", ["-C", root, "show", `${REVIEWED_HEAD}:${path}`]);
    if (sha256(reviewed) !== control.sha256[path]) fail("reviewed_source");
  }
  git(root, ["merge-base", "--is-ancestor", REVIEWED_HEAD, "HEAD"]);
  if (!/^[0-9a-f]{32}$/u.test(control.expectedObservation.schema_md5)) fail("reference_profile");
  return control;
}

export function evaluatePreparationEnvironment(environment, head, main) {
  const inherited = evaluateStagingDatabaseRolloutStateEnvironment(environment);
  const errors = [...inherited.errors];
  if (!/^[0-9a-f]{40}$/u.test(head) || head !== main || head !== environment.GITHUB_SHA
    || head !== environment.FANMIND_STAGING_DATABASE_ROLLOUT_REVIEWED_COMMIT) errors.push("current_main");
  if (environment.FANMIND_TARGET_SUPABASE_PROJECT_REF !== STAGING
    || environment.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF !== PRODUCTION) errors.push("exact_project");
  if (environment.FANMIND_CAPACITY_PREFLIGHT_CONFIRM !== "prepare-readonly-capacity-preflight") errors.push("capacity_confirmation");
  return {ok: errors.length === 0, errors: [...new Set(errors)]};
}

export function evaluateObservation(observation, control) {
  const expected = control.expectedObservation;
  const failures = Object.keys(expected).filter(key =>
    JSON.stringify(observation?.[key]) !== JSON.stringify(expected[key]));
  const policy = observation?.policy;
  for (const [key, value] of Object.entries(control.expectedPolicy)) {
    if (policy?.[key] !== value) failures.push(`policy_${key}`);
  }
  return {state: failures.length ? "BLOCK" : "READONLY_BASELINE_MATCH",
    apply: "disabled", failures};
}

export function emitReadOnlySql(root, environment) {
  const control = verifyPreparation(root);
  const head = git(root, ["rev-parse", "HEAD"]);
  const main = git(root, ["rev-parse", "refs/remotes/origin/main"]);
  const boundary = evaluatePreparationEnvironment(environment, head, main);
  if (!boundary.ok) fail("environment_binding");
  if (git(root, ["status", "--porcelain", "--untracked-files=normal"])) fail("dirty_checkout");
  // These are request labels, NOT a server-side proof of target identity/TLS.
  // Protected workflow/transport must independently establish that binding.
  const labels = `'requested_main_commit','${head}',
  'requested_target_project','${STAGING}',
  'reviewed_lifecycle_commit','${REVIEWED_HEAD}',
  'recovery_sha256','${control.sha256[RECOVERY]}',
  'version',1,`;
  return readFileSync(resolve(root, QUERY), "utf8").replace("'version',1,", labels);
}

function main() {
  if (process.argv.length !== 3) fail("mode");
  const mode = process.argv[2];
  if (mode === "--check") {
    verifyPreparation();
    console.log("CAPACITY_PREFLIGHT_PREPARATION=SOURCE_CHECKED");
    console.log("CAPACITY_TARGET_EXECUTION=NOT_PERFORMED");
    console.log("CAPACITY_APPLY=disabled");
  } else if (mode === "--emit-readonly-sql") {
    process.stdout.write(emitReadOnlySql(process.cwd(), process.env));
  } else fail("mode");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); } catch (error) {
    console.error(/^CAPACITY_PREFLIGHT_PREPARATION_ERROR=[a-z_]+$/u.test(error.message)
      ? error.message : "CAPACITY_PREFLIGHT_PREPARATION_ERROR=invalid_source_or_input");
    process.exitCode = 1;
  }
}
