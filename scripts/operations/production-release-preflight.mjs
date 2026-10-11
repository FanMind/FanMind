import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const RELEASE_CONFIRMATION = "deploy-fanmind-production";
const ROLLBACK_CONFIRMATION = "rollback-fanmind-production";
const SHA_PATTERN = /^[0-9a-f]{40}$/u;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateReleaseRequest({
  mode,
  confirmation,
  releaseCommit,
  mainCommit,
  compareStatus,
}) {
  const errors = [];

  if (!SHA_PATTERN.test(releaseCommit)) errors.push("release_commit");
  if (!SHA_PATTERN.test(mainCommit)) errors.push("main_commit");
  if (!["release", "rollback"].includes(mode)) errors.push("deployment_mode");

  const expectedConfirmation =
    mode === "rollback" ? ROLLBACK_CONFIRMATION : RELEASE_CONFIRMATION;
  if (confirmation !== expectedConfirmation) errors.push("confirmation");

  if (mode === "release" && releaseCommit !== mainCommit) {
    errors.push("release_not_current_main");
  }
  if (
    mode === "rollback" &&
    releaseCommit !== mainCommit &&
    !["ahead", "identical"].includes(compareStatus)
  ) {
    errors.push("rollback_not_main_ancestor");
  }

  return { ok: errors.length === 0, errors };
}

function successfulRun(runs, releaseCommit, predicate) {
  return runs.find(
    (run) =>
      run?.head_sha === releaseCommit &&
      run?.conclusion === "success" &&
      predicate(run),
  );
}

export function requiredEvidence(runs, mode, releaseCommit) {
  const codeql = successfulRun(
    runs,
    releaseCommit,
    (run) =>
      run.name === "FanMind CodeQL" &&
      run.event === "push" &&
      run.head_branch === "main",
  );

  if (mode === "rollback") {
    const previousDeployment = successfulRun(
      runs,
      releaseCommit,
      (run) =>
        run.name === "Deploy FanMind" &&
        ["push", "workflow_dispatch"].includes(run.event),
    );
    return {
      ok: Boolean(codeql && previousDeployment),
      missing: [
        !codeql && "FanMind CodeQL",
        !previousDeployment && "previous successful Deploy FanMind",
      ].filter(Boolean),
      runs: [codeql, previousDeployment].filter(Boolean),
    };
  }

  const ci = successfulRun(
    runs,
    releaseCommit,
    (run) =>
      run.name === "FanMind CI" &&
      run.event === "push" &&
      run.head_branch === "main",
  );
  return {
    ok: Boolean(ci && codeql),
    missing: [!ci && "FanMind CI", !codeql && "FanMind CodeQL"].filter(Boolean),
    runs: [ci, codeql].filter(Boolean),
  };
}

async function githubJson(path, token, repository) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`github_api_${response.status}`);
  }
  return response.json();
}

async function writeOutput(path, lines) {
  if (!path) throw new Error("github_output_missing");
  await appendFile(path, `${lines.join("\n")}\n`, "utf8");
}

async function main(environment = process.env) {
  const repository = clean(environment.GITHUB_REPOSITORY);
  const token = clean(environment.GITHUB_TOKEN);
  const mode = clean(environment.FANMIND_DEPLOYMENT_MODE);
  const confirmation = clean(environment.FANMIND_PRODUCTION_CONFIRMATION);
  const releaseCommit = clean(environment.FANMIND_RELEASE_COMMIT).toLowerCase();

  if (repository !== "FanMind/FanMind" || !token) {
    throw new Error("github_context_invalid");
  }

  const branch = await githubJson("/branches/main", token, repository);
  const mainCommit = clean(branch?.commit?.sha).toLowerCase();
  let compareStatus = releaseCommit === mainCommit ? "identical" : "";
  if (mode === "rollback" && SHA_PATTERN.test(releaseCommit)) {
    const comparison = await githubJson(
      `/compare/${releaseCommit}...${mainCommit}`,
      token,
      repository,
    );
    compareStatus = clean(comparison?.status);
  }

  const request = validateReleaseRequest({
    mode,
    confirmation,
    releaseCommit,
    mainCommit,
    compareStatus,
  });
  if (!request.ok) {
    throw new Error(`release_request_invalid:${request.errors.join(",")}`);
  }

  const workflowRuns = await githubJson(
    `/actions/runs?head_sha=${releaseCommit}&status=completed&per_page=100`,
    token,
    repository,
  );
  const evidence = requiredEvidence(
    Array.isArray(workflowRuns?.workflow_runs) ? workflowRuns.workflow_runs : [],
    mode,
    releaseCommit,
  );
  if (!evidence.ok) {
    throw new Error(`release_evidence_missing:${evidence.missing.join(",")}`);
  }

  await writeOutput(environment.GITHUB_OUTPUT, [
    `release_commit=${releaseCommit}`,
    `deployment_mode=${mode}`,
  ]);

  if (environment.GITHUB_STEP_SUMMARY) {
    await appendFile(
      environment.GITHUB_STEP_SUMMARY,
      [
        "## Production release preflight",
        `- mode: ${mode}`,
        `- immutable release commit: ${releaseCommit}`,
        `- current main: ${mainCommit}`,
        `- evidence run IDs: ${evidence.runs.map((run) => run.id).join(", ")}`,
        "- result: PASS; protected Production deployment still requires environment approval",
        "",
      ].join("\n"),
      "utf8",
    );
  }
}

const invokedDirectly =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "production_release_preflight_failed");
    process.exitCode = 1;
  });
}
