import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import yaml from "js-yaml";
import { gunzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { monthlyAuditFixture } from "./fixtures/monthly-audit.mjs";
import { request, WORKER_COMMIT } from "../scripts/operations/backup-worker-install-policy.mjs";
import { AUDIT_FILES, AUDIT_SOURCE, AUDIT_BASE, AUDIT_DEPENDENCIES, frozenFile, validatePair, replacePair, preservePreimages, verifyCollectedAudit } from "../scripts/operations/install-production-audit-policy.mjs";

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
  // The historical audit-install workflow remains frozen. Its pre-existing
  // old worker pin is not a valid current backup-worker installation authority.
  assert.notEqual(preflight.WORKER_SOURCE_COMMIT, WORKER_COMMIT);
  assert.throws(() => request("verify", AUDIT_SOURCE, preflight.WORKER_SOURCE_COMMIT, preflight.EXPECTED_APPLICATION_COMMIT), {code:"release_binding_invalid"});
  assert.doesNotThrow(() => request("verify", AUDIT_SOURCE, WORKER_COMMIT, preflight.EXPECTED_APPLICATION_COMMIT));
  for (const binding of ["270165082", "1259448985", "fanmind-prod-01-exoscale", "FANMIND_AUDIT_POLICY_INSTALL_APPROVAL", "admin-bypass-disabled", AUDIT_BASE, AUDIT_SOURCE, "install-audit-reviewed-policy", "6bc209851b4a54609747099ec34264318dc7f4c4", "backup-worker-install-github-preflight.mjs", "--nonblock", "O_NOFOLLOW"])
    assert.ok(source.includes(binding), binding);
  const hash = crypto.createHash("sha256").update(fs.readFileSync("scripts/operations/install-production-audit-policy.mjs")).digest("hex");
  const install = workflow.jobs.install.steps[0].run;
  const sourceBase = `https://raw.githubusercontent.com/FanMind/FanMind/${AUDIT_SOURCE}/scripts/operations`;
  assert.ok(install.includes(`"$CURRENT_MAIN:install-audit-reviewed-policy:${AUDIT_SOURCE}:${AUDIT_BASE}:admin-bypass-disabled"`));
  assert.ok(install.includes(`${sourceBase}/read-only-production-audit.sh --output "$COLLECTOR"`));
  assert.ok(install.includes(`${sourceBase}/verify-production-audit-output.mjs --output "$VERIFIER"`));
  assert.ok(install.includes(`"$INSTALLER" ${hash} "$COLLECTOR" "$VERIFIER"`));
  assert.doesNotMatch(install, /git reset|systemctl restart|pm2|db push|age --decrypt/u);
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
test("unchanged collector is not rewritten and the historical install keeps its dependency pins",t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"fanmind-audit-retained-"));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const [i,file]of AUDIT_FILES.entries())fs.writeFileSync(path.join(root,file.name),oldBytes[i],{mode:0o755});
  const collector=path.join(root,AUDIT_FILES[0].name),before=fs.statSync(collector,{bigint:true});
  replacePair(root,oldBytes,newBytes,()=>{});
  const after=fs.statSync(collector,{bigint:true});
  assert.equal(after.ino,before.ino);assert.equal(after.mtimeNs,before.mtimeNs);
  // This one-shot installer verified already installed boot bytes on AUDIT_BASE.
  // Later boot sources belong to a separate reviewed installation.
  assert.deepEqual(AUDIT_DEPENDENCIES, [
    { path: "/usr/local/lib/fanmind-audit/production-boot-readiness.mjs",
      sha256: "fe183af14219860c9772a7d3fd659b6896e819f52b83423316ec94c9cff8d7c0" },
    { path: "/usr/local/lib/public-health-policy.mjs",
      sha256: crypto.createHash("sha256").update(fs.readFileSync("scripts/public-health-policy.mjs")).digest("hex") },
  ]);
});

test("postcheck streams the same audit to the full unchanged verifier as the collector identity", () => {
  const audit = { status: 0, stdout: monthlyAuditFixture(AUDIT_BASE, AUDIT_BASE) };
  const environment = { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" };
  const execute = (command, args, options) => {
    assert.equal(command, "/usr/sbin/runuser");
    assert.deepEqual(args.slice(0, 6), ["-u", "ubuntu", "--", "/usr/bin/node", "--input-type=module", "-e"]);
    assert.equal(args[7], "file:///usr/local/lib/fanmind-audit/verify-production-audit-output.mjs");
    assert.equal(args[8], AUDIT_BASE);
    assert.equal(args[9], String(process.getuid()));
    assert.equal(options.input, audit.stdout);
    assert.deepEqual(options.env, environment);
    assert.ok(!args.includes(audit.stdout), "private audit bytes never enter argv");
    // Only redirect the installed module URL to its identical reviewed source.
    const actual = [...args.slice(4)];
    actual[3] = pathToFileURL(path.resolve("scripts/operations/verify-production-audit-output.mjs")).href;
    return spawnSync(process.execPath, actual, options);
  };
  verifyCollectedAudit(audit, process.getuid(), environment, execute);
  for (const mutation of [
    audit.stdout.replace(`LIVE_RELEASE=${AUDIT_BASE}`, `LIVE_RELEASE=${"f".repeat(40)}`),
    audit.stdout.replace("BACKUP_VERIFY_OK=true", "BACKUP_VERIFY_OK=false"),
    audit.stdout.replace("AUDIT_RESULT=success", "AUDIT_RESULT=failed"),
  ]) {
    audit.stdout = mutation;
    assert.throws(() => verifyCollectedAudit(audit, process.getuid(), environment, execute), /audit_postcheck_failed/u);
  }
});

test("collection failures never validate and failed identity/process checks retain exact rollback", t => {
  const good = { status: 0, stdout: monthlyAuditFixture(AUDIT_BASE, AUDIT_BASE) };
  const mustNotRun = () => { throw Error("unexpected verification"); };
  for (const bad of [{ ...good, status: 1 }, { ...good, status: null }, { ...good, error: Error("timeout") },
    { ...good, stdout: "x".repeat(2 * 1024 * 1024 + 1) }])
    assert.throws(() => verifyCollectedAudit(bad, process.getuid(), {}, mustNotRun), /audit_postcheck_failed/u);
  assert.throws(() => verifyCollectedAudit(good, 0, {}, mustNotRun), /audit_postcheck_failed/u);
  for (const result of [{ status: 1 }, { status: null, error: Error("timeout") }])
    assert.throws(() => verifyCollectedAudit(good, process.getuid(), {}, () => result), /audit_postcheck_failed/u);
  // Execute the actual bootstrap with a mismatched identity; no verifier import.
  assert.throws(() => verifyCollectedAudit(good, process.getuid() + 1, {}, (_command, args, options) =>
    spawnSync(process.execPath, args.slice(4), options)), /audit_postcheck_failed/u);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "fanmind-postcheck-rollback-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [i, file] of AUDIT_FILES.entries()) fs.writeFileSync(path.join(root, file.name), oldBytes[i], { mode: 0o755 });
  assert.throws(() => replacePair(root, oldBytes, newBytes, () =>
    verifyCollectedAudit(good, process.getuid(), {}, () => ({ status: 1 }))), /install_rolled_back/u);
  assert.deepEqual(AUDIT_FILES.map(file => fs.readFileSync(path.join(root, file.name))), oldBytes);
});

test("real root Git ownership rejection becomes unprivileged full provenance success without exceptions", t => {
  // Deployment runners must never acquire extra root access for a CI fixture.
  // The existing GitHub-hosted CI still requires the actual root regression.
  if (process.env.GITHUB_ACTIONS === "true" && process.env.RUNNER_ENVIRONMENT === "self-hosted") {
    t.skip("root fixture belongs to GitHub-hosted CI, never a self-hosted deployment");
    return;
  }
  const root = process.getuid() === 0;
  const sudo = root ? null : spawnSync("/usr/bin/sudo", ["-n", "/usr/bin/true"]);
  if (!root && (sudo.error || sudo.status !== 0)) {
    assert.notEqual(process.env.GITHUB_ACTIONS, "true", "GitHub CI must execute the real root regression");
    t.skip("local sudo unavailable; exact-head GitHub CI must execute root regression");
    return;
  }
  const args = [path.resolve("tests/fixtures/audit-postcheck-owner.mjs"), process.cwd()];
  const result = spawnSync(root ? process.execPath : "/usr/bin/sudo", root ? args : ["-n", process.execPath, ...args],
    { env: { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" }, encoding: "utf8", timeout: 30000, maxBuffer: 131072 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /AUDIT_OWNER_CONTEXT_REGRESSION=PASS/u);
});

test("self-hosted deployment skips the root fixture before probing privileged execution", () => {
  const environment = { ...process.env, GITHUB_ACTIONS: "true", RUNNER_ENVIRONMENT: "self-hosted" };
  delete environment.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ["--test", "--test-name-pattern=^real root Git ownership rejection", "tests/production-audit-policy-install.test.mjs"],
    { env: environment, encoding: "utf8", timeout: 30000, maxBuffer: 131072 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /root fixture belongs to GitHub-hosted CI, never a self-hosted deployment/u);
});
