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
        and q = 'is_current_chat_admin_workspace(workspace_id)'
        and wc like '%is_current_chat_admin_workspace(workspace_id)%'
        and wc like '%created_by_user_id=auth.uid()%'
      )
      or (
        policyname = 'chat_admin_conversations_owner_all'
        and tablename = 'chat_character_conversations'
        and cmd = 'ALL'
        and q = 'is_current_chat_admin_workspace(workspace_id)'
        and wc = 'is_current_chat_admin_workspace(workspace_id)'
      )
      or (
        policyname = 'chat_admin_messages_owner_all'
        and tablename = 'chat_character_messages'
        and cmd = 'ALL'
        and q = 'is_current_chat_admin_workspace(workspace_id)'
        and wc = 'is_current_chat_admin_workspace(workspace_id)'
      )
    );

  select count(*) into constraint_valid
  from pg_constraint c
  where (
      c.conrelid = to_regclass('public.chat_character_conversations')
      and c.contype = 'f'
      and regexp_replace(pg_get_constraintdef(c.oid, true), '[[:space:]]+', '', 'g')
        = 'FOREIGNKEY(workspace_id,character_id)REFERENCESchat_characters(workspace_id,id)ONDELETECASCADE'
    )
    or (
      c.conrelid = to_regclass('public.chat_character_messages')
      and c.contype = 'f'
      and regexp_replace(pg_get_constraintdef(c.oid, true), '[[:space:]]+', '', 'g')
        = 'FOREIGNKEY(workspace_id,character_id,conversation_id)REFERENCESchat_character_conversations(workspace_id,character_id,id)ONDELETECASCADE'
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
  where n.nspname = 'public'
    and p.proname = 'is_current_chat_admin_workspace'
    and pg_get_function_identity_arguments(p.oid) = 'target_workspace_id uuid'
    and not p.prosecdef
    and array_to_string(coalesce(p.proconfig, '{}'::text[]), ',') like '%search_path=%';

  if present <> 6
    or rls_enabled <> 4
    or policy_count <> 4
    or policy_valid <> 4
    or constraint_valid <> 2
    or index_valid <> 1
    or function_valid <> 1
    or has_table_privilege(
      'anon',
      'public.chat_characters',
      'select,insert,update,delete'
    )
    or not has_table_privilege(
      'authenticated',
      'public.chat_characters',
      'select,insert,update,delete'
    )
    or has_function_privilege(
      'anon',
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

    if (mode === "apply" && run(source, safeEnvironment).status !== 0) {
      fail("apply_failed");
    }

    const result = run(CHAT_ADMIN_POSTFLIGHT_SQL, safeEnvironment);
    if (result.status !== 0) {
      fail(result.stderr.includes("PARTIAL") ? "schema_partial" : "verify_failed");
    }
    const output = result.stderr + result.stdout;
    const state = output.includes("VERIFIED")
      ? "VERIFIED"
      : output.includes("ABSENT")
        ? "ABSENT"
        : "PARTIAL";
    console.log(`CHAT_ADMIN_SCHEMA_STATE=${state}`);
    if (mode === "apply" && state !== "VERIFIED") {
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
