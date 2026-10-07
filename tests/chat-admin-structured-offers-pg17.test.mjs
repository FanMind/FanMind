import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
