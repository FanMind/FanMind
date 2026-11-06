import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import sharp from "sharp";
import * as policy from "../src/lib/chatAdminMediaPolicy.mjs";
import { defaultChatAdminSalesPlaybook } from "../src/lib/chatAdminSalesPlaybook.mjs";
import { assertChatAdminReplySemantics, buildChatAdminCharacterContext } from "../src/lib/chatAdminPolicy.mjs";
import { writeChatAdminKnowledge, readChatAdminKnowledge } from "../src/lib/chatAdminKnowledge.mjs";
import { buildChatAdminModelRequest } from "../src/lib/chatAdminModelPolicy.mjs";

const character={id:"11111111-1111-4111-8111-111111111111",workspace_id:"22222222-2222-4222-8222-222222222222",revision:1,status:"active",sales_playbook:defaultChatAdminSalesPlaybook(),typical_phrases:[],forbidden_phrases:[],example_messages:[]};
const offer={id:"custom",name:"Anfertigung",category:"custom",description:"Ein neues Foto",currency:"EUR",minimumPriceMinor:2500,recommendedPriceMinor:2500,maximumPriceMinor:2500,maximumDiscountPercent:0,delivery:"",exclusivity:"",active:true,requiresConfirmation:false};
character.sales_playbook.offers=[offer];
const asset={id:"33333333-3333-4333-8333-333333333333",workspace_id:character.workspace_id,character_id:character.id,revision:2,description:"Strand im Hintergrund",tags:["Strand"],folder:"Sommer",offer_id:"custom",reviewed:true,available:true,deleted:false};
const custom={enabled:true,offer_id:"custom",delivery_hours:24,motifs:["Strand"],requires_confirmation:false};
const ground=(assets=[asset],settings=custom,incoming="Hast du ein Bild am Strand?",requested=null)=>policy.buildMediaGrounding(character,assets,settings,incoming,requested);

test("only reviewed, available, nondeleted Character media establishes a match",()=>{
 assert.equal(ground().status,"verified_match");
 for(const patch of [{reviewed:false},{available:false},{deleted:true},{tags:["Wald"]}])assert.equal(ground([{...asset,...patch}]).status,"unconfirmed");
 for(const patch of [{workspace_id:crypto.randomUUID()},{character_id:crypto.randomUUID()}])assert.throws(()=>ground([{...asset,...patch}]),/media_context_mismatch/u);
 assert.throws(()=>ground(Array(101).fill(asset)),/media_context_mismatch/u);
});
test("all motif constraints are required and oversized requests never truncate into a match",()=>{
 assert.equal(ground([asset],custom,"Hast du ein Bild am Strand mit rotem Kleid?").status,"unconfirmed");
 const tags=Array.from({length:16},(_,i)=>`motiv${i}`);assert.equal(ground([{...asset,tags}],custom,`Bild ${tags.join(" ")} widerspruch`).status,"unconfirmed");
 assert.equal(ground([asset],custom,"Hast du Bilder?").status,"unconfirmed");
 assert.equal(ground([{...asset,tags:["Rosen"]}],custom,"Foto mit 20 Rosen").status,"unconfirmed");
});
test("an available image cannot substantiate a different priced offer",()=>{
 assert.equal(ground([asset],custom,"Bild am Strand",{...offer,id:"other"}).status,"unconfirmed");
 assert.equal(ground([asset],custom,"Bild am Strand",offer).status,"verified_match");
});
test("paid custom creation requires an active bound offer, configured motif, delivery and no outstanding confirmation",()=>{
 assert.equal(ground([],custom,"Bild am Strand",offer).status,"custom_available");
 for(const patch of [{enabled:false},{requires_confirmation:true},{delivery_hours:null},{delivery_hours:0},{delivery_hours:721},{motifs:["Wald"]},{offer_id:"other"}])assert.equal(ground([],{...custom,...patch},"Bild am Strand",offer).status,"unconfirmed");
 assert.equal(ground([],custom,"Bild am Strand",null).status,"unconfirmed");
 assert.throws(()=>policy.normalizeCustomPolicy({...custom,delivery_hours:null},[offer]),/custom_offer_not_ready/u);
 assert.throws(()=>policy.normalizeCustomPolicy(custom,[{...offer,active:false}]),/custom_offer_not_ready/u);
});
test("custom fallback reuses existing sales holds and never overrides a refusal",()=>{
 const incoming="Hast du ein Bild am Strand?",base=buildChatAdminCharacterContext(character,incoming);
 const parsed=JSON.parse(policy.attachMediaGrounding(base,character,null,[],custom,incoming,Date.now()));
 assert.equal(parsed.media_inventory.status,"custom_available");assert.equal(parsed.sales_playbook.requested_offer.recommendedPriceMinor,2500);
 const held=JSON.parse(policy.attachMediaGrounding(base,character,{notes:writeChatAdminKnowledge({...readChatAdminKnowledge(""),commercial:{...readChatAdminKnowledge("").commercial,salesHold:true}})},[],custom,incoming,Date.now()));
 assert.notEqual(held.media_inventory.status,"custom_available");
 const refused=JSON.parse(policy.attachMediaGrounding(base,character,null,[asset],custom,"Ich will kein Bild am Strand",Date.now()));assert.equal(refused.media_inventory.status,"unconfirmed");
});
test("unrelated negation cannot bypass a positive availability claim",()=>{
 for(const reply of ["Ich habe ein Foto am Strand, aber nicht kostenlos.","Ich habe ein Foto am Strand, kein Problem.","Ich habe ein Bild bereit.","I have a photo in stock.","Ich habe kein Foto, aber ich habe ein Bild am Strand.","Das Bild habe ich schon.","Ich kann dir morgen ein Foto schicken."])
  assert.throws(()=>policy.assertMediaReplyClaims([reply],{status:"unconfirmed",custom:null}),/media_claim_not_grounded/u);
 assert.doesNotThrow(()=>policy.assertMediaReplyClaims(["Ich habe gerade kein Bild zur Hand."],{status:"unconfirmed",custom:null}));
 assert.throws(()=>policy.assertMediaReplyClaims(["Du bekommst es in 12 Stunden."],{status:"custom_available",custom:{delivery_hours:24}}),/media_delivery_not_grounded/u);
 assert.doesNotThrow(()=>policy.assertMediaReplyClaims(["Das fertige ich neu an. Du bekommst es innerhalb von 24 Stunden für 25 EUR."],{status:"custom_available",custom:{delivery_hours:24}}));
});
test("inbound invented prices release an explicit correction requirement without exposing the raw price",()=>{
 const incoming="Ist Anfertigung für 999 EUR erhältlich?",context=JSON.parse(buildChatAdminCharacterContext(character,incoming));
 assert.equal(context.sales_playbook.price_correction_required,true);assert.doesNotMatch(context.incoming_message,/999/u);
 assert.throws(()=>assertChatAdminReplySemantics(["Ja, das geht.","Das ist möglich.","Gerne."],incoming,offer),/reply_price_not_permitted/u);
 assert.doesNotThrow(()=>assertChatAdminReplySemantics(["Das kostet 25 EUR.","Für 25 EUR ist es möglich.","Gerne für 25 EUR."],incoming,offer));
 assert.throws(()=>assertChatAdminReplySemantics(["Das kostet 999 EUR.","25 EUR.","25 EUR."],incoming,offer),/reply_price_not_permitted/u);
 assert.match(buildChatAdminModelRequest(JSON.stringify({...context,media_inventory:{status:"unconfirmed"}})).input[0].content,/media_inventory/u);
});

test("image processing decodes/re-encodes and rejects invalid, oversized and animated input",async()=>{
 const exports={};const require=createRequire(import.meta.url);
 const code=ts.transpileModule(readFileSync("src/lib/chatAdminMediaImage.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 runInNewContext(code,{exports,Buffer,require:name=>name==="./chatAdminMediaPolicy.mjs"?policy:require(name)});
 const image=await sharp({create:{width:32,height:32,channels:3,background:"red"}}).jpeg().toBuffer();
 const normalized=await exports.normalizeMediaImage(image);const meta=await sharp(normalized).metadata();assert.equal(meta.format,"webp");assert.equal(meta.exif,undefined);
 for(const bytes of [Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),Buffer.from("not an image"),Buffer.alloc(policy.MEDIA_MAX_BYTES+1)])await assert.rejects(exports.normalizeMediaImage(bytes),/invalid_image/u);
});
