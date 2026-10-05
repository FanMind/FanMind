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
  assert.match(workflow, /task_id:[\s\S]*required: true/u);
  assert.match(workflow, /handoff_id:[\s\S]*required: true/u);
  assert.match(workflow, /previous_task_id:[\s\S]*required: true/u);
  assert.match(workflow, /payload_sha256:[\s\S]*required: true/u);
  assert.match(workflow, /handoff_base64:[\s\S]*required: true/u);
  assert.match(workflow, /REQUESTED_TASK_ID: \$\{\{ inputs\.task_id \}\}/u);
  assert.doesNotMatch(workflow, /REQUESTED_TASK:/u);
  assert.match(workflow, /ref: main/u);
  assert.match(workflow, /permissions:[\s\S]*contents: read/u);
  assert.doesNotMatch(workflow, /contents: write/u);
  assert.doesNotMatch(workflow, /actions: read|checks: read|pull-requests: read/u);
  assert.doesNotMatch(workflow, /--github-token|GITHUB_TOKEN/u);
  assert.ok(
    workflow.indexOf("Checkout fresh main")
      < workflow.indexOf("fanmind_orchestrator_admission.py dispatch"),
  );
  assert.match(workflow, /fanmind-orchestrator-builder-lifecycle/u);
  assert.match(workflow, /fanmind_orchestrator_admission.py await-closeout/u);
  assert.doesNotMatch(workflow, /curl[\s\S]*workspace_agents/u);
});
