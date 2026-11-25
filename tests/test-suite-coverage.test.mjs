import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = path.join(repoRoot, "package.json");
const workflowPath = path.join(repoRoot, ".github/workflows/ci-fanmind.yml");
const testsDirectory = path.join(repoRoot, "tests");

const requiredCiRoots = [
  "test:operations",
  "test:staging-stripe-catalog",
  "test:staging-stripe-webhook",
  "test:database-authorization:pg17",
  "test:creator-foundation-transition",
];

function referencedScripts(command) {
  return [...command.matchAll(/(?:^|[;&|]\s*)npm\s+run\s+([A-Za-z0-9:_-]+)/gu)].map(
    (match) => match[1],
  );
}

function referencedTests(command) {
  return [...command.matchAll(/tests\/[A-Za-z0-9._/-]+\.test\.mjs/gu)].map(
    (match) => match[0],
  );
}

function collectReachableTests(scripts, scriptName, visited = new Set()) {
  assert.equal(typeof scripts[scriptName], "string", `missing package script ${scriptName}`);
  if (visited.has(scriptName)) {
    return new Set();
  }

  visited.add(scriptName);
  const command = scripts[scriptName];
  const reachable = new Set(referencedTests(command));
  for (const nestedScript of referencedScripts(command)) {
    for (const testPath of collectReachableTests(scripts, nestedScript, visited)) {
      reachable.add(testPath);
    }
  }
  return reachable;
}

test("every tracked Node policy test is owned by the required FanMind CI", async () => {
  const [packageText, workflow, entries] = await Promise.all([
    readFile(packagePath, "utf8"),
    readFile(workflowPath, "utf8"),
    readdir(testsDirectory, { withFileTypes: true }),
  ]);
  const scripts = JSON.parse(packageText).scripts;

  const ciOwnedTests = new Set();
  for (const rootScript of requiredCiRoots) {
    assert.match(
      workflow,
      new RegExp(`npm\\s+run\\s+${rootScript}(?:\\s|$)`, "u"),
      `${rootScript} must run in ci-fanmind.yml`,
    );
    for (const testPath of collectReachableTests(scripts, rootScript)) {
      ciOwnedTests.add(testPath);
    }
  }

  // The integration step runs only tests not already covered by Operations.
  // Check actual workflow command, not a comment or the unused package alias.
  const integrationStep = workflow.split("      - name: Website Chat and Inbox integration policies\n")[1]?.split("\n      - name:")[0];
  assert.ok(integrationStep, "missing integration step");
  const integrationCommand = integrationStep.split("\n").find(line => line.trim().startsWith("{ npm run "));
  assert.ok(integrationCommand, "missing integration command");
  const actual = new Set(referencedTests(integrationCommand));
  for (const match of integrationCommand.matchAll(/npm run ([A-Za-z0-9:_-]+)/gu)) {
    for (const file of collectReachableTests(scripts, match[1])) actual.add(file);
  }
  const operations = collectReachableTests(scripts, "test:operations");
  const expected = [...collectReachableTests(scripts, "test:release-integrations")].filter(file => !operations.has(file)).sort();
  assert.deepEqual([...actual].sort(), expected, "integration step must execute exactly the tests not covered by Operations");
  for (const file of actual) ciOwnedTests.add(file);

  const capacityStep = workflow.split("      - name: Prove Capacity grant reserve settle release reconciliation in PostgreSQL 17\n")[1]?.split("\n      - name:")[0];
  const nativeCommand = capacityStep?.split("\n").find(line => line.trim().startsWith("run: node --test "));
  assert.ok(nativeCommand, "required native Capacity command");
  for (const file of referencedTests(nativeCommand)) ciOwnedTests.add(file);
  for (const file of collectReachableTests(scripts, "test:ai-capacity")) {
    assert.ok(ciOwnedTests.has(file), `Capacity suite lost CI coverage for ${file}`);
  }

  const trackedTests = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".test.mjs"))
    .map((entry) => `tests/${entry.name}`)
    .sort();
  const orphaned = trackedTests.filter((testPath) => !ciOwnedTests.has(testPath));

  assert.deepEqual(orphaned, [], `Node policy tests missing from required CI: ${orphaned.join(", ")}`);
});
