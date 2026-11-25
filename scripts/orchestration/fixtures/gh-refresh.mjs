// Test-only gh double. All mutations stay within the temporary git repository.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const scope = { full_name: "FanMind/FanMind" };
const prefix = "repos/FanMind/FanMind/";
const args = process.argv.slice(2);
const head = git("rev-parse", "topic"), base = git("rev-parse", "main");
const behind = spawnSync("git", ["merge-base", "--is-ancestor", base, head]).status === 1;
const verifiedHead = existsSync("passed-head") && readFileSync("passed-head", "utf8") === head;
const pr = { number: 42, state: "open", draft: false, base: { ref: "main", sha: base, repo: scope },
  head: { sha: head, repo: scope }, mergeable: true, mergeable_state: verifiedHead ? "clean" : "blocked",
  auto_merge: { merge_method: "merge" } };
const contexts = JSON.parse(readFileSync(new URL("../../../project-memory/BRANCH_PROTECTION_CONTRACT.json", import.meta.url))).required_status_checks.map(
  context => ({ context, integration_id: context === "CodeQL" ? 57789 : 15368 }));
const path = args.at(-1);
let output;
if (args.includes("graphql")) {
  output = { data: { repository: { pullRequest: { state: "OPEN", isDraft: false, baseRefName: "main",
    headRefOid: head, mergeStateStatus: behind ? "BEHIND" : pr.mergeable_state.toUpperCase(),
    headRepository: { nameWithOwner: scope.full_name }, autoMergeRequest: { enabledAt: "2026-11-25T10:00Z" } } } } };
} else if (args.includes("PUT")) {
  assert.deepEqual(args, ["api", "--method", "PUT", prefix + "pulls/42/update-branch", "-f", "expected_head_sha=" + head]);
  assert.equal(behind, true);
  git("merge", "--no-edit", "main");
  appendFileSync("updates", head + "\n");
  output = { message: "Updating pull request branch." };
} else if (args.includes("--paginate")) {
  assert.equal(path, prefix + "pulls?state=open&base=main&per_page=100");
  output = [[pr]];
} else if (path === prefix + "pulls/42") {
  output = pr;
} else if (path === prefix + "rulesets/24945113") {
  output = { id: 24945113, source: scope.full_name, target: "branch", enforcement: "active",
    conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } }, bypass_actors: [],
    rules: [{ type: "required_status_checks", parameters: { strict_required_status_checks_policy: true,
      required_status_checks: contexts } }] };
} else if (path === prefix + `commits/${head}/check-runs?per_page=100&page=1`) {
  output = { total_count: contexts.length, check_runs: contexts.map(({context, integration_id}, i) =>
    ({ id: i+1, name: context, head_sha: head, app: { id: integration_id },
      status: verifiedHead ? "completed" : "queued", conclusion: verifiedHead ? "success" : null })) };
} else {
  throw new Error("Unexpected fixture invocation");
}
console.log(JSON.stringify(output));
