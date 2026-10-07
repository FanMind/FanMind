import { defaultCreatorBundle, normalizeCreatorBundle } from "./creatorIntelligencePolicy.mjs";

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
  return normalizeCreatorBundle(bundle).playbook;
}

export function resolveChatAdminRequestedOffer(playbook, incomingMessage) {
  const normalized = normalizeChatAdminSalesPlaybook(playbook);
  const incoming = typeof incomingMessage === "string" ? incomingMessage.toLocaleLowerCase() : "";
  const privateRequest = /\b(?:privat(?:e[nsr]?|es)?|persönlich(?:e[nsr]?|es)?|exklusiv(?:e[nsr]?|es)?)\b/iu.test(incoming);
  const photoRequest = /\b(?:fotos?|bilder?|pics?|images?)\b/iu.test(incoming);
  const videoRequest = /\b(?:videos?|clips?)\b/iu.test(incoming);
  const category = privateRequest && photoRequest ? "private_photo"
    : privateRequest && videoRequest ? "private_video"
    : photoRequest ? "photo"
    : videoRequest ? "video"
    : null;
  const activeOffers = normalized.offers.filter((offer) => offer.active);
  const requested = category ? activeOffers.find((offer) => offer.category === category && !offer.requiresConfirmation) ?? null : null;
  return {
    playbook: { ...normalized, offers: activeOffers },
    requestedOffer: requested ? {
      id: requested.id,
      name: requested.name,
      category: requested.category,
      currency: requested.currency,
      minimumPriceMinor: requested.minimumPriceMinor,
      recommendedPriceMinor: requested.recommendedPriceMinor,
      maximumPriceMinor: requested.maximumPriceMinor,
      maximumDiscountPercent: requested.maximumDiscountPercent,
      requiresConfirmation: requested.requiresConfirmation,
    } : null,
  };
}

export function assertChatAdminReplyPrices(replies, requestedOffer) {
  const monetary = /(?:(?:[€$£]|(?:EUR|USD|GBP|CHF)\b)\s*\d+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?\s*(?:€|\$|£|(?:EUR|USD|GBP|CHF)\b))/giu;
  const barePrice = /\b(?:für(?:\s+dich)?|kostet?|preis(?:\s+liegt)?(?:\s+bei)?|nur)\s+\d+(?:[.,]\d{1,2})?\b/iu;
  for (const reply of replies) {
    const matches = [...reply.matchAll(monetary)].map((match) => match[0]);
    if (matches.length === 0 && barePrice.test(reply)) throw new Error("reply_price_not_permitted");
    if (matches.length === 0) continue;
    if (!requestedOffer) throw new Error("reply_price_not_permitted");
    const expected = requestedOffer.recommendedPriceMinor;
    const currency = requestedOffer.currency;
    for (const match of matches) {
      const number = match.match(/\d+(?:[.,]\d{1,2})?/u)?.[0];
      const amountMinor = number ? Math.round(Number(number.replace(",", ".")) * 100) : NaN;
      const symbolMatches = currency === "EUR" ? match.includes("€") || /EUR/iu.test(match)
        : currency === "USD" ? match.includes("$") || /USD/iu.test(match)
        : currency === "GBP" ? match.includes("£") || /GBP/iu.test(match)
        : currency === "CHF" ? /CHF/iu.test(match)
        : false;
      if (amountMinor !== expected || !symbolMatches) throw new Error("reply_price_not_permitted");
    }
  }
  return replies;
}
