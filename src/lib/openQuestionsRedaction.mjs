// Defense-in-depth display masking, not a guarantee of full PII anonymization.
// Keep raw content only in the existing restricted source system.
export function redactOpenQuestion(text) {
  return String(text ?? "")
    // Specific credentials must run before generic number masking.
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~-]{12,}|gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/gi, "[Zugangsdaten entfernt]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[E-Mail entfernt]")
    // Do not require a word boundary: attackers can prefix a URL with a word character.
    .replace(/(?:https?:\/\/|www\.)[^\s<>]+/gi, "[Link entfernt]")
    .replace(/^(\s*)\p{Lu}[\p{L}'’-]{1,39}\s+\p{Lu}[\p{L}'’-]{1,39}(\s*[.!?]?\s*)$/u, "$1[Name entfernt]$2")
    .replace(/\b(?:Name|Kontaktperson|Ansprechpartner(?:in)?|Patient(?:in)?)\s*:\s*\p{Lu}[\p{L}'’-]{1,39}(?:\s+\p{Lu}[\p{L}'’-]{1,39})+\b/giu, "[Name entfernt]")
    .replace(/\b\p{Lu}[\p{L}.'’-]{1,50}(?:straße|strasse|str\.|gasse|weg|platz|allee)\s+\d{1,5}[a-z]?(?:\s*,?\s*\d{4,5}\s+\p{Lu}[\p{L}.'’-]{1,50})?/giu, "[Adresse entfernt]")
    .replace(/\b(?:Diagnose|HIV(?:-positiv)?|Krankheit|Therapie|Medikament|psychische(?:r|s)?\s+Zustand)\b[^.!?\n]*/giu, "[Sensibler Inhalt entfernt]")
    .replace(/\b(?:\+?\d[\d\s()./-]{7,}\d)\b/g, "[Telefon/Zahl entfernt]");
}
