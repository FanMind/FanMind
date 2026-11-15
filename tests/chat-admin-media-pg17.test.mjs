import {proveMonthlySqlNative,proveMonthlyPriceDrift} from './monthly-release-sql-native.cases.mjs';
import {runStorageFinalizationSqlCases} from './chat-admin-media-storage-finalization-sql.cases.mjs';
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {mediaCatalogueEqualitySql} from "../scripts/operations/staging-support-media-preflight.mjs";
import {runMediaSchemaNativeCases} from './chat-admin-media-schema.cases.mjs';
import {installRetentionIndependenceFixture,proveMediaRetentionIndependence,proveCapacityWriterRetentionIndependence} from './media-retention-independence.cases.mjs';
import { execFileSync, spawn } from "node:child_process";
import test from "node:test";
const container=process.env.FANMIND_CREATOR_PG17_CONTAINER_ID??"";
const enabled=process.env.FANMIND_CREATOR_PG17_REQUIRED==="true";
const database="fanmind_chat_media_ci";
function sql(query,db=database){assert.match(container,/^[0-9a-f]{12,64}$/u);return execFileSync("docker",["exec","-i",container,"psql","-X","-U","postgres","-d",db,"-v","ON_ERROR_STOP=1","-At"],{input:query,encoding:"utf8",timeout:60000,maxBuffer:2*1024*1024,stdio:["pipe","pipe","pipe"]});}
import { runChatAdminMediaSqlCases } from "./chat-admin-media-sql.cases.mjs";
function transaction(query,onOutput=()=>{}){
 return new Promise((resolve,reject)=>{
  const child=spawn("docker",["exec","-i",container,"psql","-X","-q","-U","postgres","-d",database,"-v","ON_ERROR_STOP=1","-At"],{stdio:["pipe","pipe","pipe"]});
  let out="",error="";const timer=setTimeout(()=>{child.kill();reject(Error("media_sql_transaction_timeout"));},15000);
  child.stdout.on("data",data=>{out+=data;onOutput(out);});child.stderr.on("data",data=>{error+=data;});
  child.on("error",reject);child.on("close",status=>{clearTimeout(timer);resolve({status,out,error});});child.stdin.end(query);
 });
}
import {runMediaCatalogueSqlCases} from "./chat-admin-media-catalogue-sql.cases.mjs";
async function concurrentMediaLifecycle(){
 const w="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",c="cccccccc-cccc-4ccc-8ccc-cccccccccccc",owner="11111111-1111-4111-8111-111111111111";
 const ids=sql("select id from public.chat_character_media order by id limit 2;").trim().split("\n");
 const auth=`set role authenticated;set request.jwt.claim.sub='${owner}';`;
 for(const insertionWins of [true,false]){
  const id=ids[insertionWins?0:1],path=`${w}/${c}/${id}.webp`;
  let ready;const locked=new Promise(resolve=>{ready=resolve;});
  const action=insertionWins?`insert into storage.objects(bucket_id,name) values('chat-character-media','${path}');`:`update public.chat_character_media set deleted=true,reviewed=false,available=false where id='${id}';`;
  const first=transaction(`begin;${auth}${action}select 'media-lock-held';select pg_sleep(0.6);commit;`,out=>{if(out.includes("media-lock-held"))ready();});
  await Promise.race([locked,first.then(()=>{throw Error("media_lock_handshake_missing");})]);
  const competing=insertionWins?transaction(`${auth}update public.chat_character_media set deleted=true,reviewed=false,available=false where id='${id}';select count(*) from storage.objects where name='${path}';`):transaction(`${auth}insert into storage.objects(bucket_id,name) values('chat-character-media','${path}');`);
  assert.equal((await first).status,0);
  const result=await competing;
  if(insertionWins){assert.equal(result.status,0);assert.equal(result.out.trim().split("\n").at(-1),"1","cleanup must observe the serialized object insertion");}
  else{assert.notEqual(result.status,0);assert.match(result.error,/media_object_binding_invalid|row-level security/u);assert.equal(sql(`select count(*) from storage.objects where name='${path}';`).trim(),"0");}
 }
}
test("native PG17 media RLS, object lifecycle, revision invalidation and deletion freeze",{skip:!enabled},async()=>{
 let supportCatalogue;
 sql(`create database ${database};`,"postgres");
 try{await runChatAdminMediaSqlCases(async query=>sql(query),async()=>{
   supportCatalogue=await installRetentionIndependenceFixture(async query=>sql(query));
   await proveMediaRetentionIndependence(async query=>sql(query),supportCatalogue);
   const reference=JSON.parse(readFileSync("docs/operations/chat-admin-media-runtime-reference.json","utf8"));
   assert.equal(reference.sourceSha256,createHash("sha256").update(readFileSync(reference.source)).digest("hex"));
   const catalogue=readFileSync("scripts/operations/chat-admin-media-runtime-catalogue.sql","utf8");
   assert.deepEqual(JSON.parse(sql(catalogue)),reference.catalogue,"native source recreation must match every media policy, predicate, ACL, trigger, column and bucket");
   await runMediaSchemaNativeCases(async query=>sql(query),'initial');
   const verify=mediaCatalogueEqualitySql(reference,catalogue).replace('BEGIN READ ONLY;','').replace(/ROLLBACK;$/, '');
   for(const drift of ["create policy allow_all on public.chat_character_media for select to authenticated using(true);","create policy allow_all_storage on storage.objects for select to authenticated using(true);","alter policy chat_media_read on public.chat_character_media using(true);","grant select on public.chat_character_media to anon;","alter table public.chat_character_media disable trigger chat_media_revision;"]){
    assert.throws(()=>sql(`begin;${drift}${verify}rollback;`),"native activation preflight must refuse broad policy, grant and trigger drift");
   }
  });await concurrentMediaLifecycle();await runMediaCatalogueSqlCases(async query=>sql(query),async()=>{
   await runMediaSchemaNativeCases(async query=>sql(query),'extended');
   await runStorageFinalizationSqlCases(async query=>sql(query));
   await proveCapacityWriterRetentionIndependence(async query=>sql(query),supportCatalogue);
   await proveMediaRetentionIndependence(async query=>sql(query),supportCatalogue);
  });}
 finally{sql(`drop database if exists ${database} with (force);`,"postgres");}
});

import {runMediaPricesSqlCases} from './chat-admin-media-prices-sql.cases.mjs';
test("native PG17 media prices: immutable audit, scoped quote, transactional rollback and retention",{skip:!enabled},async()=>{
 const db="fanmind_media_prices_ci";
 sql(`create database ${db};`,"postgres");
 let supportCatalogue;
 const query=async query=>sql(query,db);
 try{await runMediaPricesSqlCases(query,async()=>{
  supportCatalogue=await installRetentionIndependenceFixture(query);
  await proveMediaRetentionIndependence(query,supportCatalogue);
 },async()=>{
  await proveMediaRetentionIndependence(query,supportCatalogue);
  await query(readFileSync('supabase/controlled/support_ai_consent.sql','utf8'));
  await proveMonthlySqlNative(query,'support_consent');
  await proveMonthlySqlNative(query,'media_prices');
  await proveMonthlyPriceDrift(query);
  await proveMediaRetentionIndependence(query,supportCatalogue);
 });}
 finally{sql(`drop database if exists ${db} with (force);`,"postgres");}
});

import {mediaOwnerMappingSql,assertMediaStoragePresent,MEDIA_ACCEPTANCE_CHARACTER_ID,MEDIA_ACCEPTANCE_MODEL} from '../scripts/operations/chat-admin-media-acceptance-policy.mjs';
import {OPERATOR_USER,OPERATOR_WORKSPACE,OPERATOR_NAME} from '../src/lib/stagingOperatorIdentity.mjs';
test('native PG17 media runner exact Operator binding and Storage negatives',{skip:!enabled},()=>{
 const db='fanmind_media_runner_binding_ci';
 const binding={ids:{MEDIA_CHARACTER_ID:MEDIA_ACCEPTANCE_CHARACTER_ID,STAGING_WORKSPACE_ID:OPERATOR_WORKSPACE,OWNER_ID:OPERATOR_USER},marker:'FM1425-E2E-123-1'};
 const read=query=>sql(query,db).trim();
 sql(`create database ${db};`,'postgres');
 try{
  read(`create schema auth;create schema storage;
   create table auth.users(id uuid primary key);
   create table public.workspaces(id uuid primary key,owner_user_id uuid,name text,test_access_flags jsonb);
   create table public.chat_characters(id uuid primary key,workspace_id uuid,display_name text,status text);
   create table public.workspace_chat_admin_capabilities(workspace_id uuid,granted_to_user_id uuid,chat_admin_multi_character boolean);
   create table public.account_deletion_requests(user_id uuid,status text);
   create table storage.objects(bucket_id text,name text,owner_id text);
   insert into auth.users values('${OPERATOR_USER}');
   insert into public.workspaces values('${OPERATOR_WORKSPACE}','${OPERATOR_USER}','${OPERATOR_NAME}','{"staging_operator_workspace":true}');
   insert into public.chat_characters values('${MEDIA_ACCEPTANCE_CHARACTER_ID}','${OPERATOR_WORKSPACE}','${MEDIA_ACCEPTANCE_MODEL}','active');
   insert into public.workspace_chat_admin_capabilities values('${OPERATOR_WORKSPACE}','${OPERATOR_USER}',true);`);
  const mapping=mediaOwnerMappingSql(binding),foreign='ffffffff-ffff-4fff-8fff-ffffffffffff';
  assert.equal(read(mapping),'1');
  for(const change of [
   'delete from public.chat_characters;',
   `update public.chat_characters set workspace_id='${foreign}';`,
   `update public.chat_characters set id='${foreign}';`,
   `update public.chat_characters set display_name='foreign Model';`,
   `update public.chat_characters set status='inactive';`,
   `update public.workspaces set owner_user_id='${foreign}';`,
   `update public.workspaces set test_access_flags='{"staging_synthetic_fixture":true}';`,
   `update public.workspaces set name='other';`,
   `update public.workspace_chat_admin_capabilities set granted_to_user_id='${foreign}';`,
   'update public.workspace_chat_admin_capabilities set chat_admin_multi_character=false;',
   `insert into public.account_deletion_requests values('${OPERATOR_USER}','processing');`
  ])assert.equal(read(`begin;${change}${mapping};rollback;`).split('\n').filter(x=>/^[01]$/u.test(x)).at(-1),'0',change);
  const asset={id:foreign,workspace_id:OPERATOR_WORKSPACE,character_id:MEDIA_ACCEPTANCE_CHARACTER_ID,original_filename:`${binding.marker}.png`,media_type:'image'};
  const path=`${OPERATOR_WORKSPACE}/${MEDIA_ACCEPTANCE_CHARACTER_ID}/${asset.id}.webp`;
  assert.throws(()=>assertMediaStoragePresent(read,binding,asset),/storage_presence/);
  read(`insert into storage.objects values('chat-character-media','${path}','${OPERATOR_USER}');`);
  assert.doesNotThrow(()=>assertMediaStoragePresent(read,binding,asset));
  for(const change of [
   `update storage.objects set bucket_id='public-bucket';`,
   `update storage.objects set owner_id='${foreign}';`,
   `update storage.objects set name=replace(name,'.webp','.mp4');`,
   `update storage.objects set name=replace(name,'${OPERATOR_WORKSPACE}','${foreign}');`,
   'insert into storage.objects select * from storage.objects;'
  ]){
   const probe=query=>read(`begin;${change}${query};rollback;`).split('\n').filter(x=>/^\d+$/u.test(x)).at(-1);
   assert.throws(()=>assertMediaStoragePresent(probe,binding,asset),/storage_presence/);
  }
 }finally{sql(`drop database if exists ${db} with (force);`,'postgres');}
});
