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

import {
  NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT,
  evaluateEnvironmentBoundary,
} from "../../src/lib/environmentBoundaryPolicy.mjs";

const CONTROL_ID = "20260816190000_workspace_ai_tier_stripe_event_ledger";
const CONTROL_PATH = resolve(
  process.cwd(),
  `supabase/controlled/${CONTROL_ID}.sql`,
);
const EXPECTED_CONTROL_SHA256 =
  "c07636db6f246364066b2fba426d4bcc955bee13d372982a88d2569c34b8c0d7";
const APPLY_CONFIRMATION = "apply-ai-tier-stripe-event-ledger";
const MAX_PASSFILE_BYTES = 64 * 1024;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const DATABASE_IDENTITY_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/u;
const HOST_PATTERN =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u;

const POSTFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  v_table regclass;
  v_column text;
  v_function regprocedure;
begin
  if to_regclass('public.workspace_ai_tier_entitlements') is null
     or to_regclass('public.workspace_ai_tier_stripe_events') is null
     or to_regclass('public.workspace_ai_tier_stripe_reconciliations') is null then
    raise exception 'ledger_table_missing';
  end if;

  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'workspace_ai_tier_entitlements'
       and column_name = 'stripe_sync_state'
       and data_type = 'text'
       and is_nullable = 'NO'
  ) or not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'workspace_ai_tier_entitlements'
       and column_name = 'stripe_sync_revision'
       and data_type = 'bigint'
       and is_nullable = 'NO'
  ) then
    raise exception 'projection_columns_invalid';
  end if;

  foreach v_table in array array[
    'public.workspace_ai_tier_stripe_events'::regclass,
    'public.workspace_ai_tier_stripe_reconciliations'::regclass
  ]
  loop
    if not exists (
      select 1 from pg_class
       where oid = v_table
         and relkind = 'r'
         and relrowsecurity
         and relforcerowsecurity
    ) or exists (
      select 1
        from pg_policy
       where polrelid = v_table
    ) then
      raise exception 'ledger_rls_invalid';
    end if;

    if has_table_privilege(
      'anon', v_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ) or has_table_privilege(
      'authenticated', v_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ) or has_table_privilege(
      'service_role', v_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ) then
      raise exception 'ledger_table_privilege_invalid';
    end if;

    for v_column in
      select attribute.attname::text
        from pg_attribute as attribute
       where attribute.attrelid = v_table
         and attribute.attnum > 0
         and not attribute.attisdropped
    loop
      if has_column_privilege(
        'anon', v_table, v_column, 'SELECT,INSERT,UPDATE,REFERENCES'
      ) or has_column_privilege(
        'authenticated', v_table, v_column, 'SELECT,INSERT,UPDATE,REFERENCES'
      ) or has_column_privilege(
        'service_role', v_table, v_column, 'SELECT,INSERT,UPDATE,REFERENCES'
      ) then
        raise exception 'ledger_column_privilege_invalid';
      end if;
    end loop;
  end loop;

  if not has_table_privilege(
    'service_role', 'public.workspace_ai_tier_entitlements', 'SELECT'
  ) or has_table_privilege(
    'service_role',
    'public.workspace_ai_tier_entitlements',
    'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
  ) then
    raise exception 'projection_privilege_invalid';
  end if;

  for v_column in
    select attribute.attname::text
      from pg_attribute as attribute
     where attribute.attrelid =
           'public.workspace_ai_tier_entitlements'::regclass
       and attribute.attnum > 0
       and not attribute.attisdropped
  loop
    if has_column_privilege(
      'service_role',
      'public.workspace_ai_tier_entitlements',
      v_column,
      'INSERT,UPDATE,REFERENCES'
    ) then
      raise exception 'projection_column_privilege_invalid';
    end if;
  end loop;

  if (
    select count(*)
      from pg_constraint
     where conrelid in (
       'public.workspace_ai_tier_entitlements'::regclass,
       'public.workspace_ai_tier_stripe_events'::regclass,
       'public.workspace_ai_tier_stripe_reconciliations'::regclass
     )
       and conname in (
         'workspace_ai_tier_entitlements_sync_state_check',
         'workspace_ai_tier_entitlements_sync_revision_check',
         'workspace_ai_tier_reconciliations_request_check',
         'workspace_ai_tier_reconciliations_customer_check',
         'workspace_ai_tier_reconciliations_subscription_check',
         'workspace_ai_tier_reconciliations_previous_subscription_check',
         'workspace_ai_tier_reconciliations_cutoff_check',
         'workspace_ai_tier_reconciliations_fingerprint_check',
         'workspace_ai_tier_reconciliations_revision_check',
         'workspace_ai_tier_reconciliations_kind_check',
         'workspace_ai_tier_events_id_check',
         'workspace_ai_tier_events_created_check',
         'workspace_ai_tier_events_type_check',
         'workspace_ai_tier_events_customer_check',
         'workspace_ai_tier_events_subscription_check',
         'workspace_ai_tier_events_fingerprint_check',
         'workspace_ai_tier_events_projection_check',
         'workspace_ai_tier_events_processing_check',
         'workspace_ai_tier_events_revision_check',
         'workspace_ai_tier_events_processed_check'
       )
       and convalidated
  ) <> 20 then
    raise exception 'ledger_constraints_invalid';
  end if;

  if (
    select count(*)
      from pg_index as definition
      join pg_class as index_relation
        on index_relation.oid = definition.indexrelid
     where definition.indisvalid
       and definition.indisready
       and index_relation.relname in (
         'workspace_ai_tier_reconciliations_workspace_idx',
         'workspace_ai_tier_events_workspace_order_idx',
         'workspace_ai_tier_events_subscription_order_idx',
         'workspace_ai_tier_events_reconciliation_idx'
       )
  ) <> 4 then
    raise exception 'ledger_indexes_invalid';
  end if;

  if (
    select count(*)
      from pg_proc as definition
      join pg_namespace as namespace on namespace.oid = definition.pronamespace
     where namespace.nspname = 'public'
       and definition.proname in (
         'apply_workspace_ai_tier_stripe_event',
         'reconcile_workspace_ai_tier_stripe_subscription'
       )
  ) <> 2 then
    raise exception 'ledger_function_set_invalid';
  end if;

  foreach v_function in array array[
    'public.apply_workspace_ai_tier_stripe_event(uuid,boolean,text,bigint,text,text,text,text,boolean,text,text,text,text,timestamp with time zone,timestamp with time zone)'::regprocedure,
    'public.reconcile_workspace_ai_tier_stripe_subscription(uuid,text,text,text,text,timestamp with time zone,text,bigint,boolean,text,text,text,text,timestamp with time zone,timestamp with time zone)'::regprocedure
  ]
  loop
    if not exists (
      select 1 from pg_proc
       where oid = v_function
         and prosecdef
         and proconfig @> array['search_path=pg_catalog, public, pg_temp']
    ) or has_function_privilege('anon', v_function, 'EXECUTE')
      or has_function_privilege('authenticated', v_function, 'EXECUTE')
      or not has_function_privilege('service_role', v_function, 'EXECUTE')
      or exists (
        select 1
          from pg_proc as definition
          cross join lateral aclexplode(
            coalesce(definition.proacl, acldefault('f', definition.proowner))
          ) as acl
         where definition.oid = v_function
           and acl.grantee = 0
           and acl.privilege_type = 'EXECUTE'
      ) then
      raise exception 'ledger_function_invalid';
    end if;
  end loop;
end
$verify$;

select 'AI_TIER_STRIPE_EVENT_LEDGER_POSTFLIGHT=PASS';
rollback;
`;

function fail(code) {
  throw new Error(`AI_TIER_STRIPE_EVENT_LEDGER_ERROR=${code}`);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedHost(value) {
  const candidate = clean(value).toLowerCase().replace(/\.+$/u, "");
  return HOST_PATTERN.test(candidate) ? candidate : "";
}

function strictOrigin(value) {
  try {
    const url = new URL(clean(value));
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "")
    ) {
      return "";
    }
    return url.origin;
  } catch {
    return "";
  }
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

export function evaluateAiTierStripeEventLedgerSql(sql) {
  if (typeof sql !== "string") fail("control_unreadable");
  const digest = createHash("sha256").update(sql).digest("hex");
  if (digest !== EXPECTED_CONTROL_SHA256) fail("control_checksum_mismatch");

  const required = [
    /^begin;/iu,
    /alter table public\.workspace_ai_tier_entitlements[\s\S]*stripe_sync_state[\s\S]*stripe_sync_revision/iu,
    /create table public\.workspace_ai_tier_stripe_events/iu,
    /event_id text primary key/iu,
    /create table public\.workspace_ai_tier_stripe_reconciliations/iu,
    /force row level security/iu,
    /revoke all on table public\.workspace_ai_tier_stripe_events[\s\S]*from public, anon, authenticated, service_role/iu,
    /revoke insert, update, delete[\s\S]*workspace_ai_tier_entitlements[\s\S]*from service_role/iu,
    /revoke insert \(%1\$s\), update \(%1\$s\), references \(%1\$s\)[\s\S]*workspace_ai_tier_entitlements from service_role/iu,
    /create function public\.apply_workspace_ai_tier_stripe_event/iu,
    /create function public\.reconcile_workspace_ai_tier_stripe_subscription/iu,
    /p_expected_previous_subscription_id[\s\S]*v_workspace_subscription_id is distinct from p_subscription_id/iu,
    /snapshot_event_created_cutoff[\s\S]*last_stripe_event_created_at = v_snapshot_event_created_cutoff/iu,
    /v_latest_reconciliation_cutoff[\s\S]*stale_event/iu,
    /language plpgsql\s+security definer\s+set search_path = pg_catalog, public, pg_temp/iu,
    /p_event_created_at = v_current\.last_stripe_event_created_at[\s\S]*event_order_conflict/iu,
    /stripe_sync_revision = v_expected_revision/iu,
    /workspace_ai_tier_ledger_function_boundary_failed/iu,
    /commit;\s*$/iu,
  ];
  const forbidden = [
    /^\s*truncate\s+(?:table\s+)?/imu,
    /\bdrop\s+(?:table|schema|database)\b/iu,
    /create\s+policy/iu,
    /p_event_id\s*(?:<|>|<=|>=)/iu,
    /order\s+by\s+(?:\w+\.)?event_id/iu,
    /raw_(?:body|payload)|request_body/iu,
  ];
  if (
    required.some((contract) => !contract.test(sql)) ||
    forbidden.some((contract) => contract.test(sql))
  ) {
    fail("control_contract_invalid");
  }
  return Object.freeze({ digest, controlId: CONTROL_ID });
}

function readAndVerifyControl() {
  let sql;
  try {
    sql = readFileSync(CONTROL_PATH, "utf8");
  } catch {
    fail("control_unreadable");
  }
  const evaluated = evaluateAiTierStripeEventLedgerSql(sql);
  console.log(`AI_TIER_STRIPE_EVENT_LEDGER_ID=${evaluated.controlId}`);
  console.log("AI_TIER_STRIPE_EVENT_LEDGER_CHECKSUM=verified");
  console.log("AI_TIER_STRIPE_EVENT_LEDGER_CONTRACT=verified");
  return sql;
}

function evaluateTarget(environment, mode) {
  const apply = mode === "--apply";
  const boundary = evaluateEnvironmentBoundary(environment, {
    allowWrite: apply,
  });
  if (
    !boundary.ok ||
    boundary.runtimeEnvironment !== "staging" ||
    boundary.appProduction ||
    !boundary.productionProjectIdentified ||
    boundary.supabaseProductionMatch ||
    !boundary.supabaseTargetRefMatchesUrl
  ) {
    fail("environment_invalid");
  }
  if (
    apply &&
    (clean(environment.FANMIND_AI_TIER_STRIPE_EVENT_LEDGER_CONFIRM) !==
      APPLY_CONFIRMATION ||
      clean(environment.FANMIND_NON_PRODUCTION_WRITE_ACK) !==
        NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT)
  ) {
    fail("apply_confirmation_invalid");
  }

  const githubSha = clean(environment.GITHUB_SHA).toLowerCase();
  const reviewedCommit = clean(
    environment.FANMIND_AI_TIER_STRIPE_EVENT_LEDGER_REVIEWED_COMMIT,
  ).toLowerCase();
  const appOrigin = strictOrigin(environment.NEXT_PUBLIC_APP_URL);
  const targetApiOrigin = strictOrigin(environment.FANMIND_TARGET_API_ORIGIN);
  const productionApiOrigin = strictOrigin(
    environment.FANMIND_PRODUCTION_API_ORIGIN,
  );
  const host = normalizedHost(environment.PGHOST);
  const targetHost = normalizedHost(environment.FANMIND_TARGET_DB_HOST);
  const productionHost = normalizedHost(
    environment.FANMIND_PRODUCTION_DB_HOST,
  );
  const targetReference = clean(
    environment.FANMIND_TARGET_SUPABASE_PROJECT_REF,
  ).toLowerCase();
  const productionReference = clean(
    environment.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF,
  ).toLowerCase();
  const port = clean(environment.PGPORT);
  const database = clean(environment.PGDATABASE);
  const user = clean(environment.PGUSER).toLowerCase();
  const tlsRootCertificate = clean(environment.PGSSLROOTCERT);
  if (
    clean(environment.GITHUB_REF) !== "refs/heads/main" ||
    !COMMIT_PATTERN.test(githubSha) ||
    !COMMIT_PATTERN.test(reviewedCommit) ||
    githubSha !== reviewedCommit ||
    !appOrigin ||
    !targetApiOrigin ||
    !productionApiOrigin ||
    appOrigin !== targetApiOrigin ||
    targetApiOrigin === productionApiOrigin ||
    !host ||
    !targetHost ||
    host !== targetHost ||
    !host.endsWith(".pooler.supabase.com") ||
    !productionHost ||
    host === productionHost ||
    port !== "5432" ||
    !DATABASE_IDENTITY_PATTERN.test(database) ||
    !DATABASE_IDENTITY_PATTERN.test(user) ||
    user !== `postgres.${targetReference}` ||
    user === `postgres.${productionReference}` ||
    clean(environment.PGSSLMODE).toLowerCase() !== "verify-full" ||
    !tlsRootCertificate ||
    !isAbsolute(tlsRootCertificate)
  ) {
    fail("database_binding_invalid");
  }
  for (const redirect of [
    "DATABASE_URL",
    "POSTGRES_URL",
    "SUPABASE_DB_URL",
    "PGPASSWORD",
    "PGHOSTADDR",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR",
    "PGSSLCERT",
    "PGSSLKEY",
    "PGSSLPASSWORD",
    "PGSSLCRL",
    "PGSSLCRLDIR",
  ]) {
    if (clean(environment[redirect])) fail("database_redirect_invalid");
  }
}

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
        descriptor,
        content,
        offset,
        content.length - offset,
        offset,
      );
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
    snapshotDirectory = mkdtempSync(join(tmpdir(), "fanmind-ai-tier-ledger-"));
    const snapshotPath = join(snapshotDirectory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { snapshotDirectory, snapshotPath };
  } catch (error) {
    if (snapshotDirectory) {
      rmSync(snapshotDirectory, { recursive: true, force: true });
    }
    if (
      error instanceof Error &&
      error.message.startsWith("AI_TIER_STRIPE_EVENT_LEDGER_ERROR=")
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
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function psqlEnvironment(environment, passfilePath) {
  const safe = {
    ...environment,
    PGPASSFILE: passfilePath,
    PGCONNECT_TIMEOUT: "10",
    PGSSLMODE: "verify-full",
    PGGSSENCMODE: "disable",
  };
  for (const key of [
    "DATABASE_URL",
    "POSTGRES_URL",
    "SUPABASE_DB_URL",
    "PGPASSWORD",
    "PGHOSTADDR",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR",
    "PGSSLCERT",
    "PGSSLKEY",
    "PGSSLPASSWORD",
    "PGSSLCRL",
    "PGSSLCRLDIR",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
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
  console.log("AI_TIER_STRIPE_EVENT_LEDGER_PSQL=available");
}

function runDatabaseMode(mode, sql, environment) {
  evaluateTarget(environment, mode);
  ensurePsqlAvailable();
  const { snapshotDirectory, snapshotPath } =
    privatePassfileSnapshot(environment);
  try {
    if (mode === "--apply") {
      const apply = runPsql(sql, environment, snapshotPath);
      if (apply.error || apply.status !== 0) fail("apply_failed");
      console.log("AI_TIER_STRIPE_EVENT_LEDGER_APPLY=completed");
    } else {
      console.log("AI_TIER_STRIPE_EVENT_LEDGER_APPLY=not_requested");
    }
    const postflight = runPsql(POSTFLIGHT_SQL, environment, snapshotPath);
    const postflightLines = String(postflight.stdout ?? "")
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);
    if (
      postflight.error ||
      postflight.status !== 0 ||
      postflightLines.length !== 1 ||
      postflightLines[0] !== "AI_TIER_STRIPE_EVENT_LEDGER_POSTFLIGHT=PASS"
    ) {
      fail("postflight_failed");
    }
    console.log("AI_TIER_STRIPE_EVENT_LEDGER_POSTFLIGHT=PASS");
    console.log("AI_TIER_STRIPE_EVENT_LEDGER_POSTFLIGHT_TRANSACTION=ROLLED_BACK");
    console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  const sql = readAndVerifyControl();
  if (mode === "--check") {
    console.log("AI_TIER_STRIPE_EVENT_LEDGER_MODE=check");
    console.log("AI_TIER_STRIPE_EVENT_LEDGER_READY=YES");
    return;
  }
  console.log(
    `AI_TIER_STRIPE_EVENT_LEDGER_MODE=${mode === "--apply" ? "apply" : "verify"}`,
  );
  runDatabaseMode(mode, sql, process.env);
  console.log("AI_TIER_STRIPE_EVENT_LEDGER_READY=YES");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    if (
      error instanceof Error &&
      /^AI_TIER_STRIPE_EVENT_LEDGER_ERROR=[a-z0-9_]+$/u.test(error.message)
    ) {
      console.error(error.message);
    } else {
      console.error("AI_TIER_STRIPE_EVENT_LEDGER_ERROR=unexpected_failure");
    }
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  });
}

export {
  APPLY_CONFIRMATION,
  CONTROL_ID,
  EXPECTED_CONTROL_SHA256,
  POSTFLIGHT_SQL,
};
