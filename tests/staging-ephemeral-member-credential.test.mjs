import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import {
  chmod,
  link,
  mkdtemp,
  open,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  STAGING_EPHEMERAL_MEMBER_ACTIVATE_CONFIRMATION,
  STAGING_EPHEMERAL_MEMBER_MARKER,
  STAGING_EPHEMERAL_MEMBER_MARKER_KEY,
  STAGING_EPHEMERAL_MEMBER_MARKER_VERSION,
  STAGING_EPHEMERAL_MEMBER_MARKER_VERSION_KEY,
  STAGING_EPHEMERAL_MEMBER_REVOKE_CONFIRMATION,
  activateStagingEphemeralMemberCredential,
  evaluateStagingEphemeralMemberCredentialEnvironment,
  generateStrongEphemeralMemberPassword,
  isStrongEphemeralMemberPassword,
  revokeStagingEphemeralMemberCredential,
} from "../src/lib/stagingEphemeralMemberCredentialPolicy.mjs";
import {
  STAGING_SYNTHETIC_MEMBER_EMAIL,
  STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME,
} from "../src/lib/stagingSyntheticFixturePolicy.mjs";
import { appendEphemeralPasswordToGithubEnvironment } from "../scripts/operations/staging-ephemeral-member-credential.mjs";

const COMMIT = "a".repeat(40);
const MEMBER_ID = "55555555-5555-4555-8555-555555555555";
const OWNER_ID = "66666666-6666-4666-8666-666666666666";
const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const SERVICE_KEY = `sb_secret_${"s".repeat(40)}`;
const ANON_KEY = `sb_publishable_${"p".repeat(40)}`;
const ACTIVE_PASSWORD = generateStrongEphemeralMemberPassword(() =>
  Buffer.alloc(48, 11),
);

function environment(mode = "activate", overrides = {}) {
  return {
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.ch",
    FANMIND_STAGING_SUPABASE_URL:
      "https://stagingprojectref.supabase.co",
    FANMIND_TARGET_SUPABASE_PROJECT_REF: "stagingprojectref",
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionprojectref",
    FANMIND_STAGING_EPHEMERAL_MEMBER_REVIEWED_COMMIT: COMMIT,
    FANMIND_STAGING_EPHEMERAL_MEMBER_CONFIRM:
      mode === "revoke"
        ? STAGING_EPHEMERAL_MEMBER_REVOKE_CONFIRMATION
        : STAGING_EPHEMERAL_MEMBER_ACTIVATE_CONFIRMATION,
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    FANMIND_STAGING_E2E_WORKSPACE_ID: WORKSPACE_ID,
    FANMIND_STAGING_E2E_MEMBER_PASSWORD: ACTIVE_PASSWORD,
    FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    FANMIND_STAGING_SUPABASE_ANON_KEY: ANON_KEY,
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: COMMIT,
    NODE_OPTIONS: "",
    NODE_EXTRA_CA_CERTS: "",
    NODE_USE_ENV_PROXY: "",
    HTTP_PROXY: "",
    HTTPS_PROXY: "",
    ALL_PROXY: "",
    http_proxy: "",
    https_proxy: "",
    all_proxy: "",
    ...overrides,
  };
}

function jsonResponse(status, payload) {
  if (status === 204) return new Response(null, { status });
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function markedUser(overrides = {}) {
  return {
    id: MEMBER_ID,
    email: STAGING_SYNTHETIC_MEMBER_EMAIL,
    email_confirmed_at: "2026-08-17T00:00:00.000Z",
    user_metadata: {
      [STAGING_EPHEMERAL_MEMBER_MARKER_KEY]:
        STAGING_EPHEMERAL_MEMBER_MARKER,
      [STAGING_EPHEMERAL_MEMBER_MARKER_VERSION_KEY]:
        STAGING_EPHEMERAL_MEMBER_MARKER_VERSION,
    },
    ...overrides,
  };
}

function positiveFetch(calls, options = {}) {
  let tokenRequests = 0;
  let profileRequests = 0;
  let userRequests = 0;
  let membershipRequests = 0;
  let workspaceRequests = 0;
  let updateRequests = 0;
  return async (url, request = {}) => {
    const parsed = new URL(String(url));
    const call = {
      url: parsed.toString(),
      pathname: parsed.pathname,
      method: request.method ?? "GET",
      headers: request.headers ?? {},
      body: request.body,
    };
    calls.push(call);
    if (parsed.pathname === "/rest/v1/profiles") {
      profileRequests += 1;
      const profiles =
        typeof options.profiles === "function"
          ? options.profiles(profileRequests)
          : options.profiles;
      return jsonResponse(
        200,
        profiles ?? [
          { id: MEMBER_ID, email: STAGING_SYNTHETIC_MEMBER_EMAIL },
        ],
      );
    }
    if (
      parsed.pathname === `/auth/v1/admin/users/${MEMBER_ID}` &&
      call.method === "GET"
    ) {
      userRequests += 1;
      const user =
        typeof options.user === "function"
          ? options.user(userRequests)
          : options.user;
      return jsonResponse(200, user ?? markedUser());
    }
    if (parsed.pathname === "/rest/v1/workspace_members") {
      membershipRequests += 1;
      const memberships =
        typeof options.memberships === "function"
          ? options.memberships(membershipRequests)
          : options.memberships;
      return jsonResponse(
        200,
        memberships ?? [
          { workspace_id: WORKSPACE_ID, user_id: MEMBER_ID, role: "member" },
        ],
      );
    }
    if (parsed.pathname === "/rest/v1/workspaces") {
      workspaceRequests += 1;
      const workspaces =
        typeof options.workspaces === "function"
          ? options.workspaces(workspaceRequests)
          : options.workspaces;
      return jsonResponse(
        200,
        workspaces ?? [
          {
            id: WORKSPACE_ID,
            name: STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME,
            owner_user_id: OWNER_ID,
            billing_status: "active",
            workspace_access_mode: "active",
            test_access_flags: { staging_synthetic_fixture: true },
          },
        ],
      );
    }
    if (
      parsed.pathname === `/auth/v1/admin/users/${MEMBER_ID}` &&
      call.method === "PUT"
    ) {
      updateRequests += 1;
      if (typeof options.onUpdate === "function") {
        const result = await options.onUpdate(updateRequests, call);
        if (result) return result;
      }
      const updatedUser =
        typeof options.updatedUser === "function"
          ? options.updatedUser(updateRequests)
          : options.updatedUser;
      return jsonResponse(200, updatedUser ?? markedUser());
    }
    if (parsed.pathname === "/auth/v1/token") {
      tokenRequests += 1;
      if (options.tokenPayload) return jsonResponse(400, options.tokenPayload);
      if (
        typeof options.tokenResponse === "function"
          ? options.tokenResponse(tokenRequests) === "accepted"
          : false
      ) {
        return jsonResponse(200, {
          access_token: `synthetic-member-access-token-${tokenRequests}`,
          user: { id: MEMBER_ID, email: STAGING_SYNTHETIC_MEMBER_EMAIL },
        });
      }
      return jsonResponse(400, {
        code: "invalid_credentials",
        message: "Invalid login credentials",
      });
    }
    if (parsed.pathname === "/auth/v1/logout") {
      return jsonResponse(204);
    }
    throw new Error(`unexpected request: ${parsed.pathname}`);
  };
}

test("environment is exact Staging/main and never needs owner credentials", () => {
  assert.deepEqual(
    evaluateStagingEphemeralMemberCredentialEnvironment(
      environment("activate"),
      { mode: "activate" },
    ),
    { ok: true, errors: [] },
  );
  assert.deepEqual(
    evaluateStagingEphemeralMemberCredentialEnvironment(environment("revoke"), {
      mode: "revoke",
    }),
    { ok: true, errors: [] },
  );
  for (const [mode, overrides, expected] of [
    ["activate", { FANMIND_RUNTIME_ENVIRONMENT: "production" }, "runtime_environment"],
    ["activate", { NEXT_PUBLIC_APP_URL: "https://fanmind.ch" }, "application_boundary"],
    ["activate", { FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionprojectref" }, "supabase_boundary"],
    ["activate", { GITHUB_REF: "refs/heads/feature" }, "reviewed_commit"],
    ["activate", { FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false" }, "write_confirmation"],
    ["activate", { FANMIND_STAGING_EPHEMERAL_MEMBER_CONFIRM: "yes" }, "operation_confirmation"],
    ["activate", { FANMIND_STAGING_E2E_WORKSPACE_ID: "not-a-uuid" }, "workspace_identity"],
    ["activate", { FANMIND_STAGING_E2E_MEMBER_PASSWORD: "short" }, "member_password"],
    ["activate", { FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY: "invalid" }, "service_role_key"],
    ["revoke", { FANMIND_STAGING_SUPABASE_ANON_KEY: "invalid" }, "publishable_key"],
    ["activate", { NODE_OPTIONS: "--require /tmp/redirect.cjs" }, "network_redirect"],
  ]) {
    const result = evaluateStagingEphemeralMemberCredentialEnvironment(
      environment(mode, overrides),
      { mode },
    );
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes(expected), expected);
  }
});

test("member credential policy never reads owner or secondary credentials", async () => {
  const forbiddenCredentialKeys = new Set([
    "FANMIND_STAGING_E2E_PASSWORD",
    "FANMIND_E2E_STAGING_PASSWORD",
    "FANMIND_STAGING_E2E_SECONDARY_EMAIL",
    "FANMIND_STAGING_E2E_SECONDARY_PASSWORD",
    "FANMIND_E2E_STAGING_SECONDARY_EMAIL",
    "FANMIND_E2E_STAGING_SECONDARY_PASSWORD",
  ]);
  for (const mode of ["activate", "revoke"]) {
    const guardedEnvironment = new Proxy(environment(mode), {
      get(target, property, receiver) {
        if (forbiddenCredentialKeys.has(property)) {
          throw new Error(`forbidden credential access: ${String(property)}`);
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const calls = [];
    const runner =
      mode === "activate"
        ? activateStagingEphemeralMemberCredential
        : revokeStagingEphemeralMemberCredential;
    const result = await runner(guardedEnvironment, {
      fetchImplementation: positiveFetch(calls),
      randomBytesImplementation: () => Buffer.alloc(48, 23),
    });
    assert.equal(result.ok, true);
    assert.equal(calls.some((call) => call.method === "PUT"), true);
  }
});

test("password generation has fixed high entropy, required classes and no control bytes", () => {
  const first = generateStrongEphemeralMemberPassword(() =>
    Buffer.alloc(48, 1),
  );
  const second = generateStrongEphemeralMemberPassword(() =>
    Buffer.alloc(48, 2),
  );
  assert.equal(isStrongEphemeralMemberPassword(first), true);
  assert.equal(isStrongEphemeralMemberPassword(second), true);
  assert.notEqual(first, second);
  assert.match(first, /^Fm1![A-Za-z0-9_-]{64}$/u);
  assert.doesNotMatch(first, /[\r\n=]/u);
  assert.throws(
    () => generateStrongEphemeralMemberPassword(() => Buffer.alloc(16)),
    /random_source_invalid/u,
  );
});

test("GITHUB_ENV is forced to an exact private regular file before append", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "fanmind-member-env-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const githubEnvironmentPath = join(directory, "github-env");
  await writeFile(githubEnvironmentPath, "", { mode: 0o644 });
  await chmod(githubEnvironmentPath, 0o644);

  appendEphemeralPasswordToGithubEnvironment(ACTIVE_PASSWORD, {
    GITHUB_ENV: githubEnvironmentPath,
  });

  const fileHandle = await open(
    githubEnvironmentPath,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const fileStat = await fileHandle.stat();
    assert.equal(fileStat.isFile(), true);
    assert.equal(fileStat.nlink, 1);
    assert.equal(fileStat.mode & 0o777, 0o600);
    assert.equal(
      await fileHandle.readFile("utf8"),
      [
        `FANMIND_STAGING_E2E_MEMBER_PASSWORD=${ACTIVE_PASSWORD}`,
        `FANMIND_E2E_STAGING_MEMBER_PASSWORD=${ACTIVE_PASSWORD}`,
        "",
      ].join("\n"),
    );
  } finally {
    await fileHandle.close();
  }
});

test("GITHUB_ENV hardlink is rejected before any credential append", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "fanmind-member-env-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sourcePath = join(directory, "source");
  const githubEnvironmentPath = join(directory, "github-env");
  await writeFile(sourcePath, "sentinel\n", { mode: 0o644 });
  await link(sourcePath, githubEnvironmentPath);

  assert.throws(
    () =>
      appendEphemeralPasswordToGithubEnvironment(ACTIVE_PASSWORD, {
        GITHUB_ENV: githubEnvironmentPath,
      }),
    /github_environment_file_invalid/u,
  );
  assert.equal(await readFile(sourcePath, "utf8"), "sentinel\n");
  const fileStat = await stat(githubEnvironmentPath);
  assert.equal(fileStat.nlink, 2);
  assert.equal(fileStat.mode & 0o777, 0o644);
});

test("activation resolves one fixed profile and fully re-reads Auth, membership and workspace after update", async () => {
  const calls = [];
  const result = await activateStagingEphemeralMemberCredential(
    environment("activate"),
    { fetchImplementation: positiveFetch(calls) },
  );
  assert.deepEqual(result, { ok: true, updatedUsers: 1 });
  assert.deepEqual(
    calls.map(({ pathname, method }) => `${method} ${pathname}`),
    [
      "GET /rest/v1/profiles",
      `GET /auth/v1/admin/users/${MEMBER_ID}`,
      "GET /rest/v1/workspace_members",
      "GET /rest/v1/workspaces",
      `PUT /auth/v1/admin/users/${MEMBER_ID}`,
      "GET /rest/v1/profiles",
      `GET /auth/v1/admin/users/${MEMBER_ID}`,
      "GET /rest/v1/workspace_members",
      "GET /rest/v1/workspaces",
    ],
  );
  const update = calls.find((call) => call.method === "PUT");
  assert.deepEqual(JSON.parse(update.body), { password: ACTIVE_PASSWORD });
  assert.equal(update.headers.apikey, SERVICE_KEY);
  const profileLookup = new URL(calls[0].url);
  assert.equal(
    profileLookup.searchParams.get("email"),
    `eq.${STAGING_SYNTHETIC_MEMBER_EMAIL}`,
  );
  assert.equal(profileLookup.searchParams.get("limit"), "2");
  assert.doesNotMatch(
    calls.map((call) => call.body ?? "").join("\n"),
    /owner|secondary|user_metadata|email_confirm/iu,
  );
});

test("activation refuses a foreign marker or cross-workspace membership before mutation", async () => {
  for (const options of [
    {
      user: markedUser({
        user_metadata: {
          [STAGING_EPHEMERAL_MEMBER_MARKER_KEY]: "primary",
          [STAGING_EPHEMERAL_MEMBER_MARKER_VERSION_KEY]: 1,
        },
      }),
    },
    {
      memberships: [
        { workspace_id: WORKSPACE_ID, user_id: MEMBER_ID, role: "member" },
        { workspace_id: OWNER_ID, user_id: MEMBER_ID, role: "member" },
      ],
    },
    {
      workspaces: [
        {
          id: WORKSPACE_ID,
          name: STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME,
          owner_user_id: OWNER_ID,
          billing_status: "active",
          workspace_access_mode: "active",
          test_access_flags: { staging_synthetic_fixture: false },
        },
      ],
    },
  ]) {
    const calls = [];
    const result = await activateStagingEphemeralMemberCredential(
      environment("activate"),
      { fetchImplementation: positiveFetch(calls, options) },
    );
    assert.equal(result.ok, false);
    assert.equal(
      calls.some((call) => call.method === "PUT"),
      false,
    );
  }
});

test("profile binding drift after PUT stays red and compensates only the pre-bound member UUID", async () => {
  const calls = [];
  const result = await activateStagingEphemeralMemberCredential(
    environment("activate"),
    {
      fetchImplementation: positiveFetch(calls, {
        profiles: (requestNumber) =>
          requestNumber === 1
            ? [{ id: MEMBER_ID, email: STAGING_SYNTHETIC_MEMBER_EMAIL }]
            : [{ id: OWNER_ID, email: STAGING_SYNTHETIC_MEMBER_EMAIL }],
      }),
      randomBytesImplementation: () => Buffer.alloc(48, 22),
    },
  );

  assert.deepEqual(result, {
    ok: false,
    error: "post_update_contract_drift_compensated",
  });
  const updates = calls.filter((call) => call.method === "PUT");
  assert.equal(updates.length, 2);
  assert.equal(updates.every((call) => call.pathname.endsWith(MEMBER_ID)), true);
  assert.equal(calls.some((call) => call.pathname.endsWith(OWNER_ID)), false);
  assert.equal(JSON.parse(updates[0].body).password, ACTIVE_PASSWORD);
  const compensationPassword = JSON.parse(updates[1].body).password;
  assert.equal(isStrongEphemeralMemberPassword(compensationPassword), true);
  assert.notEqual(compensationPassword, ACTIVE_PASSWORD);
});

test("membership drift after PUT stays red and compensation does not re-read membership", async () => {
  const calls = [];
  const result = await activateStagingEphemeralMemberCredential(
    environment("activate"),
    {
      fetchImplementation: positiveFetch(calls, {
        memberships: (requestNumber) =>
          requestNumber === 1
            ? [
                {
                  workspace_id: WORKSPACE_ID,
                  user_id: MEMBER_ID,
                  role: "member",
                },
              ]
            : [
                {
                  workspace_id: WORKSPACE_ID,
                  user_id: MEMBER_ID,
                  role: "member",
                },
                {
                  workspace_id: OWNER_ID,
                  user_id: MEMBER_ID,
                  role: "member",
                },
              ],
      }),
      randomBytesImplementation: () => Buffer.alloc(48, 22),
    },
  );

  assert.deepEqual(result, {
    ok: false,
    error: "post_update_contract_drift_compensated",
  });
  assert.equal(
    calls.filter((call) => call.pathname === "/rest/v1/workspace_members")
      .length,
    2,
  );
  const updates = calls.filter((call) => call.method === "PUT");
  assert.equal(updates.length, 2);
  assert.equal(updates.every((call) => call.pathname.endsWith(MEMBER_ID)), true);
  assert.notEqual(JSON.parse(updates[1].body).password, ACTIVE_PASSWORD);
});

test("workspace drift after PUT stays red and compensation remains bound to the member UUID", async () => {
  const calls = [];
  const result = await activateStagingEphemeralMemberCredential(
    environment("activate"),
    {
      fetchImplementation: positiveFetch(calls, {
        workspaces: (requestNumber) => [
          {
            id: WORKSPACE_ID,
            name: STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME,
            owner_user_id: OWNER_ID,
            billing_status: "active",
            workspace_access_mode: "active",
            test_access_flags: {
              staging_synthetic_fixture: requestNumber === 1,
            },
          },
        ],
      }),
      randomBytesImplementation: () => Buffer.alloc(48, 22),
    },
  );

  assert.deepEqual(result, {
    ok: false,
    error: "post_update_contract_drift_compensated",
  });
  assert.equal(
    calls.filter((call) => call.pathname === "/rest/v1/workspaces").length,
    2,
  );
  const updates = calls.filter((call) => call.method === "PUT");
  assert.equal(updates.length, 2);
  assert.equal(updates.every((call) => call.pathname.endsWith(MEMBER_ID)), true);
  assert.notEqual(JSON.parse(updates[1].body).password, ACTIVE_PASSWORD);
});

test("accepted-then-timeout Admin PUT stays red after one unknown compensating rotation", async () => {
  const calls = [];
  const result = await activateStagingEphemeralMemberCredential(
    environment("activate"),
    {
      fetchImplementation: positiveFetch(calls, {
        onUpdate: (requestNumber) => {
          if (requestNumber === 1) {
            throw new Error("timeout after provider accepted the request");
          }
          return undefined;
        },
      }),
      randomBytesImplementation: () => Buffer.alloc(48, 22),
    },
  );

  assert.deepEqual(result, {
    ok: false,
    error: "admin_update_indeterminate_compensated",
  });
  const updates = calls.filter((call) => call.method === "PUT");
  assert.equal(updates.length, 2);
  assert.equal(updates.every((call) => call.pathname.endsWith(MEMBER_ID)), true);
  assert.equal(JSON.parse(updates[0].body).password, ACTIVE_PASSWORD);
  const compensationPassword = JSON.parse(updates[1].body).password;
  assert.equal(isStrongEphemeralMemberPassword(compensationPassword), true);
  assert.notEqual(compensationPassword, ACTIVE_PASSWORD);
  assert.equal(
    calls.filter((call) => call.pathname === "/rest/v1/workspace_members")
      .length,
    1,
  );
});

test("compensation failure remains red and never retries the known member password", async () => {
  const calls = [];
  const result = await activateStagingEphemeralMemberCredential(
    environment("activate"),
    {
      fetchImplementation: positiveFetch(calls, {
        memberships: (requestNumber) =>
          requestNumber === 1
            ? [
                {
                  workspace_id: WORKSPACE_ID,
                  user_id: MEMBER_ID,
                  role: "member",
                },
              ]
            : [],
        onUpdate: (requestNumber) => {
          if (requestNumber === 2) {
            throw new Error("compensation failed");
          }
          return undefined;
        },
      }),
      randomBytesImplementation: () => Buffer.alloc(48, 22),
    },
  );

  assert.deepEqual(result, {
    ok: false,
    error: "post_update_contract_drift_compensation_failed",
  });
  const updates = calls.filter((call) => call.method === "PUT");
  assert.equal(updates.length, 2);
  assert.equal(JSON.parse(updates[0].body).password, ACTIVE_PASSWORD);
  assert.notEqual(JSON.parse(updates[1].body).password, ACTIVE_PASSWORD);
});

test("activation bounds provider responses before any mutation", async () => {
  const calls = [];
  const fetchImplementation = async (url, request) => {
    calls.push({ url: String(url), method: request.method });
    return new Response(`"${"x".repeat(300_000)}"`, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const result = await activateStagingEphemeralMemberCredential(
    environment("activate"),
    { fetchImplementation },
  );
  assert.deepEqual(result, { ok: false, error: "response_too_large" });
  assert.equal(calls.length, 1);
});

test("revoke rotates to an unpersisted password and proves the known password is rejected", async () => {
  const calls = [];
  let entropy = 20;
  const result = await revokeStagingEphemeralMemberCredential(
    environment("revoke"),
    {
      fetchImplementation: positiveFetch(calls),
      randomBytesImplementation: () => Buffer.alloc(48, entropy++),
    },
  );
  assert.deepEqual(result, {
    ok: true,
    updatedUsers: 1,
    knownPasswordRejected: true,
    rotationAttempts: 1,
  });
  const updates = calls.filter((call) => call.method === "PUT");
  assert.equal(updates.length, 1);
  const unknownPassword = JSON.parse(updates[0].body).password;
  assert.equal(isStrongEphemeralMemberPassword(unknownPassword), true);
  assert.notEqual(unknownPassword, ACTIVE_PASSWORD);
  const token = calls.find((call) => call.pathname === "/auth/v1/token");
  assert.deepEqual(JSON.parse(token.body), {
    email: STAGING_SYNTHETIC_MEMBER_EMAIL,
    password: ACTIVE_PASSWORD,
  });
  assert.equal(token.headers.apikey, ANON_KEY);
  assert.equal(token.headers["X-Supabase-Api-Version"], "2024-01-01");
  assert.equal(calls.some((call) => call.pathname === "/auth/v1/logout"), false);
});

test("revoke accepts only the exact legacy invalid-credentials response and rejects unrelated 400 bodies", async () => {
  const legacy = { error: "invalid_grant", error_description: "Invalid login credentials" };
  for (const [tokenPayload, accepted] of [
    [legacy, true],
    [{ error: "invalid_grant", error_description: "Email not confirmed" }, false],
    [{ error: "invalid_request", error_description: "Invalid login credentials" }, false],
    [{ ...legacy, code: "captcha_failed" }, false],
    [{ message: "Invalid login credentials" }, false],
  ]) {
    const calls = [];
    const result = await revokeStagingEphemeralMemberCredential(environment("revoke"), {
      fetchImplementation: positiveFetch(calls, { tokenPayload }),
      randomBytesImplementation: () => Buffer.alloc(48, 40),
    });
    assert.equal(result.ok, accepted);
    if (!accepted) assert.equal(result.error, "password_rejection_invalid");
    assert.equal(calls.filter(call => call.method === "PUT").length, 1);
  }
});

test("revoke bounds an unexpected known-password session, logs it out and rotates once more", async () => {
  const calls = [];
  let entropy = 30;
  const result = await revokeStagingEphemeralMemberCredential(
    environment("revoke"),
    {
      fetchImplementation: positiveFetch(calls, {
        tokenResponse: (requestNumber) =>
          requestNumber === 1 ? "accepted" : "rejected",
      }),
      randomBytesImplementation: () => Buffer.alloc(48, entropy++),
    },
  );
  assert.equal(result.ok, true);
  assert.equal(result.rotationAttempts, 2);
  assert.equal(calls.filter((call) => call.method === "PUT").length, 2);
  const logout = calls.find((call) => call.pathname === "/auth/v1/logout");
  assert.equal(logout.headers.apikey, ANON_KEY);
  assert.match(logout.headers.Authorization, /^Bearer synthetic-member-access-token-/u);
  assert.equal(
    calls.filter((call) => call.pathname === "/auth/v1/token").length,
    2,
  );
});

test("revoke rejects a repeated random source without writing the known password", async () => {
  const calls = [];
  const result = await revokeStagingEphemeralMemberCredential(
    environment("revoke"),
    {
      fetchImplementation: positiveFetch(calls),
      randomBytesImplementation: () => Buffer.alloc(48, 11),
    },
  );
  assert.deepEqual(result, { ok: false, error: "random_source_repeated" });
  assert.equal(calls.some((call) => call.method === "PUT"), false);
});

test("offline command has no network, secret or provider requirement", () => {
  const output = execFileSync(
    process.execPath,
    ["scripts/operations/staging-ephemeral-member-credential.mjs", "--check"],
    { encoding: "utf8" },
  );
  assert.match(
    output,
    /STAGING_EPHEMERAL_MEMBER_CREDENTIAL_CONTRACT=PASS/u,
  );
  assert.match(
    output,
    /STAGING_EPHEMERAL_MEMBER_CREDENTIAL_NETWORK_CALLS=0/u,
  );
  assert.match(output, /STAGING_EPHEMERAL_MEMBER_PERSISTED_SECRET=0/u);
});

test("Core and CSV workflow generates, masks, activates and always revokes without a persisted member secret", async () => {
  const [workflow, script] = await Promise.all([
    readFile(".github/workflows/browser-e2e-staging-write.yml", "utf8"),
    readFile(
      "scripts/operations/staging-ephemeral-member-credential.mjs",
      "utf8",
    ),
  ]);
  assert.doesNotMatch(
    workflow,
    /secrets\.FANMIND_STAGING_E2E_MEMBER_PASSWORD/u,
  );
  assert.match(workflow, /id: member_credential_generation/u);
  assert.match(workflow, /staging:member-credential:generate/u);
  assert.match(script, /::add-mask::\$\{password\}/u);
  assert.match(script, /environment\.GITHUB_ENV/u);
  assert.match(script, /FANMIND_STAGING_E2E_MEMBER_PASSWORD=\$\{password\}/u);
  assert.match(script, /FANMIND_E2E_STAGING_MEMBER_PASSWORD=\$\{password\}/u);
  assert.match(workflow, /id: member_credential_activation/u);
  assert.match(workflow, /staging:member-credential:activate/u);
  assert.match(workflow, /FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY:[\s\S]*secrets\.FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY/u);
  assert.match(workflow, /id: member_credential_cleanup/u);
  assert.match(
    workflow,
    /if: \$\{\{ always\(\) && steps\.member_credential_generation\.outcome == 'success' \}\}/u,
  );
  assert.match(workflow, /staging:member-credential:revoke/u);
  assert.match(
    workflow,
    /steps\.member_credential_cleanup\.outcome == 'success'/u,
  );
  assert.ok(
    workflow.indexOf("staging:member-credential:revoke") <
      workflow.indexOf("STAGING_CORE_CSV_ACCEPTANCE=PASS"),
  );
  const chromiumInstall = workflow.indexOf(
    "npx playwright install --with-deps chromium",
  );
  const generation = workflow.indexOf("staging:member-credential:generate");
  const activation = workflow.indexOf("staging:member-credential:activate");
  const prepare = workflow.indexOf("staging:core-csv:prepare");
  const browser = workflow.indexOf("test:e2e:staging-write");
  const revoke = workflow.indexOf("staging:member-credential:revoke");
  const finalPostflight = workflow.indexOf(
    "Recheck database postflight and exact deployed release",
  );
  assert.ok(
    chromiumInstall < generation &&
      generation < activation &&
      activation < prepare &&
      prepare < browser &&
      browser < revoke &&
      revoke < finalPostflight,
  );
  assert.match(workflow, /trap clear_member_environment EXIT/u);
  assert.match(
    workflow,
    /FANMIND_STAGING_E2E_MEMBER_PASSWORD='[\s\S]*FANMIND_E2E_STAGING_MEMBER_PASSWORD='/u,
  );
  assert.match(script, /STAGING_EPHEMERAL_MEMBER_KNOWN_PASSWORD_REJECTED=PASS/u);
});
