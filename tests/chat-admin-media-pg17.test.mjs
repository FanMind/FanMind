import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {mediaCatalogueEqualitySql} from "../scripts/operations/staging-support-media-preflight.mjs";
import {runMediaSchemaNativeCases} from './chat-admin-media-schema.cases.mjs';
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
 sql(`create database ${database};`,"postgres");
 try{await runChatAdminMediaSqlCases(async query=>sql(query),async()=>{
   const reference=JSON.parse(readFileSync("docs/operations/chat-admin-media-runtime-reference.json","utf8"));
   assert.equal(reference.sourceSha256,createHash("sha256").update(readFileSync(reference.source)).digest("hex"));
   const catalogue=readFileSync("scripts/operations/chat-admin-media-runtime-catalogue.sql","utf8");
   assert.deepEqual(JSON.parse(sql(catalogue)),reference.catalogue,"native source recreation must match every media policy, predicate, ACL, trigger, column and bucket");
   await runMediaSchemaNativeCases(async query=>sql(query),'initial');
   const verify=mediaCatalogueEqualitySql(reference,catalogue).replace('BEGIN READ ONLY;','').replace(/ROLLBACK;$/, '');
   for(const drift of ["create policy allow_all on public.chat_character_media for select to authenticated using(true);","create policy allow_all_storage on storage.objects for select to authenticated using(true);","alter policy chat_media_read on public.chat_character_media using(true);","grant select on public.chat_character_media to anon;","alter table public.chat_character_media disable trigger chat_media_revision;"]){
    assert.throws(()=>sql(`begin;${drift}${verify}rollback;`),"native activation preflight must refuse broad policy, grant and trigger drift");
   }
  });await concurrentMediaLifecycle();await runMediaCatalogueSqlCases(async query=>sql(query),()=>runMediaSchemaNativeCases(async query=>sql(query),'extended'));}
 finally{sql(`drop database if exists ${database} with (force);`,"postgres");}
});
