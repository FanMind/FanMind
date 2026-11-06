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

import {
  STAGING_CORE_CSV_ACCEPTANCE_CONFIRMATION,
  STAGING_CORE_CSV_ACCEPTANCE_CONTACT_NAME,
  STAGING_CORE_CSV_ACCEPTANCE_IMPORTED_HANDLE,
  STAGING_CORE_CSV_ACCEPTANCE_IMPORTED_NAME,
  STAGING_CORE_CSV_ACCEPTANCE_IMPORTED_SUMMARY,
  STAGING_CORE_CSV_ACCEPTANCE_INBOUND_MESSAGE,
  UUID_PATTERN,
  deriveStagingCoreCsvAcceptanceIds,
  evaluateStagingCoreCsvAcceptanceEnvironment,
} from "../../src/lib/stagingCoreCsvAcceptancePolicy.mjs";
import {
  STAGING_SYNTHETIC_MEMBER_EMAIL,
  STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME,
} from "../../src/lib/stagingSyntheticFixturePolicy.mjs";

const MAX_PASSFILE_BYTES = 64 * 1024;

function fail(code) {
  throw new Error(`STAGING_CORE_CSV_ACCEPTANCE_ERROR=${code}`);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function modeFromArguments(argumentsList) {
  const known = new Set([
    "--check",
    "--identity",
    "--prepare",
    "--verify",
    "--cleanup",
  ]);
  if (argumentsList.some((argument) => !known.has(argument))) {
    fail("argument_invalid");
  }
  if (argumentsList.length > 1) fail("mode_ambiguous");
  return argumentsList[0] ?? "--check";
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlUuid(value) {
  const uuid = clean(value).toLowerCase();
  if (!UUID_PATTERN.test(uuid)) fail("fixture_identity");
  return `${sqlLiteral(uuid)}::uuid`;
}

function fixture(environment) {
  const workspaceId = clean(
    environment.FANMIND_STAGING_E2E_WORKSPACE_ID,
  ).toLowerCase();
  const secondaryWorkspaceId = clean(
    environment.FANMIND_STAGING_E2E_SECONDARY_WORKSPACE_ID,
  ).toLowerCase();
  const primaryFixtureContactId = clean(
    environment.FANMIND_STAGING_E2E_CONTACT_ID,
  ).toLowerCase();
  const secondaryFixtureContactId = clean(
    environment.FANMIND_STAGING_E2E_SECONDARY_CONTACT_ID,
  ).toLowerCase();
  const ids = deriveStagingCoreCsvAcceptanceIds(workspaceId);
  return {
    ...ids,
    workspaceId,
    secondaryWorkspaceId,
    primaryFixtureContactId,
    secondaryFixtureContactId,
  };
}

export function buildStagingCoreCsvPrepareSql(environment) {
  const resource = fixture(environment);
  const workspace = sqlUuid(resource.workspaceId);
  const secondaryWorkspace = sqlUuid(resource.secondaryWorkspaceId);
  const fixtureContact = sqlUuid(resource.primaryFixtureContactId);
  const secondaryContact = sqlUuid(resource.secondaryFixtureContactId);
  const contact = sqlUuid(resource.contactId);
  const conversation = sqlUuid(resource.conversationId);
  const message = sqlUuid(resource.messageId);
  const workspaceName = sqlLiteral(STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME);
  const memberEmail = sqlLiteral(STAGING_SYNTHETIC_MEMBER_EMAIL);
  const contactName = sqlLiteral(STAGING_CORE_CSV_ACCEPTANCE_CONTACT_NAME);
  const inboundMessage = sqlLiteral(STAGING_CORE_CSV_ACCEPTANCE_INBOUND_MESSAGE);
  const importedHandle = sqlLiteral(
    STAGING_CORE_CSV_ACCEPTANCE_IMPORTED_HANDLE,
  );
  const importedSummary = sqlLiteral(
    STAGING_CORE_CSV_ACCEPTANCE_IMPORTED_SUMMARY,
  );

  return String.raw`
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $contract$
begin
  if not exists (
    select 1
      from public.workspaces
     where id = ${workspace}
       and name = ${workspaceName}
       and workspace_access_mode = 'active'
       and billing_status = 'active'
       and test_access_flags ->> 'staging_synthetic_fixture' = 'true'
  ) then
    raise exception 'primary_fixture_workspace_invalid';
  end if;
  if not exists (
    select 1
      from public.contacts
     where id = ${fixtureContact}
       and workspace_id = ${workspace}
       and handle = 'fanmind-staging-primary'
  ) or not exists (
    select 1
      from public.contacts
     where id = ${secondaryContact}
       and workspace_id = ${secondaryWorkspace}
       and handle = 'fanmind-staging-secondary'
  ) then
    raise exception 'persistent_fixture_contacts_invalid';
  end if;
  if not exists (
    select 1
      from public.workspace_members as member
      join public.profiles as profile on profile.id = member.user_id
     where member.workspace_id = ${workspace}
       and member.role = 'member'
       and lower(profile.email) = lower(${memberEmail})
  ) then
    raise exception 'member_fixture_invalid';
  end if;
  if exists (
    select 1
      from public.contacts
     where (id = ${contact} or lower(handle) = 'fanmind-staging-core-acceptance')
       and not (
         id = ${contact}
         and
         workspace_id = ${workspace}
         and display_name = ${contactName}
         and handle = 'fanmind-staging-core-acceptance'
         and source_platform = 'manual'
         and summary = 'Kontrollierte synthetische Staging-Core-Acceptance.'
         and tags @> array['synthetic','staging','core-acceptance']::text[]
       )
  ) then
    raise exception 'acceptance_contact_collision';
  end if;
  if exists (
    select 1
      from public.contacts
     where workspace_id = ${workspace}
       and lower(handle) = lower(${importedHandle})
       and not (
         display_name = ${sqlLiteral(STAGING_CORE_CSV_ACCEPTANCE_IMPORTED_NAME)}
         and source_platform = 'manual'
         and summary = ${importedSummary}
         and tags @> array['synthetic','staging','core-acceptance']::text[]
       )
  ) then
    raise exception 'imported_contact_collision';
  end if;
end
$contract$;

delete from public.contacts
 where workspace_id = ${workspace}
   and lower(handle) = lower(${importedHandle})
   and display_name = ${sqlLiteral(STAGING_CORE_CSV_ACCEPTANCE_IMPORTED_NAME)}
   and source_platform = 'manual'
   and summary = ${importedSummary}
   and tags @> array['synthetic','staging','core-acceptance']::text[];
delete from public.ai_usage_events
 where workspace_id = ${workspace}
   and contact_id = ${contact}
   and feature = 'reply_suggestions'
   and source_route = '/api/ai/reply-suggestions';
delete from public.contacts
 where id = ${contact}
   and workspace_id = ${workspace}
   and display_name = ${contactName}
   and handle = 'fanmind-staging-core-acceptance'
   and source_platform = 'manual'
   and summary = 'Kontrollierte synthetische Staging-Core-Acceptance.'
   and tags @> array['synthetic','staging','core-acceptance']::text[];

insert into public.contacts (
  id, workspace_id, display_name, handle, source_platform, language, status,
  tags, summary, internal_notes, is_top_fan
) values (
  ${contact}, ${workspace}, ${contactName}, 'fanmind-staging-core-acceptance',
  'manual', 'de', 'new',
  array['synthetic','staging','core-acceptance']::text[],
  'Kontrollierte synthetische Staging-Core-Acceptance.', null, false
);

insert into public.conversations (
  id, workspace_id, contact_id, status, priority, source_platform,
  source_type, external_thread_id, last_inbound_at, last_message_preview,
  ai_status, next_step
) values (
  ${conversation}, ${workspace}, ${contact}, 'open', 'normal', 'manual',
  'manual', 'fanmind-staging-core-acceptance', statement_timestamp(),
  ${inboundMessage}, 'ready', 'Mensch prüft und sendet manuell.'
);

insert into public.conversation_messages (
  id, workspace_id, conversation_id, contact_id, direction, message_type,
  source_platform, external_message_id, author_label, content, seen_at
) values (
  ${message}, ${workspace}, ${conversation}, ${contact}, 'inbound', 'manual',
  'manual', 'fanmind-staging-core-acceptance-message',
  ${contactName}, ${inboundMessage}, null
);

commit;
select 'STAGING_CORE_CSV_PREPARE=PASS';
`;
}

export function buildStagingCoreCsvVerifySql(environment) {
  const resource = fixture(environment);
  const workspace = sqlUuid(resource.workspaceId);
  const secondaryWorkspace = sqlUuid(resource.secondaryWorkspaceId);
  const contact = sqlUuid(resource.contactId);
  const conversation = sqlUuid(resource.conversationId);
  const message = sqlUuid(resource.messageId);
  const importedHandle = sqlLiteral(
    STAGING_CORE_CSV_ACCEPTANCE_IMPORTED_HANDLE,
  );
  const importedSummary = sqlLiteral(
    STAGING_CORE_CSV_ACCEPTANCE_IMPORTED_SUMMARY,
  );

  return String.raw`
\set ON_ERROR_STOP on
do $verify$
begin
  if (select count(*) from public.contacts where id = ${contact} and workspace_id = ${workspace}) <> 1 then
    raise exception 'acceptance_contact_missing';
  end if;
  if (select count(*) from public.contacts where workspace_id = ${workspace} and lower(handle) = 'fanmind-staging-core-acceptance') <> 1 then
    raise exception 'acceptance_contact_handle_count';
  end if;
  if (select count(*) from public.conversations where id = ${conversation} and contact_id = ${contact} and workspace_id = ${workspace}) <> 1 then
    raise exception 'acceptance_conversation_missing';
  end if;
  if (select count(*) from public.conversation_messages where id = ${message} and conversation_id = ${conversation} and contact_id = ${contact} and workspace_id = ${workspace} and direction = 'inbound' and seen_at is not null) <> 1 then
    raise exception 'acceptance_message_not_seen';
  end if;
  if (select count(*) from public.memories where contact_id = ${contact} and workspace_id = ${workspace}) <> 1 then
    raise exception 'acceptance_memory_count';
  end if;
  if (select count(*) from public.followups where contact_id = ${contact} and workspace_id = ${workspace} and status = 'open') <> 1 then
    raise exception 'acceptance_followup_count';
  end if;
  if (select count(*) from public.ai_usage_events where contact_id = ${contact} and workspace_id = ${workspace} and feature = 'reply_suggestions' and status = 'ok' and source_route = '/api/ai/reply-suggestions') <> 1 then
    raise exception 'acceptance_ai_usage_count';
  end if;
  if (select count(*) from public.contacts where workspace_id = ${workspace} and lower(handle) = lower(${importedHandle}) and display_name = ${sqlLiteral(STAGING_CORE_CSV_ACCEPTANCE_IMPORTED_NAME)} and source_platform = 'manual' and summary = ${importedSummary} and tags @> array['synthetic','staging','core-acceptance']::text[]) <> 1 then
    raise exception 'acceptance_csv_contact_count';
  end if;
  if exists (
    select 1 from public.contacts
     where workspace_id = ${secondaryWorkspace}
       and (id = ${contact} or lower(handle) = lower(${importedHandle}))
  ) then
    raise exception 'secondary_workspace_contamination';
  end if;
end
$verify$;
select 'STAGING_CORE_CSV_MEMORY_COUNT=' || count(*) from public.memories where contact_id = ${contact} and workspace_id = ${workspace};
select 'STAGING_CORE_CSV_FOLLOWUP_COUNT=' || count(*) from public.followups where contact_id = ${contact} and workspace_id = ${workspace};
select 'STAGING_CORE_CSV_AI_USAGE_COUNT=' || count(*) from public.ai_usage_events where contact_id = ${contact} and workspace_id = ${workspace} and feature = 'reply_suggestions' and status = 'ok' and source_route = '/api/ai/reply-suggestions';
select 'STAGING_CORE_CSV_IMPORTED_COUNT=' || count(*) from public.contacts where workspace_id = ${workspace} and lower(handle) = lower(${importedHandle});
select 'STAGING_CORE_CSV_VERIFY=PASS';
`;
}

export function buildStagingCoreCsvCleanupSql(environment) {
  const resource = fixture(environment);
  const workspace = sqlUuid(resource.workspaceId);
  const contact = sqlUuid(resource.contactId);
  const importedHandle = sqlLiteral(
    STAGING_CORE_CSV_ACCEPTANCE_IMPORTED_HANDLE,
  );
  const importedSummary = sqlLiteral(
    STAGING_CORE_CSV_ACCEPTANCE_IMPORTED_SUMMARY,
  );

  return String.raw`
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $contract$
begin
  if not exists (
    select 1 from public.workspaces
     where id = ${workspace}
       and name = ${sqlLiteral(STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME)}
       and test_access_flags ->> 'staging_synthetic_fixture' = 'true'
  ) then
    raise exception 'cleanup_workspace_invalid';
  end if;
  if exists (
    select 1 from public.contacts
     where (id = ${contact} or lower(handle) = 'fanmind-staging-core-acceptance')
       and not (
         id = ${contact}
         and
         workspace_id = ${workspace}
         and display_name = ${sqlLiteral(STAGING_CORE_CSV_ACCEPTANCE_CONTACT_NAME)}
         and handle = 'fanmind-staging-core-acceptance'
         and source_platform = 'manual'
         and summary = 'Kontrollierte synthetische Staging-Core-Acceptance.'
         and tags @> array['synthetic','staging','core-acceptance']::text[]
       )
  ) then
    raise exception 'cleanup_contact_collision';
  end if;
  if exists (
    select 1 from public.contacts
     where workspace_id = ${workspace}
       and lower(handle) = lower(${importedHandle})
       and not (
         display_name = ${sqlLiteral(STAGING_CORE_CSV_ACCEPTANCE_IMPORTED_NAME)}
         and source_platform = 'manual'
         and summary = ${importedSummary}
         and tags @> array['synthetic','staging','core-acceptance']::text[]
       )
  ) then
    raise exception 'cleanup_import_collision';
  end if;
end
$contract$;
delete from public.contacts
 where workspace_id = ${workspace}
   and lower(handle) = lower(${importedHandle})
   and display_name = ${sqlLiteral(STAGING_CORE_CSV_ACCEPTANCE_IMPORTED_NAME)}
   and source_platform = 'manual'
   and summary = ${importedSummary}
   and tags @> array['synthetic','staging','core-acceptance']::text[];
delete from public.ai_usage_events
 where workspace_id = ${workspace}
   and contact_id = ${contact}
   and feature = 'reply_suggestions'
   and source_route = '/api/ai/reply-suggestions'
   and exists (
     select 1 from public.contacts
      where id = ${contact}
        and workspace_id = ${workspace}
        and display_name = ${sqlLiteral(STAGING_CORE_CSV_ACCEPTANCE_CONTACT_NAME)}
        and handle = 'fanmind-staging-core-acceptance'
        and source_platform = 'manual'
        and summary = 'Kontrollierte synthetische Staging-Core-Acceptance.'
        and tags @> array['synthetic','staging','core-acceptance']::text[]
   );
delete from public.contacts
 where id = ${contact}
   and workspace_id = ${workspace}
   and display_name = ${sqlLiteral(STAGING_CORE_CSV_ACCEPTANCE_CONTACT_NAME)}
   and handle = 'fanmind-staging-core-acceptance'
   and source_platform = 'manual'
   and summary = 'Kontrollierte synthetische Staging-Core-Acceptance.'
   and tags @> array['synthetic','staging','core-acceptance']::text[];
do $verify$
begin
  if exists (select 1 from public.contacts where id = ${contact})
     or exists (select 1 from public.contacts where workspace_id = ${workspace} and lower(handle) = 'fanmind-staging-core-acceptance')
     or exists (select 1 from public.contacts where workspace_id = ${workspace} and lower(handle) = lower(${importedHandle}))
     or exists (select 1 from public.conversations where contact_id = ${contact})
     or exists (select 1 from public.conversation_messages where contact_id = ${contact})
     or exists (select 1 from public.memories where contact_id = ${contact})
     or exists (select 1 from public.followups where contact_id = ${contact})
     or exists (select 1 from public.ai_usage_events where contact_id = ${contact}) then
    raise exception 'cleanup_incomplete';
  end if;
end
$verify$;
commit;
select 'STAGING_CORE_CSV_CLEANUP=PASS';
`;
}

function privatePassfileSnapshot(environment) {
  const sourcePath = clean(environment.PGPASSFILE);
  if (!sourcePath || !isAbsolute(sourcePath)) fail("passfile_path");
  let descriptor;
  let content;
  let snapshotDirectory;
  try {
    descriptor = openSync(
      sourcePath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    const opened = fstatSync(descriptor);
    if (
      !opened.isFile() ||
      opened.size < 1 ||
      opened.size > MAX_PASSFILE_BYTES ||
      (opened.mode & 0o777) !== 0o600 ||
      opened.nlink !== 1
    ) {
      fail("passfile_metadata");
    }
    content = Buffer.allocUnsafe(opened.size);
    let offset = 0;
    while (offset < content.length) {
      const bytesRead = readSync(
        descriptor,
        content,
        offset,
        content.length - offset,
        offset,
      );
      if (bytesRead === 0) fail("passfile_read");
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
      join(tmpdir(), "fanmind-staging-core-csv-"),
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
      error.message.startsWith("STAGING_CORE_CSV_ACCEPTANCE_ERROR=")
    ) {
      throw error;
    }
    fail("passfile_read");
  } finally {
    content?.fill(0);
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function psqlEnvironment(environment, passfilePath) {
  const safe = { ...environment, PGPASSFILE: passfilePath, PGCONNECT_TIMEOUT: "10" };
  for (const key of [
    "DATABASE_URL",
    "POSTGRES_URL",
    "SUPABASE_DB_URL",
    "PGPASSWORD",
    "PGHOSTADDR",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR",
    "FANMIND_STAGING_E2E_PASSWORD",
    "FANMIND_STAGING_E2E_SECONDARY_PASSWORD",
    "FANMIND_STAGING_E2E_MEMBER_PASSWORD",
  ]) {
    delete safe[key];
  }
  return safe;
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

function executeDatabaseMode(mode, environment) {
  const policy = evaluateStagingCoreCsvAcceptanceEnvironment(environment);
  if (!policy.ok) fail("environment_invalid");
  const version = spawnSync("psql", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (version.error || version.status !== 0) fail("psql_unavailable");
  const snapshot = privatePassfileSnapshot(environment);
  try {
    const sql =
      mode === "--prepare"
        ? buildStagingCoreCsvPrepareSql(environment)
        : mode === "--verify"
          ? buildStagingCoreCsvVerifySql(environment)
          : buildStagingCoreCsvCleanupSql(environment);
    const expected =
      mode === "--prepare"
        ? "STAGING_CORE_CSV_PREPARE=PASS"
        : mode === "--verify"
          ? "STAGING_CORE_CSV_VERIFY=PASS"
          : "STAGING_CORE_CSV_CLEANUP=PASS";
    const result = runPsql(sql, environment, snapshot.snapshotPath);
    if (
      result.error ||
      result.status !== 0 ||
      !String(result.stdout).split(/\r?\n/u).map((line) => line.trim()).includes(expected)
    ) {
      fail("database_operation_failed");
    }
    for (const line of String(result.stdout).split(/\r?\n/u)) {
      const value = line.trim();
      if (/^STAGING_CORE_CSV_[A-Z_]+=(?:PASS|[0-9]+)$/u.test(value)) {
        console.log(value);
      }
    }
  } finally {
    rmSync(snapshot.snapshotDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  if (mode === "--check") {
    const sampleWorkspace = "11111111-1111-4111-8111-111111111111";
    const identities = deriveStagingCoreCsvAcceptanceIds(sampleWorkspace);
    if (
      new Set(Object.values(identities)).size !== 3 ||
      Object.values(identities).some((value) => !UUID_PATTERN.test(value)) ||
      STAGING_CORE_CSV_ACCEPTANCE_CONFIRMATION !==
        "run-staging-core-csv-acceptance"
    ) {
      fail("contract_invalid");
    }
    console.log("STAGING_CORE_CSV_ACCEPTANCE_MODE=check");
    console.log("STAGING_CORE_CSV_ACCEPTANCE_CONTRACT=PASS");
    return;
  }
  if (mode === "--identity") {
    const identities = deriveStagingCoreCsvAcceptanceIds(
      process.env.FANMIND_STAGING_E2E_WORKSPACE_ID,
    );
    console.log(
      `FANMIND_E2E_STAGING_ACCEPTANCE_CONTACT_ID=${identities.contactId}`,
    );
    console.log(
      `FANMIND_E2E_STAGING_ACCEPTANCE_IMPORTED_HANDLE=${STAGING_CORE_CSV_ACCEPTANCE_IMPORTED_HANDLE}`,
    );
    return;
  }
  executeDatabaseMode(mode, process.env);
  console.log("STAGING_CORE_CSV_ACCEPTANCE_SECRETS_OUTPUT=0");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    if (
      error instanceof Error &&
      /^STAGING_CORE_CSV_ACCEPTANCE_ERROR=[a-z0-9_]+$/u.test(error.message)
    ) {
      console.error(error.message);
    } else {
      console.error("STAGING_CORE_CSV_ACCEPTANCE_ERROR=unexpected_failure");
    }
    console.error("STAGING_CORE_CSV_ACCEPTANCE_SECRETS_OUTPUT=0");
    process.exitCode = 1;
  });
}
