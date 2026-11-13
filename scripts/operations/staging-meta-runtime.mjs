#!/usr/bin/env node
import { constants, openSync, fstatSync, closeSync, readFileSync, writeFileSync, renameSync, unlinkSync, fsyncSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { parseEnv } from "node:util";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildSupabaseApiKeyHeaders } from "../../src/lib/supabase/apiKeyPolicy.mjs";
import { META_GRAPH_API_VERSION } from "../../src/lib/metaIntegrationPolicy.mjs";
import { changeStagingRuntime, waitForStagingRelease } from "./staging-support-media-runtime.mjs";

const ROOT = "/var/www/fanmind-staging";
const ENV = ROOT + "/.env.production";
const OVERRIDES = ["/etc/fanmind-staging/runtime-secrets.env", ROOT + "/.release.env"];
const ORIGIN = "https://staging.fanmind.ch";
const CALLBACK = ORIGIN + "/api/integrations/facebook/callback";
const STAGING = "vshyhvgcmrlagvfnvomc";
const PRODUCTION = "drqkpdvtbbrrdwmtrodz";
const FIELDS = ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET", "FACEBOOK_REDIRECT_URI", "FANMIND_TOKEN_ENCRYPTION_KEY", "FACEBOOK_WEBHOOK_VERIFY_TOKEN"];
const fail = code => { throw new Error(code); };
const usable = value => typeof value === "string" && value.length > 0 && !/replace_with_|^your_/iu.test(value);
export function validMetaKey(value) {
  return typeof value === "string" && (/^[a-f0-9]{64}$/iu.test(value) ||
    (/^[A-Za-z0-9+/]{43}=$/u.test(value) && Buffer.from(value, "base64").length === 32));
}
export function metaReadiness(values) {
  const id = [values.FACEBOOK_APP_ID, values.META_APP_ID].find(value => usable(value) && /^\d{5,32}$/u.test(value));
  const secret = [values.FACEBOOK_APP_SECRET, values.META_APP_SECRET].find(value => usable(value) && /^[a-f0-9]{32}$/iu.test(value));
  return { appId: Boolean(id), appSecret: Boolean(secret),
    callback: [values.FACEBOOK_REDIRECT_URI, values.META_REDIRECT_URI].includes(CALLBACK),
    encryption: validMetaKey(values.FANMIND_TOKEN_ENCRYPTION_KEY),
    webhook: usable(values.FACEBOOK_WEBHOOK_VERIFY_TOKEN ?? values.META_WEBHOOK_VERIFY_TOKEN) };
}
export function assertMetaTarget(values, control, action) {
  if (!["inspect", "configure", "rebind", "subscribe-webhook"].includes(action) || control.GITHUB_REPOSITORY !== "FanMind/FanMind" ||
      control.GITHUB_EVENT_NAME !== "workflow_dispatch" || control.GITHUB_REF !== "refs/heads/main" ||
      !/^[a-f0-9]{40}$/u.test(control.GITHUB_SHA ?? "") || control.REVIEWED_COMMIT !== control.GITHUB_SHA ||
      control.CONFIRMATION !== `staging-meta-${action}` || !/^\d{1,20}$/u.test(control.GITHUB_RUN_ID ?? "")) fail("control_binding");
  if (values.FANMIND_RUNTIME_ENVIRONMENT !== "staging" || values.NEXT_PUBLIC_APP_URL !== ORIGIN ||
      values.NEXT_PUBLIC_SUPABASE_URL !== `https://${STAGING}.supabase.co` ||
      values.FANMIND_TARGET_SUPABASE_PROJECT_REF !== STAGING || values.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF !== PRODUCTION ||
      control.TARGET_PROJECT !== STAGING || control.PRODUCTION_PROJECT !== PRODUCTION ||
      values.FANMIND_RELEASE_COMMIT !== control.GITHUB_SHA) fail("target_binding");
}
// The separately authorized Staging identity transition is deliberately distinct
// from initial setup. Unknown aliases/overrides remain blocked, never rewritten.
export function assertMetaRebind(values, requested, expectedPreviousAppId) {
  if (expectedPreviousAppId !== "2214477125984114" ||
      values.FACEBOOK_APP_ID !== expectedPreviousAppId ||
      !/^\d{5,32}$/u.test(requested.appId ?? "") ||
      [expectedPreviousAppId, "1637976007865045"].includes(requested.appId) ||
      requested.appSecret === values.FACEBOOK_APP_SECRET ||
      !/^[a-f0-9]{32}$/iu.test(requested.appSecret ?? "")) fail("rebind_identity_invalid");
  if (!validMetaKey(values.FANMIND_TOKEN_ENCRYPTION_KEY) ||
      !usable(values.FACEBOOK_WEBHOOK_VERIFY_TOKEN)) fail("rebind_preservation_missing");
  if (["META_APP_ID", "META_APP_SECRET", "META_WEBHOOK_APP_SECRET"].some(name => typeof values[name] === "string" && values[name].trim().length > 0))
    fail("rebind_alias_conflict");
}
export function renderMetaConfiguration(original, overrides, requested, { tokensPresent = true, generateKey = () => randomBytes(32).toString("base64"), expectedPreviousAppId } = {}) {
  const effective = Object.assign({}, parseEnv(original), ...overrides.map(parseEnv));
  if (expectedPreviousAppId !== undefined) assertMetaRebind(effective, requested, expectedPreviousAppId);
  if (!/^\d{5,32}$/u.test(requested.appId ?? "") || !/^[a-f0-9]{32}$/iu.test(requested.appSecret ?? "") ||
      !/^[A-Za-z0-9_-]{32,128}$/u.test(requested.webhookToken ?? "")) fail("input_invalid");
  for (const name of ["FACEBOOK_APP_ID", "META_APP_ID"]) {
    if (/^\d{5,32}$/u.test(effective[name] ?? "") && effective[name] !== requested.appId &&
        !(name === "FACEBOOK_APP_ID" && expectedPreviousAppId && effective[name] === expectedPreviousAppId)) fail("existing_app_conflict");
  }
  let key = effective.FANMIND_TOKEN_ENCRYPTION_KEY;
  if (!validMetaKey(key)) {
    if (tokensPresent !== false) fail("existing_tokens_require_key_recovery");
    key = generateKey();
    if (!validMetaKey(key)) fail("generated_key_invalid");
  }
  const desired = { FACEBOOK_APP_ID: requested.appId, FACEBOOK_APP_SECRET: requested.appSecret,
    FACEBOOK_REDIRECT_URI: CALLBACK, FANMIND_TOKEN_ENCRYPTION_KEY: key,
    FACEBOOK_WEBHOOK_VERIFY_TOKEN: usable(effective.FACEBOOK_WEBHOOK_VERIFY_TOKEN)
      ? effective.FACEBOOK_WEBHOOK_VERIFY_TOKEN : requested.webhookToken };
  let after = original;
  for (const name of FIELDS) {
    const pattern = new RegExp(`^[ \\t]*(?:export[ \\t]+)?${name}[ \\t]*=.*$`, "gm");
    if ([...after.matchAll(pattern)].length > 1) fail("ambiguous_configuration");
    for (const override of overrides) {
      const value = parseEnv(override)[name];
      if (value !== undefined && value !== desired[name]) fail("override_conflict");
    }
    const line = `${name}=${JSON.stringify(desired[name])}`;
    after = pattern.test(after) ? after.replace(new RegExp(pattern.source, "gm"), line)
      : after + (after.endsWith("\n") ? "" : "\n") + line + "\n";
  }
  return after;
}
export function assertMetaRuntimeConsistency(effective, running, requestedAppId, rebind) {
  if (rebind) {
    const requested = { appId: requestedAppId, appSecret: rebind.appSecret };
    assertMetaRebind(effective, requested, rebind.expectedPreviousAppId);
    assertMetaRebind(running, requested, rebind.expectedPreviousAppId);
  }
  if (effective.FANMIND_TOKEN_ENCRYPTION_KEY !== running.FANMIND_TOKEN_ENCRYPTION_KEY) fail("encryption_key_drift");
  if (FIELDS.some(name => effective[name] !== running[name])) fail("managed_configuration_drift");
  for (const name of Object.keys(effective)) {
    if (!FIELDS.includes(name) && effective[name] !== running[name]) fail("unrelated_runtime_drift");
  }
  for (const name of ["FACEBOOK_APP_ID", "META_APP_ID"]) {
    if (/^\d{5,32}$/u.test(running[name] ?? "") && running[name] !== requestedAppId &&
        !(name === "FACEBOOK_APP_ID" && rebind && running[name] === rebind.expectedPreviousAppId)) fail("existing_app_conflict");
  }
}
function privateFile(path, rootSecret = false) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const a = fstatSync(fd);
    if (!a.isFile() || a.nlink !== 1 || a.size < 1 || a.size > 1048576 ||
        a.uid !== (rootSecret ? 0 : process.getuid()) || (a.mode & 0o777) !== (rootSecret ? 0o640 : 0o600)) fail("private_file_invalid");
    const text = readFileSync(fd, "utf8"), b = fstatSync(fd);
    if (a.ino !== b.ino || a.size !== b.size || a.mtimeMs !== b.mtimeMs || a.ctimeMs !== b.ctimeMs) fail("private_file_changed");
    return text;
  } finally { closeSync(fd); }
}
function command(binary, args) {
  const result = spawnSync(binary, args, { encoding: "utf8", timeout: 30000, maxBuffer: 65536, env: { PATH: "/usr/bin:/bin", LANG: "C.UTF-8" } });
  if (result.status !== 0 || result.error) fail("host_command_failed");
  return result.stdout.trim();
}
function runningValues() {
  const pid = command("/usr/bin/systemctl", ["show", "fanmind-staging.service", "--property=MainPID", "--value"]);
  if (!/^[1-9][0-9]{0,9}$/u.test(pid)) fail("service_not_running");
  const bytes = readFileSync(`/proc/${pid}/environ`, "utf8");
  if (bytes.length > 1048576) fail("process_environment_invalid");
  return Object.fromEntries(bytes.split("\0").filter(line => line.indexOf("=") > 0).map(line => {
    const i = line.indexOf("="); return [line.slice(0, i), line.slice(i + 1)];
  }));
}
async function boundedJson(url, headers, options = {}, request = fetch) {
  const response = await request(url, { ...options, headers, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) fail("target_read_failed");
  let size = 0; const chunks = [], reader = response.body.getReader();
  try { for (;;) { const item = await reader.read(); if (item.done) break; size += item.value.length; if (size > 65536) fail("target_read_failed"); chunks.push(item.value); } }
  finally { await reader.cancel().catch(() => {}); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export function metaSetupInput(action, control) {
  return { appId: control.META_SETUP_APP_ID,
    appSecret: action === "rebind" ? control.META_REBIND_APP_SECRET : control.META_SETUP_APP_SECRET,
    webhookToken: control.META_SETUP_WEBHOOK_TOKEN };
}
// The token stays on the protected Staging host. Never export it to a job log
// or mutate any existing Production app subscription.
export async function subscribeStagingMetaWebhook(values, requestedAppId, request = fetch) {
  const appId = "1547928503809961", callback = ORIGIN + "/api/webhooks/meta";
  if (requestedAppId !== appId || values.FACEBOOK_APP_ID !== appId ||
      !/^[a-f0-9]{32}$/iu.test(values.FACEBOOK_APP_SECRET ?? "") ||
      !/^[A-Za-z0-9_-]{32,128}$/u.test(values.FACEBOOK_WEBHOOK_VERIFY_TOKEN ?? "")) fail("subscription_identity_invalid");
  const url = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${appId}/subscriptions`;
  const headers = { Authorization: `Bearer ${appId}|${values.FACEBOOK_APP_SECRET}` };
  const read = () => boundedJson(url, headers, {}, request);
  const validate = data => {
    if (!Array.isArray(data?.data) || data.data.length > 1 || data.paging?.next) fail("subscription_inventory_invalid");
    const page = data.data[0];
    if (page && (page.object !== "page" || page.callback_url !== callback || !Array.isArray(page.fields) ||
        page.fields.some(field => !["messages", "feed"].includes(field.name)))) fail("subscription_conflict");
    return page;
  };
  const complete = page => page?.active === true && new Set(page.fields.map(field => field.name)).size === 2;
  if (complete(validate(await read()))) return;
  const body = new URLSearchParams({ object: "page", callback_url: callback,
    verify_token: values.FACEBOOK_WEBHOOK_VERIFY_TOKEN, fields: "messages,feed" });
  const result = await boundedJson(url, { ...headers, "Content-Type": "application/x-www-form-urlencoded" }, { method: "POST", body }, request);
  if (result?.success !== true) fail("subscription_write_unconfirmed");
  if (!complete(validate(await read()))) fail("subscription_readback_failed");
}
async function verifyRelease(control) {
  const version = await boundedJson(ORIGIN + "/api/version");
  if (version.application !== "fanmind" || version.runtimeEnvironment !== "staging" || version.releaseCommit !== control.GITHUB_SHA) fail("live_release_mismatch");
}
function replace(text) {
  const temporary = ENV + ".meta-" + randomBytes(12).toString("hex");
  let fd;
  try {
    fd = openSync(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    writeFileSync(fd, text); fsyncSync(fd); closeSync(fd); fd = undefined;
    renameSync(temporary, ENV);
    const directory = openSync(ROOT, constants.O_RDONLY | constants.O_DIRECTORY);
    try { fsyncSync(directory); } finally { closeSync(directory); }
  } finally { if (fd !== undefined) closeSync(fd); try { unlinkSync(temporary); } catch {} }
}
export async function runMetaRuntime(action, control = process.env) {
  const before = privateFile(ENV), overrides = OVERRIDES.map((path, i) => privateFile(path, i === 0));
  const effective = Object.assign({}, parseEnv(before), ...overrides.map(parseEnv));
  assertMetaTarget(effective, control, action);
  await verifyRelease(control);
  const verifyOverrides = () => { if (OVERRIDES.some((path, i) => privateFile(path, i === 0) !== overrides[i])) fail("override_configuration_changed"); };
  const runningBefore = runningValues();
  if (action === "inspect") {
    console.log(`STAGING_META_READINESS=${JSON.stringify(metaReadiness(runningBefore))}`);
    return;
  }
  if (action === "subscribe-webhook") {
    assertMetaRuntimeConsistency(effective, runningBefore, control.META_SETUP_APP_ID);
    await subscribeStagingMetaWebhook(runningBefore, control.META_SETUP_APP_ID);
    console.log("STAGING_META_APP_SUBSCRIPTION=PASS");
    return;
  }
  const requested = metaSetupInput(action, control);
  const rebind = action === "rebind" ? { expectedPreviousAppId: control.META_SETUP_PREVIOUS_APP_ID, appSecret: requested.appSecret } : undefined;
  if (action === "rebind") assertMetaRebind(effective, requested, control.META_SETUP_PREVIOUS_APP_ID);
  assertMetaRuntimeConsistency(effective, runningBefore, requested.appId, rebind);
  let tokensPresent = true;
  if (!validMetaKey(effective.FANMIND_TOKEN_ENCRYPTION_KEY)) {
    const url = new URL(effective.NEXT_PUBLIC_SUPABASE_URL + "/rest/v1/social_connections");
    url.searchParams.set("select", "id"); url.searchParams.set("page_access_token_encrypted", "not.is.null"); url.searchParams.set("limit", "1");
    const rows = await boundedJson(url.href, buildSupabaseApiKeyHeaders(effective.SUPABASE_SERVICE_ROLE_KEY));
    if (!Array.isArray(rows) || rows.length > 1) fail("token_inventory_invalid");
    tokensPresent = rows.length > 0;
  }
  const after = renderMetaConfiguration(before, overrides, requested, { tokensPresent, ...(rebind ? { expectedPreviousAppId: rebind.expectedPreviousAppId } : {}) });
  const desired = Object.assign({}, parseEnv(after), ...overrides.map(parseEnv));
  const unchangedNames = [...new Set([...Object.keys(effective), ...Object.keys(desired)])].filter(name => !FIELDS.includes(name));
  if (unchangedNames.some(name => effective[name] !== desired[name])) fail("unrelated_configuration_changed");
  command("/usr/bin/sudo", ["-n", "-l", "/usr/bin/systemctl", "restart", "fanmind-staging.service"]);
  // Private durable snapshot survives job interruption; never upload it as an artifact.
  const snapshot = ENV + ".meta-before-" + control.GITHUB_RUN_ID;
  const snapshotFd = openSync(snapshot, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try { writeFileSync(snapshotFd, before); fsyncSync(snapshotFd); } finally { closeSync(snapshotFd); }
  const snapshotDirectory = openSync(ROOT, constants.O_RDONLY | constants.O_DIRECTORY);
  try { fsyncSync(snapshotDirectory); } finally { closeSync(snapshotDirectory); }
  const restart = () => { command("/usr/bin/sudo", ["-n", "/usr/bin/systemctl", "restart", "fanmind-staging.service"]); command("/usr/bin/systemctl", ["is-active", "--quiet", "fanmind-staging.service"]); };
  await changeStagingRuntime({ before, after, read: () => privateFile(ENV),
    write: text => { verifyOverrides(); if (privateFile(ENV) !== (text === after ? before : after)) fail("configuration_changed"); replace(text); }, restart,
    verify: async () => {
      await waitForStagingRelease(() => verifyRelease(control)); verifyOverrides();
      const running = runningValues();
      if (FIELDS.some(name => running[name] !== desired[name]) || unchangedNames.some(name => running[name] !== runningBefore[name])) fail("effective_flags_mismatch");
    }, verifyRollback: async () => {
      await waitForStagingRelease(() => verifyRelease(control)); verifyOverrides(); const running = runningValues();
      if ([...new Set([...FIELDS, ...unchangedNames])].some(name => running[name] !== runningBefore[name])) fail("rollback_effective_flags_mismatch");
    } });
  console.log("STAGING_META_CONFIGURATION=PASS");
  console.log(`STAGING_META_READINESS=${JSON.stringify(metaReadiness(runningValues()))}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await runMetaRuntime(process.argv[2]); }
  catch { console.error("STAGING_META_CONFIGURATION=FAIL"); process.exitCode = 1; }
}
