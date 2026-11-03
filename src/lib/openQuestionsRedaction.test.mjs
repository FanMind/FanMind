import test from "node:test";
import assert from "node:assert/strict";
import { redactOpenQuestion } from "./openQuestionsRedaction.mjs";

test("masks synthetic email, embedded link and phone-like content", () => {
  const output = redactOpenQuestion("Kontakt test@example.org, prefixhttps://example.org/help, +43 660 12345678");
  assert.match(output, /\[E-Mail entfernt\]/);
  assert.match(output, /prefix\[Link entfernt\]/);
  assert.match(output, /\[Telefon\/Zahl entfernt\]/);
  assert.doesNotMatch(output, /https?:\/\/|www\./i);
  assert.doesNotMatch(output, /\b\d{8,}\b/);
});

test("masks credentials before generic numbers", () => {
  assert.equal(
    redactOpenQuestion("Mein Schlüssel: sk-12345678901234567890"),
    "Mein Schlüssel: [Zugangsdaten entfernt]",
  );
  assert.equal(
    redactOpenQuestion("Bearer abcdefghijklmnopqrstuvwxyz"),
    "[Zugangsdaten entfernt]",
  );
  assert.equal(
    redactOpenQuestion("AKIAIOSFODNN7EXAMPLE"),
    "[Zugangsdaten entfernt]",
  );
});

test("masks defined synthetic names, addresses and health data", () => {
  assert.equal(redactOpenQuestion("Anna Musterfrau"), "[Name entfernt]");
  assert.equal(redactOpenQuestion("Name: Max Mustermann"), "[Name entfernt]");
  assert.equal(redactOpenQuestion("Musterstrasse 12, 8000 Zürich"), "[Adresse entfernt]");
  assert.equal(redactOpenQuestion("Diagnose: HIV-positiv"), "[Sensibler Inhalt entfernt]");
});

test("does not claim anonymization or suppress ordinary support questions", () => {
  assert.equal(redactOpenQuestion("Wie ändere ich meine Rechnungsadresse?"), "Wie ändere ich meine Rechnungsadresse?");
});
