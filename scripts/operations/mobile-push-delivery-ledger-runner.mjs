#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  closeSync,
  constants,
  fstatSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { evaluateMobilePushStagingControlEnvironment } from "../../src/lib/mobilePushStagingControlPolicy.mjs";

export const LEDGER_ID = "20260903190000_mobile_push_delivery_ledger";
export const LEDGER_PATH = resolve(
  process.cwd(),
  `supabase/controlled/${LEDGER_ID}.sql`,
);
export const EXPECTED_LEDGER_SHA256 =
  "b76a5f99e57e7c8c4514f10055fcedc8087f540ca7e0a42c4b373bd948326d91";
const MAX_PASSFILE_BYTES = 64 * 1024;

export const LEDGER_POSTFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  ledger_table oid := to_regclass('public.mobile_push_delivery_attempts');
  rpc_signature text;
begin
  if ledger_table is null then raise exception 'ledger_table_missing'; end if;
  if not exists (
    select 1 from pg_class where oid = ledger_table and relkind = 'r' and relrowsecurity
  ) then raise exception 'ledger_rls_invalid'; end if;
  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'mobile_push_delivery_attempts'
  ) then raise exception 'ledger_browser_policy_invalid'; end if;
  if exists (
       select 1
         from pg_class c,
              lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
        where c.oid = ledger_table
          and acl.grantee = 0
          and acl.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
     )
     or has_table_privilege('anon', ledger_table, 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', ledger_table, 'SELECT,INSERT,UPDATE,DELETE')
     or not has_table_privilege('service_role', ledger_table, 'SELECT')
     or not has_table_privilege('service_role', ledger_table, 'INSERT')
     or not has_table_privilege('service_role', ledger_table, 'UPDATE')
     or not has_table_privilege('service_role', ledger_table, 'DELETE')
     or has_table_privilege('service_role', ledger_table, 'TRUNCATE')
  then raise exception 'ledger_table_privilege_invalid'; end if;

  foreach rpc_signature in array array[
    'public.mobile_push_delivery_reserve(jsonb)',
    'public.mobile_push_delivery_reserve_receipt(jsonb)',
    'public.mobile_push_delivery_transition(text,jsonb)'
  ] loop
    if to_regprocedure(rpc_signature) is null
       or exists (
         select 1
           from pg_proc p,
                lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
          where p.oid = to_regprocedure(rpc_signature)
            and acl.grantee = 0
            and acl.privilege_type = 'EXECUTE'
       )
       or has_function_privilege('anon', rpc_signature, 'EXECUTE')
       or has_function_privilege('authenticated', rpc_signature, 'EXECUTE')
       or not has_function_privilege('service_role', rpc_signature, 'EXECUTE')
       or exists (
         select 1 from pg_proc
          where oid = to_regprocedure(rpc_signature)
            and (prosecdef or not (proconfig @> array['search_path=public, pg_temp']))
       )
    then raise exception 'ledger_function_privilege_invalid'; end if;
  end loop;
end
$verify$;

select 'MOBILE_PUSH_DELIVERY_LEDGER_POSTFLIGHT=PASS';
rollback;
`;

function fail(code) {
  throw new Error(`MOBILE_PUSH_DELIVERY_LEDGER_ERROR=${code}`);
}

export function evaluateMobilePushDeliveryLedgerSql(sql) {
  if (typeof sql !== "string") fail("ledger_unreadable");
  const digest = createHash("sha256").update(sql).digest("hex");
  if (digest !== EXPECTED_LEDGER_SHA256) fail("ledger_checksum_mismatch");
  const required = [
    /^begin;/iu,
    /create table if not exists public\.mobile_push_delivery_attempts/iu,
    /jsonb_object_keys\(p_input\) as keys\(key\)/iu,
    /unique \(idempotency_key, attempt_number\)/iu,
    /alter table public\.mobile_push_delivery_attempts enable row level security/iu,
    /from public, anon, authenticated, service_role/iu,
    /to service_role/iu,
    /create or replace function public\.mobile_push_delivery_reserve\(p_input jsonb\)/iu,
    /for update of w, m, f, c, r/iu,
    /pg_advisory_xact_lock\(hashtextextended\(v_idempotency_key, 0\)\)/iu,
    /r\.expo_token_hash = v_token_fingerprint/iu,
    /create or replace function public\.mobile_push_delivery_reserve_receipt\(p_input jsonb\)/iu,
    /create or replace function public\.mobile_push_delivery_transition/iu,
    /v_registration_id <> v_attempt\.registration_id/iu,
    /update public\.mobile_push_registrations set\s+status = 'disabled'/iu,
    /Installing this table does not enable a route, timer, worker or provider send/iu,
    /commit;\s*$/iu,
  ];
  const forbidden = [
    /create\s+policy/iu,
    /\btruncate\b/iu,
    /\bpg_cron\b|\bcron\.schedule\b/iu,
    /\b(?:http|net)\.(?:post|get)\b/iu,
    /exp\.host|expo\.dev/iu,
  ];
  if (
    required.some((contract) => !contract.test(sql)) ||
    forbidden.some((contract) => contract.test(sql))
  ) {
    fail("ledger_contract_invalid");
  }
  return Object.freeze({ digest, ledgerId: LEDGER_ID });
}

export function checkMobilePushDeliveryLedger() {
  const result = evaluateMobilePushDeliveryLedgerSql(
    readFileSync(LEDGER_PATH, "utf8"),
  );
  console.log(`MOBILE_PUSH_DELIVERY_LEDGER_ID=${result.ledgerId}`);
  console.log(`MOBILE_PUSH_DELIVERY_LEDGER_SHA256=${result.digest}`);
  console.log("MOBILE_PUSH_DELIVERY_LEDGER_OFFLINE_CHECK=PASS");
  return result;
}

function modeFromArguments(argumentsList) {
  const known = new Set(["--check", "--verify", "--apply"]);
  if (argumentsList.length !== 1 || !known.has(argumentsList[0])) {
    fail("argument_invalid");
  }
  return argumentsList[0];
}

function privatePassfileSnapshot(environment) {
  const sourcePath = environment.PGPASSFILE?.trim();
  if (!sourcePath || !isAbsolute(sourcePath)) fail("passfile_missing");
  let descriptor;
  let snapshotDirectory;
  let content;
  try {
    descriptor = openSync(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = fstatSync(descriptor);
    if (
      !opened.isFile() ||
      (opened.mode & 0o777) !== 0o600 ||
      opened.size < 1 ||
      opened.size > MAX_PASSFILE_BYTES ||
      (typeof process.getuid === "function" && opened.uid !== process.getuid())
    ) fail("passfile_invalid");
    content = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < content.length) {
      const count = readSync(descriptor, content, offset, content.length - offset, offset);
      if (count === 0) fail("passfile_read_failed");
      offset += count;
    }
    const settled = fstatSync(descriptor);
    if (
      settled.dev !== opened.dev || settled.ino !== opened.ino ||
      settled.size !== opened.size || settled.mtimeMs !== opened.mtimeMs ||
      settled.ctimeMs !== opened.ctimeMs
    ) fail("passfile_changed");
    snapshotDirectory = mkdtempSync(join(tmpdir(), "fanmind-push-ledger-"));
    const snapshotPath = join(snapshotDirectory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { snapshotDirectory, snapshotPath };
  } catch (error) {
    if (snapshotDirectory) rmSync(snapshotDirectory, { recursive: true, force: true });
    if (error instanceof Error && error.message.startsWith("MOBILE_PUSH_DELIVERY_LEDGER_ERROR=")) throw error;
    fail("passfile_read_failed");
  } finally {
    content?.fill(0);
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function runPsql(input, environment, passfilePath) {
  const safeEnvironment = { ...environment, PGPASSFILE: passfilePath, PGCONNECT_TIMEOUT: "10" };
  for (const key of ["DATABASE_URL", "POSTGRES_URL", "SUPABASE_DB_URL", "PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE", "PGSYSCONFDIR"]) delete safeEnvironment[key];
  return spawnSync("psql", ["--no-password", "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1"], {
    env: safeEnvironment,
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function runDatabaseMode(mode, sql, environment) {
  const policyMode = mode === "--apply" ? "ledger_migration" : "ledger_schema";
  if (!evaluateMobilePushStagingControlEnvironment(environment, { mode: policyMode }).ok) fail("environment_invalid");
  const version = spawnSync("psql", ["--version"], { stdio: "ignore" });
  if (version.error || version.status !== 0) fail("psql_unavailable");
  const { snapshotDirectory, snapshotPath } = privatePassfileSnapshot(environment);
  try {
    if (mode === "--apply") {
      const applied = runPsql(sql, environment, snapshotPath);
      if (applied.error || applied.status !== 0) fail("apply_failed");
      console.log("MOBILE_PUSH_DELIVERY_LEDGER_APPLY=completed");
    } else {
      console.log("MOBILE_PUSH_DELIVERY_LEDGER_APPLY=not_requested");
    }
    const checked = runPsql(LEDGER_POSTFLIGHT_SQL, environment, snapshotPath);
    if (checked.error || checked.status !== 0 || !checked.stdout.includes("MOBILE_PUSH_DELIVERY_LEDGER_POSTFLIGHT=PASS")) fail("postflight_failed");
    console.log("MOBILE_PUSH_DELIVERY_LEDGER_POSTFLIGHT=PASS");
    console.log("MOBILE_PUSH_DELIVERY_PROVIDER_SEND=disabled");
    console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    const mode = modeFromArguments(process.argv.slice(2));
    const checked = checkMobilePushDeliveryLedger();
    if (mode !== "--check") {
      const sql = readFileSync(LEDGER_PATH, "utf8");
      runDatabaseMode(mode, sql, process.env);
    }
    console.log(`MOBILE_PUSH_DELIVERY_LEDGER_MODE=${mode.slice(2)}`);
    console.log("MOBILE_PUSH_DELIVERY_LEDGER_READY=YES");
  } catch (error) {
    console.error(error instanceof Error && /^MOBILE_PUSH_DELIVERY_LEDGER_ERROR=[a-z0-9_]+$/u.test(error.message) ? error.message : "MOBILE_PUSH_DELIVERY_LEDGER_ERROR=unexpected_failure");
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  }
}
