// Offline policy contract only. NOT connected to database writes, model context
// or deployed ChatAdmin runtime. Database authorization/atomicity must be proved
// in a separate controlled schema and native-PG17 acceptance.
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

function parseLiteral(quote) {
 if (typeof quote !== "string" || quote.length > 240 || quote !== quote.trim()) return null;
 const negativeMatch=negative.exec(quote);
 const positiveMatch=positive.exec(quote);
 const match=negativeMatch||positiveMatch;
 if (!match) return null;
 const token=match.slice(1).find(Boolean)?.toLowerCase();
 const topic=aliases.get(token);
 return topic?{topic,polarity:negativeMatch?"negative":"positive"}:null;
}

export function applyCurrentInterestAssertion(current, proposed, savedInbound) {
 if (!Array.isArray(current) || !proposed || typeof proposed !== "object")throw new Error("invalid_interest_claim");
 if (!savedInbound || savedInbound.direction!=="fan_inbound" ||
     typeof savedInbound.id!=="string" || !savedInbound.id ||
     proposed.source_message_id!==savedInbound.id ||
     !Number.isSafeInteger(savedInbound.sequence) || savedInbound.sequence<=0 ||
     proposed.source_sequence!==savedInbound.sequence ||
     typeof savedInbound.content!=="string")throw new Error("invalid_interest_source");
 const parsed=parseLiteral(proposed.quote);
 // Only literal complete source statements. Never accept a substring of a
 // quoted hypothetical sentence as a direct fan preference.
 const statements=savedInbound.content.split(/(?<=[.!?])\s+|\n/u).map(s=>s.trim());
 if (!parsed || proposed.topic!==parsed.topic || !statements.includes(proposed.quote))throw new Error("invalid_interest_claim");
 if(current.some(f=>!f || typeof f.topic!=="string" || !Number.isSafeInteger(f.source_sequence)))throw new Error("interest_order_conflict");
 const old=current.find(f=>f.topic===parsed.topic);
 if(old){
   if(old.source_sequence>savedInbound.sequence) return current;
   if(old.source_sequence===savedInbound.sequence){
     if(old.source_message_id===savedInbound.id && old.quote===proposed.quote && old.polarity===parsed.polarity)return current;
     throw new Error("interest_order_conflict");
   }
 }
 const next={topic:parsed.topic,polarity:parsed.polarity,quote:proposed.quote,source_message_id:savedInbound.id,source_sequence:savedInbound.sequence};
 return [...current.filter(f=>f.topic!==parsed.topic),next];
}
