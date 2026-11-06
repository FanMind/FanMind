import { createHash } from "node:crypto";

import { evaluatePublicHealth } from "../../scripts/public-health-policy.mjs";

export const STAGING_EMAIL_ACCEPTANCE_CONFIRMATION =
  "send-one-staging-email-provider-acceptance";
export const STAGING_EMAIL_ACCEPTANCE_ENVIRONMENT =
  "staging-email-acceptance";
export const STAGING_EMAIL_ACCEPTANCE_APP_ORIGIN =
  "https://staging.fanmind.ch";
export const STAGING_EMAIL_ACCEPTANCE_DOMAIN =
  "mail.staging.fanmind.ch";
export const STAGING_EMAIL_ACCEPTANCE_FROM =
  "FanMind Staging <acceptance@mail.staging.fanmind.ch>";
export const STAGING_EMAIL_ACCEPTANCE_TO =
  "delivered+fanmind-staging@resend.dev";
export const STAGING_EMAIL_SCOPE_ATTESTATION =
  "sending_access-domain-restricted:mail.staging.fanmind.ch";

const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const RESEND_KEY_PATTERN = /^re_[A-Za-z0-9_-]{20,256}$/u;
const RESEND_MX_PATTERN =
  /^feedback-smtp\.(?:us-east-1|eu-west-1|sa-east-1|ap-northeast-1)\.amazonses\.com$/u;
const RESPONSE_LIMIT = 16 * 1024;
const GITHUB_REPOSITORY = "Bernds-tech/FanMind";
const GITHUB_REPOSITORY_ID = "1259448985";
const GITHUB_API_ORIGIN = "https://api.github.com";
const RESEND_API_ORIGIN = "https://api.resend.com";
const USER_AGENT = "FanMind-Staging-Email-Acceptance/1.0";

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanSecret(value) {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    /[\0\r\n]/u.test(value)
  ) {
    return "";
  }
  return value;
}

function exactOrigin(value) {
  try {
    const url = new URL(clean(value));
    if (
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

export function evaluateStagingEmailAcceptanceEnvironment(
  environment = {},
  { mode = "combined" } = {},
) {
  const errors = [];
  const reviewedCommit = clean(
    environment.FANMIND_STAGING_EMAIL_REVIEWED_COMMIT,
  ).toLowerCase();
  const githubSha = clean(environment.GITHUB_SHA).toLowerCase();
  const apiKey = cleanSecret(
    environment.FANMIND_STAGING_EMAIL_ACCEPTANCE_RESEND_KEY,
  );
  const expectedMx = clean(
    environment.FANMIND_STAGING_EMAIL_EXPECTED_MX,
  ).toLowerCase();
  const dkimSha256 = clean(
    environment.FANMIND_STAGING_EMAIL_DKIM_SHA256,
  ).toLowerCase();

  if (!new Set(["combined", "preflight", "send"]).has(mode)) {
    errors.push("mode");
  }
  if (clean(environment.FANMIND_RUNTIME_ENVIRONMENT) !== "staging") {
    errors.push("runtime_environment");
  }
  if (
    exactOrigin(environment.FANMIND_STAGING_APP_URL) !==
    STAGING_EMAIL_ACCEPTANCE_APP_ORIGIN
  ) {
    errors.push("application_boundary");
  }
  if (
    clean(environment.GITHUB_REF) !== "refs/heads/main" ||
    !COMMIT_PATTERN.test(reviewedCommit) ||
    reviewedCommit !== githubSha
  ) {
    errors.push("reviewed_commit");
  }
  if (
    clean(environment.FANMIND_STAGING_EMAIL_CONFIRM) !==
    STAGING_EMAIL_ACCEPTANCE_CONFIRMATION
  ) {
    errors.push("confirmation");
  }
  if (
    clean(environment.FANMIND_STAGING_EMAIL_ACCEPTANCE_ENVIRONMENT) !==
    STAGING_EMAIL_ACCEPTANCE_ENVIRONMENT
  ) {
    errors.push("github_environment");
  }
  if (
    clean(environment.FANMIND_STAGING_EMAIL_SCOPE_ATTESTATION) !==
    STAGING_EMAIL_SCOPE_ATTESTATION
  ) {
    errors.push("scope_attestation");
  }
  if (
    clean(environment.GITHUB_REPOSITORY) !== GITHUB_REPOSITORY ||
    clean(environment.GITHUB_REPOSITORY_ID) !== GITHUB_REPOSITORY_ID ||
    exactOrigin(environment.GITHUB_API_URL) !== GITHUB_API_ORIGIN
  ) {
    errors.push("repository_boundary");
  }
  if (!RESEND_MX_PATTERN.test(expectedMx)) {
    errors.push("expected_mx");
  }
  if (!SHA256_PATTERN.test(dkimSha256)) {
    errors.push("dkim_fingerprint");
  }
  if ((mode === "combined" || mode === "preflight") && !cleanSecret(environment.GITHUB_TOKEN)) {
    errors.push("github_token");
  }
  if ((mode === "combined" || mode === "send") && !RESEND_KEY_PATTERN.test(apiKey)) {
    errors.push("resend_key");
  }
  if (mode === "preflight" && apiKey) {
    errors.push("resend_key_exposed_to_preflight");
  }
  if (mode === "send" && cleanSecret(environment.GITHUB_TOKEN)) {
    errors.push("github_token_exposed_to_send");
  }
  if (
    clean(environment.RESEND_API_KEY) ||
    clean(environment.FANMIND_NOTIFICATION_FROM)
  ) {
    errors.push("application_runtime_email");
  }

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze([...new Set(errors)]),
    reviewedCommit,
    apiKey,
    expectedMx,
    dkimSha256,
  });
}

export function buildStagingEmailAcceptancePayload(reviewedCommit) {
  const commit = clean(reviewedCommit).toLowerCase();
  if (!COMMIT_PATTERN.test(commit)) {
    throw new Error("STAGING_EMAIL_ACCEPTANCE_ERROR=reviewed_commit");
  }
  return Object.freeze({
    from: STAGING_EMAIL_ACCEPTANCE_FROM,
    to: Object.freeze([STAGING_EMAIL_ACCEPTANCE_TO]),
    subject: "FanMind Staging Provider Acceptance",
    text: "Synthetic FanMind Staging provider acceptance. No customer or CRM data.",
  });
}

export function validateEnvironmentProtection(environmentPayload, branchPayload) {
  const requiredReviewers = Array.isArray(environmentPayload?.protection_rules)
    ? environmentPayload.protection_rules.filter(
        (rule) => rule?.type === "required_reviewers",
      )
    : [];
  const branchPolicies = Array.isArray(branchPayload?.branch_policies)
    ? branchPayload.branch_policies
    : [];

  return Boolean(
    environmentPayload?.name === STAGING_EMAIL_ACCEPTANCE_ENVIRONMENT &&
      environmentPayload?.can_admins_bypass === false &&
      environmentPayload?.deployment_branch_policy?.protected_branches ===
        false &&
      environmentPayload?.deployment_branch_policy
        ?.custom_branch_policies === true &&
      requiredReviewers.length === 1 &&
      requiredReviewers[0]?.prevent_self_review === true &&
      Array.isArray(requiredReviewers[0]?.reviewers) &&
      requiredReviewers[0].reviewers.length >= 1 &&
      requiredReviewers[0].reviewers.every(
        (entry) =>
          (entry?.type === "User" || entry?.type === "Team") &&
          Number.isSafeInteger(entry?.reviewer?.id) &&
          entry.reviewer.id > 0,
      ) &&
      branchPayload?.total_count === 1 &&
      branchPolicies.length === 1 &&
      branchPolicies[0]?.name === "main" &&
      Number.isSafeInteger(branchPolicies[0]?.id) &&
      branchPolicies[0].id > 0
  );
}

function validDnsEvidence(
  mxRecords,
  spfRecords,
  dkimRecords,
  expectedMx,
  dkimSha256,
) {
  const mx = Array.isArray(mxRecords) ? mxRecords : [];
  const flattenTxt = (records) =>
    Array.isArray(records)
      ? records.map((record) =>
          Array.isArray(record) ? record.join("") : "",
        )
      : [];
  const spf = flattenTxt(spfRecords);
  const dkim = flattenTxt(dkimRecords);
  return Boolean(
    mx.length === 1 &&
      mx[0]?.priority === 10 &&
      clean(mx[0]?.exchange).toLowerCase().replace(/\.$/u, "") ===
        expectedMx &&
      spf.length === 1 &&
      spf[0] === "v=spf1 include:amazonses.com ~all" &&
      dkim.length === 1 &&
      /^(?:v=DKIM1;\s*)?(?:k=rsa;\s*)?p=[A-Za-z0-9+/=]{32,}$/u.test(
        dkim[0],
      ) &&
      createHash("sha256").update(dkim[0], "utf8").digest("hex") ===
        dkimSha256
  );
}

async function boundedJson(response) {
  const contentLength = Number(response?.headers?.get?.("content-length"));
  if (Number.isFinite(contentLength) && contentLength > RESPONSE_LIMIT) {
    throw new Error("response_too_large");
  }
  if (!response?.body || typeof response.body.getReader !== "function") {
    throw new Error("response_body_invalid");
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > RESPONSE_LIMIT) {
      await reader.cancel();
      throw new Error("response_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

function requestOptions(token, overrides = {}) {
  const { headers = {}, ...rest } = overrides;
  return {
    redirect: "error",
    signal: AbortSignal.timeout(12_000),
    ...rest,
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  };
}

async function exactJsonRequest(fetchImplementation, url, options, status) {
  const response = await fetchImplementation(url, options);
  if (response?.status !== status) throw new Error("status_invalid");
  return boundedJson(response);
}

async function verifyPublicStagingBoundary(
  evaluation,
  { fetchImplementation, resolveMxImplementation, resolveTxtImplementation },
) {
  const liveVersion = await exactJsonRequest(
    fetchImplementation,
    `${STAGING_EMAIL_ACCEPTANCE_APP_ORIGIN}/api/version`,
    requestOptions(""),
    200,
  );
  if (
    liveVersion?.application !== "fanmind" ||
    liveVersion?.releaseCommit !== evaluation.reviewedCommit ||
    liveVersion?.runtimeEnvironment !== "staging"
  ) {
    throw new Error("deployed_release");
  }
  const liveHealth = await exactJsonRequest(
    fetchImplementation,
    `${STAGING_EMAIL_ACCEPTANCE_APP_ORIGIN}/api/health`,
    requestOptions(""),
    207,
  );
  const emailChecks = Array.isArray(liveHealth?.checks)
    ? liveHealth.checks.filter((check) => check?.component === "email_config")
    : [];
  const requiredHealth = evaluatePublicHealth(liveHealth);
  if (
    liveHealth?.status !== "degraded" ||
    liveHealth?.scope !== "public" ||
    !requiredHealth.ok ||
    emailChecks.length !== 1 ||
    emailChecks[0]?.status !== "unknown"
  ) {
    throw new Error("application_email_runtime");
  }

  const [mxRecords, spfRecords, dkimRecords] = await Promise.all([
    resolveMxImplementation(`send.${STAGING_EMAIL_ACCEPTANCE_DOMAIN}`),
    resolveTxtImplementation(`send.${STAGING_EMAIL_ACCEPTANCE_DOMAIN}`),
    resolveTxtImplementation(
      `resend._domainkey.${STAGING_EMAIL_ACCEPTANCE_DOMAIN}`,
    ),
  ]);
  if (
    !validDnsEvidence(
      mxRecords,
      spfRecords,
      dkimRecords,
      evaluation.expectedMx,
      evaluation.dkimSha256,
    )
  ) {
    throw new Error("dns_evidence");
  }
}

function fixedResult(ok, error, providerCalls = 0) {
  return Object.freeze({ ok, error, providerCalls });
}

function knownError(error) {
  const known = new Set([
    "environment_protection",
    "current_main",
    "deployed_release",
    "application_email_runtime",
    "dns_evidence",
    "resend_permission",
  ]);
  const message = error instanceof Error ? error.message : "";
  return known.has(message) ? message : "network_or_response";
}

export async function runStagingEmailProviderPreflight(
  environment = {},
  {
    fetchImplementation = globalThis.fetch,
    resolveMxImplementation,
    resolveTxtImplementation,
  } = {},
) {
  const evaluation = evaluateStagingEmailAcceptanceEnvironment(environment, {
    mode: "preflight",
  });
  if (!evaluation.ok) return fixedResult(false, evaluation.errors[0]);
  if (
    typeof fetchImplementation !== "function" ||
    typeof resolveMxImplementation !== "function" ||
    typeof resolveTxtImplementation !== "function"
  ) {
    return fixedResult(false, "network_adapter");
  }
  try {
    const repositoryApi = `${GITHUB_API_ORIGIN}/repos/${GITHUB_REPOSITORY}`;
    const githubOptions = requestOptions(environment.GITHUB_TOKEN, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    const environmentPayload = await exactJsonRequest(
      fetchImplementation,
      `${repositoryApi}/environments/${STAGING_EMAIL_ACCEPTANCE_ENVIRONMENT}`,
      githubOptions,
      200,
    );
    const branchPayload = await exactJsonRequest(
      fetchImplementation,
      `${repositoryApi}/environments/${STAGING_EMAIL_ACCEPTANCE_ENVIRONMENT}/deployment-branch-policies`,
      githubOptions,
      200,
    );
    if (!validateEnvironmentProtection(environmentPayload, branchPayload)) {
      throw new Error("environment_protection");
    }
    const mainRef = await exactJsonRequest(
      fetchImplementation,
      `${repositoryApi}/git/ref/heads/main`,
      githubOptions,
      200,
    );
    if (mainRef?.object?.sha !== evaluation.reviewedCommit) {
      throw new Error("current_main");
    }
    await verifyPublicStagingBoundary(evaluation, {
      fetchImplementation,
      resolveMxImplementation,
      resolveTxtImplementation,
    });
    return fixedResult(true, null);
  } catch (error) {
    return fixedResult(false, knownError(error));
  }
}

export async function sendStagingEmailProviderAcceptance(
  environment = {},
  {
    fetchImplementation = globalThis.fetch,
    resolveMxImplementation,
    resolveTxtImplementation,
  } = {},
) {
  const evaluation = evaluateStagingEmailAcceptanceEnvironment(environment, {
    mode: "send",
  });
  if (!evaluation.ok) return fixedResult(false, evaluation.errors[0]);
  if (
    typeof fetchImplementation !== "function" ||
    typeof resolveMxImplementation !== "function" ||
    typeof resolveTxtImplementation !== "function"
  ) {
    return fixedResult(false, "network_adapter");
  }
  let providerCalls = 0;
  try {
    await verifyPublicStagingBoundary(evaluation, {
      fetchImplementation,
      resolveMxImplementation,
      resolveTxtImplementation,
    });
    providerCalls += 1;
    const permissionPayload = await exactJsonRequest(
      fetchImplementation,
      `${RESEND_API_ORIGIN}/api-keys`,
      requestOptions(evaluation.apiKey),
      401,
    );
    if (permissionPayload?.name !== "restricted_api_key") {
      throw new Error("resend_permission");
    }

    const payload = buildStagingEmailAcceptancePayload(
      evaluation.reviewedCommit,
    );
    if (
      Object.keys(payload).sort().join(",") !== "from,subject,text,to" ||
      payload.to.length !== 1 ||
      payload.to[0] !== STAGING_EMAIL_ACCEPTANCE_TO
    ) {
      throw new Error("payload_contract");
    }
    providerCalls += 1;
    let response;
    try {
      response = await fetchImplementation(
        `${RESEND_API_ORIGIN}/emails`,
        requestOptions(evaluation.apiKey, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `fanmind-staging-provider/${evaluation.reviewedCommit}`,
          },
          body: JSON.stringify(payload),
        }),
      );
    } catch {
      return fixedResult(false, "send_indeterminate", providerCalls);
    }
    if (response?.status !== 200) {
      return fixedResult(false, "send_indeterminate", providerCalls);
    }
    let sendPayload;
    try {
      sendPayload = await boundedJson(response);
    } catch {
      return fixedResult(false, "send_indeterminate", providerCalls);
    }
    if (
      !sendPayload ||
      Object.keys(sendPayload).sort().join(",") !== "id" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        sendPayload.id,
      )
    ) {
      return fixedResult(false, "send_indeterminate", providerCalls);
    }
    return fixedResult(true, null, providerCalls);
  } catch (error) {
    return fixedResult(false, knownError(error), providerCalls);
  }
}
