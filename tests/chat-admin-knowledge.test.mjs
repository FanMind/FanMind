import assert from "node:assert/strict";
import test from "node:test";
import { readChatAdminKnowledge, writeChatAdminKnowledge, learnChatAdminKnowledge, deriveChatAdminStrategy } from "../src/lib/chatAdminKnowledge.mjs";

const now = Date.parse("2026-10-14T08:00:00Z");
const playbook = { offers: [], minimumHoursBetweenOffers: 48, aftercareHours: 48 };
const source = {id:"incoming",memory_source:"generation-a",direction:"fan_inbound",content:"Ich mag kurze Antworten ohne Emojis. Ich liebe Katzen."};

const topicQuotes=["Ich liebe Katzen.","Ich liebe Hunde.","Ich liebe Sport.","Ich liebe Reisen.","Ich liebe Kochen.","Ich liebe Musik.","Ich liebe Fotos.","Ich liebe Videos."];
function knowledgeAfterTopicChanges(quote="Ich mag kurze Antworten ohne Emojis.",boundary=false){
 let notes=learnChatAdminKnowledge("Fan kauft bestimmt morgen.",[{kind:"communication",quote,source:"preference"}],[{id:"preference",memory_source:"confirmed-preference",sequence:10,direction:"fan_inbound",content:quote}]);
 if(boundary)notes=learnChatAdminKnowledge(notes,[{kind:"boundary",quote:"Bitte keine Angebote.",source:"boundary"}],[{id:"boundary",sequence:11,direction:"fan_inbound",content:"Bitte keine Angebote."}]);
 for(const [index,topic] of topicQuotes.entries())notes=learnChatAdminKnowledge(notes,[{kind:"interest",quote:topic,source:`topic-${index}`}],[{id:`topic-${index}`,sequence:20+index,direction:"fan_inbound",content:topic}]);
 return notes;
}

for(const quote of ["Ich mag kurze Antworten ohne Emojis.","I prefer short replies without emojis."])for(const boundary of [false,true])test(`topic accumulation retains confirmed communication (${quote}, boundary=${boundary})`,()=>{
 const notes=knowledgeAfterTopicChanges(quote,boundary);const knowledge=readChatAdminKnowledge(notes);
 assert.equal(knowledge.facts.length,8);
 assert.deepEqual(knowledge.facts.filter(f=>f.kind==="communication"),[{kind:"communication",quote,source:"confirmed-preference",source_sequence:10}]);
 assert.equal(knowledge.manual,"Fan kauft bestimmt morgen.");
 assert.equal(knowledge.facts.filter(f=>f.kind==="interest").length,boundary?6:7);
 assert.ok(!knowledge.facts.some(f=>f.quote===topicQuotes[0]),"an old interest may yield to a communication preference");
 if(boundary)assert.ok(knowledge.facts.some(f=>f.quote==="Bitte keine Angebote."));
 assert.equal(writeChatAdminKnowledge(knowledge),notes);
 const strategy=deriveChatAdminStrategy(playbook,{notes,customer_tier:"red"},null,now);
 assert.equal(strategy.purchaseIntent,null);assert.equal(strategy.relationship_stage,"new");assert.equal(strategy.sellNow,false);
});

test("an old-generation replay cannot regain authority after newer topics filled memory",()=>{
 const notes=knowledgeAfterTopicChanges();
 const replay=learnChatAdminKnowledge(notes,[{kind:"communication",quote:"Ich mag lange Antworten.",source:"old"}],[{id:"old",sequence:5,direction:"fan_inbound",content:"Ich mag lange Antworten."}]);
 assert.equal(replay,notes);
});

test("summaries, unused drafts and unsupported claims cannot replace retained communication",()=>{
 const notes=knowledgeAfterTopicChanges();
 for(const [quote,direction] of [["I prefer long replies with emojis.","suggested_reply"],["Fan kauft bestimmt morgen.","fan_inbound"],["Ich mag kurze Antworten wegen meiner Religion.","fan_inbound"]]){
  const result=learnChatAdminKnowledge(notes,[{kind:"communication",quote,source:"unconfirmed"}],[{id:"unconfirmed",sequence:100,direction,content:quote}]);
  assert.equal(result,notes);
 }
 assert.equal(readChatAdminKnowledge(notes).facts.find(f=>f.kind==="communication")?.quote,"Ich mag kurze Antworten ohne Emojis.");
});

test("a communication update never displaces eight already stored protective boundaries",()=>{
 const notes=writeChatAdminKnowledge({manual:"",facts:Array.from({length:8},(_,index)=>({kind:"boundary",quote:"Bitte keine Angebote.",source:`legacy-boundary-${index}`}))});
 const next=learnChatAdminKnowledge(notes,[{kind:"communication",quote:"Ich mag kurze Antworten.",source:"new"}],[{id:"new",sequence:100,direction:"fan_inbound",content:"Ich mag kurze Antworten."}]);
 assert.equal(next,notes);assert.equal(deriveChatAdminStrategy(playbook,{notes:next},{id:"photo"},now).sellNow,false);
});

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


test("only explicit confirmed closures pause, never Fan text, drafts, warnings or quotes",async()=>{
 const {deriveChatAdminReplyPause}=await import("../src/lib/chatAdminKnowledge.mjs");
 const row={id:"77777777-7777-4777-8777-777777777777",direction:"confirmed_reply",content:"Das Gespräch ist beendet."};
 for(const content of ["Drohungen akzeptiere ich nicht. Damit ist das Gespräch für mich beendet.","Ich antworte nicht weiter.","Das Gespräch bleibt beendet.","Bitte respektiere, dass ich keinen weiteren Kontakt möchte."]){assert.equal(deriveChatAdminReplyPause("",{...row,content}).paused,true,content);}
 for(const content of ["Wenn du mich weiter beleidigst, beende ich das Gespräch.","Falls nötig: Ich beende das Gespräch.","Du schreibst: Das Gespräch ist beendet.","Das Gespräch ist beendet?",'"Das Gespräch ist beendet."',"Ich lerne dich hier im Chat kennen."]){assert.equal(deriveChatAdminReplyPause("",{...row,content}).paused,false,content);}
 for(const direction of ["fan_inbound","suggested_reply"]){assert.equal(deriveChatAdminReplyPause("",{...row,direction}).paused,false);}
});
test("explicit resumption binds one confirmed reply and preserves notes, knowledge and sales holds",async()=>{
 const {deriveChatAdminReplyPause,resumeChatAdminReplies}=await import("../src/lib/chatAdminKnowledge.mjs");
 const row={id:"77777777-7777-4777-8777-777777777777",direction:"confirmed_reply",content:"Ich antworte nicht weiter."};
 const initial=writeChatAdminKnowledge({manual:"Manuelle Notiz",facts:[{kind:"interest",quote:"Ich liebe Musik.",source:"synthetic"}],commercial:{salesHold:true}});
 const resumed=resumeChatAdminReplies(initial,row.id);assert.equal(deriveChatAdminReplyPause(resumed,row).paused,false);
 assert.equal(readChatAdminKnowledge(resumed).manual,"Manuelle Notiz");assert.equal(readChatAdminKnowledge(resumed).facts.length,1);assert.equal(readChatAdminKnowledge(resumed).commercial.salesHold,true);
 assert.equal(deriveChatAdminReplyPause(resumed,{...row,id:"88888888-8888-4888-8888-888888888888"}).paused,true);
 assert.throws(()=>resumeChatAdminReplies(initial,"unbound"));
 const learned=learnChatAdminKnowledge(resumed,[{kind:"interest",quote:"Ich mag Katzen.",source:"new"}],[{id:"new",direction:"fan_inbound",content:"Ich mag Katzen."}]);
 assert.equal(deriveChatAdminReplyPause(learned,row).paused,false);
});
