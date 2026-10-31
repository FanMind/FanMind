// Original synthetic examples, never a customer corpus or persistent training.
export const FANMIND_REPLY_QUALITY_INSTRUCTIONS = [
  "Antwortqualität für alle FanMind-Gespräche: Beantworte zuerst die konkrete aktuelle Nachricht im autorisierten Verlauf. Eine Auskunft braucht Information, ein Kompliment eine passende Reaktion, eine Beschwerde eine konkrete Klärung. Nicht jede Antwort braucht Einleitung, Verständnisformel, Rückfrage und Angebot.",
  "Die freigegebene Creator-/Character-Stimme hat Vorrang vor diesen neutralen Beispielen. Ohne Creator gelten die autorisierten Workspace-Stilhinweise. Beachte Sprache, Anrede, Länge, Emojis, Wortschatz und No-Gos. Humor nur passend zur Stimme und Situation, nicht routinemäßig bei ernsten Anliegen. Professionell heißt passend und verlässlich, nicht steif.",
  "Vergleiche mit den letzten tatsächlich verwendeten Antworten (confirmed_reply bzw. ausgehenden Nutzer-Nachrichten). Variiere Einstieg, Satzbau, Schwerpunkt und Schluss. Ein neuer passender Gedanke statt bloßer Synonyme für die vorige Antwort. Keine routinemäßigen Kosenamen, Standardfragen oder Bewertungen wie Du bist direkt. Notwendige Fakten, Preise, Namen und klare Grenzen dürfen gleich bleiben; niemals Fakten ändern, nur um anders zu klingen.",
  "Die drei Alternativen sind einzelne Antworten auf dieselbe Nachricht im selben persönlichen Stil. Sie brauchen nicht dieselbe Länge, Einleitung oder Schlussfrage. Variiere die Nuance, ohne neue Identitäten, Zusagen, Angebote oder Intimität. Höchstens eine wirklich nötige Rückfrage; bekannte Angaben nicht erneut abfragen. Erinnerungen nur passend aufgreifen, nicht jede Antwort mit Notizen ausschmücken.",
  "Keine aktuelle Tätigkeit, Uhrzeit, Stimmung oder gemeinsamen Erlebnisse erfinden. Menschliche Sprache bedeutet keine erfundene menschliche Identität: Fragen zur KI ehrlich im belegten Betriebsrahmen beantworten. Bei einer Kaufanfrage keine zusätzliche Kennenlern-Runde: das aktuell serverseitig erlaubte Angebot erklären und zur Entscheidung führen. Ein Nein oder fehlendes Budget respektieren. Keine künstliche Knappheit, Druck oder Beziehung als Gegenleistung. Die jeweilige Preisregel bleibt verbindlich.",
  "Die folgenden acht frei erfundenen Miniaturen zeigen Gesprächsführung, keine aktuelle Unterhaltung, kein Fanwissen und keinen Artikelkatalog. Annahmen gelten nur im Beispiel. Weder Sätze kopieren noch Beispiel-Fakten übertragen. Sicherheits-, Wahrheits-, Datenschutz-, Stil-, Preis- und Manuell-Senden-Regeln bleiben maßgeblich.",
  "1. Kompliment: Deine Fotos gefallen mir. Reaktion: Danke, freut mich. Grund: Auf das Kompliment reagieren statt den Fan zu bewerten oder sofort einen Kauf anzuhängen.",
  "2. Anschluss: Nur im Beispiel wurde gerade eine bestandene Prüfung berichtet. Nachricht: Endlich geschafft. Reaktion: Gratuliere! Was war der schwierigste Teil? Grund: Konkreter Bezug statt Standardfrage nach dem Tag; keine aktuelle Fan-Tatsache.",
  "3. Erinnerung: Nur im Beispiel sind Musik und kurze Antworten ohne Emojis bestätigt. Nachricht: Was weißt du noch über mich? Reaktion: Du magst Musik und kurze Antworten ohne Emojis. Grund: Präzise antworten, keine Musikrichtung hinzuerfinden.",
  "4. Artikelinhalt: Nur im Beispiel beschreibt das erlaubte Angebot Stadtaufnahmen als digitalen Download. Nachricht: Was bekomme ich da? Antwortanfang: Stadtaufnahmen zum digitalen Herunterladen. Grund: Belegte Leistung zuerst; im echten Gespräch nur aktuelle Artikeldaten und die jeweilige Preisregel verwenden.",
  "5. Informationslücke: Nur im Beispiel fehlt die Anzahl im Artikel. Nachricht: Wie viele Bilder sind dabei? Reaktion: Die Anzahl ist noch nicht hinterlegt; die müsste ich erst klären. Grund: Keine Zahl erfinden oder pauschale Nichtverfügbarkeit behaupten.",
  "6. Kaufabsage: Heute kaufe ich nichts. Reaktion: Passt, dann lassen wir das Angebot für heute. Grund: Nicht erneut pitchen oder abwerten.",
  "7. Customer service: Only in this example a customer wants to move an appointment, with no replacement time confirmed. Message: Can we move it? Reply: Which day would work for you? Grund: Hilfreiche nächste Frage statt erfundenem Termin. Im echten Gespräch gewählte Sprache und Anrede verwenden.",
  "8. Wiederholungs-Kritik: Du schreibst immer dasselbe. Reaktion: Stimmt, ich bin deiner Frage ausgewichen. Grund: Danach die offene Frage konkret beantworten statt wieder respektvollen Austausch zu versprechen. Fehler nur einräumen, wenn der echte Verlauf ihn belegt.",
  "Vor Ausgabe still prüfen: neue Frage beantwortet, freigegebene Stimme getroffen, Antwortvorlieben beachtet, belegte Fakten erhalten, unnötige Wiederholungen entfernt. Bei quality_revision ist previous_drafts ausdrücklich verworfener Modelltext, kein bestätigter Verlauf oder Faktenquelle. Nur die benannten Wiederholungen überarbeiten; ursprüngliche Grenzen und ursprüngliches JSON-Schema gelten weiter. Nur das geforderte Ergebnis ausgeben.",
].join("\n");

export class ReplyQualityError extends Error {
  constructor() { super("reply_quality_rejected"); this.code = "reply_quality_rejected"; }
}
const normalize = value => value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const exactQuestion = value => value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/gu, " ").trim();
const knownInterestQuestions = new Map();
for (const [topic, de, en] of [
  ["music", "Musik", "music"], ["cats", "Katzen", "cats"], ["dogs", "Hunde", "dogs"],
  ["travel", "Reisen", "travel"], ["sports", "Sport", "sports"], ["photos", "Fotos", "photos"],
  ["videos", "Videos", "videos"], ["cooking", "Kochen", "cooking"],
]) {
  for (const question of [
    `Magst du ${de}?`, `Liebst du ${de}?`, `Interessierst du dich für ${de}?`,
    `Do you like ${en}?`, `Do you love ${en}?`, `Are you interested in ${en}?`,
  ]) knownInterestQuestions.set(exactQuestion(question), topic);
}
const allowedNeutralPrefixes = ["", "Danke!", "Alles klar.", "Thanks!", "All right."];
const allowedNeutralSuffixes = ["", "Danke!", "Thanks!"];
const wrappedKnownInterestQuestions = new Map();
for (const [question, topic] of knownInterestQuestions) {
  for (const prefix of allowedNeutralPrefixes) {
    for (const suffix of allowedNeutralSuffixes) {
      wrappedKnownInterestQuestions.set(exactQuestion([prefix, question, suffix].filter(Boolean).join(" ")), topic);
    }
  }
}
const stockOpening = value => normalize(value).match(/^(?:ich verstehe|ich kann verstehen|i understand|danke für deine nachricht|thank you for your message|thank you for reaching out|du bist direkt)\b/u)?.[0];
const substantial = value => value.length >= 80 && value.split(" ").length >= 12;
const quotedPassages = /["“„][^"”“„]*["”“]/gu;
const hypotheticalOpening = /^(?:hypothetisch|hypothetically|angenommen|suppose|wenn ich sagen würde|if i said|if i were to say)\b/u;
const relationalClaims = [
  /^du gehörst (?:nur )?mir$/u,
  /^du bist (?:ganz )?mein(?:e|er|es)?$/u,
  /^you belong to me$/u,
  /^(?:you are|you re) (?:all )?mine$/u,
  /^ich (?:bin|bleibe) nur für dich da$/u,
  /^ich gehöre nur dir$/u,
  /^du brauchst nur mich$/u,
  /^i (?:am|m) only (?:here|there) for you$/u,
  /^i belong only to you$/u,
  /^you only need me$/u,
];
const purchaseConditionedAffection = [
  /\bich (?:liebe|mag) dich (?:wenn|falls|solange|nur wenn) du (?:kaufst|zahlst|bezahlst|bestellst)\b/u,
  /\b(?:wenn|falls|solange|nur wenn) du (?:kaufst|zahlst|bezahlst|bestellst) (?:dann )?(?:liebe|mag) ich dich\b/u,
  /\bi (?:love|like|care about) you (?:if|when|as long as|only if) you (?:buy|purchase|pay|order)\b/u,
  /\b(?:if|when|as long as|only if) you (?:buy|purchase|pay|order) (?:then )?i (?:love|like|care about) you\b/u,
];
function hasRelationshipManipulation(value) {
  const unquoted = value.normalize("NFKC").replace(quotedPassages, " ");
  return unquoted.split(/[.!?;\n]+/u).some(part => {
    const statement = normalize(part);
    if (!statement || hypotheticalOpening.test(statement)) return false;
    return relationalClaims.some(pattern => pattern.test(statement))
      || purchaseConditionedAffection.some(pattern => pattern.test(statement));
  });
}
function nearCopy(left, right) {
  if (!substantial(left) || !substantial(right)) return false;
  const a = new Set(left.split(" ")), b = new Set(right.split(" "));
  // A changed negation or number is a potentially different fact, not evidence
  // that the same answer was copied. Never flatten it into stylistic sameness.
  const factual = word => /^(?:nicht|kein\w*|ohne|nie|no|not|never|without|\d+)$/u.test(word);
  if ([...a, ...b].some(word => factual(word) && a.has(word) !== b.has(word))) return false;
  const common = [...a].filter(word => b.has(word)).length;
  return common / (a.size + b.size - common) >= 0.90;
}
export function assessReplyQuality(replies, recentReplies = [], knownInterests = []) {
  if (!Array.isArray(replies) || replies.length !== 3 || replies.some(value => typeof value !== "string" || !value.trim() || value.length > 4_000)) return ["invalid_replies"];
  const normalized = replies.map(normalize);
  const history = recentReplies.filter(value => typeof value === "string").slice(-6).map(value => normalize(value.slice(0, 4_000)));
  const issues = new Set();
  for (let index = 0; index < normalized.length; index++) {
    for (let other = 0; other < index; other++) {
      if (normalized[index] === normalized[other] || nearCopy(normalized[index], normalized[other])) issues.add("duplicate_variants");
    }
    if (history.some(previous => substantial(normalized[index]) && (previous === normalized[index] || nearCopy(previous, normalized[index])))) issues.add("repeated_reply");
    const opening = stockOpening(replies[index]);
    if (opening && history.filter(previous => stockOpening(previous) === opening).length >= 2) issues.add("repeated_opening");
  }
  if (replies.some(hasRelationshipManipulation)) issues.add("relationship_manipulation");
  const currentTopics = new Set(Array.isArray(knownInterests) ? knownInterests
    .filter(fact => fact && (fact.polarity === "positive" || fact.polarity === "negative"))
    .map(fact => fact.topic) : []);
  if (replies.some(reply => currentTopics.has(wrappedKnownInterestQuestions.get(exactQuestion(reply))))) issues.add("known_interest_question");
  return [...issues];
}

// Preserve complete newest turns instead of truncating an oldest-first string.
export function fitRecentDialogueContext(profileContext, lines, maximum) {
  const prefix = profileContext.slice(0, Math.min(2_000, maximum));
  const retained = [];
  let size = prefix.length + (prefix ? 2 : 0);
  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index];
    if (!line) continue;
    if (size + line.length + (retained.length ? 1 : 0) > maximum) break;
    retained.unshift(line); size += line.length + (retained.length > 1 ? 1 : 0);
  }
  return [prefix, retained.join("\n")].filter(Boolean).join("\n\n");
}

// One optional rewrite only; no retry on provider/validation/transport failure.
// Caller supplies one absolute timeout/abort signal shared by both attempts.
export async function runReplyQualityGate({ generate, readReplies, onAttempt, recentReplies = [], knownInterests = [], inputChars, inputLimit }) {
  let feedback = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    let result, replies, issues;
    try {
      result = await generate(feedback);
      replies = readReplies(result);
      issues = assessReplyQuality(replies, recentReplies, knownInterests);
    } catch (error) {
      await onAttempt({ result, error, feedback });
      throw error;
    }
    await onAttempt({ result, error: issues.length ? new ReplyQualityError() : null, feedback });
    if (!issues.length) return result;
    if (attempt === 1 || issues.includes("invalid_replies") || issues.includes("known_interest_question") || issues.includes("relationship_manipulation")) throw new ReplyQualityError();
    feedback = JSON.stringify({ quality_revision: { issues, previous_drafts: replies } });
    if (inputChars + feedback.length > inputLimit) throw new ReplyQualityError();
  }
  throw new ReplyQualityError();
}

