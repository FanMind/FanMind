import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

import {
  STAGING_EMAIL_ACCEPTANCE_CONFIRMATION,
  STAGING_EMAIL_ACCEPTANCE_ENVIRONMENT,
  STAGING_EMAIL_ACCEPTANCE_FROM,
  STAGING_EMAIL_ACCEPTANCE_TO,
  STAGING_EMAIL_SCOPE_ATTESTATION,
  buildStagingEmailAcceptancePayload,
  evaluateStagingEmailAcceptanceEnvironment,
  runStagingEmailProviderPreflight,
  sendStagingEmailProviderAcceptance,
  validateEnvironmentProtection,
} from "../src/lib/stagingEmailProviderAcceptancePolicy.mjs";

const execFileAsync = promisify(execFile);
const COMMIT = "a".repeat(40);
const DKIM = `p=${"A".repeat(64)}`;
const DKIM_SHA256 = createHash("sha256").update(DKIM).digest("hex");
const SCRIPT = "scripts/operations/staging-email-provider-acceptance.mjs";
const WORKFLOW = ".github/workflows/staging-email-provider-acceptance.yml";
const PROVISIONING = ".github/workflows/provision-staging-host.yml";
const STAGING_ENV = ".env.staging.example";
const RUNBOOK = "docs/operations/STAGING_EMAIL_PROVIDER_ACCEPTANCE.md";
const REQUIRED_HEALTH_COMPONENTS = Object.freeze([
  "application",
  "supabase_config",
  "supabase_database",
  "supabase_storage",
  "stripe_config",
  "openai_config",
  "shared_rate_limit_config",
]);

function environment(overrides = {}) {
  return {
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    FANMIND_STAGING_APP_URL: "https://staging.fanmind.ch",
    FANMIND_STAGING_EMAIL_ACCEPTANCE_ENVIRONMENT:
      STAGING_EMAIL_ACCEPTANCE_ENVIRONMENT,
    FANMIND_STAGING_EMAIL_REVIEWED_COMMIT: COMMIT,
    FANMIND_STAGING_EMAIL_CONFIRM: STAGING_EMAIL_ACCEPTANCE_CONFIRMATION,
    FANMIND_STAGING_EMAIL_SCOPE_ATTESTATION:
      STAGING_EMAIL_SCOPE_ATTESTATION,
    FANMIND_STAGING_EMAIL_EXPECTED_MX:
      "feedback-smtp.eu-west-1.amazonses.com",
    FANMIND_STAGING_EMAIL_DKIM_SHA256: DKIM_SHA256,
    FANMIND_STAGING_EMAIL_ACCEPTANCE_RESEND_KEY: `re_${"x".repeat(32)}`,
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: COMMIT,
    GITHUB_REPOSITORY: "Bernds-tech/FanMind",
    GITHUB_REPOSITORY_ID: "1259448985",
    GITHUB_API_URL: "https://api.github.com",
    GITHUB_TOKEN: "github-synthetic-token",
    RESEND_API_KEY: "",
    FANMIND_NOTIFICATION_FROM: "",
    ...overrides,
  };
}

function preflightEnvironment(overrides = {}) {
  return environment({
    FANMIND_STAGING_EMAIL_ACCEPTANCE_RESEND_KEY: "",
    ...overrides,
  });
}

function sendEnvironment(overrides = {}) {
  return environment({ GITHUB_TOKEN: "", ...overrides });
}

function protectedEnvironment(overrides = {}) {
  return {
    name: STAGING_EMAIL_ACCEPTANCE_ENVIRONMENT,
    can_admins_bypass: false,
    protection_rules: [
      {
        type: "required_reviewers",
        prevent_self_review: true,
        reviewers: [{ type: "User", reviewer: { id: 123 } }],
      },
    ],
    deployment_branch_policy: {
      protected_branches: false,
      custom_branch_policies: true,
    },
    ...overrides,
  };
}

function branchPolicies(overrides = {}) {
  return {
    total_count: 1,
    branch_policies: [{ id: 321, name: "main" }],
    ...overrides,
  };
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function positiveDependencies(calls) {
  return {
    resolveMxImplementation: async (name) => {
      calls.push({ kind: "mx", name });
      return [
        {
          priority: 10,
          exchange: "feedback-smtp.eu-west-1.amazonses.com",
        },
      ];
    },
    resolveTxtImplementation: async (name) => {
      calls.push({ kind: "txt", name });
      return name.startsWith("resend._domainkey.")
        ? [[DKIM]]
        : [["v=spf1 include:amazonses.com ~all"]];
    },
    fetchImplementation: async (url, options) => {
      const request = { kind: "fetch", url: String(url), options };
      calls.push(request);
      if (request.url.endsWith("/environments/staging-email-acceptance")) {
        return jsonResponse(200, protectedEnvironment());
      }
      if (request.url.endsWith("/deployment-branch-policies")) {
        return jsonResponse(200, branchPolicies());
      }
      if (request.url.endsWith("/git/ref/heads/main")) {
        return jsonResponse(200, { object: { sha: COMMIT } });
      }
      if (request.url === "https://staging.fanmind.ch/api/version") {
        return jsonResponse(200, {
          application: "fanmind",
          releaseCommit: COMMIT,
          runtimeEnvironment: "staging",
        });
      }
      if (request.url === "https://staging.fanmind.ch/api/health") {
        return jsonResponse(207, {
          status: "degraded",
          scope: "public",
          checks: [
            ...REQUIRED_HEALTH_COMPONENTS.map((component) => ({
              component,
              status: "healthy",
            })),
            { component: "email_config", status: "unknown" },
          ],
        });
      }
      if (request.url === "https://api.resend.com/api-keys") {
        return jsonResponse(401, { name: "restricted_api_key" });
      }
      if (request.url === "https://api.resend.com/emails") {
        return jsonResponse(200, {
          id: "123e4567-e89b-42d3-a456-426614174000",
        });
      }
      throw new Error("unexpected request");
    },
  };
}

test("preflight and send environments split tokens and keep app mail disabled", () => {
  assert.equal(
    evaluateStagingEmailAcceptanceEnvironment(preflightEnvironment(), {
      mode: "preflight",
    }).ok,
    true,
  );
  assert.equal(
    evaluateStagingEmailAcceptanceEnvironment(sendEnvironment(), {
      mode: "send",
    }).ok,
    true,
  );

  for (const [overrides, error] of [
    [{ FANMIND_RUNTIME_ENVIRONMENT: "production" }, "runtime_environment"],
    [{ FANMIND_STAGING_APP_URL: "https://fanmind.ch" }, "application_boundary"],
    [{ GITHUB_REF: "refs/heads/feature" }, "reviewed_commit"],
    [{ GITHUB_SHA: "b".repeat(40) }, "reviewed_commit"],
    [{ FANMIND_STAGING_EMAIL_CONFIRM: "yes" }, "confirmation"],
    [{ FANMIND_STAGING_EMAIL_SCOPE_ATTESTATION: "sending_access" }, "scope_attestation"],
    [{ FANMIND_STAGING_EMAIL_EXPECTED_MX: "smtp.example.com" }, "expected_mx"],
    [{ FANMIND_STAGING_EMAIL_DKIM_SHA256: "short" }, "dkim_fingerprint"],
    [{ GITHUB_REPOSITORY_ID: "1" }, "repository_boundary"],
    [{ RESEND_API_KEY: "re_forbidden" }, "application_runtime_email"],
    [{ FANMIND_NOTIFICATION_FROM: STAGING_EMAIL_ACCEPTANCE_FROM }, "application_runtime_email"],
  ]) {
    assert.ok(
      evaluateStagingEmailAcceptanceEnvironment(environment(overrides)).errors.includes(error),
      error,
    );
  }
  assert.ok(
    evaluateStagingEmailAcceptanceEnvironment(
      preflightEnvironment({
        FANMIND_STAGING_EMAIL_ACCEPTANCE_RESEND_KEY: `re_${"x".repeat(32)}`,
      }),
      { mode: "preflight" },
    ).errors.includes("resend_key_exposed_to_preflight"),
  );
  assert.ok(
    evaluateStagingEmailAcceptanceEnvironment(
      sendEnvironment({ GITHUB_TOKEN: "github-token" }),
      { mode: "send" },
    ).errors.includes("github_token_exposed_to_send"),
  );
  assert.equal(
    evaluateStagingEmailAcceptanceEnvironment(
      environment({
        FANMIND_STAGING_EMAIL_EXPECTED_MX:
          "feedback-smtp.ap-northeast-1.amazonses.com",
      }),
    ).ok,
    true,
  );
});

test("the payload has exactly one provider-owned recipient and fixed harmless content", () => {
  const payload = buildStagingEmailAcceptancePayload(COMMIT);
  assert.deepEqual(Object.keys(payload).sort(), ["from", "subject", "text", "to"]);
  assert.equal(payload.from, STAGING_EMAIL_ACCEPTANCE_FROM);
  assert.deepEqual(payload.to, [STAGING_EMAIL_ACCEPTANCE_TO]);
  assert.doesNotMatch(payload.subject, new RegExp(COMMIT, "u"));
  assert.doesNotMatch(payload.text, new RegExp(COMMIT, "u"));
  for (const forbidden of [
    "cc",
    "bcc",
    "reply_to",
    "html",
    "attachments",
    "scheduled_at",
    "tags",
  ]) {
    assert.equal(Object.hasOwn(payload, forbidden), false);
  }
  assert.throws(
    () => buildStagingEmailAcceptancePayload("short"),
    /STAGING_EMAIL_ACCEPTANCE_ERROR=reviewed_commit/u,
  );
});

test("environment protection requires nested reviewers, self-review denial, no bypass and main only", () => {
  assert.equal(
    validateEnvironmentProtection(protectedEnvironment(), branchPolicies()),
    true,
  );
  for (const [protection, branches] of [
    [protectedEnvironment({ can_admins_bypass: true }), branchPolicies()],
    [protectedEnvironment({ protection_rules: [] }), branchPolicies()],
    [
      protectedEnvironment({
        protection_rules: [
          {
            type: "required_reviewers",
            prevent_self_review: false,
            reviewers: [{ type: "User", reviewer: { id: 123 } }],
          },
        ],
      }),
      branchPolicies(),
    ],
    [protectedEnvironment(), branchPolicies({ total_count: 2 })],
    [protectedEnvironment(), branchPolicies({ branch_policies: [{ id: 1, name: "release/*" }] })],
  ]) {
    assert.equal(validateEnvironmentProtection(protection, branches), false);
  }
});

test("preflight checks exact protected current-main, deployed runtime, health and DNS without Resend", async () => {
  const calls = [];
  const result = await runStagingEmailProviderPreflight(
    preflightEnvironment(),
    positiveDependencies(calls),
  );
  assert.deepEqual(result, { ok: true, error: null, providerCalls: 0 });
  const fetches = calls.filter((call) => call.kind === "fetch");
  assert.deepEqual(
    fetches.map((call) => call.url),
    [
      "https://api.github.com/repos/Bernds-tech/FanMind/environments/staging-email-acceptance",
      "https://api.github.com/repos/Bernds-tech/FanMind/environments/staging-email-acceptance/deployment-branch-policies",
      "https://api.github.com/repos/Bernds-tech/FanMind/git/ref/heads/main",
      "https://staging.fanmind.ch/api/version",
      "https://staging.fanmind.ch/api/health",
    ],
  );
  assert.equal(fetches.some((call) => call.url.includes("api.resend.com")), false);
});

test("send rechecks public boundaries and performs exactly two fixed Resend operations", async () => {
  const calls = [];
  const result = await sendStagingEmailProviderAcceptance(
    sendEnvironment(),
    positiveDependencies(calls),
  );
  assert.deepEqual(result, { ok: true, error: null, providerCalls: 2 });
  const resend = calls.filter(
    (call) => call.kind === "fetch" && call.url.includes("api.resend.com"),
  );
  assert.deepEqual(
    resend.map((call) => call.url),
    ["https://api.resend.com/api-keys", "https://api.resend.com/emails"],
  );
  assert.equal(resend[0].options.method, undefined);
  assert.equal(resend[0].options.redirect, "error");
  assert.equal(resend[1].options.method, "POST");
  assert.equal(
    resend[1].options.headers["Idempotency-Key"],
    `fanmind-staging-provider/${COMMIT}`,
  );
  assert.deepEqual(
    JSON.parse(resend[1].options.body),
    buildStagingEmailAcceptancePayload(COMMIT),
  );
  assert.ok(
    resend.every(
      (call) =>
        call.options.headers.Authorization ===
          `Bearer re_${"x".repeat(32)}` &&
        call.options.headers["User-Agent"] ===
          "FanMind-Staging-Email-Acceptance/1.0",
    ),
  );
  assert.deepEqual(
    calls.filter((call) => call.kind === "mx" || call.kind === "txt").map((call) => call.name),
    [
      "send.mail.staging.fanmind.ch",
      "send.mail.staging.fanmind.ch",
      "resend._domainkey.mail.staging.fanmind.ch",
    ],
  );
});

test("invalid boundaries and indeterminate POST never claim success", async () => {
  const noCalls = [];
  assert.deepEqual(
    await sendStagingEmailProviderAcceptance(
      sendEnvironment({ GITHUB_SHA: "b".repeat(40) }),
      positiveDependencies(noCalls),
    ),
    { ok: false, error: "reviewed_commit", providerCalls: 0 },
  );
  assert.equal(noCalls.length, 0);

  const calls = [];
  const dependencies = positiveDependencies(calls);
  const originalFetch = dependencies.fetchImplementation;
  dependencies.fetchImplementation = async (url, options) => {
    if (String(url) === "https://api.resend.com/emails") {
      throw new Error("synthetic timeout after request start");
    }
    return originalFetch(url, options);
  };
  assert.deepEqual(
    await sendStagingEmailProviderAcceptance(sendEnvironment(), dependencies),
    { ok: false, error: "send_indeterminate", providerCalls: 2 },
  );

  const rejectedCalls = [];
  const rejectedDependencies = positiveDependencies(rejectedCalls);
  const positiveFetch = rejectedDependencies.fetchImplementation;
  rejectedDependencies.fetchImplementation = async (url, options) =>
    String(url) === "https://api.resend.com/emails"
      ? jsonResponse(503, { name: "provider_unavailable" })
      : positiveFetch(url, options);
  assert.deepEqual(
    await sendStagingEmailProviderAcceptance(
      sendEnvironment(),
      rejectedDependencies,
    ),
    { ok: false, error: "send_indeterminate", providerCalls: 2 },
  );
});

test("missing or unhealthy required public health components block before provider access", async () => {
  for (const checks of [
    [{ component: "email_config", status: "unknown" }],
    [
      ...REQUIRED_HEALTH_COMPONENTS.map((component) => ({
        component,
        status: component === "openai_config" ? "unknown" : "healthy",
      })),
      { component: "email_config", status: "unknown" },
    ],
  ]) {
    const calls = [];
    const dependencies = positiveDependencies(calls);
    const positiveFetch = dependencies.fetchImplementation;
    dependencies.fetchImplementation = async (url, options) =>
      String(url) === "https://staging.fanmind.ch/api/health"
        ? jsonResponse(207, { status: "degraded", scope: "public", checks })
        : positiveFetch(url, options);
    assert.deepEqual(
      await sendStagingEmailProviderAcceptance(
        sendEnvironment(),
        dependencies,
      ),
      { ok: false, error: "application_email_runtime", providerCalls: 0 },
    );
    assert.equal(
      calls.some(
        (call) =>
          call.kind === "fetch" && call.url.includes("api.resend.com"),
      ),
      false,
    );
  }
});

test("offline CLI and workflow isolate the key from dispatch, preflight and app runtime", async () => {
  const [{ stdout, stderr }, workflow, provisioning, stagingEnv, runbook] =
    await Promise.all([
      execFileAsync(process.execPath, [SCRIPT, "--check"], {
        env: { PATH: process.env.PATH },
      }),
      readFile(WORKFLOW, "utf8"),
      readFile(PROVISIONING, "utf8"),
      readFile(STAGING_ENV, "utf8"),
      readFile(RUNBOOK, "utf8"),
    ]);
  assert.equal(stderr, "");
  assert.match(stdout, /STAGING_EMAIL_ACCEPTANCE_NETWORK_CALLS=0/u);
  assert.match(stdout, /STAGING_APP_EMAIL_RUNTIME=DISABLED/u);

  assert.match(workflow, /^on:\n  workflow_dispatch:/mu);
  assert.doesNotMatch(workflow, /^\s{2}(?:push|schedule|workflow_call):/mu);
  assert.match(workflow, /validate-dispatch:/u);
  assert.match(workflow, /\[\[ "\$GITHUB_REF" == refs\/heads\/main \]\]/u);
  assert.match(workflow, /\[\[ "\$REQUESTED_COMMIT" == "\$GITHUB_SHA" \]\]/u);
  assert.match(workflow, /needs: validate-dispatch/u);
  assert.match(workflow, /environment: staging-email-acceptance/u);
  assert.match(workflow, /permissions:\n  actions: read\n  contents: read/u);
  assert.match(workflow, /persist-credentials: false/u);

  const preflight = workflow.slice(
    workflow.indexOf("- name: Verify protected GitHub"),
    workflow.indexOf("- name: Recheck public boundary"),
  );
  const send = workflow.slice(workflow.indexOf("- name: Recheck public boundary"));
  assert.match(preflight, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/u);
  assert.match(preflight, /FANMIND_STAGING_EMAIL_ACCEPTANCE_RESEND_KEY: ''/u);
  assert.doesNotMatch(preflight, /secrets\.FANMIND_STAGING_EMAIL_ACCEPTANCE_RESEND_KEY/u);
  assert.match(
    send,
    /FANMIND_STAGING_EMAIL_ACCEPTANCE_RESEND_KEY: \$\{\{ secrets\.FANMIND_STAGING_EMAIL_ACCEPTANCE_RESEND_KEY \}\}/u,
  );
  assert.doesNotMatch(send, /github\.token/u);
  assert.match(send, /unset GITHUB_TOKEN/u);
  assert.match(send, /RESEND_API_KEY: ''/u);
  assert.match(send, /FANMIND_NOTIFICATION_FROM: ''/u);

  assert.doesNotMatch(provisioning, /RESEND_API_KEY|FANMIND_NOTIFICATION_FROM|STAGING_RESEND/u);
  assert.match(stagingEnv, /^RESEND_API_KEY=$/mu);
  assert.match(stagingEnv, /^FANMIND_NOTIFICATION_FROM=$/mu);
  assert.match(runbook, /keine Resend-Fernattestierung/u);
  assert.match(runbook, /erreicht keinen menschlichen Empfänger/u);
  assert.match(runbook, /email_config=unknown/u);
  assert.match(runbook, /INDETERMINATE_NO_RETRY/u);
});
