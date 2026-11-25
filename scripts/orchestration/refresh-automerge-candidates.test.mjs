import assert from "node:assert/strict";
import test from "node:test";
import { refreshCandidates } from "./refresh-automerge-candidates.mjs";

const head = "a".repeat(40);
const repo = { full_name: "FanMind/FanMind" };
const candidate = number => ({ number, state: "open", draft: false, base: { ref: "main", repo },
  auto_merge: {}, head: { sha: head, repo } });

test("scan pages once, isolate conflicts and request failures, and refresh each eligible head once", () => {
  const writes = [];
  const records = [[candidate(1), candidate(2), { ...candidate(3), draft: true }],
    [candidate(4), candidate(5), { ...candidate(6), auto_merge: null }]];
  const states = { 1: "DIRTY", 2: "BEHIND", 4: "BEHIND", 5: "CLEAN" };
  const gh = args => {
    if (args.includes("--paginate")) return JSON.stringify(records);
    if (args.includes("graphql")) {
      const number = args.at(-1).split("=")[1];
      return JSON.stringify({ data: { repository: { pullRequest: { state: "OPEN", isDraft: false,
        headRepository: { nameWithOwner: repo.full_name }, headRefOid: head, baseRefName: "main",
        mergeStateStatus: states[number], autoMergeRequest: { enabledAt: "2026-11-25T10:00Z" } } } } });
    }
    assert.equal(args.at(-1), `expected_head_sha=${head}`);
    writes.push(args[3]);
    if (args[3].includes("/2/")) throw new Error("concurrent update");
    return "{}";
  };
  assert.deepEqual(refreshCandidates(gh).map(r => r.status), ["CONFLICT", "REFRESH_FAILED", "UPDATE_REQUESTED", "NO_UPDATE"]);
  assert.deepEqual(writes, [2, 4].map(n => `repos/FanMind/FanMind/pulls/${n}/update-branch`));
});
test("handle a single event without scanning or processing forked heads", () => {
  const data = candidate(7);
  data.head.repo = { full_name: "outside/FanMind" };
  const gh = args => {
    assert.deepEqual(args, ["api", "repos/FanMind/FanMind/pulls/7"]);
    return JSON.stringify(data);
  };
  assert.deepEqual(refreshCandidates(gh, "7"), []);
  assert.throws(() => refreshCandidates(gh, "main"), /invalid_pr_number/);
});

test("refresh executes the trusted event base and never listens for its own synchronization", async () => {
  const { readFile } = await import("node:fs/promises");
  const workflow = await readFile(new URL("../../.github/workflows/refresh-automerge-branches.yml", import.meta.url), "utf8");
  assert.match(workflow, /pull_request_target:\s*branches: \[main\]\s*types: \[auto_merge_enabled\]/u);
  assert.match(workflow, /permissions:\s*contents: read\s+jobs:/u);
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}\s*persist-credentials: false/u);
  assert.match(workflow, /environment: fanmind-pr-refresh/u);
  assert.match(workflow, /GH_TOKEN: \$\{\{ secrets\.FANMIND_PR_REFRESH_TOKEN \}\}/u);
  assert.doesNotMatch(workflow, /pull_request\.head|synchronize|github\.token|GITHUB_TOKEN|write-all/u);
});
