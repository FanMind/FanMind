import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { buildManualFlowSql } from "../scripts/operations/chat-admin-manual-flow-staging.mjs";
import { POSTFLIGHT_SQL as FAN_POSTFLIGHT_SQL, SQL_PATH as FAN_SQL_PATH } from "../scripts/operations/chat-admin-fan-staging-runner.mjs";

const container=process.env.FANMIND_CREATOR_PG17_CONTAINER_ID ?? "";
const enabled=process.env.FANMIND_CREATOR_PG17_REQUIRED==="true";
const database="fanmind_chatadmin_manual_ci";
const ids=Array.from({length:10},(_,i)=>`${(i+1).toString(16).repeat(8)}-1111-4111-8111-${(i+1).toString(16).repeat(12)}`);
const keys=["STAGING_WORKSPACE_ID","SECOND_WORKSPACE_ID","OWNER_ID","MEMBER_ID","FOREIGN_OWNER_ID","PLATFORM_ADMIN_ID","CHARACTER_A_ID","CHARACTER_B_ID","CONVERSATION_A_ID","CONVERSATION_B_ID"];
const env={
  GITHUB_REF:"refs/heads/main",GITHUB_SHA:"a".repeat(40),FANMIND_CHAT_ADMIN_REVIEWED_COMMIT:"a".repeat(40),
  FANMIND_RUNTIME_ENVIRONMENT:"staging",NEXT_PUBLIC_APP_URL:"https://staging.fanmind.ch",FANMIND_TARGET_API_ORIGIN:"https://staging.fanmind.ch",FANMIND_PRODUCTION_API_ORIGIN:"https://fanmind.ch",
  NEXT_PUBLIC_SUPABASE_URL:"https://stagingref123.supabase.co",FANMIND_TARGET_SUPABASE_PROJECT_REF:"stagingref123",FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:"productionref123",
  PGHOST:"aws-0-eu.pooler.supabase.com",FANMIND_TARGET_DB_HOST:"aws-0-eu.pooler.supabase.com",FANMIND_PRODUCTION_DB_HOST:"db.productionref123.supabase.co",PGUSER:"postgres.stagingref123",PGPORT:"5432",PGDATABASE:"postgres",PGSSLMODE:"verify-full",PGSSLROOTCERT:"/repo/config/certificates/supabase-root-2021-ca.crt",
  FANMIND_ENABLE_NON_PRODUCTION_WRITES:"true",FANMIND_NON_PRODUCTION_WRITE_ACK:"I_UNDERSTAND_NON_PRODUCTION_ONLY",FANMIND_CHAT_ADMIN_MANUAL_CONFIRM:"run-chat-admin-manual-flow",
  FANMIND_STAGING_E2E_EMAIL:"primary-staging@example.invalid",FANMIND_STAGING_E2E_PASSWORD:"synthetic-password-primary",FANMIND_STAGING_E2E_SECONDARY_EMAIL:"secondary-staging@example.invalid",FANMIND_STAGING_E2E_SECONDARY_PASSWORD:"synthetic-password-secondary",
  FANMIND_ADMIN_EMAILS:"admin-staging@example.invalid",FANMIND_STAGING_ADMIN_E2E_EMAIL:"admin-staging@example.invalid",FANMIND_STAGING_ADMIN_E2E_PASSWORD:"synthetic-password-admin",
  ...Object.fromEntries(keys.map((key,i)=>[`FANMIND_CHAT_ADMIN_${key}`,ids[i]])),
};
function sql(query,db=database){assert.match(container,/^[0-9a-f]{12,64}$/u);return execFileSync("docker",["exec","-i",container,"psql","-X","-U","postgres","-d",db,"-v","ON_ERROR_STOP=1","-At"],{input:query,encoding:"utf8",timeout:60_000,maxBuffer:2*1024*1024,stdio:["pipe","pipe","pipe"]});}

test("native PG17 proves committed fixture ownership, identity negatives, read-only authority and cleanup",{skip:!enabled},()=>{
  sql(`create database ${database};`,"postgres");
  const receipt={marker:"f".repeat(32),startedAt:"2026-09-26T10:00:00.000Z"};
  try {
    sql(`do $$ begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
    end $$;
    create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon,service_role;
    grant execute on function auth.uid() to authenticated;
    create table public.workspaces(id uuid primary key,owner_user_id uuid references auth.users(id),name text,test_access_flags jsonb,workspace_access_mode text,billing_status text,stripe_customer_id text,stripe_subscription_id text,stripe_checkout_session_id text,stripe_payment_intent_id text,stripe_mandate_id text);
    create table public.workspace_members(workspace_id uuid,user_id uuid,role text);
    create table public.ai_usage_events(workspace_id uuid,user_id uuid,feature text,source_route text,status text,created_at timestamptz default now());
    grant select on public.workspaces to authenticated;
    alter table public.workspaces enable row level security;
    create policy workspace_owner_read on public.workspaces for select to authenticated using(owner_user_id=auth.uid());
    insert into auth.users values
      ('${ids[2]}','primary-staging@example.invalid',now(),'{"fanmind_staging_fixture":"primary","fanmind_staging_fixture_version":1}'),
      ('${ids[4]}','secondary-staging@example.invalid',now(),'{"fanmind_staging_fixture":"secondary","fanmind_staging_fixture_version":1}'),
      ('${ids[3]}','fanmind-ai-member-staging@example.invalid',now(),'{"fanmind_staging_fixture":"ai_member","fanmind_staging_fixture_version":1}'),
      ('${ids[5]}','admin-staging@example.invalid',now(),'{}');
    insert into public.workspaces(id,owner_user_id,name,test_access_flags,workspace_access_mode,billing_status) values
      ('${ids[0]}','${ids[2]}','FanMind Staging Processing Acceptance','{"staging_synthetic_fixture":true}','active','active'),
      ('${ids[1]}','${ids[4]}','FanMind Staging Secondary E2E','{"staging_synthetic_fixture":true}','active','active');
    insert into public.workspace_members values('${ids[0]}','${ids[2]}','owner'),('${ids[1]}','${ids[4]}','owner'),('${ids[0]}','${ids[3]}','member');`);
    sql(readFileSync(new URL("../supabase/controlled/20260920230000_chat_admin_multi_character.sql",import.meta.url),"utf8"));
    sql(`update public.workspaces set test_access_flags='{}' where id='${ids[0]}';`);
    assert.throws(()=>sql(buildManualFlowSql("prepare",env,receipt)));
    assert.equal(sql("select count(*) from public.workspace_chat_admin_capabilities;").trim(),"0");
    sql(`update public.workspaces set test_access_flags='{"staging_synthetic_fixture":true}' where id='${ids[0]}';`);
    sql(`update auth.users set email='ordinary-staging@example.invalid' where id='${ids[5]}';`);
    assert.throws(()=>sql(buildManualFlowSql("prepare",env,receipt)),"an existing ordinary user cannot stand in for the protected admin identity");
    assert.equal(sql("select count(*) from public.workspace_chat_admin_capabilities;").trim(),"0");
    sql(`update auth.users set email='admin-staging@example.invalid',email_confirmed_at=null where id='${ids[5]}';`);
    assert.throws(()=>sql(buildManualFlowSql("prepare",env,receipt)),"unconfirmed admin identity must fail before mutation");
    assert.equal(sql("select count(*) from public.workspace_chat_admin_capabilities;").trim(),"0");
    sql(`update auth.users set email_confirmed_at=now() where id='${ids[5]}';`);
    assert.match(sql(buildManualFlowSql("prepare",env,receipt)),/CHAT_ADMIN_MANUAL_PREPARE=PASS/u);
    assert.equal(sql(`select count(*) from public.chat_characters where id='${ids[9]}' and workspace_id='${ids[1]}' and created_by_user_id='${ids[4]}' and bio='FanMind synthetic manual acceptance ${receipt.marker}' and created_at='${receipt.startedAt}'::timestamptz;`).trim(),"1","foreign denial must target an existing, exactly bound Character");
    assert.equal(sql(`select count(*) from public.workspace_chat_admin_capabilities where workspace_id='${ids[1]}';`).trim(),"0","foreign fixture must not add another capability");
    assert.throws(()=>sql(buildManualFlowSql("prepare",env,receipt)),"existing capability must never be overwritten");
    assert.throws(()=>sql(buildManualFlowSql("cleanup",env,{...receipt,marker:"e".repeat(32)})),"wrong receipt must not delete rows");
    assert.equal(sql("select count(*) from public.chat_characters;").trim(),"3");
    for(const [column,wrong,original] of [["workspace_id",ids[0],ids[1]],["created_by_user_id",ids[2],ids[4]]]) {
      sql(`update public.chat_characters set ${column}='${wrong}' where id='${ids[9]}';`);
      assert.throws(()=>sql(buildManualFlowSql("cleanup",env,receipt)),`foreign ${column} drift must prevent every cleanup delete`);
      assert.equal(sql("select count(*) from public.chat_characters;").trim(),"3");
      assert.equal(sql("select count(*) from public.workspace_chat_admin_capabilities;").trim(),"1");
      sql(`update public.chat_characters set ${column}='${original}' where id='${ids[9]}';`);
    }
    sql(`insert into public.ai_usage_events values('${ids[0]}','${ids[2]}','chat_admin_reply','/api/chatadmin/reply-suggestions','ok','2026-09-26T10:01:00Z'),('${ids[0]}','${ids[2]}','chat_admin_reply','/api/chatadmin/reply-suggestions','ok','2026-09-26T10:01:01Z'); update public.chat_characters set status='inactive',revision=2 where id='${ids[7]}';`);
    assert.match(sql(buildManualFlowSql("verify",env,receipt)),/CHAT_ADMIN_MANUAL_VERIFY=PASS/u);
    assert.match(sql(buildManualFlowSql("cleanup",env,receipt)),/CHAT_ADMIN_MANUAL_CLEANUP=PASS/u);
    assert.match(sql(buildManualFlowSql("absence",env,receipt)),/CHAT_ADMIN_MANUAL_ABSENCE=PASS/u);
    assert.match(sql(buildManualFlowSql("cleanup",env,receipt)),/CHAT_ADMIN_MANUAL_CLEANUP=PASS/u,"cleanup remains idempotent");
    assert.equal(sql("select count(*) from public.workspaces;").trim(),"2");
    assert.equal(sql("select count(*) from auth.users;").trim(),"4");

    const absentPostflight=spawnSync("docker",["exec","-i",container,"psql","-X","-U","postgres","-d",database,"-v","ON_ERROR_STOP=1","-At"],{
      input:FAN_POSTFLIGHT_SQL,encoding:"utf8",timeout:60_000,maxBuffer:2*1024*1024,stdio:["pipe","pipe","pipe"],
    });
    assert.equal(absentPostflight.status,0,absentPostflight.stderr||absentPostflight.stdout);
    assert.match(`${absentPostflight.stdout}${absentPostflight.stderr}`,/CHAT_ADMIN_FAN_SCHEMA_STATE=ABSENT/u);
    sql("alter policy chat_admin_conversations_owner_all on public.chat_character_conversations using (true) with check (true);");
    const baselinePolicy=spawnSync("docker",["exec","-i",container,"psql","-X","-U","postgres","-d",database,"-v","ON_ERROR_STOP=1","-At"],{
      input:FAN_POSTFLIGHT_SQL,encoding:"utf8",timeout:60_000,maxBuffer:2*1024*1024,stdio:["pipe","pipe","pipe"],
    });
    assert.notEqual(baselinePolicy.status,0,"ABSENT must require the parent conversation owner policy");
    assert.match(`${baselinePolicy.stdout}${baselinePolicy.stderr}`,/CHAT_ADMIN_FAN_SCHEMA_STATE=PARTIAL/u);
    sql("alter policy chat_admin_conversations_owner_all on public.chat_character_conversations using (public.is_current_chat_admin_workspace(workspace_id)) with check (public.is_current_chat_admin_workspace(workspace_id));");

    sql("alter table public.chat_characters alter column status drop default;");
    const absentParentDefault=spawnSync("docker",["exec","-i",container,"psql","-X","-U","postgres","-d",database,"-v","ON_ERROR_STOP=1","-At"],{
      input:FAN_POSTFLIGHT_SQL,encoding:"utf8",timeout:60_000,maxBuffer:2*1024*1024,stdio:["pipe","pipe","pipe"],
    });
    assert.notEqual(absentParentDefault.status,0,"ABSENT must reject parent runtime drift before APPLY");
    assert.match(`${absentParentDefault.stdout}${absentParentDefault.stderr}`,/CHAT_ADMIN_FAN_SCHEMA_STATE=PARTIAL/u);
    sql("alter table public.chat_characters alter column status set default 'active';");

    sql("alter table public.chat_characters add constraint unexpected_chat_character_revision_check check (revision < 3);");
    const absentParentConstraint=spawnSync("docker",["exec","-i",container,"psql","-X","-U","postgres","-d",database,"-v","ON_ERROR_STOP=1","-At"],{
      input:FAN_POSTFLIGHT_SQL,encoding:"utf8",timeout:60_000,maxBuffer:2*1024*1024,stdio:["pipe","pipe","pipe"],
    });
    assert.notEqual(absentParentConstraint.status,0,"ABSENT must reject unexpected parent runtime constraints");
    assert.match(`${absentParentConstraint.stdout}${absentParentConstraint.stderr}`,/CHAT_ADMIN_FAN_SCHEMA_STATE=PARTIAL/u);
    sql("alter table public.chat_characters drop constraint unexpected_chat_character_revision_check;");

    sql("create function public.require_chat_admin_fan_binding() returns trigger language plpgsql as $$begin return new; end$$; create trigger require_chat_admin_conversation_fan before insert or update on public.chat_character_conversations for each row execute function public.require_chat_admin_fan_binding();");
    const orphanedFanObjects=spawnSync("docker",["exec","-i",container,"psql","-X","-U","postgres","-d",database,"-v","ON_ERROR_STOP=1","-At"],{
      input:FAN_POSTFLIGHT_SQL,encoding:"utf8",timeout:60_000,maxBuffer:2*1024*1024,stdio:["pipe","pipe","pipe"],
    });
    assert.notEqual(orphanedFanObjects.status,0,"an orphaned fan helper and trigger must not be classified ABSENT");
    assert.match(`${orphanedFanObjects.stdout}${orphanedFanObjects.stderr}`,/CHAT_ADMIN_FAN_SCHEMA_STATE=PARTIAL/u);
    sql("drop trigger require_chat_admin_conversation_fan on public.chat_character_conversations; drop function public.require_chat_admin_fan_binding();");

    // Exercise the exact fan migration and its read-only catalog verifier on native PG17.
    const fanSql = readFileSync(new URL(`../${FAN_SQL_PATH}`, import.meta.url), "utf8");
    sql(fanSql);
    const postflight = spawnSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-At"], {
      input: FAN_POSTFLIGHT_SQL, encoding: "utf8", timeout: 60_000, maxBuffer: 2 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let diagnostics = "";
    if (postflight.status !== 0) {
      const diagnosticSql = FAN_POSTFLIGHT_SQL.replace(
        "  if rls_enabled <> 5",
        `  raise notice 'CHAT_ADMIN_FAN_DIAGNOSTIC=%', jsonb_build_object(
    'schema',schema_mismatch,'owner',table_owner_mismatch,'persistence',persistence_mismatch,
    'constraints',persistence_constraint_mismatch,'defaults',persistence_default_mismatch,
    'routine_acl',routine_acl_mismatch,'fan_indexes',fan_unique_index_mismatch,
    'conversation_indexes',conversation_unique_index_mismatch,'extension_markers',extension_markers,
    'triggers',trigger_mismatch,'identity',identity_mismatch,'rewrite_rules',rewrite_rule_mismatch,
    'policy',policy_valid,'table_acl',table_privilege_mismatch,
    'generated_columns',generated_column_mismatch,'parent_character',parent_character_runtime_mismatch,
    'routine_grant_options',routine_grant_option_mismatch,'schema_usage',schema_usage_mismatch,'fan_constraints',constraint_mismatch,
    'persistence_constraints',persistence_constraint_mismatch,
    'trigger_catalog', (select jsonb_agg(jsonb_build_object('name',tgname,'type',tgtype,'attrs',tgattr::text,'enabled',tgenabled,'fn',tgfoid::regprocedure::text,'qual',tgqual::text)) from pg_trigger where tgrelid in ('public.chat_character_fans'::regclass,'public.chat_character_conversations'::regclass,'public.chat_character_messages'::regclass) and not tgisinternal),
    'persistence_catalog', (select jsonb_agg(jsonb_build_object('table',c.relname,'name',con.conname,'type',con.contype,'definition',pg_get_constraintdef(con.oid,true))) from pg_constraint con join pg_class c on c.oid=con.conrelid where con.conrelid in ('public.chat_character_conversations'::regclass,'public.chat_character_messages'::regclass)),
    'column_acl',protected_column_privilege_mismatch,
    'authenticated_writes',authenticated_conversation_message_write_grant_mismatch);
  if rls_enabled <> 5`,
      );
      const result = spawnSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-At"], {
        input: diagnosticSql, encoding: "utf8", timeout: 60_000, maxBuffer: 2 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      });
      diagnostics = `${result.stdout}${result.stderr}`;
    }
    assert.equal(postflight.status, 0, `${postflight.stderr || postflight.stdout}${diagnostics}`);
    assert.match(`${postflight.stdout}${postflight.stderr}`, /CHAT_ADMIN_FAN_SCHEMA_STATE=VERIFIED/u);
    const assertPostflightRejectsPartial = () => {
      const result = spawnSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-At"], {
        input: FAN_POSTFLIGHT_SQL, encoding: "utf8", timeout: 60_000, maxBuffer: 2 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.notEqual(result.status, 0, "the postflight must reject the injected catalog drift");
      assert.match(`${result.stdout}${result.stderr}`, /CHAT_ADMIN_FAN_SCHEMA_STATE=PARTIAL/u);
    };
    const assertPostflightVerified = () => {
      const result = spawnSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1", "-At"], {
        input: FAN_POSTFLIGHT_SQL, encoding: "utf8", timeout: 60_000, maxBuffer: 2 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      });
      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.match(`${result.stdout}${result.stderr}`, /CHAT_ADMIN_FAN_SCHEMA_STATE=VERIFIED/u);
    };
    const restoreAndVerify = (statement) => {
      sql(statement);
      assertPostflightVerified();
    };

    sql("alter table public.chat_characters alter column status drop not null;");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter table public.chat_characters alter column status set not null;");

    sql("alter table public.chat_characters alter column revision type bigint using revision::bigint;");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter table public.chat_characters alter column revision type integer using revision::integer;");

    sql("alter table public.chat_characters add constraint unexpected_chat_character_runtime_unique unique (revision,id);");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter table public.chat_characters drop constraint unexpected_chat_character_runtime_unique;");

    sql("create unique index unexpected_chat_character_status_unique on public.chat_characters(status,id);");
    assertPostflightRejectsPartial();
    restoreAndVerify("drop index public.unexpected_chat_character_status_unique;");

    sql("alter table public.chat_character_fans add constraint unexpected_fan_overlap exclude using gist ((daterange('2026-01-01'::date, '2026-01-02'::date)) with &&);");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter table public.chat_character_fans drop constraint unexpected_fan_overlap;");

    sql("grant execute on function public.create_chat_admin_fan(uuid,uuid,uuid,jsonb) to authenticated with grant option;");
    assertPostflightRejectsPartial();
    restoreAndVerify("revoke grant option for execute on function public.create_chat_admin_fan(uuid,uuid,uuid,jsonb) from authenticated;");

    sql("revoke usage on schema public from public, authenticated;");
    assertPostflightRejectsPartial();
    restoreAndVerify("grant usage on schema public to public, authenticated;");

    sql("grant create on schema public to authenticated;");
    assertPostflightRejectsPartial();
    restoreAndVerify("revoke create on schema public from authenticated;");

    sql("alter function public.is_current_chat_admin_workspace(uuid) owner to authenticated;");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter function public.is_current_chat_admin_workspace(uuid) owner to postgres; grant execute on function public.is_current_chat_admin_workspace(uuid) to authenticated;");

    sql("alter table public.chat_characters disable row level security;");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter table public.chat_characters enable row level security;");

    sql("alter table public.chat_character_conversations disable trigger require_chat_admin_conversation_fan;");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter table public.chat_character_conversations enable trigger require_chat_admin_conversation_fan;");

    sql("alter policy chat_admin_fans_owner_all on public.chat_character_fans using (true) with check (true);");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter policy chat_admin_fans_owner_all on public.chat_character_fans using (public.is_current_chat_admin_workspace(workspace_id)) with check (public.is_current_chat_admin_workspace(workspace_id));");

    sql("alter index public.chat_character_conversations_one_per_fan rename to chat_character_conversations_one_per_fan_invalid;");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter index public.chat_character_conversations_one_per_fan_invalid rename to chat_character_conversations_one_per_fan;");

    sql("drop index public.one_chat_admin_workspace_global;");
    assertPostflightRejectsPartial();
    restoreAndVerify("create unique index one_chat_admin_workspace_global on public.workspace_chat_admin_capabilities using btree (chat_admin_multi_character) where chat_admin_multi_character;");

    sql("create unique index unexpected_chat_message_content_unique on public.chat_character_messages(content);");
    assertPostflightRejectsPartial();
    restoreAndVerify("drop index public.unexpected_chat_message_content_unique;");

    sql("create unique index unexpected_chat_conversation_character_unique on public.chat_character_conversations(workspace_id,character_id);");
    assertPostflightRejectsPartial();
    restoreAndVerify("drop index public.unexpected_chat_conversation_character_unique;");

    sql("create unique index unexpected_chat_fan_character_unique on public.chat_character_fans(workspace_id,character_id);");
    assertPostflightRejectsPartial();
    restoreAndVerify("drop index public.unexpected_chat_fan_character_unique;");

    sql("alter table public.chat_character_messages add column unexpected_required_column text not null default 'temporary';");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter table public.chat_character_messages drop column unexpected_required_column;");

    sql("alter table public.chat_character_messages add constraint unexpected_message_direction_check check (direction <> 'suggested_reply');");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter table public.chat_character_messages drop constraint unexpected_message_direction_check;");

    sql("alter table public.chat_character_messages drop constraint chat_character_messages_direction_check; alter table public.chat_character_messages add constraint chat_character_messages_direction_check check (direction <> 'suggested_reply');");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter table public.chat_character_messages drop constraint chat_character_messages_direction_check; alter table public.chat_character_messages add constraint chat_character_messages_direction_check check (direction in ('fan_inbound','suggested_reply','confirmed_reply'));");

    sql("alter table public.chat_character_messages set unlogged;");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter table public.chat_character_messages set logged;");

    sql("alter table public.chat_character_fans owner to authenticated;");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter table public.chat_character_fans owner to postgres; grant select,update,delete on table public.chat_character_fans to authenticated,service_role;");

    sql("alter role authenticated bypassrls;");
    try { assertPostflightRejectsPartial(); }
    finally { restoreAndVerify("alter role authenticated nobypassrls;"); }

    sql("alter table public.chat_character_conversations alter column fan_id set default '00000000-0000-4000-8000-000000000001'::uuid;");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter table public.chat_character_conversations alter column fan_id drop default;");

    sql("alter table public.chat_character_messages alter column id drop default;");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter table public.chat_character_messages alter column id set default gen_random_uuid();");

    sql("alter sequence public.chat_character_messages_sequence_seq increment by -1;");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter sequence public.chat_character_messages_sequence_seq increment by 1;");

    sql("alter sequence public.chat_character_messages_sequence_seq cache 2;");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter sequence public.chat_character_messages_sequence_seq cache 1;");

    sql("drop trigger require_chat_admin_conversation_fan on public.chat_character_conversations; create trigger require_chat_admin_conversation_fan before insert or update of fan_id on public.chat_character_conversations for each row execute function public.require_chat_admin_fan_binding();");
    assertPostflightRejectsPartial();
    restoreAndVerify("drop trigger require_chat_admin_conversation_fan on public.chat_character_conversations; create trigger require_chat_admin_conversation_fan before insert or update on public.chat_character_conversations for each row execute function public.require_chat_admin_fan_binding();");

    sql("create rule unexpected_message_insert_ignore as on insert to public.chat_character_messages do instead nothing;");
    assertPostflightRejectsPartial();
    restoreAndVerify("drop rule unexpected_message_insert_ignore on public.chat_character_messages;");

    sql("create rule unexpected_fan_insert_ignore as on insert to public.chat_character_fans do instead nothing;");
    assertPostflightRejectsPartial();
    restoreAndVerify("drop rule unexpected_fan_insert_ignore on public.chat_character_fans;");

    sql("grant insert (summary) on table public.chat_character_fans to authenticated;");
    assertPostflightRejectsPartial();
    restoreAndVerify("revoke insert (summary) on table public.chat_character_fans from authenticated;");

    sql("grant insert (summary) on table public.chat_character_fans to service_role;");
    assertPostflightRejectsPartial();
    restoreAndVerify("revoke insert (summary) on table public.chat_character_fans from service_role;");

    sql("do $$ begin if not exists(select 1 from pg_roles where rolname='fanmind_chatadmin_unexpected_table_reader') then create role fanmind_chatadmin_unexpected_table_reader nologin; end if; end $$; grant select on table public.chat_character_fans to fanmind_chatadmin_unexpected_table_reader;");
    assertPostflightRejectsPartial();
    restoreAndVerify("revoke select on table public.chat_character_fans from fanmind_chatadmin_unexpected_table_reader; drop role fanmind_chatadmin_unexpected_table_reader;");

    sql("revoke insert on table public.chat_characters from authenticated;");
    assertPostflightRejectsPartial();
    restoreAndVerify("grant insert on table public.chat_characters to authenticated;");

    sql("grant delete on table public.workspace_chat_admin_capabilities to authenticated;");
    assertPostflightRejectsPartial();
    restoreAndVerify("revoke delete on table public.workspace_chat_admin_capabilities from authenticated;");

    sql("alter function public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[]) owner to authenticated;");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter function public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[]) owner to postgres; grant execute on function public.persist_chat_admin_generation(uuid,uuid,uuid,uuid,integer,integer,uuid,uuid[],text,text[]) to authenticated;");

    sql("do $$ begin if not exists(select 1 from pg_roles where rolname='fanmind_chatadmin_unexpected_executor') then create role fanmind_chatadmin_unexpected_executor nologin; end if; end $$; grant execute on function public.create_chat_admin_fan(uuid,uuid,uuid,jsonb) to fanmind_chatadmin_unexpected_executor;");
    assertPostflightRejectsPartial();
    restoreAndVerify("revoke execute on function public.create_chat_admin_fan(uuid,uuid,uuid,jsonb) from fanmind_chatadmin_unexpected_executor; drop role fanmind_chatadmin_unexpected_executor;");

    sql("alter table public.chat_character_fans drop constraint chat_character_fans_display_name_check; alter table public.chat_character_fans add constraint chat_character_fans_display_name_check check (char_length(btrim(display_name)) between 1 and 120); alter table public.chat_character_fans add constraint chat_character_fans_unrelated_check check (true);");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter table public.chat_character_fans drop constraint chat_character_fans_display_name_check; alter table public.chat_character_fans drop constraint chat_character_fans_unrelated_check; alter table public.chat_character_fans add constraint chat_character_fans_display_name_check check (char_length(btrim(display_name)) between 1 and 120);");

    sql("alter table public.chat_character_fans add constraint unexpected_unvalidated_fan_check check (false) not valid;");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter table public.chat_character_fans drop constraint unexpected_unvalidated_fan_check;");

    sql("alter table public.chat_character_fans drop constraint chat_character_fans_status_check; alter table public.chat_character_fans alter column status drop default; alter table public.chat_character_fans drop column status; alter table public.chat_character_fans add column status text generated always as ('active'::text) stored not null; alter table public.chat_character_fans add constraint chat_character_fans_status_check check (status in ('active','inactive'));");
    assertPostflightRejectsPartial();
    restoreAndVerify("alter table public.chat_character_fans drop constraint chat_character_fans_status_check; alter table public.chat_character_fans drop column status; alter table public.chat_character_fans add column status text not null default 'active' check (status in ('active','inactive'));");

    sql("set allow_system_table_mods = on; update pg_catalog.pg_trigger t set tgenabled='D' from pg_constraint c where c.oid=t.tgconstraint and c.conname='chat_character_conversations_fan_fk' and t.tgisinternal;");
    assertPostflightRejectsPartial();
    restoreAndVerify("set allow_system_table_mods = on; update pg_catalog.pg_trigger t set tgenabled='O' from pg_constraint c where c.oid=t.tgconstraint and c.conname='chat_character_conversations_fan_fk' and t.tgisinternal;");
  } finally {sql(`drop database ${database} with (force);`,"postgres");}
});
