import assert from "node:assert/strict";
import "./chat-admin-current-facts-profile.cases.mjs";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const container=process.env.FANMIND_CREATOR_PG17_CONTAINER_ID??"";
const enabled=process.env.FANMIND_CREATOR_PG17_REQUIRED==="true";
const database="fanmind_chatadmin_offers_ci";
function sql(query,db=database){assert.match(container,/^[0-9a-f]{12,64}$/u);return execFileSync("docker",["exec","-i",container,"psql","-X","-U","postgres","-d",db,"-v","ON_ERROR_STOP=1","-At"],{input:query,encoding:"utf8",timeout:60000,maxBuffer:2*1024*1024});}

test("PostgreSQL 17 persists and isolates structured playbooks per Character",{skip:!enabled},()=>{
 sql(`create database ${database};`,"postgres");
 try{
  sql(`create table public.chat_characters(id uuid primary key,workspace_id uuid not null,sales_rules text not null);insert into public.chat_characters values('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','keep rules'),('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','other rules');`);
  sql(readFileSync(new URL("../supabase/controlled/20261007190000_chat_admin_structured_offers.sql",import.meta.url),"utf8"));
  assert.equal(sql(`select count(*) from public.chat_characters where sales_playbook->'offers'='[]'::jsonb and sales_rules like '%rules';`).trim(),"2");
  sql(`update public.chat_characters set sales_playbook=jsonb_build_object('positioning','', 'offers',jsonb_build_array(jsonb_build_object('id','private_photo','name','Privates Foto','category','private_photo','currency','EUR','minimumPriceMinor',2500,'recommendedPriceMinor',2500,'maximumPriceMinor',2500,'maximumDiscountPercent',0,'description','','delivery','','exclusivity','','requiresConfirmation',false,'active',true)),'minimumHoursBetweenOffers',48,'aftercareHours',48,'contentBoundaries',jsonb_build_array(),'confirmationRequired',jsonb_build_array(),'noGos',jsonb_build_array()) where id='11111111-1111-4111-8111-111111111111';`);
  assert.equal(sql(`select sales_playbook#>>'{offers,0,recommendedPriceMinor}' from public.chat_characters where id='11111111-1111-4111-8111-111111111111';`).trim(),"2500");
  assert.equal(sql(`select jsonb_array_length(sales_playbook->'offers') from public.chat_characters where id='22222222-2222-4222-8222-222222222222';`).trim(),"0");
  assert.throws(()=>sql(`update public.chat_characters set sales_playbook='[]'::jsonb where id='11111111-1111-4111-8111-111111111111';`));
 }finally{sql(`drop database if exists ${database} with (force);`,"postgres");}
});

// Separate disposable database, actual canonical parent SQL and native roles.
// This proves a proposed install on PG17, never an installed target/runtime.
test("PostgreSQL 17 current facts replace interests beside 4000 manual characters with source/RLS/CAS proof",{skip:!enabled},async()=>{
 sql(`create database ${database};`,"postgres");
 const w="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",c="cccccccc-cccc-4ccc-8ccc-cccccccccccc",f="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
 const owner="11111111-1111-4111-8111-111111111111",foreign="22222222-2222-4222-8222-222222222222";
 const g=i=>`${String(i).padStart(8,"0")}-1111-4111-8111-111111111111`;
 const as=(query,id=owner)=>sql(`set role authenticated;set request.jwt.claim.sub='${id}';${query}`);
 const revision=()=>Number(sql(`select revision from public.chat_character_fans where id='${f}';`).trim());
 let conversation;
 const apply=(generation,rev=revision())=>as(`select public.apply_chat_admin_current_interests('${w}','${c}','${f}','${conversation}',1,${rev},'${generation}');`);
 const event=(i,content)=>{
  const escaped=content.replaceAll("'","''");
  sql(`insert into public.chat_character_messages(workspace_id,character_id,fan_id,conversation_id,direction,content,character_revision,generation_id) values('${w}','${c}','${f}','${conversation}','fan_inbound','${escaped}',1,'${g(i)}');insert into public.chat_character_messages(workspace_id,character_id,fan_id,conversation_id,direction,content,character_revision,generation_id) select '${w}','${c}','${f}','${conversation}','suggested_reply','Synthetic reply',1,'${g(i)}' from generate_series(1,3);`);
 };
 try{
  sql(readFileSync(new URL("./fixtures/chat-admin-current-facts.sql",import.meta.url),"utf8"));
  sql(readFileSync(new URL("../supabase/controlled/20260920230000_chat_admin_multi_character.sql",import.meta.url),"utf8"));
  sql(readFileSync(new URL("../supabase/controlled/20260927200000_chat_admin_character_fans.sql",import.meta.url),"utf8"));
  sql(`insert into public.workspace_chat_admin_capabilities(workspace_id,chat_admin_multi_character,granted_to_user_id) values('${w}',true,'${owner}');insert into public.chat_characters(id,workspace_id,created_by_user_id,display_name,public_age,bio,personality,writing_style,emoji_style,sentence_style,flirt_style,sales_rules) values('${c}','${w}','${owner}','Synthetic',25,'','','','','','','');insert into public.chat_character_fans(id,workspace_id,character_id,display_name,platform,creation_id,notes) values('${f}','${w}','${c}','Synthetic fan','manual','${g(90)}',repeat('x',4000));`);
  conversation=sql(`select id from public.chat_character_conversations where fan_id='${f}';`).trim();
  assert.throws(()=>sql("select * from public.chat_character_current_facts;"),"RED: prior schema has no durable relation");
  sql(readFileSync(new URL("../supabase/controlled/chat_admin_current_facts.sql",import.meta.url),"utf8"));
  event(1,"Ich liebe Musik.");event(2,"Ich mag Musik nicht mehr.");
  const equalLegacy=JSON.stringify({version:1,facts:[{kind:"interest",quote:"Ich mag Musik nicht mehr.",source:"opaque",source_sequence:1}]}).replaceAll("'","''");
  sql(`update public.chat_character_fans set notes=E'manual\\n\\n[FanMind-Kontaktwissen v1]\\n'||'${equalLegacy}' where id='${f}';`);
  assert.ok(apply(g(1)).split("\n").includes("f"),"equal opaque legacy order cannot be reinterpreted as a positive");
  assert.equal(sql("select count(*) from public.chat_character_current_facts;").trim(),"0");
  sql(`update public.chat_character_fans set notes=repeat('x',4000) where id='${f}';`);
  assert.ok(apply(g(1)).split("\n").includes("t"));
  assert.ok(apply(g(2)).split("\n").includes("t"));
  assert.equal(sql(`select polarity||':'||quote from public.chat_character_current_facts where fan_id='${f}' and topic='music';`).trim(),"negative:Ich mag Musik nicht mehr.");
  assert.equal(sql(`select notes=repeat('x',4000) from public.chat_character_fans where id='${f}';`).trim(),"t");
  const rev=revision();assert.ok(apply(g(1)).split("\n").includes("f"));assert.ok(apply(g(2)).split("\n").includes("f"));assert.equal(revision(),rev);
  event(3,"Ich mag Musik. Ich mag Musik nicht mehr.");apply(g(3));
  assert.equal(sql("select source_statement_index from public.chat_character_current_facts where topic='music';").trim(),"1");
  event(4,"I love music.");apply(g(4));
  assert.equal(sql("select polarity from public.chat_character_current_facts where topic='music';").trim(),"positive");
  assert.throws(()=>apply(g(2),1),"stale fan revision rejected");
  assert.throws(()=>as(`select public.apply_chat_admin_current_interests('${w}','${c}','${f}','${conversation}',1,${revision()},'${g(4)}');`,foreign));
  assert.equal(as("select count(*) from public.chat_character_current_facts;",foreign).trim().split("\n").at(-1),"0");
  assert.throws(()=>as("update public.chat_character_current_facts set polarity='negative';"));
  assert.throws(()=>as("delete from public.chat_character_current_facts;"));
  assert.throws(()=>as("insert into public.chat_character_current_facts select * from public.chat_character_current_facts;"));
  assert.throws(()=>sql(`update public.chat_character_messages set content='I no longer like music.' where id=(select source_message_id from public.chat_character_current_facts where topic='music');`));
  assert.throws(()=>sql(`delete from public.chat_character_messages where id=(select source_message_id from public.chat_character_current_facts where topic='music');`));
  event(5,'"\nIch mag Musik nicht mehr.\n"');assert.ok(apply(g(5)).split("\n").includes("f"));
  event(6,"Ich mag Katzen.");apply(g(6));
  assert.equal(sql("select count(*) from public.chat_character_current_facts;").trim(),"2");
  event(7,"Bitte keine Angebote. Ich mag Musik nicht mehr.");event(8,"Ich mag kurze Antworten. Ich liebe Musik.");
  const heldRevision=revision();
  let lockReady;
  const locked=new Promise(resolve=>{lockReady=resolve;});
  function transaction(query,onOutput=()=>{}){
   return new Promise((resolve,reject)=>{
    const child=spawn("docker",["exec","-i",container,"psql","-X","-q","-U","postgres","-d",database,"-v","ON_ERROR_STOP=1","-At"],{stdio:["pipe","pipe","pipe"]});
    let out="",error="";const timer=setTimeout(()=>{child.kill();reject(new Error("local_pg_transaction_timeout"));},15000);
    child.stdout.on("data",data=>{out+=data;onOutput(out);});child.stderr.on("data",data=>{error+=data;});
    child.on("error",reject);child.on("close",status=>{clearTimeout(timer);resolve({status,out,error});});child.stdin.end(query);
   });
  }
  const first=transaction(`begin;set role authenticated;set request.jwt.claim.sub='${owner}';select public.apply_chat_admin_current_interests('${w}','${c}','${f}','${conversation}',1,${heldRevision},'${g(7)}');select 'lock-held';select pg_sleep(0.8);commit;`,output=>{if(output.includes("lock-held"))lockReady();});
  await Promise.race([locked,first.then(()=>{throw new Error("source_lock_handshake_missing");})]);
  const updateSource=transaction(`update public.chat_character_messages set content='Ich mag Musik.' where generation_id='${g(7)}' and direction='fan_inbound';`);
  const competing=transaction(`set role authenticated;set request.jwt.claim.sub='${owner}';select public.apply_chat_admin_current_interests('${w}','${c}','${f}','${conversation}',1,${heldRevision},'${g(8)}');`);
  assert.equal((await first).status,0);
  const sourceResult=await updateSource;assert.notEqual(sourceResult.status,0);assert.match(sourceResult.error,/current_fact_source_immutable/u);
  const conflict=await competing;assert.notEqual(conflict.status,0);assert.match(conflict.error,/current_fact_revision/u);
  assert.equal(sql("select strpos(m.content,f.quote)>0 from public.chat_character_current_facts f join public.chat_character_messages m on m.id=f.source_message_id where f.topic='music';").trim(),"t");
  apply(g(8));event(9,"Ich mag Musik nicht mehr.");
  assert.equal(sql(`select current_facts_version from public.chat_character_fans where id='${f}';`).trim(),"1");
  assert.throws(()=>as(`update public.chat_character_fans set current_facts_version=0 where id='${f}';`));
  const before=sql("select jsonb_agg(t order by topic)::text from public.chat_character_current_facts t;").trim();
  assert.throws(()=>as(`begin;select public.apply_chat_admin_current_interests('${w}','${c}','${f}','${conversation}',1,${revision()},'${g(9)}');select 1/0;commit;`));
  assert.equal(sql("select jsonb_agg(t order by topic)::text from public.chat_character_current_facts t;").trim(),before);
  assert.equal(sql("select has_table_privilege('anon','public.chat_character_current_facts','SELECT');").trim(),"f");
  assert.equal(sql("select has_function_privilege('service_role','public.apply_chat_admin_current_interests(uuid,uuid,uuid,uuid,integer,integer,uuid)','EXECUTE');").trim(),"f");
  event(10,"Ich mag Kochen.");
  sql(`update public.chat_character_fans set notes=E'manual\\n\\n[FanMind-Kontaktwissen v1]\\n'||jsonb_build_object('version',1,'facts',jsonb_build_array(jsonb_build_object('kind','interest','quote','Ich mag Hunde.','source','legacy-opaque','source_sequence',10000)))::text where id='${f}';`);
  assert.ok(apply(g(10)).split("\n").includes("f"),"legacy ordering cutoff rejects older unrelated generations");
  sql(`update public.chat_character_fans set notes=repeat('x',4000) where id='${f}';`);
  apply(g(10));
  event(11,"Ich mag Musik nicht mehr. Ich mag Katzen nicht mehr. Ich mag Hunde nicht mehr. Ich mag Reisen nicht mehr. Ich mag Sport nicht mehr. Ich mag Fotos nicht mehr. Ich mag Videos nicht mehr. Ich mag Kochen nicht mehr.");
  apply(g(11));
  assert.equal(sql("select count(*) from public.chat_character_current_facts where polarity='negative';").trim(),"8");
  assert.ok(apply(g(1)).split("\n").includes("f"));
  as(`delete from public.chat_character_fans where id='${f}';`);
  assert.equal(sql("select count(*) from public.chat_character_current_facts;").trim(),"0","Fan deletion cascades both facts and sources");
 }finally{sql(`drop database if exists ${database} with (force);`,"postgres");}
});
