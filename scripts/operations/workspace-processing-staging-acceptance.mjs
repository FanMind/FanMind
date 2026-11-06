#!/usr/bin/env node

import { spawnSync } from "node:child_process";
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
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { evaluateWorkspaceProcessingEntitlement } from "../../src/lib/workspaceProcessingPolicy.mjs";
import {
  UUID_PATTERN,
  WORKSPACE_PROCESSING_STAGING_WORKSPACE_NAME,
  evaluateWorkspaceProcessingStagingEnvironment,
} from "../../src/lib/workspaceProcessingStagingPolicy.mjs";

const MAX_PASSFILE_BYTES = 64 * 1024;
const FIXTURE_PREFIX = "WORKSPACE_PROCESSING_STAGING_FIXTURE=";
const MARKER_FLAGS =
  `'${JSON.stringify({ workspace_processing_acceptance: true })}'::jsonb`;

const EXPECTED_CASES = new Map([
  ["active", { allowed: true, reason: "active_billing" }],
  ["archived", { allowed: false, reason: "workspace_archived" }],
  ["contract_ended", { allowed: false, reason: "contract_ended" }],
  ["suspended", { allowed: false, reason: "billing_suspended" }],
  ["billing_grace", { allowed: true, reason: "billing_grace" }],
  ["manual_override", { allowed: true, reason: "manual_override" }],
  ["temporary_access", { allowed: true, reason: "temporary_access" }],
  [
    "temporary_access_expired",
    { allowed: false, reason: "temporary_access_expired" },
  ],
  ["reactivated", { allowed: true, reason: "active_billing" }],
]);

function fail(code) {
  throw new Error(`WORKSPACE_PROCESSING_STAGING_ACCEPTANCE_ERROR=${code}`);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function modeFromArguments(argumentsList) {
  const known = new Set(["--check", "--run"]);
  if (argumentsList.some((argument) => !known.has(argument))) {
    fail("argument_invalid");
  }
  const selected = argumentsList.filter((argument) => known.has(argument));
  if (selected.length > 1) fail("mode_ambiguous");
  return selected[0] ?? "--check";
}

function sqlUuid(value) {
  if (!UUID_PATTERN.test(value)) fail("synthetic_workspace_invalid");
  return `'${value}'::uuid`;
}

function fixtureSelect(caseName, workspaceId) {
  if (!EXPECTED_CASES.has(caseName)) fail("fixture_case_invalid");
  return String.raw`
select '${FIXTURE_PREFIX}' || jsonb_build_object(
  'case', '${caseName}',
  'now', current_timestamp,
  'workspace', jsonb_build_object(
    'workspace_access_mode', workspace.workspace_access_mode,
    'subscription_effective_end_at', workspace.subscription_effective_end_at,
    'billing_status', workspace.billing_status,
    'billing_manual_override', workspace.billing_manual_override,
    'billing_grace_until', workspace.billing_grace_until,
    'billing_suspended_at', workspace.billing_suspended_at,
    'test_access_flags', workspace.test_access_flags
  )
)::text
from public.workspaces as workspace
where workspace.id = ${workspaceId};
`;
}

function stateUpdate(
  workspaceId,
  {
    accessMode = "active",
    effectiveEnd = "null",
    billingStatus = "active",
    manualOverride = false,
    graceUntil = "null",
    suspendedAt = "null",
    testAccessFlags = MARKER_FLAGS,
  } = {},
) {
  return String.raw`
update public.workspaces
   set workspace_access_mode = '${accessMode}',
       subscription_effective_end_at = ${effectiveEnd},
       billing_status = '${billingStatus}',
       billing_manual_override = ${manualOverride ? "true" : "false"},
       billing_grace_until = ${graceUntil},
       billing_suspended_at = ${suspendedAt},
       test_access_flags = ${testAccessFlags}
 where id = ${workspaceId};
`;
}

export function buildWorkspaceProcessingAcceptanceSql(rawWorkspaceId) {
  const workspaceId = sqlUuid(clean(rawWorkspaceId));
  const workspaceName = WORKSPACE_PROCESSING_STAGING_WORKSPACE_NAME.replaceAll(
    "'",
    "''",
  );
  const temporaryAccessFlags =
    "jsonb_build_object('workspace_processing_acceptance', true, 'temporary_processing_access', true, 'temporary_processing_access_expires_at', (current_timestamp + interval '1 hour')::text)";
  const expiredTemporaryAccessFlags =
    "jsonb_build_object('workspace_processing_acceptance', true, 'temporary_processing_access', true, 'temporary_processing_access_expires_at', (current_timestamp - interval '1 second')::text)";

  return String.raw`
\set ON_ERROR_STOP on
create temporary table fanmind_workspace_processing_original (
  state_digest text not null
) on commit preserve rows;

insert into fanmind_workspace_processing_original (state_digest)
select md5(jsonb_build_object(
  'workspace_access_mode', workspace.workspace_access_mode,
  'subscription_effective_end_at', workspace.subscription_effective_end_at,
  'billing_status', workspace.billing_status,
  'billing_manual_override', workspace.billing_manual_override,
  'billing_grace_until', workspace.billing_grace_until,
  'billing_suspended_at', workspace.billing_suspended_at,
  'test_access_flags', workspace.test_access_flags
)::text)
from public.workspaces as workspace
where workspace.id = ${workspaceId};

do $resource$
begin
  if to_regrole('service_role') is null then
    raise exception 'service_role_missing';
  end if;
  if not exists (
    select 1
      from public.workspaces as workspace
     where workspace.id = ${workspaceId}
       and workspace.name = '${workspaceName}'
       and workspace.workspace_access_mode = 'active'
       and workspace.billing_status = 'active'
       and workspace.stripe_customer_id is null
       and workspace.stripe_subscription_id is null
       and workspace.test_access_flags ->> 'workspace_processing_acceptance' = 'true'
  ) then
    raise exception 'dedicated_synthetic_workspace_invalid';
  end if;
  if (select count(*) from fanmind_workspace_processing_original) <> 1 then
    raise exception 'synthetic_workspace_state_invalid';
  end if;
end
$resource$;

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $lock$
begin
  perform 1
    from public.workspaces
   where id = ${workspaceId}
   for update;
  if not found then
    raise exception 'synthetic_workspace_missing';
  end if;
end
$lock$;

${stateUpdate(workspaceId)}
${fixtureSelect("active", workspaceId)}

${stateUpdate(workspaceId, { accessMode: "archived_readonly" })}
${fixtureSelect("archived", workspaceId)}

${stateUpdate(workspaceId, {
    effectiveEnd: "current_timestamp - interval '1 second'",
  })}
${fixtureSelect("contract_ended", workspaceId)}

${stateUpdate(workspaceId, {
    billingStatus: "suspended",
    suspendedAt: "current_timestamp",
  })}
${fixtureSelect("suspended", workspaceId)}

${stateUpdate(workspaceId, {
    billingStatus: "payment_failed",
    graceUntil: "current_timestamp + interval '1 hour'",
  })}
${fixtureSelect("billing_grace", workspaceId)}

${stateUpdate(workspaceId, {
    billingStatus: "suspended",
    manualOverride: true,
    suspendedAt: "current_timestamp",
  })}
${fixtureSelect("manual_override", workspaceId)}

${stateUpdate(workspaceId, {
    billingStatus: "demo_free",
    testAccessFlags: temporaryAccessFlags,
  })}
${fixtureSelect("temporary_access", workspaceId)}

${stateUpdate(workspaceId, {
    billingStatus: "demo_free",
    testAccessFlags: expiredTemporaryAccessFlags,
  })}
${fixtureSelect("temporary_access_expired", workspaceId)}

${stateUpdate(workspaceId)}
${fixtureSelect("reactivated", workspaceId)}

rollback;

do $rollback_verify$
begin
  if not exists (
    select 1
      from public.workspaces as workspace
      cross join fanmind_workspace_processing_original as original
     where workspace.id = ${workspaceId}
       and md5(jsonb_build_object(
         'workspace_access_mode', workspace.workspace_access_mode,
         'subscription_effective_end_at', workspace.subscription_effective_end_at,
         'billing_status', workspace.billing_status,
         'billing_manual_override', workspace.billing_manual_override,
         'billing_grace_until', workspace.billing_grace_until,
         'billing_suspended_at', workspace.billing_suspended_at,
         'test_access_flags', workspace.test_access_flags
       )::text) = original.state_digest
  ) then
    raise exception 'rollback_state_mismatch';
  end if;
end
$rollback_verify$;

select 'WORKSPACE_PROCESSING_STAGING_SYNTHETIC_RESOURCE=PASS';
select 'WORKSPACE_PROCESSING_STAGING_ROLLBACK=PASS';
drop table fanmind_workspace_processing_original;
`;
}

export function verifyWorkspaceProcessingFixtures(output) {
  const fixtures = new Map();
  for (const line of String(output ?? "").split(/\r?\n/u)) {
    const normalized = line.trim();
    if (!normalized.startsWith(FIXTURE_PREFIX)) continue;
    let fixture;
    try {
      fixture = JSON.parse(normalized.slice(FIXTURE_PREFIX.length));
    } catch {
      fail("fixture_output_invalid");
    }
    const caseName = clean(fixture?.case);
    if (
      !EXPECTED_CASES.has(caseName) ||
      fixtures.has(caseName) ||
      !fixture?.workspace ||
      typeof fixture.workspace !== "object" ||
      !clean(fixture.now)
    ) {
      fail("fixture_output_invalid");
    }
    const now = new Date(fixture.now);
    if (!Number.isFinite(now.getTime())) fail("fixture_output_invalid");
    const decision = evaluateWorkspaceProcessingEntitlement(
      fixture.workspace,
      now,
    );
    if (
      JSON.stringify(decision) !== JSON.stringify(EXPECTED_CASES.get(caseName))
    ) {
      fail("fixture_decision_mismatch");
    }
    fixtures.set(caseName, decision);
  }
  if (fixtures.size !== EXPECTED_CASES.size) fail("fixture_count_invalid");

  const missing = evaluateWorkspaceProcessingEntitlement(null, new Date(0));
  const unknown = evaluateWorkspaceProcessingEntitlement(
    { workspace_access_mode: "unknown" },
    new Date(0),
  );
  if (
    JSON.stringify(missing) !==
      JSON.stringify({ allowed: false, reason: "workspace_missing" }) ||
    JSON.stringify(unknown) !==
      JSON.stringify({ allowed: false, reason: "workspace_state_unknown" })
  ) {
    fail("fail_closed_policy_invalid");
  }

  return Object.freeze({
    databaseCases: fixtures.size,
    policyCases: fixtures.size + 2,
  });
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
    snapshotDirectory = mkdtempSync(
      join(tmpdir(), "fanmind-workspace-processing-staging-"),
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
      error.message.startsWith(
        "WORKSPACE_PROCESSING_STAGING_ACCEPTANCE_ERROR=",
      )
    ) {
      throw error;
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
  ]) {
    delete safe[key];
  }
  return safe;
}

function ensurePsqlAvailable() {
  const result = spawnSync("psql", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (result.error || result.status !== 0) fail("psql_unavailable");
  console.log("WORKSPACE_PROCESSING_STAGING_PSQL=available");
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

function runAcceptance(environment) {
  const policy = evaluateWorkspaceProcessingStagingEnvironment(environment);
  if (!policy.ok) fail("environment_invalid");
  ensurePsqlAvailable();
  const { snapshotDirectory, snapshotPath } =
    privatePassfileSnapshot(environment);
  try {
    const sql = buildWorkspaceProcessingAcceptanceSql(
      clean(environment.FANMIND_WORKSPACE_PROCESSING_STAGING_WORKSPACE_ID),
    );
    const result = runPsql(sql, environment, snapshotPath);
    if (
      result.error ||
      result.status !== 0 ||
      !result.stdout.includes(
        "WORKSPACE_PROCESSING_STAGING_SYNTHETIC_RESOURCE=PASS",
      ) ||
      !result.stdout.includes("WORKSPACE_PROCESSING_STAGING_ROLLBACK=PASS")
    ) {
      fail("database_acceptance_failed");
    }
    const proof = verifyWorkspaceProcessingFixtures(result.stdout);
    console.log(
      `WORKSPACE_PROCESSING_STAGING_DATABASE_CASES=${proof.databaseCases}`,
    );
    console.log(
      `WORKSPACE_PROCESSING_STAGING_POLICY_CASES=${proof.policyCases}`,
    );
    console.log("WORKSPACE_PROCESSING_STAGING_DENIAL_REACTIVATION=PASS");
    console.log("WORKSPACE_PROCESSING_STAGING_ROLLBACK=PASS");
    console.log("WORKSPACE_PROCESSING_STAGING_PROVIDER_CALLS=0");
    console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  if (mode === "--check") {
    console.log("WORKSPACE_PROCESSING_STAGING_ACCEPTANCE_MODE=check");
    console.log("WORKSPACE_PROCESSING_STAGING_ACCEPTANCE_READY=YES");
    return;
  }
  console.log("WORKSPACE_PROCESSING_STAGING_ACCEPTANCE_MODE=run");
  runAcceptance(process.env);
  console.log("WORKSPACE_PROCESSING_STAGING_ACCEPTANCE_READY=YES");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    if (
      error instanceof Error &&
      /^WORKSPACE_PROCESSING_STAGING_ACCEPTANCE_ERROR=[a-z0-9_]+$/u.test(
        error.message,
      )
    ) {
      console.error(error.message);
    } else {
      console.error(
        "WORKSPACE_PROCESSING_STAGING_ACCEPTANCE_ERROR=unexpected_failure",
      );
    }
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  });
}
