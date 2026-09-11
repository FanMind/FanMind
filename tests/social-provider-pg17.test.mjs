import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const container = process.env.FANMIND_CREATOR_PG17_CONTAINER_ID ?? "";
const enabled = process.env.FANMIND_CREATOR_PG17_REQUIRED === "true";
const database = "fanmind_social_provider_ci";
function sql(query, db = database) {
  assert.match(container, /^[0-9a-f]{12,64}$/u);
  return execFileSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-At"], { input: query, encoding: "utf8", timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
}
test("PG17 proves social OAuth one-use state, owner isolation, uniqueness, leases, disconnect races and rollback", { skip: !enabled }, () => {
  sql(`create database ${database};`, "postgres");
  try {
    sql(`
      do $$ begin
        if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
        if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
        if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
      end $$;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated,service_role;
      create table auth.users(id uuid primary key);
      create table public.workspaces(id uuid primary key,owner_user_id uuid references auth.users);
      grant select on public.workspaces to authenticated,service_role;
      insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
      insert into public.workspaces values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222');
    `);
    sql(readFileSync(new URL("../supabase/controlled/social_provider_connections.sql", import.meta.url), "utf8"));
    const result = sql(`
      create function pg_temp.expect(value boolean) returns void language plpgsql as $$ begin if value is distinct from true then raise exception 'expectation failed'; end if; end $$;
      create function pg_temp.denied(command text) returns void language plpgsql as $$ begin
        begin execute command; exception when insufficient_privilege or unique_violation or check_violation then return; end;
        raise exception 'expected denial missing'; end $$;
      select pg_temp.expect((select count(*)=2 from pg_class where oid in ('public.social_provider_connections'::regclass,'public.social_provider_oauth_attempts'::regclass) and relrowsecurity));
      select pg_temp.expect(not has_table_privilege('authenticated','public.social_provider_connections','SELECT'));
      select pg_temp.expect(not has_column_privilege('authenticated','public.social_provider_connections','encrypted_token','SELECT'));
      select pg_temp.expect(not has_table_privilege('authenticated','public.social_provider_oauth_attempts','SELECT'));
      select pg_temp.expect(not has_function_privilege('authenticated',oid,'EXECUTE')) from pg_proc where proname like 'fanmind_social_%';
      set role service_role;
      select pg_temp.expect(not public.fanmind_social_begin('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','x',repeat('a',64),'verifier'));
      select pg_temp.expect(public.fanmind_social_begin('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','x',repeat('a',64),'verifier'));
      select pg_temp.expect(not public.fanmind_social_begin('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','x',repeat('b',64),'verifier'));
      select pg_temp.expect(public.fanmind_social_consume('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','22222222-2222-4222-8222-222222222222','x',repeat('a',64)) is null);
      select pg_temp.expect(public.fanmind_social_consume('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','x',repeat('a',64))='verifier');
      select pg_temp.expect(public.fanmind_social_consume('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','x',repeat('a',64)) is null);
      select pg_temp.expect(public.fanmind_social_complete('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','x',repeat('a',64),'123','Synthetic A','ciphertext',now()+interval '1 hour'));
      select pg_temp.expect(not public.fanmind_social_complete('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','x',repeat('a',64),'123','Synthetic A','replacement',now()+interval '1 hour'));
      select pg_temp.expect(public.fanmind_social_begin('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','x',repeat('b',64),'verifier'));
      select public.fanmind_social_consume('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','x',repeat('b',64));
      select pg_temp.denied($q$select public.fanmind_social_complete('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','x',repeat('b',64),'123','Other','foreign',now()+interval '1 hour')$q$);
      select pg_temp.expect((select encrypted_token='ciphertext' from public.social_provider_connections where provider='x'));
      select pg_temp.expect((select count(*)=1 from public.social_provider_oauth_attempts where workspace_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'));
      reset role;
      set role authenticated;
      select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
      select pg_temp.expect((select count(provider)=1 from public.social_provider_connections));
      select pg_temp.denied('select encrypted_token from public.social_provider_connections');
      select pg_temp.denied('select * from public.social_provider_oauth_attempts');
      select pg_temp.denied('delete from public.social_provider_connections');
      select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
      select pg_temp.expect((select count(provider)=0 from public.social_provider_connections));
      reset role;
      set role service_role;
      select pg_temp.expect((select count(*)=1 from public.fanmind_social_claim_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','x',
        (select revision from public.social_provider_connections where provider='x'),'33333333-3333-4333-8333-333333333333')));
      select pg_temp.expect((select count(*)=0 from public.fanmind_social_claim_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','x',
        (select revision from public.social_provider_connections where provider='x'),'44444444-4444-4444-8444-444444444444')));
      select pg_temp.expect(not public.fanmind_social_rotate('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','x',
        '55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','stale',now()+interval '1 hour'));
      select pg_temp.expect(public.fanmind_social_begin('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','x',repeat('c',64),'verifier'));
      select public.fanmind_social_consume('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','x',repeat('c',64));
      select count(*) from public.fanmind_social_disconnect('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','x');
      select pg_temp.expect(not public.fanmind_social_complete('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','x',repeat('c',64),'123','A','resurrected',now()+interval '1 hour'));
      select pg_temp.expect(not public.fanmind_social_finish_read('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','x','55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333'));
      begin;
      select public.fanmind_social_begin('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','tiktok',repeat('d',64),'rollback-verifier');
      rollback;
      select pg_temp.expect((select count(*)=0 from public.social_provider_oauth_attempts where provider='tiktok'));
      reset role;
      delete from public.workspaces;
      select pg_temp.expect((select count(*)=0 from public.social_provider_oauth_attempts));
      select pg_temp.expect((select count(*)=0 from public.social_provider_connections));
      select 'SOCIAL_PG17_VERIFIED';
    `);
    assert.match(result, /SOCIAL_PG17_VERIFIED/);
  } finally { sql(`drop database ${database};`, "postgres"); }
});
