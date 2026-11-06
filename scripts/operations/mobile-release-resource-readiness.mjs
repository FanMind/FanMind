#!/usr/bin/env node

import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const APP_CONFIG_JSON_URL = new URL(
  "../../apps/mobile/app.json",
  import.meta.url,
);
const APP_CONFIG_MODULE_URL = new URL(
  "../../apps/mobile/app.config.js",
  import.meta.url,
);
const require = createRequire(import.meta.url);
const ALLOWED_ENVIRONMENTS = new Set(["development", "preview", "production"]);
const ALLOWED_PUBLIC_KEYS = new Set([
  "EXPO_PUBLIC_FANMIND_API_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_SUPABASE_URL",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/u;
const OWNER_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,37}[a-z0-9])?$/iu;
const FORBIDDEN_PUBLIC_VALUE_PATTERN =
  /(?:service[_-]?role|sb_secret_|sk_(?:live|test|proj)?_|whsec_|-----BEGIN|OPENAI_API_KEY|STRIPE_SECRET)/iu;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function required(environment, key, code = "configuration_missing") {
  const value = String(environment[key] ?? "").trim();
  if (!value) fail(code);
  return value;
}

function parseOrigin(value, code) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(code);
  }
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.search
    || url.hash
    || (url.pathname !== "/" && url.pathname !== "")
  ) {
    fail(code);
  }
  return url.origin;
}

function parseSupabaseProjectRef(value, code) {
  const origin = parseOrigin(value, code);
  const url = new URL(origin);
  const match = /^([a-z0-9]{20})\.supabase\.co$/u.exec(url.hostname);
  if (!match) fail(code);
  return match[1];
}

function decodeJwtRole(value) {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function verifyPublicClientEnvironment(environment) {
  const publicKeys = Object.keys(environment)
    .filter((key) => key.startsWith("EXPO_PUBLIC_"))
    .sort();
  const unexpectedKey = publicKeys.find((key) => !ALLOWED_PUBLIC_KEYS.has(key));
  if (unexpectedKey || publicKeys.length !== ALLOWED_PUBLIC_KEYS.size) {
    fail("public_environment_invalid");
  }

  for (const key of ALLOWED_PUBLIC_KEYS) {
    const value = required(environment, key, "public_environment_invalid");
    if (FORBIDDEN_PUBLIC_VALUE_PATTERN.test(value)) {
      fail("public_environment_secret_like");
    }
  }

  const anonKey = required(
    environment,
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    "public_environment_invalid",
  );
  const jwtRole = decodeJwtRole(anonKey);
  const isPublishableKey =
    /^sb_publishable_[A-Za-z0-9_-]{20,}$/u.test(anonKey);
  if ((!isPublishableKey && jwtRole !== "anon") || jwtRole === "service_role") {
    fail("supabase_public_key_invalid");
  }
}

function verifyReleaseSwitches(environment) {
  for (const key of [
    "FANMIND_ENABLE_MOBILE_EAS_BUILD",
    "FANMIND_ENABLE_MOBILE_EAS_SUBMIT",
    "FANMIND_ENABLE_MOBILE_EAS_UPDATE",
  ]) {
    if (String(environment[key] ?? "").trim() !== "false") {
      fail("release_write_gate_enabled");
    }
  }
}

export function evaluateMobileReleaseResources({
  appConfig,
  environment = process.env,
}) {
  const releaseEnvironment = required(
    environment,
    "FANMIND_MOBILE_RELEASE_ENVIRONMENT",
  );
  if (!ALLOWED_ENVIRONMENTS.has(releaseEnvironment)) {
    fail("release_environment_invalid");
  }
  if (
    required(environment, "FANMIND_MOBILE_RELEASE_RESOURCE_CONFIRM")
    !== "verify-mobile-release-resources"
  ) {
    fail("confirmation_invalid");
  }
  verifyReleaseSwitches(environment);
  verifyPublicClientEnvironment(environment);

  const expectedOwner = required(
    environment,
    "FANMIND_MOBILE_EXPECTED_EAS_OWNER",
  );
  const expectedProjectId = required(
    environment,
    "FANMIND_MOBILE_EXPECTED_EAS_PROJECT_ID",
  );
  if (
    !OWNER_PATTERN.test(expectedOwner)
    || /^(?:owner|example|placeholder|fanmind)$/iu.test(expectedOwner)
  ) {
    fail("eas_owner_invalid");
  }
  if (!UUID_PATTERN.test(expectedProjectId)) fail("eas_project_id_invalid");

  const expo = appConfig?.expo;
  if (
    expo?.owner !== expectedOwner
    || expo?.extra?.eas?.projectId !== expectedProjectId
  ) {
    fail("eas_project_binding_invalid");
  }
  if (
    expo?.slug !== "fanmind-mobile"
    || expo?.scheme !== "fanmind"
    || expo?.ios?.bundleIdentifier !== "ch.fanmind.app"
    || expo?.android?.package !== "ch.fanmind.app"
  ) {
    fail("app_identity_invalid");
  }

  const expectedTargetRef = required(
    environment,
    "FANMIND_MOBILE_EXPECTED_SUPABASE_PROJECT_REF",
  );
  const productionRef = required(
    environment,
    "FANMIND_PRODUCTION_SUPABASE_PROJECT_REF",
  );
  if (
    !PROJECT_REF_PATTERN.test(expectedTargetRef)
    || !PROJECT_REF_PATTERN.test(productionRef)
  ) {
    fail("supabase_project_ref_invalid");
  }
  const actualTargetRef = parseSupabaseProjectRef(
    required(environment, "EXPO_PUBLIC_SUPABASE_URL"),
    "supabase_url_invalid",
  );
  if (actualTargetRef !== expectedTargetRef) fail("supabase_target_mismatch");

  const expectedApiOrigin = parseOrigin(
    required(environment, "FANMIND_MOBILE_EXPECTED_API_ORIGIN"),
    "api_origin_invalid",
  );
  const productionApiOrigin = parseOrigin(
    required(environment, "FANMIND_PRODUCTION_API_ORIGIN"),
    "api_origin_invalid",
  );
  const actualApiOrigin = parseOrigin(
    required(environment, "EXPO_PUBLIC_FANMIND_API_URL"),
    "api_origin_invalid",
  );
  if (actualApiOrigin !== expectedApiOrigin) fail("api_origin_mismatch");

  if (releaseEnvironment === "production") {
    if (
      expectedTargetRef !== productionRef
      || expectedApiOrigin !== productionApiOrigin
    ) {
      fail("production_target_mismatch");
    }
  } else if (
    expectedTargetRef === productionRef
    || expectedApiOrigin === productionApiOrigin
  ) {
    fail("production_crossover");
  }

  return Object.freeze({
    environment: releaseEnvironment,
    projectBinding: "verified",
    appIdentity: "verified",
    publicEnvironment: "verified",
    writeGates: "disabled",
  });
}

export async function verifyMobileReleaseResources(environment = process.env) {
  let appConfig;
  try {
    const staticConfig = JSON.parse(
      await readFile(APP_CONFIG_JSON_URL, "utf8"),
    );
    const configFactory = require(fileURLToPath(APP_CONFIG_MODULE_URL));
    appConfig = {
      expo: configFactory({
        config: staticConfig.expo,
        environment,
      }),
    };
  } catch {
    fail("app_config_invalid");
  }
  return evaluateMobileReleaseResources({ appConfig, environment });
}

async function main() {
  const result = await verifyMobileReleaseResources(process.env);
  console.log(`MOBILE_RELEASE_READINESS_ENVIRONMENT=${result.environment}`);
  console.log("MOBILE_RELEASE_READINESS_EAS_PROJECT=linked");
  console.log("MOBILE_RELEASE_READINESS_APP_IDENTITY=verified");
  console.log("MOBILE_RELEASE_READINESS_PUBLIC_ENVIRONMENT=verified");
  console.log("MOBILE_RELEASE_READINESS_BUILD=disabled");
  console.log("MOBILE_RELEASE_READINESS_SUBMIT=disabled");
  console.log("MOBILE_RELEASE_READINESS_UPDATE=disabled");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  console.log("MOBILE_RELEASE_RESOURCE_READINESS=PASS");
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(
      `MOBILE_RELEASE_READINESS_ERROR=${error?.code ?? "readiness_failed"}`,
    );
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    console.error("MOBILE_RELEASE_RESOURCE_READINESS=FAIL");
    process.exitCode = 1;
  });
}
