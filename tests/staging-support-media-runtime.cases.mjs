import test from 'node:test';
import assert from 'node:assert/strict';
import {assertStagingRuntimeTarget,renderStagingRuntimeFlags,changeStagingRuntime} from '../scripts/operations/staging-support-media-runtime.mjs';
const env={GITHUB_REPOSITORY:'FanMind/FanMind',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_SHA:'a'.repeat(40),REVIEWED_COMMIT:'a'.repeat(40),CONFIRMATION:'staging-support-media-activate',FANMIND_RUNTIME_ENVIRONMENT:'staging',NEXT_PUBLIC_APP_URL:'https://staging.fanmind.ch',NEXT_PUBLIC_SUPABASE_URL:'https://vshyhvgcmrlagvfnvomc.supabase.co',FANMIND_TARGET_SUPABASE_PROJECT_REF:'vshyhvgcmrlagvfnvomc',FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:'drqkpdvtbbrrdwmtrodz',FANMIND_CHAT_ADMIN_MEDIA_ANALYSIS_ENABLED:'false',FANMIND_OPERATIONS_EMAIL_ENABLED:'false',FANMIND_SERVER_ERROR_EMAIL_ENABLED:'false',FANMIND_ENABLE_TELEGRAM_SEND:'false',SUPPORT_OWNER_UUID:'5995a803-2ae2-46fa-8e4d-b030bf71da3c',GITHUB_RUN_ID:'12345',SUPPORT_SCHEMA_VERIFIED:'true',SUPPORT_RETENTION_VERIFIED:'true'};
test('runtime rejects Production, branch source, absent schema proof and external delivery',()=>{
 assert.doesNotThrow(()=>assertStagingRuntimeTarget(env,'activate'));
 for(const patch of [{NEXT_PUBLIC_APP_URL:'https://fanmind.ch'},{NEXT_PUBLIC_SUPABASE_URL:'https://drqkpdvtbbrrdwmtrodz.supabase.co'},{FANMIND_TARGET_SUPABASE_PROJECT_REF:'drqkpdvtbbrrdwmtrodz'},{GITHUB_REF:'refs/heads/feature'},{GITHUB_EVENT_NAME:'pull_request'},{REVIEWED_COMMIT:'b'.repeat(40)},{SUPPORT_SCHEMA_VERIFIED:'false'},{SUPPORT_RETENTION_VERIFIED:'false'},{FANMIND_CHAT_ADMIN_MEDIA_ANALYSIS_ENABLED:'true'},{FANMIND_OPERATIONS_EMAIL_ENABLED:'true'},{FANMIND_ENABLE_TELEGRAM_SEND:'true'}])assert.throws(()=>assertStagingRuntimeTarget({...env,...patch},'activate'));
});
test('only the two authorized flags change; analysis stays false and unrelated bytes survive',()=>{
 const before='OTHER=unchanged\nFANMIND_SUPPORT_CENTRE_ENABLED=false\nFANMIND_CHAT_ADMIN_MEDIA_ENABLED=false\nFANMIND_CHAT_ADMIN_MEDIA_ANALYSIS_ENABLED=false\n';
 const enabled=renderStagingRuntimeFlags(before,['BILLING=false\n','SECRET=private\n'],true);
 assert.equal(enabled,before.replace('FANMIND_SUPPORT_CENTRE_ENABLED=false','FANMIND_SUPPORT_CENTRE_ENABLED=true').replace('FANMIND_CHAT_ADMIN_MEDIA_ENABLED=false','FANMIND_CHAT_ADMIN_MEDIA_ENABLED=true'));
 assert.equal(renderStagingRuntimeFlags(enabled,[],false),before);
 for(const override of ['FANMIND_SUPPORT_CENTRE_ENABLED=false','export FANMIND_CHAT_ADMIN_MEDIA_ENABLED=false','FANMIND_CHAT_ADMIN_MEDIA_ANALYSIS_ENABLED=true'])assert.throws(()=>renderStagingRuntimeFlags(before,[override],true));
 for(const unsafe of [before+'FANMIND_SUPPORT_CENTRE_ENABLED=false\n',before.replace('ENABLED=false','ENABLED=$(private)')])assert.throws(()=>renderStagingRuntimeFlags(unsafe,[],true));
});
test('postflight failure restores exact prior configuration and restarts; concurrent changes are retained',async()=>{
 let state='before',restarts=0;
 await assert.rejects(changeStagingRuntime({before:'before',after:'after',write:s=>{state=s;},read:()=>state,restart:()=>{restarts++;},verifyRollback:async()=>{assert.equal(state,'before');},verify:async()=>{throw Error('private');}}),/activation_failed_rolled_back/);
 assert.equal(state,'before');assert.equal(restarts,2);
 state='before';restarts=0;
 await assert.rejects(changeStagingRuntime({before:'before',after:'after',write:s=>{state=s;},read:()=>state,restart:()=>{restarts++;},verify:async()=>{state='concurrent';throw Error('private');}}),/rollback_configuration_changed/);
 assert.equal(state,'concurrent');assert.equal(restarts,1);
});
test('rollback failure never reports restored state; deactivation failure never re-enables flags',async()=>{
 let state='before';
 await assert.rejects(changeStagingRuntime({before:'before',after:'after',write:s=>{state=s;},read:()=>state,restart:()=>{},verify:async()=>{throw Error('failure');},verifyRollback:async()=>{throw Error('not restored');}}),/rollback_failed/);
 await assert.rejects(changeStagingRuntime({before:'enabled',after:'disabled',write:s=>{state=s;},read:()=>state,restart:()=>{},restoreOnFailure:false,verify:async()=>{throw Error('offline');},verifyRollback:async()=>{throw Error('must not run');}}),/deactivation_failed_reconciliation_required/);
 assert.equal(state,'disabled');
});
test('media preflight is source-bound, read-only and checks private storage and existing owner',async()=>{
 const {mediaRuntimePreflightSql}=await import('../scripts/operations/staging-support-media-preflight.mjs');
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../supabase/controlled/chat_admin_media.sql',import.meta.url),'utf8');
 const sql=mediaRuntimePreflightSql(source,env.GITHUB_SHA,env.SUPPORT_OWNER_UUID);
 assert.match(sql,/BEGIN READ ONLY/);assert.match(sql,/ROLLBACK/);assert.match(sql,/NOT public/);assert.match(sql,/support_centre_owners/);assert.match(sql,/source_commit=/);assert.match(sql,/md5\(p.prosrc\)/);
 assert.doesNotMatch(sql,/\b(?:insert|update|delete|alter|create|grant|truncate)\s+(?:into|table|function|on)\b/i);
 assert.throws(()=>mediaRuntimePreflightSql(source,"'; private",env.SUPPORT_OWNER_UUID));
 assert.throws(()=>mediaRuntimePreflightSql('',env.GITHUB_SHA,env.SUPPORT_OWNER_UUID));
});

test('support-only actions retain target gates and leave every media byte unchanged',()=>{
 for(const action of ['verify-support','activate-support','deactivate-support']){
  const scoped={...env,CONFIRMATION:`staging-support-media-${action}`};
  assert.doesNotThrow(()=>assertStagingRuntimeTarget(scoped,action));
  assert.throws(()=>assertStagingRuntimeTarget({...scoped,NEXT_PUBLIC_APP_URL:'https://fanmind.ch'},action));
  if(action==='activate-support')assert.throws(()=>assertStagingRuntimeTarget({...scoped,SUPPORT_RETENTION_VERIFIED:'false'},action));
 }
 const before='OTHER=unchanged\nFANMIND_SUPPORT_CENTRE_ENABLED=false\nFANMIND_CHAT_ADMIN_MEDIA_ENABLED=false\nFANMIND_CHAT_ADMIN_MEDIA_ANALYSIS_ENABLED=false\n';
 assert.equal(renderStagingRuntimeFlags(before,[],true,true),before.replace('FANMIND_SUPPORT_CENTRE_ENABLED=false','FANMIND_SUPPORT_CENTRE_ENABLED=true'));
 const withMedia=before.replace('FANMIND_CHAT_ADMIN_MEDIA_ENABLED=false','FANMIND_CHAT_ADMIN_MEDIA_ENABLED=true');
 assert.equal(renderStagingRuntimeFlags(withMedia,[],true,true),withMedia.replace('FANMIND_SUPPORT_CENTRE_ENABLED=false','FANMIND_SUPPORT_CENTRE_ENABLED=true'));
 assert.throws(()=>renderStagingRuntimeFlags(before,['FANMIND_SUPPORT_CENTRE_ENABLED=false'],true,true));
});
