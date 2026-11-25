import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { completeChecks, readCompleteCheckRuns, REQUIRED_MAIN_CHECKS, REQUIRED_PR_CHECKS } from "./production-release-preflight.mjs";

// Preparation only. No deploy, migration, provider or privileged subprocess.
export const BUDGET_SECONDS = Object.freeze({ preflight: 600, deploy: 1200, tests: 900, closeout: 900 });
const SHA = /^[a-f0-9]{40}$/u;
const REPO = "FanMind/FanMind";
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => `${JSON.stringify(value, null, 2)}\n`;
function requireValue(condition) { if (!condition) throw new Error("monthly_release_blocked"); }
function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], { maxBuffer: 128 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

export function sourcePlan(root, base, candidate) {
  requireValue(SHA.test(base) && SHA.test(candidate) && base !== candidate);
  requireValue(git(root, "rev-parse", `${base}^{commit}`).toString().trim() === base);
  requireValue(git(root, "rev-parse", `${candidate}^{commit}`).toString().trim() === candidate);
  git(root, "merge-base", "--is-ancestor", base, candidate);
  const fields = git(root, "diff", "--no-renames", "--name-status", "-z", base, candidate).toString().split("\0");
  fields.pop();
  const changes = [];
  const sql = [];
  for (let i = 0; i < fields.length; i += 2) {
    const [status, path] = fields.slice(i, i + 2);
    requireValue(["A", "M", "D", "T"].includes(status) && typeof path === "string");
    // Packages contain repository paths, never arbitrary file contents or env.
    requireValue(!/[\x00-\x1f\x7f]/u.test(path));
    changes.push({ status, path });
    if (path.startsWith("supabase/") && path.endsWith(".sql")) {
      const mode = status === "D" ? null : git(root, "ls-tree", candidate, "--", path).toString().split(" ")[0];
      requireValue(mode === null || mode === "100644" || mode === "100755");
      sql.push({ status, path, sha256: status === "D" ? null : hash(git(root, "show", `${candidate}:${path}`)), decision: "SEPARATE_CONTROLLED_REVIEW_REQUIRED" });
    }
  }
  return {
    schemaVersion: 1, repository: REPO, base, candidate,
    tree: git(root, "rev-parse", `${candidate}^{tree}`).toString().trim(),
    sourceArchiveSha256: hash(git(root, "archive", "--format=tar", candidate)),
    changes, sql,
    budgetsSeconds: BUDGET_SECONDS,
    controller: ".github/workflows/deploy-fanmind.yml",
    concurrency: "fanmind-production-deploy",
    state: "PREPARED_NOT_AUTHORIZED",
    requiredBeforeRelease: ["FRESH_PRODUCTION_BASE_AND_CONFIGURATION", "CURRENT_BACKUP_AND_RESTORE_PROOF", "CONTROLLED_SQL_DECISIONS", "OWNER_AND_PRODUCTION_ENVIRONMENT_APPROVAL", "FULL_NONPRODUCTION_TIMED_REHEARSAL"],
  };
}

// Review pointers for directly identifiable provider surfaces. They never
// participate in the admission decision or alter an existing package digest.
const PROVIDER_REVIEWS = [
  [/^(?:src\/app\/api\/(?:stripe|billing)\/|src\/lib\/(?:stripe|aiTierStripe|referralStripe)|scripts\/operations\/(?:staging-stripe-|stripe-billing-))/u,
    "Stripe", "Verify applicable price mapping, tax configuration and signed webhook/lifecycle evidence.", "docs/operations/STRIPE_RUNTIME_CONFORMANCE.md"],
  [/^(?:src\/app\/api\/(?:integrations\/(?:facebook|instagram)|webhooks\/meta)\/|src\/lib\/(?:facebook|instagram|meta)(?=[A-Z.])|scripts\/operations\/(?:production-meta-|staging-meta-))/u,
    "Facebook / Instagram", "Verify required permissions, app review and account-level subscription evidence.", "docs/operations/META_APP_REVIEW_READINESS_20261114.md"],
  [/^(?:src\/app\/api\/integrations\/social\/|src\/lib\/socialProvider|scripts\/operations\/social-provider-)/u,
    "TikTok / X", "Verify permitted OAuth scopes and the target-specific pilot boundaries.", "docs/integrations/TIKTOK_X_CONNECTIONS.md"],
  [/^(?:src\/app\/api\/webhooks\/whatsapp\/|src\/lib\/whatsapp)/u,
    "WhatsApp", "Check the inbound-only Staging contract and its Production prohibition.", "docs/integrations/WHATSAPP_CLOUD_INBOUND.md"],
  [/^(?:src\/app\/api\/integrations\/telegram\/|src\/lib\/telegram)/u,
    "Telegram", "Check server-side webhook authentication and workspace binding.", "docs/telegram-webhook.md"],
  [/^(?:src\/lib\/stagingEmailProviderAcceptancePolicy|scripts\/operations\/staging-email-provider-)/u,
    "Staging email", "Verify the isolated sender, recipient and delivery evidence for the synthetic scope.", "docs/operations/STAGING_EMAIL_PROVIDER_ACCEPTANCE.md"],
];

export function providerReviewSummary({ base, candidate, changes }) {
  requireValue(SHA.test(base) && SHA.test(candidate));
  const lines = [
    "### Provider prerequisites for review",
    `Candidate \`${candidate}\` against Production base \`${base}\`.`,
    "Direct path matches only. Shared dependencies and other providers require release-scope review. No provider state has been verified or authorized.",
    "",
  ];
  const matches = [];
  for (const [pattern, name, prerequisite, contract] of PROVIDER_REVIEWS) {
    const count = changes.filter(change => pattern.test(change.path)).length;
    if (count) matches.push(`- **${name}** (${count} changed ${count === 1 ? "path" : "paths"}). ${prerequisite} [Repository contract](https://github.com/FanMind/FanMind/blob/${candidate}/${contract})`);
  }
  lines.push(...(matches.length ? matches : ["No direct provider matches."]));
  return lines.join("\n") + "\n";
}

export function verifySource(root, manifest) {
  const expected = sourcePlan(root, manifest.base, manifest.candidate);
  for (const key of Object.keys(expected)) requireValue(JSON.stringify(manifest[key]) === JSON.stringify(expected[key]));
  return true;
}

export function stagingRun(run, candidate, allowedPaths) {
  requireValue(run?.repository?.full_name === REPO && run.head_sha === candidate && run.head_branch === "main"
    && run.status === "completed" && run.conclusion === "success"
    && Number.isSafeInteger(run.id) && Number.isSafeInteger(run.run_attempt) && run.run_attempt >= 1
    && run.event === "workflow_dispatch" && allowedPaths.includes(run.path));
  const start = Date.parse(run.run_started_at), end = Date.parse(run.updated_at);
  requireValue(Number.isFinite(start) && Number.isFinite(end) && end >= start);
  return { id: run.id, attempt: run.run_attempt, path: run.path, candidate, elapsedUpperBoundSeconds: Math.ceil((end - start) / 1000) };
}

async function requireExecutedJob(run, get, name) {
  const payload = await get(`actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`);
  requireValue(Array.isArray(payload?.jobs) && payload.total_count <= 100 && payload.jobs.length === payload.total_count);
  const jobs = payload.jobs.filter(job => job.name === name);
  requireValue(jobs.length === 1 && jobs[0].status === "completed" && jobs[0].conclusion === "success");
}

const ACCEPTANCE_JOBS = Object.freeze({
  ".github/workflows/browser-e2e-staging.yml": "Synthetic login and contact read-only flow",
  ".github/workflows/browser-e2e-staging-write.yml": "Synthetic owner and member core flow with cleanup",
  ".github/workflows/admin-e2e-staging.yml": "Prove positive and negative Staging admin boundaries without writes",
  ".github/workflows/chat-admin-manual-flow-staging.yml": "acceptance",
});

// Discovery proposes existing run IDs only. collectEvidence independently checks
// the actual attempt, executed job, ordering, source and protected branch.
export async function discoverStaging(candidate, get) {
  requireValue(SHA.test(candidate));
  const deploymentPath = ".github/workflows/deploy-staging.yml";
  const paths = [deploymentPath, ...Object.keys(ACCEPTANCE_JOBS)];
  const groups = await Promise.all(paths.map(async path => {
    const workflow = path.split("/").at(-1);
    const data = await get(`actions/workflows/${workflow}/runs?head_sha=${candidate}&branch=main&event=workflow_dispatch&per_page=100`);
    requireValue(Array.isArray(data?.workflow_runs) && data.total_count === data.workflow_runs.length
      && data.total_count <= 100 && data.workflow_runs.every(run => run.path === path && run.head_sha === candidate
        && run.head_branch === "main" && run.event === "workflow_dispatch" && run.repository?.full_name === REPO));
    return data.workflow_runs;
  }));
  // Multiple deployments (including restore attempts) require explicit selection.
  requireValue(groups[0].length === 1);
  const deployment = groups[0][0];
  stagingRun(deployment, candidate, [deploymentPath]);
  const acceptanceIds = [];
  for (const [i, runs] of groups.slice(1).entries()) {
    // An ongoing run may lack a start time. Never silently discard it.
    requireValue(runs.every(run => Number.isFinite(Date.parse(run.run_started_at))));
    const subsequent = runs.filter(run => Date.parse(run.run_started_at) >= Date.parse(deployment.updated_at));
    requireValue(subsequent.length <= 1);
    if (subsequent.length) acceptanceIds.push(stagingRun(subsequent[0], candidate, [paths[i + 1]]).id);
  }
  requireValue(acceptanceIds.length > 0);
  return { deploymentId: deployment.id, acceptanceIds };
}

export async function collectEvidence(candidate, deploymentId, acceptanceIds, get, excludedSuite) {
  requireValue(SHA.test(candidate) && Number.isSafeInteger(deploymentId) && deploymentId > 0);
  requireValue(Array.isArray(acceptanceIds) && acceptanceIds.length > 0 && acceptanceIds.length <= 20
    && acceptanceIds.every(id => Number.isSafeInteger(id) && id > 0)
    && new Set([deploymentId, ...acceptanceIds]).size === acceptanceIds.length + 1);
  const [branch, checks, prs, deployment] = await Promise.all([
    get("branches/main"), readCompleteCheckRuns(get, candidate),
    get(`commits/${candidate}/pulls?per_page=100`), get(`actions/runs/${deploymentId}`),
  ]);
  requireValue(branch.protected === true && branch.commit?.sha === candidate);
  requireValue(completeChecks(checks, REQUIRED_MAIN_CHECKS, excludedSuite));
  const pr = prs.find(value => value.merge_commit_sha === candidate && value.merged_at
    && value.base?.ref === "main" && value.head?.repo?.full_name === REPO && SHA.test(value.head?.sha));
  requireValue(!!pr);
  requireValue(completeChecks(await readCompleteCheckRuns(get, pr.head.sha), REQUIRED_PR_CHECKS));
  const staging = stagingRun(deployment, candidate, [".github/workflows/deploy-staging.yml"]);
  requireValue(deployment.id === deploymentId);
  await requireExecutedJob(deployment, get, "Deploy exact reviewed commit to isolated staging");
  // This records selected evidence, never asserts that every feature is accepted.
  const acceptances = [];
  for (const id of acceptanceIds) {
    const run = await get(`actions/runs/${id}`);
    requireValue(Date.parse(run.run_started_at) >= Date.parse(deployment.updated_at));
    const evidence = stagingRun(run, candidate, Object.keys(ACCEPTANCE_JOBS));
    requireValue(run.id === id);
    await requireExecutedJob(run, get, ACCEPTANCE_JOBS[run.path]);
    acceptances.push(evidence);
  }
  return { staging, acceptances, sourceChecks: "PASS_AT_PREPARATION_ONLY", completeFeatureAcceptance: false };
}

// Pure timing evaluator: no execution authority and no fabricated Release PASS.
// Unknown/interrupted writes require inspection; they are never retried blindly.
export function evaluateTimeline(events) {
  const phases = Object.keys(BUDGET_SECONDS);
  requireValue(Array.isArray(events) && events.length <= phases.length);
  let total = 0;
  for (const [i, event] of events.entries()) {
    requireValue(event.phase === phases[i] && Number.isSafeInteger(event.elapsedSeconds) && event.elapsedSeconds >= 0
      && ["success", "failed", "interrupted", "unknown"].includes(event.outcome));
    total += event.elapsedSeconds;
    if (event.outcome !== "success") return { state: i === 0 ? "STOPPED_BEFORE_WRITE" : "INSPECTION_REQUIRED", totalSeconds: total, resume: "REVALIDATE_EXACT_PACKAGE_AND_ACTUAL_STATE" };
    if (event.elapsedSeconds > BUDGET_SECONDS[event.phase] || total > 3600) return { state: "BUDGET_EXCEEDED_NOT_COMPLETE", totalSeconds: total, resume: "REVALIDATE_EXACT_PACKAGE_AND_ACTUAL_STATE" };
  }
  return { state: events.length === phases.length ? "TIMING_ONLY_WITHIN_BUDGET" : "INCOMPLETE", totalSeconds: total, releaseAccepted: false };
}

async function main() {
  try {
    const [command, ...args] = process.argv.slice(2);
    if (command === "verify" && args.length === 1) {
      verifySource(process.cwd(), JSON.parse(readFileSync(args[0], "utf8")));
      process.stdout.write("MONTHLY_SOURCE_PACKAGE=PASS_NOT_AUTHORIZATION\n");
      return;
    }
    requireValue(["plan", "prepare"].includes(command) && args.length === (command === "plan" ? 3 : 5));
    const [base, candidate, output, deployment, acceptance] = args;
    const manifest = sourcePlan(process.cwd(), base, candidate);
    if (command === "prepare") {
      requireValue(process.env.GITHUB_REPOSITORY === REPO && process.env.GITHUB_REF === "refs/heads/main"
        && process.env.GITHUB_SHA === candidate && process.env.GITHUB_EVENT_NAME === "workflow_dispatch");
      if (process.env.GITHUB_STEP_SUMMARY) {
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, providerReviewSummary(manifest));
      }
      const get = async path => {
        const response = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
          headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
          signal: AbortSignal.timeout(15_000),
        });
        requireValue(response.ok);
        return response.json();
      };
      const run = await get(`actions/runs/${process.env.GITHUB_RUN_ID}`);
      requireValue(run.path === ".github/workflows/monthly-release-prepare.yml" && run.head_sha === candidate
        && run.event === "workflow_dispatch" && Number.isSafeInteger(run.check_suite_id));
      requireValue(Boolean(deployment) === Boolean(acceptance));
      const refs = deployment
        ? { deploymentId: Number(deployment), acceptanceIds: JSON.parse(acceptance) }
        : await discoverStaging(candidate, get);
      manifest.evidence = await collectEvidence(candidate, refs.deploymentId, refs.acceptanceIds, get, run.check_suite_id);
    }
    // Exclusive create prevents accidentally replacing an approved package.
    const contents = json(manifest);
    writeFileSync(output, contents, { flag: "wx", mode: 0o600 });
    process.stdout.write(`MONTHLY_SOURCE_PACKAGE=PREPARED_NOT_AUTHORIZED\nPACKAGE_SHA256=${hash(contents)}\n`);
  } catch {
    process.stderr.write("MONTHLY_SOURCE_PACKAGE=BLOCK\n");
    process.exitCode = 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
