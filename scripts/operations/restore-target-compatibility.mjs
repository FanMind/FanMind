#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import {
  chmod,
  mkdtemp,
  open,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { evaluateRestoreReadiness } from "../../src/lib/restoreTargetPolicy.mjs";
import { readStablePrivateFile } from "./verify-full-backup-restore-receipt.mjs";

export const RESTORE_TARGET_COMPATIBILITY_CONFIRMATION =
  "verify-read-only-restore-target";
export const REQUIRED_RESTORE_ROLES = Object.freeze([
  "anon",
  "authenticated",
  "service_role",
]);
export const REQUIRED_RESTORE_EXTENSIONS = Object.freeze(["pgcrypto"]);
export const RESTORE_TARGET_COMPATIBILITY_SQL = String.raw`
select
  settings.setting::integer,
  (select count(*) from pg_catalog.pg_roles where rolname in ('anon', 'authenticated', 'service_role')),
  (select count(*)
     from pg_catalog.pg_extension as extension
     join pg_catalog.pg_namespace as namespace
       on namespace.oid = extension.extnamespace
    where extension.extname = 'pgcrypto'
      and extension.extversion = '1.3'
      and extension.extrelocatable
      and namespace.nspname = 'extensions'
      and extension.extconfig is null
      and extension.extcondition is null),
  (select count(*)
     from pg_catalog.pg_roles as restore_role
    where restore_role.rolname = current_user
      and restore_role.rolsuper)
from pg_catalog.pg_settings as settings
where settings.name = 'server_version_num';
`.trim();

const PSQL_BIN = "/usr/lib/postgresql/17/bin/psql";
const TEST_MODE = "restore-target-compatibility-test";
const MAX_CA_CERT_BYTES = 1024 * 1024;
const MAX_OUTPUT_BYTES = 4096;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

async function readStableCaCertificate(path) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    fail("ca_certificate_read_failed");
  }

  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) fail("ca_certificate_not_regular");
    if ((before.mode & 0o022n) !== 0n) {
      fail("ca_certificate_permissions_invalid");
    }
    if (before.size <= 0n || before.size > BigInt(MAX_CA_CERT_BYTES)) {
      fail("ca_certificate_size_invalid");
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (
      after.dev !== before.dev
      || after.ino !== before.ino
      || after.size !== before.size
      || after.mtimeNs !== before.mtimeNs
      || after.ctimeNs !== before.ctimeNs
      || BigInt(bytes.length) !== before.size
    ) {
      fail("ca_certificate_changed_during_read");
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

function resolvePsqlBinary(environment) {
  const override = clean(environment.FANMIND_PSQL_BIN);
  const operationalTestMode = clean(environment.FANMIND_OPERATIONAL_TEST_MODE);
  if (
    clean(environment.GITHUB_ACTIONS) === "true"
    && (override || operationalTestMode)
  ) {
    fail("psql_override_forbidden");
  }
  if (!override) return PSQL_BIN;
  if (
    operationalTestMode !== TEST_MODE
    || !isAbsolute(override)
  ) {
    fail("psql_override_forbidden");
  }
  return resolve(override);
}

function compatibilityEnvironment(environment, passfilePath, caCertificatePath) {
  const safeEnvironment = {
    LANG: "C",
    LC_ALL: "C",
    PATH: environment.PATH ?? "/usr/bin:/bin",
    PGAPPNAME: "fanmind-restore-target-compatibility",
    PGCONNECT_TIMEOUT: "10",
    PGGSSENCMODE: "disable",
    PGPASSFILE: passfilePath,
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: caCertificatePath,
    PGOPTIONS: "-c default_transaction_read_only=on",
  };
  if (clean(environment.FANMIND_OPERATIONAL_TEST_MODE) === TEST_MODE) {
    for (const [name, value] of Object.entries(environment)) {
      if (name.startsWith("FANMIND_TEST_")) safeEnvironment[name] = value;
    }
  }
  return safeEnvironment;
}

function parseCompatibilityOutput(stdout) {
  const lines = String(stdout)
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length !== 1 || !/^\d+\|\d+\|\d+\|\d+$/u.test(lines[0])) {
    fail("catalog_result_invalid");
  }
  const [
    serverVersion,
    presentRoles,
    installedExtensions,
    restoreUserSuperuser,
  ] = lines[0]
    .split("|")
    .map(Number);
  if (
    !Number.isSafeInteger(serverVersion)
    || !Number.isSafeInteger(presentRoles)
    || !Number.isSafeInteger(installedExtensions)
    || !Number.isSafeInteger(restoreUserSuperuser)
  ) {
    fail("catalog_result_invalid");
  }
  if (serverVersion < 170000 || serverVersion >= 180000) {
    fail("server_major_incompatible");
  }
  if (presentRoles !== REQUIRED_RESTORE_ROLES.length) {
    fail("required_roles_missing");
  }
  if (installedExtensions !== REQUIRED_RESTORE_EXTENSIONS.length) {
    fail("required_extensions_missing");
  }
  if (restoreUserSuperuser !== 1) {
    fail("restore_user_not_superuser");
  }
  return Object.freeze({
    serverMajor: 17,
    presentRoles,
    installedExtensions,
    restoreUserSuperuser: true,
  });
}

export async function verifyRestoreTargetCompatibility(
  environment = process.env,
) {
  const readiness = evaluateRestoreReadiness(environment);
  if (!readiness.ok) fail("environment_invalid");
  if (
    clean(environment.FANMIND_RESTORE_TARGET_COMPATIBILITY_CONFIRM)
    !== RESTORE_TARGET_COMPATIBILITY_CONFIRMATION
  ) {
    fail("compatibility_confirmation_invalid");
  }

  const configuredPassfile = clean(
    environment.FANMIND_RESTORE_TARGET_PGPASSFILE_PATH,
  );
  const configuredCaCertificate = clean(
    environment.FANMIND_RESTORE_TARGET_CA_CERT_PATH,
  );
  if (!isAbsolute(configuredPassfile)) fail("passfile_path_invalid");
  if (!isAbsolute(configuredCaCertificate)) {
    fail("ca_certificate_path_invalid");
  }

  let passfileBytes;
  let caCertificateBytes;
  let snapshotDirectory;
  try {
    [passfileBytes, caCertificateBytes] = await Promise.all([
      readStablePrivateFile(configuredPassfile, "compatibility_passfile"),
      readStableCaCertificate(configuredCaCertificate),
    ]);
    snapshotDirectory = await mkdtemp(
      join(tmpdir(), "fanmind-restore-compatibility-"),
    );
    await chmod(snapshotDirectory, 0o700);
    const passfilePath = join(snapshotDirectory, "pgpass");
    const caCertificatePath = join(snapshotDirectory, "root-ca.pem");
    await Promise.all([
      writeFile(passfilePath, passfileBytes, { flag: "wx", mode: 0o600 }),
      writeFile(caCertificatePath, caCertificateBytes, {
        flag: "wx",
        mode: 0o600,
      }),
    ]);

    const result = spawnSync(
      resolvePsqlBinary(environment),
      [
        "--host",
        clean(environment.FANMIND_RESTORE_TARGET_DB_HOST),
        "--port",
        clean(environment.FANMIND_RESTORE_TARGET_DB_PORT),
        "--dbname",
        clean(environment.FANMIND_RESTORE_TARGET_DB_NAME),
        "--username",
        clean(environment.FANMIND_RESTORE_TARGET_DB_USER),
        "--no-password",
        "--no-psqlrc",
        "--quiet",
        "--tuples-only",
        "--no-align",
        "--field-separator=|",
        "--set=ON_ERROR_STOP=1",
        "--command",
        RESTORE_TARGET_COMPATIBILITY_SQL,
      ],
      {
        encoding: "utf8",
        env: compatibilityEnvironment(
          environment,
          passfilePath,
          caCertificatePath,
        ),
        maxBuffer: MAX_OUTPUT_BYTES,
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 15_000,
      },
    );
    if (result.error || result.status !== 0) fail("catalog_query_failed");
    return parseCompatibilityOutput(result.stdout);
  } finally {
    passfileBytes?.fill(0);
    caCertificateBytes?.fill(0);
    if (snapshotDirectory) {
      await rm(snapshotDirectory, { recursive: true, force: true });
    }
  }
}

async function main() {
  const result = await verifyRestoreTargetCompatibility(process.env);
  console.log(`RESTORE_TARGET_COMPATIBILITY_SERVER_MAJOR=${result.serverMajor}`);
  console.log(
    `RESTORE_TARGET_COMPATIBILITY_REQUIRED_ROLES=${REQUIRED_RESTORE_ROLES.length}`,
  );
  console.log(
    `RESTORE_TARGET_COMPATIBILITY_PRESENT_ROLES=${result.presentRoles}`,
  );
  console.log(
    `RESTORE_TARGET_COMPATIBILITY_REQUIRED_EXTENSIONS=${REQUIRED_RESTORE_EXTENSIONS.length}`,
  );
  console.log(
    `RESTORE_TARGET_COMPATIBILITY_INSTALLED_EXTENSIONS=${result.installedExtensions}`,
  );
  console.log(
    `RESTORE_TARGET_COMPATIBILITY_RESTORE_USER_SUPERUSER=${result.restoreUserSuperuser}`,
  );
  console.log("RESTORE_TARGET_COMPATIBILITY_DATABASE_CONNECTION=read_only_catalog");
  console.log("RESTORE_TARGET_COMPATIBILITY_TLS=verify-full");
  console.log("RESTORE_TARGET_COMPATIBILITY_WRITES=disabled");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  console.log("RESTORE_TARGET_COMPATIBILITY=PASS");
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(
      `RESTORE_TARGET_COMPATIBILITY_ERROR=${error?.code ?? "compatibility_failed"}`,
    );
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    console.error("RESTORE_TARGET_COMPATIBILITY=FAIL");
    process.exitCode = 1;
  });
}
