#!/usr/bin/env node

import {
  closeSync,
  constants,
  fstatSync,
  mkdtempSync,
  openSync,
  readSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  buildAiTierSyntheticLifecycleProof,
  evaluateAiTierStagingAcceptanceEnvironment,
  evaluateAiTierStagingResourceEnvironment,
  isAiTierStagingWorkspaceId,
  validateAiTierStripeTestPrice,
} from "../../src/lib/aiTierStagingAcceptancePolicy.mjs";

const MAX_PASSFILE_BYTES = 64 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DB_IDENTITY_PATTERN = /^[A-Za-z0-9_.-]{1,128}$/u;
const HOST_PATTERN =
  /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u;
const STRIPE_ID_PATTERN = /^(?:evt|sub|si|price)_[A-Za-z0-9_]+$/u;

function fail(code) {
  throw new Error(`AI_TIER_STAGING_ACCEPTANCE_ERROR=${code}`);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function modeFromArguments(argumentsList) {
  const known = new Set(["--check", "--preflight", "--run"]);
  if (argumentsList.some((argument) => !known.has(argument))) {
    fail("argument_invalid");
  }
  const selected = argumentsList.filter((argument) => known.has(argument));
  if (selected.length > 1) fail("mode_ambiguous");
  return selected[0] ?? "--check";
}

function workspaceResourceSql(workspaceId) {
  const workspace = sqlString(workspaceId, UUID_PATTERN);
  return String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
select concat(
  workspace.owner_user_id::text,
  ':',
  (
    select member.user_id::text
      from public.workspace_members as member
     where member.workspace_id = workspace.id
       and member.role = 'member'
     order by member.created_at, member.user_id
     limit 1
  )
)
from public.workspaces as workspace
where workspace.id = ${workspace};
rollback;
`;
}

function parseWorkspaceResourcePrincipals(output) {
  const candidate = clean(output);
  const match = /^([0-9a-f-]{36}):([0-9a-f-]{36})$/u.exec(candidate);
  if (
    !match ||
    !UUID_PATTERN.test(match[1]) ||
    !UUID_PATTERN.test(match[2]) ||
    match[1] === match[2]
  ) {
    fail("synthetic_workspace_state");
  }
}

function normalizedHost(value) {
  const candidate = clean(value).toLowerCase().replace(/\.$/u, "");
  return HOST_PATTERN.test(candidate) ? candidate : "";
}

function requireDatabaseTarget(environment) {
  const pgHost = normalizedHost(environment.PGHOST);
  const expectedHost = normalizedHost(environment.FANMIND_TARGET_DB_HOST);
  const pgPort = clean(environment.PGPORT);
  const pgDatabase = clean(environment.PGDATABASE);
  const pgUser = clean(environment.PGUSER);
  if (!pgHost || !expectedHost || pgHost !== expectedHost) {
    fail("database_host_binding");
  }
  if (
    !/^[0-9]{1,5}$/u.test(pgPort) ||
    Number(pgPort) < 1 ||
    Number(pgPort) > 65_535 ||
    !DB_IDENTITY_PATTERN.test(pgDatabase) ||
    !DB_IDENTITY_PATTERN.test(pgUser)
  ) {
    fail("database_identity");
  }
  for (const redirect of [
    "PGHOSTADDR",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR",
  ]) {
    if (clean(environment[redirect])) fail("libpq_redirect");
  }
  console.log("AI_TIER_STAGING_DATABASE_BINDING=verified");
}

function privatePassfileSnapshot(environment) {
  const sourcePath = clean(environment.PGPASSFILE);
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
      if (bytesRead === 0) fail("passfile_read");
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
      join(tmpdir(), "fanmind-ai-tier-staging-"),
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
      error.message.startsWith("AI_TIER_STAGING_ACCEPTANCE_ERROR=")
    ) {
      throw error;
    }
    fail("passfile_read");
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

function runPsql(sql, environment, passfilePath) {
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
      input: sql,
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
  console.log("AI_TIER_STAGING_PSQL=available");
}

function sqlString(value, pattern) {
  if (!pattern.test(value)) fail("synthetic_contract");
  return `'${value}'`;
}

function workspacePrincipalSql(workspaceId) {
  const workspace = sqlString(workspaceId, UUID_PATTERN);
  return String.raw`
\set ON_ERROR_STOP on
select concat(
  workspace.owner_user_id::text,
  ':',
  (
    select member.user_id::text
      from public.workspace_members as member
     where member.workspace_id = workspace.id
       and member.role = 'member'
     order by member.created_at, member.user_id
     limit 1
  ),
  ':',
  case when exists (
    select 1
      from public.workspace_ai_tier_entitlements as entitlement
     where entitlement.workspace_id = workspace.id
  ) then 'occupied' else 'empty' end
)
from public.workspaces as workspace
where workspace.id = ${workspace};
`;
}

function parseWorkspacePrincipals(output) {
  const candidate = clean(output);
  const match =
    /^([0-9a-f-]{36}):([0-9a-f-]{36}):(empty|occupied)$/u.exec(candidate);
  if (
    !match ||
    !UUID_PATTERN.test(match[1]) ||
    !UUID_PATTERN.test(match[2]) ||
    match[1] === match[2] ||
    match[3] !== "empty"
  ) {
    fail("synthetic_workspace_state");
  }
  return { ownerId: match[1], memberId: match[2] };
}

function authenticatedProbeSql({
  operation,
  workspaceId,
  userId,
  mutation,
}) {
  const workspace = sqlString(workspaceId, UUID_PATTERN);
  const user = sqlString(userId, UUID_PATTERN);
  const subscription = sqlString(
    mutation.stripeSubscriptionId,
    STRIPE_ID_PATTERN,
  );
  const item = sqlString(
    mutation.stripeSubscriptionItemId,
    STRIPE_ID_PATTERN,
  );
  const price = sqlString(mutation.stripePriceId, STRIPE_ID_PATTERN);
  const event = sqlString(mutation.lastStripeEventId, STRIPE_ID_PATTERN);
  const statements = {
    select: `select workspace_id from public.workspace_ai_tier_entitlements where workspace_id = ${workspace};`,
    insert: `insert into public.workspace_ai_tier_entitlements (workspace_id, tier_id, status, source, stripe_subscription_id, stripe_subscription_item_id, stripe_price_id, effective_at, expires_at, last_stripe_event_id, last_stripe_event_created_at) values (${workspace}, 'plus', 'active', 'stripe', ${subscription}, ${item}, ${price}, '${mutation.effectiveAt}'::timestamptz, null, ${event}, ${mutation.lastStripeEventCreatedAt});`,
    update: `update public.workspace_ai_tier_entitlements set tier_id = 'ultra' where workspace_id = ${workspace};`,
    delete: `delete from public.workspace_ai_tier_entitlements where workspace_id = ${workspace};`,
  };
  const statement = statements[operation];
  if (!statement) fail("browser_probe_operation");
  return String.raw`
\set ON_ERROR_STOP on
begin;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', ${user}, 'role', 'authenticated')::text,
  true
);
set local role authenticated;
${statement}
rollback;
`;
}

function serviceRoleCrudSql(workspaceId, mutation) {
  const workspace = sqlString(workspaceId, UUID_PATTERN);
  const subscription = sqlString(
    mutation.stripeSubscriptionId,
    STRIPE_ID_PATTERN,
  );
  const item = sqlString(
    mutation.stripeSubscriptionItemId,
    STRIPE_ID_PATTERN,
  );
  const price = sqlString(mutation.stripePriceId, STRIPE_ID_PATTERN);
  const event = sqlString(mutation.lastStripeEventId, STRIPE_ID_PATTERN);
  return String.raw`
\set ON_ERROR_STOP on
begin;
set local role service_role;

insert into public.workspace_ai_tier_entitlements (
  workspace_id,
  tier_id,
  status,
  source,
  stripe_subscription_id,
  stripe_subscription_item_id,
  stripe_price_id,
  effective_at,
  expires_at,
  last_stripe_event_id,
  last_stripe_event_created_at
) values (
  ${workspace},
  'plus',
  'active',
  'stripe',
  ${subscription},
  ${item},
  ${price},
  '${mutation.effectiveAt}'::timestamptz,
  null,
  ${event},
  ${mutation.lastStripeEventCreatedAt}
);

do $verify_insert$
begin
  if not exists (
    select 1
      from public.workspace_ai_tier_entitlements
     where workspace_id = ${workspace}
       and tier_id = 'plus'
       and status = 'active'
  ) then
    raise exception 'service_role_insert_failed';
  end if;
end
$verify_insert$;

update public.workspace_ai_tier_entitlements
   set tier_id = 'ultra',
       status = 'paused',
       last_stripe_event_id = 'evt_fanmind_staging_update',
       last_stripe_event_created_at =
         last_stripe_event_created_at + 1
 where workspace_id = ${workspace};

do $verify_update$
begin
  if not exists (
    select 1
      from public.workspace_ai_tier_entitlements
     where workspace_id = ${workspace}
       and tier_id = 'ultra'
       and status = 'paused'
  ) then
    raise exception 'service_role_update_failed';
  end if;
end
$verify_update$;

delete from public.workspace_ai_tier_entitlements
where workspace_id = ${workspace};

do $verify_delete$
begin
  if exists (
    select 1
      from public.workspace_ai_tier_entitlements
     where workspace_id = ${workspace}
  ) then
    raise exception 'service_role_delete_failed';
  end if;
end
$verify_delete$;

rollback;
do $verify_rollback$
begin
  if exists (
    select 1
      from public.workspace_ai_tier_entitlements
     where workspace_id = ${workspace}
  ) then
    raise exception 'service_role_rollback_failed';
  end if;
end
$verify_rollback$;
select 'AI_TIER_STAGING_SERVICE_ROLE_CRUD=PASS';
select 'AI_TIER_STAGING_ROLLBACK=PASS';
`;
}

function ledgerAvailabilitySql() {
  return String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
select case
  when to_regprocedure(
    'public.apply_workspace_ai_tier_stripe_event(uuid,boolean,text,bigint,text,text,text,text,boolean,text,text,text,text,timestamp with time zone,timestamp with time zone)'
  ) is not null then 'ledger'
  else 'legacy'
end;
rollback;
`;
}

function parseLedgerAvailability(output) {
  const mode = clean(output);
  if (mode !== "ledger" && mode !== "legacy") {
    fail("ledger_state");
  }
  return mode;
}

function serviceRoleLedgerSql(workspaceId, mutation, ultraPriceId) {
  const workspace = sqlString(workspaceId, UUID_PATTERN);
  const plusItem = sqlString(
    mutation.stripeSubscriptionItemId,
    STRIPE_ID_PATTERN,
  );
  const plusPrice = sqlString(mutation.stripePriceId, STRIPE_ID_PATTERN);
  const plusEvent = sqlString(
    mutation.lastStripeEventId,
    STRIPE_ID_PATTERN,
  );
  const ultraPrice = sqlString(ultraPriceId, STRIPE_ID_PATTERN);
  const effectiveAt = new Date(mutation.effectiveAt).toISOString();
  const createdAt = mutation.lastStripeEventCreatedAt;
  if (!Number.isSafeInteger(createdAt) || createdAt < 0) {
    fail("synthetic_contract");
  }
  return String.raw`
\set ON_ERROR_STOP on
begin;
-- Bind an unbound synthetic fixture only inside this rolled-back transaction.
-- Existing provider bindings are never replaced.
update public.workspaces
   set stripe_customer_id = 'cus_fanmind_staging_' || replace(${workspace}::text, '-', ''),
       stripe_subscription_id = 'sub_fanmind_staging_' || replace(${workspace}::text, '-', '')
 where id = ${workspace}
   and stripe_customer_id is null
   and stripe_subscription_id is null;
set local role service_role;

do $ledger_acceptance$
declare
  v_customer_id text;
  v_subscription_id text;
  v_result record;
begin
  select workspace.stripe_customer_id, workspace.stripe_subscription_id
    into v_customer_id, v_subscription_id
    from public.workspaces as workspace
   where workspace.id = ${workspace};
  if v_customer_id is null or v_subscription_id is null then
    raise exception 'ledger_acceptance_workspace_binding_missing';
  end if;

  select * into v_result
    from public.apply_workspace_ai_tier_stripe_event(
      ${workspace}, true, ${plusEvent}, ${createdAt},
      'customer.subscription.updated', v_customer_id, v_subscription_id,
      repeat('1', 64), true, 'plus', 'active', ${plusItem},
      ${plusPrice}, '${effectiveAt}'::timestamptz, null
    );
  if v_result.result_status <> 'applied' then
    raise exception 'ledger_acceptance_plus_failed';
  end if;

  select * into v_result
    from public.apply_workspace_ai_tier_stripe_event(
      ${workspace}, true, 'evt_fanmind_staging_ultra', ${createdAt + 1},
      'customer.subscription.updated', v_customer_id, v_subscription_id,
      repeat('2', 64), true, 'ultra', 'paused',
      'si_fanmind_staging_ultra', ${ultraPrice},
      '${effectiveAt}'::timestamptz, null
    );
  if v_result.result_status <> 'applied' then
    raise exception 'ledger_acceptance_ultra_failed';
  end if;

  select * into v_result
    from public.apply_workspace_ai_tier_stripe_event(
      ${workspace}, true, 'evt_fanmind_staging_starter', ${createdAt + 2},
      'customer.subscription.updated', v_customer_id, v_subscription_id,
      repeat('3', 64), false, null, null, null, null, null, null
    );
  if v_result.result_status <> 'applied' then
    raise exception 'ledger_acceptance_starter_failed';
  end if;

  if exists (
    select 1 from public.workspace_ai_tier_entitlements
     where workspace_id = ${workspace}
  ) then
    raise exception 'ledger_acceptance_projection_cleanup_failed';
  end if;
end
$ledger_acceptance$;

rollback;
do $verify_rollback$
begin
  if exists (
    select 1 from public.workspaces where id = ${workspace}
      and stripe_customer_id = 'cus_fanmind_staging_' || replace(${workspace}::text, '-', '')
  ) then
    raise exception 'service_role_fixture_rollback_failed';
  end if;
  if exists (
    select 1 from public.workspace_ai_tier_entitlements
     where workspace_id = ${workspace}
  ) or exists (
    select 1 from public.workspace_ai_tier_stripe_events
     where workspace_id = ${workspace}
       and event_id in (
         ${plusEvent},
         'evt_fanmind_staging_ultra',
         'evt_fanmind_staging_starter'
       )
  ) then
    raise exception 'service_role_rollback_failed';
  end if;
end
$verify_rollback$;
select 'AI_TIER_STAGING_SERVICE_ROLE_LEDGER=PASS';
select 'AI_TIER_STAGING_ROLLBACK=PASS';
`;
}

async function fetchStripePrice(environment, priceId, expectedUnitAmount) {
  const url = new URL(
    `https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`,
  );
  url.searchParams.append("expand[]", "product");
  let response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${environment.STRIPE_SECRET_KEY}`,
      },
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    fail("stripe_catalog_unavailable");
  }
  if (!response.ok) fail("stripe_catalog_unavailable");
  let payload;
  try {
    payload = await response.json();
  } catch {
    fail("stripe_catalog_invalid");
  }
  if (
    !validateAiTierStripeTestPrice(payload, {
      expectedId: priceId,
      expectedUnitAmount,
    })
  ) {
    fail("stripe_catalog_invalid");
  }
}

function runBrowserBoundaryProbes({
  environment,
  passfilePath,
  workspaceId,
  principals,
  mutation,
}) {
  for (const userId of [principals.ownerId, principals.memberId]) {
    for (const operation of ["select", "insert", "update", "delete"]) {
      const probe = runPsql(
        authenticatedProbeSql({
          operation,
          workspaceId,
          userId,
          mutation,
        }),
        environment,
        passfilePath,
      );
      if (probe.error || probe.status === 0) {
        fail("browser_boundary");
      }
    }
  }
  console.log("AI_TIER_STAGING_BROWSER_BOUNDARY=PASS");
}

async function runAcceptance(environment) {
  const evaluation =
    evaluateAiTierStagingAcceptanceEnvironment(environment);
  if (!evaluation.ok) fail("environment_invalid");
  requireDatabaseTarget(environment);
  ensurePsqlAvailable();

  const lifecycle = buildAiTierSyntheticLifecycleProof(environment);
  if (!lifecycle.ok || !lifecycle.mutation) fail("lifecycle_contract");
  console.log("AI_TIER_STAGING_LIFECYCLE=PASS");

  await Promise.all([
    fetchStripePrice(
      environment,
      environment.STRIPE_PRICE_AI_PLUS,
      10_000,
    ),
    fetchStripePrice(
      environment,
      environment.STRIPE_PRICE_AI_ULTRA,
      20_000,
    ),
  ]);
  console.log("AI_TIER_STAGING_STRIPE_CATALOG=PASS");

  const workspaceId = clean(
    environment.FANMIND_AI_TIER_STAGING_WORKSPACE_ID,
  ).toLowerCase();
  if (!isAiTierStagingWorkspaceId(workspaceId)) {
    fail("synthetic_workspace");
  }

  const { snapshotDirectory, snapshotPath } =
    privatePassfileSnapshot(environment);
  try {
    const principalResult = runPsql(
      workspacePrincipalSql(workspaceId),
      environment,
      snapshotPath,
    );
    if (
      principalResult.error ||
      principalResult.status !== 0 ||
      !principalResult.stdout
    ) {
      fail("synthetic_workspace_state");
    }
    const principals = parseWorkspacePrincipals(principalResult.stdout);
    runBrowserBoundaryProbes({
      environment,
      passfilePath: snapshotPath,
      workspaceId,
      principals,
      mutation: lifecycle.mutation,
    });

    const ledgerState = runPsql(
      ledgerAvailabilitySql(),
      environment,
      snapshotPath,
    );
    if (ledgerState.error || ledgerState.status !== 0) {
      fail("ledger_state");
    }
    const ledgerMode = parseLedgerAvailability(ledgerState.stdout);
    const serviceRole = runPsql(
      ledgerMode === "ledger"
        ? serviceRoleLedgerSql(
            workspaceId,
            lifecycle.mutation,
            environment.STRIPE_PRICE_AI_ULTRA,
          )
        : serviceRoleCrudSql(workspaceId, lifecycle.mutation),
      environment,
      snapshotPath,
    );
    if (
      serviceRole.error ||
      serviceRole.status !== 0 ||
      !serviceRole.stdout.includes(
        ledgerMode === "ledger"
          ? "AI_TIER_STAGING_SERVICE_ROLE_LEDGER=PASS"
          : "AI_TIER_STAGING_SERVICE_ROLE_CRUD=PASS",
      ) ||
      !serviceRole.stdout.includes("AI_TIER_STAGING_ROLLBACK=PASS")
    ) {
      fail("service_role_crud");
    }
    console.log(
      ledgerMode === "ledger"
        ? "AI_TIER_STAGING_SERVICE_ROLE_LEDGER=PASS"
        : "AI_TIER_STAGING_SERVICE_ROLE_CRUD=PASS",
    );
    console.log("AI_TIER_STAGING_TRANSACTION=ROLLED_BACK");
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }

  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  console.log("AI_TIER_STAGING_ACCEPTANCE=PASS");
}

async function runResourcePreflight(environment) {
  const evaluation =
    evaluateAiTierStagingResourceEnvironment(environment);
  if (!evaluation.ok) fail("environment_invalid");
  requireDatabaseTarget(environment);
  ensurePsqlAvailable();

  const lifecycle = buildAiTierSyntheticLifecycleProof(environment);
  if (!lifecycle.ok || !lifecycle.mutation) fail("lifecycle_contract");
  console.log("AI_TIER_STAGING_LIFECYCLE=PASS");

  await Promise.all([
    fetchStripePrice(
      environment,
      environment.STRIPE_PRICE_AI_PLUS,
      10_000,
    ),
    fetchStripePrice(
      environment,
      environment.STRIPE_PRICE_AI_ULTRA,
      20_000,
    ),
  ]);
  console.log("AI_TIER_STAGING_STRIPE_CATALOG=PASS");

  const workspaceId = clean(
    environment.FANMIND_AI_TIER_STAGING_WORKSPACE_ID,
  ).toLowerCase();
  if (!isAiTierStagingWorkspaceId(workspaceId)) {
    fail("synthetic_workspace");
  }

  const { snapshotDirectory, snapshotPath } =
    privatePassfileSnapshot(environment);
  try {
    const principalResult = runPsql(
      workspaceResourceSql(workspaceId),
      environment,
      snapshotPath,
    );
    if (
      principalResult.error ||
      principalResult.status !== 0 ||
      !principalResult.stdout
    ) {
      fail("synthetic_workspace_state");
    }
    parseWorkspaceResourcePrincipals(principalResult.stdout);
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }

  console.log("AI_TIER_STAGING_SYNTHETIC_WORKSPACE=PASS");
  console.log("AI_TIER_STAGING_RESOURCE_MODE=READ_ONLY");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  console.log("AI_TIER_STAGING_RESOURCE_READINESS=PASS");
}

async function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  if (mode === "--check") {
    const proof = buildAiTierSyntheticLifecycleProof(
      {
        STRIPE_PRICE_AI_PLUS: "price_fanmind_staging_plus",
        STRIPE_PRICE_AI_ULTRA: "price_fanmind_staging_ultra",
      },
      {
        eventCreatedAt: 1_753_056_000,
        nonce: "0123456789abcdef",
      },
    );
    if (!proof.ok) fail("offline_contract");
    console.log("AI_TIER_STAGING_ACCEPTANCE_MODE=check");
    console.log("AI_TIER_STAGING_ACCEPTANCE_READY=YES");
    return;
  }

  if (mode === "--preflight") {
    console.log("AI_TIER_STAGING_ACCEPTANCE_MODE=preflight");
    await runResourcePreflight(process.env);
    return;
  }

  console.log("AI_TIER_STAGING_ACCEPTANCE_MODE=run");
  await runAcceptance(process.env);
}

main().catch((error) => {
  if (
    error instanceof Error &&
    /^AI_TIER_STAGING_ACCEPTANCE_ERROR=[a-z0-9_]+$/u.test(error.message)
  ) {
    console.error(error.message);
  } else {
    console.error("AI_TIER_STAGING_ACCEPTANCE_ERROR=unexpected_failure");
  }
  process.exitCode = 1;
});
