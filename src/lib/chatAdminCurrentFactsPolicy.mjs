import { extractChatAdminFacts } from "./chatAdminKnowledge.mjs";
// Source policy shared by the prepared default-off reader and offline checks.
// It never proves DB authorization: native PG17 verifies the controlled writer;
// protected installation and runtime acceptance remain separate.
const aliases = new Map([
 ["musik","music"],["music","music"],
 ["katzen","cats"],["cats","cats"],
 ["hunde","dogs"],["dogs","dogs"],
 ["reisen","travel"],["travel","travel"],
 ["sport","sports"],["sports","sports"],
 ["fotos","photos"],["photos","photos"],
 ["videos","videos"],["kochen","cooking"],["cooking","cooking"],
]);
const item = "(?:musik|music|katzen|cats|hunde|dogs|reisen|travel|sport|sports|fotos|photos|videos|kochen|cooking)";
const positive = new RegExp("^(?:ich (?:mag|liebe|bevorzuge)|i (?:like|love|prefer)) ("+item+")[.!]?$","iu");
const negative = new RegExp("^(?:ich (?:mag|liebe|bevorzuge) (?:(?:keine ("+item+") mehr)|("+item+") nicht mehr)|i (?:(?:do not|don['’]t) like ("+item+") anymore|no longer like ("+item+")))[.!]?$","iu");

export function classifyCurrentInterestQuote(quote) {
 if (typeof quote !== "string" || quote.length > 240 || quote !== quote.trim()) return null;
 const negativeMatch=negative.exec(quote);
 const positiveMatch=positive.exec(quote);
 const match=negativeMatch||positiveMatch;
 if (!match) return null;
 const token=match.slice(1).find(Boolean)?.toLowerCase();
 const topic=aliases.get(token);
 return topic?{topic,polarity:negativeMatch?"negative":"positive"}:null;
}

const bindingKeys = ["workspace_id","character_id","fan_id","conversation_id"];
const bound = (value,binding) => bindingKeys.every(key => typeof binding?.[key] === "string" && !!binding[key] && value?.[key] === binding[key]);
const validId = value => typeof value === "string" && value.length > 0 && value.length <= 80;

// This validates an already loaded source, never proves DB authorization.
export function extractCurrentInterestAssertions(savedInbound,binding) {
 if (!bound(savedInbound,binding) || savedInbound.direction !== "fan_inbound" || !validId(savedInbound.id) || !validId(savedInbound.generation_id) || !Number.isSafeInteger(savedInbound.sequence) || savedInbound.sequence <= 0 || typeof savedInbound.content !== "string" || savedInbound.content.length > 4000) throw new Error("invalid_interest_source");
 const statements=savedInbound.content.split(/(?<=[.!?])\s+|\n/u).map(s=>s.trim()).filter(Boolean);
 // Entire-message grammar: quoted/hypothetical or mixed unsupported context
 // is uncertain. Decline it rather than elevating a matching line to fact.
 if (!statements.length || statements.some(quote=>!classifyCurrentInterestQuote(quote) && !extractChatAdminFacts(quote,"literal").some(fact=>fact.quote===quote && fact.kind!=="interest"))) return [];
 const last=new Map();
 statements.forEach((quote,index)=>{
  const parsed=classifyCurrentInterestQuote(quote);
  if(!parsed)return;
  last.set(parsed.topic,{...binding,...parsed,quote,source_message_id:savedInbound.id,source_sequence:savedInbound.sequence,source_statement_index:index});
 });
 return [...last.values()];
}

export function validateCurrentInterestFacts(current,binding) {
 if (!Array.isArray(current) || current.length > aliases.size) throw new Error("interest_order_conflict");
 const seen=new Set();
 for(const fact of current){
  const parsed=classifyCurrentInterestQuote(fact?.quote);
  if(!bound(fact,binding) || !parsed || fact.topic!==parsed.topic || fact.polarity!==parsed.polarity || seen.has(fact.topic) || !validId(fact.source_message_id) || !Number.isSafeInteger(fact.source_sequence) || fact.source_sequence<=0 || !Number.isSafeInteger(fact.source_statement_index) || fact.source_statement_index<0 || fact.source_statement_index>3999) throw new Error("interest_order_conflict");
  seen.add(fact.topic);
 }
 return current;
}

export function applyCurrentInterestAssertion(current, proposed, savedInbound, binding) {
 const candidates=extractCurrentInterestAssertions(savedInbound,binding);
 if(!bound(proposed,binding) || proposed.source_message_id!==savedInbound.id || proposed.source_sequence!==savedInbound.sequence)throw new Error("invalid_interest_source");
 const next=candidates.find(fact=>fact.topic===proposed.topic && fact.quote===proposed.quote && fact.source_statement_index===proposed.source_statement_index);
 if(!next)throw new Error("invalid_interest_claim");
 validateCurrentInterestFacts(current,binding);
 const old=current.find(fact=>fact.topic===next.topic);
 if(old){
  if(old.source_sequence>next.source_sequence)return current;
  if(old.source_sequence===next.source_sequence){
   if(old.source_message_id===next.source_message_id && old.quote===next.quote && old.polarity===next.polarity && old.source_statement_index===next.source_statement_index)return current;
   throw new Error("interest_order_conflict");
  }
 }
 return [...current.filter(fact=>fact.topic!==next.topic),next];
}
