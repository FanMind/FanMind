import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import yaml from "js-yaml";
import { AUDIT_FILES, frozenFile, validatePair, replacePair } from "../scripts/operations/install-production-audit-policy.mjs";

const newBytes = AUDIT_FILES.map(file => fs.readFileSync(`scripts/operations/${file.name}`));
const oldBytes = [
  Buffer.from(newBytes[0].toString().replace("  { name: '1h', since: now - 60 * 60 * 1000 },\n", "").replace("window.name === '1h'", "window.name === '24h'").replaceAll("BACKUP_WORKER_1H_", "BACKUP_WORKER_24H_")),
  Buffer.from(newBytes[1].toString().replaceAll("BACKUP_WORKER_1H_", "BACKUP_WORKER_24H_")),
];
test("only the exact reviewed old or already installed audit pair is accepted", () => {
  assert.equal(validatePair(oldBytes, newBytes), "replace");
  assert.equal(validatePair(newBytes, newBytes), "installed");
  assert.throws(() => validatePair([newBytes[0], oldBytes[1]], newBytes), /installed_hash_invalid/u);
  assert.throws(() => validatePair(oldBytes, [Buffer.from("changed"), newBytes[1]]), /source_hash_invalid/u);
});
test("frozen input rejects symlinks, writable files and wrong owners", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fanmind-audit-frozen-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, "source");
  fs.writeFileSync(file, newBytes[0], { mode: 0o600 });
  assert.deepEqual(frozenFile(file, process.getuid(), 0o600), newBytes[0]);
  assert.throws(() => frozenFile(file, process.getuid() + 1, 0o600));
  fs.symlinkSync(file, path.join(root, "link"));
  assert.throws(() => frozenFile(path.join(root, "link"), process.getuid(), 0o600));
  fs.chmodSync(file, 0o666);
  assert.throws(() => frozenFile(file, process.getuid(), 0o600));
});
test("successful installation postchecks both new files; failed audit restores both exact preimages", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fanmind-audit-pair-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const read = () => AUDIT_FILES.map(file => fs.readFileSync(path.join(root, file.name)));
  const seed = () => AUDIT_FILES.forEach((file, i) => fs.writeFileSync(path.join(root, file.name), oldBytes[i], { mode: 0o755 }));
  seed();
  let checks = 0;
  replacePair(root, oldBytes, newBytes, () => { checks++; assert.deepEqual(read(), newBytes); });
  assert.equal(checks, 1); assert.deepEqual(read(), newBytes);
  seed();
  assert.throws(() => replacePair(root, oldBytes, newBytes, () => { assert.deepEqual(read(), newBytes); throw Error("audit_failure"); }), /install_rolled_back/u);
  assert.deepEqual(read(), oldBytes);
  assert.deepEqual(fs.readdirSync(root).sort(), AUDIT_FILES.map(file => file.name).sort());
});
test("protected manual workflow binds Owner, exact main, environment, host, approval, lock and installer bytes", () => {
  const source = fs.readFileSync(".github/workflows/install-production-audit-policy.yml", "utf8");
  const workflow = yaml.load(source);
  assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"]);
  assert.equal(workflow.jobs.install.environment, "backup-production-recovery");
  assert.equal(workflow.jobs.install.needs, "validate");
  assert.equal(workflow.concurrency.group, "fanmind-production-deploy");
  assert.equal(workflow.concurrency["cancel-in-progress"], false);
  for (const binding of ["270165082", "1259448985", "fanmind-prod-01-exoscale", "FANMIND_AUDIT_POLICY_INSTALL_APPROVAL", "admin-bypass-disabled", "707d22702a784e3b9999d1c9ae9c1e11c096a1bc", "935d1d806d09bd7291e89bcffb2250864dcf6739", "backup-worker-install-github-preflight.mjs", "--nonblock", "O_NOFOLLOW"])
    assert.ok(source.includes(binding), binding);
  const hash = crypto.createHash("sha256").update(fs.readFileSync("scripts/operations/install-production-audit-policy.mjs")).digest("hex");
  assert.ok(source.includes(hash));
  assert.doesNotMatch(workflow.jobs.install.steps[0].run, /git reset|systemctl restart|pm2|db push|age --decrypt/u);
});
