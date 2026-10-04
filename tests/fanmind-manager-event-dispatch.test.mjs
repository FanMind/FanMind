import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ORCHESTRATOR_RECEIPT_PATH,
  classifyManagerPrFiles,
} from "../scripts/orchestration/classify-manager-pr-files.mjs";

const file = (filename) => ({ filename });

test("suppresses only a complete receipt-only merged PR", () => {
  assert.deepEqual(
    classifyManagerPrFiles({
      pages: [[file(ORCHESTRATOR_RECEIPT_PATH)]],
      expectedChangedFiles: 1,
    }),
    { receiptOnly: true, classification: "receipt_only", observedCount: 1 },
  );
});

test("dispatches product-only and mixed receipt/product merged PRs", () => {
  for (const pages of [
    [[file("src/app/page.tsx")]],
    [[file(ORCHESTRATOR_RECEIPT_PATH), file("src/app/page.tsx")]],
  ]) {
    const result = classifyManagerPrFiles({
      pages,
      expectedChangedFiles: pages[0].length,
    });
    assert.equal(result.receiptOnly, false);
    assert.equal(result.classification, "dispatch");
  }
});

test("incomplete or malformed enumeration is uncertain and never receipt-only", () => {
  for (const input of [
    { pages: [[file(ORCHESTRATOR_RECEIPT_PATH)]], expectedChangedFiles: 2 },
    { pages: [[{}]], expectedChangedFiles: 1 },
    { pages: null, expectedChangedFiles: 1 },
  ]) {
    const result = classifyManagerPrFiles(input);
    assert.equal(result.receiptOnly, false);
    assert.equal(result.classification, "uncertain");
  }
});

test("workflow is explicit Orchestrator-only dispatch with mandatory correlation", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/fanmind-manager-event-dispatch.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /workflow_dispatch:/u);
  assert.doesNotMatch(workflow, /pull_request:/u);
  assert.match(workflow, /task:[\s\S]*required: true/u);
  assert.match(workflow, /task_id:[\s\S]*required: true/u);
  assert.match(workflow, /REQUESTED_TASK: \$\{\{ inputs\.task \}\}/u);
  assert.match(workflow, /REQUESTED_TASK_ID: \$\{\{ inputs\.task_id \}\}/u);
  assert.match(workflow, /sole authority for selecting the next independent FanMind task/u);
  assert.match(workflow, /do not select, start, continue, or substitute another independent roadmap task/u);
  assert.doesNotMatch(workflow, /gh api --paginate --slurp/u);
});
