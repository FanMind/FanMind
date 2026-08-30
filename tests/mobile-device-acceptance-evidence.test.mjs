import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdtemp,
  open,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { createMobileDeviceAcceptanceTemplate } from "../scripts/operations/prepare-mobile-device-acceptance.mjs";

const execFileAsync = promisify(execFile);
const verifierPath =
  "scripts/operations/verify-mobile-device-acceptance.mjs";
const receiptWriterPath =
  "scripts/operations/write-mobile-signed-build-receipt.mjs";
const preparerPath =
  "scripts/operations/prepare-mobile-device-acceptance.mjs";
const MAIN_COMMIT = "a".repeat(40);
const BUILD_ID = "123e4567-e89b-42d3-a456-426614174000";

const sha = (value) => createHash("sha256").update(value).digest("hex");

function queueBuild(overrides = {}) {
  return {
    id: BUILD_ID,
    platform: "ANDROID",
    buildProfile: "preview",
    gitCommitHash: MAIN_COMMIT,
    ...overrides,
  };
}

function completedBuild(overrides = {}) {
  return {
    ...queueBuild(),
    status: "FINISHED",
    distribution: "INTERNAL",
    completedAt: "2026-08-06T08:00:00.000Z",
    artifacts: {
      applicationArchiveUrl:
        "https://expo.dev/artifacts/eas/private-synthetic-build.apk",
    },
    ...overrides,
  };
}

function signedBuildReceipt(queueBytes, completionBytes, overrides = {}) {
  return {
    schemaVersion: 1,
    completedAt: "2026-08-06T08:00:00.000Z",
    releaseCommit: MAIN_COMMIT,
    platform: "android",
    buildProfile: "preview",
    distribution: "internal",
    artifact: "available",
    queueSha256: sha(queueBytes),
    completionSha256: sha(completionBytes),
    submit: "disabled",
    update: "disabled",
    ...overrides,
  };
}

function deviceEvidence(receiptBytes, overrides = {}) {
  return {
    schemaVersion: 1,
    acceptanceId: "2026-08-06-mobile-android-001",
    startedAt: "2026-08-06T09:00:00Z",
    completedAt: "2026-08-06T10:00:00Z",
    environment: "staging",
    platform: "android",
    releaseCommit: MAIN_COMMIT,
    buildProfile: "preview",
    signedBuildCompletedAt: "2026-08-06T08:00:00.000Z",
    signedBuildReceiptSha256: sha(receiptBytes),
    signedBuildInstalled: "passed",
    login: "passed",
    recoveryValidLink: "passed",
    recoveryInvalidLinkRejected: "passed",
    recoveryExpiredLinkRejected: "passed",
    recoveryUsedLinkRejected: "passed",
    passwordChanged: "passed",
    restartLogin: "passed",
    offlineTransportFallback: "passed",
    offlineReadOnly: "passed",
    offlineAuthFailureClosed: "passed",
    offlineRlsFailureClosed: "passed",
    offlineServerFailureClosed: "passed",
    offlineExpiredCacheRejected: "passed",
    logoutPurge: "passed",
    appIconBranding: "passed",
    splashBranding: "passed",
    accountDeletionRequest: "passed",
    accountDeletionCancel: "passed",
    pushTested: false,
    pushStagingGateSha256: null,
    pushPermissionOptIn: "not_tested",
    pushPermissionDenial: "not_tested",
    pushRegistration: "not_tested",
    pushOptOut: "not_tested",
    automaticSendingObserved: false,
    customerDataUsed: false,
    secretsRecorded: false,
    pushDeliveryObserved: false,
    issues: [],
    ...overrides,
  };
}

function pushGate(overrides = {}) {
  return {
    schemaVersion: 1,
    completedAt: "2026-08-06T08:30:00Z",
    environment: "staging",
    releaseCommit: MAIN_COMMIT,
    resourceReadiness: "passed",
    migrationApply: "passed",
    rollbackAcceptance: "passed",
    productionTargetUsed: false,
    realPushTokenUsed: false,
    deliveryEnabled: false,
    issues: [],
    ...overrides,
  };
}

async function privateFile(path, content) {
  await writeFile(path, content, { mode: 0o600 });
  await chmod(path, 0o600);
}

async function withFixture(callback, overrides = {}) {
  const root = await mkdtemp(join(tmpdir(), "fanmind-mobile-device-"));
  try {
    await chmod(root, 0o700);
    const queueBytes = `${JSON.stringify(
      queueBuild(overrides.queue),
    )}\n`;
    const completionBytes = `${JSON.stringify(
      completedBuild(overrides.completion),
    )}\n`;
    const receiptBytes = `${JSON.stringify(
      signedBuildReceipt(queueBytes, completionBytes, overrides.receipt),
    )}\n`;
    const gateBytes = `${JSON.stringify(pushGate(overrides.gate))}\n`;
    const evidenceBytes = `${JSON.stringify(
      deviceEvidence(receiptBytes, overrides.evidence),
    )}\n`;
    const paths = {
      root,
      evidence: join(root, "device-evidence.json"),
      queue: join(root, "signed-build-queue.json"),
      completion: join(root, "signed-build-completion.json"),
      receipt: join(root, "signed-build-receipt.json"),
      gate: join(root, "push-staging-gate.json"),
    };
    await Promise.all([
      privateFile(paths.evidence, evidenceBytes),
      privateFile(paths.queue, queueBytes),
      privateFile(paths.completion, completionBytes),
      privateFile(paths.receipt, receiptBytes),
      privateFile(paths.gate, gateBytes),
    ]);
    return await callback({
      paths,
      queueBytes,
      completionBytes,
      receiptBytes,
      evidenceBytes,
      gateBytes,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function verifierArguments(paths, { push = false, commit = MAIN_COMMIT } = {}) {
  return [
    verifierPath,
    "--input",
    paths.evidence,
    "--signed-build-receipt",
    paths.receipt,
    "--expected-main-commit",
    commit,
    ...(push ? ["--push-staging-gate", paths.gate] : []),
  ];
}

test("valid private device evidence binds one exact signed preview build without leaking identifiers", async () => {
  await withFixture(async ({ paths, evidenceBytes }) => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      verifierArguments(paths),
    );
    const output = `${stdout}\n${stderr}`;
    assert.match(output, /MOBILE_DEVICE_ACCEPTANCE_BUILD_BINDINGS=5/u);
    assert.match(output, /MOBILE_DEVICE_ACCEPTANCE_BUILD_BINDINGS_PASSED=5/u);
    assert.match(output, /MOBILE_DEVICE_ACCEPTANCE_REQUIRED_CHECKS=19/u);
    assert.match(output, /MOBILE_DEVICE_ACCEPTANCE_REQUIRED_PASSED=19/u);
    assert.match(output, /MOBILE_DEVICE_ACCEPTANCE_PUSH_CHECKS=0/u);
    assert.match(output, /MOBILE_DEVICE_ACCEPTANCE_PUSH_PASSED=0/u);
    assert.match(output, /MOBILE_DEVICE_ACCEPTANCE=PASS/u);
    assert.match(
      output,
      new RegExp(`MOBILE_DEVICE_ACCEPTANCE_SHA256=${sha(evidenceBytes)}`, "u"),
    );
    assert.doesNotMatch(
      output,
      /123e4567|a{20}|android|preview|expo\.dev|mobile-android-001/u,
    );
  });
});

test("iOS device evidence is accepted only with the matching iOS receipt", async () => {
  await withFixture(async ({ paths }) => {
    const { stdout } = await execFileAsync(
      process.execPath,
      verifierArguments(paths),
    );
    assert.match(stdout, /MOBILE_DEVICE_ACCEPTANCE=PASS/u);
  }, {
    receipt: { platform: "ios" },
    evidence: {
      platform: "ios",
      acceptanceId: "2026-08-06-mobile-ios-001",
    },
  });
});

test("the signed build handoff writes one redacted private receipt", async () => {
  await withFixture(async ({ paths, queueBytes, completionBytes }) => {
    const output = join(paths.root, "generated-receipt.json");
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [
        receiptWriterPath,
        "--queue",
        paths.queue,
        "--completion",
        paths.completion,
        "--output",
        output,
      ],
      {
        env: {
          ...process.env,
          GITHUB_REF: "refs/heads/main",
          GITHUB_SHA: MAIN_COMMIT,
          FANMIND_MOBILE_EXPECTED_RELEASE_COMMIT: MAIN_COMMIT,
          FANMIND_MOBILE_RELEASE_ENVIRONMENT: "preview",
          FANMIND_MOBILE_BUILD_PROFILE: "preview",
          FANMIND_MOBILE_BUILD_PLATFORM: "android",
          FANMIND_MOBILE_BUILD_CLASS: "internal",
          FANMIND_MOBILE_SIGNED_BUILD_CONFIRM:
            "queue-one-signed-mobile-build",
          FANMIND_ENABLE_MOBILE_EAS_BUILD: "true",
          FANMIND_ENABLE_MOBILE_EAS_SUBMIT: "false",
          FANMIND_ENABLE_MOBILE_EAS_UPDATE: "false",
        },
      },
    );
    const generated = JSON.parse(await readFile(output, "utf8"));
    assert.deepEqual(generated, signedBuildReceipt(queueBytes, completionBytes));
    assert.equal((await stat(output)).mode & 0o777, 0o600);
    const outputText = `${stdout}\n${stderr}`;
    assert.match(outputText, /MOBILE_SIGNED_BUILD_RECEIPT=PASS/u);
    assert.doesNotMatch(outputText, /123e4567|a{20}|android|preview|expo\.dev/u);
  });
});

test("evidence fails closed on main commit, platform, build identity, timestamp and digest drift", async () => {
  const cases = [
    {
      options: { commit: "b".repeat(40) },
      error: /evidence_main_commit_mismatch/u,
    },
    {
      fixture: { evidence: { platform: "ios" } },
      error: /signed_build_receipt_platform_mismatch/u,
    },
    {
      fixture: {
        receipt: { releaseCommit: "b".repeat(40) },
      },
      error: /signed_build_receipt_commit_mismatch/u,
    },
    {
      fixture: { evidence: { startedAt: "2026-08-06T07:59:59Z" } },
      error: /evidence_timestamp_order_invalid/u,
    },
    {
      fixture: {
        evidence: {
          startedAt: "2026-09-31T09:00:00Z",
          completedAt: "2026-10-02T10:00:00Z",
        },
      },
      error: /evidence_timestamp_order_invalid/u,
    },
    {
      fixture: { evidence: { signedBuildReceiptSha256: "0".repeat(64) } },
      error: /signed_build_receipt_sha_mismatch/u,
    },
  ];

  for (const { fixture = {}, options = {}, error } of cases) {
    await withFixture(async ({ paths }) => {
      await assert.rejects(
        execFileAsync(process.execPath, verifierArguments(paths, options)),
        error,
      );
    }, fixture);
  }
});

test("all mandatory device checks and privacy boundaries fail closed", async () => {
  const cases = [
    [{ login: "failed" }, /evidence_login_not_passed/u],
    [
      { offlineAuthFailureClosed: "failed" },
      /evidence_offline_auth_failure_closed_not_passed/u,
    ],
    [{ logoutPurge: "failed" }, /evidence_logout_purge_not_passed/u],
    [{ accountDeletionCancel: "failed" }, /evidence_account_deletion_cancel_not_passed/u],
    [{ customerDataUsed: true }, /evidence_customer_data_used_must_be_false/u],
    [{ automaticSendingObserved: true }, /evidence_automatic_sending_observed_must_be_false/u],
    [{ issues: ["open"] }, /evidence_issues_invalid/u],
  ];

  for (const [evidence, error] of cases) {
    await withFixture(async ({ paths }) => {
      await assert.rejects(
        execFileAsync(process.execPath, verifierArguments(paths)),
        error,
      );
    }, { evidence });
  }
});

test("push device checks are optional but require the exact prior Staging gate", async () => {
  await withFixture(async ({ paths, gateBytes, receiptBytes }) => {
    const pushEvidence = deviceEvidence(receiptBytes, {
      pushTested: true,
      pushStagingGateSha256: sha(gateBytes),
      pushPermissionOptIn: "passed",
      pushPermissionDenial: "passed",
      pushRegistration: "passed",
      pushOptOut: "passed",
    });
    await privateFile(paths.evidence, `${JSON.stringify(pushEvidence)}\n`);

    await assert.rejects(
      execFileAsync(process.execPath, verifierArguments(paths)),
      /push_staging_gate_required/u,
    );

    const { stdout } = await execFileAsync(
      process.execPath,
      verifierArguments(paths, { push: true }),
    );
    assert.match(stdout, /MOBILE_DEVICE_ACCEPTANCE_PUSH_CHECKS=4/u);
    assert.match(stdout, /MOBILE_DEVICE_ACCEPTANCE_PUSH_PASSED=4/u);
    assert.doesNotMatch(stdout, /push-staging-gate|123e4567|a{20}/u);
  });

  for (const [gate, error] of [
    [{ releaseCommit: "b".repeat(40) }, /push_gate_commit_mismatch/u],
    [{ rollbackAcceptance: "failed" }, /push_gate_rollback_acceptance_not_passed/u],
    [{ productionTargetUsed: true }, /push_gate_production_target_used_must_be_false/u],
    [{ deliveryEnabled: true }, /push_gate_delivery_enabled_must_be_false/u],
  ]) {
    await withFixture(async ({ paths, gateBytes, receiptBytes }) => {
      const evidence = deviceEvidence(receiptBytes, {
        pushTested: true,
        pushStagingGateSha256: sha(gateBytes),
        pushPermissionOptIn: "passed",
        pushPermissionDenial: "passed",
        pushRegistration: "passed",
        pushOptOut: "passed",
      });
      await privateFile(paths.evidence, `${JSON.stringify(evidence)}\n`);
      await assert.rejects(
        execFileAsync(
          process.execPath,
          verifierArguments(paths, { push: true }),
        ),
        error,
      );
    }, { gate });
  }
});

test("private evidence inputs reject broad permissions and symlinks", async () => {
  await withFixture(async ({ paths }) => {
    await chmod(paths.evidence, 0o640);
    await assert.rejects(
      execFileAsync(process.execPath, verifierArguments(paths)),
      /mobile_device_evidence_permissions_invalid/u,
    );
  });

  await withFixture(async ({ paths }) => {
    const link = join(paths.root, "linked-evidence.json");
    await symlink(paths.evidence, link);
    await assert.rejects(
      execFileAsync(
        process.execPath,
        verifierArguments({ ...paths, evidence: link }),
      ),
      /mobile_device_evidence_not_regular/u,
    );
  });
});

test("the private preparer binds the exact Preview receipt but never pre-approves a check", async () => {
  await withFixture(async ({ receiptBytes }) => {
    const template = createMobileDeviceAcceptanceTemplate({
      signedBuildReceiptBytes: Buffer.from(receiptBytes, "utf8"),
      acceptanceId: "2026-08-30-mobile-android-001",
      startedAt: "2026-08-30T09:00:00Z",
    });

    assert.equal(template.environment, "staging");
    assert.equal(template.platform, "android");
    assert.equal(template.releaseCommit, MAIN_COMMIT);
    assert.equal(template.buildProfile, "preview");
    assert.equal(template.signedBuildCompletedAt, "2026-08-06T08:00:00.000Z");
    assert.equal(template.signedBuildReceiptSha256, sha(receiptBytes));
    assert.equal(template.completedAt, "replace-with-completion-utc");
    assert.equal(
      Object.values(template).filter((value) => value === "pending").length,
      23,
    );
    assert.equal(template.pushTested, false);
    assert.equal(template.automaticSendingObserved, "pending");
    assert.equal(template.customerDataUsed, "pending");
    assert.equal(template.secretsRecorded, "pending");
    assert.equal(template.pushDeliveryObserved, "pending");
    assert.deepEqual(template.issues, []);
  });
});

test("the preparer writes one mode-0600 pending file and the verifier rejects it until completed", async () => {
  await withFixture(async ({ paths }) => {
    const output = join(paths.root, "android.json");
    const prepareArguments = [
      preparerPath,
      "--signed-build-receipt",
      paths.receipt,
      "--output",
      output,
      "--acceptance-id",
      "2026-08-30-mobile-android-001",
      "--started-at",
      "2026-08-30T09:00:00Z",
    ];
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      prepareArguments,
    );
    const outputText = `${stdout}\n${stderr}`;
    const outputHandle = await open(output, "r");
    let metadata;
    let template;
    try {
      metadata = await outputHandle.stat();
      template = JSON.parse(await outputHandle.readFile("utf8"));
    } finally {
      await outputHandle.close();
    }

    assert.equal(metadata.mode & 0o777, 0o600);
    assert.equal(
      Object.values(template).filter((value) => value === "pending").length,
      23,
    );
    assert.match(outputText, /MOBILE_DEVICE_ACCEPTANCE_TEMPLATE_CHECKS=19/u);
    assert.match(
      outputText,
      /MOBILE_DEVICE_ACCEPTANCE_TEMPLATE_SAFETY_CONFIRMATIONS=4/u,
    );
    assert.match(outputText, /MOBILE_DEVICE_ACCEPTANCE_TEMPLATE_STATE=pending/u);
    assert.match(outputText, /MOBILE_DEVICE_ACCEPTANCE_TEMPLATE=PASS/u);
    assert.doesNotMatch(
      outputText,
      /123e4567|a{20}|android|preview|mobile-android-001/u,
    );

    await assert.rejects(
      execFileAsync(
        process.execPath,
        verifierArguments({ ...paths, evidence: output }),
      ),
      /evidence_timestamp_order_invalid/u,
    );
    await assert.rejects(
      execFileAsync(process.execPath, prepareArguments),
      /output_already_exists/u,
    );
  });
});

test("the preparer rejects Store receipts and timestamps before the signed Preview", async () => {
  await withFixture(async ({ receiptBytes }) => {
    assert.throws(
      () =>
        createMobileDeviceAcceptanceTemplate({
          signedBuildReceiptBytes: Buffer.from(
            JSON.stringify({
              ...JSON.parse(receiptBytes),
              buildProfile: "production",
              distribution: "store",
            }),
            "utf8",
          ),
          acceptanceId: "2026-08-30-mobile-android-001",
          startedAt: "2026-08-30T09:00:00Z",
        }),
      /signed_build_receipt_boundaries_invalid/u,
    );
    assert.throws(
      () =>
        createMobileDeviceAcceptanceTemplate({
          signedBuildReceiptBytes: Buffer.from(receiptBytes, "utf8"),
          acceptanceId: "2026-08-30-mobile-android-001",
          startedAt: "2026-08-06T07:59:59Z",
        }),
      /started_at_before_build/u,
    );
    assert.throws(
      () =>
        createMobileDeviceAcceptanceTemplate({
          signedBuildReceiptBytes: Buffer.from(receiptBytes, "utf8"),
          acceptanceId: "2026-08-30-mobile-android-001",
          startedAt: "2026-09-31T09:00:00Z",
        }),
      /started_at_invalid/u,
    );
  });
});

test("the acceptance handoff is local-only, private and part of the Operations suite", async () => {
  const [packageJson, gitignore, runbook, beta, architecture, readme] =
    await Promise.all([
      readFile("package.json", "utf8").then(JSON.parse),
      readFile(".gitignore", "utf8"),
      readFile("docs/mobile/DEVICE_ACCEPTANCE.md", "utf8"),
      readFile("docs/mobile/BETA_RELEASE.md", "utf8"),
      readFile("docs/mobile/ARCHITECTURE.md", "utf8"),
      readFile("apps/mobile/README.md", "utf8"),
    ]);

  assert.equal(
    packageJson.scripts["mobile:signed-build:receipt"],
    "node scripts/operations/write-mobile-signed-build-receipt.mjs",
  );
  assert.equal(
    packageJson.scripts["mobile:device:acceptance:prepare"],
    "node scripts/operations/prepare-mobile-device-acceptance.mjs",
  );
  assert.equal(
    packageJson.scripts["mobile:device:acceptance:verify"],
    "node scripts/operations/verify-mobile-device-acceptance.mjs",
  );
  assert.match(
    packageJson.scripts["test:operations"],
    /tests\/mobile-device-acceptance-evidence\.test\.mjs/u,
  );
  assert.match(gitignore, /\/docs\/mobile\/private-device-evidence\//u);
  assert.match(runbook, /keinen GitHub-Workflow/u);
  assert.match(runbook, /--expected-main-commit/u);
  assert.match(runbook, /push-staging-gate/u);
  assert.match(runbook, /mobile:device:acceptance:prepare/u);
  assert.match(
    runbook,
    /All 19 real-device checks and the four\s+safety observations remain `"pending"`/u,
  );
  assert.match(runbook, /iOS\/TestFlight and an iPhone record are Phase 8/u);
  assert.match(runbook, /Keinen neuen Build starten/u);
  assert.match(beta, /DEVICE_ACCEPTANCE\.md/u);
  assert.match(architecture, /SHA-gebundener Geräte-Abnahmevalidator/u);
  assert.match(readme, /privaten\s+Geräte-Abnahmevalidator/u);
});
