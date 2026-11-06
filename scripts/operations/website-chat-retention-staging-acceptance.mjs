#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  closeSync, constants, fstatSync, mkdtempSync, openSync,
  readSync, rmSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  WEBSITE_CHAT_STAGING_UUID_PATTERN,
} from "../../src/lib/websiteChatStagingControlPolicy.mjs";
import {
  evaluateWebsiteChatRetentionStagingEnvironment,
} from "../../src/lib/websiteChatRetentionStagingPolicy.mjs";

const MAX_PASSFILE_BYTES = 64 * 1024;
const ORIGIN = "https://website-chat-retention.invalid";
const ROLE_PROBES = Object.freeze([
  Object.freeze(["anon", "table"]),
  Object.freeze(["authenticated", "table"]),
  Object.freeze(["anon", "function"]),
  Object.freeze(["authenticated", "function"]),
]);

function fail(code) {
  throw new Error(`WEBSITE_CHAT_RETENTION_ACCEPTANCE_ERROR=${code}`);
}

function deriveUuid(workspaceId, label) {
  if (!WEBSITE_CHAT_STAGING_UUID_PATTERN.test(workspaceId)) fail("workspace_invalid");
  const hex = createHash("sha256")
    .update(`fanmind-website-chat-retention:${workspaceId}:${label}`)
    .digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16], 16) % 4];
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export function deriveWebsiteChatRetentionMaterial(workspaceId) {
  const labels = [
    "installation", "public-installation", "foreign-workspace",
    "eligible-session", "protected-session", "dry-session",
    "eligible-contact", "protected-contact",
    "eligible-conversation", "protected-conversation",
    "eligible-message", "protected-message",
    "eligible-client-message", "protected-client-message",
    "eligible-handoff", "protected-handoff",
    "eligible-client-handoff", "protected-client-handoff",
  ];
  return Object.freeze(Object.fromEntries([
    ["workspaceId", workspaceId],
    ...labels.map((label) => [
      label.replace(/-([a-z])/gu, (_, character) => character.toUpperCase()) + "Id",
      deriveUuid(workspaceId, label),
    ]),
  ]));
}

function sqlUuid(value) {
  if (!WEBSITE_CHAT_STAGING_UUID_PATTERN.test(value)) fail("identifier_invalid");
  return `'${value}'::uuid`;
}

export function buildWebsiteChatRetentionRoleDenialSql(role, boundary = "function") {
  if (!ROLE_PROBES.some(([candidateRole, candidateBoundary]) =>
    candidateRole === role && candidateBoundary === boundary)) fail("role_probe_invalid");
  const probe = boundary === "table"
    ? "select session_id from public.website_chat_message_receipts limit 1;"
    : "select * from public.manage_website_chat_retention(1, false, null);";
  return String.raw`
\set ON_ERROR_STOP on
begin;
set local role ${role};
select 'WEBSITE_CHAT_RETENTION_ROLE_SWITCH=PASS';
${probe}
rollback;
`;
}

export function buildWebsiteChatRetentionAcceptanceSql(workspaceId) {
  const material = deriveWebsiteChatRetentionMaterial(workspaceId);
  const id = Object.fromEntries(
    Object.entries(material).map(([key, value]) => [key, sqlUuid(value)]),
  );
  const eligibleHash = createHash("sha256").update(`${workspaceId}:eligible`).digest("hex");
  const protectedHash = createHash("sha256").update(`${workspaceId}:protected`).digest("hex");
  const dryHash = createHash("sha256").update(`${workspaceId}:dry`).digest("hex");
  return String.raw`
\set ON_ERROR_STOP on
begin;
set local role service_role;
\echo WEBSITE_CHAT_RETENTION_ACCEPTANCE_STAGE=preflight

do $preflight$
begin
  if to_regprocedure('public.manage_website_chat_retention(integer,boolean,uuid)') is null
     or not exists (
       select 1 from public.workspaces
        where id = ${id.workspaceId}
          and test_access_flags->>'staging_synthetic_fixture' = 'true'
          and test_access_flags->>'workspace_processing_acceptance' = 'true'
     ) then
    raise exception 'website_chat_retention_acceptance_prerequisite_missing';
  end if;
  if exists (
    select 1 from public.website_chat_installations
     where id = ${id.installationId}
        or public_installation_id = ${id.publicInstallationId}
  ) or exists (
    select 1 from public.website_chat_visitor_sessions
     where id in (${id.eligibleSessionId}, ${id.protectedSessionId}, ${id.drySessionId})
  ) or exists (
    select 1 from public.contacts
     where id in (${id.eligibleContactId}, ${id.protectedContactId})
  ) then
    raise exception 'website_chat_retention_fixture_not_clean';
  end if;
end
$preflight$;

\echo WEBSITE_CHAT_RETENTION_ACCEPTANCE_STAGE=fixtures
insert into public.website_chat_installations (
  id, workspace_id, public_installation_id, label, enabled,
  consent_version, session_ttl_minutes, message_retention_days
) values (
  ${id.installationId}, ${id.workspaceId}, ${id.publicInstallationId},
  'Website Chat retention rollback-only acceptance', false,
  'website-chat-retention-v1', 60, 30
);
insert into public.website_chat_allowed_origins (
  installation_id, workspace_id, origin, verified_at
) values (${id.installationId}, ${id.workspaceId}, '${ORIGIN}', statement_timestamp());

insert into public.website_chat_visitor_sessions (
  id, installation_id, workspace_id, origin, visitor_subject_hash,
  consent_version, consent_granted_at, expires_at, last_seen_at, revoked_at
) values
  (${id.eligibleSessionId}, ${id.installationId}, ${id.workspaceId}, '${ORIGIN}',
   '${eligibleHash}', 'website-chat-retention-v1', statement_timestamp() - interval '40 minutes',
   statement_timestamp() + interval '10 minutes', statement_timestamp(), statement_timestamp()),
  (${id.protectedSessionId}, ${id.installationId}, ${id.workspaceId}, '${ORIGIN}',
   '${protectedHash}', 'website-chat-retention-v1', statement_timestamp() - interval '20 minutes',
   statement_timestamp() + interval '30 minutes', statement_timestamp(), statement_timestamp()),
  (${id.drySessionId}, ${id.installationId}, ${id.workspaceId}, '${ORIGIN}',
   '${dryHash}', 'website-chat-retention-v1', statement_timestamp() - interval '30 minutes',
   statement_timestamp() + interval '20 minutes', statement_timestamp(), statement_timestamp());

insert into public.contacts (id, workspace_id, display_name, source_platform)
values
  (${id.eligibleContactId}, ${id.workspaceId}, 'Retention eligible fixture', 'website-chat'),
  (${id.protectedContactId}, ${id.workspaceId}, 'Retention protected fixture', 'website-chat');
insert into public.conversations (
  id, workspace_id, contact_id, source_platform, source_type, last_message_preview
) values
  (${id.eligibleConversationId}, ${id.workspaceId}, ${id.eligibleContactId}, 'website-chat', 'form', 'Retention eligible fixture'),
  (${id.protectedConversationId}, ${id.workspaceId}, ${id.protectedContactId}, 'website-chat', 'form', 'Retention protected fixture');
insert into public.conversation_messages (
  id, workspace_id, conversation_id, contact_id, direction,
  message_type, source_platform, content
) values
  (${id.eligibleMessageId}, ${id.workspaceId}, ${id.eligibleConversationId}, ${id.eligibleContactId}, 'inbound', 'form', 'website-chat', 'Retention eligible fixture'),
  (${id.protectedMessageId}, ${id.workspaceId}, ${id.protectedConversationId}, ${id.protectedContactId}, 'inbound', 'form', 'website-chat', 'Retention protected fixture');
insert into public.website_chat_message_receipts (
  session_id, installation_id, workspace_id, client_message_id,
  contact_id, conversation_id, message_id
) values
  (${id.eligibleSessionId}, ${id.installationId}, ${id.workspaceId}, ${id.eligibleClientMessageId},
   ${id.eligibleContactId}, ${id.eligibleConversationId}, ${id.eligibleMessageId}),
  (${id.protectedSessionId}, ${id.installationId}, ${id.workspaceId}, ${id.protectedClientMessageId},
   ${id.protectedContactId}, ${id.protectedConversationId}, ${id.protectedMessageId});
insert into public.website_chat_handoffs (
  id, session_id, installation_id, workspace_id, client_handoff_id,
  contact_id, conversation_id, note_message_id, visitor_email_fingerprint,
  consent_version, consent_granted_at, status, expires_at
) values
  (${id.eligibleHandoffId}, ${id.eligibleSessionId}, ${id.installationId}, ${id.workspaceId}, ${id.eligibleClientHandoffId},
   ${id.eligibleContactId}, ${id.eligibleConversationId}, ${id.eligibleMessageId}, '${eligibleHash}',
   'website-chat-retention-v1', statement_timestamp() - interval '2 days', 'expired', statement_timestamp() - interval '1 day'),
  (${id.protectedHandoffId}, ${id.protectedSessionId}, ${id.installationId}, ${id.workspaceId}, ${id.protectedClientHandoffId},
   ${id.protectedContactId}, ${id.protectedConversationId}, ${id.protectedMessageId}, '${protectedHash}',
   'website-chat-retention-v1', statement_timestamp(), 'requested', statement_timestamp() + interval '1 day');

\echo WEBSITE_CHAT_RETENTION_ACCEPTANCE_STAGE=invalid_inputs
do $invalid_inputs$
declare
  rejected integer := 0;
begin
  begin
    perform * from public.manage_website_chat_retention(0, false, ${id.workspaceId});
  exception when sqlstate '22023' then
    rejected := rejected + 1;
  end;
  begin
    perform * from public.manage_website_chat_retention(1001, false, ${id.workspaceId});
  exception when sqlstate '22023' then
    rejected := rejected + 1;
  end;
  begin
    perform * from public.manage_website_chat_retention(1, null, ${id.workspaceId});
  exception when sqlstate '22023' then
    rejected := rejected + 1;
  end;
  if rejected <> 3 then
    raise exception 'website_chat_retention_invalid_inputs_not_rejected';
  end if;
end
$invalid_inputs$;
select 'WEBSITE_CHAT_RETENTION_INVALID_INPUTS=PASS';

\echo WEBSITE_CHAT_RETENTION_ACCEPTANCE_STAGE=workspace_scope
do $workspace_scope$
declare result record;
begin
  select * into result
    from public.manage_website_chat_retention(100, false, ${id.foreignWorkspaceId});
  if result.candidate_session_count <> 0
     or result.candidate_receipt_count <> 0
     or result.candidate_handoff_count <> 0
     or result.deleted_session_count <> 0
     or result.has_more is not false then
    raise exception 'website_chat_retention_workspace_scope_invalid';
  end if;
end
$workspace_scope$;
select 'WEBSITE_CHAT_RETENTION_WORKSPACE_SCOPE=PASS';

\echo WEBSITE_CHAT_RETENTION_ACCEPTANCE_STAGE=dry_run
do $dry_run$
declare result record;
begin
  select * into result
    from public.manage_website_chat_retention(100, false, ${id.workspaceId});
  if result.candidate_session_count <> 2
     or result.candidate_receipt_count <> 1
     or result.candidate_handoff_count <> 1
     or result.deleted_session_count <> 0
     or result.has_more is not true
     or not exists (select 1 from public.website_chat_visitor_sessions where id = ${id.eligibleSessionId})
     or not exists (select 1 from public.website_chat_visitor_sessions where id = ${id.drySessionId}) then
    raise exception 'website_chat_retention_dry_run_invalid';
  end if;
end
$dry_run$;
select 'WEBSITE_CHAT_RETENTION_DRY_RUN=PASS';

\echo WEBSITE_CHAT_RETENTION_ACCEPTANCE_STAGE=bounded_execute
do $bounded$
declare result record;
begin
  select * into result
    from public.manage_website_chat_retention(1, true, ${id.workspaceId});
  if result.candidate_session_count <> 1
     or result.candidate_receipt_count <> 1
     or result.candidate_handoff_count <> 1
     or result.deleted_session_count <> 1
     or result.has_more is not true
     or exists (select 1 from public.website_chat_visitor_sessions where id = ${id.eligibleSessionId})
     or exists (select 1 from public.website_chat_message_receipts where session_id = ${id.eligibleSessionId})
     or exists (select 1 from public.website_chat_handoffs where session_id = ${id.eligibleSessionId})
     or not exists (select 1 from public.contacts where id = ${id.eligibleContactId})
     or not exists (select 1 from public.conversations where id = ${id.eligibleConversationId})
     or not exists (select 1 from public.conversation_messages where id = ${id.eligibleMessageId}) then
    raise exception 'website_chat_retention_bounded_execute_invalid';
  end if;
end
$bounded$;
select 'WEBSITE_CHAT_RETENTION_BOUNDED_DELETE=PASS';
select 'WEBSITE_CHAT_RETENTION_CRM_PRESERVED=PASS';

\echo WEBSITE_CHAT_RETENTION_ACCEPTANCE_STAGE=active_handoff
do $active_handoff$
declare result record;
begin
  select * into result
    from public.manage_website_chat_retention(100, true, ${id.workspaceId});
  if result.candidate_session_count <> 1
     or result.candidate_receipt_count <> 0
     or result.candidate_handoff_count <> 0
     or result.deleted_session_count <> 1
     or result.has_more is not false
     or exists (select 1 from public.website_chat_visitor_sessions where id = ${id.drySessionId})
     or not exists (select 1 from public.website_chat_visitor_sessions where id = ${id.protectedSessionId})
     or not exists (select 1 from public.website_chat_message_receipts where session_id = ${id.protectedSessionId})
     or not exists (select 1 from public.website_chat_handoffs where session_id = ${id.protectedSessionId})
     or not exists (select 1 from public.contacts where id = ${id.protectedContactId})
     or not exists (select 1 from public.conversations where id = ${id.protectedConversationId})
     or not exists (select 1 from public.conversation_messages where id = ${id.protectedMessageId}) then
    raise exception 'website_chat_retention_active_handoff_invalid';
  end if;
end
$active_handoff$;
select 'WEBSITE_CHAT_RETENTION_ACTIVE_HANDOFF=PASS';
rollback;

\echo WEBSITE_CHAT_RETENTION_ACCEPTANCE_STAGE=rollback
begin;
set transaction read only;
set local role service_role;
do $rollback_check$
begin
  if exists (
    select 1 from public.website_chat_installations where id = ${id.installationId}
  ) or exists (
    select 1 from public.website_chat_visitor_sessions
     where id in (${id.eligibleSessionId}, ${id.protectedSessionId}, ${id.drySessionId})
  ) or exists (
    select 1 from public.contacts where id in (${id.eligibleContactId}, ${id.protectedContactId})
  ) or exists (
    select 1 from public.conversations where id in (${id.eligibleConversationId}, ${id.protectedConversationId})
  ) or exists (
    select 1 from public.conversation_messages where id in (${id.eligibleMessageId}, ${id.protectedMessageId})
  ) then
    raise exception 'website_chat_retention_rollback_failed';
  end if;
end
$rollback_check$;
select 'WEBSITE_CHAT_RETENTION_ROLLBACK=PASS';
rollback;
`;
}

function privatePassfileSnapshot(environment) {
  const sourcePath = environment.PGPASSFILE?.trim();
  if (!sourcePath || !isAbsolute(sourcePath)) fail("passfile_missing");
  let descriptor;
  let directory;
  let content;
  try {
    descriptor = openSync(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || (opened.mode & 0o777) !== 0o600 || opened.size < 1 || opened.size > MAX_PASSFILE_BYTES || (typeof process.getuid === "function" && opened.uid !== process.getuid())) fail("passfile_invalid");
    content = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < content.length) {
      const count = readSync(descriptor, content, offset, content.length - offset, offset);
      if (count === 0) fail("passfile_read_failed");
      offset += count;
    }
    const settled = fstatSync(descriptor);
    if (settled.dev !== opened.dev || settled.ino !== opened.ino || settled.size !== opened.size || settled.mtimeMs !== opened.mtimeMs || settled.ctimeMs !== opened.ctimeMs) fail("passfile_changed");
    directory = mkdtempSync(join(tmpdir(), "fanmind-website-chat-retention-acceptance-"));
    const snapshotPath = join(directory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { directory, snapshotPath };
  } catch (error) {
    if (directory) rmSync(directory, { recursive: true, force: true });
    if (error instanceof Error && error.message.startsWith("WEBSITE_CHAT_RETENTION_ACCEPTANCE_ERROR=")) throw error;
    fail("passfile_read_failed");
  } finally {
    content?.fill(0);
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function runPsql(sql, environment, passfilePath) {
  const safe = { ...environment, PGPASSFILE: passfilePath, PGCONNECT_TIMEOUT: "10" };
  for (const key of ["DATABASE_URL", "POSTGRES_URL", "SUPABASE_DB_URL", "PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE", "PGSYSCONFDIR"]) delete safe[key];
  return spawnSync("psql", ["--no-password", "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1"], { env: safe, input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}

function runAcceptance(environment) {
  const policy = evaluateWebsiteChatRetentionStagingEnvironment(environment, { mode: "acceptance" });
  if (!policy.ok) fail("environment_invalid");
  const version = spawnSync("psql", ["--version"], { stdio: "ignore" });
  if (version.error || version.status !== 0) fail("psql_unavailable");
  const { directory, snapshotPath } = privatePassfileSnapshot(environment);
  try {
    for (const [role, boundary] of ROLE_PROBES) {
      const result = runPsql(
        buildWebsiteChatRetentionRoleDenialSql(role, boundary),
        environment,
        snapshotPath,
      );
      const expectedDenial = boundary === "table"
        ? /permission denied for table website_chat_message_receipts/iu
        : /permission denied for function manage_website_chat_retention/iu;
      if (
        result.error || result.status === 0 ||
        !result.stdout.includes("WEBSITE_CHAT_RETENTION_ROLE_SWITCH=PASS") ||
        !expectedDenial.test(result.stderr)
      ) fail("browser_boundary_invalid");
    }
    const result = runPsql(buildWebsiteChatRetentionAcceptanceSql(policy.workspaceId), environment, snapshotPath);
    const markers = [
      "WEBSITE_CHAT_RETENTION_INVALID_INPUTS=PASS",
      "WEBSITE_CHAT_RETENTION_DRY_RUN=PASS",
      "WEBSITE_CHAT_RETENTION_BOUNDED_DELETE=PASS",
      "WEBSITE_CHAT_RETENTION_CRM_PRESERVED=PASS",
      "WEBSITE_CHAT_RETENTION_ACTIVE_HANDOFF=PASS",
      "WEBSITE_CHAT_RETENTION_WORKSPACE_SCOPE=PASS",
      "WEBSITE_CHAT_RETENTION_ROLLBACK=PASS",
    ];
    if (result.error || result.status !== 0 || markers.some((marker) => !result.stdout.includes(marker))) fail("database_acceptance_failed");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  console.log("WEBSITE_CHAT_RETENTION_BROWSER_DENIALS=4");
  console.log("WEBSITE_CHAT_RETENTION_TRANSACTION=ROLLED_BACK");
  console.log("WEBSITE_CHAT_RETENTION_CLEANUP=PASS");
  console.log("WEBSITE_CHAT_RETENTION_SCHEDULE=disabled");
  console.log("WEBSITE_CHAT_AI=disabled");
  console.log("WEBSITE_CHAT_EMAIL_DELIVERY=disabled");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  console.log("WEBSITE_CHAT_RETENTION_STAGING_ACCEPTANCE=PASS");
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !new Set(["--check", "--run"]).has(args[0])) fail("argument_invalid");
  if (args[0] === "--check") {
    const sql = buildWebsiteChatRetentionAcceptanceSql("11111111-1111-4111-8111-111111111111");
    if (/\bcommit\s*;/iu.test(sql) || !sql.includes("WEBSITE_CHAT_RETENTION_ROLLBACK=PASS")) fail("offline_contract_invalid");
    console.log("WEBSITE_CHAT_RETENTION_ACCEPTANCE_MODE=check");
    console.log("WEBSITE_CHAT_RETENTION_ACCEPTANCE_READY=YES");
    return;
  }
  runAcceptance(process.env);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); }
  catch (error) {
    console.error(error instanceof Error && /^WEBSITE_CHAT_RETENTION_ACCEPTANCE_ERROR=[a-z0-9_]+$/u.test(error.message) ? error.message : "WEBSITE_CHAT_RETENTION_ACCEPTANCE_ERROR=unexpected_failure");
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  }
}
