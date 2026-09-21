#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { evaluateChatAdminStagingControlEnvironment } from "../../src/lib/chatAdminStagingControlPolicy.mjs";

export const SQL_PATH =
  "supabase/controlled/20260920230000_chat_admin_multi_character.sql";
export const SQL_SHA256 =
  "9dd3674a3848303cd707aa89ad4b808c5bd9a12bfe3ff4b367e2c99121ad1e7b";

export const CHAT_ADMIN_POSTFLIGHT_SQL = String.raw`\set ON_ERROR_STOP on
begin;
set transaction read only;
do $verify$
declare
  present integer;
  rls_enabled integer;
  policy_count integer;
  policy_valid integer;
  constraint_valid integer;
  index_valid integer;
  function_valid integer;
  privilege_mismatch integer;
begin
  select count(*) into present
  from (values
    (to_regclass('public.workspace_chat_admin_capabilities') is not null),
    (to_regclass('public.chat_characters') is not null),
    (to_regclass('public.chat_character_conversations') is not null),
    (to_regclass('public.chat_character_messages') is not null),
    (to_regprocedure('public.is_current_chat_admin_workspace(uuid)') is not null),
    (exists(
      select 1 from pg_indexes
      where schemaname = 'public'
        and tablename = 'workspace_chat_admin_capabilities'
        and indexname = 'one_chat_admin_workspace_global'
    ))
  ) as required(ok)
  where ok;

  if present = 0 then
    raise notice 'CHAT_ADMIN_SCHEMA_STATE=ABSENT';
    return;
  end if;

  select count(*) into rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in (
      'workspace_chat_admin_capabilities',
      'chat_characters',
      'chat_character_conversations',
      'chat_character_messages'
    )
    and c.relrowsecurity;

  select count(*) into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'workspace_chat_admin_capabilities',
      'chat_characters',
      'chat_character_conversations',
      'chat_character_messages'
    );

  select count(*) into policy_valid
  from (
    select
      policyname,
      tablename,
      cmd,
      roles,
      regexp_replace(coalesce(qual, ''), '[[:space:]]+', '', 'g') as q,
      regexp_replace(coalesce(with_check, ''), '[[:space:]]+', '', 'g') as wc
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'workspace_chat_admin_capabilities',
        'chat_characters',
        'chat_character_conversations',
        'chat_character_messages'
      )
  ) p
  where roles = '{authenticated}'::name[]
    and (
      (
        policyname = 'chat_admin_capability_owner_read'
        and tablename = 'workspace_chat_admin_capabilities'
        and cmd = 'SELECT'
        and wc = ''
        and q like '%chat_admin_multi_character%'
        and q like '%granted_to_user_id=auth.uid()%'
        and q like '%w.owner_user_id=auth.uid()%'
        and q like '%w.id=workspace_id%'
      )
      or (
        policyname = 'chat_admin_characters_owner_all'
        and tablename = 'chat_characters'
        and cmd = 'ALL'
        and q like '%is_current_chat_admin_workspace(workspace_id)%'
        and q not in ('true', '(true)')
        and wc like '%is_current_chat_admin_workspace(workspace_id)%'
        and wc like '%created_by_user_id=auth.uid()%'
      )
      or (
        policyname = 'chat_admin_conversations_owner_all'
        and tablename = 'chat_character_conversations'
        and cmd = 'ALL'
        and q like '%is_current_chat_admin_workspace(workspace_id)%'
        and q not in ('true', '(true)')
        and wc like '%is_current_chat_admin_workspace(workspace_id)%'
        and wc not in ('true', '(true)')
      )
      or (
        policyname = 'chat_admin_messages_owner_all'
        and tablename = 'chat_character_messages'
        and cmd = 'ALL'
        and q like '%is_current_chat_admin_workspace(workspace_id)%'
        and q not in ('true', '(true)')
        and wc like '%is_current_chat_admin_workspace(workspace_id)%'
        and wc not in ('true', '(true)')
      )
    );

  select count(*) into constraint_valid
  from (
    select
      conrelid,
      contype,
      replace(
        regexp_replace(lower(pg_get_constraintdef(oid, true)), '[[:space:]]+', '', 'g'),
        'public.',
        ''
      ) as definition
    from pg_constraint
    where conrelid in (
      to_regclass('public.chat_character_conversations'),
      to_regclass('public.chat_character_messages')
    )
  ) c
  where (
      c.conrelid = to_regclass('public.chat_character_conversations')
      and c.contype = 'f'
      and c.definition = 'foreignkey(workspace_id,character_id)referenceschat_characters(workspace_id,id)ondeletecascade'
    )
    or (
      c.conrelid = to_regclass('public.chat_character_messages')
      and c.contype = 'f'
      and c.definition = 'foreignkey(workspace_id,character_id,conversation_id)referenceschat_character_conversations(workspace_id,character_id,id)ondeletecascade'
    );

  select count(*) into index_valid
  from pg_indexes
  where schemaname = 'public'
    and tablename = 'workspace_chat_admin_capabilities'
    and indexname = 'one_chat_admin_workspace_global'
    and lower(indexdef) like 'create unique index one_chat_admin_workspace_global%'
    and regexp_replace(lower(indexdef), '[[:space:]]+', '', 'g')
      like '%(chat_admin_multi_character)%wherechat_admin_multi_character%';

  select count(*) into function_valid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname = 'public'
    and p.proname = 'is_current_chat_admin_workspace'
    and pg_get_function_identity_arguments(p.oid) = 'target_workspace_id uuid'
    and l.lanname = 'sql'
    and p.provolatile = 's'
    and not p.prosecdef
    and array_to_string(coalesce(p.proconfig, '{}'::text[]), ',') like '%search_path=%'
    and regexp_replace(lower(btrim(p.prosrc)), '[[:space:]]+', '', 'g') =
      'selectexists(select1frompublic.workspace_chat_admin_capabilitiescjoinpublic.workspaceswonw.id=c.workspace_idwherec.workspace_id=target_workspace_idandc.chat_admin_multi_characterandc.granted_to_user_id=auth.uid()andw.owner_user_id=auth.uid());';

  with expected(grantee, table_name, privilege_type) as (
    values
      ('authenticated', 'workspace_chat_admin_capabilities', 'SELECT'),
      ('authenticated', 'chat_characters', 'SELECT'),
      ('authenticated', 'chat_characters', 'INSERT'),
      ('authenticated', 'chat_characters', 'UPDATE'),
      ('authenticated', 'chat_characters', 'DELETE'),
      ('authenticated', 'chat_character_conversations', 'SELECT'),
      ('authenticated', 'chat_character_conversations', 'INSERT'),
      ('authenticated', 'chat_character_conversations', 'UPDATE'),
      ('authenticated', 'chat_character_conversations', 'DELETE'),
      ('authenticated', 'chat_character_messages', 'SELECT'),
      ('authenticated', 'chat_character_messages', 'INSERT'),
      ('authenticated', 'chat_character_messages', 'UPDATE'),
      ('authenticated', 'chat_character_messages', 'DELETE'),
      ('service_role', 'workspace_chat_admin_capabilities', 'SELECT'),
      ('service_role', 'workspace_chat_admin_capabilities', 'INSERT'),
      ('service_role', 'workspace_chat_admin_capabilities', 'UPDATE'),
      ('service_role', 'workspace_chat_admin_capabilities', 'DELETE'),
      ('service_role', 'chat_characters', 'SELECT'),
      ('service_role', 'chat_characters', 'INSERT'),
      ('service_role', 'chat_characters', 'UPDATE'),
      ('service_role', 'chat_characters', 'DELETE'),
      ('service_role', 'chat_character_conversations', 'SELECT'),
      ('service_role', 'chat_character_conversations', 'INSERT'),
      ('service_role', 'chat_character_conversations', 'UPDATE'),
      ('service_role', 'chat_character_conversations', 'DELETE'),
      ('service_role', 'chat_character_messages', 'SELECT'),
      ('service_role', 'chat_character_messages', 'INSERT'),
      ('service_role', 'chat_character_messages', 'UPDATE'),
      ('service_role', 'chat_character_messages', 'DELETE')
  ), actual as (
    select grantee, table_name, privilege_type
    from information_schema.table_privileges
    where table_schema = 'public'
      and table_name in (
        'workspace_chat_admin_capabilities',
        'chat_characters',
        'chat_character_conversations',
        'chat_character_messages'
      )
      and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
  ), mismatch as (
    (select * from expected except select * from actual)
    union all
    (select * from actual except select * from expected)
  )
  select count(*) into privilege_mismatch from mismatch;

  if present <> 6
    or rls_enabled <> 4
    or policy_count <> 4
    or policy_valid <> 4
    or constraint_valid <> 2
    or index_valid <> 1
    or function_valid <> 1
    or privilege_mismatch <> 0
    or has_function_privilege(
      'anon',
      'public.is_current_chat_admin_workspace(uuid)',
      'execute'
    )
    or has_function_privilege(
      'service_role',
      'public.is_current_chat_admin_workspace(uuid)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'public.is_current_chat_admin_workspace(uuid)',
      'execute'
    )
  then
    raise exception 'CHAT_ADMIN_SCHEMA_STATE=PARTIAL';
  end if;

  raise notice 'CHAT_ADMIN_SCHEMA_STATE=VERIFIED';
end $verify$;
rollback;`;

function fail(code) {
  throw new Error(`CHAT_ADMIN_STAGING_ERROR=${code}`);
}

function run(sql, env) {
  return spawnSync(
    "psql",
    ["--no-password", "--no-psqlrc", "--quiet", "--set=ON_ERROR_STOP=1"],
    { env, input: sql, encoding: "utf8" },
  );
}

function readSchemaState(result) {
  const output = `${result.stderr ?? ""}${result.stdout ?? ""}`;
  if (result.status !== 0) {
    fail(output.includes("PARTIAL") ? "schema_partial" : "verify_failed");
  }
  if (output.includes("VERIFIED")) return "VERIFIED";
  if (output.includes("ABSENT")) return "ABSENT";
  fail("schema_state_unknown");
}

export function execute(mode, env = process.env) {
  const policyMode = mode === "apply" ? "migration" : "schema";
  if (!evaluateChatAdminStagingControlEnvironment(env, { mode: policyMode }).ok) {
    fail("environment_invalid");
  }

  const source = readFileSync(SQL_PATH, "utf8");
  if (createHash("sha256").update(source).digest("hex") !== SQL_SHA256) {
    fail("checksum_mismatch");
  }
  if (
    mode === "apply" &&
    !/^begin;[\s\S]*commit;\s*$/u.test(
      source.trim().replace(/^--.*$/gmu, "").trim(),
    )
  ) {
    fail("transaction_contract");
  }

  const directory = mkdtempSync(join(tmpdir(), "fanmind-chat-admin-"));
  const passfile = join(directory, "pgpass");
  try {
    const raw = readFileSync(env.PGPASSFILE);
    writeFileSync(passfile, raw, { mode: 0o600 });
    chmodSync(passfile, 0o600);
    const safeEnvironment = { ...env, PGPASSFILE: passfile };

    const preflightState = readSchemaState(
      run(CHAT_ADMIN_POSTFLIGHT_SQL, safeEnvironment),
    );
    if (mode === "verify") {
      console.log(`CHAT_ADMIN_SCHEMA_STATE=${preflightState}`);
      return;
    }
    if (preflightState !== "ABSENT") {
      fail(
        preflightState === "VERIFIED"
          ? "apply_requires_absent_schema"
          : "schema_partial",
      );
    }

    if (run(source, safeEnvironment).status !== 0) {
      fail("apply_failed");
    }

    const postflightState = readSchemaState(
      run(CHAT_ADMIN_POSTFLIGHT_SQL, safeEnvironment),
    );
    console.log(`CHAT_ADMIN_SCHEMA_STATE=${postflightState}`);
    if (postflightState !== "VERIFIED") {
      fail("postflight_failed");
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    const argument = process.argv[2];
    if (!["--verify", "--apply"].includes(argument)) {
      fail("argument_invalid");
    }
    execute(argument.slice(2));
  } catch (error) {
    console.error(
      error.message?.startsWith("CHAT_ADMIN_STAGING_ERROR=")
        ? error.message
        : "CHAT_ADMIN_STAGING_ERROR=unexpected_failure",
    );
    process.exitCode = 1;
  }
}
