import test from "node:test";
import assert from "node:assert/strict";
import { redactOpenQuestion } from "./openQuestionsRedaction.mjs";

test("masks synthetic email, embedded link and phone-like content", () => {
  const output = redactOpenQuestion("Kontakt test@example.org, prefixhttps://example.org/help, +43 660 12345678");
  assert.equal(output, "Thema: Allgemeine Supportfrage");
  assert.doesNotMatch(output, /test@example|prefix|660/iu);
  assert.doesNotMatch(output, /https?:\/\/|www\./i);
  assert.doesNotMatch(output, /\b\d{8,}\b/);
});

test("masks credentials before generic numbers", () => {
  assert.equal(
    redactOpenQuestion("Mein Schlüssel: sk-12345678901234567890"),
    "Thema: Allgemeine Supportfrage",
  );
  assert.equal(
    redactOpenQuestion("Bearer abcdefghijklmnopqrstuvwxyz"),
    "Thema: Allgemeine Supportfrage",
  );
  assert.equal(
    redactOpenQuestion("AKIAIOSFODNN7EXAMPLE"),
    "Thema: Allgemeine Supportfrage",
  );
});

test("withholds names in sentences, addresses, health data and free identifiers", () => {
  for (const input of [
    "Anna Musterfrau", "Name: Max Mustermann",
    "Bitte kontaktieren Sie Anna Musterfrau morgen", "Ich heiße Anna Musterfrau",
    "Musterstrasse 12, 8000 Zürich", "Diagnose: HIV-positiv",
    "Kundennummer ABC-123-XYZ",
  ]) {
    assert.equal(redactOpenQuestion(input), "Thema: Allgemeine Supportfrage");
    assert.doesNotMatch(redactOpenQuestion(input), /Anna|Muster|HIV|ABC-123/iu);
  }
});

test("emits only fixed privacy-reviewed topic labels", () => {
  assert.equal(redactOpenQuestion("Wie bezahle ich meine Rechnung?"), "Thema: Abrechnung");
  assert.equal(redactOpenQuestion("Wo ist der Datenexport?"), "Thema: Datenexport");
  assert.equal(redactOpenQuestion("Warum lädt die Übersicht nicht?"), "Thema: Technische Hilfe");
});
