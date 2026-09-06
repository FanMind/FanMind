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

const CONTROL_ID = "20260816210000_workspace_stripe_billing_event_ledger";
const CONTROL_PATH = resolve(
  process.cwd(),
  `supabase/controlled/${CONTROL_ID}.sql`,
);
const EXPECTED_CONTROL_SHA256 =
  "2df73a07d9358d1465e900594eceb31123b7b5655e956c45a230386b895137cb";
const APPLY_CONFIRMATION = "apply-stripe-billing-event-ledger";
const MAX_PASSFILE_BYTES = 64 * 1024;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;
const DATABASE_IDENTITY_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/u;
const HOST_PATTERN =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u;

const SCHEMA_VERIFIER_BODY_PLACEHOLDER = "__FANMIND_SCHEMA_VERIFIER_BODY_BASE64__";
const SCHEMA_REFERENCE_DDL_PLACEHOLDER = "__FANMIND_SCHEMA_REFERENCE_DDL__";
const SCHEMA_REFERENCE_BEGIN =
  "-- FANMIND_STRIPE_BILLING_SCHEMA_REFERENCE_BEGIN";
const SCHEMA_REFERENCE_END =
  "-- FANMIND_STRIPE_BILLING_SCHEMA_REFERENCE_END";

const POSTFLIGHT_SQL_TEMPLATE = String.raw`
\set ON_ERROR_STOP on
${SCHEMA_REFERENCE_DDL_PLACEHOLDER}

begin;
set transaction read only;

do $verify_schema_body$
declare
  v_body_base64 text;
begin
  select replace(replace(
           encode(convert_to(definition.prosrc, 'UTF8'), 'base64'),
           E'\n', ''), E'\r', '')
    into v_body_base64
    from pg_proc as definition
   where definition.oid = to_regprocedure(
     'public.verify_workspace_stripe_billing_ledger_schema()'
   )
     and definition.proowner = (
       select oid from pg_roles where rolname = session_user
     )
     and definition.proowner <> (
       select oid from pg_roles where rolname = 'service_role'
     );
  if v_body_base64 is distinct from
     '${SCHEMA_VERIFIER_BODY_PLACEHOLDER}' then
    raise exception 'stripe_billing_ledger_schema_verifier_drift';
  end if;
  perform public.verify_workspace_stripe_billing_ledger_schema();
end
$verify_schema_body$;

do $verify$
declare
  v_table regclass;
  v_function regprocedure;
  v_helper regprocedure;
begin
  foreach v_table in array array[
    'public.workspace_stripe_billing_streams'::regclass,
    'public.workspace_stripe_billing_object_bindings'::regclass,
    'public.workspace_stripe_billing_reconciliations'::regclass,
    'public.workspace_stripe_billing_events'::regclass
  ] loop
    if not exists (
      select 1 from pg_class
       where oid = v_table and relkind = 'r'
         and relrowsecurity and relforcerowsecurity
    ) or exists (select 1 from pg_policy where polrelid = v_table) then
      raise exception 'stripe_billing_ledger_rls_invalid';
    end if;
    if has_table_privilege(
      'anon', v_table,
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ) or has_table_privilege(
      'authenticated', v_table,
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ) or has_table_privilege(
      'service_role', v_table,
      'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
    ) then
      raise exception 'stripe_billing_ledger_table_privilege_invalid';
    end if;
  end loop;

  foreach v_function in array array[
    'public.apply_workspace_stripe_billing_event(boolean,boolean,text,bigint,text,text,text,uuid,boolean,text,text,text,text,text,text,text,text,text,text,jsonb)'::regprocedure,
    'public.reconcile_workspace_stripe_billing_projection(uuid,text,text,timestamp with time zone,text,bigint,text,text,jsonb,text[],jsonb)'::regprocedure
  ] loop
    if not exists (
      select 1 from pg_proc
       where oid = v_function and prosecdef
         and proowner = (
           select oid from pg_roles where rolname = session_user
         )
         and proowner <> (
           select oid from pg_roles where rolname = 'service_role'
         )
         and proconfig @> array['search_path=pg_catalog, public, pg_temp']
    ) or has_function_privilege('anon', v_function, 'EXECUTE')
      or has_function_privilege('authenticated', v_function, 'EXECUTE')
      or not has_function_privilege('service_role', v_function, 'EXECUTE')
      or exists (
        select 1 from pg_proc as definition
        cross join lateral aclexplode(
          coalesce(definition.proacl, acldefault('f', definition.proowner))
        ) as acl
        where definition.oid = v_function
          and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
      ) or exists (
        select 1 from pg_proc as definition
        cross join lateral aclexplode(
          coalesce(definition.proacl, acldefault('f', definition.proowner))
        ) as acl
        where definition.oid = v_function
          and acl.grantee = (
            select oid from pg_roles where rolname = 'service_role'
          )
          and acl.privilege_type = 'EXECUTE'
          and acl.is_grantable
      ) then
      raise exception 'stripe_billing_ledger_function_invalid';
    end if;
  end loop;

  foreach v_helper in array array[
    'public.workspace_stripe_billing_projection_valid(jsonb)'::regprocedure,
    'public.apply_workspace_stripe_billing_projection(uuid,jsonb)'::regprocedure,
    'public.mark_workspace_stripe_billing_reconciliation(uuid)'::regprocedure
  ] loop
    if not exists (
         select 1 from pg_proc
          where oid = v_helper
            and proowner = (
              select oid from pg_roles where rolname = session_user
            )
            and proowner <> (
              select oid from pg_roles where rolname = 'service_role'
            )
       )
       or has_function_privilege('anon', v_helper, 'EXECUTE')
       or has_function_privilege('authenticated', v_helper, 'EXECUTE')
       or has_function_privilege('service_role', v_helper, 'EXECUTE')
       or exists (
         select 1 from pg_proc as definition
         cross join lateral aclexplode(
           coalesce(definition.proacl, acldefault('f', definition.proowner))
         ) as acl
         where definition.oid = v_helper
           and acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
       ) then
      raise exception 'stripe_billing_ledger_helper_privilege_invalid';
    end if;
  end loop;

  if (
    select count(*) from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
     where namespace.nspname = 'public'
       and relation.relname in (
       'workspace_stripe_billing_object_workspace_idx',
       'workspace_stripe_billing_reconciliation_workspace_idx',
       'workspace_stripe_billing_event_workspace_order_idx',
       'workspace_stripe_billing_event_pending_idx'
     ) and relation.relkind = 'i'
  ) <> 4 then
    raise exception 'stripe_billing_ledger_index_invalid';
  end if;

  if exists (
    select 1 from public.workspaces as workspace
     where workspace.stripe_customer_id is not null
       and (
         not exists (
           select 1 from public.workspace_stripe_billing_streams as stream
            where stream.workspace_id = workspace.id
              and stream.event_stream = 'lifecycle'
         )
         or not exists (
           select 1
             from public.workspace_stripe_billing_object_bindings as binding
            where binding.stripe_object_type = 'customer'
              and binding.stripe_object_id = workspace.stripe_customer_id
              and binding.workspace_id = workspace.id
         )
       )
  ) then
    raise exception 'stripe_billing_ledger_seed_incomplete';
  end if;

  if exists (
    select 1 from public.workspaces
     where stripe_customer_id is not null
     group by stripe_customer_id having count(*) > 1
  ) or exists (
    select 1 from public.workspace_stripe_billing_object_bindings
     group by stripe_object_type, stripe_object_id
    having count(distinct workspace_id) > 1
  ) then
    raise exception 'stripe_billing_ledger_binding_collision';
  end if;
end
$verify$;

select 'STRIPE_BILLING_EVENT_LEDGER_POSTFLIGHT=PASS';
select 'STRIPE_BILLING_EVENT_LEDGER_CUTOVER_PENDING='
       || count(*)::text
  from public.workspace_stripe_billing_streams
 where sync_state = 'reconciliation_needed';
select 'STRIPE_BILLING_EVENT_LEDGER_CUTOVER_UNINVENTORIED='
       || count(*)::text
  from public.workspaces as workspace
 where (
       workspace.stripe_customer_id is not null
       or workspace.stripe_subscription_id is not null
       or workspace.stripe_checkout_session_id is not null
       or workspace.stripe_payment_intent_id is not null
       or workspace.last_invoice_id is not null
     )
   and (
       workspace.stripe_customer_id is null
       or not exists (
         select 1
           from public.workspace_stripe_billing_streams as stream
          where stream.workspace_id = workspace.id
            and stream.event_stream = 'lifecycle'
       )
       or not exists (
         select 1
           from public.workspace_stripe_billing_object_bindings as binding
          where binding.workspace_id = workspace.id
            and binding.stripe_object_type = 'customer'
            and binding.stripe_object_id = workspace.stripe_customer_id
       )
       or (
         workspace.stripe_subscription_id is not null
         and not exists (
           select 1
             from public.workspace_stripe_billing_object_bindings as binding
            where binding.workspace_id = workspace.id
              and binding.stripe_object_type = 'subscription'
              and binding.stripe_object_id = workspace.stripe_subscription_id
         )
       )
       or (
         workspace.stripe_checkout_session_id is not null
         and not exists (
           select 1
             from public.workspace_stripe_billing_object_bindings as binding
            where binding.workspace_id = workspace.id
              and binding.stripe_object_type = 'checkout_session'
              and binding.stripe_object_id = workspace.stripe_checkout_session_id
         )
       )
       or (
         workspace.stripe_payment_intent_id is not null
         and not exists (
           select 1
             from public.workspace_stripe_billing_object_bindings as binding
            where binding.workspace_id = workspace.id
              and binding.stripe_object_type = 'payment_intent'
              and binding.stripe_object_id = workspace.stripe_payment_intent_id
         )
       )
       or (
         workspace.last_invoice_id is not null
         and not exists (
           select 1
             from public.workspace_stripe_billing_object_bindings as binding
            where binding.workspace_id = workspace.id
              and binding.stripe_object_type = 'invoice'
              and binding.stripe_object_id = workspace.last_invoice_id
         )
       )
     );
rollback;
`;

export function materializeStripeBillingEventLedgerPostflight(sql) {
  if (typeof sql !== "string") fail("control_unreadable");
  const verifierMatch =
    /create function public\.verify_workspace_stripe_billing_ledger_schema\(\)[\s\S]*?as \$schema_verify\$(?<body>[\s\S]*?)\$schema_verify\$;/iu.exec(
      sql,
    );
  if (!verifierMatch?.groups?.body) fail("schema_verifier_contract_invalid");
  const encoded = Buffer.from(verifierMatch.groups.body, "utf8").toString(
    "base64",
  );
  if (!encoded || encoded.includes("\n") || encoded.includes("\r")) {
    fail("schema_verifier_contract_invalid");
  }
  const referencePattern = new RegExp(
    `${SCHEMA_REFERENCE_BEGIN.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*` +
      `(?<ddl>[\\s\\S]*?)\\s*${SCHEMA_REFERENCE_END.replace(
        /[.*+?^${}()|[\]\\]/gu,
        "\\$&",
      )}`,
    "u",
  );
  const referenceMatches = [...sql.matchAll(new RegExp(referencePattern, "gu"))];
  const referenceDdl = referenceMatches[0]?.groups?.ddl?.trim() ?? "";
  const referenceStatements = referenceDdl
    .replace(/^\s*--.*$/gmu, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  if (
    referenceMatches.length !== 1 ||
    referenceStatements.length !== 9 ||
    /\bpublic\s*[.]|\\[a-z]/iu.test(referenceDdl) ||
    referenceStatements.some(
      (statement) =>
        !/^(?:create temporary table fanmind_expected_[a-z0-9_]+\s*\(|create index workspace_stripe_billing_[a-z0-9_]+\s+on fanmind_expected_[a-z0-9_]+\s*\()/iu.test(
          statement,
        ),
    )
  ) {
    fail("schema_reference_contract_invalid");
  }
  return POSTFLIGHT_SQL_TEMPLATE.replace(
    SCHEMA_REFERENCE_DDL_PLACEHOLDER,
    () => referenceDdl,
  ).replace(SCHEMA_VERIFIER_BODY_PLACEHOLDER, () => encoded);
}

const POSTFLIGHT_SQL = POSTFLIGHT_SQL_TEMPLATE;

function fail(code) {
  throw new Error(`STRIPE_BILLING_EVENT_LEDGER_ERROR=${code}`);
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

export function evaluateStripeBillingEventLedgerSql(sql) {
  if (typeof sql !== "string") fail("control_unreadable");
  const digest = createHash("sha256").update(sql).digest("hex");
  if (digest !== EXPECTED_CONTROL_SHA256) fail("control_checksum_mismatch");
  const required = [
    /^begin;/iu,
    /create table public\.workspace_stripe_billing_streams/iu,
    /create table public\.workspace_stripe_billing_object_bindings/iu,
    /create table public\.workspace_stripe_billing_reconciliations/iu,
    /create table public\.workspace_stripe_billing_events/iu,
    /create function public\.apply_workspace_stripe_billing_event/iu,
    /create function public\.reconcile_workspace_stripe_billing_projection/iu,
    /create function public\.verify_workspace_stripe_billing_ledger_schema/iu,
    /FANMIND_STRIPE_BILLING_SCHEMA_REFERENCE_BEGIN[\s\S]*FANMIND_STRIPE_BILLING_SCHEMA_REFERENCE_END/iu,
    /stripe_billing_ledger_columns_invalid[\s\S]*stripe_billing_ledger_constraints_invalid[\s\S]*stripe_billing_ledger_constraint_source_hash_invalid[\s\S]*stripe_billing_ledger_indexes_invalid[\s\S]*stripe_billing_ledger_index_source_hash_invalid/iu,
    /stripe_billing_ledger_function_body_drift/iu,
    /acl\.privilege_type = 'EXECUTE'[\s\S]*not acl\.is_grantable/iu,
    /select public\.verify_workspace_stripe_billing_ledger_schema\(\);/iu,
    /p_event_created_at = v_stream\.last_event_created_at[\s\S]*event_order_conflict/iu,
    /v_stream_bootstrap_allowed[\s\S]*p_binding_mode = 'checkout'[\s\S]*v_workspace\.stripe_customer_id is null[\s\S]*workspace_stripe_billing_object_bindings[\s\S]*case when v_stream_bootstrap_allowed then 'in_sync'/iu,
    /fanmind-stripe-billing:[\s\S]*pg_advisory_xact_lock/iu,
    /processing_state = 'unresolved'/iu,
    /if not p_projection_enabled then[\s\S]*reconciliation_pending/iu,
    /elsif v_prior_pending then[\s\S]*reconciliation_pending/iu,
    /reconciled_event/iu,
    /workspace_stripe_billing_tax_projection_invalid/iu,
    /projection_revision = projection_revision \+ 1/iu,
    /force row level security/iu,
    /'reconciliation_needed', 'controlled_cutover'/iu,
    /commit;\s*$/iu,
  ];
  const forbidden = [
    /^\s*truncate\s+(?:table\s+)?/imu,
    /\bdrop\s+(?:table|schema|database)\b/iu,
    /create\s+policy/iu,
    /p_event_id\s*(?:<|>|<=|>=)/iu,
    /raw_(?:body|payload)|request_body/iu,
    /https:\/\/api\.stripe\.com|net\.http|http_post/iu,
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
  const evaluated = evaluateStripeBillingEventLedgerSql(sql);
  console.log(`STRIPE_BILLING_EVENT_LEDGER_ID=${evaluated.controlId}`);
  console.log("STRIPE_BILLING_EVENT_LEDGER_CHECKSUM=verified");
  console.log("STRIPE_BILLING_EVENT_LEDGER_CONTRACT=verified");
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
    (clean(environment.FANMIND_STRIPE_BILLING_EVENT_LEDGER_CONFIRM) !==
      APPLY_CONFIRMATION ||
      clean(environment.FANMIND_NON_PRODUCTION_WRITE_ACK) !==
        NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT)
  ) {
    fail("apply_confirmation_invalid");
  }

  const githubSha = clean(environment.GITHUB_SHA).toLowerCase();
  const reviewedCommit = clean(
    environment.FANMIND_STRIPE_BILLING_EVENT_LEDGER_REVIEWED_COMMIT,
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
      !opened.isFile() || (opened.mode & 0o777) !== 0o600 ||
      opened.size < 1 || opened.size > MAX_PASSFILE_BYTES ||
      (typeof process.getuid === "function" && opened.uid !== process.getuid())
    ) {
      fail("passfile_invalid");
    }
    content = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < content.length) {
      const bytesRead = readSync(
        descriptor, content, offset, content.length - offset, offset,
      );
      if (bytesRead === 0) fail("passfile_read_failed");
      offset += bytesRead;
    }
    const settled = fstatSync(descriptor);
    if (
      settled.dev !== opened.dev || settled.ino !== opened.ino ||
      settled.size !== opened.size || settled.mtimeMs !== opened.mtimeMs ||
      settled.ctimeMs !== opened.ctimeMs
    ) {
      fail("passfile_changed");
    }
    snapshotDirectory = mkdtempSync(join(tmpdir(), "fanmind-billing-ledger-"));
    const snapshotPath = join(snapshotDirectory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { snapshotDirectory, snapshotPath };
  } catch (error) {
    if (snapshotDirectory) rmSync(snapshotDirectory, { recursive: true, force: true });
    if (
      error instanceof Error &&
      error.message.startsWith("STRIPE_BILLING_EVENT_LEDGER_ERROR=")
    ) throw error;
    if (error && typeof error === "object" && error.code === "ELOOP") {
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
  ]) delete safe[key];
  return safe;
}

function runPsql(input, environment, passfilePath) {
  return spawnSync(
    "psql",
    [
      "--no-password", "--no-psqlrc", "--quiet", "--quiet",
      "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1",
      "--set=VERBOSITY=verbose",
    ],
    {
      env: psqlEnvironment(environment, passfilePath),
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}

export function billingDatabaseFailureDiagnostic(stderr, sql) {
  const message = String(stderr ?? "");
  const match = /(?:^|\n)(?:psql:[^\r\n]*?:[0-9]+: )?ERROR:\s+([0-9A-Z]{5}):\s+([^\r\n]*)/u.exec(message);
  const code = match?.[1] ?? "unknown";
  const allowed = new Set([...sql.matchAll(/(?:message\s*=\s*|raise\s+exception\s+)'([a-z0-9_]+)'/giu)].map(m => m[1]));
  const reason = allowed.has(match?.[2]) ? match[2] : "database_rejected";
  return { code, reason };
}

export function verifyStagingBillingCaptureRecord(runId, present, environment = process.env) {
  if (!/^[0-9]{1,20}$/u.test(runId ?? "") || typeof present !== "boolean") fail("capture_record_invalid");
  evaluateTarget(environment, "--verify");
  const { snapshotDirectory, snapshotPath } = privatePassfileSnapshot(environment);
  try {
    const predicate = present
      ? `count(*) = 1 and count(*) filter (where workspace_id is null and stripe_customer_id is null and stripe_subscription_id is null and event_type = 'checkout.session.completed' and processing_state = 'unresolved' and processing_reason = 'tenant_binding_missing' and projection_revision = 0) = 1`
      : "count(*) = 0";
    const sql = String.raw`\set ON_ERROR_STOP on
begin;
set transaction read only;
select case when ${predicate} then 'CAPTURE_RECORD_PASS' else 'CAPTURE_RECORD_FAIL' end
from public.workspace_stripe_billing_events where event_id = 'evt_fanmind_capture_${runId}';
rollback;
`;
    const result = runPsql(sql, environment, snapshotPath);
    if (result.error || result.status !== 0 || String(result.stdout).trim() !== "CAPTURE_RECORD_PASS") fail("capture_record_invalid");
    console.log(present ? "STAGING_BILLING_SIGNED_DURABLE_CAPTURE=PASS" : "STAGING_BILLING_CAPTURE_ABSENCE=PASS");
  } finally { rmSync(snapshotDirectory, { recursive: true, force: true }); }
}

function ensurePsqlAvailable() {
  const result = spawnSync("psql", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (result.error || result.status !== 0) fail("psql_unavailable");
  console.log("STRIPE_BILLING_EVENT_LEDGER_PSQL=available");
}

function runDatabaseMode(mode, sql, environment) {
  evaluateTarget(environment, mode);
  ensurePsqlAvailable();
  const { snapshotDirectory, snapshotPath } =
    privatePassfileSnapshot(environment);
  try {
    if (mode === "--apply") {
      const apply = runPsql(sql, environment, snapshotPath);
      if (apply.error || apply.status !== 0) {
        const diagnostic = billingDatabaseFailureDiagnostic(apply.stderr, sql);
        console.error(`STRIPE_BILLING_EVENT_LEDGER_SQLSTATE=${diagnostic.code}`);
        console.error(`STRIPE_BILLING_EVENT_LEDGER_FAILURE_CLASS=${diagnostic.reason}`);
        fail("apply_failed");
      }
      console.log("STRIPE_BILLING_EVENT_LEDGER_APPLY=completed");
    } else {
      console.log("STRIPE_BILLING_EVENT_LEDGER_APPLY=not_requested");
    }
    const postflightSql = materializeStripeBillingEventLedgerPostflight(sql);
    const postflight = runPsql(postflightSql, environment, snapshotPath);
    const postflightLines = String(postflight.stdout ?? "")
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);
    if (
      postflight.error || postflight.status !== 0 ||
      postflightLines.length !== 3 ||
      postflightLines[0] !== "STRIPE_BILLING_EVENT_LEDGER_POSTFLIGHT=PASS" ||
      !/^STRIPE_BILLING_EVENT_LEDGER_CUTOVER_PENDING=\d+$/u.test(
        postflightLines[1],
      ) ||
      !/^STRIPE_BILLING_EVENT_LEDGER_CUTOVER_UNINVENTORIED=\d+$/u.test(
        postflightLines[2],
      )
    ) {
      const diagnostic = billingDatabaseFailureDiagnostic(postflight.stderr, sql + postflightSql);
      console.error(`STRIPE_BILLING_EVENT_LEDGER_SQLSTATE=${diagnostic.code}`);
      console.error(`STRIPE_BILLING_EVENT_LEDGER_FAILURE_CLASS=${diagnostic.reason}`);
      fail("postflight_failed");
    }
    process.stdout.write(`${postflightLines.join("\n")}\n`);
    console.log("STRIPE_BILLING_EVENT_LEDGER_POSTFLIGHT_TRANSACTION=ROLLED_BACK");
    console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  const sql = readAndVerifyControl();
  if (mode === "--check") {
    console.log("STRIPE_BILLING_EVENT_LEDGER_MODE=check");
    console.log("STRIPE_BILLING_EVENT_LEDGER_READY=YES");
    return;
  }
  console.log(
    `STRIPE_BILLING_EVENT_LEDGER_MODE=${mode === "--apply" ? "apply" : "verify"}`,
  );
  runDatabaseMode(mode, sql, process.env);
  console.log("STRIPE_BILLING_EVENT_LEDGER_READY=YES");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    if (
      error instanceof Error &&
      /^STRIPE_BILLING_EVENT_LEDGER_ERROR=[a-z0-9_]+$/u.test(error.message)
    ) console.error(error.message);
    else console.error("STRIPE_BILLING_EVENT_LEDGER_ERROR=unexpected_failure");
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  });
}

export {
  APPLY_CONFIRMATION,
  CONTROL_ID,
  CONTROL_PATH,
  EXPECTED_CONTROL_SHA256,
  POSTFLIGHT_SQL,
};
