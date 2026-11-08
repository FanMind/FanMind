#!/usr/bin/env node
// Real customer-cookie/API checks. PostgreSQL is read-only fixture/cleanup proof,
// never a substitute for the customer identity under test. No service key.
import {spawnSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {rmSync} from 'node:fs';
import {evaluateSupportEnvironment} from './support-centre-staging.mjs';
import {privatePassfileSnapshot} from './website-chat-retention-staging-runner.mjs';

const APP='https://staging.fanmind.ch', REF='vshyhvgcmrlagvfnvomc';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const requireFact=(value,code)=>{if(!value)throw Error(code);};
export function customerAcceptanceBoundary(env,checkout){
 const fixtures=[['FANMIND_STAGING_E2E_EMAIL','FANMIND_STAGING_E2E_PASSWORD','FANMIND_STAGING_E2E_WORKSPACE_ID'],['FANMIND_STAGING_E2E_SECONDARY_EMAIL','FANMIND_STAGING_E2E_SECONDARY_PASSWORD','FANMIND_STAGING_E2E_SECONDARY_WORKSPACE_ID']].map(([email,password,workspace])=>({email:env[email]?.trim(),password:env[password],workspace:env[workspace]}));
 requireFact(env.FANMIND_SUPPORT_CUSTOMER_CONFIRM==='run-staging-support-customer-acceptance'&&env.GITHUB_REPOSITORY==='FanMind/FanMind'&&env.GITHUB_EVENT_NAME==='workflow_dispatch','dispatch_boundary');
 requireFact(evaluateSupportEnvironment({...env,FANMIND_SUPPORT_CONFIRM:'apply-support-centre-schema'},'apply',checkout).ok,'target_boundary');
 requireFact(env.NEXT_PUBLIC_APP_URL===APP&&new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname===`${REF}.supabase.co`,'target_boundary');
 for(const f of fixtures)requireFact(f.email&&/staging|synthetic|test/i.test(f.email)&&f.password&&uuid.test(f.workspace??''),'fixture_boundary');
 requireFact(fixtures[0].email.toLowerCase()!==fixtures[1].email.toLowerCase()&&fixtures[0].workspace!==fixtures[1].workspace,'fixture_overlap');
 return fixtures;
}
export async function runCustomerAcceptance(env=process.env){
 const uiOnly=env.FANMIND_SUPPORT_CUSTOMER_UI_ONLY==='true';
 const checkout=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout?.trim();
 const fixtures=customerAcceptanceBoundary(env,checkout);
 requireFact(spawnSync('git',['rev-parse','origin/main'],{encoding:'utf8'}).stdout?.trim()===checkout,'main_changed');
 async function version(){const r=await fetch(APP+'/api/version',{signal:AbortSignal.timeout(15000),redirect:'error',cache:'no-store'});const d=await r.json();requireFact(r.ok&&d.releaseCommit===checkout&&d.runtimeEnvironment==='staging','release_changed');}
 await version();
 const {directory,snapshotPath}=privatePassfileSnapshot(env);
 const query=sql=>{
  const safe=Object.fromEntries(['PATH','PGHOST','PGPORT','PGDATABASE','PGUSER','PGSSLMODE','PGSSLROOTCERT'].map(k=>[k,env[k]]));
  const r=spawnSync('psql',['--no-password','--no-psqlrc','-qAt','-v','ON_ERROR_STOP=1'],{env:{...safe,PGPASSFILE:snapshotPath,PGOPTIONS:'-c default_transaction_read_only=on',PGCONNECT_TIMEOUT:'10'},input:`BEGIN READ ONLY;SET LOCAL statement_timeout='10s';${sql};ROLLBACK;`,encoding:'utf8',timeout:30000,maxBuffer:65536});
  requireFact(!r.error&&r.status===0,'read_only_proof_failed');return r.stdout.trim();
 };
 const ids=fixtures.map(f=>`'${f.workspace}'`).join(',');
 const countSql=`SELECT (SELECT count(*) FROM public.support_chat_threads WHERE workspace_id IN(${ids}))+(SELECT count(*) FROM public.support_chat_turns WHERE workspace_id IN(${ids}))`;
 let browser;const actors=[];let failure=null,uiMissing=false;
 try{
  requireFact(query(`SELECT count(*) FROM public.workspaces w JOIN auth.users u ON u.id=w.owner_user_id WHERE w.id IN(${ids}) AND w.test_access_flags->>'staging_synthetic_fixture'='true' AND u.email ~* '(staging|synthetic|test)' AND u.deleted_at IS NULL`) ==='2','fixture_proof_failed');
  requireFact(query(countSql)==='0','fixture_not_empty');
  const {chromium}=await import('@playwright/test');browser=await chromium.launch();
  async function request(actor,path,body,origin=APP){
   const r=await actor.context.request.fetch(APP+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json'},...(body===undefined?{}:{data:body}),timeout:20000});
   let data;try{data=await r.json();}catch{data=null;}return {status:r.status(),data};
  }
  for(const [i,f]of fixtures.entries()){
   await version();
   const context=await browser.newContext({viewport:{width:i?390:1440,height:i?844:900}});const page=await context.newPage();
   const actor={...f,context,page,scope:null,token:null,anon:null,id:null};actors.push(actor);
   // Zero outbound provider traffic from the test browser; only app and its Auth.
   await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin===APP||u.origin===`https://${REF}.supabase.co`)await route.continue();else await route.abort();});
   await page.goto(APP+'/login');await page.getByRole('textbox',{name:'E-Mail',exact:true}).fill(f.email);await page.locator('input[name="password"]').fill(f.password);
   const exchange=page.waitForResponse(r=>r.url().startsWith(`https://${REF}.supabase.co/auth/v1/token?`)&&r.request().method()==='POST');
   await page.getByRole('button',{name:/Einloggen/}).click();const response=await exchange;requireFact(response.ok(),'login_failed');
   const session=await response.json();actor.token=session.access_token;actor.anon=response.request().headers().apikey;actor.id=session.user?.id;
   requireFact(uuid.test(actor.id??'')&&typeof actor.token==='string'&&actor.anon,'identity_failed');
   requireFact(query(`SELECT count(*) FROM public.workspaces WHERE id='${f.workspace}' AND owner_user_id='${actor.id}' AND test_access_flags->>'staging_synthetic_fixture'='true'`)==='1','fixture_owner_changed');
   await page.waitForURL(/\/dashboard(?:\?|$)/);
   let r=await request(actor,'/api/support/conversation');requireFact(r.status===200&&r.data?.turns?.length===0,'initial_conversation');actor.scope=r.data.scope;
   requireFact(actor.scope===createHash('sha256').update(`${actor.id}:${actor.workspace}`).digest('hex'),'workspace_scope');
   for(const table of ['support_chat_threads','support_chat_turns','support_centre_cases','support_centre_events','support_centre_notifications','support_repair_audit']){
    const denied=await context.request.get(`https://${REF}.supabase.co/rest/v1/${table}?select=*&limit=1`,{headers:{apikey:actor.anon,Authorization:`Bearer ${actor.token}`}});requireFact([401,403].includes(denied.status()),'direct_browser_table_exposed');
   }
   requireFact((await request(actor,'/api/admin/support/overview')).status===401,'customer_admin_read');
   requireFact((await request(actor,'/api/admin/support/decision',{workspace:actor.workspace,id:randomUUID(),decision:'approve'})).status===401,'workspace_owner_not_platform_owner');
   requireFact((await request(actor,'/api/support/conversation',{scope:actor.scope,workspace:fixtures[1-i].workspace,question:'synthetic',context:'support',requestId:randomUUID()})).status===409,'workspace_selector');
   requireFact((await request(actor,'/api/support/conversation',{scope:actor.scope,question:'synthetic',context:'support',requestId:randomUUID()},'https://foreign.invalid')).status===403,'foreign_origin');
   actor.first=randomUUID();actor.second=randomUUID();
   const payload={scope:actor.scope,requestId:actor.first,question:`Synthetic support acceptance ${env.GITHUB_RUN_ID} ${i}`,context:'support'};
   r=await request(actor,'/api/support/conversation',payload);requireFact(r.status===200&&r.data?.turns?.length===1,'save_first');
   r=await request(actor,'/api/support/conversation',payload);requireFact(r.status===200&&r.data?.turns?.length===1,'send_replay');
   r=await request(actor,'/api/support/conversation',{...payload,requestId:actor.second,question:'FanMind Funktionen und Hilfe'});requireFact(r.status===200&&r.data?.turns?.length===2,'save_second');
   r=await request(actor,`/api/support/conversation?before=${actor.second}`);requireFact(r.status===200&&r.data.turns.length===1&&r.data.turns[0].request_id===actor.first,'older_page');
   if(!uiOnly){
   r=await request(actor,`/api/support/privacy?scope=${actor.scope}`);requireFact(r.status===200&&r.data?.turns?.length===2&&r.data.turns.every(t=>[actor.first,actor.second].includes(t.request_id)),'own_export');
   r=await request(actor,`/api/support/privacy?scope=${actor.scope}&preview=erase`);requireFact(r.status===200&&uuid.test(r.data?.state?.thread??''),'own_preview');actor.state=r.data.state;
   requireFact((await request(actor,'/api/support/conversation',{scope:actor.scope,handoff:true})).status===200,'handoff');
   requireFact(query(`SELECT count(*) FROM public.support_chat_threads WHERE id='${actor.state.thread}' AND user_id='${actor.id}' AND handoff_consent AND shared_sequence=${actor.state.sequence}`)==='1','stored_consent');
   }
   const help=page.getByRole('button',{name:'Hilfe',exact:true});
   if(await help.count()){
    await help.click();const section=page.getByRole('region',{name:'Dein Supportgespräch',exact:true});await section.getByText(payload.question,{exact:false}).waitFor();
    await page.getByRole('button',{name:'Hilfe schließen',exact:true}).click();await help.click();await section.getByText(payload.question,{exact:false}).waitFor();
    await page.reload();await help.click();await section.getByText(payload.question,{exact:false}).waitFor();
   }else uiMissing=true;
   console.log(`SUPPORT_CUSTOMER_${i?'MOBILE':'DESKTOP'}_${uiOnly?'UI_RETEST':'API'}=PASS`);
  }
  if(!uiOnly){
  const [a,b]=actors;
  for(const [own,foreign] of [[a,b],[b,a]]){
   requireFact((await request(own,`/api/support/privacy?scope=${foreign.scope}`)).status===400,'foreign_export');
   const page=await request(own,`/api/support/conversation?before=${foreign.first}`);requireFact(page.status!==200||page.data.turns?.length===0,'foreign_cursor');
   const erased=await request(own,'/api/support/privacy',{action:'erase',confirmed:true,scope:own.scope,thread:foreign.state.thread,sequence:foreign.state.sequence});requireFact(erased.status===409,'foreign_erase');
   const preserved=await request(foreign,'/api/support/conversation');requireFact(preserved.status===200&&preserved.data.turns.length===2,'foreign_preserved');
  }
  console.log('SUPPORT_CUSTOMER_TENANT_AND_PRIVACY=PASS');
  }
  await version();
 }catch(error){failure=error;}
 finally{
  let clean=true;
  for(const actor of actors){
   try{
    if(actor.scope){
     const preview=await actor.context.request.get(APP+`/api/support/privacy?scope=${actor.scope}&preview=erase`);requireFact(preview.ok(),'cleanup_preview');const p=await preview.json();
     if(p.state){requireFact(uuid.test(p.state.thread),'cleanup_tuple');const erased=await actor.context.request.post(APP+'/api/support/privacy',{headers:{Origin:APP},data:{action:'erase',confirmed:true,scope:actor.scope,thread:p.state.thread,sequence:p.state.sequence}});requireFact(erased.ok(),'cleanup_erase');}
    }
    if(actor.token){const logout=await actor.context.request.post(`https://${REF}.supabase.co/auth/v1/logout?scope=local`,{headers:{apikey:actor.anon,Authorization:`Bearer ${actor.token}`}});requireFact(logout.ok(),'logout');}
    await actor.context.clearCookies();const denied=await actor.context.request.get(APP+'/api/support/conversation');requireFact(denied.status()===401,'logout_denial');
   }catch{clean=false;}
   await actor.context.close().catch(()=>{clean=false;});
  }
  if(browser)await browser.close();
  try{
   requireFact(query(countSql)==='0','cleanup_residue');
   const threads=actors.map(a=>a.state?.thread).filter(id=>uuid.test(id??''));
   if(threads.length)requireFact(query(`SELECT count(*) FROM public.support_centre_notifications WHERE reference_id IN(${threads.map(id=>`'${id}'`).join(',')})`)==='0','cleanup_notice_residue');
  }catch{clean=false;}
  rmSync(directory,{recursive:true,force:true});
  console.log(`SUPPORT_CUSTOMER_INDEPENDENT_CLEANUP=${clean?'PASS':'FAIL'}`);
  if(!clean)failure=Error('cleanup_failed');
 }
 if(failure)throw failure;
 console.log(`SUPPORT_CUSTOMER_BROWSER_UI=${uiMissing?'BLOCKED_LAUNCHER_DISABLED':'PASS'}`);
 if(!uiOnly)console.log('SUPPORT_CUSTOMER_API_ACCEPTANCE=PASS');
 if(uiMissing)throw Error('launcher_disabled');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 runCustomerAcceptance().catch(error=>{console.error(`SUPPORT_CUSTOMER_ERROR=${/^[a-z_]+$/.test(error?.message??'')?error.message:'operation_failed'}`);process.exitCode=1;});
}
