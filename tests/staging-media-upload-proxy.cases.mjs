import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {assertProxyTarget,planUploadProxy,applyProxyPlan,UPLOAD_BLOCK,UPLOAD_LIMITS} from '../scripts/operations/staging-media-upload-proxy.mjs';
const env={GITHUB_REPOSITORY:'FanMind/FanMind',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_ACTOR:'Bernds-tech',RUNNER_NAME:'fanmind-prod-01-exoscale',GITHUB_SHA:'a'.repeat(40),REVIEWED_COMMIT:'a'.repeat(40),EXPECTED_STAGING_COMMIT:'a'.repeat(40),CONFIRMATION:'staging-media-upload-proxy-apply',STAGING_APP_URL:'https://staging.fanmind.ch'};
function tlsEnd(source){
 const r=spawnSync('awk',['-v','expected_certificate=/etc/letsencrypt/live/staging.fanmind.ch/fullchain.pem','-v','expected_certificate_key=/etc/letsencrypt/live/staging.fanmind.ch/privkey.pem','-v','output_mode=media_end_line','-f','scripts/operations/verify-staging-nginx-whatsapp-boundary.awk'],{input:source,encoding:'utf8'});return Number(r.stdout.trim());
}
const fresh=readFileSync('ops/nginx/fanmind-staging.http.conf','utf8').replace('listen 80;','listen 443 ssl;').replace('listen [::]:80;','listen [::]:443 ssl;').replace('server_name staging.fanmind.ch;','server_name staging.fanmind.ch;\n    ssl_certificate /etc/letsencrypt/live/staging.fanmind.ch/fullchain.pem;\n    ssl_certificate_key /etc/letsencrypt/live/staging.fanmind.ch/privkey.pem;');
const before=fresh.replace(UPLOAD_BLOCK,'');
test('fixed upload proxy control rejects non-main, foreign target, actor, runner and release drift',()=>{
 assert.doesNotThrow(()=>assertProxyTarget(env,'apply'));
 for(const patch of [{GITHUB_REPOSITORY:'Other/Repo'},{GITHUB_REF:'refs/heads/fix'},{GITHUB_EVENT_NAME:'pull_request'},{GITHUB_ACTOR:'unknown'},{RUNNER_NAME:'fanmind-staging-01-exoscale'},{REVIEWED_COMMIT:'b'.repeat(40)},{EXPECTED_STAGING_COMMIT:'b'.repeat(40)},{STAGING_APP_URL:'https://fanmind.ch'},{CONFIRMATION:'enable-fanmind-staging-tls'}])assert.throws(()=>assertProxyTarget({...env,...patch},'apply'));
 assert.throws(()=>assertProxyTarget(env,'arbitrary'));
});
test('only exact upload routes gain bounded bodies, all existing TLS, webhook and generic-route bytes survive',()=>{
 const plan=planUploadProxy(before,tlsEnd);assert.equal(plan.state,'ABSENT');assert.equal(plan.next.replace(UPLOAD_BLOCK,''),before);
 assert.match(plan.next,/client_max_body_size 2m;/);assert.deepEqual(UPLOAD_LIMITS,[['/api/chatadmin/media',7100000],['/api/chatadmin/media/catalogue',35100000]]);
 const again=planUploadProxy(plan.next,tlsEnd);assert.equal(again.state,'READY');assert.equal(again.next,plan.next);assert.equal(planUploadProxy(fresh,tlsEnd).state,'READY');
});
test('partial, duplicated, wrong upstream and foreign TLS configurations cannot be rewritten',()=>{
 for(const source of [before.replace('server_name staging.fanmind.ch','server_name fanmind.ch'),before.replace('127.0.0.1:3001','127.0.0.1:3000'),before.replace('location / {','location = /api/chatadmin/media {'),fresh.replace('client_max_body_size 35100000;','client_max_body_size 0;'),fresh+UPLOAD_BLOCK,before.replace('proxy_set_header Connection "upgrade";','proxy_set_header Connection "close";')])assert.throws(()=>planUploadProxy(source,tlsEnd));
});
test('failed proxy transport restores exact bytes and reloads only the original configuration',async()=>{
 let state='before',reloads=0;
 const io={before:'before',next:'before'+UPLOAD_BLOCK,read:()=>state,write:s=>{state=s;},global:()=>'global:'+state,check:()=>{},reload:()=>{reloads++;},probe:async()=>{throw Error('probe failed');}};
 await assert.rejects(applyProxyPlan(io),/probe failed/);assert.equal(state,'before');assert.equal(reloads,2);
});
test('failed nginx syntax restores before any reload; concurrent target or global changes are never overwritten/reloaded',async()=>{
 let state='before',reloads=0,checks=0;
 const base={before:'before',next:'before'+UPLOAD_BLOCK,read:()=>state,write:s=>{state=s;},global:()=>'global:'+state,check:()=>{if(++checks===1)throw Error('syntax failed');},reload:()=>{reloads++;},probe:async()=>{}};
 await assert.rejects(applyProxyPlan(base),/syntax failed/);assert.equal(state,'before');assert.equal(reloads,0);
 state='before';checks=0;
 await assert.rejects(applyProxyPlan({...base,check:()=>{state='concurrent';}}),/concurrent/);assert.equal(state,'concurrent');assert.equal(reloads,0);
 state='before';let drift=false;
 await assert.rejects(applyProxyPlan({...base,check:()=>{drift=true;},global:()=>state+(drift?'other configuration changed':'')}),/concurrent/);assert.equal(state,'before');assert.equal(reloads,0);
});
test('fixed protected job never invokes provisioning, certbot, application restart or new credential grants',()=>{
 const workflow=readFileSync('.github/workflows/enable-staging-tls.yml','utf8').split('  media-upload-proxy:')[1];assert.ok(workflow);
 assert.match(workflow,/environment: staging/);assert.match(workflow,/group: fanmind-staging-deploy/);assert.match(workflow,/inputs.reviewed_commit/);assert.match(workflow,/staging-media-upload-proxy-verify/);
 assert.doesNotMatch(workflow,/certbot|provision-staging-host|secrets\.|sudoers|systemctl restart|apply_migration/);
 const runner=readFileSync('scripts/operations/staging-media-upload-proxy.mjs','utf8');assert.match(runner,/sites-available\/fanmind-staging/);assert.match(runner,/fchmodSync\(fd,0o644\)/);assert.doesNotMatch(runner,/sites-available\/fanmind['"/]|\.env\.production|SUPABASE_SERVICE|STRIPE/);
});
