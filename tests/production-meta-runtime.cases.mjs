import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertProductionMetaTarget, assertProductionRuntimeConsistency, verifyProductionAppSecret, productionMetaTransaction, productionMetaReadiness, productionAppSubscription, APP } from '../scripts/operations/production-meta-runtime.mjs';
import { renderMetaConfiguration } from '../scripts/operations/staging-meta-runtime.mjs';
const values={FANMIND_RUNTIME_ENVIRONMENT:'production',NEXT_PUBLIC_APP_URL:'https://fanmind.ch',NEXT_PUBLIC_SUPABASE_URL:'https://drqkpdvtbbrrdwmtrodz.supabase.co',FACEBOOK_APP_ID:APP,FACEBOOK_APP_SECRET:'a'.repeat(32),FACEBOOK_REDIRECT_URI:'https://fanmind.ch/api/integrations/facebook/callback',FANMIND_TOKEN_ENCRYPTION_KEY:'b'.repeat(64),FACEBOOK_WEBHOOK_VERIFY_TOKEN:'synthetic'.repeat(8)};
const control={GITHUB_REPOSITORY:'FanMind/FanMind',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR_ID:'270165082',GITHUB_SHA:'c'.repeat(40),REVIEWED_COMMIT:'c'.repeat(40),LIVE_COMMIT:'d'.repeat(40),CONFIRMATION:'production-meta-inspect',META_SETUP_APP_ID:APP,GITHUB_RUN_ID:'123'};
test('Production controller rejects Staging, other apps, actors, branches and mismatched release inputs',()=>{
 assert.doesNotThrow(()=>assertProductionMetaTarget(values,control,'inspect'));
 for(const patch of [{FANMIND_RUNTIME_ENVIRONMENT:'staging'},{NEXT_PUBLIC_APP_URL:'https://staging.fanmind.ch'},{NEXT_PUBLIC_SUPABASE_URL:'https://vshyhvgcmrlagvfnvomc.supabase.co'},{FACEBOOK_APP_ID:'1547928503809961'},{META_APP_ID:'1637976007865045'}])assert.throws(()=>assertProductionMetaTarget({...values,...patch},control,'inspect'));
 for(const patch of [{GITHUB_EVENT_NAME:'push'},{GITHUB_EVENT_NAME:'pull_request'},{GITHUB_REF:'refs/heads/feature'},{GITHUB_ACTOR_ID:'other'},{GITHUB_SHA:'e'.repeat(40)},{LIVE_COMMIT:''},{META_SETUP_APP_ID:'1547928503809961'},{CONFIRMATION:'staging-meta-inspect'}])assert.throws(()=>assertProductionMetaTarget(values,{...control,...patch},'inspect'));
});
test('shared renderer preserves valid encryption and unrelated settings, blocks key replacement when dependent data exist',()=>{
 const original='FANMIND_SUPPORT_CENTRE_ENABLED=true\nSTRIPE_SECRET_KEY=synthetic-preserve\nFANMIND_TOKEN_ENCRYPTION_KEY='+values.FANMIND_TOKEN_ENCRYPTION_KEY+'\n';
 const requested={appId:APP,appSecret:values.FACEBOOK_APP_SECRET,webhookToken:values.FACEBOOK_WEBHOOK_VERIFY_TOKEN};
 const rendered=renderMetaConfiguration(original,[],requested,{tokensPresent:true,callback:values.FACEBOOK_REDIRECT_URI});
 assert.ok(rendered.startsWith('FANMIND_SUPPORT_CENTRE_ENABLED=true\nSTRIPE_SECRET_KEY=synthetic-preserve\n'));assert.ok(rendered.includes(values.FANMIND_TOKEN_ENCRYPTION_KEY));assert.ok(rendered.includes(values.FACEBOOK_REDIRECT_URI));
 assert.throws(()=>renderMetaConfiguration('',[],requested,{tokensPresent:true,callback:values.FACEBOOK_REDIRECT_URI}),/existing_tokens_require_key_recovery/);
 assert.throws(()=>renderMetaConfiguration('',[],requested,{callback:'https://foreign.invalid/callback'}),/callback_invalid/);
 assert.equal(Object.values(productionMetaReadiness(values)).every(Boolean),true);
});
test('app subscription verifies exact Production callback and messages/feed; conflicts never mutate, success must read back',async()=>{
 const page={object:'page',active:true,callback_url:'https://fanmind.ch/api/webhooks/meta',fields:[{name:'messages'},{name:'feed'}]};
 const calls=[];const request=async(url,options)=>{calls.push({url,options});return Response.json({data:[page]});};
 assert.equal(await productionAppSubscription(values,true,request),true);assert.equal(calls.length,1);
 assert.ok(calls[0].url.includes(APP));assert.equal(calls[0].options.method,undefined);
 let writes=0;
 await assert.rejects(productionAppSubscription(values,true,async(_u,o)=>{if(o.method==='POST')writes++;return Response.json({data:[{...page,callback_url:'https://staging.fanmind.ch/api/webhooks/meta'}]});}),/subscription_conflict/);assert.equal(writes,0);
 let reads=0;
 assert.equal(await productionAppSubscription(values,true,async(_u,o)=>{
  if(o.method==='POST'){writes++;assert.equal(o.body.get('fields'),'messages,feed');return Response.json({success:true});}
  return Response.json({data:++reads===1?[]:[page]});
 },{saveSnapshot:inventory=>assert.deepEqual(inventory,{data:[]})}),true);assert.equal(writes,1);assert.equal(reads,2);
});
test('Production control shares deployment lock and protected environment, never exports secrets as command arguments',()=>{
 const workflow=readFileSync('.github/workflows/production-meta-runtime.yml','utf8');
 assert.match(workflow,/group: fanmind-production-deploy/);assert.match(workflow,/environment: production/);assert.match(workflow,/git merge-base --is-ancestor/);assert.match(workflow,/--preserve-env=META_SETUP_APP_SECRET/);
 assert.doesNotMatch(workflow,/META_SETUP_APP_SECRET="\$/);
});

test('wrong inherited target/service key/aliases fail before setup; PM2 release marker remains exactly live-bound',()=>{
 const file={...values,SUPABASE_SERVICE_ROLE_KEY:'synthetic-production'};
 const running={...file,FANMIND_RELEASE_COMMIT:control.LIVE_COMMIT};
 assert.doesNotThrow(()=>assertProductionRuntimeConsistency(file,running,control.LIVE_COMMIT));
 for(const name of ['META_APP_ID','META_APP_SECRET','META_WEBHOOK_APP_SECRET','META_REDIRECT_URI','META_WEBHOOK_VERIFY_TOKEN'])assert.throws(()=>assertProductionRuntimeConsistency(file,{...running,[name]:'synthetic-staging-alias'},control.LIVE_COMMIT));
 for(const patch of [{NEXT_PUBLIC_SUPABASE_URL:'https://vshyhvgcmrlagvfnvomc.supabase.co'},{NEXT_PUBLIC_APP_URL:'https://staging.fanmind.ch'},{SUPABASE_SERVICE_ROLE_KEY:'synthetic-staging'},{FACEBOOK_APP_SECRET:'f'.repeat(32)},{FANMIND_RUNTIME_ENVIRONMENT:'staging'},{FANMIND_RELEASE_COMMIT:'e'.repeat(40)}])assert.throws(()=>assertProductionRuntimeConsistency(file,{...running,...patch},control.LIVE_COMMIT));
});
test('secret must authenticate exact pinned Production app before configuration can be changed',async()=>{
 let count=0;
 await verifyProductionAppSecret(values.FACEBOOK_APP_SECRET,async(url,options)=>{count++;assert.ok(url.includes(APP+'?fields=id'));assert.ok(options.headers.Authorization.startsWith('Bearer '+APP+'|'));return Response.json({id:APP});});
 assert.equal(count,1);
 await assert.rejects(verifyProductionAppSecret('e'.repeat(32),async()=>Response.json({error:{code:190}},{status:400})),/provider_request_failed/);
 await assert.rejects(verifyProductionAppSecret('e'.repeat(32),async()=>Response.json({id:'1547928503809961'})),/app_secret_identity_invalid/);
});

test('actual Production transaction snapshots first, verifies reload and rolls back failed health without overwriting concurrent changes',async()=>{
 let current='before', events=[];
 const operations={before:'before',after:'after',saveSnapshot:async value=>{assert.equal(value,'before');events.push('snapshot');},read:()=>current,write:value=>{events.push('write:'+value);current=value;},restart:()=>events.push('restart'),verify:async()=>{events.push('verify');throw Error('target_read_failed');},verifyRollback:async()=>events.push('rollback-verified')};
 await assert.rejects(productionMetaTransaction(operations),/activation_failed_rolled_back/);
 assert.equal(current,'before');assert.deepEqual(events,['snapshot','write:after','restart','verify','write:before','restart','rollback-verified']);
 events=[];current='before';
 await assert.rejects(productionMetaTransaction({...operations,saveSnapshot:async()=>{throw Error('snapshot_failed');}}),/snapshot_failed/);assert.deepEqual(events,[]);assert.equal(current,'before');
 await assert.rejects(productionMetaTransaction({...operations,verify:async()=>{current='concurrent';throw Error('target_read_failed');}}),/rollback_configuration_changed/);assert.equal(current,'concurrent');
});

test('automatic registration validation cannot reach the protected host job or deployment lock',()=>{
 const workflow=readFileSync('.github/workflows/production-meta-runtime.yml','utf8');
 const validation=workflow.split('  validate:')[1].split('  control:')[0];
 const host=workflow.split('  control:')[1];
 assert.match(workflow,/push:\n    branches: \[main\]\n    paths: \[.github\/workflows\/production-meta-runtime.yml\]/u);
 assert.match(validation,/if: github.event_name != 'workflow_dispatch'/u);
 assert.match(validation,/runs-on: ubuntu-24.04/u);
 assert.doesNotMatch(validation,/environment:|secrets\.|self-hosted|sudo|concurrency:/u);
 assert.match(host,/if: github.event_name == 'workflow_dispatch' && github.ref == 'refs\/heads\/main'/u);
 assert.match(host,/concurrency:\n      group: fanmind-production-deploy\n      cancel-in-progress: false/u);
 assert.match(host,/environment: production/u);
 assert.match(host,/github.actor_id == '270165082'/u);
 assert.match(host,/inputs.reviewed_commit == github.sha/u);
});
