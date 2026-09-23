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

const MIGRATION_ID = "20260923023000_creator_confirmed_chat_learning";
const MIGRATION_PATH = resolve(process.cwd(), `supabase/controlled/${MIGRATION_ID}.sql`);
const ROLLOUT_STATE_REPO_PATH = "src/lib/confirmedChatLearningDeletionVerification.mjs";
const ROLLOUT_STATE_PATH = resolve(process.cwd(), ROLLOUT_STATE_REPO_PATH);
const EXPECTED_MIGRATION_GIT_BLOB_SHA1 = "b09a22643d5076e68cfe7816980e88d0d00272f7";
const APPLY_CONFIRMATION = "apply-creator-confirmed-chat-learning";
const NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT = "I_UNDERSTAND_NON_PRODUCTION_ONLY";
const MAX_PASSFILE_BYTES = 64 * 1024;

const VERIFY_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  learning_table oid := to_regclass('public.creator_confirmed_chat_learning');
  messages_table oid := to_regclass('public.conversation_messages');
  policy_count integer;
  policy_roles name[];
  policy_qual text;
  policy_check text;
  trigger_def text;
  function_def text;
  function_security_definer boolean;
  function_config text;
  index_def text;
  constraint_defs text[];
begin
  if to_regclass('public.creators') is null
     or to_regclass('public.creator_commercial_events') is null
     or messages_table is null
     or to_regprocedure('public.creator_workspace_access_allowed(uuid)') is null
     or to_regprocedure('public.workspace_owner_active_mutation_allowed(uuid)') is null
     or to_regprocedure('public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)') is null then
    raise exception 'creator_learning_foundation_missing';
  end if;

  if learning_table is null then
    if exists (
      select 1 from pg_attribute
       where attrelid = messages_table
         and attname = 'creator_learning_manual_send'
         and attnum > 0 and not attisdropped
    )
    or to_regprocedure('public.stamp_creator_learning_manual_send()') is not null
    or to_regprocedure('public.record_creator_confirmed_chat_proposals(uuid,uuid,uuid,uuid,integer,text,jsonb)') is not null
    or to_regprocedure('public.confirm_creator_confirmed_chat_outbound(uuid,uuid,uuid,uuid,uuid,text)') is not null
    or to_regprocedure('public.link_creator_confirmed_chat_outcomes(uuid,uuid,uuid,uuid,uuid)') is not null then
      raise exception 'creator_learning_schema_partial';
    end if;
    return;
  end if;

  if not exists (
    select 1 from pg_class
     where oid = learning_table and relkind = 'r' and relrowsecurity
  ) then
    raise exception 'creator_learning_rls_invalid';
  end if;

  if not exists (
    select 1 from pg_attribute
     where attrelid = messages_table
       and attname = 'creator_learning_manual_send'
       and format_type(atttypid, atttypmod) = 'boolean'
       and attnotnull
       and attnum > 0 and not attisdropped
  ) then
    raise exception 'creator_learning_manual_send_column_invalid';
  end if;

  select pg_get_triggerdef(t.oid, true) into trigger_def
    from pg_trigger t
   where t.tgrelid = messages_table
     and t.tgname = 'conversation_messages_stamp_creator_learning_manual_send'
     and t.tgenabled = 'O' and not t.tgisinternal;
  trigger_def := regexp_replace(lower(coalesce(trigger_def, '')), '\s+', '', 'g');
  if position('beforeinsertorupdate' in trigger_def) = 0
     or position('conversation_messages' in trigger_def) = 0
     or position('foreachrow' in trigger_def) = 0
     or position('executefunction' in trigger_def) = 0
     or position('stamp_creator_learning_manual_send()' in trigger_def) = 0 then
    raise exception 'creator_learning_manual_send_trigger_invalid';
  end if;

  if to_regprocedure('public.stamp_creator_learning_manual_send()') is null
     or to_regprocedure('public.record_creator_confirmed_chat_proposals(uuid,uuid,uuid,uuid,integer,text,jsonb)') is null
     or to_regprocedure('public.confirm_creator_confirmed_chat_outbound(uuid,uuid,uuid,uuid,uuid,text)') is null
     or to_regprocedure('public.link_creator_confirmed_chat_outcomes(uuid,uuid,uuid,uuid,uuid)') is null then
    raise exception 'creator_learning_functions_missing';
  end if;

  select p.prosecdef, coalesce(array_to_string(p.proconfig, ','), ''), pg_get_functiondef(p.oid)
    into function_security_definer, function_config, function_def
    from pg_proc p
   where p.oid = to_regprocedure('public.stamp_creator_learning_manual_send()');
  if function_def is null
     or function_security_definer
     or position('search_path=' in function_config) = 0
     or lower(function_def) not like '%auth.role()%'
     or lower(function_def) not like '%auth.uid()%'
     or lower(function_def) not like '%new.direction = ''outbound''%'
     or lower(function_def) not like '%new.message_type in (''dm'',''manual'')%'
     or lower(function_def) not like '%manual_note%'
     or lower(function_def) not like '%old.creator_learning_manual_send%'
     or lower(function_def) not like '%new.content is not distinct from old.content%' then
    raise exception 'creator_learning_stamp_function_invalid';
  end if;

  select p.prosecdef, coalesce(array_to_string(p.proconfig, ','), ''), pg_get_functiondef(p.oid)
    into function_security_definer, function_config, function_def
    from pg_proc p
   where p.oid = to_regprocedure(
     'public.record_creator_confirmed_chat_proposals(uuid,uuid,uuid,uuid,integer,text,jsonb)'
   );
  if function_def is null
     or not function_security_definer
     or position('search_path=' in function_config) = 0
     or lower(function_def) not like '%creator_workspace_access_allowed(p_workspace_id)%'
     or lower(function_def) not like '%jsonb_array_length(p_proposals) <> 3%'
     or lower(function_def) not like '%c.revision = p_creator_revision%'
     or lower(function_def) not like '%c.status = ''active''%'
     or lower(function_def) not like '%insert into public.creator_confirmed_chat_learning%'
     or lower(function_def) not like '%gen_random_uuid()%' then
    raise exception 'creator_learning_proposal_function_invalid';
  end if;

  select p.prosecdef, coalesce(array_to_string(p.proconfig, ','), ''), pg_get_functiondef(p.oid)
    into function_security_definer, function_config, function_def
    from pg_proc p
   where p.oid = to_regprocedure(
     'public.confirm_creator_confirmed_chat_outbound(uuid,uuid,uuid,uuid,uuid,text)'
   );
  if function_def is null
     or not function_security_definer
     or position('search_path=' in function_config) = 0
     or lower(function_def) not like '%auth.role()%'
     or lower(function_def) not like '%service_role%'
     or lower(function_def) not like '%w.owner_user_id = p_actor_user_id%'
     or lower(function_def) not like '%workspace_processing_allowed_contract(%'
     or lower(function_def) not like '%m.creator_learning_manual_send is true%'
     or lower(function_def) not like '%message_text is distinct from p_expected_actual_text%'
     or lower(function_def) not like '%message_time < target.generated_at%'
     or lower(function_def) not like '%statement_timestamp() + interval ''30 seconds''%'
     or lower(function_def) not like '%for update%'
     or lower(function_def) not like '%creator_learning_outbound_conflict%' then
    raise exception 'creator_learning_confirm_function_invalid';
  end if;

  select p.prosecdef, coalesce(array_to_string(p.proconfig, ','), ''), pg_get_functiondef(p.oid)
    into function_security_definer, function_config, function_def
    from pg_proc p
   where p.oid = to_regprocedure(
     'public.link_creator_confirmed_chat_outcomes(uuid,uuid,uuid,uuid,uuid)'
   );
  if function_def is null
     or not function_security_definer
     or position('search_path=' in function_config) = 0
     or lower(function_def) not like '%auth.uid()%'
     or lower(function_def) not like '%workspace_owner_active_mutation_allowed(p_workspace_id)%'
     or lower(function_def) not like '%creator_workspace_access_allowed(p_workspace_id)%'
     or lower(function_def) not like '%m.direction = ''inbound''%'
     or lower(function_def) not like '%manual_note%'
     or lower(function_def) not like '%e.kind = ''purchase''%'
     or lower(function_def) not like '%e.confirmed_at is not null%'
     or lower(function_def) not like '%creator_learning_reaction_conflict%'
     or lower(function_def) not like '%creator_learning_purchase_conflict%'
     or lower(function_def) not like '%for update%' then
    raise exception 'creator_learning_outcome_function_invalid';
  end if;

  select count(*)::integer into policy_count
    from pg_policies
   where schemaname = 'public'
     and tablename = 'creator_confirmed_chat_learning';

  select roles, qual, with_check
    into policy_roles, policy_qual, policy_check
    from pg_policies
   where schemaname = 'public'
     and tablename = 'creator_confirmed_chat_learning'
     and policyname = 'creator_confirmed_chat_learning_member_read'
     and cmd = 'SELECT';

  policy_qual := regexp_replace(lower(coalesce(policy_qual, '')), '\s+', '', 'g');
  if policy_count <> 1
     or policy_roles is distinct from array['authenticated']::name[]
     or policy_check is not null
     or position('creator_workspace_access_allowed(workspace_id)' in policy_qual) = 0
     or position('workspace_members' in policy_qual) = 0
     or position('m.workspace_id=creator_confirmed_chat_learning.workspace_id' in policy_qual) = 0
     or position('m.user_id=(selectauth.uid()' in policy_qual) = 0
     or position('workspaces' in policy_qual) = 0
     or position('w.id=creator_confirmed_chat_learning.workspace_id' in policy_qual) = 0
     or position('w.owner_user_id=(selectauth.uid()' in policy_qual) = 0 then
    raise exception 'creator_learning_policy_invalid';
  end if;

  if not has_table_privilege('authenticated', learning_table, 'SELECT')
     or has_table_privilege('authenticated', learning_table, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('anon', learning_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or not has_table_privilege(
       'service_role',
       learning_table,
       'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
     ) then
    raise exception 'creator_learning_table_privilege_invalid';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.record_creator_confirmed_chat_proposals(uuid,uuid,uuid,uuid,integer,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.record_creator_confirmed_chat_proposals(uuid,uuid,uuid,uuid,integer,text,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.confirm_creator_confirmed_chat_outbound(uuid,uuid,uuid,uuid,uuid,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.confirm_creator_confirmed_chat_outbound(uuid,uuid,uuid,uuid,uuid,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.link_creator_confirmed_chat_outcomes(uuid,uuid,uuid,uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.link_creator_confirmed_chat_outcomes(uuid,uuid,uuid,uuid,uuid)',
       'EXECUTE'
     ) then
    raise exception 'creator_learning_function_privilege_invalid';
  end if;

  select pg_get_indexdef(i.indexrelid) into index_def
    from pg_index i
    join pg_class c on c.oid = i.indexrelid
   where i.indrelid = learning_table
     and i.indisvalid and i.indisready and not i.indisunique
     and i.indnkeyatts = 4
     and c.relname = 'creator_confirmed_chat_learning_contact_idx';
  if index_def is null
     or regexp_replace(lower(index_def), '\s+', '', 'g') not like
       '%(workspace_id,creator_id,contact_id,generated_atdesc)%' then
    raise exception 'creator_learning_index_invalid';
  end if;

  select array_agg(regexp_replace(lower(pg_get_constraintdef(oid)), '\s+', '', 'g'))
    into constraint_defs
    from pg_constraint
   where conrelid = learning_table;

  if constraint_defs is null
     or not ('foreignkey(workspace_id,creator_id)referencescreators(workspace_id,id)ondeletecascade' = any(constraint_defs))
     or not ('foreignkey(workspace_id,contact_id,conversation_id)referencesconversations(workspace_id,contact_id,id)ondeletecascade' = any(constraint_defs))
     or not ('foreignkey(confirmed_by)referencesauth.users(id)ondeletesetnull' = any(constraint_defs))
     or not ('unique(workspace_id,generation_id)' = any(constraint_defs))
     or not ('unique(workspace_id,outbound_message_id)' = any(constraint_defs))
     or not ('unique(workspace_id,reaction_message_id)' = any(constraint_defs))
     or not ('unique(workspace_id,purchase_event_id)' = any(constraint_defs))
     or not exists (select 1 from unnest(constraint_defs) d where d like 'check(%creator_revision%>0%)')
     or not exists (select 1 from unnest(constraint_defs) d where d like 'check(%prompt_revision%120%)')
     or not exists (select 1 from unnest(constraint_defs) d where d like 'check(%selected_variant%recommended%softer%stronger%)')
     or not exists (select 1 from unnest(constraint_defs) d where d like 'check(%proposed_text%4000%)')
     or not exists (select 1 from unnest(constraint_defs) d where d like 'check(%outbound_message_id%actual_text%confirmed_at%)')
     or not exists (select 1 from unnest(constraint_defs) d where d like 'check(%reaction_message_id%reaction_at%)')
     or not exists (select 1 from unnest(constraint_defs) d where d like 'check(%purchase_event_id%purchase_evidence_reference%purchase_at%)')
     or not exists (select 1 from unnest(constraint_defs) d where d like 'check(%confirmed_at%generated_at%)')
     or not exists (select 1 from unnest(constraint_defs) d where d like 'check(%reaction_at%confirmed_at%)')
     or not exists (select 1 from unnest(constraint_defs) d where d like 'check(%purchase_at%confirmed_at%)') then
    raise exception 'creator_learning_constraint_invalid';
  end if;
end
$verify$;

select case
  when to_regclass('public.creator_confirmed_chat_learning') is null
    then 'CREATOR_CONFIRMED_CHAT_SCHEMA_STATE=ABSENT'
  else 'CREATOR_CONFIRMED_CHAT_SCHEMA_STATE=INSTALLED'
end;
rollback;
`;

function fail(code) {
  throw new Error(`CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=${code}`);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function gitBlobSha1(content) {
  const body = Buffer.from(content, "utf8");
  return createHash("sha1")
    .update(`blob ${body.length}\0`, "utf8")
    .update(body)
    .digest("hex");
}

function parseRolloutState(source) {
  const match = source.match(
    /export const CONFIRMED_CHAT_LEARNING_SCHEMA_STATE = "(preinstall|installed)";/u,
  );
  if (!match) fail("rollout_state_invalid");
  return match[1];
}

function rolloutState() {
  try {
    return parseRolloutState(readFileSync(ROLLOUT_STATE_PATH, "utf8"));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=")
    ) {
      throw error;
    }
    fail("rollout_state_unreadable");
  }
}

function runGit(args) {
  return spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

function reviewedRolloutState(reviewedCommit) {
  const shown = runGit(["show", `${reviewedCommit}:${ROLLOUT_STATE_REPO_PATH}`]);
  if (shown.status !== 0) fail("reviewed_rollout_state_unreadable");
  return parseRolloutState(shown.stdout);
}

function requireCleanTrackedCheckout() {
  const status = runGit(["status", "--porcelain=v1", "--untracked-files=no"]);
  if (status.status !== 0 || clean(status.stdout)) fail("checkout_dirty");
}

function readAndVerifyMigration() {
  let sql;
  try {
    sql = readFileSync(MIGRATION_PATH, "utf8");
  } catch {
    fail("migration_unreadable");
  }
  if (gitBlobSha1(sql) !== EXPECTED_MIGRATION_GIT_BLOB_SHA1) {
    fail("migration_checksum_mismatch");
  }
  const required = [
    /^begin;/imu,
    /create table public\.creator_confirmed_chat_learning/iu,
    /add column if not exists creator_learning_manual_send boolean not null default false/iu,
    /create trigger conversation_messages_stamp_creator_learning_manual_send/iu,
    /alter table public\.creator_confirmed_chat_learning enable row level security/iu,
    /grant select on public\.creator_confirmed_chat_learning to authenticated/iu,
    /grant all on public\.creator_confirmed_chat_learning to service_role/iu,
    /record_creator_confirmed_chat_proposals/iu,
    /confirm_creator_confirmed_chat_outbound/iu,
    /link_creator_confirmed_chat_outcomes/iu,
    /references auth\.users\(id\) on delete set null/iu,
    /references public\.creators\(workspace_id,id\) on delete cascade/iu,
    /references public\.conversations\(workspace_id,contact_id,id\) on delete cascade/iu,
    /unique \(workspace_id,generation_id\)/iu,
    /unique \(workspace_id,outbound_message_id\)/iu,
    /unique \(workspace_id,reaction_message_id\)/iu,
    /unique \(workspace_id,purchase_event_id\)/iu,
    /creator_confirmed_chat_learning\(workspace_id,creator_id,contact_id,generated_at desc\)/iu,
    /commit;\s*$/iu,
  ];
  if (
    required.some((contract) => !contract.test(sql)) ||
    /\bdrop\s+(?:table|schema|database)\b/iu.test(sql)
  ) {
    fail("migration_contract_invalid");
  }
  return sql;
}

function projectReferenceFromUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    const match = /^([a-z0-9]{8,64})\.supabase\.co$/u.exec(url.hostname.toLowerCase());
    return match?.[1] ?? "";
  } catch {
    return "";
  }
}

function normalizedReference(value) {
  const candidate = clean(value).toLowerCase();
  return /^[a-z0-9]{8,64}$/u.test(candidate) ? candidate : "";
}

function normalizedHost(value) {
  const candidate = clean(value).toLowerCase().replace(/\.$/u, "");
  return /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/u.test(candidate)
    ? candidate
    : "";
}

function requireTarget(environment, mode) {
  const runtime = clean(environment.FANMIND_RUNTIME_ENVIRONMENT).toLowerCase();
  if (!["staging", "production"].includes(runtime)) fail("runtime_environment_invalid");
  if (mode === "apply" && runtime !== "staging") fail("production_apply_forbidden");

  const targetReference = normalizedReference(environment.FANMIND_TARGET_SUPABASE_PROJECT_REF);
  const productionReference = normalizedReference(
    environment.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF,
  );
  const urlReference = projectReferenceFromUrl(environment.NEXT_PUBLIC_SUPABASE_URL);
  if (!targetReference || !productionReference || !urlReference) {
    fail("supabase_reference_missing");
  }
  if (targetReference !== urlReference) fail("supabase_url_binding_invalid");
  if (
    (runtime === "production" && targetReference !== productionReference) ||
    (runtime === "staging" && targetReference === productionReference)
  ) {
    fail("environment_target_binding_invalid");
  }

  const pgHost = normalizedHost(environment.PGHOST);
  const expectedHost = normalizedHost(environment.FANMIND_TARGET_DB_HOST);
  if (!pgHost || !expectedHost || pgHost !== expectedHost) {
    fail("database_host_binding_invalid");
  }
  const pgUser = clean(environment.PGUSER).toLowerCase();
  const directProjectHost = `db.${targetReference}.supabase.co`;
  const projectBoundConnection =
    pgHost === directProjectHost || pgUser === `postgres.${targetReference}`;
  if (!projectBoundConnection) fail("database_project_binding_invalid");

  if (clean(environment.PGSSLMODE) !== "verify-full") fail("tls_mode_invalid");
  if (!isAbsolute(clean(environment.PGSSLROOTCERT))) fail("tls_root_invalid");

  const reviewedCommit = clean(
    environment.FANMIND_CREATOR_CONFIRMED_CHAT_REVIEWED_COMMIT,
  ).toLowerCase();
  if (!/^[0-9a-f]{40}$/u.test(reviewedCommit)) fail("reviewed_commit_invalid");
  const actual = runGit(["rev-parse", "HEAD"]);
  if (actual.status !== 0 || clean(actual.stdout).toLowerCase() !== reviewedCommit) {
    fail("checkout_mismatch");
  }

  if (mode === "apply") {
    requireCleanTrackedCheckout();
    const committedState = reviewedRolloutState(reviewedCommit);
    const workingState = rolloutState();
    if (committedState !== workingState) fail("rollout_state_checkout_mismatch");
    if (committedState !== "installed") fail("source_state_not_installed");

    if (
      clean(environment.FANMIND_CREATOR_CONFIRMED_CHAT_APPLY_CONFIRMATION) !==
      APPLY_CONFIRMATION
    ) {
      fail("apply_confirmation_missing");
    }
    if (
      clean(environment.FANMIND_NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT) !==
      NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT
    ) {
      fail("write_acknowledgement_missing");
    }
  }
  return reviewedCommit;
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
      opened.nlink !== 1 ||
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
      const read = readSync(descriptor, content, offset, content.length - offset, offset);
      if (read === 0) fail("passfile_read_failed");
      offset += read;
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
    snapshotDirectory = mkdtempSync(join(tmpdir(), "fanmind-confirmed-chat-"));
    const snapshotPath = join(snapshotDirectory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { snapshotDirectory, snapshotPath };
  } catch (error) {
    if (snapshotDirectory) rmSync(snapshotDirectory, { recursive: true, force: true });
    if (
      error instanceof Error &&
      error.message.startsWith("CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=")
    ) {
      throw error;
    }
    if (error && typeof error === "object" && "code" in error && error.code === "ELOOP") {
      fail("passfile_invalid");
    }
    fail("passfile_read_failed");
  } finally {
    content?.fill(0);
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function psqlEnvironment(environment, passfilePath) {
  const allowed = [
    "PATH", "LANG", "LC_ALL", "PGHOST", "PGPORT", "PGDATABASE", "PGUSER",
    "PGSSLMODE", "PGSSLROOTCERT",
  ];
  const safe = Object.fromEntries(
    allowed
      .filter((key) => typeof environment[key] === "string")
      .map((key) => [key, environment[key]]),
  );
  safe.PGPASSFILE = passfilePath;
  safe.PGCONNECT_TIMEOUT = "10";
  safe.PGOPTIONS =
    "-c statement_timeout=60000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=60000";
  return safe;
}

function runPsql(input, environment, passfilePath) {
  return spawnSync(
    "psql",
    ["--no-password", "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1"],
    {
      env: psqlEnvironment(environment, passfilePath),
      input,
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}

function databaseState(result) {
  if (result.error || result.status !== 0) fail("verify_query_failed");
  const lines = clean(result.stdout).split(/\r?\n/u).filter(Boolean);
  if (lines.length !== 1) fail("verify_response_invalid");
  if (lines[0] === "CREATOR_CONFIRMED_CHAT_SCHEMA_STATE=ABSENT") return "absent";
  if (lines[0] === "CREATOR_CONFIRMED_CHAT_SCHEMA_STATE=INSTALLED") return "installed";
  fail("verify_response_invalid");
}

function runDatabaseMode(mode, sql, state, environment, database) {
  const before = databaseState(database(VERIFY_SQL));
  if (state === "preinstall") {
    if (before === "installed") fail("installed_target_with_preinstall_source");
    if (mode === "apply") fail("source_state_not_installed");
    return [
      "CREATOR_CONFIRMED_CHAT_SCHEMA_STATE=absent",
      "CREATOR_CONFIRMED_CHAT_SOURCE_STATE=preinstall",
      "CREATOR_CONFIRMED_CHAT_NEXT=reviewed_state_switch_before_apply",
      "CREATOR_CONFIRMED_CHAT_APPLY=not_requested",
    ];
  }

  if (mode === "verify") {
    return before === "installed"
      ? [
          "CREATOR_CONFIRMED_CHAT_SCHEMA_STATE=installed",
          "CREATOR_CONFIRMED_CHAT_SOURCE_STATE=installed",
          "CREATOR_CONFIRMED_CHAT_POSTFLIGHT=PASS",
          "CREATOR_CONFIRMED_CHAT_APPLY=not_requested",
        ]
      : [
          "CREATOR_CONFIRMED_CHAT_SCHEMA_STATE=absent",
          "CREATOR_CONFIRMED_CHAT_SOURCE_STATE=installed",
          "CREATOR_CONFIRMED_CHAT_NEXT=apply",
          "CREATOR_CONFIRMED_CHAT_APPLY=not_requested",
        ];
  }

  if (before !== "absent") fail("apply_requires_absent_target");
  const applied = database(sql);
  if (applied.error || applied.status !== 0) fail("apply_indeterminate_verify_before_retry");
  const after = databaseState(database(VERIFY_SQL));
  if (after !== "installed") fail("postflight_failed");
  return [
    "CREATOR_CONFIRMED_CHAT_SCHEMA_STATE=installed",
    "CREATOR_CONFIRMED_CHAT_SOURCE_STATE=installed",
    "CREATOR_CONFIRMED_CHAT_APPLY=committed",
    "CREATOR_CONFIRMED_CHAT_POSTFLIGHT=PASS",
    "CREATOR_CONFIRMED_CHAT_RUNTIME_ACTIVATED=false",
  ];
}

export function main(args = process.argv.slice(2), environment = process.env) {
  const modeArg = args[0] ?? "--check";
  if (args.length > 1 || !["--check", "--verify", "--apply"].includes(modeArg)) {
    fail("mode_invalid");
  }
  const sql = readAndVerifyMigration();
  const state = rolloutState();
  const digest = createHash("sha256").update(sql).digest("hex");
  if (modeArg === "--check") {
    console.log(`CREATOR_CONFIRMED_CHAT_MIGRATION_ID=${MIGRATION_ID}`);
    console.log("CREATOR_CONFIRMED_CHAT_MIGRATION_CHECKSUM=verified");
    console.log(`CREATOR_CONFIRMED_CHAT_MIGRATION_SHA256=${digest}`);
    console.log("CREATOR_CONFIRMED_CHAT_MIGRATION_CONTRACT=verified");
    console.log(`CREATOR_CONFIRMED_CHAT_SOURCE_STATE=${state}`);
    console.log("CREATOR_CONFIRMED_CHAT_APPLY=not_requested");
    return;
  }

  const mode = modeArg.slice(2);
  if (mode === "apply" && state !== "installed") fail("source_state_not_installed");
  requireTarget(environment, mode);
  const { snapshotDirectory, snapshotPath } = privatePassfileSnapshot(environment);
  try {
    for (const marker of runDatabaseMode(
      mode,
      sql,
      state,
      environment,
      (input) => runPsql(input, environment, snapshotPath),
    )) {
      console.log(marker);
    }
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    const message =
      error instanceof Error &&
      /^CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=[a-z0-9_]+$/u.test(error.message)
        ? error.message
        : "CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=unexpected_failure";
    console.error(message);
    process.exitCode = 1;
  }
}
