const MONEY = /(?:(EUR|CHF|USD|GBP|Euros?|Franken|Fr\.|Pfund|Pounds?|Dollars?|[€$£])\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(EUR|CHF|USD|GBP|Euros?|Franken|Fr\.|Pfund|Pounds?|Dollars?|[€$£]))/giu;

/** @param {import('@playwright/test').Page} page @param {string} name */
export async function ensureOfferEditor(page, name) {
  const heading = page.getByRole("heading", { name, exact: true });
  if (await heading.count() === 0) {
    await page.getByRole("button", { name: "+ Angebot", exact: true }).click();
    await page.getByRole("heading", { name: "Neues Angebot", exact: true })
      .locator("..").getByLabel("Angebotsname", { exact: true }).fill(name);
  }
  return heading.locator("..");
}

const currencyFor = (token) => {
  if (/^(?:EUR|Euros?|€)$/iu.test(token)) return "EUR";
  if (/^(?:CHF|Franken|Fr\.)$/iu.test(token)) return "CHF";
  if (/^(?:USD|Dollars?|\$)$/iu.test(token)) return "USD";
  if (/^(?:GBP|Pfund|Pounds?|£)$/iu.test(token)) return "GBP";
  throw new Error("chat_admin_manual_currency_evidence");
};

export function monetaryEvidence(reply) {
  return [...reply.matchAll(MONEY)].map((match) => ({
    currency: currencyFor(match[1] ?? match[4]),
    minor: Math.round(Number((match[2] ?? match[3]).replace(",", ".")) * 100),
  }));
}

export function assertReplyPriceEvidence(replies, expected) {
  if (!Array.isArray(replies) || replies.length !== 3 || replies.some((reply) => typeof reply !== "string" || !reply.trim())) {
    throw new Error("chat_admin_manual_reply_evidence");
  }
  for (const reply of replies) {
    const evidence = monetaryEvidence(reply);
    if (expected === null) {
      if (evidence.length) throw new Error("chat_admin_manual_unavailable_offer_price");
      continue;
    }
    if (!evidence.length || evidence.some(({ currency, minor }) => currency !== expected.currency || minor !== expected.minor)) {
      throw new Error("chat_admin_manual_offer_price_mismatch");
    }
  }
}
