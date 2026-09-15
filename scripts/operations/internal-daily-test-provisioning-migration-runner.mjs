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

import { evaluateInternalDailyTestWorkspaceProvisioningStagingEnvironment } from "../../src/lib/internalDailyTestWorkspaceProvisioningStagingPolicy.mjs";
import { evaluateInternalDailyTestWorkspaceProvisioningProductionEnvironment } from "../../src/lib/internalDailyTestWorkspaceProvisioningProductionPolicy.mjs";

const CONTROL_ID = "20260808230102_internal_daily_test_workspace_provisioning";
const CONTROLLED_SQL_PATH = resolve(
  process.cwd(),
  `supabase/controlled/${CONTROL_ID}.sql`,
);
const EXPECTED_CONTROLLED_SQL_SHA256 =
  "235b1f7e57cd2c6ecfdc9d68b6412c3649aee776b7bb1bc8688d74ac0da5ed4a";
const MAX_PASSFILE_BYTES = 64 * 1024;

const PRECHECK_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $preflight$
declare
  owner_index oid := to_regclass('public.workspaces_owner_user_id_uidx');
  membership_index oid :=
    to_regclass('public.workspace_members_workspace_user_uidx');
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception 'generic_migration_ledger_missing';
  end if;

  if exists (
    select 1
      from supabase_migrations.schema_migrations
     where version = '20260808230102'
  ) then
    raise exception 'controlled_sql_found_in_generic_ledger';
  end if;

  if to_regprocedure(
       'public.ensure_current_user_workspace(text,text,boolean)'
     ) is null then
    raise exception 'starter_provisioning_rpc_missing';
  end if;

  if to_regprocedure(
       'public.ensure_internal_daily_test_workspace(uuid,text,boolean)'
     ) is not null
     or to_regprocedure(
       'public.internal_daily_test_workspace_provisioning_ready()'
     ) is not null then
    raise exception 'controlled_sql_already_present';
  end if;

  if owner_index is null or not exists (
    select 1
      from pg_index as index_record
     where index_record.indexrelid = owner_index
       and index_record.indrelid = 'public.workspaces'::regclass
       and index_record.indisunique
       and index_record.indisvalid
       and index_record.indisready
       and index_record.indislive
       and index_record.indimmediate
       and index_record.indpred is null
       and index_record.indexprs is null
       and index_record.indnkeyatts = 1
       and index_record.indnatts = 1
       and (
         select array_agg(attribute.attname::text order by key.ordinality)
           from unnest(index_record.indkey)
             with ordinality as key(attnum, ordinality)
           join pg_attribute as attribute
             on attribute.attrelid = index_record.indrelid
            and attribute.attnum = key.attnum
       ) = array['owner_user_id']::text[]
  ) then
    raise exception 'workspace_owner_index_invalid';
  end if;

  if membership_index is null or not exists (
    select 1
      from pg_index as index_record
     where index_record.indexrelid = membership_index
       and index_record.indrelid = 'public.workspace_members'::regclass
       and index_record.indisunique
       and index_record.indisvalid
       and index_record.indisready
       and index_record.indislive
       and index_record.indimmediate
       and index_record.indpred is null
       and index_record.indexprs is null
       and index_record.indnkeyatts = 2
       and index_record.indnatts = 2
       and (
         select array_agg(attribute.attname::text order by key.ordinality)
           from unnest(index_record.indkey)
             with ordinality as key(attnum, ordinality)
           join pg_attribute as attribute
             on attribute.attrelid = index_record.indrelid
            and attribute.attnum = key.attnum
       ) = array['workspace_id', 'user_id']::text[]
  ) then
    raise exception 'workspace_membership_index_invalid';
  end if;

  if has_table_privilege('anon', 'public.workspaces', 'INSERT')
     or has_table_privilege('authenticated', 'public.workspaces', 'INSERT')
     or has_any_column_privilege(
       'anon', 'public.workspaces', 'INSERT'
     )
     or has_any_column_privilege(
       'authenticated', 'public.workspaces', 'INSERT'
     ) then
    raise exception 'browser_workspace_insert_not_denied';
  end if;

  if exists (
    select 1
      from public.workspaces
     where commercial_option not in (
       'pilot_only',
       'starter_paid_setup',
       'starter_no_setup_commitment',
       'internal_daily_test'
     )
        or (
          payment_collection_method is not null
          and payment_collection_method not in (
            'none',
            'manual_invoice',
            'sepa_direct_debit',
            'card'
          )
        )
  ) then
    raise exception 'workspace_value_contract_incompatible';
  end if;
end
$preflight$;

select 'INTERNAL_DAILY_TEST_PROVISIONING_PREFLIGHT=PASS';
rollback;
`;

const POSTFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  daily_rpc oid := to_regprocedure(
    'public.ensure_internal_daily_test_workspace(uuid,text,boolean)'
  );
  readiness_rpc oid := to_regprocedure(
    'public.internal_daily_test_workspace_provisioning_ready()'
  );
begin
  if to_regclass('supabase_migrations.schema_migrations') is null then
    raise exception 'generic_migration_ledger_missing';
  end if;

  if exists (
    select 1
      from supabase_migrations.schema_migrations
     where version = '20260808230102'
  ) then
    raise exception 'controlled_sql_in_generic_ledger';
  end if;

  if daily_rpc is null or readiness_rpc is null then
    raise exception 'controlled_rpc_missing';
  end if;

  if not coalesce((
    select count(*) = 2
       and bool_and(prosecdef)
       and bool_and(
         coalesce(
           proconfig = array['search_path=pg_catalog, public, pg_temp'],
           false
         )
       )
      from pg_proc
     where oid in (daily_rpc, readiness_rpc)
  ), false) then
    raise exception 'controlled_rpc_contract_invalid';
  end if;

  if not exists (
    select 1
      from pg_proc as function_definition
      join pg_language as function_language
        on function_language.oid = function_definition.prolang
     where function_definition.oid = daily_rpc
       and function_definition.proowner = to_regrole('postgres')
       and function_language.lanname = 'plpgsql'
       and function_definition.prokind = 'f'
       and function_definition.provolatile = 'v'
       and function_definition.proretset
       and function_definition.prorettype = 'record'::regtype
       and function_definition.proallargtypes = array[
         'uuid'::regtype,
         'text'::regtype,
         'boolean'::regtype,
         'uuid'::regtype,
         'boolean'::regtype
       ]::oid[]
       and function_definition.proargmodes =
         array['i', 'i', 'i', 't', 't']::"char"[]
       and function_definition.proargnames = array[
         'p_user_id',
         'p_workspace_name',
         'p_payment_terms_accepted',
         'workspace_id',
         'created'
       ]::text[]
       and function_definition.prosrc = convert_from(
         decode('__FANMIND_DAILY_RPC_BODY_HEX__', 'hex'),
         'UTF8'
       )
  ) then
    raise exception 'controlled_daily_rpc_definition_invalid';
  end if;

  if not exists (
    select 1
      from pg_proc as function_definition
      join pg_language as function_language
        on function_language.oid = function_definition.prolang
     where function_definition.oid = readiness_rpc
       and function_definition.proowner = to_regrole('postgres')
       and function_language.lanname = 'sql'
       and function_definition.prokind = 'f'
       and function_definition.provolatile = 's'
       and function_definition.proretset
       and function_definition.prorettype = 'boolean'::regtype
       and function_definition.proallargtypes =
         array['boolean'::regtype]::oid[]
       and function_definition.proargmodes = array['t']::"char"[]
       and function_definition.proargnames = array['ready']::text[]
       and function_definition.prosrc = convert_from(
         decode('__FANMIND_READINESS_RPC_BODY_HEX__', 'hex'),
         'UTF8'
       )
  ) then
    raise exception 'controlled_readiness_rpc_definition_invalid';
  end if;

  if has_function_privilege('anon', daily_rpc, 'EXECUTE')
     or has_function_privilege('authenticated', daily_rpc, 'EXECUTE')
     or has_function_privilege('anon', readiness_rpc, 'EXECUTE')
     or has_function_privilege('authenticated', readiness_rpc, 'EXECUTE')
     or not has_function_privilege('service_role', daily_rpc, 'EXECUTE')
     or not has_function_privilege('service_role', readiness_rpc, 'EXECUTE')
     or exists (
       select 1
         from pg_proc as function_definition
        where function_definition.oid in (daily_rpc, readiness_rpc)
          and not coalesce((
            select count(*) = 2
               and bool_and(function_acl.privilege_type = 'EXECUTE')
               and bool_and(not function_acl.is_grantable)
               and bool_and(
                 function_acl.grantor = function_definition.proowner
               )
               and count(*) filter (
                 where function_acl.grantee = function_definition.proowner
               ) = 1
               and count(*) filter (
                 where function_acl.grantee = to_regrole('service_role')
               ) = 1
              from aclexplode(
                coalesce(
                  function_definition.proacl,
                  acldefault('f', function_definition.proowner)
                )
              ) as function_acl
          ), false)
     ) then
    raise exception 'controlled_rpc_privilege_invalid';
  end if;

  if not exists (
    select 1
      from pg_constraint as constraint_record
     where constraint_record.conrelid = 'public.workspaces'::regclass
       and constraint_record.conname = 'workspaces_commercial_option_check'
       and constraint_record.contype = 'c'
       and constraint_record.convalidated
       and pg_get_constraintdef(constraint_record.oid, true) =
         $commercial_option_contract$CHECK (commercial_option = ANY (ARRAY['pilot_only'::text, 'starter_paid_setup'::text, 'starter_no_setup_commitment'::text, 'internal_daily_test'::text]))$commercial_option_contract$
  ) then
    raise exception 'commercial_option_constraint_invalid';
  end if;

  if not exists (
    select 1
      from pg_constraint as constraint_record
     where constraint_record.conrelid = 'public.workspaces'::regclass
       and constraint_record.conname =
             'workspaces_payment_collection_method_check'
       and constraint_record.contype = 'c'
       and constraint_record.convalidated
       and pg_get_constraintdef(constraint_record.oid, true) =
         $payment_collection_contract$CHECK (payment_collection_method IS NULL OR (payment_collection_method = ANY (ARRAY['none'::text, 'manual_invoice'::text, 'sepa_direct_debit'::text, 'card'::text])))$payment_collection_contract$
  ) then
    raise exception 'payment_collection_constraint_invalid';
  end if;

  if not exists (
    select 1
      from pg_index as index_record
     where index_record.indexrelid =
             to_regclass('public.workspaces_owner_user_id_uidx')
       and index_record.indrelid = 'public.workspaces'::regclass
       and index_record.indisunique
       and index_record.indisvalid
       and index_record.indisready
       and index_record.indislive
       and index_record.indimmediate
       and index_record.indpred is null
       and index_record.indexprs is null
       and index_record.indnkeyatts = 1
       and index_record.indnatts = 1
       and (
         select array_agg(attribute.attname::text order by key.ordinality)
           from unnest(index_record.indkey)
             with ordinality as key(attnum, ordinality)
           join pg_attribute as attribute
             on attribute.attrelid = index_record.indrelid
            and attribute.attnum = key.attnum
       ) = array['owner_user_id']::text[]
  ) then
    raise exception 'workspace_owner_index_invalid';
  end if;

  if not exists (
    select 1
      from pg_index as index_record
     where index_record.indexrelid =
             to_regclass('public.workspace_members_workspace_user_uidx')
       and index_record.indrelid = 'public.workspace_members'::regclass
       and index_record.indisunique
       and index_record.indisvalid
       and index_record.indisready
       and index_record.indislive
       and index_record.indimmediate
       and index_record.indpred is null
       and index_record.indexprs is null
       and index_record.indnkeyatts = 2
       and index_record.indnatts = 2
       and (
         select array_agg(attribute.attname::text order by key.ordinality)
           from unnest(index_record.indkey)
             with ordinality as key(attnum, ordinality)
           join pg_attribute as attribute
             on attribute.attrelid = index_record.indrelid
            and attribute.attnum = key.attnum
       ) = array['workspace_id', 'user_id']::text[]
  ) then
    raise exception 'workspace_membership_index_invalid';
  end if;

  if has_table_privilege('anon', 'public.workspaces', 'INSERT')
     or has_table_privilege('authenticated', 'public.workspaces', 'INSERT')
     or has_any_column_privilege(
       'anon', 'public.workspaces', 'INSERT'
     )
     or has_any_column_privilege(
       'authenticated', 'public.workspaces', 'INSERT'
     ) then
    raise exception 'browser_workspace_insert_not_denied';
  end if;

  perform set_config('request.jwt.claim.role', 'service_role', true);
  if not exists (
    select 1
      from public.internal_daily_test_workspace_provisioning_ready()
     where ready
  ) then
    raise exception 'controlled_readiness_failed';
  end if;
end
$verify$;

select 'INTERNAL_DAILY_TEST_PROVISIONING_POSTFLIGHT=PASS';
rollback;
`;

function fail(code) {
  throw new Error(`INTERNAL_DAILY_TEST_PROVISIONING_ERROR=${code}`);
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

export function evaluateInternalDailyTestProvisioningSql(sql) {
  if (typeof sql !== "string") fail("controlled_sql_unreadable");
  const digest = createHash("sha256").update(sql).digest("hex");
  if (digest !== EXPECTED_CONTROLLED_SQL_SHA256) {
    fail("controlled_sql_checksum_mismatch");
  }

  const required = [
    /^begin;/mu,
    /lock table supabase_migrations\.schema_migrations in share mode[\s\S]*version = '20260808230102'/u,
    /add constraint workspaces_commercial_option_daily_check[\s\S]*validate constraint workspaces_commercial_option_daily_check/u,
    /add constraint workspaces_payment_collection_method_daily_check[\s\S]*validate constraint workspaces_payment_collection_method_daily_check/u,
    /create or replace function public\.ensure_internal_daily_test_workspace[\s\S]*security definer[\s\S]*auth\.role\(\) is distinct from 'service_role'/u,
    /revoke all on function public\.ensure_internal_daily_test_workspace[\s\S]*from public, anon, authenticated[\s\S]*grant execute[\s\S]*to service_role/u,
    /create or replace function public\.internal_daily_test_workspace_provisioning_ready[\s\S]*security definer/u,
    /revoke all on function public\.internal_daily_test_workspace_provisioning_ready[\s\S]*from public, anon, authenticated[\s\S]*grant execute[\s\S]*to service_role/u,
    /commit;\s*$/u,
  ];
  const forbidden = [
    /\bgrant\s+(?:insert|update|delete|all)\b[\s\S]*\bto\s+(?:public|anon|authenticated)\b/iu,
    /\btruncate\b/iu,
    /\bdrop\s+(?:table|schema|database)\b/iu,
    /\bdelete\s+from\b/iu,
  ];
  if (
    required.some((contract) => !contract.test(sql)) ||
    forbidden.some((contract) => contract.test(sql))
  ) {
    fail("controlled_sql_contract_invalid");
  }
  return Object.freeze({ digest, controlId: CONTROL_ID });
}

function controlledFunctionBody(sql, functionName) {
  const declaration = `create or replace function public.${functionName}`;
  const declarationStart = sql.indexOf(declaration);
  const bodyDelimiter = "as $function$";
  const bodyStart = sql.indexOf(bodyDelimiter, declarationStart);
  const bodyEnd = sql.indexOf("$function$;", bodyStart + bodyDelimiter.length);
  if (
    declarationStart < 0 ||
    bodyStart < 0 ||
    bodyEnd < 0 ||
    sql.indexOf(declaration, declarationStart + declaration.length) >= 0
  ) {
    fail("controlled_sql_contract_invalid");
  }
  return sql.slice(bodyStart + bodyDelimiter.length, bodyEnd);
}

export function materializeInternalDailyTestProvisioningPostflight(sql) {
  evaluateInternalDailyTestProvisioningSql(sql);
  const dailyBodyHex = Buffer.from(
    controlledFunctionBody(sql, "ensure_internal_daily_test_workspace"),
    "utf8",
  ).toString("hex");
  const readinessBodyHex = Buffer.from(
    controlledFunctionBody(
      sql,
      "internal_daily_test_workspace_provisioning_ready",
    ),
    "utf8",
  ).toString("hex");
  const materialized = POSTFLIGHT_SQL.replace(
    "__FANMIND_DAILY_RPC_BODY_HEX__",
    dailyBodyHex,
  ).replace("__FANMIND_READINESS_RPC_BODY_HEX__", readinessBodyHex);
  if (/__FANMIND_[A-Z_]+__/u.test(materialized)) {
    fail("controlled_sql_contract_invalid");
  }
  return materialized;
}

function readAndVerifyControlledSql() {
  let sql;
  try {
    sql = readFileSync(CONTROLLED_SQL_PATH, "utf8");
  } catch {
    fail("controlled_sql_unreadable");
  }
  const result = evaluateInternalDailyTestProvisioningSql(sql);
  console.log(`INTERNAL_DAILY_TEST_PROVISIONING_CONTROL_ID=${result.controlId}`);
  console.log("INTERNAL_DAILY_TEST_PROVISIONING_CHECKSUM=verified");
  console.log("INTERNAL_DAILY_TEST_PROVISIONING_CONTRACT=verified");
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
      join(tmpdir(), "fanmind-internal-daily-test-provisioning-"),
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
      error.message.startsWith("INTERNAL_DAILY_TEST_PROVISIONING_ERROR=")
    ) {
      throw error;
    }
    if (error && typeof error === "object" && error.code === "ELOOP") {
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
  console.log("INTERNAL_DAILY_TEST_PROVISIONING_PSQL=available");
}

function runDatabaseMode(mode, controlledSql, environment) {
  const policyMode = mode === "--apply" ? "apply" : "verify";
  const evaluator =
    environment.FANMIND_INTERNAL_DAILY_TEST_CONTROL_TARGET === "production"
      ? evaluateInternalDailyTestWorkspaceProvisioningProductionEnvironment
      : evaluateInternalDailyTestWorkspaceProvisioningStagingEnvironment;
  const evaluation = evaluator(environment, { mode: policyMode });
  if (!evaluation.ok) fail("environment_invalid");
  const postflightSql =
    materializeInternalDailyTestProvisioningPostflight(controlledSql);

  ensurePsqlAvailable();
  const { snapshotDirectory, snapshotPath } =
    privatePassfileSnapshot(environment);
  try {
    if (mode === "--apply") {
      const preflight = runPsql(PRECHECK_SQL, environment, snapshotPath);
      if (
        preflight.error ||
        preflight.status !== 0 ||
        !preflight.stdout.includes(
          "INTERNAL_DAILY_TEST_PROVISIONING_PREFLIGHT=PASS",
        )
      ) {
        fail("preflight_failed");
      }
      console.log("INTERNAL_DAILY_TEST_PROVISIONING_PREFLIGHT=PASS");

      const apply = runPsql(controlledSql, environment, snapshotPath);
      if (apply.error || apply.status !== 0) fail("apply_failed");
      console.log("INTERNAL_DAILY_TEST_PROVISIONING_APPLY=completed");
    } else {
      console.log("INTERNAL_DAILY_TEST_PROVISIONING_APPLY=not_requested");
    }

    const verification = runPsql(postflightSql, environment, snapshotPath);
    if (
      verification.error ||
      verification.status !== 0 ||
      !verification.stdout.includes(
        "INTERNAL_DAILY_TEST_PROVISIONING_POSTFLIGHT=PASS",
      )
    ) {
      fail("postflight_failed");
    }
    console.log("INTERNAL_DAILY_TEST_PROVISIONING_POSTFLIGHT=PASS");
    console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  const controlledSql = readAndVerifyControlledSql();
  if (mode === "--check") {
    console.log("INTERNAL_DAILY_TEST_PROVISIONING_MODE=check");
    console.log("INTERNAL_DAILY_TEST_PROVISIONING_READY=YES");
    return;
  }
  console.log(
    `INTERNAL_DAILY_TEST_PROVISIONING_MODE=${
      mode === "--apply" ? "apply" : "verify"
    }`,
  );
  runDatabaseMode(mode, controlledSql, process.env);
  console.log("INTERNAL_DAILY_TEST_PROVISIONING_READY=YES");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    if (
      error instanceof Error &&
      /^INTERNAL_DAILY_TEST_PROVISIONING_ERROR=[a-z0-9_]+$/u.test(
        error.message,
      )
    ) {
      console.error(error.message);
    } else {
      console.error(
        "INTERNAL_DAILY_TEST_PROVISIONING_ERROR=unexpected_failure",
      );
    }
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  });
}

export {
  CONTROL_ID,
  EXPECTED_CONTROLLED_SQL_SHA256,
  PRECHECK_SQL,
  POSTFLIGHT_SQL,
};
