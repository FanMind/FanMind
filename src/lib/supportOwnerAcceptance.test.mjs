import test from 'node:test';
import assert from 'node:assert/strict';
import {activationTarget,targetFor,replaceSupportFlag,withActivationRollback} from '../../scripts/operations/support-production-control.mjs';
const main='a'.repeat(40),live='b'.repeat(40),cleanup='c'.repeat(40),email='owner@example.test';
const target={email,commit:main};
const pending={FANMIND_SUPPORT_LIVE_COMMIT:live,FANMIND_SUPPORT_SCHEDULE_ENABLED:'true',FANMIND_SUPPORT_SCHEDULE_SOURCE:cleanup,FANMIND_SUPPORT_SCHEDULE_OWNER:email,FANMIND_SUPPORT_OWNER_ACCEPTANCE_ACK:'I_WILL_PERFORM_THE_PENDING_LIVE_ACCEPTANCE'};
test('Owner live acceptance preserves pending state without fabricating completed assertions',()=>{
 const before=structuredClone(pending);
 assert.equal(activationTarget(target,pending,'activate-for-owner-acceptance').commit,live);
 assert.deepEqual(pending,before);
 assert.equal(pending.FANMIND_SUPPORT_PRIVACY_READY,undefined);
 assert.equal(pending.FANMIND_SUPPORT_ACCEPTANCE_COMMIT,undefined);
 for(const [key,value] of [['FANMIND_SUPPORT_LIVE_COMMIT','main'],['FANMIND_SUPPORT_SCHEDULE_SOURCE',''],['FANMIND_SUPPORT_SCHEDULE_ENABLED','false'],['FANMIND_SUPPORT_SCHEDULE_OWNER','foreign@example.test'],['FANMIND_SUPPORT_OWNER_ACCEPTANCE_ACK','true']]){
  assert.throws(()=>activationTarget(target,{...pending,[key]:value},'activate-for-owner-acceptance'));
 }
});
test('normal activation still requires privacy and exact accepted release',()=>{
 assert.throws(()=>activationTarget(target,pending),/operational_readiness_missing/);
 const accepted={...pending,FANMIND_SUPPORT_PRIVACY_READY:'true',FANMIND_SUPPORT_SCHEDULE_SOURCE:main,FANMIND_SUPPORT_ACCEPTANCE_COMMIT:main};
 assert.equal(activationTarget(target,accepted).commit,main);
 assert.throws(()=>activationTarget(target,{...accepted,FANMIND_SUPPORT_ACCEPTANCE_COMMIT:live}),/runtime_acceptance_required/);
});
test('both new actions retain manual Owner exact-source target binding; schedules cannot activate',()=>{
 const env={GITHUB_REPOSITORY:'FanMind/FanMind',GITHUB_REF:'refs/heads/main',GITHUB_SHA:main,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR_ID:'270165082',FANMIND_SUPPORT_REVIEWED_COMMIT:main,FANMIND_RUNTIME_ENVIRONMENT:'production',NEXT_PUBLIC_SUPABASE_URL:'https://drqkpdvtbbrrdwmtrodz.supabase.co',NEXT_PUBLIC_APP_URL:'https://fanmind.ch',FANMIND_BACKUP_DB_HOST:'db.drqkpdvtbbrrdwmtrodz.supabase.co',FANMIND_BACKUP_DB_USER:'postgres',FANMIND_BACKUP_DB_NAME:'postgres',FANMIND_BACKUP_PGPASSFILE:'/etc/fanmind-backup/pgpass',FANMIND_ADMIN_EMAILS:email};
 for(const action of ['activate-for-owner-acceptance','deactivate']){
  const e={...env,FANMIND_SUPPORT_CONFIRM:'support-production-'+action};
  assert.equal(targetFor(e,action,email).commit,main);
  for(const bad of [{GITHUB_ACTOR_ID:'1'},{GITHUB_EVENT_NAME:'schedule',FANMIND_SUPPORT_SCHEDULE_ENABLED:'true'},{GITHUB_REF:'refs/heads/feature'},{FANMIND_SUPPORT_REVIEWED_COMMIT:live},{FANMIND_SUPPORT_CONFIRM:'support-production-activate'},{FANMIND_ADMIN_EMAILS:'foreign@example.test'},{PGOPTIONS:'unsafe'}])assert.throws(()=>targetFor({...e,...bad},action,email));
 }
});
test('deactivation stays available without cleanup/privacy readiness and changes only Support boolean',()=>{
 assert.equal(activationTarget(target,{FANMIND_SUPPORT_LIVE_COMMIT:live},'deactivate').commit,live);
 const before='OTHER_FLAG=true\nFANMIND_SUPPORT_CENTRE_ENABLED=true\n';
 assert.equal(replaceSupportFlag(before,false),'OTHER_FLAG=true\nFANMIND_SUPPORT_CENTRE_ENABLED=false\n');
 let restored=0;
 assert.throws(()=>withActivationRollback(()=>{},()=>{throw Error('health');},()=>{restored++;}),/activation_failed_rolled_back/);
 assert.equal(restored,1);
 assert.throws(()=>withActivationRollback(()=>{throw Error('reload');},()=>{},()=>{throw Error('restore');}),/activation_rollback_failed/);
});
