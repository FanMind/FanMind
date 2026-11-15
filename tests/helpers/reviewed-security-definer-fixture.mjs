// Synthetic catalog fixture only. Never connects to a target itself.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {REVIEWED_SECURITY_DEFINER_PROFILE} from '../../scripts/operations/database-authorization-contract.mjs';

function splitExpressions(source) {
  const result=[];let start=0,depth=0,quoted=false;
  for(let i=0;i<source.length;i++) {
    const char=source[i];
    if(char==="'") {if(quoted&&source[i+1]==="'"){i++;continue;}quoted=!quoted;}
    else if(!quoted) {if(char==='(')depth++;else if(char===')')depth--;else if(char===','&&depth===0){result.push(source.slice(start,i));start=i+1;}}
  }
  result.push(source.slice(start));return result;
}

export function reviewedBodyHashes(name,body) {
  const variants=[body];
  if(name==='create_chat_admin_fan') {
    const match=/insert into public.chat_character_fans\(([^\n]+)\)\n  values\(([^\n]+)\)\n  returning/.exec(body);
    assert.ok(match,'reviewed customer-tier INSERT missing');
    const columns=splitExpressions(match[1]),values=splitExpressions(match[2]);
    assert.equal(columns.length,11);assert.equal(values.length,11);
    assert.deepEqual(columns.slice(8),['customer_tier','summary','notes']);
    const order=[0,1,2,3,4,5,6,7,9,10,8];
    const replacement=body.slice(0,match.index)+match[0].replace(match[1],order.map(i=>columns[i]).join(',')).replace(match[2],order.map(i=>values[i]).join(','))+body.slice(match.index+match[0].length);
    variants.push(replacement);
  }
  return [...new Set(variants.flatMap(value=>[value,value.replaceAll('\n','\r\n')]).map(value=>createHash('sha256').update(value).digest('hex')))].sort();
}

export async function reviewedDefinitions() {
  const definitions=[];
  for (const expected of REVIEWED_SECURITY_DEFINER_PROFILE) {
    const source=await readFile(new URL(`../../${expected.source}`,import.meta.url),'utf8');
    const pattern=new RegExp(String.raw`\bcreate\s+(?:or\s+replace\s+)?function\s+(?:public\.)?${expected.name}\s*\(.*?\bas\s+(\$[A-Za-z_0-9]*\$)([\s\S]*?)\1`,'is');
    const match=pattern.exec(source);
    assert.ok(match,`reviewed source missing: ${expected.name}`);
    const hash=createHash('sha256').update(match[2]).digest('hex');
    assert.ok(expected.body_sha256.includes(hash),`reviewed body drift: ${expected.name}`);
    assert.deepEqual([...expected.body_sha256],reviewedBodyHashes(expected.name,match[2]),`unreviewed body variant: ${expected.name}`);
    definitions.push({expected,definition:`${match[0]};`,body:match[2]});
  }
  return definitions;
}

export async function reviewedFixtureSql() {
  const definitions=await reviewedDefinitions();
  const statements=[
    // The existing CI legacy/current proofs have completed before this fixture.
    // No function is executed: referenced production tables are NOT customer fixtures.
    'set check_function_bodies=off;',
    `do $fixture$ declare f record; begin
       for f in select p.oid::regprocedure as signature from pg_proc p
         join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='public' and p.prosecdef
       loop execute 'drop function '||f.signature||' cascade'; end loop;
     end $fixture$;`,
    'create table public.admin_operation_jobs(job_type text,status text);',
  ];
  for (const {expected,definition} of definitions) {
    const types=expected.identity_arguments.split(', ').map(argument=>argument.slice(argument.indexOf(' ')+1)).join(',');
    const signature=`public.${expected.name}(${types})`;
    statements.push(definition);
    // The reviewed optional trigger hardening is a separate authoritative ALTER.
    if(expected.name==='trim_conversation_messages_to_latest_50') statements.push(`alter function ${signature} set search_path=pg_catalog,pg_temp;`);
    statements.push(`revoke all privileges on function ${signature} from public,anon,authenticated,service_role;`);
    const grantees=expected.executors.filter(name=>name!=='postgres');
    if(grantees.length)statements.push(`grant execute on function ${signature} to ${grantees.join(',')};`);
  }
  statements.push('set check_function_bodies=on;');
  return statements.join('\n');
}
