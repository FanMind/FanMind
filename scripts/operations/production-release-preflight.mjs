import { pathToFileURL } from "node:url";

export const REQUIRED_MAIN_CHECKS = ["god-mode", "JavaScript and TypeScript security analysis", "Immutable Actions, dependency audit and CycloneDX SBOM", "Public no-write flows on desktop and mobile Chromium", "Synthetic regular-user core flow on local providers"];
export const REQUIRED_PR_CHECKS = [...REQUIRED_MAIN_CHECKS, "Truth, lint, tests and build", "PostgreSQL 17 authorization roundtrip", "project-memory-guard", "project-memory-quality", "generate-status", "language-runtime-guard"];
function completeChecks(payload, required, excludedSuite) {
  if (!Array.isArray(payload?.check_runs) || payload.total_count < 1 || payload.total_count > 100 || payload.check_runs.length !== payload.total_count) return false;
  const latest = new Map();
  for (const check of payload.check_runs) {
    if (excludedSuite !== undefined && check.check_suite?.id === excludedSuite) continue;
    const key = `${check.app?.slug}:${check.name}`;
    if (!latest.has(key) || check.id > latest.get(key).id) latest.set(key, check);
  }
  const checks = [...latest.values()];
  return checks.every(check => check.status === "completed" && ["success", "skipped", "neutral"].includes(check.conclusion))
    && required.every(name => checks.some(check => check.name === name && check.app?.slug === "github-actions" && check.conclusion === "success"));
}

export function evaluateProductionRelease(env, branch, checks, currentRun, mergedPr, prChecks) {
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
    && completeChecks(checks, REQUIRED_MAIN_CHECKS, currentRun.check_suite_id)
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
    const [branch, checks, currentRun, pullRequests] = await Promise.all([get("branches/main"), get(`commits/${process.env.GITHUB_SHA}/check-runs?per_page=100`),get(`actions/runs/${process.env.GITHUB_RUN_ID}`),get(`commits/${process.env.GITHUB_SHA}/pulls?per_page=100`)]);
    const mergedPr = pullRequests.find(pr => pr.merge_commit_sha === process.env.GITHUB_SHA && pr.merged_at && pr.base?.ref === "main");
    if (!/^[0-9a-f]{40}$/u.test(mergedPr?.head?.sha ?? "")) throw new Error("merged_pr_missing");
    const prChecks = await get(`commits/${mergedPr.head.sha}/check-runs?per_page=100`);
    if (!evaluateProductionRelease(process.env, branch, checks, currentRun, mergedPr, prChecks)) throw new Error("release_not_ready");
    process.stdout.write("PRODUCTION_RELEASE_PREFLIGHT=PASS\n");
  } catch { process.stderr.write("PRODUCTION_RELEASE_PREFLIGHT=BLOCK\n"); process.exitCode = 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
