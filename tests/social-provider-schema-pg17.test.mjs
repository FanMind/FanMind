import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildSocialApply, buildSocialVerification, SOCIAL_STATE_SQL } from "../scripts/operations/social-provider-schema-sql.mjs";

const container=process.env.FANMIND_CREATOR_PG17_CONTAINER_ID ?? "";
const enabled=process.env.FANMIND_CREATOR_PG17_REQUIRED === "true";
const database="fanmind_social_schema_ci";
const artifact=readFileSync(new URL("../supabase/controlled/social_provider_connections.sql",import.meta.url),"utf8");
function sql(query,db=database) {
 assert.match(container,/^[0-9a-f]{12,64}$/u);
 return execFileSync("docker",["exec","-i",container,"psql","-X","-U","postgres","-d",db,"-v","ON_ERROR_STOP=1","-At"],{input:query,encoding:"utf8",timeout:60000,maxBuffer:2*1024*1024,stdio:["pipe","pipe","pipe"]});
}
test("PG17 proves controlled Social schema apply, rollback and exact drift rejection",{skip:!enabled},()=>{
 sql(`create database ${database};`,"postgres");
 try {
  sql(`do $$ begin
   if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
   if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
   if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  end $$;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create table auth.users(id uuid primary key);
  create table public.workspaces(id uuid primary key,owner_user_id uuid references auth.users);
  alter table public.workspaces enable row level security;
  grant usage on schema auth to authenticated,service_role;
  grant select(id,owner_user_id) on public.workspaces to authenticated;
  grant select on public.workspaces to service_role;`);
  assert.match(sql(SOCIAL_STATE_SQL),/STATE=absent/u);
  const apply=buildSocialApply(artifact);
  const verify=buildSocialVerification(artifact);
  const forced=apply.replace("end $verify$;","raise exception 'forced_postflight_failure'; end $verify$;");
  assert.throws(()=>sql(forced),error=>String(error.stderr).includes("forced_postflight_failure"));
  assert.match(sql(SOCIAL_STATE_SQL),/STATE=absent/u);
  assert.match(sql(apply),/APPLY=COMMITTED/u);
  assert.match(sql(verify.verify),/POSTFLIGHT=PASS/u);
  const mutations=[
   "alter table public.social_provider_connections add column unexpected text;",
   "alter table public.social_provider_connections disable row level security;",
   "alter policy social_provider_owner_metadata on public.social_provider_connections using (true);",
   "grant select(encrypted_token) on public.social_provider_connections to authenticated;",
   "alter table public.social_provider_connections alter column initial_read_pending set default true;",
   "create or replace function public.fanmind_social_owner(p_workspace uuid,p_user uuid) returns boolean language sql stable security invoker set search_path='' as $$ select true $$;",
   "grant execute on function public.fanmind_social_owner(uuid,uuid) to public;",
   "alter table public.social_provider_connections disable trigger all;",
   "create index unexpected_social_index on public.social_provider_connections(provider);",
  ];
  for(const mutation of mutations) {
   assert.throws(()=>sql(`begin; ${mutation} ${verify.reference} ${verify.body} rollback;`),error=>/social_.*drift/u.test(String(error.stderr)),mutation);
  }
  assert.match(sql("begin; drop function public.fanmind_social_finish_read(uuid,uuid,text,uuid,uuid); "+SOCIAL_STATE_SQL+" rollback;"),/STATE=partial/u);
  assert.match(sql(verify.verify),/POSTFLIGHT=PASS/u);
  assert.equal(sql("select (select count(*) from public.social_provider_connections)+(select count(*) from public.social_provider_oauth_attempts);").trim(),"0");
 } finally { sql(`drop database ${database};`,"postgres"); }
});
