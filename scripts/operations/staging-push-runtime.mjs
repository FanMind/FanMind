import { randomBytes } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import mobileConfig from "../../apps/mobile/app.config.js";
import { buildSupabaseApiKeyHeaders } from "../../src/lib/supabase/apiKeyPolicy.mjs";

const ENV_FILE = "/var/www/fanmind-staging/.env.production";
const OVERRIDES = ["/etc/fanmind-staging/runtime-secrets.env", "/var/www/fanmind-staging/.release.env"];
const KEY = "FANMIND_PUSH_TOKEN_ENCRYPTION_KEY";
const PROJECT = "FANMIND_MOBILE_PUSH_EAS_PROJECT_ID";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const fail = code => { throw new Error(code); };

export function planPushRuntime(environment, hasRegistrations, generate = () => randomBytes(32).toString("hex")) {
  const expected = environment.FANMIND_PUSH_RUNTIME_EXPECTED_EAS_PROJECT;
  if (!UUID.test(expected ?? "") || expected !== mobileConfig.RUNTIME_EAS_PROJECT_ID) fail("project_configuration");
  const project = environment[PROJECT]?.trim() ?? "";
  if (project && project !== "replace_with_approved_eas_project_uuid" && project !== expected) fail("project_mismatch");
  const key = environment[KEY]?.trim() ?? "";
  const valid = /^[a-f0-9]{64}$/iu.test(key) || (/^[A-Za-z0-9+/]+={0,2}$/u.test(key) && Buffer.from(key, "base64").length === 32);
  if (!valid && hasRegistrations) fail("key_recovery_required");
  if (!valid && key && key !== "replace_with_dedicated_32_byte_base64_or_hex_key") fail("key_configuration");
  return { key: valid ? key : generate(), project: expected, generated: !valid };
}

export function renderPushRuntime(original, plan) {
  const retained = original.split(/\r?\n/u).filter(line => !/^\s*(?:export\s+)?FANMIND_(?:PUSH_TOKEN_ENCRYPTION_KEY|MOBILE_PUSH_EAS_PROJECT_ID)=/u.test(line));
  return `${retained.join("\n").replace(/\n*$/u, "")}\n${KEY}='${plan.key}'\n${PROJECT}='${plan.project}'\n`;
}

function privateFile(path) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o600 || stat.uid !== process.getuid() || stat.size > 1024 * 1024) fail("private_file_invalid");
  return readFileSync(path, "utf8");
}
function replacePrivate(path, contents) {
  const temporary = `${path}.push-${randomBytes(8).toString("hex")}`;
  try { writeFileSync(temporary, contents, { mode: 0o600, flag: "wx" }); renameSync(temporary, path); }
  finally { try { unlinkSync(temporary); } catch {} }
}
async function json(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  if (!response.ok || text.length > 8192) fail("runtime_or_storage_unavailable");
  return JSON.parse(text);
}
async function main() {
  const [mode, backup] = process.argv.slice(2);
  const env = process.env;
  if (env.GITHUB_REF !== "refs/heads/main" || !/^[0-9a-f]{40}$/u.test(env.GITHUB_SHA ?? "") ||
      env.FANMIND_PUSH_RUNTIME_CONFIRM !== "prepare-staging-push-registration" ||
      !backup || resolve(backup) !== join(resolve(env.RUNNER_TEMP), "fanmind-push-runtime.backup")) fail("execution_boundary");
  if (mode !== "prepare" || env.FANMIND_RUNTIME_ENVIRONMENT !== "staging" ||
      env.NEXT_PUBLIC_APP_URL !== "https://staging.fanmind.ch" ||
      !/^[a-z0-9]{20}$/u.test(env.FANMIND_PUSH_RUNTIME_EXPECTED_DB_PROJECT ?? "") ||
      env.NEXT_PUBLIC_SUPABASE_URL !== `https://${env.FANMIND_PUSH_RUNTIME_EXPECTED_DB_PROJECT}.supabase.co` ||
      !env.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF ||
      env.FANMIND_PUSH_RUNTIME_EXPECTED_DB_PROJECT === env.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF) fail("target_binding");
  const version = await json("https://staging.fanmind.ch/api/version");
  if (version.application !== "fanmind" || version.runtimeEnvironment !== "staging" || version.releaseCommit !== env.GITHUB_SHA) fail("release_mismatch");
  const original = privateFile(ENV_FILE);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) fail("storage_configuration");
  const registrations = await json(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/mobile_push_registrations?select=id&limit=1`, {
    headers: buildSupabaseApiKeyHeaders(env.SUPABASE_SERVICE_ROLE_KEY),
  });
  if (!Array.isArray(registrations)) fail("storage_configuration");
  const plan = planPushRuntime(env, registrations.length > 0);
  for (const path of OVERRIDES) {
    const contents = readFileSync(path, "utf8");
    for (const [key, value] of [[KEY, plan.key], [PROJECT, plan.project]]) {
      if (new RegExp(`^\\s*(?:export\\s+)?${key}=`, "mu").test(contents) && env[key] !== value) fail("protected_override");
    }
  }
  if (privateFile(ENV_FILE) !== original) fail("configuration_changed");
  writeFileSync(backup, original, { mode: 0o600, flag: "wx" });
  replacePrivate(ENV_FILE, renderPushRuntime(original, plan));
  console.log(`STAGING_PUSH_RUNTIME_KEY=${plan.generated ? "generated" : "preserved"}`);
  console.log("STAGING_PUSH_RUNTIME_PROJECT=bound");
  console.log("STAGING_PUSH_RUNTIME_PREPARED=PASS");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    const allowed = new Set(["project_configuration", "project_mismatch", "key_recovery_required", "key_configuration", "private_file_invalid", "runtime_or_storage_unavailable", "execution_boundary", "target_binding", "release_mismatch", "storage_configuration", "protected_override", "configuration_changed"]);
    console.error(`STAGING_PUSH_RUNTIME_ERROR=${allowed.has(error.message) ? error.message : "operation_failed"}`);
    process.exitCode = 1;
  });
}
