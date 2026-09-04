#!/usr/bin/env node

import { createHash } from "node:crypto";
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

import {
  UUID_PATTERN,
  evaluateMobilePushStagingControlEnvironment,
} from "../../src/lib/mobilePushStagingControlPolicy.mjs";

const MAX_PASSFILE_BYTES = 64 * 1024;
const ROLE_PROBES = Object.freeze([
  ["anon", "table"],
  ["anon", "reserve"],
  ["authenticated", "table"],
  ["authenticated", "reserve"],
]);
const ACCEPTANCE_STAGE_PATTERN =
  /MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_STAGE=(preflight|fixtures|reservation_membership|reservation_workspace|reservation_target|reservation|ticket|receipt|device_revocation|rollback_check)/gu;
const ACCEPTANCE_FAILURE_REASONS = Object.freeze([
  "mobile_push_reservation_input_invalid",
  "mobile_push_target_revalidation_failed",
  "initial_reservation_invalid",
  "lease_exclusivity_invalid",
]);

function fail(code) {
  throw new Error(`MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_ERROR=${code}`);
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
  if (!UUID_PATTERN.test(value)) fail("synthetic_identifier_invalid");
  return `'${value}'::uuid`;
}

function sqlText(value, pattern) {
  if (!pattern.test(value)) fail("synthetic_material_invalid");
  return `'${value}'`;
}

export function deriveMobilePushLedgerAcceptanceUuid(deviceId, label) {
  if (!UUID_PATTERN.test(deviceId) || !/^[a-z][a-z0-9-]{1,40}$/u.test(label)) {
    fail("synthetic_identifier_invalid");
  }
  const hex = createHash("sha256")
    .update(`fanmind-mobile-push-ledger:${deviceId}:${label}`)
    .digest("hex")
    .slice(0, 32)
    .split("");
  hex[12] = "4";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16], 16) % 4];
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function syntheticMaterial(identifiers) {
  const labels = [
    "contact",
    "followup-primary",
    "followup-device",
    "registration-primary",
    "registration-device",
  ];
  const derived = Object.fromEntries(
    labels.map((label) => [
      label.replace(/-([a-z])/gu, (_, character) => character.toUpperCase()),
      deriveMobilePushLedgerAcceptanceUuid(identifiers.deviceId, label),
    ]),
  );
  const fingerprint = (label) =>
    createHash("sha256")
      .update(`fanmind-mobile-push-ledger:${identifiers.deviceId}:${label}`)
      .digest("hex");
  const ciphertext = (label) => {
    const material = fingerprint(`ciphertext-${label}`);
    return `v1:${material.slice(0, 16)}:${material.slice(16, 48)}:${material.slice(48)}`;
  };
  return Object.freeze({
    ...derived,
    primaryFingerprint: fingerprint("primary-token"),
    deviceFingerprint: fingerprint("device-token"),
    primaryCiphertext: ciphertext("primary"),
    deviceCiphertext: ciphertext("device"),
    primaryKey: fingerprint("primary-idempotency"),
    deviceKey: fingerprint("device-idempotency"),
  });
}

export function buildMobilePushLedgerRoleDenialSql(role, probe) {
  if (!new Set(["anon", "authenticated"]).has(role)) fail("role_probe_invalid");
  if (!new Set(["table", "reserve"]).has(probe)) fail("role_probe_invalid");
  const statement =
    probe === "table"
      ? "select id from public.mobile_push_delivery_attempts limit 1;"
      : "select public.mobile_push_delivery_reserve('{}'::jsonb);";
  return String.raw`
\set ON_ERROR_STOP on
begin;
set local role ${role};
select 'MOBILE_PUSH_DELIVERY_LEDGER_ROLE_SWITCH=PASS';
${statement}
rollback;
`;
}

export function buildMobilePushLedgerAcceptanceSql(identifiers) {
  const material = syntheticMaterial(identifiers);
  const workspace = sqlUuid(identifiers.workspaceId);
  const owner = sqlUuid(identifiers.ownerUserId);
  const member = sqlUuid(identifiers.memberUserId);
  const project = sqlUuid(identifiers.easProjectId);
  const contact = sqlUuid(material.contact);
  const followupPrimary = sqlUuid(material.followupPrimary);
  const followupDevice = sqlUuid(material.followupDevice);
  const registrationPrimary = sqlUuid(material.registrationPrimary);
  const registrationDevice = sqlUuid(material.registrationDevice);
  const primaryFingerprint = sqlText(material.primaryFingerprint, /^[0-9a-f]{64}$/u);
  const deviceFingerprint = sqlText(material.deviceFingerprint, /^[0-9a-f]{64}$/u);
  const primaryCiphertext = sqlText(
    material.primaryCiphertext,
    /^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/u,
  );
  const deviceCiphertext = sqlText(
    material.deviceCiphertext,
    /^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/u,
  );
  const primaryKey = sqlText(material.primaryKey, /^[0-9a-f]{64}$/u);
  const deviceKey = sqlText(material.deviceKey, /^[0-9a-f]{64}$/u);
  const projectRef = sqlText(
    identifiers.targetSupabaseProjectRef,
    /^[a-z0-9]{8,40}$/u,
  );
  return String.raw`
\set ON_ERROR_STOP on
begin;
set local role service_role;
\echo MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_STAGE=preflight

do $preflight$
begin
  if to_regclass('public.mobile_push_delivery_attempts') is null
     or to_regprocedure('public.mobile_push_delivery_reserve(jsonb)') is null
     or to_regprocedure('public.mobile_push_delivery_reserve_receipt(jsonb)') is null
     or to_regprocedure('public.mobile_push_delivery_transition(text,jsonb)') is null then
    raise exception 'delivery_ledger_schema_missing';
  end if;
  if exists (
    select 1 from public.mobile_push_delivery_attempts
     where idempotency_key in (${primaryKey}, ${deviceKey})
  ) or exists (
    select 1 from public.mobile_push_registrations
     where id in (${registrationPrimary}, ${registrationDevice})
        or user_id in (${owner}, ${member})
        or expo_token_hash in (${primaryFingerprint}, ${deviceFingerprint})
  ) or exists (
    select 1 from public.followups where id in (${followupPrimary}, ${followupDevice})
  ) or exists (
    select 1 from public.contacts where id = ${contact}
  ) then
    raise exception 'synthetic_rows_not_clean';
  end if;
end
$preflight$;

\echo MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_STAGE=fixtures
update public.workspaces
   set test_access_flags = coalesce(test_access_flags, '{}'::jsonb) || jsonb_build_object(
         'temporary_processing_access', 'true',
         'temporary_processing_access_expires_at',
         to_char((statement_timestamp() + interval '1 hour') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
       )
 where id = ${workspace};

insert into public.contacts (
  id, workspace_id, display_name, handle, source_platform, language, status,
  tags, summary, internal_notes, is_top_fan
) values (
  ${contact}, ${workspace}, 'FanMind Push Ledger Acceptance',
  'fanmind-push-ledger-acceptance', 'manual', 'de', 'new',
  array['synthetic','staging','push-ledger-acceptance']::text[],
  'Rollback-only Mobile Push Delivery Ledger acceptance.', null, false
);

insert into public.followups (
  id, workspace_id, contact_id, due_date, priority, reason, status
) values
  (${followupPrimary}, ${workspace}, ${contact}, current_date, 'normal',
   'Synthetic delivery lifecycle acceptance.', 'open'),
  (${followupDevice}, ${workspace}, ${contact}, current_date, 'normal',
   'Synthetic atomic device revocation acceptance.', 'open');

insert into public.mobile_push_registrations (
  id, user_id, workspace_id, expo_token_ciphertext, expo_token_hash,
  expo_project_id, platform, status, registered_at, last_seen_at, expires_at
) values
  (${registrationPrimary}, ${owner}, ${workspace},
   ${primaryCiphertext}, ${primaryFingerprint}, ${project},
   'android', 'active', statement_timestamp(), statement_timestamp(),
   statement_timestamp() + interval '30 days'),
  (${registrationDevice}, ${member}, ${workspace},
   ${deviceCiphertext}, ${deviceFingerprint}, ${project},
   'android', 'active', statement_timestamp(), statement_timestamp(),
   statement_timestamp() + interval '30 days');

\echo MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_STAGE=reservation_membership
do $membership$
begin
  if not exists (
    select 1 from public.workspace_members
     where workspace_id = ${workspace} and user_id = ${owner}
       and role in ('owner', 'member')
  ) or not exists (
    select 1 from public.workspace_members
     where workspace_id = ${workspace} and user_id = ${member}
       and role in ('owner', 'member')
  ) then
    raise exception 'synthetic_membership_invalid';
  end if;
end
$membership$;

\echo MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_STAGE=reservation_workspace
do $workspace_access$
begin
  if not exists (
    select 1 from public.workspaces
     where id = ${workspace}
       and workspace_access_mode = 'active'
       and billing_status <> 'demo_free'
       and test_access_flags->>'temporary_processing_access' = 'true'
       and (test_access_flags->>'temporary_processing_access_expires_at')::timestamptz > statement_timestamp()
       and (subscription_effective_end_at is null or subscription_effective_end_at > statement_timestamp())
  ) then
    raise exception 'synthetic_workspace_access_invalid';
  end if;
end
$workspace_access$;

\echo MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_STAGE=reservation_target
do $target_binding$
begin
  if not exists (
    select 1
      from public.followups f
      join public.contacts c on c.id = f.contact_id and c.workspace_id = f.workspace_id
      join public.mobile_push_registrations r
        on r.workspace_id = f.workspace_id and r.user_id = ${owner}
     where f.id = ${followupPrimary} and f.workspace_id = ${workspace}
       and c.id = ${contact} and f.status = 'open' and f.due_date = current_date
       and r.id = ${registrationPrimary} and r.expo_project_id = ${project}
       and r.status = 'active' and r.expires_at > statement_timestamp()
       and r.expo_token_hash = ${primaryFingerprint}
  ) then
    raise exception 'synthetic_target_binding_invalid';
  end if;
end
$target_binding$;

\echo MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_STAGE=reservation
do $lifecycle$
declare
  reserved jsonb;
  duplicate_result jsonb;
  receipt_reserved jsonb;
  attempt_id uuid;
  send_lease text;
  receipt_lease text;
begin
  reserved := public.mobile_push_delivery_reserve(jsonb_build_object(
    'contactId', ${contact}::text,
    'dueDate', current_date::text,
    'dueDateCutoff', current_date::text,
    'expectedRegistrationTokenFingerprint', ${primaryFingerprint},
    'expectedSupabaseProjectRef', ${projectRef},
    'expectedTargetHash', ${primaryKey},
    'followupId', ${followupPrimary}::text,
    'idempotencyKey', ${primaryKey},
    'projectId', ${project}::text,
    'registrationId', ${registrationPrimary}::text,
    'reservedAt', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'revalidationContract', 'mobile-push-target-revalidation-v1',
    'userId', ${owner}::text,
    'workspaceId', ${workspace}::text
  ));
  if reserved->>'status' <> 'reserved'
     or reserved->>'attemptNumber' <> '1'
     or reserved->>'revalidatedTargetHash' <> ${primaryKey}
     or reserved->>'revalidatedRegistrationTokenFingerprint' <> ${primaryFingerprint}
     or reserved->>'revalidatedSupabaseProjectRef' <> ${projectRef} then
    raise exception 'initial_reservation_invalid';
  end if;
  attempt_id := (reserved->>'attemptId')::uuid;
  send_lease := reserved->>'leaseToken';

  duplicate_result := public.mobile_push_delivery_reserve(jsonb_build_object(
    'contactId', ${contact}::text,
    'dueDate', current_date::text,
    'dueDateCutoff', current_date::text,
    'expectedRegistrationTokenFingerprint', ${primaryFingerprint},
    'expectedSupabaseProjectRef', ${projectRef},
    'expectedTargetHash', ${primaryKey},
    'followupId', ${followupPrimary}::text,
    'idempotencyKey', ${primaryKey},
    'projectId', ${project}::text,
    'registrationId', ${registrationPrimary}::text,
    'reservedAt', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'revalidationContract', 'mobile-push-target-revalidation-v1',
    'userId', ${owner}::text,
    'workspaceId', ${workspace}::text
  ));
  if duplicate_result->>'status' <> 'inflight' then
    raise exception 'lease_exclusivity_invalid';
  end if;

  raise notice 'MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_STAGE=ticket';
  perform public.mobile_push_delivery_transition('markTicket', jsonb_build_object(
    'attemptId', attempt_id::text,
    'checkAfter', to_char((statement_timestamp() + interval '15 minutes') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'expiresAt', to_char((statement_timestamp() + interval '24 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'leaseToken', send_lease,
    'receiptId', 'synthetic-ledger-receipt',
    'ticketCreatedAt', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ));
  update public.mobile_push_delivery_attempts
     set receipt_check_after = statement_timestamp()
   where id = attempt_id;
  raise notice 'MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_STAGE=receipt';
  receipt_reserved := public.mobile_push_delivery_reserve_receipt(jsonb_build_object(
    'attemptId', attempt_id::text,
    'requestedAt', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ));
  if receipt_reserved->>'status' <> 'reserved'
     or receipt_reserved->>'receiptCheckNumber' <> '1' then
    raise exception 'receipt_reservation_invalid';
  end if;
  receipt_lease := receipt_reserved->>'receiptLeaseToken';
  perform public.mobile_push_delivery_transition('markReceiptAccepted', jsonb_build_object(
    'acceptedAt', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'attemptId', attempt_id::text,
    'receiptLeaseToken', receipt_lease
  ));
  if not exists (
    select 1 from public.mobile_push_delivery_attempts
     where id = attempt_id and state = 'accepted' and terminal_at is not null
       and receipt_check_count = 1
  ) then
    raise exception 'receipt_acceptance_invalid';
  end if;
end
$lifecycle$;

\echo MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_STAGE=device_revocation
do $device_revocation$
declare
  reserved jsonb;
  attempt_id uuid;
begin
  reserved := public.mobile_push_delivery_reserve(jsonb_build_object(
    'contactId', ${contact}::text,
    'dueDate', current_date::text,
    'dueDateCutoff', current_date::text,
    'expectedRegistrationTokenFingerprint', ${deviceFingerprint},
    'expectedSupabaseProjectRef', ${projectRef},
    'expectedTargetHash', ${deviceKey},
    'followupId', ${followupDevice}::text,
    'idempotencyKey', ${deviceKey},
    'projectId', ${project}::text,
    'registrationId', ${registrationDevice}::text,
    'reservedAt', to_char(statement_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'revalidationContract', 'mobile-push-target-revalidation-v1',
    'userId', ${member}::text,
    'workspaceId', ${workspace}::text
  ));
  if reserved->>'status' <> 'reserved' then
    raise exception 'device_reservation_invalid';
  end if;
  attempt_id := (reserved->>'attemptId')::uuid;
  perform public.mobile_push_delivery_transition('markDeviceNotRegistered', jsonb_build_object(
    'attemptId', attempt_id::text,
    'leaseToken', reserved->>'leaseToken',
    'reason', 'device_not_registered',
    'registrationId', ${registrationDevice}::text
  ));
  if not exists (
    select 1 from public.mobile_push_delivery_attempts
     where id = attempt_id and state = 'rejected'
       and redacted_error_code = 'device_not_registered' and terminal_at is not null
  ) or not exists (
    select 1 from public.mobile_push_registrations
     where id = ${registrationDevice} and status = 'disabled'
  ) then
    raise exception 'atomic_device_revocation_invalid';
  end if;
end
$device_revocation$;

select 'MOBILE_PUSH_DELIVERY_LEDGER_RESERVATION=PASS';
select 'MOBILE_PUSH_DELIVERY_LEDGER_LEASE_EXCLUSIVITY=PASS';
select 'MOBILE_PUSH_DELIVERY_LEDGER_RECEIPT_LIFECYCLE=PASS';
select 'MOBILE_PUSH_DELIVERY_LEDGER_ATOMIC_DEVICE_REVOCATION=PASS';
rollback;

\echo MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_STAGE=rollback_check
begin;
set transaction read only;
set local role service_role;
do $rollback_check$
begin
  if exists (
    select 1 from public.mobile_push_delivery_attempts
     where idempotency_key in (${primaryKey}, ${deviceKey})
  ) or exists (
    select 1 from public.mobile_push_registrations
     where id in (${registrationPrimary}, ${registrationDevice})
        or user_id in (${owner}, ${member})
        or expo_token_hash in (${primaryFingerprint}, ${deviceFingerprint})
  ) or exists (
    select 1 from public.followups where id in (${followupPrimary}, ${followupDevice})
  ) or exists (
    select 1 from public.contacts where id = ${contact}
  ) then
    raise exception 'rollback_cleanup_invalid';
  end if;
end
$rollback_check$;
select 'MOBILE_PUSH_DELIVERY_LEDGER_ROLLBACK=PASS';
rollback;
`;
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
    snapshotDirectory = mkdtempSync(join(tmpdir(), "fanmind-push-ledger-acceptance-"));
    const snapshotPath = join(snapshotDirectory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { snapshotDirectory, snapshotPath };
  } catch (error) {
    if (snapshotDirectory) rmSync(snapshotDirectory, { recursive: true, force: true });
    if (error instanceof Error && error.message.startsWith("MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_ERROR=")) throw error;
    fail("passfile_read_failed");
  } finally {
    content?.fill(0);
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function psqlEnvironment(environment, passfilePath) {
  const safe = { ...environment, PGPASSFILE: passfilePath, PGCONNECT_TIMEOUT: "10" };
  for (const key of ["DATABASE_URL", "POSTGRES_URL", "SUPABASE_DB_URL", "PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE", "PGSYSCONFDIR"]) delete safe[key];
  return safe;
}

function runPsql(sql, environment, passfilePath) {
  return spawnSync("psql", ["--no-password", "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1"], {
    env: psqlEnvironment(environment, passfilePath),
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

export function latestMobilePushLedgerAcceptanceStage(stdout) {
  const matches = [...String(stdout ?? "").matchAll(ACCEPTANCE_STAGE_PATTERN)];
  return matches.at(-1)?.[1] ?? "unknown";
}

export function classifyMobilePushLedgerAcceptanceFailure(output) {
  const value = String(output ?? "");
  const fixed = ACCEPTANCE_FAILURE_REASONS.find((reason) => value.includes(reason));
  if (fixed) return fixed;
  for (const [pattern, reason] of [
    [/for update/iu, "row_lock_invalid"],
    [/permission denied/iu, "permission_denied"],
    [/violates .*constraint|duplicate key/iu, "constraint_violation"],
    [/invalid input syntax/iu, "input_syntax_invalid"],
    [/operator does not exist|does not exist/iu, "schema_contract_mismatch"],
  ]) {
    if (pattern.test(value)) return reason;
  }
  return "unknown";
}

function ensurePsqlAvailable() {
  const result = spawnSync("psql", ["--version"], { stdio: "ignore" });
  if (result.error || result.status !== 0) fail("psql_unavailable");
}

async function runAcceptance(environment) {
  const evaluation = evaluateMobilePushStagingControlEnvironment(environment, { mode: "ledger_acceptance" });
  if (!evaluation.ok) fail("environment_invalid");
  ensurePsqlAvailable();
  const identifiers = {
    ...evaluation.syntheticIdentifiers,
    targetSupabaseProjectRef: environment.FANMIND_TARGET_SUPABASE_PROJECT_REF?.trim().toLowerCase() ?? "",
  };
  const { snapshotDirectory, snapshotPath } = privatePassfileSnapshot(environment);
  try {
    for (const [role, probe] of ROLE_PROBES) {
      const result = runPsql(buildMobilePushLedgerRoleDenialSql(role, probe), environment, snapshotPath);
      if (result.error || result.status === 0 || !result.stdout.includes("MOBILE_PUSH_DELIVERY_LEDGER_ROLE_SWITCH=PASS")) {
        fail("browser_boundary_invalid");
      }
    }
    const acceptance = runPsql(buildMobilePushLedgerAcceptanceSql(identifiers), environment, snapshotPath);
    const markers = [
      "MOBILE_PUSH_DELIVERY_LEDGER_RESERVATION=PASS",
      "MOBILE_PUSH_DELIVERY_LEDGER_LEASE_EXCLUSIVITY=PASS",
      "MOBILE_PUSH_DELIVERY_LEDGER_RECEIPT_LIFECYCLE=PASS",
      "MOBILE_PUSH_DELIVERY_LEDGER_ATOMIC_DEVICE_REVOCATION=PASS",
      "MOBILE_PUSH_DELIVERY_LEDGER_ROLLBACK=PASS",
    ];
    if (acceptance.error || acceptance.status !== 0 || markers.some((marker) => !acceptance.stdout.includes(marker))) {
      console.error(
        `MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_FAILURE_REASON=${classifyMobilePushLedgerAcceptanceFailure(`${acceptance.stdout}\n${acceptance.stderr}`)}`,
      );
      console.error(
        `MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_FAILURE_STAGE=${latestMobilePushLedgerAcceptanceStage(`${acceptance.stdout}\n${acceptance.stderr}`)}`,
      );
      fail("database_acceptance_failed");
    }
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
  console.log("MOBILE_PUSH_DELIVERY_LEDGER_BROWSER_DENIALS=4");
  console.log("MOBILE_PUSH_DELIVERY_LEDGER_RESERVATION=PASS");
  console.log("MOBILE_PUSH_DELIVERY_LEDGER_LEASE_EXCLUSIVITY=PASS");
  console.log("MOBILE_PUSH_DELIVERY_LEDGER_RECEIPT_LIFECYCLE=PASS");
  console.log("MOBILE_PUSH_DELIVERY_LEDGER_ATOMIC_DEVICE_REVOCATION=PASS");
  console.log("MOBILE_PUSH_DELIVERY_LEDGER_TRANSACTION=ROLLED_BACK");
  console.log("MOBILE_PUSH_DELIVERY_LEDGER_CLEANUP=PASS");
  console.log("MOBILE_PUSH_PROVIDER_SEND=disabled");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  console.log("MOBILE_PUSH_DELIVERY_LEDGER_STAGING_ACCEPTANCE=PASS");
}

async function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  if (mode === "--check") {
    const identifiers = {
      workspaceId: "11111111-1111-4111-8111-111111111111",
      ownerUserId: "22222222-2222-4222-8222-222222222222",
      memberUserId: "33333333-3333-4333-8333-333333333333",
      easProjectId: "44444444-4444-4444-8444-444444444444",
      deviceId: "55555555-5555-4555-8555-555555555555",
      targetSupabaseProjectRef: "stagingref12345",
    };
    const sql = buildMobilePushLedgerAcceptanceSql(identifiers);
    if (!sql.includes("MOBILE_PUSH_DELIVERY_LEDGER_ROLLBACK=PASS") || /\bcommit\s*;/iu.test(sql)) fail("offline_contract_invalid");
    console.log("MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_MODE=check");
    console.log("MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_READY=YES");
    return;
  }
  console.log("MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_MODE=run");
  await runAcceptance(process.env);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    if (error instanceof Error && /^MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_ERROR=[a-z0-9_]+$/u.test(error.message)) console.error(error.message);
    else console.error("MOBILE_PUSH_DELIVERY_LEDGER_ACCEPTANCE_ERROR=unexpected_failure");
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  });
}
