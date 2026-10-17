import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertChatAdminCharacterInput, assertChatAdminReplySemantics, buildChatAdminCharacterContext, buildChatAdminFanContext } from "../src/lib/chatAdminPolicy.mjs";
import { CHAT_ADMIN_OFFER_CATEGORIES, defaultChatAdminSalesPlaybook, normalizeChatAdminSalesPlaybook, resolveChatAdminRequestedOffer } from "../src/lib/chatAdminSalesPlaybook.mjs";

import { writeChatAdminKnowledge } from "../src/lib/chatAdminKnowledge.mjs";

const workspace="11111111-1111-4111-8111-111111111111";
const otherWorkspace="22222222-2222-4222-8222-222222222222";
const characterId="33333333-3333-4333-8333-333333333333";
const fanId="44444444-4444-4444-8444-444444444444";
const conversationId="55555555-5555-4555-8555-555555555555";
const prices={photo:1000,video:2000,private_photo:2500,private_video:4000};
const offer=(definition,price)=>({id:definition.id,name:definition.name,category:definition.category,description:"",currency:"EUR",minimumPriceMinor:price,recommendedPriceMinor:price,maximumPriceMinor:price,maximumDiscountPercent:0,delivery:"",exclusivity:"",requiresConfirmation:false,active:true});
function playbook(patch={}){const value=defaultChatAdminSalesPlaybook();value.offers=CHAT_ADMIN_OFFER_CATEGORIES.map(definition=>offer(definition,prices[definition.category]));return {...value,...patch};}
function character(overrides={}){return {id:characterId,workspace_id:workspace,revision:1,status:"active",display_name:"Ada",public_age:25,bio:"Bio",location:null,languages:["Deutsch"],personality:"warm",writing_style:"kurz",emoji_style:"sparsam",sentence_style:"kurz",typical_phrases:[],forbidden_phrases:[],flirt_style:"spielerisch",sales_rules:"kein Druck",sales_playbook:playbook(),example_messages:[],...overrides};}

for(const definition of CHAT_ADMIN_OFFER_CATEGORIES)test(`${definition.name} price saves and reloads in the #1099 playbook shape`,()=>{
 const normalized=normalizeChatAdminSalesPlaybook(JSON.parse(JSON.stringify(playbook())));
 const reloaded=JSON.parse(JSON.stringify(normalized));
 const saved=reloaded.offers.find(item=>item.category===definition.category);
 assert.equal(saved.currency,"EUR");
 assert.equal(saved.recommendedPriceMinor,prices[definition.category]);
});

test("ChatAdmin accepts only the four two-decimal currencies exposed by the editor",()=>{
 const unsupported=playbook();unsupported.offers[0]={...unsupported.offers[0],currency:"JPY"};
 assert.throws(()=>normalizeChatAdminSalesPlaybook(unsupported),/unsupported_chat_admin_currency/u);
});

test("Character validation persists structured offers separately from supplemental sales rules",()=>{
 const input=character();delete input.id;delete input.workspace_id;delete input.revision;
 const saved=assertChatAdminCharacterInput(input);
 const reloaded=JSON.parse(JSON.stringify(saved));
 assert.equal(reloaded.sales_rules,"kein Druck");
 assert.deepEqual(reloaded.sales_playbook,normalizeChatAdminSalesPlaybook(playbook()));
});

test("private photo intent resolves only the bound Character price",()=>{
 const fan={id:fanId,workspace_id:workspace,character_id:characterId,status:"active",display_name:"Sam",handle:null,platform:"OnlyFans",language:"Deutsch",summary:"mag klare Angebote",notes:"kein Druck"};
 const conversation={id:conversationId,workspace_id:workspace,character_id:characterId,fan_id:fanId};
 const context=JSON.parse(buildChatAdminFanContext(character(),fan,conversation,[],"Ich will ein privates Foto von dir"));
 assert.equal(context.sales_playbook.requested_offer.category,"private_photo");
 assert.equal(context.sales_playbook.requested_offer.recommendedPriceMinor,2500);
 assert.equal(context.sales_playbook.requested_offer.currency,"EUR");
 assert.deepEqual(context.sales_playbook.offers.map(item=>item.category),["private_photo"]);
 assert.doesNotMatch(JSON.stringify(context.sales_playbook),/4000/u);
});

test("media compliments do not release prices, while explicit requests still do",()=>{
 for(const incoming of ["hallo süße nette fotos hast du da","Deine Videos sind toll","Beautiful photos!","Really nice clips"]){
  const result=resolveChatAdminRequestedOffer(playbook(),incoming);
  assert.equal(result.requestedOffer,null,incoming);
  assert.deepEqual(result.playbook.offers,[]);
  assert.throws(()=>assertChatAdminReplySemantics(["Das Foto kostet 10 EUR","Danke dir","Freut mich"],incoming,result.requestedOffer),/reply_price_not_permitted/u);
 }
 for(const [incoming,category] of [["Schöne Fotos, was kosten sie?","photo"],["Ich möchte ein schönes privates Foto","private_photo"],["Kann ich ein schönes privates Foto haben?","private_photo"],["Darf ich deine schönen Fotos sehen?","photo"],["Nice video, how much is it?","video"],["Could I get a nice private video?","private_video"],["Send me a nice private video","private_video"],["privates Foto","private_photo"]]){
  assert.equal(resolveChatAdminRequestedOffer(playbook(),incoming).requestedOffer.category,category,incoming);
 }
});

test("a fan-invented price stays untrusted while all three replies use the bound offer price",()=>{
 const incoming="Ist dein privates Foto für 999 EUR erhältlich?";
 const requested=resolveChatAdminRequestedOffer(playbook(),incoming).requestedOffer;
 assert.equal(requested.recommendedPriceMinor,2500);
 const context=JSON.parse(buildChatAdminCharacterContext(character(),incoming));
 assert.equal(context.incoming_message,"Ist dein privates Foto für [vom Fan genannter, unbestätigter Preis] erhältlich?");
 assert.doesNotMatch(context.incoming_message,/999|EUR/u);
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Das private Foto kostet 25 EUR.","Für 25 EUR ist es erhältlich.","Der Preis ist 25 EUR."],incoming,requested));
 assert.throws(()=>assertChatAdminReplySemantics(["Nicht für 999 EUR, sondern für 25 EUR.","Für 25 EUR ist es erhältlich.","Der Preis ist 25 EUR."],incoming,requested),error=>error?.code==="reply_price_not_permitted");
});

test("different Characters retain different prices and foreign workspace context fails closed",()=>{
 const second=playbook();second.offers=second.offers.map(item=>item.category==="private_photo"?{...item,recommendedPriceMinor:6100,minimumPriceMinor:6100,maximumPriceMinor:6100}:item);
 assert.equal(resolveChatAdminRequestedOffer(character().sales_playbook,"privates Foto").requestedOffer.recommendedPriceMinor,2500);
 assert.equal(resolveChatAdminRequestedOffer(second,"privates Foto").requestedOffer.recommendedPriceMinor,6100);
 const fan={id:fanId,workspace_id:otherWorkspace,character_id:characterId,status:"active"};
 assert.throws(()=>buildChatAdminFanContext(character(),fan,{},[],"privates Foto"),/fan_unavailable/u);
});

test("missing offers expose no price and provider prices must match the selected Character offer exactly",()=>{
 const missing=resolveChatAdminRequestedOffer(defaultChatAdminSalesPlaybook(),"Ich will ein privates Foto");
 assert.equal(missing.requestedOffer,null);
 assert.deepEqual(missing.playbook.offers,[]);
 const confirmation=playbook();confirmation.offers=confirmation.offers.map(item=>item.category==="private_photo"?{...item,requiresConfirmation:true}:item);
 assert.equal(resolveChatAdminRequestedOffer(confirmation,"Ich will ein privates Foto").requestedOffer,null);
 assert.throws(()=>assertChatAdminReplySemantics(["Das kostet 25 EUR","Gern","Klar"],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 assert.throws(()=>assertChatAdminReplySemantics(["Das kostet 100 JPY","Gern","Klar"],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 assert.throws(()=>assertChatAdminReplySemantics(["JPY 100 ist zu viel","Gern","Klar"],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 assert.throws(()=>assertChatAdminReplySemantics(["Das kostet 100 jpy.","Gern","Klar"],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 assert.throws(()=>assertChatAdminReplySemantics(["100 jpy","hundred jpy","Klar"],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 assert.throws(()=>assertChatAdminReplySemantics(["That costs 100 rub.","Das kostet 100 cop.","That costs one hundred rub."],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 assert.throws(()=>assertChatAdminReplySemantics(["Für 25 RUB gehört es dir.","100 COP","RUB 100"],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 assert.throws(()=>assertChatAdminReplySemantics(["Für 25 TRY gehört es dir.","Price: 25 TRY","Nur 25 ALL."],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 assert.throws(()=>assertChatAdminReplySemantics(["Das kostet hundert JPY.","That costs one hundred JPY.","Klar"],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 assert.throws(()=>assertChatAdminReplySemantics(["Das kostet fünfundzwanzig Euro","Gern","Klar"],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 assert.throws(()=>assertChatAdminReplySemantics(["Das kostet 25.-","Gern","Klar"],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 assert.throws(()=>assertChatAdminReplySemantics(["Das kostet 25.–","Gern","Klar"],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Ich schicke dir 1 Nachricht.","Gern","Klar"],"Wie viele Nachrichten?",null));
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Du bist VIP für mich.","Gern","Klar"],"Was denkst du über mich?",null));
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Wir sind VIP 1.","USA 1 ist weit.","Klar"],"Erzähl mir etwas",null));
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Let's try something playful.","That's all for now.","I'm mad about that."],"Tell me more",null));
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["This is top.","Fr. Müller ist nett.","Klar"],"Tell me more",null));
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Let's try 2 playful ideas.","All 2 photos are ready.","Top 3 ideas work."],"Tell me more",null));
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["ALL GOOD","BAM 2 ideas","2 CUP portions"],"Tell me more",null));
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["I know 2 cop friends.","Rub 2 spots gently.","Send one SOS message."],"Tell me more",null));
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Use one mop.","Klar","Gern"],"Tell me more",null));
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Für dich 2 Fotos.","Das gilt für 2 Tage.","Nur 1 Nachricht."],"Wie sieht es aus?",null));
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Für dich 2 private Fotos.","Das gilt für 2 schöne Tage.","Nur 1 kurze Nachricht."],"Wie sieht es aus?",null));
 assert.throws(()=>assertChatAdminReplySemantics(["Das kostet fünfundzwanzig EUR","Gern","Klar"],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 assert.throws(()=>assertChatAdminReplySemantics(["Ich nehme 30 eur.","Gern","Klar"],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 assert.throws(()=>assertChatAdminReplySemantics(["That costs twenty EUR.","Gern","Klar"],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 assert.throws(()=>assertChatAdminReplySemantics(["Das kostet einundzwanzig EUR.","Gern","Klar"],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 assert.throws(()=>assertChatAdminReplySemantics(["Das sind 30 euros.","Gern","Klar"],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 const requested=resolveChatAdminRequestedOffer(playbook(),"Ich will ein privates Foto").requestedOffer;
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Ein privates Foto bekommst du für 25 EUR.","Das kann ich dir anbieten.","Sehr gern."],"Ich will ein privates Foto",requested));
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Ein privates Foto bekommst du für 25 eur.","Das kann ich dir anbieten.","Sehr gern."],"Ich will ein privates Foto",requested));
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Das sind 25 euros.","Das kann ich dir anbieten.","Sehr gern."],"Ich will ein privates Foto",requested));
 assert.throws(()=>assertChatAdminReplySemantics(["Ich nehme 30 eur.","Gern","Klar"],"Ich will ein privates Foto",requested),/reply_price_not_permitted/u);
 const chf=playbook();chf.offers=chf.offers.map(item=>item.category==="private_photo"?{...item,currency:"CHF"}:item);
 const requestedChf=resolveChatAdminRequestedOffer(chf,"Ich will ein privates Foto").requestedOffer;
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Das private Foto kostet Fr. 25.","Gern","Klar"],"Ich will ein privates Foto",requestedChf));
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Das private Foto kostet 25,00 €.","Das kann ich dir anbieten.","Sehr gern."],"Ich will ein privates Foto",requested));
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Das private Foto kostet 25 Euro.","Das kann ich dir anbieten.","Sehr gern."],"Ich will ein privates Foto",requested));
 assert.throws(()=>assertChatAdminReplySemantics(["Für 25 JPY gehört es dir.","Gern","Klar"],"Ich will ein privates Foto",requested),/reply_price_not_permitted/u);
 assert.throws(()=>assertChatAdminReplySemantics(["Für 30 EUR gehört es dir.","Gern","Klar"],"Ich will ein privates Foto",requested),/reply_price_not_permitted/u);
 assert.throws(()=>assertChatAdminReplySemantics(["Für dich nur 25.","Gern","Klar"],"Ich will ein privates Foto",requested),/reply_price_not_permitted/u);
});

test("the controlled migration adds one Character-bound playbook without replacing sales_rules",async()=>{
 const sql=await readFile(new URL("../supabase/controlled/20261007190000_chat_admin_structured_offers.sql",import.meta.url),"utf8");
 assert.match(sql,/alter table public\.chat_characters[\s\S]*add column sales_playbook jsonb not null/u);
 assert.match(sql,/creator_sales_playbooks\.rules/u);
 assert.doesNotMatch(sql,/create table public\.(?:creator_sales_playbooks|chat_character_prices)/u);
 assert.doesNotMatch(sql,/drop column sales_rules/u);
});

test("existing Recommended/Softer/Stronger, combined use action and Character scrolling contracts remain intact",async()=>{
 const [instructions,client,styles]=await Promise.all([
  import("../src/lib/chatAdminPolicy.mjs"),
  readFile(new URL("../src/app/chatadmin/ChatAdminClient.tsx",import.meta.url),"utf8"),
  readFile(new URL("../src/app/chatadmin/chatadmin.module.css",import.meta.url),"utf8"),
 ]);
 assert.match(instructions.CHAT_ADMIN_REPLY_INSTRUCTIONS,/empfohlen\/natürlich, weicher\/spielerischer, stärker\/direkter/u);
 assert.match(instructions.CHAT_ADMIN_REPLY_INSTRUCTIONS,/Wiederhole ihn in keiner Variante[\s\S]*in allen drei Varianten ausschließlich/u);
 assert.match(client,/Kopieren und verwenden/u);assert.doesNotMatch(client,/Als manuell gesendet bestätigen/u);
 assert.match(styles,/\.characterEditor\{min-height:0;max-height:calc\(100% - 32px\);overflow-y:auto/u);
});


test("custom names resolve literally and only on requests; ambiguous offers expose no prices",()=>{
 const custom=offer({id:"summer",name:"Sommerpaket (VIP+)",category:"custom"},3700);
 const own=playbook({offers:[custom]});
 assert.equal(resolveChatAdminRequestedOffer(own,"Was kostet Sommerpaket (VIP+)?").requestedOffer.id,"summer");
 assert.equal(resolveChatAdminRequestedOffer(own,"Sommerpaket (VIP+)").requestedOffer.recommendedPriceMinor,3700);
 for(const text of ["Mein Sommerpaket (VIP+) ist schon angekommen","Sommerpaket VIP","Sommerpaket (VIP+) ist toll"])
  assert.equal(resolveChatAdminRequestedOffer(own,text).requestedOffer,null,text);
 for(const patch of [{active:false},{requiresConfirmation:true}])
  assert.equal(resolveChatAdminRequestedOffer(playbook({offers:[{...custom,...patch}]}),"Was kostet Sommerpaket (VIP+)?").requestedOffer,null);
 const duplicate={...custom,id:"summer_other",recommendedPriceMinor:3900,maximumPriceMinor:3900};
 assert.equal(resolveChatAdminRequestedOffer(playbook({offers:[custom,duplicate]}),"Was kostet Sommerpaket (VIP+)?").requestedOffer,null);
 const extra={...custom,id:"winter",name:"Winterpaket"};
 assert.equal(resolveChatAdminRequestedOffer(playbook({offers:[custom,extra]}),"Was kosten Sommerpaket (VIP+) und Winterpaket?").requestedOffer,null);
 assert.equal(resolveChatAdminRequestedOffer(playbook({offers:[custom,extra]}),"Was kostet ein Video?").requestedOffer,null);
});

test("generic media requests never substitute a public offer for private media or select among several prices",()=>{
 const video=playbook().offers.find(item=>item.category==="video");
 assert.equal(resolveChatAdminRequestedOffer(playbook({offers:[video]}),"Ich möchte ein privates Video").requestedOffer,null);
 assert.equal(resolveChatAdminRequestedOffer(playbook(),"Was kosten Fotos und Videos?").requestedOffer,null);
 const alternate={...video,id:"video_other",name:"Reiseclip"};
 assert.equal(resolveChatAdminRequestedOffer(playbook({offers:[video,alternate]}),"Was kostet ein Clip?").requestedOffer,null);
 assert.equal(resolveChatAdminRequestedOffer(playbook({offers:[video,alternate]}),"Was kostet Reiseclip?").requestedOffer.id,"video_other");
});


test("article descriptions save, clear and reach only the selected server-owned offer",()=>{
 const own=playbook();own.offers[0].description="5 Landschaftsfotos im digitalen Set.";
 own.offers[1].description="VIDEO CONTENT MUST NOT LEAK";
 const saved=assertChatAdminCharacterInput(character({sales_playbook:own}));
 const reloaded=JSON.parse(JSON.stringify(saved.sales_playbook));
 assert.equal(reloaded.offers[0].description,"5 Landschaftsfotos im digitalen Set.");
 const context=JSON.parse(buildChatAdminCharacterContext(character({sales_playbook:reloaded}),"Ich möchte Fotos"));
 assert.equal(context.sales_playbook.requested_offer.description,"5 Landschaftsfotos im digitalen Set.");
 assert.doesNotMatch(JSON.stringify(context),/VIDEO CONTENT MUST NOT LEAK/u);
 reloaded.offers[0].description="";assert.equal(normalizeChatAdminSalesPlaybook(reloaded).offers[0].description,"");
 reloaded.offers[0].description="x".repeat(401);assert.throws(()=>normalizeChatAdminSalesPlaybook(reloaded));
});

function followUpFixture(){
 const own=playbook();own.offers[0].description="5 Landschaftsfotos im digitalen Set.";
 const c=character({sales_playbook:own});
 const fan={id:fanId,workspace_id:workspace,character_id:characterId,status:"active",display_name:"Sam",notes:"",summary:""};
 const conversation={id:conversationId,workspace_id:workspace,character_id:characterId,fan_id:fanId};
 const row={workspace_id:workspace,character_id:characterId,fan_id:fanId,conversation_id:conversationId,created_at:"2026-10-14T12:00:00Z"};
 const messages=[{...row,id:"inbound-photo",direction:"fan_inbound",content:"Bekomme ich Fotos von dir?"},{...row,id:"confirmed-photo",direction:"confirmed_reply",content:"Ja, Fotos bekommst du für 10 EUR."}];
 const context=(incoming="Was bekomme ich da?",history=messages,max=80000)=>JSON.parse(buildChatAdminFanContext(c,fan,conversation,history,incoming,max));
 return {own,c,fan,conversation,row,messages,context};
}
test("content follow-up uses the nearest confirmed photo exchange and current article details",()=>{
 const f=followUpFixture();const context=f.context();
 assert.equal(context.incoming_message,"Was bekomme ich da?");
 assert.equal(context.sales_playbook.requested_offer.id,"photo");
 assert.equal(context.sales_playbook.requested_offer.description,"5 Landschaftsfotos im digitalen Set.");
 f.own.offers[0].recommendedPriceMinor=1500;f.own.offers[0].maximumPriceMinor=1500;
 assert.equal(f.context().sales_playbook.requested_offer.recommendedPriceMinor,1500,"old conversation prices cannot override the current article");
 const explicit=f.context("Ich möchte ein Video");assert.equal(explicit.sales_playbook.requested_offer.id,"video");
});
test("unused drafts, newer topics and ambiguous or unavailable articles cannot bind a follow-up",()=>{
 const f=followUpFixture();
 for(const history of [[],[f.messages[0],{...f.messages[1],direction:"suggested_reply"}],[...f.messages,{...f.row,id:"new-topic",direction:"fan_inbound",content:"Ich liebe Musik"}], [f.messages[0],{...f.messages[1],content:"Ich möchte ein Video anbieten"}]])assert.equal(f.context("Was bekomme ich da?",history).sales_playbook.requested_offer,null);
 assert.equal(f.context("Wie war dein Tag?").sales_playbook.requested_offer,null);
 f.own.offers.push({...f.own.offers[0],id:"other-photo",name:"Anderes Foto"});assert.equal(f.context().sales_playbook.requested_offer,null);
 f.own.offers.pop();f.own.offers[0].requiresConfirmation=true;assert.equal(f.context().sales_playbook.requested_offer,null);
 f.own.offers[0].requiresConfirmation=false;f.own.offers[0].active=false;assert.equal(f.context().sales_playbook.requested_offer,null);
});
test("follow-up preserves sales holds, tenant boundaries and the retained-history budget",()=>{
 const f=followUpFixture();
 f.fan.notes=writeChatAdminKnowledge({commercial:{salesHold:true}});assert.equal(f.context().sales_playbook.requested_offer,null);assert.equal(f.context().sales_strategy.sellNow,false);
 f.fan.notes="";
 assert.throws(()=>f.context("Was bekomme ich da?",[{...f.messages[0],fan_id:"foreign"},f.messages[1]]),/message_context_mismatch/u);
 const full=f.context();const bounded=f.context("Was bekomme ich da?",f.messages,JSON.stringify(full).length-200);
 assert.equal(bounded.sales_playbook.requested_offer,null,"excluded source turns cannot authorize an article");
});


test("video calls never inherit a recorded video article or its price",()=>{
 for(const request of ["Ich möchte Video telefonieren","Was kostet ein Video Telefonat?","Kann ich einen privaten Video Call bekommen?","Video Chat bitte"]){assert.equal(resolveChatAdminRequestedOffer(playbook(),request).requestedOffer,null,request);}
 assert.equal(resolveChatAdminRequestedOffer(playbook(),"Ich möchte ein Video").requestedOffer.id,"video");
 const own=playbook();own.offers.push(offer({id:"call",name:"Videoanruf",category:"custom"},5000));
 assert.equal(resolveChatAdminRequestedOffer(own,"Ich möchte einen Videoanruf").requestedOffer.id,"call");
});

test("explicit current refusals never release an article or a price, including mixed wishes",()=>{
 for(const incoming of ["Ich möchte kein Foto, nur reden.","Keine Videos bitte.","Ich möchte nichts kaufen.","Bitte keine Angebote mehr.",
  "Kein privates Foto, aber ein normales Bild.","I don't want a video, just chat.","I don’t want a private photo.",
  "Ich will nicht Privates Foto.","Privates Foto bitte nicht.","NO VIDEO PLEASE", "Ich möchte kein Foto. Was kostet Privates Foto?"]){
  const result=resolveChatAdminRequestedOffer(playbook(),incoming);
  assert.equal(result.requestedOffer,null,incoming);assert.deepEqual(result.playbook.offers,[],incoming);
  assert.throws(()=>assertChatAdminReplySemantics(["Das kostet 25 EUR.","Gern.","Klar."],incoming,result.requestedOffer),/reply_price_not_permitted/u);
 }
 const custom=offer({id:"summer",name:"Sommerpaket",category:"custom"},3700);
 assert.equal(resolveChatAdminRequestedOffer(playbook({offers:[custom]}),"Sommerpaket bitte nicht.").requestedOffer,null);
 for(const [incoming,id] of [["Ich möchte ein Foto.","photo"],["Privates Foto","private_photo"],["Videos bitte.","video"]]){
  assert.equal(resolveChatAdminRequestedOffer(playbook(),incoming).requestedOffer.id,id,incoming);
 }
 const nocturne=offer({id:"nocturne",name:"Nocturne",category:"custom"},3700);
 assert.equal(resolveChatAdminRequestedOffer(playbook({offers:[nocturne]}),"Was kostet Nocturne?").requestedOffer.id,"nocturne");
});

test("current refusal overrides confirmed offer dialogue without inventing a persistent event",()=>{
 const fan={id:fanId,workspace_id:workspace,character_id:characterId,status:"active",notes:"",display_name:"Synthetic"};
 const conversation={id:conversationId,workspace_id:workspace,character_id:characterId,fan_id:fanId};
 const rows=[{id:"request",direction:"fan_inbound",content:"Ich möchte ein privates Foto."},{id:"confirmed",direction:"confirmed_reply",content:"Privates Foto kostet 25 EUR."}];
 const bind=items=>items.map(row=>({...row,workspace_id:workspace,character_id:characterId,fan_id:fanId,conversation_id:conversationId}));
 for(const incoming of ["Privates Foto bitte nicht.","Kein privates Foto, aber ein normales Bild.","Bitte keine Angebote mehr."]){
  for(const commercial of [{},{salesHold:true}]){
   const currentFan={...fan,notes:writeChatAdminKnowledge({commercial})};
   const context=JSON.parse(buildChatAdminFanContext(character(),currentFan,conversation,bind(rows),incoming));
   assert.equal(context.sales_playbook.requested_offer,null);assert.deepEqual(context.sales_playbook.offers,[]);
   assert.equal(context.sales_strategy.sellNow,false);assert.equal(context.style.writing,"kurz");
   assert.equal(currentFan.notes,writeChatAdminKnowledge({commercial}));
  }
 }
 const refused=bind([{id:"denied",direction:"fan_inbound",content:"Privates Foto bitte nicht."},{id:"bad-confirmed",direction:"confirmed_reply",content:"Privates Foto kostet 25 EUR."}]);
 const later=JSON.parse(buildChatAdminFanContext(character(),fan,conversation,refused,"Was bekomme ich da?"));
 assert.equal(later.sales_playbook.requested_offer,null);assert.equal(later.sales_strategy.sellNow,false);
 assert.throws(()=>buildChatAdminFanContext(character(),{...fan,workspace_id:otherWorkspace},conversation,bind(rows),"Kein Foto"),/fan_unavailable/u);
});
