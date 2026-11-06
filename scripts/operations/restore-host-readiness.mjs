#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { access, lstat, readFile, realpath } from "node:fs/promises";
import { userInfo } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const RESTORE_HOST_CONFIRMATION = "verify-isolated-restore-host";
export const RESTORE_HOST_REPOSITORY_ID = "1259448985";
export const RESTORE_HOST_RUNNER_NAME = "fanmind-restore-01";
export const RESTORE_HOST_RUNNER_USER = "fanmind-restore";
export const RESTORE_HOST_NODE_PATH =
  "/opt/fanmind-restore/node-v24.19.0-linux-x64/bin/node";
export const RESTORE_HOST_GATE_PATH =
  "/opt/fanmind-restore/restore-host-readiness.mjs";

const MAX_TOOL_OUTPUT_BYTES = 8192;
const ALLOWED_RESTORE_ENVIRONMENT = new Set([
  "FANMIND_RESTORE_HOST_CONFIRMATION",
]);
const ALLOWED_HOST_ENVIRONMENT = new Set([
  "FANMIND_ENABLE_NON_PRODUCTION_WRITES",
  "FANMIND_ENABLE_RESTORE_DRILL",
  "FANMIND_NON_PRODUCTION_WRITE_ACK",
  "FANMIND_RESTORE_HOST_CONFIRMATION",
  "FANMIND_RESTORE_TARGET_ACK",
  "GITHUB_ACTIONS",
  "GITHUB_EVENT_NAME",
  "GITHUB_REF",
  "GITHUB_REPOSITORY",
  "GITHUB_REPOSITORY_ID",
  "GITHUB_WORKSPACE",
  "LANG",
  "LC_ALL",
  "RUNNER_ARCH",
  "RUNNER_ENVIRONMENT",
  "RUNNER_NAME",
  "RUNNER_OS",
  "RUNNER_TEMP",
  "TMPDIR",
]);
export const PROCESS_INJECTION_ENVIRONMENT = Object.freeze([
  "ALL_PROXY",
  "BASH_ENV",
  "BASHOPTS",
  "BASH_XTRACEFD",
  "CURL_CA_BUNDLE",
  "ENV",
  "GCONV_PATH",
  "GIT_CONFIG_COUNT",
  "GIT_CONFIG_GLOBAL",
  "GIT_CONFIG_KEY_0",
  "GIT_CONFIG_PARAMETERS",
  "GIT_CONFIG_SYSTEM",
  "GIT_CONFIG_VALUE_0",
  "GIT_CURL_VERBOSE",
  "GIT_EXEC_PATH",
  "GIT_SSL_CAINFO",
  "GIT_SSL_CAPATH",
  "GIT_SSL_NO_VERIFY",
  "GIT_TRACE",
  "GIT_TRACE_CURL",
  "GIT_TRACE_CURL_NO_DATA",
  "GIT_TRACE_FSMONITOR",
  "GIT_TRACE_PACK_ACCESS",
  "GIT_TRACE_PACKFILE",
  "GIT_TRACE_PACKET",
  "GIT_TRACE_PERFORMANCE",
  "GIT_TRACE_REFS",
  "GIT_TRACE_REDACT",
  "GIT_TRACE_SETUP",
  "GIT_TRACE_SHALLOW",
  "GIT_TRACE2",
  "GIT_TRACE2_BRIEF",
  "GIT_TRACE2_CONFIG_PARAMS",
  "GIT_TRACE2_ENV_VARS",
  "GIT_TRACE2_EVENT",
  "GIT_TRACE2_EVENT_BRIEF",
  "GIT_TRACE2_EVENT_NESTING",
  "GIT_TRACE2_PARENT_NAME",
  "GIT_TRACE2_PERF",
  "GIT_TRACE2_PERF_BRIEF",
  "HTTPS_PROXY",
  "HTTP_PROXY",
  "LD_AUDIT",
  "LD_LIBRARY_PATH",
  "LD_PRELOAD",
  "NODE_DEBUG",
  "NODE_DEBUG_NATIVE",
  "NODE_OPTIONS",
  "NODE_PATH",
  "NODE_EXTRA_CA_CERTS",
  "NODE_TLS_REJECT_UNAUTHORIZED",
  "NO_PROXY",
  "NPM_CONFIG_SCRIPT_SHELL",
  "OPENSSL_CONF",
  "OPENSSL_ENGINES",
  "OPENSSL_MODULES",
  "PYTHONPATH",
  "REQUESTS_CA_BUNDLE",
  "PS4",
  "SHELLOPTS",
  "SSL_CERT_DIR",
  "SSL_CERT_FILE",
  "all_proxy",
  "http_proxy",
  "https_proxy",
  "no_proxy",
]);
const SERVICE_ENVIRONMENT_NAMES = Object.freeze([
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
]);
const SERVICE_ENVIRONMENT_PREFIXES = Object.freeze([
  "FANMIND_BACKUP_",
  "FANMIND_PRODUCTION_",
  "FANMIND_TARGET_",
  "POSTGRES_",
  "SUPABASE_",
]);
export const TOOL_CONTRACT = Object.freeze([
  {
    name: "node",
    path: RESTORE_HOST_NODE_PATH,
    args: ["--version"],
    version: /^v24\.19\.0\s*$/u,
  },
  {
    name: "bash",
    path: "/usr/bin/bash",
    args: ["--version"],
    version: /GNU bash, version 5\.2\./u,
  },
  {
    name: "tar",
    path: "/usr/bin/tar",
    args: ["--version"],
    version: /tar \(GNU tar\) 1\.35(?:\s|$)/u,
  },
  {
    name: "gzip",
    path: "/usr/bin/gzip",
    args: ["--version"],
    version: /gzip 1\.12(?:\s|$)/u,
  },
  {
    name: "age",
    path: "/usr/bin/age",
    args: ["--version"],
    version: /(?:^|\s)(?:age )?1\.1\.1(?:\s|$)/u,
  },
  {
    name: "psql",
    path: "/usr/lib/postgresql/17/bin/psql",
    args: ["--version"],
    version: /psql \(PostgreSQL\) 17\.11(?:\s|$)/u,
  },
  {
    name: "pg_restore",
    path: "/usr/lib/postgresql/17/bin/pg_restore",
    args: ["--version"],
    version: /pg_restore \(PostgreSQL\) 17\.11(?:\s|$)/u,
  },
  {
    name: "pg_dump",
    path: "/usr/lib/postgresql/17/bin/pg_dump",
    args: ["--version"],
    version: /pg_dump \(PostgreSQL\) 17\.11(?:\s|$)/u,
  },
]);
const COREUTILS = Object.freeze([
  "cat",
  "chmod",
  "cp",
  "date",
  "dirname",
  "env",
  "id",
  "mkdir",
  "mktemp",
  "realpath",
  "rmdir",
  "sha256sum",
  "stat",
  "unlink",
]);
const TRUSTED_TOOL_DIRECTORIES = Object.freeze([
  "/opt",
  "/opt/fanmind-restore",
  "/opt/fanmind-restore/node-v24.19.0-linux-x64",
  "/opt/fanmind-restore/node-v24.19.0-linux-x64/bin",
  "/usr",
  "/usr/bin",
  "/usr/lib",
  "/usr/lib/postgresql",
  "/usr/lib/postgresql/17",
  "/usr/lib/postgresql/17/bin",
]);
const PRIVILEGED_SOCKET_PATHS = Object.freeze([
  "/run/docker.sock",
  "/run/libvirt/libvirt-sock",
  "/run/podman/podman.sock",
  "/var/lib/incus/unix.socket",
  "/var/lib/lxd/unix.socket",
  "/var/snap/lxd/common/lxd/unix.socket",
  "/var/run/docker.sock",
  "/var/run/libvirt/libvirt-sock",
  "/var/run/podman/podman.sock",
]);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function defaultRun(path, args) {
  return spawnSync(path, args, {
    encoding: "utf8",
    env: {
      LANG: "C",
      LC_ALL: "C",
      PATH: "/usr/bin:/bin",
    },
    maxBuffer: MAX_TOOL_OUTPUT_BYTES,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 5_000,
  });
}

async function defaultInspect(path) {
  const metadata = await lstat(path);
  return Object.freeze({
    canonicalPath: await realpath(path),
    isDirectory: metadata.isDirectory(),
    isFile: metadata.isFile(),
    isSymbolicLink: metadata.isSymbolicLink(),
    mode: metadata.mode & 0o7777,
    uid: metadata.uid,
  });
}

async function defaultCanAccess(path, mode) {
  try {
    await access(path, mode);
    return true;
  } catch {
    return false;
  }
}

function defaultRuntime() {
  return {
    arch: process.arch,
    canAccess: defaultCanAccess,
    inspect: defaultInspect,
    nodeVersion: process.version,
    nodePath: process.execPath,
    platform: process.platform,
    readText: (path) => readFile(path, "utf8"),
    resolvePath: (path) => realpath(path),
    run: defaultRun,
    scriptPath: resolve(process.argv[1] ?? ""),
    uid: typeof process.getuid === "function" ? process.getuid() : -1,
    userName: userInfo().username,
  };
}

function parseOsRelease(source) {
  const fields = new Map();
  for (const line of String(source).split(/\r?\n/u)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/u);
    if (!match) continue;
    let value = match[2];
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    fields.set(match[1], value);
  }
  return fields;
}

function assertEnvironment(environment) {
  if (
    clean(environment.GITHUB_ACTIONS) !== "true"
    || clean(environment.GITHUB_EVENT_NAME) !== "workflow_dispatch"
    || clean(environment.GITHUB_REF) !== "refs/heads/main"
    || !clean(environment.GITHUB_REPOSITORY)
    || clean(environment.GITHUB_REPOSITORY_ID) !== RESTORE_HOST_REPOSITORY_ID
  ) {
    fail("github_boundary_invalid");
  }
  if (
    clean(environment.RUNNER_ENVIRONMENT) !== "self-hosted"
    || clean(environment.RUNNER_OS) !== "Linux"
    || clean(environment.RUNNER_ARCH) !== "X64"
    || clean(environment.RUNNER_NAME) !== RESTORE_HOST_RUNNER_NAME
  ) {
    fail("runner_identity_invalid");
  }
  if (
    clean(environment.FANMIND_RESTORE_HOST_CONFIRMATION)
      !== RESTORE_HOST_CONFIRMATION
  ) {
    fail("host_confirmation_invalid");
  }
  if (
    clean(environment.FANMIND_ENABLE_NON_PRODUCTION_WRITES) !== "false"
    || clean(environment.FANMIND_NON_PRODUCTION_WRITE_ACK)
    || clean(environment.FANMIND_ENABLE_RESTORE_DRILL) !== "false"
    || clean(environment.FANMIND_RESTORE_TARGET_ACK)
  ) {
    fail("write_gate_invalid");
  }

  for (const [name, value] of Object.entries(environment)) {
    if (name.startsWith("PG") && clean(value)) {
      fail("libpq_environment_present");
    }
    if (
      name.startsWith("FANMIND_RESTORE_")
      && !ALLOWED_RESTORE_ENVIRONMENT.has(name)
      && clean(value)
    ) {
      fail("restore_secret_environment_present");
    }
    if (
      SERVICE_ENVIRONMENT_PREFIXES.some((prefix) => name.startsWith(prefix))
      && clean(value)
    ) {
      fail("service_environment_present");
    }
  }
  if (
    SERVICE_ENVIRONMENT_NAMES.some((name) => clean(environment[name]))
  ) {
    fail("service_environment_present");
  }
  if (
    PROCESS_INJECTION_ENVIRONMENT.some((name) => clean(environment[name]))
  ) {
    fail("process_injection_environment_present");
  }
  if (
    Object.entries(environment).some(
      ([name, value]) => !ALLOWED_HOST_ENVIRONMENT.has(name) && clean(value),
    )
  ) {
    fail("unexpected_environment_present");
  }
}

async function assertDirectory(runtime, path, expectedUid, privateDirectory) {
  if (!isAbsolute(path)) fail("runner_directory_invalid");
  let metadata;
  try {
    metadata = await runtime.inspect(path);
  } catch {
    fail("runner_directory_invalid");
  }
  if (
    !metadata.isDirectory
    || metadata.isSymbolicLink
    || metadata.canonicalPath !== resolve(path)
    || metadata.uid !== expectedUid
    || (metadata.mode & 0o7000) !== 0
    || (metadata.mode & 0o022) !== 0
    || (privateDirectory && (metadata.mode & 0o077) !== 0)
  ) {
    fail("runner_directory_invalid");
  }
  if (
    !(await runtime.canAccess(
      path,
      constants.R_OK | constants.W_OK | constants.X_OK,
    ))
  ) {
    fail("runner_directory_inaccessible");
  }
}

function pathsOverlap(first, second) {
  const firstToSecond = relative(first, second);
  const secondToFirst = relative(second, first);
  const contained = (candidate) =>
    candidate === ""
    || (
      candidate !== ".."
      && !candidate.startsWith(`..${sep}`)
      && !isAbsolute(candidate)
    );
  return contained(firstToSecond) || contained(secondToFirst);
}

async function assertRootOwnedTool(runtime, path, name) {
  let metadata;
  try {
    metadata = await runtime.inspect(path);
  } catch {
    fail(`tool_${name}_invalid`);
  }
  if (
    !metadata.isFile
    || metadata.isSymbolicLink
    || metadata.canonicalPath !== path
    || metadata.uid !== 0
    || (metadata.mode & 0o7022) !== 0
    || await runtime.canAccess(path, constants.W_OK)
  ) {
    fail(`tool_${name}_invalid`);
  }
}

async function assertTrustedToolDirectory(runtime, path) {
  let metadata;
  try {
    metadata = await runtime.inspect(path);
  } catch {
    fail("tool_parent_directory_invalid");
  }
  if (
    !metadata.isDirectory
    || metadata.isSymbolicLink
    || metadata.canonicalPath !== path
    || metadata.uid !== 0
    || (metadata.mode & 0o7022) !== 0
    || await runtime.canAccess(path, constants.W_OK)
  ) {
    fail("tool_parent_directory_invalid");
  }
}

function runVersion(runtime, contract) {
  const result = runtime.run(contract.path, contract.args);
  if (result?.error || result?.status !== 0) {
    fail(`tool_${contract.name}_execution_failed`);
  }
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (!contract.version.test(output)) {
    fail(`tool_${contract.name}_version_invalid`);
  }
}

async function assertToolchain(runtime) {
  if (
    runtime.nodePath !== RESTORE_HOST_NODE_PATH
    || runtime.scriptPath !== RESTORE_HOST_GATE_PATH
    || await runtime.resolvePath("/proc/self/exe") !== RESTORE_HOST_NODE_PATH
  ) {
    fail("node_executable_invalid");
  }
  for (const path of TRUSTED_TOOL_DIRECTORIES) {
    await assertTrustedToolDirectory(runtime, path);
  }
  await assertRootOwnedTool(runtime, RESTORE_HOST_GATE_PATH, "gate");
  for (const contract of TOOL_CONTRACT) {
    await assertRootOwnedTool(runtime, contract.path, contract.name);
    runVersion(runtime, contract);
  }
  for (const name of COREUTILS) {
    const path = `/usr/bin/${name}`;
    await assertRootOwnedTool(runtime, path, name);
    runVersion(runtime, {
      name,
      path,
      args: ["--version"],
      version: new RegExp(`${name} \\(GNU coreutils\\) 9\\.4(?:\\s|$)`, "u"),
    });
  }
}

async function assertPrincipalBoundary(runtime) {
  const primaryGroupResult = runtime.run("/usr/bin/id", ["-gn"]);
  const groupsResult = runtime.run("/usr/bin/id", ["-Gn"]);
  if (
    primaryGroupResult?.error
    || primaryGroupResult?.status !== 0
    || clean(primaryGroupResult.stdout) !== RESTORE_HOST_RUNNER_USER
    || groupsResult?.error
    || groupsResult?.status !== 0
  ) {
    fail("runner_groups_invalid");
  }
  const groups = clean(groupsResult.stdout).split(/\s+/u).filter(Boolean);
  if (groups.length !== 1 || groups[0] !== RESTORE_HOST_RUNNER_USER) {
    fail("runner_groups_invalid");
  }

  const sudoResult = runtime.run("/usr/bin/sudo", ["-n", "-l"]);
  if (sudoResult?.error && sudoResult.error.code !== "ENOENT") {
    fail("runner_sudo_check_failed");
  }
  if (!sudoResult?.error && sudoResult?.status === 0) {
    fail("runner_sudo_available");
  }
  if (!sudoResult?.error && !Number.isInteger(sudoResult?.status)) {
    fail("runner_sudo_check_failed");
  }

  const socketPaths = [
    ...PRIVILEGED_SOCKET_PATHS,
    `/run/user/${runtime.uid}/docker.sock`,
    `/run/user/${runtime.uid}/incus/unix.socket`,
    `/run/user/${runtime.uid}/libvirt/libvirt-sock`,
    `/run/user/${runtime.uid}/podman/podman.sock`,
  ];
  for (const path of socketPaths) {
    if (
      await runtime.canAccess(path, constants.R_OK)
      || await runtime.canAccess(path, constants.W_OK)
    ) {
      fail("runner_privileged_socket_accessible");
    }
  }
}

async function assertProcessBoundary(runtime) {
  let status;
  try {
    status = await runtime.readText("/proc/self/status");
  } catch {
    fail("process_privilege_boundary_invalid");
  }
  const fields = new Map();
  for (const line of String(status).split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z]+):\s*(\S+)/u);
    if (match) fields.set(match[1], match[2]);
  }
  for (const name of ["CapInh", "CapPrm", "CapEff", "CapAmb"]) {
    if (!/^0+$/u.test(fields.get(name) ?? "")) {
      fail("process_privilege_boundary_invalid");
    }
  }
  if (fields.get("NoNewPrivs") !== "1") {
    fail("process_privilege_boundary_invalid");
  }
}

export async function verifyRestoreHostReadiness(
  environment = process.env,
  injectedRuntime,
) {
  const runtime = injectedRuntime ?? defaultRuntime();
  assertEnvironment(environment);

  if (
    runtime.platform !== "linux"
    || runtime.arch !== "x64"
    || runtime.uid <= 0
    || runtime.userName !== RESTORE_HOST_RUNNER_USER
  ) {
    fail("host_principal_invalid");
  }
  if (runtime.nodeVersion !== "v24.19.0") {
    fail("node_version_invalid");
  }

  let osRelease;
  try {
    osRelease = parseOsRelease(await runtime.readText("/etc/os-release"));
  } catch {
    fail("host_os_invalid");
  }
  if (
    osRelease.get("ID") !== "ubuntu"
    || osRelease.get("VERSION_ID") !== "24.04"
  ) {
    fail("host_os_invalid");
  }

  const runnerTemp = clean(environment.RUNNER_TEMP);
  const workspace = clean(environment.GITHUB_WORKSPACE);
  const temporaryDirectory = clean(environment.TMPDIR);
  if (
    !runnerTemp
    || !workspace
    || temporaryDirectory !== runnerTemp
    || pathsOverlap(resolve(runnerTemp), resolve(workspace))
  ) {
    fail("runner_directory_invalid");
  }
  await assertDirectory(runtime, runnerTemp, runtime.uid, true);
  await assertDirectory(runtime, workspace, runtime.uid, false);
  if (!(await runtime.canAccess("/proc/self/fd", constants.R_OK))) {
    fail("proc_fd_unavailable");
  }

  await assertPrincipalBoundary(runtime);
  await assertProcessBoundary(runtime);
  await assertToolchain(runtime);

  return Object.freeze({
    ageVersion: "1.1.1",
    nodeVersion: "24.19.0",
    postgresqlVersion: "17.11",
    tarVersion: "1.35",
  });
}

async function main() {
  const result = await verifyRestoreHostReadiness(process.env);
  console.log("RESTORE_HOST_PLATFORM=ubuntu-24.04-linux-x64");
  console.log("RESTORE_HOST_RUNNER_IDENTITY=verified");
  console.log(`RESTORE_HOST_NODE_VERSION=${result.nodeVersion}`);
  console.log(`RESTORE_HOST_POSTGRESQL_TOOLS=${result.postgresqlVersion}`);
  console.log(`RESTORE_HOST_AGE_VERSION=${result.ageVersion}`);
  console.log(`RESTORE_HOST_TAR_VERSION=${result.tarVersion}`);
  console.log("RESTORE_HOST_DATABASE_CONNECTION=not_attempted");
  console.log("RESTORE_HOST_DECRYPTION=not_attempted");
  console.log("RESTORE_HOST_WRITES=disabled");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  console.log("RESTORE_HOST_READINESS=PASS");
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(`RESTORE_HOST_ERROR=${error?.code ?? "host_readiness_failed"}`);
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    console.error("RESTORE_HOST_READINESS=FAIL");
    process.exitCode = 1;
  });
}
