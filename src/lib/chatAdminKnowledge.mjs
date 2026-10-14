import { deriveCreatorStrategy } from "./creatorIntelligencePolicy.mjs";

const MARKER = "\n\n[FanMind-Kontaktwissen v1]\n";
const KINDS = ["communication", "interest", "boundary"];
// Learn only complete statements from a small non-sensitive vocabulary.
// Free-form personal/sensitive conclusions remain outside automatic learning.
const SUPPORTED = {
 communication: /^(?:(?:ich (?:mag|bevorzuge)|bitte (?:schreibe|schreib)) (?:(?:kurze|lange|direkte|lockere|freundliche) (?:antworten|nachrichten))(?: (?:ohne|mit) emojis)?|(?:bitte )?(?:keine|ohne) emojis|i prefer (?:short|long|direct|casual|friendly) (?:replies|messages)(?: (?:with|without) emojis)?)[.!]?$/iu,
 interest: /^(?:ich (?:mag|liebe|bevorzuge)|i (?:like|love|prefer)) (?:fotos|videos|katzen|hunde|sport|reisen|kochen|musik|photos|cats|dogs|travel|cooking|music)(?: (?:und|and) (?:fotos|videos|katzen|hunde|sport|reisen|kochen|musik|photos|cats|dogs|travel|cooking|music))*[.!]?$/iu,
 boundary: /^(?:(?:bitte keine|ich (?:will|möchte) keine) (?:angebote|verkaufsgespräche|nachfragen|emojis)|(?:please no|i do not want) (?:offers|sales|questions|emojis))[.!]?$/iu,
};

export function extractChatAdminFacts(content, source) {
 if (typeof content !== "string") return [];
 return content.split(/(?<=[.!?])\s+|\n/u).flatMap(sentence => {
   const quote = sentence.trim();
   const kind = KINDS.find(key => SUPPORTED[key].test(quote));
   return kind ? [{kind,quote,source}] : [];
 }).slice(0,3);
}

// Reuse the existing Fan notes row, its RLS, export and deletion lifecycle.
// Manual notes are kept separately and never replaced by learned facts.
export function readChatAdminKnowledge(notes) {
  const raw = typeof notes === "string" ? notes : "";
  const index = raw.lastIndexOf(MARKER);
  if (index < 0) return { manual: raw, facts: [], commercial: {} };
  try {
    const value = JSON.parse(raw.slice(index + MARKER.length));
    if (value.version !== 1 || !Array.isArray(value.facts) || value.facts.length > 8) throw new Error("invalid_knowledge");
    const facts = value.facts.filter(fact => fact && KINDS.includes(fact.kind) && typeof fact.quote === "string" && fact.quote.length <= 240 && typeof fact.source === "string" && fact.source.length <= 80);
    return { manual: raw.slice(0, index), facts, commercial: normalizeChatAdminCommercial(value.commercial) };
  } catch { return { manual: raw, facts: [], commercial: {} }; }
}

export function normalizeChatAdminCommercial(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const stage = ["new", "familiar", "trusted"].includes(value.stage) ? value.stage : "new";
  const source = typeof value.source === "string" ? value.source.trim().slice(0, 160) : "";
  const date = key => typeof value[key] === "string" && Number.isFinite(Date.parse(value[key])) ? new Date(value[key]).toISOString() : null;
  return { stage, salesHold: value.salesHold === true, source, lastPurchaseAt: source ? date("lastPurchaseAt") : null, lastOfferAt: source ? date("lastOfferAt") : null, lastDeclinedAt: source ? date("lastDeclinedAt") : null };
}

export function writeChatAdminKnowledge({ manual = "", facts = [], commercial = {} }) {
  if(!Array.isArray(facts)||facts.length>8)throw new Error("invalid_knowledge");
  const normalized = normalizeChatAdminCommercial(commercial);
  if (!facts.length && normalized.stage === "new" && !normalized.salesHold && !normalized.source) return manual;
  const result = manual + MARKER + JSON.stringify({ version: 1, facts, commercial: normalized });
  if (result.length > 4_000) throw new Error("knowledge_too_large");
  return result;
}

export function learnChatAdminKnowledge(notes, proposed, sources) {
  if (!Array.isArray(proposed) || proposed.length > 3) return notes;
  const knowledge = readChatAdminKnowledge(notes);
  for (const fact of [...proposed].sort((a,b) => sources.findIndex(row => row.id === a?.source) - sources.findIndex(row => row.id === b?.source))) {
    const source = sources.find(row => row.id === fact?.source && row.direction === "fan_inbound");
    if (!source || !KINDS.includes(fact.kind) || typeof fact.quote !== "string") continue;
    const quote = fact.quote.trim();
    const order=Number.isSafeInteger(source.sequence)?source.sequence:0;
    if (!quote || quote.length > 240 || !source.content.includes(quote) || !SUPPORTED[fact.kind].test(quote)) continue;
    if(fact.kind==="communication" && knowledge.facts.some(old=>old.kind==="communication" && (old.source_sequence??0)>order))continue;
    // Latest communication statement wins; independent boundaries are retained.
    const boundaryKey=text=>/angebot|verkauf|offer|sales/iu.test(text)?"sales":/emoji/iu.test(text)?"emoji":"questions";
    knowledge.facts = knowledge.facts.filter(old => old.quote !== quote && (fact.kind !== "communication" || old.kind !== fact.kind) && !(fact.kind==="boundary" && old.kind==="boundary" && boundaryKey(old.quote)===boundaryKey(quote)));
    knowledge.facts.push({ kind: fact.kind, quote, source: source.memory_source ?? source.id, source_sequence: order });
    if(knowledge.facts.length>8){
      const boundaries=knowledge.facts.filter(old=>old.kind==="boundary");
      const other=knowledge.facts.filter(old=>old.kind!=="boundary");
      const retained=boundaries.slice(-8);
      const slots=8-retained.length;
      knowledge.facts=[...retained,...(slots>0?other.slice(-slots):[])];
    }
  }
  try { return writeChatAdminKnowledge(knowledge); } catch { return notes; }
}

export function deriveChatAdminStrategy(playbook, fan, requestedOffer, now = Date.now()) {
  const knowledge = readChatAdminKnowledge(fan.notes);
  const commercial = knowledge.commercial;
  const events = [["purchase", commercial.lastPurchaseAt], ["offer", commercial.lastOfferAt], ["offer_declined", commercial.lastDeclinedAt]]
    .filter(([, at]) => at && Date.parse(at) <= now)
    .map(([kind, at]) => ({ kind, occurred_at: at, confirmed_at: at, confirmed_by: "workspace_owner" }));
  const strategy = deriveCreatorStrategy({ playbook, commercial: { salesHold: commercial.salesHold }, events, now });
  // The current explicit request is an offer permission, never a purchase/score.
  const latest = kind => events.filter(event => event.kind === kind).some(event => now - Date.parse(event.occurred_at) < playbook.minimumHoursBetweenOffers * 3_600_000);
  const boundaryHold = knowledge.facts.some(fact => fact.kind === "boundary" && /angebot|verkauf|druck|offer|sales|pressure/iu.test(fact.quote));
  const blocked = commercial.salesHold || boundaryHold || strategy.state === "AFTERCARE" || latest("offer") || latest("offer_declined");
  const sellNow = !!requestedOffer && !blocked;
  return { ...strategy, state: sellNow ? "OFFER" : strategy.state, reason: boundaryHold ? "fan_boundary" : sellNow ? "explicit_current_request" : blocked ? "sales_pause_or_aftercare" : strategy.reason, objective: sellNow ? "present_requested_offer" : "relationship_without_sales_pressure", sellNow, relationship_stage: commercial.stage ?? "new", customer_tier: fan.customer_tier ?? "red", variantGuidance: sellNow ? { recommended: "Beantworte die konkrete Anfrage natürlich.", softer: "Beantworte dieselbe Anfrage weicher und ohne Druck.", stronger: "Beantworte dieselbe Anfrage direkt, ohne zusätzliche Intimität oder Dringlichkeit." } : strategy.variantGuidance };
}
