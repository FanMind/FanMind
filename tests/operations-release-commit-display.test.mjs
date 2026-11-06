import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const operationsPage = await readFile(
  new URL("../src/app/admin/operations/page.tsx", import.meta.url),
  "utf8",
);

test("Operations Center prefers the deployed release commit over CI fallbacks", () => {
  const releaseCommit = operationsPage.indexOf(
    "process.env.FANMIND_RELEASE_COMMIT",
  );
  const vercelCommit = operationsPage.indexOf(
    "process.env.VERCEL_GIT_COMMIT_SHA",
  );
  const githubCommit = operationsPage.indexOf("process.env.GITHUB_SHA");

  assert.ok(releaseCommit >= 0);
  assert.ok(vercelCommit > releaseCommit);
  assert.ok(githubCommit > vercelCommit);
});
