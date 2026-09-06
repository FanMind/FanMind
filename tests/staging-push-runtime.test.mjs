import assert from "node:assert/strict";
import test from "node:test";
import { planPushRuntime, renderPushRuntime, privateFile } from "../scripts/operations/staging-push-runtime.mjs";

import mobileConfig from "../apps/mobile/app.config.js";
const project = mobileConfig.RUNTIME_EAS_PROJECT_ID;
const base = { FANMIND_PUSH_RUNTIME_EXPECTED_EAS_PROJECT: project };
const key = "a".repeat(64);

test("registration setup preserves the existing encryption key with or without registrations", () => {
  for (const exists of [true, false]) {
    const plan = planPushRuntime({ ...base, FANMIND_PUSH_TOKEN_ENCRYPTION_KEY: key }, exists, () => { throw Error("rotation"); });
    assert.equal(plan.key, key);
    assert.equal(plan.generated, false);
  }
});
test("a missing key can be generated only for an empty registration table", () => {
  assert.equal(planPushRuntime(base, false, () => key).key, key);
  assert.throws(() => planPushRuntime(base, true), /key_recovery_required/);
  assert.throws(() => planPushRuntime({ ...base, FANMIND_PUSH_TOKEN_ENCRYPTION_KEY: "invalid" }, false), /key_configuration/);
});
test("an unexpected existing EAS binding cannot be overwritten", () => {
  assert.throws(() => planPushRuntime({ ...base, FANMIND_MOBILE_PUSH_EAS_PROJECT_ID: "22222222-2222-4222-8222-222222222222" }, false), /project_mismatch/);
});
test("configuration changes only registration fields, preserving billing and delivery gates", () => {
  const original = "FANMIND_STRIPE_BILLING_WRITE_FREEZE=true\nFANMIND_MOBILE_PUSH_DELIVERY_ENABLED=false\nOTHER='keep $literal'\nFANMIND_PUSH_TOKEN_ENCRYPTION_KEY='placeholder'\n";
  const result = renderPushRuntime(original, { key, project });
  assert.match(result, /FANMIND_STRIPE_BILLING_WRITE_FREEZE=true/);
  assert.match(result, /FANMIND_MOBILE_PUSH_DELIVERY_ENABLED=false/);
  assert.ok(result.includes("OTHER='keep $literal'"));
  assert.equal(result.match(/FANMIND_PUSH_TOKEN_ENCRYPTION_KEY=/g).length, 1);
  assert.equal(renderPushRuntime(result, { key, project }), result);
});


test("private configuration reads the checked descriptor and rejects symlinks or broad permissions", async () => {
  const { mkdtemp, writeFile, symlink, chmod, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const root = await mkdtemp(join(tmpdir(), "fanmind-push-file-"));
  try {
    const path = join(root, "config");
    await writeFile(path, "private fixture", { mode: 0o600 });
    assert.equal(privateFile(path), "private fixture");
    await symlink(path, join(root, "link"));
    assert.throws(() => privateFile(join(root, "link")));
    await chmod(path, 0o644);
    assert.throws(() => privateFile(path), /private_file_invalid/);
  } finally { await rm(root, { recursive: true, force: true }); }
});


test("host reprovisioning preserves the existing encryption key and project", async () => {
  const { preservePushRuntimeFields } = await import("../scripts/operations/staging-push-key-preservation.mjs");
  const previous = `FANMIND_PUSH_TOKEN_ENCRYPTION_KEY='${key}'\nFANMIND_MOBILE_PUSH_EAS_PROJECT_ID='${project}'\nOLD=value\n`;
  const result = preservePushRuntimeFields(previous, "NEW=value\n");
  assert.ok(result.includes(key));
  assert.ok(result.includes(project));
  assert.ok(result.includes("NEW=value"));
  assert.ok(!result.includes("OLD=value"));
  assert.equal(preservePushRuntimeFields("OLD=value\n", "NEW=value\n"), "NEW=value\n");
  assert.throws(() => preservePushRuntimeFields("FANMIND_PUSH_TOKEN_ENCRYPTION_KEY=corrupt", ""), /push_preservation_invalid/);
  assert.throws(() => preservePushRuntimeFields(previous + previous, ""), /push_preservation_invalid/);
});

test("runtime activation consumes exact successful acceptance and independent production binding", async () => {
  const { readFile } = await import("node:fs/promises");
  const workflow = await readFile(".github/workflows/staging-push-runtime.yml", "utf8");
  assert.match(workflow, /needs: verify-acceptance/);
  assert.match(workflow, /run.head_sha !== process.env.GITHUB_SHA/);
  assert.match(workflow, /run.conclusion !== 'success'/);
  assert.match(workflow, /job.conclusion !== 'success'/);
  assert.match(workflow, /Run synthetic rollback-only Staging acceptance/);
  assert.match(workflow, /step.conclusion === 'success'/);
  assert.match(workflow, /run.path !== '.github\/workflows\/mobile-push-staging-acceptance.yml'/);
  assert.match(workflow, /FANMIND_PUSH_RUNTIME_EXPECTED_PRODUCTION_PROJECT:.*vars.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF/);
});
