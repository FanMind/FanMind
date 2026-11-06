#!/usr/bin/env node

import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertDatabaseAuthorizationRoles,
  captureProjectedTargetAuthorizationContract,
  validateAuthorizationContract,
} from "./database-authorization-contract.mjs";

const MAX_RECEIPT_BYTES = 16 * 1024;
const MAX_PROCESS_OUTPUT_BYTES = 256 * 1024;
const PROCESS_TIMEOUT_MS = 60_000;
const ALLOWED_LIBPQ_ENVIRONMENT = Object.freeze([
  "PGPASSFILE",
  "PGSSLMODE",
  "PGSSLROOTCERT",
  "PGGSSENCMODE",
  "PGCONNECT_TIMEOUT",
]);
const REQUIRED_SCHEMA_NAMES = Object.freeze(["graphql", "graphql_public"]);
const REQUIRED_ROLE_NAMES = Object.freeze([
  "anon",
  "authenticated",
  "postgres",
  "service_role",
  "supabase_admin",
]);
const OWNER_ONLY_ACL = Object.freeze([
  Object.freeze(["supabase_admin", "supabase_admin", "CREATE", false]),
  Object.freeze(["supabase_admin", "supabase_admin", "USAGE", false]),
]);
const RECOVERED_ACL = Object.freeze([
  Object.freeze(["anon", "supabase_admin", "USAGE", false]),
  Object.freeze(["authenticated", "supabase_admin", "USAGE", false]),
  Object.freeze(["postgres", "supabase_admin", "USAGE", true]),
  Object.freeze(["service_role", "supabase_admin", "USAGE", false]),
  ...OWNER_ONLY_ACL,
].sort(compareTuple));

function fixedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function compareTuple(left, right) {
  return JSON.stringify(left).localeCompare(JSON.stringify(right), "en");
}

function equalJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function authorizationContractsEqual(left, right) {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.canonicalization === right.canonicalization &&
    left.fingerprintSha256 === right.fingerprintSha256 &&
    left.recordCount === right.recordCount &&
    left.grantTupleCount === right.grantTupleCount &&
    equalJson(left.requiredRoles, right.requiredRoles) &&
    left.requiredRolesSha256 === right.requiredRolesSha256 &&
    left.roleFingerprintSha256 === right.roleFingerprintSha256 &&
    left.roleRecordCount === right.roleRecordCount &&
    left.databaseContainerFingerprintSha256 ===
      right.databaseContainerFingerprintSha256 &&
    left.databaseContainerRecordCount === right.databaseContainerRecordCount &&
    equalJson(left.requiredExtensions, right.requiredExtensions) &&
    left.requiredExtensionsSha256 === right.requiredExtensionsSha256 &&
    left.extensionFingerprintSha256 === right.extensionFingerprintSha256 &&
    left.extensionRecordCount === right.extensionRecordCount &&
    left.coreTableAppGrantTupleCount === right.coreTableAppGrantTupleCount &&
    left.restrictedSecurityDefinerFunctionCount ===
      right.restrictedSecurityDefinerFunctionCount
  );
}

export function classifySchemaAclRecovery(expected, actual) {
  if (authorizationContractsEqual(expected, actual)) return "not_needed";

  const invariantMatch =
    expected.schemaVersion === actual.schemaVersion &&
    expected.canonicalization === actual.canonicalization &&
    expected.recordCount === actual.recordCount &&
    equalJson(expected.requiredRoles, actual.requiredRoles) &&
    expected.requiredRolesSha256 === actual.requiredRolesSha256 &&
    expected.roleFingerprintSha256 === actual.roleFingerprintSha256 &&
    expected.roleRecordCount === actual.roleRecordCount &&
    expected.databaseContainerFingerprintSha256 ===
      actual.databaseContainerFingerprintSha256 &&
    expected.databaseContainerRecordCount === actual.databaseContainerRecordCount &&
    equalJson(expected.requiredExtensions, actual.requiredExtensions) &&
    expected.requiredExtensionsSha256 === actual.requiredExtensionsSha256 &&
    expected.extensionFingerprintSha256 === actual.extensionFingerprintSha256 &&
    expected.extensionRecordCount === actual.extensionRecordCount &&
    expected.coreTableAppGrantTupleCount === actual.coreTableAppGrantTupleCount &&
    expected.restrictedSecurityDefinerFunctionCount ===
      actual.restrictedSecurityDefinerFunctionCount;

  if (!invariantMatch) {
    throw fixedError("schema_acl_recovery_contract_boundary_mismatch");
  }
  if (expected.fingerprintSha256 === actual.fingerprintSha256) {
    throw fixedError("schema_acl_recovery_fingerprint_delta_invalid");
  }
  if (expected.grantTupleCount - actual.grantTupleCount !== 8) {
    throw fixedError("schema_acl_recovery_grant_delta_invalid");
  }
  return "repair_required";
}

async function readStablePrivateReceipt(path) {
  const receiptPath = clean(path);
  if (!isAbsolute(receiptPath) || /[\u0000\r\n]/u.test(receiptPath)) {
    throw fixedError("schema_acl_recovery_receipt_path_invalid");
  }

  let handle;
  try {
    handle = await open(receiptPath, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    throw fixedError("schema_acl_recovery_receipt_read_failed");
  }

  try {
    const before = await handle.stat({ bigint: true });
    if (
      !before.isFile() ||
      before.nlink !== 1n ||
      typeof process.getuid !== "function" ||
      before.uid !== BigInt(process.getuid()) ||
      (before.mode & 0o777n) !== 0o600n ||
      before.size <= 0n ||
      before.size > BigInt(MAX_RECEIPT_BYTES)
    ) {
      throw fixedError("schema_acl_recovery_receipt_invalid");
    }

    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs ||
      BigInt(bytes.length) !== before.size
    ) {
      bytes.fill(0);
      throw fixedError("schema_acl_recovery_receipt_changed_during_read");
    }

    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      const parsed = JSON.parse(text);
      return validateAuthorizationContract(parsed);
    } catch (error) {
      if (typeof error?.message === "string" && error.message.startsWith("authorization_")) {
        throw error;
      }
      throw fixedError("schema_acl_recovery_receipt_json_invalid");
    } finally {
      bytes.fill(0);
    }
  } finally {
    await handle.close();
  }
}

function validateConnectionOptions(options) {
  if (!isRecord(options)) throw fixedError("schema_acl_recovery_options_invalid");
  const psqlBin = clean(options.psqlBin);
  const host = clean(options.host);
  const port = clean(options.port);
  const username = clean(options.username);
  const database = clean(options.database);
  if (!isAbsolute(psqlBin)) throw fixedError("schema_acl_recovery_psql_invalid");
  if (!host || host.length > 255 || /[\u0000\r\n]/u.test(host)) {
    throw fixedError("schema_acl_recovery_host_invalid");
  }
  if (!/^\d{1,5}$/u.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw fixedError("schema_acl_recovery_port_invalid");
  }
  for (const value of [username, database]) {
    if (!value || Buffer.byteLength(value, "utf8") > 63 || /[\u0000\r\n]/u.test(value)) {
      throw fixedError("schema_acl_recovery_database_identity_invalid");
    }
  }
  return Object.freeze({
    psqlBin,
    host,
    port,
    username,
    database,
    env: isRecord(options.env) ? options.env : {},
  });
}

function psqlEnvironment(environment, applicationName, readOnly) {
  const safeEnvironment = Object.fromEntries(
    Object.entries(environment).filter(([name]) => !name.startsWith("PG")),
  );
  for (const name of ALLOWED_LIBPQ_ENVIRONMENT) {
    if (Object.hasOwn(environment, name)) safeEnvironment[name] = environment[name];
  }
  return {
    ...safeEnvironment,
    LANG: "C",
    LC_ALL: "C",
    PGAPPNAME: applicationName,
    PGOPTIONS: readOnly
      ? "-c default_transaction_read_only=on -c search_path=pg_catalog,pg_temp"
      : "-c search_path=pg_catalog,pg_temp",
  };
}

function runPsql(connection, sql, { applicationName, readOnly }) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      connection.psqlBin,
      [
        "--no-psqlrc",
        "--no-align",
        "--tuples-only",
        "--quiet",
        "--set",
        "ON_ERROR_STOP=1",
        "--no-password",
        "--host",
        connection.host,
        "--port",
        connection.port,
        "--username",
        connection.username,
        "--dbname",
        connection.database,
      ],
      {
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        env: psqlEnvironment(connection.env, applicationName, readOnly),
      },
    );

    let stdout = Buffer.alloc(0);
    let stderrBytes = 0;
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(fixedError("schema_acl_recovery_query_timeout"));
    }, PROCESS_TIMEOUT_MS);

    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolvePromise(value);
    }

    child.once("error", () => finish(fixedError("schema_acl_recovery_psql_start_failed")));
    child.stdin.once("error", () => finish(fixedError("schema_acl_recovery_query_failed")));
    child.stdout.on("data", (chunk) => {
      if (stdout.length + chunk.length > MAX_PROCESS_OUTPUT_BYTES) {
        child.kill("SIGTERM");
        finish(fixedError("schema_acl_recovery_output_invalid"));
        return;
      }
      stdout = Buffer.concat([stdout, chunk]);
    });
    child.stderr.on("data", (chunk) => {
      stderrBytes += chunk.length;
      if (stderrBytes > MAX_PROCESS_OUTPUT_BYTES) {
        child.kill("SIGTERM");
        finish(fixedError("schema_acl_recovery_output_invalid"));
      }
    });
    child.once("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        finish(fixedError("schema_acl_recovery_query_failed"));
        return;
      }
      let text;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(stdout);
      } catch {
        finish(fixedError("schema_acl_recovery_output_invalid"));
        return;
      }
      finish(null, text.trim());
    });

    child.stdin.end(sql);
  });
}

function schemaStateSql() {
  return String.raw`
begin isolation level repeatable read, read only;
set local search_path = pg_catalog, pg_temp;
with required_schemas(schema_name) as (
  values ('graphql'), ('graphql_public')
), required_roles(role_name) as (
  values ('anon'), ('authenticated'), ('postgres'), ('service_role'), ('supabase_admin')
), schema_state as (
  select
    required.schema_name,
    owner_role.rolname as owner_name,
    exists (
      select 1
      from pg_catalog.pg_depend as dependency
      where dependency.classid = 'pg_catalog.pg_namespace'::pg_catalog.regclass
        and dependency.objid = namespace.oid
        and dependency.objsubid = 0
        and dependency.refclassid = 'pg_catalog.pg_extension'::pg_catalog.regclass
        and dependency.deptype = 'e'
    ) as extension_member,
    coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_array(
          case when privilege.grantee = 0 then 'PUBLIC' else grantee_role.rolname end,
          grantor_role.rolname,
          privilege.privilege_type,
          privilege.is_grantable
        )
        order by
          (case when privilege.grantee = 0 then 'PUBLIC' else grantee_role.rolname end) collate "C",
          grantor_role.rolname collate "C",
          privilege.privilege_type collate "C",
          privilege.is_grantable
      )
      from pg_catalog.aclexplode(
        nullif(coalesce(
          namespace.nspacl,
          pg_catalog.acldefault('n'::"char", namespace.nspowner)
        ), '{}'::pg_catalog.aclitem[])
      ) as privilege
      left join pg_catalog.pg_roles as grantee_role
        on grantee_role.oid = privilege.grantee and privilege.grantee <> 0
      left join pg_catalog.pg_roles as grantor_role
        on grantor_role.oid = privilege.grantor
    ), '[]'::pg_catalog.jsonb) as acl_entries
  from required_schemas as required
  left join pg_catalog.pg_namespace as namespace
    on namespace.nspname = required.schema_name
  left join pg_catalog.pg_roles as owner_role
    on owner_role.oid = namespace.nspowner
), payload as (
  select pg_catalog.jsonb_build_object(
    'schemaCount', (select count(*) from schema_state where owner_name is not null),
    'requiredRoleCount', (
      select count(*)
      from required_roles as required
      join pg_catalog.pg_roles as role_definition
        on role_definition.rolname = required.role_name
    ),
    'schemas', (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'name', schema_name,
          'owner', owner_name,
          'extensionMember', extension_member,
          'acl', acl_entries
        ) order by schema_name collate "C"
      ) from schema_state
    )
  ) as value
)
select 'FANMIND_SCHEMA_ACL_STATE|' || pg_catalog.encode(
  pg_catalog.convert_to(value::text, 'UTF8'),
  'hex'
)
from payload;
rollback;
`;
}

function decodeStateFrame(output) {
  const lines = output.split(/\r?\n/u).filter(Boolean);
  if (lines.length !== 1 || !lines[0].startsWith("FANMIND_SCHEMA_ACL_STATE|")) {
    throw fixedError("schema_acl_recovery_state_output_invalid");
  }
  const hex = lines[0].slice("FANMIND_SCHEMA_ACL_STATE|".length);
  if (!/^(?:[0-9a-f]{2})+$/u.test(hex) || hex.length > MAX_PROCESS_OUTPUT_BYTES) {
    throw fixedError("schema_acl_recovery_state_output_invalid");
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(hex, "hex"));
    return JSON.parse(text);
  } catch {
    throw fixedError("schema_acl_recovery_state_output_invalid");
  }
}

export function validateSchemaAclState(state, expectedAcl) {
  if (
    !isRecord(state) ||
    state.schemaCount !== 2 ||
    state.requiredRoleCount !== REQUIRED_ROLE_NAMES.length ||
    !Array.isArray(state.schemas) ||
    state.schemas.length !== 2
  ) {
    throw fixedError("schema_acl_recovery_state_invalid");
  }

  const sorted = [...state.schemas].sort((left, right) =>
    String(left?.name ?? "").localeCompare(String(right?.name ?? ""), "en"),
  );
  if (sorted.some((entry, index) => entry?.name !== REQUIRED_SCHEMA_NAMES[index])) {
    throw fixedError("schema_acl_recovery_schema_identity_invalid");
  }

  for (const entry of sorted) {
    if (
      entry.owner !== "supabase_admin" ||
      entry.extensionMember !== false ||
      !Array.isArray(entry.acl)
    ) {
      throw fixedError("schema_acl_recovery_schema_boundary_invalid");
    }
    const acl = [...entry.acl].sort(compareTuple);
    if (!equalJson(acl, expectedAcl)) {
      throw fixedError("schema_acl_recovery_acl_precondition_invalid");
    }
  }
  return true;
}

function mutationPreconditionSql(expectedMode) {
  const expectedAclCount = expectedMode === "owner_only" ? 2 : 6;
  const allowedAcl = expectedMode === "owner_only"
    ? String.raw`(
          privilege.grantee = 'supabase_admin'::pg_catalog.regrole
          and privilege.grantor = 'supabase_admin'::pg_catalog.regrole
          and privilege.privilege_type in ('CREATE', 'USAGE')
          and not privilege.is_grantable
        )`
    : String.raw`(
          (privilege.grantee = 'supabase_admin'::pg_catalog.regrole
            and privilege.grantor = 'supabase_admin'::pg_catalog.regrole
            and privilege.privilege_type in ('CREATE', 'USAGE')
            and not privilege.is_grantable)
          or (privilege.grantee = 'anon'::pg_catalog.regrole
            and privilege.grantor = 'supabase_admin'::pg_catalog.regrole
            and privilege.privilege_type = 'USAGE'
            and not privilege.is_grantable)
          or (privilege.grantee = 'authenticated'::pg_catalog.regrole
            and privilege.grantor = 'supabase_admin'::pg_catalog.regrole
            and privilege.privilege_type = 'USAGE'
            and not privilege.is_grantable)
          or (privilege.grantee = 'service_role'::pg_catalog.regrole
            and privilege.grantor = 'supabase_admin'::pg_catalog.regrole
            and privilege.privilege_type = 'USAGE'
            and not privilege.is_grantable)
          or (privilege.grantee = 'postgres'::pg_catalog.regrole
            and privilege.grantor = 'supabase_admin'::pg_catalog.regrole
            and privilege.privilege_type = 'USAGE'
            and privilege.is_grantable)
        )`;

  return String.raw`
do $fanmind$
begin
  if (select count(*) from pg_catalog.pg_roles where rolname in (
    'anon', 'authenticated', 'postgres', 'service_role', 'supabase_admin'
  )) <> 5 then
    raise exception 'fanmind_schema_acl_role_boundary';
  end if;

  if (select count(*) from pg_catalog.pg_namespace where nspname in (
    'graphql', 'graphql_public'
  ) and nspowner = 'supabase_admin'::pg_catalog.regrole) <> 2 then
    raise exception 'fanmind_schema_acl_schema_boundary';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_namespace as namespace
    join pg_catalog.pg_depend as dependency
      on dependency.classid = 'pg_catalog.pg_namespace'::pg_catalog.regclass
     and dependency.objid = namespace.oid
     and dependency.objsubid = 0
     and dependency.refclassid = 'pg_catalog.pg_extension'::pg_catalog.regclass
     and dependency.deptype = 'e'
    where namespace.nspname in ('graphql', 'graphql_public')
  ) then
    raise exception 'fanmind_schema_acl_extension_boundary';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_namespace as namespace
    cross join lateral pg_catalog.aclexplode(
      nullif(coalesce(
        namespace.nspacl,
        pg_catalog.acldefault('n'::"char", namespace.nspowner)
      ), '{}'::pg_catalog.aclitem[])
    ) as privilege
    where namespace.nspname in ('graphql', 'graphql_public')
      and not ${allowedAcl}
  ) then
    raise exception 'fanmind_schema_acl_unexpected_entry';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_namespace as namespace
    where namespace.nspname in ('graphql', 'graphql_public')
      and (
        select count(*)
        from pg_catalog.aclexplode(
          nullif(coalesce(
            namespace.nspacl,
            pg_catalog.acldefault('n'::"char", namespace.nspowner)
          ), '{}'::pg_catalog.aclitem[])
        )
      ) <> ${expectedAclCount}
  ) then
    raise exception 'fanmind_schema_acl_count_boundary';
  end if;
end
$fanmind$;
`;
}

export function recoverySql() {
  return String.raw`
begin;
select pg_catalog.pg_advisory_xact_lock(20260820, 731001);
${mutationPreconditionSql("owner_only")}
set role supabase_admin;
grant usage on schema graphql, graphql_public to anon, authenticated, service_role;
grant usage on schema graphql, graphql_public to postgres with grant option;
reset role;
commit;
`;
}

export function rollbackSql() {
  return String.raw`
begin;
select pg_catalog.pg_advisory_xact_lock(20260820, 731001);
${mutationPreconditionSql("recovered")}
set role supabase_admin;
revoke usage on schema graphql, graphql_public from anon, authenticated, service_role;
revoke usage on schema graphql, graphql_public from postgres;
reset role;
commit;
`;
}

async function captureState(connection) {
  const output = await runPsql(connection, schemaStateSql(), {
    applicationName: "fanmind-restore-schema-acl-state",
    readOnly: true,
  });
  return decodeStateFrame(output);
}

async function rollbackAndVerify(connection, beforeContract) {
  await runPsql(connection, rollbackSql(), {
    applicationName: "fanmind-restore-schema-acl-rollback",
    readOnly: false,
  });
  validateSchemaAclState(await captureState(connection), OWNER_ONLY_ACL);
  const rolledBack = await captureProjectedTargetAuthorizationContract({
    ...connection,
    env: connection.env,
  });
  if (!authorizationContractsEqual(rolledBack, beforeContract)) {
    throw fixedError("schema_acl_recovery_rollback_verification_failed");
  }
}

export async function recoverSupabaseSchemaAcls(options) {
  const connection = validateConnectionOptions(options);
  const expectedContract = await readStablePrivateReceipt(options.receiptPath);

  // This preflight proves the connected restore principal is the one and only
  // login/superuser outside the receipt-bound source role component. Only after
  // that proof may the target snapshot exclude that exact target-only login.
  await assertDatabaseAuthorizationRoles({
    receiptPath: options.receiptPath,
    ...connection,
    env: connection.env,
  });
  const beforeContract = await captureProjectedTargetAuthorizationContract({
    ...connection,
    env: connection.env,
  });
  const classification = classifySchemaAclRecovery(expectedContract, beforeContract);
  if (classification === "not_needed") {
    return Object.freeze({ status: "not_needed" });
  }

  validateSchemaAclState(await captureState(connection), OWNER_ONLY_ACL);

  try {
    await runPsql(connection, recoverySql(), {
      applicationName: "fanmind-restore-schema-acl-apply",
      readOnly: false,
    });
  } catch (error) {
    const afterFailure = await captureProjectedTargetAuthorizationContract({
      ...connection,
      env: connection.env,
    }).catch(() => null);
    if (afterFailure && !authorizationContractsEqual(afterFailure, beforeContract)) {
      throw fixedError("schema_acl_recovery_indeterminate_write");
    }
    throw error;
  }

  try {
    validateSchemaAclState(await captureState(connection), RECOVERED_ACL);
    const afterContract = await captureProjectedTargetAuthorizationContract({
      ...connection,
      env: connection.env,
    });
    if (!authorizationContractsEqual(afterContract, expectedContract)) {
      await rollbackAndVerify(connection, beforeContract);
      throw fixedError("schema_acl_recovery_postcheck_mismatch");
    }
  } catch (error) {
    if (error?.message === "schema_acl_recovery_postcheck_mismatch") throw error;
    try {
      await rollbackAndVerify(connection, beforeContract);
    } catch {
      throw fixedError("schema_acl_recovery_rollback_failed");
    }
    throw error;
  }

  return Object.freeze({ status: "applied" });
}

function parseCli(argv) {
  if (argv[2] !== "apply") throw fixedError("schema_acl_recovery_cli_invalid");
  const allowed = new Map([
    ["--receipt", "receiptPath"],
    ["--psql-bin", "psqlBin"],
    ["--host", "host"],
    ["--port", "port"],
    ["--username", "username"],
    ["--dbname", "database"],
  ]);
  const values = {};
  for (let index = 3; index < argv.length; index += 2) {
    const key = allowed.get(argv[index]);
    const value = argv[index + 1];
    if (!key || value === undefined || values[key] !== undefined) {
      throw fixedError("schema_acl_recovery_cli_invalid");
    }
    values[key] = value;
  }
  if (["receiptPath", "psqlBin", "host", "port", "username", "database"].some(
    (key) => values[key] === undefined,
  )) {
    throw fixedError("schema_acl_recovery_cli_invalid");
  }
  return values;
}

async function main() {
  const values = parseCli(process.argv);
  const result = await recoverSupabaseSchemaAcls({
    ...values,
    env: process.env,
  });
  process.stdout.write(
    result.status === "applied"
      ? "SCHEMA_ACL_RECOVERY=APPLIED\n"
      : "SCHEMA_ACL_RECOVERY=NOT_NEEDED\n",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const code = typeof error?.message === "string" && /^[a-z0-9_]+$/u.test(error.message)
      ? error.message
      : "schema_acl_recovery_failed";
    process.stderr.write("SCHEMA_ACL_RECOVERY=ERROR\n");
    process.stderr.write(`SCHEMA_ACL_RECOVERY_ERROR=${code}\n`);
    process.exitCode = 1;
  });
}
