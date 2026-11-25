import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sourcePlan, verifySource, discoverStaging, collectEvidence, stagingRun, evaluateTimeline, BUDGET_SECONDS } from "../scripts/operations/monthly-release-package.mjs";
import { REQUIRED_MAIN_CHECKS, REQUIRED_PR_CHECKS } from "../scripts/operations/production-release-preflight.mjs";

const candidate = "b".repeat(40), head = "c".repeat(40);
const repo = { full_name: "FanMind/FanMind" };
const run = (id, path, start = "2026-11-14T11:00:00Z", end = "2026-11-14T11:02:00Z") => ({ id, path, repository: repo, head_sha: candidate, head_branch: "main", run_attempt: 1, event: "workflow_dispatch", status: "completed", conclusion: "success", run_started_at: start, updated_at: end });
const checks = names => ({ total_count: names.length, check_runs: names.map((name, i) => ({ id: i + 1, name, status: "completed", conclusion: "success", app: { slug: "github-actions" } })) });
function responses() {
  return {
    "branches/main": { protected: true, commit: { sha: candidate } },
    [`commits/${candidate}/check-runs?per_page=100&page=1`]: checks(REQUIRED_MAIN_CHECKS),
    [`commits/${head}/check-runs?per_page=100&page=1`]: checks(REQUIRED_PR_CHECKS),
    [`commits/${candidate}/pulls?per_page=100`]: [{ merge_commit_sha: candidate, merged_at: "2026-11-14T10:00:00Z", base: { ref: "main" }, head: { sha: head, repo } }],
    "actions/runs/1": run(1, ".github/workflows/deploy-staging.yml"),
    "actions/runs/2": run(2, ".github/workflows/browser-e2e-staging.yml", "2026-11-14T11:03:00Z", "2026-11-14T11:04:00Z"),
    "actions/runs/1/attempts/1/jobs?per_page=100": { total_count: 1, jobs: [{ name: "Deploy exact reviewed commit to isolated staging", status: "completed", conclusion: "success" }] },
    "actions/runs/2/attempts/1/jobs?per_page=100": { total_count: 1, jobs: [{ name: "Synthetic login and contact read-only flow", status: "completed", conclusion: "success" }] },
  };
}

test("actual Git/CLI preparation, tamper rejection, abort and repeat preparation", t => {
  const root = mkdtempSync(join(tmpdir(), "fanmind-monthly-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "-q"); git("config", "user.email", "synthetic@example.com"); git("config", "user.name", "Synthetic fixture");
  writeFileSync(join(root, "package.json"), "{}\n"); git("add", "."); git("commit", "-qm", "base");
  const base = git("rev-parse", "HEAD");
  mkdirSync(join(root, "supabase", "controlled"), { recursive: true });
  writeFileSync(join(root, "supabase", "controlled", "fixture.sql"), "select 1;\n");
  writeFileSync(join(root, "feature.txt"), "synthetic source\n"); git("add", "."); git("commit", "-qm", "candidate");
  const sha = git("rev-parse", "HEAD");
  const manifest = sourcePlan(root, base, sha);
  assert.equal(manifest.sql.length, 1); assert.equal(manifest.sql[0].decision, "SEPARATE_CONTROLLED_REVIEW_REQUIRED");
  assert.equal(verifySource(root, manifest), true);
  const changed = structuredClone(manifest); changed.sql[0].sha256 = "0".repeat(64);
  assert.throws(() => verifySource(root, changed));
  assert.throws(() => sourcePlan(root, sha, base));
  assert.throws(() => sourcePlan(root, "main", sha));
  const cli = resolve("scripts/operations/monthly-release-package.mjs");
  const invoke = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: "utf8" });
  const output = join(root, "package.json.release");
  const interrupted = invoke("plan", base, "0".repeat(40), output);
  assert.equal(interrupted.status, 1);
  assert.equal(invoke("plan", base, sha, output).status, 0);
  const frozen = readFileSync(output, "utf8");
  assert.equal(invoke("plan", base, sha, output).status, 1);
  assert.equal(readFileSync(output, "utf8"), frozen);
  assert.equal(invoke("verify", output).status, 0);
  rmSync(output);
  assert.equal(invoke("plan", base, sha, output).status, 0);
  assert.equal(readFileSync(output, "utf8"), frozen);
  assert.equal(git("rev-parse", "HEAD"), sha);
});

test("GitHub evidence is exact-source, protected-main and subsequent-Staging bound", async () => {
  const payload = responses();
  const result = await collectEvidence(candidate, 1, [2], async path => payload[path]);
  assert.equal(result.staging.elapsedUpperBoundSeconds, 120);
  assert.equal(result.completeFeatureAcceptance, false);
  for (const mutate of [
    p => { p["branches/main"].protected = false; },
    p => { p["branches/main"].commit.sha = head; },
    p => { p["actions/runs/1"].head_sha = head; },
    p => { p["actions/runs/1"].head_branch = "other"; },
    p => { p["actions/runs/2"].head_branch = "other"; },
    p => { p["actions/runs/2"].conclusion = "failure"; },
    p => { p["actions/runs/2"].path = ".github/workflows/deploy-fanmind.yml"; },
    p => { p["actions/runs/2"].run_started_at = "2026-11-14T10:00:00Z"; },
    p => { p[`commits/${candidate}/check-runs?per_page=100&page=1`].total_count = 101; },
    p => { p[`commits/${head}/check-runs?per_page=100&page=1`].check_runs[0].conclusion = "failure"; },
    p => { p[`commits/${candidate}/pulls?per_page=100`] = []; },
    p => { p["actions/runs/1/attempts/1/jobs?per_page=100"].jobs[0].conclusion = "skipped"; },
    p => { p["actions/runs/2/attempts/1/jobs?per_page=100"].jobs[0].conclusion = "skipped"; },
  ]) {
    const broken = responses(); mutate(broken);
    await assert.rejects(collectEvidence(candidate, 1, [2], async path => broken[path]));
  }
  await assert.rejects(collectEvidence(candidate, 1, [], async path => payload[path]));
  await assert.rejects(collectEvidence(candidate, 1, [1], async path => payload[path]));
  assert.throws(() => stagingRun({ ...payload["actions/runs/1"], repository: { full_name: "other/repo" } }, candidate, [".github/workflows/deploy-staging.yml"]));
});

test("budget, incomplete and interrupted writes never assert release acceptance", () => {
  const events = Object.entries(BUDGET_SECONDS).map(([phase, elapsedSeconds]) => ({ phase, elapsedSeconds, outcome: "success" }));
  assert.deepEqual(evaluateTimeline(events), { state: "TIMING_ONLY_WITHIN_BUDGET", totalSeconds: 3600, releaseAccepted: false });
  assert.equal(evaluateTimeline(events.slice(0, 2)).state, "INCOMPLETE");
  assert.equal(evaluateTimeline([{ ...events[0], outcome: "failed" }]).state, "STOPPED_BEFORE_WRITE");
  for (const outcome of ["interrupted", "failed", "unknown"]) {
    assert.equal(evaluateTimeline([events[0], { ...events[1], outcome }]).state, "INSPECTION_REQUIRED");
  }
  assert.equal(evaluateTimeline([{ ...events[0], elapsedSeconds: 601 }]).state, "BUDGET_EXCEEDED_NOT_COMPLETE");
  assert.throws(() => evaluateTimeline([{ ...events[0], elapsedSeconds: -1 }]));
  assert.throws(() => evaluateTimeline([events[1]]));
  // Recovery of preparation restarts from the same exact immutable inputs;
  // this function cannot resume an actual migration or attest a live rollback.
  assert.equal(evaluateTimeline(events).releaseAccepted, false);
});

test("discover unambiguous existing Staging evidence and reject incomplete or conflicting inventories", async () => {
  const payload = responses();
  const deployment = { ...payload["actions/runs/1"], head_branch: "main" };
  const acceptance = { ...payload["actions/runs/2"], head_branch: "main" };
  const discover = (rows, partial = false) => discoverStaging(candidate, async path => {
    assert.ok(path.endsWith(`?head_sha=${candidate}&branch=main&event=workflow_dispatch&per_page=100`));
    const workflow_runs = rows.filter(run => path.startsWith(`actions/workflows/${run.path.split("/").at(-1)}/runs?`));
    return { total_count: workflow_runs.length + Number(partial), workflow_runs };
  });
  assert.deepEqual(await discover([deployment, acceptance]), { deploymentId: 1, acceptanceIds: [2] });
  for (const rows of [
    [deployment], [acceptance], [deployment, deployment, acceptance],
    [deployment, acceptance, { ...acceptance, id: 3 }],
    [deployment, { ...acceptance, run_started_at: null }],
    [deployment, { ...acceptance, conclusion: "failure" }],
    [deployment, { ...acceptance, head_sha: head }],
    [deployment, { ...acceptance, run_started_at: deployment.run_started_at }],
  ]) await assert.rejects(discover(rows));
  await assert.rejects(discover([deployment, acceptance], true));
});
