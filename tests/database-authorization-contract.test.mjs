import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { after, before, test } from "node:test";

import {
  DATABASE_AUTHORIZATION_CONTRACT_SQL,
  analyzeAuthorizationToc,
  assertDatabaseAuthorizationRoles,
  authorizationContractSqlExcludingTargetLogin,
  captureDatabaseAuthorizationContract,
  openDatabaseAuthorizationSnapshot,
  validateAuthorizationContract,
} from "../scripts/operations/database-authorization-contract.mjs";

const MODULE_PATH = resolve(
  "scripts/operations/database-authorization-contract.mjs",
);
const HOST = "db.example.invalid";
const PORT = "5432";
const USERNAME = "restore_admin";
const DATABASE = "postgres";
const REQUIRED_ROLES = ["anon", "authenticated", "postgres"];
const REQUIRED_ROLES_SHA256 = createHash("sha256")
  .update(JSON.stringify(REQUIRED_ROLES), "utf8")
  .digest("hex");
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
const REQUIRED_EXTENSIONS_SHA256 = createHash("sha256")
  .update(JSON.stringify(REQUIRED_EXTENSIONS), "utf8")
  .digest("hex");
const AUTHORIZATION_PAYLOAD = Object.freeze({
  server_version_num: 170006,
  fingerprint_sha256: "a".repeat(64),
  record_count: 1462,
  grant_tuple_count: 2463,
  required_roles: REQUIRED_ROLES,
  role_fingerprint_sha256: "c".repeat(64),
  role_record_count: 5,
  database_container_fingerprint_sha256: "d".repeat(64),
  database_container_record_count: 12,
  required_extensions: REQUIRED_EXTENSIONS,
  extension_fingerprint_sha256: "e".repeat(64),
  extension_record_count: 84,
  extension_contract_invariant_violation_count: 0,
  extension_contract_unsupported_class_count: 0,
  core_table_app_grant_tuple_count: 120,
  core_table_app_grant_option_count: 0,
  core_table_app_grant_row_count: 120,
  container_recovery_invariant_violation_count: 0,
  extension_recovery_invariant_violation_count: 0,
  public_security_definer_function_count: 13,
  restricted_security_definer_function_count: 12,
  exposed_security_definer_exception_count: 1,
  hardened_security_definer_exception_count: 0,
  unsupported_default_acl_type_count: 0,
  unresolved_role_oid_count: 0,
});

let fixtureDirectory;
let fakePsqlPath;
let receiptPath;

function fullReceipt(overrides = {}) {
  return {
    schemaVersion: 2,
    createdAt: "2026-08-15T12:00:00.000Z",
    sourceArtifactBasename: "fanmind-full-1234567890123.tar.gz.age",
    outerSha256: "1".repeat(64),
    productionCommit: "2".repeat(40),
    databasePartEncryptedSha256: "3".repeat(64),
    databaseDumpSha256: "4".repeat(64),
    databaseAuthorizationContractVersion: 2,
    databaseAuthorizationFingerprintSha256:
      AUTHORIZATION_PAYLOAD.fingerprint_sha256,
    databaseAuthorizationRecordCount: AUTHORIZATION_PAYLOAD.record_count,
    databaseAuthorizationGrantTupleCount:
      AUTHORIZATION_PAYLOAD.grant_tuple_count,
    databaseAuthorizationRequiredRoles: REQUIRED_ROLES,
    databaseAuthorizationRequiredRolesSha256: REQUIRED_ROLES_SHA256,
    databaseAuthorizationRoleFingerprintSha256: "c".repeat(64),
    databaseAuthorizationRoleRecordCount: 5,
    databaseAuthorizationContainerFingerprintSha256: "d".repeat(64),
    databaseAuthorizationContainerRecordCount: 12,
    databaseAuthorizationRequiredExtensions: REQUIRED_EXTENSIONS,
    databaseAuthorizationRequiredExtensionsSha256:
      REQUIRED_EXTENSIONS_SHA256,
    databaseAuthorizationExtensionFingerprintSha256: "e".repeat(64),
    databaseAuthorizationExtensionRecordCount: 84,
    databaseCoreTableAppGrantTupleCount: 120,
    databaseRestrictedSecurityDefinerFunctionCount: 12,
    databaseAclTocEntryCount: 1,
    databaseDefaultAclTocEntryCount: 1,
    databaseAclTocSha256: "5".repeat(64),
    databasePrivilegesArchived: true,
    databaseOwnershipArchived: true,
    verifier: "passed",
    ...overrides,
  };
}

function connectionOptions() {
  return {
    psqlBin: fakePsqlPath,
    host: HOST,
    port: PORT,
    username: USERNAME,
    database: DATABASE,
    env: {
      PATH: process.env.PATH,
      FAKE_AUTHORIZATION_PAYLOAD: JSON.stringify(AUTHORIZATION_PAYLOAD),
      FAKE_HOST: HOST,
      FAKE_PORT: PORT,
      FAKE_USERNAME: USERNAME,
      FAKE_DATABASE: DATABASE,
      PGHOSTADDR: "203.0.113.77",
      PGSERVICE: "hostile-service",
      PGPASSWORD: "hostile-password",
      PGSSLMODE: "verify-full",
    },
  };
}

before(async () => {
  fixtureDirectory = await mkdtemp(join(tmpdir(), "fanmind-authorization-"));
  fakePsqlPath = join(fixtureDirectory, "fake-psql.mjs");
  receiptPath = join(fixtureDirectory, "full-receipt.json");
  const fakePsql = `#!/usr/bin/env node
const expected = [
  "--no-psqlrc", "--no-align", "--tuples-only", "--quiet",
  "--set", "ON_ERROR_STOP=1", "--no-password",
  "--host", process.env.FAKE_HOST,
  "--port", process.env.FAKE_PORT,
  "--username", process.env.FAKE_USERNAME,
  "--dbname", process.env.FAKE_DATABASE,
];
if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(expected)) {
  process.exit(41);
}
if (
  "PGHOSTADDR" in process.env ||
  "PGSERVICE" in process.env ||
  "PGPASSWORD" in process.env ||
  process.env.PGSSLMODE !== "verify-full"
) {
  process.exit(44);
}
const authorization = Buffer.from(
  JSON.stringify(JSON.parse(process.env.FAKE_AUTHORIZATION_PAYLOAD)),
  "utf8",
).toString("hex");
const defaultRoleResult = {
  server_version_num: 170006,
  required_role_count: 3,
  present_role_count: 3,
  component_roles: ["anon", "authenticated", "postgres"],
  role_fingerprint_sha256: "c".repeat(64),
  role_record_count: 5,
  database_container_fingerprint_sha256: "d".repeat(64),
  database_container_record_count: 12,
  database_container_invariant_violation_count: 0,
  required_extensions: ${JSON.stringify(REQUIRED_EXTENSIONS)},
  extension_fingerprint_sha256: "e".repeat(64),
  extension_record_count: 84,
  extension_contract_invariant_violation_count: 0,
  extension_contract_unsupported_class_count: 0,
  restore_user_superuser: true,
  restore_user_login: true,
  restore_user_outside_component: true,
  outside_component_login_role_count: 1,
  outside_component_superuser_role_count: 1,
};
const roleResultValue = process.env.FAKE_ROLE_RESULT
  ? { ...defaultRoleResult, ...JSON.parse(process.env.FAKE_ROLE_RESULT) }
  : defaultRoleResult;
const roleResult = Buffer.from(
  JSON.stringify(roleResultValue),
  "utf8",
).toString("hex");
process.stdin.setEncoding("utf8");
let input = "";
let sent = false;
process.stdin.on("data", (chunk) => {
  input += chunk;
  const forbiddenSql = JSON.parse(process.env.FAKE_FORBIDDEN_SQL || "[]");
  const requiredSql = JSON.parse(process.env.FAKE_REQUIRED_SQL || "[]");
  if (forbiddenSql.some((value) => input.includes(value))) {
    process.exit(42);
  }
  if (
    input.includes("FANMIND_ROLE_CHECK") &&
    requiredSql.some((value) => !input.includes(value))
  ) {
    process.exit(43);
  }
  if (!sent && input.includes("FANMIND_ROLE_CHECK")) {
    sent = true;
    process.stdout.write("FANMIND_ROLE_CHECK|" + roleResult + "\\n");
  } else if (!sent && input.includes("FANMIND_AUTHORIZATION_FRAME")) {
    sent = true;
    if (input.includes("pg_export_snapshot")) {
      process.stdout.write("FANMIND_SNAPSHOT|00000001-00000002-1\\n");
    }
    process.stdout.write("FANMIND_AUTHORIZATION|" + authorization + "\\n");
    if (input.includes("pg_export_snapshot")) {
      process.stdout.write("FANMIND_READY\\n");
    }
  }
});
`;
  await writeFile(fakePsqlPath, fakePsql, { encoding: "utf8", mode: 0o700 });
  await chmod(fakePsqlPath, 0o700);
  await writeFile(receiptPath, JSON.stringify(fullReceipt()), {
    encoding: "utf8",
    mode: 0o600,
  });
  await chmod(receiptPath, 0o600);
});

after(async () => {
  await rm(fixtureDirectory, { recursive: true, force: true });
});

test("validates nested snake_case contracts and exact role hashing", () => {
  assert.match(DATABASE_AUTHORIZATION_CONTRACT_SQL, /^\nwith recursive\n/u);
  const contract = validateAuthorizationContract({
    authorization_contract: {
      schema_version: 2,
      canonicalization: "postgresql-17-acl-json-array-hex-v2",
      fingerprint_sha256: "a".repeat(64),
      record_count: 1462,
      grant_tuple_count: 2463,
      required_roles: REQUIRED_ROLES,
      required_roles_sha256: REQUIRED_ROLES_SHA256,
      role_fingerprint_sha256: "c".repeat(64),
      role_record_count: 5,
      database_container_fingerprint_sha256: "d".repeat(64),
      database_container_record_count: 12,
      required_extensions: REQUIRED_EXTENSIONS,
      required_extensions_sha256: REQUIRED_EXTENSIONS_SHA256,
      extension_fingerprint_sha256: "e".repeat(64),
      extension_record_count: 84,
      core_table_app_grant_tuple_count: 120,
      restricted_security_definer_function_count: 12,
    },
  });
  assert.equal(contract.grantTupleCount, 2463);
  assert.deepEqual(contract.requiredRoles, REQUIRED_ROLES);
  assert.deepEqual(contract.requiredExtensions, REQUIRED_EXTENSIONS);
  assert.equal(contract.requiredExtensionsSha256, REQUIRED_EXTENSIONS_SHA256);
  assert.equal(contract.extensionRecordCount, 84);
  assert.throws(
    () => validateAuthorizationContract({ ...contract, schemaVersion: 1 }),
    /authorization_contract_schema_invalid/u,
  );
  assert.throws(
    () => validateAuthorizationContract({
      ...contract,
      requiredExtensions: REQUIRED_EXTENSIONS.map((extension, index) =>
        index === 0 ? { ...extension, owner: "attacker" } : extension,
      ),
    }),
    /authorization_contract_extensions_sha_invalid/u,
  );
  assert.throws(
    () => validateAuthorizationContract({
      ...contract,
      requiredRolesSha256: createHash("sha256")
        .update(`${JSON.stringify(REQUIRED_ROLES)}\n`, "utf8")
        .digest("hex"),
    }),
    /authorization_contract_roles_sha_invalid/u,
  );
});

test("captures and holds one repeatable-read exported snapshot", async () => {
  const previous = new Map([
    ["PGHOSTADDR", process.env.PGHOSTADDR],
    ["PGSERVICE", process.env.PGSERVICE],
    ["PGPASSWORD", process.env.PGPASSWORD],
    ["PGSSLMODE", process.env.PGSSLMODE],
  ]);
  process.env.PGHOSTADDR = "198.51.100.45";
  process.env.PGSERVICE = "ambient-hostile-service";
  process.env.PGPASSWORD = "ambient-hostile-password";
  process.env.PGSSLMODE = "disable";
  try {
    const snapshot = await openDatabaseAuthorizationSnapshot(
      connectionOptions(),
    );
    assert.equal(snapshot.snapshotId, "00000001-00000002-1");
    assert.equal(snapshot.contract.recordCount, 1462);
    assert.equal(snapshot.contract.grantTupleCount, 2463);
    await snapshot.close();
    await snapshot.close();
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("captures one-shot authorization and verifies receipt roles", async () => {
  const contract = await captureDatabaseAuthorizationContract(
    connectionOptions(),
  );
  assert.equal(contract.fingerprintSha256, "a".repeat(64));
  const result = await assertDatabaseAuthorizationRoles({
    ...connectionOptions(),
    receiptPath,
  });
  assert.deepEqual(result, { requiredRoleCount: 3, verified: true });
});

test("rejects a source with a noncanonical recovery extension inventory", async () => {
  const options = connectionOptions();
  options.env.FAKE_AUTHORIZATION_PAYLOAD = JSON.stringify({
    ...AUTHORIZATION_PAYLOAD,
    extension_recovery_invariant_violation_count: 1,
  });
  await assert.rejects(
    captureDatabaseAuthorizationContract(options),
    /authorization_extension_recovery_invariant_invalid/u,
  );
});

test("accepts the exact hardened trigger without changing the historical receipt contract", async () => {
  const legacy = await captureDatabaseAuthorizationContract(connectionOptions());
  const options = connectionOptions();
  options.env.FAKE_AUTHORIZATION_PAYLOAD = JSON.stringify({
    ...AUTHORIZATION_PAYLOAD,
    exposed_security_definer_exception_count: 0,
    hardened_security_definer_exception_count: 1,
  });
  const hardened = await captureDatabaseAuthorizationContract(options);
  // The new discriminator is a live SQL guard, not a new/rewritten receipt field.
  assert.deepEqual(hardened, legacy);
  assert.equal(validateAuthorizationContract(fullReceipt()).restrictedSecurityDefinerFunctionCount, 12);
  const snapshot = await openDatabaseAuthorizationSnapshot(options);
  try {
    assert.deepEqual(snapshot.contract, legacy);
  } finally {
    await snapshot.close();
  }
});

test("rejects missing, partial, duplicate and malformed trigger boundary states", async () => {
  for (const [exposed, hardened] of [[0, 0], [1, 1], [0, 2], [2, 0], [0, "1"], [1, undefined]]) {
    const options = connectionOptions();
    options.env.FAKE_AUTHORIZATION_PAYLOAD = JSON.stringify({
      ...AUTHORIZATION_PAYLOAD,
      exposed_security_definer_exception_count: exposed,
      hardened_security_definer_exception_count: hardened,
    });
    await assert.rejects(captureDatabaseAuthorizationContract(options), /authorization_security_definer_boundary_invalid/u);
  }
});

test("role preflight rejects an inbound membership component expansion", async () => {
  const options = connectionOptions();
  options.env.FAKE_ROLE_RESULT = JSON.stringify({
    server_version_num: 170006,
    required_role_count: 3,
    present_role_count: 3,
    component_roles: ["anon", "attacker_login", "authenticated", "postgres"],
    role_fingerprint_sha256: "d".repeat(64),
    role_record_count: 7,
    database_container_fingerprint_sha256: "d".repeat(64),
    database_container_record_count: 12,
    database_container_invariant_violation_count: 0,
    restore_user_superuser: true,
    restore_user_login: true,
    restore_user_outside_component: true,
    outside_component_login_role_count: 1,
    outside_component_superuser_role_count: 1,
  });
  await assert.rejects(
    assertDatabaseAuthorizationRoles({ ...options, receiptPath }),
    /authorization_role_contract_mismatch/u,
  );
});

test("role preflight rejects a database-container fingerprint mismatch", async () => {
  const options = connectionOptions();
  options.env.FAKE_ROLE_RESULT = JSON.stringify({
    server_version_num: 170006,
    required_role_count: 3,
    present_role_count: 3,
    component_roles: REQUIRED_ROLES,
    role_fingerprint_sha256: "c".repeat(64),
    role_record_count: 5,
    database_container_fingerprint_sha256: "9".repeat(64),
    database_container_record_count: 12,
    database_container_invariant_violation_count: 0,
    restore_user_superuser: true,
    restore_user_login: true,
    restore_user_outside_component: true,
    outside_component_login_role_count: 1,
    outside_component_superuser_role_count: 1,
  });
  await assert.rejects(
    assertDatabaseAuthorizationRoles({ ...options, receiptPath }),
    /authorization_database_container_contract_mismatch/u,
  );
});

test("role preflight rejects extension definition or inventory drift", async () => {
  const options = connectionOptions();
  options.env.FAKE_ROLE_RESULT = JSON.stringify({
    extension_fingerprint_sha256: "f".repeat(64),
  });
  await assert.rejects(
    assertDatabaseAuthorizationRoles({ ...options, receiptPath }),
    /authorization_extension_contract_mismatch/u,
  );
});

test("role preflight rejects an additional target login principal", async () => {
  const options = connectionOptions();
  options.env.FAKE_ROLE_RESULT = JSON.stringify({
    server_version_num: 170006,
    required_role_count: 3,
    present_role_count: 3,
    component_roles: REQUIRED_ROLES,
    role_fingerprint_sha256: "c".repeat(64),
    role_record_count: 5,
    database_container_fingerprint_sha256: "d".repeat(64),
    database_container_record_count: 12,
    database_container_invariant_violation_count: 0,
    restore_user_superuser: true,
    restore_user_login: true,
    restore_user_outside_component: true,
    outside_component_login_role_count: 2,
    outside_component_superuser_role_count: 1,
  });
  await assert.rejects(
    assertDatabaseAuthorizationRoles({ ...options, receiptPath }),
    /authorization_target_principal_boundary_invalid/u,
  );
});

test("role preflight rejects stale target collation metadata", async () => {
  const options = connectionOptions();
  options.env.FAKE_ROLE_RESULT = JSON.stringify({
    server_version_num: 170006,
    required_role_count: 3,
    present_role_count: 3,
    component_roles: REQUIRED_ROLES,
    role_fingerprint_sha256: "c".repeat(64),
    role_record_count: 5,
    database_container_fingerprint_sha256: "d".repeat(64),
    database_container_record_count: 12,
    database_container_invariant_violation_count: 1,
    restore_user_superuser: true,
    restore_user_login: true,
    restore_user_outside_component: true,
    outside_component_login_role_count: 1,
    outside_component_superuser_role_count: 1,
  });
  await assert.rejects(
    assertDatabaseAuthorizationRoles({ ...options, receiptPath }),
    /authorization_database_container_invariant_invalid/u,
  );
});

test("role preflight hex-encodes quote and backslash role names", async () => {
  const adversarialRoles = ["back\\slash", "quote'role"];
  const adversarialRolesSha256 = createHash("sha256")
    .update(JSON.stringify(adversarialRoles), "utf8")
    .digest("hex");
  await writeFile(receiptPath, JSON.stringify(fullReceipt({
    databaseAuthorizationRequiredRoles: adversarialRoles,
    databaseAuthorizationRequiredRolesSha256: adversarialRolesSha256,
    databaseAuthorizationRoleFingerprintSha256: "e".repeat(64),
    databaseAuthorizationRoleRecordCount: 2,
  })), { encoding: "utf8", mode: 0o600 });
  const options = connectionOptions();
  options.env.FAKE_ROLE_RESULT = JSON.stringify({
    server_version_num: 170006,
    required_role_count: 2,
    present_role_count: 2,
    component_roles: adversarialRoles,
    role_fingerprint_sha256: "e".repeat(64),
    role_record_count: 2,
    database_container_fingerprint_sha256: "d".repeat(64),
    database_container_record_count: 12,
    database_container_invariant_violation_count: 0,
    restore_user_superuser: true,
    restore_user_login: true,
    restore_user_outside_component: true,
    outside_component_login_role_count: 1,
    outside_component_superuser_role_count: 1,
  });
  options.env.FAKE_FORBIDDEN_SQL = JSON.stringify(adversarialRoles);
  options.env.FAKE_REQUIRED_SQL = JSON.stringify([
    "set local standard_conforming_strings = on",
    "role_definition.rolconnlimit",
    "role_definition.rolvaliduntil at time zone 'UTC'",
    "role_definition.rolconfig",
    "grantor_role.rolname",
    "membership.grantor",
    "outside_component_login_role_count",
    "database_container_payload",
    "pg_database_collation_actual_version",
    ...adversarialRoles.map((role) => Buffer.from(role, "utf8").toString("hex")),
  ]);
  const result = await assertDatabaseAuthorizationRoles({
    ...options,
    receiptPath,
  });
  assert.deepEqual(result, { requiredRoleCount: 2, verified: true });
  await writeFile(receiptPath, JSON.stringify(fullReceipt()), {
    encoding: "utf8",
    mode: 0o600,
  });
});

test("target projection excludes only the encoded restore login from the source role seed", () => {
  const targetLogin = "fanmind_restore_bootstrap";
  const encodedLogin = Buffer.from(targetLogin, "utf8").toString("hex");
  const projected = authorizationContractSqlExcludingTargetLogin(targetLogin);

  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /where login_role\.rolcanlogin/u,
  );
  assert.doesNotMatch(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /login_role\.rolname <>/u,
  );
  assert.match(
    projected,
    new RegExp(
      `where login_role\\.rolcanlogin\\s+and login_role\\.rolname <> ` +
        `pg_catalog\\.convert_from\\(pg_catalog\\.decode\\('${encodedLogin}', 'hex'\\), 'UTF8'\\)`,
      "u",
    ),
  );
  assert.doesNotMatch(projected, /fanmind_restore_bootstrap/u);
  assert.equal(
    projected.match(/and login_role\.rolname <>/gu)?.length,
    1,
  );
  assert.throws(
    () => authorizationContractSqlExcludingTargetLogin("restore\noperator"),
    /authorization_target_projection_role_invalid/u,
  );
});

test("SQL scope mirrors pg_dump ACL selection and fixed recovery guards", () => {
  assert.doesNotMatch(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /is distinct from initial_privileges\.initprivs/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /scope\.dump_all[\s\S]+?namespace\.nspname = 'pg_catalog'[\s\S]+?extension_member\.objid is not null/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /filtered_acl_objects[\s\S]+?except[\s\S]+?baseline_privilege/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /aclexplode\([\s\S]+?nullif\(coalesce\([\s\S]+?'\{\}'::pg_catalog\.aclitem\[\]\)/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /nullif\(object_definition\.init_acl, '\{\}'::pg_catalog\.aclitem\[\]\)/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /default_privileges\.defaclnamespace[\s\S]+?scope\.dump_all[\s\S]+?scope\.nspname = 'pg_catalog'/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /core_relation_names[\s\S]+?core_privilege_names[\s\S]+?not privilege\.is_grantable/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /expected_recovery_extensions[\s\S]+?1e2296ca95301c346504d97552fff0d38cf81755653ce24687a261a8e97b7a9e/iu,
  );
  assert.doesNotMatch(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /count\(\*\) from pg_catalog\.pg_extension\) = 2/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /recovery_extension_member_namespace_violations[\s\S]+?function_definition\.pronamespace <> extension\.extnamespace/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /user_mapping_role[\s\S]+?server_extension_member\.objid is null/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /extended_statistics[\s\S]+?statistics\.stxrelid[\s\S]+?relation_scope\.dump_all[\s\S]+?relation_extension_member\.objid is null/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /container_recovery_invariants[\s\S]+?public_security_definer_totals/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /database_container_records[\s\S]+?'profile'[\s\S]+?datcollversion[\s\S]+?'acl'[\s\S]+?'role_setting'/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /extension_contract_member_addresses[\s\S]+?derived_dependency\.deptype in \('i', 'a', 'P', 'S'\)/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /pg_get_functiondef[\s\S]+?indexDefinition[\s\S]+?arrayType[\s\S]+?pg_get_ruledef/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /toast table for[\s\S]+?toast index for/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /pg_init_privs[\s\S]+?nullif\(initial_privileges\.initprivs, '\{\}'::pg_catalog\.aclitem\[\]\)/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /current_database_acl[\s\S]+?aclexplode\([\s\S]+?nullif\(coalesce\([\s\S]+?database_definition\.datacl/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /pg_database_collation_actual_version[\s\S]+?actual_collversion is distinct from[\s\S]+?datcollversion/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /pg_db_role_setting[\s\S]+?database_definition\.oid = setting\.setdatabase/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /select login_role\.oid[\s\S]+?where login_role\.rolcanlogin/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /membership\.member,[\s\S]+?membership\.roleid,[\s\S]+?membership\.grantor/iu,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /role_definition\.rolconnlimit[\s\S]+?rolvaliduntil at time zone 'UTC'[\s\S]+?role_definition\.rolconfig/iu,
  );
  assert.doesNotMatch(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /153\.121|app\.settings\.jwt_exp=3600/u,
  );
  assert.match(
    DATABASE_AUTHORIZATION_CONTRACT_SQL,
    /rolname = 'service_role'[\s\S]+?'EXECUTE'/iu,
  );
});

test("recovery inventory hash matches the runner's exact function inventory", async () => {
  const runner = await readFile(
    resolve("scripts/operations/run-database-restore-drill.sh"),
    "utf8",
  );
  const expectedFunction = /^\s*\('([^']+)', '([^']+)', '([^']*)', '([^']+)', '([^']+)', (true|false), '([^']+)', '([^']+)'\),?$/gmu;
  const records = [...runner.matchAll(expectedFunction)].map((match) => {
    const [
      , extname, proname, identityArguments, cSymbol, resultType,
      isStrict, volatility, parallelSafety,
    ] = match;
    return [
      "function",
      extname,
      proname,
      identityArguments,
      `$libdir/${extname}`,
      cSymbol,
      resultType,
      "f",
      "c",
      isStrict === "true",
      volatility,
      parallelSafety,
      false,
      false,
      true,
      true,
      true,
      true,
      0,
      true,
      1,
      resultType.startsWith("SETOF ") ? 1000 : 0,
    ];
  });
  assert.equal(records.length, 39);
  records.push([
    "language",
    "plpgsql",
    "plpgsql",
    true,
    true,
    "plpgsql_call_handler",
    "",
    "plpgsql_inline_handler",
    "internal",
    "plpgsql_validator",
    "oid",
    true,
  ]);
  const payload = records
    .map((record) => Buffer.from(
      `[${record.map((value) => JSON.stringify(value)).join(", ")}]`,
      "utf8",
    ).toString("hex"))
    .sort()
    .join("\n") + "\n";
  assert.equal(
    createHash("sha256").update(payload, "utf8").digest("hex"),
    "1e2296ca95301c346504d97552fff0d38cf81755653ce24687a261a8e97b7a9e",
  );
});

test("analyzes only strict active ACL and DEFAULT ACL TOC entries", () => {
  const toc = [
    "; Archive created at 2026-08-15",
    "1; 0 0 ACL TABLE public.contacts postgres",
    "2; 0 0 DEFAULT ACL SCHEMA public postgres",
    "3; 1259 42 TABLE public.contacts postgres",
    "",
  ].join("\n");
  assert.deepEqual(analyzeAuthorizationToc(toc), {
    aclEntryCount: 1,
    defaultAclEntryCount: 1,
    sha256: createHash("sha256")
      .update(
        "1; 0 0 ACL TABLE public.contacts postgres\n" +
        "2; 0 0 DEFAULT ACL SCHEMA public postgres\n",
        "utf8",
      )
      .digest("hex"),
  });
  assert.throws(
    () => analyzeAuthorizationToc("1;  0 0 ACL TABLE public.contacts postgres\n"),
    /authorization_toc_invalid/u,
  );
});

test("snapshot-target requires and binds the Full Receipt v2 contract", async () => {
  const args = [
    MODULE_PATH,
    "snapshot-target",
    "--receipt",
    receiptPath,
    "--psql-bin",
    fakePsqlPath,
    "--host",
    HOST,
    "--port",
    PORT,
    "--username",
    USERNAME,
    "--dbname",
    DATABASE,
  ];
  const environment = {
    ...process.env,
    FAKE_AUTHORIZATION_PAYLOAD: JSON.stringify(AUTHORIZATION_PAYLOAD),
    FAKE_HOST: HOST,
    FAKE_PORT: PORT,
    FAKE_USERNAME: USERNAME,
    FAKE_DATABASE: DATABASE,
    PGHOSTADDR: "192.0.2.12",
    PGSERVICE: "cli-hostile-service",
    PGPASSWORD: "cli-hostile-password",
    PGSSLMODE: "verify-full",
  };
  const pass = spawnSync(process.execPath, args, {
    encoding: "utf8",
    env: environment,
  });
  assert.equal(pass.status, 0);
  assert.equal(
    pass.stdout,
    `authorization|${"a".repeat(64)}|1462|2463|120|12|` +
      `${REQUIRED_EXTENSIONS_SHA256}|2|${"e".repeat(64)}|84\n`,
  );
  assert.equal(pass.stderr, "");

  const roleBoundaryFail = spawnSync(process.execPath, args, {
    encoding: "utf8",
    env: {
      ...environment,
      FAKE_ROLE_RESULT: JSON.stringify({
        server_version_num: 170006,
        required_role_count: REQUIRED_ROLES.length,
        present_role_count: REQUIRED_ROLES.length,
        component_roles: REQUIRED_ROLES,
        role_fingerprint_sha256: "c".repeat(64),
        role_record_count: 5,
        database_container_fingerprint_sha256: "d".repeat(64),
        database_container_record_count: 12,
        database_container_invariant_violation_count: 0,
        restore_user_superuser: true,
        restore_user_login: true,
        restore_user_outside_component: true,
        outside_component_login_role_count: 2,
        outside_component_superuser_role_count: 1,
      }),
    },
  });
  assert.equal(roleBoundaryFail.status, 1);
  assert.equal(roleBoundaryFail.stdout, "");
  assert.equal(roleBoundaryFail.stderr, "AUTHORIZATION=ERROR\n");

  await writeFile(
    receiptPath,
    JSON.stringify(fullReceipt({
      databaseAuthorizationFingerprintSha256: "b".repeat(64),
    })),
    { encoding: "utf8", mode: 0o600 },
  );
  const fail = spawnSync(process.execPath, args, {
    encoding: "utf8",
    env: environment,
  });
  assert.equal(fail.status, 1);
  assert.equal(fail.stdout, "");
  assert.equal(fail.stderr, "AUTHORIZATION=ERROR\n");
});
