// Isolated Linux credential regression only; never reads a Production path.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

assert.equal(process.getuid(), 0);
const repository = process.argv[2];
const { verifyCollectedAudit, AUDIT_BASE } = await import(pathToFileURL(path.join(repository, "scripts/operations/install-production-audit-policy.mjs")));
const { monthlyAuditFixture } = await import(pathToFileURL(path.join(repository, "tests/fixtures/monthly-audit.mjs")));
const clean = { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_NO_REPLACE_OBJECTS: "1", GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1" };
const run = (command, args) => {
  const result = spawnSync(command, args, { env: clean, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
};
const uid = Number(run("/usr/bin/id", ["-u", "nobody"])), gid = Number(run("/usr/bin/id", ["-g", "nobody"]));
assert.ok(uid > 0 && gid > 0);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "fanmind-owner-regression-"));
try {
  fs.chmodSync(temporary, 0o755);
  const worktree = path.join(temporary, "worktree"); fs.mkdirSync(worktree);
  const git = (...args) => run("/usr/bin/git", ["--no-replace-objects", "-C", worktree, ...args]);
  git("init", "-b", "main");
  const commits = [];
  for (let i = 0; i < 2; i++) {
    fs.writeFileSync(path.join(worktree, "synthetic.txt"), `synthetic ${i}\n`);
    git("add", "synthetic.txt");
    git("-c", "user.name=Synthetic", "-c", "user.email=fixture@example.invalid", "commit", "-m", `fixture ${i}`);
    commits.push(git("rev-parse", "HEAD"));
  }
  const [live, origin] = commits;
  git("remote", "add", "origin", "https://github.com/FanMind/FanMind.git");
  git("update-ref", "refs/remotes/origin/main", origin);
  git("checkout", "--detach", live);
  const chownFixture = file => {
    if (fs.lstatSync(file).isDirectory()) for (const name of fs.readdirSync(file)) chownFixture(path.join(file, name));
    fs.chownSync(file, uid, gid);
  };
  chownFixture(worktree);
  const rejected = spawnSync("/usr/bin/git", ["--no-replace-objects", "-C", worktree, "rev-parse", "--show-toplevel"], { env: clean, encoding: "utf8" });
  assert.notEqual(rejected.status, 0); assert.match(rejected.stderr, /detected dubious ownership/u);
  const config = fs.readFileSync(path.join(worktree, ".git/config"));
  const code = path.join(temporary, "code");
  // Root-owned, world-readable copies of the unchanged three-module verifier.
  for (const file of ["scripts/operations/verify-production-audit-output.mjs", "scripts/operations/production-boot-readiness.mjs", "scripts/public-health-policy.mjs"]) {
    fs.mkdirSync(path.dirname(path.join(code, file)), { recursive: true, mode: 0o755 });
    fs.writeFileSync(path.join(code, file), fs.readFileSync(path.join(repository, file)), { mode: 0o644 });
  }
  const canonical = pathToFileURL(path.join(code, "scripts/operations/verify-production-audit-output.mjs")).href;
  const receipt = path.join(temporary, "private"); fs.mkdirSync(receipt, { mode: 0o700 });
  const raw = monthlyAuditFixture(live, origin), output = path.join(receipt, "audit.txt"); fs.writeFileSync(output, raw, { mode: 0o600 });
  const fixtureModule = path.join(code, "fixture.mjs");
  fs.writeFileSync(fixtureModule, `import fs from 'node:fs'; import assert from 'node:assert/strict';
import {verifyProductionAuditOutput as verify, readTrackingProvenance} from ${JSON.stringify(canonical)};
const live=${JSON.stringify(live)}, origin=${JSON.stringify(origin)};
const requestJson=endpoint=>{
 if(endpoint==='/')return {id:1259448985,full_name:'FanMind/FanMind',default_branch:'main',fork:false,archived:false,disabled:false};
 if(endpoint==='/git/ref/heads/main')return {ref:'refs/heads/main',object:{type:'commit',sha:origin}};
 if(endpoint==='/compare/'+live+'...'+origin+'?per_page=1&page=2')return {base_commit:{sha:live},merge_base_commit:{sha:live},behind_by:0,ahead_by:1,total_commits:1,status:'ahead'};
 if(endpoint==='/compare/'+origin+'...'+origin+'?per_page=1&page=2')return {base_commit:{sha:origin},merge_base_commit:{sha:origin},behind_by:0,ahead_by:0,total_commits:0,status:'identical'};
 throw Error('unexpected endpoint');
};
export function verifyProductionAuditOutput(raw,expected){
 assert.throws(()=>fs.readFileSync(${JSON.stringify(output)}),/EACCES/);
 const result=verify(raw,expected,{trackingReader:(l,o)=>readTrackingProvenance(l,o,{root:${JSON.stringify(worktree)},requestJson})});
 assert.equal(result.tracking.classification,'MAIN_EXACT');
 console.log('UNPRIVILEGED_FULL_AUDIT=PASS');
}
`, { mode: 0o644 });
  let child;
  const execute = (command, args, options) => {
    assert.equal(command, "/usr/sbin/runuser"); assert.equal(args[1], "ubuntu"); assert.equal(args[8], AUDIT_BASE);
    assert.equal(args[3], "/usr/bin/node");
    const fixtureArgs = [...args]; fixtureArgs[1] = "nobody"; fixtureArgs[3] = process.execPath; fixtureArgs[7] = pathToFileURL(fixtureModule).href; fixtureArgs[8] = live;
    child = spawnSync(command, fixtureArgs, options); return child;
  };
  verifyCollectedAudit({ status: 0, stdout: raw }, uid, clean, execute);
  assert.match(child.stdout, /UNPRIVILEGED_FULL_AUDIT=PASS/u);
  assert.deepEqual(fs.readFileSync(path.join(worktree, ".git/config")), config);
  assert.equal(fs.statSync(worktree).uid, uid); assert.equal(fs.statSync(path.join(worktree, ".git")).uid, uid);
  const receiptFd = fs.openSync(output, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const metadata = fs.fstatSync(receiptFd);
    assert.equal(metadata.uid, 0); assert.equal(metadata.mode & 0o777, 0o600);
    assert.equal(fs.readFileSync(receiptFd, "utf8"), raw);
  } finally { fs.closeSync(receiptFd); }
  assert.equal(fs.statSync(receipt).mode & 0o777, 0o700);
  // The corrected identity must not accept a foreign repository either.
  fs.writeFileSync(path.join(worktree, ".git/config"), config.toString().replace("https://github.com/FanMind/FanMind.git", "https://github.com/foreign/repository.git"));
  assert.throws(() => verifyCollectedAudit({ status: 0, stdout: raw }, uid, clean, execute), /audit_postcheck_failed/u);
  assert.match(child.stderr, /production_audit_tracking_provenance_invalid/u);
  console.log("AUDIT_OWNER_CONTEXT_REGRESSION=PASS");
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
