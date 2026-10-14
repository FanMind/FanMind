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
  // A compliment about existing media is not a request to buy more. Preserve
  // short category requests and explicit price/content requests as before.
  const appreciation = /\b(?:schön\w*|schoen\w*|nett\w*|toll\w*|hübsch\w*|huebsch\w*|süß\w*|suess\w*|nice|beautiful|lovely|great)\b/iu.test(incoming);
  const explicitRequest = /\b(?:will|möchte|moechte|hätte|haette|schick\w*|zeig\w*|kauf\w*|bestell\w*|bekomm\w*|kost\w*|preis\w*|wieviel|want|send|show|buy|order|cost\w*|price\w*)\b|\b(?:wie\s+viel|how\s+much)\b|\b(?:kann|könnte|koennte|darf)\s+ich\b.{0,100}\b(?:haben|sehen)\b|\b(?:can|could|may)\s+i\s+(?:get|have|see)\b/iu.test(incoming);
  const category = appreciation && !explicitRequest ? null
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
  const named = [...new Map(specific.map(match => [match.offer.id, match.offer])).values()].filter(offer => {
    const genericMediaName = /^(?:foto|photo|bild|pic|video|clip)s?$/iu.test(offer.name.trim());
    return !(privateRequest && (genericMediaName || offer.category === "photo" || offer.category === "video"));
  });
  const byCategory = category ? activeOffers.filter(offer => offer.category === category) : [];
  const candidates = named.length ? named : byCategory;
  const bareNamedRequest = named.length === 1 && incoming.trim().replace(/[?!.,]+$/u, "").trim() === named[0].name.toLocaleLowerCase();
  const customMentionWithoutRequest = named.some(offer => offer.category === "custom") && !explicitRequest && !bareNamedRequest;
  const requested = (appreciation && !explicitRequest) || (photoRequest && videoRequest) || customMentionWithoutRequest ? null
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

export function assertChatAdminReplyPrices(replies, requestedOffer) {
  const isoCurrency = "(?:AED|AFN|ALL|AMD|ANG|AOA|ARS|AUD|AWG|AZN|BAM|BBD|BDT|BGN|BHD|BIF|BMD|BND|BOB|BOV|BRL|BSD|BTN|BWP|BYN|BZD|CAD|CDF|CHE|CHF|CHW|CLF|CLP|CNY|COP|COU|CRC|CUC|CUP|CVE|CZK|DJF|DKK|DOP|DZD|EGP|ERN|ETB|EUR|FJD|FKP|GBP|GEL|GHS|GIP|GMD|GNF|GTQ|GYD|HKD|HNL|HRK|HTG|HUF|IDR|ILS|INR|IQD|IRR|ISK|JMD|JOD|JPY|KES|KGS|KHR|KMF|KPW|KRW|KWD|KYD|KZT|LAK|LBP|LKR|LRD|LSL|LYD|MAD|MDL|MGA|MKD|MMK|MNT|MOP|MRU|MUR|MVR|MWK|MXN|MXV|MYR|MZN|NAD|NGN|NIO|NOK|NPR|NZD|OMR|PAB|PEN|PGK|PHP|PKR|PLN|PYG|QAR|RON|RSD|RUB|RWF|SAR|SBD|SCR|SDG|SEK|SGD|SHP|SLE|SLL|SOS|SRD|SSP|STN|SVC|SYP|SZL|THB|TJS|TMT|TND|TOP|TRY|TTD|TWD|TZS|UAH|UGX|USD|USN|UYI|UYU|UYW|UZS|VED|VES|VND|VUV|WST|XAF|XAG|XAU|XBA|XBB|XBC|XBD|XCD|XCG|XDR|XOF|XPD|XPF|XPT|XSU|XTS|XUA|XXX|YER|ZAR|ZMW|ZWL)";
  const supportedIsoCurrency = "(?:EUR|CHF|USD|GBP)";
  const nonWordIsoCurrency = `(?!(?:ALL|BAM|BOB|COP|CUP|GEL|MAD|MOP|PEN|RUB|SOS|TOP|TRY)\\b)${isoCurrency}`;
  const canonicalNumericIsoCurrency = `(?!(?:ALL|BAM|BOB|CUP|GEL|MAD|PEN|TOP|TRY)\\b)${isoCurrency}`;
  const writtenNumber = "(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|ein(?:s|e[nm]?)?|zwei|drei|vier|f(?:ü|ue)nf|sechs|sieben|acht|neun|zehn|elf|zw(?:ö|oe)lf|dreizehn|vierzehn|f(?:ü|ue)nfzehn|sechzehn|siebzehn|achtzehn|neunzehn|zwanzig|dreißig|dreissig|vierzig|f(?:ü|ue)nfzig|sechzig|siebzig|achtzig|neunzig|hundert|tausend|million)[\\p{L}-]*";
  const namedCurrency = "(?:Euro(?:s)?|Dollar(?:s)?|Pfund|Pounds?|Franken|Fr\\.)";
  const standaloneNamedCurrency = "(?:Euro(?:s)?|Dollar(?:s)?|Pfund|Pounds?|Franken)";
  const currencyMarker = new RegExp(`(?:\\p{Sc}|\\b${supportedIsoCurrency}\\b|\\b${standaloneNamedCurrency}(?=\\s|$|[.!?]))`, "iu");
  const namedMonetary = new RegExp(`(?:(?:\\p{Sc}|\\b${namedCurrency})\\s*\\d+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?\\s*(?:\\p{Sc}|\\b${namedCurrency}))`, "giu");
  const supportedIsoMonetary = new RegExp(`(?:\\b${supportedIsoCurrency}\\b\\s*\\d+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?\\s*\\b${supportedIsoCurrency}\\b)`, "giu");
  const otherIsoMonetary = new RegExp(`(?:\\b${nonWordIsoCurrency}\\b\\s*\\d+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?\\s*\\b${nonWordIsoCurrency}\\b)`, "giu");
  const canonicalIsoMonetary = new RegExp(`(?:\\b${canonicalNumericIsoCurrency}\\b\\s*\\d+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?\\s*\\b${canonicalNumericIsoCurrency}\\b)`, "gu");
  const writtenIsoMonetary = new RegExp(`(?:\\b${writtenNumber}\\s+${nonWordIsoCurrency}\\b|\\b${nonWordIsoCurrency}\\s+${writtenNumber}\\b)`, "giu");
  const strongPriceContext = "(?:kostet?|preis(?:\\s+liegt)?(?:\\s+bei)?|costs?|price(?:\\s+is)?)";
  const weakPriceContext = "(?:für(?:\\s+dich)?|for(?:\\s+you)?|only|nur)";
  const contextualIsoMonetary = new RegExp(`\\b${strongPriceContext}\\s*:?\\s+(?:(?:\\d+(?:[.,]\\d{1,2})?|${writtenNumber}(?:\\s+${writtenNumber})*)\\s+${isoCurrency}|${isoCurrency}\\s+(?:\\d+(?:[.,]\\d{1,2})?|${writtenNumber}(?:\\s+${writtenNumber})*))\\b`, "giu");
  const weakContextualCanonicalIsoMonetary = new RegExp(`\\b${weakPriceContext}\\s+(?:(?:\\d+(?:[.,]\\d{1,2})?|${writtenNumber}(?:\\s+${writtenNumber})*)\\s+${isoCurrency}|${isoCurrency}\\s+(?:\\d+(?:[.,]\\d{1,2})?|${writtenNumber}(?:\\s+${writtenNumber})*))\\b`, "gu");
  const barePrice = /\b(?:für(?:\s+dich)?|kostet?|preis(?:\s+liegt)?(?:\s+bei)?|nur)\s+\d+(?:[.,]\d{1,2})?(?=\s*(?:[.!?]|$))/iu;
  const priceNotation = /\b\d+(?:[.,]\d{1,2})?\s*(?:[.,]-|[-–—])(?=\s|$|[!?])/u;
  for (const reply of replies) {
    const matches = [...reply.matchAll(namedMonetary), ...reply.matchAll(supportedIsoMonetary), ...reply.matchAll(canonicalIsoMonetary), ...reply.matchAll(otherIsoMonetary), ...reply.matchAll(writtenIsoMonetary), ...reply.matchAll(contextualIsoMonetary), ...reply.matchAll(weakContextualCanonicalIsoMonetary)].map((match) => match[0]);
    const unmatched = matches.reduce((text, match) => text.replace(match, " "), reply);
    if (currencyMarker.test(unmatched) || barePrice.test(unmatched) || priceNotation.test(unmatched)) throw new Error("reply_price_not_permitted");
    if (matches.length === 0) continue;
    if (!requestedOffer) throw new Error("reply_price_not_permitted");
    const expected = requestedOffer.recommendedPriceMinor;
    const currency = requestedOffer.currency;
    for (const match of matches) {
      const number = match.match(/\d+(?:[.,]\d{1,2})?/u)?.[0];
      const amountMinor = number ? Math.round(Number(number.replace(",", ".")) * 100) : NaN;
      const currencyWord = currency === "EUR" ? /(?:EUR|Euros?)/iu
        : currency === "USD" ? /(?:USD|Dollars?)/iu
        : currency === "GBP" ? /(?:GBP|Pfund|Pounds?)/iu
        : currency === "CHF" ? /(?:CHF|Franken|Fr\.)/iu
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
