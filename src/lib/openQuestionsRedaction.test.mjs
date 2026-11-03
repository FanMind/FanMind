import test from "node:test";
import assert from "node:assert/strict";
import { redactOpenQuestion } from "./openQuestionsRedaction.mjs";

test("masks synthetic email, link and phone-like content", () => {
  const output = redactOpenQuestion("Kontakt test@example.org, https://example.org/help, +43 660 12345678");
  assert.match(output, /\[E-Mail entfernt\]/);
  assert.match(output, /\[Link entfernt\]/);
  assert.match(output, /\[Telefon\/Zahl entfernt\]/);
  assert.doesNotMatch(output, /https?:\/\/|www\./i);
  assert.doesNotMatch(output, /\b\d{8,}\b/);
});

test("masks synthetic API key-like content", () => {
  const output = redactOpenQuestion("Mein Schlüssel: sk-12345678901234567890");
  assert.equal(output, "Mein Schlüssel: [Zugangsdaten entfernt]");
});
