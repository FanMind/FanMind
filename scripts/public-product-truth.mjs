export const PUBLIC_PRODUCT_TRUTH_RULES = Object.freeze({
  germanLanding: Object.freeze({
    includes: Object.freeze([
      "Kontaktwissen",
      "Keine automatische Sendefunktion",
      "99 €/Monat",
      "199 €/Monat",
      "312 €/Monat",
      "0 € Einrichtung",
      "Bezahlte Aktivierung in Vorbereitung",
    ]),
    excludes: Object.freeze([
      "Fan-Gedächtnis",
      "Pilot anfragen",
      "Pilot / Setup",
      "990 € Setup",
      "Starter Flex",
      "Starter 12 Monate",
      "299 €/Monat",
      "499 €/Monat",
      "Agency ab 990 €/Monat",
      "zzgl. USt.",
      "MVP-Workspace",
      "Memory",
    ]),
  }),
  englishLanding: Object.freeze({
    includes: Object.freeze([
      "Your AI-powered",
      "contact knowledge",
      "no automatic sending",
    ]),
    excludes: Object.freeze([
      "Dein KI-gestütztes",
      "Kostenlos testen",
      "Produktvorschau für dein",
    ]),
  }),
  registration: Object.freeze({
    includes: Object.freeze(["99 €/Monat", "199 €/Monat", "312 €/Monat", "0 € Einrichtung"]),
    excludes: Object.freeze([
      "299",
      "Pilot / Setup",
      "Pilot anfragen",
      "990 € Setup",
      "Starter Flex",
      "Starter 12 Monate",
      "zzgl. USt.",
    ]),
  }),
});

export function visibleText(html) {
  return String(html ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&euro;|&#8364;/gi, "€")
    .replace(/\s+/g, " ")
    .trim();
}

export function evaluatePublicProductTruth(text, rules) {
  const normalizedText = String(text ?? "").toLocaleLowerCase("de");

  for (const value of rules.includes ?? []) {
    if (!normalizedText.includes(value.toLocaleLowerCase("de"))) {
      return { ok: false, detail: `Pflichttext fehlt: ${value}` };
    }
  }

  for (const value of rules.excludes ?? []) {
    if (normalizedText.includes(value.toLocaleLowerCase("de"))) {
      return { ok: false, detail: `veralteter Text gefunden: ${value}` };
    }
  }

  return { ok: true, detail: "öffentliche Produktwahrheit bestätigt" };
}
