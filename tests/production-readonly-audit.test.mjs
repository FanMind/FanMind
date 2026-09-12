import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import yaml from "js-yaml";

import { verifyProductionAuditOutput, verifyProductionRuntimeOutput } from "../scripts/operations/verify-production-audit-output.mjs";
import {
  BOOT_ROLES, bootNodeMatches, bootReadinessLines, bootSummaryFromValues, parseUnitProperties,
  readSavedApp, runnerUnitFromCgroup, savedAppMatches, startupContract, releaseTargetMatches, runnerStartupMatches,
} from "../scripts/operations/production-boot-readiness.mjs";
import { parseProductionAuditOutput } from "../scripts/operations/verify-production-audit-output.mjs";

const auditScriptPath = "scripts/operations/read-only-production-audit.sh";
const execFileAsync = promisify(execFile);
const expectedCommit = "a".repeat(40);

async function readAuditScript() {
  return readFile(auditScriptPath, "utf8");
}

function validBootLines() {
  return bootReadinessLines({
    units: Object.fromEntries(BOOT_ROLES.map(role => [role, {
      LoadState: "loaded", UnitFileState: "enabled", ActiveState: "active", NeedDaemonReload: "no",
    }])),
    checks: { PM2_STARTUP: true, PM2_SAVED_APP: true, BOOT_NODE: true, RUNNER_BOUND: true, RELEASE_TARGET: true },
  });
}

function savedApp() {
  return {
    name: "fanmind", exec_mode: "cluster_mode", autorestart: true,
    pm_cwd: "/var/www/fanmind-current",
    pm_exec_path: "/var/www/fanmind-current/node_modules/next/dist/bin/next",
    exec_interpreter: "node", args: ["start"],
    NODE_ENV: "production", FANMIND_RUNTIME_ENVIRONMENT: "production", FANMIND_RELEASE_COMMIT: expectedCommit,
    env: { FANMIND_RELEASE_COMMIT: expectedCommit, PRIVATE_SECRET: "RAW_SECRET_CANARY" },
  };
}

test("boot preflight rejects missing, duplicate, masked, transient and inactive units", () => {
  const valid = validBootLines().join("\n");
  assert.equal(bootSummaryFromValues(parseProductionAuditOutput(valid)).verified, true);
  for (const role of BOOT_ROLES) {
    const line = `BOOT_UNIT_${role}=loaded|enabled|active|no`;
    for (const altered of [
      valid.replace(line, ""), `${valid}\n${line}`,
      valid.replace(line, `BOOT_UNIT_${role}=loaded|enabled|active|yes`),
      valid.replace(line, `BOOT_UNIT_${role}=loaded|enabled|active`),
      valid.replace(line, `BOOT_UNIT_${role}=not-found|disabled|inactive|no`),
      valid.replace(line, `BOOT_UNIT_${role}=masked|masked|inactive`),
      valid.replace(line, `BOOT_UNIT_${role}=loaded|enabled-runtime|active`),
      valid.replace(line, `BOOT_UNIT_${role}=loaded|enabled|failed`),
      valid.replace(line, `BOOT_UNIT_${role}=RAW_SECRET_CANARY|enabled|active`),
    ]) {
      const result = bootSummaryFromValues(parseProductionAuditOutput(altered));
      assert.equal(result.verified, false, role);
      assert.doesNotMatch(JSON.stringify(result), /RAW_SECRET_CANARY/u);
    }
  }
  for (const key of ["PM2_STARTUP", "PM2_SAVED_APP", "BOOT_NODE", "RUNNER_BOUND", "RELEASE_TARGET"]) {
    assert.equal(bootSummaryFromValues(parseProductionAuditOutput(valid.replace(`BOOT_${key}=true`, `BOOT_${key}=false`))).verified, false);
  }
});

test("saved PM2 app binds exactly one cluster app and the current release without returning private environment", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-boot-dump-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, "dump.pm2");
  await writeFile(file, JSON.stringify([savedApp()]), { mode: 0o600 });
  assert.equal(readSavedApp(file, expectedCommit), true);
  assert.equal(savedAppMatches([{ ...savedApp(), instances: 1 }], expectedCommit), true);
  assert.equal(readSavedApp(file, "b".repeat(40)), false);
  assert.equal(savedAppMatches([], expectedCommit), false);
  assert.equal(savedAppMatches([savedApp(), savedApp()], expectedCommit), false);
  for (const overrides of [
    { name: "other" }, { exec_mode: "fork_mode" }, { instances: 2 }, { autorestart: false },
    { pm_cwd: "/var/www/old-release" }, { pm_exec_path: "/private/RAW_SECRET_CANARY" },
    { exec_interpreter: "/private/node" }, { args: ["dev"] }, { NODE_ENV: "development" },
    { FANMIND_RUNTIME_ENVIRONMENT: "staging" }, { FANMIND_RELEASE_COMMIT: "b".repeat(40) },
    { env: { FANMIND_RELEASE_COMMIT: "b".repeat(40) } },
  ]) assert.equal(savedAppMatches([{ ...savedApp(), ...overrides }], expectedCommit), false);
  const link = join(root, "link.pm2");
  await symlink(file, link);
  assert.equal(readSavedApp(link, expectedCommit), false);
  await chmod(file, 0o666);
  assert.equal(readSavedApp(file, expectedCommit), false);
  await chmod(file, 0o600);
  await writeFile(file, "RAW_SECRET_CANARY");
  assert.equal(readSavedApp(file, expectedCommit), false);
  await writeFile(file, "x".repeat(1024 * 1024 + 1));
  assert.equal(readSavedApp(file, expectedCommit), false);
  assert.equal(readSavedApp(root, expectedCommit), false);
  assert.equal(readSavedApp(join(root, "missing"), expectedCommit), false);
});

test("PM2 startup and current runner binding fail closed on alternate commands, users and unparseable inputs", () => {
  const unit = parseUnitProperties([
    "User=ubuntu", "Type=forking", "PIDFile=/home/ubuntu/.pm2/pm2.pid",
    ...["ExecCondition", "ExecStartPre", "ExecStartPost", "EnvironmentFiles", "PassEnvironment", "UnsetEnvironment", "PAMName", "RootDirectory", "RootImage"].map(key => `${key}=`),
    "Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin PM2_HOME=/home/ubuntu/.pm2",
    "ExecStart={ path=/usr/lib/node_modules/pm2/bin/pm2 ; argv[]=/usr/lib/node_modules/pm2/bin/pm2 resurrect ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }",
  ].join("\n"));
  assert.equal(startupContract(unit).executable, "/usr/lib/node_modules/pm2/bin/pm2");
  for (const overrides of [
    { User: "root" }, { Type: "simple" }, { PIDFile: "/tmp/pm2.pid" },
    ...["ExecCondition", "ExecStartPre", "ExecStartPost", "EnvironmentFiles", "PassEnvironment", "UnsetEnvironment", "PAMName", "RootDirectory", "RootImage"].flatMap(key => [{ [key]: undefined }, { [key]: "/private/RAW_SECRET_CANARY" }]),
    { Environment: `${unit.Environment} NODE_OPTIONS=--require=/tmp/hook.cjs` },
    { ExecStart: unit.ExecStart.replace(" resurrect ", " resurrect extra ") },
    { ExecStart: `${unit.ExecStart} ${unit.ExecStart}` },
    { Environment: `${unit.Environment} PM2_HOME=/private/RAW_SECRET_CANARY` },
    { Environment: unit.Environment.replace("/usr/bin", "relative") },
    { Environment: 'PATH="$(RAW_SECRET_CANARY)" PM2_HOME=/home/ubuntu/.pm2' },
  ]) assert.equal(startupContract({ ...unit, ...overrides }), null);
  assert.throws(() => parseUnitProperties("User=ubuntu\nUser=root"), /duplicate/u);
  assert.throws(() => parseUnitProperties("RAW_SECRET_CANARY"), /invalid/u);
  const runner = "actions.runner.FanMind-FanMind.production.service";
  assert.equal(runnerUnitFromCgroup(`0::/system.slice/${runner}`), runner);
  assert.equal(runnerUnitFromCgroup("0::/user.slice/session.scope"), null);
  assert.equal(runnerUnitFromCgroup(`0::/system.slice/${runner}/actions.runner.other.service`), null);
});

test("saved PM2 launch rejects Node arguments and loader environment overrides", () => {
  assert.equal(savedAppMatches([{ ...savedApp(), node_args: [], interpreter_args: "" }], expectedCommit), true);
  for (const key of ["node_args", "interpreter_args"]) {
    for (const value of [["--require=/tmp/RAW_SECRET_CANARY"], "--inspect", null, {}]) {
      assert.equal(savedAppMatches([{ ...savedApp(), [key]: value }], expectedCommit), false);
    }
  }
  for (const key of ["NODE_OPTIONS", "NODE_PATH", "LD_PRELOAD", "LD_LIBRARY_PATH", "LD_AUDIT", "BASH_ENV", "ENV", "OPENSSL_CONF", "OPENSSL_MODULES"]) {
    assert.equal(savedAppMatches([{ ...savedApp(), [key]: "/tmp/RAW_SECRET_CANARY" }], expectedCommit), false);
    assert.equal(savedAppMatches([{ ...savedApp(), env: { [key]: "/tmp/RAW_SECRET_CANARY" } }], expectedCommit), false);
  }
});

test("next-boot release rejects a repointed symlink, wrong deployment ID and missing build artifacts", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-boot-release-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const releases = join(root, "releases"), current = join(root, "current"), release = join(releases, expectedCommit);
  await mkdir(join(release, ".next"), { recursive: true });
  await mkdir(join(release, "node_modules/next/dist/bin"), { recursive: true });
  const metadata = join(release, ".next/required-server-files.json");
  await writeFile(metadata, JSON.stringify({ config: { deploymentId: expectedCommit } }));
  await writeFile(join(release, ".next/BUILD_ID"), "build-id");
  const launcher = join(release, "node_modules/next/dist/bin/next");
  await writeFile(launcher, "// synthetic non-executed Next launcher");
  await symlink(release, current);
  assert.equal(releaseTargetMatches(expectedCommit, current, releases), true);
  await writeFile(metadata, JSON.stringify({ config: { deploymentId: "b".repeat(40) } }));
  assert.equal(releaseTargetMatches(expectedCommit, current, releases), false);
  await writeFile(metadata, JSON.stringify({ config: { deploymentId: expectedCommit } }));
  await rm(launcher);
  assert.equal(releaseTargetMatches(expectedCommit, current, releases), false);
  await writeFile(launcher, "// synthetic non-executed Next launcher");
  await rm(current);
  await symlink(root, current);
  assert.equal(releaseTargetMatches(expectedCommit, current, releases), false);
  assert.equal(releaseTargetMatches(expectedCommit, release, releases), false);
});

test("runner boot binds the actual registration and rejects missing or replaced startup artifacts", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-boot-runner-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "bin"));
  await mkdir(join(root, "externals/node20/bin"), { recursive: true });
  const unitName = "actions.runner.FanMind-FanMind.production.service";
  const context = { name: "synthetic-runner", workspace: join(root, "_work/FanMind"), repository: "FanMind/FanMind" };
  const settings = { agentName: context.name, gitHubUrl: "https://github.com/FanMind/FanMind", workFolder: "_work" };
  await writeFile(join(root, ".runner"), JSON.stringify(settings), { mode: 0o600 });
  await writeFile(join(root, ".service"), unitName, { mode: 0o600 });
  await writeFile(join(root, ".path"), "/usr/local/bin:/usr/bin:/bin", { mode: 0o600 });
  await writeFile(join(root, ".env"), "LANG=C.UTF-8\n", { mode: 0o600 });
  for (const relative of [".credentials", ".credentials_rsaparams"]) await writeFile(join(root, relative), "synthetic-not-a-credential", { mode: 0o600 });
  for (const relative of ["bin/Runner.Listener", "externals/node20/bin/node"]) await writeFile(join(root, relative), "synthetic-not-executed", { mode: 0o700 });
  const runsvc = await readFile("tests/fixtures/runner-startup-v2.337.0/runsvc.sh.txt", "utf8");
  await writeFile(join(root, "runsvc.sh"), runsvc, { mode: 0o700 });
  await writeFile(join(root, "bin/RunnerService.js"), await readFile("tests/fixtures/runner-startup-v2.337.0/RunnerService.js.txt"));
  const unit = {
    User: "ubuntu", Type: "simple", WorkingDirectory: root, Environment: "",
    ExecStart: `{ path=${root}/runsvc.sh ; argv[]=${root}/runsvc.sh ; ignore_errors=no ; pid=1 ; code=(null) ; status=0/0 }`,
    ...Object.fromEntries(["ExecCondition", "ExecStartPre", "ExecStartPost", "EnvironmentFiles", "PassEnvironment", "UnsetEnvironment", "PAMName", "RootDirectory", "RootImage"].map(key => [key, ""])),
  };
  assert.equal(runnerStartupMatches(unit, unitName, context), true);
  for (const overrides of [
    { User: "root" }, { WorkingDirectory: "/tmp/absent" }, { ExecStart: unit.ExecStart.replace(" ; ignore", " extra ; ignore") },
    { ExecStartPre: "/tmp/RAW_SECRET_CANARY" }, { Environment: "NODE_OPTIONS=--require=/tmp/hook.cjs" },
  ]) assert.equal(runnerStartupMatches({ ...unit, ...overrides }, unitName, context), false);
  assert.equal(runnerStartupMatches(unit, unitName, { ...context, name: "foreign" }), false);
  assert.equal(runnerStartupMatches(unit, unitName, { ...context, workspace: root }), false);
  await writeFile(join(root, ".path"), "/usr/bin NODE_OPTIONS=--require=/tmp/RAW_SECRET_CANARY");
  assert.equal(runnerStartupMatches(unit, unitName, context), false);
  await writeFile(join(root, ".path"), "/usr/bin:/bin");
  await writeFile(join(root, ".env"), "NODE_OPTIONS=--require=/tmp/RAW_SECRET_CANARY\n");
  assert.equal(runnerStartupMatches(unit, unitName, context), false);
  await writeFile(join(root, ".env"), "LANG=C.UTF-8\n");
  await writeFile(join(root, "runsvc.sh"), "#!/bin/bash\nexit 1\n");
  assert.equal(runnerStartupMatches(unit, unitName, context), false);
  await writeFile(join(root, "runsvc.sh"), runsvc);
  await writeFile(join(root, ".runner"), JSON.stringify({ ...settings, gitHubUrl: "https://github.com/other/repo" }));
  assert.equal(runnerStartupMatches(unit, unitName, context), false);
  await writeFile(join(root, ".runner"), JSON.stringify(settings));
  for (const relative of ["runsvc.sh", "bin/RunnerService.js", "bin/Runner.Listener", "externals/node20/bin/node", ".service", ".credentials", ".credentials_rsaparams"]) {
    const file = join(root, relative), content = await readFile(file);
    await rm(file);
    assert.equal(runnerStartupMatches(unit, unitName, context), false, relative);
    await writeFile(file, content, { mode: 0o700 });
  }
  assert.equal(runnerStartupMatches(unit, unitName, context), true);
  await chmod(join(root, ".credentials"), 0o644);
  assert.equal(runnerStartupMatches(unit, unitName, context), false);
});

test("actual workflow keeps boot readiness separate and never publishes private unit values", async (t) => {
  const good = await runAuditWorkflow(t, validAuditOutput(), 0);
  assert.equal(good.code, 0);
  assert.match(good.stdout, /^PRODUCTION_BOOT_READINESS_VERIFIED=true$/mu);
  const bad = await runAuditWorkflow(t, validAuditOutput().replace(
    "BOOT_UNIT_PM2=loaded|enabled|active|no", "BOOT_UNIT_PM2=RAW_SECRET_CANARY|disabled|inactive"), 0);
  assert.equal(bad.code, 0, "the prior live Operations contract remains independent");
  assert.match(bad.stdout, /^PRODUCTION_AUDIT_VERIFIED=true$/mu);
  assert.match(bad.stdout, /^PRODUCTION_BOOT_READINESS_VERIFIED=false$/mu);
  assert.doesNotMatch(bad.stdout, /RAW_SECRET_CANARY/u);
});

test("boot Node rejects a writable or missing earlier PATH directory", () => {
  // The test runtime need not be root-installed (for example hostedtoolcache
  // on CI), but an unsafe prefix must reject independently of that runtime.
  assert.equal(bootNodeMatches([tmpdir(), dirname(process.execPath)]), false);
  assert.equal(bootNodeMatches(["/fanmind-nonexistent-boot-path", dirname(process.execPath)]), false);
  assert.equal(bootNodeMatches([]), false);
});

function validAuditOutput(overrides = {}) {
  const values = {
    NODE_VERSION: "v22.13.1",
    PM2_NODE_VERSION: "24.19.0",
    HOST_UPTIME_SECONDS: "9000",
    HOST_BOOT_ID: "01234567-89ab-cdef-0123-456789abcdef",
    SERVER_HEAD: expectedCommit,
    ORIGIN_MAIN: expectedCommit,
    LIVE_RELEASE: expectedCommit,
    LIVE_ENVIRONMENT: "production",
    LIVE_RUNTIME_ENVIRONMENT: "production",
    LIVE_HEALTH: "healthy",
    PM2_STATUS: "online",
    PM2_EXEC_MODE: "cluster_mode",
    PM2_CWD: "/var/www/fanmind-current",
    PM2_RESTARTS: "12",
    PM2_UNSTABLE_RESTARTS: "0",
    PM2_UPTIME_SECONDS: "7200",
    SERVER_ERROR_TRACKING_ENABLED: "true",
    SERVER_ERROR_EMAIL_ENABLED: "false",
    NGINX_CONFIG: "ok",
    NGINX_ACTIVE: "active",
    LOCAL_LOGIN_HTTP: "200",
    PUBLIC_LOGIN_HTTP: "200",
    ROOT_DISK_USED_PERCENT: "41",
    MEMORY_AVAILABLE_KIB: "2048000",
    REBOOT_REQUIRED: "false",
    FANMIND_SYSTEMD_UNIT_COUNT: "17",
    BACKUP_ROOT: "available",
    BACKUP_COMPLETE_PAIR_COUNT: "7",
    BACKUP_ORPHAN_PAIR_COUNT: "0",
    BACKUP_VERIFY_OK: "true",
    BACKUP_VERIFY_MODE: "checksum_only",
    BACKUP_VERIFY_TYPE: "full",
    BACKUP_VERIFY_SIZE_BYTES: "5000000",
    OFFSITE_ENABLED: "true",
    OFFSITE_STATUS: "reachable",
    OFFSITE_COMPLETE_PAIR_COUNT: "38",
    OFFSITE_ORPHAN_PAIR_COUNT: "0",
    OFFSITE_LATEST_FULL: "fanmind-full-redacted.tar.gz.age",
    BACKUP_WORKER_STRUCTURED_EVENT_COUNT: "40",
    BACKUP_WORKER_24H_FAILURE_EVENT_COUNT: "0",
    BACKUP_WORKER_24H_FAILURE_FREE: "true",
    AUDIT_RESULT: "success",
    ...overrides,
  };
  const health = [
    "application",
    "supabase_config",
    "supabase_database",
    "supabase_storage",
    "stripe_config",
    "openai_config",
    "shared_rate_limit_config",
    "email_config",
  ].map((component) => `HEALTH_COMPONENT=${component}:healthy`);
  const backups = [
    ["database", "12.50"],
    ["storage", "11.25"],
    ["server_config", "10.75"],
    ["full", "120.00"],
  ].map(
    ([type, age]) =>
      `BACKUP_LATEST=${type}|file=fanmind-${type}-redacted.age|age_hours=${age}|size_bytes=1000|pair=complete`,
  );
  return [
    ...validBootLines(),
    "AUDIT_UTC=2026-07-30T12:00:00Z",
    `NODE_VERSION=${values.NODE_VERSION}`,
    `PM2_NODE_VERSION=${values.PM2_NODE_VERSION}`,
    `HOST_UPTIME_SECONDS=${values.HOST_UPTIME_SECONDS}`,
    `HOST_BOOT_ID=${values.HOST_BOOT_ID}`,
    `SERVER_HEAD=${values.SERVER_HEAD}`,
    `ORIGIN_MAIN=${values.ORIGIN_MAIN}`,
    `LIVE_RELEASE=${values.LIVE_RELEASE}`,
    `LIVE_ENVIRONMENT=${values.LIVE_ENVIRONMENT}`,
    `LIVE_RUNTIME_ENVIRONMENT=${values.LIVE_RUNTIME_ENVIRONMENT}`,
    `LIVE_HEALTH=${values.LIVE_HEALTH}`,
    ...health,
    `PM2_STATUS=${values.PM2_STATUS}`,
    `PM2_RESTARTS=${values.PM2_RESTARTS}`,
    `PM2_UNSTABLE_RESTARTS=${values.PM2_UNSTABLE_RESTARTS}`,
    `PM2_UPTIME_SECONDS=${values.PM2_UPTIME_SECONDS}`,
    `PM2_CWD=${values.PM2_CWD}`,
    `PM2_EXEC_MODE=${values.PM2_EXEC_MODE}`,
    "PM2_MEMORY_BYTES=100000000",
    `SERVER_ERROR_TRACKING_ENABLED=${values.SERVER_ERROR_TRACKING_ENABLED}`,
    `SERVER_ERROR_EMAIL_ENABLED=${values.SERVER_ERROR_EMAIL_ENABLED}`,
    `NGINX_CONFIG=${values.NGINX_CONFIG}`,
    `NGINX_ACTIVE=${values.NGINX_ACTIVE}`,
    `LOCAL_LOGIN_HTTP=${values.LOCAL_LOGIN_HTTP}`,
    `PUBLIC_LOGIN_HTTP=${values.PUBLIC_LOGIN_HTTP}`,
    `ROOT_DISK_USED_PERCENT=${values.ROOT_DISK_USED_PERCENT}`,
    `MEMORY_AVAILABLE_KIB=${values.MEMORY_AVAILABLE_KIB}`,
    `REBOOT_REQUIRED=${values.REBOOT_REQUIRED}`,
    `FANMIND_SYSTEMD_UNIT_COUNT=${values.FANMIND_SYSTEMD_UNIT_COUNT}`,
    `BACKUP_ROOT=${values.BACKUP_ROOT}`,
    `BACKUP_COMPLETE_PAIR_COUNT=${values.BACKUP_COMPLETE_PAIR_COUNT}`,
    `BACKUP_ORPHAN_PAIR_COUNT=${values.BACKUP_ORPHAN_PAIR_COUNT}`,
    ...backups,
    "LATEST_FULL_BACKUP=fanmind-full-redacted.tar.gz.age",
    `BACKUP_VERIFY_OK=${values.BACKUP_VERIFY_OK}`,
    `BACKUP_VERIFY_MODE=${values.BACKUP_VERIFY_MODE}`,
    `BACKUP_VERIFY_TYPE=${values.BACKUP_VERIFY_TYPE}`,
    "BACKUP_VERIFY_ARTIFACT=fanmind-full-redacted.tar.gz.age",
    `BACKUP_VERIFY_SIZE_BYTES=${values.BACKUP_VERIFY_SIZE_BYTES}`,
    `OFFSITE_ENABLED=${values.OFFSITE_ENABLED}`,
    `OFFSITE_STATUS=${values.OFFSITE_STATUS}`,
    "OFFSITE_RELEVANT_OBJECT_COUNT=76",
    `OFFSITE_COMPLETE_PAIR_COUNT=${values.OFFSITE_COMPLETE_PAIR_COUNT}`,
    `OFFSITE_ORPHAN_PAIR_COUNT=${values.OFFSITE_ORPHAN_PAIR_COUNT}`,
    `OFFSITE_LATEST_FULL=${values.OFFSITE_LATEST_FULL}`,
    `BACKUP_WORKER_STRUCTURED_EVENT_COUNT=${values.BACKUP_WORKER_STRUCTURED_EVENT_COUNT}`,
    `BACKUP_WORKER_24H_FAILURE_EVENT_COUNT=${values.BACKUP_WORKER_24H_FAILURE_EVENT_COUNT}`,
    `BACKUP_WORKER_24H_FAILURE_FREE=${values.BACKUP_WORKER_24H_FAILURE_FREE}`,
    `AUDIT_RESULT=${values.AUDIT_RESULT}`,
    "",
  ].join("\n");
}

async function runWithResult(command, args, options) {
  try {
    return { ...(await execFileAsync(command, args, options)), code: 0 };
  } catch (error) {
    if (typeof error.code !== "number") throw error;
    return { code: error.code, stdout: error.stdout, stderr: error.stderr };
  }
}

async function runAuditWorkflow(t, output, exitCode) {
  const root = await mkdtemp(join(tmpdir(), "fanmind-audit-workflow-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runnerTemp = join(root, "runner");
  await mkdir(runnerTemp);
  const audit = join(root, "audit.sh");
  await writeFile(audit, '#!/bin/bash\nprintf "%s" "$AUDIT_TEST_OUTPUT"\nprintf "%s\\n" "RAW_SECRET_CANARY" >&2\nexit "$AUDIT_TEST_EXIT"\n', { mode: 0o700 });
  const workflow = yaml.load(await readFile(".github/workflows/production-readonly-audit.yml", "utf8"));
  // Execute the actual production step, substituting only its installed paths.
  const step = workflow.jobs.audit.steps[0].run
    .replaceAll("/usr/local/lib/fanmind-audit/read-only-production-audit.sh", '"$AUDIT_TEST_SCRIPT"')
    .replaceAll("/usr/local/lib/fanmind-audit/verify-production-audit-output.mjs", '"$AUDIT_TEST_VERIFIER"');
  const result = await runWithResult("bash", ["-euo", "pipefail", "-c", step], {
    env: { ...process.env, RUNNER_TEMP: runnerTemp, EXPECTED_COMMIT: expectedCommit,
      AUDIT_TEST_SCRIPT: audit, AUDIT_TEST_VERIFIER: resolve("scripts/operations/verify-production-audit-output.mjs"),
      AUDIT_TEST_OUTPUT: output, AUDIT_TEST_EXIT: String(exitCode) },
  });
  assert.deepEqual(await readdir(runnerTemp), [], "both private files must be removed");
  assert.doesNotMatch(result.stdout + result.stderr, /RAW_SECRET_CANARY/u);
  return result;
}

test("actual workflow preserves successful full audit and measured runtime versions", async (t) => {
  const result = await runAuditWorkflow(t, validAuditOutput(), 0);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /^PRODUCTION_AUDIT_VERIFIED=true$/mu);
  assert.match(result.stdout, /^PRODUCTION_RUNTIME_VERIFIED=true$/mu);
  assert.match(result.stdout, /^PRODUCTION_SHELL_NODE_VERSION=v22\.13\.1$/mu);
  assert.match(result.stdout, /^PRODUCTION_PM2_NODE_VERSION=24\.19\.0$/mu);
  assert.equal(result.stdout.match(/^PRODUCTION_HEALTH_COMPONENT=.+:healthy$/gmu)?.length, 8);
});

test("actual workflow diagnoses a silent shell failure and cannot turn it into a pass", async (t) => {
  const output = validAuditOutput({ AUDIT_RESULT: "failed" }) + "AUDIT_FAILED_STAGE=backup_inventory\nAUDIT_EXIT_CODE=7\n";
  const result = await runAuditWorkflow(t, output, 7);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /^PRODUCTION_AUDIT_VERIFIED=false$/mu);
  assert.match(result.stdout, /^PRODUCTION_AUDIT_FAILED_STAGE=backup_inventory$/mu);
  assert.match(result.stdout, /^PRODUCTION_AUDIT_EXIT_CODE=7$/mu);
  assert.match(result.stdout, /^PRODUCTION_RUNTIME_VERIFIED=true$/mu);
  assert.doesNotMatch(result.stdout, /^PRODUCTION_AUDIT_VERIFIED=true$/mu);
  const forgedSuccess = await runAuditWorkflow(t, validAuditOutput(), 7);
  assert.equal(forgedSuccess.code, 1, "process failure overrides a success marker");
  const empty = await runAuditWorkflow(t, "", 7);
  assert.equal(empty.code, 1);
  assert.match(empty.stdout, /^PRODUCTION_RUNTIME_VERIFIED=false$/mu);
});

test("actual workflow keeps backup and runtime validation failures fail-closed and redacted", async (t) => {
  for (const [override, code] of [
    [{ BACKUP_WORKER_24H_FAILURE_EVENT_COUNT: "1" }, "backup_worker_failures_present"],
    [{ OFFSITE_ORPHAN_PAIR_COUNT: "1" }, "offsite_orphans_present"],
    [{ PM2_NODE_VERSION: "RAW_SECRET_CANARY" }, "pm2_node_version_invalid"],
    [{ PM2_EXEC_MODE: "fork_mode" }, "pm2_launch_contract_invalid"],
    [{ PM2_CWD: "/var/www/RAW_SECRET_CANARY" }, "pm2_launch_contract_invalid"],
    [{ NGINX_ACTIVE: "inactive" }, "nginx_inactive"],
  ]) {
    const result = await runAuditWorkflow(t, validAuditOutput(override), 0);
    assert.equal(result.code, 1);
    assert.match(result.stdout, new RegExp(`^PRODUCTION_AUDIT_FAILURE_CODE=production_audit_${code}$`, "mu"));
  }
  const injected = await runAuditWorkflow(t, validAuditOutput({ AUDIT_RESULT: "failed" }) + "AUDIT_FAILED_STAGE=RAW_SECRET_CANARY\n", 7);
  assert.equal(injected.code, 1);
  assert.match(injected.stdout, /^PRODUCTION_AUDIT_FAILED_STAGE=unknown$/mu);
  const malformed = await runAuditWorkflow(t, "RAW_SECRET_CANARY\n", 0);
  assert.equal(malformed.code, 1);
});

test("runtime subset rejects release drift and an omitted eighth health component", () => {
  assert.throws(() => verifyProductionRuntimeOutput(validAuditOutput({ LIVE_RELEASE: "b".repeat(40) }), expectedCommit), /release_drift/u);
  assert.throws(() => verifyProductionRuntimeOutput(validAuditOutput().replace("HEALTH_COMPONENT=email_config:healthy\n", ""), expectedCommit), /health_components_unhealthy/u);
});

test("real audit shell captures early probe failure and later explicit exit without leaking PM2 environment", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-audit-shell-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bin = join(root, "bin");
  await mkdir(bin);
  await symlink(process.execPath, join(bin, "node"));
  const checks = ["application", "supabase_config", "supabase_database", "supabase_storage", "stripe_config", "openai_config", "shared_rate_limit_config", "email_config"].map(component => ({ component, status: "healthy" }));
  const mock = `#!/bin/bash
case "\${0##*/}" in
  npm) echo 10.8.0 ;;
  git) printf '%s\\n' "$AUDIT_TEST_COMMIT" ;;
  pm2)
    if [[ "$1" == --version ]]; then echo 6.0.14; else
      printf '%s\\n' '[{"name":"fanmind","pm2_env":{"status":"online","exec_mode":"cluster_mode","pm_cwd":"/var/www/fanmind-current","node_version":"24.19.0","restart_time":12,"unstable_restarts":0,"pm_uptime":1,"SECRET":"RAW_SECRET_CANARY"}}]'
    fi ;;
  curl)
    case "\${!#}" in
      */api/version)
        if [[ "$AUDIT_TEST_MODE" == early ]]; then echo RAW_SECRET_CANARY >&2; exit 7; fi
        printf '%s\\n' '{"releaseCommit":"${expectedCommit}","environment":"production","runtimeEnvironment":"production"}' ;;
      */api/health) printf '%s\\n' '${JSON.stringify({ status: "healthy", checks })}' ;;
      *) printf '200' ;;
    esac ;;
  sudo) shift; exec "$@" ;;
  nginx) exit 0 ;;
  systemctl)
    if [[ "$1" == list-unit-files ]]; then echo 'fanmind-monitor.service enabled'; else echo active; fi ;;
  journalctl) exit 1 ;;
esac
`;
  for (const command of ["npm", "git", "pm2", "curl", "sudo", "nginx", "systemctl", "journalctl"]) {
    await writeFile(join(bin, command), mock, { mode: 0o700 });
  }
  const envPath = join(root, "production.env");
  await writeFile(envPath, "FANMIND_SERVER_ERROR_TRACKING_ENABLED=true\nFANMIND_SERVER_ERROR_EMAIL_ENABLED=false\nOTHER_SECRET=RAW_SECRET_CANARY\n", { mode: 0o600 });
  for (const [mode, stage] of [["early", "release"], ["later", "backup_inventory"]]) {
    const result = await runWithResult("bash", [auditScriptPath], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TMPDIR: root,
        AUDIT_TEST_MODE: mode, AUDIT_TEST_COMMIT: expectedCommit,
        FANMIND_AUDIT_BACKUP_ROOT: join(root, "absent"), FANMIND_AUDIT_PRODUCTION_ENV_PATH: envPath },
    });
    assert.notEqual(result.code, 0);
    assert.match(result.stdout, new RegExp(`^AUDIT_FAILED_STAGE=${stage}$`, "mu"));
    assert.match(result.stdout, /^AUDIT_RESULT=failed$/mu);
    assert.doesNotMatch(result.stdout, /RAW_SECRET_CANARY/u);
    assert.equal((await readdir(root)).filter(name => name.startsWith("tmp.")).length, 0, "internal private files cleaned on explicit exit");
    const published = await runAuditWorkflow(t, result.stdout, result.code);
    assert.equal(published.code, 1);
    assert.match(published.stdout, new RegExp(`^PRODUCTION_AUDIT_FAILED_STAGE=${stage}$`, "mu"));
    if (mode === "later") assert.match(published.stdout, /^PRODUCTION_RUNTIME_VERIFIED=true$/mu);
  }
});

test("production audit is valid bash", async () => {
  await execFileAsync("bash", ["-n", auditScriptPath]);
});

test("production audit exposes only read-only runtime and backup checks", async () => {
  const source = await readAuditScript();

  assert.match(source, /^#!\/usr\/bin\/env bash\nset -euo pipefail/u);
  assert.match(source, /verify-backup-artifact\.mjs/u);
  assert.match(source, /--artifact "\$latest_full" --json/u);
  assert.match(source, /BACKUP_VERIFY_MODE/u);
  assert.match(source, /BACKUP_VERIFY_TYPE/u);
  assert.match(
    source,
    /sudo -n "\$rclone_bin" --config "\$config" lsf "\$\{remote\}:\$\{remote_path\}" --files-only --recursive/u,
  );
  assert.match(source, /journalctl -u fanmind-backup-worker\.service/u);
  assert.match(source, /pm2 jlist \| PM2_APP_NAME="\$PM2_APP_NAME" node -e/u);
  assert.match(source, /read_config_value\(\)/u);
  assert.match(source, /LIVE_RUNTIME_ENVIRONMENT/u);
  assert.match(source, /FANMIND_AUDIT_PRODUCTION_ENV_PATH/u);
  assert.match(source, /MAX_ENV_BYTES = 64 \* 1024/u);
  assert.match(source, /fs\.constants\.O_NOFOLLOW/u);
  assert.match(source, /fs\.realpathSync\(filePath\)/u);
  assert.match(source, /entries\.length !== 1/u);
  assert.match(source, /\['true', 'false'\]\.includes\(entries\[0\]\)/u);
  assert.match(source, /SERVER_ERROR_TRACKING_ENABLED/u);
  assert.match(source, /SERVER_ERROR_EMAIL_ENABLED/u);

  assert.doesNotMatch(source, /--identity\b/u);
  assert.doesNotMatch(source, /\bage\s+(?:--decrypt|-d)\b/u);
  assert.doesNotMatch(source, /\bpg_restore\b|\bpsql\b/u);
  assert.doesNotMatch(
    source,
    /\brclone\s+(?:copy|copyto|sync|move|moveto|delete|deletefile|purge)\b/u,
  );
  assert.doesNotMatch(
    source,
    /\bsystemctl\s+(?:start|restart|stop|enable|disable|daemon-reload|mask|unmask)\b/u,
  );
  assert.doesNotMatch(
    source,
    /\bpm2\s+(?:start|restart|reload|stop|delete|save|startup|unstartup)\b/u,
  );
  assert.doesNotMatch(source, /\bgit\s+(?:reset|checkout|pull|push|clean)\b/u);
  assert.doesNotMatch(source, /curl[^\n]*\s-X\s*(?:POST|PUT|PATCH|DELETE)\b/iu);
  assert.doesNotMatch(source, /\bsource\s+["']?\$?env_file\b/u);
  assert.doesNotMatch(source, /\bcat\s+[^\n]*worker\.env/u);
  assert.doesNotMatch(source, /sudo\s+-n\s+bash\b/u);
  assert.doesNotMatch(source, /BACKUP_VERIFY_CHECKSUM/u);
  assert.doesNotMatch(source, /console\.log\(`FANMIND_/u);
  assert.doesNotMatch(source, /console\.log\(source\)/u);
});

test("production audit output verifier accepts one complete redacted pass", () => {
  const result = verifyProductionAuditOutput(
    validAuditOutput(),
    expectedCommit,
  );

  assert.equal(result.releaseCommit, expectedCommit);
  assert.equal(result.healthComponentCount, 8);
  assert.equal(result.pm2Restarts, 12);
  assert.equal(result.serverErrorTrackingEnabled, true);
  assert.equal(result.serverErrorEmailEnabled, false);
  assert.equal(result.backupCompletePairCount, 7);
  assert.equal(result.offsiteCompletePairCount, 38);
});

test("production audit output verifier fails closed on drift and degraded safeguards", () => {
  assert.throws(
    () =>
      verifyProductionAuditOutput(
        validAuditOutput({ LIVE_RELEASE: "b".repeat(40) }),
        expectedCommit,
      ),
    /production_audit_release_drift/u,
  );
  assert.throws(
    () =>
      verifyProductionAuditOutput(
        validAuditOutput({ LIVE_RUNTIME_ENVIRONMENT: "staging" }),
        expectedCommit,
      ),
    /production_audit_runtime_environment_invalid/u,
  );
  assert.throws(
    () =>
      verifyProductionAuditOutput(
        validAuditOutput({ OFFSITE_ORPHAN_PAIR_COUNT: "1" }),
        expectedCommit,
      ),
    /production_audit_offsite_orphans_present/u,
  );
  assert.throws(
    () =>
      verifyProductionAuditOutput(
        validAuditOutput({ BACKUP_WORKER_24H_FAILURE_EVENT_COUNT: "1" }),
        expectedCommit,
      ),
    /production_audit_backup_worker_failures_present/u,
  );
  assert.throws(
    () =>
      verifyProductionAuditOutput(
        validAuditOutput({ SERVER_ERROR_TRACKING_ENABLED: "false" }),
        expectedCommit,
      ),
    /production_audit_server_error_tracking_disabled/u,
  );
  assert.throws(
    () =>
      verifyProductionAuditOutput(
        validAuditOutput({ SERVER_ERROR_EMAIL_ENABLED: "true" }),
        expectedCommit,
      ),
    /production_audit_server_error_email_enabled/u,
  );
  assert.throws(
    () =>
      verifyProductionAuditOutput(
        `${validAuditOutput()}SERVER_ERROR_TRACKING_ENABLED=true\n`,
        expectedCommit,
      ),
    /production_audit_server_error_tracking_enabled_cardinality_invalid/u,
  );
});

test("permanent Production audit runs installed root-owned code only", async () => {
  const [workflow, deploy, manifest, runbook] = await Promise.all([
    readFile(".github/workflows/production-readonly-audit.yml", "utf8"),
    readFile(".github/workflows/deploy-fanmind.yml", "utf8"),
    readFile("package.json", "utf8"),
    readFile("docs/operations/READ_ONLY_PRODUCTION_AUDIT.md", "utf8"),
  ]);

  assert.match(workflow, /workflow_run:[\s\S]*Deploy FanMind/u);
  assert.match(workflow, /schedule:[\s\S]*17 4 \* \* \*/u);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /run-read-only-production-audit/u);
  assert.match(workflow, /runs-on: \[self-hosted, fanmind-prod, exoscale, linux, x64\]/u);
  assert.match(workflow, /environment: production/u);
  assert.match(
    workflow,
    /^\s+\/usr\/local\/lib\/fanmind-audit\/read-only-production-audit\.sh \\/mu,
  );
  assert.match(
    workflow,
    /\/usr\/local\/lib\/fanmind-audit\/verify-production-audit-output\.mjs/u,
  );
  assert.match(
    workflow,
    /FANMIND_AUDIT_VERIFIER_PATH=\/usr\/local\/lib\/fanmind-ops\/verify-backup-artifact\.mjs/u,
  );
  assert.match(workflow, /trap 'rm -f "\$AUDIT_OUTPUT" "\$AUDIT_STDERR"' EXIT/u);
  assert.doesNotMatch(workflow, /actions\/checkout|upload-artifact/u);
  assert.doesNotMatch(
    workflow,
    /sudo -n \/usr\/local\/lib\/fanmind-audit\/read-only-production-audit\.sh/u,
  );

  assert.match(
    deploy,
    /sudo install -d -o root -g root -m 0700 \/usr\/local\/lib\/fanmind-ops/u,
  );
  assert.match(
    deploy,
    /sudo install -d -o root -g root -m 0755 \/usr\/local\/lib\/fanmind-audit/u,
  );
  assert.match(
    deploy,
    /sudo install -o root -g root -m 0755 scripts\/operations\/read-only-production-audit\.sh \/usr\/local\/lib\/fanmind-audit\/read-only-production-audit\.sh/u,
  );
  assert.match(
    deploy,
    /sudo install -o root -g root -m 0755 scripts\/operations\/verify-production-audit-output\.mjs \/usr\/local\/lib\/fanmind-audit\/verify-production-audit-output\.mjs/u,
  );
  assert.match(deploy, /scripts\/public-health-policy\.mjs \/usr\/local\/lib\/public-health-policy\.mjs/u);

  const parsed = JSON.parse(manifest);
  assert.equal(
    parsed.scripts["production:audit:verify"],
    "node scripts/operations/verify-production-audit-output.mjs",
  );
  assert.match(runbook, /checkt keinen Repository-Code aus/u);
  assert.match(runbook, /kein Audit-Artefakt hochgeladen/u);
});

test("production audit uses stable timer properties instead of localized timer columns", async () => {
  const source = await readAuditScript();

  assert.match(source, /systemctl show "\$unit" --property=NextElapseUSecRealtime --value/u);
  assert.match(source, /systemctl show "\$unit" --property=NextElapseUSecMonotonic --value/u);
  assert.match(source, /systemctl show "\$unit" --property=LastTriggerUSec --value/u);
  assert.match(
    source,
    /SYSTEMD_TIMER=%s\|next_realtime=%s\|next_monotonic=%s\|last=%s/u,
  );
  assert.doesNotMatch(source, /systemctl list-timers/u);
});

test("production audit reports backup worker events by bounded time window without raw failures", async () => {
  const source = await readAuditScript();

  assert.match(source, /\{ name: '24h', since:/u);
  assert.match(source, /\{ name: '14d', since:/u);
  assert.match(source, /BACKUP_WORKER_WINDOW=\$\{window\.name\}/u);
  assert.match(source, /BACKUP_WORKER_EVENT=\$\{window\.name\}\|\$\{event\}:/u);
  assert.match(source, /BACKUP_WORKER_24H_FAILURE_EVENT_COUNT/u);
  assert.match(source, /BACKUP_WORKER_24H_FAILURE_FREE/u);

  assert.doesNotMatch(source, /payload\.job_id/u);
  assert.doesNotMatch(source, /payload\.error/u);
  assert.doesNotMatch(source, /error_message/u);
});

test("production audit never logs backup configuration values or raw PM2 payloads", async () => {
  const source = await readAuditScript();

  assert.match(source, /OFFSITE_ENABLED/u);
  assert.match(source, /OFFSITE_STATUS/u);
  assert.match(source, /OFFSITE_COMPLETE_PAIR_COUNT/u);
  assert.match(source, /BACKUP_WORKER_EVENT/u);

  assert.doesNotMatch(source, /echo\s+.*FANMIND_BACKUP_RCLONE_REMOTE/u);
  assert.doesNotMatch(source, /echo\s+.*SUPABASE_SERVICE_ROLE_KEY/u);
  assert.doesNotMatch(source, /echo\s+.*DATABASE_URL/u);
  assert.doesNotMatch(source, /echo\s+.*\.env\.production/u);
  assert.doesNotMatch(source, /console\.log\([^\n]*JSON\.stringify\(rows/u);
  assert.doesNotMatch(source, /console\.log\([^\n]*processRow\.pm2_env/u);
});
