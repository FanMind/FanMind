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
  evaluateWebsiteChatStagingControlEnvironment,
} from "../../src/lib/websiteChatStagingControlPolicy.mjs";

const MAX_PASSFILE_BYTES = 64 * 1024;
const ORIGIN = "https://website-chat-acceptance.invalid";
const EMAIL = "website-chat-acceptance@example.invalid";
const ROLE_PROBES = Object.freeze([
  ["anon", "table"],
  ["authenticated", "table"],
  ["anon", "handoff"],
]);

function fail(code) {
  throw new Error(`WEBSITE_CHAT_HANDOFF_ACCEPTANCE_ERROR=${code}`);
}

function deriveUuid(workspaceId, label) {
  if (!WEBSITE_CHAT_STAGING_UUID_PATTERN.test(workspaceId)) fail("workspace_invalid");
  const hex = createHash("sha256")
    .update(`fanmind-website-chat-handoff:${workspaceId}:${label}`)
    .digest("hex").slice(0, 32).split("");
  hex[12] = "4";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16], 16) % 4];
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

export function deriveWebsiteChatAcceptanceMaterial(workspaceId) {
  return Object.freeze({
    workspaceId,
    installationId: deriveUuid(workspaceId, "installation"),
    publicInstallationId: deriveUuid(workspaceId, "public-installation"),
    sessionId: deriveUuid(workspaceId, "session"),
    emptySessionId: deriveUuid(workspaceId, "empty-session"),
    clientMessageId: deriveUuid(workspaceId, "message"),
    clientHandoffId: deriveUuid(workspaceId, "handoff"),
    emptyClientHandoffId: deriveUuid(workspaceId, "empty-handoff"),
    visitorSubjectHash: createHash("sha256")
      .update(`fanmind-website-chat-subject:${workspaceId}`).digest("hex"),
    emptyVisitorSubjectHash: createHash("sha256")
      .update(`fanmind-website-chat-empty-subject:${workspaceId}`).digest("hex"),
  });
}

function sqlUuid(value) {
  if (!WEBSITE_CHAT_STAGING_UUID_PATTERN.test(value)) fail("identifier_invalid");
  return `'${value}'::uuid`;
}

export function buildWebsiteChatRoleDenialSql(role, probe) {
  if (!new Set(["anon", "authenticated"]).has(role)) fail("role_probe_invalid");
  if (!new Set(["table", "handoff"]).has(probe)) fail("role_probe_invalid");
  const statement = probe === "table"
    ? "select id from public.website_chat_handoffs limit 1;"
    : `select public.request_website_chat_handoff(
        '11111111-1111-4111-8111-111111111111'::uuid,
        '${ORIGIN}', repeat('a', 64),
        '22222222-2222-4222-8222-222222222222'::uuid,
        '${EMAIL}', 'website-chat-acceptance-v1'
      );`;
  return String.raw`
\set ON_ERROR_STOP on
begin;
set local role ${role};
select 'WEBSITE_CHAT_HANDOFF_ROLE_SWITCH=PASS';
${statement}
rollback;
`;
}

export function buildWebsiteChatAcceptanceSql(workspaceId) {
  const material = deriveWebsiteChatAcceptanceMaterial(workspaceId);
  const workspace = sqlUuid(material.workspaceId);
  const installation = sqlUuid(material.installationId);
  const publicInstallation = sqlUuid(material.publicInstallationId);
  const session = sqlUuid(material.sessionId);
  const emptySession = sqlUuid(material.emptySessionId);
  const clientMessage = sqlUuid(material.clientMessageId);
  const clientHandoff = sqlUuid(material.clientHandoffId);
  const emptyClientHandoff = sqlUuid(material.emptyClientHandoffId);
  return String.raw`
\set ON_ERROR_STOP on
begin;
set local role service_role;
\echo WEBSITE_CHAT_HANDOFF_ACCEPTANCE_STAGE=preflight

do $preflight$
begin
  if to_regclass('public.website_chat_handoffs') is null
     or to_regprocedure('public.ingest_website_chat_message_v2(uuid,text,text,uuid,text)') is null
     or to_regprocedure('public.request_website_chat_handoff(uuid,text,text,uuid,text,text)') is null
     or not exists (
       select 1
         from public.workspaces
        where id = ${workspace}
          and test_access_flags->>'staging_synthetic_fixture' = 'true'
          and test_access_flags->>'workspace_processing_acceptance' = 'true'
     ) then
    raise exception 'website_chat_acceptance_prerequisite_missing';
  end if;
  if exists (select 1 from public.website_chat_installations where id = ${installation} or public_installation_id = ${publicInstallation})
     or exists (select 1 from public.website_chat_allowed_origins where origin = '${ORIGIN}')
     or exists (select 1 from public.website_chat_visitor_sessions where id in (${session}, ${emptySession}))
     or exists (select 1 from public.website_chat_message_receipts where client_message_id = ${clientMessage})
     or exists (select 1 from public.website_chat_handoffs where client_handoff_id in (${clientHandoff}, ${emptyClientHandoff}))
     or exists (
       select 1 from public.contacts
        where workspace_id = ${workspace}
          and handle = '${EMAIL}' and source_platform = 'website-chat'
     ) then
    raise exception 'website_chat_acceptance_fixture_not_clean';
  end if;
end
$preflight$;

\echo WEBSITE_CHAT_HANDOFF_ACCEPTANCE_STAGE=fixtures
update public.workspaces
   set test_access_flags = coalesce(test_access_flags, '{}'::jsonb) || jsonb_build_object(
         'temporary_processing_access', 'true',
         'temporary_processing_access_expires_at',
         to_char((statement_timestamp() + interval '1 hour') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
       )
 where id = ${workspace};

do $processing_gate$
begin
  if not public.website_chat_processing_allowed(${workspace}) then
    raise exception 'website_chat_acceptance_processing_gate_closed';
  end if;
end
$processing_gate$;

insert into public.website_chat_installations (
  id, workspace_id, public_installation_id, label, enabled,
  consent_version, session_ttl_minutes, message_retention_days
) values (
  ${installation}, ${workspace}, ${publicInstallation},
  'Website Chat rollback-only acceptance', true,
  'website-chat-acceptance-v1', 60, 30
);
insert into public.website_chat_allowed_origins (
  installation_id, workspace_id, origin, verified_at
) values (${installation}, ${workspace}, '${ORIGIN}', statement_timestamp());
insert into public.website_chat_visitor_sessions (
  id, installation_id, workspace_id, origin, visitor_subject_hash,
  consent_version, consent_granted_at, expires_at, last_seen_at
) values (
  ${session}, ${installation}, ${workspace}, '${ORIGIN}',
  '${material.visitorSubjectHash}', 'website-chat-acceptance-v1',
  statement_timestamp(), statement_timestamp() + interval '1 hour',
  statement_timestamp()
);
insert into public.website_chat_visitor_sessions (
  id, installation_id, workspace_id, origin, visitor_subject_hash,
  consent_version, consent_granted_at, expires_at, last_seen_at
) values (
  ${emptySession}, ${installation}, ${workspace}, '${ORIGIN}',
  '${material.emptyVisitorSubjectHash}', 'website-chat-acceptance-v1',
  statement_timestamp(), statement_timestamp() + interval '1 hour',
  statement_timestamp()
);

\echo WEBSITE_CHAT_HANDOFF_ACCEPTANCE_STAGE=lifecycle
do $lifecycle$
declare
  accepted boolean;
  duplicate boolean;
  conversation_id uuid;
  message_id uuid;
  handoff_id uuid;
  first_conversation_id uuid;
  first_message_id uuid;
  first_handoff_id uuid;
begin
  select result.accepted
    into accepted
    from public.request_website_chat_handoff(
      ${publicInstallation}, '${ORIGIN}', '${material.emptyVisitorSubjectHash}',
      ${emptyClientHandoff}, '${EMAIL}', 'website-chat-acceptance-v1'
    ) as result;
  if accepted is not false then
    raise exception 'website_chat_handoff_without_message_not_rejected';
  end if;

  select result.accepted, result.duplicate, result.conversation_id, result.message_id
    into accepted, duplicate, conversation_id, message_id
    from public.ingest_website_chat_message_v2(
      ${publicInstallation}, '${ORIGIN}', '${material.visitorSubjectHash}',
      ${clientMessage}, 'Rollback-only Website Chat acceptance message.'
    ) as result;
  if accepted is not true or duplicate is not false or conversation_id is null or message_id is null then
    raise exception 'website_chat_message_acceptance_failed';
  end if;
  first_conversation_id := conversation_id;
  first_message_id := message_id;

  select result.accepted, result.duplicate, result.conversation_id, result.message_id
    into accepted, duplicate, conversation_id, message_id
    from public.ingest_website_chat_message_v2(
      ${publicInstallation}, '${ORIGIN}', '${material.visitorSubjectHash}',
      ${clientMessage}, 'Rollback-only Website Chat acceptance message.'
    ) as result;
  if accepted is not true or duplicate is not true
     or conversation_id is distinct from first_conversation_id
     or message_id is distinct from first_message_id then
    raise exception 'website_chat_message_idempotency_failed';
  end if;

  select result.accepted, result.duplicate, result.conversation_id, result.handoff_id
    into accepted, duplicate, conversation_id, handoff_id
    from public.request_website_chat_handoff(
      ${publicInstallation}, '${ORIGIN}', '${material.visitorSubjectHash}',
      ${clientHandoff}, '${EMAIL}', 'website-chat-acceptance-v1'
    ) as result;
  if accepted is not true or duplicate is not false or conversation_id is null or handoff_id is null then
    raise exception 'website_chat_handoff_acceptance_failed';
  end if;
  if conversation_id is distinct from first_conversation_id then
    raise exception 'website_chat_handoff_conversation_changed';
  end if;
  first_handoff_id := handoff_id;

  select result.accepted, result.duplicate, result.conversation_id, result.handoff_id
    into accepted, duplicate, conversation_id, handoff_id
    from public.request_website_chat_handoff(
      ${publicInstallation}, '${ORIGIN}', '${material.visitorSubjectHash}',
      ${clientHandoff}, '${EMAIL}', 'website-chat-acceptance-v1'
    ) as result;
  if accepted is not true or duplicate is not true
     or conversation_id is distinct from first_conversation_id
     or handoff_id is distinct from first_handoff_id then
    raise exception 'website_chat_handoff_idempotency_failed';
  end if;

  select result.accepted
    into accepted
    from public.ingest_website_chat_message_v2(
      ${publicInstallation}, 'https://wrong-origin.invalid',
      '${material.visitorSubjectHash}', gen_random_uuid(), 'Must fail.'
    ) as result;
  if accepted is not false then
    raise exception 'website_chat_wrong_origin_not_rejected';
  end if;

  select result.accepted
    into accepted
    from public.request_website_chat_handoff(
      ${publicInstallation}, 'https://wrong-origin.invalid',
      '${material.visitorSubjectHash}', gen_random_uuid(),
      '${EMAIL}', 'website-chat-acceptance-v1'
    ) as result;
  if accepted is not false then
    raise exception 'website_chat_handoff_wrong_origin_not_rejected';
  end if;
end
$lifecycle$;

\echo WEBSITE_CHAT_HANDOFF_ACCEPTANCE_STAGE=assertions
do $assertions$
begin
  if not exists (
    select 1
      from public.website_chat_handoffs handoff
      join public.contacts contact on contact.id = handoff.contact_id
      join public.conversations conversation on conversation.id = handoff.conversation_id
     where handoff.session_id = ${session}
       and handoff.client_handoff_id = ${clientHandoff}
       and handoff.consent_purpose = 'human_reply_by_email'
       and handoff.visitor_email_fingerprint = encode(
         digest(convert_to('${EMAIL}', 'UTF8'), 'sha256'), 'hex'
       )
       and contact.workspace_id = ${workspace}
       and contact.handle = '${EMAIL}'
       and conversation.workspace_id = ${workspace}
       and conversation.priority = 'high'
       and conversation.next_step = 'Persönlich per E-Mail antworten'
  ) or (select count(*) from public.website_chat_message_receipts where session_id = ${session}) <> 1
    or (select count(*) from public.website_chat_handoffs where session_id = ${session}) <> 1
    or (
      select count(*) from public.conversation_messages
       where conversation_id = (
         select receipt.conversation_id
           from public.website_chat_message_receipts as receipt
          where receipt.session_id = ${session}
          limit 1
       )
         and workspace_id = ${workspace}
         and source_platform = 'website-chat'
    ) <> 2
    or exists (
      select 1 from public.conversation_messages
       where conversation_id = (
         select receipt.conversation_id
           from public.website_chat_message_receipts as receipt
          where receipt.session_id = ${session}
          limit 1
       )
         and workspace_id = ${workspace} and source_platform = 'website-chat'
         and direction = 'outbound'
    )
    or exists (
      select 1 from public.website_chat_handoffs
       where session_id = ${emptySession}
    ) then
    raise exception 'website_chat_handoff_persistence_invalid';
  end if;
end
$assertions$;

select 'WEBSITE_CHAT_HANDOFF_MESSAGE=PASS';
select 'WEBSITE_CHAT_HANDOFF_MESSAGE_REQUIRED=PASS';
select 'WEBSITE_CHAT_HANDOFF_IDEMPOTENCY=PASS';
select 'WEBSITE_CHAT_HANDOFF_ORIGIN_REJECTION=PASS';
select 'WEBSITE_CHAT_HANDOFF_WRONG_ORIGIN_REJECTION=PASS';
select 'WEBSITE_CHAT_HANDOFF_CRM_LINKAGE=PASS';
rollback;

\echo WEBSITE_CHAT_HANDOFF_ACCEPTANCE_STAGE=rollback
begin;
set transaction read only;
set local role service_role;
do $rollback_check$
begin
  if exists (select 1 from public.website_chat_installations where id = ${installation} or public_installation_id = ${publicInstallation})
     or exists (select 1 from public.website_chat_allowed_origins where origin = '${ORIGIN}')
     or exists (select 1 from public.website_chat_visitor_sessions where id in (${session}, ${emptySession}))
     or exists (select 1 from public.website_chat_message_receipts where client_message_id = ${clientMessage})
     or exists (select 1 from public.website_chat_handoffs where client_handoff_id in (${clientHandoff}, ${emptyClientHandoff}))
     or exists (
       select 1 from public.contacts
        where workspace_id = ${workspace}
          and handle = '${EMAIL}' and source_platform = 'website-chat'
     ) then
    raise exception 'website_chat_acceptance_rollback_failed';
  end if;
end
$rollback_check$;
select 'WEBSITE_CHAT_HANDOFF_ROLLBACK=PASS';
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
    directory = mkdtempSync(join(tmpdir(), "fanmind-website-chat-acceptance-"));
    const snapshotPath = join(directory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { directory, snapshotPath };
  } catch (error) {
    if (directory) rmSync(directory, { recursive: true, force: true });
    if (error instanceof Error && error.message.startsWith("WEBSITE_CHAT_HANDOFF_ACCEPTANCE_ERROR=")) throw error;
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
  const policy = evaluateWebsiteChatStagingControlEnvironment(environment, { mode: "acceptance" });
  if (!policy.ok) fail("environment_invalid");
  const version = spawnSync("psql", ["--version"], { stdio: "ignore" });
  if (version.error || version.status !== 0) fail("psql_unavailable");
  const { directory, snapshotPath } = privatePassfileSnapshot(environment);
  try {
    for (const [role, probe] of ROLE_PROBES) {
      const result = runPsql(buildWebsiteChatRoleDenialSql(role, probe), environment, snapshotPath);
      const expectedDenial = probe === "table"
        ? /permission denied for table website_chat_handoffs/iu
        : /permission denied for function request_website_chat_handoff/iu;
      if (
        result.error || result.status === 0 ||
        !result.stdout.includes("WEBSITE_CHAT_HANDOFF_ROLE_SWITCH=PASS") ||
        !expectedDenial.test(result.stderr)
      ) fail("browser_boundary_invalid");
    }
    const result = runPsql(buildWebsiteChatAcceptanceSql(policy.workspaceId), environment, snapshotPath);
    const markers = [
      "WEBSITE_CHAT_HANDOFF_MESSAGE=PASS",
      "WEBSITE_CHAT_HANDOFF_MESSAGE_REQUIRED=PASS",
      "WEBSITE_CHAT_HANDOFF_IDEMPOTENCY=PASS",
      "WEBSITE_CHAT_HANDOFF_ORIGIN_REJECTION=PASS",
      "WEBSITE_CHAT_HANDOFF_WRONG_ORIGIN_REJECTION=PASS",
      "WEBSITE_CHAT_HANDOFF_CRM_LINKAGE=PASS",
      "WEBSITE_CHAT_HANDOFF_ROLLBACK=PASS",
    ];
    if (result.error || result.status !== 0 || markers.some((marker) => !result.stdout.includes(marker))) fail("database_acceptance_failed");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  console.log("WEBSITE_CHAT_HANDOFF_BROWSER_DENIALS=3");
  console.log("WEBSITE_CHAT_HANDOFF_TRANSACTION=ROLLED_BACK");
  console.log("WEBSITE_CHAT_HANDOFF_CLEANUP=PASS");
  console.log("WEBSITE_CHAT_AI=disabled");
  console.log("WEBSITE_CHAT_EMAIL_DELIVERY=disabled");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  console.log("WEBSITE_CHAT_HANDOFF_STAGING_ACCEPTANCE=PASS");
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !new Set(["--check", "--run"]).has(args[0])) fail("argument_invalid");
  if (args[0] === "--check") {
    const sql = buildWebsiteChatAcceptanceSql("11111111-1111-4111-8111-111111111111");
    if (/\bcommit\s*;/iu.test(sql) || !sql.includes("WEBSITE_CHAT_HANDOFF_ROLLBACK=PASS")) fail("offline_contract_invalid");
    console.log("WEBSITE_CHAT_HANDOFF_ACCEPTANCE_MODE=check");
    console.log("WEBSITE_CHAT_HANDOFF_ACCEPTANCE_READY=YES");
    return;
  }
  runAcceptance(process.env);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(); }
  catch (error) {
    console.error(error instanceof Error && /^WEBSITE_CHAT_HANDOFF_ACCEPTANCE_ERROR=[a-z0-9_]+$/u.test(error.message) ? error.message : "WEBSITE_CHAT_HANDOFF_ACCEPTANCE_ERROR=unexpected_failure");
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  }
}
