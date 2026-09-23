import "./creator-confirmed-chat-learning.cases.mjs";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = path.join(
  repoRoot,
  "scripts/operations/creator-confirmed-chat-learning-migration-runner.mjs",
);

test("confirmed-chat rollout runner pins the reviewed SQL and stays offline in check mode", async () => {
  const runner = await readFile(runnerPath, "utf8");
  assert.match(runner, /EXPECTED_MIGRATION_GIT_BLOB_SHA1 = "b09a22643d5076e68cfe7816980e88d0d00272f7"/u);
  assert.match(runner, /set transaction read only/u);
  assert.match(runner, /production_apply_forbidden/u);
  assert.match(runner, /source_state_not_installed/u);
  assert.match(runner, /installed_target_with_preinstall_source/u);

  const result = spawnSync(process.execPath, [runnerPath, "--check"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /CREATOR_CONFIRMED_CHAT_MIGRATION_CHECKSUM=verified/u);
  assert.match(result.stdout, /CREATOR_CONFIRMED_CHAT_MIGRATION_CONTRACT=verified/u);
  assert.match(result.stdout, /CREATOR_CONFIRMED_CHAT_MIGRATION_SHA256=[0-9a-f]{64}/u);
  assert.match(result.stdout, /CREATOR_CONFIRMED_CHAT_SOURCE_STATE=preinstall/u);
  assert.match(result.stdout, /CREATOR_CONFIRMED_CHAT_APPLY=not_requested/u);
  console.log(result.stdout.trim());
});

test("confirmed-chat apply fails before target access while source state is preinstall", () => {
  const result = spawnSync(process.execPath, [runnerPath, "--apply"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      FANMIND_CREATOR_CONFIRMED_CHAT_APPLY_CONFIRMATION: "apply-creator-confirmed-chat-learning",
      FANMIND_NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=source_state_not_installed/u);
});

test("confirmed-chat verify requires exact target binding and normal deploy never applies the schema", async () => {
  const deploy = await readFile(path.join(repoRoot, ".github/workflows/deploy-fanmind.yml"), "utf8");
  assert.doesNotMatch(
    deploy,
    /creator-confirmed-chat-learning-migration-runner|20260923023000_creator_confirmed_chat_learning\.sql/u,
  );

  const result = spawnSync(process.execPath, [runnerPath, "--verify"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "" },
  });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=runtime_environment_invalid/u,
  );
});
