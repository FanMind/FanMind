#!/usr/bin/env node
import { spawnSync } from "node:child_process";

import { evaluateChatAdminStagingControlEnvironment } from "../../src/lib/chatAdminStagingControlPolicy.mjs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const CHAT_ADMIN_ACCEPTANCE_SQL = String.raw`\set ON_ERROR_STOP on
begin;
select set_config('fanmind.synthetic_workspace', :'workspace_id', true);
select set_config('fanmind.fixture.workspace_id', :'workspace_id', true);
select set_config('fanmind.fixture.second_workspace_id', :'second_workspace_id', true);
select set_config('fanmind.fixture.owner_id', :'owner_id', true);
select set_config('fanmind.fixture.member_id', :'member_id', true);
select set_config('fanmind.fixture.foreign_owner_id', :'foreign_owner_id', true);
select set_config('fanmind.fixture.platform_admin_id', :'platform_admin_id', true);
select set_config('fanmind.fixture.character_a', :'character_a', true);
select set_config('fanmind.fixture.character_b', :'character_b', true);
select set_config('fanmind.fixture.conversation_a', :'conversation_a', true);
select set_config('fanmind.fixture.conversation_b', :'conversation_b', true);

do $preflight$
begin
  if current_setting('fanmind.synthetic_workspace', true) <>
    current_setting('fanmind.fixture.workspace_id', true) then
    raise exception 'synthetic_fixture_missing';
  end if;
  if to_regclass('public.chat_characters') is null then
    raise exception 'schema_absent';
  end if;
  if not exists (
    select 1 from public.workspaces
    where id = current_setting('fanmind.fixture.workspace_id', true)::uuid
      and owner_user_id = current_setting('fanmind.fixture.owner_id', true)::uuid
  ) then
    raise exception 'synthetic_owner_workspace_invalid';
  end if;
  if not exists (
    select 1 from public.workspaces
    where id = current_setting('fanmind.fixture.second_workspace_id', true)::uuid
      and owner_user_id = current_setting('fanmind.fixture.foreign_owner_id', true)::uuid
  ) then
    raise exception 'synthetic_foreign_workspace_invalid';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = current_setting('fanmind.fixture.workspace_id', true)::uuid
      and user_id = current_setting('fanmind.fixture.member_id', true)::uuid
      and role = 'member'
  ) then
    raise exception 'synthetic_member_invalid';
  end if;
  if not exists (
    select 1 from auth.users
    where id = current_setting('fanmind.fixture.platform_admin_id', true)::uuid
  ) then
    raise exception 'synthetic_platform_admin_invalid';
  end if;
  if exists (
    select 1 from public.workspace_chat_admin_capabilities
    where workspace_id in (
      current_setting('fanmind.fixture.workspace_id', true)::uuid,
      current_setting('fanmind.fixture.second_workspace_id', true)::uuid
    )
  ) then
    raise exception 'synthetic_capability_not_clean';
  end if;
  if exists (
    select 1 from public.chat_characters
    where id in (
      current_setting('fanmind.fixture.character_a', true)::uuid,
      current_setting('fanmind.fixture.character_b', true)::uuid
    )
  ) or exists (
    select 1 from public.chat_character_conversations
    where id in (
      current_setting('fanmind.fixture.conversation_a', true)::uuid,
      current_setting('fanmind.fixture.conversation_b', true)::uuid
    )
  ) then
    raise exception 'synthetic_rows_not_clean';
  end if;
end $preflight$;

insert into public.workspace_chat_admin_capabilities(
  workspace_id, granted_to_user_id, chat_admin_multi_character
) values (
  current_setting('fanmind.fixture.workspace_id', true)::uuid,
  current_setting('fanmind.fixture.owner_id', true)::uuid,
  true
);

do $global_capability$
declare
  violated_name text;
begin
  begin
    insert into public.workspace_chat_admin_capabilities(
      workspace_id, granted_to_user_id, chat_admin_multi_character
    ) values (
      current_setting('fanmind.fixture.second_workspace_id', true)::uuid,
      current_setting('fanmind.fixture.foreign_owner_id', true)::uuid,
      true
    );
    raise exception 'second_workspace_allowed';
  exception
    when unique_violation then
      get stacked diagnostics violated_name = CONSTRAINT_NAME;
      if violated_name <> 'one_chat_admin_workspace_global' then
        raise exception 'wrong_uniqueness_guard:%', violated_name;
      end if;
  end;
end $global_capability$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  current_setting('fanmind.fixture.owner_id', true),
  true
);

insert into public.chat_characters(
  id, workspace_id, created_by_user_id, display_name, public_age, bio,
  personality, writing_style, emoji_style, sentence_style, flirt_style,
  sales_rules, status
) values
  (
    current_setting('fanmind.fixture.character_a', true)::uuid,
    current_setting('fanmind.fixture.workspace_id', true)::uuid,
    current_setting('fanmind.fixture.owner_id', true)::uuid,
    'FM synthetic A', 24, 'synthetic', 'synthetic', 'synthetic', 'none',
    'short', 'safe', 'none', 'active'
  ),
  (
    current_setting('fanmind.fixture.character_b', true)::uuid,
    current_setting('fanmind.fixture.workspace_id', true)::uuid,
    current_setting('fanmind.fixture.owner_id', true)::uuid,
    'FM synthetic B', 25, 'synthetic', 'synthetic', 'synthetic', 'none',
    'short', 'safe', 'none', 'active'
  );

do $underage$
begin
  begin
    insert into public.chat_characters(
      workspace_id, created_by_user_id, display_name, public_age, bio,
      personality, writing_style, emoji_style, sentence_style, flirt_style,
      sales_rules
    ) values (
      current_setting('fanmind.fixture.workspace_id', true)::uuid,
      current_setting('fanmind.fixture.owner_id', true)::uuid,
      'underage', 17, 'x', 'x', 'x', 'x', 'x', 'x', 'x'
    );
    raise exception 'underage_allowed';
  exception when check_violation then
    null;
  end;
end $underage$;

insert into public.chat_character_conversations(
  id, workspace_id, character_id, fan_reference
) values
  (
    current_setting('fanmind.fixture.conversation_a', true)::uuid,
    current_setting('fanmind.fixture.workspace_id', true)::uuid,
    current_setting('fanmind.fixture.character_a', true)::uuid,
    'same-fan'
  ),
  (
    current_setting('fanmind.fixture.conversation_b', true)::uuid,
    current_setting('fanmind.fixture.workspace_id', true)::uuid,
    current_setting('fanmind.fixture.character_b', true)::uuid,
    'same-fan'
  );

insert into public.chat_character_messages(
  workspace_id, character_id, conversation_id, direction, content,
  character_revision
) values (
  current_setting('fanmind.fixture.workspace_id', true)::uuid,
  current_setting('fanmind.fixture.character_a', true)::uuid,
  current_setting('fanmind.fixture.conversation_a', true)::uuid,
  'fan_inbound', 'synthetic manual input', 1
);

do $isolation$
begin
  begin
    insert into public.chat_character_messages(
      workspace_id, character_id, conversation_id, direction, content,
      character_revision
    ) values (
      current_setting('fanmind.fixture.workspace_id', true)::uuid,
      current_setting('fanmind.fixture.character_a', true)::uuid,
      current_setting('fanmind.fixture.conversation_b', true)::uuid,
      'suggested_reply', 'must fail', 1
    );
    raise exception 'cross_character_allowed';
  exception when foreign_key_violation then
    null;
  end;
  if (
    select count(distinct character_id)
    from public.chat_character_conversations
    where fan_reference = 'same-fan'
      and workspace_id = current_setting('fanmind.fixture.workspace_id', true)::uuid
  ) <> 2 then
    raise exception 'fan_reference_mixed';
  end if;
end $isolation$;

select set_config(
  'request.jwt.claim.sub',
  current_setting('fanmind.fixture.member_id', true),
  true
);
do $member_denied$
begin
  begin
    insert into public.chat_characters(
      id, workspace_id, created_by_user_id, display_name, public_age, bio,
      personality, writing_style, emoji_style, sentence_style, flirt_style,
      sales_rules, status
    ) values (
      gen_random_uuid(),
      current_setting('fanmind.fixture.workspace_id', true)::uuid,
      current_setting('fanmind.fixture.member_id', true)::uuid,
      'member must fail', 24, 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'active'
    );
    raise exception 'workspace_member_allowed';
  exception when insufficient_privilege then
    null;
  end;
end $member_denied$;

select set_config(
  'request.jwt.claim.sub',
  current_setting('fanmind.fixture.foreign_owner_id', true),
  true
);
do $owner_without_capability_denied$
begin
  begin
    insert into public.chat_characters(
      id, workspace_id, created_by_user_id, display_name, public_age, bio,
      personality, writing_style, emoji_style, sentence_style, flirt_style,
      sales_rules, status
    ) values (
      gen_random_uuid(),
      current_setting('fanmind.fixture.second_workspace_id', true)::uuid,
      current_setting('fanmind.fixture.foreign_owner_id', true)::uuid,
      'owner without capability must fail', 24, 'x', 'x', 'x', 'x', 'x',
      'x', 'x', 'active'
    );
    raise exception 'owner_without_capability_allowed';
  exception when insufficient_privilege then
    null;
  end;
end $owner_without_capability_denied$;

select set_config(
  'request.jwt.claim.sub',
  current_setting('fanmind.fixture.platform_admin_id', true),
  true
);
do $platform_admin_denied$
begin
  begin
    insert into public.chat_characters(
      id, workspace_id, created_by_user_id, display_name, public_age, bio,
      personality, writing_style, emoji_style, sentence_style, flirt_style,
      sales_rules, status
    ) values (
      gen_random_uuid(),
      current_setting('fanmind.fixture.workspace_id', true)::uuid,
      current_setting('fanmind.fixture.platform_admin_id', true)::uuid,
      'platform admin must fail', 24, 'x', 'x', 'x', 'x', 'x', 'x', 'x',
      'active'
    );
    raise exception 'platform_admin_allowed';
  exception when insufficient_privilege then
    null;
  end;
end $platform_admin_denied$;

reset role;
rollback;

select 'CHAT_ADMIN_ACCEPTANCE_AUTHORIZATION=PASS';
select 'CHAT_ADMIN_ACCEPTANCE_ADMIN_NEGATIVE=PASS';
select 'CHAT_ADMIN_ACCEPTANCE_ISOLATION=PASS';
select 'CHAT_ADMIN_ACCEPTANCE_DATABASE_FLOW=PASS';
select 'CHAT_ADMIN_ACCEPTANCE_MANUAL_FLOW=OPEN';
select 'CHAT_ADMIN_ACCEPTANCE_CLEANUP=PASS';`;

function fixtureIds(environment) {
  return [
    environment.FANMIND_CHAT_ADMIN_STAGING_WORKSPACE_ID,
    environment.FANMIND_CHAT_ADMIN_SECOND_WORKSPACE_ID,
    environment.FANMIND_CHAT_ADMIN_OWNER_ID,
    environment.FANMIND_CHAT_ADMIN_MEMBER_ID,
    environment.FANMIND_CHAT_ADMIN_FOREIGN_OWNER_ID,
    environment.FANMIND_CHAT_ADMIN_PLATFORM_ADMIN_ID,
    environment.FANMIND_CHAT_ADMIN_CHARACTER_A_ID,
    environment.FANMIND_CHAT_ADMIN_CHARACTER_B_ID,
    environment.FANMIND_CHAT_ADMIN_CONVERSATION_A_ID,
    environment.FANMIND_CHAT_ADMIN_CONVERSATION_B_ID,
  ].map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""));
}

function validateFixtures(environment) {
  const ids = fixtureIds(environment);
  if (ids.some((value) => !UUID_PATTERN.test(value))) {
    throw new Error("CHAT_ADMIN_ACCEPTANCE_ERROR=fixture_identity");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("CHAT_ADMIN_ACCEPTANCE_ERROR=fixture_overlap");
  }
  return ids;
}

export function check() {
  if (
    !/rollback;/u.test(CHAT_ADMIN_ACCEPTANCE_SQL) ||
    /\bcommit;/iu.test(CHAT_ADMIN_ACCEPTANCE_SQL)
  ) {
    throw new Error("acceptance_not_rollback_only");
  }
  if (/CHAT_ADMIN_ACCEPTANCE_MANUAL_FLOW=PASS/u.test(CHAT_ADMIN_ACCEPTANCE_SQL)) {
    throw new Error("manual_flow_not_exercised");
  }
  const dollarQuotedBodies = [
    ...CHAT_ADMIN_ACCEPTANCE_SQL.matchAll(/\$[A-Za-z0-9_]+\$([\s\S]*?)\$[A-Za-z0-9_]+\$/gu),
  ].map((match) => match[1]);
  if (dollarQuotedBodies.some((body) => /:'[A-Za-z0-9_]+'/u.test(body))) {
    throw new Error("acceptance_quoted_psql_variable");
  }
  console.log("CHAT_ADMIN_ACCEPTANCE_READY=YES");
}

export function run(environment = process.env) {
  if (
    !evaluateChatAdminStagingControlEnvironment(environment, {
      mode: "acceptance",
    }).ok
  ) {
    throw new Error("CHAT_ADMIN_ACCEPTANCE_ERROR=environment_invalid");
  }
  const [
    workspaceId,
    secondWorkspaceId,
    ownerId,
    memberId,
    foreignOwnerId,
    platformAdminId,
    characterA,
    characterB,
    conversationA,
    conversationB,
  ] = validateFixtures(environment);

  const result = spawnSync(
    "psql",
    [
      "--no-password",
      "--no-psqlrc",
      "--set=ON_ERROR_STOP=1",
      "--set",
      `workspace_id=${workspaceId}`,
      "--set",
      `second_workspace_id=${secondWorkspaceId}`,
      "--set",
      `owner_id=${ownerId}`,
      "--set",
      `member_id=${memberId}`,
      "--set",
      `foreign_owner_id=${foreignOwnerId}`,
      "--set",
      `platform_admin_id=${platformAdminId}`,
      "--set",
      `character_a=${characterA}`,
      "--set",
      `character_b=${characterB}`,
      "--set",
      `conversation_a=${conversationA}`,
      "--set",
      `conversation_b=${conversationB}`,
    ],
    { env: environment, input: CHAT_ADMIN_ACCEPTANCE_SQL, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error("CHAT_ADMIN_ACCEPTANCE_ERROR=acceptance_failed");
  }
  if (!result.stdout.includes("CHAT_ADMIN_ACCEPTANCE_MANUAL_FLOW=OPEN")) {
    throw new Error("CHAT_ADMIN_ACCEPTANCE_ERROR=manual_flow_state_missing");
  }
  console.log("CHAT_ADMIN_ACCEPTANCE_DATABASE=PASS");
  console.log("CHAT_ADMIN_ACCEPTANCE_MANUAL_FLOW=OPEN");
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    if (process.argv[2] === "--check") {
      check();
    } else if (process.argv[2] === "--run") {
      run();
    } else {
      throw new Error("CHAT_ADMIN_ACCEPTANCE_ERROR=argument_invalid");
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
