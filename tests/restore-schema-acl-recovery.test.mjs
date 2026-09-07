import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  authorizationContractsEqual,
  classifySchemaAclRecovery,
  recoverySql,
  rollbackSql,
  validateSchemaAclState,
} from "../scripts/operations/restore-schema-acl-recovery.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_ROLES = Object.freeze([
  "anon",
  "authenticated",
  "postgres",
  "service_role",
  "supabase_admin",
]);
const REQUIRED_EXTENSIONS = Object.freeze([
  Object.freeze({
    name: "pgcrypto",
    version: "1.3",
    schema: "extensions",
    owner: "postgres",
    relocatable: true,
    schemaOwner: "postgres",
    schemaDefinitionArchived: true,
  }),
  Object.freeze({
    name: "plpgsql",
    version: "1.0",
    schema: "pg_catalog",
    owner: "postgres",
    relocatable: false,
    schemaOwner: "postgres",
    schemaDefinitionArchived: false,
  }),
]);

function contract(overrides = {}) {
  return {
    schemaVersion: 2,
    canonicalization: "postgresql-17-acl-json-array-hex-v2",
    fingerprintSha256: "a".repeat(64),
    recordCount: 1469,
    grantTupleCount: 2463,
    requiredRoles: REQUIRED_ROLES,
    requiredRolesSha256: "b".repeat(64),
    roleFingerprintSha256: "c".repeat(64),
    roleRecordCount: 34,
    databaseContainerFingerprintSha256: "d".repeat(64),
    databaseContainerRecordCount: 9,
    requiredExtensions: REQUIRED_EXTENSIONS,
    requiredExtensionsSha256: "e".repeat(64),
    extensionFingerprintSha256: "f".repeat(64),
    extensionRecordCount: 84,
    coreTableAppGrantTupleCount: 120,
    restrictedSecurityDefinerFunctionCount: 12,
    ...overrides,
  };
}

const OWNER_ONLY = Object.freeze([
  ["supabase_admin", "supabase_admin", "CREATE", false],
  ["supabase_admin", "supabase_admin", "USAGE", false],
]);
const RECOVERED = Object.freeze([
  ["anon", "supabase_admin", "USAGE", false],
  ["authenticated", "supabase_admin", "USAGE", false],
  ["postgres", "supabase_admin", "USAGE", true],
  ["service_role", "supabase_admin", "USAGE", false],
  ["supabase_admin", "supabase_admin", "CREATE", false],
  ["supabase_admin", "supabase_admin", "USAGE", false],
]);

function schemaState(acl) {
  return {
    schemaCount: 2,
    requiredRoleCount: 5,
    schemas: [
      {
        name: "graphql",
        owner: "supabase_admin",
        extensionMember: false,
        acl,
      },
      {
        name: "graphql_public",
        owner: "supabase_admin",
        extensionMember: false,
        acl,
      },
    ],
  };
}

test("schema ACL recovery is a no-op when the full receipt contract already matches", () => {
  const expected = contract();
  const actual = contract();
  assert.equal(authorizationContractsEqual(expected, actual), true);
  assert.equal(classifySchemaAclRecovery(expected, actual), "not_needed");
});

test("schema ACL recovery accepts only the proven eight-tuple fingerprint gap", () => {
  const expected = contract();
  const actual = contract({
    fingerprintSha256: "9".repeat(64),
    grantTupleCount: 2455,
  });
  assert.equal(authorizationContractsEqual(expected, actual), false);
  assert.equal(classifySchemaAclRecovery(expected, actual), "repair_required");

  assert.throws(
    () => classifySchemaAclRecovery(expected, {
      ...actual,
      grantTupleCount: 2454,
    }),
    /schema_acl_recovery_grant_delta_invalid/u,
  );
  assert.throws(
    () => classifySchemaAclRecovery(expected, {
      ...actual,
      recordCount: expected.recordCount - 1,
    }),
    /schema_acl_recovery_contract_boundary_mismatch/u,
  );
  assert.throws(
    () => classifySchemaAclRecovery(expected, {
      ...actual,
      databaseContainerFingerprintSha256: "8".repeat(64),
    }),
    /schema_acl_recovery_contract_boundary_mismatch/u,
  );
});

test("schema ACL state is fail-closed on exact schema, owner, extension and ACL boundaries", () => {
  assert.equal(validateSchemaAclState(schemaState(OWNER_ONLY), OWNER_ONLY), true);
  assert.equal(validateSchemaAclState(schemaState(RECOVERED), RECOVERED), true);

  assert.throws(
    () => validateSchemaAclState({
      ...schemaState(OWNER_ONLY),
      schemaCount: 1,
    }, OWNER_ONLY),
    /schema_acl_recovery_state_invalid/u,
  );

  const wrongOwner = schemaState(OWNER_ONLY);
  wrongOwner.schemas[0] = { ...wrongOwner.schemas[0], owner: "postgres" };
  assert.throws(
    () => validateSchemaAclState(wrongOwner, OWNER_ONLY),
    /schema_acl_recovery_schema_boundary_invalid/u,
  );

  const extensionMember = schemaState(OWNER_ONLY);
  extensionMember.schemas[1] = {
    ...extensionMember.schemas[1],
    extensionMember: true,
  };
  assert.throws(
    () => validateSchemaAclState(extensionMember, OWNER_ONLY),
    /schema_acl_recovery_schema_boundary_invalid/u,
  );

  const extraGrant = schemaState([
    ...OWNER_ONLY,
    ["anon", "supabase_admin", "USAGE", false],
  ]);
  assert.throws(
    () => validateSchemaAclState(extraGrant, OWNER_ONLY),
    /schema_acl_recovery_acl_precondition_invalid/u,
  );
});

test("schema ACL mutation is narrowly bounded and has an exact inverse", () => {
  const apply = recoverySql();
  const rollback = rollbackSql();

  assert.match(apply, /grant usage on schema graphql, graphql_public to anon, authenticated, service_role;/u);
  assert.match(apply, /grant usage on schema graphql, graphql_public to postgres with grant option;/u);
  assert.match(apply, /set role supabase_admin;/u);
  assert.match(apply, /pg_advisory_xact_lock\(20260820, 731001\)/u);
  assert.doesNotMatch(apply, /grant all/u);
  assert.doesNotMatch(apply, /drop\s+(?:schema|database|role)/iu);

  assert.match(rollback, /revoke usage on schema graphql, graphql_public from anon, authenticated, service_role;/u);
  assert.match(rollback, /revoke usage on schema graphql, graphql_public from postgres;/u);
  assert.match(rollback, /set role supabase_admin;/u);
  assert.doesNotMatch(rollback, /revoke all/u);
  assert.doesNotMatch(rollback, /drop\s+(?:schema|database|role)/iu);
});

test("schema ACL recovery remains inside the protected R4 database-restore write gates", async () => {
  const [workflow, restoreRunner, recoveryHelper] = await Promise.all([
    readFile(path.join(repoRoot, ".github/workflows/restore-drill-database.yml"), "utf8"),
    readFile(path.join(repoRoot, "scripts/operations/run-database-restore-drill.sh"), "utf8"),
    readFile(path.join(repoRoot, "scripts/operations/restore-schema-acl-recovery.mjs"), "utf8"),
  ]);

  assert.match(workflow, /\[\[ "\$REQUESTED_CONFIRMATION" == 'run-isolated-database-restore' \]\]/u);
  assert.match(workflow, /environment: restore-drill/u);
  assert.match(workflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'true'/u);
  assert.match(workflow, /FANMIND_NON_PRODUCTION_WRITE_ACK: I_UNDERSTAND_NON_PRODUCTION_ONLY/u);
  assert.match(workflow, /FANMIND_ENABLE_RESTORE_DRILL: 'true'/u);
  assert.match(workflow, /FANMIND_RESTORE_TARGET_ACK: I_UNDERSTAND_EMPTY_DISPOSABLE_DATABASE_ONLY/u);
  assert.match(workflow, /PGSSLMODE: verify-full/u);
  assert.match(workflow, /PGGSSENCMODE: disable/u);

  const recoveryInvocations = restoreRunner.match(/restore-schema-acl-recovery\.mjs/gu) ?? [];
  assert.equal(recoveryInvocations.length, 1);
  assert.match(restoreRunner, /database_schema_acl_recovery_failed/u);
  assert.match(restoreRunner, /SCHEMA_ACL_RECOVERY=\(APPLIED\|NOT_NEEDED\)/u);
  assert.match(
    recoveryHelper,
    /captureProjectedTargetAuthorizationContract/u,
  );
  assert.doesNotMatch(
    recoveryHelper,
    /captureDatabaseAuthorizationContract/u,
  );
  assert.match(
    recoveryHelper,
    /one and only[\s\S]*target snapshot exclude that exact target-only login/u,
  );
});
