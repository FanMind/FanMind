import { randomBytes as nodeRandomBytes } from "node:crypto";

import { buildSupabaseApiKeyHeaders } from "./supabase/apiKeyPolicy.mjs";
import {
  STAGING_SYNTHETIC_MEMBER_EMAIL,
  STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME,
  STAGING_SYNTHETIC_UUID_PATTERN,
} from "./stagingSyntheticFixturePolicy.mjs";

export const STAGING_EPHEMERAL_MEMBER_ACTIVATE_CONFIRMATION =
  "activate-staging-ephemeral-member-credential";
export const STAGING_EPHEMERAL_MEMBER_REVOKE_CONFIRMATION =
  "revoke-staging-ephemeral-member-credential";
export const STAGING_EPHEMERAL_MEMBER_MARKER_KEY =
  "fanmind_staging_fixture";
export const STAGING_EPHEMERAL_MEMBER_MARKER_VERSION_KEY =
  "fanmind_staging_fixture_version";
export const STAGING_EPHEMERAL_MEMBER_MARKER = "ai_member";
export const STAGING_EPHEMERAL_MEMBER_MARKER_VERSION = 1;

const STAGING_APP_ORIGIN = "https://staging.fanmind.ch";
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const PROJECT_REF_PATTERN = /^[a-z0-9]{8,64}$/u;
const MAX_RESPONSE_BYTES = 256 * 1024;
const REQUEST_TIMEOUT_MS = 12_000;

class CredentialError extends Error {
  constructor(code) {
    super(code);
    this.name = "CredentialError";
    this.code = code;
  }
}

function fail(code) {
  throw new CredentialError(code);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedOrigin(value) {
  try {
    const url = new URL(clean(value));
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return "";
    }
    return url.origin;
  } catch {
    return "";
  }
}

function validSecretKey(value) {
  const key = clean(value);
  return key.startsWith("sb_secret_") || key.startsWith("eyJ");
}

function validPublishableKey(value) {
  const key = clean(value);
  return key.startsWith("sb_publishable_") || key.startsWith("eyJ");
}

export function isStrongEphemeralMemberPassword(value) {
  return (
    typeof value === "string" &&
    value.length >= 48 &&
    value.length <= 128 &&
    /[a-z]/u.test(value) &&
    /[A-Z]/u.test(value) &&
    /[0-9]/u.test(value) &&
    /[^A-Za-z0-9]/u.test(value) &&
    !/[\u0000-\u0020\u007f]/u.test(value)
  );
}

export function generateStrongEphemeralMemberPassword(
  randomBytesImplementation = nodeRandomBytes,
) {
  const entropy = randomBytesImplementation(48);
  if (!Buffer.isBuffer(entropy) || entropy.length !== 48) {
    fail("random_source_invalid");
  }
  try {
    const password = `Fm1!${entropy.toString("base64url")}`;
    if (!isStrongEphemeralMemberPassword(password)) {
      fail("generated_password_invalid");
    }
    return password;
  } finally {
    entropy.fill(0);
  }
}

export function evaluateStagingEphemeralMemberCredentialEnvironment(
  environment = {},
  { mode = "activate" } = {},
) {
  const errors = [];
  const targetRef = clean(
    environment.FANMIND_TARGET_SUPABASE_PROJECT_REF,
  ).toLowerCase();
  const productionRef = clean(
    environment.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF,
  ).toLowerCase();
  const supabaseOrigin = normalizedOrigin(
    environment.FANMIND_STAGING_SUPABASE_URL,
  );
  const reviewedCommit = clean(
    environment.FANMIND_STAGING_EPHEMERAL_MEMBER_REVIEWED_COMMIT,
  ).toLowerCase();
  const githubSha = clean(environment.GITHUB_SHA).toLowerCase();
  const memberPassword = environment.FANMIND_STAGING_E2E_MEMBER_PASSWORD;
  const serviceKey = clean(
    environment.FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY,
  );
  const anonKey = clean(environment.FANMIND_STAGING_SUPABASE_ANON_KEY);

  if (!new Set(["activate", "revoke"]).has(mode)) {
    errors.push("mode");
  }
  if (clean(environment.FANMIND_RUNTIME_ENVIRONMENT) !== "staging") {
    errors.push("runtime_environment");
  }
  if (normalizedOrigin(environment.NEXT_PUBLIC_APP_URL) !== STAGING_APP_ORIGIN) {
    errors.push("application_boundary");
  }
  if (
    !PROJECT_REF_PATTERN.test(targetRef) ||
    !PROJECT_REF_PATTERN.test(productionRef) ||
    targetRef === productionRef ||
    supabaseOrigin !== `https://${targetRef}.supabase.co`
  ) {
    errors.push("supabase_boundary");
  }
  if (
    clean(environment.GITHUB_REF) !== "refs/heads/main" ||
    !COMMIT_PATTERN.test(reviewedCommit) ||
    reviewedCommit !== githubSha
  ) {
    errors.push("reviewed_commit");
  }
  if (
    clean(environment.FANMIND_ENABLE_NON_PRODUCTION_WRITES) !== "true" ||
    clean(environment.FANMIND_NON_PRODUCTION_WRITE_ACK) !==
      "I_UNDERSTAND_NON_PRODUCTION_ONLY"
  ) {
    errors.push("write_confirmation");
  }
  const expectedConfirmation =
    mode === "revoke"
      ? STAGING_EPHEMERAL_MEMBER_REVOKE_CONFIRMATION
      : STAGING_EPHEMERAL_MEMBER_ACTIVATE_CONFIRMATION;
  if (
    clean(environment.FANMIND_STAGING_EPHEMERAL_MEMBER_CONFIRM) !==
    expectedConfirmation
  ) {
    errors.push("operation_confirmation");
  }
  if (
    !STAGING_SYNTHETIC_UUID_PATTERN.test(
      clean(environment.FANMIND_STAGING_E2E_WORKSPACE_ID).toLowerCase(),
    )
  ) {
    errors.push("workspace_identity");
  }
  if (!isStrongEphemeralMemberPassword(memberPassword)) {
    errors.push("member_password");
  }
  if (!validSecretKey(serviceKey)) {
    errors.push("service_role_key");
  }
  if (
    mode === "revoke" &&
    (!validPublishableKey(anonKey) || anonKey === serviceKey)
  ) {
    errors.push("publishable_key");
  }
  for (const redirect of [
    "NODE_OPTIONS",
    "NODE_EXTRA_CA_CERTS",
    "NODE_USE_ENV_PROXY",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
  ]) {
    if (clean(environment[redirect])) {
      errors.push("network_redirect");
      break;
    }
  }
  return { ok: errors.length === 0, errors };
}

async function boundedJson(response) {
  const contentLength = Number.parseInt(
    response.headers.get("content-length") ?? "",
    10,
  );
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    fail("response_too_large");
  }
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        fail("response_too_large");
      }
      chunks.push(value);
    }
  } catch (error) {
    for (const chunk of chunks) chunk.fill(0);
    if (error instanceof CredentialError) throw error;
    fail("response_read_failed");
  }
  if (received === 0) return null;
  let bytes;
  try {
    bytes = Buffer.concat(chunks, received);
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    fail("response_json_invalid");
  } finally {
    bytes?.fill(0);
    for (const chunk of chunks) chunk.fill(0);
  }
}

async function fixedRequest(
  environment,
  fetchImplementation,
  path,
  { method = "GET", headers = {}, body, expectedStatuses = [200] } = {},
) {
  const base = new URL(clean(environment.FANMIND_STAGING_SUPABASE_URL));
  const url = path instanceof URL ? path : new URL(path, base);
  if (url.origin !== base.origin || url.protocol !== "https:") {
    fail("request_origin_invalid");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImplementation(url, {
      method,
      headers: { Accept: "application/json", ...headers },
      body,
      redirect: "error",
      signal: controller.signal,
    });
    if (!expectedStatuses.includes(response.status)) {
      fail("response_status_invalid");
    }
    return { response, payload: await boundedJson(response) };
  } catch (error) {
    if (error instanceof CredentialError) throw error;
    fail("request_failed");
  } finally {
    clearTimeout(timeout);
  }
}

function serviceHeaders(environment, accessToken) {
  return buildSupabaseApiKeyHeaders(
    environment.FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY,
    accessToken,
  );
}

function userFromPayload(payload) {
  return payload?.user && typeof payload.user === "object"
    ? payload.user
    : payload;
}

function markerFromUser(user) {
  const metadata = user?.user_metadata ?? user?.raw_user_meta_data;
  return metadata && typeof metadata === "object" ? metadata : {};
}

function assertMarkedMemberUser(user, expectedUserId) {
  const marker = markerFromUser(user);
  if (
    clean(user?.id).toLowerCase() !== expectedUserId ||
    clean(user?.email).toLowerCase() !== STAGING_SYNTHETIC_MEMBER_EMAIL ||
    !clean(user?.email_confirmed_at) ||
    marker[STAGING_EPHEMERAL_MEMBER_MARKER_KEY] !==
      STAGING_EPHEMERAL_MEMBER_MARKER ||
    marker[STAGING_EPHEMERAL_MEMBER_MARKER_VERSION_KEY] !==
      STAGING_EPHEMERAL_MEMBER_MARKER_VERSION
  ) {
    fail("auth_user_contract_invalid");
  }
}

async function readAdminUser(environment, fetchImplementation, userId) {
  const { payload: userPayload } = await fixedRequest(
    environment,
    fetchImplementation,
    `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    { headers: serviceHeaders(environment) },
  );
  return userFromPayload(userPayload);
}

async function readMarkedAdminUser(environment, fetchImplementation, userId) {
  const user = await readAdminUser(environment, fetchImplementation, userId);
  assertMarkedMemberUser(user, userId);
  return user;
}

async function readMemberWorkspaceContract(
  environment,
  fetchImplementation,
  userId,
) {
  const membershipsUrl = new URL(
    "/rest/v1/workspace_members",
    environment.FANMIND_STAGING_SUPABASE_URL,
  );
  membershipsUrl.searchParams.set("select", "workspace_id,user_id,role");
  membershipsUrl.searchParams.set("user_id", `eq.${userId}`);
  membershipsUrl.searchParams.set("limit", "2");
  const { payload: memberships } = await fixedRequest(
    environment,
    fetchImplementation,
    membershipsUrl,
    { headers: serviceHeaders(environment) },
  );
  const workspaceId = clean(
    environment.FANMIND_STAGING_E2E_WORKSPACE_ID,
  ).toLowerCase();
  if (
    !Array.isArray(memberships) ||
    memberships.length !== 1 ||
    clean(memberships[0]?.workspace_id).toLowerCase() !== workspaceId ||
    clean(memberships[0]?.user_id).toLowerCase() !== userId ||
    memberships[0]?.role !== "member"
  ) {
    fail("membership_contract_invalid");
  }

  const workspaceUrl = new URL(
    "/rest/v1/workspaces",
    environment.FANMIND_STAGING_SUPABASE_URL,
  );
  workspaceUrl.searchParams.set(
    "select",
    "id,name,owner_user_id,billing_status,workspace_access_mode,test_access_flags",
  );
  workspaceUrl.searchParams.set("id", `eq.${workspaceId}`);
  workspaceUrl.searchParams.set("limit", "2");
  const { payload: workspaces } = await fixedRequest(
    environment,
    fetchImplementation,
    workspaceUrl,
    { headers: serviceHeaders(environment) },
  );
  const workspace = Array.isArray(workspaces) ? workspaces[0] : null;
  if (
    !Array.isArray(workspaces) ||
    workspaces.length !== 1 ||
    clean(workspace?.id).toLowerCase() !== workspaceId ||
    workspace?.name !== STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME ||
    clean(workspace?.owner_user_id).toLowerCase() === userId ||
    !STAGING_SYNTHETIC_UUID_PATTERN.test(
      clean(workspace?.owner_user_id).toLowerCase(),
    ) ||
    workspace?.billing_status !== "active" ||
    workspace?.workspace_access_mode !== "active" ||
    workspace?.test_access_flags?.staging_synthetic_fixture !== true
  ) {
    fail("workspace_contract_invalid");
  }
}

async function resolveFixedMemberProfile(environment, fetchImplementation) {
  const profileUrl = new URL(
    "/rest/v1/profiles",
    environment.FANMIND_STAGING_SUPABASE_URL,
  );
  profileUrl.searchParams.set("select", "id,email");
  profileUrl.searchParams.set("email", `eq.${STAGING_SYNTHETIC_MEMBER_EMAIL}`);
  profileUrl.searchParams.set("limit", "2");
  const { payload: profiles } = await fixedRequest(
    environment,
    fetchImplementation,
    profileUrl,
    { headers: serviceHeaders(environment) },
  );
  if (
    !Array.isArray(profiles) ||
    profiles.length !== 1 ||
    clean(profiles[0]?.email).toLowerCase() !==
      STAGING_SYNTHETIC_MEMBER_EMAIL ||
    !STAGING_SYNTHETIC_UUID_PATTERN.test(clean(profiles[0]?.id).toLowerCase())
  ) {
    fail("profile_contract_invalid");
  }
  return clean(profiles[0].id).toLowerCase();
}

async function inspectMarkedMember(environment, fetchImplementation) {
  const userId = await resolveFixedMemberProfile(
    environment,
    fetchImplementation,
  );
  await readMarkedAdminUser(environment, fetchImplementation, userId);
  await readMemberWorkspaceContract(environment, fetchImplementation, userId);
  return { userId };
}

async function verifyMarkedMemberAfterUpdate(
  environment,
  fetchImplementation,
  userId,
) {
  const resolvedUserId = await resolveFixedMemberProfile(
    environment,
    fetchImplementation,
  );
  if (resolvedUserId !== userId) {
    fail("profile_binding_drift");
  }
  await readMarkedAdminUser(environment, fetchImplementation, userId);
  await readMemberWorkspaceContract(environment, fetchImplementation, userId);
}

async function updateMarkedMemberPassword(
  environment,
  fetchImplementation,
  userId,
  password,
) {
  const { payload } = await fixedRequest(
    environment,
    fetchImplementation,
    `/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "PUT",
      headers: serviceHeaders(environment),
      body: JSON.stringify({ password }),
    },
  );
  assertMarkedMemberUser(userFromPayload(payload), userId);
}

function generateUnknownPassword(
  randomBytesImplementation,
  forbiddenPasswords,
) {
  for (let draw = 0; draw < 3; draw += 1) {
    const candidate = generateStrongEphemeralMemberPassword(
      randomBytesImplementation,
    );
    if (!forbiddenPasswords.has(candidate)) return candidate;
  }
  fail("random_source_repeated");
}

async function compensateBoundMemberPassword(
  environment,
  fetchImplementation,
  randomBytesImplementation,
  userId,
  forbiddenPasswords,
) {
  try {
    const currentUser = await readAdminUser(
      environment,
      fetchImplementation,
      userId,
    );
    assertMarkedMemberUser(currentUser, userId);
  } catch (error) {
    if (
      error instanceof CredentialError &&
      error.code === "auth_user_contract_invalid"
    ) {
      return false;
    }
    // The exact UUID was bound before the first PUT. If the optional Auth
    // re-read is unavailable, still make one bounded cleanup attempt against
    // that UUID; never resolve another profile or depend on drifted membership.
  }

  let unknownPassword;
  try {
    unknownPassword = generateUnknownPassword(
      randomBytesImplementation,
      forbiddenPasswords,
    );
    await updateMarkedMemberPassword(
      environment,
      fetchImplementation,
      userId,
      unknownPassword,
    );
    return true;
  } catch {
    return false;
  }
}

async function updateMarkedMemberPasswordWithPostflight(
  environment,
  fetchImplementation,
  randomBytesImplementation,
  userId,
  password,
  knownPassword,
) {
  const forbiddenPasswords = new Set([password, knownPassword]);
  try {
    await updateMarkedMemberPassword(
      environment,
      fetchImplementation,
      userId,
      password,
    );
  } catch {
    const compensated = await compensateBoundMemberPassword(
      environment,
      fetchImplementation,
      randomBytesImplementation,
      userId,
      forbiddenPasswords,
    );
    fail(
      compensated
        ? "admin_update_indeterminate_compensated"
        : "admin_update_indeterminate_compensation_failed",
    );
  }

  try {
    await verifyMarkedMemberAfterUpdate(
      environment,
      fetchImplementation,
      userId,
    );
  } catch {
    const compensated = await compensateBoundMemberPassword(
      environment,
      fetchImplementation,
      randomBytesImplementation,
      userId,
      forbiddenPasswords,
    );
    fail(
      compensated
        ? "post_update_contract_drift_compensated"
        : "post_update_contract_drift_compensation_failed",
    );
  }
}

async function revokeUnexpectedSession(
  environment,
  fetchImplementation,
  accessToken,
) {
  await fixedRequest(
    environment,
    fetchImplementation,
    "/auth/v1/logout?scope=global",
    {
      method: "POST",
      headers: buildSupabaseApiKeyHeaders(
        environment.FANMIND_STAGING_SUPABASE_ANON_KEY,
        accessToken,
      ),
      expectedStatuses: [200, 204],
    },
  );
}

async function knownPasswordIsRejected(
  environment,
  fetchImplementation,
  password,
  expectedUserId,
) {
  const { response, payload } = await fixedRequest(
    environment,
    fetchImplementation,
    "/auth/v1/token?grant_type=password",
    {
      method: "POST",
      headers: {
        ...buildSupabaseApiKeyHeaders(environment.FANMIND_STAGING_SUPABASE_ANON_KEY),
        "X-Supabase-Api-Version": "2024-01-01",
      },
      body: JSON.stringify({
        email: STAGING_SYNTHETIC_MEMBER_EMAIL,
        password,
      }),
      expectedStatuses: [200, 400],
    },
  );
  if (response.status === 400) {
    const code = clean(payload?.code ?? payload?.error_code).toLowerCase();
    const legacyRejection = !code && payload?.error === "invalid_grant" &&
      payload?.error_description === "Invalid login credentials";
    if (code !== "invalid_credentials" && !legacyRejection) {
      fail("password_rejection_invalid");
    }
    return true;
  }
  const accessToken = clean(payload?.access_token);
  if (
    !accessToken ||
    clean(payload?.user?.id).toLowerCase() !== expectedUserId ||
    clean(payload?.user?.email).toLowerCase() !==
      STAGING_SYNTHETIC_MEMBER_EMAIL
  ) {
    fail("unexpected_session_invalid");
  }
  await revokeUnexpectedSession(environment, fetchImplementation, accessToken);
  return false;
}

function resultError(error) {
  return error instanceof CredentialError ? error.code : "unexpected_failure";
}

export async function activateStagingEphemeralMemberCredential(
  environment = {},
  {
    fetchImplementation = fetch,
    randomBytesImplementation = nodeRandomBytes,
  } = {},
) {
  try {
    const policy = evaluateStagingEphemeralMemberCredentialEnvironment(
      environment,
      { mode: "activate" },
    );
    if (!policy.ok) fail("environment_invalid");
    const { userId } = await inspectMarkedMember(
      environment,
      fetchImplementation,
    );
    await updateMarkedMemberPasswordWithPostflight(
      environment,
      fetchImplementation,
      randomBytesImplementation,
      userId,
      environment.FANMIND_STAGING_E2E_MEMBER_PASSWORD,
      environment.FANMIND_STAGING_E2E_MEMBER_PASSWORD,
    );
    return { ok: true, updatedUsers: 1 };
  } catch (error) {
    return { ok: false, error: resultError(error) };
  }
}

export async function revokeStagingEphemeralMemberCredential(
  environment = {},
  {
    fetchImplementation = fetch,
    randomBytesImplementation = nodeRandomBytes,
  } = {},
) {
  try {
    const policy = evaluateStagingEphemeralMemberCredentialEnvironment(
      environment,
      { mode: "revoke" },
    );
    if (!policy.ok) fail("environment_invalid");
    const { userId } = await inspectMarkedMember(
      environment,
      fetchImplementation,
    );
    const knownPassword = environment.FANMIND_STAGING_E2E_MEMBER_PASSWORD;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const unknownPassword = generateUnknownPassword(
        randomBytesImplementation,
        new Set([knownPassword]),
      );
      await updateMarkedMemberPasswordWithPostflight(
        environment,
        fetchImplementation,
        randomBytesImplementation,
        userId,
        unknownPassword,
        knownPassword,
      );
      if (
        await knownPasswordIsRejected(
          environment,
          fetchImplementation,
          knownPassword,
          userId,
        )
      ) {
        return {
          ok: true,
          updatedUsers: 1,
          knownPasswordRejected: true,
          rotationAttempts: attempt,
        };
      }
    }
    fail("known_password_reusable");
  } catch (error) {
    return { ok: false, error: resultError(error) };
  }
}
