import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {monthlySqlQueries} from '../scripts/operations/monthly-release-sql-verify.mjs';
// Called only inside existing disposable native-PG17 specialist fixtures.
export async function proveMonthlySqlNative(sql,id){
 for(const [index,check]of monthlySqlQueries(id).entries()){
  const result=(await sql(`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SET LOCAL search_path=pg_catalog,public;${check.query.trim().replace(/;$/u,'')};ROLLBACK;`)).trim().split('\n').filter(row=>! /^(?:BEGIN|SET|ROLLBACK|MONTHLY_MUTATION_APPLIED|ALTER TABLE|CREATE (?:TYPE|FUNCTION|VIEW|INDEX)|DROP FUNCTION|GRANT|REVOKE)$/u.test(row)).join('\n');
  assert.equal(check.accept(result),true,`${id}[${index}]: exact source-recreated schema must verify (${result.slice(0,80)})`);
 }
}
export async function proveMonthlyPriceDrift(sql){
 const checks=monthlySqlQueries('media_prices').slice(1);
 const writeFunction=readFileSync('supabase/controlled/chat_admin_media_prices.sql','utf8').match(/create function public\.chat_admin_price_write[^]*?end \$\$;/u)[0];
 const mutations=[
  "drop function public.chat_admin_price_write(uuid,uuid,integer,jsonb);"+writeFunction.replace('returns boolean','returns text')+"revoke all on function public.chat_admin_price_write(uuid,uuid,integer,jsonb) from public,anon,service_role;grant execute on function public.chat_admin_price_write(uuid,uuid,integer,jsonb) to authenticated;",
  'grant select(binding) on fanmind_media_price_evidence.offers to anon;',
  "create type fanmind_media_price_evidence.extra as enum ('synthetic');",
  'alter table fanmind_media_price_evidence.offers alter column binding drop not null;',
  'alter table fanmind_media_price_evidence.offers alter column binding type text using binding::text;',
  'create function fanmind_media_price_evidence.unreviewed() returns int language sql as $$select 1$$;',
  'create view fanmind_media_price_evidence.extra as select 1;',
  'grant execute on function public.chat_admin_price_write(uuid,uuid,integer,jsonb) to authenticated with grant option;',
  'alter table fanmind_media_price_evidence.offers add column extra text;',
  'create index unexpected_price_idx on fanmind_media_price_evidence.offers(fan_id);',
 ];
 for(const mutation of mutations){
  let rejected=false;
  for(const check of checks){
   try{const result=(await sql(`BEGIN;${mutation}SELECT 'MONTHLY_MUTATION_APPLIED';SET LOCAL search_path=pg_catalog,public;${check.query.trim().replace(/;$/u,'')};ROLLBACK;`)).trim().split('\n').filter(row=>! /^(?:BEGIN|SET|ROLLBACK|MONTHLY_MUTATION_APPLIED|ALTER TABLE|CREATE (?:TYPE|FUNCTION|VIEW|INDEX)|DROP FUNCTION|GRANT|REVOKE)$/u.test(row)).join('\n');if(!check.accept(result))rejected=true;}
   catch(error){assert.match(error.stdout?.toString()??'',/MONTHLY_MUTATION_APPLIED/u,'the intended mutation must execute before the verifier rejects');rejected=true;}
  }
  assert.equal(rejected,true,mutation);
 }
 await proveMonthlySqlNative(sql,'media_prices');
}
