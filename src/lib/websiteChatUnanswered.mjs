// Conservative signal only: a review candidate, never proof of an unanswered question.
// Do not persist visitor content or personal information in this classifier.
const uncertainty = [
  /(?:ich|wir) (?:weiß|wissen) (?:es |das )?nicht/i,
  /(?:keine|nicht genügend|nicht ausreichend) (?:gesicherte |verlässliche )?(?:information|angaben|daten)/i,
  /(?:kann|können) (?:ich|wir) (?:nicht|leider nicht) (?:sicher |zuverlässig )?beantworten/i,
  /(?:nicht|keine) (?:sicher|verlässlich) (?:beantworten|auskunft)/i,
  /(?:cannot|can't|unable to) (?:answer|confirm|verify)/i,
  /(?:don't|do not) (?:have|know) (?:enough )?(?:information|details)/i,
];
export function classifyWebsiteChatUnanswered(reply) {
  if (typeof reply !== "string" || !reply.trim()) return { candidate: false, reason: "empty_reply" };
  const candidate = uncertainty.some(pattern => pattern.test(reply));
  return { candidate, reason: candidate ? "assistant_uncertainty" : "no_explicit_uncertainty" };
}
