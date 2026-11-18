import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import yaml from "js-yaml";
import { gunzipSync } from "node:zlib";
import { request } from "../scripts/operations/backup-worker-install-policy.mjs";
import { AUDIT_FILES, AUDIT_SOURCE, AUDIT_BASE, AUDIT_DEPENDENCIES, frozenFile, validatePair, replacePair, preservePreimages } from "../scripts/operations/install-production-audit-policy.mjs";

// The historical frozen verifier is the measured installed preimage. Its bytes
// remain immutable; the new verifier is reused directly from reviewed Main.
const frozenVerifier = JSON.parse(fs.readFileSync("tests/fixtures/production-audit-policy-verifier-935d1d8.json", "utf8"));
const newBytes = [fs.readFileSync("scripts/operations/read-only-production-audit.sh"), fs.readFileSync("scripts/operations/verify-production-audit-output.mjs")];
const oldBytes = [newBytes[0], gunzipSync(Buffer.from(frozenVerifier.content, "base64"))];
test("only the exact reviewed old or already installed audit pair is accepted", () => {
  assert.equal(crypto.createHash("sha256").update(oldBytes[1]).digest("hex"), frozenVerifier.sha256);
  assert.equal(frozenVerifier.sha256, AUDIT_FILES[1].old);
  assert.equal(validatePair(oldBytes, newBytes), "replace");
  assert.equal(validatePair(newBytes, newBytes), "installed");
  assert.throws(() => validatePair([Buffer.from("unreviewed collector"), oldBytes[1]], newBytes), /installed_hash_invalid/u);
  assert.throws(() => validatePair(oldBytes, [Buffer.from("changed"), newBytes[1]]), /source_hash_invalid/u);
  assert.throws(() => validatePair(newBytes, oldBytes), /source_hash_invalid/u);
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
  const preflight = workflow.jobs.validate.steps.at(-1).env;
  assert.doesNotThrow(() => request("verify", AUDIT_SOURCE, preflight.WORKER_SOURCE_COMMIT, preflight.EXPECTED_APPLICATION_COMMIT));
  for (const binding of ["270165082", "1259448985", "fanmind-prod-01-exoscale", "FANMIND_AUDIT_POLICY_INSTALL_APPROVAL", "admin-bypass-disabled", AUDIT_BASE, AUDIT_SOURCE, "install-audit-reviewed-policy", "6bc209851b4a54609747099ec34264318dc7f4c4", "backup-worker-install-github-preflight.mjs", "--nonblock", "O_NOFOLLOW"])
    assert.ok(source.includes(binding), binding);
  const hash = crypto.createHash("sha256").update(fs.readFileSync("scripts/operations/install-production-audit-policy.mjs")).digest("hex");
  assert.ok(source.includes(hash));
  assert.doesNotMatch(workflow.jobs.install.steps[0].run, /git reset|systemctl restart|pm2|db push|age --decrypt/u);
});

test("private preimages retain exact bytes before replacement and reject overwrite", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fanmind-audit-preimages-"));
  t.after(() => fs.rmSync(root, {recursive:true,force:true}));
  preservePreimages(root, oldBytes);
  const manifest = JSON.parse(fs.readFileSync(path.join(root,"preimages.json"),"utf8"));
  assert.equal(manifest.base,AUDIT_BASE); assert.equal(manifest.source,AUDIT_SOURCE);
  for (const [i,file] of AUDIT_FILES.entries()) {
    const target=path.join(root,file.name);
    assert.deepEqual(fs.readFileSync(target),oldBytes[i]);
    assert.equal(fs.statSync(target).mode & 0o777,0o600);
    assert.equal(manifest.files[file.name].sha256,crypto.createHash("sha256").update(oldBytes[i]).digest("hex"));
  }
  assert.throws(()=>preservePreimages(root,newBytes),/EEXIST/u);
  assert.deepEqual(fs.readFileSync(path.join(root,AUDIT_FILES[1].name)),oldBytes[1]);
});
test("unchanged collector is not rewritten and exact installed dependencies match reviewed Source",t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"fanmind-audit-retained-"));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const [i,file]of AUDIT_FILES.entries())fs.writeFileSync(path.join(root,file.name),oldBytes[i],{mode:0o755});
  const collector=path.join(root,AUDIT_FILES[0].name),before=fs.statSync(collector,{bigint:true});
  replacePair(root,oldBytes,newBytes,()=>{});
  const after=fs.statSync(collector,{bigint:true});
  assert.equal(after.ino,before.ino);assert.equal(after.mtimeNs,before.mtimeNs);
  const sources=["scripts/operations/production-boot-readiness.mjs","scripts/public-health-policy.mjs"];
  for(const [i,file]of AUDIT_DEPENDENCIES.entries())assert.equal(crypto.createHash("sha256").update(fs.readFileSync(sources[i])).digest("hex"),file.sha256);
});
