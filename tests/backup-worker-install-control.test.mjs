import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { WORKER_COMMIT, APP_COMMIT, FILES, OWNER_ID, ENVIRONMENT, PROJECT,
  request, authorization, connection, parseSelectedEnvironment, environmentPolicy, transition } from '../scripts/operations/backup-worker-install-policy.mjs';
const controller = 'a'.repeat(40);
const input = request('install',controller,WORKER_COMMIT,APP_COMMIT);
function auth() { return {schemaVersion:1,repository:'FanMind/FanMind',environment:ENVIRONMENT,project:PROJECT,
  controllerCommit:controller,workerCommit:WORKER_COMMIT,applicationCommit:APP_COMMIT,adminBypassDisabled:true,
  reviewerId:OWNER_ID,actions:['verify','install','rollback'],approvedAt:'2026-10-13T19:00:00Z',expiresAt:'2026-10-13T20:00:00Z',
  controllerHashes:Object.fromEntries(['backup-worker-install-control.mjs','backup-worker-install-policy.mjs','fanmind-backup-worker-control'].map(k=>[k,'b'.repeat(64)])),unitHash:'e'.repeat(64),previousHashes:FILES}; }
test('approval binds exact action, controller, worker, application, target and expiry',()=>{
  assert.equal(authorization(auth(),input,Date.parse('2026-10-13T19:30:00Z')).applicationCommit,APP_COMMIT);
  for (const change of [{actions:['verify']},{adminBypassDisabled:false},{project:'vshyhvgcmrlagvfnvomc'},
    {reviewerId:1},{workerCommit:controller},{controllerCommit:WORKER_COMMIT},{previousHashes:{}},{controllerHashes:{a:'b'.repeat(64),b:'c'.repeat(64),c:'d'.repeat(64)}},{unitHash:'x'},
    {approvedAt:'2026-10-13T19:31:00Z'},{expiresAt:'2026-10-13T19:29:00Z'},
    {expiresAt:'2026-10-15T20:00:00Z'}]) assert.throws(()=>authorization({...auth(),...change},input,Date.parse('2026-10-13T19:30:00Z')));
  assert.throws(()=>request('enqueue',controller,WORKER_COMMIT,APP_COMMIT));
  assert.throws(()=>request('install',controller,controller,APP_COMMIT));
  assert.throws(()=>request('install',controller,WORKER_COMMIT,controller));
});
test('environment requires pre-existing numeric User reviewer, main-only policy and no observed bypass',()=>{
  const e = {name:ENVIRONMENT,protection_rules:[{type:'required_reviewers',reviewers:[{type:'User',reviewer:{id:OWNER_ID}}]}],
    deployment_branch_policy:{custom_branch_policies:true,protected_branches:false},can_admins_bypass:false};
  const b = {total_count:1,branch_policies:[{name:'main',type:'branch'}]};
  environmentPolicy(e,b);
  for(const bad of [{...e,protection_rules:[]},{...e,can_admins_bypass:true},
    {...e,protection_rules:[{type:'required_reviewers',reviewers:[{type:'Team',reviewer:{id:OWNER_ID}}]}]}]) assert.throws(()=>environmentPolicy(bad,b));
  assert.throws(()=>environmentPolicy(e,{total_count:2,branch_policies:[{name:'main',type:'branch'},{name:'*',type:'branch'}]}));
});
test('connection rejects hidden libpq routing and mismatched Supabase identity',()=>{
  const c = {NEXT_PUBLIC_SUPABASE_URL:`https://${PROJECT}.supabase.co`,FANMIND_BACKUP_DB_HOST:`db.${PROJECT}.supabase.co`,
    FANMIND_BACKUP_DB_USER:'postgres',FANMIND_BACKUP_DB_NAME:'postgres',FANMIND_BACKUP_PGPASSFILE:'/etc/fanmind-backup/pgpass',
    FANMIND_BACKUP_DB_CA_CERT_PATH:'/usr/local/lib/fanmind-ops/supabase-root-2021-ca.crt'};
  assert.equal(connection(c).host,c.FANMIND_BACKUP_DB_HOST);
  for(const change of [{FANMIND_BACKUP_DB_HOST:'localhost'},{FANMIND_BACKUP_DB_PORT:'6543'},
    {NEXT_PUBLIC_SUPABASE_URL:'https://vshyhvgcmrlagvfnvomc.supabase.co'},
    {FANMIND_BACKUP_DB_HOST:'aws-0-eu-west-3.pooler.supabase.com',FANMIND_BACKUP_DB_USER:'postgres.foreign'},
    {FANMIND_BACKUP_PGPASSFILE:'relative'}]) assert.throws(()=>connection({...c,...change}));
  assert.deepEqual(parseSelectedEnvironment('OTHER_SECRET=ignored\nFANMIND_BACKUP_DB_HOST="example"').FANMIND_BACKUP_DB_HOST,'example');
  assert.throws(()=>parseSelectedEnvironment('FANMIND_BACKUP_DB_HOST=$(malicious)'));
  assert.throws(()=>parseSelectedEnvironment('FANMIND_BACKUP_DB_HOST=x\nFANMIND_BACKUP_DB_HOST=y'));
});
function fake(state=null,failAt=null) {
  const calls=[];let current=state;let failed=false;
  const io = {calls,authorize:async()=>{},preflight:async()=>calls.push('preflight'),state:async()=>current,
    persist:async status=>{calls.push(status);current={status};},
    snapshot:async()=>{calls.push('snapshot');current={status:'PREPARED'};},
    checkFiles:async v=>calls.push(`check:${v}`),checkSaved:async()=>calls.push('saved'),
    checkKnownFiles:async()=>calls.push('known'),stop:async()=>calls.push('stop'),start:async()=>calls.push('start'),
    queueEmpty:async()=>{calls.push('queue');if(failAt==='queue')throw Error();},
    replace:async v=>{calls.push(`replace:${v}`);if(v==='new'&&failAt==='replace'&&!failed){failed=true;throw Error();}},
    postflight:async()=>{calls.push('postflight');if(failAt==='postflight'&&!failed){failed=true;throw Error();}}};return io;
}
test('read-only verify never snapshots, stops, replaces or persists',async()=>{
  const io=fake(); assert.equal(await transition({...input,action:'verify'},io),'VERIFIED');
  assert.deepEqual(io.calls,['preflight','check:old']);
});
test('installation persists recovery binding before replacing files; successful rerun is no-op',async()=>{
  const io=fake(); assert.equal(await transition(input,io),'INSTALLED');
  assert.ok(io.calls.indexOf('snapshot')<io.calls.indexOf('stop'));
  assert.ok(io.calls.indexOf('APPLYING')<io.calls.indexOf('replace:new'));
  assert.equal(await transition(input,fake({status:'INSTALLED'})),'ALREADY_INSTALLED');
});
test('interruption receipts cannot trigger blind installation retries',async()=>{
  for(const status of ['PREPARED','APPLYING','RECONCILIATION_REQUIRED','ROLLED_BACK']) {
    const io=fake({status});await assert.rejects(transition(input,io),/receipt_already_exists/);
    assert.deepEqual(io.calls,['preflight']);
  }
});
test('timer race blocks file mutation and automatic resume',async()=>{
  const io=fake(null,'queue');await assert.rejects(transition(input,io));
  assert.equal(io.calls.includes('replace:new'),false);assert.equal(io.calls.includes('start'),false);
});
test('partial copy and postflight failure restore only exact saved program bytes',async()=>{
  for(const failure of ['replace','postflight']){
    const io=fake(null,failure);await assert.rejects(transition(input,io),/installation_failed_rolled_back/);
    assert.ok(io.calls.includes('RECONCILIATION_REQUIRED'));assert.ok(io.calls.includes('replace:old'));
    assert.equal(io.calls.at(-1),'ROLLED_BACK');
  }
});
test('rollback of interrupted state requires saved and known current hashes first',async()=>{
  const io=fake({status:'APPLYING'});assert.equal(await transition({...input,action:'rollback'},io),'ROLLED_BACK');
  assert.ok(io.calls.indexOf('saved')<io.calls.indexOf('stop'));assert.ok(io.calls.indexOf('known')<io.calls.indexOf('replace:old'));
  await assert.rejects(transition({...input,action:'rollback'},fake()),/rollback_receipt_missing/);
});
test('privileged path is preinstalled, keeps release.env untouched and never enqueues or migrates',async()=>{
  const root=await readFile('scripts/operations/backup-worker-install-control.mjs','utf8');
  const workflow=await readFile('.github/workflows/backup-worker-production-control.yml','utf8');
  assert.match(root,/O_NOFOLLOW/);assert.match(root,/fd\.sync\(\)/);
  assert.doesNotMatch(root,/atomic\(RELEASE|grant execute|supabase db push|enqueue-backup/);
  assert.doesNotMatch(workflow,/sudo.*install|pm2|daemon-reload/);
  assert.match(workflow,/needs: validate-protection/);assert.match(workflow,/environment: backup-production-recovery/);
  assert.match(workflow,/fanmind-production-deploy/);assert.match(workflow,/ACTION_APPROVAL/);
});

test('expiry is rechecked before mutation; approved recovery remains possible after expiry',async()=>{
  const before=fake(); before.authorize=async()=>{throw Error('expired');};
  await assert.rejects(transition(input,before));
  assert.ok(!before.calls.includes('snapshot')&&!before.calls.includes('stop'));
  const during=fake();let n=0;during.authorize=async()=>{if(++n===3)throw Error('expired');};
  await assert.rejects(transition(input,during),{code:'installation_failed_rolled_back'});
  assert.ok(!during.calls.includes('replace:new'));assert.ok(during.calls.includes('replace:old'));
});
