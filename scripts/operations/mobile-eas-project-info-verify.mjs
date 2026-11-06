#!/usr/bin/env node

import assert from "node:assert/strict";
import { constants } from "node:fs";
import {
  mkdtemp,
  open,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_REPORT_BYTES = 64 * 1024;
const EXPECTED_SLUG = "fanmind-mobile";
const ANSI_ESCAPE_PATTERN = /\u001B(?:\[[0-?]*[ -/]*[@-~]|[@-_])/gu;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const OWNER_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,37}[a-z0-9])?$/iu;
const FORBIDDEN_OWNER_PATTERN = /^(?:owner|example|placeholder|fanmind)$/iu;
const RELEASE_READINESS_WORKFLOW_URL = new URL(
  "../../.github/workflows/mobile-release-resource-readiness.yml",
  import.meta.url,
);
const SIGNED_BUILD_WORKFLOW_URL = new URL(
  "../../.github/workflows/mobile-signed-internal-build.yml",
  import.meta.url,
);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function required(value, code = "configuration_missing") {
  const normalized = String(value ?? "").trim();
  if (!normalized) fail(code);
  return normalized;
}

function parseProjectInfoFields(report) {
  if (typeof report !== "string") fail("eas_project_info_invalid");
  const reportBytes = Buffer.byteLength(report, "utf8");
  if (reportBytes === 0 || reportBytes > MAX_REPORT_BYTES) {
    fail("eas_project_info_size_invalid");
  }

  const normalized = report
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n");
  const fields = new Map();

  for (const rawLine of normalized.split("\n")) {
    const match = /^(fullName|ID)\s{2,}(.+?)\s*$/u.exec(rawLine.trimEnd());
    if (!match) continue;
    const [, label, value] = match;
    if (fields.has(label)) fail("eas_project_info_ambiguous");
    fields.set(label, value);
  }

  if (!fields.has("fullName") || !fields.has("ID")) {
    fail("eas_project_info_incomplete");
  }

  return {
    fullName: fields.get("fullName"),
    projectId: fields.get("ID"),
  };
}

export function evaluateEasProjectInfoReport({
  report,
  expectedOwner,
  expectedProjectId,
  expectedSlug = EXPECTED_SLUG,
}) {
  const owner = required(expectedOwner);
  const projectId = required(expectedProjectId);
  const slug = required(expectedSlug);

  if (
    !OWNER_PATTERN.test(owner)
    || FORBIDDEN_OWNER_PATTERN.test(owner)
  ) {
    fail("eas_owner_invalid");
  }
  if (!UUID_PATTERN.test(projectId)) fail("eas_project_id_invalid");
  if (slug !== EXPECTED_SLUG) fail("eas_slug_invalid");

  const fields = parseProjectInfoFields(report);
  const fullName = fields.fullName.replace(/^@/u, "");
  const segments = fullName.split("/");
  if (segments.length !== 2 || !segments[0] || !segments[1]) {
    fail("eas_project_full_name_invalid");
  }

  const [actualOwner, actualSlug] = segments;
  if (
    actualOwner.toLowerCase() !== owner.toLowerCase()
    || actualSlug !== slug
  ) {
    fail("eas_project_full_name_mismatch");
  }
  if (!UUID_PATTERN.test(fields.projectId)) {
    fail("eas_project_report_id_invalid");
  }
  if (fields.projectId.toLowerCase() !== projectId.toLowerCase()) {
    fail("eas_project_id_mismatch");
  }

  return Object.freeze({
    owner: "verified",
    slug: "verified",
    projectId: "verified",
  });
}

export async function verifyEasProjectInfoFile(
  reportPath,
  environment = process.env,
) {
  const path = required(reportPath, "eas_project_info_path_missing");
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    fail("eas_project_info_file_unavailable");
  }

  let report;
  try {
    const stats = await handle.stat();
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAX_REPORT_BYTES) {
      fail("eas_project_info_file_invalid");
    }
    report = await handle.readFile("utf8");
  } catch (error) {
    if (String(error?.code ?? "").startsWith("eas_")) throw error;
    fail("eas_project_info_file_unavailable");
  } finally {
    await handle.close().catch(() => {});
  }

  return evaluateEasProjectInfoReport({
    report,
    expectedOwner: environment.FANMIND_MOBILE_EXPECTED_EAS_OWNER,
    expectedProjectId: environment.FANMIND_MOBILE_EXPECTED_EAS_PROJECT_ID,
  });
}

function assertWorkflowBinding(workflow, { signedBuild }) {
  const lookupMarker = "eas-cli@21.2.0 project:info";
  const verifierMarker =
    "node ../../scripts/operations/mobile-eas-project-info-verify.mjs";
  assert.equal((workflow.match(/eas-cli@21\.2\.0 project:info/gu) ?? []).length, 1);
  assert.equal(
    (workflow.match(/mobile-eas-project-info-verify\.mjs/gu) ?? []).length,
    1,
  );
  assert.ok(workflow.indexOf(lookupMarker) >= 0);
  assert.ok(workflow.indexOf(verifierMarker) > workflow.indexOf(lookupMarker));
  assert.match(workflow, /project:info >"\$REPORT_PATH" 2>&1/u);
  assert.match(workflow, /"\$REPORT_PATH"; then/u);
  assert.match(workflow, /umask 077/u);
  assert.doesNotMatch(
    workflow,
    /\bcat\s+"\$REPORT_PATH"|\becho\s+"\$(?:cat|<)/u,
  );

  if (signedBuild) {
    assert.ok(
      workflow.indexOf(verifierMarker)
      < workflow.indexOf("Authorize exactly one signed internal build"),
    );
  } else {
    assert.doesNotMatch(
      workflow,
      /eas(?:-cli@[\d.]+)?\s+(?:build|submit|update|project:init|init)\b/u,
    );
  }
}

async function runSelfTest() {
  const expectedOwner = "bernds-tech";
  const expectedProjectId = "123e4567-e89b-42d3-a456-426614174000";
  const environment = {
    FANMIND_MOBILE_EXPECTED_EAS_OWNER: expectedOwner,
    FANMIND_MOBILE_EXPECTED_EAS_PROJECT_ID: expectedProjectId,
  };
  const validReport = [
    "\u001B[2mfullName\u001B[22m  @bernds-tech/fanmind-mobile",
    `\u001B[2mID      \u001B[22m  ${expectedProjectId}`,
    "",
  ].join("\n");

  assert.deepEqual(
    evaluateEasProjectInfoReport({
      report: validReport,
      expectedOwner,
      expectedProjectId,
    }),
    {
      owner: "verified",
      slug: "verified",
      projectId: "verified",
    },
  );

  assert.throws(
    () =>
      evaluateEasProjectInfoReport({
        report: validReport.replace("bernds-tech", "other-owner"),
        expectedOwner,
        expectedProjectId,
      }),
    { code: "eas_project_full_name_mismatch" },
  );
  assert.throws(
    () =>
      evaluateEasProjectInfoReport({
        report: validReport.replace("fanmind-mobile", "other-slug"),
        expectedOwner,
        expectedProjectId,
      }),
    { code: "eas_project_full_name_mismatch" },
  );
  assert.throws(
    () =>
      evaluateEasProjectInfoReport({
        report: validReport.replace(
          expectedProjectId,
          "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        ),
        expectedOwner,
        expectedProjectId,
      }),
    { code: "eas_project_id_mismatch" },
  );
  assert.throws(
    () =>
      evaluateEasProjectInfoReport({
        report: `${validReport}ID        ${expectedProjectId}\n`,
        expectedOwner,
        expectedProjectId,
      }),
    { code: "eas_project_info_ambiguous" },
  );
  assert.throws(
    () =>
      evaluateEasProjectInfoReport({
        report: "fullName  @bernds-tech/fanmind-mobile\n",
        expectedOwner,
        expectedProjectId,
      }),
    { code: "eas_project_info_incomplete" },
  );
  assert.throws(
    () =>
      evaluateEasProjectInfoReport({
        report: validReport,
        expectedOwner: "placeholder",
        expectedProjectId,
      }),
    { code: "eas_owner_invalid" },
  );

  const temporaryRoot = await mkdtemp(
    join(tmpdir(), "fanmind-mobile-eas-project-info-"),
  );
  try {
    const reportPath = join(temporaryRoot, "project-info.txt");
    await writeFile(reportPath, validReport, { mode: 0o600 });
    assert.deepEqual(
      await verifyEasProjectInfoFile(reportPath, environment),
      {
        owner: "verified",
        slug: "verified",
        projectId: "verified",
      },
    );

    const symlinkPath = join(temporaryRoot, "project-info-link.txt");
    await symlink(reportPath, symlinkPath);
    await assert.rejects(
      () => verifyEasProjectInfoFile(symlinkPath, environment),
      { code: "eas_project_info_file_unavailable" },
    );

    const oversizedPath = join(temporaryRoot, "oversized.txt");
    await writeFile(
      oversizedPath,
      Buffer.alloc(MAX_REPORT_BYTES + 1, 0x61),
      { mode: 0o600 },
    );
    await assert.rejects(
      () => verifyEasProjectInfoFile(oversizedPath, environment),
      { code: "eas_project_info_file_invalid" },
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }

  const [releaseReadinessWorkflow, signedBuildWorkflow] = await Promise.all([
    readFile(RELEASE_READINESS_WORKFLOW_URL, "utf8"),
    readFile(SIGNED_BUILD_WORKFLOW_URL, "utf8"),
  ]);
  assertWorkflowBinding(releaseReadinessWorkflow, { signedBuild: false });
  assertWorkflowBinding(signedBuildWorkflow, { signedBuild: true });

  console.log("MOBILE_EAS_PROJECT_INFO_SELF_TEST=PASS");
}

async function main() {
  if (process.argv[2] === "--self-test") {
    await runSelfTest();
    return;
  }
  if (process.argv.length !== 3) fail("eas_project_info_path_missing");
  await verifyEasProjectInfoFile(process.argv[2], process.env);
  console.log("MOBILE_EAS_PROJECT_OWNER=verified");
  console.log("MOBILE_EAS_PROJECT_SLUG=verified");
  console.log("MOBILE_EAS_PROJECT_ID=verified");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  console.log("MOBILE_EAS_PROJECT_INFO_VERIFICATION=PASS");
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(
      `MOBILE_EAS_PROJECT_INFO_ERROR=${error?.code ?? "verification_failed"}`,
    );
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    console.error("MOBILE_EAS_PROJECT_INFO_VERIFICATION=FAIL");
    process.exitCode = 1;
  });
}
