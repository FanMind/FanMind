import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  REQUIRED_MAIN_PUSH_WORKFLOWS,
  REQUIRED_PULL_REQUEST_WORKFLOWS,
  collectEvidence,
  requireIndependentReview,
  requireMainPushCi,
  requireOwnerAuthorization,
  requirePullRequestCi,
  requireRecoveryAudit,
  selectMergedPullRequest,
  validateRequest,
} from "../scripts/operations/production-release-control.mjs";

const release = "a".repeat(40);
const reviewedHead = "b".repeat(40);
const now = new Date("2026-10-11T14:00:00.000Z");
const input = {
  apiBase: "https://api.github.test",
  repository: "FanMind/FanMind",
  productionVersionUrl: "https://fanmind.test/api/version",
  token: "synthetic-test-token",
  gateEnabled: "true",
  ownerLogin: "fanmind-owner",
  eventName: "workflow_dispatch",
  ref: "refs/heads/main",
  triggerCommit: release,
  releaseCommit: release,
  taskId: "FM-DEPLOYMENT-CONTROL-20261011-01",
  risk: "R4",
  confirmation: "release-production",
  authorizationCommentId: "1234",
  recoveryAuditRunId: "5678",
  runId: 9012,
  runAttempt: 1,
};
const pull = {
  number: 1299,
  merged_at: "2026-10-11T12:00:00Z",
  merge_commit_sha: release,
  base: { ref: "main" },
  head: { sha: reviewedHead },
  user: { login: "builder" },
};
const approval = {
  id: 44,
  state: "APPROVED",
  commit_id: reviewedHead,
  submitted_at: "2026-10-11T11:00:00Z",
  user: { login: "reviewer" },
};
const ciRuns = REQUIRED_MAIN_PUSH_WORKFLOWS.map((name, index) => ({
  id: 100 + index,
  name,
  event: "push",
  head_branch: "main",
  head_sha: release,
  status: "completed",
  conclusion: "success",
  run_attempt: 1,
}));
const prCiRuns = REQUIRED_PULL_REQUEST_WORKFLOWS.map((name, index) => ({
  id: 200 + index,
  name,
  event: "pull_request",
  head_branch: "fix/production-release-control",
  head_sha: reviewedHead,
  status: "completed",
  conclusion: "success",
  run_attempt: 1,
}));
const ownerComment = {
  id: 1234,
  html_url: "https://github.test/FanMind/FanMind/issues/9#issuecomment-1234",
  created_at: "2026-10-11T13:00:00Z",
  user: { login: "fanmind-owner" },
  body: [
    "FM_PRODUCTION_RELEASE_AUTHORIZATION",
    `task_id=${input.taskId}`,
    `release_commit=${release}`,
    "risk=R4",
    "authorization=approve",
  ].join("\n"),
};
const auditRun = {
  id: 5678,
  run_attempt: 2,
  name: "FanMind Read-only Production Audit",
  path: ".github/workflows/production-readonly-audit.yml",
  head_branch: "main",
  status: "completed",
  conclusion: "success",
  updated_at: "2026-10-11T13:30:00Z",
};
const auditArtifact = {
  id: 77,
  name: `fanmind-production-audit-${"c".repeat(40)}-5678-2`,
  expired: false,
};

function blocked(fn, code) {
  assert.throws(fn, new RegExp(`production_release_blocked:${code}`, "u"));
}

test("request gate rejects wrong event, ref, SHA, risk, confirmation and missing controls", () => {
  assert.equal(validateRequest(input), input);
  for (const [field, value, code] of [
    ["gateEnabled", "false", "gate_not_enabled"],
    ["eventName", "push", "event_not_dispatch"],
    ["ref", "refs/heads/release", "ref_not_main"],
    ["releaseCommit", "short", "release_commit_invalid"],
    ["triggerCommit", "d".repeat(40), "trigger_commit_mismatch"],
    ["taskId", "free text", "task_id_invalid"],
    ["risk", "R1-approved", "risk_invalid"],
    ["confirmation", "yes", "confirmation_invalid"],
    ["authorizationCommentId", "0", "authorization_comment_id_invalid"],
    ["recoveryAuditRunId", "none", "recovery_audit_run_id_invalid"],
    ["ownerLogin", "", "owner_login_not_configured"],
  ]) blocked(() => validateRequest({ ...input, [field]: value }), code);
});

test("source PR and final reviewed head are unique and independently approved", () => {
  assert.equal(selectMergedPullRequest([pull], release), pull);
  assert.equal(requireIndependentReview([approval], pull), approval);
  blocked(() => selectMergedPullRequest([], release), "merged_pull_request_not_unique");
  blocked(
    () => selectMergedPullRequest([pull, { ...pull, number: 1300 }], release),
    "merged_pull_request_not_unique",
  );
  blocked(
    () => requireIndependentReview([{ ...approval, user: pull.user }], pull),
    "final_head_independent_approval_missing",
  );
  blocked(
    () => requireIndependentReview([{ ...approval, commit_id: "d".repeat(40) }], pull),
    "final_head_independent_approval_missing",
  );
  blocked(
    () => requireIndependentReview([approval, { ...approval, id: 45, state: "CHANGES_REQUESTED", submitted_at: "2026-10-11T11:01:00Z" }], pull),
    "review_changes_requested",
  );
});

test("all applicable exact-main push workflows must have a successful latest attempt", () => {
  assert.equal(requireMainPushCi(ciRuns, release).length, 4);
  blocked(() => requireMainPushCi(ciRuns.slice(1), release), "ci_missing:FanMind Browser E2E");
  blocked(
    () => requireMainPushCi(ciRuns.map((run, i) => i ? run : { ...run, conclusion: "failure" }), release),
    "ci_not_successful:FanMind Browser E2E",
  );
  blocked(
    () => requireMainPushCi(ciRuns.map((run, i) => i ? run : { ...run, head_sha: "d".repeat(40) }), release),
    "ci_missing:FanMind Browser E2E",
  );
  blocked(
    () => requireMainPushCi([...ciRuns, { ...ciRuns[0], id: 999, run_attempt: 2, status: "in_progress", conclusion: null }], release),
    "ci_not_successful:FanMind Browser E2E",
  );
});

test("all nine PR workflows must pass on the exact independently reviewed head", () => {
  assert.equal(requirePullRequestCi(prCiRuns, reviewedHead).length, 9);
  blocked(() => requirePullRequestCi(prCiRuns.slice(1), reviewedHead), "ci_missing:FanMind CI");
  blocked(
    () => requirePullRequestCi(prCiRuns.map((run, i) => i ? run : { ...run, head_sha: release }), reviewedHead),
    "ci_missing:FanMind CI",
  );
});

test("owner authorization is an exact identity, task, SHA and risk binding", () => {
  const authorizationInput = { ...input, mergedAt: pull.merged_at };
  assert.equal(requireOwnerAuthorization(ownerComment, authorizationInput).comment_id, 1234);
  blocked(
    () => requireOwnerAuthorization({ ...ownerComment, user: { login: "other" } }, authorizationInput),
    "owner_author_mismatch",
  );
  for (const replacement of ["risk=R1", `release_commit=${"d".repeat(40)}`, "authorization=approve-now"]) {
    blocked(
      () => requireOwnerAuthorization({ ...ownerComment, body: ownerComment.body.replace(/risk=R4|release_commit=[a-f0-9]{40}|authorization=approve/u, replacement) }, authorizationInput),
      "owner_authorization_body_mismatch",
    );
  }
  blocked(
    () => requireOwnerAuthorization({ ...ownerComment, created_at: "2026-10-11T11:59:59Z" }, authorizationInput),
    "owner_authorization_predates_merge",
  );
});

test("recovery audit requires a fresh successful run and exact unexpired receipt", () => {
  assert.equal(requireRecoveryAudit(auditRun, [auditArtifact], now).rollback_commit, "c".repeat(40));
  for (const overrides of [
    { conclusion: "failure" },
    { status: "in_progress" },
    { path: ".github/workflows/other.yml" },
    { head_branch: "feature" },
  ]) blocked(() => requireRecoveryAudit({ ...auditRun, ...overrides }, [auditArtifact], now), "recovery_audit_not_successful");
  blocked(
    () => requireRecoveryAudit({ ...auditRun, updated_at: "2026-10-08T00:00:00Z" }, [auditArtifact], now),
    "recovery_audit_stale",
  );
  blocked(() => requireRecoveryAudit(auditRun, [], now), "recovery_audit_receipt_missing");
  blocked(
    () => requireRecoveryAudit(auditRun, [{ ...auditArtifact, expired: true }], now),
    "recovery_audit_receipt_missing",
  );
});

test("collected manifest binds main, PR review, CI, owner authorization and rollback evidence", async () => {
  const responses = new Map([
    ["/git/ref/heads/main", { object: { sha: release } }],
    [`/commits/${release}/pulls`, [pull]],
    ["/pulls/1299/reviews?per_page=100", [approval]],
    [`/actions/runs?head_sha=${release}&event=push&per_page=100`, { total_count: ciRuns.length, workflow_runs: ciRuns }],
    [`/actions/runs?head_sha=${reviewedHead}&event=pull_request&per_page=100`, { total_count: prCiRuns.length, workflow_runs: prCiRuns }],
    ["/issues/comments/1234", ownerComment],
    ["/actions/runs/5678", auditRun],
    ["/actions/runs/5678/artifacts?per_page=100", { total_count: 1, artifacts: [auditArtifact] }],
  ]);
  const request = async (_api, _repo, token, path) => {
    assert.equal(token, "synthetic-test-token");
    assert.equal(responses.has(path), true, path);
    return responses.get(path);
  };
  const live = async (url) => {
    assert.equal(url, "https://fanmind.test/api/version");
    return "c".repeat(40);
  };
  const manifest = await collectEvidence(input, request, now, live);
  assert.equal(manifest.release_commit, release);
  assert.equal(manifest.source_pull_request, 1299);
  assert.equal(manifest.reviewed_head_commit, reviewedHead);
  assert.equal(manifest.ci.main_push.length, 4);
  assert.equal(manifest.ci.pull_request.length, 9);
  assert.equal(manifest.recovery.rollback_commit, "c".repeat(40));
  await assert.rejects(
    collectEvidence(input, async (...args) => {
      const path = args.at(-1);
      return path === "/git/ref/heads/main" ? { object: { sha: "d".repeat(40) } } : request(...args);
    }, now, live),
    /production_release_blocked:main_moved/u,
  );
  await assert.rejects(
    collectEvidence(input, request, now, async () => "d".repeat(40)),
    /production_release_blocked:recovery_audit_not_current/u,
  );
});

test("workflow cannot deploy on push and reaches Production only after hosted authorization", async () => {
  const workflow = await readFile(".github/workflows/deploy-fanmind.yml", "utf8");
  assert.doesNotMatch(workflow, /^\s*push:/mu);
  assert.match(workflow, /^\s*workflow_dispatch:/mu);
  assert.match(workflow, /authorize-release:[\s\S]*runs-on: ubuntu-24\.04/u);
  assert.match(workflow, /FANMIND_PRODUCTION_RELEASE_GATE_ENABLED: \$\{\{ vars\.FANMIND_PRODUCTION_RELEASE_GATE_ENABLED \}\}/u);
  assert.match(workflow, /FANMIND_PRODUCTION_OWNER_LOGIN: \$\{\{ vars\.FANMIND_PRODUCTION_OWNER_LOGIN \}\}/u);
  assert.match(workflow, /deploy:[\s\S]*needs: authorize-release[\s\S]*environment: production[\s\S]*self-hosted/u);
  assert.doesNotMatch(workflow, /legacy in-place|git reset --hard/u);
});

test("downstream audit and readiness bind to the successful deploy commit", async () => {
  const [readiness, audit] = await Promise.all([
    readFile(".github/workflows/final-go-live-readiness.yml", "utf8"),
    readFile(".github/workflows/production-readonly-audit.yml", "utf8"),
  ]);
  assert.match(readiness, /github\.event\.workflow_run\.head_branch == 'main'/u);
  assert.match(readiness, /github\.event\.workflow_run\.head_sha/u);
  assert.match(readiness, /expected_commit:[\s\S]*required: true/u);
  assert.match(audit, /Resolve the installed Production commit for scheduled audit/u);
  assert.match(audit, /fanmind-production-audit-\$\{\{ steps\.target\.outputs\.commit \}\}-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/u);
});
