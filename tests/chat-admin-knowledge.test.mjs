import assert from "node:assert/strict";
import test from "node:test";
import { readChatAdminKnowledge, writeChatAdminKnowledge, learnChatAdminKnowledge, deriveChatAdminStrategy } from "../src/lib/chatAdminKnowledge.mjs";

const now = Date.parse("2026-10-14T08:00:00Z");
const playbook = { offers: [], minimumHoursBetweenOffers: 48, aftercareHours: 48 };
const source = {id:"incoming",memory_source:"generation-a",direction:"fan_inbound",content:"Ich mag kurze Antworten ohne Emojis. Ich liebe Katzen."};

test("explicit fan preferences survive reload without overwriting manual notes", () => {
  const learned = learnChatAdminKnowledge("Manuell geprüft",[{kind:"communication",quote:"Ich mag kurze Antworten ohne Emojis.",source:"incoming"},{kind:"interest",quote:"Ich liebe Katzen.",source:"incoming"}],[source]);
  const knowledge = readChatAdminKnowledge(learned);
  assert.equal(knowledge.manual,"Manuell geprüft");
  assert.equal(knowledge.facts.length,2);
  assert.equal(knowledge.facts[0].source,"generation-a");
  assert.equal(writeChatAdminKnowledge(knowledge),learned);
  assert.equal(learnChatAdminKnowledge(learned,[{kind:"interest",quote:"Ich liebe Katzen.",source:"incoming"}],[source]),learned);
});
test("unused drafts, other sources, hallucinations and sensitive claims cannot become learned facts", () => {
  for (const proposed of [
    {kind:"communication",quote:"Ich mag kurze Antworten ohne Emojis.",source:"other-fan"},
    {kind:"interest",quote:"Ich liebe Hunde.",source:"incoming"},
    {kind:"purchase",quote:"Ich liebe Katzen.",source:"incoming"},
    {kind:"interest",quote:"Ich liebe Katzen und meine Religion.",source:"sensitive"},
    {kind:"interest",quote:"Ich liebe Katzen.",source:"draft"},
  ]) assert.equal(learnChatAdminKnowledge("Notiz",[proposed],[source,{id:"draft",direction:"suggested_reply",content:"Ich liebe Katzen."},{id:"sensitive",direction:"fan_inbound",content:"Ich liebe Musik und bin Muslim"}]),"Notiz");
});
test("bounded learning preserves long manual notes and retains the previous valid memory on overflow", () => {
  const notes="M".repeat(3990);
  assert.equal(learnChatAdminKnowledge(notes,[{kind:"interest",quote:"Ich liebe Katzen.",source:"incoming"}],[source]),notes);
  assert.equal(readChatAdminKnowledge("legacy\n\n[FanMind-Kontaktwissen v1]\ninvalid").manual,"legacy\n\n[FanMind-Kontaktwissen v1]\ninvalid");
});
test("latest explicit communication preference replaces the old one, not manual knowledge", () => {
  const first=learnChatAdminKnowledge("Manuell",[{kind:"communication",quote:"Ich mag kurze Antworten ohne Emojis.",source:"incoming"}],[source]);
  const second=learnChatAdminKnowledge(first,[{kind:"communication",quote:"Ich mag lange Antworten.",source:"next"}],[{id:"next",direction:"fan_inbound",content:"Ich mag lange Antworten."}]);
  assert.equal(readChatAdminKnowledge(second).facts.length,1);
  assert.equal(readChatAdminKnowledge(second).facts[0].quote,"Ich mag lange Antworten.");
});
test("customer tier is context, never a purchase or automatic progression", () => {
  const s=deriveChatAdminStrategy(playbook,{notes:"",customer_tier:"green"},null,now);
  assert.equal(s.customer_tier,"green");assert.equal(s.relationship_stage,"new");assert.equal(s.sellNow,false);assert.equal(s.purchaseIntent,null);
});
test("sales hold, evidenced purchases/offer cooldown and fan boundaries suppress an explicit offer", () => {
  for (const commercial of [{salesHold:true},{source:"Beleg",lastPurchaseAt:"2026-10-14T07:00:00Z"},{source:"Beleg",lastOfferAt:"2026-10-14T07:00:00Z"},{source:"Beleg",lastDeclinedAt:"2026-10-14T07:00:00Z"}]) {
    const notes=writeChatAdminKnowledge({manual:"",facts:[],commercial});
    assert.equal(deriveChatAdminStrategy(playbook,{notes}, {id:"photo"}, now).sellNow,false);
  }
  const notes=learnChatAdminKnowledge("",[{kind:"boundary",quote:"Bitte keine Angebote.",source:"fan"}],[{id:"fan",direction:"fan_inbound",content:"Bitte keine Angebote."}]);
  assert.equal(deriveChatAdminStrategy(playbook,{notes},{id:"photo"},now).sellNow,false);
});
test("source-free and future purchase times never create AFTERCARE; an explicit request stays permitted", () => {
  for (const commercial of [{lastPurchaseAt:"2026-10-14T07:00:00Z"},{source:"Beleg",lastPurchaseAt:"2026-10-15T07:00:00Z"}]) {
    const notes=writeChatAdminKnowledge({manual:"",facts:[],commercial});
    assert.equal(deriveChatAdminStrategy(playbook,{notes},{id:"photo"},now).sellNow,true);
  }
});

test("independent boundary changes and interest accumulation never revoke a sales refusal",()=>{
 let notes=learnChatAdminKnowledge("",[{kind:"boundary",quote:"Bitte keine Angebote",source:"1"}],[{id:"1",direction:"fan_inbound",content:"Bitte keine Angebote"}]);
 notes=learnChatAdminKnowledge(notes,[{kind:"boundary",quote:"Bitte keine Emojis",source:"2"}],[{id:"2",direction:"fan_inbound",content:"Bitte keine Emojis"}]);
 for (const quote of ["Ich liebe Katzen","Ich liebe Hunde","Ich liebe Sport","Ich liebe Reisen","Ich liebe Kochen","Ich liebe Musik","Ich liebe Fotos","Ich liebe Videos"])
  notes=learnChatAdminKnowledge(notes,[{kind:"interest",quote,source:quote}],[{id:quote,direction:"fan_inbound",content:quote}]);
 assert.equal(deriveChatAdminStrategy(playbook,{notes},{id:"photo"},now).sellNow,false);
 assert.ok(readChatAdminKnowledge(notes).facts.some(f=>f.quote==="Bitte keine Angebote"));
});

test("many equivalent boundaries remain readable and never lift a sales refusal",()=>{
 let notes="";
 for(const quote of ["Bitte keine Angebote","Bitte keine Angebote.","Bitte keine Angebote!","Ich will keine Angebote","Ich möchte keine Angebote","Bitte keine Verkaufsgespräche","Bitte keine Nachfragen","Bitte keine Emojis","Please no offers"])
  notes=learnChatAdminKnowledge(notes,[{kind:"boundary",quote,source:quote}],[{id:quote,direction:"fan_inbound",content:quote}]);
 assert.ok(readChatAdminKnowledge(notes).facts.length<=8);assert.equal(deriveChatAdminStrategy(playbook,{notes},{id:"photo"},now).sellNow,false);
});
test("replaying an older generation never replaces newer communication knowledge",()=>{
 const first=learnChatAdminKnowledge("",[{kind:"communication",quote:"Ich mag lange Antworten.",source:"new"}],[{id:"new",sequence:20,direction:"fan_inbound",content:"Ich mag lange Antworten."}]);
 const replay=learnChatAdminKnowledge(first,[{kind:"communication",quote:"Ich mag kurze Antworten.",source:"old"}],[{id:"old",sequence:10,direction:"fan_inbound",content:"Ich mag kurze Antworten."}]);
 assert.equal(replay,first);
});
