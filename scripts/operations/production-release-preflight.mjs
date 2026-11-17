import { pathToFileURL } from "node:url";

export const REQUIRED_MAIN_CHECKS = ["god-mode", "JavaScript and TypeScript security analysis", "Immutable Actions, dependency audit and CycloneDX SBOM", "Public no-write flows on desktop and mobile Chromium", "Synthetic regular-user core flow on local providers"];
export const REQUIRED_PR_CHECKS = [...REQUIRED_MAIN_CHECKS, "Truth, lint, tests and build", "PostgreSQL 17 authorization roundtrip", "project-memory-guard", "project-memory-quality", "generate-status", "language-runtime-guard"];
const MAX_CHECK_RUNS = 1000;

// Read every bounded page; partial inventories must never authorize a release.
export async function readCompleteCheckRuns(get, sha) {
  if (!/^[0-9a-f]{40}$/u.test(sha ?? "")) throw new Error("check_sha_invalid");
  const endpoint = `commits/${sha}/check-runs?per_page=100&page=`;
  const first = await get(endpoint + "1");
  const count = first?.total_count;
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_CHECK_RUNS) throw new Error("check_inventory_invalid");
  const checks = [], ids = new Set();
  for (let page = 1; checks.length < count; page++) {
    const payload = page === 1 ? first : await get(endpoint + page);
    if (payload?.total_count !== count || !Array.isArray(payload.check_runs)
      || payload.check_runs.length !== Math.min(100, count - checks.length)) throw new Error("check_page_incomplete");
    for (const check of payload.check_runs) {
      if (!Number.isSafeInteger(check?.id) || check.id < 1 || ids.has(check.id)) throw new Error("check_page_duplicate");
      ids.add(check.id); checks.push(check);
    }
  }
  // New runs shift page boundaries. Reject a changed first page rather than
  // treating equal counts or a duplicate-free partial snapshot as completeness.
  if (count > 100 && JSON.stringify(await get(endpoint + "1")) !== JSON.stringify(first)) throw new Error("check_inventory_changed");
  return { total_count: count, check_runs: checks };
}
export function isSeparateStagingDiagnostic(check, run, sha) {
  return check?.name === "inspect-staging-application-context"
    && check.app?.slug === "github-actions"
    && Number.isSafeInteger(check.check_suite?.id)
    && run?.check_suite_id === check.check_suite.id
    && run.head_sha === sha && run.head_branch === "main"
    && run.repository?.full_name === "FanMind/FanMind"
    && run.event === "workflow_dispatch"
    && run.path === ".github/workflows/chat-admin-media-host-readiness.yml";
}
export function completeChecks(payload, required, excludedSuite, stagingDiagnostics = [], sha) {
  if (!Array.isArray(payload?.check_runs) || !Number.isSafeInteger(payload.total_count) || payload.total_count < 1 || payload.total_count > MAX_CHECK_RUNS || payload.check_runs.length !== payload.total_count) return false;
  const latest = new Map();
  for (const check of payload.check_runs) {
    if (excludedSuite !== undefined && check.check_suite?.id === excludedSuite) continue;
    if (stagingDiagnostics.some(run => isSeparateStagingDiagnostic(check, run, sha))) continue;
    const key = `${check.app?.slug}:${check.name}`;
    if (!latest.has(key) || check.id > latest.get(key).id) latest.set(key, check);
  }
  const checks = [...latest.values()];
  return checks.every(check => check.status === "completed" && ["success", "skipped", "neutral"].includes(check.conclusion))
    && required.every(name => checks.some(check => check.name === name && check.app?.slug === "github-actions" && check.conclusion === "success"));
}

export function evaluateProductionRelease(env, branch, checks, currentRun, mergedPr, prChecks, stagingDiagnostics = []) {
  return env.GITHUB_REPOSITORY === "FanMind/FanMind"
    && env.GITHUB_REF === "refs/heads/main"
    && env.GITHUB_EVENT_NAME === "workflow_dispatch"
    && env.GITHUB_ACTOR_ID === "270165082"
    && /^[0-9a-f]{40}$/u.test(env.REVIEWED_MAIN_COMMIT ?? "")
    && env.REVIEWED_MAIN_COMMIT === env.GITHUB_SHA
    && env.CONFIRMATION === "deploy-reviewed-chatadmin"
    && branch?.protected === true
    && branch?.commit?.sha === env.GITHUB_SHA
    && currentRun?.id === Number(env.GITHUB_RUN_ID)
    && currentRun?.head_sha === env.GITHUB_SHA
    && currentRun?.path === ".github/workflows/deploy-fanmind.yml"
    && Number.isSafeInteger(currentRun?.check_suite_id)
    && mergedPr?.merge_commit_sha === env.GITHUB_SHA && !!mergedPr?.merged_at
    && mergedPr?.base?.ref === "main" && mergedPr?.head?.repo?.full_name === "FanMind/FanMind"
    && completeChecks(checks, REQUIRED_MAIN_CHECKS, currentRun.check_suite_id, stagingDiagnostics, env.GITHUB_SHA)
    && completeChecks(prChecks, REQUIRED_PR_CHECKS);
}

async function main() {
  try {
    const headers = { Accept: "application/vnd.github+json", Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "X-GitHub-Api-Version": "2022-11-28" };
    const get = async path => {
      const response = await fetch(`https://api.github.com/repos/FanMind/FanMind/${path}`, { headers, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error("github_unavailable");
      return response.json();
    };
    const [branch, checks, currentRun, pullRequests] = await Promise.all([get("branches/main"), readCompleteCheckRuns(get, process.env.GITHUB_SHA),get(`actions/runs/${process.env.GITHUB_RUN_ID}`),get(`commits/${process.env.GITHUB_SHA}/pulls?per_page=100`)]);
    const mergedPr = pullRequests.find(pr => pr.merge_commit_sha === process.env.GITHUB_SHA && pr.merged_at && pr.base?.ref === "main");
    if (!/^[0-9a-f]{40}$/u.test(mergedPr?.head?.sha ?? "")) throw new Error("merged_pr_missing");
    const prChecks = await readCompleteCheckRuns(get, mergedPr.head.sha);
    // Only this separate manual Staging inspection is outside Production source
    // CI. Bind its suite to authoritative Actions metadata; names alone never
    // authorize an exclusion. All other checks and all PR checks remain strict.
    const stagingDiagnostics = await Promise.all([...new Set(checks.check_runs
      .filter(check => check.name === "inspect-staging-application-context")
      .map(check => check.check_suite?.id))].map(async suite => {
      if (!Number.isSafeInteger(suite)) throw new Error("diagnostic_suite_invalid");
      const runs = await get(`actions/runs?check_suite_id=${suite}&per_page=100`);
      if (runs.total_count !== 1 || runs.workflow_runs?.length !== 1) throw new Error("diagnostic_provenance_unknown");
      return runs.workflow_runs[0];
    }));
    if (!evaluateProductionRelease(process.env, branch, checks, currentRun, mergedPr, prChecks, stagingDiagnostics)) throw new Error("release_not_ready");
    process.stdout.write("PRODUCTION_RELEASE_PREFLIGHT=PASS\n");
  } catch { process.stderr.write("PRODUCTION_RELEASE_PREFLIGHT=BLOCK\n"); process.exitCode = 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
