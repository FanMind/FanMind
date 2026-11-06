import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { loadCurrentFactsProfile, PROFILE_PINS, verifyCurrentFactsCatalog } from "../scripts/operations/chat-admin-current-facts-profile.mjs";
import { CURRENT_CHAT_ADMIN_BASE_POSTFLIGHT_SQL as BASE } from "../scripts/operations/chat-admin-manual-flow-staging.mjs";
import { POSTFLIGHT_SQL as FAN } from "../scripts/operations/chat-admin-fan-staging-runner.mjs";
import { POSTFLIGHT_SQL as OFFERS } from "../scripts/operations/chat-admin-structured-offers-staging-runner.mjs";
import { POSTFLIGHT_SQL as TIER } from "../scripts/operations/chat-admin-customer-tier-staging-runner.mjs";

const root=new URL("../",import.meta.url), read=path=>readFileSync(new URL(path,root));
const enabled=process.env.FANMIND_CREATOR_PG17_REQUIRED==="true";
const image="postgres:17.11-trixie@sha256:e38411452a464af89e5adadb8d223bf53b898d47d6ef918b2d58c08707350449";
const docker=(args,options={})=>execFileSync("docker",["--host=unix:///var/run/docker.sock",...args],{encoding:"utf8",timeout:60000,maxBuffer:16*1024*1024,stdio:["pipe","pipe","pipe"],...options});
const parentPaths=["supabase/controlled/20260920230000_chat_admin_multi_character.sql","supabase/controlled/20260927200000_chat_admin_character_fans.sql","supabase/controlled/20261007102000_chat_admin_customer_tier.sql","supabase/controlled/20261007190000_chat_admin_structured_offers.sql"];
const originalProfiles=[BASE,FAN,OFFERS,TIER];

test("offline Current-Facts profile refuses modified source, query, reference and incomplete catalogs",()=>{
 const loaded=loadCurrentFactsProfile();
 for(const phase of ["baseline","current"]){
  assert.match(verifyCurrentFactsCatalog(loaded.reference[phase],phase),/VERIFIED$/u);
  for(const change of [c=>c.records.pop(),c=>c.records.push({kind:"unexpected"}),c=>c.postgresMajor=16,c=>c.records[0].unexpected=true]){
   const actual=structuredClone(loaded.reference[phase]);change(actual);assert.throws(()=>verifyCurrentFactsCatalog(actual,phase),/catalog_mismatch/u);
  }
 }
 assert.throws(()=>verifyCurrentFactsCatalog(loaded.reference.baseline),/catalog_mismatch/u);
 for(const path of [...Object.keys(PROFILE_PINS),"scripts/operations/chat-admin-current-facts-catalog.sql","docs/operations/chat-admin-current-facts-profile-reference.json"]){
  assert.throws(()=>loadCurrentFactsProfile(p=>p===path?Buffer.concat([read(p),Buffer.from("\n")]):read(p)),/checksum/u,path);
 }
 // A caller-supplied reference is not an approval mechanism.
 assert.throws(()=>verifyCurrentFactsCatalog({},"current",{reference:{current:{}}}),/catalog_mismatch/u);
});

test("PG17 offline Current-Facts strict profile survives full dump/restore and rejects native catalog mutations",{skip:!enabled,timeout:240000},async t=>{
 const {query,reference}=loadCurrentFactsProfile();
 const containers=[];
 const sql=(container,db,input)=>{
  assert.match(container,/^[a-f0-9]{64}$/u);
  return docker(["exec","-i",container,"psql","-X","-qAt","-U","postgres","-d",db,"-v","ON_ERROR_STOP=1"],{input});
 };
 const start=async label=>{
  const id=docker(["run","--pull=never","-d","--name",`fanmind-facts-${label}-${randomUUID()}`,"--network","none","-e","POSTGRES_HOST_AUTH_METHOD=trust","-e","POSTGRES_INITDB_ARGS=--encoding=UTF8 --locale-provider=icu --icu-locale=en-US --locale=en_US.UTF-8",image]).trim();
  containers.push(id);
  const state=JSON.parse(docker(["inspect",id]))[0];
  assert.equal(state.HostConfig.NetworkMode,"none");assert.ok(state.Mounts.every(m=>m.Type==="volume"&&m.Destination==="/var/lib/postgresql/data"&&m.RW===true),"only disposable image PGDATA volumes, no host mounts");assert.ok(!state.HostConfig.PortBindings||Object.keys(state.HostConfig.PortBindings).length===0);
  for(let i=0;i<80;i++){try{if(!docker(["logs",id]).includes("PostgreSQL init process complete; ready for start up."))throw new Error("initializing");sql(id,"postgres","select 1;");return id;}catch{await new Promise(r=>setTimeout(r,100));}}
  throw new Error("isolated_pg17_not_ready");
 };
 const w="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",c="cccccccc-cccc-4ccc-8ccc-cccccccccccc",f="dddddddd-dddd-4ddd-8ddd-dddddddddddd",other="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
 const owner="11111111-1111-4111-8111-111111111111",foreign="22222222-2222-4222-8222-222222222222";
 const generation=i=>`${String(i).padStart(8,"0")}-1111-4111-8111-111111111111`;
 const escaped=s=>"'"+s.replaceAll("'","''")+"'";
 try{
  const source=await start("source"),target=await start("target");assert.notEqual(source,target);
  const sourceDb="facts_source",targetDb="facts_restored",parentsDb="facts_parent_copy";
  sql(source,"postgres",`create database ${sourceDb} template template0;`);
  sql(source,sourceDb,read("tests/fixtures/chat-admin-current-facts.sql"));
  for(const path of parentPaths)sql(source,sourceDb,read(path));
  // Entire original exports, including their READ ONLY transactions, unchanged.
  for(const profile of originalProfiles)sql(source,sourceDb,profile);
  assert.equal(JSON.parse(sql(source,sourceDb,query)).postgresMajor,17);
  verifyCurrentFactsCatalog(JSON.parse(sql(source,sourceDb,query)),"baseline");
  sql(source,sourceDb,read("supabase/controlled/chat_admin_current_facts.sql"));
  verifyCurrentFactsCatalog(JSON.parse(sql(source,sourceDb,query)));
  sql(source,sourceDb,`insert into public.workspace_chat_admin_capabilities(workspace_id,chat_admin_multi_character,granted_to_user_id) values('${w}',true,'${owner}');
   insert into public.chat_characters(id,workspace_id,created_by_user_id,display_name,public_age,bio,personality,writing_style,emoji_style,sentence_style,flirt_style,sales_rules) values('${c}','${w}','${owner}','Synthetic',25,'','','','','','','');
   insert into public.chat_character_fans(id,workspace_id,character_id,display_name,platform,creation_id,notes) values('${f}','${w}','${c}','Synthetic fan','manual','${generation(90)}',repeat('x',4000)),('${other}','${w}','${c}','Independent synthetic fan','manual','${generation(91)}','independent notes');`);
  const conversation=sql(source,sourceDb,`select id from public.chat_character_conversations where fan_id='${f}';`).trim();
  const as=(id,db,text,user=owner)=>sql(id,db,`set role authenticated;set request.jwt.claim.sub='${user}';${text}`);
  const event=(id,db,i,content)=>sql(id,db,`insert into public.chat_character_messages(workspace_id,character_id,fan_id,conversation_id,direction,content,character_revision,generation_id) values('${w}','${c}','${f}','${conversation}','fan_inbound',${escaped(content)},1,'${generation(i)}');insert into public.chat_character_messages(workspace_id,character_id,fan_id,conversation_id,direction,content,character_revision,generation_id) select '${w}','${c}','${f}','${conversation}','suggested_reply','Synthetic draft',1,'${generation(i)}' from generate_series(1,3);`);
  const apply=(id,db,i)=>as(id,db,`select public.apply_chat_admin_current_interests('${w}','${c}','${f}','${conversation}',1,(select revision from public.chat_character_fans where id='${f}'),'${generation(i)}');`).trim();
  event(source,sourceDb,1,"Ich liebe Musik.");assert.equal(apply(source,sourceDb,1),"t");
  event(source,sourceDb,2,"Ich mag keine Musik mehr.");assert.equal(apply(source,sourceDb,2),"t");
  const dataQuery=`select jsonb_build_object(${["auth.users","public.workspaces","public.workspace_chat_admin_capabilities","public.chat_characters","public.chat_character_fans","public.chat_character_conversations","public.chat_character_messages","public.chat_character_current_facts"].map(table=>`${escaped(table)},(select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text collate "C"),'[]') from ${table} r)`).join(",")},'sequence',(select jsonb_build_object('last_value',last_value::text,'is_called',is_called) from public.chat_character_messages_sequence_seq));`;
  const data=JSON.parse(sql(source,sourceDb,dataQuery));
  assert.equal(data["public.chat_character_fans"].find(r=>r.id===f).notes,"x".repeat(4000));
  assert.equal(data["public.chat_character_fans"].find(r=>r.id===f).current_facts_version,1);
  assert.equal(data["public.chat_character_current_facts"].length,1);
  assert.equal(data["public.chat_character_current_facts"][0].polarity,"negative");
  assert.equal(data["public.chat_character_current_facts"][0].quote,"Ich mag keine Musik mehr.");
  assert.equal(data["public.chat_character_messages"].filter(r=>r.content==="Ich liebe Musik.").length,1);
  const before=JSON.parse(sql(source,sourceDb,query));verifyCurrentFactsCatalog(before);
  const archive=docker(["exec",source,"pg_dump","-U","postgres","--format=custom","--dbname",sourceDb],{encoding:null});
  assert.ok(archive.subarray(0,5).equals(Buffer.from("PGDMP")));assert.ok(archive.length>1000);
  const digest=createHash("sha256").update(archive).digest("hex");
  // Roles are fixed synthetic prerequisites, not claims that pg_dump archives cluster globals.
  sql(target,"postgres",read("tests/fixtures/chat-admin-current-facts.sql").toString().split("create schema auth;")[0]);
  for(const db of [targetDb,parentsDb]){
   sql(target,"postgres",`create database ${db} template template0;`);
   assert.equal(sql(target,db,"select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname not in ('pg_catalog','information_schema') and n.nspname !~ '^pg_toast';").trim(),"0");
   docker(["exec","-i",target,"pg_restore","-U","postgres","--exit-on-error","--single-transaction","--dbname",db],{input:archive});
   verifyCurrentFactsCatalog(JSON.parse(sql(target,db,query)));
   assert.deepEqual(JSON.parse(sql(target,db,dataQuery)),data);
  }
  // No schema, ACL, owner or data filters; bytes passed intact into a different container.
  assert.equal(createHash("sha256").update(archive).digest("hex"),digest);
  const mainSig="uuid,uuid,uuid,uuid,integer,integer,uuid";
  sql(target,parentsDb,`begin;
   drop trigger chat_current_fact_authority_immutable on public.chat_character_fans;
   drop trigger chat_current_fact_source_immutable on public.chat_character_messages;
   drop table public.chat_character_current_facts restrict;
   drop index public.chat_character_messages_current_fact_source restrict;
   alter table public.chat_character_fans drop column current_facts_version restrict;
   drop function public.apply_chat_admin_current_interests(${mainSig}) restrict;
   drop function fanmind_chat_knowledge.apply_generation(${mainSig}) restrict;
   drop function fanmind_chat_knowledge.guard_source() restrict;
   drop function fanmind_chat_knowledge.guard_authority_marker() restrict;
   drop function fanmind_chat_knowledge.source_interests(text) restrict;
   drop function fanmind_chat_knowledge.neutral_statement(text) restrict;
   drop function fanmind_chat_knowledge.literal_interest(text) restrict;
   drop schema fanmind_chat_knowledge restrict;
   commit;`);
  for(const profile of originalProfiles)sql(target,parentsDb,profile);
  verifyCurrentFactsCatalog(JSON.parse(sql(target,parentsDb,query)),"baseline");
  verifyCurrentFactsCatalog(JSON.parse(sql(target,targetDb,query)));
  assert.deepEqual(JSON.parse(sql(target,targetDb,dataQuery)),data,"inverse copy must not touch actual restored state");

  const restoredCatalog=JSON.parse(sql(target,targetDb,query));
  const sourceFk=reference.current.records.find(r=>r.kind==="constraint"&&r.relation==="public.chat_character_current_facts"&&r.type==="f"&&r.definition.includes("chat_character_messages"));
  assert.match(sourceFk.name,/^[a-z0-9_]+$/u);
  const mutations=[
   ["neutral disclosure view","create view public.unexpected_disclosure as select * from public.chat_character_current_facts;grant select on public.unexpected_disclosure to authenticated"],
   ["neutral materialized view","create materialized view public.unexpected_materialized as select * from public.chat_character_current_facts;grant select on public.unexpected_materialized to authenticated"],
   ["incoming bypass role grant","create role profile_attacker login;grant service_role to profile_attacker"],
   ["extra private enum","create type fanmind_chat_knowledge.unexpected as enum ('x')"],
   ["extra private table","create table fanmind_chat_knowledge.unexpected(x integer)"],
   ["extra public profile table","create table public.chat_character_unexpected(x integer)"],
   ["extra parent column","alter table public.chat_character_fans add column unexpected text"],
   ["changed parent nullability","alter table public.chat_characters alter column display_name drop not null"],
   ["extra index outside prefix","create index unexpected_index on public.chat_character_fans(display_name)"],
   ["disabled source trigger","alter table public.chat_character_messages disable trigger chat_current_fact_source_immutable"],
   ["extra trigger","create trigger unexpected before update on public.chat_character_current_facts for each row execute function fanmind_chat_knowledge.guard_authority_marker()"],
   ["nondeferred source FK",`alter table public.chat_character_current_facts alter constraint ${sourceFk.name} not deferrable`],
   ["unvalidated source FK",`alter table public.chat_character_current_facts drop constraint ${sourceFk.name};alter table public.chat_character_current_facts add constraint ${sourceFk.name} ${sourceFk.definition} not valid`],
   ["broadened quote CHECK","alter table public.chat_character_current_facts drop constraint chat_character_current_facts_quote_check;alter table public.chat_character_current_facts add constraint chat_character_current_facts_quote_check check(char_length(quote) between 1 and 240 or quote=btrim(quote))"],
   ["changed quote CHECK","alter table public.chat_character_current_facts drop constraint chat_character_current_facts_quote_check;alter table public.chat_character_current_facts add constraint chat_character_current_facts_quote_check check(char_length(quote) between 1 and 239 and quote=btrim(quote))"],
   ["disabled RLS","alter table public.chat_character_current_facts disable row level security"],
   ["changed policy","alter policy chat_current_facts_owner_read on public.chat_character_current_facts using(true)"],
   ["extra policy","create policy unexpected on public.chat_character_current_facts for select to anon using(true)"],
   ["write with grant option","grant update on public.chat_character_current_facts to authenticated with grant option"],
   ["column ACL","grant select(quote) on public.chat_character_current_facts to anon"],
   ["public schema create ACL","grant create on schema public to authenticated"],
   ["database owner",`alter database ${targetDb} owner to authenticated`],
   ["ICU locale","update pg_catalog.pg_database set datlocale='de-DE' where datname=current_database()"],
   ["ICU rules","update pg_catalog.pg_database set daticurules='&a<b' where datname=current_database()"],
   ["ICU collation version","update pg_catalog.pg_database set datcollversion='unexpected' where datname=current_database()"],
   ["schema create ACL","grant create on schema fanmind_chat_knowledge to authenticated"],
   ["schema owner","alter schema fanmind_chat_knowledge owner to authenticated"],
   ["function owner","alter function fanmind_chat_knowledge.guard_source() owner to authenticated"],
   ["private definer changed",`alter function fanmind_chat_knowledge.apply_generation(${mainSig}) security invoker`],
   ["public wrapper definer",`alter function public.apply_chat_admin_current_interests(${mainSig}) security definer`],
   ["routine search path","alter function fanmind_chat_knowledge.guard_source() set search_path=public"],
   ["routine execute ACL","grant execute on function fanmind_chat_knowledge.guard_source() to public"],
   ["routine body","create or replace function fanmind_chat_knowledge.literal_interest(value text) returns table(topic text,polarity text) language sql immutable security invoker set search_path='' as $$select 'music'::text,'positive'::text$$"],
   ["extra overload","create function public.apply_chat_admin_current_interests(integer) returns boolean language sql as $$select true$$"],
   ["parent helper changed","alter function public.is_current_chat_admin_workspace(uuid) security definer"],
   ["sequence changed","alter sequence public.chat_character_messages_sequence_seq increment by 2"],
   ["default ACL","alter default privileges in schema fanmind_chat_knowledge grant execute on functions to anon"],
   ["database role defaults",`alter database ${targetDb} set session_replication_role=replica`],
   ["role bypass","alter role authenticated bypassrls"],
   ["transitive role escape","create role profile_bridge;grant service_role to profile_bridge;grant profile_bridge to authenticated"],
  ];
  let rejectedCases=0;
  for(const [name,mutation] of mutations)await t.test(`rejects ${name}`,()=>{
   // Deliberate mutation is LOCAL ONLY and rolled back. Catalog SELECT unchanged;
   // only its transaction is writable for this adversarial fixture.
   try{
   const mutatedQuery=query.replace("begin transaction isolation level repeatable read read only;","begin;").replace("with recursive",()=>`${mutation};\nwith recursive`);
   const observed=JSON.parse(sql(target,targetDb,mutatedQuery));
   assert.throws(()=>verifyCurrentFactsCatalog(observed),/catalog_mismatch/u);
   assert.deepEqual(JSON.parse(sql(target,targetDb,query)),restoredCatalog,"mutation must roll back completely");
   }catch(error){rejectedCases++;throw error;}
  });
  assert.equal(rejectedCases,0,"all native mutation cases must pass before reporting roundtrip PASS");
  assert.deepEqual(JSON.parse(sql(target,targetDb,dataQuery)),data);
  assert.equal(as(target,targetDb,"select count(*) from public.chat_character_current_facts;",foreign).trim(),"0");
  assert.throws(()=>as(target,targetDb,`select public.apply_chat_admin_current_interests('${w}','${c}','${f}','${conversation}',1,1,'${generation(2)}');`,foreign));
  assert.throws(()=>as(target,targetDb,"update public.chat_character_current_facts set polarity='positive';"));
  assert.throws(()=>as(target,targetDb,`select public.apply_chat_admin_current_interests('${w}','${c}','${other}','${conversation}',1,1,'${generation(2)}');`));
  assert.throws(()=>sql(target,targetDb,"delete from public.chat_character_messages where id in(select source_message_id from public.chat_character_current_facts);"));
  assert.throws(()=>sql(target,targetDb,"update public.chat_character_messages set content='invented' where id in(select source_message_id from public.chat_character_current_facts);"));
  assert.throws(()=>sql(target,targetDb,`update public.chat_character_fans set current_facts_version=0 where id='${f}';`));
  assert.equal(apply(target,targetDb,1),"f");assert.equal(apply(target,targetDb,2),"f");
  assert.deepEqual(JSON.parse(sql(target,targetDb,dataQuery)),data,"late/repeated source must preserve restored negative and revision");
  for(const [label,deletion] of [["Character",`delete from public.chat_characters where id='${c}'`],["Workspace",`delete from public.workspaces where id='${w}'`]]){
   const result=sql(target,targetDb,`begin;${deletion};set constraints all immediate;select (select count(*) from public.chat_character_current_facts)||(select count(*) from public.chat_character_messages where workspace_id='${w}')::text;rollback;`).trim();
   assert.equal(result,"00",label+" deletion must atomically cascade facts and sources");
   assert.deepEqual(JSON.parse(sql(target,targetDb,dataQuery)),data,label+" synthetic rollback must preserve restored data");
  }
  event(target,targetDb,3,"Ich liebe Musik.");assert.equal(apply(target,targetDb,3),"t");
  assert.equal(sql(target,targetDb,"select polarity from public.chat_character_current_facts;").trim(),"positive");
  assert.equal(sql(target,targetDb,`select notes=repeat('x',4000) from public.chat_character_fans where id='${f}';`).trim(),"t");
  as(target,targetDb,`delete from public.chat_character_fans where id='${f}';`);
  assert.equal(sql(target,targetDb,`select (select count(*) from public.chat_character_current_facts)||(select count(*) from public.chat_character_messages where fan_id='${f}')::text;`).trim(),"00");
  assert.equal(sql(target,targetDb,`select notes from public.chat_character_fans where id='${other}';`).trim(),"independent notes");
  verifyCurrentFactsCatalog(JSON.parse(sql(target,targetDb,query)));
  t.diagnostic(`OFFLINE_CURRENT_FACTS_ROUNDTRIP=PASS dump_sha256=${digest} baseline_records=${reference.baseline.records.length} current_records=${reference.current.records.length} mutations=${mutations.length} parent_profiles=4 source_target_containers=2`);
 }finally{for(const id of containers.reverse())docker(["rm","-f","-v",id]);}
});
