import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import test from "node:test";

import {
  PROCESS_INJECTION_ENVIRONMENT,
  RESTORE_HOST_GATE_PATH,
  RESTORE_HOST_NODE_PATH,
  RESTORE_HOST_REPOSITORY_ID,
  TOOL_CONTRACT,
  verifyRestoreHostReadiness,
} from "../scripts/operations/restore-host-readiness.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const RUNNER_UID = 1001;
const RUNNER_TEMP = "/home/fanmind-restore/_temp";
const WORKSPACE = "/home/fanmind-restore/_work/FanMind/FanMind";
const TRUSTED_DIRECTORIES = new Set([
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
const PINNED_RESTORE_CA_ENVIRONMENT = Object.freeze({
  CURL_CA_BUNDLE: "/etc/ssl/certs/ca-certificates.crt",
  GIT_SSL_CAINFO: "/etc/ssl/certs/ca-certificates.crt",
  GIT_SSL_CAPATH: "/etc/ssl/certs",
  REQUESTS_CA_BUNDLE: "/etc/ssl/certs/ca-certificates.crt",
  SSL_CERT_DIR: "/etc/ssl/certs",
  SSL_CERT_FILE: "/etc/ssl/certs/ca-certificates.crt",
});

function countOccurrences(text, value) {
  return text.split(value).length - 1;
}

function hostEnvironment(overrides = {}) {
  return {
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
    FANMIND_ENABLE_RESTORE_DRILL: "false",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "",
    FANMIND_RESTORE_HOST_CONFIRMATION: "verify-isolated-restore-host",
    FANMIND_RESTORE_TARGET_ACK: "",
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: "refs/heads/main",
    GITHUB_REPOSITORY: "Bernds-tech/FanMind",
    GITHUB_REPOSITORY_ID: RESTORE_HOST_REPOSITORY_ID,
    GITHUB_WORKSPACE: WORKSPACE,
    LANG: "C",
    LC_ALL: "C",
    RUNNER_ARCH: "X64",
    RUNNER_ENVIRONMENT: "self-hosted",
    RUNNER_NAME: "fanmind-restore-01",
    RUNNER_OS: "Linux",
    RUNNER_TEMP,
    TMPDIR: RUNNER_TEMP,
    ...overrides,
  };
}

function toolOutput(path, args) {
  if (path === RESTORE_HOST_NODE_PATH) return "v24.19.0\n";
  if (path === "/usr/bin/bash") return "GNU bash, version 5.2.21\n";
  if (path === "/usr/bin/tar") return "tar (GNU tar) 1.35\n";
  if (path === "/usr/bin/gzip") return "gzip 1.12\n";
  if (path === "/usr/bin/age") return "age 1.1.1\n";
  if (path.endsWith("/psql")) return "psql (PostgreSQL) 17.11\n";
  if (path.endsWith("/pg_restore")) return "pg_restore (PostgreSQL) 17.11\n";
  if (path.endsWith("/pg_dump")) return "pg_dump (PostgreSQL) 17.11\n";
  if (path === "/usr/bin/id" && args[0] === "-gn") {
    return "fanmind-restore\n";
  }
  if (path === "/usr/bin/id" && args[0] === "-Gn") {
    return "fanmind-restore\n";
  }
  return `${basename(path)} (GNU coreutils) 9.4\n`;
}

function hostRuntime(overrides = {}) {
  return {
    arch: "x64",
    async canAccess(path, mode) {
      if (path === RUNNER_TEMP || path === WORKSPACE) return true;
      if (path === "/proc/self/fd") return mode === constants.R_OK;
      return false;
    },
    async inspect(path) {
      if (path === RUNNER_TEMP) {
        return {
          canonicalPath: path,
          isDirectory: true,
          isFile: false,
          isSymbolicLink: false,
          mode: 0o700,
          uid: RUNNER_UID,
        };
      }
      if (path === WORKSPACE) {
        return {
          canonicalPath: path,
          isDirectory: true,
          isFile: false,
          isSymbolicLink: false,
          mode: 0o755,
          uid: RUNNER_UID,
        };
      }
      if (TRUSTED_DIRECTORIES.has(path)) {
        return {
          canonicalPath: path,
          isDirectory: true,
          isFile: false,
          isSymbolicLink: false,
          mode: 0o755,
          uid: 0,
        };
      }
      return {
        canonicalPath: path,
        isDirectory: false,
        isFile: true,
        isSymbolicLink: false,
        mode: path === RESTORE_HOST_GATE_PATH ? 0o444 : 0o555,
        uid: 0,
      };
    },
    nodePath: RESTORE_HOST_NODE_PATH,
    nodeVersion: "v24.19.0",
    platform: "linux",
    async readText(path) {
      if (path === "/etc/os-release") {
        return 'ID=ubuntu\nVERSION_ID="24.04"\n';
      }
      if (path === "/proc/self/status") {
        return [
          "CapInh:\t0000000000000000",
          "CapPrm:\t0000000000000000",
          "CapEff:\t0000000000000000",
          "CapAmb:\t0000000000000000",
          "NoNewPrivs:\t1",
          "",
        ].join("\n");
      }
      throw new Error("unexpected read");
    },
    async resolvePath(path) {
      assert.equal(path, "/proc/self/exe");
      return RESTORE_HOST_NODE_PATH;
    },
    run(path, args) {
      if (path === "/usr/bin/sudo") {
        const error = new Error("not installed");
        error.code = "ENOENT";
        return { error, status: null, stdout: "", stderr: "" };
      }
      return { status: 0, stdout: toolOutput(path, args), stderr: "" };
    },
    scriptPath: RESTORE_HOST_GATE_PATH,
    uid: RUNNER_UID,
    userName: "fanmind-restore",
    ...overrides,
  };
}

async function rejectsWithCode(environment, runtime, code) {
  await assert.rejects(
    verifyRestoreHostReadiness(environment, runtime),
    (error) => error?.code === code,
  );
}

test("the isolated fixed host contract passes without Restore data access", async () => {
  const result = await verifyRestoreHostReadiness(
    hostEnvironment(),
    hostRuntime(),
  );
  assert.deepEqual(result, {
    ageVersion: "1.1.1",
    nodeVersion: "24.19.0",
    postgresqlVersion: "17.11",
    tarVersion: "1.35",
  });
});

test("the stable repository id keeps the boundary exact across an owner transfer", async () => {
  const result = await verifyRestoreHostReadiness(
    hostEnvironment({ GITHUB_REPOSITORY: "future-org/FanMind" }),
    hostRuntime(),
  );
  assert.equal(result.nodeVersion, "24.19.0");
});

for (const [name, value, code] of [
  ["GITHUB_REF", "refs/heads/feature", "github_boundary_invalid"],
  ["GITHUB_REPOSITORY_ID", "1", "github_boundary_invalid"],
  ["RUNNER_NAME", "fanmind-restore-02", "runner_identity_invalid"],
  ["PGHOST", "production.internal", "libpq_environment_present"],
  ["FANMIND_BACKUP_BUCKET", "production-backups", "service_environment_present"],
  ["NEXT_PUBLIC_SUPABASE_URL", "https://example.invalid", "service_environment_present"],
  ["NODE_DEBUG", "http", "process_injection_environment_present"],
  ["GIT_TRACE", "1", "process_injection_environment_present"],
  ["HTTPS_PROXY", "https://proxy.invalid", "process_injection_environment_present"],
  ["UNEXPECTED_HOST_VALUE", "present", "unexpected_environment_present"],
]) {
  test(`host gate rejects ${name}`, async () => {
    await rejectsWithCode(
      hostEnvironment({ [name]: value }),
      hostRuntime(),
      code,
    );
  });
}

test("all process-injection names remain represented by the workflows", async () => {
  const workflows = await Promise.all([
    ".github/workflows/restore-drill-host-readiness.yml",
    ".github/workflows/restore-drill-resource-readiness.yml",
    ".github/workflows/restore-drill-database.yml",
  ].map((path) => readFile(resolve(ROOT, path), "utf8")));
  for (const workflow of workflows) {
    for (const name of PROCESS_INJECTION_ENVIRONMENT) {
      if (name === "GIT_SSL_NO_VERIFY") continue;
      const indent = name === name.toLowerCase() ? 2 : 6;
      assert.match(workflow, new RegExp(`^ {${indent}}${name}: `, "m"), name);
    }
    assert.doesNotMatch(workflow, /^\s+GIT_SSL_NO_VERIFY:/mu);
    assert.match(workflow, /^ {6}GIT_TRACE_REDACT: 'true'$/m);
    assert.match(workflow, /^ {6}NODE_TLS_REJECT_UNAUTHORIZED: '1'$/m);
    for (const [name, value] of Object.entries(PINNED_RESTORE_CA_ENVIRONMENT)) {
      assert.match(workflow, new RegExp(`^ {6}${name}: ${value}$`, "m"), name);
      assert.doesNotMatch(workflow, new RegExp(`^ {6}${name}: ''$`, "m"), name);
    }
  }
});

test("toolchain drift, privilege drift, and writable fixed tools fail closed", async () => {
  await rejectsWithCode(
    hostEnvironment(),
    hostRuntime({ nodeVersion: "v24.20.0" }),
    "node_version_invalid",
  );
  await rejectsWithCode(
    hostEnvironment(),
    hostRuntime({
      async readText(path) {
        if (path === "/etc/os-release") return 'ID=ubuntu\nVERSION_ID="24.04"\n';
        return "CapInh:\t0\nCapPrm:\t0\nCapEff:\t1\nCapAmb:\t0\nNoNewPrivs:\t1\n";
      },
    }),
    "process_privilege_boundary_invalid",
  );
  const base = hostRuntime();
  await rejectsWithCode(
    hostEnvironment(),
    hostRuntime({
      async canAccess(path, mode) {
        if (path === "/usr/bin/age" && mode === constants.W_OK) return true;
        return base.canAccess(path, mode);
      },
    }),
    "tool_age_invalid",
  );
});

test("the fixed versions and tool paths cover the restore toolchain", () => {
  assert.deepEqual(
    TOOL_CONTRACT.map(({ name }) => name),
    ["node", "bash", "tar", "gzip", "age", "psql", "pg_restore", "pg_dump"],
  );
  assert.equal(RESTORE_HOST_NODE_PATH.startsWith("/opt/fanmind-restore/"), true);
});

test("all Restore workflows require the future organization scope, gate digest and five labels", async () => {
  const gate = await readFile(
    resolve(ROOT, "scripts/operations/restore-host-readiness.mjs"),
  );
  const digest = createHash("sha256").update(gate).digest("hex");
  for (const [path, selfHostedJobCount] of [
    [".github/workflows/restore-drill-host-readiness.yml", 1],
    [".github/workflows/restore-drill-resource-readiness.yml", 2],
    [".github/workflows/restore-drill-database.yml", 2],
  ]) {
    const workflow = await readFile(resolve(ROOT, path), "utf8");
    assert.doesNotMatch(workflow, /__RESTORE_HOST_GATE_SHA256__/u);
    assert.match(workflow, new RegExp(`RESTORE_HOST_GATE_SHA256: ${digest}`, "u"));
    assert.match(
      workflow,
      /runs-on:\s*\n\s+group: fanmind-restore-drill\s*\n\s+labels: \[self-hosted, fanmind-restore, fanmind-restore-01, linux, x64\]/u,
    );
    assert.match(workflow, /RESTORE_RUNNER_SCOPE: \$\{\{ vars\.FANMIND_RESTORE_RUNNER_SCOPE \}\}/u);
    assert.match(workflow, /RESTORE_RUNNER_SCOPE" == 'organization-workflow-allowlist'/u);
    assert.match(workflow, /^env:\n  all_proxy: ''\n  http_proxy: ''\n  https_proxy: ''\n  no_proxy: ''$/mu);
    assert.doesNotMatch(workflow, /^\s{6}(?:all|http|https|no)_proxy:/mu);
    assert.doesNotMatch(workflow, /^\s{6}TMPDIR: \$\{\{ runner\.temp \}\}$/mu);
    assert.doesNotMatch(workflow, /^\s+GIT_SSL_NO_VERIFY:/mu);
    assert.equal(
      (workflow.match(/\[\[ -z "\$\{GIT_SSL_NO_VERIFY\+x\}" \]\]/gu) ?? []).length,
      selfHostedJobCount,
    );
    for (const [name, value] of Object.entries(PINNED_RESTORE_CA_ENVIRONMENT)) {
      assert.equal(
        countOccurrences(workflow, `      ${name}: ${value}`),
        selfHostedJobCount,
        name,
      );
    }
    assert.equal(
      countOccurrences(
        workflow,
        "readonly RESTORE_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt",
      ),
      selfHostedJobCount,
    );
    assert.equal(
      countOccurrences(
        workflow,
        '[[ -s "$RESTORE_CA_BUNDLE" && ! -L "$RESTORE_CA_BUNDLE" && ! -w "$RESTORE_CA_BUNDLE" ]]',
      ),
      selfHostedJobCount,
    );
    assert.equal(
      countOccurrences(
        workflow,
        '[[ -d "$RESTORE_CA_DIRECTORY" && ! -L "$RESTORE_CA_DIRECTORY" && ! -w "$RESTORE_CA_DIRECTORY" ]]',
      ),
      selfHostedJobCount,
    );
    assert.equal(
      (workflow.match(/printf 'TMPDIR=%s\\n' "\$RUNNER_TEMP" >> "\$GITHUB_ENV"/gu) ?? []).length,
      selfHostedJobCount,
    );
    assert.equal(
      (workflow.match(/GITHUB_REPOSITORY_ID="\$GITHUB_REPOSITORY_ID"/gu) ?? []).length,
      selfHostedJobCount,
    );
    assert.doesNotMatch(workflow, /actions\/setup-node|\bnpm (?:ci|run)\b/u);
  }
});

test("protected Restore workflows gate a secret-free JIT before the environment JIT", async () => {
  for (const [path, protectedJob] of [
    [
      ".github/workflows/restore-drill-resource-readiness.yml",
      "  verify-isolated-restore-resources:",
    ],
    [
      ".github/workflows/restore-drill-database.yml",
      "  restore-isolated-database:",
    ],
  ]) {
    const workflow = await readFile(resolve(ROOT, path), "utf8");
    const boundary = workflow.indexOf(protectedJob);
    assert.notEqual(boundary, -1);
    const prejob = workflow.slice(workflow.indexOf("  verify-restore-host:"), boundary);
    assert.doesNotMatch(prejob, /secrets\.|environment: restore-drill|actions\/checkout/u);
    const protectedPart = workflow.slice(boundary);
    assert.match(protectedPart, /environment: restore-drill/u);
    assert.ok(
      protectedPart.indexOf("Re-attest the preinstalled gate")
        < protectedPart.indexOf("actions/checkout@"),
    );
  }
});

test("standalone readiness cannot checkout, load Restore secrets, or dispatch a restore", async () => {
  const workflow = await readFile(
    resolve(ROOT, ".github/workflows/restore-drill-host-readiness.yml"),
    "utf8",
  );
  assert.doesNotMatch(
    workflow,
    /actions\/checkout|secrets\.|environment: restore-drill|pg_restore|restore-target|verify-backup-artifact/u,
  );
  assert.match(workflow, /RESTORE_HOST_DATABASE_CONNECTION=not_attempted/u);
  assert.match(workflow, /RESTORE_HOST_DECRYPTION=not_attempted/u);
});

test("the verifier child environment does not inherit the ambient process", async () => {
  const source = await readFile(
    resolve(ROOT, "scripts/operations/verify-backup-artifact.mjs"),
    "utf8",
  );
  const runFunction = source.slice(
    source.indexOf("function run(command"),
    source.indexOf("async function", source.indexOf("function run(command")),
  );
  assert.doesNotMatch(runFunction, /\.\.\.process\.env/u);
  assert.match(runFunction, /LANG: "C"/u);
  assert.match(runFunction, /LC_ALL: "C"/u);
  assert.match(runFunction, /PATH: "\/usr\/bin:\/bin"/u);
});
