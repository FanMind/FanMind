import test from "node:test";
import assert from "node:assert/strict";
import { classifyWebsiteChatUnanswered } from "./websiteChatUnanswered.mjs";

test("marks explicit lack of information as candidate", () => {
  assert.equal(classifyWebsiteChatUnanswered("Ich weiß das nicht. Ich kann einen Menschen hinzuziehen.").candidate, true);
});
test("does not flag a regular answer", () => {
  assert.equal(classifyWebsiteChatUnanswered("Die Öffnungszeiten sind Montag bis Freitag.").candidate, false);
});
test("does not flag empty or non-text replies", () => {
  assert.equal(classifyWebsiteChatUnanswered("").candidate, false);
  assert.equal(classifyWebsiteChatUnanswered(null).candidate, false);
});
