import test from "node:test";
import assert from "node:assert/strict";
import { applyCurrentInterestAssertion } from "../src/lib/chatAdminCurrentFactsPolicy.mjs";

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
