import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertChatAdminCharacterInput, assertChatAdminReplySemantics, buildChatAdminFanContext } from "../src/lib/chatAdminPolicy.mjs";
import { CHAT_ADMIN_OFFER_CATEGORIES, defaultChatAdminSalesPlaybook, normalizeChatAdminSalesPlaybook, resolveChatAdminRequestedOffer } from "../src/lib/chatAdminSalesPlaybook.mjs";

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
 assert.throws(()=>assertChatAdminReplySemantics(["Das kostet fünfundzwanzig Euro","Gern","Klar"],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 assert.throws(()=>assertChatAdminReplySemantics(["Das kostet 25.-","Gern","Klar"],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Ich schicke dir 1 Nachricht.","Gern","Klar"],"Wie viele Nachrichten?",null));
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Du bist VIP für mich.","Gern","Klar"],"Was denkst du über mich?",null));
 assert.throws(()=>assertChatAdminReplySemantics(["Das kostet fünfundzwanzig EUR","Gern","Klar"],"Ich will ein privates Foto",null),/reply_price_not_permitted/u);
 const requested=resolveChatAdminRequestedOffer(playbook(),"Ich will ein privates Foto").requestedOffer;
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Ein privates Foto bekommst du für 25 EUR.","Das kann ich dir anbieten.","Sehr gern."],"Ich will ein privates Foto",requested));
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
 assert.match(client,/Kopieren und verwenden/u);assert.doesNotMatch(client,/Als manuell gesendet bestätigen/u);
 assert.match(styles,/\.characterEditor\{min-height:0;max-height:calc\(100% - 32px\);overflow-y:auto/u);
});
