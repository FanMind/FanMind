import { constants, openSync, fstatSync, closeSync, readFileSync, writeSync, ftruncateSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE = "/var/www/fanmind-staging/.env.production";
const TARGET = "/var/www/fanmind-staging/.env.production.provisioning";
const FIELD = /^\s*(?:export\s+)?(FANMIND_PUSH_TOKEN_ENCRYPTION_KEY|FANMIND_MOBILE_PUSH_EAS_PROJECT_ID)=(.*)$/u;

export function preservePushRuntimeFields(previous, replacement) {
  const fields = new Map();
  for (const line of previous.split(/\r?\n/u)) {
    const match = line.match(FIELD);
    if (!match) continue;
    if (fields.has(match[1])) throw Error("push_preservation_invalid");
    let value = match[2].trim();
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) value = value.slice(1, -1);
    const valid = match[1] === "FANMIND_PUSH_TOKEN_ENCRYPTION_KEY"
      ? /^[a-f0-9]{64}$/iu.test(value) || (/^[A-Za-z0-9+/]+={0,2}$/u.test(value) && Buffer.from(value, "base64").length === 32)
      : /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
    if (!valid) throw Error("push_preservation_invalid");
    fields.set(match[1], value);
  }
  if (!fields.size) return replacement;
  const retained = replacement.split(/\r?\n/u).filter(line => !FIELD.test(line));
  return `${retained.join("\n").replace(/\n*$/u, "")}\n${[...fields].map(([key,value]) => `${key}='${value}'`).join("\n")}\n`;
}
function checkedDescriptor(path, writable = false) {
  const descriptor = openSync(path, (writable ? constants.O_RDWR : constants.O_RDONLY) | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  const stat = fstatSync(descriptor);
  if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600 || stat.size > 1024 * 1024) {
    closeSync(descriptor); throw Error("push_preservation_invalid");
  }
  return descriptor;
}
function main() {
  let source;
  try { source = checkedDescriptor(SOURCE); }
  catch (error) { if (error.code === "ENOENT") return; throw error; }
  let previous;
  try { previous = readFileSync(source, "utf8"); } finally { closeSync(source); }
  const target = checkedDescriptor(TARGET, true);
  try {
    const replacement = readFileSync(target, "utf8");
    const preserved = preservePushRuntimeFields(previous, replacement);
    // A positional write avoids the descriptor offset advanced by readFileSync.
    const bytes = Buffer.from(preserved);
    ftruncateSync(target, 0);
    let offset = 0;
    while (offset < bytes.length) offset += writeSync(target, bytes, offset, bytes.length - offset, offset);
  } finally { closeSync(target); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); console.log("STAGING_PUSH_RUNTIME_PRESERVATION=PASS"); }
  catch { console.error("STAGING_PUSH_RUNTIME_PRESERVATION=FAIL"); process.exitCode = 1; }
}
