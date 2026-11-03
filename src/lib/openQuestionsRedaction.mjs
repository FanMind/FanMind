// Defense-in-depth display masking, not a guarantee of full PII anonymization.
// Keep raw content only in the existing restricted source system.
export function redactOpenQuestion(text) {
  return String(text ?? "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[E-Mail entfernt]")
    .replace(/\b(?:https?:\/\/|www\.)[^\s<>]+/gi, "[Link entfernt]")
    .replace(/\b(?:\+?\d[\d\s()./-]{7,}\d)\b/g, "[Telefon/Zahl entfernt]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~-]{12,})\b/gi, "[Zugangsdaten entfernt]");
}
