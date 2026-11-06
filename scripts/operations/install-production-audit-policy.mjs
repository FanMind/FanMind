import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import cp from "node:child_process";
import { pathToFileURL } from "node:url";

export const AUDIT_FILES = [
  { name: "read-only-production-audit.sh", old: "5b0e80d7f5ff2498be70a5ab6f3030fa866e0ac28995b1554b20face1908f024", next: "664be21a67ad06dd7f26d7d1dca6ca63e9b441dd58e0f26eab8a403a22c4af27" },
  { name: "verify-production-audit-output.mjs", old: "0f5e171046e0f3eb1fe81f3718c2fe7ff4b6a2392b967aff67df59236fc33bcd", next: "e65a1af5169c3843dcb04bf3283a1e013928c26f2357c25f52847391145ca218" },
];
const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
export function frozenFile(file, uid, mode) {
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(fd, { bigint: true });
    if (!before.isFile() || before.nlink !== 1n || before.uid !== BigInt(uid)
      || (Number(before.mode) & 0o777) !== mode || before.size < 1n || before.size > 131072n) throw Error("file_invalid");
    const bytes = fs.readFileSync(fd);
    const after = fs.fstatSync(fd, { bigint: true });
    for (const key of ["ino", "dev", "size", "mtimeNs", "ctimeNs", "mode", "uid", "gid", "nlink"])
      if (before[key] !== after[key]) throw Error("file_changed");
    return bytes;
  } finally { fs.closeSync(fd); }
}
export function validatePair(oldBytes, newBytes) {
  const oldHashes = oldBytes.map(digest);
  if (!AUDIT_FILES.every((file, i) => digest(newBytes[i]) === file.next)) throw Error("source_hash_invalid");
  if (AUDIT_FILES.every((file, i) => oldHashes[i] === file.next)) return "installed";
  if (!AUDIT_FILES.every((file, i) => oldHashes[i] === file.old)) throw Error("installed_hash_invalid");
  return "replace";
}

// Both files are prevalidated before the first rename. Callers must hold the host lock.
// On any failed postcheck, restore both original files and verify their bytes.
export function replacePair(directory, oldBytes, newBytes, postcheck) {
  const names = AUDIT_FILES.map(file => path.join(directory, file.name));
  const stage = (name, bytes) => {
    const temporary = path.join(directory, `.audit-policy-${crypto.randomUUID()}`);
    const fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o755);
    try { fs.writeFileSync(fd, bytes); fs.fchmodSync(fd, 0o755); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    try { fs.renameSync(temporary, name); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  };
  let changed = false;
  try {
    for (let i = 0; i < names.length; i++) { changed = true; stage(names[i], newBytes[i]); }
    for (let i = 0; i < names.length; i++) if (digest(fs.readFileSync(names[i])) !== AUDIT_FILES[i].next) throw Error("post_hash_invalid");
    postcheck();
  } catch {
    if (changed) {
      for (let i = 0; i < names.length; i++) stage(names[i], oldBytes[i]);
      for (let i = 0; i < names.length; i++) if (digest(fs.readFileSync(names[i])) !== digest(oldBytes[i])) throw Error("rollback_failed");
    }
    throw Error("install_rolled_back");
  }
}

async function main() {
  let scratch;
  try {
    if (process.getuid() !== 0 || process.argv.length !== 5) throw Error();
    const [, , collector, verifier, invokingUid] = process.argv;
    if (!/^[1-9][0-9]*$/u.test(invokingUid)) throw Error();
    const directory = "/usr/local/lib/fanmind-audit";
    for (const parent of ["/", "/usr", "/usr/local", "/usr/local/lib", directory]) {
      const st = fs.lstatSync(parent);
      if (!st.isDirectory() || st.isSymbolicLink() || st.uid !== 0 || (st.mode & 0o022)) throw Error();
    }
    const newBytes = [collector, verifier].map(file => frozenFile(file, Number(invokingUid), 0o600));
    const oldBytes = AUDIT_FILES.map(file => frozenFile(path.join(directory, file.name), 0, 0o755));
    const state = validatePair(oldBytes, newBytes);
    const environment = { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C", HOME: "/home/ubuntu", FANMIND_AUDIT_VERIFIER_PATH: "/usr/local/lib/fanmind-ops/verify-backup-artifact.mjs" };
    const live = () => {
      const response = cp.spawnSync("/usr/bin/curl", ["--fail", "--silent", "--show-error", "--proto", "=https", "--tlsv1.2", "--max-time", "30", "https://fanmind.ch/api/version"], { env: environment, encoding: "utf8", timeout: 35000, maxBuffer: 65536 });
      if (response.error || response.status !== 0) throw Error();
      const value = JSON.parse(response.stdout);
      if (value.application !== "fanmind" || value.runtimeEnvironment !== "production" || value.releaseCommit !== "707d22702a784e3b9999d1c9ae9c1e11c096a1bc") throw Error();
    };
    live();
    scratch = fs.mkdtempSync("/var/lib/fanmind-audit-policy-"); fs.chmodSync(scratch, 0o700);
    const postcheck = () => {
      live();
      const audit = cp.spawnSync("/usr/sbin/runuser", ["-u", "ubuntu", "--", path.join(directory, AUDIT_FILES[0].name)], { env: environment, encoding: "utf8", timeout: 180000, maxBuffer: 2 * 1024 * 1024 });
      const output = path.join(scratch, "audit.txt");
      fs.writeFileSync(output, audit.stdout ?? "", { mode: 0o600, flag: "wx" });
      const verification = cp.spawnSync("/usr/bin/node", [path.join(directory, AUDIT_FILES[1].name), output, "707d22702a784e3b9999d1c9ae9c1e11c096a1bc", String(audit.error ? 1 : audit.status ?? 1)], { env: environment, encoding: "utf8", timeout: 30000, maxBuffer: 131072 });
      if (verification.error || verification.status !== 0) throw Error();
      live();
    };
    if (state === "replace") replacePair(directory, oldBytes, newBytes, postcheck);
    else postcheck();
    process.stdout.write("PRODUCTION_AUDIT_POLICY=INSTALLED_AND_VERIFIED\nPRODUCTION_AUDIT_FAILURE_WINDOW_HOURS=1\n");
  } catch { process.stderr.write("PRODUCTION_AUDIT_POLICY=BLOCK\n"); process.exitCode = 1; }
  finally { if (scratch) fs.rmSync(scratch, { recursive: true, force: true }); }
}
if (process.argv[1] === "-" || (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)) await main();
