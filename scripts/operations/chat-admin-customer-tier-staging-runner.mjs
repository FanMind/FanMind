#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, openSync, closeSync, fstatSync, constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { evaluateChatAdminStagingControlEnvironment } from "../../src/lib/chatAdminStagingControlPolicy.mjs";

import { POSTFLIGHT_SQL as FAN_POSTFLIGHT_SQL, CUSTOMER_TIER_SQL_PATH, CUSTOMER_TIER_SQL_SHA256, SQL_PATH as FAN_SQL_PATH, SQL_SHA256 as FAN_SQL_SHA256 } from "./chat-admin-fan-staging-runner.mjs";

export const SQL_PATH = CUSTOMER_TIER_SQL_PATH;
export const SQL_SHA256 = CUSTOMER_TIER_SQL_SHA256;
const marker = "  raise notice 'CHAT_ADMIN_FAN_SCHEMA_STATE=VERIFIED';";
if (FAN_POSTFLIGHT_SQL.split(marker).length !== 2) throw new Error("customer_tier_postflight_composition");
export const POSTFLIGHT_SQL = FAN_POSTFLIGHT_SQL.replace(marker, `${marker}
  if customer_tier_expected then
    raise notice 'CHAT_ADMIN_CUSTOMER_TIER_SCHEMA_STATE=VERIFIED';
  else
    raise notice 'CHAT_ADMIN_CUSTOMER_TIER_SCHEMA_STATE=ABSENT';
  end if;`);

function fail(code) {
  throw new Error(`CHAT_ADMIN_CUSTOMER_TIER_STAGING_ERROR=${code}`);
}

function run(sql, env, extraArguments = []) {
  return spawnSync(
    "psql",
    [
      "--no-password",
      "--no-psqlrc",
      "--quiet",
      "--set=ON_ERROR_STOP=1",
      ...extraArguments,
    ],
    { env, input: sql, encoding: "utf8", timeout:150_000, maxBuffer:1024*1024 },
  );
}

export function state(result) {
  const output = `${result.stderr ?? ""}${result.stdout ?? ""}`;
  if (result.status !== 0) fail(output.includes("PARTIAL") ? "schema_partial" : "verify_failed");
  const matches = [...output.matchAll(/CHAT_ADMIN_CUSTOMER_TIER_SCHEMA_STATE=(ABSENT|VERIFIED)/gu)];
  if (matches.length !== 1) fail("schema_state_unknown");
  return matches[0][1];
}

export function parseFanCount(output) {
  const count = String(output ?? "").trim();
  if (!/^\d+$/u.test(count)) fail("row_count_invalid");
  return count;
}

export function validateSqlSource(source, mode) {
  if(createHash("sha256").update(source).digest("hex")!==SQL_SHA256)fail("checksum_mismatch");
  if(mode==="apply"&&!/^begin;[\s\S]*commit;\s*$/u.test(source.trim().replace(/^--.*$/gmu,"").trim()))fail("transaction_contract");
}

export function validateApplyStartState(before) {
  if(before!=="ABSENT")fail(before==="VERIFIED"?"apply_requires_absent_schema":"schema_partial");
}

function fanCount(env) {
  const result=run(
    "\\set ON_ERROR_STOP on\nbegin;\nset transaction read only;\nselect count(*) from public.chat_character_fans;\nrollback;",
    env,
    ["--tuples-only", "--no-align"],
  );
  if(result.status!==0)fail("row_count_failed");
  return parseFanCount(result.stdout);
}

export function buildApplySql(source) {
  validateSqlSource(source, "apply");
  const verification = POSTFLIGHT_SQL.replace(/^\\set ON_ERROR_STOP on\nbegin;\nset transaction read only;\n/u, "").replace(/rollback;\s*$/u, "");
  if (verification === POSTFLIGHT_SQL || /set transaction read only/u.test(verification)) fail("postflight_composition");
  return source.replace(/commit;\s*$/u, () => verification + "\ncommit;\n");
}

export function validateEnvironment(mode, env) {
  if (!["verify","apply"].includes(mode)) fail("argument_invalid");
  if (env.FANMIND_CHAT_ADMIN_CUSTOMER_TIER_CONFIRM !== (mode === "apply" ? "apply-chat-admin-customer-tier" : "verify-chat-admin-customer-tier")) fail("confirmation_invalid");
  if (!evaluateChatAdminStagingControlEnvironment(env,{mode:mode === "apply" ? "migration" : "schema"}).ok) fail("environment_invalid");
}

function readPrivatePassfile(path) {
  const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {
    const before=fstatSync(fd);
    if(!before.isFile()||before.nlink!==1||(before.mode&0o777)!==0o600||before.uid!==process.getuid()||before.size<1||before.size>65536) fail("passfile_metadata");
    const bytes=readFileSync(fd), after=fstatSync(fd);
    if(before.dev!==after.dev||before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs){bytes.fill(0);fail("passfile_changed");}
    return bytes;
  } finally {closeSync(fd);}
}

export function execute(mode, env=process.env) {
  validateEnvironment(mode, env);
  if (createHash("sha256").update(readFileSync(FAN_SQL_PATH)).digest("hex") !== FAN_SQL_SHA256) fail("base_checksum_mismatch");
  const source=readFileSync(SQL_PATH,"utf8");
  validateSqlSource(source,mode);

  const directory=mkdtempSync(join(tmpdir(),"fanmind-chat-admin-customer-tier-"));
  let bytes;
  try{
    const passfile=join(directory,"pgpass");
    bytes=readPrivatePassfile(env.PGPASSFILE);
    writeFileSync(passfile,bytes,{mode:0o600,flag:"wx"});
    chmodSync(passfile,0o600);
    const safeEnv={...Object.fromEntries(["PATH","HOME","LANG","PGHOST","PGPORT","PGDATABASE","PGUSER","PGSSLMODE","PGSSLROOTCERT"].filter(key=>env[key]!==undefined).map(key=>[key,env[key]])),PGPASSFILE:passfile,PGCONNECT_TIMEOUT:"10",PGOPTIONS:"-c lock_timeout=5000 -c statement_timeout=120000"};
    const before=state(run(POSTFLIGHT_SQL,safeEnv));
    if(mode==="verify"){
      console.log(`CHAT_ADMIN_CUSTOMER_TIER_SCHEMA_STATE=${before}`);
      console.log(`CHAT_ADMIN_CUSTOMER_TIER_ROW_COUNT=${fanCount(safeEnv)}`);
      return;
    }
    validateApplyStartState(before);
    const rowsBefore=fanCount(safeEnv);
    if(run(buildApplySql(source),safeEnv).status!==0)fail("apply_failed");
    const after=state(run(POSTFLIGHT_SQL,safeEnv));
    if(after!=="VERIFIED")fail("postflight_failed");
    if(fanCount(safeEnv)!==rowsBefore)fail("row_count_changed");
    console.log("CHAT_ADMIN_CUSTOMER_TIER_SCHEMA_STATE=VERIFIED");
  }finally{
    bytes?.fill(0);rmSync(directory,{recursive:true,force:true});
  }
}

if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href){
  try{
    const arg=process.argv[2];
    if (arg === "--check") {
      validateSqlSource(readFileSync(SQL_PATH, "utf8"), "apply");
      buildApplySql(readFileSync(SQL_PATH, "utf8"));
      console.log("CHAT_ADMIN_CUSTOMER_TIER_CONTRACT=VERIFIED");
    } else {
      if(!["--verify","--apply"].includes(arg))fail("argument_invalid");
    execute(arg.slice(2));
    }
  }catch(error){
    console.error(error.message?.startsWith("CHAT_ADMIN_CUSTOMER_TIER_STAGING_ERROR=")
      ?error.message
      :"CHAT_ADMIN_CUSTOMER_TIER_STAGING_ERROR=unexpected_failure");
    process.exitCode=1;
  }
}
