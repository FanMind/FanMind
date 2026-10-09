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
    playbook: { ...normalized, offers: requested ? [requested] : [] },
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
  const namedCurrency = /\p{Sc}|\b(?:Euro|Dollar|Pfund|Franken)\b/iu;
  const isoCurrency = "(?:AED|AFN|ALL|AMD|ANG|AOA|ARS|AUD|AWG|AZN|BAM|BBD|BDT|BGN|BHD|BIF|BMD|BND|BOB|BOV|BRL|BSD|BTN|BWP|BYN|BZD|CAD|CDF|CHE|CHF|CHW|CLF|CLP|CNY|COP|COU|CRC|CUC|CUP|CVE|CZK|DJF|DKK|DOP|DZD|EGP|ERN|ETB|EUR|FJD|FKP|GBP|GEL|GHS|GIP|GMD|GNF|GTQ|GYD|HKD|HNL|HRK|HTG|HUF|IDR|ILS|INR|IQD|IRR|ISK|JMD|JOD|JPY|KES|KGS|KHR|KMF|KPW|KRW|KWD|KYD|KZT|LAK|LBP|LKR|LRD|LSL|LYD|MAD|MDL|MGA|MKD|MMK|MNT|MOP|MRU|MUR|MVR|MWK|MXN|MXV|MYR|MZN|NAD|NGN|NIO|NOK|NPR|NZD|OMR|PAB|PEN|PGK|PHP|PKR|PLN|PYG|QAR|RON|RSD|RUB|RWF|SAR|SBD|SCR|SDG|SEK|SGD|SHP|SLE|SLL|SOS|SRD|SSP|STN|SVC|SYP|SZL|THB|TJS|TMT|TND|TOP|TRY|TTD|TWD|TZS|UAH|UGX|USD|USN|UYI|UYU|UYW|UZS|VED|VES|VND|VUV|WST|XAF|XAG|XAU|XBA|XBB|XBC|XBD|XCD|XCG|XDR|XOF|XPD|XPF|XPT|XSU|XTS|XUA|XXX|YER|ZAR|ZMW|ZWL)";
  const writtenNumber = "(?:zwei|drei|vier|f(?:ü|ue)nf|sechs|sieben|acht|neun|zehn|elf|zw(?:ö|oe)lf|dreizehn|vierzehn|f(?:ü|ue)nfzehn|sechzehn|siebzehn|achtzehn|neunzehn|zwanzig|dreißig|dreissig|vierzig|f(?:ü|ue)nfzig|sechzig|siebzig|achtzig|neunzig|hundert|tausend)[\\p{L}-]*";
  const namedMonetary = /(?:(?:\p{Sc}|\b(?:Euro|Dollar|Pfund|Franken)\b)\s*\d+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?\s*(?:\p{Sc}|\b(?:Euro|Dollar|Pfund|Franken)\b))/giu;
  const isoMonetary = new RegExp(`(?:\\b${isoCurrency}\\b\\s*\\d+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?\\s*\\b${isoCurrency}\\b)`, "gu");
  const isoWrittenMonetary = new RegExp(`(?:\\b${writtenNumber}\\s+${isoCurrency}\\b|\\b${isoCurrency}\\s+${writtenNumber}\\b)`, "gu");
  const barePrice = /\b(?:für(?:\s+dich)?|kostet?|preis(?:\s+liegt)?(?:\s+bei)?|nur)\s+\d+(?:[.,]\d{1,2})?(?=\s*(?:[.!?]|$))/iu;
  const priceNotation = /\b\d+(?:[.,]\d{1,2})?\s*(?:[.,]-|[-–—])(?=\s|$|[!?])/u;
  for (const reply of replies) {
    const matches = [...reply.matchAll(namedMonetary), ...reply.matchAll(isoMonetary)].map((match) => match[0]);
    const hasWrittenIsoPrice = isoWrittenMonetary.test(reply);
    isoWrittenMonetary.lastIndex = 0;
    if (matches.length === 0 && (barePrice.test(reply) || namedCurrency.test(reply) || hasWrittenIsoPrice || priceNotation.test(reply))) throw new Error("reply_price_not_permitted");
    if (matches.length === 0) continue;
    if (!requestedOffer) throw new Error("reply_price_not_permitted");
    const expected = requestedOffer.recommendedPriceMinor;
    const currency = requestedOffer.currency;
    for (const match of matches) {
      const number = match.match(/\d+(?:[.,]\d{1,2})?/u)?.[0];
      const amountMinor = number ? Math.round(Number(number.replace(",", ".")) * 100) : NaN;
      const currencyWord = currency === "EUR" ? /(?:EUR|Euro)/iu
        : currency === "USD" ? /(?:USD|Dollar)/iu
        : currency === "GBP" ? /(?:GBP|Pfund)/iu
        : currency === "CHF" ? /(?:CHF|Franken)/iu
        : new RegExp(`\\b${currency}\\b`, "iu");
      const symbolMatches = currencyWord.test(match)
        || (currency === "EUR" && match.includes("€"))
        || (currency === "USD" && match.includes("$"))
        || (currency === "GBP" && match.includes("£"));
      if (amountMinor !== expected || !symbolMatches) throw new Error("reply_price_not_permitted");
    }
  }
  return replies;
}
