export { assertReplyPrices as assertChatAdminReplyPrices } from "./replyPricePolicy.mjs";
import { defaultCreatorBundle, normalizeCreatorBundle } from "./creatorIntelligencePolicy.mjs";

export const CHAT_ADMIN_OFFER_CURRENCIES = Object.freeze(["EUR", "CHF", "USD", "GBP"]);

export const CHAT_ADMIN_OFFER_CATEGORIES = Object.freeze([
  Object.freeze({ id: "photo", name: "Foto", category: "photo" }),
  Object.freeze({ id: "video", name: "Video", category: "video" }),
  Object.freeze({ id: "private_photo", name: "Privates Foto", category: "private_photo" }),
  Object.freeze({ id: "private_video", name: "Privates Video", category: "private_video" }),
]);

export function defaultChatAdminSalesPlaybook() {
  return structuredClone(defaultCreatorBundle().playbook);
}

export function normalizeChatAdminSalesPlaybook(value) {
  const bundle = defaultCreatorBundle();
  bundle.persona.displayName = "ChatAdmin validation";
  bundle.voice.tone = "ChatAdmin validation";
  bundle.playbook = value;
  const normalized = normalizeCreatorBundle(bundle).playbook;
  if (normalized.offers.some((offer) => !CHAT_ADMIN_OFFER_CURRENCIES.includes(offer.currency))) throw new Error("unsupported_chat_admin_currency");
  return normalized;
}

export function resolveChatAdminRequestedOffer(playbook, incomingMessage) {
  const normalized = normalizeChatAdminSalesPlaybook(playbook);
  const incoming = typeof incomingMessage === "string" ? incomingMessage.toLocaleLowerCase() : "";
  // Explicit negation vetoes this message's offer selection, including mixed
  // wishes or unclear scope. Ask for clarification rather than infer consent;
  // this does not persist a sales hold or a declined/purchased event.
  const explicitRefusal = /(?<![\p{L}\p{N}])(?:kein(?:e[nmrs]?)?|keinerlei|nicht|nichts|ohne|no|not|never|don['’]?t|can['’]?t|cannot|won['’]?t)(?![\p{L}\p{N}])/iu.test(incoming);
  if (explicitRefusal) return { playbook: { ...normalized, offers: [] }, requestedOffer: null };
  const privateRequest = /\b(?:privat(?:e[nsr]?|es)?|persönlich(?:e[nsr]?|es)?|exklusiv(?:e[nsr]?|es)?)\b/iu.test(incoming);
  const photoRequest = /\b(?:fotos?|bilder?|pics?|images?)\b/iu.test(incoming);
  const videoRequest = /\b(?:videos?|clips?)\b/iu.test(incoming);
  // A compliment about existing media is not a request to buy more. Preserve
  // short category requests and explicit price/content requests as before.
  const appreciation = /\b(?:schön\w*|schoen\w*|nett\w*|toll\w*|hübsch\w*|huebsch\w*|süß\w*|suess\w*|nice|beautiful|lovely|great)\b/iu.test(incoming);
  const explicitRequest = /\b(?:will|möchte|moechte|hätte|haette|schick\w*|zeig\w*|kauf\w*|bestell\w*|bekomm\w*|kost\w*|preis\w*|wieviel|want|send|show|buy|order|cost\w*|price\w*)\b|\b(?:wie\s+viel|how\s+much)\b|\b(?:kann|könnte|koennte|darf)\s+ich\b.{0,100}\b(?:haben|sehen)\b|\b(?:can|could|may)\s+i\s+(?:get|have|see)\b/iu.test(incoming);
  const callRequest = /\b(?:video[ -]*(?:telefon(?:at|ieren)?|anruf|call|chat)|videotelefon(?:at|ieren)?|telefon(?:at|ieren)|anrufen|facetime)\b/iu.test(incoming);
  const category = callRequest ? null : appreciation && !explicitRequest ? null
    : privateRequest && photoRequest ? "private_photo"
    : privateRequest && videoRequest ? "private_video"
    : photoRequest ? "photo"
    : videoRequest ? "video"
    : null;
  const activeOffers = normalized.offers.filter((offer) => offer.active);
  // Names are literal Character-owned data, never executable expressions. Keep
  // contained names ("Video" inside "Privates Video") from creating ambiguity,
  // but never choose between separately named offers or duplicate names.
  const nameMatches = activeOffers.flatMap(offer => {
    const name = offer.name.toLocaleLowerCase().replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const matcher = new RegExp(`(?<![\\p{L}\\p{N}])${name}(?![\\p{L}\\p{N}])`, "gu");
    return [...incoming.matchAll(matcher)].map(match => ({ offer, start: match.index, end: match.index + match[0].length }));
  });
  const specific = nameMatches.filter(match => !nameMatches.some(other => other.start <= match.start && other.end >= match.end && other.end - other.start > match.end - match.start));
  // Preserve ambiguity before category/private/call filters discard candidates.
  // A contained generic name is already removed above; repeated mentions of the
  // same offer are not multiple offers. Never choose among distinct named IDs.
  const multipleNamedOffers = new Set(specific.map(match => match.offer.id)).size > 1;
  const named = [...new Map(specific.map(match => [match.offer.id, match.offer])).values()].filter(offer => {
    const genericMediaName = /^(?:foto|photo|bild|pic|video|clip)s?$/iu.test(offer.name.trim());
    if(callRequest && (genericMediaName || ["photo","video","private_photo","private_video"].includes(offer.category)))return false;
    return !(privateRequest && (genericMediaName || offer.category === "photo" || offer.category === "video"));
  });
  const byCategory = category ? activeOffers.filter(offer => offer.category === category) : [];
  const candidates = named.length ? named : byCategory;
  const bareNamedRequest = named.length === 1 && incoming.trim().replace(/[?!.,]+$/u, "").trim() === named[0].name.toLocaleLowerCase();
  const customMentionWithoutRequest = named.some(offer => offer.category === "custom") && !explicitRequest && !bareNamedRequest;
  const requested = multipleNamedOffers || (appreciation && !explicitRequest) || (photoRequest && videoRequest) || customMentionWithoutRequest ? null
    : candidates.length === 1 && !candidates[0].requiresConfirmation ? candidates[0] : null;
  return {
    playbook: { ...normalized, offers: requested ? [requested] : [] },
    requestedOffer: requested ? {
      id: requested.id,
      name: requested.name,
      category: requested.category,
      description: requested.description,
      delivery: requested.delivery,
      exclusivity: requested.exclusivity,
      currency: requested.currency,
      minimumPriceMinor: requested.minimumPriceMinor,
      recommendedPriceMinor: requested.recommendedPriceMinor,
      maximumPriceMinor: requested.maximumPriceMinor,
      maximumDiscountPercent: requested.maximumDiscountPercent,
      requiresConfirmation: requested.requiresConfirmation,
    } : null,
  };
}
