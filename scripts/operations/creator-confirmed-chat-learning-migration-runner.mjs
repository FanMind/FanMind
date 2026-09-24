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
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), "../.."));
const RUNNER_REPO_PATH = "scripts/operations/creator-confirmed-chat-learning-migration-runner.mjs";
const MIGRATION_ID = "20260923023000_creator_confirmed_chat_learning";
const MIGRATION_REPO_PATH = `supabase/controlled/${MIGRATION_ID}.sql`;
const MIGRATION_PATH = resolve(REPO_ROOT, MIGRATION_REPO_PATH);
const ROLLOUT_STATE_REPO_PATH = "src/lib/confirmedChatLearningDeletionVerification.mjs";
const ROLLOUT_STATE_PATH = resolve(REPO_ROOT, ROLLOUT_STATE_REPO_PATH);
const WORKSPACE_BOUNDARY_REPO_PATH =
  "supabase/controlled/20260816120000_workspace_member_data_boundary.sql";
const CREATOR_ACCESS_REPO_PATH = "supabase/controlled/creator_revision_conflict_fix.sql";
const WHATSAPP_INBOUND_REPO_PATH =
  "supabase/controlled/20260817230000_whatsapp_cloud_inbound_foundation.sql";
const REVIEWED_CONTROL_REPO_PATHS = Object.freeze([
  RUNNER_REPO_PATH,
  MIGRATION_REPO_PATH,
  ROLLOUT_STATE_REPO_PATH,
  WORKSPACE_BOUNDARY_REPO_PATH,
  CREATOR_ACCESS_REPO_PATH,
  WHATSAPP_INBOUND_REPO_PATH,
]);
const EXPECTED_MIGRATION_GIT_BLOB_SHA1 = "b09a22643d5076e68cfe7816980e88d0d00272f7";
const EXPECTED_WORKSPACE_BOUNDARY_GIT_BLOB_SHA1 = "07286a4793204a1f3d82c18fca18728b1380d6fa";
const EXPECTED_CREATOR_ACCESS_GIT_BLOB_SHA1 = "c2132db39e141131483afc44d045d21d632b1672";
const EXPECTED_WHATSAPP_INBOUND_GIT_BLOB_SHA1 = "2aac4ab447eaf34685aa7fcff3b78be41332c22b";
const EXPECTED_DATABASE_FUNCTION_OWNER = "postgres";
const EXPECTED_DATABASE_NAME = "postgres";
const APPLY_CONFIRMATION = "apply-creator-confirmed-chat-learning";
const NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT = "I_UNDERSTAND_NON_PRODUCTION_ONLY";
const MAX_PASSFILE_BYTES = 64 * 1024;

const FUNCTION_CONTRACTS = Object.freeze([
  Object.freeze({
    name: "stamp_creator_learning_manual_send",
    signature: "public.stamp_creator_learning_manual_send()",
    securityDefiner: false,
    resultType: "trigger",
    argNames: null,
    executeRoles: Object.freeze([]),
  }),
  Object.freeze({
    name: "record_creator_confirmed_chat_proposals",
    signature:
      "public.record_creator_confirmed_chat_proposals(uuid,uuid,uuid,uuid,integer,text,jsonb)",
    securityDefiner: true,
    resultType: "jsonb",
    argNames: Object.freeze([
      "p_workspace_id",
      "p_contact_id",
      "p_conversation_id",
      "p_creator_id",
      "p_creator_revision",
      "p_prompt_revision",
      "p_proposals",
    ]),
    executeRoles: Object.freeze(["service_role"]),
  }),
  Object.freeze({
    name: "confirm_creator_confirmed_chat_outbound",
    signature:
      "public.confirm_creator_confirmed_chat_outbound(uuid,uuid,uuid,uuid,uuid,text)",
    securityDefiner: true,
    resultType: "jsonb",
    argNames: Object.freeze([
      "p_workspace_id",
      "p_contact_id",
      "p_proposal_id",
      "p_outbound_message_id",
      "p_actor_user_id",
      "p_expected_actual_text",
    ]),
    executeRoles: Object.freeze(["service_role"]),
  }),
  Object.freeze({
    name: "link_creator_confirmed_chat_outcomes",
    signature:
      "public.link_creator_confirmed_chat_outcomes(uuid,uuid,uuid,uuid,uuid)",
    securityDefiner: true,
    resultType: "jsonb",
    argNames: Object.freeze([
      "p_workspace_id",
      "p_contact_id",
      "p_proposal_id",
      "p_reaction_message_id",
      "p_purchase_event_id",
    ]),
    executeRoles: Object.freeze(["authenticated"]),
  }),
]);

const FOUNDATION_FUNCTION_CONTRACTS = Object.freeze([
  Object.freeze({
    name: "creator_workspace_access_allowed",
    signature: "public.creator_workspace_access_allowed(uuid)",
    source: "creatorAccess",
    securityDefiner: true,
    language: "plpgsql",
    proconfig: `array['search_path=""']::text[]`,
  }),
  Object.freeze({
    name: "workspace_owner_active_mutation_allowed",
    signature: "public.workspace_owner_active_mutation_allowed(uuid)",
    source: "workspaceBoundary",
    securityDefiner: false,
    language: "sql",
    proconfig:
      "array['search_path=pg_catalog, public, pg_temp','row_security=on']::text[]",
  }),
  Object.freeze({
    name: "workspace_processing_allowed_contract",
    signature:
      "public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)",
    source: "workspaceBoundary",
    securityDefiner: false,
    language: "plpgsql",
    proconfig: "array['search_path=pg_catalog, public, pg_temp']::text[]",
  }),
]);

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

function functionBody(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const signature = new RegExp(
    `create(?:\\s+or\\s+replace)?\\s+function\\s+public\\.${escaped}\\s*\\(`,
    "giu",
  );
  const match = signature.exec(source);
  if (!match) fail("contract_function_missing");
  const bodyMarker = /\bas\s+(\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)/giu;
  bodyMarker.lastIndex = match.index + match[0].length;
  const marker = bodyMarker.exec(source);
  if (!marker) fail("contract_function_body_invalid");
  const delimiter = marker[1];
  const bodyStart = marker.index + marker[0].length;
  const bodyEnd = source.indexOf(delimiter, bodyStart);
  if (bodyEnd < 0) fail("contract_function_body_invalid");
  return source.slice(bodyStart, bodyEnd);
}

function functionBodyHash(source, name) {
  return createHash("md5").update(functionBody(source, name), "utf8").digest("hex");
}

function readPinnedSource(repoPath, expectedBlobSha1, unreadableCode, checksumCode) {
  let source;
  try {
    source = readFileSync(resolve(REPO_ROOT, repoPath), "utf8");
  } catch {
    fail(unreadableCode);
  }
  if (gitBlobSha1(source) !== expectedBlobSha1) fail(checksumCode);
  return source;
}

function readFoundationContractSources() {
  const workspaceBoundary = readPinnedSource(
    WORKSPACE_BOUNDARY_REPO_PATH,
    EXPECTED_WORKSPACE_BOUNDARY_GIT_BLOB_SHA1,
    "workspace_boundary_unreadable",
    "workspace_boundary_checksum_mismatch",
  );
  const creatorAccess = readPinnedSource(
    CREATOR_ACCESS_REPO_PATH,
    EXPECTED_CREATOR_ACCESS_GIT_BLOB_SHA1,
    "creator_access_contract_unreadable",
    "creator_access_contract_checksum_mismatch",
  );
  const whatsappInbound = readPinnedSource(
    WHATSAPP_INBOUND_REPO_PATH,
    EXPECTED_WHATSAPP_INBOUND_GIT_BLOB_SHA1,
    "whatsapp_inbound_contract_unreadable",
    "whatsapp_inbound_contract_checksum_mismatch",
  );
  for (const contract of FOUNDATION_FUNCTION_CONTRACTS) {
    functionBody(contract.source === "creatorAccess" ? creatorAccess : workspaceBoundary, contract.name);
  }
  functionBody(whatsappInbound, "protect_whatsapp_cloud_message_identity");
  return { workspaceBoundary, creatorAccess, whatsappInbound };
}

function functionMetadataCondition({
  securityDefiner,
  language,
  resultType,
  proconfig,
  bodyHash,
}) {
  return [
    "function_source is null",
    `function_owner is distinct from '${EXPECTED_DATABASE_FUNCTION_OWNER}'`,
    `function_security_definer is distinct from ${securityDefiner ? "true" : "false"}`,
    `function_config is distinct from ${proconfig}`,
    `function_language is distinct from '${language}'`,
    "function_strict is distinct from false",
    "function_volatility is distinct from 's'",
    `function_result_type is distinct from '${resultType}'`,
    "function_returns_set is distinct from false",
    "function_parallel is distinct from 'u'",
    "function_leakproof is distinct from false",
    "function_kind is distinct from 'f'",
    "function_default_count is distinct from 0",
    "function_variadic is distinct from 0::oid",
    `md5(function_source) <> '${bodyHash}'`,
  ].join("\n     or ");
}

function learningFunctionMetadataCondition(contract, bodyHash) {
  const argNameCondition =
    contract.argNames === null
      ? "function_arg_names is not null"
      : `function_arg_names is distinct from ${sqlTextArray(contract.argNames)}`;
  return [
    "function_source is null",
    argNameCondition,
    "function_arg_modes is not null",
    `function_owner is distinct from '${EXPECTED_DATABASE_FUNCTION_OWNER}'`,
    `function_security_definer is distinct from ${contract.securityDefiner ? "true" : "false"}`,
    `function_config is distinct from array['search_path=""']::text[]`,
    "function_language is distinct from 'plpgsql'",
    "function_strict is distinct from false",
    "function_volatility is distinct from 'v'",
    `function_result_type is distinct from '${contract.resultType}'`,
    "function_returns_set is distinct from false",
    "function_parallel is distinct from 'u'",
    "function_leakproof is distinct from false",
    "function_kind is distinct from 'f'",
    "function_default_count is distinct from 0",
    "function_variadic is distinct from 0::oid",
    `md5(function_source) <> '${bodyHash}'`,
  ].join("\n     or ");
}

function pgProcSelect(signature) {
  return String.raw`select
      p.prosecdef,
      pg_get_userbyid(p.proowner)::text,
      p.proconfig,
      p.prosrc,
      p.proisstrict,
      p.provolatile::text,
      l.lanname::text,
      format_type(p.prorettype, null),
      p.proretset,
      p.proparallel::text,
      p.proleakproof,
      p.prokind::text,
      p.pronargdefaults,
      p.provariadic,
      p.proargnames,
      p.proargmodes
    into
      function_security_definer,
      function_owner,
      function_config,
      function_source,
      function_strict,
      function_volatility,
      function_language,
      function_result_type,
      function_returns_set,
      function_parallel,
      function_leakproof,
      function_kind,
      function_default_count,
      function_variadic,
      function_arg_names,
      function_arg_modes
    from pg_proc p
    join pg_language l on l.oid = p.prolang
   where p.oid = to_regprocedure('${signature}');`;
}

function sqlTextArray(values) {
  if (values.length === 0) return "array[]::text[]";
  return `array[${values.map((value) => `'${value.replaceAll("'", "''")}'`).join(",")}]::text[]`;
}

function buildVerifySql(sql, foundationSources) {
  const hashes = Object.fromEntries(
    FUNCTION_CONTRACTS.map(({ name }) => [name, functionBodyHash(sql, name)]),
  );
  const foundationHashes = Object.fromEntries(
    FOUNDATION_FUNCTION_CONTRACTS.map((contract) => [
      contract.name,
      functionBodyHash(
        contract.source === "creatorAccess"
          ? foundationSources.creatorAccess
          : foundationSources.workspaceBoundary,
        contract.name,
      ),
    ]),
  );

  const whatsappIdentityBodyHash = functionBodyHash(
    foundationSources.whatsappInbound,
    "protect_whatsapp_cloud_message_identity",
  );

  const foundationChecks = FOUNDATION_FUNCTION_CONTRACTS.map((contract) => {
    const resultType = "boolean";
    return String.raw`
  ${pgProcSelect(contract.signature)}
  if ${functionMetadataCondition({
    securityDefiner: contract.securityDefiner,
    language: contract.language,
    resultType,
    proconfig: contract.proconfig,
    bodyHash: foundationHashes[contract.name],
  })} then
    raise exception 'creator_learning_foundation_function_invalid';
  end if;`;
  }).join("\n");

  const learningChecks = FUNCTION_CONTRACTS.map(
    (contract) => String.raw`
  ${pgProcSelect(contract.signature)}
  if ${learningFunctionMetadataCondition(contract, hashes[contract.name])} then
    raise exception 'creator_learning_function_metadata_invalid';
  end if;`,
  ).join("\n");

  const learningOverloadChecks = FUNCTION_CONTRACTS.map(
    (contract) => String.raw`
  if (
    select count(*)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = '${contract.name}'
  ) <> 1 then
    raise exception 'creator_learning_function_overload_invalid';
  end if;`,
  ).join("\n");

  const learningAclChecks = FUNCTION_CONTRACTS.map(
    (contract) => String.raw`
  select coalesce(
           array_agg(grantee_name order by grantee_name),
           array[]::text[]
         )
    into function_execute_grantees
    from (
      select distinct
             case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end as grantee_name
        from pg_proc p
        cross join lateral aclexplode(
          coalesce(p.proacl, acldefault('f', p.proowner))
        ) acl
        left join pg_roles grantee on grantee.oid = acl.grantee and acl.grantee <> 0
       where p.oid = to_regprocedure('${contract.signature}')
         and acl.privilege_type = 'EXECUTE'
         and acl.grantee <> p.proowner
    ) direct_execute;
  if function_execute_grantees is distinct from ${sqlTextArray(contract.executeRoles)}
     or exists (
       select 1
         from pg_proc p
         cross join lateral aclexplode(
           coalesce(p.proacl, acldefault('f', p.proowner))
         ) acl
        where p.oid = to_regprocedure('${contract.signature}')
          and acl.privilege_type = 'EXECUTE'
          and acl.grantee <> p.proowner
          and acl.is_grantable
     ) then
    raise exception 'creator_learning_function_acl_invalid';
  end if;`,
  ).join("\n");

  return String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
set local search_path = pg_catalog;

do $verify$
declare
  learning_table oid := to_regclass('public.creator_confirmed_chat_learning');
  messages_table oid := to_regclass('public.conversation_messages');
  policy_count integer;
  policy_roles name[];
  policy_qual text;
  policy_permissive text;
  policy_check text;
  trigger_def text;
  function_source text;
  function_security_definer boolean;
  function_owner text;
  function_config text[];
  function_strict boolean;
  function_volatility text;
  function_language text;
  function_result_type text;
  function_returns_set boolean;
  function_parallel text;
  function_leakproof boolean;
  function_kind text;
  function_default_count integer;
  function_variadic oid;
  function_arg_names text[];
  function_arg_modes "char"[];
  function_execute_grantees text[];
  table_acl_entries text[];
  index_def text;
  constraint_defs text[];
  check_constraint_defs text[];
  expected_check_sources text[] := array[
    '(creator_revision > 0)',
    '(length(btrim(prompt_revision)) between 1 and 120)',
    '(selected_variant in (''recommended'',''softer'',''stronger''))',
    '(length(btrim(proposed_text)) between 1 and 4000)',
    '((outbound_message_id is null and actual_text is null and confirmed_at is null and confirmed_by is null and reaction_message_id is null and reaction_at is null and purchase_event_id is null and purchase_evidence_reference is null and purchase_at is null) or (outbound_message_id is not null and actual_text is not null and length(btrim(actual_text)) between 1 and 4000 and confirmed_at is not null))',
    '((reaction_message_id is null) = (reaction_at is null))',
    '((purchase_event_id is null and purchase_evidence_reference is null and purchase_at is null) or (purchase_event_id is not null and purchase_evidence_reference is not null and length(btrim(purchase_evidence_reference)) between 1 and 200 and purchase_at is not null))',
    '(confirmed_at is null or confirmed_at >= generated_at)',
    '(reaction_at is null or reaction_at >= confirmed_at)',
    '(purchase_at is null or purchase_at >= confirmed_at)'
  ];
  expected_check_defs text[] := '{}'::text[];
  expected_check_source text;
  expected_check_plan json;
  expected_check_def text;
begin
  if current_user is distinct from '${EXPECTED_DATABASE_FUNCTION_OWNER}'
     or current_database() is distinct from '${EXPECTED_DATABASE_NAME}' then
    raise exception 'creator_learning_server_identity_invalid';
  end if;

  if to_regclass('public.creators') is null
     or to_regclass('public.creator_commercial_events') is null
     or messages_table is null
     or to_regprocedure('public.creator_workspace_access_allowed(uuid)') is null
     or to_regprocedure('public.workspace_owner_active_mutation_allowed(uuid)') is null
     or to_regprocedure('public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)') is null then
    raise exception 'creator_learning_foundation_missing';
  end if;

${foundationChecks}

  if not has_function_privilege(
       'authenticated',
       'public.creator_workspace_access_allowed(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.creator_workspace_access_allowed(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.creator_workspace_access_allowed(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.workspace_owner_active_mutation_allowed(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.workspace_owner_active_mutation_allowed(uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.workspace_owner_active_mutation_allowed(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamp with time zone)',
       'EXECUTE'
     ) then
    raise exception 'creator_learning_foundation_function_privilege_invalid';
  end if;

  if learning_table is null then
    if exists (
      select 1 from pg_attribute
       where attrelid = messages_table
         and attname = 'creator_learning_manual_send'
         and attnum > 0 and not attisdropped
    )
    or exists (
      select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in (
           'stamp_creator_learning_manual_send',
           'record_creator_confirmed_chat_proposals',
           'confirm_creator_confirmed_chat_outbound',
           'link_creator_confirmed_chat_outcomes'
         )
    )
    or exists (
      select 1
        from pg_trigger t
       where t.tgrelid = messages_table
         and t.tgname = 'conversation_messages_stamp_creator_learning_manual_send'
         and not t.tgisinternal
    ) then
      raise exception 'creator_learning_schema_partial';
    end if;
    return;
  end if;

  if not exists (
    select 1 from pg_class
     where oid = learning_table
       and relkind = 'r'
       and relpersistence = 'p'
       and not relispartition
       and pg_get_userbyid(relowner) = '${EXPECTED_DATABASE_FUNCTION_OWNER}'
       and relrowsecurity
  ) then
    raise exception 'creator_learning_rls_invalid';
  end if;

  if exists (
    select 1 from pg_inherits
     where inhrelid = learning_table or inhparent = learning_table
  ) then
    raise exception 'creator_learning_inheritance_invalid';
  end if;

  if exists (
    select 1 from pg_rewrite
     where ev_class = learning_table
  ) then
    raise exception 'creator_learning_rewrite_rule_invalid';
  end if;

  if (select count(*) from pg_roles where rolname in ('anon','authenticated')) <> 2
     or exists (
       select 1 from pg_roles
        where rolname in ('anon','authenticated')
          and (rolbypassrls or rolsuper)
     ) then
    raise exception 'creator_learning_browser_role_rls_invalid';
  end if;

  if exists (
    select 1 from pg_trigger
     where tgrelid = learning_table
       and not tgisinternal
  ) then
    raise exception 'creator_learning_trigger_set_invalid';
  end if;

  if (select count(*)
        from pg_attribute
       where attrelid = learning_table
         and attnum > 0
         and not attisdropped) <> 22 then
    raise exception 'creator_learning_column_contract_invalid';
  end if;

  if exists (
    with expected(column_name, type_name, not_null, default_expr) as (
      values
        ('proposal_id','uuid',true,null::text),
        ('generation_id','uuid',true,null::text),
        ('workspace_id','uuid',true,null::text),
        ('creator_id','uuid',true,null::text),
        ('contact_id','uuid',true,null::text),
        ('conversation_id','uuid',true,null::text),
        ('creator_revision','integer',true,null::text),
        ('prompt_revision','text',true,null::text),
        ('selected_variant','text',true,null::text),
        ('proposed_text','text',true,null::text),
        ('generated_at','timestamp with time zone',true,null::text),
        ('outbound_message_id','uuid',false,null::text),
        ('actual_text','text',false,null::text),
        ('confirmed_at','timestamp with time zone',false,null::text),
        ('confirmed_by','uuid',false,null::text),
        ('reaction_message_id','uuid',false,null::text),
        ('reaction_at','timestamp with time zone',false,null::text),
        ('purchase_event_id','uuid',false,null::text),
        ('purchase_evidence_reference','text',false,null::text),
        ('purchase_at','timestamp with time zone',false,null::text),
        ('created_at','timestamp with time zone',true,'now()'),
        ('updated_at','timestamp with time zone',true,'now()')
    )
    select 1
      from expected e
      left join pg_attribute a
        on a.attrelid = learning_table
       and a.attname = e.column_name
       and a.attnum > 0
       and not a.attisdropped
      left join pg_attrdef d
        on d.adrelid = a.attrelid
       and d.adnum = a.attnum
     where a.attname is null
        or format_type(a.atttypid, a.atttypmod) <> e.type_name
        or a.attnotnull is distinct from e.not_null
        or (e.default_expr is null and d.adbin is not null)
        or (
          e.default_expr is not null
          and regexp_replace(coalesce(pg_get_expr(d.adbin, d.adrelid), ''), '[[:space:]]+', '', 'g')
              <> e.default_expr
        )
  ) then
    raise exception 'creator_learning_column_contract_invalid';
  end if;

  if not exists (
    select 1
      from pg_attribute a
      join pg_attrdef d
        on d.adrelid = a.attrelid
       and d.adnum = a.attnum
     where a.attrelid = messages_table
       and a.attname = 'creator_learning_manual_send'
       and format_type(a.atttypid, a.atttypmod) = 'boolean'
       and a.attnotnull
       and a.attnum > 0
       and not a.attisdropped
       and regexp_replace(pg_get_expr(d.adbin, d.adrelid), '[[:space:]]+', '', 'g') = 'false'
  ) then
    raise exception 'creator_learning_manual_send_column_invalid';
  end if;

  if exists (
    select 1
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
     where t.tgrelid = messages_table
       and not t.tgisinternal
       and t.tgenabled <> 'D'
       and t.tgname not in (
         'conversation_messages_stamp_creator_learning_manual_send',
         'conversation_messages_whatsapp_identity_immutable'
       )
       and (t.tgtype & 1) = 1
       and (t.tgtype & 2) = 2
       and ((t.tgtype & 4) = 4 or (t.tgtype & 16) = 16)
       and (
         t.tgname > 'conversation_messages_stamp_creator_learning_manual_send'
         or position(
           'creator_learning_manual_send' in lower(pg_get_functiondef(p.oid))
         ) > 0
       )
  ) then
    raise exception 'creator_learning_manual_send_competing_trigger_invalid';
  end if;

  if exists (
    select 1 from pg_trigger
     where tgrelid = messages_table
       and tgname = 'conversation_messages_whatsapp_identity_immutable'
       and not tgisinternal
  ) then
    select pg_get_triggerdef(t.oid, true) into trigger_def
      from pg_trigger t
     where t.tgrelid = messages_table
       and t.tgname = 'conversation_messages_whatsapp_identity_immutable'
       and t.tgenabled = 'O'
       and not t.tgisinternal;
    trigger_def := regexp_replace(
      replace(lower(coalesce(trigger_def, '')), 'public.', ''),
      '\s+',
      '',
      'g'
    );
    if trigger_def <>
       'createtriggerconversation_messages_whatsapp_identity_immutablebeforeupdateonconversation_messagesforeachrowexecutefunctionprotect_whatsapp_cloud_message_identity()' then
      raise exception 'creator_learning_whatsapp_identity_trigger_invalid';
    end if;

    ${pgProcSelect("public.protect_whatsapp_cloud_message_identity()")}
    if ${learningFunctionMetadataCondition(
      {
        securityDefiner: true,
        resultType: "trigger",
      },
      whatsappIdentityBodyHash,
    ).replace(
      `array['search_path=""']::text[]`,
      "array['search_path=pg_catalog, public, pg_temp']::text[]",
    )} then
      raise exception 'creator_learning_whatsapp_identity_function_invalid';
    end if;
    select coalesce(
             array_agg(grantee_name order by grantee_name),
             array[]::text[]
           )
      into function_execute_grantees
      from (
        select distinct
               case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end as grantee_name
          from pg_proc p
          cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
          left join pg_roles grantee on grantee.oid = acl.grantee and acl.grantee <> 0
         where p.oid = to_regprocedure('public.protect_whatsapp_cloud_message_identity()')
           and acl.privilege_type = 'EXECUTE'
           and acl.grantee <> p.proowner
      ) direct_execute;
    if function_execute_grantees is distinct from array['service_role']::text[]
       or exists (
         select 1
           from pg_proc p
           cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
          where p.oid = to_regprocedure('public.protect_whatsapp_cloud_message_identity()')
            and acl.privilege_type = 'EXECUTE'
            and acl.grantee <> p.proowner
            and acl.is_grantable
       ) then
      raise exception 'creator_learning_whatsapp_identity_function_acl_invalid';
    end if;
  end if;

  select pg_get_triggerdef(t.oid, true) into trigger_def
    from pg_trigger t
   where t.tgrelid = messages_table
     and t.tgname = 'conversation_messages_stamp_creator_learning_manual_send'
     and t.tgenabled = 'O'
     and not t.tgisinternal;
  trigger_def := regexp_replace(
      replace(lower(coalesce(trigger_def, '')), 'public.', ''),
      '\s+',
      '',
      'g'
    );
  if trigger_def <>
     'createtriggerconversation_messages_stamp_creator_learning_manual_sendbeforeinsertorupdateonconversation_messagesforeachrowexecutefunctionstamp_creator_learning_manual_send()' then
    raise exception 'creator_learning_manual_send_trigger_invalid';
  end if;

${learningOverloadChecks}

  if to_regprocedure('public.stamp_creator_learning_manual_send()') is null
     or to_regprocedure('public.record_creator_confirmed_chat_proposals(uuid,uuid,uuid,uuid,integer,text,jsonb)') is null
     or to_regprocedure('public.confirm_creator_confirmed_chat_outbound(uuid,uuid,uuid,uuid,uuid,text)') is null
     or to_regprocedure('public.link_creator_confirmed_chat_outcomes(uuid,uuid,uuid,uuid,uuid)') is null then
    raise exception 'creator_learning_functions_missing';
  end if;

${learningChecks}

${learningAclChecks}

  if exists (
    select 1
      from pg_auth_members membership
      join pg_roles inherited_role on inherited_role.oid = membership.roleid
     where inherited_role.rolname in ('service_role','authenticated','${EXPECTED_DATABASE_FUNCTION_OWNER}')
       and membership.inherit_option
  ) then
    raise exception 'creator_learning_function_acl_inheritance_invalid';
  end if;

  select count(*)::integer into policy_count
    from pg_policies
   where schemaname = 'public'
     and tablename = 'creator_confirmed_chat_learning';

  select roles, qual, permissive, with_check
    into policy_roles, policy_qual, policy_permissive, policy_check
    from pg_policies
   where schemaname = 'public'
     and tablename = 'creator_confirmed_chat_learning'
     and policyname = 'creator_confirmed_chat_learning_member_read'
     and cmd = 'SELECT';

  policy_qual := regexp_replace(
    replace(lower(coalesce(policy_qual, '')), 'public.', ''),
    '[[:space:]]+',
    '',
    'g'
  );
  policy_qual := replace(policy_qual, '(selectauth.uid()asuid)', 'AUTH_UID');
  policy_qual := replace(policy_qual, '(selectauth.uid())', 'AUTH_UID');
  policy_qual := replace(
    policy_qual,
    'creator_workspace_access_allowed(creator_confirmed_chat_learning.workspace_id)',
    'creator_workspace_access_allowed(workspace_id)'
  );
  if policy_count <> 1
     or policy_roles is distinct from array['authenticated']::name[]
     or policy_permissive is distinct from 'PERMISSIVE'
     or policy_check is not null
     or policy_qual <> '(creator_workspace_access_allowed(workspace_id)and((exists(select1fromworkspace_membersmwhere((m.workspace_id=creator_confirmed_chat_learning.workspace_id)and(m.user_id=AUTH_UID))))or(exists(select1fromworkspaceswwhere((w.id=creator_confirmed_chat_learning.workspace_id)and(w.owner_user_id=AUTH_UID))))))' then
    raise exception 'creator_learning_policy_invalid';
  end if;

  if not has_table_privilege('authenticated', learning_table, 'SELECT')
     or has_table_privilege('authenticated', learning_table, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
     or has_table_privilege('anon', learning_table, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
     or not has_table_privilege('service_role', learning_table, 'SELECT')
     or not has_table_privilege('service_role', learning_table, 'INSERT')
     or not has_table_privilege('service_role', learning_table, 'UPDATE')
     or not has_table_privilege('service_role', learning_table, 'DELETE')
     or not has_table_privilege('service_role', learning_table, 'TRUNCATE')
     or not has_table_privilege('service_role', learning_table, 'REFERENCES')
     or not has_table_privilege('service_role', learning_table, 'TRIGGER')
     or not has_table_privilege('service_role', learning_table, 'MAINTAIN') then
    raise exception 'creator_learning_table_privilege_invalid';
  end if;

  select coalesce(
           array_agg(
             (case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end)
             || ':' || acl.privilege_type
             || ':' || acl.is_grantable::text
             || ':' || grantor.rolname
             order by
               case when acl.grantee = 0 then 'PUBLIC' else grantee.rolname end,
               acl.privilege_type
           ),
           array[]::text[]
         )
    into table_acl_entries
    from pg_class c
    cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) acl
    left join pg_roles grantee on grantee.oid = acl.grantee and acl.grantee <> 0
    join pg_roles grantor on grantor.oid = acl.grantor
   where c.oid = learning_table
     and acl.grantee <> c.relowner;
  if table_acl_entries is distinct from array[
       'authenticated:SELECT:false:postgres',
       'service_role:DELETE:false:postgres',
       'service_role:INSERT:false:postgres',
       'service_role:MAINTAIN:false:postgres',
       'service_role:REFERENCES:false:postgres',
       'service_role:SELECT:false:postgres',
       'service_role:TRIGGER:false:postgres',
       'service_role:TRUNCATE:false:postgres',
       'service_role:UPDATE:false:postgres'
     ]::text[] then
    raise exception 'creator_learning_table_acl_invalid';
  end if;

  if exists (
    select 1
      from pg_attribute a
     where a.attrelid = learning_table
       and a.attnum > 0
       and not a.attisdropped
       and a.attacl is not null
       and cardinality(a.attacl) > 0
  ) then
    raise exception 'creator_learning_column_acl_invalid';
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
     or has_function_privilege(
       'anon',
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
     or has_function_privilege(
       'anon',
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
    join pg_am am on am.oid = c.relam
   where i.indrelid = learning_table
     and i.indisvalid and i.indisready and i.indislive
     and not i.indisunique
     and i.indpred is null and i.indexprs is null
     and i.indnkeyatts = 4 and i.indnatts = 4
     and am.amname = 'btree'
     and c.relname = 'creator_confirmed_chat_learning_contact_idx';
  index_def := regexp_replace(
    replace(lower(coalesce(index_def, '')), 'public.', ''),
    '[[:space:]]+',
    '',
    'g'
  );
  if index_def <>
     'createindexcreator_confirmed_chat_learning_contact_idxoncreator_confirmed_chat_learningusingbtree(workspace_id,creator_id,contact_id,generated_atdesc)' then
    raise exception 'creator_learning_index_invalid';
  end if;

  if exists (
    select 1
      from pg_index i
     where i.indrelid = learning_table
       and i.indisunique
       and i.indisready
       and i.indislive
       and not exists (
         select 1
           from pg_constraint c
          where c.conrelid = learning_table
            and c.conindid = i.indexrelid
            and c.contype in ('p','u')
       )
  ) then
    raise exception 'creator_learning_unexpected_unique_index';
  end if;

  if (select count(*) from pg_constraint where conrelid = learning_table) <> 18
     or exists (
       select 1 from pg_constraint
        where conrelid = learning_table
          and (not convalidated or condeferrable or condeferred)
     ) then
    raise exception 'creator_learning_constraint_invalid';
  end if;

  select array_agg(
           regexp_replace(
             replace(lower(pg_get_constraintdef(oid)), 'public.', ''),
             '\s+',
             '',
             'g'
           )
         )
    into constraint_defs
    from pg_constraint
   where conrelid = learning_table;

  select array_agg(
           regexp_replace(
             replace(
               replace(
                 lower(pg_get_expr(conbin, conrelid, true)),
                 '::text',
                 ''
               ),
               'public.',
               ''
             ),
             '[[:space:]]+',
             '',
             'g'
           )
           order by oid
         )
    into check_constraint_defs
    from pg_constraint
   where conrelid = learning_table
     and contype = 'c'
     and convalidated;

  foreach expected_check_source in array expected_check_sources
  loop
    execute format(
      'explain (verbose, format json) select (%s) from public.creator_confirmed_chat_learning where false',
      expected_check_source
    ) into expected_check_plan;
    expected_check_def := expected_check_plan->0->'Plan'->'Output'->>0;
    expected_check_def := regexp_replace(
      replace(
        replace(
          replace(lower(coalesce(expected_check_def, '')), 'creator_confirmed_chat_learning.', ''),
          '::text',
          ''
        ),
        'public.',
        ''
      ),
      '[[:space:]]+',
      '',
      'g'
    );
    expected_check_defs := array_append(expected_check_defs, expected_check_def);
  end loop;

  if constraint_defs is null
     or check_constraint_defs is null
     or array_length(check_constraint_defs, 1) <> 10
     or array_length(expected_check_defs, 1) <> 10
     or not ('primarykey(proposal_id)' = any(constraint_defs))
     or not ('foreignkey(workspace_id,creator_id)referencescreators(workspace_id,id)ondeletecascade' = any(constraint_defs))
     or not ('foreignkey(workspace_id,contact_id,conversation_id)referencesconversations(workspace_id,contact_id,id)ondeletecascade' = any(constraint_defs))
     or not ('foreignkey(confirmed_by)referencesauth.users(id)ondeletesetnull' = any(constraint_defs))
     or not ('unique(workspace_id,generation_id)' = any(constraint_defs))
     or not ('unique(workspace_id,outbound_message_id)' = any(constraint_defs))
     or not ('unique(workspace_id,reaction_message_id)' = any(constraint_defs))
     or not ('unique(workspace_id,purchase_event_id)' = any(constraint_defs))
     or exists (
       select 1
         from unnest(expected_check_defs) as expected(definition)
        where not (expected.definition = any(check_constraint_defs))
     ) then
    raise exception 'creator_learning_constraint_invalid';
  end if;

  if (select count(*) from pg_constraint where conrelid = learning_table and contype = 'f') <> 3
     or exists (
       select 1
         from pg_constraint c
        where c.conrelid = learning_table
          and c.contype = 'f'
          and (
            (
              select count(*)
                from pg_trigger t
               where t.tgconstraint = c.oid
                 and t.tgisinternal
                 and t.tgrelid in (c.conrelid,c.confrelid)
            ) <> 4
            or exists (
              select 1
                from pg_trigger t
               where t.tgconstraint = c.oid
                 and t.tgisinternal
                 and t.tgrelid in (c.conrelid,c.confrelid)
                 and t.tgenabled <> 'O'
            )
          )
     ) then
    raise exception 'creator_learning_foreign_key_trigger_invalid';
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

function safeGitEnvironment(environment = process.env) {
  const allowed = ["PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "SYSTEMROOT", "WINDIR"];
  const safe = Object.fromEntries(
    allowed
      .filter((key) => typeof environment[key] === "string")
      .map((key) => [key, environment[key]]),
  );
  safe.GIT_NO_REPLACE_OBJECTS = "1";
  safe.GIT_TERMINAL_PROMPT = "0";
  return safe;
}

function runGit(args, environment = process.env) {
  return spawnSync("git", ["-C", REPO_ROOT, ...args], {
    cwd: REPO_ROOT,
    env: safeGitEnvironment(environment),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

function requireRepositoryIdentity(environment) {
  const topLevel = runGit(["rev-parse", "--show-toplevel"], environment);
  if (
    topLevel.status !== 0 ||
    !clean(topLevel.stdout) ||
    realpathSync(clean(topLevel.stdout)) !== REPO_ROOT
  ) {
    fail("checkout_repository_mismatch");
  }
}

function reviewedRolloutState(reviewedCommit, environment) {
  const shown = runGit(["show", `${reviewedCommit}:${ROLLOUT_STATE_REPO_PATH}`], environment);
  if (shown.status !== 0) fail("reviewed_rollout_state_unreadable");
  return parseRolloutState(shown.stdout);
}

function requireCleanTrackedCheckout(environment) {
  const status = runGit(["status", "--porcelain=v1", "--untracked-files=no"], environment);
  if (status.status !== 0 || clean(status.stdout)) fail("checkout_dirty");
}

function requireReviewedControlFiles(reviewedCommit, environment) {
  const indexed = runGit(["ls-files", "-v", "--", ...REVIEWED_CONTROL_REPO_PATHS], environment);
  if (indexed.status !== 0) fail("checkout_index_state_unreadable");
  const entries = clean(indexed.stdout).split(/\r?\n/u).filter(Boolean);
  if (entries.length !== REVIEWED_CONTROL_REPO_PATHS.length) {
    fail("checkout_index_flag_invalid");
  }
  const states = new Map();
  for (const entry of entries) {
    const match = /^([A-Za-z]) (.+)$/u.exec(entry);
    if (!match || states.has(match[2])) fail("checkout_index_flag_invalid");
    states.set(match[2], match[1]);
  }
  for (const repoPath of REVIEWED_CONTROL_REPO_PATHS) {
    if (states.get(repoPath) !== "H") fail("checkout_index_flag_invalid");
    const shown = runGit(["show", `${reviewedCommit}:${repoPath}`], environment);
    if (shown.status !== 0) fail("reviewed_control_file_unreadable");
    let working;
    try {
      working = readFileSync(resolve(REPO_ROOT, repoPath), "utf8");
    } catch {
      fail("reviewed_control_file_unreadable");
    }
    if (working !== shown.stdout) fail("checkout_reviewed_file_mismatch");
  }
}

function readAndVerifyMigration() {
  const sql = readPinnedSource(
    MIGRATION_REPO_PATH,
    EXPECTED_MIGRATION_GIT_BLOB_SHA1,
    "migration_unreadable",
    "migration_checksum_mismatch",
  );
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
  for (const { name } of FUNCTION_CONTRACTS) functionBody(sql, name);
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

function isSupabasePoolerHost(host) {
  return /^(?:[a-z0-9-]+\.)+pooler\.supabase\.com$/u.test(host);
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
  if (clean(environment.PGDATABASE) !== EXPECTED_DATABASE_NAME) {
    fail("database_name_binding_invalid");
  }
  const pgUser = clean(environment.PGUSER).toLowerCase();
  const directProjectHost = `db.${targetReference}.supabase.co`;
  const directProjectConnection = pgHost === directProjectHost && pgUser === "postgres";
  const poolerProjectConnection =
    isSupabasePoolerHost(pgHost) && pgUser === `postgres.${targetReference}`;
  if (!directProjectConnection && !poolerProjectConnection) {
    fail("database_project_binding_invalid");
  }

  if (clean(environment.PGSSLMODE) !== "verify-full") fail("tls_mode_invalid");
  if (!isAbsolute(clean(environment.PGSSLROOTCERT))) fail("tls_root_invalid");

  const reviewedCommit = clean(
    environment.FANMIND_CREATOR_CONFIRMED_CHAT_REVIEWED_COMMIT,
  ).toLowerCase();
  if (!/^[0-9a-f]{40}$/u.test(reviewedCommit)) fail("reviewed_commit_invalid");
  requireRepositoryIdentity(environment);
  const actual = runGit(["rev-parse", "HEAD"], environment);
  if (actual.status !== 0 || clean(actual.stdout).toLowerCase() !== reviewedCommit) {
    fail("checkout_mismatch");
  }

  requireCleanTrackedCheckout(environment);
  requireReviewedControlFiles(reviewedCommit, environment);
  if (mode === "apply") {
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
  return { reviewedCommit, runtime };
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
    "PATH",
    "LANG",
    "LC_ALL",
    "PGHOST",
    "PGPORT",
    "PGDATABASE",
    "PGUSER",
    "PGSSLMODE",
    "PGSSLROOTCERT",
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

function runDatabaseMode(mode, sql, verifySql, state, environment, database) {
  const before = databaseState(database(verifySql));
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
    if (before === "installed") {
      return [
        "CREATOR_CONFIRMED_CHAT_SCHEMA_STATE=installed",
        "CREATOR_CONFIRMED_CHAT_SOURCE_STATE=installed",
        "CREATOR_CONFIRMED_CHAT_POSTFLIGHT=PASS",
        "CREATOR_CONFIRMED_CHAT_APPLY=not_requested",
      ];
    }
    const runtime = clean(environment.FANMIND_RUNTIME_ENVIRONMENT).toLowerCase();
    return runtime === "production"
      ? [
          "CREATOR_CONFIRMED_CHAT_SCHEMA_STATE=absent",
          "CREATOR_CONFIRMED_CHAT_SOURCE_STATE=installed",
          "CREATOR_CONFIRMED_CHAT_NEXT=separate_production_rollout_plan_required",
          "CREATOR_CONFIRMED_CHAT_APPLY=forbidden",
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
  const after = databaseState(database(verifySql));
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
  const foundationSources = readFoundationContractSources();
  const verifySql = buildVerifySql(sql, foundationSources);
  const workingState = rolloutState();
  const digest = createHash("sha256").update(sql).digest("hex");

  if (modeArg === "--check") {
    console.log(`CREATOR_CONFIRMED_CHAT_MIGRATION_ID=${MIGRATION_ID}`);
    console.log("CREATOR_CONFIRMED_CHAT_MIGRATION_CHECKSUM=verified");
    console.log(`CREATOR_CONFIRMED_CHAT_MIGRATION_SHA256=${digest}`);
    console.log("CREATOR_CONFIRMED_CHAT_MIGRATION_CONTRACT=verified");
    console.log("CREATOR_CONFIRMED_CHAT_FOUNDATION_CONTRACT=verified");
    console.log(`CREATOR_CONFIRMED_CHAT_SOURCE_STATE=${workingState}`);
    console.log("CREATOR_CONFIRMED_CHAT_APPLY=not_requested");
    return;
  }

  const mode = modeArg.slice(2);
  if (mode === "apply" && workingState !== "installed") fail("source_state_not_installed");
  const { reviewedCommit } = requireTarget(environment, mode);
  const state = reviewedRolloutState(reviewedCommit, environment);
  if (state !== workingState) fail("rollout_state_checkout_mismatch");
  if (mode === "apply" && state !== "installed") fail("source_state_not_installed");

  const { snapshotDirectory, snapshotPath } = privatePassfileSnapshot(environment);
  try {
    for (const marker of runDatabaseMode(
      mode,
      sql,
      verifySql,
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