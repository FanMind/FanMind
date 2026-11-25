import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { mergeReadiness } from "./merge-readiness.mjs";

const contract = JSON.parse(readFileSync(new URL("../../project-memory/BRANCH_PROTECTION_CONTRACT.json", import.meta.url)));
const head = "a".repeat(40);
function fixture() {
  const repo = { full_name: contract.repository };
  const pr = { number: 42, state: "open", draft: false, base: { ref: "main", sha: "b".repeat(40), repo },
    head: { sha: head, repo }, mergeable: true, mergeable_state: "clean" };
  const contexts = contract.required_status_checks.map(context => ({ context, integration_id: context === "CodeQL" ? 57789 : 15368 }));
  const ruleset = { id: contract.ruleset_id, source: repo.full_name, target: "branch", enforcement: "active",
    bypass_actors: [], conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
    rules: [{ type: "required_status_checks", parameters: { strict_required_status_checks_policy: true,
      required_status_checks: contexts } }] };
  const runs = contexts.map(({ context, integration_id }, i) => ({ name: context, id: i+1, head_sha: head,
    app: { id: integration_id }, status: "completed", conclusion: "success" }));
  const data = { pr, last: structuredClone(pr), ruleset, runs };
  let reads = 0;
  data.get = path => {
    if (path === "pulls/42") return ++reads === 1 ? data.pr : data.last;
    if (path === `rulesets/${contract.ruleset_id}`) return data.ruleset;
    assert.equal(path, `commits/${head}/check-runs?per_page=100&page=1`);
    return { total_count: data.runs.length, check_runs: data.runs };
  };
  return data;
}
test("all current, correctly issued contexts and clean GitHub state permit readiness", async () => {
  assert.equal((await mergeReadiness(42, head, fixture().get)).ready, true);
});
test("missing, ambiguous, pending, skipped, stale and wrongly issued results block", async () => {
  for (const mutate of [d => d.runs.pop(), d => d.runs.push({ ...d.runs[0], id: 100 }),
    d => d.runs[0].status = "in_progress", d => d.runs[0].conclusion = "skipped",
    d => d.runs[0].head_sha = "b".repeat(40), d => d.runs[0].app.id = 123,
    d => d.last.mergeable_state = "behind"]) {
    const d = fixture();
    mutate(d);
    assert.equal((await mergeReadiness(42, head, d.get)).ready, false);
  }
});
test("drifted rules and moving branches invalidate the snapshot", async () => {
  for (const mutate of [d => d.ruleset.rules[0].parameters.required_status_checks.pop(),
    d => d.ruleset.bypass_actors.push({}), d => d.last.base.sha = "c".repeat(40),
    d => d.last.head.sha = "d".repeat(40)]) {
    const d = fixture();
    mutate(d);
    await assert.rejects(mergeReadiness(42, head, d.get));
  }
});
