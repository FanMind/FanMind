import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { buildManualFlowSql } from "../scripts/operations/chat-admin-manual-flow-staging.mjs";

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
  } finally {sql(`drop database ${database} with (force);`,"postgres");}
});
