#!/usr/bin/env node
import { execFileSync } from "node:child_process";
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
});
const FIXED_CHECKS = ["PM2_STARTUP", "PM2_SAVED_APP", "BOOT_NODE", "RUNNER_BOUND"];
const PM2_HOME = "/home/ubuntu/.pm2";
const CURRENT = "/var/www/fanmind-current";

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
      "show", "--no-pager",
      ...["LoadState", "UnitFileState", "ActiveState", ...extra].map(key => `--property=${key}`),
      "--", unit,
    ], { encoding: "utf8", timeout: 10_000, maxBuffer: 128 * 1024, stdio: ["ignore", "pipe", "pipe"] }));
  } catch {
    return {};
  }
}

// Read one bounded regular file without following final/ancestor symlinks or
// accepting a replacement during the read. No private value leaves this module.
export function readSavedApp(file, expectedCommit) {
  let fd;
  try {
    if (fs.realpathSync(file) !== file) return false;
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    const before = fs.fstatSync(fd);
    if (!before.isFile() || before.size < 2 || before.size > 1024 * 1024 ||
        before.uid !== process.getuid() || (before.mode & 0o022) !== 0) return false;
    const buffer = Buffer.alloc(before.size + 1);
    const bytes = fs.readSync(fd, buffer, 0, buffer.length, 0);
    const after = fs.fstatSync(fd);
    const current = fs.lstatSync(file);
    if (bytes !== before.size || before.size !== after.size || before.mtimeMs !== after.mtimeMs ||
        before.ctimeMs !== after.ctimeMs || before.ino !== current.ino || before.dev !== current.dev ||
        current.isSymbolicLink() || fs.realpathSync(file) !== file) return false;
    return savedAppMatches(JSON.parse(buffer.subarray(0, bytes).toString("utf8")), expectedCommit);
  } catch {
    return false;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
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
  const tokens = (unit.Environment ?? "").split(" ");
  if (tokens.some(token => !/^[A-Za-z_][A-Za-z0-9_]*=[A-Za-z0-9_/:.=-]+$/u.test(token))) return null;
  const homes = tokens.filter(token => token.startsWith("PM2_HOME="));
  const paths = tokens.filter(token => token.startsWith("PATH="));
  if (homes.length !== 1 || homes[0] !== `PM2_HOME=${PM2_HOME}` || paths.length !== 1) return null;
  const match = (unit.ExecStart ?? "").match(/^\{ path=(\/[A-Za-z0-9_/.-]+\/bin\/pm2) ; argv\[\]=\1 resurrect ; ignore_errors=no ; [^{}]* \}$/u);
  if (!match) return null;
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

export function collectBootReadiness(expectedCommit) {
  const units = Object.fromEntries(Object.entries(BOOT_UNITS).map(([role, name]) => [
    role, readUnit(name, role === "PM2" ? ["User", "Type", "PIDFile", "Environment", "ExecStart"] : []),
  ]));
  let runner;
  try { runner = runnerUnitFromCgroup(fs.readFileSync("/proc/self/cgroup", "utf8")); } catch {}
  units.RUNNER = runner ? readUnit(runner, ["User"]) : {};
  const startup = startupContract(units.PM2);
  const checks = {
    PM2_STARTUP: Boolean(startup && trustedExecutable(startup.executable)),
    PM2_SAVED_APP: readSavedApp(`${PM2_HOME}/dump.pm2`, expectedCommit),
    BOOT_NODE: Boolean(startup && bootNodeMatches(startup.directories)),
    RUNNER_BOUND: Boolean(runner && units.RUNNER.User === "ubuntu"),
  };
  return { units, checks };
}

export function bootReadinessLines({ units, checks }) {
  return ["BOOT_COLLECTOR=available", ...BOOT_ROLES.map(role => {
    const unit = units[role] ?? {};
    return `BOOT_UNIT_${role}=${state(unit.LoadState, "load")}|${state(unit.UnitFileState, "enabled")}|${state(unit.ActiveState, "active")}`;
  }), ...FIXED_CHECKS.map(key => `BOOT_${key}=${checks[key] === true}`)];
}

export function bootSummaryFromValues(values) {
  const one = key => values.get(key)?.length === 1 ? values.get(key)[0] : undefined;
  const units = Object.fromEntries(BOOT_ROLES.map(role => {
    const parts = (one(`BOOT_UNIT_${role}`) ?? "").split("|");
    return [role, parts.length === 3 ? `${state(parts[0], "load")}|${state(parts[1], "enabled")}|${state(parts[2], "active")}` : "unknown|unknown|unknown"];
  }));
  const checks = Object.fromEntries(FIXED_CHECKS.map(key => [key, one(`BOOT_${key}`) === "true"]));
  return { units, checks, verified: one("BOOT_COLLECTOR") === "available" &&
    Object.values(units).every(value => value === "loaded|enabled|active") && Object.values(checks).every(Boolean) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    for (const line of bootReadinessLines(collectBootReadiness(process.argv[2]))) console.log(line);
  } catch {
    console.log("BOOT_COLLECTOR=unavailable");
    process.exitCode = 1;
  }
}
