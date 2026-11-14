import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {priceSchemaPostflight} from '../scripts/operations/chat-admin-media-prices-schema.mjs';
import {defaultChatAdminSalesPlaybook} from '../src/lib/chatAdminSalesPlaybook.mjs';
import {withMediaPrice,withMediaProductPrice,buildCatalogueGrounding} from '../src/lib/chatAdminMediaCatalogue.mjs';
export async function runMediaPricesSqlCases(sql){
 const w='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',c='cccccccc-cccc-4ccc-8ccc-cccccccccccc',owner='11111111-1111-4111-8111-111111111111',foreign='22222222-2222-4222-8222-222222222222';
 const id=n=>`12345678-1234-4123-8123-${String(n).padStart(12,'0')}`;
 const literal=o=>`'${JSON.stringify(o).replaceAll("'","''")}'::jsonb`;
 const as=(q,user=owner)=>sql(`set role authenticated;set request.jwt.claim.sub='${user}';${q}`);
 await sql(readFileSync('tests/fixtures/chat-admin-current-facts.sql','utf8'));
 await sql(readFileSync('supabase/controlled/20260920230000_chat_admin_multi_character.sql','utf8'));
 await sql(`alter table public.chat_characters add column sales_playbook jsonb not null default '{}';grant update(sales_playbook,updated_at) on public.chat_characters to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;create table public.account_deletion_requests(user_id uuid,status text);`);
 await sql(readFileSync('supabase/controlled/chat_admin_media.sql','utf8'));
 await sql(readFileSync('supabase/controlled/chat_admin_media_catalogue.sql','utf8'));
 await sql(readFileSync('supabase/controlled/20260927200000_chat_admin_character_fans.sql','utf8'));
 const catalogue=readFileSync('scripts/operations/chat-admin-media-runtime-catalogue.sql','utf8');
 const beforeCatalogue=await sql(catalogue);
 await sql(readFileSync('supabase/controlled/chat_admin_media_prices.sql','utf8'));
 await sql(priceSchemaPostflight());
 assert.equal(await sql(catalogue),beforeCatalogue,'price evidence must not invalidate the existing media catalogue');
 for(const drift of ["grant execute on function public.chat_admin_price_write(uuid,uuid,integer,jsonb) to anon;","grant usage on schema fanmind_media_price_evidence to authenticated;","alter table public.chat_characters disable trigger chat_media_price_audit;","alter table fanmind_media_price_evidence.offers disable row level security;"]){
  await assert.rejects(()=>sql(`begin;${drift}${priceSchemaPostflight().replace('BEGIN READ ONLY;','').replace('ROLLBACK;','')}rollback;`));
 }

 await sql(`insert into public.workspace_chat_admin_capabilities(workspace_id,chat_admin_multi_character,granted_to_user_id) values('${w}',true,'${owner}');insert into public.chat_characters(id,workspace_id,created_by_user_id,display_name,public_age,bio,personality,writing_style,emoji_style,sentence_style,flirt_style,sales_rules) values('${c}','${w}','${owner}','Synthetic',25,'','','','','','','');insert into public.chat_character_fans(id,workspace_id,character_id,display_name,platform,creation_id) values('${id(1)}','${w}','${c}','Synthetic','manual','${id(2)}');`);
 const conversationId=(await sql(`select id from public.chat_character_conversations where workspace_id='${w}' and character_id='${c}' and fan_id='${id(1)}';`)).trim();
 const who={id:c,workspace_id:w,revision:1,sales_playbook:defaultChatAdminSalesPlaybook()};
 const terms={scope:'folder',target_id:id(4),kind:'image',quantity:1,inherit:true,upper_unlimited:true,negotiation_allowed:true,special_discounts_allowed:false,tax_mode:'vat_included',vat_basis_points:2000,unit_seconds:null};
 const price={name:'Abendkleidung',start_minor:3500,maximum_discount_percent:10,currency:'EUR',requires_confirmation:false,negotiation_allowed:true,special_discounts_allowed:false};
 const single=withMediaPrice(who,id(4),price,'',terms);
 const folder={id:id(4),workspace_id:w,character_id:c,kind:'image',parent_id:null,name:'Abendkleidung',offer_id:single.offer_id,price_rules:{negotiation_allowed:true,special_discounts_allowed:false},revision:1};
 await sql(`insert into public.chat_character_media_folders(id,workspace_id,character_id,kind,name,offer_id,price_rules) values('${folder.id}','${w}','${c}','image','Abendkleidung','${single.offer_id}',${literal(folder.price_rules)});`);
 const assets=Array.from({length:3},(_,i)=>({id:id(10+i),workspace_id:w,character_id:c,folder_id:folder.id,media_type:'image',offer_id:'',description:'Abendkleidung',tags:['Abendkleidung'],reviewed:true,available:true,deleted:false,revision:1}));
 for(const a of assets)await sql(`insert into public.chat_character_media(id,workspace_id,character_id,folder_id,description,tags,reviewed,available) values('${a.id}','${w}','${c}','${folder.id}','Abendkleidung',array['Abendkleidung'],true,true);`);
 const playbook=withMediaProductPrice({...who,sales_playbook:single.playbook},[folder],{scope:'folder',kind:'image',target_id:folder.id,quantity:3,terms,price:{...price,name:'3 Bilder Abendkleidung',start_minor:7000}});
 const revision=async()=>Number((await sql(`select revision from public.chat_characters where id='${c}';`)).trim());
 const write=rev=>`select public.chat_admin_price_write('${w}','${c}',${rev},${literal(playbook)});`;
 const rev=await revision();assert.match(await as(write(rev)),/t\s*$/u);
 await assert.rejects(()=>as(write(rev)),/stale_media_context/u);
 await assert.rejects(()=>as(write(rev+1),foreign));
 assert.equal((await sql('select count(*) from fanmind_media_price_evidence.revisions;')).trim(),'1');
 for(const role of ['anon','authenticated','service_role'])await assert.rejects(()=>sql(`set role ${role};select * from fanmind_media_price_evidence.revisions;`));
 who.sales_playbook=playbook;who.revision=await revision();
 const binding=JSON.parse(buildCatalogueGrounding(JSON.stringify({sales_playbook:{offers:[],requested_offer:null}}),who,null,assets,[folder],'3 Bilder Abendkleidung für 1 EUR',Date.now())).media_pricing;
 assert.equal(binding.offered_price_minor,6300);
 const record=(b,g=id(30))=>`select public.chat_admin_price_offer_record('${w}','${c}','${id(1)}','${conversationId}','${g}',${who.revision},${literal(b)});`;
 const persist=(b,g=id(30))=>`select public.persist_chat_admin_media_generation('${w}','${c}','${id(1)}','${conversationId}',${who.revision},1,'${g}','{}','Synthetic request',array['63 EUR','63 EUR','63 EUR'],${literal(b)});`;
 for(const patch of [{offered_price_minor:6299},{assets:binding.assets.slice(0,2)},{tax:{...binding.tax,vat_minor:0}},{source_id:id(99)},{workspace_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}]){
  await assert.rejects(()=>as(persist({...binding,...patch})),/invalid_media_offer|stale_media_context/u);
  assert.equal((await sql('select count(*) from public.chat_character_messages;')).trim(),'0','failed quote must roll generation back');
 }
 await as(persist(binding));await as(record(binding));
 assert.equal((await sql('select count(*) from fanmind_media_price_evidence.offers;')).trim(),'1');
 await assert.rejects(()=>as(record(binding),foreign),/owner_required/u);
 await assert.rejects(()=>as(record({...binding,offered_price_minor:6400,tax:{...binding.tax,gross_minor:6400,net_minor:5333,vat_minor:1067}})),/media_offer_conflict/u);
 const original=(await sql('select binding::text from fanmind_media_price_evidence.offers;')).trim();
 await as(`select public.chat_admin_price_write('${w}','${c}',${who.revision},${literal({...playbook,positioning:'Changed price revision'})});`);
 assert.equal((await sql('select binding::text from fanmind_media_price_evidence.offers;')).trim(),original,'historic offer is immutable after edit');
 await assert.rejects(()=>as(record(binding)),/stale_media_context/u);
 await sql('delete from public.chat_character_messages;');
 assert.equal((await sql('select count(*) from fanmind_media_price_evidence.offers;')).trim(),'0','message retention cascades to offer evidence');
 await sql(`delete from public.chat_characters where id='${c}';`);
 assert.equal((await sql('select count(*) from fanmind_media_price_evidence.revisions;')).trim(),'0','Character erase cascades to pricing history');
}
