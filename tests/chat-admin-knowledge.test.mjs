import { applyCurrentInterestAssertion } from "../src/lib/chatAdminCurrentFactsPolicy.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { extractChatAdminFacts, readChatAdminKnowledge, writeChatAdminKnowledge, learnChatAdminKnowledge, deriveChatAdminStrategy } from "../src/lib/chatAdminKnowledge.mjs";

import { buildChatAdminFanContext } from "../src/lib/chatAdminPolicy.mjs";

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
test("new length preference replaces old length while preserving the independent emoji clause", () => {
  const first=learnChatAdminKnowledge("Manuell",[{kind:"communication",quote:"Ich mag kurze Antworten ohne Emojis.",source:"incoming"}],[source]);
  const second=learnChatAdminKnowledge(first,[{kind:"communication",quote:"Ich mag lange Antworten.",source:"next"}],[{id:"next",direction:"fan_inbound",content:"Ich mag lange Antworten."}]);
  assert.deepEqual(readChatAdminKnowledge(second).facts.map(f=>f.quote),["ohne Emojis.","Ich mag lange Antworten."]);
  assert.equal(readChatAdminKnowledge(second).manual,"Manuell");
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


function learn(notes, content, sequence, id=`event-${sequence}`) {
 return learnChatAdminKnowledge(notes,extractChatAdminFacts(content,id),[{id,memory_source:id,direction:"fan_inbound",sequence,content}]);
}
const communications=notes=>readChatAdminKnowledge(notes).facts.filter(f=>f.kind==="communication");

for(const [first,second] of [
 ["Ich mag kurze Antworten.","Bitte keine Emojis."],
 ["Ich mag direkte Antworten.","Ohne Emojis."],
 ["Ich mag freundliche Nachrichten.","Mit Emojis."],
 ["I prefer short replies.","Without emojis."],
 ["I prefer direct messages.","Without emojis."],
 ["I prefer friendly messages.","With emojis."],
 ["Ich mag kurze Antworten.","Ich mag direkte Nachrichten."],
])for(const reverse of [false,true])test(`independent confirmed preferences coexist (${first}, reverse=${reverse})`,()=>{
 const [a,b]=reverse?[second,first]:[first,second];
 const notes=learn(learn("Manuell",a,10),b,20);
 assert.deepEqual(communications(notes).map(f=>f.quote),[a,b]);
 assert.deepEqual(communications(notes).map(f=>[f.source,f.source_sequence]),[["event-10",10],["event-20",20]]);
 assert.equal(readChatAdminKnowledge(notes).manual,"Manuell");assert.equal(writeChatAdminKnowledge(readChatAdminKnowledge(notes)),notes);
});

for(const [old,next,residual] of [
 ["Ich mag kurze Antworten ohne Emojis.","Ich mag lange Antworten.","ohne Emojis."],
 ["I prefer short replies without emojis.","I prefer long replies.","without emojis."],
 ["Ich mag kurze Antworten ohne Emojis.","Mit Emojis.","Ich mag kurze Antworten"],
 ["I prefer short replies without emojis.","With emojis.","I prefer short replies"],
 ["Ich mag direkte Antworten ohne Emojis.","Ich mag lockere Antworten.","ohne Emojis."],
 ["Ich mag freundliche Nachrichten mit Emojis.","Ohne Emojis.","Ich mag freundliche Nachrichten"],
])test(`a partial conflict retains the literal independent source clause (${next})`,()=>{
 const notes=learn(learn("Manuell",old,10),next,20);
 const facts=communications(notes);
 assert.deepEqual(facts,[{kind:"communication",quote:residual,source:"event-10",source_sequence:10},{kind:"communication",quote:next,source:"event-20",source_sequence:20}]);
 assert.ok(old.includes(residual),"residual is an actual original quote, not a newly invented preference");
 assert.equal(learn(notes,old,10),notes,"delayed composite retry cannot restore its overwritten dimension");
});

for(const [first,second] of [
 ["Ich mag kurze Antworten.","Ich mag lange Antworten."],
 ["Ohne Emojis.","Mit Emojis."],
 ["Ich mag direkte Antworten.","Ich mag lockere Antworten."],
 ["I prefer short replies without emojis.","I prefer long replies with emojis."],
])test(`newer conflicting dimension replaces only its predecessor (${second})`,()=>{
 const notes=learn(learn("",first,10),second,20);
 assert.deepEqual(communications(notes).map(f=>f.quote),[second]);
 assert.equal(learn(notes,first,10),notes);
});

test("same-event statements keep their order and retries are idempotent",()=>{
 const content="Ich mag kurze Antworten. Ich mag lange Antworten. Ohne Emojis.";
 const notes=learn("",content,10);
 assert.deepEqual(communications(notes).map(f=>f.quote),["Ich mag lange Antworten.","Ohne Emojis."]);
 assert.equal(learn(notes,content,10),notes);
});

test("an older composite cannot add a previously unknown dimension or restore an old value",()=>{
 const notes=learn("","Ich mag lange Antworten.",20);
 assert.equal(learn(notes,"Ich mag kurze Antworten ohne Emojis.",10),notes);
});

for(const change of ["missing","draft","wrong-quote","sensitive","unsupported","wrong-kind"])test(`invalid preference provenance creates no dimension (${change})`,()=>{
 const notes=learn("Manuell","Ich mag kurze Antworten.",10);
 let quote="Ohne Emojis.",source="next",kind="communication";
 const rows=[{id:"next",direction:"fan_inbound",sequence:20,content:quote}];
 if(change==="missing")source="foreign";
 if(change==="draft")rows[0].direction="suggested_reply";
 if(change==="wrong-quote")quote="Mit Emojis.";
 if(change==="sensitive")quote=rows[0].content="Ich mag kurze Antworten wegen meiner Religion.";
 if(change==="unsupported")quote=rows[0].content="Ich brauche Antworten nach meiner Diagnose.";
 if(change==="wrong-kind")kind="purchase";
 assert.equal(learnChatAdminKnowledge(notes,[{kind,quote,source}],rows),notes);
});

for(const count of [0,3,6,7,8])test(`eight-fact cap keeps boundaries first, communications before interests (${count} boundaries)`,()=>{
 const boundaries=Array.from({length:count},(_,i)=>({kind:"boundary",quote:"Bitte keine Angebote.",source:`legacy-${i}`,source_sequence:1}));
 let notes=writeChatAdminKnowledge({manual:"Manuell",facts:boundaries,commercial:{salesHold:true}});
 notes=learn(learn(notes,"Ich mag kurze Antworten.",10),"Ohne Emojis.",20);
 for(const [i,topic] of ["Katzen","Hunde","Sport","Reisen","Kochen","Musik","Fotos","Videos"].entries())notes=learn(notes,`Ich liebe ${topic}.`,30+i);
 const knowledge=readChatAdminKnowledge(notes);
 assert.equal(knowledge.facts.length,8);assert.deepEqual(knowledge.facts.filter(f=>f.kind==="boundary"),boundaries);
 assert.equal(communications(notes).length,Math.min(2,8-count));
 if(count<=6)assert.deepEqual(communications(notes).map(f=>f.quote),["Ich mag kurze Antworten.","Ohne Emojis."]);
 if(count===7)assert.equal(communications(notes)[0].quote,"Ohne Emojis.");
 assert.equal(knowledge.commercial.salesHold,true);assert.equal(knowledge.manual,"Manuell");
});

test("an emoji communication update cannot delete a protective legacy emoji boundary",()=>{
 const boundary={kind:"boundary",quote:"Please no emojis.",source:"protected",source_sequence:1};
 const notes=learn(writeChatAdminKnowledge({facts:[boundary]}),"With emojis.",20);
 assert.deepEqual(readChatAdminKnowledge(notes).facts.filter(f=>f.kind==="boundary"),[boundary]);
});

const character={id:"character-a",workspace_id:"workspace-a",revision:1,status:"active",display_name:"Synthetic",public_age:25,bio:"Synthetic",languages:["Deutsch"],personality:"freundlich",writing_style:"eigene Stimme",emoji_style:"sparsam",sentence_style:"kurz",typical_phrases:[],forbidden_phrases:[],example_messages:[]};
function contextFixture(notes,suffix="a") {
 const c={...character,id:`character-${suffix}`,workspace_id:`workspace-${suffix}`};
 const fan={id:`fan-${suffix}`,character_id:c.id,workspace_id:c.workspace_id,status:"active",notes,summary:"Unbestätigt: Fan kauft morgen."};
 const conversation={id:`conversation-${suffix}`,fan_id:fan.id,character_id:c.id,workspace_id:c.workspace_id};
 return {c,fan,conversation};
}
for(const budget of [0,1000,10000])test(`merged preferences survive bounded context and topic change (${budget})`,()=>{
 const notes=learn(learn("Manuell","Ich mag kurze Antworten.",10),"Ohne Emojis.",20);
 const {c,fan,conversation}=contextFixture(notes);
 const row={workspace_id:c.workspace_id,character_id:c.id,fan_id:fan.id,conversation_id:conversation.id,direction:"fan_inbound"};
 const messages=Array.from({length:20},(_,i)=>({...row,id:`turn-${i}`,content:"Neues Thema Wochenende "+"x".repeat(400)}));
 const base=buildChatAdminFanContext(c,fan,conversation,[],"Wie geht es dir?");
 const raw=buildChatAdminFanContext(c,fan,conversation,messages,"Wie geht es dir?",base.length+budget);const context=JSON.parse(raw);
 assert.ok(raw.length<=base.length+budget);assert.deepEqual(context.fan.learned_preferences,readChatAdminKnowledge(notes).facts);
 assert.equal(context.style.writing,c.writing_style);assert.equal(context.sales_strategy.sellNow,false);assert.equal(context.sales_strategy.purchaseIntent,null);
 if(!budget)assert.deepEqual(context.conversation.recent_messages,[]);
});

test("separate bound Fans and Characters keep their own merged preferences",()=>{
 const first=contextFixture(learn(learn("","Ich mag kurze Antworten.",10),"Ohne Emojis.",20));
 const second=contextFixture(learn(learn("","I prefer long replies.",10),"With emojis.",20),"b");
 for(const f of [first,second]){
  const context=JSON.parse(buildChatAdminFanContext(f.c,f.fan,f.conversation,[],"Hallo"));
  assert.deepEqual(context.fan.learned_preferences,readChatAdminKnowledge(f.fan.notes).facts);
 }
 assert.throws(()=>buildChatAdminFanContext(first.c,second.fan,second.conversation,[],"Hallo"),/fan_unavailable/u);
 assert.throws(()=>buildChatAdminFanContext(first.c,first.fan,second.conversation,[],"Hallo"),/conversation_unavailable/u);
});

test("legacy composites keep the v1 format and only confirmed partial updates residualize",()=>{
 const quote="I prefer short replies without emojis.";
 const fact={kind:"communication",quote,source:"legacy"};
 const initial=writeChatAdminKnowledge({manual:"Manuell",facts:[fact]});
 assert.equal(writeChatAdminKnowledge(readChatAdminKnowledge(initial)),initial);
 const notes=learn(initial,"I prefer long replies.",20);
 assert.deepEqual(communications(notes)[0],{...fact,quote:"without emojis."});
 assert.equal(readChatAdminKnowledge(notes).manual,"Manuell");
});

test("standalone emoji clauses do not admit negated, quoted, sensitive or unrelated text",()=>{
 for(const content of ['Nicht ohne Emojis.','Not without emojis.','"With emojis."','With emojis because of my diagnosis.','Mit Emojis und Religion.','Bitte nicht mit Emojis.','I dislike emojis.']){
  assert.deepEqual(extractChatAdminFacts(content,"source"),[]);
  assert.equal(learn("Manuell",content,20),"Manuell");
 }
});

test("identical communication wording cannot demote a stored protective emoji boundary",()=>{
 const boundary={kind:"boundary",quote:"Bitte keine Emojis.",source:"legacy-protection",source_sequence:1};
 let notes=writeChatAdminKnowledge({facts:[boundary]});
 notes=learn(notes,"Bitte keine Emojis.",20);
 notes=learn(notes,"Mit Emojis.",30);
 assert.deepEqual(readChatAdminKnowledge(notes).facts.filter(f=>f.kind==="boundary"),[boundary]);
});

// PR1342: explicit revocation regression; kept in this required CI suite.
const inbound = (id, sequence, content, direction = "fan_inbound") => ({ id, sequence, content, direction });
const apply = (notes, event) => learnChatAdminKnowledge(notes, extractChatAdminFacts(event.content, event.id), [event]);
const learned = (notes) => readChatAdminKnowledge(notes).facts;

test("explicit DE/EN interest withdrawal is extracted only with a named bounded subject", () => {
 for (const quote of ["Ich mag Musik nicht mehr.", "Ich mag keine Musik mehr.", "I don't like music anymore.", "I no longer like music."]) {
  assert.deepEqual(extractChatAdminFacts(quote,"new"),[{kind:"interest",quote,source:"new"}]);
 }
 for (const quote of ["Das stimmt inzwischen nicht mehr.", "I changed my mind.", "Ich mag Musik nicht mehr wegen meiner Religion.", "Ich mag keine Angebote mehr.", "Ich mag Musik nicht mehr?"]) {
  assert.deepEqual(extractChatAdminFacts(quote,"new"),[]);
 }
});

test("newer explicit withdrawal persists instead of the superseded positive interest", () => {
 const first = apply("Manuelle Notiz",inbound("old",10,"Ich liebe Musik."));
 const next = apply(first,inbound("new",20,"Ich mag Musik nicht mehr."));
 assert.equal(readChatAdminKnowledge(next).manual,"Manuelle Notiz");
 assert.deepEqual(learned(next),[{kind:"interest",quote:"Ich mag Musik nicht mehr.",source:"new",source_sequence:20}]);
 assert.equal(writeChatAdminKnowledge(readChatAdminKnowledge(next)),next);
 assert.equal(apply(next,inbound("old",10,"Ich liebe Musik.")),next,"delayed replay must not resurrect the old preference");
 assert.equal(apply(next,inbound("new",20,"Ich mag Musik nicht mehr.")),next,"duplicate generation stays idempotent");
});

test("later explicit re-confirmation may supersede a withdrawal without inventing a preference", () => {
 const withdrawn=apply(apply("",inbound("old",10,"Ich liebe Musik.")),inbound("new",20,"Ich mag Musik nicht mehr."));
 const restored=apply(withdrawn,inbound("latest",30,"Ich liebe Musik."));
 assert.deepEqual(learned(restored),[{kind:"interest",quote:"Ich liebe Musik.",source:"latest",source_sequence:30}]);
});

test("withdrawal does not touch unrelated interests, communication preferences or boundaries", () => {
 let notes=apply("Manuell",inbound("music",10,"Ich mag Musik."));
 notes=apply(notes,inbound("cat",11,"Ich liebe Katzen."));
 notes=apply(notes,inbound("communication",12,"Ich mag kurze Antworten."));
 notes=apply(notes,inbound("boundary",13,"Bitte keine Angebote."));
 notes=apply(notes,inbound("withdraw",20,"Ich mag keine Musik mehr."));
 assert.ok(learned(notes).some(f=>f.kind==="interest"&&f.quote==="Ich mag keine Musik mehr."));
 assert.ok(learned(notes).some(f=>f.quote==="Ich liebe Katzen."));
 assert.ok(learned(notes).some(f=>f.quote==="Ich mag kurze Antworten."));
 assert.ok(learned(notes).some(f=>f.quote==="Bitte keine Angebote."));
 assert.equal(readChatAdminKnowledge(notes).manual,"Manuell");
});

test("an unsupported, unsaved or missing-order withdrawal never changes notes", () => {
 const first=apply("",inbound("old",10,"Ich mag Musik."));
 for(const event of [inbound("wrong",20,"Ich mag Musik nicht mehr.","suggested_reply"),inbound("no-order",undefined,"Ich mag Musik nicht mehr."),inbound("older",5,"Ich mag Musik nicht mehr.")]){
  assert.equal(apply(first,event),first);
 }
 assert.equal(learnChatAdminKnowledge(first,[{kind:"interest",quote:"Ich mag Musik nicht mehr.",source:"invented"}],[inbound("real",20,"Ich mag Musik nicht mehr.")]),first);
});

test("late withdrawal takes precedence over a compound positive claim without fabricating remaining clauses",()=>{
 const first=apply("",inbound("old",10,"Ich mag Musik und Reisen."));
 const next=apply(first,inbound("new",20,"Ich mag Musik nicht mehr."));
 assert.equal(learned(next).length,1);
 assert.equal(learned(next)[0].quote,"Ich mag Musik nicht mehr.");
});

test("withdrawal survives historical message trimming because it is in durable fan facts",()=>{
 const notes=apply(apply("",inbound("old",10,"Ich liebe Musik.")),inbound("new",20,"Ich mag Musik nicht mehr."));
 const knowledge=readChatAdminKnowledge(notes);
 assert.deepEqual(knowledge.facts.map(f=>f.quote),["Ich mag Musik nicht mehr."]);
 assert.equal(knowledge.facts.some(f=>f.quote==="Ich liebe Musik."),false);
});

for (const quote of ["I do not like music anymore.", "I don’t like music anymore.", "Ich liebe Musik nicht mehr."]) test(`explicit literal negation is supported: ${quote}`,()=>{
 const notes=apply(apply("",inbound("old",10,"Ich mag Musik.")),inbound("new",20,quote));
 assert.deepEqual(learned(notes).map(f=>f.quote),[quote]);
});

test("later clauses within one generation resolve the topic without losing retry idempotency",()=>{
 for(const content of ["Ich mag Musik. Ich mag Musik nicht mehr.","Ich mag Musik nicht mehr. Ich mag Musik."]){
  const event=inbound("generation",20,content);const notes=apply("",event);
  assert.deepEqual(learned(notes).map(f=>f.quote),[content.split(". ").at(-1)]);
  assert.equal(apply(notes,event),notes);
 }
});

test("explicit withdrawal is not discarded behind three unrelated positive sentences",()=>{
 const notes=apply(apply("",inbound("old",10,"Ich mag Musik.")),inbound("new",20,"Ich mag Katzen. Ich mag Hunde. Ich mag Reisen. Ich mag Musik nicht mehr."));
 assert.ok(learned(notes).some(f=>f.quote==="Ich mag Musik nicht mehr."));
 assert.ok(!learned(notes).some(f=>f.quote==="Ich mag Musik."));
});

test("an evicted withdrawal does not allow an older interest generation back into full memory",()=>{
 let notes="";
 for(const [i,topic] of ["Musik","Fotos","Videos","Katzen","Hunde","Sport","Reisen","Kochen"].entries())notes=apply(notes,inbound(`withdraw-${i}`,20+i,`Ich mag ${topic} nicht mehr.`));
 notes=apply(notes,inbound("communication",30,"Ich mag kurze Antworten."));
 notes=apply(notes,inbound("renew",40,"Ich mag Fotos."));
 assert.equal(apply(notes,inbound("old",10,"Ich mag Musik.")),notes);
 assert.equal(learned(notes).length,8);
 assert.ok(learned(notes).some(f=>f.quote==="Ich mag kurze Antworten."));
});

test("interest provenance requires a full literal source statement, never a substring",()=>{
 const first=apply("",inbound("old",10,"Ich mag Musik."));
 const next=learnChatAdminKnowledge(first,[{kind:"interest",quote:"Ich mag Musik nicht mehr.",source:"new"}],[inbound("new",20,"Wenn ich sage: Ich mag Musik nicht mehr.")]);
 assert.equal(next,first);
});

test("insufficient space for a withdrawal is explicit and preserves the original notes",()=>{
 const notes=apply("x".repeat(3711),inbound("old",10,"Ich mag Musik."));
 assert.ok(notes.length<=4000);
 assert.throws(()=>apply(notes,inbound("new",20,"Ich mag Musik nicht mehr.")),/knowledge_too_large/u);
 assert.equal(readChatAdminKnowledge(notes).manual.length,3711);
});

for(const [positive,negative] of [["I love sports.","Ich mag Sport nicht mehr."],["Ich mag Reisen.","I no longer like travel."]])test(`topic aliases use one source ordering: ${positive}`,()=>{
 const first=apply("",inbound("old",10,positive));assert.equal(learned(first).length,1);
 const notes=apply(first,inbound("new",20,negative));assert.deepEqual(learned(notes).map(f=>f.quote),[negative]);
 assert.equal(apply(notes,inbound("old",10,positive)),notes);
});

test("bounded extraction preserves protective boundaries ahead of competing withdrawals",()=>{
 const facts=extractChatAdminFacts("Bitte keine Angebote. Ich mag Musik nicht mehr. Ich mag Fotos nicht mehr. Ich mag Videos nicht mehr.","new");
 assert.equal(facts.length,3);assert.ok(facts.some(f=>f.kind==="boundary"&&f.quote==="Bitte keine Angebote."));
});

test("independent delayed interests are conservatively declined after newer retained knowledge",()=>{
 const current=apply("",inbound("new",20,"Ich mag Musik nicht mehr."));
 assert.equal(apply(current,inbound("old",10,"Ich mag Katzen.")),current);
 assert.equal(apply(current,inbound("missing",undefined,"Ich mag Musik.")),current);
});

// Offline storage projection contract; not wired to production.
{
const source=(id,sequence,content,direction="fan_inbound")=>({id,sequence,content,direction});
const claim=(quote,src,topic="music")=>({topic,quote,source_message_id:src.id,source_sequence:src.sequence});

test("newer explicitly sourced withdrawal replaces one current topic, not appends",()=>{
 const old=source("older",10,"Ich liebe Musik.");
 const newer=source("newer",20,"Ich mag Musik nicht mehr.");
 const a=applyCurrentInterestAssertion([],claim("Ich liebe Musik.",old),old);
 const b=applyCurrentInterestAssertion(a,claim("Ich mag Musik nicht mehr.",newer),newer);
 assert.equal(b.length,1);
 assert.equal(b[0].quote,"Ich mag Musik nicht mehr.");
 assert.equal(b[0].polarity,"negative");
 assert.equal(b[0].source_sequence,20);
 assert.equal(applyCurrentInterestAssertion(b,claim("Ich liebe Musik.",old),old),b);
 assert.equal(applyCurrentInterestAssertion(b,claim("Ich mag Musik nicht mehr.",newer),newer),b);
});

test("later reconfirmation reverses an earlier withdrawal",()=>{
 const a=source("a",10,"Ich mag Musik nicht mehr.");
 const b=source("b",30,"Ich liebe Musik.");
 const existing=applyCurrentInterestAssertion([],claim(a.content,a),a);
 assert.deepEqual(applyCurrentInterestAssertion(existing,claim(b.content,b),b).map(x=>x.polarity),["positive"]);
});

test("unrelated topics stay independent",()=>{
 const a=source("a",10,"Ich mag Musik.");
 const b=source("b",11,"Ich liebe Katzen.");
 const c=source("c",20,"Ich mag Musik nicht mehr.");
 const first=applyCurrentInterestAssertion([],claim(a.content,a),a);
 const second=applyCurrentInterestAssertion(first,claim(b.content,b,"cats"),b);
 const third=applyCurrentInterestAssertion(second,claim(c.content,c),c);
 assert.equal(third.length,2);
 assert.equal(third.find(x=>x.topic==="cats").quote,"Ich liebe Katzen.");
});

test("reject unsaved, outbound, mismatched, incomplete and unclear claims",()=>{
 const good=source("good",20,"Ich mag Musik nicht mehr.");
 for(const [c,s] of [
  [claim(good.content,good),source("good",20,good.content,"suggested_reply")],
  [claim(good.content,good),source("other",20,good.content)],
  [claim(good.content,good),source("good",20,"Wenn ich sage: Ich mag Musik nicht mehr.")],
  [claim("Das stimmt nicht mehr.",good),source("good",20,"Das stimmt nicht mehr.")],
  [claim("Ich mag Musik nicht mehr.",good,"cats"),good],
  [claim("Ich mag Musik nicht mehr.",good),source("good",undefined,good.content)],
 ])assert.throws(()=>applyCurrentInterestAssertion([],c,s),/invalid_interest_source|invalid_interest_claim/u);
});

test("same-sequence contradictory claims fail closed, not overwrite",()=>{
 const src=source("same",20,"Ich mag Musik. Ich mag Musik nicht mehr.");
 const one=source("one",20,"Ich mag Musik.");
 const a=applyCurrentInterestAssertion([],claim(one.content,one),one);
 assert.throws(()=>applyCurrentInterestAssertion(a,claim("Ich mag Musik nicht mehr.",src),src),/interest_order_conflict/u);
});

test("a current fact without valid order cannot be silently superseded",()=>{
 const incoming=source("new",20,"Ich mag Musik nicht mehr.");
 assert.throws(()=>applyCurrentInterestAssertion([{topic:"music",quote:"Ich mag Musik.",polarity:"positive",source_message_id:"legacy",source_sequence:null}],claim(incoming.content,incoming),incoming),/interest_order_conflict/u);
});

test("input current-facts collection stays untouched; only bounded topics and immutable original claims",()=>{
 const event=source("new",100,"I do not like music anymore.");
 const old=Object.freeze([{topic:"cats",quote:"Ich liebe Katzen.",polarity:"positive",source_message_id:"cat",source_sequence:4}]);
 const newFacts=applyCurrentInterestAssertion(old,claim(event.content,event),event);
 assert.equal(old.length,1);
 assert.equal(newFacts.length,2);
 assert.equal(newFacts.find(x=>x.topic==="music").quote,event.content);
});

}
