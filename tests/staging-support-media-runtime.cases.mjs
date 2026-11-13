import test from 'node:test';
import assert from 'node:assert/strict';
import {assertStagingRuntimeTarget,renderStagingRuntimeFlags,changeStagingRuntime,waitForStagingRelease,supportRuntimeCapabilities,renderStagingWidgetSecret,renderStagingDiagnostics} from '../scripts/operations/staging-support-media-runtime.mjs';
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

test('service startup waits for reachability but never accepts wrong source or endless startup',async()=>{
 let clock=0,calls=0;const timing={now:()=>clock,pause:async ms=>{clock+=ms;},timeoutMs:1500};
 await waitForStagingRelease(async()=>{if(++calls<3)throw Error('target_read_failed');},timing);
 assert.equal(calls,3);assert.equal(clock,1500);
 calls=0;await assert.rejects(waitForStagingRelease(async()=>{calls++;throw Error('live_release_mismatch');},timing),/live_release_mismatch/);assert.equal(calls,1);
 await assert.rejects(waitForStagingRelease(async()=>{throw Error('target_read_failed');},timing),/service_startup_timeout/);
 await assert.rejects(waitForStagingRelease(async()=>{throw Error('configuration_changed');},timing),/configuration_changed/);
});

test('daily retention proof reuse requires an ancestor with unchanged executable contract',async()=>{
 const {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');const {join,dirname}=await import('node:path');const {execFileSync}=await import('node:child_process');
 const {RETENTION_PROOF_PATHS,assertRetentionSourceEquivalent}=await import('../scripts/operations/staging-support-media-preflight.mjs');
 const root=mkdtempSync(join(tmpdir(),'fanmind-retention-proof-'));
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const write=(path,value)=>{mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),value);};
 try{
  git('init','-q');git('config','user.name','Synthetic QA');git('config','user.email','qa@example.test');
  for(const path of RETENTION_PROOF_PATHS)write(['supabase/controlled','src/lib'].includes(path)?path+'/contract.probe':path,'retention-v1');
  for(const path of ['supabase/controlled/support_centre.sql','supabase/controlled/support_centre_operations.sql','supabase/controlled/20260904170000_website_chat_retention.sql'])write(path,'retention-sql-v1');
  write('package.json',JSON.stringify({type:'module',dependencies:{},scripts:{}}));
  git('add','.');git('commit','-qm','approved retention contract');const source=git('rev-parse','HEAD');
  const media='supabase/controlled/chat_admin_media_catalogue.sql';
  write(media,readFileSync(new URL('../supabase/controlled/chat_admin_media_catalogue.sql',import.meta.url),'utf8'));
  write('src/components/synthetic-ui.ts','presentation only');write('package.json',JSON.stringify({type:'module',dependencies:{},scripts:{'test:unrelated':'node unrelated-test.mjs'}}));git('add','.');git('commit','-qm','independent pinned media addition, presentation and npm test script');const current=git('rev-parse','HEAD');
  assert.doesNotThrow(()=>assertRetentionSourceEquivalent(source,current,root));
  assert.throws(()=>assertRetentionSourceEquivalent('not-a-sha',current,root));
  for(const path of [...RETENTION_PROOF_PATHS.filter(p=>p!=='supabase/controlled'),'supabase/controlled/contract.probe','supabase/controlled/support_centre.sql','supabase/controlled/support_centre_operations.sql','supabase/controlled/20260904170000_website_chat_retention.sql',media]){
   git('reset','--hard',current);write(path,'changed retention contract');git('add','.');git('commit','-qm','contract drift');
   assert.throws(()=>assertRetentionSourceEquivalent(source,git('rev-parse','HEAD'),root),/not_equivalent/);
  }
  git('reset','--hard',current);git('rm',media);git('commit','-qm','remove media source');
  assert.throws(()=>assertRetentionSourceEquivalent(current,git('rev-parse','HEAD'),root),/not_equivalent/);
  git('reset','--hard',current);git('mv',media,media+'.renamed');git('commit','-qm','rename media source');
  assert.throws(()=>assertRetentionSourceEquivalent(current,git('rev-parse','HEAD'),root),/not_equivalent/);
  git('reset','--hard',current);write('package.json',JSON.stringify({type:'commonjs',dependencies:{}}));git('add','.');git('commit','-qm','runtime manifest drift');
  assert.throws(()=>assertRetentionSourceEquivalent(source,git('rev-parse','HEAD'),root),/not_equivalent/);
  git('checkout','--orphan','unrelated-history');git('add','.');git('commit','-qm','unrelated source');
  assert.throws(()=>assertRetentionSourceEquivalent(git('rev-parse','HEAD'),current,root),/not_equivalent/);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('retention proof binds every relative executable dependency of the retained runner',async()=>{
 const {readFileSync}=await import('node:fs');const {posix}=await import('node:path');
 const {RETENTION_PROOF_PATHS}=await import('../scripts/operations/staging-support-media-preflight.mjs');
 const seen=new Set();
 function inspect(path){
  if(seen.has(path))return;seen.add(path);assert.ok(RETENTION_PROOF_PATHS.includes(path),`Unbound dependency: ${path}`);
  const source=readFileSync(path,'utf8');assert.doesNotMatch(source,/\bimport\s*\(/,'Dynamic retention dependencies require explicit source-binding review');
  for(const match of source.matchAll(/\bfrom\s*["'](\.[^"']+)["']/g))inspect(posix.normalize(posix.join(posix.dirname(path),match[1])));
 }
 inspect('scripts/operations/support-centre-staging.mjs');
});


test('runtime capability summary is boolean-only and never promotes presence to execution or delivery',()=>{
 const absent={widgetSessionConfigured:false,diagnosticsEnabled:false,automaticChecksEnabled:false,repairEnabled:false,emailConfigured:false};
 assert.deepEqual(supportRuntimeCapabilities({}),absent);
 const privateProbe='synthetic-private-runtime-value-that-must-not-be-returned';
 const ready={FANMIND_WEBSITE_CHAT_SESSION_SECRET:privateProbe,FANMIND_INAPP_HELP_DIAGNOSTICS_ENABLED:'true',FANMIND_INAPP_HELP_REPAIR_ENABLED:'true',RESEND_API_KEY:privateProbe,FANMIND_NOTIFICATION_FROM:'synthetic@example.invalid'};
 assert.deepEqual(supportRuntimeCapabilities(ready),{widgetSessionConfigured:true,diagnosticsEnabled:true,automaticChecksEnabled:false,repairEnabled:true,emailConfigured:true});
 assert.equal(JSON.stringify(supportRuntimeCapabilities(ready)).includes(privateProbe),false);
 assert.ok(Object.values(supportRuntimeCapabilities(ready)).every(value=>typeof value==='boolean'));
 for(const patch of [{FANMIND_WEBSITE_CHAT_SESSION_SECRET:'short'}, {FANMIND_WEBSITE_CHAT_SESSION_SECRET:' '.repeat(40)}])assert.equal(supportRuntimeCapabilities({...ready,...patch}).widgetSessionConfigured,false);
 for(const value of ['TRUE','1',true,undefined])assert.equal(supportRuntimeCapabilities({...ready,FANMIND_INAPP_HELP_REPAIR_ENABLED:value}).repairEnabled,false);
 for(const key of ['RESEND_API_KEY','FANMIND_NOTIFICATION_FROM'])assert.equal(supportRuntimeCapabilities({...ready,[key]:'  '}).emailConfigured,false);
});


test('widget preparation binds staging and adds one private key without changing flags or existing values',()=>{
 const action='prepare-widget',scoped={...env,CONFIRMATION:'staging-support-media-prepare-widget'};
 assert.doesNotThrow(()=>assertStagingRuntimeTarget(scoped,action));
 for(const patch of [{NEXT_PUBLIC_APP_URL:'https://fanmind.ch'},{SUPPORT_SCHEMA_VERIFIED:'false'},{SUPPORT_RETENTION_VERIFIED:'false'}])assert.throws(()=>assertStagingRuntimeTarget({...scoped,...patch},action));
 const before='FANMIND_SUPPORT_CENTRE_ENABLED=true\nFANMIND_INAPP_HELP_REPAIR_ENABLED=false\nOTHER=unchanged\n';
 const key='c'.repeat(64),after=renderStagingWidgetSecret(before,[],key);
 assert.equal(after,before+'FANMIND_WEBSITE_CHAT_SESSION_SECRET='+key+'\n');
 assert.equal(renderStagingWidgetSecret(before+'FANMIND_WEBSITE_CHAT_SESSION_SECRET=""\n',[],key),after);
 assert.throws(()=>renderStagingWidgetSecret(after,[],key));
 assert.throws(()=>renderStagingWidgetSecret(before,['OTHER=x\n','export FANMIND_WEBSITE_CHAT_SESSION_SECRET=private\n'],key));
 assert.throws(()=>renderStagingWidgetSecret(before,[],'short'));
 assert.throws(()=>renderStagingWidgetSecret(before+'FANMIND_WEBSITE_CHAT_SESSION_SECRET=\nFANMIND_WEBSITE_CHAT_SESSION_SECRET=\n',[],key));
});


test('positive widget acceptance rejects wrong target, absent write acknowledgement and mixed modes',async()=>{
 const {widgetAcceptanceBoundary}=await import('../scripts/operations/support-widget-staging-acceptance.mjs');
 const control={...env,FANMIND_SUPPORT_REVIEWED_COMMIT:env.GITHUB_SHA,FANMIND_SUPPORT_WIDGET_ONLY:'true',FANMIND_SUPPORT_CUSTOMER_CONFIRM:'run-staging-support-customer-acceptance',FANMIND_STAGING_WIDGET_WORKSPACE_ID:'ed7b908d-1dd9-4dc7-b217-648c4166aee5',FANMIND_ENABLE_NON_PRODUCTION_WRITES:'true',FANMIND_NON_PRODUCTION_WRITE_ACK:'I_UNDERSTAND_NON_PRODUCTION_ONLY',FANMIND_TARGET_API_ORIGIN:'https://staging.fanmind.ch',FANMIND_PRODUCTION_API_ORIGIN:'https://fanmind.ch',PGHOST:'aws-0-eu-west-3.pooler.supabase.com',FANMIND_TARGET_DB_HOST:'aws-0-eu-west-3.pooler.supabase.com',FANMIND_PRODUCTION_DB_HOST:'db.drqkpdvtbbrrdwmtrodz.supabase.co',PGPORT:'5432',PGDATABASE:'postgres',PGUSER:'postgres.vshyhvgcmrlagvfnvomc',PGSSLMODE:'verify-full'};
 assert.doesNotThrow(()=>widgetAcceptanceBoundary(control,env.GITHUB_SHA));
 for(const patch of [{NEXT_PUBLIC_APP_URL:'https://fanmind.ch'},{FANMIND_ENABLE_NON_PRODUCTION_WRITES:'false'},{FANMIND_SUPPORT_CUSTOMER_UI_ONLY:'true'},{FANMIND_STAGING_WIDGET_WORKSPACE_ID:'invalid'},{FANMIND_SUPPORT_WIDGET_ONLY:'false'},{PGUSER:'postgres.drqkpdvtbbrrdwmtrodz'}])assert.throws(()=>widgetAcceptanceBoundary({...control,...patch},env.GITHUB_SHA));
});


test('diagnostic activation changes only safe read flags and retains independent rollback/target gates',()=>{
 const before='FANMIND_SUPPORT_CENTRE_ENABLED=true\nFANMIND_INAPP_HELP_REPAIR_ENABLED=false\n';
 const after=renderStagingDiagnostics(before,[],true);
 assert.equal(after,before+'FANMIND_INAPP_HELP_DIAGNOSTICS_ENABLED=true\nFANMIND_INAPP_HELP_AUTOMATIC_CHECKS_ENABLED=true\n');
 assert.ok(renderStagingDiagnostics(after,[],false).includes('FANMIND_INAPP_HELP_REPAIR_ENABLED=false'));
 for(const key of ['FANMIND_INAPP_HELP_DIAGNOSTICS_ENABLED','FANMIND_INAPP_HELP_AUTOMATIC_CHECKS_ENABLED'])assert.throws(()=>renderStagingDiagnostics(before,[key+'=false'],true));
 assert.throws(()=>renderStagingDiagnostics(before+'FANMIND_INAPP_HELP_DIAGNOSTICS_ENABLED=invalid\n',[],true));
 for(const action of ['activate-diagnostics','deactivate-diagnostics']){
  const scoped={...env,CONFIRMATION:'staging-support-media-'+action};assert.doesNotThrow(()=>assertStagingRuntimeTarget(scoped,action));
  assert.throws(()=>assertStagingRuntimeTarget({...scoped,NEXT_PUBLIC_APP_URL:'https://fanmind.ch'},action));
 }
 assert.throws(()=>assertStagingRuntimeTarget({...env,CONFIRMATION:'staging-support-media-activate-diagnostics',SUPPORT_RETENTION_VERIFIED:'false'},'activate-diagnostics'));
});
