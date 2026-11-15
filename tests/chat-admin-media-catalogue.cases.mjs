import assert from "node:assert/strict";
import test from "node:test";
import { buildCatalogueGrounding, effectiveMediaPrice, mediaFolderPath, negotiateMediaPrice, normalizeMediaFolder, validateMediaFolders, withMediaPrice, assertCatalogueReplyClaims } from "../src/lib/chatAdminMediaCatalogue.mjs";
import { defaultChatAdminSalesPlaybook } from "../src/lib/chatAdminSalesPlaybook.mjs";
import { assertChatAdminReplySemantics, buildChatAdminCharacterContext } from "../src/lib/chatAdminPolicy.mjs";
import { attachMediaGrounding, assertMediaReplyClaims } from "../src/lib/chatAdminMediaPolicy.mjs";
const id=n=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const w=id(1),c=id(2),rules={negotiation_allowed:true,special_discounts_allowed:false};
const offer={id:"landscape",name:"Landschaft",category:"custom",description:"Ein geprüftes Landschaftsbild",currency:"EUR",minimumPriceMinor:1200,recommendedPriceMinor:2000,maximumPriceMinor:2500,maximumDiscountPercent:40,delivery:"",exclusivity:"",requiresConfirmation:false,active:true};
const character={id:c,workspace_id:w,status:"active",revision:1,sales_playbook:{...defaultChatAdminSalesPlaybook(),offers:[offer]},typical_phrases:[],forbidden_phrases:[],example_messages:[]};
const root={id:id(3),workspace_id:w,character_id:c,parent_id:null,kind:"image",name:"Landschaft",offer_id:offer.id,price_rules:rules,revision:1};
const child={...root,id:id(4),parent_id:root.id,name:"Wald",offer_id:""};
const asset={id:id(5),workspace_id:w,character_id:c,folder_id:child.id,media_type:"image",description:"Wald mit grünen Bäumen",tags:["Wald","grüne Bäume"],offer_id:"",reviewed:true,available:true,deleted:false,revision:1};
const policy={enabled:false,revision:0};
const context=incoming=>attachMediaGrounding(buildChatAdminCharacterContext(character,incoming),character,null,[asset],policy,incoming,Date.now());
const ground=(incoming="Bild im Wald",assets=[asset],folders=[root,child],who=character)=>JSON.parse(buildCatalogueGrounding(context(incoming),who,null,assets,folders,incoming,Date.now()));

test("nested folders preserve kind/scope, reject foreign parents, duplicate names, cycles and depth overflow",()=>{
 assert.equal(validateMediaFolders(character,[root,child]).size,2);assert.equal(mediaFolderPath(child.id,[root,child]),"Landschaft / Wald");
 for(const folders of [[{...root,workspace_id:id(99)}],[{...child,kind:"video"},root],[{...root,parent_id:child.id},child],[root,{...root,id:id(6),name:" landschaft "}],[root,{...child,parent_id:id(99)}]])assert.throws(()=>validateMediaFolders(character,folders));
 const deep=Array.from({length:9},(_,i)=>({...root,id:id(20+i),parent_id:i?id(19+i):null,name:`Ebene ${i}`}));
 assert.doesNotThrow(()=>validateMediaFolders(character,deep.slice(0,8)));assert.throws(()=>validateMediaFolders(character,deep),/media_folder_depth/);
 assert.throws(()=>normalizeMediaFolder({...child,parent_id:child.id},character,[root,child]),/media_folder_cycle/);
 assert.throws(()=>normalizeMediaFolder({...child,revision:0},character,[root,child]),/stale_media_context/);
 assert.throws(()=>normalizeMediaFolder({...child,name:"../anderer"},character,[root,child]));
});
test("prices reference the one Character playbook and have no example defaults",()=>{
 const price={name:"Wald",start_minor:2345,minimum_minor:1900,maximum_minor:null,currency:"EUR",negotiation_allowed:true,special_discounts_allowed:false,requires_confirmation:true};
 const saved=withMediaPrice(character,id(20),price);const created=saved.playbook.offers.find(o=>o.id===saved.offer_id);
 assert.equal(created.recommendedPriceMinor,2345);assert.equal(created.minimumPriceMinor,1900);assert.equal(created.maximumPriceMinor,2345);assert.equal(created.requiresConfirmation,true);
 assert.equal(withMediaPrice(character,id(20),null).offer_id,"");
 for(const patch of [{minimum_minor:2500},{start_minor:0},{currency:"XYZ"},{requires_confirmation:"false"},{start_minor:19.5}])assert.throws(()=>withMediaPrice(character,id(20),{...price,...patch}));
});
test("file price overrides closest ancestor, malformed/inactive overrides never fall back",()=>{
 const parent=effectiveMediaPrice(character,asset,[root,child]);assert.equal(parent.offer.id,"landscape");assert.equal(parent.source_id,root.id);
 const second={...offer,id:"file",recommendedPriceMinor:3000,minimumPriceMinor:3000,maximumPriceMinor:3000};
 const who={...character,sales_playbook:{...character.sales_playbook,offers:[offer,second]}};
 assert.equal(effectiveMediaPrice(who,{...asset,offer_id:"file",price_rules:{negotiation_allowed:false,special_discounts_allowed:false}},[root,child]).offer.recommendedPriceMinor,3000);
 assert.equal(effectiveMediaPrice(who,{...asset,offer_id:"missing"},[root,child]),null);
 assert.equal(effectiveMediaPrice({...who,sales_playbook:{...who.sales_playbook,offers:[offer,{...second,active:false}]}},{...asset,offer_id:"file"},[root,child]),null);
 assert.throws(()=>effectiveMediaPrice(character,{...asset,character_id:id(99)},[root,child]),/media_context_mismatch/);
 assert.throws(()=>effectiveMediaPrice(character,{...asset,media_type:"video"},[root,child]),/media_folder_binding_invalid/);
});
test("counteroffers stay inside minimum, start, currency and approved discount bounds",()=>{
 const binding=effectiveMediaPrice(character,asset,[root,child]);
 for(const [request,expected] of [["15 EUR?",1500],["1 EUR?",1200],["25 EUR?",2000],["EUR 12,50",1250],["18 €",1800],["15 USD?",2000],["15 EUR oder 12 EUR",2000],["5-10 EUR",2000],["50 % Rabatt",2000],["15",2000]])assert.equal(negotiateMediaPrice(binding,request).recommendedPriceMinor,expected,request);
 for(let cents=1;cents<5000;cents+=29){const chosen=negotiateMediaPrice(binding,`${(cents/100).toFixed(2)} EUR`).recommendedPriceMinor;assert.ok(chosen>=1200&&chosen<=2000);}
 assert.equal(negotiateMediaPrice({...binding,rules:{...rules,negotiation_allowed:false}},"12 EUR").recommendedPriceMinor,2000);
 assert.equal(negotiateMediaPrice({...binding,offer:{...offer,requiresConfirmation:true}},"15 EUR"),null);
 assert.equal(negotiateMediaPrice({...binding,offer:{...offer,maximumDiscountPercent:10}},"1 EUR").recommendedPriceMinor,1800);
});
test("only approved real inventory establishes availability; categories and descriptions remain searchable data",()=>{
 const g=ground();assert.equal(g.media_inventory.status,"verified_match");assert.equal(g.sales_playbook.requested_offer.recommendedPriceMinor,2000);assert.equal(g.media_pricing.source,"category");
 assert.equal(ground("Bild im Wald für 15 EUR").sales_playbook.requested_offer.recommendedPriceMinor,1500);
 for(const patch of [{deleted:true},{available:false},{reviewed:false}])assert.equal(ground("Bild im Wald",[{...asset,...patch}]).media_inventory.status,"unconfirmed");
 for(const text of ["Bild am Strand","Bilder?","Video im Wald","Ich will kein Bild im Wald"])assert.equal(ground(text).media_inventory.status,"unconfirmed",text);
 assert.throws(()=>ground("Bild im Wald",[{...asset,workspace_id:id(90)}]),/media_context_mismatch/);
 const uncertain=ground("Bild im Wald",[asset,{...asset,id:id(6),offer_id:"other"}]);assert.equal(uncertain.media_inventory.status,"unconfirmed");
});
test("video matching does not use images or imply image-provider video analysis",()=>{
 const folder={...root,kind:"video"},video={...asset,folder_id:folder.id,media_type:"video",duration_ms:5000};
 const g=ground("Video im Wald",[video],[folder]);assert.equal(g.media_inventory.status,"verified_match");assert.equal(g.media_inventory.matches[0].media_type,"video");assert.equal(g.media_inventory.matches[0].duration_ms,5000);
 assert.equal(ground("Bild im Wald",[video],[folder]).media_inventory.status,"unconfirmed");
});
test("manual confirmation keeps stock truthful but withholds all price authority",()=>{
 const who={...character,sales_playbook:{...character.sales_playbook,offers:[{...offer,requiresConfirmation:true}]}};
 const g=ground("Bild im Wald",[asset],[root,child],who);assert.equal(g.media_inventory.status,"verified_match");assert.equal(g.sales_playbook.requested_offer,null);assert.equal(g.media_pricing.manual_confirmation,true);
});
test("reply guard admits only the server counteroffer; no unauthorized discounts or completed transaction claims",()=>{
 const g=ground("Bild im Wald für 15 EUR"),price=g.sales_playbook.requested_offer;
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Das Wald-Bild kostet 15 EUR.","Für das Wald-Foto sind 15 EUR möglich.","Das Bild gibt es für 15 EUR."],"Bild im Wald für 15 EUR",price));
 for(const amount of ["1 EUR","12 EUR","20 EUR","15 USD"])assert.throws(()=>assertChatAdminReplySemantics([amount,amount,amount],"Bild im Wald für 15 EUR",price));
 for(const reply of ["Du erhältst 50 % Rabatt.","Ich gebe dir das Bild kostenlos.","Deine Zahlung ist eingegangen.","Ich habe es gesendet."])assert.throws(()=>assertCatalogueReplyClaims([reply],g.media_pricing));
 assert.doesNotThrow(()=>assertCatalogueReplyClaims(["Das Bild ist nicht kostenlos."],g.media_pricing));
 assert.throws(()=>assertMediaReplyClaims(["Ich habe ein Foto am Strand."],{status:"unconfirmed",custom:null}));
});

test("QA regressions reject invented video stock, wrong media type and fabricated completed transactions",()=>{
 for(const text of ["Ich habe ein Video am Strand.","Das Video ist vorhanden.","Ich habe einen Clip für dich bereit."])assert.throws(()=>assertCatalogueReplyClaims([text],null,{status:"unconfirmed",matches:[]}),/media_claim_not_grounded/);
 assert.throws(()=>assertCatalogueReplyClaims(["Ich habe ein Foto bereit."],null,{status:"verified_match",matches:[{media_type:"video"}]}),/media_claim_not_grounded/);
 for(const text of ["Deine Zahlung ist angekommen.","Ich habe dir das Video gesendet.","Das Video wurde versendet.","Dein Kauf ist bestätigt.","Du hast bezahlt, hier ist dein Video."])assert.throws(()=>assertCatalogueReplyClaims([text],null),/media_transaction_not_confirmed/);
});

test("bare counteroffer binds only the latest manually used scoped current-revision offer",()=>{
 const fan={id:id(40),workspace_id:w,character_id:c,notes:"",customer_tier:"blue"};
 const history=[{id:id(41),workspace_id:w,character_id:c,fan_id:fan.id,conversation_id:id(43),character_revision:1,direction:"fan_inbound",content:"Bild im Wald"},{id:id(42),workspace_id:w,character_id:c,fan_id:fan.id,conversation_id:id(43),character_revision:1,direction:"confirmed_reply",content:"Landschaft kostet 20 EUR."}];
 const base=JSON.parse(context("15 EUR?"));base.conversation={id:id(43),recent_messages:history};
 const run=rows=>JSON.parse(buildCatalogueGrounding(JSON.stringify(base),character,fan,[asset],[root,child],"15 EUR?",Date.now(),rows));
 assert.equal(run(history).sales_playbook.requested_offer.recommendedPriceMinor,1500);
 for(const rows of [[{...history[0]}, {...history[1],content:"Landschaft biete ich dir nicht an."}],[{...history[0]}, {...history[1],content:"Nein, Landschaft gibt es nicht für dich."}],[{...history[0]}, {...history[1],content:"Landschaft nicht für 20 EUR."}],[{...history[0]}, {...history[1],character_revision:0}],[{...history[0]}, {...history[1],direction:"suggested_reply"}],[...history,{...history[0],id:id(44),content:"Anderes Thema"}],[{...history[0],workspace_id:id(99)},history[1]]])assert.equal(run(rows).sales_playbook.requested_offer,null);
});

test("local negative stock and transaction statements remain allowed without masking a following positive claim",()=>{
 for(const text of ["Ich habe kein passendes Video.","Ich kann kein Video anbieten."])assert.doesNotThrow(()=>assertCatalogueReplyClaims([text],null,{status:"unconfirmed",matches:[]}));
 for(const text of ["Ich habe das Video nicht geschickt.","Ich habe dir das Video noch nicht geschickt."])assert.doesNotThrow(()=>assertCatalogueReplyClaims([text],null));
 assert.throws(()=>assertCatalogueReplyClaims(["Ich habe kein Video, aber ich habe einen Clip bereit."],null,{status:"unconfirmed",matches:[]}),/media_claim_not_grounded/);
});
