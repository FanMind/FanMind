import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultChatAdminSalesPlaybook,normalizeChatAdminSalesPlaybook} from '../src/lib/chatAdminSalesPlaybook.mjs';
import {withMediaPrice,withMediaProductPrice,effectiveMediaPrice,negotiateMediaPrice,buildCatalogueGrounding,assertCatalogueReplyClaims} from '../src/lib/chatAdminMediaCatalogue.mjs';
import {mediaTaxBreakdown} from '../src/lib/chatAdminMediaTerms.mjs';
const id=n=>`11111111-1111-4111-8111-${String(n).padStart(12,'0')}`;
const character={id:id(1),workspace_id:id(2),revision:7,sales_playbook:defaultChatAdminSalesPlaybook()};
const folder={id:id(3),workspace_id:character.workspace_id,character_id:character.id,parent_id:null,kind:'image',name:'Abendkleidung',offer_id:'',price_rules:{negotiation_allowed:true,special_discounts_allowed:false},revision:1};
const terms={scope:'folder',target_id:folder.id,kind:'image',quantity:1,inherit:true,upper_unlimited:true,negotiation_allowed:true,special_discounts_allowed:false,tax_mode:'vat_included',vat_basis_points:2000,unit_seconds:null};
const price={name:'Abendkleidung',start_minor:3500,maximum_discount_percent:10,currency:'EUR',requires_confirmation:false,negotiation_allowed:true,special_discounts_allowed:false};
const saved=withMediaPrice(character,folder.id,price,'',terms);
const who={...character,sales_playbook:saved.playbook},folders=[{...folder,offer_id:saved.offer_id}];
const assets=Array.from({length:3},(_,i)=>({id:id(10+i),workspace_id:who.workspace_id,character_id:who.id,folder_id:folder.id,media_type:'image',offer_id:'',description:'Abendkleidung',tags:['Abendkleidung'],reviewed:true,available:true,deleted:false,revision:i+1}));
const context=JSON.stringify({sales_playbook:{offers:[],requested_offer:null},media_inventory:{status:'unconfirmed'}});
const ground=(c=who,rows=assets,input='Bild Abendkleidung')=>JSON.parse(buildCatalogueGrounding(context,c,null,rows,folders,input,Date.now()));
test('35 EUR single: exact 10% floor, upward negotiation and explicit cap',()=>{
 const binding=effectiveMediaPrice(who,assets[0],folders);
 assert.equal(negotiateMediaPrice(binding,'1 EUR').recommendedPriceMinor,3150);
 assert.equal(negotiateMediaPrice(binding,'45 EUR').recommendedPriceMinor,4500);
 const capped={...binding,offer:{...binding.offer,maximumPriceMinor:4000,mediaTerms:{...binding.offer.mediaTerms,upper_unlimited:false}}};
 assert.equal(negotiateMediaPrice(capped,'50 EUR').recommendedPriceMinor,4000);
 assert.equal(negotiateMediaPrice({...binding,rules:{...binding.rules,negotiation_allowed:false}},'45 EUR').recommendedPriceMinor,3500);
 assert.equal(negotiateMediaPrice({...binding,offer:{...binding.offer,mediaTerms:{...terms,tax_mode:'unconfirmed',vat_basis_points:null}}},'45 EUR'),null);
});
test('package of 3 is 70 EUR, floor 63 EUR, exact files/revisions and no stacked discounts',()=>{
 const playbook=withMediaProductPrice(who,folders,{scope:'folder',target_id:folder.id,kind:'image',quantity:3,terms,price:{...price,start_minor:7000,name:'3 Bilder Abendkleidung'}});
 const result=ground({...who,sales_playbook:playbook},assets,'3 Bilder Abendkleidung für 1 EUR');
 assert.equal(result.sales_playbook.requested_offer.recommendedPriceMinor,6300);
 assert.equal(result.media_pricing.quantity,3);
 assert.equal(result.media_pricing.price_revision,7);
 assert.deepEqual(result.media_pricing.assets,assets.map(a=>({id:a.id,revision:a.revision})));
 assert.equal(result.media_pricing.base_price_minor,7000);
 assert.equal(result.media_pricing.minimum_price_minor,6300);
 for(const patch of [{reviewed:false},{available:false},{deleted:true}])assert.equal(ground({...who,sales_playbook:playbook},[assets[0],assets[1],{...assets[2],...patch}],'3 Bilder Abendkleidung').sales_playbook.requested_offer,null);
 assert.equal(ground(who,assets,'3 Bilder Abendkleidung').sales_playbook.requested_offer,null);
});
test('file overrides folder; inheritance toggle and explicit Model fallback remain deterministic',()=>{
 const child={...folder,id:id(4),parent_id:folder.id,name:'Unterordner'};
 const row={...assets[0],folder_id:child.id};
 assert.equal(effectiveMediaPrice(who,row,[...folders,child]).source,'category');
 const noInheritance={...who,sales_playbook:{...who.sales_playbook,offers:who.sales_playbook.offers.map(o=>({...o,mediaTerms:{...o.mediaTerms,inherit:false}}))}};
 assert.equal(effectiveMediaPrice(noInheritance,row,[...folders,child]),null);
 const defaults=withMediaProductPrice(noInheritance,[...folders,child],{scope:'model',target_id:null,kind:'image',quantity:1,terms,price:{...price,start_minor:1000,name:'Model Bild'}});
 assert.equal(effectiveMediaPrice({...who,sales_playbook:defaults},row,[...folders,child]).source,'model');
 const file=withMediaPrice(who,row.id,{...price,start_minor:5000,name:'Einzeldatei'},'',{...terms,scope:'file',target_id:row.id});
 assert.equal(effectiveMediaPrice({...who,sales_playbook:file.playbook},{...row,offer_id:file.offer_id},[...folders,child]).offer.recommendedPriceMinor,5000);
});
test('approved Abendkleidung inventory also matches the explicit image request Abendkleidern',()=>{
 assert.equal(ground(who,assets,"Bilder in Abendkleidern").media_inventory.status,"verified_match");
});
test('round-trip retains original prices/metadata and tax totals reconcile exactly',()=>{
 assert.deepEqual(normalizeChatAdminSalesPlaybook(JSON.parse(JSON.stringify(saved.playbook))),saved.playbook);
 const offer=saved.playbook.offers[0],tax=mediaTaxBreakdown(offer,3150);
 assert.deepEqual(tax,{currency:'EUR',gross_minor:3150,net_minor:2625,vat_minor:525,mode:'vat_included',vat_basis_points:2000});
 assert.equal(character.sales_playbook.offers.length,0);
 for(const patch of [{quantity:0},{tax_mode:'invented'},{vat_basis_points:NaN},{upper_unlimited:'true'},{target_id:'foreign'}])assert.throws(()=>withMediaPrice(character,folder.id,price,'',{...terms,...patch}));
 for(const patch of [{workspace_id:id(90)},{character_id:id(90)}])assert.throws(()=>ground(who,[{...assets[0],...patch}]));
});
test('video unit prices use actual duration and reject missing durations',()=>{
 const vf={...folder,kind:'video'},vt={...terms,kind:'video',unit_seconds:30};
 const v=withMediaPrice(character,vf.id,price,'',vt),vc={...character,sales_playbook:v.playbook},fs=[{...vf,offer_id:v.offer_id}];
 const video={...assets[0],media_type:'video',duration_ms:31000};
 assert.equal(effectiveMediaPrice(vc,video,fs).offer.recommendedPriceMinor,7000);
 assert.equal(effectiveMediaPrice(vc,{...video,duration_ms:null},fs),null);
});

test('reply cannot change the agreed package quantity at the correct price',()=>{
 assert.doesNotThrow(()=>assertCatalogueReplyClaims(['Die 3 Bilder kosten 63 EUR.'],{quantity:3,special_discounts_allowed:false}));
 for(const reply of ['Die 5 Bilder kosten 63 EUR.','Drei Fotos kosten 63 EUR.'])assert.throws(()=>assertCatalogueReplyClaims([reply],{quantity:1,special_discounts_allowed:false}),/media_quantity_not_grounded/);
});
