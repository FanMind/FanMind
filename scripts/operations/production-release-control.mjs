import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const REQUIRED_MAIN_PUSH_WORKFLOWS = Object.freeze([
  { name: "FanMind Browser E2E", path: ".github/workflows/browser-e2e.yml" },
  { name: "FanMind CodeQL", path: ".github/workflows/codeql.yml" },
  { name: "FanMind God Mode Gate", path: ".github/workflows/fanmind-god-mode-gate.yml" },
  { name: "FanMind Supply Chain Security", path: ".github/workflows/supply-chain-security.yml" },
]);
export const REQUIRED_PULL_REQUEST_WORKFLOWS = Object.freeze([
  { name: "FanMind CI", path: ".github/workflows/ci-fanmind.yml" },
  ...REQUIRED_MAIN_PUSH_WORKFLOWS,
  { name: "FanMind Landing Language CI", path: ".github/workflows/landing-language-ci.yml" },
  { name: "Project Memory Guard", path: ".github/workflows/project-memory-guard.yml" },
  { name: "Project Memory Quality", path: ".github/workflows/project-memory-quality.yml" },
  { name: "Project Memory Status", path: ".github/workflows/project-memory-status.yml" },
]);

const SHA = /^[0-9a-f]{40}$/u;
const TASK_ID = /^FM-[A-Z0-9][A-Z0-9-]{5,95}$/u;
const COMMENT_ID = /^[1-9][0-9]{0,19}$/u;
const LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u;
const RISKS = new Set(["R1", "R2", "R3", "R4"]);
const AUDIT_MAX_AGE_MS = 48 * 60 * 60 * 1000;

function fail(code) {
  throw new Error(`production_release_blocked:${code}`);
}

export function validateRequest(input) {
  if (input.gateEnabled !== "true") fail("gate_not_enabled");
  if (input.eventName !== "repository_dispatch") fail("event_not_repository_dispatch");
  if (input.eventAction !== "fanmind-production-release") fail("event_action_invalid");
  if (input.repository !== "FanMind/FanMind") fail("repository_invalid");
  if (input.ref !== "refs/heads/main") fail("ref_not_main");
  if (!SHA.test(input.releaseCommit ?? "")) fail("release_commit_invalid");
  if (input.releaseCommit !== input.triggerCommit) fail("trigger_commit_mismatch");
  if (!TASK_ID.test(input.taskId ?? "")) fail("task_id_invalid");
  if (!RISKS.has(input.risk)) fail("risk_invalid");
  if (input.confirmation !== "release-production") fail("confirmation_invalid");
  if (!COMMENT_ID.test(input.authorizationCommentId ?? "")) {
    fail("authorization_comment_id_invalid");
  }
  if (!COMMENT_ID.test(input.recoveryAuditRunId ?? "")) {
    fail("recovery_audit_run_id_invalid");
  }
  if (!LOGIN.test(input.ownerLogin ?? "")) fail("owner_login_not_configured");
  return input;
}

export function selectMergedPullRequest(pulls, releaseCommit) {
  const matches = pulls.filter(
    (pull) =>
      pull?.merged_at &&
      pull?.base?.ref === "main" &&
      pull?.merge_commit_sha === releaseCommit &&
      SHA.test(pull?.head?.sha ?? ""),
  );
  if (matches.length !== 1) fail("merged_pull_request_not_unique");
  return matches[0];
}

export function requireIndependentReview(reviews, pull) {
  const latest = new Map();
  for (const review of reviews) {
    const login = review?.user?.login;
    const submitted = Date.parse(review?.submitted_at ?? "");
    if (!login || !Number.isFinite(submitted)) continue;
    const previous = latest.get(login);
    if (!previous || Date.parse(previous.submitted_at) < submitted) {
      latest.set(login, review);
    }
  }
  const current = [...latest.values()];
  if (current.some((review) => review.state === "CHANGES_REQUESTED")) {
    fail("review_changes_requested");
  }
  const approval = current.find(
    (review) =>
      review.state === "APPROVED" &&
      review.user.login !== pull.user.login &&
      review.commit_id === pull.head.sha,
  );
  if (!approval) fail("final_head_independent_approval_missing");
  return approval;
}

function requireCi(runs, commit, event, required, identities, headBranch) {
  const selected = [];
  for (const expected of required) {
    const identity = identities.find(
      (workflow) => workflow.name === expected.name && workflow.path === expected.path,
    );
    if (!identity || !Number.isSafeInteger(identity.id) || identity.id <= 0) {
      fail(`ci_workflow_identity_missing:${expected.name}`);
    }
    if (identity.state !== "active") fail(`ci_workflow_inactive:${expected.name}`);
    const candidates = runs
      .filter(
        (run) =>
          run.workflow_id === identity.id &&
          run.path === expected.path &&
          run.name === expected.name &&
          run.event === event &&
          (!headBranch || run.head_branch === headBranch) &&
          run.head_sha === commit &&
          Number.isSafeInteger(run.run_number) &&
          run.run_number > 0 &&
          Number.isSafeInteger(run.run_attempt) &&
          run.run_attempt > 0,
      )
      .sort(
        (left, right) =>
          right.run_number - left.run_number ||
          right.run_attempt - left.run_attempt ||
          right.id - left.id,
      );
    const run = candidates[0];
    if (!run) fail(`ci_missing:${expected.name}`);
    if (run.status !== "completed" || run.conclusion !== "success") {
      fail(`ci_not_successful:${expected.name}`);
    }
    selected.push({
      name: run.name,
      path: run.path,
      workflow_id: run.workflow_id,
      run_id: run.id,
      run_number: run.run_number,
      run_attempt: run.run_attempt,
    });
  }
  return selected;
}

export function requireMainPushCi(runs, releaseCommit, identities) {
  return requireCi(
    runs,
    releaseCommit,
    "push",
    REQUIRED_MAIN_PUSH_WORKFLOWS,
    identities,
    "main",
  );
}

export function requirePullRequestCi(runs, reviewedHead, identities) {
  return requireCi(
    runs,
    reviewedHead,
    "pull_request",
    REQUIRED_PULL_REQUEST_WORKFLOWS,
    identities,
  );
}

export function requireOwnerAuthorization(comment, input) {
  if (comment?.user?.login !== input.ownerLogin) fail("owner_author_mismatch");
  const expected = [
    "FM_PRODUCTION_RELEASE_AUTHORIZATION",
    `task_id=${input.taskId}`,
    `release_commit=${input.releaseCommit}`,
    `risk=${input.risk}`,
    "authorization=approve",
  ].join("\n");
  if (comment?.body?.trim() !== expected) fail("owner_authorization_body_mismatch");
  const createdAt = Date.parse(comment.created_at ?? "");
  const mergedAt = Date.parse(input.mergedAt ?? "");
  if (!Number.isFinite(createdAt) || !Number.isFinite(mergedAt) || createdAt < mergedAt) {
    fail("owner_authorization_predates_merge");
  }
  return {
    comment_id: comment.id,
    comment_url: comment.html_url,
    authorized_by: comment.user.login,
    created_at: comment.created_at,
  };
}

export function requireRecoveryAudit(run, artifacts, now = new Date()) {
  if (
    run?.name !== "FanMind Read-only Production Audit" ||
    run?.path !== ".github/workflows/production-readonly-audit.yml" ||
    run?.head_branch !== "main" ||
    run?.status !== "completed" ||
    run?.conclusion !== "success"
  ) {
    fail("recovery_audit_not_successful");
  }
  const completedAt = Date.parse(run.updated_at ?? "");
  if (
    !Number.isFinite(completedAt) ||
    completedAt > now.getTime() ||
    now.getTime() - completedAt > AUDIT_MAX_AGE_MS
  ) {
    fail("recovery_audit_stale");
  }
  const prefix = `fanmind-production-audit-`;
  const suffix = `-${run.id}-${run.run_attempt}`;
  const matches = artifacts.filter(
    (artifact) =>
      !artifact.expired &&
      artifact.name?.startsWith(prefix) &&
      artifact.name?.endsWith(suffix) &&
      SHA.test(artifact.name.slice(prefix.length, -suffix.length)),
  );
  if (matches.length !== 1) fail("recovery_audit_receipt_missing");
  return {
    run_id: run.id,
    run_attempt: run.run_attempt,
    completed_at: run.updated_at,
    rollback_commit: matches[0].name.slice(prefix.length, -suffix.length),
    artifact_id: matches[0].id,
  };
}

async function githubJson(apiBase, repo, token, path) {
  const response = await fetch(`${apiBase}/repos/${repo}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) fail(`github_api_${response.status}`);
  return response.json();
}

async function publicReleaseCommit(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) fail(`production_version_${response.status}`);
  const commit = (await response.json())?.releaseCommit;
  if (!SHA.test(commit ?? "")) fail("production_version_invalid");
  return commit;
}

export async function collectEvidence(
  input,
  request = githubJson,
  now = new Date(),
  readLiveCommit = publicReleaseCommit,
) {
  validateRequest(input);
  const api = (path) => request(input.apiBase, input.repository, input.token, path);
  const main = await api("/git/ref/heads/main");
  if (main?.object?.sha !== input.releaseCommit) fail("main_moved");

  const pulls = await api(`/commits/${input.releaseCommit}/pulls`);
  const pull = selectMergedPullRequest(pulls, input.releaseCommit);
  const workflowDefinitions = [
    ...new Map(
      [...REQUIRED_MAIN_PUSH_WORKFLOWS, ...REQUIRED_PULL_REQUEST_WORKFLOWS].map(
        (workflow) => [workflow.path, workflow],
      ),
    ).values(),
  ];
  const [reviews, mainRunPage, prRunPage, comment, auditRun, artifactPage, identities] = await Promise.all([
    api(`/pulls/${pull.number}/reviews?per_page=100`),
    api(`/actions/runs?head_sha=${input.releaseCommit}&event=push&per_page=100`),
    api(`/actions/runs?head_sha=${pull.head.sha}&event=pull_request&per_page=100`),
    api(`/issues/comments/${input.authorizationCommentId}`),
    api(`/actions/runs/${input.recoveryAuditRunId}`),
    api(`/actions/runs/${input.recoveryAuditRunId}/artifacts?per_page=100`),
    Promise.all(
      workflowDefinitions.map((workflow) =>
        api(`/actions/workflows/${encodeURIComponent(workflow.path.split("/").at(-1))}`),
      ),
    ),
  ]);
  if (reviews.length >= 100) fail("review_evidence_pagination_required");
  if ((mainRunPage.total_count ?? 0) > (mainRunPage.workflow_runs?.length ?? 0)) {
    fail("main_ci_evidence_pagination_required");
  }
  if ((prRunPage.total_count ?? 0) > (prRunPage.workflow_runs?.length ?? 0)) {
    fail("pull_request_ci_evidence_pagination_required");
  }
  if ((artifactPage.total_count ?? 0) > (artifactPage.artifacts?.length ?? 0)) {
    fail("audit_artifact_pagination_required");
  }
  const approval = requireIndependentReview(reviews, pull);
  const mainCi = requireMainPushCi(
    mainRunPage.workflow_runs ?? [],
    input.releaseCommit,
    identities,
  );
  const pullRequestCi = requirePullRequestCi(
    prRunPage.workflow_runs ?? [],
    pull.head.sha,
    identities,
  );
  const authorization = requireOwnerAuthorization(comment, {
    ...input,
    mergedAt: pull.merged_at,
  });
  const recovery = requireRecoveryAudit(auditRun, artifactPage.artifacts ?? [], now);
  const liveCommit = await readLiveCommit(input.productionVersionUrl);
  if (liveCommit !== recovery.rollback_commit) fail("recovery_audit_not_current");
  return {
    schema: "fanmind-production-release-control-v1",
    task_id: input.taskId,
    risk: input.risk,
    release_commit: input.releaseCommit,
    source_pull_request: pull.number,
    reviewed_head_commit: pull.head.sha,
    approval: {
      review_id: approval.id,
      reviewer: approval.user.login,
      submitted_at: approval.submitted_at,
    },
    authorization,
    ci: { pull_request: pullRequestCi, main_push: mainCi },
    recovery,
    workflow_run: { id: input.runId, attempt: input.runAttempt },
    generated_at: now.toISOString(),
  };
}

export function serializeManifest(manifest) {
  const body = `${JSON.stringify(manifest, null, 2)}\n`;
  return { body, sha256: createHash("sha256").update(body).digest("hex") };
}

async function main() {
  const input = {
    apiBase: process.env.GITHUB_API_URL ?? "https://api.github.com",
    productionVersionUrl: "https://fanmind.ch/api/version",
    repository: process.env.GITHUB_REPOSITORY,
    token: process.env.GITHUB_TOKEN,
    gateEnabled: process.env.FANMIND_PRODUCTION_RELEASE_GATE_ENABLED,
    ownerLogin: process.env.FANMIND_PRODUCTION_OWNER_LOGIN,
    eventName: process.env.GITHUB_EVENT_NAME,
    eventAction: process.env.FANMIND_RELEASE_EVENT_ACTION,
    ref: process.env.GITHUB_REF,
    triggerCommit: process.env.GITHUB_SHA,
    releaseCommit: process.env.FANMIND_RELEASE_COMMIT,
    taskId: process.env.FANMIND_RELEASE_TASK_ID,
    risk: process.env.FANMIND_RELEASE_RISK,
    confirmation: process.env.FANMIND_RELEASE_CONFIRMATION,
    authorizationCommentId: process.env.FANMIND_AUTHORIZATION_COMMENT_ID,
    recoveryAuditRunId: process.env.FANMIND_RECOVERY_AUDIT_RUN_ID,
    runId: Number(process.env.GITHUB_RUN_ID),
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
  };
  if (!input.repository || !input.token) fail("github_context_missing");
  const manifest = await collectEvidence(input);
  const { body, sha256 } = serializeManifest(manifest);
  const output = process.env.FANMIND_RELEASE_MANIFEST_PATH;
  if (!output) fail("manifest_path_missing");
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, body, { mode: 0o600 });
  if (process.env.GITHUB_OUTPUT) {
    await writeFile(
      process.env.GITHUB_OUTPUT,
      `release_commit=${manifest.release_commit}\nmanifest_sha256=${sha256}\nrollback_commit=${manifest.recovery.rollback_commit}\n`,
      { flag: "a" },
    );
  }
  console.log(`Production release evidence accepted for ${manifest.release_commit}.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "production_release_blocked:unknown");
    process.exitCode = 1;
  });
}
