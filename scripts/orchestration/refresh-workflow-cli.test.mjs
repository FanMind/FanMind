import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("CLI updates a stale branch once and requires fresh exact-head checks for readiness", t => {
  const cwd = mkdtempSync(join(tmpdir(), "fanmind-refresh-"));
  t.after(() => rmSync(cwd, { force: true, recursive: true }));
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  git("init", "--quiet", "-b", "main");
  git("config", "user.name", "CI");
  git("config", "user.email", "fixture@localhost");
  git("config", "commit.gpgSign", "false");
  git("commit", "--quiet", "--allow-empty", "-m", "initial");
  git("switch", "--quiet", "-c", "topic");
  git("commit", "--quiet", "--allow-empty", "-m", "PR");
  const oldHead = git("rev-parse", "HEAD");
  git("switch", "--quiet", "main");
  git("commit", "--quiet", "--allow-empty", "-m", "new base");
  const base = git("rev-parse", "HEAD");
  git("switch", "--quiet", "topic");

  const local = path => fileURLToPath(new URL(path, import.meta.url));
  writeFileSync(join(cwd, "gh"), '#!/bin/sh\nexec "$FIXTURE_NODE" "$FIXTURE_GH" "$@"\n', { mode: 0o700 });
  const env = { PATH: cwd + ":" + process.env.PATH, HOME: cwd, FIXTURE_NODE: process.execPath,
    FIXTURE_GH: local("./fixtures/gh-refresh.mjs") };
  const cli = (script, args, expectedExit = 0) => {
    const result = spawnSync(process.execPath, [local(script), ...args], { cwd, env, encoding: "utf8" });
    assert.equal(result.status, expectedExit, result.stderr);
    return JSON.parse(result.stdout);
  };

  writeFileSync(join(cwd, "passed-head"), oldHead);
  assert.deepEqual(cli("./refresh-automerge-candidates.mjs", [""]), [{ number: 42, status: "UPDATE_REQUESTED" }]);
  const newHead = git("rev-parse", "topic");
  assert.equal(git("rev-parse", "topic^1"), oldHead);
  assert.equal(git("rev-parse", "topic^2"), base);
  assert.deepEqual(cli("./refresh-automerge-candidates.mjs", ["42"]), [{ number: 42, status: "NO_UPDATE" }]);
  assert.equal(readFileSync(join(cwd, "updates"), "utf8"), oldHead + "\n");
  const pending = cli("./merge-readiness.mjs", ["42", newHead], 1);
  assert.equal(pending.ready, false);
  assert.equal(pending.checks.length, 12);
  assert.ok(pending.checks.every(check => check.state === "pending"));
  writeFileSync(join(cwd, "passed-head"), newHead);
  assert.equal(cli("./merge-readiness.mjs", ["42", newHead]).ready, true);
  assert.equal(git("rev-parse", "main"), base);
});
