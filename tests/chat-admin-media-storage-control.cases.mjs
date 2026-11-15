import {storageFinalizationSource} from '../scripts/operations/chat-admin-media-storage-finalization.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {assertStorageGuardTarget,storageGuardStateSql,storageGuardTransaction} from '../scripts/operations/chat-admin-media-storage-control.mjs';
const target={GITHUB_REPOSITORY:'FanMind/FanMind',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_SHA:'a'.repeat(40),REVIEWED_COMMIT:'a'.repeat(40),STORAGE_GUARD_ACTION:'verify',CONFIRMATION:'staging-media-storage-verify',FANMIND_RUNTIME_ENVIRONMENT:'staging',FANMIND_TARGET_API_ORIGIN:'https://staging.fanmind.ch',FANMIND_TARGET_SUPABASE_PROJECT_REF:'vshyhvgcmrlagvfnvomc',FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:'drqkpdvtbbrrdwmtrodz',NEXT_PUBLIC_SUPABASE_URL:'https://vshyhvgcmrlagvfnvomc.supabase.co',PGHOST:'session.pooler.invalid',FANMIND_TARGET_DB_HOST:'session.pooler.invalid',FANMIND_PRODUCTION_DB_HOST:'db.drqkpdvtbbrrdwmtrodz.supabase.co',PGUSER:'postgres.vshyhvgcmrlagvfnvomc',PGSSLMODE:'verify-full',PGSSLROOTCERT:'private-ca',PGPASSFILE:'private-passfile',FANMIND_ENABLE_NON_PRODUCTION_WRITES:'false',FANMIND_NON_PRODUCTION_WRITE_ACK:''};
test('storage guard requires exact reviewed Main, protected Staging bindings, TLS and explicit write acknowledgement',()=>{
 assert.doesNotThrow(()=>assertStorageGuardTarget(target));
 for(const key of Object.keys(target)){
  assert.throws(()=>assertStorageGuardTarget({...target,[key]:['PGSSLROOTCERT','PGPASSFILE','FANMIND_PRODUCTION_DB_HOST'].includes(key)?'':'wrong'}),/blocked/,key);
 }
 const apply={...target,STORAGE_GUARD_ACTION:'apply',CONFIRMATION:'staging-media-storage-apply',FANMIND_ENABLE_NON_PRODUCTION_WRITES:'true',FANMIND_NON_PRODUCTION_WRITE_ACK:'I_UNDERSTAND_NON_PRODUCTION_ONLY'};
 assert.doesNotThrow(()=>assertStorageGuardTarget(apply));
 assert.throws(()=>assertStorageGuardTarget({...apply,FANMIND_ENABLE_NON_PRODUCTION_WRITES:'false'}));
 assert.throws(()=>assertStorageGuardTarget({...apply,PGHOST:target.FANMIND_PRODUCTION_DB_HOST,FANMIND_TARGET_DB_HOST:target.FANMIND_PRODUCTION_DB_HOST}));
});
test('storage control only accepts exact source-derived before/after catalogues and preserves all grants and RLS',()=>{
 const state=storageGuardStateSql(),transaction=storageGuardTransaction();
 assert.match(state,/integrity_ok IS NOT TRUE/);assert.match(state,/ELSE 'block'/);
 assert.match(transaction,/pg_advisory_xact_lock/);assert.match(transaction,/lock_timeout='5s'/);
 assert.match(transaction,/IF before_state='pending'/);assert.match(transaction,/IS DISTINCT FROM 'ready'/);
 assert.doesNotMatch(storageFinalizationSource().statement,/\b(?:grant|revoke|disable|drop policy|security definer)\b/i);
});
