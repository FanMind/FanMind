import test from "node:test";
import assert from "node:assert/strict";
import { redactOpenQuestion } from "./openQuestionsRedaction.mjs";

test("masks synthetic email, link and phone-like content", () => {
  const output = redactOpenQuestion("Kontakt test@example.org, https://example.org/help, +43 660 12345678");
  assert.ok(!output.includes("test@example.org"));
  assert.ok(!output.includes("https://example.org/help"));
  assert.ok(!output.includes("12345678"));
});

test("masks synthetic API key-like content", () => {
  const output = redactOpenQuestion("Mein Schlüssel: sk-12345678901234567890");
  assert.ok(!output.includes("sk-12345678901234567890"));
});
