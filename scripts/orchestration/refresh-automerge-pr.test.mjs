import assert from "node:assert/strict";
import test from "node:test";
import { refreshAutomergePr } from "./refresh-automerge-pr.mjs";

const head = "a".repeat(40);
const eligible = {
  state: "OPEN", isDraft: false, baseRefName: "main", headRefOid: head,
  headRepository: { nameWithOwner: "FanMind/FanMind" }, mergeStateStatus: "BEHIND",
  autoMergeRequest: { enabledAt: "2026-11-25T12:00:00Z" },
};

function exercise(overrides, expectedWrites) {
  const calls = [];
  const result = refreshAutomergePr("42", head, args => {
    calls.push(args);
    return JSON.stringify({ data: { repository: { pullRequest: { ...eligible, ...overrides } } } });
  });
  assert.equal(calls.length, 1 + expectedWrites);
  if (expectedWrites) {
    assert.deepEqual(calls[1], ["api", "--method", "PUT", "repos/FanMind/FanMind/pulls/42/update-branch", "-f", `expected_head_sha=${head}`]);
  }
  return result;
}
test("request one guarded update for the selected behind PR", () => {
  assert.equal(exercise({}, 1), "UPDATE_REQUESTED");
});
test("leave other branches, states, heads and opt-outs alone", () => {
  for (const change of [{ state: "MERGED" }, { isDraft: true }, { baseRefName: "release" },
    { headRefOid: "b".repeat(40) }, { headRepository: null }, { autoMergeRequest: null },
    { mergeStateStatus: "CLEAN" }]) {
    assert.equal(exercise(change, 0), "NO_UPDATE");
  }
});
test("report conflicts and uncomputed merge states without writing", () => {
  assert.equal(exercise({ mergeStateStatus: "DIRTY" }, 0), "CONFLICT");
  assert.equal(exercise({ mergeStateStatus: "UNKNOWN" }, 0), "MERGE_STATE_UNKNOWN");
});
test("API and validation failures never authorize a write", () => {
  assert.throws(() => refreshAutomergePr("42", head, () => "{}"), /pr_metadata_unavailable/);
  assert.throws(() => refreshAutomergePr("42", "main", () => assert.fail()), /invalid_pr_or_head/);
});
