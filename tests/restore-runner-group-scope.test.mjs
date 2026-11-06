import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

import {
  FANMIND_REPOSITORY_ID,
  POLICY_MAX_AGE_MS,
  parseRunnerGroupScopeCapture,
  validateRunnerGroupScopeCapture,
} from "../scripts/operations/verify-restore-runner-group-scope.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = resolve("scripts/operations/verify-restore-runner-group-scope.mjs");
const FIXTURE_ORGANIZATION = "synthetic-test-organization";

function validCapture(capturedAt = new Date().toISOString(), repositoryPrivate = false) {
  const fullName = `${FIXTURE_ORGANIZATION}/FanMind`;
  return {
    schemaVersion: 1,
    capturedAt,
    capture: {
      method: "github-organization-admin-policy-capture",
      performedByRole: "organization-runner-group-administrator",
      containsSecrets: false,
    },
    organization: { login: FIXTURE_ORGANIZATION },
    repository: {
      id: FANMIND_REPOSITORY_ID,
      name: "FanMind",
      fullName,
      ownerLogin: FIXTURE_ORGANIZATION,
      ownerType: "Organization",
      private: repositoryPrivate,
    },
    runnerGroup: {
      name: "fanmind-restore-drill",
      visibility: "selected",
      allowsPublicRepositories: !repositoryPrivate,
      restrictedToWorkflows: true,
      selectedRepositoryIds: [FANMIND_REPOSITORY_ID],
      selectedWorkflows: [
        `${fullName}/.github/workflows/restore-drill-resource-readiness.yml@refs/heads/main`,
        `${fullName}/.github/workflows/restore-drill-database.yml@refs/heads/main`,
        `${fullName}/.github/workflows/restore-drill-host-readiness.yml@refs/heads/main`,
      ],
    },
  };
}

test("offline scope contract accepts exact public and private organization policies", () => {
  const now = Date.now();
  for (const repositoryPrivate of [false, true]) {
    const capture = validCapture(new Date(now - 1_000).toISOString(), repositoryPrivate);
    const parsed = parseRunnerGroupScopeCapture(Buffer.from(JSON.stringify(capture)));
    const result = validateRunnerGroupScopeCapture(parsed, { now });
    assert.equal(result.repositoryVisibility, repositoryPrivate ? "private" : "public");
  }
});

test("repository identity and organization context are inseparable", () => {
  for (const mutate of [
    (capture) => { capture.repository.id += 1; },
    (capture) => { capture.repository.ownerType = "User"; },
    (capture) => { capture.repository.ownerLogin = "different-organization"; },
    (capture) => { capture.repository.fullName = "different-organization/FanMind"; },
    (capture) => { capture.repository.name = "fanmind"; },
  ]) {
    const capture = validCapture();
    mutate(capture);
    assert.throws(
      () => validateRunnerGroupScopeCapture(capture),
      /scope_repository_context_invalid/u,
    );
  }

  for (const invalidLogin of ["K-org", "ſ-org", "synthetic_org"]) {
    const capture = validCapture();
    capture.organization.login = invalidLogin;
    capture.repository.ownerLogin = invalidLogin;
    capture.repository.fullName = `${invalidLogin}/FanMind`;
    assert.throws(
      () => validateRunnerGroupScopeCapture(capture),
      /scope_organization_invalid/u,
    );
  }
});

test("runner group is selected-repository-only and public repositories require explicit allowance", () => {
  for (const [mutate, code] of [
    [(capture) => { capture.runnerGroup.name = "Default"; }, "scope_runner_group_policy_invalid"],
    [(capture) => { capture.runnerGroup.visibility = "all"; }, "scope_runner_group_policy_invalid"],
    [(capture) => { capture.runnerGroup.restrictedToWorkflows = false; }, "scope_runner_group_policy_invalid"],
    [(capture) => { capture.runnerGroup.selectedRepositoryIds.push(99); }, "scope_selected_repositories_invalid"],
    [(capture) => { capture.runnerGroup.selectedRepositoryIds = []; }, "scope_selected_repositories_invalid"],
    [(capture) => { capture.runnerGroup.allowsPublicRepositories = false; }, "scope_public_repository_policy_invalid"],
  ]) {
    const capture = validCapture();
    mutate(capture);
    assert.throws(() => validateRunnerGroupScopeCapture(capture), new RegExp(code, "u"));
  }
});

test("workflow allowlist is exactly the three restore workflows on refs/heads/main", () => {
  for (const mutate of [
    (capture) => { capture.runnerGroup.selectedWorkflows.pop(); },
    (capture) => { capture.runnerGroup.selectedWorkflows.push("extra/FanMind/.github/workflows/other.yml@refs/heads/main"); },
    (capture) => { capture.runnerGroup.selectedWorkflows[0] = capture.runnerGroup.selectedWorkflows[1]; },
    (capture) => { capture.runnerGroup.selectedWorkflows[0] = capture.runnerGroup.selectedWorkflows[0].replace("refs/heads/main", "refs/heads/release"); },
    (capture) => { capture.runnerGroup.selectedWorkflows[0] = capture.runnerGroup.selectedWorkflows[0].replace(FIXTURE_ORGANIZATION, "different-organization"); },
  ]) {
    const capture = validCapture();
    mutate(capture);
    assert.throws(
      () => validateRunnerGroupScopeCapture(capture),
      /scope_selected_workflows_invalid/u,
    );
  }
});

test("capture is fresh, secret-free metadata with an exact-key schema", () => {
  const now = Date.now();
  const stale = validCapture(new Date(now - POLICY_MAX_AGE_MS - 1).toISOString());
  assert.throws(() => validateRunnerGroupScopeCapture(stale, { now }), /scope_capture_stale/u);
  const future = validCapture(new Date(now + 1).toISOString());
  assert.throws(() => validateRunnerGroupScopeCapture(future, { now }), /scope_capture_from_future/u);

  const normalizedInvalidDate = validCapture("2026-02-31T00:00:00Z");
  assert.throws(
    () => validateRunnerGroupScopeCapture(normalizedInvalidDate, {
      now: Date.parse("2026-03-03T00:10:00Z"),
    }),
    /scope_capture_timestamp_invalid/u,
  );

  const metadata = validCapture();
  metadata.capture.containsSecrets = true;
  assert.throws(() => validateRunnerGroupScopeCapture(metadata), /scope_capture_metadata_invalid/u);

  const extra = validCapture();
  extra.runnerGroup.unexpected = true;
  assert.throws(
    () => parseRunnerGroupScopeCapture(Buffer.from(JSON.stringify(extra))),
    /scope_runner_group_keys_invalid/u,
  );
  assert.throws(
    () => validateRunnerGroupScopeCapture(extra),
    /scope_runner_group_keys_invalid/u,
  );

  const duplicate = Buffer.from('{"schemaVersion":1,"schemaVersion":1}');
  assert.throws(
    () => parseRunnerGroupScopeCapture(duplicate),
    /scope_capture_duplicate_member/u,
  );
  const escapedNestedDuplicate = Buffer.from(
    '{"capture":{"method":"first","\\u006dethod":"second"}}',
  );
  assert.throws(
    () => parseRunnerGroupScopeCapture(escapedNestedDuplicate),
    /scope_capture_duplicate_member/u,
  );
});

test("CLI writes only a private redacted receipt and performs no remote action", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-runner-scope-"));
  try {
    await chmod(root, 0o700);
    const inputPath = join(root, "capture.json");
    const outputPath = join(root, "receipt.json");
    await writeFile(inputPath, `${JSON.stringify(validCapture())}\n`, { mode: 0o600 });

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [scriptPath, "--input", inputPath, "--output", outputPath],
      { env: { PATH: process.env.PATH ?? "" } },
    );
    const output = `${stdout}\n${stderr}`;
    const receiptText = await readFile(outputPath, "utf8");
    const receipt = JSON.parse(receiptText);

    assert.match(output, /RESTORE_RUNNER_GROUP_SCOPE_MODE=offline_read_only/u);
    assert.match(output, /RESTORE_RUNNER_GROUP_SCOPE_REMOTE_ATTESTATION=false/u);
    assert.match(output, /RESTORE_RUNNER_GROUP_SCOPE=PASS/u);
    assert.doesNotMatch(output, new RegExp(FIXTURE_ORGANIZATION, "u"));
    assert.doesNotMatch(receiptText, new RegExp(FIXTURE_ORGANIZATION, "u"));
    assert.equal((await stat(outputPath)).mode & 0o777, 0o600);
    assert.deepEqual(Object.keys(receipt).sort(), [
      "allowsPublicRepositories", "captureSha256", "capturedAt", "publicRepositoryPolicy",
      "remoteAttestation", "repositoryId", "repositoryOwnerType", "repositoryVisibility",
      "restrictedToWorkflows", "runnerGroupName", "schemaVersion", "selectedRepositoryCount",
      "selectedWorkflowCount", "validUntil", "validatorGithubApiCalls",
      "validatorMode", "validatorRestoreAttempts", "validatorRunnerRegistrations",
      "verifiedAt", "workflowRef",
    ].sort());
    assert.equal(receipt.remoteAttestation, false);
    assert.equal(receipt.validatorGithubApiCalls, 0);
    assert.equal(receipt.validatorRunnerRegistrations, 0);
    assert.equal(receipt.validatorRestoreAttempts, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("CLI rejects non-private input and never creates a receipt", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-runner-scope-"));
  try {
    await chmod(root, 0o700);
    const inputPath = join(root, "capture.json");
    const outputPath = join(root, "receipt.json");
    await writeFile(inputPath, `${JSON.stringify(validCapture())}\n`, { mode: 0o644 });
    await assert.rejects(
      execFileAsync(process.execPath, [scriptPath, "--input", inputPath, "--output", outputPath]),
      (error) => {
        const output = `${String(error.stdout)}\n${String(error.stderr)}`;
        assert.match(output, /scope_capture_permissions_invalid/u);
        assert.match(output, /RESTORE_RUNNER_GROUP_SCOPE=FAIL/u);
        assert.doesNotMatch(output, new RegExp(FIXTURE_ORGANIZATION, "u"));
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("receipt permissions remain exactly 0600 under a hostile process umask", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-runner-scope-"));
  try {
    await chmod(root, 0o700);
    const inputPath = join(root, "capture.json");
    const outputPath = join(root, "receipt.json");
    await writeFile(inputPath, `${JSON.stringify(validCapture())}\n`, { mode: 0o600 });
    const moduleUrl = pathToFileURL(scriptPath).href;
    const source = [
      `import { verifyRunnerGroupScope } from ${JSON.stringify(moduleUrl)};`,
      "process.umask(0o777);",
      "await verifyRunnerGroupScope({ inputPath: process.argv[1], outputPath: process.argv[2] });",
    ].join("\n");
    await execFileAsync(
      process.execPath,
      ["--input-type=module", "--eval", source, inputPath, outputPath],
      { env: { PATH: process.env.PATH ?? "" } },
    );
    assert.equal((await stat(outputPath)).mode & 0o777, 0o600);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an existing receipt path is never overwritten", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-runner-scope-"));
  try {
    await chmod(root, 0o700);
    const inputPath = join(root, "capture.json");
    const outputPath = join(root, "receipt.json");
    const marker = "pre-existing-private-receipt\n";
    await writeFile(inputPath, `${JSON.stringify(validCapture())}\n`, { mode: 0o600 });
    await writeFile(outputPath, marker, { mode: 0o600 });
    await assert.rejects(
      execFileAsync(process.execPath, [scriptPath, "--input", inputPath, "--output", outputPath]),
    );
    assert.equal(await readFile(outputPath, "utf8"), marker);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("validator source has no GitHub API, network, runner registration or restore primitive", async () => {
  const source = await readFile(scriptPath, "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(|https?:\/\/|api\.github\.com|GITHUB_TOKEN|gh\s+api/u);
  assert.doesNotMatch(
    source,
    /node:(?:child_process|cluster|dgram|dns|http|https|net|tls|worker_threads)/u,
  );
  assert.doesNotMatch(source, /config\.sh|run\.sh|registration-token|pg_restore|restore:database:drill/u);
});
