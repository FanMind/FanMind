#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { closeSync, constants, fstatSync, mkdtempSync, openSync, readFileSync, readSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { evaluateCreatorFoundationStagingEnvironment } from "../../src/lib/creatorFoundationStagingPolicy.mjs";
import { checkCreatorArtifact, CREATOR_STATE_SQL, CREATOR_PREFLIGHT_BODY, buildCreatorVerification, buildCreatorApply } from "./creator-foundation-sql.mjs";
const MAX_PASSFILE_BYTES = 64 * 1024;
function fail(code) { throw new Error(`CREATOR_FOUNDATION_ERROR=${code}`); }
function privatePassfileSnapshot(environment) {
  const sourcePath = clean(environment.PGPASSFILE);
  if (!sourcePath || !isAbsolute(sourcePath)) fail("passfile_missing");

  let descriptor;
  let snapshotDirectory;
  let content;
  try {
    descriptor = openSync(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = fstatSync(descriptor);
    if (
      !opened.isFile() ||
      opened.nlink !== 1 ||
      (opened.mode & 0o777) !== 0o600 ||
      opened.size < 1 ||
      opened.size > MAX_PASSFILE_BYTES ||
      (typeof process.getuid === "function" && opened.uid !== process.getuid())
    ) {
      fail("passfile_invalid");
    }
    content = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < content.length) {
      const bytesRead = readSync(descriptor, content, offset, content.length - offset, offset);
      if (bytesRead === 0) fail("passfile_read_failed");
      offset += bytesRead;
    }
    const settled = fstatSync(descriptor);
    if (
      settled.dev !== opened.dev ||
      settled.ino !== opened.ino ||
      settled.size !== opened.size ||
      settled.mtimeMs !== opened.mtimeMs ||
      settled.ctimeMs !== opened.ctimeMs
    ) {
      fail("passfile_changed");
    }
    snapshotDirectory = mkdtempSync(join(tmpdir(), "fanmind-creator-foundation-"));
    const snapshotPath = join(snapshotDirectory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { snapshotDirectory, snapshotPath };
  } catch (error) {
    if (snapshotDirectory) rmSync(snapshotDirectory, { recursive: true, force: true });
    if (error instanceof Error && error.message.startsWith("CREATOR_FOUNDATION_ERROR=")) {
      throw error;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "ELOOP") {
      fail("passfile_invalid");
    }
    fail("passfile_read_failed");
  } finally {
    content?.fill(0);
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function psqlEnvironment(environment, passfilePath) {
  const safe = Object.fromEntries(["PATH", "LANG", "LC_ALL", "PGHOST", "PGPORT", "PGDATABASE", "PGUSER", "PGSSLMODE", "PGSSLROOTCERT"].filter(key => typeof environment[key] === "string").map(key => [key, environment[key]]));
  safe.PGPASSFILE = passfilePath; safe.PGCONNECT_TIMEOUT = "10";
  safe.PGOPTIONS = "-c statement_timeout=60000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=60000";
  for (const key of [
    "DATABASE_URL",
    "POSTGRES_URL",
    "SUPABASE_DB_URL",
    "PGPASSWORD",
    "PGHOSTADDR",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR",
  ]) {
    delete safe[key];
  }
  return safe;
}

function runPsql(input, environment, passfilePath) {
  return spawnSync(
    "psql",
    [
      "--no-password",
      "--no-psqlrc",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--set=ON_ERROR_STOP=1",
    ],
    {
      env: psqlEnvironment(environment, passfilePath),
      input,
      encoding: "utf8",
      timeout: 120000,
      maxBuffer: 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}


export function creatorStateFromOutput(result) {
 if (result.error || result.status !== 0) fail("state_query_failed");
 const lines=result.stdout.trim().split(/\r?\n/u);
 if (lines.length!==1 || !/^CREATOR_FOUNDATION_STATE=(absent|present|partial)$/u.test(lines[0])) fail("state_response_invalid");
 return lines[0].split("=")[1];
}
export function runCreatorDatabaseMode(mode, sql, environment, database) {
 checkCreatorArtifact(sql);
 if (!evaluateCreatorFoundationStagingEnvironment(environment,{mode}).ok) fail("environment_invalid");
 const state=creatorStateFromOutput(database(`begin read only; ${CREATOR_PREFLIGHT_BODY} ${CREATOR_STATE_SQL} rollback;`));
 if (state==="partial") fail("partial_schema");
 if (state==="absent" && mode==="verify") return ["CREATOR_FOUNDATION_STATE=absent","CREATOR_FOUNDATION_NEXT=apply","CREATOR_FOUNDATION_APPLY=not_requested"];
 if (state==="absent") {
  const result=database(buildCreatorApply(sql));
  if (result.error || result.status!==0 || !result.stdout.trim().split(/\r?\n/u).includes("CREATOR_FOUNDATION_APPLY=COMMITTED")) fail("apply_indeterminate_verify_before_retry");
 }
 const result=database(buildCreatorVerification(sql).verify);
 if (result.error || result.status!==0 || result.stdout.trim()!=="CREATOR_FOUNDATION_POSTFLIGHT=PASS") fail("postflight_failed");
 return [`CREATOR_FOUNDATION_APPLY=${state==="absent" ? "committed" : "not_requested"}`,"CREATOR_FOUNDATION_STATE=verified","CREATOR_FOUNDATION_POSTFLIGHT=PASS","CREATOR_FOUNDATION_RUNTIME_ACTIVATED=false"];
}
export function main(args=process.argv.slice(2), environment=process.env) {
 const arg=args[0] ?? "--check";
 if (args.length>1 || !["--check","--verify","--apply"].includes(arg)) fail("mode_invalid");
 const sql=checkCreatorArtifact(readFileSync(new URL("../../supabase/controlled/creator_intelligence_foundation.sql",import.meta.url),"utf8"));
 buildCreatorVerification(sql);
 if (arg==="--check") { console.log("CREATOR_FOUNDATION_CHECKSUM=verified"); return; }
 const mode=arg.slice(2);
 if (!evaluateCreatorFoundationStagingEnvironment(environment,{mode}).ok) fail("environment_invalid");
 const actual=spawnSync("git",["rev-parse","HEAD"],{encoding:"utf8",stdio:["ignore","pipe","ignore"]});
 if (actual.status!==0 || actual.stdout.trim()!==environment.FANMIND_CREATOR_FOUNDATION_REVIEWED_COMMIT) fail("checkout_mismatch");
 const {snapshotDirectory,snapshotPath}=privatePassfileSnapshot(environment);
 try { for (const marker of runCreatorDatabaseMode(mode,sql,environment,input=>runPsql(input,environment,snapshotPath))) console.log(marker); }
 finally { rmSync(snapshotDirectory,{recursive:true,force:true}); }
}
if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 try { main(); } catch(error) {
  console.error(error instanceof Error && /^CREATOR_FOUNDATION_ERROR=[a-z0-9_]+$/u.test(error.message) ? error.message : "CREATOR_FOUNDATION_ERROR=unexpected_failure");
  process.exitCode=1;
 }
}
