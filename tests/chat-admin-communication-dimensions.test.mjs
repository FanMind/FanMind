import assert from "node:assert/strict";
import test from "node:test";
import { extractChatAdminFacts, learnChatAdminKnowledge, readChatAdminKnowledge, writeChatAdminKnowledge } from "../src/lib/chatAdminKnowledge.mjs";
import { buildChatAdminFanContext } from "../src/lib/chatAdminPolicy.mjs";

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
