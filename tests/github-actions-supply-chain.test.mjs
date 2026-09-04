import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";
import test from "node:test";

import { scanWorkflowPolicy } from "../scripts/verify-actions-pinned.mjs";

const CODEQL_V4_37_7_SHA = "ff2f1c621b7f889edc0d3c761ac2e6a3f8cdb0dd";
const SETUP_JAVA_V5_7_0_SHA =
  "b6effb05e454b25005698d916606bdc6ffcbf961";
const HOSTED_CHECKOUT_V7_0_1_SHA =
  "3d3c42e5aac5ba805825da76410c181273ba90b1";
const PG17_SERVICE_IMAGE =
  "postgres:17.11-trixie@sha256:" +
  "e38411452a464af89e5adadb8d223bf53b898d47d6ef918b2d58c08707350449";
const RESTORE_CHECKOUT_V4_SHA =
  "11d5960a326750d5838078e36cf38b85af677262";
const STAGING_DEPLOY_WORKFLOW = "deploy-staging.yml";
const RESTORE_WORKFLOW = "restore-drill-resource-readiness.yml";
const RESTORE_DATABASE_WORKFLOW = "restore-drill-database.yml";
const RESTORE_HOST_WORKFLOW = "restore-drill-host-readiness.yml";
const STAGING_PROVISION_WORKFLOW = "provision-staging-host.yml";

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function workflowEnvBlocks(source) {
  const lines = source.split("\n");
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(\s*)env:\s*(?:&[A-Za-z0-9_-]+\s*)?$/u.exec(
      lines[index],
    );
    if (!match) continue;

    const indent = match[1].length;
    const keys = [];
    let cursor = index + 1;
    for (; cursor < lines.length; cursor += 1) {
      const line = lines[cursor];
      if (line.trim() === "") continue;
      const childIndent = /^\s*/u.exec(line)?.[0].length ?? 0;
      if (childIndent <= indent) break;
      if (childIndent !== indent + 2) continue;
      const key = /^\s*([A-Za-z_][A-Za-z0-9_]*):/u.exec(line)?.[1];
      if (key) keys.push({ key, line: cursor + 1, value: line.slice(line.indexOf(":") + 1) });
    }
    blocks.push({ indent, keys });
  }

  return blocks;
}

function workflowEnvironmentRegistrationErrors(source, file) {
  const errors = [];

  for (const [index, line] of source.split("\n").entries()) {
    if (/^\s*<<\s*:/u.test(line)) {
      errors.push(`${file}:${index + 1} uses unsupported YAML merge key`);
    }
  }

  for (const block of workflowEnvBlocks(source)) {
    const seen = new Map();
    for (const { key, line, value } of block.keys) {
      const normalized = key.toLocaleLowerCase("en-US");
      if (seen.has(normalized)) {
        errors.push(`${file}:${line} duplicates environment key ${key} case-insensitively`);
      }
      seen.set(normalized, line);
      if (block.indent <= 4 && /\$\{\{\s*runner\./u.test(value)) {
        errors.push(`${file}:${line} uses runner context before a step starts`);
      }
    }
  }

  return errors;
}

test("release integration failures retain reports and still allow the build diagnostic", async () => {
  const workflow = await readFile(".github/workflows/ci-fanmind.yml", "utf8");
  assert.match(workflow, /id: release_integrations[\s\S]*continue-on-error: true[\s\S]*release-integration-report\.txt/u);
  assert.match(workflow, /name: fanmind-release-integration-report[\s\S]*if-no-files-found: error/u);
  assert.match(workflow, /id: build[\s\S]*build-report\.txt/u);
  assert.match(workflow, /steps\.release_integrations\.outcome != 'success'[\s\S]*fanmind-release-integration-report artifact/u);
});

test("authorization roundtrip uses two independent digest-pinned PG17 services", async () => {
  const [workflow, manifest] = await Promise.all([
    readFile(".github/workflows/ci-fanmind.yml", "utf8"),
    readFile("package.json", "utf8"),
  ]);
  const job = workflow.match(
    /\n  pg17_authorization_roundtrip:\n[\s\S]*$/u,
  )?.[0] ?? "";
  const images = [...job.matchAll(/^\s+image:\s+(\S+)$/gmu)]
    .map((match) => match[1]);

  assert.deepEqual(images, [PG17_SERVICE_IMAGE, PG17_SERVICE_IMAGE]);
  assert.match(job, /services:\n\s+pg17_source:/u);
  assert.match(job, /\n\s+pg17_target:/u);
  assert.equal([...job.matchAll(/POSTGRES_INITDB_ARGS:/gu)].length, 2);
  assert.equal([...job.matchAll(/--locale-provider=icu/gu)].length, 2);
  assert.match(
    job,
    /FANMIND_PG17_SOURCE_CONTAINER_ID: \$\{\{ job\.services\.pg17_source\.id \}\}/u,
  );
  assert.match(
    job,
    /FANMIND_PG17_TARGET_CONTAINER_ID: \$\{\{ job\.services\.pg17_target\.id \}\}/u,
  );
  assert.match(
    job,
    /FANMIND_PG17_REQUIRE_SERVICE_CONTAINERS: "true"/u,
  );
  assert.equal(
    JSON.parse(manifest).scripts["test:database-authorization:pg17"],
    "node --test tests/database-authorization-pg17-roundtrip.test.mjs",
  );
});

test("all GitHub workflows use immutable external Action references and explicit permissions", async () => {
  const result = await scanWorkflowPolicy();

  assert.equal(result.errors.length, 0, result.errors.join("\n"));
  assert.ok(result.workflowCount >= 9);
  assert.ok(result.externalActionCount > 0);
  assert.equal(
    result.references
      .filter((reference) => reference.kind === "external")
      .every((reference) => /^[0-9a-f]{40}$/u.test(reference.ref)),
    true,
  );
});

test("workflow environment maps avoid the known GitHub registration hazards", async () => {
  const workflowFiles = (await readdir(".github/workflows"))
    .filter((file) => /\.ya?ml$/u.test(file))
    .sort();

  for (const file of workflowFiles) {
    const source = await readFile(`.github/workflows/${file}`, "utf8");
    assert.deepEqual(workflowEnvironmentRegistrationErrors(source, file), []);
  }
});

test("workflow registration guard detects step env duplicates, merge keys and early runner context", () => {
  const fixture = `env:
  CACHE_ROOT: \${{ runner.temp }}
jobs:
  invalid:
    runs-on: ubuntu-24.04
    env:
      ALL_PROXY: ''
      all_proxy: ''
      TMPDIR: \${{ runner.temp }}
    steps:
      - name: Case-folded step variables
        env: &proxy_environment
          HTTPS_PROXY: ''
          https_proxy: ''
        run: 'true'
      - name: Unsupported merge
        env:
          <<: *proxy_environment
        run: 'true'
`;

  assert.deepEqual(workflowEnvironmentRegistrationErrors(fixture, "fixture.yml"), [
    "fixture.yml:18 uses unsupported YAML merge key",
    "fixture.yml:2 uses runner context before a step starts",
    "fixture.yml:8 duplicates environment key all_proxy case-insensitively",
    "fixture.yml:9 uses runner context before a step starts",
    "fixture.yml:14 duplicates environment key https_proxy case-insensitively",
  ]);
});

test("hosted checkout uses v7 while the isolated restore runner stays on v4", async () => {
  const workflowFiles = (await readdir(".github/workflows"))
    .filter((file) => /\.ya?ml$/u.test(file))
    .sort();
  const workflowRecords = [];

  for (const file of workflowFiles) {
    const source = await readFile(`.github/workflows/${file}`, "utf8");
    const checkoutShas = [
      ...source.matchAll(/actions\/checkout@([0-9a-f]{40})/gu),
    ].map((match) => match[1]);

    workflowRecords.push({
      file,
      source,
      checkoutShas,
      selfHosted:
        /\bruns-on:\s*\[[^\]]*\bself-hosted\b[^\]]*\]/u.test(source) ||
        /\bruns-on:\s*\n\s+group:[^\n]+\n\s+labels:[\s\S]*?\bself-hosted\b/u.test(source),
    });
  }

  const selfHostedWorkflows = workflowRecords.filter(
    (workflow) => workflow.selfHosted,
  );
  const requiredSelfHostedWorkflows = [
    STAGING_DEPLOY_WORKFLOW,
    STAGING_PROVISION_WORKFLOW,
    RESTORE_DATABASE_WORKFLOW,
    RESTORE_HOST_WORKFLOW,
    RESTORE_WORKFLOW,
  ];
  for (const requiredWorkflow of requiredSelfHostedWorkflows) {
    assert.equal(
      selfHostedWorkflows.some((workflow) => workflow.file === requiredWorkflow),
      true,
      `${requiredWorkflow} must stay on a self-hosted runner`,
    );
  }
  assert.deepEqual(
    selfHostedWorkflows
      .filter((workflow) => workflow.checkoutShas.length > 0)
      .map((workflow) => workflow.file),
    [
      STAGING_DEPLOY_WORKFLOW,
      STAGING_PROVISION_WORKFLOW,
      RESTORE_DATABASE_WORKFLOW,
      RESTORE_WORKFLOW,
    ],
  );
  const restoreWorkflows = selfHostedWorkflows.filter((workflow) =>
    [RESTORE_DATABASE_WORKFLOW, RESTORE_HOST_WORKFLOW, RESTORE_WORKFLOW].includes(
      workflow.file,
    )
  );
  const stagingProvisionWorkflow = selfHostedWorkflows.find(
    (workflow) => workflow.file === STAGING_PROVISION_WORKFLOW,
  );
  const stagingDeployWorkflow = selfHostedWorkflows.find(
    (workflow) => workflow.file === STAGING_DEPLOY_WORKFLOW,
  );
  assert.equal(restoreWorkflows.length, 3);
  for (const restoreWorkflow of restoreWorkflows) {
    assert.deepEqual(
      restoreWorkflow.checkoutShas,
      restoreWorkflow.file === RESTORE_HOST_WORKFLOW ? [] : [RESTORE_CHECKOUT_V4_SHA],
    );
  }
  assert.deepEqual(stagingProvisionWorkflow?.checkoutShas, [
    HOSTED_CHECKOUT_V7_0_1_SHA,
  ]);
  assert.deepEqual(stagingDeployWorkflow?.checkoutShas, [
    HOSTED_CHECKOUT_V7_0_1_SHA,
  ]);
  for (const restoreWorkflow of restoreWorkflows) {
    assert.match(
      restoreWorkflow.source,
      /runs-on:\s*\n\s+group:\s*fanmind-restore-drill\s*\n\s+labels:\s*\[self-hosted, fanmind-restore, fanmind-restore-01, linux, x64\]/u,
    );
    assert.match(
      restoreWorkflow.source,
      /RESTORE_RUNNER_SCOPE: \$\{\{ vars\.FANMIND_RESTORE_RUNNER_SCOPE \}\}[\s\S]*organization-workflow-allowlist/u,
    );
  }
  assert.match(
    stagingProvisionWorkflow?.source ?? "",
    /runs-on:\s*\[self-hosted, fanmind-prod, exoscale, linux, x64\]/u,
  );
  assert.match(
    stagingDeployWorkflow?.source ?? "",
    /runs-on:\s*\[self-hosted, fanmind-staging, exoscale, linux, x64\]/u,
  );

  const hostedWorkflows = workflowRecords.filter(
    (workflow) => !workflow.selfHosted && workflow.checkoutShas.length > 0,
  );
  assert.equal(hostedWorkflows.length, 59);
  assert.equal(
    hostedWorkflows.reduce(
      (count, workflow) => count + workflow.checkoutShas.length,
      0,
    ),
    64,
  );
  assert.equal(
    hostedWorkflows.every((workflow) =>
      workflow.checkoutShas.every(
        (checkoutSha) => checkoutSha === HOSTED_CHECKOUT_V7_0_1_SHA,
      ),
    ),
    true,
  );
});

test("CodeQL init and analyze use the same reviewed v4.37.7 commit and minimal permissions", async () => {
  const [source, reader] = await Promise.all([
    readFile(".github/workflows/codeql.yml", "utf8"),
    readFile("docs/security/SUPPLY_CHAIN.md", "utf8"),
  ]);
  const initMatch = source.match(
    /github\/codeql-action\/init@([0-9a-f]{40})\s+#\s+v4\.37\.7/u,
  );
  const analyzeMatch = source.match(
    /github\/codeql-action\/analyze@([0-9a-f]{40})\s+#\s+v4\.37\.7/u,
  );

  assert.equal(initMatch?.[1], CODEQL_V4_37_7_SHA);
  assert.equal(analyzeMatch?.[1], CODEQL_V4_37_7_SHA);
  assert.equal(initMatch?.[1], analyzeMatch?.[1]);
  assert.match(source, /queries: security-extended/u);
  assert.match(source, /security-events: write/u);
  assert.match(source, /contents: read/u);
  assert.doesNotMatch(source, /contents: write/u);
  assert.match(
    reader,
    new RegExp(
      `github/codeql-action[^\\n]+${CODEQL_V4_37_7_SHA}[^\\n]+v4\\.37\\.7`,
      "u",
    ),
  );
  assert.equal([...reader.matchAll(/4\.37\.7/gu)].length, 2);
  assert.doesNotMatch(reader, /4\.37\.6/u);
});

test("native CI and supply-chain reader use the reviewed setup-java v5.7.0 commit", async () => {
  const [workflow, reader] = await Promise.all([
    readFile(".github/workflows/ci-mobile-native.yml", "utf8"),
    readFile("docs/security/SUPPLY_CHAIN.md", "utf8"),
  ]);
  const setupJavaMatch = workflow.match(
    /actions\/setup-java@([0-9a-f]{40})\s+#\s+v5\.7\.0/u,
  );

  assert.equal(setupJavaMatch?.[1], SETUP_JAVA_V5_7_0_SHA);
  assert.match(
    reader,
    new RegExp(
      `actions/setup-java[^\\n]+${SETUP_JAVA_V5_7_0_SHA}[^\\n]+v5\\.7\\.0`,
      "u",
    ),
  );
  assert.doesNotMatch(reader, /v5\.6\.0/u);
});

test("dependency audit and CycloneDX SBOM gates are persistent and short-lived", async () => {
  const [workflow, manifest] = await Promise.all([
    readFile(".github/workflows/supply-chain-security.yml", "utf8"),
    readFile("package.json", "utf8"),
  ]);

  assert.match(workflow, /npm run verify:actions-pinned/u);
  assert.match(workflow, /npm run security:audit/u);
  assert.match(workflow, /npm run security:sbom/u);
  assert.match(workflow, /fanmind-dependency-audit-report/u);
  assert.match(workflow, /fanmind-cyclonedx-sbom/u);
  assert.match(workflow, /retention-days: 7/u);
  assert.match(workflow, /contents: read/u);
  assert.doesNotMatch(workflow, /contents: write/u);

  const parsed = JSON.parse(manifest);
  assert.equal(
    parsed.scripts["verify:actions-pinned"],
    "node scripts/verify-actions-pinned.mjs",
  );
  assert.equal(
    parsed.scripts["security:audit"],
    "node scripts/security/verify-dependency-audit.mjs",
  );
  assert.equal(
    parsed.scripts["security:sbom"],
    "node scripts/security/generate-sbom.mjs",
  );
});

test("Dependabot covers web, Mobile and GitHub Actions without auto-merge configuration", async () => {
  const source = await readFile(".github/dependabot.yml", "utf8");

  assert.match(source, /package-ecosystem: npm[\s\S]*directory: \//u);
  assert.match(source, /package-ecosystem: npm[\s\S]*directory: \/apps\/mobile/u);
  assert.match(source, /package-ecosystem: github-actions/u);
  assert.match(source, /interval: weekly/u);
  assert.doesNotMatch(source, /auto-merge|automerge/u);
});

test("completed one-off and patch workflows are absent", async () => {
  assert.equal(
    await exists(
      ".github/workflows/one-off-apply-top-fan-migration-20260719.yml",
    ),
    false,
  );
  assert.equal(
    await exists(
      ".github/workflows/p1-supply-chain-hardening-patch-20260723.yml",
    ),
    false,
  );
  assert.equal(
    await exists("scripts/security/supply-chain-hardening-patch-temp.mjs"),
    false,
  );
});
