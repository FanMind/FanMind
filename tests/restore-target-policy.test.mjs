import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import {
  RESTORE_READINESS_CONFIRMATION,
  RESTORE_TARGET_ACKNOWLEDGEMENT,
  evaluateRestoreReadiness,
  evaluateRestoreTarget,
  normalizeHost,
  normalizePort,
} from "../src/lib/restoreTargetPolicy.mjs";
import {
  REQUIRED_RESTORE_EXTENSIONS,
  REQUIRED_RESTORE_ROLES,
  RESTORE_TARGET_COMPATIBILITY_CONFIRMATION,
  RESTORE_TARGET_COMPATIBILITY_SQL,
} from "../scripts/operations/restore-target-compatibility.mjs";
import {
  analyzeAuthorizationToc,
} from "../scripts/operations/database-authorization-contract.mjs";
import {
  filterExtensionHostSchemaToc,
} from "../scripts/operations/restore-extension-toc-policy.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = "scripts/operations/restore-target-preflight.mjs";
const readinessScriptPath =
  "scripts/operations/restore-drill-resource-readiness.mjs";
const compatibilityScriptPath =
  "scripts/operations/restore-target-compatibility.mjs";
const readinessWorkflowPath =
  ".github/workflows/restore-drill-resource-readiness.yml";
const databaseRestoreWorkflowPath =
  ".github/workflows/restore-drill-database.yml";
const runnerPath = "scripts/operations/run-database-restore-drill.sh";
const extensionTocPolicyPath =
  "scripts/operations/restore-extension-toc-policy.mjs";
const runbookPath = "docs/operations/RESTORE_DRILL.md";
const packagePath = "package.json";
const EXTENSIONS_SCHEMA_TOC_ENTRY =
  "10; 2615 16392 SCHEMA - extensions postgres";
const VAULT_SCHEMA_TOC_ENTRY =
  "20; 2615 16490 SCHEMA - vault supabase_admin";
const SYNTHETIC_ARCHIVE_TOC = `${[
  ";",
  "; Archive created by PostgreSQL 17",
  "; Selected TOC Entries:",
  "1; 0 0 ENCODING - ENCODING ",
  "2; 0 0 STDSTRINGS - STDSTRINGS ",
  "3; 0 0 SEARCHPATH - SEARCHPATH ",
  EXTENSIONS_SCHEMA_TOC_ENTRY,
  VAULT_SCHEMA_TOC_ENTRY,
  "21; 3079 16440 EXTENSION - pg_stat_statements ",
  "11; 3079 16447 EXTENSION - pgcrypto ",
  "22; 3079 16491 EXTENSION - supabase_vault ",
  "23; 3079 16510 EXTENSION - uuid-ossp ",
  "12; 0 16392 COMMENT - SCHEMA extensions postgres",
  "13; 0 16392 SECURITY LABEL - SCHEMA extensions postgres",
  "14; 1259 20000 TABLE extensions fanmind_table postgres",
  "15; 1255 20001 FUNCTION extensions fanmind_fn() postgres",
  "16; 1259 20002 TABLE public contacts postgres",
  "17; 0 0 ACL - SCHEMA extensions postgres",
  "18; 0 0 ACL public TABLE contacts postgres",
  "19; 0 0 DEFAULT ACL - DEFAULT PRIVILEGES FOR TABLES postgres",
].join("\n")}\n`;
const SYNTHETIC_RESTORE_TOC = SYNTHETIC_ARCHIVE_TOC.replace(
  `${EXTENSIONS_SCHEMA_TOC_ENTRY}\n`,
  `;${EXTENSIONS_SCHEMA_TOC_ENTRY}\n`,
).replace(`${VAULT_SCHEMA_TOC_ENTRY}\n`, `;${VAULT_SCHEMA_TOC_ENTRY}\n`);
const SYNTHETIC_AUTHORIZATION_FINGERPRINT = "f".repeat(64);
const SYNTHETIC_AUTHORIZATION_ROLE_FINGERPRINT = "e".repeat(64);
const SYNTHETIC_AUTHORIZATION_ROLE_RECORD_COUNT = 12;
const SYNTHETIC_AUTHORIZATION_CONTAINER_FINGERPRINT = "7".repeat(64);
const SYNTHETIC_AUTHORIZATION_CONTAINER_RECORD_COUNT = 12;
const SYNTHETIC_AUTHORIZATION_EXTENSION_FINGERPRINT = "6".repeat(64);
const SYNTHETIC_AUTHORIZATION_EXTENSION_RECORD_COUNT = 85;
const SYNTHETIC_AUTHORIZATION_REQUIRED_EXTENSIONS = [
  {
    name: "pg_stat_statements",
    version: "1.11",
    schema: "extensions",
    owner: "postgres",
    relocatable: true,
    schemaOwner: "postgres",
    schemaDefinitionArchived: true,
  },
  {
    name: "pgcrypto",
    version: "1.3",
    schema: "extensions",
    owner: "postgres",
    relocatable: true,
    schemaOwner: "postgres",
    schemaDefinitionArchived: true,
  },
  {
    name: "plpgsql",
    version: "1.0",
    schema: "pg_catalog",
    owner: "supabase_admin",
    relocatable: false,
    schemaOwner: "supabase_admin",
    schemaDefinitionArchived: false,
  },
  {
    name: "supabase_vault",
    version: "0.3.1",
    schema: "vault",
    owner: "supabase_admin",
    relocatable: false,
    schemaOwner: "supabase_admin",
    schemaDefinitionArchived: true,
  },
  {
    name: "uuid-ossp",
    version: "1.1",
    schema: "extensions",
    owner: "postgres",
    relocatable: true,
    schemaOwner: "postgres",
    schemaDefinitionArchived: true,
  },
];
const SYNTHETIC_AUTHORIZATION_REQUIRED_EXTENSIONS_SHA256 = createHash("sha256")
  .update(JSON.stringify(SYNTHETIC_AUTHORIZATION_REQUIRED_EXTENSIONS), "utf8")
  .digest("hex");
const SYNTHETIC_AUTHORIZATION_RECORD_COUNT = 500;
const SYNTHETIC_AUTHORIZATION_GRANT_TUPLE_COUNT = 1000;
const SYNTHETIC_AUTHORIZATION_REQUIRED_ROLES = [
  "anon",
  "authenticated",
  "dashboard_user",
  "pg_database_owner",
  "postgres",
  "service_role",
  "supabase_etl_admin",
  "supabase_storage_admin",
];
const SYNTHETIC_AUTHORIZATION_REQUIRED_ROLES_SHA256 = createHash("sha256")
  .update(JSON.stringify(SYNTHETIC_AUTHORIZATION_REQUIRED_ROLES), "utf8")
  .digest("hex");
const SYNTHETIC_AUTHORIZATION_TOC = analyzeAuthorizationToc(
  SYNTHETIC_ARCHIVE_TOC,
);

function hexJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("hex");
}

function syntheticAuthorizationRoleCheck(overrides = {}) {
  return {
    server_version_num: 170006,
    required_role_count: SYNTHETIC_AUTHORIZATION_REQUIRED_ROLES.length,
    present_role_count: SYNTHETIC_AUTHORIZATION_REQUIRED_ROLES.length,
    component_roles: SYNTHETIC_AUTHORIZATION_REQUIRED_ROLES,
    role_fingerprint_sha256: SYNTHETIC_AUTHORIZATION_ROLE_FINGERPRINT,
    role_record_count: SYNTHETIC_AUTHORIZATION_ROLE_RECORD_COUNT,
    database_container_fingerprint_sha256:
      SYNTHETIC_AUTHORIZATION_CONTAINER_FINGERPRINT,
    database_container_record_count:
      SYNTHETIC_AUTHORIZATION_CONTAINER_RECORD_COUNT,
    database_container_invariant_violation_count: 0,
    extension_fingerprint_sha256:
      SYNTHETIC_AUTHORIZATION_EXTENSION_FINGERPRINT,
    extension_record_count: SYNTHETIC_AUTHORIZATION_EXTENSION_RECORD_COUNT,
    required_extensions: SYNTHETIC_AUTHORIZATION_REQUIRED_EXTENSIONS,
    extension_contract_invariant_violation_count: 0,
    extension_contract_unsupported_class_count: 0,
    restore_user_superuser: true,
    restore_user_login: true,
    restore_user_outside_component: true,
    outside_component_login_role_count: 1,
    outside_component_superuser_role_count: 1,
    ...overrides,
  };
}

function safeEnvironment(overrides = {}) {
  return {
    FANMIND_RUNTIME_ENVIRONMENT: "test",
    NEXT_PUBLIC_APP_URL: "https://restore-test.fanmind.example",
    NEXT_PUBLIC_SUPABASE_URL: "https://restoretestref1.supabase.co",
    FANMIND_TARGET_SUPABASE_PROJECT_REF: "restoretestref1",
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    FANMIND_ENABLE_RESTORE_DRILL: "true",
    FANMIND_RESTORE_TARGET_ACK: RESTORE_TARGET_ACKNOWLEDGEMENT,
    PGHOST: "restore-db.internal",
    PGPORT: "5432",
    PGDATABASE: "fanmind_restore",
    PGUSER: "restore_operator",
    PGPASSFILE: "/secure/keys/restore.pgpass",
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: "/secure/keys/restore-ca.pem",
    PGGSSENCMODE: "disable",
    PGPASSWORD: "",
    PGHOSTADDR: "",
    PGSERVICE: "",
    PGSERVICEFILE: "",
    FANMIND_RESTORE_TARGET_DB_HOST: "restore-db.internal",
    FANMIND_RESTORE_TARGET_DB_PORT: "5432",
    FANMIND_RESTORE_TARGET_DB_NAME: "fanmind_restore",
    FANMIND_RESTORE_TARGET_DB_USER: "restore_operator",
    FANMIND_PRODUCTION_DB_HOST: "db.production.internal",
    FANMIND_PRODUCTION_DB_PORT: "6543",
    FANMIND_PRODUCTION_DB_NAME: "postgres",
    FANMIND_PRODUCTION_DB_USER: "postgres.productionref123",
    ...overrides,
  };
}

function safeReadinessEnvironment(overrides = {}) {
  return safeEnvironment({
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "",
    FANMIND_ENABLE_RESTORE_DRILL: "false",
    FANMIND_RESTORE_TARGET_ACK: "",
    FANMIND_RESTORE_READINESS_CONFIRM: RESTORE_READINESS_CONFIRMATION,
    PGHOST: "",
    PGPORT: "",
    PGDATABASE: "",
    PGUSER: "",
    PGPASSFILE: "",
    ...overrides,
  });
}

async function restoreCompatibilityFixture(
  root,
  catalogResult = "170006|3|1|1",
  overrides = {},
) {
  const passfilePath = join(root, "restore-compatibility.pgpass");
  const caCertificatePath = join(root, "restore-compatibility-ca.pem");
  const fakePsqlPath = join(root, "restore-compatibility-psql.sh");
  const capturePath = join(root, "restore-compatibility-capture.txt");
  await writeFile(
    passfilePath,
    "restore-db.internal:5432:fanmind_restore:restore_operator:private-compatibility-password\n",
    { mode: 0o600 },
  );
  await writeFile(
    caCertificatePath,
    "synthetic-private-compatibility-ca\n",
    { mode: 0o644 },
  );
  await writeFile(
    fakePsqlPath,
    [
      "#!/bin/sh",
      "set -eu",
      "{",
      "  printf 'ARGS='",
      "  printf '%s ' \"$@\"",
      "  printf '\\nPGSSLMODE=%s\\n' \"$PGSSLMODE\"",
      "  printf 'PGGSSENCMODE=%s\\n' \"$PGGSSENCMODE\"",
      "  printf 'PGOPTIONS=%s\\n' \"$PGOPTIONS\"",
      "  printf 'PASSFILE_PRIVATE=%s\\n' \"$(stat -c %a \"$PGPASSFILE\")\"",
      "  printf 'PASSFILE_SNAPSHOT=%s\\n' \"$([ \"$PGPASSFILE\" != \"$FANMIND_TEST_SOURCE_PASSFILE\" ] && echo yes || echo no)\"",
      "  printf 'CA_PRIVATE=%s\\n' \"$(stat -c %a \"$PGSSLROOTCERT\")\"",
      "  printf 'CA_SNAPSHOT=%s\\n' \"$([ \"$PGSSLROOTCERT\" != \"$FANMIND_TEST_SOURCE_CA\" ] && echo yes || echo no)\"",
      "  printf 'PASSFILE_PATH=%s\\n' \"$PGPASSFILE\"",
      "  printf 'CA_PATH=%s\\n' \"$PGSSLROOTCERT\"",
      "} > \"$FANMIND_TEST_COMPATIBILITY_CAPTURE\"",
      "printf '%s\\n' \"$FANMIND_TEST_COMPATIBILITY_RESULT\"",
      "",
    ].join("\n"),
    { mode: 0o700 },
  );

  return {
    environment: {
      ...process.env,
      GITHUB_ACTIONS: "",
      ...safeReadinessEnvironment(),
      FANMIND_RESTORE_TARGET_COMPATIBILITY_CONFIRM:
        RESTORE_TARGET_COMPATIBILITY_CONFIRMATION,
      FANMIND_RESTORE_TARGET_PGPASSFILE_PATH: passfilePath,
      FANMIND_RESTORE_TARGET_CA_CERT_PATH: caCertificatePath,
      FANMIND_OPERATIONAL_TEST_MODE: "restore-target-compatibility-test",
      FANMIND_PSQL_BIN: fakePsqlPath,
      FANMIND_TEST_COMPATIBILITY_CAPTURE: capturePath,
      FANMIND_TEST_COMPATIBILITY_RESULT: catalogResult,
      FANMIND_TEST_SOURCE_PASSFILE: passfilePath,
      FANMIND_TEST_SOURCE_CA: caCertificatePath,
      ...overrides,
    },
    passfilePath,
    caCertificatePath,
    capturePath,
  };
}

async function restoreRunnerEnvironment(root, dumpPath, overrides = {}) {
  const receiptPath = join(root, "full-backup-receipt.json");
  const runnerReceiptPath = join(root, "restore-runner-receipt.json");
  const databasePostcheckReceiptPath = join(
    root,
    "database-postcheck-receipt.json",
  );
  const fakePsqlPath = join(root, "fake-psql.sh");
  const caCertificatePath = join(root, "restore-ca.pem");
  const dumpBytes = await readFile(dumpPath);
  const dumpSha256 = createHash("sha256").update(dumpBytes).digest("hex");
  const fullReceipt = {
    schemaVersion: 2,
    createdAt: "2026-07-30T07:55:00Z",
    sourceArtifactBasename: "fanmind-full-1785398400000.tar.gz.age",
    outerSha256: "a".repeat(64),
    productionCommit: "b".repeat(40),
    databasePartEncryptedSha256: "d".repeat(64),
    databaseDumpSha256: dumpSha256,
    databaseAuthorizationContractVersion: 2,
    databaseAuthorizationFingerprintSha256:
      SYNTHETIC_AUTHORIZATION_FINGERPRINT,
    databaseAuthorizationRecordCount: SYNTHETIC_AUTHORIZATION_RECORD_COUNT,
    databaseAuthorizationGrantTupleCount:
      SYNTHETIC_AUTHORIZATION_GRANT_TUPLE_COUNT,
    databaseAuthorizationRequiredRoles:
      SYNTHETIC_AUTHORIZATION_REQUIRED_ROLES,
    databaseAuthorizationRequiredRolesSha256:
      SYNTHETIC_AUTHORIZATION_REQUIRED_ROLES_SHA256,
    databaseAuthorizationRoleFingerprintSha256:
      SYNTHETIC_AUTHORIZATION_ROLE_FINGERPRINT,
    databaseAuthorizationRoleRecordCount:
      SYNTHETIC_AUTHORIZATION_ROLE_RECORD_COUNT,
    databaseAuthorizationContainerFingerprintSha256:
      SYNTHETIC_AUTHORIZATION_CONTAINER_FINGERPRINT,
    databaseAuthorizationContainerRecordCount:
      SYNTHETIC_AUTHORIZATION_CONTAINER_RECORD_COUNT,
    databaseAuthorizationRequiredExtensions:
      SYNTHETIC_AUTHORIZATION_REQUIRED_EXTENSIONS,
    databaseAuthorizationRequiredExtensionsSha256:
      SYNTHETIC_AUTHORIZATION_REQUIRED_EXTENSIONS_SHA256,
    databaseAuthorizationExtensionFingerprintSha256:
      SYNTHETIC_AUTHORIZATION_EXTENSION_FINGERPRINT,
    databaseAuthorizationExtensionRecordCount:
      SYNTHETIC_AUTHORIZATION_EXTENSION_RECORD_COUNT,
    databaseCoreTableAppGrantTupleCount: 120,
    databaseRestrictedSecurityDefinerFunctionCount: 12,
    databaseAclTocEntryCount: SYNTHETIC_AUTHORIZATION_TOC.aclEntryCount,
    databaseDefaultAclTocEntryCount:
      SYNTHETIC_AUTHORIZATION_TOC.defaultAclEntryCount,
    databaseAclTocSha256: SYNTHETIC_AUTHORIZATION_TOC.sha256,
    databasePrivilegesArchived: true,
    databaseOwnershipArchived: true,
    verifier: "passed",
  };
  await writeFile(receiptPath, `${JSON.stringify(fullReceipt)}\n`);
  await chmod(receiptPath, 0o600);
  await writeFile(caCertificatePath, "synthetic-restore-ca\n", { mode: 0o644 });
  await writeFile(
    fakePsqlPath,
    [
      "#!/usr/bin/env bash",
      "set -Eeuo pipefail",
      "if [[ \"$*\" != *--command* ]]; then",
      "  sql_input=\"$(cat)\"",
      "  if [[ \"$sql_input\" == *FANMIND_ROLE_CHECK* ]]; then",
      "    printf 'FANMIND_ROLE_CHECK|%s\\n' \"$FANMIND_TEST_ROLE_CHECK_HEX\"",
      "    exit 0",
      "  fi",
      "  if [[ \"$sql_input\" == *FANMIND_AUTHORIZATION* ]]; then",
      "    printf 'FANMIND_AUTHORIZATION|%s\\n' \"$FANMIND_TEST_AUTHORIZATION_HEX\"",
      "    exit 0",
      "  fi",
      "  exit 91",
      "fi",
      "if [[ \"$*\" == *fanmind_required_restore_tables* ]]; then",
      "  printf '%s\\n' \"$FANMIND_TEST_POSTCHECK_RESULT\"",
      "  exit 0",
      "fi",
      "if [[ -n \"${FANMIND_TEST_EMPTY_QUERY_MARKER_PATH:-}\" ]]; then",
      "  {",
      "    printf 'ARGS='",
      "    printf '%q ' \"$@\"",
      "    printf '\\nPGPASSFILE=%s\\n' \"$PGPASSFILE\"",
      "  } > \"$FANMIND_TEST_EMPTY_QUERY_MARKER_PATH\"",
      "fi",
      "printf '%s\\n' \"${FANMIND_TEST_EMPTY_TARGET_RESULT:-0}\"",
      "",
    ].join("\n"),
  );
  await chmod(fakePsqlPath, 0o755);

  return {
    GITHUB_ACTIONS: "",
    FANMIND_OPERATIONAL_TEST_MODE: "restore-runner-test",
    FANMIND_PSQL_BIN: fakePsqlPath,
    FANMIND_FULL_BACKUP_RESTORE_RECEIPT_PATH: receiptPath,
    FANMIND_RESTORE_RUNNER_RECEIPT_PATH: runnerReceiptPath,
    FANMIND_RESTORE_DATABASE_POSTCHECK_RECEIPT_PATH:
      databasePostcheckReceiptPath,
    FANMIND_RESTORE_DRILL_ID: "2026-07-30-restore-001",
    FANMIND_RESTORE_DISPOSABLE_TARGET_ID:
      "123e4567-e89b-42d3-a456-426614174000",
    FANMIND_RESTORE_PRODUCTION_COMMIT: "b".repeat(40),
    FANMIND_TEST_POSTCHECK_RESULT: [
      "contacts|1|1|4",
      "followups|1|1|3",
      "memories|1|1|3",
      "workspace_members|1|1|2",
      "workspaces|1|1|2",
    ].join("\n"),
    FANMIND_TEST_ARCHIVE_TOC: SYNTHETIC_ARCHIVE_TOC,
    FANMIND_TEST_ROLE_CHECK_HEX: hexJson(syntheticAuthorizationRoleCheck()),
    FANMIND_TEST_AUTHORIZATION_HEX: hexJson({
      server_version_num: 170006,
      fingerprint_sha256: SYNTHETIC_AUTHORIZATION_FINGERPRINT,
      record_count: SYNTHETIC_AUTHORIZATION_RECORD_COUNT,
      grant_tuple_count: SYNTHETIC_AUTHORIZATION_GRANT_TUPLE_COUNT,
      required_roles: SYNTHETIC_AUTHORIZATION_REQUIRED_ROLES,
      role_fingerprint_sha256: SYNTHETIC_AUTHORIZATION_ROLE_FINGERPRINT,
      role_record_count: SYNTHETIC_AUTHORIZATION_ROLE_RECORD_COUNT,
      database_container_fingerprint_sha256:
        SYNTHETIC_AUTHORIZATION_CONTAINER_FINGERPRINT,
      database_container_record_count:
        SYNTHETIC_AUTHORIZATION_CONTAINER_RECORD_COUNT,
      core_table_app_grant_tuple_count: 120,
      core_table_app_grant_option_count: 0,
      core_table_app_grant_row_count: 120,
      container_recovery_invariant_violation_count: 0,
      extension_recovery_invariant_violation_count: 0,
      extension_fingerprint_sha256:
        SYNTHETIC_AUTHORIZATION_EXTENSION_FINGERPRINT,
      extension_record_count: SYNTHETIC_AUTHORIZATION_EXTENSION_RECORD_COUNT,
      required_extensions: SYNTHETIC_AUTHORIZATION_REQUIRED_EXTENSIONS,
      extension_contract_invariant_violation_count: 0,
      extension_contract_unsupported_class_count: 0,
      public_security_definer_function_count: 13,
      restricted_security_definer_function_count: 12,
      exposed_security_definer_exception_count: 1,
      hardened_security_definer_exception_count: 0,
      unsupported_default_acl_type_count: 0,
      unresolved_role_oid_count: 0,
    }),
    PGSSLROOTCERT: caCertificatePath,
    ...overrides,
  };
}

test("read-only restore readiness confirms isolation without enabling a restore", () => {
  const result = evaluateRestoreReadiness(safeReadinessEnvironment());

  assert.equal(result.ok, true);
  assert.equal(result.mode, "isolated-restore-readiness");
  assert.equal(result.environmentBoundaryOk, true);
  assert.equal(result.targetConfirmed, true);
  assert.equal(result.productionHostSeparated, true);
  assert.equal(result.hiddenTargetOverridesClear, true);

  const unsafe = evaluateRestoreReadiness(
    safeReadinessEnvironment({
      FANMIND_RUNTIME_ENVIRONMENT: "production",
      NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
      NEXT_PUBLIC_SUPABASE_URL:
        "https://productionref123.supabase.co",
      FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionref123",
      FANMIND_ENABLE_RESTORE_DRILL: "true",
      FANMIND_RESTORE_TARGET_ACK: RESTORE_TARGET_ACKNOWLEDGEMENT,
      FANMIND_RESTORE_TARGET_DB_HOST: "db.production.internal",
    }),
  );
  assert.equal(unsafe.ok, false);
  assert.ok(unsafe.errors.includes("runtime_environment"));
  assert.ok(unsafe.errors.includes("production_boundary"));
  assert.ok(unsafe.errors.includes("restore_write_gate"));
  assert.ok(unsafe.errors.includes("production_database_target"));

  const incomplete = evaluateRestoreReadiness(
    safeReadinessEnvironment({
      FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "",
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "",
    }),
  );
  assert.equal(incomplete.ok, false);
  assert.ok(incomplete.errors.includes("production_boundary"));
  assert.ok(incomplete.errors.includes("non_production_write_gate"));

  const hostedDatabase = evaluateRestoreReadiness(
    safeReadinessEnvironment({
      FANMIND_RESTORE_TARGET_DB_HOST: "db.restoretestref1.supabase.co",
    }),
  );
  assert.equal(hostedDatabase.ok, false);
  assert.equal(hostedDatabase.managedSupabaseTarget, true);
  assert.ok(
    hostedDatabase.errors.includes("managed_supabase_target_unsupported"),
  );
});

test("restore resource runner verifies only the encrypted full-backup checksum", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-restore-readiness-"));
  try {
    const secretMarker = "never-print-restore-resource";
    const artifactPath = join(
      root,
      "fanmind-full-20260727T120000Z.tar.gz.age",
    );
    const content = Buffer.from(`encrypted-${secretMarker}`);
    const digest = createHash("sha256").update(content).digest("hex");
    await writeFile(artifactPath, content);
    await writeFile(
      `${artifactPath}.sha256`,
      `${digest}  fanmind-full-20260727T120000Z.tar.gz.age\n`,
    );
    const before = await readFile(artifactPath);

    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [readinessScriptPath],
      {
        env: {
          ...process.env,
          ...safeReadinessEnvironment({
            FANMIND_RESTORE_ARTIFACT_PATH: artifactPath,
          }),
        },
      },
    );
    const output = `${stdout}\n${stderr}`;

    assert.match(output, /RESTORE_READINESS_MODE=checksum_only/);
    assert.match(output, /RESTORE_READINESS_DATABASE_CONNECTION=not_attempted/);
    assert.match(output, /RESTORE_READINESS_DECRYPTION=not_attempted/);
    assert.match(output, /RESTORE_READINESS_WRITES=disabled/);
    assert.match(output, /RESTORE_DRILL_RESOURCE_READINESS=PASS/);
    assert.doesNotMatch(output, new RegExp(secretMarker));
    assert.doesNotMatch(output, new RegExp(digest));
    assert.doesNotMatch(output, /fanmind-full-20260727/);
    assert.deepEqual(await readFile(artifactPath), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("manual restore readiness workflow is main-only and write-disabled", async () => {
  const [workflow, runbook, packageSource] = await Promise.all([
    readFile(readinessWorkflowPath, "utf8"),
    readFile(runbookPath, "utf8"),
    readFile(packagePath, "utf8"),
  ]);
  const packageJson = JSON.parse(packageSource);

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /REQUESTED_CONFIRMATION: \$\{\{ inputs\.confirmation \}\}/);
  assert.match(workflow, /GITHUB_REF" == 'refs\/heads\/main'/);
  assert.match(workflow, /REQUESTED_CONFIRMATION" == 'verify-isolated-restore-resources'/);
  assert.equal(
    (workflow.match(/group: fanmind-restore-drill\n/gu) ?? []).length,
    2,
  );
  assert.equal(
    (workflow.match(/labels: \[self-hosted, fanmind-restore, fanmind-restore-01, linux, x64\]/gu) ?? []).length,
    2,
  );
  assert.match(workflow, /RESTORE_RUNNER_SCOPE" == 'organization-workflow-allowlist'/u);
  assert.match(workflow, /environment: restore-drill/);
  assert.match(workflow, /needs: validate-dispatch/u);
  assert.match(workflow, /needs: verify-restore-host/u);
  assert.match(workflow, /RESTORE_HOST_GATE_SHA256:/u);
  assert.match(workflow, /Re-attest the preinstalled gate before checkout/u);
  assert.match(workflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'/);
  assert.match(workflow, /FANMIND_ENABLE_RESTORE_DRILL: 'false'/);
  assert.match(workflow, /node scripts\/operations\/restore-drill-resource-readiness\.mjs/);
  assert.match(workflow, /node scripts\/operations\/restore-target-compatibility\.mjs/);
  assert.ok(
    workflow.indexOf("restore-drill-resource-readiness.mjs")
      < workflow.indexOf("restore-target-compatibility.mjs"),
  );
  assert.match(
    workflow,
    /FANMIND_RESTORE_TARGET_COMPATIBILITY_CONFIRM: verify-read-only-restore-target/,
  );
  assert.match(workflow, /FANMIND_RESTORE_TARGET_PGPASSFILE_PATH:/);
  assert.match(workflow, /FANMIND_RESTORE_TARGET_CA_CERT_PATH:/);
  assert.doesNotMatch(
    workflow,
    /restore:database:drill|pg_restore|--identity|FANMIND_BACKUP_AGE_IDENTITY/,
  );
  assert.doesNotMatch(workflow, /actions\/setup-node|\bnpm (?:ci|run)\b/u);
  assert.equal(
    packageJson.scripts["restore:resources:preflight"],
    "node scripts/operations/restore-drill-resource-readiness.mjs",
  );
  assert.equal(
    packageJson.scripts["restore:target:compatibility"],
    "node scripts/operations/restore-target-compatibility.mjs",
  );
  assert.match(runbook, /FanMind Restore Drill Resource Readiness/);
  assert.match(runbook, /RESTORE_DRILL_RESOURCE_READINESS=PASS/);
  assert.match(runbook, /RESTORE_TARGET_COMPATIBILITY=PASS/);
  assert.match(runbook, /sslmode=verify-full/);
});

test("manual database restore workflow is exact-commit-bound and receipt-only", async () => {
  const workflow = await readFile(databaseRestoreWorkflowPath, "utf8");
  const protectedJob = workflow.slice(workflow.indexOf("  restore-isolated-database:"));
  const secretFreeHostJob = workflow.slice(
    workflow.indexOf("  verify-restore-host:"),
    workflow.indexOf("  restore-isolated-database:"),
  );
  const compatibilityStep = protectedJob.slice(
    protectedJob.indexOf(
      "      - name: Verify isolated PostgreSQL 17 target read-only",
    ),
    protectedJob.indexOf(
      "      - name: Decrypt privately and restore the exact database dump",
    ),
  );

  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /REVIEWED_COMMIT: \$\{\{ inputs\.reviewed_commit \}\}/u);
  assert.match(workflow, /REVIEWED_COMMIT" == "\$GITHUB_SHA"/u);
  assert.match(workflow, /GITHUB_REF" == 'refs\/heads\/main'/u);
  assert.match(workflow, /run-isolated-database-restore/u);
  assert.equal(
    (workflow.match(/group: fanmind-restore-drill\n/gu) ?? []).length,
    2,
  );
  assert.equal(
    (workflow.match(/labels: \[self-hosted, fanmind-restore, fanmind-restore-01, linux, x64\]/gu) ?? []).length,
    2,
  );
  assert.match(workflow, /RESTORE_RUNNER_SCOPE" == 'organization-workflow-allowlist'/u);
  assert.match(workflow, /environment: restore-drill/u);
  assert.doesNotMatch(secretFreeHostJob, /secrets\.|environment: restore-drill|actions\/checkout/u);
  assert.ok(
    protectedJob.indexOf("Re-attest the preinstalled gate")
      < protectedJob.indexOf("actions/checkout@"),
  );
  assert.match(workflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'/u);
  assert.match(workflow, /FANMIND_ENABLE_RESTORE_DRILL: 'false'/u);
  assert.match(
    compatibilityStep,
    /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'/u,
  );
  assert.match(compatibilityStep, /FANMIND_NON_PRODUCTION_WRITE_ACK: ''/u);
  assert.match(compatibilityStep, /FANMIND_ENABLE_RESTORE_DRILL: 'false'/u);
  assert.match(compatibilityStep, /FANMIND_RESTORE_TARGET_ACK: ''/u);
  assert.match(
    compatibilityStep,
    /FANMIND_RESTORE_READINESS_CONFIRM: verify-isolated-restore-resources/u,
  );
  assert.match(workflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'true'/u);
  assert.match(workflow, /FANMIND_ENABLE_RESTORE_DRILL: 'true'/u);
  assert.match(workflow, /node scripts\/operations\/restore-drill-resource-readiness\.mjs/u);
  assert.match(workflow, /node scripts\/operations\/restore-target-compatibility\.mjs/u);
  assert.match(workflow, /node scripts\/operations\/restore-target-preflight\.mjs/u);
  assert.match(workflow, /verify-backup-artifact\.mjs/u);
  assert.match(workflow, /\/usr\/bin\/bash -p scripts\/operations\/run-database-restore-drill\.sh/u);
  assert.ok(
    workflow.indexOf("restore-drill-resource-readiness.mjs")
      < workflow.indexOf("restore-target-compatibility.mjs"),
  );
  assert.ok(
    workflow.indexOf("restore-target-compatibility.mjs")
      < workflow.indexOf("run-database-restore-drill.sh"),
  );
  assert.match(workflow, /PGSSLMODE: verify-full/u);
  assert.match(workflow, /PGGSSENCMODE: disable/u);
  assert.match(workflow, /FANMIND_RESTORE_AGE_IDENTITY_PATH/u);
  assert.match(
    workflow,
    /Decrypt privately and restore[\s\S]*?FANMIND_RESTORE_PRIVATE_ROOT: \$\{\{ runner\.temp \}\}\/fanmind-restore-/u,
  );
  assert.match(workflow, /TMPDIR="\$FANMIND_RESTORE_PRIVATE_ROOT\/work"/u);
  assert.match(workflow, /--age-bin \/usr\/bin\/age/u);
  assert.match(workflow, /--pg-restore-bin \/usr\/lib\/postgresql\/17\/bin\/pg_restore/u);
  assert.match(workflow, /--tar-bin \/usr\/bin\/tar/u);
  assert.match(workflow, /\/receipts\n/u);
  assert.match(workflow, /retention-days: 3/u);
  assert.match(workflow, /RESTORE_DISPOSABLE_TARGET_CLEANUP=required/u);
  assert.doesNotMatch(workflow, /path:.*verified-database\.dump/u);
  assert.doesNotMatch(workflow, /rm -rf|rmdir[^\n]*\|\| true/u);
  assert.doesNotMatch(workflow, /actions\/setup-node|\bnpm (?:ci|run)\b/u);
});

test("restore target compatibility uses one redacted read-only catalog query", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-restore-compatibility-"));
  try {
    const fixture = await restoreCompatibilityFixture(root);
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [compatibilityScriptPath],
      { env: fixture.environment },
    );
    const output = `${stdout}\n${stderr}`;
    const capture = await readFile(fixture.capturePath, "utf8");

    assert.match(output, /RESTORE_TARGET_COMPATIBILITY_SERVER_MAJOR=17/);
    assert.match(output, /RESTORE_TARGET_COMPATIBILITY_REQUIRED_ROLES=3/);
    assert.match(output, /RESTORE_TARGET_COMPATIBILITY_PRESENT_ROLES=3/);
    assert.match(
      output,
      /RESTORE_TARGET_COMPATIBILITY_REQUIRED_EXTENSIONS=1/,
    );
    assert.match(
      output,
      /RESTORE_TARGET_COMPATIBILITY_INSTALLED_EXTENSIONS=1/,
    );
    assert.match(
      output,
      /RESTORE_TARGET_COMPATIBILITY_RESTORE_USER_SUPERUSER=true/,
    );
    assert.match(output, /DATABASE_CONNECTION=read_only_catalog/);
    assert.match(output, /RESTORE_TARGET_COMPATIBILITY_TLS=verify-full/);
    assert.match(output, /RESTORE_TARGET_COMPATIBILITY_WRITES=disabled/);
    assert.match(output, /RESTORE_TARGET_COMPATIBILITY=PASS/);
    assert.match(output, /SECRETS_WURDEN_NICHT_AUSGEGEBEN=true/);

    assert.match(capture, /--host restore-db\.internal/);
    assert.match(capture, /--port 5432/);
    assert.match(capture, /--dbname fanmind_restore/);
    assert.match(capture, /--username restore_operator/);
    assert.match(capture, /PGSSLMODE=verify-full/);
    assert.match(capture, /PGGSSENCMODE=disable/);
    assert.match(capture, /PGOPTIONS=-c default_transaction_read_only=on/);
    assert.match(capture, /PASSFILE_PRIVATE=600/);
    assert.match(capture, /PASSFILE_SNAPSHOT=yes/);
    assert.match(capture, /CA_PRIVATE=600/);
    assert.match(capture, /CA_SNAPSHOT=yes/);
    assert.match(capture, /pg_catalog\.pg_settings/);
    assert.match(capture, /pg_catalog\.pg_roles/);
    assert.match(capture, /pg_catalog\.pg_extension/);
    assert.match(capture, /pg_catalog\.pg_namespace/);
    assert.match(capture, /restore_role\.rolsuper/u);
    assert.match(capture, /extension\.extversion = '1\.3'/u);
    assert.match(capture, /namespace\.nspname = 'extensions'/u);
    assert.match(capture, /extension\.extconfig is null/u);
    assert.match(capture, /extension\.extcondition is null/u);
    assert.doesNotMatch(
      RESTORE_TARGET_COMPATIBILITY_SQL,
      /\b(?:insert|update|delete|create|alter|drop|grant|revoke|copy|call)\b/iu,
    );

    for (const sensitive of [
      "restore-db.internal",
      "fanmind_restore",
      "restore_operator",
      "private-compatibility-password",
      "synthetic-private-compatibility-ca",
      fixture.passfilePath,
      fixture.caCertificatePath,
    ]) {
      assert.doesNotMatch(output, new RegExp(sensitive.replaceAll("/", "\\/")));
    }

    const snapshotPassfile = capture.match(/^PASSFILE_PATH=(.+)$/mu)?.[1];
    const snapshotCa = capture.match(/^CA_PATH=(.+)$/mu)?.[1];
    await assert.rejects(access(snapshotPassfile));
    await assert.rejects(access(snapshotCa));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restore target compatibility fails closed on version, role, extension or format mismatch", async () => {
  const cases = [
    ["160009|3|1|1", "server_major_incompatible"],
    ["180001|3|1|1", "server_major_incompatible"],
    ["170006|2|1|1", "required_roles_missing"],
    ["170006|3|0|1", "required_extensions_missing"],
    ["170006|3|1|0", "restore_user_not_superuser"],
    ["restore-db.internal|3|1|1", "catalog_result_invalid"],
  ];

  for (const [catalogResult, expectedCode] of cases) {
    const root = await mkdtemp(join(tmpdir(), "fanmind-restore-compatibility-"));
    try {
      const fixture = await restoreCompatibilityFixture(root, catalogResult);
      await assert.rejects(
        execFileAsync(process.execPath, [compatibilityScriptPath], {
          env: fixture.environment,
        }),
        (error) => {
          const output = `${String(error.stdout)}\n${String(error.stderr)}`;
          assert.match(
            output,
            new RegExp(`RESTORE_TARGET_COMPATIBILITY_ERROR=${expectedCode}`),
          );
          assert.match(output, /RESTORE_TARGET_COMPATIBILITY=FAIL/);
          assert.match(output, /SECRETS_WURDEN_NICHT_AUSGEGEBEN=true/);
          assert.doesNotMatch(output, /restore-db\.internal|private-compatibility/);
          return true;
        },
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("restore compatibility prerequisites stay bound to FanMind migrations", async () => {
  const migrationDirectory = "supabase/migrations";
  const migrationFiles = (await readdir(migrationDirectory))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const migrationSql = (
    await Promise.all(
      migrationFiles.map((name) => readFile(join(migrationDirectory, name), "utf8")),
    )
  ).join("\n");
  const extensions = [...migrationSql.matchAll(
    /\bcreate\s+extension\s+if\s+not\s+exists\s+([a-z0-9_]+)/giu,
  )].map((match) => match[1].toLowerCase());

  assert.deepEqual([...new Set(extensions)].sort(), REQUIRED_RESTORE_EXTENSIONS);
  assert.deepEqual(REQUIRED_RESTORE_ROLES, [
    "anon",
    "authenticated",
    "service_role",
  ]);
  for (const role of REQUIRED_RESTORE_ROLES) {
    assert.match(
      migrationSql,
      new RegExp(`\\b(?:grant|revoke)\\b[^;]{0,500}\\b${role}\\b`, "iu"),
    );
  }
  const runner = await readFile(runnerPath, "utf8");
  assert.match(
    runner,
    /expected_extension_versions\([\s\S]+?schema_name[\s\S]+?\) AS/u,
  );
  assert.match(
    runner,
    /\('plpgsql', '1\.0', false, 'pg_catalog'\)/u,
  );
  assert.match(
    runner,
    /\('pgcrypto', '1\.3', true, 'extensions'\)/u,
  );
  assert.match(runner, /expected\.relocatable = e\.extrelocatable/u);
  assert.match(runner, /n\.nspname = expected\.schema_name/u);
  assert.match(runner, /exact extension version\/schema\/owner\/member inventory/u);
  assert.doesNotMatch(runner, /FANMIND_[A-Z0-9_]*PGCRYPTO[A-Z0-9_]*SCHEMA/u);
  assert.match(runner, /WHERE e\.extconfig IS NULL/u);
  assert.match(runner, /AND e\.extcondition IS NULL/u);
  assert.match(
    runner,
    /expected_extension_functions\([\s\S]+?identity_arguments,[\s\S]+?parallel_safety/u,
  );
  const manifestMatch = runner.match(
    /expected_extension_functions\([\s\S]+?\) AS \(\n  VALUES\n([\s\S]+?)\n\),\nresolved_extension_functions AS/u,
  );
  assert.ok(manifestMatch);
  assert.equal(
    (manifestMatch[1].match(/^    \('(plpgsql|pgcrypto)',/gmu) ?? []).length,
    39,
  );
  for (const row of [
    "('plpgsql', 'plpgsql_call_handler', '', 'plpgsql_call_handler', 'language_handler', false, 'v', 'u')",
    "('pgcrypto', 'digest', 'text, text', 'pg_digest', 'bytea', true, 'i', 's')",
    "('pgcrypto', 'gen_random_uuid', '', 'pg_random_uuid', 'uuid', false, 'v', 's')",
    "('pgcrypto', 'armor', 'bytea, text[], text[]', 'pg_armor', 'text', true, 'i', 's')",
    "('pgcrypto', 'pgp_armor_headers', 'text, OUT key text, OUT value text', 'pgp_armor_headers', 'SETOF record', true, 'i', 's')",
  ]) {
    assert.ok(runner.includes(row));
  }
  assert.match(runner, /resolved_extension_functions AS/u);
  assert.match(runner, /p\.pronamespace = e\.extnamespace/u);
  assert.match(runner, /AND l\.lanname = 'c'/u);
  assert.match(
    runner,
    /pg_catalog\.pg_get_function_identity_arguments\(p\.oid\)[\s\n]+\s*= expected\.identity_arguments/u,
  );
  assert.match(runner, /p\.probin = '\\\$libdir\/' \|\| expected\.extname/u);
  assert.match(runner, /p\.prosrc = expected\.c_symbol/u);
  assert.match(
    runner,
    /p\.proowner IN \(e\.extowner, 10::pg_catalog\.oid\)/u,
  );
  assert.match(
    runner,
    /pg_catalog\.pg_get_function_result\(p\.oid\) = expected\.result_type/u,
  );
  assert.match(runner, /p\.proisstrict = expected\.is_strict/u);
  assert.match(runner, /p\.provolatile = expected\.volatility/u);
  assert.match(runner, /p\.proparallel = expected\.parallel_safety/u);
  assert.match(runner, /AND NOT p\.prosecdef/u);
  assert.match(runner, /AND NOT p\.proleakproof/u);
  assert.match(runner, /AND p\.proconfig IS NULL/u);
  assert.match(runner, /AND p\.protrftypes IS NULL/u);
  assert.match(runner, /AND p\.prosupport = 0/u);
  assert.match(runner, /resolved_extension_languages AS/u);
  assert.match(runner, /AND l\.lanispl/u);
  assert.match(runner, /AND l\.lanpltrusted/u);
  assert.match(runner, /l\.lanplcallfoid = call_handler\.oid/u);
  assert.match(runner, /l\.laninline = inline_handler\.oid/u);
  assert.match(runner, /l\.lanvalidator = validator\.oid/u);
  assert.match(runner, /l\.lanowner = e\.extowner/u);
  assert.match(runner, /AND l\.lanacl IS NULL/u);
  assert.match(
    runner,
    /PGOPTIONS="-c default_transaction_read_only=on -c search_path=pg_catalog,pg_temp"/u,
  );
  assert.match(runner, /actual_extension_addresses AS/u);
  assert.match(runner, /expected_extension_addresses AS/u);
  assert.match(runner, /extension_inventory_violations AS/u);
  assert.equal(
    (runner.match(/FROM actual_extension_addresses AS actual/gu) ?? []).length,
    2,
  );
  assert.equal(
    (runner.match(/FROM expected_extension_addresses AS expected/gu) ?? []).length,
    2,
  );
  assert.match(
    runner,
    /d\.refclassid = 'pg_catalog\.pg_extension'::pg_catalog\.regclass/u,
  );
  assert.match(runner, /d\.deptype = 'e'/u);
  assert.match(runner, /d\.objsubid/u);
  assert.match(runner, /allowed_container_schemas AS/u);
  assert.match(runner, /n\.nspname = 'extensions'/u);
  assert.match(runner, /n\.nspname = 'public'/u);
  assert.match(runner, /n\.nspowner = 'postgres'::pg_catalog\.regrole/u);
  assert.match(
    runner,
    /n\.nspowner = 'pg_database_owner'::pg_catalog\.regrole/u,
  );
  assert.match(runner, /schema_objects\(classid, objid, nspoid\) AS/u);
  for (const catalog of [
    "pg_class",
    "pg_proc",
    "pg_type",
    "pg_collation",
    "pg_conversion",
    "pg_operator",
    "pg_opclass",
    "pg_opfamily",
    "pg_statistic_ext",
    "pg_ts_parser",
    "pg_ts_dict",
    "pg_ts_template",
    "pg_ts_config",
    "pg_constraint",
    "pg_attrdef",
    "pg_rewrite",
    "pg_trigger",
    "pg_policy",
  ]) {
    assert.match(
      runner,
      new RegExp(`'pg_catalog\\.${catalog}'::pg_catalog\\.regclass`, "u"),
    );
  }
  assert.match(runner, /schema_object_violations AS/u);
  assert.match(runner, /allowed\.classid = object\.classid/u);
  assert.match(runner, /allowed\.objid = object\.objid/u);
  assert.match(runner, /allowed\.objsubid = 0/u);
  assert.match(runner, /top_level_object_violations AS/u);
  for (const catalog of [
    "pg_language",
    "pg_cast",
    "pg_am",
    "pg_transform",
    "pg_foreign_data_wrapper",
    "pg_foreign_server",
    "pg_user_mapping",
    "pg_default_acl",
    "pg_event_trigger",
    "pg_largeobject_metadata",
    "pg_publication",
    "pg_publication_rel",
    "pg_publication_namespace",
    "pg_subscription",
    "pg_subscription_rel",
  ]) {
    assert.match(runner, new RegExp(`pg_catalog\\.${catalog}`, "u"));
  }
  assert.match(runner, /l\.oid NOT IN \([\s\S]+?12::pg_catalog\.oid/u);
  assert.equal(
    (runner.match(/oid >= 16384::pg_catalog\.oid/gu) ?? []).length,
    4,
  );
  assert.match(runner, /s\.subdbid = \([\s\S]+?pg_catalog\.current_database\(\)/u);
  assert.doesNotMatch(runner, /pg_replication_origin/u);
  assert.doesNotMatch(runner, /allowed_extension_objects/u);
  assert.match(runner, /WITH RECURSIVE preinstalled_extensions AS/u);
  assert.match(runner, /preinstalled_extension_addresses\(classid, objid, objsubid\) AS/u);
  assert.match(runner, /d\.deptype IN \('i', 'a', 'P', 'S'\)/u);
  assert.doesNotMatch(runner, /t\.typtype IN \('d', 'e', 'r'\)/u);
});

test("extension TOC policy disables only receipt-archived host schemas and keeps CREATE EXTENSION active", () => {
  const filtered = filterExtensionHostSchemaToc(
    SYNTHETIC_ARCHIVE_TOC,
    SYNTHETIC_AUTHORIZATION_REQUIRED_EXTENSIONS,
  );

  assert.equal(filtered, SYNTHETIC_RESTORE_TOC);
  assert.match(filtered, /^;10; 2615 16392 SCHEMA - extensions postgres$/mu);
  assert.match(filtered, /^;20; 2615 16490 SCHEMA - vault supabase_admin$/mu);
  for (const extensionName of [
    "pg_stat_statements",
    "pgcrypto",
    "supabase_vault",
    "uuid-ossp",
  ]) {
    assert.match(
      filtered,
      new RegExp(`^[1-9][0-9]*; 3079 [1-9][0-9]* EXTENSION - ${extensionName} `, "mu"),
    );
    assert.doesNotMatch(
      filtered,
      new RegExp(`^;[1-9][0-9]*; 3079 [1-9][0-9]* EXTENSION - ${extensionName}`, "mu"),
    );
  }

  assert.throws(
    () => filterExtensionHostSchemaToc(
      SYNTHETIC_ARCHIVE_TOC,
      SYNTHETIC_AUTHORIZATION_REQUIRED_EXTENSIONS.map((descriptor, index) =>
        index === 0 ? { ...descriptor, unexpected: true } : descriptor
      ),
    ),
    /extension_receipt_policy_invalid/u,
  );
  assert.throws(
    () => filterExtensionHostSchemaToc(
      SYNTHETIC_ARCHIVE_TOC.replace(
        VAULT_SCHEMA_TOC_ENTRY,
        "20; 2615 16490 SCHEMA - vault postgres",
      ),
      SYNTHETIC_AUTHORIZATION_REQUIRED_EXTENSIONS,
    ),
    /dump_extension_schema_entry_ambiguous/u,
  );
  for (const invalidDescriptor of [
    { version: "" },
    { relocatable: "true" },
  ]) {
    assert.throws(
      () => filterExtensionHostSchemaToc(
        SYNTHETIC_ARCHIVE_TOC,
        SYNTHETIC_AUTHORIZATION_REQUIRED_EXTENSIONS.map(
          (descriptor, index) => index === 0
            ? { ...descriptor, ...invalidDescriptor }
            : descriptor,
        ),
      ),
      /extension_receipt_policy_invalid/u,
    );
  }
  for (const requiredExtension of ["pgcrypto", "uuid-ossp"]) {
    assert.throws(
      () => filterExtensionHostSchemaToc(
        SYNTHETIC_ARCHIVE_TOC.replace(
          new RegExp(
            `^[1-9][0-9]*; 3079 [1-9][0-9]* EXTENSION - ${requiredExtension} *\\n`,
            "mu",
          ),
          "",
        ),
        SYNTHETIC_AUTHORIZATION_REQUIRED_EXTENSIONS,
      ),
      /dump_extension_entry_missing/u,
    );
  }
  assert.throws(
    () => filterExtensionHostSchemaToc(
      SYNTHETIC_ARCHIVE_TOC.replace(
        "23; 3079 16510 EXTENSION - uuid-ossp ",
        "23; 3079 16510 EXTENSION - uuid-ossp \n24; 3079 13563 EXTENSION - plpgsql ",
      ),
      SYNTHETIC_AUTHORIZATION_REQUIRED_EXTENSIONS,
    ),
    /dump_extension_builtin_entry_unexpected/u,
  );
});

test("isolated restore target passes only with both boundaries and exact target binding", () => {
  const result = evaluateRestoreTarget(safeEnvironment());

  assert.equal(result.ok, true);
  assert.equal(result.environmentBoundaryOk, true);
  assert.equal(result.restoreEnabled, true);
  assert.equal(result.acknowledgementConfirmed, true);
  assert.equal(result.targetConfirmed, true);
  assert.equal(result.actualTargetCanonical, true);
  assert.equal(result.productionHostSeparated, true);
  assert.equal(result.productionSeparated, true);
  assert.equal(result.hiddenTargetOverridesClear, true);
});

test("restore target normalization accepts canonical hosts and valid ports only", () => {
  assert.equal(normalizeHost("DB.Example.COM."), "db.example.com");
  assert.equal(normalizeHost("[2001:db8::1]"), "2001:db8::1");
  assert.equal(
    normalizeHost("2001:0db8:0:0:0:0:0:1"),
    "2001:db8::1",
  );
  assert.equal(normalizeHost("127.1"), null);
  assert.equal(normalizeHost("127.000.000.001"), null);
  assert.equal(normalizeHost("0x7f.1"), null);
  assert.equal(normalizeHost("db-one,db-two"), null);
  assert.equal(normalizeHost("postgresql://db.example.com"), null);
  assert.equal(normalizePort("05432"), "5432");
  assert.equal(normalizePort("0"), null);
  assert.equal(normalizePort("65536"), null);
});

test("shared write boundary remains mandatory for restore drills", () => {
  const result = evaluateRestoreTarget(
    safeEnvironment({
      FANMIND_RUNTIME_ENVIRONMENT: "production",
      NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
      NEXT_PUBLIC_SUPABASE_URL: "https://productionref123.supabase.co",
      FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionref123",
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.environmentBoundaryOk, false);
  assert.match(result.errors.join("\n"), /Umgebungsgrenze/);
  assert.match(result.errors.join("\n"), /staging oder test/);
  assert.match(result.errors.join("\n"), /Production-Supabase-Projekt/);
});

test("exact Production database tuple is always rejected", () => {
  const result = evaluateRestoreTarget(
    safeEnvironment({
      PGHOST: "db.production.internal",
      PGPORT: "6543",
      PGDATABASE: "postgres",
      PGUSER: "postgres.productionref123",
      FANMIND_RESTORE_TARGET_DB_HOST: "db.production.internal",
      FANMIND_RESTORE_TARGET_DB_PORT: "6543",
      FANMIND_RESTORE_TARGET_DB_NAME: "postgres",
      FANMIND_RESTORE_TARGET_DB_USER: "postgres.productionref123",
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.targetConfirmed, true);
  assert.equal(result.productionHostSeparated, false);
  assert.equal(result.productionSeparated, false);
  assert.match(result.errors.join("\n"), /Production-Datenbankhost/);
});

test("every target on the Production database host is rejected independently of tuple fields", () => {
  const result = evaluateRestoreTarget(
    safeEnvironment({
      PGHOST: "db.production.internal",
      PGPORT: "7432",
      PGDATABASE: "fanmind_restore_isolated",
      PGUSER: "restore_only_operator",
      FANMIND_RESTORE_TARGET_DB_HOST: "db.production.internal",
      FANMIND_RESTORE_TARGET_DB_PORT: "7432",
      FANMIND_RESTORE_TARGET_DB_NAME: "fanmind_restore_isolated",
      FANMIND_RESTORE_TARGET_DB_USER: "restore_only_operator",
    }),
  );

  assert.equal(result.targetConfirmed, true);
  assert.equal(result.productionHostSeparated, false);
  assert.equal(result.productionSeparated, false);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Production-Datenbankhost/);
});

test("equivalent numeric Production endpoints cannot bypass host separation", () => {
  const cases = [
    ["127.1", "127.0.0.1"],
    ["127.000.000.001", "127.0.0.1"],
    ["2001:db8::1", "2001:0db8:0:0:0:0:0:1"],
  ];

  for (const [actualHost, productionHost] of cases) {
    const result = evaluateRestoreTarget(
      safeEnvironment({
        PGHOST: actualHost,
        FANMIND_RESTORE_TARGET_DB_HOST: actualHost,
        FANMIND_PRODUCTION_DB_HOST: productionHost,
      }),
    );
    assert.equal(result.ok, false, `${actualHost} -> ${productionHost}`);
    assert.equal(
      result.productionSeparated,
      false,
      `${actualHost} -> ${productionHost}`,
    );
  }
});

test("actual pg_restore values must already equal their canonical checked form", () => {
  const cases = [
    ["PGHOST", "Restore-DB.Internal."],
    ["PGPORT", "05432"],
    ["PGDATABASE", "fanmind_restore "],
    ["PGUSER", " restore_operator"],
  ];

  for (const [name, value] of cases) {
    const result = evaluateRestoreTarget(safeEnvironment({ [name]: value }));
    assert.equal(result.targetConfirmed, true, name);
    assert.equal(result.actualTargetValid, true, name);
    assert.equal(result.actualTargetCanonical, false, name);
    assert.equal(result.ok, false, name);
    assert.match(result.errors.join("\n"), /bereits kanonisch/, name);
  }
});

test("every actual pg_restore target field must match the explicit confirmation", () => {
  const cases = [
    ["PGHOST", "other-db.internal"],
    ["PGPORT", "6432"],
    ["PGDATABASE", "other_restore"],
    ["PGUSER", "other_operator"],
  ];

  for (const [name, value] of cases) {
    const result = evaluateRestoreTarget(safeEnvironment({ [name]: value }));
    assert.equal(result.ok, false, name);
    assert.equal(result.targetConfirmed, false, name);
    assert.match(result.errors.join("\n"), /stimmen nicht exakt/, name);
  }
});

test("connection strings, multi-host routing and hidden libpq target overrides fail closed", () => {
  const connectionString = evaluateRestoreTarget(
    safeEnvironment({
      PGDATABASE:
        "postgresql://restore_operator@example.invalid/fanmind_restore",
    }),
  );
  assert.equal(connectionString.ok, false);
  assert.equal(connectionString.actualTargetValid, false);
  assert.match(connectionString.errors.join("\n"), /Connection-Strings/);

  const hiddenOverride = evaluateRestoreTarget(
    safeEnvironment({
      PGHOSTADDR: "203.0.113.10",
      PGSERVICE: "hidden-target",
    }),
  );
  assert.equal(hiddenOverride.ok, false);
  assert.equal(hiddenOverride.hiddenTargetOverridesClear, false);
  assert.match(hiddenOverride.errors.join("\n"), /PGHOSTADDR, PGSERVICE/);

  const sharedPooler = evaluateRestoreTarget(
    safeEnvironment({
      PGHOST: "aws-0-eu-central-1.pooler.supabase.com",
      FANMIND_RESTORE_TARGET_DB_HOST:
        "aws-0-eu-central-1.pooler.supabase.com",
    }),
  );
  assert.equal(sharedPooler.ok, false);
  assert.equal(sharedPooler.sharedSupabasePooler, true);
  assert.match(sharedPooler.errors.join("\n"), /Shared Supabase-Pooler/);
});

test("hosted Supabase databases are rejected even when the app project matches", () => {
  const matching = evaluateRestoreTarget(
    safeEnvironment({
      PGHOST: "db.restoretestref1.supabase.co",
      FANMIND_RESTORE_TARGET_DB_HOST:
        "db.restoretestref1.supabase.co",
    }),
  );
  assert.equal(matching.ok, false);
  assert.equal(matching.directSupabaseProjectBound, true);
  assert.equal(matching.managedSupabaseTarget, true);
  assert.match(matching.errors.join("\n"), /Gehostete Supabase-Datenbanken/u);

  const mismatched = evaluateRestoreTarget(
    safeEnvironment({
      PGHOST: "db.otherprojectref.supabase.co",
      FANMIND_RESTORE_TARGET_DB_HOST:
        "db.otherprojectref.supabase.co",
    }),
  );
  assert.equal(mismatched.ok, false);
  assert.equal(mismatched.directSupabaseProjectBound, false);
  assert.equal(mismatched.managedSupabaseTarget, true);
  assert.match(mismatched.errors.join("\n"), /Zielprojektreferenz/);
});

test("Production comparison and protected passfile are mandatory without PGPASSWORD", () => {
  const missingComparison = evaluateRestoreTarget(
    safeEnvironment({
      FANMIND_PRODUCTION_DB_HOST: "",
      FANMIND_PRODUCTION_DB_PORT: "",
      FANMIND_PRODUCTION_DB_NAME: "",
      FANMIND_PRODUCTION_DB_USER: "",
      PGPASSFILE: "",
      PGPASSWORD: "must-never-be-logged",
    }),
  );

  assert.equal(missingComparison.ok, false);
  assert.equal(missingComparison.productionTargetComplete, false);
  assert.equal(missingComparison.passfileConfigured, false);
  assert.equal(missingComparison.passwordInEnvironment, true);
  assert.match(missingComparison.errors.join("\n"), /Production-Vergleich/);
  assert.match(missingComparison.errors.join("\n"), /PGPASSFILE/);
  assert.match(missingComparison.errors.join("\n"), /PGPASSWORD/);

  const relativePassfile = evaluateRestoreTarget(
    safeEnvironment({ PGPASSFILE: "relative/restore.pgpass" }),
  );
  assert.equal(relativePassfile.ok, false);
  assert.equal(relativePassfile.passfileAbsolute, false);
  assert.match(relativePassfile.errors.join("\n"), /absoluter Pfad/);
});

test("restore target requires certificate-verified TLS without GSS fallback", () => {
  const cases = [
    ["PGSSLMODE", "require"],
    ["PGSSLROOTCERT", "relative/restore-ca.pem"],
    ["PGGSSENCMODE", "prefer"],
  ];

  for (const [name, value] of cases) {
    const result = evaluateRestoreTarget(safeEnvironment({ [name]: value }));
    assert.equal(result.ok, false, name);
    assert.equal(result.tlsVerified, false, name);
  }
});

test("CLI reports only redacted gate state", async () => {
  const environment = {
    ...process.env,
    ...safeEnvironment(),
  };
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [scriptPath],
    { env: environment },
  );
  const output = `${stdout}\n${stderr}`;

  assert.match(output, /ENVIRONMENT_BOUNDARY=ok/);
  assert.match(output, /RESTORE_TARGET=confirmed/);
  assert.match(output, /RESTORE_INPUT=canonical/);
  assert.match(output, /PRODUCTION_TARGET=separate/);
  assert.match(output, /LIBPQ_TARGET_OVERRIDES=clear/);
  assert.match(output, /DATABASE_PASSWORD_SOURCE=passfile/);
  assert.match(output, /DATABASE_TLS=verify-full/);
  assert.match(output, /SECRETS_WURDEN_NICHT_AUSGEGEBEN=true/);
  assert.match(output, /RESTORE_TARGET_BOUNDARY=OK/);

  for (const value of [
    "restore-db.internal",
    "fanmind_restore",
    "restore_operator",
    "db.production.internal",
    "postgres.productionref123",
    "/secure/keys/restore.pgpass",
  ]) {
    assert.doesNotMatch(output, new RegExp(value.replaceAll(".", "\\.")));
  }
});

test("failing CLI output remains redacted", async () => {
  const sensitiveValues = [
    "sensitive-restore-host.internal",
    "sensitive_restore_database",
    "sensitive_restore_user",
    "/sensitive/passfiles/restore.pgpass",
    "sensitive-database-password",
  ];
  const environment = {
    ...process.env,
    ...safeEnvironment({
      PGHOST: sensitiveValues[0],
      PGDATABASE: sensitiveValues[1],
      PGUSER: sensitiveValues[2],
      PGPASSFILE: sensitiveValues[3],
      PGPASSWORD: sensitiveValues[4],
    }),
  };

  await assert.rejects(
    execFileAsync(process.execPath, [scriptPath], { env: environment }),
    (error) => {
      const output = `${String(error.stdout)}\n${String(error.stderr)}`;
      assert.match(output, /RESTORE_TARGET_BOUNDARY=OK|RESTORE_ERROR=/);
      assert.doesNotMatch(output, /RESTORE_TARGET_BOUNDARY=OK/);
      assert.match(output, /SECRETS_WURDEN_NICHT_AUSGEGEBEN=true/);
      for (const value of sensitiveValues) {
        assert.doesNotMatch(
          output,
          new RegExp(value.replaceAll(".", "\\.").replaceAll("/", "\\/")),
        );
      }
      return true;
    },
  );
});

test("restore runner freezes the checked target and passes only explicit connection arguments", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-restore-runner-test-"));
  try {
    const dumpPath = join(root, "fanmind-database-test.dump");
    const fakeRestorePath = join(root, "fake-pg-restore.sh");
    const capturePath = join(root, "capture.txt");
    const passfilePath = join(root, "restore.pgpass");
    const listMarkerPath = join(root, "list-validated.txt");
    const tocCapturePath = join(root, "restore-toc.txt");
    const tocMetadataPath = join(root, "restore-toc-metadata.txt");
    const emptyQueryMarkerPath = join(root, "empty-query.txt");
    await writeFile(dumpPath, "synthetic-dump");
    await chmod(dumpPath, 0o600);
    await writeFile(passfilePath, "synthetic-password-file");
    await chmod(passfilePath, 0o600);
    await writeFile(
      fakeRestorePath,
      [
        "#!/usr/bin/env bash",
        "set -Eeuo pipefail",
        "if [[ \"${1:-}\" == \"--list\" ]]; then",
        "  printf '%s\\n' \"${2:-}\" > \"$FANMIND_TEST_LIST_MARKER_PATH\"",
        "  printf '%s' \"$FANMIND_TEST_ARCHIVE_TOC\"",
        "  exit 0",
        "fi",
        "[[ -s \"$FANMIND_TEST_EMPTY_QUERY_MARKER_PATH\" ]]",
        "write_dump_path=\"${@: -1}\"",
        "list_dump_path=\"$(cat \"$FANMIND_TEST_LIST_MARKER_PATH\")\"",
        "[[ \"$list_dump_path\" == \"$write_dump_path\" ]]",
        "restore_toc_path=''",
        "for ((argument_index = 1; argument_index <= $#; argument_index++)); do",
        "  if [[ \"${!argument_index}\" == \"--use-list\" ]]; then",
        "    value_index=$((argument_index + 1))",
        "    restore_toc_path=\"${!value_index}\"",
        "  fi",
        "done",
        "[[ \"$restore_toc_path\" == /proc/self/fd/* ]]",
        "cat \"$restore_toc_path\" > \"$FANMIND_TEST_TOC_CAPTURE_PATH\"",
        "{",
        "  printf 'MODE=%s\\n' \"$(stat -Lc '%a' \"$restore_toc_path\")\"",
        "  printf 'TARGET=%s\\n' \"$(readlink \"$restore_toc_path\")\"",
        "} > \"$FANMIND_TEST_TOC_METADATA_PATH\"",
        "{",
        "  printf 'ARGS='",
        "  printf '%q ' \"$@\"",
        "  printf '\\n'",
        "  printf 'PGHOST_SET=%s\\n' \"${PGHOST+x}\"",
        "  printf 'PGPORT_SET=%s\\n' \"${PGPORT+x}\"",
        "  printf 'PGDATABASE_SET=%s\\n' \"${PGDATABASE+x}\"",
        "  printf 'PGUSER_SET=%s\\n' \"${PGUSER+x}\"",
        "  printf 'PGHOSTADDR_SET=%s\\n' \"${PGHOSTADDR+x}\"",
        "  printf 'PGSERVICE_SET=%s\\n' \"${PGSERVICE+x}\"",
        "  printf 'PGSERVICEFILE_SET=%s\\n' \"${PGSERVICEFILE+x}\"",
        "  printf 'PGPASSWORD_SET=%s\\n' \"${PGPASSWORD+x}\"",
        "  printf 'PGPASSFILE=%s\\n' \"$PGPASSFILE\"",
        "  printf 'PGSSLMODE=%s\\n' \"$PGSSLMODE\"",
        "  printf 'PGGSSENCMODE=%s\\n' \"$PGGSSENCMODE\"",
        "  printf 'PGSSLROOTCERT=%s\\n' \"$PGSSLROOTCERT\"",
        "} > \"$FANMIND_TEST_CAPTURE_PATH\"",
        "",
      ].join("\n"),
    );
    await chmod(fakeRestorePath, 0o755);
    const runnerEnvironment = await restoreRunnerEnvironment(root, dumpPath);

    const { stdout, stderr } = await execFileAsync(
      "bash",
      [runnerPath, dumpPath],
      {
        env: {
          ...process.env,
          ...safeEnvironment({ PGPASSFILE: passfilePath }),
          ...runnerEnvironment,
          FANMIND_PG_RESTORE_BIN: fakeRestorePath,
          FANMIND_TEST_CAPTURE_PATH: capturePath,
          FANMIND_TEST_LIST_MARKER_PATH: listMarkerPath,
          FANMIND_TEST_TOC_CAPTURE_PATH: tocCapturePath,
          FANMIND_TEST_TOC_METADATA_PATH: tocMetadataPath,
          FANMIND_TEST_EMPTY_QUERY_MARKER_PATH: emptyQueryMarkerPath,
        },
      },
    );
    const output = `${stdout}\n${stderr}`;
    const capture = await readFile(capturePath, "utf8");
    const tocCapture = await readFile(tocCapturePath, "utf8");
    const tocMetadata = await readFile(tocMetadataPath, "utf8");
    const emptyQueryCapture = await readFile(emptyQueryMarkerPath, "utf8");

    assert.match(output, /RESTORE_TARGET_BOUNDARY=OK/);
    const validatedSnapshotPath = (await readFile(listMarkerPath, "utf8")).trim();
    assert.match(validatedSnapshotPath, /fanmind-restore\.[^/]+\/database\.dump$/u);
    assert.doesNotMatch(validatedSnapshotPath, new RegExp(dumpPath.replaceAll(".", "\\.")));
    assert.match(
      capture,
      /ARGS=--exit-on-error --single-transaction --use-list \/proc\/self\/fd\/[0-9]+ --no-password --host restore-db\.internal --port 5432 --username restore_operator --dbname fanmind_restore /,
    );
    assert.doesNotMatch(capture, /--no-owner|--no-privileges/u);
    assert.equal(tocCapture, SYNTHETIC_RESTORE_TOC);
    assert.match(tocMetadata, /^MODE=400$/mu);
    assert.match(
      tocMetadata,
      /TARGET=\/[^\n]*fanmind-restore\.[^/]+\/database\.restore\.toc \(deleted\)/u,
    );
    assert.equal((capture.match(/--use-list/gu) ?? []).length, 1);
    assert.doesNotMatch(capture, new RegExp(`${dumpPath.replaceAll(".", "\\.")}\\s`));
    assert.match(capture, /fanmind-restore\.[^/]+\/database\.dump\s/u);
    assert.match(
      emptyQueryCapture,
      /ARGS=--no-psqlrc --no-align --tuples-only --quiet --set ON_ERROR_STOP=1 --no-password --host restore-db\.internal --port 5432 --username restore_operator --dbname fanmind_restore --command /u,
    );
    const snapshotPassfileMatch = capture.match(/^PGPASSFILE=(.+)$/mu);
    assert.ok(snapshotPassfileMatch);
    const snapshotPassfilePath = snapshotPassfileMatch[1];
    assert.match(snapshotPassfilePath, /fanmind-restore\.[^/]+\/restore\.pgpass$/u);
    assert.notEqual(snapshotPassfilePath, passfilePath);
    assert.equal(dirname(snapshotPassfilePath), dirname(validatedSnapshotPath));
    assert.match(capture, /PGSSLMODE=verify-full/u);
    assert.match(capture, /PGGSSENCMODE=disable/u);
    const snapshotCaMatch = capture.match(/^PGSSLROOTCERT=(.+)$/mu);
    assert.ok(snapshotCaMatch);
    assert.match(
      snapshotCaMatch[1],
      /fanmind-restore\.[^/]+\/restore-ca\.pem$/u,
    );
    assert.notEqual(snapshotCaMatch[1], runnerEnvironment.PGSSLROOTCERT);
    assert.equal(dirname(snapshotCaMatch[1]), dirname(validatedSnapshotPath));
    for (const name of [
      "PGHOST",
      "PGPORT",
      "PGDATABASE",
      "PGUSER",
      "PGHOSTADDR",
      "PGSERVICE",
      "PGSERVICEFILE",
      "PGPASSWORD",
    ]) {
      assert.match(capture, new RegExp(`${name}_SET=\\n`));
    }
    const runnerReceipt = JSON.parse(
      await readFile(
        runnerEnvironment.FANMIND_RESTORE_RUNNER_RECEIPT_PATH,
        "utf8",
      ),
    );
    assert.equal(runnerReceipt.databaseRestore, "passed");
    assert.equal(runnerReceipt.emptyTargetObjectCount, 0);
    assert.equal(runnerReceipt.singleTransaction, true);
    assert.equal(runnerReceipt.databasePrivilegesRestore, "passed");
    assert.equal(runnerReceipt.databaseOwnershipRestore, "passed");
    assert.equal(
      runnerReceipt.databaseAuthorizationFingerprintSha256,
      SYNTHETIC_AUTHORIZATION_FINGERPRINT,
    );
    assert.equal(
      runnerReceipt.databaseAuthorizationRoleFingerprintSha256,
      SYNTHETIC_AUTHORIZATION_ROLE_FINGERPRINT,
    );
    assert.equal(
      runnerReceipt.databaseAuthorizationRoleRecordCount,
      SYNTHETIC_AUTHORIZATION_ROLE_RECORD_COUNT,
    );
    assert.equal(
      runnerReceipt.databaseAuthorizationContainerFingerprintSha256,
      SYNTHETIC_AUTHORIZATION_CONTAINER_FINGERPRINT,
    );
    assert.equal(
      runnerReceipt.databaseAuthorizationContainerRecordCount,
      SYNTHETIC_AUTHORIZATION_CONTAINER_RECORD_COUNT,
    );
    const databasePostcheckReceipt = JSON.parse(
      await readFile(
        runnerEnvironment.FANMIND_RESTORE_DATABASE_POSTCHECK_RECEIPT_PATH,
        "utf8",
      ),
    );
    assert.equal(databasePostcheckReceipt.databasePostcheck, "passed");
    assert.equal(databasePostcheckReceipt.existingTableCount, 5);
    assert.equal(databasePostcheckReceipt.rlsEnabledTableCount, 5);
    assert.equal(databasePostcheckReceipt.policyCoveredTableCount, 5);
    assert.equal(
      databasePostcheckReceipt.databaseAuthorizationPostcheck,
      "passed",
    );
    assert.equal(databasePostcheckReceipt.coreTableAppPrivileges, "passed");
    assert.equal(
      databasePostcheckReceipt.securityDefinerExecutionBoundary,
      "passed",
    );
    assert.equal(
      databasePostcheckReceipt.databaseAuthorizationRoleFingerprintSha256,
      SYNTHETIC_AUTHORIZATION_ROLE_FINGERPRINT,
    );
    assert.equal(
      databasePostcheckReceipt.databaseAuthorizationContainerFingerprintSha256,
      SYNTHETIC_AUTHORIZATION_CONTAINER_FINGERPRINT,
    );
    await assert.rejects(access(dirname(validatedSnapshotPath)), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restore runner proves an empty target before writing or creating a receipt", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-restore-empty-target-test-"));
  try {
    const dumpPath = join(root, "fanmind-database-test.dump");
    const fakeRestorePath = join(root, "fake-pg-restore.sh");
    const passfilePath = join(root, "restore.pgpass");
    const writeInvokedPath = join(root, "write-invoked.txt");
    await writeFile(dumpPath, "synthetic-dump");
    await chmod(dumpPath, 0o600);
    await writeFile(passfilePath, "synthetic-password-file");
    await chmod(passfilePath, 0o600);
    await writeFile(
      fakeRestorePath,
      [
        "#!/usr/bin/env bash",
        "set -Eeuo pipefail",
        "if [[ \"${1:-}\" == \"--list\" ]]; then",
        "  printf '%s' \"$FANMIND_TEST_ARCHIVE_TOC\"",
        "  exit 0",
        "fi",
        "printf 'write-invoked\\n' > \"$FANMIND_TEST_WRITE_INVOKED_PATH\"",
        "",
      ].join("\n"),
    );
    await chmod(fakeRestorePath, 0o755);
    const runnerEnvironment = await restoreRunnerEnvironment(root, dumpPath, {
      FANMIND_TEST_EMPTY_TARGET_RESULT: "1",
    });

    await assert.rejects(
      execFileAsync("bash", [runnerPath, dumpPath], {
        env: {
          ...process.env,
          ...safeEnvironment({ PGPASSFILE: passfilePath }),
          ...runnerEnvironment,
          FANMIND_PG_RESTORE_BIN: fakeRestorePath,
          FANMIND_TEST_WRITE_INVOKED_PATH: writeInvokedPath,
        },
      }),
      (error) => {
        assert.match(String(error.stderr), /restore_target_not_empty/u);
        return true;
      },
    );
    await assert.rejects(readFile(writeInvokedPath, "utf8"), /ENOENT/u);
    await assert.rejects(
      readFile(
        runnerEnvironment.FANMIND_RESTORE_RUNNER_RECEIPT_PATH,
        "utf8",
      ),
      /ENOENT/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restore runner rejects a mismatched role graph before the target query or write", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-restore-role-graph-test-"));
  try {
    const dumpPath = join(root, "fanmind-database-test.dump");
    const fakeRestorePath = join(root, "fake-pg-restore.sh");
    const passfilePath = join(root, "restore.pgpass");
    const queryMarkerPath = join(root, "query-invoked.txt");
    const writeMarkerPath = join(root, "write-invoked.txt");
    await writeFile(dumpPath, "synthetic-dump", { mode: 0o600 });
    await writeFile(passfilePath, "synthetic-password-file", { mode: 0o600 });
    await writeFile(
      fakeRestorePath,
      [
        "#!/usr/bin/env bash",
        "set -Eeuo pipefail",
        "if [[ \"${1:-}\" == \"--list\" ]]; then",
        "  printf '%s' \"$FANMIND_TEST_ARCHIVE_TOC\"",
        "  exit 0",
        "fi",
        "printf 'write-invoked\\n' > \"$FANMIND_TEST_WRITE_MARKER_PATH\"",
        "",
      ].join("\n"),
      { mode: 0o755 },
    );
    const runnerEnvironment = await restoreRunnerEnvironment(root, dumpPath, {
      FANMIND_TEST_ROLE_CHECK_HEX: hexJson({
        server_version_num: 170006,
        required_role_count: SYNTHETIC_AUTHORIZATION_REQUIRED_ROLES.length,
        present_role_count: SYNTHETIC_AUTHORIZATION_REQUIRED_ROLES.length,
        component_roles: [
          ...SYNTHETIC_AUTHORIZATION_REQUIRED_ROLES,
          "unexpected_login_role",
        ],
        role_fingerprint_sha256: "9".repeat(64),
        role_record_count: SYNTHETIC_AUTHORIZATION_ROLE_RECORD_COUNT + 2,
        database_container_fingerprint_sha256:
          SYNTHETIC_AUTHORIZATION_CONTAINER_FINGERPRINT,
        database_container_record_count:
          SYNTHETIC_AUTHORIZATION_CONTAINER_RECORD_COUNT,
        restore_user_superuser: true,
        restore_user_login: true,
        restore_user_outside_component: true,
        outside_component_login_role_count: 1,
        outside_component_superuser_role_count: 1,
      }),
    });

    await assert.rejects(
      execFileAsync("bash", [runnerPath, dumpPath], {
        env: {
          ...process.env,
          ...safeEnvironment({ PGPASSFILE: passfilePath }),
          ...runnerEnvironment,
          FANMIND_PG_RESTORE_BIN: fakeRestorePath,
          FANMIND_TEST_EMPTY_QUERY_MARKER_PATH: queryMarkerPath,
          FANMIND_TEST_WRITE_MARKER_PATH: writeMarkerPath,
        },
      }),
      (error) => {
        assert.match(
          `${String(error.stdout)}\n${String(error.stderr)}`,
          /database_authorization_preflight_failed/u,
        );
        return true;
      },
    );
    await assert.rejects(readFile(queryMarkerPath, "utf8"), /ENOENT/u);
    await assert.rejects(readFile(writeMarkerPath, "utf8"), /ENOENT/u);
    await assert.rejects(
      readFile(runnerEnvironment.FANMIND_RESTORE_RUNNER_RECEIPT_PATH, "utf8"),
      /ENOENT/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restore runner rejects a receipt-mismatched extension inventory before the empty-target query or write", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-restore-extension-contract-test-"));
  try {
    const dumpPath = join(root, "fanmind-database-test.dump");
    const fakeRestorePath = join(root, "fake-pg-restore.sh");
    const passfilePath = join(root, "restore.pgpass");
    const queryMarkerPath = join(root, "query-invoked.txt");
    const writeMarkerPath = join(root, "write-invoked.txt");
    await writeFile(dumpPath, "synthetic-dump", { mode: 0o600 });
    await writeFile(passfilePath, "synthetic-password-file", { mode: 0o600 });
    await writeFile(
      fakeRestorePath,
      [
        "#!/usr/bin/env bash",
        "set -Eeuo pipefail",
        "if [[ \"${1:-}\" == \"--list\" ]]; then",
        "  printf '%s' \"$FANMIND_TEST_ARCHIVE_TOC\"",
        "  exit 0",
        "fi",
        "printf 'write-invoked\\n' > \"$FANMIND_TEST_WRITE_MARKER_PATH\"",
        "",
      ].join("\n"),
      { mode: 0o755 },
    );
    const runnerEnvironment = await restoreRunnerEnvironment(root, dumpPath, {
      FANMIND_TEST_ROLE_CHECK_HEX: hexJson(
        syntheticAuthorizationRoleCheck({
          extension_fingerprint_sha256: "5".repeat(64),
        }),
      ),
    });

    await assert.rejects(
      execFileAsync("bash", [runnerPath, dumpPath], {
        env: {
          ...process.env,
          ...safeEnvironment({ PGPASSFILE: passfilePath }),
          ...runnerEnvironment,
          FANMIND_PG_RESTORE_BIN: fakeRestorePath,
          FANMIND_TEST_EMPTY_QUERY_MARKER_PATH: queryMarkerPath,
          FANMIND_TEST_WRITE_MARKER_PATH: writeMarkerPath,
        },
      }),
      (error) => {
        const output = `${String(error.stdout)}\n${String(error.stderr)}`;
        assert.match(output, /database_authorization_preflight_failed/u);
        assert.doesNotMatch(output, /supabase_vault|pg_stat_statements|555555/u);
        return true;
      },
    );
    await assert.rejects(readFile(queryMarkerPath, "utf8"), /ENOENT/u);
    await assert.rejects(readFile(writeMarkerPath, "utf8"), /ENOENT/u);
    await assert.rejects(
      readFile(runnerEnvironment.FANMIND_RESTORE_RUNNER_RECEIPT_PATH, "utf8"),
      /ENOENT/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restore runner rejects a mismatched database container or principal boundary before writes", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-restore-db-container-test-"));
  try {
    const dumpPath = join(root, "fanmind-database-test.dump");
    const fakeRestorePath = join(root, "fake-pg-restore.sh");
    const passfilePath = join(root, "restore.pgpass");
    const queryMarkerPath = join(root, "query-invoked.txt");
    const writeMarkerPath = join(root, "write-invoked.txt");
    await writeFile(dumpPath, "synthetic-dump", { mode: 0o600 });
    await writeFile(passfilePath, "synthetic-password-file", { mode: 0o600 });
    await writeFile(
      fakeRestorePath,
      [
        "#!/usr/bin/env bash",
        "set -Eeuo pipefail",
        "if [[ \"${1:-}\" == \"--list\" ]]; then",
        "  printf '%s' \"$FANMIND_TEST_ARCHIVE_TOC\"",
        "  exit 0",
        "fi",
        "printf 'write-invoked\\n' > \"$FANMIND_TEST_WRITE_MARKER_PATH\"",
        "",
      ].join("\n"),
      { mode: 0o755 },
    );
    const runnerEnvironment = await restoreRunnerEnvironment(root, dumpPath, {
      FANMIND_TEST_ROLE_CHECK_HEX: hexJson({
        server_version_num: 170006,
        required_role_count: SYNTHETIC_AUTHORIZATION_REQUIRED_ROLES.length,
        present_role_count: SYNTHETIC_AUTHORIZATION_REQUIRED_ROLES.length,
        component_roles: SYNTHETIC_AUTHORIZATION_REQUIRED_ROLES,
        role_fingerprint_sha256: SYNTHETIC_AUTHORIZATION_ROLE_FINGERPRINT,
        role_record_count: SYNTHETIC_AUTHORIZATION_ROLE_RECORD_COUNT,
        database_container_fingerprint_sha256: "8".repeat(64),
        database_container_record_count:
          SYNTHETIC_AUTHORIZATION_CONTAINER_RECORD_COUNT,
        database_container_invariant_violation_count: 0,
        restore_user_superuser: true,
        restore_user_login: true,
        restore_user_outside_component: true,
        outside_component_login_role_count: 1,
        outside_component_superuser_role_count: 1,
      }),
    });

    await assert.rejects(
      execFileAsync("bash", [runnerPath, dumpPath], {
        env: {
          ...process.env,
          ...safeEnvironment({ PGPASSFILE: passfilePath }),
          ...runnerEnvironment,
          FANMIND_PG_RESTORE_BIN: fakeRestorePath,
          FANMIND_TEST_EMPTY_QUERY_MARKER_PATH: queryMarkerPath,
          FANMIND_TEST_WRITE_MARKER_PATH: writeMarkerPath,
        },
      }),
      (error) => {
        assert.match(
          `${String(error.stdout)}\n${String(error.stderr)}`,
          /database_authorization_preflight_failed/u,
        );
        return true;
      },
    );
    await assert.rejects(readFile(queryMarkerPath, "utf8"), /ENOENT/u);
    await assert.rejects(readFile(writeMarkerPath, "utf8"), /ENOENT/u);
    await assert.rejects(
      readFile(runnerEnvironment.FANMIND_RESTORE_RUNNER_RECEIPT_PATH, "utf8"),
      /ENOENT/u,
    );

    runnerEnvironment.FANMIND_TEST_ROLE_CHECK_HEX = hexJson({
      server_version_num: 170006,
      required_role_count: SYNTHETIC_AUTHORIZATION_REQUIRED_ROLES.length,
      present_role_count: SYNTHETIC_AUTHORIZATION_REQUIRED_ROLES.length,
      component_roles: SYNTHETIC_AUTHORIZATION_REQUIRED_ROLES,
      role_fingerprint_sha256: SYNTHETIC_AUTHORIZATION_ROLE_FINGERPRINT,
      role_record_count: SYNTHETIC_AUTHORIZATION_ROLE_RECORD_COUNT,
      database_container_fingerprint_sha256:
        SYNTHETIC_AUTHORIZATION_CONTAINER_FINGERPRINT,
      database_container_record_count:
        SYNTHETIC_AUTHORIZATION_CONTAINER_RECORD_COUNT,
      database_container_invariant_violation_count: 0,
      restore_user_superuser: true,
      restore_user_login: true,
      restore_user_outside_component: true,
      outside_component_login_role_count: 2,
      outside_component_superuser_role_count: 1,
    });
    await assert.rejects(
      execFileAsync("bash", [runnerPath, dumpPath], {
        env: {
          ...process.env,
          ...safeEnvironment({ PGPASSFILE: passfilePath }),
          ...runnerEnvironment,
          FANMIND_PG_RESTORE_BIN: fakeRestorePath,
          FANMIND_TEST_EMPTY_QUERY_MARKER_PATH: queryMarkerPath,
          FANMIND_TEST_WRITE_MARKER_PATH: writeMarkerPath,
        },
      }),
      (error) => {
        assert.match(
          `${String(error.stdout)}\n${String(error.stderr)}`,
          /database_authorization_preflight_failed/u,
        );
        return true;
      },
    );
    await assert.rejects(readFile(queryMarkerPath, "utf8"), /ENOENT/u);
    await assert.rejects(readFile(writeMarkerPath, "utf8"), /ENOENT/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restore runner rejects receipt-unbound, absent, ambiguous or malformed extension TOC entries before querying or writing", async () => {
  const cases = [
    {
      name: "missing",
      toc: SYNTHETIC_ARCHIVE_TOC.replace(
        `${EXTENSIONS_SCHEMA_TOC_ENTRY}\n`,
        "",
      ),
      errorCode: "dump_extension_schema_entry_missing",
    },
    {
      name: "duplicate",
      toc: SYNTHETIC_ARCHIVE_TOC.replace(
        `${EXTENSIONS_SCHEMA_TOC_ENTRY}\n`,
        `${EXTENSIONS_SCHEMA_TOC_ENTRY}\n30; 2615 16392 SCHEMA - extensions postgres\n`,
      ),
      errorCode: "dump_extension_schema_entry_ambiguous",
    },
    {
      name: "wrong-owner",
      toc: SYNTHETIC_ARCHIVE_TOC.replace(
        EXTENSIONS_SCHEMA_TOC_ENTRY,
        "10; 2615 16392 SCHEMA - extensions restore_owner",
      ),
      errorCode: "dump_extension_schema_entry_ambiguous",
    },
    {
      name: "wrong-catalog",
      toc: SYNTHETIC_ARCHIVE_TOC.replace(
        EXTENSIONS_SCHEMA_TOC_ENTRY,
        "10; 1259 16392 SCHEMA - extensions postgres",
      ),
      errorCode: "dump_extension_schema_entry_ambiguous",
    },
    {
      name: "commented",
      toc: SYNTHETIC_ARCHIVE_TOC.replace(
        EXTENSIONS_SCHEMA_TOC_ENTRY,
        `;${EXTENSIONS_SCHEMA_TOC_ENTRY}`,
      ),
      errorCode: "dump_extension_schema_entry_missing",
    },
    {
      name: "near-name",
      toc: SYNTHETIC_ARCHIVE_TOC.replace(
        EXTENSIONS_SCHEMA_TOC_ENTRY,
        "10; 2615 16392 SCHEMA - extensions_backup postgres",
      ),
      errorCode: "dump_extension_schema_entry_missing",
    },
    {
      name: "vault-missing",
      toc: SYNTHETIC_ARCHIVE_TOC.replace(`${VAULT_SCHEMA_TOC_ENTRY}\n`, ""),
      errorCode: "dump_extension_schema_entry_missing",
    },
    {
      name: "vault-wrong-owner",
      toc: SYNTHETIC_ARCHIVE_TOC.replace(
        VAULT_SCHEMA_TOC_ENTRY,
        "20; 2615 16490 SCHEMA - vault postgres",
      ),
      errorCode: "dump_extension_schema_entry_ambiguous",
    },
    {
      name: "unbound-extension",
      toc: SYNTHETIC_ARCHIVE_TOC.replace(
        "23; 3079 16510 EXTENSION - uuid-ossp ",
        "23; 3079 16510 EXTENSION - hstore ",
      ),
      errorCode: "dump_extension_entry_unbound",
    },
    {
      name: "missing-pgcrypto",
      toc: SYNTHETIC_ARCHIVE_TOC.replace(
        "11; 3079 16447 EXTENSION - pgcrypto \n",
        "",
      ),
      errorCode: "dump_extension_entry_missing",
    },
    {
      name: "missing-uuid",
      toc: SYNTHETIC_ARCHIVE_TOC.replace(
        "23; 3079 16510 EXTENSION - uuid-ossp \n",
        "",
      ),
      errorCode: "dump_extension_entry_missing",
    },
    {
      name: "unexpected-plpgsql",
      toc: SYNTHETIC_ARCHIVE_TOC.replace(
        "23; 3079 16510 EXTENSION - uuid-ossp ",
        "23; 3079 16510 EXTENSION - uuid-ossp \n24; 3079 13563 EXTENSION - plpgsql ",
      ),
      errorCode: "dump_extension_builtin_entry_unexpected",
    },
    {
      name: "duplicate-extension",
      toc: SYNTHETIC_ARCHIVE_TOC.replace(
        "23; 3079 16510 EXTENSION - uuid-ossp ",
        "23; 3079 16510 EXTENSION - pgcrypto ",
      ),
      errorCode: "dump_extension_entry_ambiguous",
    },
    {
      name: "malformed-entry",
      toc: SYNTHETIC_ARCHIVE_TOC.replace(
        EXTENSIONS_SCHEMA_TOC_ENTRY,
        "not-a-toc-entry",
      ),
      errorCode: "dump_archive_toc_entry_invalid",
    },
    {
      name: "duplicate-id",
      toc: SYNTHETIC_ARCHIVE_TOC.replace(
        "16; 1259 20002 TABLE public contacts postgres",
        "14; 1259 20002 TABLE public contacts postgres",
      ),
      errorCode: "dump_archive_toc_duplicate_id",
    },
  ];

  for (const fixture of cases) {
    const root = await mkdtemp(
      join(tmpdir(), `fanmind-restore-toc-${fixture.name}-`),
    );
    try {
      const dumpPath = join(root, "fanmind-database-test.dump");
      const fakeRestorePath = join(root, "fake-pg-restore.sh");
      const passfilePath = join(root, "restore.pgpass");
      const listMarkerPath = join(root, "list-attempted.txt");
      const queryMarkerPath = join(root, "query-invoked.txt");
      const writeMarkerPath = join(root, "write-invoked.txt");
      await writeFile(dumpPath, "synthetic-dump");
      await chmod(dumpPath, 0o600);
      await writeFile(passfilePath, "synthetic-password-file");
      await chmod(passfilePath, 0o600);
      await writeFile(
        fakeRestorePath,
        [
          "#!/usr/bin/env bash",
          "set -Eeuo pipefail",
          "if [[ \"${1:-}\" == \"--list\" ]]; then",
          "  printf '%s\\n' \"${2:-}\" > \"$FANMIND_TEST_LIST_MARKER_PATH\"",
          "  printf '%s' \"$FANMIND_TEST_ARCHIVE_TOC\"",
          "  exit 0",
          "fi",
          "printf 'write-invoked\\n' > \"$FANMIND_TEST_WRITE_MARKER_PATH\"",
          "",
        ].join("\n"),
      );
      await chmod(fakeRestorePath, 0o755);
      const runnerEnvironment = await restoreRunnerEnvironment(root, dumpPath, {
        FANMIND_TEST_ARCHIVE_TOC: fixture.toc,
      });

      await assert.rejects(
        execFileAsync("bash", [runnerPath, dumpPath], {
          env: {
            ...process.env,
            ...safeEnvironment({ PGPASSFILE: passfilePath }),
            ...runnerEnvironment,
            FANMIND_PG_RESTORE_BIN: fakeRestorePath,
            FANMIND_TEST_LIST_MARKER_PATH: listMarkerPath,
            FANMIND_TEST_EMPTY_QUERY_MARKER_PATH: queryMarkerPath,
            FANMIND_TEST_WRITE_MARKER_PATH: writeMarkerPath,
          },
        }),
        (error) => {
          const output = `${String(error.stdout)}\n${String(error.stderr)}`;
          assert.match(output, new RegExp(fixture.errorCode, "u"));
          assert.doesNotMatch(output, /restore_owner|extensions_backup/u);
          return true;
        },
        fixture.name,
      );
      await assert.rejects(readFile(queryMarkerPath, "utf8"), /ENOENT/u);
      await assert.rejects(readFile(writeMarkerPath, "utf8"), /ENOENT/u);
      await assert.rejects(
        readFile(
          runnerEnvironment.FANMIND_RESTORE_RUNNER_RECEIPT_PATH,
          "utf8",
        ),
        /ENOENT/u,
      );
      const failedSnapshotPath = (await readFile(listMarkerPath, "utf8")).trim();
      await assert.rejects(access(dirname(failedSnapshotPath)), /ENOENT/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("restore runner fails closed when a required table has no policy", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-restore-postcheck-test-"));
  try {
    const dumpPath = join(root, "fanmind-database-test.dump");
    const fakeRestorePath = join(root, "fake-pg-restore.sh");
    const passfilePath = join(root, "restore.pgpass");
    await writeFile(dumpPath, "synthetic-dump");
    await chmod(dumpPath, 0o600);
    await writeFile(passfilePath, "synthetic-password-file");
    await chmod(passfilePath, 0o600);
    await writeFile(
      fakeRestorePath,
      [
        "#!/usr/bin/env bash",
        "set -Eeuo pipefail",
        "if [[ \"${1:-}\" == \"--list\" ]]; then",
        "  printf '%s' \"$FANMIND_TEST_ARCHIVE_TOC\"",
        "fi",
        "exit 0",
        "",
      ].join("\n"),
    );
    await chmod(fakeRestorePath, 0o755);
    const runnerEnvironment = await restoreRunnerEnvironment(root, dumpPath, {
      FANMIND_TEST_POSTCHECK_RESULT: [
        "contacts|1|1|4",
        "followups|1|1|3",
        "memories|1|1|0",
        "workspace_members|1|1|2",
        "workspaces|1|1|2",
      ].join("\n"),
    });

    await assert.rejects(
      execFileAsync("bash", [runnerPath, dumpPath], {
        env: {
          ...process.env,
          ...safeEnvironment({ PGPASSFILE: passfilePath }),
          ...runnerEnvironment,
          FANMIND_PG_RESTORE_BIN: fakeRestorePath,
        },
      }),
      (error) => {
        const output = `${String(error.stdout)}\n${String(error.stderr)}`;
        assert.match(output, /postcheck_policy_missing/u);
        assert.match(output, /database_postcheck_receipt_failed/u);
        return true;
      },
    );
    await assert.rejects(
      readFile(
        runnerEnvironment.FANMIND_RESTORE_DATABASE_POSTCHECK_RECEIPT_PATH,
        "utf8",
      ),
      /ENOENT/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restore runner binary overrides require the exact test-only gate", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-restore-override-test-"));
  try {
    const dumpPath = join(root, "fanmind-database-test.dump");
    const fakeRestorePath = join(root, "fake-pg-restore.sh");
    const passfilePath = join(root, "restore.pgpass");
    await writeFile(dumpPath, "synthetic-dump");
    await chmod(dumpPath, 0o600);
    await writeFile(passfilePath, "synthetic-password-file");
    await chmod(passfilePath, 0o600);
    await writeFile(fakeRestorePath, "#!/usr/bin/env bash\nexit 0\n");
    await chmod(fakeRestorePath, 0o755);
    const runnerEnvironment = await restoreRunnerEnvironment(root, dumpPath, {
      FANMIND_OPERATIONAL_TEST_MODE: "",
    });

    await assert.rejects(
      execFileAsync("bash", [runnerPath, dumpPath], {
        env: {
          ...process.env,
          ...safeEnvironment({ PGPASSFILE: passfilePath }),
          ...runnerEnvironment,
          GITHUB_ACTIONS: "true",
          FANMIND_OPERATIONAL_TEST_MODE: "restore-runner-test",
          FANMIND_PG_RESTORE_BIN: fakeRestorePath,
        },
      }),
      /operational_binary_override_forbidden_in_actions/u,
    );

    await assert.rejects(
      execFileAsync("bash", [runnerPath, dumpPath], {
        env: {
          ...process.env,
          ...safeEnvironment({ PGPASSFILE: passfilePath }),
          ...runnerEnvironment,
          FANMIND_PG_RESTORE_BIN: fakeRestorePath,
        },
      }),
      /operational_binary_override_forbidden/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("GitHub Actions can never enable the compatibility test binary", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-compatibility-actions-"));
  try {
    const fixture = await restoreCompatibilityFixture(root, "170006|3|1|1", {
      GITHUB_ACTIONS: "true",
    });
    await assert.rejects(
      execFileAsync(process.execPath, [compatibilityScriptPath], {
        env: fixture.environment,
      }),
      /psql_override_forbidden/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restore runner rejects permissive passfiles before invoking pg_restore", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-restore-passfile-test-"));
  try {
    const dumpPath = join(root, "fanmind-database-test.dump");
    const fakeRestorePath = join(root, "fake-pg-restore.sh");
    const passfilePath = join(root, "restore.pgpass");
    const invokedPath = join(root, "invoked.txt");
    await writeFile(dumpPath, "synthetic-dump");
    await chmod(dumpPath, 0o600);
    await writeFile(passfilePath, "synthetic-password-file");
    await chmod(passfilePath, 0o644);
    await writeFile(
      fakeRestorePath,
      [
        "#!/usr/bin/env bash",
        "set -Eeuo pipefail",
        "printf 'invoked\\n' > \"$FANMIND_TEST_INVOKED_PATH\"",
        "",
      ].join("\n"),
    );
    await chmod(fakeRestorePath, 0o755);
    const runnerEnvironment = await restoreRunnerEnvironment(root, dumpPath);

    await assert.rejects(
      execFileAsync("bash", [runnerPath, dumpPath], {
        env: {
          ...process.env,
          ...safeEnvironment({ PGPASSFILE: passfilePath }),
          ...runnerEnvironment,
          FANMIND_PG_RESTORE_BIN: fakeRestorePath,
          FANMIND_TEST_INVOKED_PATH: invokedPath,
        },
      }),
      (error) => {
        assert.match(String(error.stderr), /passfile_permissions_too_open/);
        return true;
      },
    );
    await assert.rejects(readFile(invokedPath, "utf8"), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restore runner rejects a passfile owned by another user before invoking pg_restore", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-restore-passfile-owner-test-"));
  try {
    const dumpPath = join(root, "fanmind-database-test.dump");
    const fakeBinDirectory = join(root, "bin");
    const fakeStatPath = join(fakeBinDirectory, "stat");
    const fakeRestorePath = join(root, "fake-pg-restore.sh");
    const passfilePath = join(root, "restore.pgpass");
    const invokedPath = join(root, "invoked.txt");
    await mkdir(fakeBinDirectory, { recursive: true });
    await writeFile(dumpPath, "synthetic-dump");
    await chmod(dumpPath, 0o600);
    await writeFile(passfilePath, "synthetic-password-file");
    await chmod(passfilePath, 0o600);
    await writeFile(
      fakeStatPath,
      [
        "#!/usr/bin/env bash",
        "set -Eeuo pipefail",
        "target=\"${@: -1}\"",
        "if [[ \"$target\" != /proc/self/fd/* ]]; then",
        "  exec /usr/bin/stat \"$@\"",
        "fi",
        "printf '1 2 999999 600 81a0\\n'",
        "",
      ].join("\n"),
    );
    await writeFile(
      fakeRestorePath,
      [
        "#!/usr/bin/env bash",
        "set -Eeuo pipefail",
        "printf 'invoked\\n' > \"$FANMIND_TEST_INVOKED_PATH\"",
        "",
      ].join("\n"),
    );
    await chmod(fakeStatPath, 0o755);
    await chmod(fakeRestorePath, 0o755);
    const runnerEnvironment = await restoreRunnerEnvironment(root, dumpPath);

    await assert.rejects(
      execFileAsync("bash", [runnerPath, dumpPath], {
        env: {
          ...process.env,
          ...safeEnvironment({ PGPASSFILE: passfilePath }),
          ...runnerEnvironment,
          PATH: `${fakeBinDirectory}:${process.env.PATH ?? ""}`,
          FANMIND_PG_RESTORE_BIN: fakeRestorePath,
          FANMIND_TEST_INVOKED_PATH: invokedPath,
        },
      }),
      (error) => {
        const output = `${String(error.stdout)}\n${String(error.stderr)}`;
        assert.match(output, /passfile_owner_mismatch/);
        assert.doesNotMatch(output, new RegExp(passfilePath.replaceAll(".", "\\.")));
        return true;
      },
    );
    await assert.rejects(readFile(invokedPath, "utf8"), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restore runner rejects a source path swapped after it was opened", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-restore-source-swap-test-"));
  try {
    const dumpPath = join(root, "fanmind-database-test.dump");
    const fakeBinDirectory = join(root, "bin");
    const fakeStatPath = join(fakeBinDirectory, "stat");
    const fakeRestorePath = join(root, "fake-pg-restore.sh");
    const passfilePath = join(root, "restore.pgpass");
    const statStatePath = join(root, "stat-state.txt");
    const invokedPath = join(root, "invoked.txt");
    await mkdir(fakeBinDirectory, { recursive: true });
    await writeFile(dumpPath, "synthetic-dump");
    await chmod(dumpPath, 0o600);
    await writeFile(passfilePath, "synthetic-password-file");
    await chmod(passfilePath, 0o600);
    await writeFile(
      fakeStatPath,
      [
        "#!/usr/bin/env bash",
        "set -Eeuo pipefail",
        "target=\"${@: -1}\"",
        "if [[ \"$target\" != /proc/self/fd/* && \"$target\" != \"$PGPASSFILE\" ]]; then",
        "  exec /usr/bin/stat \"$@\"",
        "fi",
        "count=0",
        "[[ ! -f \"$FANMIND_TEST_STAT_STATE_PATH\" ]] || read -r count < \"$FANMIND_TEST_STAT_STATE_PATH\"",
        "count=$((count + 1))",
        "printf '%s\\n' \"$count\" > \"$FANMIND_TEST_STAT_STATE_PATH\"",
        "if [[ \"$count\" -eq 1 ]]; then",
        "  printf '1 2 %s 600 81a0\\n' \"$(id -u)\"",
        "else",
        "  printf '1 3 81a0\\n'",
        "fi",
        "",
      ].join("\n"),
    );
    await writeFile(
      fakeRestorePath,
      [
        "#!/usr/bin/env bash",
        "set -Eeuo pipefail",
        "printf 'invoked\\n' > \"$FANMIND_TEST_INVOKED_PATH\"",
        "",
      ].join("\n"),
    );
    await chmod(fakeStatPath, 0o755);
    await chmod(fakeRestorePath, 0o755);
    const runnerEnvironment = await restoreRunnerEnvironment(root, dumpPath);

    await assert.rejects(
      execFileAsync("bash", [runnerPath, dumpPath], {
        env: {
          ...process.env,
          ...safeEnvironment({ PGPASSFILE: passfilePath }),
          ...runnerEnvironment,
          PATH: `${fakeBinDirectory}:${process.env.PATH ?? ""}`,
          FANMIND_PG_RESTORE_BIN: fakeRestorePath,
          FANMIND_TEST_INVOKED_PATH: invokedPath,
          FANMIND_TEST_STAT_STATE_PATH: statStatePath,
        },
      }),
      (error) => {
        assert.match(
          `${String(error.stdout)}\n${String(error.stderr)}`,
          /passfile_path_changed_during_open/,
        );
        return true;
      },
    );
    await assert.rejects(readFile(invokedPath, "utf8"), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restore runner validates the dump archive before any write invocation", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-restore-archive-test-"));
  try {
    const dumpPath = join(root, "fanmind-database-invalid.dump");
    const fakeRestorePath = join(root, "fake-pg-restore.sh");
    const passfilePath = join(root, "restore.pgpass");
    const writeInvokedPath = join(root, "write-invoked.txt");
    const listMarkerPath = join(root, "list-attempted.txt");
    await writeFile(dumpPath, "invalid-synthetic-dump");
    await chmod(dumpPath, 0o600);
    await writeFile(passfilePath, "synthetic-password-file");
    await chmod(passfilePath, 0o600);
    await writeFile(
      fakeRestorePath,
      [
        "#!/usr/bin/env bash",
        "set -Eeuo pipefail",
        "if [[ \"${1:-}\" == \"--list\" ]]; then",
        "  printf '%s\\n' \"${2:-}\" > \"$FANMIND_TEST_LIST_MARKER_PATH\"",
        "  printf '%s' \"$FANMIND_TEST_ARCHIVE_TOC\"",
        "  exit 1",
        "fi",
        "printf 'write-invoked\\n' > \"$FANMIND_TEST_WRITE_INVOKED_PATH\"",
        "",
      ].join("\n"),
    );
    await chmod(fakeRestorePath, 0o755);
    const runnerEnvironment = await restoreRunnerEnvironment(root, dumpPath);

    await assert.rejects(
      execFileAsync("bash", [runnerPath, dumpPath], {
        env: {
          ...process.env,
          ...safeEnvironment({ PGPASSFILE: passfilePath }),
          ...runnerEnvironment,
          FANMIND_PG_RESTORE_BIN: fakeRestorePath,
          FANMIND_TEST_WRITE_INVOKED_PATH: writeInvokedPath,
          FANMIND_TEST_LIST_MARKER_PATH: listMarkerPath,
        },
      }),
      (error) => {
        assert.match(String(error.stderr), /dump_archive_validation_failed/);
        return true;
      },
    );
    await assert.rejects(readFile(writeInvokedPath, "utf8"), /ENOENT/);
    const failedSnapshotPath = (await readFile(listMarkerPath, "utf8")).trim();
    await assert.rejects(access(dirname(failedSnapshotPath)), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("runbook and package scripts require the gated runner for pg_restore", async () => {
  const [runbook, packageSource, runner, extensionTocPolicy] = await Promise.all([
    readFile(runbookPath, "utf8"),
    readFile(packagePath, "utf8"),
    readFile(runnerPath, "utf8"),
    readFile(extensionTocPolicyPath, "utf8"),
  ]);
  const packageJson = JSON.parse(packageSource);
  const preflightPosition = runbook.indexOf("npm run restore:preflight");
  const runnerPosition = runbook.indexOf("npm run restore:database:drill");

  assert.equal(
    packageJson.scripts["restore:preflight"],
    "node scripts/operations/restore-target-preflight.mjs",
  );
  assert.equal(
    packageJson.scripts["restore:database:drill"],
    "bash scripts/operations/run-database-restore-drill.sh",
  );
  assert.equal(
    packageJson.scripts["restore:database:postcheck"],
    "node scripts/operations/restore-database-postcheck-receipt.mjs",
  );
  assert.match(packageJson.scripts["test:operations"], /restore-target-policy\.test\.mjs/);
  assert.ok(preflightPosition >= 0);
  assert.ok(runnerPosition > preflightPosition);
  assert.match(runbook, /RESTORE_TARGET_BOUNDARY=OK/);
  assert.match(runbook, /PGHOSTADDR/);
  assert.match(runbook, /Connection-String/);
  assert.match(runbook, /target host differs from the Production database host/);
  assert.match(
    runbook,
    /full-backup receipt, dump and passfile must be regular, non-symlink files owned\s+by the operator/u,
  );
  assert.match(runbook, /pg_restore --list/);
  assert.ok(runner.indexOf("restore-target-preflight.mjs") < runner.indexOf("--list"));
  assert.ok(runner.indexOf("--list") < runner.indexOf("empty_target_sql"));
  assert.ok(runner.indexOf("verify-target-roles") < runner.indexOf("empty_target_sql"));
  assert.ok(runner.indexOf("empty_target_sql") < runner.indexOf("--single-transaction"));
  assert.match(runner, /snapshot_archive_toc/u);
  assert.match(runner, /snapshot_restore_toc/u);
  assert.match(runner, /restore-extension-toc-policy\.mjs/u);
  assert.match(runner, /--archive-toc "\$snapshot_archive_toc"/u);
  assert.match(runner, /--output "\$snapshot_restore_toc"/u);
  assert.match(runner, /--use-list "\$restore_toc_fd_path"/u);
  assert.match(runner, /restore_toc_fd_path="\/proc\/self\/fd\/\$restore_toc_fd"/u);
  assert.doesNotMatch(runner, /--exclude-schema(?:=|\s)/u);
  assert.match(extensionTocPolicy, /before\.nlink !== 1n/u);
  assert.match(extensionTocPolicy, /before\.uid !== BigInt\(process\.getuid\(\)\)/u);
  assert.match(extensionTocPolicy, /\(before\.mode & 0o777n\) !== 0o600n/u);
  assert.match(extensionTocPolicy, /\(parent\.mode & 0o777\) !== 0o700/u);
  assert.match(extensionTocPolicy, /constants\.O_EXCL \| constants\.O_NOFOLLOW/u);
  assert.match(extensionTocPolicy, /\n      0o600,\n/u);
  assert.match(runner, /readonly[\s\\]+PGHOST[\s\\]+PGPORT[\s\\]+PGDATABASE[\s\\]+PGUSER/u);
  assert.match(runner, /owner_uid/);
  assert.match(runner, /path_changed_during_open/);
  assert.match(runner, /source_label}_permissions_too_open/);
  assert.match(runner, /dump_symlink_forbidden/);
  assert.match(runner, /passfile_symlink_forbidden/);
  assert.match(runner, /snapshot_dump/);
  assert.match(runner, /snapshot_passfile/);
  assert.match(runner, /snapshot_full_receipt/);
  assert.match(runner, /snapshot_ca_certificate/);
  assert.match(runner, /PGSSLMODE="verify-full"/u);
  assert.match(runner, /PGGSSENCMODE="disable"/u);
  assert.match(runner, /verify-full-backup-restore-receipt\.mjs/);
  assert.match(runner, /restore-runner-receipt\.mjs/);
  assert.match(runner, /restore-database-postcheck-receipt\.mjs/);
  assert.match(runner, /database-authorization-contract\.mjs/u);
  assert.match(runner, /verify-target-roles/u);
  assert.match(runner, /extension descriptor set\/fingerprint/u);
  assert.match(runner, /non-archived[\s#]+database-container profile/u);
  assert.match(runner, /membership grantors/u);
  assert.match(runner, /bootstrap-principal boundary/u);
  assert.match(runner, /snapshot-target/u);
  assert.match(
    runner,
    /authorization\\\|\[0-9a-f\]\{64\}[\s\S]+?120\\\|12\\\|\[0-9a-f\]\{64\}[\s\S]+?\[0-9a-f\]\{64\}/u,
  );
  assert.match(runner, /fanmind_required_restore_tables/u);
  assert.match(runner, /pg_catalog\.pg_policy/u);
  assert.match(runner, /FANMIND_RESTORE_DATABASE_POSTCHECK_RECEIPT_PATH/u);
  assert.match(runner, /restore_target_not_empty/);
  assert.match(runner, /expected_extension_functions\(/u);
  assert.equal(
    (runner.match(/FROM expected_extension_addresses AS expected/gu) ?? []).length,
    2,
  );
  assert.equal(
    (runner.match(/FROM allowed_container_schemas AS allowed/gu) ?? []).length,
    3,
  );
  assert.match(runner, /FROM preinstalled_extension_addresses AS allowed/u);
  assert.doesNotMatch(runner, /allowed_extension_objects/u);
  assert.match(
    runbook,
    /[Aa] newly\s+provisioned Supabase[\s\S]+not considered empty/u,
  );
  assert.match(runbook, /complete sorted Production extension[\s\S]+member identities/u);
  assert.match(
    runbook,
    /TOC[\s\S]+SCHEMA - extensions postgres[\s\S]+SCHEMA - vault supabase_admin[\s\S]+--use-list/u,
  );
  assert.match(runner, /FANMIND_OPERATIONAL_TEST_MODE/);
  assert.match(runner, /--single-transaction/);
  assert.doesNotMatch(runner, /--no-owner|--no-privileges/u);
  assert.match(runner, /-u PGHOSTADDR/);
  assert.match(runner, /-u PGSERVICE/);
  assert.match(runner, /-u PGSERVICEFILE/);
  assert.match(runner, /--host "\$PGHOST"/);
  assert.match(runner, /--port "\$PGPORT"/);
  assert.match(runner, /--username "\$PGUSER"/);
  assert.match(runner, /--dbname "\$PGDATABASE"/);
});
