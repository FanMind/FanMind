#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {rmSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {evaluateSupportEnvironment} from './support-centre-staging.mjs';
import {privatePassfileSnapshot} from './website-chat-retention-staging-runner.mjs';
const APP='https://staging.fanmind.ch';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const requireFact=(value,code)=>{if(!value)throw Error(code);};
export function widgetAcceptanceBoundary(env,checkout){
 requireFact(env.FANMIND_SUPPORT_CUSTOMER_CONFIRM==='run-staging-support-customer-acceptance'&&env.FANMIND_SUPPORT_WIDGET_ONLY==='true'&&env.FANMIND_SUPPORT_CUSTOMER_UI_ONLY!=='true','widget_confirmation');
 requireFact(evaluateSupportEnvironment({...env,FANMIND_SUPPORT_CONFIRM:'apply-support-centre-schema'},'apply',checkout).ok,'widget_target_boundary');
 requireFact(UUID.test(env.FANMIND_STAGING_WIDGET_WORKSPACE_ID??''),'widget_fixture_boundary');
 return env.FANMIND_STAGING_WIDGET_WORKSPACE_ID;
}
export async function runWidgetAcceptance(env=process.env){
 const checkout=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout?.trim();
 const workspace=widgetAcceptanceBoundary(env,checkout);
 requireFact(spawnSync('git',['rev-parse','origin/main'],{encoding:'utf8'}).stdout?.trim()===checkout,'main_changed');
 async function version(){const r=await fetch(APP+'/api/version',{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});const d=await r.json();requireFact(r.ok&&d.releaseCommit===checkout&&d.runtimeEnvironment==='staging','release_changed');}
 await version();
 const {directory,snapshotPath}=privatePassfileSnapshot(env);
 const query=(sql,write=false)=>{
  const safe=Object.fromEntries(['PATH','PGHOST','PGPORT','PGDATABASE','PGUSER','PGSSLMODE','PGSSLROOTCERT'].map(k=>[k,env[k]]));
  const r=spawnSync('psql',['--no-password','--no-psqlrc','-qAt','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate'],{env:{...safe,PGPASSFILE:snapshotPath,PGCONNECT_TIMEOUT:'10',PGOPTIONS:write?'':'-c default_transaction_read_only=on'},input:`BEGIN${write?'':' READ ONLY'};SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='10s';${sql};${write?'COMMIT':'ROLLBACK'};`,encoding:'utf8',timeout:30000,maxBuffer:65536});
  requireFact(!r.error&&r.status===0,'widget_database_operation_failed');return r.stdout.trim();
 };
 let browser,fixture,prepared=false,failure=null,baseline;
 const run=String(env.GITHUB_RUN_ID??'');requireFact(/^\d{1,20}$/.test(run),'run_binding');
 try{
  const rows=JSON.parse(query(`SELECT coalesce(json_agg(json_build_object('id',i.id,'publicId',i.public_installation_id,'consent',i.consent_version,'flags',w.test_access_flags)), '[]') FROM public.website_chat_installations i JOIN public.workspaces w ON w.id=i.workspace_id JOIN auth.users u ON u.id=w.owner_user_id WHERE w.id='${workspace}' AND w.test_access_flags->>'staging_synthetic_fixture'='true' AND u.email ~* '(staging|synthetic|test)' AND u.deleted_at IS NULL AND u.email_confirmed_at IS NOT NULL AND NOT i.enabled AND NOT EXISTS(SELECT 1 FROM public.support_centre_owners o WHERE o.user_id=u.id) AND EXISTS(SELECT 1 FROM public.website_chat_allowed_origins a WHERE a.installation_id=i.id AND a.workspace_id=w.id AND a.origin='${APP}' AND a.verified_at IS NULL)`));
  requireFact(rows.length===1,'widget_fixture_not_unique');fixture=rows[0];
  requireFact(UUID.test(fixture.id)&&UUID.test(fixture.publicId)&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(fixture.consent),'widget_fixture_invalid');
  const scope=`workspace_id='${workspace}'`;
  const counts=()=>query(`SELECT jsonb_build_object('contacts',(SELECT count(*) FROM public.contacts WHERE ${scope}),'conversations',(SELECT count(*) FROM public.conversations WHERE ${scope}),'messages',(SELECT count(*) FROM public.conversation_messages WHERE ${scope}),'sessions',(SELECT count(*) FROM public.website_chat_visitor_sessions WHERE installation_id='${fixture.id}'),'receipts',(SELECT count(*) FROM public.website_chat_message_receipts WHERE installation_id='${fixture.id}'),'handoffs',(SELECT count(*) FROM public.website_chat_handoffs WHERE installation_id='${fixture.id}'))`);
  baseline=counts();const before=JSON.parse(baseline);requireFact(before.sessions===0&&before.receipts===0&&before.handoffs===0,'widget_fixture_not_empty');
  requireFact(query(`SELECT count(*) FROM public.contacts WHERE ${scope} AND source_platform='website-chat'`)==='0','widget_contacts_not_empty');
  const prior=JSON.stringify(fixture.flags).replaceAll("'","''");
  prepared=true;
  query(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.workspaces WHERE id='${workspace}' AND test_access_flags='${prior}'::jsonb) THEN RAISE EXCEPTION 'widget_fixture_changed'; END IF; END $$; UPDATE public.website_chat_installations SET enabled=true WHERE id='${fixture.id}' AND workspace_id='${workspace}' AND NOT enabled; UPDATE public.website_chat_allowed_origins SET verified_at=clock_timestamp() WHERE installation_id='${fixture.id}' AND origin='${APP}' AND verified_at IS NULL; UPDATE public.workspaces SET test_access_flags=test_access_flags||jsonb_build_object('support_widget_acceptance_run','${run}','temporary_processing_access','true','temporary_processing_access_expires_at',to_char((clock_timestamp()+interval '30 minutes') AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) WHERE id='${workspace}'`,true);
  requireFact(query(`SELECT public.website_chat_processing_allowed('${workspace}')`)==='t','widget_processing_unavailable');
  const {chromium}=await import('@playwright/test');browser=await chromium.launch();
  for(const [index,size] of [{width:1440,height:900},{width:390,height:844}].entries()){
   const context=await browser.newContext({viewport:size});const page=await context.newPage();
   // The actual widget and app endpoints execute. Optional AI reply is aborted,
   // never mocked as success; no provider or email request is permitted.
   await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==APP||u.pathname==='/api/website-chat/reply')await route.abort();else await route.continue();});
   await page.goto(APP+'/support');
   let session=null,message=null,sessionCalls=0;
   page.on('response',async r=>{if(r.url().includes('/api/website-chat/session')&&r.request().method()==='POST'){sessionCalls++;if(r.status()===201)session=await r.json();}});
   if(await page.locator('[data-fanmind-widget]').count()===0){
    await page.evaluate(({url,id,consent})=>{const s=document.createElement('script');s.src=url;s.dataset.installationId=id;s.dataset.consentVersion=consent;document.body.appendChild(s);},{url:APP+'/website-chat/widget.js',id:fixture.publicId,consent:fixture.consent});
   }
   await page.locator('[data-fanmind-widget]').waitFor();
   requireFact(sessionCalls===0,'widget_session_before_consent');
   // Closed Shadow DOM remains closed. Real mouse/keyboard interaction uses
   // the widget's fixed button and its deliberate textarea autofocus.
   await page.mouse.click(size.width-65,size.height-40);
   await page.keyboard.type(`Synthetic widget acceptance ${run} ${index}`);
   await page.keyboard.press('Tab');await page.keyboard.press('Space');await page.keyboard.press('Tab');
   const response=page.waitForResponse(r=>r.url().includes('/api/website-chat/message')&&r.request().method()==='POST');
   await page.keyboard.press('Enter');const sent=await response;
   requireFact(sent.status()===202,'widget_message_not_accepted');message=sent.request().postDataJSON();
   requireFact(session?.session?.token&&sessionCalls===1,'widget_session_missing');
   const token=session.session.token;
   const headers={Origin:APP,'Content-Type':'application/json','x-fanmind-installation':fixture.publicId,Authorization:'Bearer '+token};
   const post=(path,data,extra={})=>context.request.post(APP+path,{headers:{...headers,...extra},data,timeout:15000});
   const replay=await post('/api/website-chat/message',message);requireFact(replay.status()===200&&(await replay.json()).duplicate===true,'widget_duplicate');
   const denied=await post('/api/website-chat/message',{...message,clientMessageId:randomUUID()},{Origin:'https://foreign.invalid'});requireFact(denied.status()===403,'widget_foreign_origin');
   requireFact((await post('/api/website-chat/session',{consent:{granted:false,version:fixture.consent}})).status()===400,'widget_consent_denial');
   const handoff=await post('/api/website-chat/handoff',{clientHandoffId:randomUUID(),email:'widget.acceptance@example.invalid',consent:{granted:true,version:fixture.consent,purpose:'human_reply_by_email'}});requireFact([200,202].includes(handoff.status()),'widget_handoff');
   requireFact(UUID.test(message.clientMessageId??''),'widget_message_identity');
   const ids=JSON.parse(query(`SELECT json_agg(json_build_object('session',session_id,'message',message_id,'contact',contact_id,'conversation',conversation_id)) FROM public.website_chat_message_receipts WHERE installation_id='${fixture.id}' AND client_message_id='${message.clientMessageId}'`));
   requireFact(ids?.length===1&&Object.values(ids[0]).every(v=>UUID.test(v)),'widget_persistence_missing');
   const id=ids[0].session;
   query(`UPDATE public.website_chat_visitor_sessions SET consent_granted_at=clock_timestamp()-interval '10 minutes',expires_at=clock_timestamp()-interval '5 minutes' WHERE id='${id}' AND installation_id='${fixture.id}' AND workspace_id='${workspace}'`,true);
   requireFact((await post('/api/website-chat/message',{...message,clientMessageId:randomUUID()})).status()===401,'widget_expiry');
   console.log(`SUPPORT_WIDGET_${index?'MOBILE':'DESKTOP'}=PASS`);await context.close();
  }
  await version();
 }catch(error){failure=error;}
 finally{
  await browser?.close().catch(()=>{});
  if(prepared){
   const prior=JSON.stringify(fixture.flags).replaceAll("'","''");
   try{
    // Disable in its own committed transaction even if later cleanup fails.
    query(`UPDATE public.website_chat_installations SET enabled=false WHERE id='${fixture.id}' AND workspace_id='${workspace}'`,true);
    query(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.workspaces WHERE id='${workspace}' AND test_access_flags->>'support_widget_acceptance_run'='${run}' AND (test_access_flags-'support_widget_acceptance_run'-'temporary_processing_access'-'temporary_processing_access_expires_at')=('${prior}'::jsonb-'temporary_processing_access'-'temporary_processing_access_expires_at')) THEN RAISE EXCEPTION 'widget_concurrent_fixture_change';END IF;END $$; DELETE FROM public.contacts WHERE workspace_id='${workspace}' AND id IN(SELECT contact_id FROM public.website_chat_message_receipts WHERE installation_id='${fixture.id}' AND workspace_id='${workspace}'); DELETE FROM public.website_chat_visitor_sessions WHERE installation_id='${fixture.id}' AND workspace_id='${workspace}'; UPDATE public.website_chat_allowed_origins SET verified_at=NULL WHERE installation_id='${fixture.id}' AND origin='${APP}'; UPDATE public.workspaces SET test_access_flags='${prior}'::jsonb WHERE id='${workspace}'`,true);
    const after=query(`SELECT jsonb_build_object('contacts',(SELECT count(*) FROM public.contacts WHERE workspace_id='${workspace}'),'conversations',(SELECT count(*) FROM public.conversations WHERE workspace_id='${workspace}'),'messages',(SELECT count(*) FROM public.conversation_messages WHERE workspace_id='${workspace}'),'sessions',(SELECT count(*) FROM public.website_chat_visitor_sessions WHERE installation_id='${fixture.id}'),'receipts',(SELECT count(*) FROM public.website_chat_message_receipts WHERE installation_id='${fixture.id}'),'handoffs',(SELECT count(*) FROM public.website_chat_handoffs WHERE installation_id='${fixture.id}'))`);
    requireFact(JSON.stringify(JSON.parse(after))===JSON.stringify(JSON.parse(baseline)),'widget_cleanup_count_mismatch');
    requireFact(query(`SELECT count(*) FROM public.website_chat_installations i JOIN public.workspaces w ON w.id=i.workspace_id JOIN public.website_chat_allowed_origins a ON a.installation_id=i.id WHERE i.id='${fixture.id}' AND NOT i.enabled AND a.origin='${APP}' AND a.verified_at IS NULL AND w.test_access_flags='${prior}'::jsonb`)==='1','widget_fixture_restore_failed');
    console.log('SUPPORT_WIDGET_INDEPENDENT_CLEANUP=PASS');
   }catch{failure=Error('widget_cleanup_failed');}
  }
  rmSync(directory,{recursive:true,force:true});
 }
 if(failure)throw failure;
 console.log('SUPPORT_WIDGET_PROVIDER_CALLS=0');console.log('SUPPORT_WIDGET_EMAIL_SENDS=0');console.log('SUPPORT_WIDGET_ACCEPTANCE=PASS');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)runWidgetAcceptance().catch(e=>{console.error(`SUPPORT_WIDGET_ERROR=${/^[a-z_]+$/.test(e?.message??'')?e.message:'acceptance_failed'}`);process.exitCode=1;});
