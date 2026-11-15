import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import ts from 'typescript';
import * as security from '../src/lib/webhookSecurityPolicy.mjs';
import * as dataPolicy from '../src/lib/metaDataHandlingPolicy.mjs';
import { facebookCommentTarget } from '../src/lib/facebookCommentTarget.mjs';

const PAGE='1208778912321696', FAN='123456789', WORKSPACE='synthetic-workspace', CONTACT='synthetic-contact';
const compile = source => ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(path, dependencies={}, extra={}) {
  const exports={}; runInNewContext(compile(readFileSync(path,'utf8')),{
    exports,URL,Date,Buffer,Response,TextDecoder,setTimeout,clearTimeout,
    console:{info(){},warn(){},error(){}}, process:{env:{}},
    require(name){assert.ok(Object.hasOwn(dependencies,name),name);return dependencies[name];},...extra,
  }); return exports;
}
const attachments=load('src/lib/messageAttachments.ts');
const dm=(patch={})=>({object:'page',entry:[{id:PAGE,messaging:[{sender:{id:FAN},recipient:{id:PAGE},timestamp:1794564000000,message:{mid:'m_synthetic',text:'synthetic private message'},...patch}]}]});
const comment=(patch={})=>({object:'page',entry:[{id:PAGE,changes:[{field:'feed',value:{item:'comment',verb:'add',post_id:`${PAGE}_101`,comment_id:'101_201',from:{id:FAN,name:'Synthetic fan'},message:'synthetic comment',created_time:1794564000,...patch}}]}]});
function processor(options={}) {
  const calls={lookup:[],writes:[],diagnostics:[],queue:[]};
  const server={
    findMetaSocialConnectionByPageId:async(...args)=>{calls.lookup.push(args);return options.lookup ?? {connection:{id:'connection',workspace_id:WORKSPACE,page_name:'Synthetic page'},error:null};},
    createMetaWebhookConversationMessage:async input=>{calls.writes.push(input);return options.persist?.(input) ?? {message:{contact_id:CONTACT},conversation:{id:'conv'},error:null};},
    createMetaWebhookDebugEvent:async input=>{calls.diagnostics.push(input);return {error:options.diagnosticError};},
    enqueueMetaConversationCatchup:async input=>{calls.queue.push(input);return {job:{id:'job'},error:null};},
  };
  const api=load('src/lib/metaWebhook.ts',{
    '@/lib/messageAttachments':attachments,'@/lib/supabase/server':server,
    '@/lib/webhookSecurityPolicy.mjs':security,'@/lib/metaDataHandlingPolicy.mjs':dataPolicy,
    '@/lib/metaCatchupQueuePolicy.mjs':{isMetaCatchupQueueEnabled:()=>false},
    '@/lib/facebookCommentTarget.mjs':{facebookCommentTarget},
  });return {...api,calls};
}
function declarationHarness(names,extra={}) {
  const path='src/lib/supabase/server.ts';const file=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true);
  const functions=names.map(name=>{const n=file.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.ok(n,name);return n.getText(file).replace(/^(?:export )?async function /,'export async function ');}).join('\n');
  const exports={};runInNewContext(compile(functions),{exports,URL,Error,Date,
    CONVERSATION_COLUMNS:'conversations-safe',CONVERSATION_MESSAGE_COLUMNS:'messages-safe',SOCIAL_CONNECTION_PUBLIC_COLUMNS:'public-only',
    getServiceAccessToken:()=> 'synthetic-service',normalizeOptionalText:v=>typeof v==='string'&&v.trim()?v.trim():null,
    normalizeUrl:v=>v??null,normalizeMessageType:v=>v,conversationError:message=>({conversation:null,error:new Error(message)}),
    socialConnectionError:message=>({connection:null,error:new Error(message)}),withOptionalSchemaHint:v=>v,
    extractFacebookPageId:v=>{try {const u=new URL(v);return u.searchParams.get('asset_id')??u.searchParams.get('mailbox_id');}catch{return null;}},...extra});return exports;
}

test('real parser/processor keeps two posts and private messages in distinct source threads and provider chronology',async()=>{
 const h=processor();for(const event of [dm(),comment(),comment({post_id:`${PAGE}_102`,comment_id:'102_202'})])await h.processMetaWebhookPayload(event);
 assert.deepEqual(h.calls.writes.map(x=>[x.sourceType,x.externalThreadId]),[['facebook_messages',`${PAGE}:${FAN}`],['facebook_comments',`${PAGE}_101:${FAN}`],['facebook_comments',`${PAGE}_102:${FAN}`]]);
 assert.equal(h.calls.writes[0].receivedAt,new Date(1794564000000).toISOString());
 assert.equal(new URL(h.calls.writes[1].replyTargetUrl).searchParams.get('comment_id'),'201');
 assert.equal(h.calls.writes[1].workspaceId,WORKSPACE);assert.equal(h.calls.queue.length,0);
});
test('invalid envelopes, cross-Page endpoints, receipts and incomplete identities never touch CRM or page lookup',async()=>{
 const invalid=[{...dm(),object:'user'},dm({recipient:{id:'foreign-page'}}),dm({sender:{id:PAGE}}),dm({message:{text:'missing mid'}}),dm({message:undefined,delivery:{mids:['receipt']}}),{object:'page',entry:[{messaging:dm().entry[0].messaging}]}];
 for(const value of invalid){const h=processor();await h.processMetaWebhookPayload(value);assert.equal(h.calls.writes.length,0);assert.equal(h.calls.lookup.length,0);}
});
test('posts, edits, removals, own comments, foreign posts and Page events masquerading as Instagram are ignored',async()=>{
 for(const patch of [{item:'status'},{verb:'edited'},{verb:'remove'},{from:{id:PAGE}},{post_id:'999_101'},{post_id:null},{comment_id:null},{from:null},{item:'status',media_id:'123'}]){
  const h=processor();await h.processMetaWebhookPayload(comment(patch));assert.equal(h.calls.writes.length,0,JSON.stringify(patch));assert.equal(h.calls.lookup.length,0);
 }
 const h=processor();const event=dm();event.entry[0].messaging[0].sender.username='not-platform-authority';await h.processMetaWebhookPayload(event);assert.equal(h.calls.lookup[0][0],'facebook');
});
test('unknown/blocked pages do not borrow a workspace; transient writes and diagnostic failures request retry',async()=>{
 for(const lookup of [{connection:null,error:null},{connection:null,error:null,processingBlocked:true}]){const h=processor({lookup});await h.processMetaWebhookPayload(dm());assert.equal(h.calls.writes.length,0);}
 const retry=processor({persist:()=>({error:new Error('synthetic private error')})});assert.equal((await retry.processMetaWebhookPayload(dm())).errorCode,'message_persist_failed');
 assert.equal((await processor({diagnosticError:new Error('private')}).processMetaWebhookPayload(dm())).errorCode,'diagnostic_persist_failed');
});
test('repeated delivery acknowledges persisted external IDs as duplicates, preserving per-post identity',async()=>{
 const ids=new Set();const h=processor({persist:input=>{const key=`${input.workspaceId}:${input.externalMessageId}`;if(ids.has(key))return {message:{id:key},conversation:null,error:null};ids.add(key);return {message:{id:key},conversation:{id:'conv'},error:null};}});
 assert.equal((await h.processMetaWebhookPayload(comment())).saved,true);
 const repeated=await h.processMetaWebhookPayload(comment());assert.equal(repeated.saved,false);assert.equal(repeated.skipped,true);assert.equal(ids.size,1);
});
test('Page lookup rejects duplicate active mappings and disabled subscription without selecting a secret',async()=>{
 for(const rows of [[],[{workspace_id:WORKSPACE,webhook_subscribed:false}],[{workspace_id:WORKSPACE,webhook_subscribed:true},{workspace_id:'foreign',webhook_subscribed:false}]]){
  let query;const h=declarationHarness(['findMetaSocialConnectionByPageId'],{postgrestSelect:async(...args)=>{query=args;return {data:rows,error:null};},getWorkspaceProcessingEntitlement:()=>assert.fail('ambiguous/disabled must stop before tenant use')});
  const result=await h.findMetaSocialConnectionByPageId('facebook',PAGE);assert.equal(result.connection,null);assert.equal(query[2],'public-only');assert.equal(query[4],2);
 }
});
function threadHarness(rows){let query;const h=declarationHarness(['resolveFacebookMessageThread'],{postgrestSelect:async(...args)=>{query=args;return {data:rows.filter(row=>args[3].every(([k,v])=>row[k]===v)),error:null};}});return {run:()=>h.resolveFacebookMessageThread({workspaceId:WORKSPACE,contactId:CONTACT,pageId:PAGE,senderId:FAN,threadIdentifiers:[`${PAGE}:${FAN}`]}),query:()=>query};}
const privateRow=(patch={})=>({id:'conversation',workspace_id:WORKSPACE,contact_id:CONTACT,source_platform:'facebook',source_type:'facebook_messages',external_thread_id:'t_GRAPH',reply_target_url:`https://business.facebook.com/latest/inbox/messenger?asset_id=${PAGE}&selected_item_id=synthetic`,...patch});
test('webhook reuses verified historic Graph DM; subsequent manual Graph IDs converge on canonical page:sender',async()=>{
 const h=threadHarness([privateRow(),privateRow({workspace_id:'foreign'}),privateRow({source_type:'facebook_comments'})]);assert.equal((await h.run()).threadId,'t_GRAPH');
 const canonical=threadHarness([privateRow({external_thread_id:`${PAGE}:${FAN}`,reply_target_url:null})]);assert.equal((await canonical.run()).threadId,`${PAGE}:${FAN}`);
 const empty=threadHarness([]);assert.equal((await empty.run()).threadId,`${PAGE}:${FAN}`);
 assert.deepEqual(Array.from(h.query()[3],p=>Array.from(p)),[['workspace_id',WORKSPACE],['contact_id',CONTACT],['source_platform','facebook'],['source_type','facebook_messages']]);
});
test('ambiguous, unbound and malicious-URL historic DM mappings fail closed',async()=>{
 for(const rows of [[privateRow(),privateRow({id:'second'})],[privateRow({reply_target_url:null})],[privateRow({reply_target_url:`https://evil.example/?asset_id=${PAGE}`})]])assert.ok((await threadHarness(rows).run()).error);
});
test('equal URLs never merge a different post or private chat into an explicit comment thread',async()=>{
 const url='https://www.facebook.com/synthetic?comment_id=1';const old=[{...privateRow(),status:'open',source_url:url,reply_target_url:url},{...privateRow(),id:'post1',status:'open',source_type:'facebook_comments',external_thread_id:'post1:fan',source_url:url,reply_target_url:url}];let created;
 const h=declarationHarness(['ensureMetaTestConversation'],{postgrestSelect:async(table,token,cols,filters,limit,single)=>{const rows=old.filter(r=>filters.every(([k,v])=>r[k]===v));return {data:single?rows[0]??null:rows,error:null};},postgrestRequest:async(table,method,row)=>{created=row;return {data:{id:'new',...row},error:null};}});
 await h.ensureMetaTestConversation({workspaceId:WORKSPACE,contactId:CONTACT,sourcePlatform:'facebook',sourceType:'facebook_comments',externalThreadId:'post2:fan',sourceUrl:url,replyTargetUrl:url});assert.equal(created.external_thread_id,'post2:fan');
});
test('replay repairs summary from latest persisted data with workspace/contact/conversation filters',async()=>{
 let update;const latest={content:'newer stored message',created_at:'2026-11-13T12:00:00Z'};const h=declarationHarness(['repairMetaConversationSummary'],{postgrestSelect:async(...args)=>{assert.deepEqual(Array.from(args[3].slice(0,3),p=>Array.from(p)),[['workspace_id',WORKSPACE],['contact_id',CONTACT],['conversation_id','conv']]);return {data:latest,error:null};},postgrestUpdate:async(...args)=>{update=args;return {error:null};}});
 assert.equal((await h.repairMetaConversationSummary({workspace_id:WORKSPACE,contact_id:CONTACT,conversation_id:'conv',created_at:'old'})).error,null);assert.equal(update[1].last_message_preview,latest.content);assert.equal(update[1].last_inbound_at,latest.created_at);assert.equal('status' in update[1],false);assert.equal('ai_status' in update[1],false);assert.equal('next_step' in update[1],false);
});
function route(processor){const secret='synthetic-secret-at-least-32-characters';const api=load('src/app/api/webhooks/meta/route.ts',{'@/lib/metaWebhook':{processMetaWebhookPayload:processor},'@/lib/webhookSecurityPolicy.mjs':security},{process:{env:{FACEBOOK_APP_SECRET:secret,FACEBOOK_WEBHOOK_VERIFY_TOKEN:secret}},setTimeout:(fn,ms)=>setTimeout(fn,Math.min(ms,25))});return {api,secret};}
test('actual route verifies challenge and exact HMAC, rejects tampering, and returns redacted retry errors',async()=>{
 let calls=0;const {api,secret}=route(async()=>{calls++;throw Error('never return private provider text');});const body=JSON.stringify(dm());const signature='sha256='+createHmac('sha256',secret).update(body).digest('hex');
 const get=await api.GET(new Request(`https://staging.fanmind.invalid/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=${secret}&hub.challenge=challenge`));assert.equal(await get.text(),'challenge');
 const request=text=>new Request('https://staging.fanmind.invalid/api/webhooks/meta',{method:'POST',headers:{'x-hub-signature-256':signature},body:text});
 assert.equal((await api.POST(request(body+' '))).status,403);assert.equal(calls,0);
 const failure=await api.POST(request(body));assert.equal(failure.status,500);assert.equal((await failure.json()).error,'processing_failed');assert.equal(calls,1);
});
test('actual route bounds chunked/declared oversized and stalled payloads before processing',async()=>{
 const {api}=route(()=>assert.fail('invalid body must not process'));
 const req=body=>new Request('https://staging.fanmind.invalid/api/webhooks/meta',{method:'POST',body,duplex:'half'});
 assert.equal((await api.POST(req('x'.repeat(1000001)))).status,413);
 let cancelled=false;const stalled=new ReadableStream({pull(){},cancel(){cancelled=true;}});assert.equal((await api.POST(req(stalled))).status,400);assert.equal(cancelled,true);
 const declared=new Request('https://staging.fanmind.invalid/api/webhooks/meta',{method:'POST',headers:{'content-length':'1000001'},body:'x'});assert.equal((await api.POST(declared)).status,413);
});

test('actual persistence survives partial summary failure, replay and older new delivery without duplicate or reopened workflow',async()=>{
 const stored=[];let patch={}, failSummary=true, inserts=0;
 const h=declarationHarness(['createMetaTestConversationMessage','repairMetaConversationSummary'],{
  normalizeIsoTimestamp:v=>v,normalizeExcerpt:v=>v,normalizeMessageAttachments:()=>null,normalizeMessageKind:()=> 'text',getDefaultWebhookAuthorLabel:()=> 'Synthetic',
  conversationMessageCreateError:message=>({message:null,conversation:null,error:new Error(message)}),
  findExistingMetaConversationMessage:async input=>({message:stored.find(r=>r.external_message_id===input.externalMessageId)??null,error:null}),
  ensureMetaTestConversation:async()=>({conversation:{id:'conv'},error:null}),
  postgrestRequest:async(table,method,row)=>{inserts++;const data={id:`message-${inserts}`,...row};stored.push(data);return {data,error:null};},
  postgrestSelect:async(table,token,cols,filters)=>({data:stored.filter(r=>filters.every(([k,v])=>r[k]===v)).sort((a,b)=>b.created_at.localeCompare(a.created_at))[0]??null,error:null}),
  postgrestUpdate:async(table,value)=>{if(failSummary){failSummary=false;return {error:new Error('transient summary failure')};}patch=value;return {error:null};},
 });
 const input={workspaceId:WORKSPACE,contactId:CONTACT,sourcePlatform:'facebook',messageType:'dm',sourceType:'facebook_messages',externalThreadId:`${PAGE}:${FAN}`,externalMessageId:'m-new',content:'newer message',receivedAt:'2026-11-13T12:00:00Z'};
 assert.ok((await h.createMetaTestConversationMessage(input)).error);assert.equal(stored.length,1);
 assert.equal((await h.createMetaTestConversationMessage(input)).error,null);assert.equal(stored.length,1);assert.equal(patch.status,undefined);
 const late=await h.createMetaTestConversationMessage({...input,externalMessageId:'m-old',content:'delayed older message',receivedAt:'2026-11-13T11:00:00Z'});
 assert.equal(late.error,null);assert.equal(stored.length,2);assert.equal(patch.last_message_preview,'newer message');assert.equal(patch.last_inbound_at,'2026-11-13T12:00:00Z');assert.equal(patch.status,'open');
});


test('provider-specific HMAC secrets cannot authenticate the other platform; explicit shared META binding can',async()=>{
 const fb='synthetic-facebook-app-secret-at-least-32',ig='synthetic-instagram-app-secret-at-least-32';let calls=0;
 const make=env=>load('src/app/api/webhooks/meta/route.ts',{'@/lib/metaWebhook':{processMetaWebhookPayload:async()=>{calls++;return {eventCount:1,saved:true,skipped:false};}},'@/lib/webhookSecurityPolicy.mjs':security},{process:{env}});
 const request=(payload,secret)=>{const body=JSON.stringify(payload);return new Request('https://staging.fanmind.invalid/api/webhooks/meta',{method:'POST',body,headers:{'x-hub-signature-256':'sha256='+createHmac('sha256',secret).update(body).digest('hex')}});};
 const api=make({FACEBOOK_APP_SECRET:fb,INSTAGRAM_APP_SECRET:ig});
 assert.equal((await api.POST(request(dm(),ig))).status,403);
 assert.equal((await api.POST(request({...dm(),object:'instagram'},fb))).status,403);assert.equal(calls,0);
 assert.equal((await api.POST(request(dm(),fb))).status,200);
 assert.equal((await api.POST(request({...dm(),object:'instagram'},ig))).status,200);
 const shared=make({META_APP_SECRET:fb});assert.equal((await shared.POST(request(dm(),fb))).status,200);assert.equal((await shared.POST(request({...dm(),object:'instagram'},fb))).status,200);
 assert.equal((await shared.POST(request({...dm(),object:'user'},fb))).status,400);assert.equal(calls,4);
});
