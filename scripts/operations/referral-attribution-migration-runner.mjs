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

import { evaluateReferralAttributionMigrationEnvironment } from "../../src/lib/referralAttributionMigrationPolicy.mjs";

const MIGRATION_ID = "20260814230000_referral_attribution_integrity";
const MIGRATION_PATH = resolve(
  process.cwd(),
  `supabase/migrations/${MIGRATION_ID}.sql`,
);
const EXPECTED_MIGRATION_SHA256 =
  "fac209e11cec77c386b4747c0b78d8d8c20efe477b78672f2b4de1dce9e7719e";
const MAX_PASSFILE_BYTES = 64 * 1024;
const SAFE_DATABASE_FAILURES = new Set([
  "referral_attribution_duplicates_require_manual_review",
  "referrals_table_missing",
  "referral_unique_index_invalid",
  "referral_self_constraint_invalid",
  "referral_attribution_function_invalid",
  "referral_attribution_execute_invalid",
  "referral_attribution_trigger_invalid",
]);

const POSTFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  referrals_oid oid := to_regclass('public.referrals');
  referred_workspace_attnum smallint;
  guard_oid oid := to_regprocedure('public.protect_referral_attribution()');
  guard_definition text;
  trigger_definition text;
begin
  if referrals_oid is null then
    raise exception 'referrals_table_missing';
  end if;

  select attnum
    into referred_workspace_attnum
    from pg_attribute
   where attrelid = referrals_oid
     and attname = 'referred_workspace_id'
     and not attisdropped;

  if referred_workspace_attnum is null or not exists (
    select 1
      from pg_index as index_definition
      join pg_class as index_relation
        on index_relation.oid = index_definition.indexrelid
     where index_definition.indrelid = referrals_oid
       and index_relation.relname = 'referrals_referred_workspace_unique_idx'
       and index_definition.indisunique
       and index_definition.indisvalid
       and index_definition.indisready
       and index_definition.indnkeyatts = 1
       and index_definition.indnatts = 1
       and index_definition.indpred is null
       and index_definition.indexprs is null
       and index_definition.indkey[0] = referred_workspace_attnum
  ) then
    raise exception 'referral_unique_index_invalid';
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conrelid = referrals_oid
       and conname = 'referrals_no_self_user_check'
       and contype = 'c'
       and convalidated
       and lower(pg_get_expr(conbin, conrelid)) like '%referred_user_id%'
       and lower(pg_get_expr(conbin, conrelid)) like '%referrer_user_id%'
       and lower(pg_get_expr(conbin, conrelid)) like '%<>%'
  ) then
    raise exception 'referral_self_constraint_invalid';
  end if;

  if guard_oid is null then
    raise exception 'referral_attribution_function_invalid';
  end if;

  select pg_get_functiondef(guard_oid)
    into guard_definition;
  if not exists (
    select 1
      from pg_proc
     where oid = guard_oid
       and pronargs = 0
       and prorettype = 'trigger'::regtype
       and proconfig @> array['search_path=pg_catalog, pg_temp']
  ) or position('referral_attribution_immutable' in guard_definition) = 0
    or position('new.referrer_workspace_id' in lower(guard_definition)) = 0
    or position('new.referred_workspace_id' in lower(guard_definition)) = 0
    or position('new.referrer_user_id' in lower(guard_definition)) = 0
    or position('new.referred_user_id' in lower(guard_definition)) = 0
    or position('new.referral_code' in lower(guard_definition)) = 0 then
    raise exception 'referral_attribution_function_invalid';
  end if;

  if has_function_privilege('anon', guard_oid, 'EXECUTE')
     or has_function_privilege('authenticated', guard_oid, 'EXECUTE')
     or exists (
       select 1
         from pg_proc as function_definition
         cross join lateral aclexplode(
           coalesce(
             function_definition.proacl,
             acldefault('f', function_definition.proowner)
           )
         ) as function_acl
        where function_definition.oid = guard_oid
          and function_acl.grantee = 0
          and function_acl.privilege_type = 'EXECUTE'
     ) then
    raise exception 'referral_attribution_execute_invalid';
  end if;

  select pg_get_triggerdef(trigger_oid, true)
    into trigger_definition
    from (
      select trigger_definition.oid as trigger_oid
        from pg_trigger as trigger_definition
       where trigger_definition.tgrelid = referrals_oid
         and trigger_definition.tgname = 'protect_referral_attribution_trigger'
         and not trigger_definition.tgisinternal
         and trigger_definition.tgenabled = 'O'
         and trigger_definition.tgfoid = guard_oid
         and trigger_definition.tgtype = 19
    ) as exact_trigger;
  if trigger_definition is null
     or position('before update of referrer_workspace_id' in lower(trigger_definition)) = 0
     or position('referrer_user_id' in lower(trigger_definition)) = 0
     or position('referred_workspace_id' in lower(trigger_definition)) = 0
     or position('referred_user_id' in lower(trigger_definition)) = 0
     or position('referral_code' in lower(trigger_definition)) = 0 then
    raise exception 'referral_attribution_trigger_invalid';
  end if;
end
$verify$;

select 'REFERRAL_ATTRIBUTION_POSTFLIGHT=PASS';
rollback;
`;

function fail(code) {
  throw new Error(`REFERRAL_ATTRIBUTION_MIGRATION_ERROR=${code}`);
}

function modeFromArguments(argumentsList) {
  const known = new Set(["--check", "--verify", "--apply"]);
  if (argumentsList.some((argument) => !known.has(argument))) {
    fail("argument_invalid");
  }
  const selected = argumentsList.filter((argument) => known.has(argument));
  if (selected.length > 1) fail("mode_ambiguous");
  return selected[0] ?? "--check";
}

export function evaluateReferralAttributionMigrationSql(sql) {
  if (typeof sql !== "string") fail("migration_unreadable");
  const digest = createHash("sha256").update(sql).digest("hex");
  if (digest !== EXPECTED_MIGRATION_SHA256) {
    fail("migration_checksum_mismatch");
  }

  const requiredContracts = [
    /^--[\s\S]*\bbegin;/iu,
    /referral_attribution_duplicates_require_manual_review/iu,
    /create unique index referrals_referred_workspace_unique_idx\s+on public\.referrals \(referred_workspace_id\);/iu,
    /add constraint referrals_no_self_user_check[\s\S]*referred_user_id[\s\S]*referrer_user_id[\s\S]*not valid;/iu,
    /validate constraint referrals_no_self_user_check;/iu,
    /create or replace function public\.protect_referral_attribution\(\)[\s\S]*returns trigger[\s\S]*set search_path = pg_catalog, pg_temp/iu,
    /raise exception 'referral_attribution_immutable';/iu,
    /create trigger protect_referral_attribution_trigger[\s\S]*before update of[\s\S]*execute function public\.protect_referral_attribution\(\);/iu,
    /revoke all on function public\.protect_referral_attribution\(\) from public;/iu,
    /revoke all on function public\.protect_referral_attribution\(\) from anon;/iu,
    /revoke all on function public\.protect_referral_attribution\(\) from authenticated;/iu,
    /commit;\s*$/iu,
  ];
  const forbiddenContracts = [
    /\bgrant\b/iu,
    /\bdrop\s+(?:table|schema|database|function)\b/iu,
    /\btruncate\b/iu,
    /\b(?:insert|update|delete)\s+(?:into|from|public\.)/iu,
    /\bcreate\s+(?:table|schema|policy)\b/iu,
  ];
  if (
    requiredContracts.some((contract) => !contract.test(sql)) ||
    forbiddenContracts.some((contract) => contract.test(sql))
  ) {
    fail("migration_contract_invalid");
  }

  return Object.freeze({ digest, migrationId: MIGRATION_ID });
}

function readAndVerifyMigration() {
  let sql;
  try {
    sql = readFileSync(MIGRATION_PATH, "utf8");
  } catch {
    fail("migration_unreadable");
  }
  const result = evaluateReferralAttributionMigrationSql(sql);
  console.log(`REFERRAL_ATTRIBUTION_MIGRATION_ID=${result.migrationId}`);
  console.log("REFERRAL_ATTRIBUTION_CHECKSUM=verified");
  console.log("REFERRAL_ATTRIBUTION_CONTRACT=verified");
  return sql;
}

function privatePassfileSnapshot(environment) {
  const sourcePath = environment.PGPASSFILE?.trim();
  if (!sourcePath || !isAbsolute(sourcePath)) fail("passfile_missing");

  let sourceDescriptor;
  let snapshotDirectory;
  let content;
  try {
    sourceDescriptor = openSync(
      sourcePath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    const opened = fstatSync(sourceDescriptor);
    if (
      !opened.isFile() ||
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
      const bytesRead = readSync(
        sourceDescriptor,
        content,
        offset,
        content.length - offset,
        offset,
      );
      if (bytesRead === 0) fail("passfile_read_failed");
      offset += bytesRead;
    }
    const settled = fstatSync(sourceDescriptor);
    if (
      settled.dev !== opened.dev ||
      settled.ino !== opened.ino ||
      settled.size !== opened.size ||
      settled.mtimeMs !== opened.mtimeMs ||
      settled.ctimeMs !== opened.ctimeMs
    ) {
      fail("passfile_changed");
    }

    snapshotDirectory = mkdtempSync(
      join(tmpdir(), "fanmind-referral-attribution-"),
    );
    const snapshotPath = join(snapshotDirectory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { snapshotDirectory, snapshotPath };
  } catch (error) {
    if (snapshotDirectory) {
      rmSync(snapshotDirectory, { recursive: true, force: true });
    }
    if (
      error instanceof Error &&
      error.message.startsWith("REFERRAL_ATTRIBUTION_MIGRATION_ERROR=")
    ) {
      throw error;
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ELOOP"
    ) {
      fail("passfile_invalid");
    }
    fail("passfile_read_failed");
  } finally {
    content?.fill(0);
    if (sourceDescriptor !== undefined) closeSync(sourceDescriptor);
  }
}

function psqlEnvironment(environment, passfilePath) {
  const safeEnvironment = { ...environment, PGPASSFILE: passfilePath };
  for (const key of [
    "DATABASE_URL",
    "POSTGRES_URL",
    "SUPABASE_DB_URL",
    "PGPASSWORD",
    "PGHOSTADDR",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ]) {
    delete safeEnvironment[key];
  }
  safeEnvironment.PGCONNECT_TIMEOUT = "10";
  return safeEnvironment;
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
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}

function ensurePsqlAvailable() {
  const result = spawnSync("psql", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (result.error || result.status !== 0) fail("psql_unavailable");
  console.log("REFERRAL_ATTRIBUTION_PSQL=available");
}

function safeDatabaseFailure(stderr, fallback) {
  const output = typeof stderr === "string" ? stderr : "";
  for (const code of SAFE_DATABASE_FAILURES) {
    if (output.includes(code)) return code;
  }
  return fallback;
}

function runDatabaseMode(mode, migrationSql, environment) {
  const policyMode = mode === "--apply" ? "apply" : "verify";
  const evaluation = evaluateReferralAttributionMigrationEnvironment(
    environment,
    { mode: policyMode },
  );
  if (!evaluation.ok) fail("environment_invalid");

  ensurePsqlAvailable();
  const { snapshotDirectory, snapshotPath } =
    privatePassfileSnapshot(environment);
  try {
    if (mode === "--apply") {
      const apply = runPsql(migrationSql, environment, snapshotPath);
      if (apply.error || apply.status !== 0) {
        fail(safeDatabaseFailure(apply.stderr, "apply_failed"));
      }
      console.log("REFERRAL_ATTRIBUTION_APPLY=completed");
    } else {
      console.log("REFERRAL_ATTRIBUTION_APPLY=not_requested");
    }

    const verification = runPsql(POSTFLIGHT_SQL, environment, snapshotPath);
    if (
      verification.error ||
      verification.status !== 0 ||
      !verification.stdout.includes("REFERRAL_ATTRIBUTION_POSTFLIGHT=PASS")
    ) {
      fail(safeDatabaseFailure(verification.stderr, "postflight_failed"));
    }
    console.log("REFERRAL_ATTRIBUTION_POSTFLIGHT=PASS");
    console.log("REFERRAL_ATTRIBUTION_POSTFLIGHT_TRANSACTION=ROLLED_BACK");
    console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  const migrationSql = readAndVerifyMigration();
  if (mode === "--check") {
    console.log("REFERRAL_ATTRIBUTION_MODE=check");
    console.log("REFERRAL_ATTRIBUTION_READY=YES");
    return;
  }
  console.log(
    `REFERRAL_ATTRIBUTION_MODE=${mode === "--apply" ? "apply" : "verify"}`,
  );
  runDatabaseMode(mode, migrationSql, process.env);
  console.log("REFERRAL_ATTRIBUTION_READY=YES");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    if (
      error instanceof Error &&
      /^REFERRAL_ATTRIBUTION_MIGRATION_ERROR=[a-z0-9_]+$/u.test(error.message)
    ) {
      console.error(error.message);
    } else {
      console.error("REFERRAL_ATTRIBUTION_MIGRATION_ERROR=unexpected_failure");
    }
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  });
}

export {
  EXPECTED_MIGRATION_SHA256,
  MIGRATION_ID,
  POSTFLIGHT_SQL,
  safeDatabaseFailure,
};
