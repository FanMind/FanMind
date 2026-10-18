import assert from "node:assert/strict";
import test from "node:test";
import { extractChatAdminFacts, learnChatAdminKnowledge, readChatAdminKnowledge, writeChatAdminKnowledge } from "../src/lib/chatAdminKnowledge.mjs";

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
