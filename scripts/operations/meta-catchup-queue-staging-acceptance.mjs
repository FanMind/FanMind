#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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

import { evaluateMetaCatchupQueueStagingEnvironment } from "../../src/lib/metaCatchupQueueStagingPolicy.mjs";
import {
  UUID_PATTERN,
  WORKSPACE_PROCESSING_STAGING_WORKSPACE_NAME,
} from "../../src/lib/workspaceProcessingStagingPolicy.mjs";

const MAX_PASSFILE_BYTES = 64 * 1024;
const ACTIVE_STATUSES = "'pending', 'claimed', 'retry'";
const WORKER_A = "fanmind-acceptance-worker-a";
const WORKER_B = "fanmind-acceptance-worker-b";

function fail(code) {
  throw new Error(`META_CATCHUP_QUEUE_STAGING_ACCEPTANCE_ERROR=${code}`);
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

export function deriveMetaCatchupAcceptanceUuid(workspaceId, label) {
  const normalizedWorkspaceId = clean(workspaceId).toLowerCase();
  if (!UUID_PATTERN.test(normalizedWorkspaceId) || !/^[a-z0-9-]{1,64}$/u.test(label)) {
    fail("synthetic_identifier_invalid");
  }
  const bytes = createHash("sha256")
    .update(`fanmind-meta-catchup-acceptance:${normalizedWorkspaceId}:${label}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sqlUuid(value) {
  if (!UUID_PATTERN.test(value)) fail("synthetic_identifier_invalid");
  return `'${value}'::uuid`;
}

function retryRoundSql({
  workspaceId,
  connectionId,
  senderId,
  expectedAttempt,
}) {
  const expectedStatus = expectedAttempt < 5 ? "retry" : "dead_letter";
  const clockAdvance =
    expectedAttempt < 5
      ? String.raw`
reset role;
update public.meta_conversation_catchup_jobs
   set available_at = now() - interval '1 second'
 where workspace_id = ${workspaceId}
   and social_connection_id = ${connectionId}
   and fan_sender_id = '${senderId}'
   and status = 'retry';
set local role service_role;
`
      : "";
  return String.raw`
do $retry_${expectedAttempt}$
declare
  claimed public.meta_conversation_catchup_jobs%rowtype;
  finished public.meta_conversation_catchup_jobs%rowtype;
begin
  select * into claimed
    from public.claim_meta_conversation_catchup_job('${WORKER_A}', 30);
  if claimed.id is null
     or claimed.workspace_id <> ${workspaceId}
     or claimed.social_connection_id <> ${connectionId}
     or claimed.fan_sender_id <> '${senderId}'
     or claimed.status <> 'claimed'
     or claimed.attempt_count <> ${expectedAttempt} then
    raise exception 'retry_claim_${expectedAttempt}_invalid';
  end if;
  select * into finished
    from public.finish_meta_conversation_catchup_job(
      claimed.id,
      '${WORKER_A}',
      claimed.lease_token,
      'retry',
      'meta_sync_failed',
      1
    );
  if finished.id is null
     or finished.status <> '${expectedStatus}'
     or finished.attempt_count <> ${expectedAttempt}
     or finished.last_error_code <> 'meta_sync_failed' then
    raise exception 'retry_finish_${expectedAttempt}_invalid';
  end if;
end
$retry_${expectedAttempt}$;
${clockAdvance}`;
}

export function buildMetaCatchupQueueAcceptanceSql(rawWorkspaceId) {
  const workspaceIdValue = clean(rawWorkspaceId).toLowerCase();
  if (!UUID_PATTERN.test(workspaceIdValue)) fail("synthetic_workspace_invalid");
  const identifiers = Object.freeze({
    workspace: sqlUuid(workspaceIdValue),
    otherWorkspace: sqlUuid(
      deriveMetaCatchupAcceptanceUuid(workspaceIdValue, "other-workspace"),
    ),
    contact: sqlUuid(
      deriveMetaCatchupAcceptanceUuid(workspaceIdValue, "contact"),
    ),
    missingContact: sqlUuid(
      deriveMetaCatchupAcceptanceUuid(workspaceIdValue, "missing-contact"),
    ),
    connection: sqlUuid(
      deriveMetaCatchupAcceptanceUuid(workspaceIdValue, "connection"),
    ),
    disconnectedConnection: sqlUuid(
      deriveMetaCatchupAcceptanceUuid(
        workspaceIdValue,
        "disconnected-connection",
      ),
    ),
  });
  const suffix = identifiers.contact.replaceAll(/[^0-9a-f]/gu, "").slice(-16);
  const senderId = `fanmind-acceptance-sender-${suffix}`;
  const pageId = `fanmind-acceptance-page-${suffix}`;
  const disconnectedPageId = `fanmind-acceptance-disconnected-${suffix}`;
  const workspaceName = WORKSPACE_PROCESSING_STAGING_WORKSPACE_NAME.replaceAll(
    "'",
    "''",
  );
  const retryRounds = [1, 2, 3, 4, 5]
    .map((expectedAttempt) =>
      retryRoundSql({
        workspaceId: identifiers.workspace,
        connectionId: identifiers.connection,
        senderId,
        expectedAttempt,
      }),
    )
    .join("\n");

  return String.raw`
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '45s';
lock table public.meta_conversation_catchup_jobs in share row exclusive mode;

do $resource$
begin
  if to_regrole('service_role') is null then
    raise exception 'service_role_missing';
  end if;
  if not exists (
    select 1
      from public.workspaces as workspace
     where workspace.id = ${identifiers.workspace}
       and workspace.name = '${workspaceName}'
       and workspace.workspace_access_mode = 'active'
       and workspace.billing_status = 'active'
       and workspace.stripe_customer_id is null
       and workspace.stripe_subscription_id is null
       and workspace.test_access_flags ->> 'workspace_processing_acceptance' = 'true'
  ) then
    raise exception 'dedicated_synthetic_workspace_invalid';
  end if;
  if exists (
    select 1
      from public.meta_conversation_catchup_jobs
     where status in (${ACTIVE_STATUSES})
  ) then
    raise exception 'active_staging_queue_must_be_empty';
  end if;
  if exists (
    select 1 from public.contacts where id in (${identifiers.contact}, ${identifiers.missingContact})
  ) or exists (
    select 1 from public.social_connections
     where id in (${identifiers.connection}, ${identifiers.disconnectedConnection})
        or page_id in ('${pageId}', '${disconnectedPageId}')
  ) or exists (
    select 1 from public.meta_conversation_catchup_jobs
     where workspace_id = ${identifiers.workspace}
       and fan_sender_id = '${senderId}'
  ) then
    raise exception 'synthetic_resource_collision';
  end if;
end
$resource$;

insert into public.contacts (
  id, workspace_id, display_name, handle, source_platform
) values (
  ${identifiers.contact},
  ${identifiers.workspace},
  'FanMind Queue Acceptance',
  '${senderId}',
  'facebook'
);

insert into public.social_connections (
  id,
  workspace_id,
  platform,
  provider,
  status,
  external_account_id,
  external_account_name,
  page_id,
  page_name,
  webhook_subscribed
) values
  (
    ${identifiers.connection},
    ${identifiers.workspace},
    'facebook',
    'meta',
    'connected',
    '${pageId}',
    'FanMind Queue Acceptance',
    '${pageId}',
    'FanMind Queue Acceptance',
    false
  ),
  (
    ${identifiers.disconnectedConnection},
    ${identifiers.workspace},
    'facebook',
    'meta',
    'disconnected',
    '${disconnectedPageId}',
    'FanMind Queue Acceptance Disconnected',
    '${disconnectedPageId}',
    'FanMind Queue Acceptance Disconnected',
    false
  );

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

do $scope_denials$
begin
  begin
    perform public.enqueue_meta_conversation_catchup(
      ${identifiers.otherWorkspace},
      ${identifiers.connection},
      'facebook',
      '${senderId}',
      ${identifiers.contact}
    );
    raise exception 'wrong_workspace_unexpected_success';
  exception when foreign_key_violation then
    if sqlerrm <> 'connection_unavailable' then raise; end if;
  end;
  begin
    perform public.enqueue_meta_conversation_catchup(
      ${identifiers.workspace},
      ${identifiers.disconnectedConnection},
      'facebook',
      '${senderId}',
      ${identifiers.contact}
    );
    raise exception 'disconnected_connection_unexpected_success';
  exception when foreign_key_violation then
    if sqlerrm <> 'connection_unavailable' then raise; end if;
  end;
  begin
    perform public.enqueue_meta_conversation_catchup(
      ${identifiers.workspace},
      ${identifiers.connection},
      'facebook',
      '${senderId}',
      ${identifiers.missingContact}
    );
    raise exception 'wrong_contact_unexpected_success';
  exception when foreign_key_violation then
    if sqlerrm <> 'contact_unavailable' then raise; end if;
  end;
  begin
    perform public.enqueue_meta_conversation_catchup(
      ${identifiers.workspace},
      ${identifiers.connection},
      'tiktok',
      '${senderId}',
      ${identifiers.contact}
    );
    raise exception 'invalid_platform_unexpected_success';
  exception when invalid_parameter_value then
    if sqlerrm <> 'catchup_input_invalid' then raise; end if;
  end;
end
$scope_denials$;

do $coalescing_and_generation$
declare
  first_job public.meta_conversation_catchup_jobs%rowtype;
  coalesced_job public.meta_conversation_catchup_jobs%rowtype;
  claimed public.meta_conversation_catchup_jobs%rowtype;
  while_claimed public.meta_conversation_catchup_jobs%rowtype;
  finished public.meta_conversation_catchup_jobs%rowtype;
  competing_claims integer;
begin
  select * into first_job
    from public.enqueue_meta_conversation_catchup(
      ${identifiers.workspace}, ${identifiers.connection}, 'facebook',
      '${senderId}', ${identifiers.contact}
    );
  select * into coalesced_job
    from public.enqueue_meta_conversation_catchup(
      ${identifiers.workspace}, ${identifiers.connection}, 'facebook',
      '${senderId}', ${identifiers.contact}
    );
  if first_job.id is null
     or coalesced_job.id <> first_job.id
     or coalesced_job.status <> 'pending'
     or coalesced_job.generation <> 2
     or (select count(*) from public.meta_conversation_catchup_jobs
          where workspace_id = ${identifiers.workspace}
            and social_connection_id = ${identifiers.connection}
            and fan_sender_id = '${senderId}'
            and status in (${ACTIVE_STATUSES})) <> 1 then
    raise exception 'coalescing_invalid';
  end if;

  select * into claimed
    from public.claim_meta_conversation_catchup_job('${WORKER_A}', 30);
  if claimed.id <> first_job.id
     or claimed.status <> 'claimed'
     or claimed.attempt_count <> 1
     or claimed.claimed_generation <> 2 then
    raise exception 'first_claim_invalid';
  end if;
  select count(*) into competing_claims
    from public.claim_meta_conversation_catchup_job('${WORKER_B}', 30);
  if competing_claims <> 0 then
    raise exception 'lease_exclusivity_invalid';
  end if;

  select * into while_claimed
    from public.enqueue_meta_conversation_catchup(
      ${identifiers.workspace}, ${identifiers.connection}, 'facebook',
      '${senderId}', ${identifiers.contact}
    );
  if while_claimed.id <> first_job.id
     or while_claimed.status <> 'claimed'
     or while_claimed.generation <> 3
     or while_claimed.claimed_generation <> 2 then
    raise exception 'claimed_generation_invalid';
  end if;

  select * into finished
    from public.finish_meta_conversation_catchup_job(
      claimed.id, '${WORKER_A}', claimed.lease_token, 'success', null, 1
    );
  if finished.id <> first_job.id
     or finished.status <> 'pending'
     or finished.generation <> 3
     or finished.attempt_count <> 0 then
    raise exception 'new_generation_preservation_invalid';
  end if;
end
$coalescing_and_generation$;

do $lease_start$
declare
  claimed public.meta_conversation_catchup_jobs%rowtype;
begin
  select * into claimed
    from public.claim_meta_conversation_catchup_job('${WORKER_A}', 30);
  if claimed.id is null
     or claimed.workspace_id <> ${identifiers.workspace}
     or claimed.status <> 'claimed'
     or claimed.attempt_count <> 1 then
    raise exception 'lease_start_invalid';
  end if;
end
$lease_start$;

reset role;
update public.meta_conversation_catchup_jobs
   set lease_until = now() - interval '1 second'
 where workspace_id = ${identifiers.workspace}
   and social_connection_id = ${identifiers.connection}
   and fan_sender_id = '${senderId}'
   and status = 'claimed';
set local role service_role;

do $lease_restart$
declare
  claimed public.meta_conversation_catchup_jobs%rowtype;
  finished public.meta_conversation_catchup_jobs%rowtype;
begin
  select * into claimed
    from public.claim_meta_conversation_catchup_job('${WORKER_B}', 30);
  if claimed.id is null
     or claimed.workspace_id <> ${identifiers.workspace}
     or claimed.status <> 'claimed'
     or claimed.worker_id <> '${WORKER_B}'
     or claimed.attempt_count <> 2 then
    raise exception 'lease_restart_invalid';
  end if;
  select * into finished
    from public.finish_meta_conversation_catchup_job(
      claimed.id, '${WORKER_B}', claimed.lease_token, 'success', null, 1
    );
  if finished.id is null or finished.status <> 'succeeded' then
    raise exception 'lease_restart_finish_invalid';
  end if;

  select * into finished
    from public.enqueue_meta_conversation_catchup(
      ${identifiers.workspace}, ${identifiers.connection}, 'facebook',
      '${senderId}', ${identifiers.contact}
    );
  if finished.id is null
     or finished.status <> 'pending'
     or finished.generation <> 1
     or finished.attempt_count <> 0 then
    raise exception 'terminal_reenqueue_invalid';
  end if;
end
$lease_restart$;

${retryRounds}

do $dead_letter$
begin
  if (select count(*)
        from public.meta_conversation_catchup_jobs
       where workspace_id = ${identifiers.workspace}
         and social_connection_id = ${identifiers.connection}
         and fan_sender_id = '${senderId}'
         and status = 'dead_letter'
         and attempt_count = 5
         and last_error_code = 'meta_sync_failed') <> 1 then
    raise exception 'dead_letter_invalid';
  end if;
  if exists (
    select 1
      from public.meta_conversation_catchup_jobs
     where workspace_id = ${identifiers.workspace}
       and social_connection_id = ${identifiers.connection}
       and fan_sender_id = '${senderId}'
       and status in (${ACTIVE_STATUSES})
  ) then
    raise exception 'active_job_after_retry_budget';
  end if;
end
$dead_letter$;

reset role;
rollback;

do $rollback_verify$
begin
  if exists (
    select 1 from public.contacts where id in (${identifiers.contact}, ${identifiers.missingContact})
  ) or exists (
    select 1 from public.social_connections
     where id in (${identifiers.connection}, ${identifiers.disconnectedConnection})
        or page_id in ('${pageId}', '${disconnectedPageId}')
  ) or exists (
    select 1 from public.meta_conversation_catchup_jobs
     where workspace_id = ${identifiers.workspace}
       and fan_sender_id = '${senderId}'
  ) then
    raise exception 'rollback_cleanup_invalid';
  end if;
end
$rollback_verify$;

select 'META_CATCHUP_QUEUE_STAGING_SCOPE_DENIALS=4';
select 'META_CATCHUP_QUEUE_STAGING_COALESCING=PASS';
select 'META_CATCHUP_QUEUE_STAGING_LEASE_RESTART=PASS';
select 'META_CATCHUP_QUEUE_STAGING_RETRY_ATTEMPTS=5';
select 'META_CATCHUP_QUEUE_STAGING_DEAD_LETTER=PASS';
select 'META_CATCHUP_QUEUE_STAGING_ROLLBACK=PASS';
`;
}

export function buildMetaCatchupQueueRoleDenialSql(role, operation) {
  if (!new Set(["anon", "authenticated"]).has(role)) fail("role_probe_invalid");
  if (!new Set(["table", "function"]).has(operation)) {
    fail("role_probe_invalid");
  }
  const statement =
    operation === "table"
      ? "select count(*) from public.meta_conversation_catchup_jobs;"
      : "select * from public.enqueue_meta_conversation_catchup('00000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000002'::uuid, 'facebook', 'denied', null);";
  return String.raw`\set ON_ERROR_STOP on
set role ${role};
select 'META_CATCHUP_QUEUE_STAGING_ROLE_SWITCH=PASS';
${statement}
`;
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
      join(tmpdir(), "fanmind-meta-catchup-acceptance-"),
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
        "META_CATCHUP_QUEUE_STAGING_ACCEPTANCE_ERROR=",
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
  console.log("META_CATCHUP_QUEUE_STAGING_PSQL=available");
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

function verifyRuntimeRoleDenials(environment, passfilePath) {
  let proofs = 0;
  for (const role of ["anon", "authenticated"]) {
    for (const operation of ["table", "function"]) {
      const result = runPsql(
        buildMetaCatchupQueueRoleDenialSql(role, operation),
        environment,
        passfilePath,
      );
      if (
        result.error ||
        result.status === 0 ||
        !result.stdout.includes(
          "META_CATCHUP_QUEUE_STAGING_ROLE_SWITCH=PASS",
        )
      ) {
        fail("role_denial_failed");
      }
      proofs += 1;
    }
  }
  console.log(`META_CATCHUP_QUEUE_STAGING_BROWSER_DENIALS=${proofs}`);
}

function runAcceptance(environment) {
  const policy = evaluateMetaCatchupQueueStagingEnvironment(environment, {
    mode: "acceptance",
  });
  if (!policy.ok) fail("environment_invalid");
  ensurePsqlAvailable();
  const { snapshotDirectory, snapshotPath } =
    privatePassfileSnapshot(environment);
  try {
    verifyRuntimeRoleDenials(environment, snapshotPath);
    const sql = buildMetaCatchupQueueAcceptanceSql(
      clean(environment.FANMIND_META_CATCHUP_QUEUE_STAGING_WORKSPACE_ID),
    );
    const result = runPsql(sql, environment, snapshotPath);
    const markers = [
      "META_CATCHUP_QUEUE_STAGING_SCOPE_DENIALS=4",
      "META_CATCHUP_QUEUE_STAGING_COALESCING=PASS",
      "META_CATCHUP_QUEUE_STAGING_LEASE_RESTART=PASS",
      "META_CATCHUP_QUEUE_STAGING_RETRY_ATTEMPTS=5",
      "META_CATCHUP_QUEUE_STAGING_DEAD_LETTER=PASS",
      "META_CATCHUP_QUEUE_STAGING_ROLLBACK=PASS",
    ];
    if (
      result.error ||
      result.status !== 0 ||
      markers.some((marker) => !result.stdout.includes(marker))
    ) {
      fail("database_acceptance_failed");
    }
    for (const marker of markers) console.log(marker);
    console.log("META_CATCHUP_QUEUE_STAGING_PROVIDER_CALLS=0");
    console.log("META_CATCHUP_QUEUE_STAGING_ANALYSIS_CALLS=0");
    console.log("META_CATCHUP_QUEUE_STAGING_SEND_CALLS=0");
    console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  if (mode === "--check") {
    console.log("META_CATCHUP_QUEUE_STAGING_ACCEPTANCE_MODE=check");
    console.log("META_CATCHUP_QUEUE_STAGING_ACCEPTANCE_READY=YES");
    return;
  }
  console.log("META_CATCHUP_QUEUE_STAGING_ACCEPTANCE_MODE=run");
  runAcceptance(process.env);
  console.log("META_CATCHUP_QUEUE_STAGING_ACCEPTANCE_READY=YES");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    if (
      error instanceof Error &&
      /^META_CATCHUP_QUEUE_STAGING_ACCEPTANCE_ERROR=[a-z0-9_]+$/u.test(
        error.message,
      )
    ) {
      console.error(error.message);
    } else {
      console.error(
        "META_CATCHUP_QUEUE_STAGING_ACCEPTANCE_ERROR=unexpected_failure",
      );
    }
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  });
}
