import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CREATOR_STATE_SQL, buildCreatorApply, buildCreatorVerification } from "../scripts/operations/creator-foundation-sql.mjs";

const container = process.env.FANMIND_CREATOR_PG17_CONTAINER_ID ?? "";
const enabled = process.env.FANMIND_CREATOR_PG17_REQUIRED === "true";
const database = "fanmind_creator_isolation_ci";
function sql(query, db = database) {
  assert.match(container, /^[0-9a-f]{12,64}$/u);
  return execFileSync("docker", ["exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-At"], { input: query, encoding: "utf8", timeout: 60000, maxBuffer: 2 * 1024 * 1024 });
}

test("real PostgreSQL 17 proves one Creator per account, RLS, FK boundaries and atomic revisions", { skip: !enabled }, () => {
  assert.match(container, /^[0-9a-f]{12,64}$/u);
  sql(`create database ${database};`, "postgres");
  try {
    sql(`
      do $$ begin
        if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
        if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
        if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
        if not exists(select 1 from pg_roles where rolname='creator_ci_unexpected') then create role creator_ci_unexpected nologin bypassrls; end if;
      end $$;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth, public to authenticated, anon, service_role;
      grant execute on function auth.uid() to authenticated,anon,service_role;
      create table public.workspaces(id uuid primary key,owner_user_id uuid not null references auth.users(id));
      create table public.workspace_members(workspace_id uuid references public.workspaces(id),user_id uuid references auth.users(id));
      create table public.contacts(id uuid primary key, workspace_id uuid not null references public.workspaces(id));
      create table public.conversations(id uuid primary key,workspace_id uuid not null references public.workspaces(id),contact_id uuid not null references public.contacts(id));
      create table public.contact_ai_profiles(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id),contact_id uuid not null references public.contacts(id), unique(workspace_id,contact_id));
      grant select on public.workspaces,public.workspace_members,public.contacts,public.conversations,public.contact_ai_profiles to authenticated;
      alter table public.contact_ai_profiles enable row level security;
      create policy contact_profiles_member_read on public.contact_ai_profiles for select to authenticated using(exists(select 1 from public.workspace_members m where m.workspace_id=contact_ai_profiles.workspace_id and m.user_id=auth.uid()));
      insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),('33333333-3333-4333-8333-333333333333');
      insert into public.workspaces values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222');
      insert into public.workspace_members values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333');
      insert into public.contacts values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('dddddddd-dddd-4ddd-8ddd-dddddddddddd','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
      insert into public.conversations values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    `);
    // Existing live parent RLS is a prerequisite. No control may disable it.
    sql(`
      alter table public.workspaces enable row level security;
      create policy ci_owner_read on public.workspaces for select to authenticated using(owner_user_id=auth.uid());
      alter table public.workspace_members enable row level security;
      create policy ci_member_read on public.workspace_members for select to authenticated using(user_id=auth.uid());
      alter table public.contacts enable row level security;
      create policy ci_contact_read on public.contacts for select to authenticated using(exists(select 1 from public.workspace_members m where m.workspace_id=contacts.workspace_id and m.user_id=auth.uid()));
      alter table public.conversations enable row level security;
      create policy ci_conversation_read on public.conversations for select to authenticated using(exists(select 1 from public.workspace_members m where m.workspace_id=conversations.workspace_id and m.user_id=auth.uid()));
    `);
    const artifact=readFileSync(new URL("../supabase/controlled/creator_intelligence_foundation.sql", import.meta.url), "utf8");
    assert.equal(sql(CREATOR_STATE_SQL).trim(), "CREATOR_FOUNDATION_STATE=absent");
    // A stale/unsafe parent causes no partially created tables.
    sql("grant update on public.contact_ai_profiles to authenticated;");
    assert.throws(()=>sql(buildCreatorApply(artifact)));
    assert.equal(sql(CREATOR_STATE_SQL).trim(), "CREATOR_FOUNDATION_STATE=absent");
    sql("revoke update on public.contact_ai_profiles from authenticated;");
    assert.match(sql(buildCreatorApply(artifact)), /CREATOR_FOUNDATION_APPLY=COMMITTED/u);
    assert.equal(sql(CREATOR_STATE_SQL).trim(), "CREATOR_FOUNDATION_STATE=present");
    const verification=buildCreatorVerification(artifact);
    assert.match(sql(verification.verify), /CREATOR_FOUNDATION_POSTFLIGHT=PASS/u);
    // Real PostgreSQL mutations: weaken a check, RLS, column ACL or function.
    // Each must be rejected, and its temporary transaction must roll back.
    for (const corruption of [
      "alter table public.creators disable row level security;",
      "alter table public.creators drop constraint creators_public_age_check; alter table public.creators add constraint creators_public_age_check check(public_age>=0);",
      "create policy unexpected_creator_read on public.creators for select to authenticated using(true);",
      "grant update(amount_minor) on public.creator_commercial_events to authenticated;",
      "grant update on public.creator_voice_profiles to authenticated;",
      "grant select on public.creators to creator_ci_unexpected;",
      "grant select(fingerprint) on public.creator_voice_profiles to creator_ci_unexpected;",
      "grant execute on function public.save_creator_bundle(uuid,uuid,integer,jsonb,jsonb,jsonb,boolean) to creator_ci_unexpected;",
      "drop index public.creator_commercial_events_contact_idx; create index creator_commercial_events_contact_idx on public.creator_commercial_events(contact_id);",
      "alter table public.creator_voice_profiles disable trigger creator_voice_identity_guard;",
      "alter function public.save_creator_bundle(uuid,uuid,integer,jsonb,jsonb,jsonb,boolean) security invoker;",
      "create or replace function public.record_creator_fan_review(uuid,uuid,jsonb,jsonb) returns void language plpgsql security definer set search_path='' as $$ begin return; end $$;",
    ]) {
      assert.throws(()=>sql(`begin; ${corruption} ${verification.reference} ${verification.body} rollback;`));
      assert.match(sql(verification.verify),/CREATOR_FOUNDATION_POSTFLIGHT=PASS/u);
    }
    assert.throws(()=>sql(buildCreatorApply(artifact)));
    assert.equal(sql("select count(*) from public.creators").trim(),"0");
    const outcome = sql(`
      begin;
      create function pg_temp.expect_denied(command text) returns void language plpgsql as $$
      begin
        begin execute command;
        exception when insufficient_privilege or foreign_key_violation or unique_violation or check_violation or serialization_failure then return;
        end;
        raise exception 'expected denial did not happen';
      end $$;
      set local role authenticated;
      select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
      select public.save_creator_bundle('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',null,0,
        '{"displayName":"Synthetic Creator A","bio":"","publicAge":null,"location":"","languages":["de"],"platforms":[],"status":"active","internalNotes":""}',
        '{"tone":"warm","goodExamples":["Hi there","Thanks","How are you?"]}','{"offers":[]}',true);
      do $$ begin
        if (select count(*) from public.creators) <> 1 then raise exception 'owner read failed'; end if;
      end $$;
      -- An owner cannot bypass revision/approval using PostgREST table PATCH.
      select pg_temp.expect_denied($q$update public.creator_voice_profiles set fingerprint='{"tone":"UNREVIEWED_DIRECT_WRITE"}'$q$);
      select pg_temp.expect_denied($q$update public.creator_sales_playbooks set rules='{"offers":[]}',approved_at=now()$q$);
      select pg_temp.expect_denied($q$update public.creators set display_name='UNREVIEWED_DIRECT_WRITE'$q$);
      select pg_temp.expect_denied(format('select public.save_creator_bundle(%L,null,0,%L,%L,%L,false)',workspace_id,
        '{"displayName":"duplicate"}','{}','{}')) from public.creators;
      do $$ begin
        if exists(select 1 from public.creator_voice_profiles where fingerprint->>'tone'<>'warm' or revision<>1 or approved_by<>auth.uid()) then raise exception 'direct mutation bypassed approval'; end if;
      end $$;
      select pg_temp.expect_denied($q$insert into public.creators(workspace_id,display_name) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','duplicate')$q$);
      select pg_temp.expect_denied($q$insert into public.creators(workspace_id,display_name) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','foreign')$q$);
      select pg_temp.expect_denied($q$insert into public.creator_commercial_events(workspace_id,creator_id,contact_id,kind,occurred_at,amount_minor,currency,evidence_reference,confirmed_by)
        select workspace_id,id,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','purchase',now(),25000,'EUR','synthetic-receipt','11111111-1111-4111-8111-111111111111' from public.creators$q$);
      select pg_temp.expect_denied($q$insert into public.creator_commercial_events(workspace_id,creator_id,contact_id,kind,occurred_at,amount_minor,currency,evidence_reference,confirmed_by)
        select workspace_id,id,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','purchase',now(),-1,'EUR','negative-price','11111111-1111-4111-8111-111111111111' from public.creators$q$);
      select pg_temp.expect_denied(format('select public.save_creator_bundle(%L,%L,99,%L,%L,%L,false)',workspace_id,id,'{}','{}','{}')) from public.creators;
      -- The authenticated table remains read-only; the narrow owner RPC is the write path.
      select pg_temp.expect_denied($q$update public.contact_ai_profiles set commercial_profile='{}'$q$);
      select public.record_creator_fan_review('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        '{"sourceReference":"synthetic-reviewed-chat","reviewedBy":"forged","reviewedAt":"2000-01-01"}',
        jsonb_build_object('kind','purchase','occurredAt',now(),'amountMinor',25000,'currency','EUR','category','photos','evidenceReference','synthetic-receipt'));
      do $$ begin
        if not exists(select 1 from public.creator_commercial_events where amount_minor=25000 and confirmed_by=auth.uid()) then raise exception 'purchase/actor failed'; end if;
        if not exists(select 1 from public.contact_ai_profiles where commercial_profile->>'reviewedBy'=auth.uid()::text and (commercial_profile->>'reviewedAt')::timestamptz=now()) then raise exception 'review actor/time not server-owned'; end if;
      end $$;
      -- A duplicate event rolls back the preceding profile update in the same RPC.
      select pg_temp.expect_denied($q$select public.record_creator_fan_review('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        '{"sourceReference":"MUST_ROLL_BACK"}',jsonb_build_object('kind','purchase','occurredAt',now(),'amountMinor',1,'currency','EUR','category','photos','evidenceReference','synthetic-receipt'))$q$);
      do $$ begin
        if exists(select 1 from public.contact_ai_profiles where commercial_profile->>'sourceReference'='MUST_ROLL_BACK') then raise exception 'partial review persisted'; end if;
      end $$;
      select pg_temp.expect_denied($q$select public.record_creator_fan_review('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','dddddddd-dddd-4ddd-8ddd-dddddddddddd','{"sourceReference":"foreign"}',null)$q$);
      -- Voice update before an invalid playbook must also roll back the Creator revision.
      select pg_temp.expect_denied(format('select public.save_creator_bundle(%L,%L,1,%L,%L,%L,false)',workspace_id,id,
        '{"displayName":"MUST_ROLL_BACK","bio":"","publicAge":null,"location":"","languages":["de"],"platforms":[],"status":"active","internalNotes":""}','{"tone":"MUST_ROLL_BACK"}','[]')) from public.creators;
      do $$ begin
        if exists(select 1 from public.creators where revision<>1 or display_name='MUST_ROLL_BACK') then raise exception 'partial Creator persisted'; end if;
        if exists(select 1 from public.creator_voice_profiles where fingerprint->>'tone'='MUST_ROLL_BACK') then raise exception 'partial voice persisted'; end if;
      end $$;
      select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
      select pg_temp.expect_denied($q$select public.record_creator_fan_review('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','{"sourceReference":"member"}',null)$q$);
      do $$ begin
        if (select count(*) from public.creators) <> 1 then raise exception 'member read failed'; end if;
      end $$;
      select pg_temp.expect_denied($q$update public.creators set display_name='member mutation'$q$);
      select pg_temp.expect_denied(format('select public.save_creator_bundle(%L,%L,1,%L,%L,%L,false)',workspace_id,id,'{}','{}','{}')) from public.creators;
      select pg_temp.expect_denied($q$insert into public.creators(workspace_id,display_name) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','member creator')$q$);
      select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
      do $$ begin
        if (select count(*) from public.creators) <> 0 then raise exception 'foreign creator leaked'; end if;
        if (select count(*) from public.creator_voice_profiles) <> 0 then raise exception 'foreign voice leaked'; end if;
        if (select count(*) from public.creator_sales_playbooks) <> 0 then raise exception 'foreign playbook leaked'; end if;
      end $$;
      set local role anon;
      select pg_temp.expect_denied('select * from public.creators');
      select pg_temp.expect_denied($q$select public.record_creator_fan_review('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc','{"sourceReference":"anonymous"}',null)$q$);
      reset role;
      rollback;
      select case when count(*)=0 then 'CREATOR_ROLLBACK_PROVED' else 'FAILED' end from public.creators;
    `);
    assert.match(outcome, /CREATOR_ROLLBACK_PROVED/u);
    assert.equal(sql("select count(*) from public.contacts;").trim(), "2");
  } finally {
    sql(`drop database ${database} with (force);`, "postgres");
  }
});
