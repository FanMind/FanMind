import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {SQL_PROOFS,sha256,validateSqlReceipt,verifySqlProvenance,validateAdmission,runRelease} from '../scripts/operations/monthly-release-control.mjs';
import {sqlAdapter,assertMonthlySqlRequest,monthlySqlQueries,collectMonthlySql} from '../scripts/operations/monthly-release-sql-verify.mjs';
const base='a'.repeat(40),candidate='b'.repeat(40),tree='c'.repeat(40);
const adapters=Object.entries(SQL_PROOFS).filter(([,a])=>a.evidenceVersion===2);
function env(id){return {GITHUB_REPOSITORY:'FanMind/FanMind',GITHUB_REF:'refs/heads/main',GITHUB_SHA:candidate,GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR_ID:'270165082',MONTHLY_SQL_ADAPTER:id,MONTHLY_SQL_ACTION:'verify',MONTHLY_SQL_CONFIRMATION:'verify-monthly-sql-only',MONTHLY_SQL_CANDIDATE:candidate,MONTHLY_SQL_BASE:base,MONTHLY_SQL_LIVE:base,MONTHLY_SQL_TREE:tree,MONTHLY_SQL_SHA256:sqlAdapter(id).sqlSha256,FANMIND_RUNTIME_ENVIRONMENT:'production',NEXT_PUBLIC_APP_URL:'https://fanmind.ch',NEXT_PUBLIC_SUPABASE_URL:'https://drqkpdvtbbrrdwmtrodz.supabase.co',FANMIND_BACKUP_DB_HOST:'db.drqkpdvtbbrrdwmtrodz.supabase.co',FANMIND_BACKUP_DB_USER:'postgres',FANMIND_BACKUP_DB_PORT:'5432',FANMIND_BACKUP_DB_NAME:'postgres',FANMIND_BACKUP_PGPASSFILE:'/etc/fanmind-backup/pgpass',FANMIND_ADMIN_EMAILS:'owner@example.test'};}
function exact(id){if(id==='capacity_writer')return [JSON.stringify(JSON.parse(readFileSync('docs/operations/ai-capacity-installed-reference.json')).catalogue)];if(id==='support_consent')return [JSON.stringify(JSON.parse(readFileSync('docs/operations/support-ai-consent-reference.json')).catalogue),JSON.stringify(JSON.parse(readFileSync('docs/operations/support-centre-reference.json')).catalogue),'t'];return id==='media_prices'?['extended','1','1']:id==='media_storage'?['ready']:['extended'];}
function proof(path,adapter){const verifiedAt=new Date(Date.now()-1000).toISOString();return {version:2,target:'production',project:'drqkpdvtbbrrdwmtrodz',candidate,base,live:base,sourceTree:tree,path,sqlSha256:adapter.sqlSha256,action:'verify',state:'EXACT',result:'PASS',runId:1,jobId:2,runAttempt:1,verifiedAt};}
function provenance(path,adapter,r){const item={path,sha256:adapter.sqlSha256,controller:adapter.workflow};const a={source:{base,candidate,tree},sql:[item]};const run={repository:{full_name:'FanMind/FanMind'},head_sha:candidate,path:adapter.workflow,event:'workflow_dispatch',head_branch:'main',actor:{id:270165082},status:'completed',conclusion:'success',run_attempt:1};const job={id:2,name:'Verify one installed SQL state (read only)',conclusion:'success',started_at:new Date(Date.parse(r.verifiedAt)-1000).toISOString(),completed_at:r.verifiedAt,steps:[{name:'Collect exact Production SQL state without writes',conclusion:'success'}]};const values={ADAPTER:adapter.id,PATH:path,SHA256:adapter.sqlSha256,TARGET:'production',PROJECT:r.project,BASE:base,LIVE:r.live,CANDIDATE:candidate,TREE:tree,ACTION:'verify',STATE:'EXACT',RESULT:'verified'};return {item,a,run,job,log:Object.entries(values).map(([k,v])=>`${r.verifiedAt} MONTHLY_SQL_${k}=${v}`).join('\n')};}

test('five SQL adapters bind exact source bytes and only strict installed target states',async()=>{
 assert.equal(adapters.length,5);
 for(const [path,adapter]of adapters){
  assert.equal(sha256(readFileSync(path)),adapter.sqlSha256);
  assertMonthlySqlRequest(env(adapter.id));const checks=monthlySqlQueries(adapter.id),values=exact(adapter.id);
  assert.equal(checks.length,values.length);assert.ok(checks.every((c,i)=>c.accept(values[i])));
  for(const invalid of ['', 'absent','initial','extended_legacy','pending','block','PASS',null]){
   assert.ok(checks.some(c=>{try{return !c.accept(invalid);}catch{return true;}}));
  }
  let reads=0,lives=0,sources=0;
  const deps={assertSource:()=>{sources++;},assertLive:async b=>{assert.equal(b,base);lives++;},readSnapshot:async qs=>{reads++;assert.equal(qs.length,checks.length+(adapter.id==='support_consent'?1:0));return adapter.id==='support_consent'?[...values,'t']:values;}};
  const out=await collectMonthlySql(env(adapter.id),deps);assert.equal(out.STATE,'EXACT');assert.equal(reads,1);assert.equal(lives,2);assert.equal(sources,2);
  for(const bad of [[],values.slice(0,-1),values.map(()=>''),[...values,'extra']])await assert.rejects(collectMonthlySql(env(adapter.id),{...deps,readSnapshot:async()=>bad}));
  await assert.rejects(collectMonthlySql(env(adapter.id),{...deps,assertSource:()=>{throw Error('new_main');}}));
 }
 const capacity=monthlySqlQueries('capacity_writer')[0];assert.equal(capacity.accept('{"relations":[],"functions":[],"triggers":[],"private_schema":null}'),false);
 const consent=monthlySqlQueries('support_consent')[0];assert.equal(consent.accept('{"relations":[],"functions":[]}'),false);
 assert.throws(()=>sqlAdapter(''));assert.throws(()=>sqlAdapter('legacy'));
});

test('read-only requests reject empty, Staging, apply, credentials redirection and unbound new Main',()=>{
 for(const [key,value]of Object.entries({MONTHLY_SQL_ACTION:'apply',MONTHLY_SQL_CONFIRMATION:'',MONTHLY_SQL_CANDIDATE:base,MONTHLY_SQL_BASE:'',MONTHLY_SQL_LIVE:'d'.repeat(40),MONTHLY_SQL_TREE:'',MONTHLY_SQL_SHA256:'',MONTHLY_SQL_ADAPTER:'',GITHUB_ACTOR_ID:'other',GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/feature',GITHUB_REPOSITORY:'other/repo',FANMIND_RUNTIME_ENVIRONMENT:'staging',NEXT_PUBLIC_APP_URL:'https://staging.fanmind.ch',NEXT_PUBLIC_SUPABASE_URL:'https://vshyhvgcmrlagvfnvomc.supabase.co',FANMIND_BACKUP_DB_HOST:'db.vshyhvgcmrlagvfnvomc.supabase.co',FANMIND_BACKUP_DB_USER:'postgres.vshyhvgcmrlagvfnvomc',FANMIND_BACKUP_PGPASSFILE:'',PGOPTIONS:'-c default_transaction_read_only=off',PGHOSTADDR:'127.0.0.1',PGPASSWORD:'test',PGSERVICE:'test'}))assert.throws(()=>assertMonthlySqlRequest({...env('media_storage'),[key]:value}),key);
});

test('actual GitHub verify provenance is required for every SQL; stale, apply, forged and replayed evidence block',async()=>{
 for(const [path,adapter]of adapters){
  const receipt=proof(path,adapter),p=provenance(path,adapter,receipt);
  const verify=async(r=receipt,patch={})=>{const x={...p,...patch};return verifySqlProvenance(x.a,[r],async url=>url.includes('/jobs?')?{total_count:1,jobs:[x.job]}:x.run,async()=>x.log);};
  await verify();
  for(const patch of [{version:1},{state:'ABSENT'},{project:'vshyhvgcmrlagvfnvomc'},{sourceTree:base},{base:candidate},{live:''},{live:'d'.repeat(40)},{live:candidate},{candidate:base},{path:'other.sql'},{sqlSha256:'d'.repeat(64)},{action:'apply'},{result:'SKIP'},{runId:0},{jobId:-1},{runAttempt:0},{verifiedAt:new Date(Date.now()-900001).toISOString()},{verifiedAt:new Date(Date.now()+60000).toISOString()}])await assert.rejects(verify({...receipt,...patch}),JSON.stringify(patch));
  for(const runPatch of [{head_sha:base},{event:'push'},{head_branch:'feature'},{actor:{id:1}},{path:'.github/workflows/ai-capacity-staging-install.yml'},{run_attempt:2},{conclusion:'failure'}])await assert.rejects(verify(receipt,{run:{...p.run,...runPatch}}));
  for(const log of [p.log.replace('ACTION=verify','ACTION=apply'),p.log.replace('STATE=EXACT','STATE=ABSENT'),p.log.replace(candidate,base),p.log.replace('LIVE='+base,'LIVE='+candidate),p.log+'\n'+p.log,p.log.replaceAll(' MONTHLY_SQL_',' echo MONTHLY_SQL_'),p.log.replaceAll(receipt.verifiedAt,new Date(Date.now()-60000).toISOString()),''])await assert.rejects(verify(receipt,{log}));
  await assert.rejects(verify(receipt,{job:{...p.job,steps:[]}}));
  await assert.rejects(verifySqlProvenance(p.a,[],async()=>p.run,async()=>p.log));
 }
});

test('no SQL/legacy omission can turn a required SQL admission into a release',()=>{
 const [path,adapter]=adapters[0],item={path,sha256:adapter.sqlSha256,controller:adapter.workflow};
 const source={base,candidate,tree,changes:[],sql:[item],evidence:{acceptances:[]}};
 const a={version:1,source,target:'production',controller:'.github/workflows/deploy-fanmind.yml',ownerId:'270165082',issuedAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),coverage:[],sql:[]};
 assert.throws(()=>validateAdmission(a,sha256(JSON.stringify(source,null,2)+'\n'),base,candidate),/sql_incomplete/);
 validateSqlReceipt(proof(path,adapter),item,a);
 const workflow=readFileSync('.github/workflows/monthly-release-sql-verify.yml','utf8');
 assert.match(workflow,/environment: production/);assert.match(workflow,/group: fanmind-production-deploy/);assert.match(workflow,/cancel-in-progress: false/);assert.match(workflow,/flock -n 9/);assert.doesNotMatch(workflow,/options:.*apply|MONTHLY_SQL_ACTION=apply|workflow_run:|schedule:/);
 const collector=readFileSync('scripts/operations/monthly-release-sql-verify.mjs','utf8');
 assert.match(collector,/REPEATABLE READ READ ONLY/);assert.match(collector,/default_transaction_read_only=on/);assert.doesNotMatch(collector,/installSql\(|storageGuardTransaction\(|consentInstallSql\(|PGPASSWORD:/);
});

// The Base never changes when the inspected same candidate is already active.
test('fresh SQL proof can resume only the same candidate under an explicit inspected-attempt plan',async()=>{
 for(const [path,adapter]of adapters){
  const receipt={...proof(path,adapter),live:candidate},p=provenance(path,adapter,receipt);
  assert.throws(()=>validateSqlReceipt(receipt,p.item,p.a),/sql_resume_approval_required/);
  p.a.resumeAfterAttempt='12345678-1234-4123-8123-123456789abc';
  validateSqlReceipt(receipt,p.item,p.a);
  await verifySqlProvenance(p.a,[receipt],async url=>url.includes('/jobs?')?{total_count:1,jobs:[p.job]}:p.run,async()=>p.log);
  const e={...env(adapter.id),MONTHLY_SQL_LIVE:candidate};assertMonthlySqlRequest(e);
  const values=exact(adapter.id);
  const result=await collectMonthlySql(e,{assertSource:()=>{},assertLive:async live=>assert.equal(live,candidate),readSnapshot:async()=>adapter.id==='support_consent'?[...values,'t']:values});
  assert.equal(result.BASE,base);assert.equal(result.LIVE,candidate);assert.equal(result.CANDIDATE,candidate);
  assert.throws(()=>assertMonthlySqlRequest({...e,MONTHLY_SQL_LIVE:'d'.repeat(40)}));
 }
});

test('inspected release resume consumes renewed candidate-live SQL evidence without changing the packagebase',async()=>{
 const [path,adapter]=adapters[0],receipt={...proof(path,adapter),live:candidate},p=provenance(path,adapter,receipt);
 const attempt='12345678-1234-4123-8123-123456789abc',packageSha256='a'.repeat(64);
 const previous={attempt,base,candidate,packageSha256,state:'INSPECTION_REQUIRED',updatedAt:new Date(Date.now()-2000).toISOString()};
 p.a.issuedAt=new Date(Date.now()-1000).toISOString();
 let deployments=0;
 const deps={packageHash:packageSha256,save:async()=>{},preflight:async()=>verifySqlProvenance(p.a,[receipt],async url=>url.includes('/jobs?')?{total_count:1,jobs:[p.job]}:p.run,async()=>p.log),deploy:async()=>{deployments++;},tests:async()=>{},closeout:async()=>{}};
 p.a.resumeAfterAttempt='22345678-1234-4123-8123-123456789abc';
 assert.equal((await runRelease(p.a,deps,previous)).failure,'resume_inspection_approval_required');assert.equal(deployments,0);
 p.a.resumeAfterAttempt=attempt;const result=await runRelease(p.a,deps,previous);
 assert.equal(result.state,'COMPLETE');assert.equal(result.base,base);assert.equal(result.candidate,candidate);assert.equal(deployments,1);
});
