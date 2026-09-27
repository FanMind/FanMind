#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ENV_FILE = "/var/www/fanmind-staging/.env.production";
const SECRET_FILE = "/etc/fanmind-staging/runtime-secrets.env";
const RELEASE_FILE = "/var/www/fanmind-staging/.release.env";
const FLAG = "FANMIND_CREATOR_INTELLIGENCE_ENABLED";
const EXPECTED_PROJECT = "vshyhvgcmrlagvfnvomc";
const EXPECTED_PRODUCTION_PROJECT = "drqkpdvtbbrrdwmtrodz";
const fail = code => { throw new Error(`CREATOR_RUNTIME_STAGING_ERROR=${code}`); };

function privateFile(path, expectedMode) {
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || (stat.mode & 0o777) !== expectedMode || stat.size > 1024 * 1024) fail("private_file_invalid");
    return readFileSync(descriptor, "utf8");
  } finally { closeSync(descriptor); }
}

function replacePrivate(path, contents) {
  const temporary = `${path}.creator-${randomBytes(8).toString("hex")}`;
  try {
    writeFileSync(temporary, contents, {mode: 0o600, flag: "wx"});
    renameSync(temporary, path);
  } finally {
    try { unlinkSync(temporary); } catch {}
  }
}

export function renderCreatorRuntime(original, enabled) {
  const retained = original.split(/\r?\n/u).filter(line =>
    !new RegExp(`^\\s*(?:export\\s+)?${FLAG}=`, "u").test(line));
  return `${retained.join("\n").replace(/\n*$/u, "")}\n${FLAG}='${enabled ? "true" : "false"}'\n`;
}

export function evaluateCreatorRuntimeEnvironment(environment) {
  const target = environment.FANMIND_TARGET_SUPABASE_PROJECT_REF?.trim() ?? "";
  const production = environment.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF?.trim() ?? "";
  return {
    ok:
      environment.GITHUB_REF === "refs/heads/main" &&
      /^[0-9a-f]{40}$/u.test(environment.GITHUB_SHA ?? "") &&
      environment.FANMIND_CREATOR_RUNTIME_REVIEWED_COMMIT === environment.GITHUB_SHA &&
      environment.FANMIND_CREATOR_RUNTIME_CONFIRM === "enable-creator-intelligence-staging" &&
      environment.FANMIND_RUNTIME_ENVIRONMENT === "staging" &&
      environment.NEXT_PUBLIC_APP_URL === "https://staging.fanmind.ch" &&
      target === EXPECTED_PROJECT &&
      production === EXPECTED_PRODUCTION_PROJECT &&
      target !== production,
    target,
    production,
  };
}

function overrideValue(contents) {
  const match = contents.match(/^\s*(?:export\s+)?FANMIND_CREATOR_INTELLIGENCE_ENABLED\s*=\s*['"]?([^'"\s]+)['"]?\s*$/mu);
  return match?.[1] ?? null;
}

export function requireCreatorRuntimeDisabled(contents) {
  const value = overrideValue(contents);
  if (value === "true") fail("flag_already_enabled_reconciliation_required");
  if (value !== null && value !== "false") fail("flag_state_invalid");
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  const [mode, backupArg] = args;
  if (!["enable","restore"].includes(mode) || !backupArg) fail("mode_invalid");
  const backup = resolve(backupArg);
  if (backup !== join(resolve(environment.RUNNER_TEMP ?? ""), "fanmind-creator-runtime.backup")) fail("execution_boundary");
  if (!evaluateCreatorRuntimeEnvironment(environment).ok) fail("environment_invalid");

  const envOriginal = privateFile(ENV_FILE, 0o600);
  const secret = readFileSync(SECRET_FILE, "utf8");
  const release = privateFile(RELEASE_FILE, 0o600);
  for (const [name, contents] of [["runtime_secret", secret], ["release", release]]) {
    const value = overrideValue(contents);
    if (value !== null && value !== "true") fail(`${name}_override`);
  }

  if (mode === "restore") {
    const original = privateFile(backup, 0o600);
    replacePrivate(ENV_FILE, original);
    return {output: "CREATOR_RUNTIME_STAGING_RESTORED=PASS", exitCode: 0};
  }

  requireCreatorRuntimeDisabled(envOriginal);
  writeFileSync(backup, envOriginal, {mode: 0o600, flag: "wx"});
  replacePrivate(ENV_FILE, renderCreatorRuntime(envOriginal, true));
  if (overrideValue(privateFile(ENV_FILE, 0o600)) !== "true") fail("write_postflight");
  return {output: "CREATOR_RUNTIME_STAGING_FLAG=enabled", exitCode: 0};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then(({output, exitCode}) => {
    console.log(output); process.exitCode = exitCode;
  }).catch(error => {
    const message = error instanceof Error && /^CREATOR_RUNTIME_STAGING_ERROR=[a-z_]+$/u.test(error.message)
      ? error.message : "CREATOR_RUNTIME_STAGING_ERROR=operation_failed";
    console.error(message); process.exitCode = 1;
  });
}
