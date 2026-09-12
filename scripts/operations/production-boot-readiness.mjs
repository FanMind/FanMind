#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// This collector never starts/enables services or executes a saved PM2 command.
export const BOOT_UNITS = Object.freeze({
  NGINX: "nginx.service",
  PM2: "pm2-ubuntu.service",
  BACKUP_WORKER: "fanmind-backup-worker.service",
  BACKUP_DATABASE: "fanmind-backup-database.timer",
  BACKUP_STORAGE: "fanmind-backup-storage.timer",
  BACKUP_CONFIG: "fanmind-backup-server_config.timer",
  BACKUP_FULL: "fanmind-backup-full.timer",
  BACKUP_RETENTION: "fanmind-backup-retention.timer",
  MONITOR: "fanmind-operations-monitor.timer",
});
export const BOOT_ROLES = Object.freeze([...Object.keys(BOOT_UNITS), "RUNNER"]);
const STATES = Object.freeze({
  load: ["loaded", "not-found", "masked", "error", "bad-setting"],
  enabled: ["enabled", "disabled", "masked", "static", "indirect", "enabled-runtime", "masked-runtime", "alias", "generated", "transient"],
  active: ["active", "inactive", "failed", "activating", "deactivating", "reloading"],
  reload: ["no", "yes"],
});
const FIXED_CHECKS = ["PM2_STARTUP", "PM2_SAVED_APP", "BOOT_NODE", "RUNNER_BOUND", "RELEASE_TARGET", "REFERENCE_BOUND", "UNIT_CONTRACTS"];
const PM2_HOME = "/home/ubuntu/.pm2";
const CURRENT = "/var/www/fanmind-current";
const RELEASE_ROOT = "/var/www/fanmind-releases";
const START_HOOKS = ["ExecCondition", "ExecStartPre", "ExecStartPost", "ExecStopPost"];
const SERVICE_INPUTS = ["EnvironmentFiles", "PassEnvironment", "UnsetEnvironment", "PAMName", "RootDirectory", "RootImage"];
const LAUNCH_ENV = ["NODE_OPTIONS", "NODE_PATH", "LD_PRELOAD", "LD_LIBRARY_PATH", "LD_AUDIT", "BASH_ENV", "ENV", "OPENSSL_CONF", "OPENSSL_MODULES"];
const UNIT_PROPERTIES = ["Id", "FragmentPath", "DropInPaths", "Conditions", "Asserts"];
const REFERENCE_FILE = "/etc/fanmind/production-boot-reference.json";
const SHA256 = /^[a-f0-9]{64}$/u;
export const MANAGED_UNIT_HASHES = Object.freeze({
  "fanmind-backup-worker.service": "ae4a16dea717bc407274c1623e9dc5fd1aa9f67c0dcd41465bffa9dba3a50896",
  "fanmind-backup-database.timer": "2c38eed5918afe5fe22eb994484183842c9d5362ef84dc15dbede9541a3d61fd",
  "fanmind-backup-storage.timer": "9357029954d54d930ad99e9409914e702097b221fa8bcd1443a94dcf646b8249",
  "fanmind-backup-server_config.timer": "dd32a9144a4d963824cf187cdf107dab7b2d1d1af7ae7db54d6f768e2643b178",
  "fanmind-backup-full.timer": "460ecd1c6ea441cd00060c823e7dd45079a3b32841c0f6d3589f4b4d401bc889",
  "fanmind-backup-retention.timer": "c9202e6bb273bc08e2132551a9911b8ad91ac626366491c96e4d8c1185dfc614",
  "fanmind-backup-enqueue@.service": "47f6a51b945293ca28f736e3e44681e8cdf2694a44af03b5682437e76237b082",
  "fanmind-backup-retention.service": "8c3412bc1e343aa059252eec883c80abf7b9005153a70f2d7153b27417f7e029",
  "fanmind-operations-monitor.timer": "8acdaa1857021cdc96b11154d99ac5d9a3b378faa45cd3fc22bdda43684355f8",
  "fanmind-operations-monitor.service": "db8e3dc3cce87fd9b2155e7b4b92e1d2711740083df0937b57d23fcd4dbe42be",
});
const TIMER_SERVICES = [
  "fanmind-backup-enqueue@backup_database.service", "fanmind-backup-enqueue@backup_storage.service",
  "fanmind-backup-enqueue@backup_server_config.service", "fanmind-backup-enqueue@backup_full.service",
  "fanmind-backup-retention.service", "fanmind-operations-monitor.service",
];
const digest = source => createHash("sha256").update(source).digest("hex");

function state(value, kind) {
  return STATES[kind].includes(value) ? value : "unknown";
}

export function parseUnitProperties(source) {
  const result = {};
  for (const line of source.trim().split("\n")) {
    const at = line.indexOf("=");
    if (at < 1) throw new Error("unit_properties_invalid");
    const key = line.slice(0, at);
    if (Object.hasOwn(result, key)) throw new Error("unit_properties_duplicate");
    result[key] = line.slice(at + 1);
  }
  return result;
}

function readUnit(unit, extra = []) {
  try {
    return parseUnitProperties(execFileSync("/bin/systemctl", [
      "show", "--no-pager", "--all",
      ...["LoadState", "UnitFileState", "ActiveState", "NeedDaemonReload", ...UNIT_PROPERTIES, ...extra].map(key => `--property=${key}`),
      "--", unit,
    ], { encoding: "utf8", timeout: 10_000, maxBuffer: 128 * 1024, stdio: ["ignore", "pipe", "pipe"] }));
  } catch {
    return {};
  }
}

// Read one bounded regular file without following final/ancestor symlinks or
// accepting a replacement during the read. No private value leaves this module.
function readOwnedFile(file, maxBytes = 1024 * 1024, owner = process.getuid()) {
  let fd;
  try {
    if (fs.realpathSync(file) !== file) throw new Error("file_path_invalid");
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const before = fs.fstatSync(fd);
    if (!before.isFile() || before.size > maxBytes ||
        before.uid !== owner || (before.mode & 0o022) !== 0) throw new Error("file_metadata_invalid");
    const buffer = Buffer.alloc(before.size + 1);
    const bytes = fs.readSync(fd, buffer, 0, buffer.length, 0);
    const after = fs.fstatSync(fd);
    const current = fs.lstatSync(file);
    if (bytes !== before.size || before.size !== after.size || before.mtimeMs !== after.mtimeMs ||
        before.ctimeMs !== after.ctimeMs || before.ino !== current.ino || before.dev !== current.dev ||
        current.isSymbolicLink() || fs.realpathSync(file) !== file) throw new Error("file_changed");
    return buffer.subarray(0, bytes).toString("utf8");
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

export function readSavedApp(file, expectedCommit) {
  try { return savedAppMatches(JSON.parse(readOwnedFile(file)), expectedCommit); } catch { return false; }
}

function noLaunchOverrides(value) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    LAUNCH_ENV.every(key => !Object.hasOwn(value, key) || value[key] === "");
}

export function savedAppMatches(rows, expectedCommit) {
  if (!/^[a-f0-9]{40}$/u.test(expectedCommit ?? "") || !Array.isArray(rows) || rows.length !== 1) return false;
  const app = rows[0];
  if (!app || app.name !== "fanmind" || app.exec_mode !== "cluster_mode" ||
      app.pm_cwd !== CURRENT || app.pm_exec_path !== `${CURRENT}/node_modules/next/dist/bin/next` ||
      !Array.isArray(app.args) || app.args.length !== 1 || app.args[0] !== "start" ||
      !["node", "/usr/bin/node"].includes(app.exec_interpreter) ||
      // PM2 dump() removes instances and writes one entry per running worker.
      // rows.length above binds the persisted worker count; an explicit future
      // instances value may not widen it on resurrection.
      (app.instances !== undefined && app.instances !== 1) || app.autorestart !== true) return false;
  if (!noLaunchOverrides(app) || (app.env !== undefined && !noLaunchOverrides(app.env))) return false;
  for (const key of ["node_args", "interpreter_args"]) {
    if (app[key] !== undefined && app[key] !== "" && !(Array.isArray(app[key]) && app[key].length === 0)) return false;
  }
  for (const [key, expected] of Object.entries({
    NODE_ENV: "production", FANMIND_RUNTIME_ENVIRONMENT: "production", FANMIND_RELEASE_COMMIT: expectedCommit,
  })) {
    if (app[key] !== expected || (app.env && Object.hasOwn(app.env, key) && app.env[key] !== expected)) return false;
  }
  return true;
}

// Only accept the simple unescaped PM2 startup environment produced by PM2.
// Unknown quoting fails closed; it is never evaluated as shell input.
export function startupContract(unit) {
  if (unit.User !== "ubuntu" || unit.Type !== "forking" || unit.PIDFile !== `${PM2_HOME}/pm2.pid`) return null;
  if (![...START_HOOKS, ...SERVICE_INPUTS, "Conditions", "Asserts"].every(key => unit[key] === "")) return null;
  const tokens = (unit.Environment ?? "").split(" ");
  if (tokens.some(token => !/^[A-Za-z_][A-Za-z0-9_]*=[A-Za-z0-9_/:.=-]+$/u.test(token))) return null;
  const homes = tokens.filter(token => token.startsWith("PM2_HOME="));
  const paths = tokens.filter(token => token.startsWith("PATH="));
  if (tokens.length !== 2 || homes.length !== 1 || homes[0] !== `PM2_HOME=${PM2_HOME}` || paths.length !== 1) return null;
  const match = (unit.ExecStart ?? "").match(/^\{ path=(\/[A-Za-z0-9_/.-]+\/bin\/pm2) ; argv\[\]=\1 resurrect ; ignore_errors=no ; [^{}]* \}$/u);
  if (!match) return null;
  const stop = (unit.ExecStop ?? "").match(/^\{ path=(\/[A-Za-z0-9_/.-]+\/bin\/pm2) ; argv\[\]=\1 kill ; ignore_errors=no ; [^{}]* \}$/u);
  if (!stop || stop[1] !== match[1]) return null;
  const directories = paths[0].slice(5).split(":");
  if (directories.some(directory => !directory.startsWith("/") || path.normalize(directory) !== directory)) return null;
  return { executable: match[1], directories };
}

function trustedPath(file) {
  // Check the spelling as well as its resolved target: a writable parent of
  // a symlink could otherwise replace an apparently trusted executable.
  for (const start of [file, fs.realpathSync(file)]) {
    let current = start;
    for (;;) {
      const stat = fs.lstatSync(current);
      if (stat.uid !== 0 || (!stat.isSymbolicLink() && (stat.mode & 0o022) !== 0)) return false;
      if (current === "/") break;
      current = path.dirname(current);
    }
  }
  return true;
}

function trustedExecutable(file) {
  try {
    const executable = fs.statSync(file);
    if (!executable.isFile() || !(executable.mode & 0o111)) return false;
    return trustedPath(file);
  } catch {
    return false;
  }
}

export function runnerPathMatches(source) {
  try {
    return /^[A-Za-z0-9_/:.-]+$/u.test(source) && source.split(":").every(directory =>
      directory.startsWith("/") && path.normalize(directory) === directory &&
      fs.statSync(directory).isDirectory() && trustedPath(directory));
  } catch { return false; }
}

// This independent, root-owned reference must be reviewed and installed by an
// authenticated operator. Never learn a trusted baseline from the files under
// inspection, and never create/update it during deploy or audit.
export function parseBootReference(source) {
  try {
    const value = JSON.parse(source);
    const keys = ["schemaVersion", "runnerRegistrationSha256", "nginxUnitSha256", "pm2UnitSha256", "runnerUnitSha256"];
    if (!value || Object.keys(value).sort().join("|") !== keys.sort().join("|") || value.schemaVersion !== 1 ||
        !keys.filter(key => key !== "schemaVersion").every(key => typeof value[key] === "string" && SHA256.test(value[key]))) return null;
    return value;
  } catch { return null; }
}

function readBootReference() {
  try {
    if (!trustedPath(REFERENCE_FILE)) return null;
    return parseBootReference(readOwnedFile(REFERENCE_FILE, 4096, 0));
  } catch { return null; }
}

export function unitDefinitionMatches(unit, name, source, expectedSha256) {
  return unit.Id === name && unit.LoadState === "loaded" && unit.NeedDaemonReload === "no" &&
    ["DropInPaths", "Conditions", "Asserts"].every(key => unit[key] === "") &&
    typeof source === "string" && SHA256.test(expectedSha256 ?? "") && digest(source) === expectedSha256;
}

function installedUnitMatches(unit, name, expectedSha256) {
  try {
    const file = unit.FragmentPath;
    if (!path.isAbsolute(file) || !trustedPath(file)) return false;
    const source = readOwnedFile(fs.realpathSync(file), 64 * 1024, 0);
    return unitDefinitionMatches(unit, name, source, expectedSha256);
  } catch { return false; }
}

export function bootNodeMatches(directories) {
  try {
    for (const directory of directories) {
      if (!path.isAbsolute(directory) || !fs.statSync(directory).isDirectory() || !trustedPath(directory)) return false;
      const candidate = path.join(directory, "node");
      try { fs.accessSync(candidate, fs.constants.X_OK); } catch { continue; }
      return trustedExecutable(candidate) && fs.realpathSync(candidate) === fs.realpathSync(process.execPath);
    }
  } catch {}
  return false;
}

export function runnerUnitFromCgroup(source) {
  const units = new Set(source.split(/[\n/]/u).filter(segment => /^actions\.runner\.[A-Za-z0-9_.-]+\.service$/u.test(segment)));
  return units.size === 1 ? [...units][0] : null;
}

// A saved environment can claim the right SHA while the stable link points to
// another build. Inspect the actual next-boot directory and Next deployment ID.
export function releaseTargetMatches(expectedCommit, current = CURRENT, releaseRoot = RELEASE_ROOT) {
  try {
    if (!/^[a-f0-9]{40}$/u.test(expectedCommit ?? "") || !fs.lstatSync(current).isSymbolicLink()) return false;
    const target = path.join(releaseRoot, expectedCommit);
    if (fs.realpathSync(current) !== target || fs.realpathSync(target) !== target) return false;
    const metadata = JSON.parse(readOwnedFile(path.join(target, ".next/required-server-files.json")));
    if (metadata?.config?.deploymentId !== expectedCommit) return false;
    for (const file of ["node_modules/next/dist/bin/next", ".next/BUILD_ID"]) {
      if (!readOwnedFile(path.join(target, file)).trim()) return false;
    }
    return fs.realpathSync(current) === target;
  } catch { return false; }
}

// Script fingerprints are from the official actions/runner v2.337.0 observed
// on this host. Unknown changed startup scripts require review, never execution.
export const RUNNER_SCRIPT_HASHES = Object.freeze({
  "runsvc.sh": "7de309192686094b552130bd836320086142bf36840482204aca5a1fea1f63ba",
  "bin/RunnerService.js": "843c5d27f4e92ce2b11d3ae0ba974f200e705eb762475c06fe0d732cb585331d",
});

export function runnerEndpointsMatch(settings) {
  const endpoint = (value, host) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.search && !url.hash &&
        host.test(url.hostname) && /^\/(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\/?)?$/u.test(url.pathname);
    } catch { return false; }
  };
  if (!Number.isSafeInteger(settings.agentId) || settings.agentId < 1 || !Number.isSafeInteger(settings.poolId) || settings.poolId < 1 ||
      ![undefined, false, true].includes(settings.useV2Flow)) return false;
  if (!endpoint(settings.serverUrl, /^pipelines[a-z0-9-]*\.actions\.githubusercontent\.com$/u)) return false;
  if (settings.useV2Flow === true || settings.serverUrlV2 !== undefined) {
    if (!endpoint(settings.serverUrlV2, /^broker[a-z0-9-]*\.actions\.githubusercontent\.com$/u)) return false;
  }
  return true;
}

export function runnerConfigurationMatches(unit, unitName, context) {
  try {
    const root = unit.WorkingDirectory;
    if (unit.User !== "ubuntu" || unit.Type !== "simple" ||
        !/^\/[A-Za-z0-9_./-]+$/u.test(root ?? "") || path.normalize(root) !== root ||
        fs.realpathSync(root) !== root ||
        ![...START_HOOKS, ...SERVICE_INPUTS, "ExecStop", "Conditions", "Asserts"].every(key => unit[key] === "") || unit.Environment !== "") return false;
    const executable = `${root}/runsvc.sh`;
    const launch = (unit.ExecStart ?? "").match(/^\{ path=(\/[A-Za-z0-9_/.-]+\/runsvc\.sh) ; argv\[\]=\1 ; ignore_errors=no ; [^{}]* \}$/u);
    if (!launch || launch[1] !== executable || context.repository !== "FanMind/FanMind" || !context.name || !context.workspace) return false;
    if (readOwnedFile(`${root}/.service`, 1024).trim() !== unitName) return false;
    const registration = readOwnedFile(`${root}/.runner`, 16 * 1024);
    if (!SHA256.test(context.registrationSha256 ?? "") || digest(registration) !== context.registrationSha256) return false;
    const settings = JSON.parse(registration);
    if (!runnerEndpointsMatch(settings) || settings.agentName !== context.name || settings.ephemeral === true ||
        !["https://github.com/FanMind/FanMind", "https://github.com/Bernds-tech/FanMind"].includes(settings.gitHubUrl) ||
        settings.workFolder !== "_work" || path.join(root, settings.workFolder, "FanMind") !== context.workspace) return false;
    const savedPath = readOwnedFile(`${root}/.path`, 16 * 1024).trim();
    if (!runnerPathMatches(savedPath)) return false;
    for (const line of readOwnedFile(`${root}/.env`, 64 * 1024).split("\n").filter(Boolean)) {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
      if (!match || (LAUNCH_ENV.includes(match[1]) && match[2] !== "")) return false;
    }
    for (const [relative, expected] of Object.entries(RUNNER_SCRIPT_HASHES)) {
      if (createHash("sha256").update(readOwnedFile(path.join(root, relative), 64 * 1024)).digest("hex") !== expected) return false;
    }
    for (const relative of ["runsvc.sh", "bin/Runner.Listener", "externals/node20/bin/node"]) {
      const file = path.join(root, relative);
      const stat = fs.lstatSync(file);
      if (fs.realpathSync(file) !== file || !stat.isFile() || stat.size === 0 || stat.uid !== process.getuid() ||
          (stat.mode & 0o022) !== 0 || (stat.mode & 0o100) === 0) return false;
    }
    // Credentials are not read or returned. Missing, linked, empty or exposed
    // registration material blocks readiness; this is not a provider auth test.
    for (const relative of [".credentials", ".credentials_rsaparams"]) {
      const file = path.join(root, relative);
      const stat = fs.lstatSync(file);
      if (fs.realpathSync(file) !== file || !stat.isFile() || stat.size < 2 || stat.size > 64 * 1024 ||
          stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) return false;
    }
    return true;
  } catch { return false; }
}

function boundedKernelRead(file, limit = 64 * 1024) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY);
  try {
    const buffer = Buffer.alloc(limit + 1);
    const count = fs.readSync(fd, buffer, 0, buffer.length, 0);
    if (count > limit) throw new Error("kernel_value_oversized");
    return buffer.subarray(0, count).toString("utf8");
  } finally { fs.closeSync(fd); }
}

function sameImage(a, b) {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
}

// Bind next-boot files to the kernel-held images of the currently functioning
// runner. Never execute a candidate to learn its version. Replaced/deleted or
// changed images fail closed, even if a replacement has the same filename.
export function loadedExecutableMatches(file, pid) {
  let candidate, loaded;
  try {
    if (!Number.isSafeInteger(pid) || pid < 1 || fs.realpathSync(file) !== file) return false;
    candidate = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    loaded = fs.openSync(`/proc/${pid}/exe`, fs.constants.O_RDONLY);
    const before = fs.fstatSync(candidate);
    if (!before.isFile() || before.size < 4 || before.size > 256 * 1024 * 1024 || (before.mode & 0o111) === 0 ||
        !sameImage(before, fs.fstatSync(loaded))) return false;
    const digests = [];
    for (const fd of [candidate, loaded]) {
      const hash = createHash("sha256"), buffer = Buffer.alloc(1024 * 1024);
      let at = 0;
      while (at < before.size) {
        const count = fs.readSync(fd, buffer, 0, Math.min(buffer.length, before.size - at), at);
        if (count === 0 || (at === 0 && !buffer.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46])))) return false;
        hash.update(buffer.subarray(0, count)); at += count;
      }
      digests.push(hash.digest("hex"));
    }
    return digests[0] === digests[1] && sameImage(before, fs.fstatSync(candidate)) && sameImage(before, fs.fstatSync(loaded)) &&
      sameImage(before, fs.lstatSync(file)) && sameImage(before, fs.statSync(`/proc/${pid}/exe`));
  } catch { return false; }
  finally {
    if (candidate !== undefined) fs.closeSync(candidate);
    if (loaded !== undefined) fs.closeSync(loaded);
  }
}

export function runnerStartupMatches(unit, unitName, context) {
  try {
    if (!runnerConfigurationMatches(unit, unitName, context) || unit.ControlGroup !== `/system.slice/${unitName}`) return false;
    const source = boundedKernelRead(`/sys/fs/cgroup${unit.ControlGroup}/cgroup.procs`);
    if (!/^(?:[1-9][0-9]{0,9}\n)+$/u.test(source)) return false;
    const pids = [...new Set(source.trim().split("\n").map(Number))];
    const root = unit.WorkingDirectory;
    return ["bin/Runner.Listener", "externals/node20/bin/node"].every(relative => {
      const file = path.join(root, relative);
      const matches = pids.filter(pid => {
        try {
          if (fs.realpathSync(`/proc/${pid}/cwd`) !== root || fs.realpathSync(`/proc/${pid}/exe`) !== file) return false;
          const args = boundedKernelRead(`/proc/${pid}/cmdline`, 8192).split("\0").filter(Boolean);
          const expected = relative === "bin/Runner.Listener" ?
            args.length === 4 && args[0] === file && args.slice(1).join(" ") === "run --startuptype service" :
            args.length === 2 && path.resolve(root, args[0]) === file && path.resolve(root, args[1]) === path.join(root, "bin/RunnerService.js");
          if (!expected || !loadedExecutableMatches(file, pid)) return false;
          return runnerUnitFromCgroup(boundedKernelRead(`/proc/${pid}/cgroup`)) === unitName && fs.realpathSync(`/proc/${pid}/cwd`) === root;
        } catch { return false; }
      });
      return matches.length === 1;
    });
  } catch { return false; }
}

export function collectBootReadiness(expectedCommit) {
  const reference = readBootReference();
  const units = Object.fromEntries(Object.entries(BOOT_UNITS).map(([role, name]) => [
    role, readUnit(name, role === "PM2" ? ["User", "Type", "PIDFile", "Environment", "ExecStart", "ExecStop", ...START_HOOKS, ...SERVICE_INPUTS] : []),
  ]));
  let runner;
  try { runner = runnerUnitFromCgroup(fs.readFileSync("/proc/self/cgroup", "utf8")); } catch {}
  units.RUNNER = runner ? readUnit(runner, ["User", "Type", "WorkingDirectory", "ControlGroup", "Environment", "ExecStart", "ExecStop", ...START_HOOKS, ...SERVICE_INPUTS]) : {};
  const contracts = Object.entries(BOOT_UNITS).map(([role, name]) =>
    installedUnitMatches(units[role], name, role === "NGINX" ? reference?.nginxUnitSha256 :
      role === "PM2" ? reference?.pm2UnitSha256 : MANAGED_UNIT_HASHES[name]));
  contracts.push(Boolean(runner && installedUnitMatches(units.RUNNER, runner, reference?.runnerUnitSha256)));
  for (const name of TIMER_SERVICES) {
    const template = name.replace(/@[^.]+\.service$/u, "@.service");
    contracts.push(installedUnitMatches(readUnit(name), name, MANAGED_UNIT_HASHES[template]));
  }
  const startup = startupContract(units.PM2);
  const checks = {
    PM2_STARTUP: Boolean(startup && trustedExecutable(startup.executable)),
    PM2_SAVED_APP: readSavedApp(`${PM2_HOME}/dump.pm2`, expectedCommit),
    BOOT_NODE: Boolean(startup && bootNodeMatches(startup.directories)),
    RUNNER_BOUND: Boolean(runner && runnerStartupMatches(units.RUNNER, runner, {
      name: process.env.RUNNER_NAME, workspace: process.env.RUNNER_WORKSPACE, repository: process.env.GITHUB_REPOSITORY,
      registrationSha256: reference?.runnerRegistrationSha256,
    })),
    RELEASE_TARGET: releaseTargetMatches(expectedCommit),
    REFERENCE_BOUND: reference !== null,
    UNIT_CONTRACTS: contracts.every(Boolean),
  };
  return { units, checks };
}

export function bootReadinessLines({ units, checks }) {
  return ["BOOT_COLLECTOR=available", ...BOOT_ROLES.map(role => {
    const unit = units[role] ?? {};
    return `BOOT_UNIT_${role}=${state(unit.LoadState, "load")}|${state(unit.UnitFileState, "enabled")}|${state(unit.ActiveState, "active")}|${state(unit.NeedDaemonReload, "reload")}`;
  }), ...FIXED_CHECKS.map(key => `BOOT_${key}=${checks[key] === true}`)];
}

export function bootSummaryFromValues(values) {
  const one = key => values.get(key)?.length === 1 ? values.get(key)[0] : undefined;
  const units = Object.fromEntries(BOOT_ROLES.map(role => {
    const parts = (one(`BOOT_UNIT_${role}`) ?? "").split("|");
    return [role, parts.length === 4 ? `${state(parts[0], "load")}|${state(parts[1], "enabled")}|${state(parts[2], "active")}|${state(parts[3], "reload")}` : "unknown|unknown|unknown|unknown"];
  }));
  const checks = Object.fromEntries(FIXED_CHECKS.map(key => [key, one(`BOOT_${key}`) === "true"]));
  return { units, checks, verified: one("BOOT_COLLECTOR") === "available" &&
    Object.values(units).every(value => value === "loaded|enabled|active|no") && Object.values(checks).every(Boolean) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    for (const line of bootReadinessLines(collectBootReadiness(process.argv[2]))) console.log(line);
  } catch {
    console.log("BOOT_COLLECTOR=unavailable");
    process.exitCode = 1;
  }
}
