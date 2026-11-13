import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SUPPORT_SQL_PATHS,catalogueSql} from '../scripts/operations/support-centre-schema.mjs';

// Runs only in the disposable source-recreated media database. The source and
// full Support catalogue are compared before/after the actual media extension.
export async function installRetentionIndependenceFixture(sql){
 for(const path of SUPPORT_SQL_PATHS)await sql(readFileSync(path,'utf8'));
 return (await sql(catalogueSql())).trim();
}
export async function proveMediaRetentionIndependence(sql,expectedCatalogue){
 assert.equal((await sql(catalogueSql())).trim(),expectedCatalogue,'media SQL must preserve all Support bodies, ACLs, policies, triggers and relations');
 const output=await sql(`BEGIN;
 INSERT INTO public.support_chat_threads(id,workspace_id,user_id,updated_at) VALUES
 ('10000000-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111',clock_timestamp()),
 ('10000000-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222',clock_timestamp()-interval '40 days');
 INSERT INTO public.support_chat_turns(thread_id,workspace_id,user_id,request_id,question,answer,context,unanswered,created_at)
 SELECT id,workspace_id,user_id,gen_random_uuid(),'Synthetic retention question','Synthetic retention answer','support',false,clock_timestamp()-interval '40 days' FROM public.support_chat_threads;
 INSERT INTO public.support_chat_turns(thread_id,workspace_id,user_id,request_id,question,answer,context,unanswered)
 SELECT id,workspace_id,user_id,gen_random_uuid(),'Recent synthetic question','Recent synthetic answer','support',false FROM public.support_chat_threads WHERE id='10000000-0000-4000-8000-000000000001';
 SELECT jsonb_build_object('result',public.run_support_retention('10000000-0000-4000-8000-000000000003','${'a'.repeat(40)}',false)->'counts');
 SELECT jsonb_build_object('threads',(SELECT count(*) FROM public.support_chat_threads),'turns',(SELECT count(*) FROM public.support_chat_turns));
 ROLLBACK;`);
 const rows=output.trim().split('\n').filter(x=>x.startsWith('{')).map(x=>JSON.parse(x));
 assert.deepEqual(rows,[{result:{turns:2,threads:1,notifications:0,cases:0,case_events:0}},{threads:1,turns:1}]);
 assert.equal((await sql('SELECT count(*) FROM public.support_chat_threads;')).trim(),'0');
 assert.equal((await sql('SELECT count(*) FROM public.support_retention_runs;')).trim(),'0');
}
